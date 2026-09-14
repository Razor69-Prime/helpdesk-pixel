/* PXL-URG-0069 — Master Pricelist bridge: demand-load + 5 minute cache.
 * Does not change SO payload, Inventory data, stock, or PR.
 */
(function(){
  'use strict';
  const REV='PXL-URG-0069';
  if(window.PXL_URG_0048_SO?.revision===REV)return;

  let catalog=[];
  let loaded=false;
  let loadedAt=0;
  let loading=null;
  const MAX_AGE_MS=5*60*1000;
  const n=v=>Number(v)||0;
  const rp=v=>'Rp '+Math.round(n(v)).toLocaleString('id-ID');

  async function api(url){
    const token=localStorage.getItem('pixel_token')||sessionStorage.getItem('pixel_token')||'';
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),10000);
    try{
      const r=await fetch(url,{cache:'no-store',signal:controller.signal,headers:token?{Authorization:'Bearer '+token,'X-Auth-Token':token}:{}});
      let d={};try{d=await r.json()}catch(_){}
      if(!r.ok)throw new Error(d.error||('HTTP '+r.status));
      return d;
    }catch(e){
      if(e?.name==='AbortError')throw new Error('Master Pricelist timeout');
      throw e;
    }finally{clearTimeout(timer)}
  }

  async function load(force=false){
    if(!force&&loaded&&Date.now()-loadedAt<MAX_AGE_MS)return catalog;
    if(loading)return loading;
    loading=api('/api/master-pricelist/catalog').then(d=>{
      catalog=Array.isArray(d.catalog)?d.catalog:[];
      loaded=true;loadedAt=Date.now();return catalog;
    }).catch(e=>{console.warn('[PXL-URG-0069] catalog',e.message);return[]}).finally(()=>{loading=null});
    return loading;
  }

  function inventoryId(row){return String(row?.dataset?.inventoryId||'').trim();}
  function sku(row){return String(row?.dataset?.sku||'').trim();}
  function findCatalog(row){
    const id=inventoryId(row);
    if(id){const hit=catalog.find(x=>String(x.inventory_item_id)===id);if(hit)return hit;}
    const code=sku(row).toLowerCase();
    if(!code)return null;
    const matches=catalog.filter(x=>String(x.sku||'').trim().toLowerCase()===code);
    return matches.length===1?matches[0]:null;
  }

  function decorateRow(row){
    if(!row)return;
    const host=row.querySelector('.item-search')?.parentElement||row;
    let badge=row.querySelector('.pxl-master-hpp-badge');
    if(!badge){
      badge=document.createElement('div');
      badge.className='pxl-master-hpp-badge';
      badge.style.cssText='font-size:10px;margin-top:4px;color:#756f66;line-height:1.35';
      host.appendChild(badge);
    }
    const hit=findCatalog(row);
    if(hit&&hit.price!=null){
      row.dataset.masterHpp=String(Number(hit.price)||0);
      row.dataset.masterPricelistSource=hit.source_key||'';
      row.dataset.masterPricelistSku=hit.sku||sku(row)||'';
      row.dataset.masterPricelistBrand=hit.brand||'';
      const html='Master Pricelist · <b>'+rp(hit.price)+'</b>'+(hit.sku?' · '+String(hit.sku):'')+(hit.brand?' · '+String(hit.brand):'');
      if(badge.innerHTML!==html)badge.innerHTML=html;
      if(badge.style.display==='none')badge.style.display='';
    }else{
      delete row.dataset.masterHpp;
      delete row.dataset.masterPricelistSource;
      delete row.dataset.masterPricelistSku;
      delete row.dataset.masterPricelistBrand;
      const label=loaded?(inventoryId(row)||sku(row)?'Master Pricelist · Belum Ada Harga':'Master Pricelist · Pilih item Inventory'):'Master Pricelist · dimuat saat diperlukan';
      if(badge.textContent!==label)badge.textContent=label;
      if(badge.style.display==='none')badge.style.display='';
    }
  }

  async function refreshRow(row,force=false){await load(force);decorateRow(row);return findCatalog(row);}
  async function scan(force=false){await load(force);document.querySelectorAll('.material-row').forEach(decorateRow);}

  function install(){
    // PXL-URG-0069: jangan fetch catalog otomatis saat Sales Order baru dibuka.
    document.querySelectorAll('.material-row').forEach(decorateRow);
    const watch=id=>{
      const el=document.getElementById(id);
      if(!el||el.dataset.pxlMasterPriceWatch==='0069')return;
      el.dataset.pxlMasterPriceWatch='0069';
      new MutationObserver(records=>{
        const rowStructureChanged=records.some(record=>{
          const nodes=[...record.addedNodes,...record.removedNodes];
          return nodes.some(node=>{
            if(!(node instanceof Element))return false;
            if(node.classList.contains('pxl-master-hpp-badge'))return false;
            return node.classList.contains('material-row')||node.querySelector?.('.material-row');
          });
        });
        if(rowStructureChanged)document.querySelectorAll('.material-row').forEach(decorateRow);
      }).observe(el,{childList:true,subtree:true});
    };
    watch('materialItems');
    document.addEventListener('change',e=>{
      const row=e.target?.closest?.('.material-row');
      if(row)setTimeout(()=>refreshRow(row,false),0);
    },true);
    document.addEventListener('input',e=>{
      if(e.target?.classList?.contains('item-search')){
        const row=e.target.closest('.material-row');
        if(row)setTimeout(()=>refreshRow(row,false),120);
      }
    },true);
    window.PXL_URG_0048_SO={
      revision:REV,
      reload:async()=>{loaded=false;loadedAt=0;catalog=[];await scan(true);},
      refreshRow:(row,force=false)=>refreshRow(row,force),
      resolve:row=>findCatalog(row),
      catalog:()=>catalog.slice(),
      cacheMs:MAX_AGE_MS
    };
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
