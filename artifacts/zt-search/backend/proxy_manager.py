"""Free proxy pool manager to bypass Cloudflare on zone-telechargement.org.

Maintains a rotating pool of working proxies. Seeds from a bundled file + MongoDB,
and self-refreshes by downloading public free-proxy lists and validating them
against the real .org domain (so only proxies that actually bypass Cloudflare are kept).
"""
import os
import time
import asyncio
import logging
from pathlib import Path

import httpx
from curl_cffi.requests import AsyncSession
from state import get_proxies, save_proxies

logger = logging.getLogger(__name__)

ROOT = Path(__file__).parent
SEED_FILE = ROOT / 'proxy_seed.txt'

VALIDATE_URL = 'https://www.zone-telechargement.org/?p=films&search=avatar'
VALIDATE_MARKER = 'cover_global'

TARGET_POOL = 40          # stop validating once we have this many working proxies
MIN_POOL = 12             # refill when pool drops below this
REFILL_COOLDOWN = 120     # seconds between refill attempts
VALIDATE_CONCURRENCY = 250
VALIDATE_TIMEOUT = 11
DB_FRESH_SECONDS = 6 * 3600

# Public free-proxy lists (scheme-tagged so we know how to dial them)
PROXY_SOURCES = [
    ('socks5', 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt'),
    ('socks4', 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt'),
    ('http', 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt'),
    ('socks5', 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt'),
    ('socks4', 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks4.txt'),
    ('http', 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt'),
    ('socks5', 'https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/protocols/socks5/data.txt'),
    ('http', 'https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/protocols/http/data.txt'),
    ('socks5', 'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt'),
]

_pool: list = []
_idx = 0
_refill_lock = asyncio.Lock()
_last_refill = 0.0
_loaded_db = False

stats = {'pool': 0, 'last_refill': 0, 'last_refill_found': 0, 'validations': 0}


def _normalize(scheme: str, line: str) -> str:
    line = line.strip()
    if not line or line.startswith('#'):
        return ''
    if '://' not in line:
        line = f'{scheme}://{line}'
    return line.replace('socks5://', 'socks5h://')


async def _load_seed() -> list:
    out = []
    if SEED_FILE.exists():
        for line in SEED_FILE.read_text().splitlines():
            n = _normalize('socks5', line)
            if n:
                out.append(n)
    return out


async def _load_db(fresh_only: bool = True) -> list:
    fresh_after = time.time() - DB_FRESH_SECONDS if fresh_only else None
    return get_proxies(fresh_after)


async def _download_sources() -> list:
    out = []
    async with httpx.AsyncClient(timeout=15, verify=False, follow_redirects=True) as c:
        async def grab(scheme, url):
            try:
                r = await c.get(url)
                if r.status_code == 200:
                    for line in r.text.splitlines():
                        n = _normalize(scheme, line)
                        if n:
                            out.append(n)
            except Exception:
                pass
        await asyncio.gather(*(grab(s, u) for s, u in PROXY_SOURCES))
    return out


async def _validate(candidates: list, target: int) -> list:
    """Probe candidates against the real .org domain. Early-stop at `target`."""
    working: list = []
    sem = asyncio.Semaphore(VALIDATE_CONCURRENCY)
    done = asyncio.Event()

    async def probe(p):
        if done.is_set():
            return
        async with sem:
            if done.is_set():
                return
            try:
                async with AsyncSession(impersonate='chrome', proxy=p,
                                        timeout=VALIDATE_TIMEOUT, verify=False) as s:
                    r = await s.get(VALIDATE_URL)
                    if r.status_code == 200 and VALIDATE_MARKER in r.text:
                        working.append(p)
                        if len(working) >= target:
                            done.set()
            except Exception:
                pass

    # de-dup while keeping order
    seen = set()
    uniq = [p for p in candidates if not (p in seen or seen.add(p))]
    stats['validations'] = len(uniq)
    await asyncio.gather(*(probe(p) for p in uniq))
    return working


async def _persist(working: list):
    if working:
        try:
            save_proxies(working, time.time())
        except Exception as e:
            logger.warning(f'proxy persist failed: {e}')


async def refill(block: bool = False) -> int:
    """Rebuild the working pool. Returns number of working proxies found."""
    global _last_refill, _pool, _idx
    if _refill_lock.locked() and not block:
        return len(_pool)
    async with _refill_lock:
        if time.time() - _last_refill < REFILL_COOLDOWN and _pool:
            return len(_pool)
        _last_refill = time.time()

        # Tier 1: cheap & fast — DB + seed
        candidates = await _load_db(fresh_only=False) + await _load_seed()
        working = await _validate(candidates, TARGET_POOL)

        # Tier 2: if still short, pull fresh lists from the internet
        if len(working) < MIN_POOL:
            logger.info('proxy pool low, downloading fresh lists...')
            downloaded = await _download_sources()
            extra = await _validate([p for p in downloaded if p not in working],
                                    TARGET_POOL - len(working))
            working.extend(extra)

        if working:
            _pool = working
            _idx = 0
            await _persist(working)
        stats.update({'pool': len(_pool), 'last_refill': int(_last_refill),
                      'last_refill_found': len(working)})
        logger.info(f'proxy refill done: {len(working)} working proxies')
        return len(working)


async def _ensure_loaded():
    global _loaded_db, _pool
    if not _loaded_db:
        _loaded_db = True
        _pool = await _load_db(fresh_only=True)
        stats['pool'] = len(_pool)


async def ensure_pool() -> bool:
    """Guarantee the pool has usable proxies (bounded wait on cold start)."""
    await _ensure_loaded()
    if len(_pool) >= MIN_POOL:
        return True
    await refill(block=True)
    return len(_pool) > 0


def _next() -> str:
    global _idx
    if not _pool:
        return ''
    p = _pool[_idx % len(_pool)]
    _idx += 1
    return p


def report_bad(proxy: str):
    if proxy in _pool:
        try:
            _pool.remove(proxy)
            stats['pool'] = len(_pool)
        except ValueError:
            pass


async def fetch(url: str, timeout: int = 20, attempts: int = 8,
                method: str = 'GET', data=None):
    """Fetch url through rotating working proxies. Returns (status, text, proxy)."""
    await ensure_pool()
    tried = 0
    while tried < attempts:
        p = _next()
        if not p:
            await refill(block=True)
            p = _next()
            if not p:
                break
        try:
            async with AsyncSession(impersonate='chrome', proxy=p,
                                    timeout=timeout, verify=False) as s:
                hdrs = {'Accept-Language': 'fr-FR,fr;q=0.9'}
                if method == 'POST':
                    r = await s.post(url, data=data, headers=hdrs)
                else:
                    r = await s.get(url, headers=hdrs)
                if r.status_code in (200, 404) and 'cf-error-details' not in r.text[:4000] \
                        and 'Just a moment' not in r.text[:4000]:
                    return r.status_code, r.text, p
                report_bad(p)
        except Exception:
            report_bad(p)
        tried += 1
        if len(_pool) < MIN_POOL:
            asyncio.create_task(refill())
    return 0, '', None


async def fetch_bytes(url: str, timeout: int = 15, attempts: int = 6):
    """Fetch binary content (images) through rotating proxies. Returns (status, bytes, content_type, proxy)."""
    await ensure_pool()
    tried = 0
    while tried < attempts:
        p = _next()
        if not p:
            await refill(block=True)
            p = _next()
            if not p:
                break
        try:
            async with AsyncSession(impersonate='chrome', proxy=p,
                                    timeout=timeout, verify=False) as s:
                r = await s.get(url, headers={
                    'Accept-Language': 'fr-FR,fr;q=0.9',
                    'Referer': 'https://www.zone-telechargement.org/',
                    'Accept': 'image/avif,image/webp,image/png,image/*,*/*;q=0.8',
                })
                ct = r.headers.get('content-type', '') if hasattr(r, 'headers') else ''
                if r.status_code == 200 and r.content and ct.startswith('image'):
                    return r.status_code, r.content, ct, p
                report_bad(p)
        except Exception:
            report_bad(p)
        tried += 1
    return 0, b'', '', None


async def warmup():
    """Kick a refill in the background at startup."""
    try:
        await refill(block=True)
    except Exception as e:
        logger.warning(f'proxy warmup failed: {e}')