<?php
/*
 * ZT .org — fichier PHP unique (recherche + fiches + liens DL/streaming par qualité)
 * ---------------------------------------------------------------------------------
 * GRATUIT : à lancer sur une IP résidentielle (ton PC / ta box), car le .org bloque les datacenters.
 *   1) Installer PHP (Windows : https://windows.php.net/download  |  Linux : apt install php-cli php-curl)
 *   2) Dans le dossier du fichier :   php -S 0.0.0.0:8787 zt_org.php
 *   3) Ouvrir http://localhost:8787
 *   4) (Optionnel, accès depuis Internet / l'app ZT Search) :  cloudflared tunnel --url http://localhost:8787
 *
 * Modes :
 *   ?q=avatar&cat=films              -> page HTML de résultats
 *   ?id=film/2903-avatar             -> fiche avec toutes les qualités + liens
 *   ajouter &format=json             -> réponse JSON (API)
 *   ?url=https://www.zone-telechargement.org/...&key=RELAY_KEY   -> mode relais brut (pour l'app ZT Search)
 */

const RELAY_KEY = 'CHANGE_MOI';
const CACHE_TTL = 600;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
define('BASE', rtrim(getenv('ZT_BASE') ?: 'https://www.zone-telechargement.org', '/'));

$CATS = [
    'films' => 'Films', 'series' => 'Séries', 'mangas' => 'Mangas', 'jeux' => 'Jeux',
    'musiques' => 'Musique', 'ebooks' => 'Ebooks', 'logiciels' => 'Logiciels',
    'autres-videos' => 'Autres vidéos', 'mobiles' => 'Mobiles',
];
$KINDS = 'film|serie|manga|jeu|musique|ebook|logiciel|autre-video|mobile';
$STREAM_HOSTS = ['dood', 'dsvplay', 'lulu', 'voe', 'embedseek', 'seekstreaming', 'streamtape',
                 'vidoza', 'uqload', 'mixdrop', 'filemoon', 'sibnet', 'vidlox', 'netu', 'streamsb'];

// ---------- HTTP ----------
function cache_path($url) { return sys_get_temp_dir() . '/ztorg_' . md5($url) . '.html'; }

function is_blocked($code, $html) {
    if ($code != 200 || !$html) return true;
    $h = substr($html, 0, 6000);
    foreach (['cf-error-details', 'Just a moment...', 'challenge-platform', 'Attention Required! | Cloudflare'] as $m) {
        if (strpos($h, $m) !== false) return true;
    }
    return false;
}

function curl_handle($url) {
    $ch = curl_init($url);
    $jar = sys_get_temp_dir() . '/ztorg_cookies.txt';
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 5,
        CURLOPT_TIMEOUT => 25, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_ENCODING => '', CURLOPT_COOKIEFILE => $jar, CURLOPT_COOKIEJAR => $jar,
        CURLOPT_HTTPHEADER => [
            'User-Agent: ' . UA,
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language: fr-FR,fr;q=0.9,en;q=0.8',
            'Referer: ' . BASE . '/',
        ],
    ]);
    return $ch;
}

// Récupère plusieurs URLs en parallèle. Retourne [url => ['code'=>, 'html'=>]]
function fetch_many(array $urls) {
    $out = []; $mh = curl_multi_init(); $hs = [];
    foreach (array_unique($urls) as $u) {
        $cp = cache_path($u);
        if (is_file($cp) && time() - filemtime($cp) < CACHE_TTL) { $out[$u] = ['code' => 200, 'html' => file_get_contents($cp)]; continue; }
        $hs[$u] = curl_handle($u); curl_multi_add_handle($mh, $hs[$u]);
    }
    do { $st = curl_multi_exec($mh, $running); if ($running) curl_multi_select($mh, 1); } while ($running && $st == CURLM_OK);
    foreach ($hs as $u => $ch) {
        $html = curl_multi_getcontent($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $out[$u] = ['code' => $code, 'html' => $html];
        if (!is_blocked($code, $html)) @file_put_contents(cache_path($u), $html);
        curl_multi_remove_handle($mh, $ch); curl_close($ch);
    }
    curl_multi_close($mh);
    return $out;
}

function fetch($url) { return fetch_many([$url])[$url]; }

// ---------- Helpers ----------
function hd($s) { return trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($s), ENT_QUOTES | ENT_HTML5, 'UTF-8'))); }
function e($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function abs_url($u) { if (!$u) return ''; if (strpos($u, '//') === 0) return 'https:' . $u; return preg_match('#^https?://#', $u) ? $u : BASE . '/' . ltrim($u, '/'); }

function clean_title($t) {
    $t = preg_replace('/\s*[\[(](?:TRUEFRENCH|FRENCH|MULTI|VOSTFR|VF|VO|4K|1080p|720p|HDLIGHT|BLU-?RAY|WEB-?DL|WEBRIP|DVDRIP|BDRIP|HDRIP)[^\])]*[\])]/i', '', $t);
    $t = preg_replace('/\s+-\s+Saison\s+\d+.*$/i', '', $t);
    return trim($t);
}

function season_episode($txt) {
    $r = ['season' => null, 'episode' => null];
    if (preg_match('/\bS(\d{1,2})E(\d{1,3})\b/i', $txt, $m)) return ['season' => (int)$m[1], 'episode' => (int)$m[2]];
    if (preg_match('/(?:saison|season)\s*(\d{1,2})/i', $txt, $m)) $r['season'] = (int)$m[1];
    if (preg_match('/\b(?:épisode|episode|ep\.?)\s*(\d{1,3})/iu', $txt, $m)) $r['episode'] = (int)$m[1];
    return $r;
}

// "film/2903-avatar" <-> URL
function id_to_url($id) { if (!preg_match('#^([a-z-]+)/(\d+-[\w-]+)$#i', $id, $m)) return null; return BASE . '/?p=' . $m[1] . '&id=' . $m[2]; }
function url_to_id($u) { return preg_match('#\?p=([a-z-]+)&(?:amp;)?id=(\d+-[^&"\']+)#i', $u, $m) ? $m[1] . '/' . $m[2] : null; }

// ---------- Parsing : liste de résultats ----------
function parse_listing($html) {
    global $KINDS;
    $items = [];
    foreach (preg_split('/<div class="cover_global"/i', $html) as $i => $blk) {
        if ($i === 0) continue;
        if (!preg_match('#<div class="cover_infos_title">\s*<a href="[^"]*\?p=(' . $KINDS . ')&(?:amp;)?id=(\d+-[^"]+)"[^>]*>(.*?)</a>#is', $blk, $m)) continue;
        $poster = preg_match('#<img[^>]+class="mainimg"[^>]+src="([^"]+)"#i', $blk, $pm) ? abs_url($pm[1]) : '';
        $rel = preg_match('#<span class="detail_release[^"]*">(.*?)</span>\s*<br#is', $blk, $rm) ? $rm[1] : '';
        preg_match_all('#<b>(.*?)</b>#is', $rel, $bm);
        $bits = array_map('hd', $bm[1]);
        $items[] = [
            'id' => $m[1] . '/' . $m[2],
            'title' => hd($m[3]),
            'poster' => $poster,
            'quality' => $bits[0] ?? '',
            'lang' => isset($bits[1]) ? preg_replace('/^\((.*)\)$/', '$1', $bits[1]) : '',
            'date' => preg_match('#<time>(.*?)</time>#i', $blk, $dm) ? hd($dm[1]) : '',
        ];
    }
    return $items;
}

function search($q, $cat, $page = 1) {
    $url = BASE . '/?p=' . rawurlencode($cat) . '&search=' . rawurlencode($q) . ($page > 1 ? '&page=' . (int)$page : '');
    $r = fetch($url);
    if (is_blocked($r['code'], $r['html'])) return ['blocked' => true, 'http_code' => $r['code'], 'results' => []];
    $groups = [];
    foreach (parse_listing($r['html']) as $it) {
        $key = mb_strtolower(clean_title($it['title']));
        if (!isset($groups[$key])) $groups[$key] = ['title' => clean_title($it['title']), 'poster' => $it['poster'], 'versions' => []];
        if (!$groups[$key]['poster']) $groups[$key]['poster'] = $it['poster'];
        $groups[$key]['versions'][] = $it;
    }
    $hasNext = (bool)preg_match('#rel=[\'"]next[\'"]#i', $r['html']);
    return ['blocked' => false, 'results' => array_values($groups), 'page' => $page, 'has_next' => $hasNext];
}

// ---------- Parsing : fiche ----------
function parse_detail($html, $url) {
    global $STREAM_HOSTS;
    $p = strpos($html, "id='dle-content'"); if ($p === false) $p = strpos($html, 'id="dle-content"');
    $c = $p !== false ? substr($html, $p) : $html;
    $c = preg_replace('/<!--.*?-->/s', '', $c);
    $c = preg_replace('#<script.*?</script>#is', '', $c);

    $d = ['url' => $url, 'id' => url_to_id($url), 'title' => preg_match('#<h1[^>]*>(.*?)</h1>#is', $c, $m) ? hd($m[1]) : ''];
    $d['poster'] = preg_match('#<img[^>]+src="((?:https?://[^"]+)?/img/[^"]+\.(?:webp|jpe?g|png))"#i', $c, $m) ? abs_url($m[1]) : '';

    $labels = ['Qualité' => 'quality', 'Langue' => 'lang', 'Taille du fichier' => 'size', "Taille d'un episode" => 'size',
               'Origine' => 'origin', 'Nationalité' => 'origin', 'Réalisation' => 'director', 'Réalisateur(s)' => 'director',
               'Acteur(s)' => 'actors', 'Genre' => 'genres', 'Durée' => 'duration', 'Date de sortie' => 'release_date',
               'Année de production' => 'year', 'Titre original' => 'original_title', 'Note' => 'rating',
               'Développeur' => 'developer', 'Editeur' => 'publisher', 'Plateforme' => 'platform', 'Auteur' => 'author', 'Format' => 'format'];
    foreach ($labels as $lbl => $k) {
        if (!empty($d[$k])) continue;
        if (preg_match('#<strong>\s*(?:<u>)?\s*' . preg_quote($lbl, '#') . '\s*(?:</u>)?\s*:?\s*</strong>\s*:?\s*(.{1,600}?)<br#isu', $c, $m)) {
            $d[$k] = trim(hd($m[1]), ' :');
        }
    }
    if (preg_match('#<em>(.{30,3000}?)</em>#is', $c, $m)) $d['synopsis'] = hd($m[1]);

    // Séries : ligne rouge "VOSTFR <br><br> 6 Episodes | Saison 1"
    if (preg_match('#color:\s*red;\s*font-weight:\s*bold[^>]*>(.*?)</div>#is', $c, $m)) {
        $parts = array_values(array_filter(array_map('hd', preg_split('#<br\s*/?>#i', $m[1]))));
        if (empty($d['lang']) && isset($parts[0])) $d['lang'] = $parts[0];
        if (isset($parts[1])) $d['episodes_info'] = $parts[1];
    }
    $se = season_episode(($d['episodes_info'] ?? '') . ' ' . $d['title']);
    $d['season'] = $se['season'];

    // Autres versions (qualités / saisons)
    $d['other_versions'] = [];
    if (preg_match('#<div class="otherversions".*?</div>#is', $c, $ov)) {
        preg_match_all('#<a href="([^"]+)"[^>]*>(.*?)</a>#is', $ov[0], $om, PREG_SET_ORDER);
        foreach ($om as $o) if ($oid = url_to_id(html_entity_decode($o[1]))) $d['other_versions'][] = ['id' => $oid, 'label' => hd($o[2])];
    }

    // Liens : blocs "<div font-weight:bold>Hébergeur</div> ... <a>"
    $d['download'] = []; $d['stream'] = [];
    $split = preg_split('/Liens?\s+De\s+Streaming/i', $c, 2);
    foreach ($split as $si => $sec) {
        $isStreamSec = count($split) > 1 ? $si === 1 : null;
        preg_match_all('#<div[^>]*font-weight:\s*bold[^>]*>\s*([^<]{2,40}?)\s*</div>(.*?)(?=<div[^>]*font-weight:\s*bold|</center>|$)#is', $sec, $bm, PREG_SET_ORDER);
        foreach ($bm as $b) {
            $host = hd($b[1]);
            preg_match_all('#<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>#is', $b[2], $lm, PREG_SET_ORDER);
            foreach ($lm as $l) {
                $href = html_entity_decode($l[1]);
                if (!preg_match('#^(https?:)?//#', $href) || strpos($href, '?p=') !== false) continue;
                if (preg_match('#allocine|youtube|youtu\.be|imdb|themoviedb|t\.me/|discord#i', $href) || stripos($host, 'Qualit') !== false) continue;
                $txt = hd($l[2]);
                $lse = season_episode($txt);
                $isStream = $isStreamSec;
                if ($isStream === null) { $isStream = false; foreach ($STREAM_HOSTS as $sh) if (stripos($host, $sh) !== false) $isStream = true; }
                $d[$isStream ? 'stream' : 'download'][] = ['host' => $host, 'url' => abs_url($href), 'label' => $txt, 'episode' => $lse['episode']];
            }
        }
    }
    return $d;
}

function details($id) {
    $first = id_to_url($id);
    if (!$first) return ['error' => 'id invalide'];
    $r = fetch($first);
    if (is_blocked($r['code'], $r['html'])) return ['blocked' => true, 'http_code' => $r['code']];
    $main = parse_detail($r['html'], $first);
    $isSerie = preg_match('#^(serie|manga)/#', $id);
    $versions = [$main];
    // Films/jeux : on récupère toutes les autres qualités. Séries : les autres versions sont des saisons -> simple lien.
    if (!$isSerie && $main['other_versions']) {
        $urls = array_filter(array_map(fn($o) => id_to_url($o['id']), $main['other_versions']));
        foreach (fetch_many($urls) as $u => $res) {
            if (!is_blocked($res['code'], $res['html'])) $versions[] = parse_detail($res['html'], $u);
        }
    }
    $order = ['4K' => 0, '2160' => 0, 'REMUX' => 1, '1080' => 2, '720' => 3, 'WEB' => 4, 'HDLIGHT' => 4, 'BLU' => 5, 'HDRIP' => 6, 'DVDRIP' => 7, 'TS' => 8, 'CAM' => 9];
    $rank = function ($q) use ($order) { foreach ($order as $k => $v) if (stripos($q, $k) !== false) return $v; return 50; };
    usort($versions, fn($a, $b) => $rank($a['quality'] ?? '') <=> $rank($b['quality'] ?? ''));
    $info = $main;
    unset($info['download'], $info['stream'], $info['url']);
    $info['seasons'] = $isSerie ? $main['other_versions'] : [];
    $info['qualities'] = array_map(fn($v) => [
        'id' => $v['id'], 'url' => $v['url'], 'quality' => $v['quality'] ?? '', 'lang' => $v['lang'] ?? '',
        'size' => $v['size'] ?? '', 'download' => $v['download'], 'stream' => $v['stream'],
    ], $versions);
    return $info;
}

// ---------- Mode relais (pour l'app ZT Search) ----------
if (isset($_GET['url'])) {
    header('Access-Control-Allow-Origin: *');
    if (($_GET['key'] ?? '') !== RELAY_KEY) { http_response_code(401); exit('bad key'); }
    $u = $_GET['url']; $h = strtolower(parse_url($u, PHP_URL_HOST) ?: '');
    if (!preg_match('#(^|\.)(zone-telechargement\.org|zoneurs\.net)$#', $h)) { http_response_code(400); exit('url not allowed'); }
    $r = fetch($u);
    http_response_code($r['code'] ?: 502);
    header('Content-Type: text/html; charset=UTF-8');
    exit($r['html'] === false ? 'relay error' : $r['html']);
}

// ---------- Routage ----------
$q = trim($_GET['q'] ?? '');
$cat = isset($CATS[$_GET['cat'] ?? '']) ? $_GET['cat'] : 'films';
$page = max(1, (int)($_GET['page'] ?? 1));
$id = $_GET['id'] ?? '';
$json = ($_GET['format'] ?? '') === 'json';

$data = null;
if ($id) $data = details($id);
elseif ($q !== '') $data = search($q, $cat, $page);

if ($json) {
    header('Content-Type: application/json; charset=UTF-8');
    header('Access-Control-Allow-Origin: *');
    echo json_encode($data ?? ['categories' => $CATS], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

// ---------- Rendu HTML ----------
function links_html($links, $title) {
    if (!$links) return '';
    $h = '<div class="lk"><h4>' . e($title) . '</h4>';
    foreach ($links as $l) {
        $lbl = $l['episode'] ? 'Ép. ' . $l['episode'] : ($l['label'] ?: 'Lien');
        $h .= '<a target="_blank" rel="noreferrer" href="' . e($l['url']) . '"><b>' . e($l['host']) . '</b> <span>' . e($lbl) . '</span></a>';
    }
    return $h . '</div>';
}
$self = strtok($_SERVER['REQUEST_URI'] ?? '', '?');
?><!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ZT .org<?= $q ? ' — ' . e($q) : '' ?></title>
<style>
:root{--bg:#0b0e14;--card:#131926;--line:#263042;--txt:#f1f5f9;--mut:#7c8aa3;--acc:#3b82f6;--ok:#22c55e;--warn:#f59e0b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:inherit;text-decoration:none}header{position:sticky;top:0;background:#0b0e14e6;backdrop-filter:blur(14px);border-bottom:1px solid var(--line);z-index:5}
.wrap{max-width:1300px;margin:auto;padding:14px 18px}form{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.logo{font-weight:800;margin-right:8px}.logo i{font-style:normal;color:var(--acc);font-size:11px;border:1px solid #3b82f655;padding:1px 6px;border-radius:5px;margin-left:4px}
input,select,button{background:var(--card);color:var(--txt);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font:inherit}
input{flex:1;min-width:200px}button{background:var(--acc);border-color:var(--acc);font-weight:700;cursor:pointer}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:16px;margin-top:18px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;transition:transform .2s,border-color .2s}
.card:hover{transform:translateY(-3px);border-color:var(--acc)}.card img{width:100%;aspect-ratio:2/3;object-fit:cover;background:#1b2232;display:block}
.card .t{padding:10px 12px 4px;font-weight:700}.v{padding:0 12px 12px;display:flex;flex-direction:column;gap:4px}
.v a{font-size:12px;color:var(--mut);border:1px solid var(--line);border-radius:7px;padding:3px 7px}.v a:hover{color:var(--txt);border-color:var(--acc)}
.alert{margin-top:18px;padding:16px;border-radius:12px;background:#f59e0b18;border:1px solid #f59e0b44;color:#fcd34d}
.det{display:grid;grid-template-columns:230px 1fr;gap:26px;margin-top:20px}.det img{width:100%;border-radius:12px}
@media(max-width:700px){.det{grid-template-columns:1fr}.det img{max-width:220px}}
.meta{color:var(--mut);font-size:13px}.meta b{color:var(--txt);font-weight:600}
.q{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-top:14px}
.q h3{margin:0 0 8px;font-size:15px}.q h3 small{color:var(--mut);font-weight:400;margin-left:8px}
.lk h4{margin:10px 0 6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
.lk a{display:inline-flex;gap:6px;margin:0 6px 6px 0;padding:6px 10px;border-radius:8px;border:1px solid var(--line);font-size:12px;transition:border-color .2s,background .2s}
.lk a:hover{border-color:var(--ok);background:#22c55e14}.lk a span{color:var(--mut)}
.pill{display:inline-block;margin:4px 6px 0 0;padding:4px 10px;border:1px solid var(--line);border-radius:99px;font-size:12px}
.pager{margin:22px 0;display:flex;gap:10px}.pager a{border:1px solid var(--line);padding:8px 14px;border-radius:10px}
</style></head><body>
<header><div class="wrap"><form method="get" action="<?= e($self) ?>">
<a class="logo" href="<?= e($self) ?>">ZT Search<i>.org</i></a>
<input name="q" value="<?= e($q) ?>" placeholder="Rechercher un film, une série, un jeu…" autofocus>
<select name="cat"><?php foreach ($CATS as $k => $v) echo '<option value="' . e($k) . '"' . ($k === $cat ? ' selected' : '') . '>' . e($v) . '</option>'; ?></select>
<button type="submit">Rechercher</button>
</form></div></header>
<main class="wrap">
<?php if (!empty($data['blocked'])): ?>
  <div class="alert"><b>Bloqué par Cloudflare (HTTP <?= e($data['http_code']) ?>).</b><br>Ce PHP doit tourner sur une IP résidentielle (ton PC / ta box), pas sur un hébergeur/datacenter ni un Worker Cloudflare.</div>
<?php elseif ($id && $data && empty($data['error'])): ?>
  <div class="det">
    <div><?php if ($data['poster']): ?><img src="<?= e($data['poster']) ?>" alt="" referrerpolicy="no-referrer"><?php endif; ?></div>
    <div>
      <h1 style="margin:0 0 6px"><?= e($data['title']) ?></h1>
      <div class="meta"><?php foreach (['original_title' => 'Titre original', 'year' => 'Année', 'release_date' => 'Sortie', 'origin' => 'Origine', 'genres' => 'Genre', 'duration' => 'Durée', 'director' => 'Réalisation', 'actors' => 'Acteurs', 'rating' => 'Note', 'developer' => 'Développeur', 'platform' => 'Plateforme', 'author' => 'Auteur', 'episodes_info' => 'Épisodes'] as $k => $l)
        if (!empty($data[$k])) echo '<div><b>' . e($l) . ' :</b> ' . e($data[$k]) . '</div>'; ?></div>
      <?php if (!empty($data['synopsis'])): ?><p><?= e($data['synopsis']) ?></p><?php endif; ?>
      <?php if ($data['seasons']): ?><div><?php foreach ($data['seasons'] as $s) echo '<a class="pill" href="?id=' . e($s['id']) . '">' . e($s['label']) . '</a>'; ?></div><?php endif; ?>
      <?php foreach ($data['qualities'] as $qv): ?>
        <div class="q"><h3><?= e($qv['quality'] ?: 'Qualité inconnue') ?><small><?= e($qv['lang']) ?> <?= $qv['size'] ? '· ' . e($qv['size']) : '' ?></small></h3>
        <?= links_html($qv['download'], 'Téléchargement') ?><?= links_html($qv['stream'], 'Streaming') ?>
        <?php if (!$qv['download'] && !$qv['stream']) echo '<div class="meta">Aucun lien trouvé.</div>'; ?></div>
      <?php endforeach; ?>
    </div>
  </div>
<?php elseif ($q !== '' && $data): ?>
  <?php if (!$data['results']): ?><div class="alert">Aucun résultat pour « <?= e($q) ?> ».</div><?php endif; ?>
  <div class="grid"><?php foreach ($data['results'] as $g): $v0 = $g['versions'][0]; ?>
    <div class="card"><a href="?id=<?= e($v0['id']) ?>"><img loading="lazy" referrerpolicy="no-referrer" src="<?= e($g['poster']) ?>" alt=""><div class="t"><?= e($g['title']) ?></div></a>
      <div class="v"><?php foreach ($g['versions'] as $v) echo '<a href="?id=' . e($v['id']) . '">' . e(trim($v['quality'] . ' ' . $v['lang']) ?: $v['title']) . '</a>'; ?></div></div>
  <?php endforeach; ?></div>
  <div class="pager">
    <?php if ($page > 1): ?><a href="?<?= e(http_build_query(['q' => $q, 'cat' => $cat, 'page' => $page - 1])) ?>">← Précédent</a><?php endif; ?>
    <?php if (!empty($data['has_next'])): ?><a href="?<?= e(http_build_query(['q' => $q, 'cat' => $cat, 'page' => $page + 1])) ?>">Suivant →</a><?php endif; ?>
  </div>
<?php else: ?>
  <p class="meta" style="margin-top:40px">Tape un titre, choisis une catégorie. Liens téléchargement + streaming regroupés par qualité, directement depuis zone-telechargement.org.</p>
<?php endif; ?>
</main></body></html>
