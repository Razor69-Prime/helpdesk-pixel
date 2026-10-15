/* PXL-PROBUS-BADGE-0001 — visual-only PROBUS badge for item pickers. */
(function(){
  'use strict';
  const REV='PXL-MP-FIX-0001';
  if(window.PXL_PROBUS_BADGE?.revision===REV)return;
  const isProbus=item=>String(item?.source_key||'').startsWith('MANUAL:PROBUS:');

  function ensureSkuHelper(){
    if(window.PXL_MASTER_SKU_MAP)return Promise.resolve(window.PXL_MASTER_SKU_MAP);
    return new Promise(resolve=>{const old=document.querySelector('script[data-pxl-master-sku-map]');if(old){old.addEventListener('load',()=>resolve(window.PXL_MASTER_SKU_MAP||null),{once:true});setTimeout(()=>resolve(window.PXL_MASTER_SKU_MAP||null),1500);return}const s=document.createElement('script');s.dataset.pxlMasterSkuMap='0001';s.src='/pxl-master-sku-map-0001.js?v=PXL-MP-FIX-0001';s.onload=()=>resolve(window.PXL_MASTER_SKU_MAP||null);s.onerror=()=>resolve(null);document.head.appendChild(s)})
  }
  async function enrichCatalogs(){const helper=await ensureSkuHelper();if(!helper)return;try{const so=soCatalog();if(so.length){const enriched=await helper.enrich(so);enriched.forEach((x,i)=>Object.assign(so[i],x))}}catch(_){}try{const mr=mrCatalog();if(mr.length){const enriched=await helper.enrich(mr);enriched.forEach((x,i)=>Object.assign(mr[i],x))}}catch(_){}decorate(document)}
  function addSkuMeta(el,item){if(!el||!item)return;const sku=String(item.master_sku||item.sku||'').trim();if(!sku||el.querySelector('.pxl-master-sku-meta'))return;const meta=document.createElement('small');meta.className='pxl-master-sku-meta';meta.textContent='SKU: '+sku;meta.style.cssText='display:block;margin-top:2px;color:var(--muted,#777);font-size:10px';const b=el.querySelector('b');if(b)b.insertAdjacentElement('afterend',meta);else el.prepend(meta)}
  function addBadge(host){
    if(!host||host.querySelector('.pxl-probus-badge'))return;
    const badge=document.createElement('span');
    badge.className='pxl-probus-badge';
    badge.textContent='PROBUS';
    badge.style.cssText='display:inline-block;margin-left:6px;padding:2px 6px;border-radius:999px;background:#e8f5e9;color:#2e7d32;font-size:9px;font-weight:800;line-height:1.2;vertical-align:1px';
    host.appendChild(badge);
  }
  function soCatalog(){
    try{if(typeof OPT!=='undefined'&&Array.isArray(OPT.inventory_items))return OPT.inventory_items}catch(_){}
    try{return window.PXL_URG_0048_SO?.catalog?.()||[]}catch(_){return[]}
  }
  function mrCatalog(){
    try{if(typeof mrInventoryItems!=='undefined'&&Array.isArray(mrInventoryItems))return mrInventoryItems}catch(_){}
    return [];
  }
  function decorateSO(root=document){
    const rows=root.matches?.('.item-option[data-id]')?[root]:[...(root.querySelectorAll?.('.item-option[data-id]')||[])];
    if(!rows.length)return;
    const catalog=soCatalog();
    rows.forEach(el=>{const item=catalog.find(x=>String(x.id)===String(el.dataset.id));if(!item)return;addSkuMeta(el,item);if(isProbus(item))addBadge(el.querySelector('b'))});
  }
  function mrId(el){
    const raw=String(el.getAttribute('onclick')||'');
    const m=raw.match(/selectMRSearchItem\('([^']*)'\)/);
    return m?m[1].replace(/\\'/g,"'"):'';
  }
  function decorateMR(root=document){
    const selector='#mr-search-results [onclick*="selectMRSearchItem"]';
    const rows=root.matches?.(selector)?[root]:[...(root.querySelectorAll?.(selector)||[])];
    if(!rows.length)return;
    const catalog=mrCatalog();
    rows.forEach(el=>{const id=mrId(el),item=catalog.find(x=>String(x.id)===String(id));if(!item)return;addSkuMeta(el,item);if(isProbus(item))addBadge(el.querySelector('b'))});
  }
  function decorate(root=document){decorateSO(root);decorateMR(root)}
  const install=()=>{
    decorate(document);enrichCatalogs();setTimeout(enrichCatalogs,500);
    new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n instanceof Element)decorate(n)}))).observe(document.documentElement,{childList:true,subtree:true});
  };
  window.PXL_PROBUS_BADGE={revision:REV,isProbus,refresh:()=>decorate(document)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
