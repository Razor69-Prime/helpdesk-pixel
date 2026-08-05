/* PXL-STG-0008A13 — tunggu JWT iframe sebelum request Invoice V1 dijalankan. */
(function(){
  'use strict';
  let runtimeToken='';
  let resolveReady;
  const authReady=new Promise(resolve=>{ resolveReady=resolve; });
  const nativeFetch=window.fetch.bind(window);

  function storedToken(){
    try {
      return runtimeToken
        || localStorage.getItem('pixel_token')
        || localStorage.getItem('token')
        || localStorage.getItem('authToken')
        || localStorage.getItem('pxl_token')
        || sessionStorage.getItem('pixel_token')
        || sessionStorage.getItem('token')
        || '';
    } catch (_) { return runtimeToken; }
  }

  function acceptToken(value){
    const token=String(value||'').trim();
    if(!token) return false;
    runtimeToken=token;
    try {
      localStorage.setItem('pixel_token',token);
      localStorage.setItem('token',token);
      localStorage.setItem('authToken',token);
      localStorage.setItem('pxl_token',token);
    } catch (_) {}
    resolveReady(token);
    window.dispatchEvent(new CustomEvent('PXL_INVOICE_AUTH_READY'));
    return true;
  }

  acceptToken(storedToken());

  window.addEventListener('message',function(event){
    if(event.origin!==location.origin || event.data?.type!=='PXL_AUTH_TOKEN') return;
    acceptToken(event.data.token);
  });

  async function waitToken(){
    const existing=storedToken();
    if(existing) return existing;
    try { window.parent?.postMessage({type:'PXL_INVOICE_READY'},location.origin); } catch (_) {}
    return Promise.race([
      authReady,
      new Promise(resolve=>setTimeout(()=>resolve(storedToken()),2500))
    ]);
  }

  window.fetch=async function(input,init){
    const options={...(init||{})};
    const url=typeof input==='string'?input:(input&&input.url)||'';
    const isApi=url.startsWith('/api/') || url.startsWith(location.origin+'/api/');
    if(isApi){
      const token=await waitToken();
      const headers=new Headers(options.headers || (input instanceof Request ? input.headers : undefined));
      if(token){
        headers.set('Authorization','Bearer '+token);
        headers.set('X-Auth-Token',token);
      }
      options.headers=headers;
    }
    let response=await nativeFetch(input,options);
    if(isApi && response.status===401){
      const token=await waitToken();
      if(token){
        const retryHeaders=new Headers(options.headers || {});
        retryHeaders.set('Authorization','Bearer '+token);
        retryHeaders.set('X-Auth-Token',token);
        response=await nativeFetch(input,{...options,headers:retryHeaders});
      }
    }
    return response;
  };

  try { window.parent?.postMessage({type:'PXL_INVOICE_READY'},location.origin); } catch (_) {}
})();
