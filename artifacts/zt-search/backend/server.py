from fastapi import FastAPI, APIRouter, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import re
import time
import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any
from urllib.parse import urlencode, quote, urlparse
import httpx
import base64
from fastapi import Header, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from secrets import compare_digest

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
import fetcher  # noqa: E402

app = FastAPI()
api_router = APIRouter(prefix="/api")
liens_router = APIRouter()


@app.get("/", include_in_schema=False)
async def root_health():
    return {"status": "ok"}


# Config
BASE_URL = 'https://www.zone-telechargement.org'
FETCH_TIMEOUT = 15
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'

# Image proxy in-memory cache: url -> (ts, bytes, content_type)
_img_cache: dict = {}

# Host patterns
HOST_PATTERNS = {
    '1fichier': '1Fichier', 'uptobox': 'Uptobox', 'turbobit': 'Turbobit',
    'trbt.cc': 'Turbobit', 'rapidgator': 'Rapidgator', 'uploaded.net': 'Uploaded',
    'uploaded.to': 'Uploaded', 'ul.to': 'Uploaded', 'nitroflare': 'Nitroflare',
    'nitro.download': 'Nitroflare', 'uploady': 'Uploady', 'dailyuploads': 'Dailyuploads',
    'fileserve': 'Fileserve', 'mediafire': 'Mediafire', 'send.now': 'Send.now',
    'send.cm': 'Send.cm', 'gofile': 'Gofile', 'multiup': 'Multiup', 'qiwi': 'Qiwi',
    'mega.nz': 'Mega', 'mega.co': 'Mega', 'k2s.cc': 'Keep2Share',
    'keep2share': 'Keep2Share', 'doodstream': 'Doodstream', 'dood.watch': 'Doodstream',
    'dood.la': 'Dood.la', 'dood.so': 'Dood.so', 'dood.re': 'Dood.re',
    'dsvplay': 'DSV Play', 'dsv.la': 'DSV Play', 'lulustream': 'Lulustream',
    'luluvdo': 'Lulustream', 'luluvid': 'Lulustream', 'voe.sx': 'Voe',
    'embedseek': 'EmbedSeek', 'seekstreaming': 'Seekstreaming',
    'rdh.embedseek': 'Seekstreaming', 'streamtape': 'Streamtape', 'vidoza': 'Vidoza',
    'uqload': 'Uqload', 'mixdrop': 'MixDrop', 'filemoon': 'FileMoon', 'sibnet': 'Sibnet',
}

STREAM_HOST_PATTERNS = [
    'doodstream', 'dood.la', 'dood.so', 'dood.re', 'dsvplay', 'dsv.la',
    'lulustream', 'luluvdo', 'luluvid', 'voe.sx', 'embedseek', 'seekstreaming',
    'streamtape', 'vidoza', 'uqload', 'mixdrop', 'filemoon', 'sibnet',
]

PROTECTION_PATTERNS = {
    'zoneurs.net': 'zoneurs', 'protect-lien': 'dl-protect',
    'dl-protect': 'dl-protect', 'liens-telechargement': 'dl-protect', 'linkpoi': 'dl-protect',
}

BLACKLIST_DOMAINS = [
    'youtube.com', 'youtu.be', 'twitter.com', 'x.com', 't.co',
    'facebook.com', 'fb.com', 'instagram.com', 'tiktok.com',
    'google.com', 'google.fr', 'telegram.me', 't.me',
    'discord.gg', 'discord.com', 'themoviedb.org', 'imdb.com',
    'allocine.fr', 'pastebin.com', 'bit.ly', 'tinyurl',
    'adf.ly', 'linkvertise', 'sh.st', 'vpnmentor', 'nordvpn', 'expressvpn', 'cyberghost',
]

BLACKLIST_TEXT = [
    'bande annonce', 'bande-annonce', 'trailer', 'teaser',
    'vpn gratuit', 'vpn offert', 'protection vpn',
    'abonnez', 'subscribe', 'newsletter', 'installer', 'download app',
    'tweet', 'share', 'partager', 'anonymement', 'anonymat',
    'lien premium', 'streaming anonyme', 'anonyme',
    'signaler un problème', 'lien mort', 'commentaire',
    'créer un compte', 'mot de passe oublié', 'être notifié',
]

# Category registry
def zt_category_registry():
    return {
        'movie': {
            'label': 'Films', 'tmdb': True,
            'subs': {
                'film': 'Tous les films',
            }
        },
        'tv': {
            'label': 'Séries', 'tmdb': True,
            'subs': {
                'serie': 'Toutes les séries',
            }
        },
        'anime': {
            'label': 'Animes', 'tmdb': True,
            'subs': {
                'manga': 'Tous les animes',
            }
        },
        'jeux': {
            'label': 'Jeux', 'tmdb': False,
            'subs': {
                'jeu': 'Tous les jeux',
            }
        },
        'musique': {
            'label': 'Musiques', 'tmdb': False,
            'subs': {
                'musique': 'Toutes les musiques',
            }
        },
        'ebook': {
            'label': 'Ebooks', 'tmdb': False,
            'subs': {
                'ebook': 'Tous les ebooks',
            }
        },
        'logiciel': {
            'label': 'Logiciels', 'tmdb': False,
            'subs': {
                'logiciel': 'Tous les logiciels',
            }
        },
        'documentaire': {
            'label': 'Documentaires', 'tmdb': False,
            'subs': {
                'autre-video': 'Documentaires & Autres',
            }
        },
        'emission': {
            'label': 'Emissions TV', 'tmdb': False,
            'subs': {
                'autre-video': 'Emissions TV',
            }
        },
        'spectacle': {
            'label': 'Spectacles', 'tmdb': False,
            'subs': {
                'autre-video': 'Spectacles',
            }
        },
        'concert': {
            'label': 'Concerts', 'tmdb': False,
            'subs': {
                'autre-video': 'Concerts',
            }
        },
        'sport': {
            'label': 'Sport', 'tmdb': False,
            'subs': {
                'autre-video': 'Sport',
            }
        },
    }


def normalize_type_alias(t: str) -> str:
    aliases = {
        'films': 'movie', 'film': 'movie', 'movie': 'movie', 'movies': 'movie',
        'series': 'tv', 'serie': 'tv', 'tv': 'tv', 'séries': 'tv', 'série': 'tv',
        'animes': 'anime', 'anime': 'anime', 'manga': 'anime', 'mangas': 'anime',
        'jeux': 'jeux', 'jeu': 'jeux', 'games': 'jeux', 'game': 'jeux',
        'jeux-pc': 'jeux', 'jeux-consoles': 'jeux',
        'musique': 'musique', 'musiques': 'musique', 'music': 'musique',
        'ebook': 'ebook', 'ebooks': 'ebook', 'livre': 'ebook',
        'logiciel': 'logiciel', 'logiciels': 'logiciel', 'software': 'logiciel',
        'documentaire': 'documentaire', 'documentaires': 'documentaire',
        'emission': 'emission', 'emissions': 'emission',
        'spectacle': 'spectacle', 'spectacles': 'spectacle',
        'concert': 'concert', 'concerts': 'concert',
        'sport': 'sport', 'sports': 'sport',
        'autoformation': 'logiciel',
    }
    return aliases.get(t.lower(), 'movie')


def zt_search_section(type_: str) -> str:
    t = normalize_type_alias(type_)
    section_map = {
        'movie': 'films', 'tv': 'series', 'anime': 'mangas',
        'jeux': 'jeux', 'musique': 'musiques', 'ebook': 'ebooks',
        'logiciel': 'logiciels', 'documentaire': 'autres-videos',
        'emission': 'autres-videos', 'spectacle': 'autres-videos',
        'concert': 'autres-videos', 'sport': 'autres-videos',
    }
    return section_map.get(t, 'films')


def type_to_categories(type_: str) -> list:
    t = normalize_type_alias(type_)
    cat_map = {
        'movie': ['film'], 'tv': ['serie'], 'anime': ['manga'],
        'jeux': ['jeu'], 'musique': ['musique'], 'ebook': ['ebook'],
        'logiciel': ['logiciel'], 'documentaire': ['autre-video'],
        'emission': ['autre-video'], 'spectacle': ['autre-video'],
        'concert': ['autre-video'], 'sport': ['autre-video'],
    }
    return cat_map.get(t, ['film'])


def hd(s: str) -> str:
    import html
    return html.unescape(s)


def clean_title(t: str) -> str:
    t = hd(t)
    t = re.sub(r'\[.*?\]', '', t)
    t = re.sub(r'\s*\((TRUEFRENCH|VOSTFR|VOSTF|MULTI|FRENCH|VF|VO|HD|4K|1080p?|720p?|WEBRIP|WEB-?DL|BDRIP|BLURAY|HDLIGHT)\)\s*', ' ', t, flags=re.I)
    t = re.sub(r'[-–]?\s*(?:saison|season)\s*\d+', '', t, flags=re.I)
    t = re.sub(r'[-–]?\s*s\d{1,2}(?:\s*[-–]?\s*e?\d{1,2})?(?!\w)', '', t, flags=re.I)
    t = re.sub(r'\s*[-–]\s*(TRUEFRENCH|VOSTFR|VOSTF|MULTI|FRENCH|VF|VO)\s*(HD|4K|1080p?|720p?|UHD)?\s*', ' ', t, flags=re.I)
    t = re.sub(r'\s+(TRUEFRENCH|VOSTFR|VOSTF|MULTI|FRENCH)\s*$', '', t, flags=re.I)
    t = re.sub(r'[-–]?\s*(HD|4K|1080p?|720p?|UHD|WEBRIP|WEB[-\s]?DL|BDRIP|HDRIP|DVDRIP|BLURAY|BLU[-\s]?RAY|HDLIGHT|HDTS|CAM|TS|X265|X264|ULTRA\s*HD)\s*$', '', t, flags=re.I)
    t = re.sub(r'\s+', ' ', t)
    return t.strip('-–: ')


def extract_year(t: str) -> str:
    m = re.search(r'\b(19\d{2}|20\d{2})\b', t)
    return m.group(1) if m else ''


def extract_season_episode(text: str) -> dict:
    se = {'season': None, 'episode': None}
    m = re.search(r'\bS(\d{1,2})E(\d{1,3})\b', text, re.I)
    if m:
        se['season'] = int(m.group(1))
        se['episode'] = int(m.group(2))
        return se
    m = re.search(r'(?:saison|season)\s*(\d{1,2})', text, re.I)
    if m:
        se['season'] = int(m.group(1))
    m = re.search(r'\b(?:épisode|episode|ép\.?|ep\.?)\s*(\d{1,3})', text, re.I)
    if m:
        se['episode'] = int(m.group(1))
    return se


def decode_zoneurs(url: str) -> str:
    m = re.match(r'^https?://(?:www\.)?zoneurs\.net/\?url=([A-Za-z0-9%+/=_-]+)', url, re.I)
    if not m:
        return url
    b64 = m.group(1)
    try:
        decoded = base64.b64decode(b64).decode('utf-8', errors='ignore')
        if re.match(r'^https?://', decoded, re.I):
            return decoded
    except Exception:
        pass
    try:
        b64s = b64.replace('-', '+').replace('_', '/')
        pad = len(b64s) % 4
        if pad:
            b64s += '=' * (4 - pad)
        decoded = base64.b64decode(b64s).decode('utf-8', errors='ignore')
        if re.match(r'^https?://', decoded, re.I):
            return decoded
    except Exception:
        pass
    return url


def extract_host_and_protection(href: str, text_src: str = '') -> dict:
    hlow = href.lower()
    tlow = text_src.lower()

    protection = ''
    for pat, label in PROTECTION_PATTERNS.items():
        if pat in hlow:
            protection = label
            break

    real = decode_zoneurs(href)
    rlow = real.lower()

    host = ''
    for pat, label in HOST_PATTERNS.items():
        if tlow and pat in tlow:
            host = label
            break
    if not host:
        for pat, label in HOST_PATTERNS.items():
            if pat in rlow:
                host = label
                break
    if not host:
        for pat, label in HOST_PATTERNS.items():
            if pat in hlow:
                host = label
                break
    if not host:
        parsed = urlparse(real)
        if parsed.hostname:
            h = re.sub(r'^(?:www\d*|dl\d*|cdn\d*|files?\d*)\.', '', parsed.hostname.lower())
            parts = h.split('.')
            host = parts[0].capitalize() if parts else ''

    return {'host': host, 'protection': protection, 'realUrl': real}


def is_valid_link(url: str, link_text: str = '') -> bool:
    if not url or url == '#':
        return False
    if re.match(r'^(?:javascript|mailto|tel|data):', url, re.I):
        return False
    if url.startswith('//'):
        url = 'https:' + url
    elif not url.startswith('http'):
        return False

    url_low = url.lower()
    text_low = link_text.lower()

    for bd in BLACKLIST_DOMAINS:
        if bd in url_low:
            return False
    for bt in BLACKLIST_TEXT:
        if bt in text_low:
            return False

    if len(url) < 12:
        return False
    if re.search(r'\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|woff|ttf)(\?|$)', url, re.I):
        return False
    return True


def is_stream_host(url: str) -> bool:
    low = url.lower()
    for pat in STREAM_HOST_PATTERNS:
        if pat in low:
            return True
    return False


# HTTP helpers (relais -> ScraperAPI -> direct)
async def http_fetch(url: str, timeout: int = FETCH_TIMEOUT) -> Optional[str]:
    return await fetcher.fetch(url, timeout)


async def http_fetch_multi(urls: list, timeout: int = FETCH_TIMEOUT) -> dict:
    return await fetcher.fetch_many(urls, timeout)


# Section-prefix → normalized type (new .org SEO URL scheme /{section}/{id}-{slug}.html)
SECTION_TYPE = {
    'top-films': 'movie', 'film-gratuit': 'movie', 'nouveaux-films': 'movie',
    'film-mkv': 'movie', 'web-2160p-1080p-720p': 'movie',
    'derniers-web-dl-ajoutes': 'movie', 'derniers-blu-rays-ajoutes': 'movie',
    'dernieres-series-vf-ajoutees': 'tv', 'dernieres-series-vostfr-ajoutees': 'tv',
    'telecharger-serie': 'tv', 'ancienne-serie': 'tv', 'series': 'tv',
    'animes': 'anime', 'manga': 'anime',
    'jeux-gratuit': 'jeux', 'derniers-jeux-ajoutes': 'jeux',
    'musique-mp3-gratuite': 'musique', 'musique': 'musique',
    'ebooks': 'ebook', 'ebook': 'ebook',
    'logiciels': 'logiciel',
    'documentaire-gratuit': 'documentaire', 'spectacles': 'spectacle',
    'emissions-tv': 'emission', 'sport': 'sport',
}


# Scrape listing (new cover_global card layout)
def scrape_listing(html: str, base_url: str = BASE_URL) -> list:
    if not html:
        return []
    results = []
    seen = set()

    link_re = re.compile(
        r'href=["\'](https?://[^"\']*zone-telechargement[^"\']*/[a-z0-9-]+/\d+-[^"\']+?\.html)["\']',
        re.I)
    img_re = re.compile(r'<img[^>]*class=["\']mainimg["\'][^>]*src=["\']([^"\']+)["\']', re.I)
    anchor_re = re.compile(r'<a[^>]+href=["\'][^"\']+\.html["\'][^>]*>(.*?)</a>', re.I | re.S)

    blocks = re.split(r'<div[^>]*class=["\']cover_global', html, flags=re.I)
    for block in blocks[1:]:
        # cut at next footer/sidebar boundary just in case
        lm = link_re.search(block)
        if not lm:
            continue
        href = lm.group(1)
        if 'zone-telechargement' in href and '/index.php' in href:
            continue
        if href in seen:
            continue
        seen.add(href)

        # title: first non-empty anchor text in the block
        title = ''
        for am in anchor_re.finditer(block):
            txt = hd(re.sub(r'<[^>]+>', ' ', am.group(1)))
            txt = re.sub(r'\s+', ' ', txt).strip()
            if txt and len(txt) >= 2:
                title = txt
                break

        # slug title from URL
        slug_title = ''
        sm = re.search(r'/\d+-(?:telecharger-)?(.+?)\.html', href)
        if sm:
            slug_title = sm.group(1).replace('-', ' ').strip()
        if not title:
            title = slug_title
        if not title:
            continue

        # poster
        poster = ''
        im = img_re.search(block)
        if im:
            poster = im.group(1)
            if poster.startswith('//'):
                poster = 'https:' + poster
            elif poster.startswith('/'):
                poster = base_url.rstrip('/') + poster

        # quality + language from detail_release badge
        quality = lang = ''
        rm = re.search(r'detail_release[^>]*>(.*?)(?:<br|</div>)', block, re.I | re.S)
        if rm:
            raw = hd(re.sub(r'<[^>]+>', ' ', rm.group(1)))
            raw = re.sub(r'\s+', ' ', raw).strip()
            lm2 = re.search(r'\(([^)]+)\)', raw)
            if lm2:
                lang = lm2.group(1).strip().upper()
            quality = re.sub(r'\([^)]*\)', '', raw).strip().upper()

        results.append({
            'title': title,
            'pageUrl': href,
            'slugTitle': slug_title,
            'poster': poster,
            'quality': quality,
            'lang': lang,
        })

    return results


def category_from_url(url: str) -> str:
    m = re.search(r'zone-telechargement[^/]*/([a-z0-9-]+)/\d+-', url, re.I)
    if not m:
        return ''
    sec = m.group(1).lower()
    t = SECTION_TYPE.get(sec, '')
    # series released under film/format prefixes
    if t == 'movie' and re.search(r'(?:-saison-|-serie-|-integrale-|\bS\d{1,2}\b)', url, re.I):
        t = 'tv'
    return t


def filter_by_category(items: list, type_: str) -> list:
    target = normalize_type_alias(type_)
    out = []
    for it in items:
        t = category_from_url(it['pageUrl'])
        if not t or t == target:
            out.append(it)
    return out


# Detail page scraper
def scrape_detail_html(html: str, page_url: str = '') -> dict:
    empty_result = {
        'meta': {}, 'quality': '', 'lang': '', 'size': '',
        'season': None, 'episode': None,
        'streamLinks': [], 'downloadLinks': [],
    }
    if not html:
        return empty_result

    # Title h1
    title = ''
    m = re.search(r'<h1[^>]*>(.*?)</h1>', html, re.I | re.S)
    if m:
        title = hd(re.sub(r'<[^>]+>', '', m.group(1)).strip())

    # Content area
    content = html
    cm = re.search(r'<div\s+id=["\']dle-content["\'][^>]*>(.*?)(?:<div\s+class=["\']c-share|<div\s+class=["\']pheading|<footer)', html, re.I | re.S)
    if cm:
        content = cm.group(1)

    # Big title
    big_title = ''
    bm = re.search(r'font-size:\s*24px[^"\']*["\'][^>]*>(.*?)</div>', content, re.I | re.S)
    if bm:
        big_title = hd(re.sub(r'<[^>]+>', '', bm.group(1)).strip())
    if not big_title:
        big_title = title

    # Poster
    poster = ''
    poster_patterns = [
        re.compile(r'<img[^>]+src=["\']((?: https?://[^"\']*zone-telechargement[^"\']*)?/img/(?:films?|series?|animes|jeux|musique|musiques|ebooks?|logiciels?|documentaires?|emissions?|spectacles?|concerts?|sports?|autoformations?)/[^"\']+\.(?:webp|jpg|png|jpeg))["\']', re.I),
        re.compile(r'<img[^>]+src=["\'](https?://(?:www\.)?zone-images\.com/[^"\']+\.(?:webp|jpg|png|jpeg))["\']', re.I),
    ]
    for pp in poster_patterns:
        pm = pp.search(content)
        if pm:
            poster = pm.group(1)
            break
    if poster and not poster.startswith('http'):
        poster = BASE_URL.rstrip('/') + poster

    # Meta extraction
    meta = {'title': big_title, 'poster': poster}
    meta_labels = {
        'Origine': 'origin', 'Nationalité': 'origin',
        'Réalisation': 'director', 'Réalisateur(s)': 'director', 'Réalisateur': 'director',
        'Acteur(s)': 'actors', 'Acteurs': 'actors',
        'Genre': 'genres', 'Date de sortie': 'release_date',
        'Note': 'rating', 'Critiques Spectateurs': 'rating',
        'Titre original': 'original_title', 'Durée': 'duration',
        'Année': 'year', 'Année de production': 'year',
        'Développement': 'developer', 'Développeur': 'developer',
        'Édition': 'publisher', 'Editeur': 'publisher', 'Éditeur': 'publisher',
        'Plateforme': 'platform', 'Plateformes': 'platform',
        'Date de parution': 'release_date', 'Mode(s)': 'modes', 'Mode': 'modes',
        'Artiste': 'artist', 'Album': 'album',
        'Auteur': 'author', 'Auteur(s)': 'author',
        'Langue': 'lang_meta', 'Format': 'format_meta',
        'Taille': 'size_meta', 'Taille du fichier': 'size_meta',
        "Taille d'un episode": 'size_meta', 'Qualité': 'quality_meta',
    }

    for lbl, key in meta_labels.items():
        if key in meta:
            continue
        pattern = re.compile(
            r'<(?:strong|b)>\s*(?:<u>)?\s*' + re.escape(lbl) +
            r'\s*(?::\s*)?</u>\s*(?::\s*)?</(?:strong|b)>\s*:?\s*(.{1,600}?)(?:<br|<strong|<b>|</?h[1-6]|\n\s*\n)',
            re.I | re.S
        )
        mm = pattern.search(content)
        if not mm:
            pattern2 = re.compile(
                r'<(?:strong|b)>\s*' + re.escape(lbl) +
                r'\s*(?::\s*)?</(?:strong|b)>\s*:?\s*(.{1,600}?)(?:<br|<strong|<b>|</?h[1-6]|\n\s*\n)',
                re.I | re.S
            )
            mm = pattern2.search(content)
        if mm:
            val = hd(re.sub(r'<[^>]+>', '', mm.group(1)).strip())
            val = re.sub(r'\s+', ' ', val).strip(' :\t\n\r')
            if val:
                meta[key] = val

    # Synopsis
    sm = re.search(r'<(?:em|i)>([^<]{30,3000})</(?:em|i)>', content, re.I | re.S)
    if sm:
        meta['synopsis'] = hd(re.sub(r'<[^>]+>', '', sm.group(1)).strip())

    if 'synopsis' not in meta:
        sm2 = re.search(r'synopsis\.png[^>]*>\s*(?:<br\s*/?>\s*)*(.{30,3000}?)(?:<img|<a\s+class=["\']btnToLink|Qualit[eé]\s*[A-Z])', content, re.I | re.S)
        if sm2:
            txt = hd(re.sub(r'<[^>]+>', '', sm2.group(1)).strip())
            txt = re.sub(r'\s+', ' ', txt)
            if len(txt) >= 30:
                meta['synopsis'] = txt

    # Quality & Language
    quality = meta.get('quality_meta', '').upper().strip()
    lang = meta.get('lang_meta', '').upper().strip()

    if not quality or not lang:
        qm = re.search(r'Qualit[eé]\s+([A-Z0-9][^|<]{1,40})\s*\|\s*([A-ZÉ\s]+?)(?:<|$|\s{2,})', content, re.I)
        if qm:
            if not quality:
                quality = qm.group(1).upper().strip()
            if not lang:
                lang = qm.group(2).upper().strip()

    if not quality and big_title:
        q_patterns = [
            r'\b(ULTRA\s*HD\s*\(?X265\)?|ULTRA\s*HD\s*4K|WEB[-\s]?DL\s*2160p|4K\s*BLU\s*RAY|4K)\b',
            r'\b(BLU[-\s]?RAY\s*1080p?|BDRIP\s*1080p?|BDREMUX|BLURAY\s*REMUX\s*1080p?)\b',
            r'\b(WEB[-\s]?DL\s*1080p|WEBRIP\s*1080p?|HDLIGHT\s*1080p?|HD\s*1080p)\b',
            r'\b(WEB[-\s]?DL\s*720p|WEBRIP\s*720p?|HDLIGHT\s*720p?|BLU[-\s]?RAY\s*720p?|HD\s*720p)\b',
            r'\b(HDRIP|BDRIP|DVDRIP|HDTS|CAM|TS)\b',
            r'\b(WEBRIP|WEB[-\s]?DL|BLURAY|BLU[-\s]?RAY|HDLIGHT)\b',
            r'\b(1080p?|720p?|480p?|2160p|UHD)\b',
        ]
        for qp in q_patterns:
            qmm = re.search(qp, big_title, re.I)
            if qmm:
                quality = re.sub(r'\s+', ' ', qmm.group(1)).upper().strip()
                break

    if not lang and big_title:
        lm = re.search(r'\((TRUEFRENCH|VOSTFR|MULTI|FRENCH|VFSTFR|VF|VO)\)', big_title, re.I)
        if lm:
            lang = lm.group(1).upper()

    if not lang:
        sl = re.search(r'color:\s*red;\s*font-weight:\s*bold[^>]*>(?:\s*<span[^>]*></span>)?\s*([^<]{2,40}?)\s*<br', content, re.I)
        if sl:
            parts = sl.group(1).strip().upper()
            qm2 = re.search(r'\b(4K|2160P|1080P|720P|HD|WEB[-\s]?DL|WEBRIP|BLURAY|HDTV)\b', parts)
            if qm2 and not quality:
                quality = parts.replace('VOSTFR', '').replace('VF', '').strip() or qm2.group(1)
            lm2 = re.search(r'(VOSTFR|TRUEFRENCH|FRENCH|MULTI|VF|VO)', parts)
            lang = lm2.group(1) if lm2 else parts

    # Season / Episode
    se_info = {'season': None, 'episode': None}
    sem = re.search(r'Episode\s+(\d{1,3})\s*\|\s*Saison\s*(\d{1,2})', content, re.I)
    if sem:
        se_info['episode'] = int(sem.group(1))
        se_info['season'] = int(sem.group(2))
    else:
        sem2 = re.search(r'(\d{1,3})\s*Episodes?\s*\|\s*Saison\s*(\d{1,2})', content, re.I)
        if sem2:
            se_info['season'] = int(sem2.group(2))
        else:
            se_info = extract_season_episode(big_title + ' ' + page_url)

    # Global size
    global_size = meta.get('size_meta', '')

    # Extract links
    download_links = []
    stream_links = []

    clean = re.sub(r'<!--.*?-->', '', content, flags=re.S)
    sm_split = re.search(r'Liens?\s+De\s+Streaming', clean, re.I)
    sections = [(clean[:sm_split.start()], False), (clean[sm_split.end():], True)] if sm_split else [(clean, None)]
    block_re = re.compile(
        r'<div[^>]*font-weight:\s*bold[^>]*>\s*([^<]{2,40}?)\s*</div>(.*?)(?=<div[^>]*font-weight:\s*bold|</center>|$)',
        re.I | re.S
    )

    def build_link(href, link_text, host_label='', force_stream=None):
        if href.startswith('//'):
            href = 'https:' + href
        if not is_valid_link(href, link_text):
            return
        hl = href.lower()
        # internal site nav / share widgets are never download links
        if 'zone-telechargement' in hl or 'zone-images' in hl:
            return
        if any(b in hl for b in ('whatsapp', 'addtoany', 'facebook', 'twitter.com',
                                 'reddit.com', 'pinterest', 'linkedin', '/user/', '/tags/')):
            return
        hp = extract_host_and_protection(href, host_label or link_text)
        rlow = hp.get('realUrl', '').lower()
        protected = hp['protection'] in ('zoneurs', 'dl-protect')
        known_host = any(pat in rlow for pat in HOST_PATTERNS) or \
            any(pat in hl for pat in HOST_PATTERNS) or \
            is_stream_host(rlow) or is_stream_host(hl)
        # keep only protected links, recognised hosts, OR links inside a labeled host block
        if not host_label and not (protected or known_host):
            return
        size = ''
        sz_match = re.search(r'(\d+(?:[.,]\d+)?\s*(?:Mo|Go|MB|GB|Ko|KB|TB|To))', link_text, re.I)
        if sz_match:
            size = sz_match.group(1)
        link_se = extract_season_episode(link_text)
        link_obj = {
            'url': hp['realUrl'] if hp['protection'] == 'zoneurs' else href,
            'host': host_label.strip() or hp['host'],
            'protection': hp['protection'],
            'filename': link_text if link_text and len(link_text) > 2 else '',
            'size': size or global_size,
            'season': link_se.get('season') or se_info.get('season'),
            'episode': link_se.get('episode') or se_info.get('episode'),
        }
        is_stream = force_stream if force_stream is not None else (
            is_stream_host(href) or is_stream_host(hp.get('realUrl', '')) or is_stream_host(host_label.lower()))
        (stream_links if is_stream else download_links).append(link_obj)

    found_blocks = False
    for sec_html, sec_stream in sections:
        for bm in block_re.finditer(sec_html):
            host_label = hd(bm.group(1)).strip()
            for href, link_html in re.findall(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', bm.group(2), re.I | re.S):
                found_blocks = True
                build_link(href, hd(re.sub(r'<[^>]+>', '', link_html).strip()), host_label, sec_stream)

    if not found_blocks:
        # Try <b>HOST</b> pattern as fallback block detection
        b_block_re = re.compile(
            r'<b>\s*([A-Za-z0-9][^<\n]{0,30}?)\s*</b>:?\s*(?:<br\s*/?>)?\s*(.*?)(?=<b>|</center>|$)',
            re.I | re.S
        )
        for sec_html, sec_stream in sections:
            for bm in b_block_re.finditer(sec_html):
                host_label = hd(bm.group(1)).strip()
                if not host_label or len(host_label) > 35 or host_label.count(' ') > 4:
                    continue
                for href, link_html in re.findall(
                    r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', bm.group(2), re.I | re.S
                ):
                    build_link(href, hd(re.sub(r'<[^>]+>', '', link_html).strip()), host_label, sec_stream)
                    found_blocks = True

    # Always try /img/HOST.png + btnToLink pattern (current .org structure)
    img_btn_re = re.compile(
        r'/img/([a-zA-Z0-9_-]+)\.[a-z]+["\'][\s\S]{0,350}?<a[^>]+class=["\']btnToLink["\'][^>]+href=["\']([^"\']+)["\']',
        re.I | re.S
    )
    for host_img, href in img_btn_re.findall(clean):
        img_low = host_img.lower().replace('-', '').replace('_', '')
        host_label = ''
        for pat, label in HOST_PATTERNS.items():
            p = pat.replace('-', '').replace('.', '').replace('_', '')
            if p in img_low or img_low in p:
                host_label = label
                break
        if not host_label:
            host_label = host_img.replace('-', '').replace('_', '').capitalize()
        build_link(href, 'Télécharger', host_label)
        found_blocks = True

    if not found_blocks:
        for href, link_html in re.findall(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', clean, re.I | re.S):
            build_link(href, hd(re.sub(r'<[^>]+>', '', link_html).strip()))

    # Deduplicate by URL
    seen_dl: set = set()
    seen_st: set = set()
    download_links = [lk for lk in download_links if lk['url'] not in seen_dl and not seen_dl.add(lk['url'])]  # type: ignore[func-returns-value]
    stream_links = [lk for lk in stream_links if lk['url'] not in seen_st and not seen_st.add(lk['url'])]  # type: ignore[func-returns-value]

    return {
        'meta': meta,
        'quality': quality,
        'lang': lang,
        'size': global_size,
        'season': se_info.get('season'),
        'episode': se_info.get('episode'),
        'streamLinks': stream_links,
        'downloadLinks': download_links,
    }


async def resolve_zoneurs_batch(links: list) -> list:
    to_fetch = {}
    for idx, lk in enumerate(links):
        if lk.get('url') and re.match(r'^https?://(?:www\.)?zoneurs\.net/', lk['url'], re.I):
            to_fetch[idx] = lk['url']

    if not to_fetch:
        return links

    html_map = await http_fetch_multi(list(set(to_fetch.values())), 12)

    for idx, z_url in to_fetch.items():
        html = html_map.get(z_url)
        if not html:
            continue

        real = ''
        m = re.search(r'class=["\']result-input["\'][^>]*value=["\'](https?://[^"\']+)["\']', html, re.I)
        if m:
            real = hd(m.group(1))
        if not real:
            m2 = re.search(r'<a[^>]+href=["\'](https?://[^"\']+)["\'][^>]*class=["\'][^"\']*btn-action[^"\']*btn-success', html, re.I)
            if m2:
                real = hd(m2.group(1))
        if not real:
            all_a = re.findall(r'<a[^>]+href=["\'](https?://[^"\']+)["\']', html, re.I)
            for a_href in all_a:
                hl = a_href.lower()
                if 'zoneurs' in hl or 'zone-telechargement' in hl:
                    continue
                if re.search(r'\.(?:css|js|png|jpe?g|gif|svg|ico|woff2?)(?:\?|$)', hl, re.I):
                    continue
                real = hd(a_href)
                break

        if not real:
            continue

        links[idx]['url'] = real
        rlow = real.lower()
        new_host = ''
        for pat, label in HOST_PATTERNS.items():
            if pat in rlow:
                new_host = label
                break
        if not new_host:
            parsed = urlparse(real)
            if parsed.hostname:
                h = re.sub(r'^(?:www\d*|dl\d*|cdn\d*|files?\d*)\.', '', parsed.hostname.lower())
                parts = h.split('.')
                new_host = parts[0].capitalize() if parts else ''
        if new_host:
            links[idx]['host'] = new_host
        links[idx]['protection'] = ''

    return links


# Search (DataLife Engine POST search) — fetch 2 pages in parallel for more results
async def zt_search(query: str, type_: str = 'movie') -> list:
    url = BASE_URL.rstrip('/') + '/index.php?do=search'

    async def _page(start: int) -> list:
        data = {
            'do': 'search', 'subaction': 'search', 'q': query, 'story': query,
            'search_start': str(start), 'full_search': '0',
            'result_from': str(start * 10 + 1),
        }
        html = await fetcher.fetch_post(url, data)
        return scrape_listing(html or '', BASE_URL)

    pages = await asyncio.gather(_page(0), _page(1))
    seen: set = set()
    merged: list = []
    for page in pages:
        for item in page:
            if item['pageUrl'] not in seen:
                seen.add(item['pageUrl'])
                merged.append(item)
    return merged


# Merge qualities from detail pages
async def merge_qualities(page_urls: list, is_serie: bool = False) -> dict:
    if not page_urls:
        return {'meta': {}, 'qualities': []}

    html_map = await http_fetch_multi(page_urls)

    all_download = []
    all_stream = []
    merged_meta = {}
    qualities_map = {}

    for url in page_urls:
        html = html_map.get(url)
        if not html:
            continue

        detail = scrape_detail_html(html, url)

        if not merged_meta:
            merged_meta = detail['meta']
        else:
            for k, v in detail['meta'].items():
                if k not in merged_meta or not merged_meta[k]:
                    merged_meta[k] = v

        q_key = (detail.get('quality', '') or 'Inconnu') + ' || ' + (detail.get('lang', '') or '')
        q_key = q_key.strip(' |')

        if q_key not in qualities_map:
            qualities_map[q_key] = {
                'quality': detail.get('quality', '') or 'Inconnu',
                'lang': detail.get('lang', ''),
                'size': detail.get('size', ''),
                'pageUrl': url,
                'downloadLinks': [],
                'streamLinks': [],
            }

        qualities_map[q_key]['downloadLinks'].extend(detail.get('downloadLinks', []))
        qualities_map[q_key]['streamLinks'].extend(detail.get('streamLinks', []))

    # Resolve zoneurs links
    for qk, qv in qualities_map.items():
        qv['downloadLinks'] = await resolve_zoneurs_batch(qv['downloadLinks'])
        qv['streamLinks'] = await resolve_zoneurs_batch(qv['streamLinks'])

    qualities = list(qualities_map.values())

    # Sort by quality priority
    q_priority = {'4K': 0, '2160P': 0, 'UHD': 0, 'ULTRA HD': 0, '1080P': 1, '1080': 1,
                  '720P': 2, '720': 2, 'WEBRIP': 3, 'WEB-DL': 3, 'HDLIGHT': 3,
                  'BLURAY': 4, 'BLU-RAY': 4, 'BDRIP': 5, 'DVDRIP': 6, 'HDTS': 7, 'CAM': 8}

    def q_sort_key(q):
        qu = q.get('quality', '').upper()
        for k, v in q_priority.items():
            if k in qu:
                return v
        return 99

    qualities.sort(key=q_sort_key)

    return {'meta': merged_meta, 'qualities': qualities}


# Group results
def group_results(items: list) -> list:
    groups = {}
    for item in items:
        ct = clean_title(item['title'])
        key = ct.lower().strip()
        if not key:
            key = item['title'].lower().strip()

        if key not in groups:
            year = extract_year(item['title'])
            groups[key] = {
                'id': key.replace(' ', '-')[:60],
                'title': ct or item['title'],
                'cleanTitle': ct,
                'poster': item.get('poster') or None,
                'year': year,
                'quality': item.get('quality') or None,
                'lang': item.get('lang') or None,
                'synopsis': None,
                'pageUrls': [item['pageUrl']],
                'totalLinks': 0,
            }
        else:
            if item['pageUrl'] not in groups[key]['pageUrls']:
                groups[key]['pageUrls'].append(item['pageUrl'])
            if not groups[key].get('poster') and item.get('poster'):
                groups[key]['poster'] = item['poster']

    return list(groups.values())


# Enrich with detail meta
async def enrich_results(results: list, max_enrich: int = 12) -> list:
    to_fetch = []
    for r in results[:max_enrich]:
        if r['pageUrls']:
            to_fetch.append(r['pageUrls'][0])

    if not to_fetch:
        return results

    html_map = await http_fetch_multi(to_fetch)

    for r in results[:max_enrich]:
        if not r['pageUrls']:
            continue
        url = r['pageUrls'][0]
        html = html_map.get(url)
        if not html:
            continue
        detail = scrape_detail_html(html, url)
        meta = detail.get('meta', {})

        if meta.get('poster'):
            r['poster'] = meta['poster']
        if meta.get('synopsis') and not r.get('synopsis'):
            r['synopsis'] = meta['synopsis']
        if not r.get('year') and meta.get('year'):
            r['year'] = meta['year']

        for key in ['origin', 'director', 'actors', 'genres', 'duration', 'rating',
                     'release_date', 'original_title', 'developer', 'publisher',
                     'platform', 'modes', 'artist', 'album', 'author',
                     'lang_meta', 'format_meta', 'size_meta']:
            if meta.get(key):
                r[key] = meta[key]

        total = len(detail.get('downloadLinks', [])) + len(detail.get('streamLinks', []))
        r['totalLinks'] = total

    return results


# ── API Routes ─────────────────────────────────────────────

@api_router.get("/categories")
async def get_categories():
    registry = zt_category_registry()
    out = []
    for key, info in registry.items():
        subs = [{'slug': slug, 'label': label} for slug, label in info['subs'].items()]
        out.append({
            'type': key,
            'label': info['label'],
            'tmdb': info['tmdb'],
            'subcategories': subs,
        })
    return {'categories': out}


@api_router.get("/search")
async def search(
    q: str = Query(..., min_length=1),
    type: str = Query('movie'),
):
    items = await zt_search(q, type)
    items = filter_by_category(items, type)
    results = group_results(items)

    last = fetcher.last_status
    return {
        'query': q,
        'type': type,
        'total': len(results),
        'results': results,
        'blocked': not results and last.get('ok') is False,
        'errors': last.get('errors', []) if not results else [],
    }


@api_router.get("/detail")
async def get_detail(
    urls: str = Query(..., description="Comma-separated page URLs"),
):
    url_list = [u.strip() for u in urls.split(',') if u.strip()][:10]
    if not url_list:
        return {'error': 'No URLs provided'}

    cat = category_from_url(url_list[0])
    is_serie = cat in ('tv', 'anime')
    merged = await merge_qualities(url_list, is_serie)
    mm = merged.get('meta', {})

    return {
        'result': {
            'title': mm.get('title', ''),
            'originalTitle': mm.get('original_title'),
            'poster': mm.get('poster'),
            'year': mm.get('year') or (mm.get('release_date') or '')[:4] or None,
            'synopsis': mm.get('synopsis'),
            'actors': mm.get('actors'),
            'director': mm.get('director'),
            'duration': mm.get('duration'),
            'genres': mm.get('genres'),
            'origin': mm.get('origin'),
            'rating': mm.get('rating'),
            'developer': mm.get('developer'),
            'publisher': mm.get('publisher'),
            'platform': mm.get('platform'),
            'modes': mm.get('modes'),
            'artist': mm.get('artist'),
            'album': mm.get('album'),
            'author': mm.get('author'),
            'lang_meta': mm.get('lang_meta'),
            'format_meta': mm.get('format_meta'),
            'size_meta': mm.get('size_meta'),
            'qualities': merged.get('qualities', []),
        }
    }


class RelayIn(BaseModel):
    url: str
    key: str = ''


class SettingsIn(BaseModel):
    relays: List[RelayIn] = []
    scraperapi_key: str = ''
    direct: bool = True


def _mask(v: str) -> str:
    return (v[:3] + '•••' + v[-2:]) if v and len(v) > 6 else ('•••' if v else '')


def _check_admin(key: Optional[str]):
    expected = os.environ.get('ADMIN_KEY', '').strip()
    if not expected:
        raise HTTPException(
            status_code=503,
            detail='Configuration administrateur indisponible : définissez ADMIN_KEY dans les secrets du projet.',
        )
    if not key or not compare_digest(key, expected):
        raise HTTPException(status_code=401, detail='Clé admin invalide')


@api_router.get("/settings")
async def read_settings(x_admin_key: Optional[str] = Header(None)):
    _check_admin(x_admin_key)
    return await fetcher.get_settings()


@api_router.put("/settings")
async def write_settings(body: SettingsIn, x_admin_key: Optional[str] = Header(None)):
    _check_admin(x_admin_key)
    relays = [{'url': r.url.strip(), 'key': r.key.strip()} for r in body.relays if r.url.strip()]
    await fetcher.save_settings(relays, body.scraperapi_key.strip(), body.direct)
    return {'ok': True}


@api_router.get("/status")
async def status():
    import proxy_manager
    s = await fetcher.get_settings()
    return {
        'relays': [{'url': r['url'], 'key': _mask(r.get('key', ''))} for r in s['relays']],
        'scraperapi': bool(s['scraperapi_key']),
        'direct': s['direct'],
        'proxyPool': proxy_manager.stats,
        'last': fetcher.last_status,
    }


@api_router.post("/status/test")
async def status_test(x_admin_key: Optional[str] = Header(None)):
    _check_admin(x_admin_key)
    return {'target': BASE_URL + '/', 'results': await fetcher.test_sources(BASE_URL + '/')}


@api_router.get("/img")
async def image_proxy(u: str):
    import proxy_manager as pm
    from fastapi.responses import Response
    parsed = urlparse(u)
    host = (parsed.hostname or '').lower().rstrip('.')
    allowed_hosts = ('zone-telechargement.org', 'zone-images.com')
    if (
        parsed.scheme not in ('http', 'https')
        or not any(host == domain or host.endswith('.' + domain) for domain in allowed_hosts)
    ):
        raise HTTPException(status_code=400, detail='host non autorisé')
    hit = _img_cache.get(u)
    if hit and time.time() - hit[0] < 86400:
        return Response(content=hit[1], media_type=hit[2],
                        headers={'Cache-Control': 'public, max-age=86400'})
    status, content, ctype, proxy = await pm.fetch_bytes(u, 15)
    if status == 200 and content:
        if len(_img_cache) > 400:
            _img_cache.clear()
        _img_cache[u] = (time.time(), content, ctype or 'image/jpeg')
        return Response(content=content, media_type=ctype or 'image/jpeg',
                        headers={'Cache-Control': 'public, max-age=86400'})
    raise HTTPException(status_code=404)


@api_router.get("/relay/{name}", response_class=PlainTextResponse)
async def relay_file(name: str):
    if name not in ('relay.php', 'relay.py', 'README.md', 'zt_org.php'):
        raise HTTPException(status_code=404)
    return PlainTextResponse((ROOT_DIR.parent / 'relay' / name).read_text(),
                             headers={'Content-Disposition': f'attachment; filename="{name}"'})


# ── TMDB helper ────────────────────────────────────────────

TMDB_BASE = 'https://api.themoviedb.org/3'


async def get_tmdb_title(tmdb_id: int, media_type: str = 'movie') -> Optional[str]:
    """Resolve a TMDB ID to its title. Returns None if TMDB_API_KEY not configured."""
    key = os.environ.get('TMDB_API_KEY', '').strip()
    if not key:
        return None
    mt = 'movie' if media_type in ('film', 'movie') else 'tv'
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as c:
            r = await c.get(
                f'{TMDB_BASE}/{mt}/{tmdb_id}',
                params={'api_key': key, 'language': 'fr-FR'},
            )
            if r.status_code != 200:
                return None
            data = r.json()
            return (data.get('title') or data.get('name') or
                    data.get('original_title') or data.get('original_name'))
    except Exception:
        return None


async def _liens_by_tmdb(
    tmdb_id: int,
    media_type: str,
    title: Optional[str],
    season: Optional[int] = None,
    episode: Optional[int] = None,
) -> dict:
    """Search the catalog by TMDB ID and optionally filter a TV season or episode."""
    if tmdb_id < 1:
        raise HTTPException(status_code=422, detail='tmdb_id doit être positif')
    if season is not None and season < 1:
        raise HTTPException(status_code=422, detail='season doit être positif')
    if episode is not None and episode < 1:
        raise HTTPException(status_code=422, detail='episode doit être positif')
    if episode is not None and season is None:
        raise HTTPException(status_code=422, detail='season est obligatoire avec episode')

    if not title:
        title = await get_tmdb_title(tmdb_id, media_type)
    if not title:
        return {
            'tmdb_id': tmdb_id,
            'media_type': 'movie' if media_type in ('film', 'movie') else 'series',
            'season': season,
            'episode': episode,
            'total': 0,
            'error': (
                'TMDB_API_KEY est nécessaire pour résoudre cet ID automatiquement. '
                'Configurez cette clé dans Replit Secrets ou passez ?title=Le+Titre.'
            ),
            'links': [],
        }

    type_map = {
        'film': 'movie', 'movie': 'movie',
        'serie': 'tv', 'series': 'tv', 'tv': 'tv',
    }
    type_ = type_map.get(media_type, 'movie')

    queries = [title]
    if season is not None and episode is not None:
        queries = [
            f'{title} S{season:02d}E{episode:02d}',
            f'{title} saison {season}',
            title,
        ]
    elif season is not None:
        queries = [f'{title} saison {season}', title]

    items = []
    for query in queries:
        items = filter_by_category(await zt_search(query, type_), type_)
        if items:
            break
    results = group_results(items)

    if not results:
        return {
            'tmdb_id': tmdb_id,
            'media_type': 'movie' if type_ == 'movie' else 'series',
            'title': title,
            'season': season,
            'episode': episode,
            'total': 0,
            'links': [],
        }

    is_serie = type_ in ('tv', 'anime')
    best = results[0]
    merged: dict = {'meta': {}, 'qualities': []}
    all_links: List[Dict[str, Any]] = []

    # Specific season/episode lookups may have several similarly titled pages.
    # Try a few candidates until one contains links matching the requested scope.
    candidates = results[:3] if season is not None else results[:1]
    for candidate in candidates:
        candidate_merged = await merge_qualities(candidate['pageUrls'][:3], is_serie)
        candidate_links: List[Dict[str, Any]] = []
        for quality in candidate_merged.get('qualities', []):
            for link_type, key in (('download', 'downloadLinks'), ('stream', 'streamLinks')):
                for link in quality.get(key, []):
                    link_season = link.get('season')
                    link_episode = link.get('episode')
                    if season is not None and link_season != season:
                        continue
                    if episode is not None and link_episode != episode:
                        continue
                    hoster = link.get('host') or extract_host_and_protection(
                        link.get('realUrl') or link.get('url', '')
                    ).get('host', '')
                    candidate_links.append({
                        **link,
                        'host': hoster,
                        'hoster': hoster,
                        'quality': quality.get('quality') or 'Inconnu',
                        'lang': quality.get('lang', ''),
                        'type': link_type,
                    })

        if candidate_links or season is None:
            best = candidate
            merged = candidate_merged
            all_links = candidate_links
            break

    return {
        'tmdb_id': tmdb_id,
        'media_type': 'movie' if type_ == 'movie' else 'series',
        'title': merged.get('meta', {}).get('title') or title,
        'poster': merged.get('meta', {}).get('poster'),
        'result_url': best['pageUrls'][0] if best.get('pageUrls') else None,
        'season': season,
        'episode': episode,
        'total': len(all_links),
        'links': all_links,
    }


# ── Latest additions ───────────────────────────────────────

# Section paths that exist on the .org listing pages
_LISTING_PATHS: Dict[str, List[str]] = {
    'movie': ['/film-gratuit/', '/nouveaux-films/', '/top-films/', '/'],
    'tv': ['/dernieres-series-vf-ajoutees/', '/telecharger-serie/', '/series/', '/'],
    'anime': ['/animes/', '/manga/', '/'],
    'jeux': ['/derniers-jeux-ajoutes/', '/jeux-gratuit/', '/'],
    'musique': ['/musique-mp3-gratuite/', '/musiques/', '/'],
    'ebook': ['/ebooks/', '/ebook/', '/'],
    'logiciel': ['/logiciels/', '/'],
    'documentaire': ['/documentaire-gratuit/', '/autres-videos/', '/'],
    'emission': ['/emissions-tv/', '/autres-videos/', '/'],
    'spectacle': ['/spectacles/', '/autres-videos/', '/'],
    'concert': ['/concerts/', '/autres-videos/', '/'],
    'sport': ['/sport/', '/autres-videos/', '/'],
}


@api_router.get("/latest")
async def get_latest(type: str = Query('movie'), limit: int = Query(24, le=48)):
    """Scrape the category listing page to get recently added content."""
    t = normalize_type_alias(type)
    paths = _LISTING_PATHS.get(t, ['/'])

    async def _try(path: str) -> Optional[str]:
        try:
            return await asyncio.wait_for(
                http_fetch(BASE_URL.rstrip('/') + path),
                timeout=12,
            )
        except (asyncio.TimeoutError, Exception):
            return None

    # Fetch all paths in parallel, use first successful result
    fetched = await asyncio.gather(*[_try(p) for p in paths])
    html = next((r for r in fetched if r), None)

    if not html:
        return {'type': type, 'total': 0, 'results': [],
                'error': 'Site inaccessible — aucun proxy disponible'}

    items = scrape_listing(html, BASE_URL)
    # Filter by category BEFORE grouping (raw items have 'pageUrl')
    if t != 'movie' or len(paths) > 1:
        filtered = filter_by_category(items, t)
        if filtered:
            items = filtered
    results = group_results(items)
    subset = results[:limit]
    return {'type': type, 'total': len(subset), 'results': subset}


# ── Liens par TMDB ID ──────────────────────────────────────

@api_router.get("/liens/film/{tmdb_id}")
async def liens_film(tmdb_id: int, title: Optional[str] = None):
    return await _liens_by_tmdb(tmdb_id, 'film', title)


@api_router.get("/liens/serie/{tmdb_id}")
async def liens_serie(tmdb_id: int, title: Optional[str] = None):
    return await _liens_by_tmdb(tmdb_id, 'serie', title)


@api_router.get("/liens")
async def liens(
    media_type: str = Query(..., pattern='^(film|serie)$'),
    tmdb_id: int = Query(..., ge=1),
    title: Optional[str] = None,
):
    return await _liens_by_tmdb(tmdb_id, media_type, title)


@liens_router.get("/liens/movie/{tmdb_id}")
async def liens_movie(tmdb_id: int, title: Optional[str] = None):
    return await _liens_by_tmdb(tmdb_id, 'movie', title)


@liens_router.get("/liens/series/{tmdb_id}")
async def liens_series(tmdb_id: int, title: Optional[str] = None):
    return await _liens_by_tmdb(tmdb_id, 'series', title)


@liens_router.get("/liens/series/{tmdb_id}/{season}")
async def liens_series_season(tmdb_id: int, season: int, title: Optional[str] = None):
    return await _liens_by_tmdb(tmdb_id, 'series', title, season=season)


@liens_router.get("/liens/series/{tmdb_id}/{season}/{episode}")
async def liens_series_episode(
    tmdb_id: int,
    season: int,
    episode: int,
    title: Optional[str] = None,
):
    return await _liens_by_tmdb(tmdb_id, 'series', title, season=season, episode=episode)


api_router.include_router(liens_router)


app.include_router(api_router)
app.include_router(liens_router)
# The artifact router preserves its configured path prefix when proxying.
# Keep the local /api routes too, while exposing the same endpoints through
# the app's /zt-api service path.
app.include_router(api_router, prefix="/zt-api")
app.include_router(liens_router, prefix="/zt-api")


@app.on_event("startup")
async def _startup_proxy_warmup():
    import proxy_manager
    asyncio.create_task(proxy_manager.warmup())

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
