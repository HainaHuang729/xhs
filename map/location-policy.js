// The user removed alternative branches and coarse reference locations.
// A merchant's own POI is distinct from a building/area used as a proxy.
const coarsePrecisions=new Set(['building','area','street','intersection']);
const alternativeKinds=new Set([
 'nearest-choice','nearest-verified-choice','nearest-verified-candidate',
 'recommended-alternative','same-brand-alternative','user-authorized-alternative-branch',
 'selected-verified-alternative','same-brand-reference','market-reference',
 'same-name-public-listing','canonical-verified-branch-reused',
 'original-area-candidate','verified-same-area-candidate','original-area-brand-inferred',
 'original-branch-area-reference',
]);
const coarseName=/(?:楼宇|楼栋|建筑|商场|市场|园区|街区|范围|区域|商圈|地址)[^，,；;（）()]{0,8}参考|参考(?:楼宇|楼栋|建筑|区域|范围)/u;
const coarseDetail=/(?:这是|仅为|只是|仅作|只作|采用|使用|坐标为|为对应|为所标明)[^。；;]{0,24}(?:楼宇|楼栋|建筑|商场|市场|园区|区域|范围)[^。；;]{0,18}参考|楼宇或区域参考点|楼宇或园区范围参考/u;
const alternativeName=/代选|代選|推荐替代|按距离选|按距離選|同品牌参考|同品牌參考/u;
const unidentifiedBranch=/(?:原帖|原文|原图|原收藏|正文)[^。；;\n]{0,14}(?:未唯一指明分店|未限定分店|未标分店|未标明分店|未指明分店)|(?:原帖|原文|原图|原收藏|正文)[^。；;\n]{0,14}分店(?:未确认|未核实|未核定|未定|不明|待核)/u;

export function locationExclusionReasons(point){
 const reasons=[];
 if(point.recommendation_status==='avoid'||point.excluded_by_user===true||/原帖不推荐|原帖不推薦|原帖为不推荐|原帖為不推薦|原帖为[^。；;]{0,6}踩雷/u.test([point.name,point.status_note].filter(Boolean).join(' ')))reasons.push('negative-recommendation');
 if(coarsePrecisions.has(point.precision))reasons.push('coarse-reference');
 if(coarseName.test(String(point.name||''))||coarseDetail.test(String(point.precision_detail||'')))reasons.push('coarse-reference-label');
 if(alternativeKinds.has(point.selection_kind)||point.branch_choice||point.selection_origin||point.selection_note||
    point.original_branch_verified===false||point.original_branch_status||
    ['alternative-branch-explicit','brand-and-city-supported'].includes(point.favorite_branch_match)||
    point.branch_selection==='selected-confirmed-alternative'||alternativeName.test(String(point.name||'')))reasons.push('alternative-or-unconfirmed-branch');
 const evidence=[point.evidence,point.reason,point.status_note,point.selection_note,point.branch_note].filter(Boolean).join('\n');
 if(unidentifiedBranch.test(evidence))reasons.push('original-branch-not-identified');
 return [...new Set(reasons)];
}
export const isAllowedLocation=point=>locationExclusionReasons(point).length===0;
