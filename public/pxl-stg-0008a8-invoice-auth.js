/* PXL-STG-0008A8 — samakan token Invoice V1 dengan auth existing. */
(function(){
  'use strict';
  try {
    const token = localStorage.getItem('pixel_token') || sessionStorage.getItem('pixel_token') || '';
    if (token) {
      localStorage.setItem('token', token);
      localStorage.setItem('pxl_token', token);
    }
  } catch (_) {}
})();
