/* PXL-URG-0042 — Dashboard checkbox in Account Management. UI/permission persistence only. */
(function(){
  'use strict';
  const MARKER='dashboard_permission_v1';

  function norm(v){return String(v??'').trim().toLowerCase().replace(/[ _-]/g,'');}
  function users(){try{return Array.isArray(window.allUsers)?window.allUsers:[]}catch(_){return[]}}
  function editedUser(){
    const id=document.getElementById('edit-user-id')?.value;
    return users().find(u=>String(u.id)===String(id))||null;
  }
  function role(){
    const sel=document.getElementById('edit-role');
    return norm(sel?.value||editedUser()?.role||'');
  }
  function storedSet(){
    const u=editedUser();
    return new Set(Array.isArray(u?.custom_menus)?u.custom_menus.map(String):[]);
  }
  function defaultLegacyDashboard(r){
    return r==='manager'||r==='admin'||r==='superadmin';
  }
  function ensure(){
    const box=document.getElementById('menu-checkboxes');
    const modal=document.getElementById('edit-user-modal');
    if(!box||!modal)return;
    let section=document.getElementById('pxl-dashboard-permission-v1');
    if(!section){
      section=document.createElement('div');
      section.id='pxl-dashboard-permission-v1';
      section.style.marginBottom='12px';
      section.innerHTML=
        '<b style="font-size:12px">Umum</b>'+
        '<div style="margin-top:6px;border:1px solid var(--border);border-radius:8px;overflow:hidden">'+
          '<div style="display:grid;grid-template-columns:1fr 110px;align-items:center;gap:8px;padding:8px 9px">'+
            '<span>Dashboard</span>'+
            '<label style="margin:0;text-transform:none"><input type="checkbox" id="pxl-dashboard-read" data-access="dashboard_read"> Akses</label>'+
          '</div>'+
        '</div>'+
        '<input type="checkbox" data-menu="'+MARKER+'" id="pxl-dashboard-marker" checked style="display:none">'+
        '<input type="checkbox" data-access="dashboard_write" id="pxl-dashboard-write-hidden" style="display:none">';
      box.insertBefore(section,box.firstChild);
    }

    const stored=storedSet();
    const r=role();
    const marker=stored.has(MARKER);
    const read=document.getElementById('pxl-dashboard-read');
    const write=document.getElementById('pxl-dashboard-write-hidden');
    const markerEl=document.getElementById('pxl-dashboard-marker');
    if(!read||!markerEl)return;

    // Once marker exists, honor exact saved state.
    // Before marker exists, recover only roles that historically owned Dashboard.
    read.checked=r==='superadmin'?true:(marker?(stored.has('dashboard_read')||stored.has('dashboard')||stored.has('dashboard_write')):defaultLegacyDashboard(r));
    read.disabled=r==='superadmin';
    markerEl.checked=true;

    if(write){
      write.checked=r==='superadmin'||stored.has('dashboard_write');
      write.disabled=r==='superadmin';
    }
  }

  function bind(){
    document.addEventListener('click',e=>{
      if(e.target?.closest?.('[onclick*="openEdit"],[onclick*="openUser"],#user-table-body button')) {
        [0,80,250].forEach(ms=>setTimeout(ensure,ms));
      }
    },true);
    document.addEventListener('change',e=>{
      if(e.target?.id==='edit-role')setTimeout(ensure,0);
    },true);
    const modal=document.getElementById('edit-user-modal');
    if(modal)new MutationObserver(()=>ensure()).observe(modal,{attributes:true,attributeFilter:['class','style']});
    [0,300,1000].forEach(ms=>setTimeout(ensure,ms));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
