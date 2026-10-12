<?php
// ZT Search relay : à héberger sur une IP NON bloquée par Cloudflare (PC perso, box, hébergement mutualisé FR).
// Usage : relay.php?url=https%3A%2F%2Fwww.zone-telechargement.org%2F&key=VOTRE_CLE
$RELAY_KEY = 'CHANGE_MOI';
$ALLOWED = ['zone-telechargement.org', 'zoneurs.net'];

header('Access-Control-Allow-Origin: *');
if (($_GET['key'] ?? '') !== $RELAY_KEY) { http_response_code(401); exit('bad key'); }

$url = $_GET['url'] ?? '';
$host = strtolower(parse_url($url, PHP_URL_HOST) ?: '');
$ok = false;
foreach ($ALLOWED as $d) { if ($host === $d || substr($host, -strlen('.' . $d)) === '.' . $d) $ok = true; }
if (!$ok || !preg_match('#^https?://#i', $url)) { http_response_code(400); exit('url not allowed'); }

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 5,
    CURLOPT_TIMEOUT => 25,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_ENCODING => '',
    CURLOPT_COOKIEFILE => sys_get_temp_dir() . '/zt_relay_cookies.txt',
    CURLOPT_COOKIEJAR => sys_get_temp_dir() . '/zt_relay_cookies.txt',
    CURLOPT_HTTPHEADER => [
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language: fr-FR,fr;q=0.9,en;q=0.8',
        'Referer: https://www.zone-telechargement.org/',
    ],
]);
$body = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE) ?: 502;
$err = curl_error($ch);
curl_close($ch);

http_response_code($body === false ? 502 : $code);
header('Content-Type: text/html; charset=UTF-8');
echo $body === false ? ('relay error: ' . $err) : $body;
