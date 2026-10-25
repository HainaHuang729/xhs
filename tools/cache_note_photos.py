"""Persist note photographs locally; only official Xiaohongshu image CDN URLs are accepted."""
import argparse,json,re,urllib.request,urllib.parse,concurrent.futures
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def cache_photo(task):
    note_id,index,url=task
    parsed=urllib.parse.urlparse(url)
    if parsed.scheme!='https' or not (parsed.hostname or '').endswith('.xhscdn.com') or parsed.username or parsed.port not in (None,443):return None
    folder=ROOT/'outputs'/'media'/note_id;folder.mkdir(parents=True,exist_ok=True)
    dest=folder/f'{index}.webp'
    manifest=dest.with_suffix('.source.json');asset=parsed.path.rsplit('/',1)[-1]
    try:
        if not dest.exists() or not manifest.exists() or json.loads(manifest.read_text()).get('asset')!=asset:
            req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
            with urllib.request.urlopen(req,timeout=20) as response:
                if not response.headers.get('Content-Type','').startswith('image/'):return None
                data=response.read(8*1024*1024+1)
                if len(data)>8*1024*1024:return None
                temp=dest.with_suffix('.tmp');temp.write_bytes(data);temp.replace(dest)
                manifest.write_text(json.dumps({'asset':asset}))
        return note_id,index,f'/media/{note_id}/{index}.webp'
    except Exception:return None

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--max-photos',type=int,default=4);ap.add_argument('--all',action='store_true',help='Save every available photo');args=ap.parse_args()
    path=ROOT/'outputs'/'map-data.json';data=json.loads(path.read_text());tasks=[];order={}
    for row in data['rows']:
        if not re.fullmatch('[a-f0-9]{24}',row['id']):continue
        remote=row.get('remote_images') or [u for u in row.get('images',[]) if str(u).startswith('https://')]
        if not remote:continue
        row['remote_images']=remote;row['photo_total']=max(len(remote),row.get('photo_total_expected',0))
        indices=list(range(len(remote))) if args.all else sorted(set([0,1,*range(max(0,len(remote)-2),len(remote))]))[:args.max_photos]
        order[row['id']]=indices
        tasks.extend((row['id'],i,remote[i]) for i in indices if i<len(remote))
    results={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(cache_photo,tasks):
            if result:results[(result[0],result[1])]=result[2]
    for row in data['rows']:
        if row['id'] not in order:continue
        local=[results[(row['id'],i)] for i in order[row['id']] if (row['id'],i) in results]
        if local:
            row['images']=local;row['cover_image']=local[0];row['photo_saved']=len(local);row['photo_complete']=bool(row.get('photo_checked_at')) and len(local)==row['photo_total']
    latest=json.loads(path.read_text());updates={r['id']:r for r in data['rows'] if r['id'] in order}
    for row in latest['rows']:
        update=updates.get(row['id'])
        if update:
            for key in ('images','cover_image','photo_saved','photo_total','photo_complete'):
                if key in update:row[key]=update[key]
    data=latest
    data.setdefault('coverage',{})['photos_saved']=sum(n.get('photo_saved',0) for n in data['rows'])
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(data,ensure_ascii=False,indent=2));temp.replace(path)
    print(json.dumps({'photos_saved':len(results),'notes_with_photos':sum(bool(n.get('photo_saved')) for n in data['rows'])}))
if __name__=='__main__':main()
