/* PXL-URG-0049A — Master Pricelist menu controlled by Account Management permission. */
(function(){
  'use strict';
  const REV='PXL-URG-0049A';
  if(window.PXL_URG_0040?.revision===REV)return;
  const norm=v=>String(v??'').trim().toLowerCase().replace(/[ _-]/g,'');
  function user(){try{return window.currentUser||currentUser||null}catch(_){return window.currentUser||null}}
  function isSuperadmin(){return norm(user()?.role)==='superadmin'}
  function permissions(){const u=user()||{};return new Set(Array.isArray(u.custom_menus)?u.custom_menus.map(String):[])}
  function canRead(){if(isSuperadmin())return true;const p=permissions();return p.has('master_pricelist_read')||p.has('master_pricelist_write')||p.has('master_pricelist')}
  function close(){const o=document.getElementById('pxl-0040-pricelist-overlay');if(o)o.remove()}
  function open(){
    if(!canRead())return;
    close();
    const overlay=document.createElement('div');
    overlay.id='pxl-0040-pricelist-overlay';
    overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:#f7f6f3';
    const iframe=document.createElement('iframe');
    iframe.src='/master-pricelist-0049a.html?v='+encodeURIComponent(REV);
    iframe.title='Master Pricelist';
    iframe.style.cssText='width:100%;height:100%;border:0;display:block;background:#f7f6f3';
    overlay.appendChild(iframe);document.body.appendChild(overlay);
  }
  function ensureMenu(){
    const sidebar=document.querySelector('.sidebar');
    if(!sidebar)return;
    let btn=sidebar.querySelector('[data-pxl-master-pricelist]');
    if(!canRead()){btn?.remove();return}
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.className='nav-btn';
      btn.dataset.pxlMasterPricelist='0049A';
      btn.innerHTML='<span>💰</span><span class="nav-label">Master Pricelist</span>';
      const inventory=[...sidebar.querySelectorAll('.nav-btn,button,a')].find(x=>/inventory/i.test(x.textContent||''));
      if(inventory?.parentNode)inventory.parentNode.insertBefore(btn,inventory.nextSibling);else sidebar.appendChild(btn);
    }else btn.dataset.pxlMasterPricelist='0049A';
    btn.onclick=e=>{e.preventDefault();e.stopPropagation();open()};
  }
  function refresh(){ensureMenu()}
  window.PXL_URG_0040={revision:REV,open,close,refresh};
  window.PXL_URG_0040_CLOSE=close;
  const obs=new MutationObserver(refresh);
  function init(){refresh();obs.observe(document.body,{childList:true,subtree:true});[200,600,1200,2500].forEach(ms=>setTimeout(refresh,ms))}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
