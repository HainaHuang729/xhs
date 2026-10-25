"""Published WGS84/GCJ02 fixtures; https://github.com/googollee/eviltransform/python/test.py."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'/'vendor'))
from eviltransform import gcj2wgs_exact,distance
fixtures=[(31.1774276,121.5272106,31.17530398364597,121.531541859215),(22.543847,113.912316,22.540796131694766,113.9171764808363),(39.911954,116.377817,39.91334545536069,116.38404722455657)]
for lat,lng,gcjlat,gcjlng in fixtures:
 converted=gcj2wgs_exact(gcjlat,gcjlng)
 assert distance(*converted,lat,lng)<.5,(lat,lng,converted)
print('公开坐标转换样例检查通过（上海、深圳、北京）')
