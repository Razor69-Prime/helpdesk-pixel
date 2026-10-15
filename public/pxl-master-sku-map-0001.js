/* PXL-MP-FIX-0001 — read-only Google Sheet SKU map keyed by existing Master Pricelist source_key. */
(function(){
  'use strict';
  if(window.PXL_MASTER_SKU_MAP)return;
  const SHEET_ID='1Q0h_NRvfa0MWjXbGPYOIODbd4zw7Bv_uelGu6ZmLcI0';
  const TABS=['CCTV','NETWORKING','ACCESSORIES'];
  const text=v=>String(v??'').trim();
  const norm=v=>text(v).toUpperCase().replace(/\s+/g,' ');
  const colName=index=>{let n=Number(index)+1,out='';while(n>0){n--;out=String.fromCharCode(65+(n%26))+out;n=Math.floor(n/26)}return out};
  let loading=null,skuByKey=new Map();
  function gviz(tab){return new Promise((resolve,reject)=>{const cb='pxlSku_'+Date.now()+'_'+Math.random().toString(36).slice(2);const s=document.createElement('script');let done=false;const finish=(err,data)=>{if(done)return;done=true;try{delete window[cb]}catch(_){window[cb]=undefined}s.remove();err?reject(err):resolve(data)};window[cb]=data=>finish(null,data);s.onerror=()=>finish(new Error('Google Sheet SKU tidak dapat dibaca'));s.src='https://docs.google.com/spreadsheets/d/'+encodeURIComponent(SHEET_ID)+'/gviz/tq?sheet='+encodeURIComponent(tab)+'&tqx='+encodeURIComponent('responseHandler:'+cb);document.head.appendChild(s);setTimeout(()=>finish(new Error('Timeout SKU '+tab)),12000)})}
  function parse(tab,resp){const cols=resp?.table?.cols||[],rows=resp?.table?.rows||[],headers=cols.map(c=>text(c?.label||c?.id||'')),out=[];headers.forEach((header,nameCol)=>{if(!norm(header).includes('PRODUCT NAME / CODE'))return;const skuCol=nameCol>0&&norm(headers[nameCol-1]).includes('NO SKU')?nameCol-1:null;if(skuCol===null)return;rows.forEach((row,r)=>{const sku=text(row?.c?.[skuCol]?.v??row?.c?.[skuCol]?.f??'');const name=text(row?.c?.[nameCol]?.v??row?.c?.[nameCol]?.f??'');if(!sku||!name)return;const source=tab+'!'+colName(skuCol)+(r+1);out.push([tab+'|'+source.toUpperCase(),sku])})});return out}
  async function load(force=false){if(loading&&!force)return loading;loading=(async()=>{const pairs=(await Promise.all(TABS.map(async tab=>parse(tab,await gviz(tab))))).flat();skuByKey=new Map(pairs);return skuByKey})();try{return await loading}catch(e){console.warn('[PXL-MP-FIX-0001] SKU map',e.message||e);return skuByKey}}
  function skuFor(sourceKey){return skuByKey.get(String(sourceKey||'').toUpperCase())||''}
  async function enrich(items){await load();return (Array.isArray(items)?items:[]).map(item=>{const master=skuFor(item?.source_key);return master?{...item,master_sku:master}:{...item}})}
  window.PXL_MASTER_SKU_MAP={revision:'PXL-MP-FIX-0001',load,skuFor,enrich};
})();
