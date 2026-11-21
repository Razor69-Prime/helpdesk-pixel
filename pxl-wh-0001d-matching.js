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
 return {matchOfficial,proposals};
});
