"""Check the LAN pairing boundary and allowed resources without browser automation."""
import http.client
import importlib.util
import json
import threading
import tempfile
from pathlib import Path
from urllib.parse import urlsplit

spec = importlib.util.spec_from_file_location('map_server', Path(__file__).resolve().parents[1] / 'tools/serve_map.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
fixture = tempfile.TemporaryDirectory()
mod.ROOT = Path(fixture.name)
sample_id = '1' * 24
sample_dir = mod.ROOT / 'outputs/media' / sample_id
sample_dir.mkdir(parents=True)
(sample_dir / '0.webp').write_bytes(b'test-image')
source_file = mod.ROOT / 'outputs/map-data.json'
source_file.write_text(json.dumps({'rows': [{'id': sample_id, 'title': '测试咖啡店', 'cover_image': f'/media/{sample_id}/0.webp'}]}))
original_source = source_file.read_bytes()
review_file = mod.ROOT / 'outputs/discovery-reviews.json'
review_file.write_text(json.dumps({sample_id: {'reason': '本地测试复核'}}))
server = mod.ThreadingHTTPServer(('0.0.0.0', 0), mod.Handler)
server.lan_enabled = True
server.access_key = 'test-only-temporary-pairing-key'
threading.Thread(target=server.serve_forever, daemon=True).start()


def get(host, path, headers=None, method='GET'):
    conn = http.client.HTTPConnection(host, server.server_port, timeout=5)
    conn.request(method, path, headers=headers or {})
    res = conn.getresponse()
    result = res.status, dict(res.getheaders()), res.read()
    conn.close()
    return result

try:
    assert get('127.0.0.1', '/')[0] == 200
    assert get('127.0.0.1', '/outputs/map-data.json')[0] == 404
    assert get('127.0.0.1', '/../outputs/map-data.json')[0] == 404
    assert get('127.0.0.1', '/vendor/')[0] == 404
    assert get('127.0.0.1', '/api/favorites', method='HEAD')[2] == b''
    assert get('127.0.0.1', '/data/gba-land.json')[0] == 200
    payload = json.loads(get('127.0.0.1', '/api/favorites')[2])
    assert payload['discovery_reviews'][sample_id]['reason'] == '本地测试复核'
    assert source_file.read_bytes() == original_source
    assert get('127.0.0.1', '/outputs/discovery-reviews.json')[0] == 404
    host = mod.lan_address()
    if host:
        assert get(host, '/')[0] == 401
        assert get(host, '/api/favorites')[0] == 401
        assert get(host, '/api/access')[0] == 403
        assert get(host, '/connect?key=wrong')[0] == 401
        status, headers, body = get(host, '/connect?key=' + server.access_key)
        assert status == 303 and headers['Location'] == '/'
        cookie = headers['Set-Cookie'].split(';')[0]
        assert 'HttpOnly' in headers['Set-Cookie']
        assert get(host, '/', {'Cookie': cookie})[0] == 200
        assert get(host, '/api/favorites', {'Cookie': cookie})[0] == 200
        assert get(host, '/api/access', {'Cookie': cookie})[0] == 403
        assert get(host, '/api/favorites', {'Cookie': 'xhs_map_access=wrong'}, 'HEAD')[0] == 401
        rows = json.loads(get(host, '/api/favorites', {'Cookie': cookie})[2])['rows']
        photo = next(n['cover_image'] for n in rows if n.get('cover_image', '').startswith('/media/'))
        assert get(host, photo, {'Cookie': cookie})[0] == 200
        print('局域网配对、收藏读取、照片与目录边界检查通过')
    else:
        print('本机与目录边界检查通过；没有局域网地址，未检查远程配对')
    original_root = mod.ROOT
    with tempfile.TemporaryDirectory() as temp:
        mod.ROOT = Path(temp)
        (mod.ROOT / 'outputs').mkdir()
        publication = mod.ROOT / 'outputs/cloud-publication.json'
        publication.write_text(json.dumps({'status':'succeeded','url':'https://example.chatgpt.site/'}))
        access = json.loads(get('127.0.0.1','/api/access')[2])
        assert access['mode'] == 'cloud' and access['url'] == 'https://example.chatgpt.site/'
        publication.write_text(json.dumps({'status':'pending','url':'https://example.chatgpt.site/'}))
        assert json.loads(get('127.0.0.1','/api/access')[2]).get('mode') != 'cloud'
        publication.write_text(json.dumps({'status':'succeeded','url':'https://example.invalid/'}))
        assert json.loads(get('127.0.0.1','/api/access')[2]).get('mode') != 'cloud'
    mod.ROOT = original_root
    print('手机入口仅使用发布成功的正式云端地址')
finally:
    server.shutdown()
    server.server_close()
    fixture.cleanup()
    server.server_close()
