'use strict';
// Shared read-only helpers for Warehouse material proposals. Never infer a SKU from fuzzy similarity.
(function(root,factory){
 const helpers=factory();
 if(typeof module==='object'&&module.exports)module.exports=helpers;
 if(root)root.PXL_WH_MATERIAL_MATCH=helpers;
})(typeof window!=='undefined'?window:null,function(){
 const txt=x=>String(x??'').trim();
 const normalize=x=>txt(x).toLocaleLowerCase('id-ID').replace(/\s+/g,' ');
 function matchOfficial(item,catalog){
  const list=Array.isArray(catalog)?catalog:[];
  const id=txt(item?.inventory_item_id||item?.item_id);
  if(id){
   const match=list.find(x=>x.id!=null&&txt(x.id)===id);
   if(match)return {item:match,reason:'inventory_id'};
  }
  const px=txt(item?.sku);
  if(px.startsWith('PX-')){
   const match=list.find(x=>txt(x.sku)===px);
   if(match)return {item:match,reason:'official_sku'};
  }
  const name=normalize(item?.name||item?.item_name);
  if(name){
   const equal=list.filter(x=>normalize(x.name)===name);
   if(equal.length===1)return {item:equal[0],reason:'unique_exact_name'};
  }
  return null;
 }
 function proposals(record,catalog){
  const items=[...(Array.isArray(record?.items)?record.items:[]),...(Array.isArray(record?.manual_items)?record.manual_items:[])];
  return items.map((original,index)=>{
   const matched=matchOfficial(original,catalog);
   return {index,name:txt(original.name||original.item_name),source:txt(original.source)||'SO/WO',
    planned_qty:Number(original.qty)||0,unit:txt(original.unit)||'pcs',
    sku:matched?.item?.sku||'',catalog_item:matched?.item||null,
    reason:matched?.reason||'unmapped',requires_confirmation:true};
  });
 }
 // Candidate suggestions are never automatic SKU assignments; operator must explicitly choose.
 const ignored=new Set(['dan','yang','untuk','dengan','per','pack','pcs','pc','unit','buah','meter','m','mm','mp','gb','cctv','camera','kamera','material','paket','listrik']);
 const norm=x=>txt(x).toLocaleLowerCase('id-ID').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
 const split=x=>norm(x).split(' ').filter(Boolean);
 const significant=x=>split(x).filter(w=>w.length>1&&!ignored.has(w));
 const measurements=x=>{
  const result={};
  for(const match of norm(x).matchAll(/\b(\d+(?:[.,]\d+)?)\s*(gb|mp|meter|mm|m)\b/g)){
   const unit=match[2]==='m'?'meter':match[2];
   (result[unit]||=(new Set())).add(Number(match[1]));
  }
  for(const match of norm(x).matchAll(/\b(\d+)(gb|mp|mm|m)\b/g)){
   const unit=match[2]==='m'?'meter':match[2];
   (result[unit]||=(new Set())).add(Number(match[1]));
  }
  return result;
 };
 function suggestOfficial(item,catalog,maxResults=3){
  const query=txt(item?.name||item?.item_name);
  if(!query||!Array.isArray(catalog))return [];
  const tokens=significant(query),qmeasure=measurements(query);
  const descriptive=tokens.filter(t=>/[a-z]/.test(t));
  const brandWords=['imou','ezviz','hikvision','hilook','dahua','ruijie','sanDisk','hiksemi','kingston'];
  const brand=brandWords.find(w=>descriptive.includes(w.toLowerCase()));
  if(!descriptive.length)return [];
  const matched=[];
  for(const candidate of catalog){
   if(!/^PX-/i.test(txt(candidate.sku))||!candidate.name)continue;
   const candidateTokens=significant(candidate.name);
   if(brand&&!candidateTokens.includes(brand.toLowerCase()))continue;
   const overlap=tokens.filter(t=>candidateTokens.includes(t));
   const overlapDescriptive=descriptive.filter(t=>candidateTokens.includes(t));
   const ratio=overlapDescriptive.length/descriptive.length;
   if(!overlapDescriptive.length||ratio<0.65)continue;
   const cmeasure=measurements(candidate.name);
   let contradiction=false;
   for(const [unit,values] of Object.entries(qmeasure)){
    // Never offer a size-specific item as a generic or different-size product.
    if(!cmeasure[unit]||![...values].some(v=>cmeasure[unit].has(v))){contradiction=true;break;}
   }
   if(contradiction)continue;
   // A model-like code (H8C, THC-B120-PC) is never exchanged for a different model.
   const modelTokens=tokens.filter(t=>/[a-z]/.test(t)&&/\d/.test(t)&&t.length>=3);
   if(modelTokens.some(t=>!candidateTokens.includes(t)))continue;
   // A package item can only suggest other explicitly labeled packages.
   if(/\bpaket\b/i.test(query)&&!/\bpaket\b/i.test(candidate.name))continue;
   const score=ratio*10+overlap.length+
    (norm(query)===norm(candidate.name)?20:0)+
    (norm(candidate.name).includes(norm(query))?4:0);
   matched.push({item:candidate,score,reason:'Kemiripan nama — wajib konfirmasi'});
  }
  return matched.sort((a,b)=>b.score-a.score||
   String(a.item.name).localeCompare(String(b.item.name))||
   String(a.item.sku).localeCompare(String(b.item.sku))).slice(0,Math.max(1,Math.min(3,Number(maxResults)||3)));
 }

 return {matchOfficial,proposals,suggestOfficial};
});
