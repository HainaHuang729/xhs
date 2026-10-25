"""Merge collector checkpoints without downgrading successful details or local photos."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
    path=ROOT/'outputs'/'map-data.json';data=json.loads(path.read_text());byid={r['id']:r for r in data['rows']}
    for file in sorted((Path.home()/'Downloads').glob('xhs-gba-*.json'),key=lambda p:p.stat().st_mtime):
        try:patches=json.loads(file.read_text())
        except (OSError,ValueError):continue
        if not isinstance(patches,list):continue
        for patch in patches:
            old=byid.get(patch.get('id'))
            if not old:continue
            for k,v in patch.items():
                if k in ('image_diagnostic','locations','images','cover_image','detail_error','photo_error','content','place_hints'):continue
                old[k]=v
            if patch.get('content'):
                old['content']=patch['content'];old.pop('detail_error',None)
            elif not old.get('content') and patch.get('detail_error'):old['detail_error']=patch['detail_error']
            if patch.get('photo_checked_at') and not patch.get('photo_error'):
                old['body_status']='loaded' if old.get('content') else 'empty';old.pop('detail_error',None)
            if patch.get('photo_error'):old['photo_error']=patch['photo_error']
            elif patch.get('photo_checked_at'):old.pop('photo_error',None)
            old['place_hints']=list(dict.fromkeys(old.get('place_hints',[])+patch.get('place_hints',[])))
            remote=[u for u in patch.get('images',[]) if u.startswith('https://')]
            if remote and (patch.get('photo_checked_at') or len(remote)>=len(old.get('remote_images',[]))):old['remote_images']=remote
            if not old.get('images') and remote:old['images']=remote;old['cover_image']=remote[0]
    c=data.setdefault('coverage',{});c.update(gba_processed=sum(bool(n.get('detail_checked_at')) for n in data['rows']),photo_notes=sum(bool(n.get('images')) for n in data['rows']),gba_loaded=sum(bool(n.get('content')) for n in data['rows'] if n.get('detail_checked_at')),gba_failed=sum(bool(n.get('detail_error')) and not n.get('content') for n in data['rows']))
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(data,ensure_ascii=False,indent=2));temp.replace(path)
    print(json.dumps(c,ensure_ascii=False))
if __name__=='__main__':main()
