/* PXL-URG-0013 — persistent Sales Order approval permission in Account Management. */
(function(){
  'use strict';

  const PERMISSION='sales_order_approve';

  function currentEditUser(){
    try{
      const modal=document.getElementById('edit-user-modal');
      const id=modal?.dataset?.userId || modal?.querySelector('[data-user-id]')?.dataset?.userId || window.editingUserId || window.editUserId || null;
      if(id && Array.isArray(window.allUsers)) return window.allUsers.find(u=>String(u.id)===String(id))||null;
    }catch(_){}
    return null;
  }

  function selectedMenus(){
    const user=currentEditUser();
    if(user && Array.isArray(user.custom_menus)) return user.custom_menus;
    try{
      const hidden=document.getElementById('pxl-access-v2');
      const parsed=hidden?.value?JSON.parse(hidden.value):[];
      return Array.isArray(parsed)?parsed:[];
    }catch(_){return[];}
  }

  function injectApprovalPermission(){
    const box=document.getElementById('menu-checkboxes');
    if(!box || box.querySelector('[data-access="'+PERMISSION+'"]')) return;

    const user=currentEditUser();
    const role=String(document.querySelector('#edit-user-modal select')?.value || user?.role || '').toLowerCase();
    const selected=new Set(selectedMenus());
    const checked=role==='superadmin' || selected.has(PERMISSION);

    const section=document.createElement('div');
    section.id='pxl-sales-order-approval-permission';
    section.style.marginBottom='12px';
    section.innerHTML='<b style="font-size:12px">Approval Sales Order</b>'+
      '<div style="margin-top:6px;border:1px solid var(--border);border-radius:8px;overflow:hidden">'+
      '<div style="display:grid;grid-template-columns:1fr 190px;align-items:center;gap:8px;padding:8px 9px">'+
      '<span>Sales Order</span><label style="margin:0;text-transform:none">'+
      '<input type="checkbox" data-access="'+PERMISSION+'" '+(checked?'checked':'')+' '+(role==='superadmin'?'disabled':'')+'> Setujui Sales Order</label></div></div>';
    box.appendChild(section);
  }

  function scheduleInject(){
    setTimeout(injectApprovalPermission,20);
    setTimeout(injectApprovalPermission,120);
  }

  function install(){
    const originalOpen=window.openEditUserModal;
    if(typeof originalOpen==='function' && !originalOpen.__pxlUrg0013){
      const wrapped=function(){
        const result=originalOpen.apply(this,arguments);
        scheduleInject();
        return result;
      };
      wrapped.__pxlUrg0013=true;
      window.openEditUserModal=wrapped;
    }

    document.addEventListener('change',function(e){
      if(e.target?.tagName==='SELECT' && e.target.closest('#edit-user-modal')){
        setTimeout(function(){
          document.getElementById('pxl-sales-order-approval-permission')?.remove();
          injectApprovalPermission();
        },30);
      }
    });

    new MutationObserver(function(){
      if(document.getElementById('edit-user-modal') && document.getElementById('menu-checkboxes')) scheduleInject();
    }).observe(document.documentElement,{childList:true,subtree:true});

    scheduleInject();
  }

  setTimeout(install,0);
  setTimeout(install,500);
})();
