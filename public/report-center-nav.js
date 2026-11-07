/* PXL-RPT-0001A — native sidebar menu, JWT-authenticated, Superadmin only. */
(()=>{'use strict';
 if(window.__pxlRptNav)return;window.__pxlRptNav=true;
 let authorized=false,lastToken='',requestId=0,observer=null;
 const token=()=>{try{return String(window.__pxlAuthToken||localStorage.getItem('pixel_token')||sessionStorage.getItem('pixel_token')||'').trim()}catch(_){return String(window.__pxlAuthToken||'').trim()}};
 const headers=t=>({'Authorization':'Bearer '+t,'X-Auth-Token':t,'Cache-Control':'no-cache'});
 function ensureMenu(){
  const nav=document.getElementById('main-nav');
  if(!nav)return;
  let group=document.getElementById('pxl-rpt-sidebar-group');
  if(!authorized||!token()){
   group?.remove();return;
  }
  if(group&&group.parentElement===nav)return;
  group?.remove();
  group=document.createElement('div');
  group.id='pxl-rpt-sidebar-group';
  group.className='sidebar-group';
  group.innerHTML='<button type="button" class="sidebar-group-toggle" aria-expanded="true"><span>Report Center</span><span class="sidebar-group-arrow">▾</span></button><div class="sidebar-group-content"><button type="button" class="nav-btn" id="pxl-rpt-menu"><span class="nav-icon">📊</span><span class="nav-label">Report Center</span></button></div>';
  group.querySelector('.sidebar-group-toggle').addEventListener('click',()=>{
   group.classList.toggle('collapsed');
   group.querySelector('.sidebar-group-toggle').setAttribute('aria-expanded',String(!group.classList.contains('collapsed')));
  });
  group.querySelector('#pxl-rpt-menu').addEventListener('click',()=>location.assign('/report-center.html'));
  nav.appendChild(group);
 }
 async function verify(t){
  const seq=++requestId;
  authorized=false;ensureMenu();
  if(!t)return;
  try{
   const r=await fetch('/api/report-center/catalog',{headers:headers(t),cache:'no-store'});
   if(seq!==requestId||t!==token())return;
   authorized=r.ok;ensureMenu();
  }catch(_){if(seq===requestId){authorized=false;ensureMenu();}}
 }
 function tick(){
  const t=token();
  if(t!==lastToken){lastToken=t;verify(t);}
  if(!observer){
   const nav=document.getElementById('main-nav');
   if(nav){
    observer=new MutationObserver(()=>ensureMenu());
    observer.observe(nav,{childList:true});
   }
  }
  ensureMenu();
 }
 setInterval(tick,1200);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){lastToken='';tick();}});
 tick();
})();