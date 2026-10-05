/* PXL-PROBUS-BADGE-0001 — visual-only PROBUS badge for item pickers. */
(function(){
  'use strict';
  const REV='PXL-PROBUS-BADGE-0001';
  if(window.PXL_PROBUS_BADGE?.revision===REV)return;
  const isProbus=item=>String(item?.source_key||'').startsWith('MANUAL:PROBUS:');
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
    rows.forEach(el=>{const item=catalog.find(x=>String(x.id)===String(el.dataset.id));if(isProbus(item))addBadge(el.querySelector('b'))});
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
    rows.forEach(el=>{const id=mrId(el),item=catalog.find(x=>String(x.id)===String(id));if(isProbus(item))addBadge(el.querySelector('b'))});
  }
  function decorate(root=document){decorateSO(root);decorateMR(root)}
  const install=()=>{
    decorate(document);
    new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n instanceof Element)decorate(n)}))).observe(document.documentElement,{childList:true,subtree:true});
  };
  window.PXL_PROBUS_BADGE={revision:REV,isProbus,refresh:()=>decorate(document)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
