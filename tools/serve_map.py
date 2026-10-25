"""Serve only the map, its photos and the favorites export; optional private LAN access."""
import argparse
import hmac
import ipaddress
import json
import re
import secrets
import socket
import subprocess
import sys
from http.cookies import SimpleCookie, CookieError
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
MAP_ROOT = (ROOT / 'map').resolve()


def favorites_response(root):
    """Keep personal review annotations in ignored data alongside the export."""
    source = root / 'outputs/map-data.json'
    overlay = root / 'outputs/discovery-reviews.json'
    payload = json.loads(source.read_text()) if source.is_file() else []
    if overlay.is_file():
        reviews = json.loads(overlay.read_text())
        if isinstance(payload, list):
            payload = {'rows': payload}
        payload = {**payload, 'discovery_reviews': reviews}
    body = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode()
    revision = ':'.join(str(p.stat().st_mtime_ns) if p.is_file() else '0' for p in (source, overlay))
    return body, revision


def lan_address():
    if sys.platform == 'darwin':
        try:
            value = subprocess.check_output(['ipconfig', 'getifaddr', 'en0'], text=True, stderr=subprocess.DEVNULL).strip()
            if ipaddress.ip_address(value).is_private:
                return value
        except (OSError, ValueError, subprocess.CalledProcessError):
            pass
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(('10.255.255.255', 1))
            value = probe.getsockname()[0]
        if ipaddress.ip_address(value).is_private:
            return value
    except (OSError, ValueError):
        pass
    return None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(MAP_ROOT), **kwargs)

    @property
    def is_local(self):
        return ipaddress.ip_address(self.client_address[0]).is_loopback

    def authorized(self):
        if self.is_local:
            return True
        try:
            cookie = SimpleCookie(self.headers.get('Cookie', ''))
            return hmac.compare_digest(cookie['xhs_map_access'].value.encode(), self.server.access_key.encode())
        except (KeyError, ValueError, CookieError):
            return False

    def log_message(self, fmt, *args):
        # The one-time connection URL must never appear in access logs.
        if args and '/connect?' in str(args[0]):
            args = ('GET /connect [private link]', *args[1:])
        super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def reply(self, body, mime='text/html; charset=utf-8', status=200, cache='no-store', head=False):
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Cache-Control', cache)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if not head:
            self.wfile.write(body)

    def do_HEAD(self):
        self.serve(head=True)

    def do_GET(self):
        self.serve()

    def serve(self, head=False):
        url = urlsplit(self.path)
        path = unquote(url.path)
        if path == '/connect' and self.server.lan_enabled:
            key = parse_qs(url.query).get('key', [''])[0]
            if hmac.compare_digest(key.encode(), self.server.access_key.encode()):
                self.send_response(303)
                self.send_header('Set-Cookie', f'xhs_map_access={key}; HttpOnly; SameSite=Strict; Path=/')
                self.send_header('Location', '/')
                self.send_header('Cache-Control', 'no-store')
                self.end_headers()
                return
        if path == '/api/access':
            if not self.is_local:
                self.reply(b'{"error":"Open the phone connection on the computer."}', 'application/json', 403, head=head)
                return
            publication = ROOT / 'outputs/cloud-publication.json'
            if publication.is_file():
                try:
                    cloud = json.loads(publication.read_text())
                    parsed = urlsplit(cloud['url'])
                    if cloud.get('status') == 'succeeded' and parsed.scheme == 'https' and parsed.hostname.endswith('.chatgpt.site') and not parsed.username and not parsed.password:
                        body = json.dumps({'url': cloud['url'], 'display_url': cloud['url'], 'mode': 'cloud'}).encode()
                        self.reply(body, 'application/json', head=head)
                        return
                except (ValueError, KeyError, AttributeError):
                    pass
            host = lan_address() if self.server.lan_enabled else None
            base = f'http://{host}:{self.server.server_port}' if host else None
            body = json.dumps({'url': base + '/connect?key=' + self.server.access_key if base else None, 'display_url': base}).encode()
            self.reply(body, 'application/json', head=head)
            return
        if not self.authorized():
            body = ('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
                    '<title>连接收藏去处</title><body style="font:16px/1.8 system-ui;background:#edf3fa;color:#294766;padding:48px 24px;max-width:420px;margin:auto">'
                    '<h1>把下一站，带在身边。</h1><p>在电脑上的收藏地图点击「手机打开」，用手机相机扫描二维码。</p><p>手机与电脑需连接同一 Wi-Fi。服务重新启动后，请重新扫码连接。</p></body></html>').encode()
            self.reply(body, status=401, head=head)
            return
        if re.fullmatch(r'/media/[a-f0-9]{24}/[0-9]+\.webp', path):
            file = ROOT / 'outputs' / path.lstrip('/')
            if not file.is_file():
                self.send_error(404)
                return
            self.reply(file.read_bytes(), 'image/webp', cache='private, max-age=86400', head=head)
            return
        if path == '/api/favorites':
            body, revision = favorites_response(ROOT)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('ETag', '"' + revision + '"')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            if not head:
                self.wfile.write(body)
            return
        file = (MAP_ROOT / path.lstrip('/')).resolve()
        if file == MAP_ROOT:
            file = MAP_ROOT / 'index.html'
        if not file.is_relative_to(MAP_ROOT) or not file.is_file() or file.name.startswith('.'):
            self.send_error(404)
            return
        self.reply(file.read_bytes(), self.guess_type(str(file)), head=head)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lan', action='store_true', help='Enable phone access on the same Wi-Fi, paired from the computer')
    parser.add_argument('--port', type=int, default=8787)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('0.0.0.0' if args.lan else '127.0.0.1', args.port), Handler)
    server.lan_enabled = args.lan
    server.access_key = secrets.token_urlsafe(24)
    print(f'收藏地图 http://127.0.0.1:{args.port}', flush=True)
    if args.lan:
        print('手机与电脑连接同一 Wi-Fi，在电脑页面点击「手机打开」扫码。', flush=True)
    server.serve_forever()
