import os
import time
import asyncio
import logging
from typing import Optional
from urllib.parse import quote

import httpx
from curl_cffi.requests import AsyncSession

import proxy_manager
from state import get_setting, save_setting

logger = logging.getLogger(__name__)

ZT_DOMAIN = 'zone-telechargement.org'
CACHE_TTL = 600
BLOCK_MARKERS = ('cf-error-details', 'Just a moment...', 'challenge-platform', 'Attention Required! | Cloudflare')

_cache: dict = {}
_sem = asyncio.Semaphore(6)
last_status: dict = {}


def is_blocked(status: int, text: str) -> bool:
    if status != 200 or not text:
        return True
    head = text[:6000]
    return any(m in head for m in BLOCK_MARKERS)


async def get_settings() -> dict:
    doc = get_setting('fetch', {})
    relays = list(doc.get('relays') or [])
    env_relay = os.environ.get('ZT_RELAY_URL')
    if env_relay and not any(r.get('url') == env_relay for r in relays):
        relays.append({'url': env_relay, 'key': os.environ.get('ZT_RELAY_KEY', '')})
    return {
        'relays': [r for r in relays if r.get('url')],
        'scraperapi_key': doc.get('scraperapi_key') or os.environ.get('SCRAPERAPI_KEY', ''),
        'direct': doc.get('direct', True),
    }


async def save_settings(relays: list, scraperapi_key: str, direct: bool):
    save_setting('fetch', {
        'relays': relays,
        'scraperapi_key': scraperapi_key,
        'direct': direct,
    })
    _cache.clear()


async def _via_relay(relay: dict, url: str, timeout: int):
    sep = '&' if '?' in relay['url'] else '?'
    target = f"{relay['url']}{sep}url={quote(url, safe='')}&key={quote(relay.get('key') or '', safe='')}"
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, verify=False) as c:
        r = await c.get(target, headers={'User-Agent': 'ZTSearch-Relay-Client/1.0'})
        return r.status_code, r.text


async def _via_scraperapi(key: str, url: str, timeout: int):
    target = f"https://api.scraperapi.com/?api_key={quote(key)}&country_code=fr&url={quote(url, safe='')}"
    async with httpx.AsyncClient(timeout=max(timeout, 60), verify=False) as c:
        r = await c.get(target)
        return r.status_code, r.text


async def _direct(url: str, timeout: int):
    async with AsyncSession(impersonate='chrome', timeout=timeout, verify=False) as s:
        r = await s.get(url, headers={'Accept-Language': 'fr-FR,fr;q=0.9'})
        return r.status_code, r.text


async def _via_proxy(url: str, timeout: int):
    status, text, proxy = await proxy_manager.fetch(url, timeout)
    if proxy:
        last_status['proxy'] = proxy
    return status, text


def _sources(settings: dict, url: str) -> list:
    relays = [(f"relay:{r['url']}", lambda u, t, r=r: _via_relay(r, u, t)) for r in settings['relays']]
    api = [('scraperapi', lambda u, t: _via_scraperapi(settings['scraperapi_key'], u, t))] if settings['scraperapi_key'] else []
    direct = [('direct', _direct)] if settings['direct'] or ZT_DOMAIN not in url else []
    if ZT_DOMAIN in url:
        # proxy pool first (free Cloudflare bypass), then relays/api, then direct
        return [('proxy', _via_proxy)] + relays + api + direct
    return direct + relays


async def fetch(url: str, timeout: int = 20, settings: Optional[dict] = None) -> Optional[str]:
    hit = _cache.get(url)
    if hit and time.time() - hit[0] < CACHE_TTL:
        return hit[1]
    settings = settings or await get_settings()
    errors = []
    async with _sem:
        for name, fn in _sources(settings, url):
            try:
                status, text = await fn(url, timeout)
                if not is_blocked(status, text):
                    _cache[url] = (time.time(), text)
                    last_status.update({'ok': True, 'source': name, 'at': time.time(), 'errors': errors})
                    return text
                errors.append(f"{name}: HTTP {status} bloqué")
            except Exception as e:
                errors.append(f"{name}: {type(e).__name__} {str(e)[:120]}")
    if ZT_DOMAIN in url:
        last_status.update({'ok': False, 'source': None, 'at': time.time(), 'errors': errors})
    logger.warning(f"fetch failed {url}: {errors}")
    return None


async def fetch_many(urls: list, timeout: int = 20) -> dict:
    unique = list(set(filter(None, urls)))
    settings = await get_settings()
    texts = await asyncio.gather(*(fetch(u, timeout, settings) for u in unique))
    return dict(zip(unique, texts))


async def fetch_post(url: str, data: dict, timeout: int = 20) -> Optional[str]:
    """POST fetch (DLE search) routed through the proxy pool, with a direct fallback."""
    key = url + '|' + repr(sorted(data.items()))
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_TTL:
        return hit[1]
    errors = []
    async with _sem:
        try:
            status, text, proxy = await proxy_manager.fetch(url, timeout, method='POST', data=data)
            if proxy and not is_blocked(status, text):
                _cache[key] = (time.time(), text)
                last_status.update({'ok': True, 'source': 'proxy', 'proxy': proxy,
                                    'at': time.time(), 'errors': []})
                return text
            errors.append('proxy: no working proxy / blocked')
        except Exception as e:
            errors.append(f"proxy: {type(e).__name__} {str(e)[:120]}")
        try:
            async with AsyncSession(impersonate='chrome', timeout=timeout, verify=False) as s:
                r = await s.post(url, data=data, headers={'Accept-Language': 'fr-FR,fr;q=0.9'})
                if not is_blocked(r.status_code, r.text):
                    _cache[key] = (time.time(), r.text)
                    last_status.update({'ok': True, 'source': 'direct', 'at': time.time(), 'errors': []})
                    return r.text
                errors.append(f"direct: HTTP {r.status_code} bloqué")
        except Exception as e:
            errors.append(f"direct: {type(e).__name__} {str(e)[:120]}")
    last_status.update({'ok': False, 'source': None, 'at': time.time(), 'errors': errors})
    logger.warning(f"fetch_post failed {url}: {errors}")
    return None


async def test_sources(url: str) -> list:
    settings = await get_settings()
    out = []
    for name, fn in _sources(settings, url):
        t0 = time.time()
        try:
            status, text = await fn(url, 25)
            out.append({'source': name, 'http_code': status, 'ok': not is_blocked(status, text),
                        'ms': int((time.time() - t0) * 1000), 'bytes': len(text or '')})
        except Exception as e:
            out.append({'source': name, 'ok': False, 'error': f"{type(e).__name__} {str(e)[:150]}",
                        'ms': int((time.time() - t0) * 1000)})
    return out
