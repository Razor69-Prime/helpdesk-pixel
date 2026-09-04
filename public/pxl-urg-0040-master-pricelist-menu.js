/* PXL-URG-0043A — Isolated Master Pricelist trial menu. Superadmin only. No Pricing/Inventory/SO integration. */
(function(){
  'use strict';
  const REV='PXL-URG-0043A';
  if(window.PXL_URG_0040?.revision===REV)return;
  const norm=v=>String(v??'').trim().toLowerCase().replace(/[ _-]/g,'');
  function user(){try{return window.currentUser||currentUser||null}catch(_){return window.currentUser||null}}
  function isSuperadmin(){return norm(user()?.role)==='superadmin'}
  function close(){const o=document.getElementById('pxl-0040-pricelist-overlay');if(o)o.remove()}
  function open(){
    if(!isSuperadmin())return;
    close();
    const overlay=document.createElement('div');
    overlay.id='pxl-0040-pricelist-overlay';
    overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:#f7f6f3';
    const iframe=document.createElement('iframe');
    iframe.src='/master-pricelist.html?v='+encodeURIComponent(REV);
    iframe.title='Master Pricelist';
    iframe.style.cssText='width:100%;height:100%;border:0;display:block;background:#f7f6f3';
    overlay.appendChild(iframe);document.body.appendChild(overlay);
  }
  function ensureMenu(){
    const sidebar=document.querySelector('.sidebar');
    if(!sidebar)return;
    let btn=sidebar.querySelector('[data-pxl-master-pricelist]');
    if(!isSuperadmin()){btn?.remove();return}
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.className='nav-btn';
      btn.dataset.pxlMasterPricelist='0043A';
      btn.innerHTML='<span>💰</span><span class="nav-label">Master Pricelist</span>';
      const inventory=[...sidebar.querySelectorAll('.nav-btn,button,a')].find(x=>/inventory/i.test(x.textContent||''));
      if(inventory?.parentNode)inventory.parentNode.insertBefore(btn,inventory.nextSibling);else sidebar.appendChild(btn);
    }else btn.dataset.pxlMasterPricelist='0043A';
    btn.onclick=e=>{e.preventDefault();e.stopPropagation();open()};
  }
  function refresh(){ensureMenu()}
  window.PXL_URG_0040={revision:REV,open,close,refresh};
  window.PXL_URG_0040_CLOSE=close;
  const obs=new MutationObserver(refresh);
  function init(){refresh();obs.observe(document.body,{childList:true,subtree:true});[200,600,1200,2500].forEach(ms=>setTimeout(refresh,ms))}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
