/* PXL-URG-0047 — Master Pricelist Read/Write checklist in Account Management. */
(function(){
  'use strict';
  const MARKER='master_pricelist_permission_v1';

  const norm=v=>String(v??'').trim().toLowerCase().replace(/[ _-]/g,'');
  function users(){try{return Array.isArray(window.allUsers)?window.allUsers:[]}catch(_){return[]}}
  function editedUser(){
    const id=document.getElementById('edit-user-id')?.value;
    return users().find(u=>String(u.id)===String(id))||null;
  }
  function role(){return norm(document.getElementById('edit-role')?.value||editedUser()?.role||'')}
  function stored(){
    const u=editedUser();
    return new Set(Array.isArray(u?.custom_menus)?u.custom_menus.map(String):[]);
  }
  function ensure(){
    const box=document.getElementById('menu-checkboxes');
    const modal=document.getElementById('edit-user-modal');
    if(!box||!modal)return;

    let section=document.getElementById('pxl-master-pricelist-permission-v1');
    if(!section){
      section=document.createElement('div');
      section.id='pxl-master-pricelist-permission-v1';
      section.style.marginBottom='12px';
      section.innerHTML=
        '<b style="font-size:12px">Master Pricelist</b>'+
        '<div style="margin-top:6px;border:1px solid var(--border);border-radius:8px;overflow:hidden">'+
          '<div style="display:grid;grid-template-columns:1fr 100px 90px;align-items:center;gap:8px;padding:8px 9px">'+
            '<span>Master Pricelist</span>'+
            '<label style="margin:0;text-transform:none"><input type="checkbox" id="pxl-master-pricelist-read" data-access="master_pricelist_read"> Read Only</label>'+
            '<label style="margin:0;text-transform:none"><input type="checkbox" id="pxl-master-pricelist-write" data-access="master_pricelist_write"> Write</label>'+
          '</div>'+
        '</div>'+
        '<input type="checkbox" id="pxl-master-pricelist-marker" data-menu="'+MARKER+'" checked style="display:none">';
      const dashboard=document.getElementById('pxl-dashboard-permission-v1');
      if(dashboard?.parentNode)dashboard.parentNode.insertBefore(section,dashboard.nextSibling);
      else box.insertBefore(section,box.firstChild);
    }

    const s=stored(),r=role(),superadmin=r==='superadmin';
    const read=document.getElementById('pxl-master-pricelist-read');
    const write=document.getElementById('pxl-master-pricelist-write');
    const marker=document.getElementById('pxl-master-pricelist-marker');
    if(!read||!write||!marker)return;

    read.checked=superadmin||s.has('master_pricelist_read')||s.has('master_pricelist_write')||s.has('master_pricelist');
    write.checked=superadmin||s.has('master_pricelist_write');
    read.disabled=superadmin;
    write.disabled=superadmin;
    marker.checked=true;

    if(!read.dataset.pxlBound){
      read.dataset.pxlBound='1';
      read.addEventListener('change',()=>{if(!read.checked)write.checked=false});
    }
    if(!write.dataset.pxlBound){
      write.dataset.pxlBound='1';
      write.addEventListener('change',()=>{if(write.checked)read.checked=true});
    }
  }
  function bind(){
    document.addEventListener('click',e=>{
      if(e.target?.closest?.('[onclick*="openEdit"],[onclick*="openUser"],#user-table-body button')){
        [0,80,250,500,900].forEach(ms=>setTimeout(ensure,ms));
      }
    },true);
    document.addEventListener('change',e=>{if(e.target?.id==='edit-role')setTimeout(ensure,0)},true);
    const modal=document.getElementById('edit-user-modal');
    if(modal)new MutationObserver(()=>ensure()).observe(modal,{attributes:true,attributeFilter:['class','style']});
    [0,300,1000].forEach(ms=>setTimeout(ensure,ms));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
