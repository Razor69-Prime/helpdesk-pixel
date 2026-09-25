/* PXL-URG-0087 — Master Paket menu visibility fix (Superadmin UAT only). */
(function(){
  'use strict';
  const TAB='package_recipes',TAB_ID='tab-'+TAB,BTN_ID='pxl-package-recipes-menu',FRAME_ID='package-recipes-frame';
  function appUser(){try{return typeof currentUser!=='undefined'&&currentUser?currentUser:(window.currentUser||null)}catch(_){return window.currentUser||null}}
  function isSuperadmin(){try{return String(appUser()?.role||'').toLowerCase().replace(/[ _-]/g,'')==='superadmin'}catch(_){return false}}
  function ensureTab(){
    if(document.getElementById(TAB_ID))return;
    const host=document.getElementById('app-content');if(!host)return;
    const tab=document.createElement('div');tab.id=TAB_ID;tab.className='tab-content';tab.style.padding='0';
    tab.innerHTML='<iframe id="'+FRAME_ID+'" title="Master Paket CCTV" style="width:100%;height:calc(100vh - 70px);border:0;background:var(--bg)" loading="lazy"></iframe>';
    host.appendChild(tab);
  }
  function ensureMenu(){
    const nav=document.getElementById('main-nav');if(!nav||!isSuperadmin())return;
    if(document.getElementById(BTN_ID))return;
    const line=document.createElement('div');line.className='sidebar-section-line';line.dataset.packageRecipe='1';
    const section=document.createElement('div');section.className='sidebar-section';section.dataset.packageRecipe='1';section.textContent='Master Data';
    const btn=document.createElement('button');btn.type='button';btn.id=BTN_ID;btn.className='nav-btn';btn.dataset.tabId=TAB;btn.innerHTML='📦 <span class="nav-label">Master Paket</span>';
    btn.onclick=function(){open(btn)};
    nav.appendChild(line);nav.appendChild(section);nav.appendChild(btn);
  }
  function open(btn){
    if(!isSuperadmin())return;
    ensureTab();
    if(typeof window.switchTab==='function')window.switchTab(TAB,btn||document.getElementById(BTN_ID));
    const frame=document.getElementById(FRAME_ID);
    if(frame&&!frame.dataset.loaded){frame.src='/package-recipes.html?v=PXL-URG-0087';frame.dataset.loaded='1';}
    try{if(frame&&typeof window.sendModuleToken==='function')window.sendModuleToken(frame)}catch(_){}
  }
  function apply(){
    if(!isSuperadmin())return;
    ensureTab();ensureMenu();
  }
  window.pxlPackageRecipes={open,apply};
  new MutationObserver(()=>apply()).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',()=>setTimeout(apply,300));
  setTimeout(apply,1200);
})();