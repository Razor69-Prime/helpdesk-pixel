/* PXL-STG-0008A11 — sinkronkan token Invoice V1 dengan token login aplikasi. */
(function(){
  'use strict';
  try {
    const activeToken = localStorage.getItem('pixel_token') || sessionStorage.getItem('pixel_token') || '';
    if (!activeToken) return;
    localStorage.setItem('token', activeToken);
    localStorage.setItem('authToken', activeToken);
    localStorage.setItem('pxl_token', activeToken);
    sessionStorage.setItem('token', activeToken);
  } catch (_) {}
})();
