/* PXL-URG-0016A — single source of truth for Account Management permissions. */
(function(){
  'use strict';

  function collectPermissions(){
    const values=new Set();

    // Read/Write matrix rendered by legacy Access V2 scripts.
    document.querySelectorAll('#menu-checkboxes [data-access]:checked').forEach(function(input){
      const value=String(input.dataset.access||'').trim();
      if(value) values.add(value);
    });
    if(document.querySelector('#menu-checkboxes [data-access]')) values.add('access_v2');

    // Native/custom permissions outside/inside the matrix.
    document.querySelectorAll('[data-menu]:checked').forEach(function(input){
      const value=String(input.dataset.menu||'').trim();
      if(value) values.add(value);
    });

    // Keep legacy menu ids for backward-compatible navigation while preserving
    // the exact read/write flags as the authoritative Access V2 values.
    Array.from(values).forEach(function(value){
      if(/_(read|write)$/.test(value)) values.add(value.replace(/_(read|write)$/,''));
    });

    return Array.from(values);
  }

  function lockCollector(){
    try{
      const descriptor=Object.getOwnPropertyDescriptor(window,'getCheckedMenus');
      if(descriptor&&descriptor.get&&descriptor.get.__pxlUrg0016A) return;

      const getter=function(){ return collectPermissions; };
      getter.__pxlUrg0016A=true;
      Object.defineProperty(window,'getCheckedMenus',{
        configurable:true,
        enumerable:true,
        get:getter,
        // Legacy scripts may still assign getCheckedMenus. Ignore those assignments
        // so Account Management has exactly one final permission collector.
        set:function(_){}
      });
    }catch(_){
      window.getCheckedMenus=collectPermissions;
    }
  }

  function syncOnModal(){
    if(!document.getElementById('edit-user-modal')) return;
    lockCollector();
  }

  lockCollector();
  document.addEventListener('click',function(event){
    if(event.target?.closest?.('#edit-user-modal,[onclick*="openEditUserModal"],#edit-user-save,[onclick*="saveEditUser"]')) lockCollector();
  },true);
  document.addEventListener('change',function(event){
    if(event.target?.closest?.('#edit-user-modal')) lockCollector();
  },true);
  new MutationObserver(syncOnModal).observe(document.documentElement,{childList:true,subtree:true,attributes:true});
  setTimeout(lockCollector,0);
  setTimeout(lockCollector,300);
  setTimeout(lockCollector,1000);
})();
