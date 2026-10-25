"""Reapply privately reviewed locations after a checkpoint merge."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1];path=root/'outputs/map-data.json'
data=json.loads(path.read_text());byid={n['id']:n for n in data['rows']}
for entry in json.loads((root/'outputs/reviewed-locations.json').read_text()):
    n=byid.get(entry['note_id'])
    if not n:continue
    p={k:v for k,v in entry.items() if k!='note_id'}
    if not any(x['name']==p['name'] for x in n.get('locations',[])):n.setdefault('locations',[]).append(p)
    n['candidate_locations']=[];n['location_review']='partial'
temp=path.with_suffix('.tmp');temp.write_text(json.dumps(data,ensure_ascii=False,indent=2));temp.replace(path)
