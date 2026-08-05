/* PXL-STG-0008A15 — auth Invoice V1 dari parent, storage, atau URL hash sebelum request API. */
(function(){
  'use strict';
  let runtimeToken='';
  let resolveReady;
  const authReady=new Promise(resolve=>{ resolveReady=resolve; });
  const nativeFetch=window.fetch.bind(window);

  function hashToken(){
    try{
      const params=new URLSearchParams(String(location.hash||'').replace(/^#/,''));
      const value=String(params.get('pxl_token')||'').trim();
      if(value) history.replaceState(null,'',location.pathname+location.search);
      return value;
    }catch(_){return '';}
  }

  function parentToken(){
    try{
      if(window.parent&&window.parent!==window&&window.parent.location.origin===location.origin){
        return String(window.parent.__pxlAuthToken
          || window.parent.localStorage.getItem('pixel_token')
          || window.parent.sessionStorage.getItem('pixel_token')
          || '').trim();
      }
    }catch(_){}
    return '';
  }

  function storedToken(){
    try {
      return runtimeToken
        || hashToken()
        || parentToken()
        || localStorage.getItem('pixel_token')
        || sessionStorage.getItem('pixel_token')
        || localStorage.getItem('token')
        || localStorage.getItem('authToken')
        || localStorage.getItem('pxl_token')
        || sessionStorage.getItem('token')
        || '';
    } catch (_) { return runtimeToken||hashToken()||parentToken(); }
  }

  function acceptToken(value){
    const token=String(value||'').trim();
    if(!token) return false;
    runtimeToken=token;
    try {
      localStorage.setItem('pixel_token',token);
      sessionStorage.setItem('pixel_token',token);
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
    if(existing){acceptToken(existing);return existing;}
    try { window.parent?.postMessage({type:'PXL_INVOICE_TOKEN_REQUEST'},location.origin); } catch (_) {}
    return Promise.race([
      authReady,
      new Promise(resolve=>setTimeout(()=>resolve(storedToken()),3000))
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
      const fresh=parentToken()||storedToken();
      if(fresh){
        acceptToken(fresh);
        const retryHeaders=new Headers(options.headers||{});
        retryHeaders.set('Authorization','Bearer '+fresh);
        retryHeaders.set('X-Auth-Token',fresh);
        response=await nativeFetch(input,{...options,headers:retryHeaders});
      }
    }
    return response;
  };

  try { window.parent?.postMessage({type:'PXL_INVOICE_READY'},location.origin); } catch (_) {}
})();
