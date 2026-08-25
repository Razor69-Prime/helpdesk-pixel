/* PXL-URG-0015A — deterministic account permission persistence without event-handler race. */
(function(){
  'use strict';

  const SALES_PERMISSIONS = new Set(['sales_order_approve','sales_order_create_wo']);

  function collectPermissions(){
    const values = new Set();

    // Access V2 matrix owns the Read/Write permission rows rendered by PXL-STG-0005A.
    document.querySelectorAll('#menu-checkboxes [data-access]:checked').forEach(function(input){
      const value = String(input.dataset.access || '').trim();
      if(value && !SALES_PERMISSIONS.has(value)) values.add(value);
    });
    if(document.querySelector('#menu-checkboxes [data-access]')) values.add('access_v2');

    // Native custom permission controls own Inventory, MR, Project and Sales Order specials.
    document.querySelectorAll('[data-menu]:checked').forEach(function(input){
      const value = String(input.dataset.menu || '').trim();
      if(value) values.add(value);
    });

    return Array.from(values);
  }

  function removeLegacyApprovalUi(){
    document.getElementById('pxl-sales-order-approval-permission')?.remove();
    document.querySelectorAll('#menu-checkboxes [data-access="sales_order_approve"]').forEach(function(input){
      const section = input.closest('#pxl-sales-order-approval-permission');
      if(section) section.remove();
      else input.closest('div')?.remove();
    });
  }

  function installSaveWrapper(){
    const originalSave = window.saveEditUser;
    if(typeof originalSave !== 'function' || originalSave.__pxlUrg0015A) return false;

    const wrapped = async function(){
      // PXL-STG-0005A may replace getCheckedMenus() from its capture click handler.
      // Override it here, immediately before the real save executes, so the payload
      // always represents the checkbox state currently visible in Account Management.
      const previousGetCheckedMenus = window.getCheckedMenus;
      window.getCheckedMenus = collectPermissions;
      try {
        return await originalSave.apply(this, arguments);
      } finally {
        if(window.getCheckedMenus === collectPermissions) {
          window.getCheckedMenus = previousGetCheckedMenus;
        }
      }
    };
    wrapped.__pxlUrg0015A = true;
    wrapped.__pxlUrg0015AOriginal = originalSave;
    window.saveEditUser = wrapped;
    return true;
  }

  function installOpenWrapper(){
    const originalOpen = window.openEditUserModal;
    if(typeof originalOpen !== 'function' || originalOpen.__pxlUrg0015A) return false;

    const wrapped = function(){
      const result = originalOpen.apply(this, arguments);
      setTimeout(removeLegacyApprovalUi, 0);
      setTimeout(removeLegacyApprovalUi, 150);
      return result;
    };
    wrapped.__pxlUrg0015A = true;
    window.openEditUserModal = wrapped;
    return true;
  }

  function install(){
    installSaveWrapper();
    installOpenWrapper();
    removeLegacyApprovalUi();
  }

  new MutationObserver(function(){
    removeLegacyApprovalUi();
    // Functions may be replaced by legacy scripts after initial load; re-wrap safely.
    installSaveWrapper();
    installOpenWrapper();
  }).observe(document.documentElement, {childList:true, subtree:true});

  setTimeout(install, 0);
  setTimeout(install, 300);
  setTimeout(install, 1000);
})();
