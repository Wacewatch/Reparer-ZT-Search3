"""ZT Search relay (Python 3, aucune dépendance). Lancer : python relay.py  -> http://localhost:8787/?url=...&key=..."""
import gzip
import http.server
import urllib.parse
import urllib.request
import ssl

RELAY_KEY = 'CHANGE_MOI'
PORT = 8787
ALLOWED = ('zone-telechargement.org', 'zoneurs.net')
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip',
    'Referer': 'https://www.zone-telechargement.org/',
}


class Relay(http.server.BaseHTTPRequestHandler):
    def _send(self, code, body: bytes):
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=UTF-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if q.get('key', [''])[0] != RELAY_KEY:
            return self._send(401, b'bad key')
        url = q.get('url', [''])[0]
        host = (urllib.parse.urlparse(url).hostname or '').lower()
        if not any(host == d or host.endswith('.' + d) for d in ALLOWED):
            return self._send(400, b'url not allowed')
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=25, context=ssl._create_unverified_context()) as r:
                data = r.read()
                if r.headers.get('Content-Encoding') == 'gzip':
                    data = gzip.decompress(data)
                self._send(r.status, data)
        except urllib.error.HTTPError as e:
            self._send(e.code, e.read())
        except Exception as e:
            self._send(502, f'relay error: {e}'.encode())


if __name__ == '__main__':
    print(f'Relay ZT sur http://0.0.0.0:{PORT}  (cle: {RELAY_KEY})')
    http.server.ThreadingHTTPServer(('0.0.0.0', PORT), Relay).serve_forever()
