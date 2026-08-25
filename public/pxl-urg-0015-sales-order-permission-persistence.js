/* PXL-URG-0015 — persist native Sales Order permissions without legacy checkbox collision. */
(function(){
  'use strict';

  const SALES_PERMISSIONS = new Set(['sales_order_approve','sales_order_create_wo']);

  function collectPermissions(){
    const values = new Set();

    // Legacy access-v2 matrix still owns the main read/write permissions.
    document.querySelectorAll('#menu-checkboxes [data-access]:checked').forEach(function(input){
      const value = String(input.dataset.access || '').trim();
      if(value && !SALES_PERMISSIONS.has(value)) values.add(value);
    });
    if(document.querySelector('#menu-checkboxes [data-access]')) values.add('access_v2');

    // Native permission controls own special/custom permissions, including Sales Order.
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

  function installSaveBridge(){
    if(document.documentElement.dataset.pxlUrg0015Installed === '1') return;
    document.documentElement.dataset.pxlUrg0015Installed = '1';

    document.addEventListener('click', function(event){
      const button = event.target?.closest?.('[onclick*="saveEditUser"],#edit-user-save');
      if(!button) return;

      // PXL-STG-0005A installs an older capture handler that temporarily replaces
      // getCheckedMenus(). This later capture handler intentionally wins before
      // saveEditUser() executes in the bubble/onclick phase.
      const previous = window.getCheckedMenus;
      window.getCheckedMenus = collectPermissions;
      setTimeout(function(){
        if(window.getCheckedMenus === collectPermissions && typeof previous === 'function') {
          window.getCheckedMenus = previous;
        }
      }, 1200);
    }, true);

    const originalOpen = window.openEditUserModal;
    if(typeof originalOpen === 'function' && !originalOpen.__pxlUrg0015){
      const wrapped = function(){
        const result = originalOpen.apply(this, arguments);
        setTimeout(removeLegacyApprovalUi, 0);
        setTimeout(removeLegacyApprovalUi, 150);
        return result;
      };
      wrapped.__pxlUrg0015 = true;
      window.openEditUserModal = wrapped;
    }

    new MutationObserver(removeLegacyApprovalUi).observe(document.documentElement, {childList:true, subtree:true});
    removeLegacyApprovalUi();
  }

  setTimeout(installSaveBridge, 0);
  setTimeout(installSaveBridge, 500);
})();
