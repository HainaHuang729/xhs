# Coordinate conversion

`eviltransform.py` is the Python implementation from
https://github.com/googollee/eviltransform (retrieved 2026-10-20).
Its BSD license and copyright notice are retained in `eviltransform.LICENSE`.

It is used offline only for explicitly identified GCJ-02 source coordinates in
reviewed mainland-China reference points. Original source coordinates, source
URLs and the conversion method stay with each point. The result is an approximate
WGS84 conversion, not a measured shop entrance. Do not use it for coordinates whose
original system is unknown, or for HK government grid coordinates.

Check the published Shanghai/Shenzhen/Beijing fixtures with
`python3 scripts/check-coordinates.py`.
