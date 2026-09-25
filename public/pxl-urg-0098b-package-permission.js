/* PXL-URG-0098B — resilient Master Paket permission row in Account Management. */
(function(){
  'use strict';
  const READ='package_recipes_read', WRITE='package_recipes_write', ROW_ID='pxl-package-recipes-permission-row';
  function role(){const s=document.getElementById('edit-role');return String(s?.value||'').toLowerCase().replace(/[ _-]/g,'')}
  function editedUser(){const id=String(document.getElementById('edit-user-id')?.value||'');try{return (Array.isArray(window.allUsers)?window.allUsers:[]).find(u=>String(u.id)===id)||null}catch(_){return null}}
  function stored(){const u=editedUser();return new Set(Array.isArray(u?.custom_menus)?u.custom_menus.map(String):[])}
  function ensure(){
    const modal=document.getElementById('edit-user-modal'),box=document.getElementById('menu-checkboxes');
    if(!modal||!box||modal.style.display==='none')return;
    if(box.querySelector('[data-access="'+READ+'"], [data-access="'+WRITE+'"]'))return;
    const perms=stored(),superadmin=role()==='superadmin';
    const section=document.createElement('section');section.id=ROW_ID;section.style.marginBottom='12px';
    section.innerHTML='<b>Sales & Proyek</b><div style="margin-top:6px;border:1px solid var(--border);border-radius:8px;overflow:hidden"><div style="display:grid;grid-template-columns:1fr 100px 80px;gap:8px;align-items:center;padding:8px"><span>Master Paket</span><label style="margin:0;text-transform:none"><input type="checkbox" data-access="'+READ+'"> Read Only</label><label style="margin:0;text-transform:none"><input type="checkbox" data-access="'+WRITE+'"> Write</label></div></div>';
    box.appendChild(section);
    const read=section.querySelector('[data-access="'+READ+'"]'),write=section.querySelector('[data-access="'+WRITE+'"]');
    read.checked=superadmin||perms.has(READ)||perms.has(WRITE)||perms.has('package_recipes');
    write.checked=superadmin||perms.has(WRITE)||perms.has('package_recipes_manage');
    read.disabled=write.disabled=superadmin;
    write.addEventListener('change',()=>{if(write.checked)read.checked=true;});
  }
  const obs=new MutationObserver(()=>setTimeout(ensure,0));
  document.addEventListener('DOMContentLoaded',()=>{obs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});[0,50,150,400].forEach(ms=>setTimeout(ensure,ms));});
  document.addEventListener('click',e=>{if(e.target?.closest?.('[onclick*="openEditUserModal"],#user-table-body button'))[0,50,150,400].forEach(ms=>setTimeout(ensure,ms));},true);
  document.addEventListener('change',e=>{if(e.target?.id==='edit-role')setTimeout(()=>{document.getElementById(ROW_ID)?.remove();ensure();},0)},true);
})();