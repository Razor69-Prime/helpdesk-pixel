/* PXL-STG-0008A12 — runtime JWT bridge untuk Invoice V1 di iframe. */
(function(){
  'use strict';
  let runtimeToken='';
  const nativeFetch=window.fetch.bind(window);

  function storedToken(){
    try {
      return runtimeToken
        || localStorage.getItem('pixel_token')
        || localStorage.getItem('token')
        || localStorage.getItem('authToken')
        || localStorage.getItem('pxl_token')
        || sessionStorage.getItem('pixel_token')
        || '';
    } catch (_) { return runtimeToken; }
  }

  window.addEventListener('message',function(event){
    if(event.origin!==location.origin || event.data?.type!=='PXL_AUTH_TOKEN') return;
    runtimeToken=String(event.data.token||'');
    if(!runtimeToken) return;
    try {
      localStorage.setItem('pixel_token',runtimeToken);
      localStorage.setItem('token',runtimeToken);
      localStorage.setItem('authToken',runtimeToken);
      localStorage.setItem('pxl_token',runtimeToken);
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('PXL_INVOICE_AUTH_READY'));
  });

  window.fetch=function(input,init){
    const options={...(init||{})};
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(url.startsWith('/api/') || url.startsWith(location.origin+'/api/')){
      const token=storedToken();
      const headers=new Headers(options.headers || (input instanceof Request ? input.headers : undefined));
      if(token){
        headers.set('Authorization','Bearer '+token);
        headers.set('X-Auth-Token',token);
      }
      options.headers=headers;
    }
    return nativeFetch(input,options);
  };

  try { window.parent?.postMessage({type:'PXL_INVOICE_READY'},location.origin); } catch (_) {}
})();
