"""Create a self-contained private Sites snapshot, without runtime or account tokens."""
import argparse
import copy
import json
import shutil
from io import BytesIO
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIELDS = '''id title content body_status category category_basis category_manual category_reviewed_basis
cover_image images image_text locations candidate_locations place_hints place_hints_reviewed
location_review location_review_reason location_review_sources location_review_status location_reviewed_at
food_groups food_cuisines food_groups_manual food_cuisines_manual food_classification_basis food_classification_note food_taxonomy_version
photo_checked_at photo_complete photo_saved photo_total photo_total_expected album_sync'''.split()


def export(target,web_photos=False,reuse_web_photos=False):
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
    source = json.loads((ROOT / 'outputs/map-data.json').read_text())
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
        rows.append(row)
    if reuse_web_photos and photos != previous_photos:
        raise ValueError('Photo references changed; export again with --web-photos')
    size = 0
    for photo in sorted(photos):
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
                image.thumbnail((1600,1600),Image.Resampling.LANCZOS)
                out=BytesIO();image.save(out,'WEBP',quality=78,method=4)
                body=out.getvalue()
            dest.write_bytes(body if len(body)<len(original) else original)
        else:
            shutil.copy2(file, dest)
        size += dest.stat().st_size
    payload = {'rows': rows, 'coverage': source.get('coverage'), 'snapshot_at': datetime.now(timezone.utc).isoformat()}
    reviews = ROOT / 'outputs/discovery-reviews.json'
    if reviews.is_file():
        payload['discovery_reviews'] = json.loads(reviews.read_text())
    (public / 'data/favorites.json').write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')))
    index = public / 'index.html'
    html = index.read_text().replace('<title>', '<meta name="favorites-source" content="data/favorites.json"><meta name="map-hosting" content="private-cloud">\n  <title>', 1)
    html = html.replace('手机与电脑连接同一 Wi-Fi，并保持这台电脑和地图服务开启。也可以在手机浏览器中添加到主屏幕。', '用手机登录同一个 ChatGPT 账号即可查看，电脑关机也能用。可在手机浏览器中添加到主屏幕。')
    html = html.replace('本机分类调整不会自动同步到小红书专辑。', '手动调整仅保存在当前浏览器，不会自动同步到其他设备或小红书。')
    index.write_text(html)
    (public / '_headers').write_text('/*\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n/data/favorites.json\n  Cache-Control: private, no-cache\n/media/*\n  Cache-Control: private, max-age=86400\n')
    (target / '.gitignore').write_text('.DS_Store\nnode_modules/\n.sites-runtime/\n')
    counts = source.get('coverage', {})
    (target / 'README.md').write_text('# 收藏去处：私人云端快照\n\n由本地 xhs/tools/export_hosted_map.py 导出。dist/ 包含完整网页、当前已导入收藏与页面引用的全部本地照片。\n使用 Sites 默认的仅所有者登录访问；不要改为公开。\n图组完整；云端使用手机版WebP压缩副本，原图保留在本地。照片不依赖电脑、局域网或临时小红书图片链接。原笔记链接为无临时令牌的公开笔记路径。\n手动分类和地点编辑仍只保存于当前浏览器；此快照不会自动同步小红书新收藏。\n'
        + f"\n当前快照：港深 {counts.get('hksz_total')} 条收藏，{counts.get('hksz_located')} 条已上图、{counts.get('hksz_points')} 个标记；{len(photos)} 张照片。多店合集按门店关联原帖图，清单、封面及推荐替代门店逐项注明。\n")
    print(json.dumps({'rows':len(rows),'photos':len(photos),'photo_bytes':size,'target':str(target)},ensure_ascii=False))


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('target',type=Path)
    photo_mode=parser.add_mutually_exclusive_group()
    photo_mode.add_argument('--web-photos',action='store_true',help='Optimize photo copies for mobile hosting; requires Pillow')
    photo_mode.add_argument('--reuse-web-photos',action='store_true',help='Reuse existing optimized copies for data-only updates; requires identical photo references')
    args=parser.parse_args()
    export(args.target,args.web_photos,args.reuse_web_photos)
