/* PXL-URG-0048 — Master Pricelist HPP bridge for Sales Order / Pricing Calculator.
 * Does not change SO payload, Inventory data, stock, or PR.
 */
(function(){
  'use strict';
  const REV='PXL-URG-0048';
  if(window.PXL_URG_0048_SO?.revision===REV)return;

  let catalog=[];
  let loaded=false;
  let loadedAt=0;
  let loading=null;
  const MAX_AGE_MS=30000;
  const n=v=>Number(v)||0;
  const rp=v=>'Rp '+Math.round(n(v)).toLocaleString('id-ID');
  const norm=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');

  async function api(url){
    const token=localStorage.getItem('pixel_token')||sessionStorage.getItem('pixel_token')||'';
    const r=await fetch(url,{cache:'no-store',headers:token?{Authorization:'Bearer '+token,'X-Auth-Token':token}:{}});
    let d={};try{d=await r.json()}catch(_){}
    if(!r.ok)throw new Error(d.error||('HTTP '+r.status));
    return d;
  }
  async function load(force=false){
    if(!force&&loaded&&Date.now()-loadedAt<MAX_AGE_MS)return catalog;
    if(loading)return loading;
    loading=api('/api/master-pricelist/catalog').then(d=>{
      catalog=Array.isArray(d.catalog)?d.catalog:[];
      loaded=true;loadedAt=Date.now();return catalog;
    }).catch(e=>{console.warn('[PXL-URG-0048] catalog',e.message);return[]}).finally(()=>{loading=null});
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
      badge.innerHTML='Master Pricelist · <b>'+rp(hit.price)+'</b>'+(hit.sku?' · '+String(hit.sku):'')+(hit.brand?' · '+String(hit.brand):'');
      badge.style.display='';
    }else{
      delete row.dataset.masterHpp;
      delete row.dataset.masterPricelistSource;
      delete row.dataset.masterPricelistSku;
      delete row.dataset.masterPricelistBrand;
      badge.textContent=inventoryId(row)||sku(row)?'Master Pricelist · Belum Ada Harga':'Master Pricelist · Pilih item Inventory';
      badge.style.display='';
    }
  }
  async function refreshRow(row,force=false){await load(force);decorateRow(row);return findCatalog(row);}
  async function scan(force=false){
    await load(force);
    document.querySelectorAll('.material-row').forEach(decorateRow);
  }
  function install(){
    scan();
    const watch=id=>{const el=document.getElementById(id);if(!el||el.dataset.pxlMasterPriceWatch)return;el.dataset.pxlMasterPriceWatch='1';new MutationObserver(()=>scan()).observe(el,{childList:true,subtree:true});};
    watch('materialItems');
    document.addEventListener('change',e=>{if(e.target?.closest?.('.material-row'))setTimeout(scan,0)},true);
    document.addEventListener('input',e=>{if(e.target?.classList?.contains('item-search'))setTimeout(scan,50)},true);
    window.PXL_URG_0048_SO={revision:REV,reload:async()=>{loaded=false;loadedAt=0;catalog=[];await scan(true);},refreshRow:(row,force=false)=>refreshRow(row,force),resolve:row=>findCatalog(row),catalog:()=>catalog.slice()};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
