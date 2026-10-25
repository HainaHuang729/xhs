"""Create a self-contained private Sites snapshot, without runtime or account tokens."""
import argparse
import copy
import json
import shutil
import subprocess
import re
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIELDS = '''id title content body_status category category_basis category_manual category_review category_reviewed_basis
cover_image images image_text locations candidate_locations place_hints place_hints_reviewed region_review
location_review location_review_reason location_review_sources location_review_status location_reviewed_at
food_groups food_cuisines food_groups_manual food_cuisines_manual food_classification_basis food_classification_note food_taxonomy_version
photo_checked_at photo_complete photo_saved photo_total photo_total_expected album_sync'''.split()


def clean_sources(value):
    if isinstance(value, dict):
        return {key: clean_sources(item) for key, item in value.items()
                if key.lower() not in {'cookie', 'authorization', 'access_token', 'xsec_token', 'web_session'}}
    if isinstance(value, list):
        return [clean_sources(item) for item in value]
    if isinstance(value, str):
        def clean_url(match):
            url = urlsplit(match.group(0))
            query = [(key, val) for key, val in parse_qsl(url.query, keep_blank_values=True)
                     if key.lower() not in {'xsec_token', 'xsec_source', 'access_token', 'token', 'authorization'}]
            return urlunsplit((url.scheme, url.netloc, url.path, urlencode(query), url.fragment))
        return re.sub(r'https?://[^\s<>"，。！？（）]+', clean_url, value)
    return value


def export(target,web_photos=False,reuse_web_photos=False,max_edge=1200,quality=64):
    target = target.resolve()
    public = target / 'dist'
    public.mkdir(parents=True, exist_ok=True)
    for item in (ROOT / 'map').iterdir():
        if item.name.startswith('_') or item.name.startswith('.'):
            continue
        if item.is_dir():
            shutil.copytree(item, public / item.name, dirs_exist_ok=True)
        else:
            shutil.copy2(item, public / item.name)
    result = subprocess.run(['node', str(ROOT / 'tools/prepare_hosted_snapshot.mjs')], capture_output=True, text=True, check=True)
    source = json.loads(result.stdout)
    previous_photos = None
    if reuse_web_photos:
        previous = json.loads((public / 'data/favorites.json').read_text())
        previous_photos = {photo for row in previous['rows'] for photo in
                           [row.get('cover_image', ''), *row.get('images', [])]
                           if photo.startswith('/media/')}
    rows, photos = [], set()
    for raw in source['rows']:
        row = {k: raw[k] for k in FIELDS if k in raw}
        row['locations'] = copy.deepcopy(row.get('locations', []))
        for point in row['locations']:
            point.pop('nearest_branch_selection_history', None)
            if 'nearest_branch_selection' in point:
                point['nearest_branch_selection'] = {
                    k: v for k, v in point['nearest_branch_selection'].items()
                    if k in {'brand', 'display', 'status', 'coverage', 'reviewed_at',
                             'updated_at', 'nearest_selection_confirmed', 'origin_coordinate_status'}
                }
        row['url'] = 'https://www.xiaohongshu.com/explore/' + row['id']
        if 'album_sync' in row:
            row['album_sync'] = {k: row['album_sync'][k] for k in ['album', 'status', 'verified_at'] if k in row['album_sync']}
        for photo in [row.get('cover_image', ''), *row.get('images', [])]:
            if photo.startswith('/media/'):
                photos.add(photo)
        rows.append(clean_sources(row))
    if reuse_web_photos and photos != previous_photos:
        raise ValueError('Photo references changed; export again with --web-photos')
    def write_photo(photo):
        file = ROOT / 'outputs' / photo.lstrip('/')
        if not file.is_file():
            raise FileNotFoundError(f'Missing photo {photo}')
        dest = public / photo.lstrip('/')
        dest.parent.mkdir(parents=True, exist_ok=True)
        if reuse_web_photos:
            if not dest.is_file() or not dest.stat().st_size:
                raise FileNotFoundError(f'Missing optimized photo {photo}')
        elif web_photos:
            from PIL import Image,ImageOps
            original=file.read_bytes()
            with Image.open(BytesIO(original)) as image:
                image=ImageOps.exif_transpose(image)
                image.thumbnail((max_edge,max_edge),Image.Resampling.LANCZOS)
                out=BytesIO();image.save(out,'WEBP',quality=quality,method=4)
                body=out.getvalue()
            dest.write_bytes(body if len(body)<len(original) else original)
        else:
            shutil.copy2(file, dest)
        return dest.stat().st_size
    with ThreadPoolExecutor(max_workers=6) as pool:
        size = sum(pool.map(write_photo, sorted(photos)))
    # Remove only obsolete generated copies, keeping original local images intact.
    for file in (public / 'media').glob('*/*.webp'):
        if '/' + file.relative_to(public).as_posix() not in photos:
            file.unlink()
    payload = {'rows': rows, 'coverage': source.get('coverage'), 'snapshot_at': datetime.now(timezone.utc).isoformat()}
    reviews = ROOT / 'outputs/discovery-reviews.json'
    if reviews.is_file():
        payload['discovery_reviews'] = json.loads(reviews.read_text())
    (public / 'data/favorites.json').write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')))
    for page in public.glob('*.html'):
        html = page.read_text().replace('<title>', '<meta name="favorites-source" content="data/favorites.json"><meta name="map-hosting" content="private-cloud">\n  <title>', 1)
        html = html.replace('手机与电脑连接同一 Wi-Fi，并保持这台电脑和地图服务开启。也可以在手机浏览器中添加到主屏幕。', '用手机登录同一个 ChatGPT 账号即可查看，电脑关机也能用。可在手机浏览器中添加到主屏幕。')
        html = html.replace('本机分类调整不会自动同步到小红书专辑。', '手动调整仅保存在当前浏览器，不会自动同步到其他设备或小红书。')
        page.write_text(html)
    (public / '_headers').write_text('/*\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n/data/favorites.json\n  Cache-Control: private, no-cache\n/media/*\n  Cache-Control: private, max-age=86400\n')
    (target / '.gitignore').write_text('.DS_Store\nnode_modules/\n.sites-runtime/\n')
    counts = source.get('coverage', {})
    (target / 'README.md').write_text('# 收藏去处：私人云端快照\n\n由本地 xhs/tools/export_hosted_map.py 导出。dist/ 包含完整网页、当前已导入收藏与页面引用的全部本地照片。\n使用 Sites 默认的仅所有者登录访问；不要改为公开。\n云端包含当前已缓存照片的手机版WebP副本，原图保留在本地；尚未缓存的图片可通过原帖查看。照片不依赖电脑、局域网或临时小红书图片链接。原笔记链接为无临时令牌的公开笔记路径。\n手动分类和地点编辑仍只保存于当前浏览器；此快照不会自动同步小红书新收藏。\n'
        + f"\n当前快照：港深 {counts.get('hksz_total')} 条收藏，{counts.get('hksz_located')} 条已上图、{counts.get('hksz_points')} 个标记；{len(photos)} 张照片。多店合集按门店关联原帖图；代选分店及区域参考点按当前本地规则排除。\n")
    print(json.dumps({'rows':len(rows),'photos':len(photos),'photo_bytes':size,'target':str(target)},ensure_ascii=False))


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('target',type=Path)
    photo_mode=parser.add_mutually_exclusive_group()
    photo_mode.add_argument('--web-photos',action='store_true',help='Optimize photo copies for mobile hosting; requires Pillow')
    photo_mode.add_argument('--reuse-web-photos',action='store_true',help='Reuse existing optimized copies for data-only updates; requires identical photo references')
    parser.add_argument('--max-edge',type=int,default=1200)
    parser.add_argument('--quality',type=int,default=64)
    args=parser.parse_args()
    export(args.target,args.web_photos,args.reuse_web_photos,args.max_edge,args.quality)
