// A quiet, local coastline under the original WGS84 points.
export function setupExploreMap(map, L) {
 const street=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'});
 const coast=L.layerGroup(),labels=L.layerGroup();
 const $=s=>document.querySelector(s);
 const areas=[['深圳',22.66,114.02,'city'],['香港',22.42,114.18,'city'],['南山',22.534,113.935],['福田',22.554,114.063],['罗湖',22.562,114.145],['盐田',22.598,114.285],['龙华',22.698,114.035],['宝安',22.663,113.83],['大鹏',22.565,114.48],['沙田',22.387,114.218],['大埔',22.463,114.188],['九龙',22.329,114.17],['香港岛',22.247,114.18],['大屿山',22.235,113.96],['西贡',22.376,114.304]];
 for(const [name,lat,lng,kind] of areas) L.marker([lat,lng],{interactive:false,keyboard:false,icon:L.divIcon({className:'area-label '+(kind||''),html:name,iconSize:[100,30],iconAnchor:[50,15]}),zIndexOffset:-1000}).addTo(labels);
 let mode='abstract';
 function updateLabels(){if(mode==='abstract'&&map.getZoom()<=14){if(!map.hasLayer(labels))labels.addTo(map);}else map.removeLayer(labels);}
 function setMode(next){
  mode=next;map.setMinZoom(mode==='abstract'?7:2);document.body.dataset.mapStyle=mode;
  $('#abstractMap').classList.toggle('active',mode==='abstract');$('#streetMap').classList.toggle('active',mode==='street');
  $('#abstractMap').setAttribute('aria-pressed',String(mode==='abstract'));$('#streetMap').setAttribute('aria-pressed',String(mode==='street'));
  if(mode==='abstract'){
   map.removeLayer(street);coast.addTo(map);map.setMaxBounds([[20.3,110.3],[25.7,116.7]]);
   map.attributionControl.removeAttribution(street.options.attribution);
   map.attributionControl.addAttribution('海岸 <a href="https://www.naturalearthdata.com/">Natural Earth</a>');
   $('#mapNote').textContent='海岸与片区的轻描绘 · 地点坐标保持真实';
  }else{
   map.removeLayer(coast);map.setMaxBounds(null);street.addTo(map);
   map.attributionControl.removeAttribution('海岸 <a href="https://www.naturalearthdata.com/">Natural Earth</a>');
   $('#mapNote').textContent='街道细节仅供参考，出发前请核对分店与入口';
  }
  updateLabels();
 }
 $('#abstractMap').onclick=()=>setMode('abstract');$('#streetMap').onclick=()=>setMode('street');map.on('zoomend',updateLabels);
 setMode('abstract');
 fetch('data/gba-land.json').then(r=>{if(!r.ok)throw Error('coast');return r.json();}).then(data=>L.geoJSON(data,{interactive:false,style:{className:'coast-shape',color:'#bccfe3',weight:1.2,fillColor:'#f8faff',fillOpacity:1,smoothFactor:2}}).addTo(coast)).catch(()=>{setMode('street');$('#mapNote').textContent='漫游图暂时未能载入，已切换街道图';});
 return {ensureExtent(points){if(points.some(p=>p.lat<20.3||p.lat>25.7||p.lng<110.3||p.lng>116.7))setMode('street');}};
}
