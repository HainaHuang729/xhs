"""Recognize cached photos with macOS Vision. Text stays on this computer."""
import json,subprocess,tempfile,hashlib
from pathlib import Path
from collections import defaultdict
ROOT=Path(__file__).resolve().parents[1]
def main():
    sdk=Path('/Library/Developer/CommandLineTools/SDKs/MacOSX15.4.sdk')
    if not sdk.exists():sdk=Path(subprocess.check_output(['xcrun','--sdk','macosx','--show-sdk-path'],text=True).strip())
    cache=ROOT/'outputs'/'photo-ocr.json'
    with tempfile.TemporaryDirectory(prefix='xhs-ocr-') as tmp:
        binary=str(Path(tmp)/'ocr')
        subprocess.run(['clang','-isysroot',str(sdk),'-fobjc-arc','-framework','Foundation','-framework','Vision',str(ROOT/'tools'/'ocr_note_photos.m'),'-o',binary],check=True)
        args=[binary,str(ROOT/'outputs'/'media')]
        hashes={(p.parent.name,p.name):hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'outputs'/'media').glob('*/*.webp')}
        previous=json.loads(cache.read_text()) if cache.exists() else []
        valid=[r for r in previous if r.get('sha256')==hashes.get((r['note_id'],r['image'])) and not r.get('error')]
        filtered=Path(tmp)/'valid-cache.json';filtered.write_text(json.dumps(valid));args.append(str(filtered))
        rows=json.loads(subprocess.check_output(args))
    for row in rows:row['sha256']=hashes.get((row['note_id'],row['image']))
    cache.write_text(json.dumps(rows,ensure_ascii=False,indent=2))
    data_path=ROOT/'outputs'/'map-data.json';data=json.loads(data_path.read_text())
    active={note['id']:{Path(image).name for image in note.get('images',[]) if image.startswith('/media/'+note['id']+'/')} for note in data['rows']}
    grouped=defaultdict(list)
    for row in rows:
        if row.get('text') and row['image'] in active.get(row['note_id'],set()):grouped[row['note_id']].append('照片 '+row['image']+'\n'+row['text'])
    for note in data['rows']:
        note['image_text']='\n\n'.join(grouped.get(note['id'],[]))
        if note['id'] in grouped:note['ocr_review']='unverified'
    data.setdefault('coverage',{})['ocr_notes']=len(grouped)
    temp=data_path.with_suffix('.next.json');temp.write_text(json.dumps(data,ensure_ascii=False,indent=2));temp.replace(data_path)
    print(json.dumps({'images':len(rows),'images_with_text':sum(bool(r.get('text')) for r in rows),'notes_with_text':len(grouped)}))
if __name__=='__main__':main()
