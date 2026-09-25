/* PXL-URG-0098 — Master Paket Account Management permission. */
(function(){
  'use strict';
  const TAB='package_recipes',TAB_ID='tab-'+TAB,BTN_ID='pxl-package-recipes-menu',FRAME_ID='package-recipes-frame';
  function appUser(){try{return typeof currentUser!=='undefined'&&currentUser?currentUser:(window.currentUser||null)}catch(_){return window.currentUser||null}}
  function isSuperadmin(){try{return String(appUser()?.role||'').toLowerCase().replace(/[ _-]/g,'')==='superadmin'}catch(_){return false}}
  function canAccess(){const u=appUser()||{};if(isSuperadmin())return true;const p=new Set(Array.isArray(u.custom_menus)?u.custom_menus.map(String):[]);return p.has('package_recipes')||p.has('package_recipes_read')||p.has('package_recipes_write')||p.has('package_recipes_view')||p.has('package_recipes_manage')}
  function ensureTab(){
    if(document.getElementById(TAB_ID))return;
    const host=document.getElementById('app-content');if(!host)return;
    const tab=document.createElement('div');tab.id=TAB_ID;tab.className='tab-content';tab.style.padding='0';
    tab.innerHTML='<iframe id="'+FRAME_ID+'" title="Master Paket CCTV" style="width:100%;height:calc(100vh - 70px);border:0;background:var(--bg)" loading="lazy"></iframe>';
    host.appendChild(tab);
  }
  function ensureMenu(){
    const nav=document.getElementById('main-nav');if(!nav)return;
    const old=document.getElementById(BTN_ID);if(!canAccess()){old?.remove();return;}
    const group=[...nav.querySelectorAll('.sidebar-group')].find(g=>{
      const title=g.querySelector('.sidebar-group-toggle span');
      return title&&String(title.textContent||'').trim()==='Sales & Proyek';
    });
    if(!group)return;
    const content=group.querySelector('.sidebar-group-content')||group;
    const existing=document.getElementById(BTN_ID);
    if(existing&&existing.parentElement===content)return;
    nav.querySelectorAll('.sidebar-section-line[data-package-recipe="1"],.sidebar-section[data-package-recipe="1"]').forEach(el=>el.remove());
    if(existing)existing.remove();
    const btn=document.createElement('button');btn.type='button';btn.id=BTN_ID;btn.className='nav-btn';btn.dataset.tabId=TAB;btn.dataset.packageRecipe='1';btn.innerHTML='📦 <span class="nav-label">Master Paket</span>';
    btn.onclick=function(){open(btn)};
    content.appendChild(btn);
  }
  function open(btn){
    if(!canAccess())return;
    ensureTab();
    if(typeof window.switchTab==='function')window.switchTab(TAB,btn||document.getElementById(BTN_ID));
    const frame=document.getElementById(FRAME_ID);
    if(frame&&!frame.dataset.loaded){frame.src='/package-recipes.html?v=PXL-URG-0098';frame.dataset.loaded='1';}
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