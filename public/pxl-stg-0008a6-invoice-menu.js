/* PXL-STG-0008A15 — buka Invoice V1 dengan token runtime deterministik. */
(function(){
  'use strict';
  const FRAME_ID='pxl-invoice-v1-frame';
  const WRAP_ID='pxl-invoice-v1-wrap';

  function token(){
    try{
      return String(window.__pxlAuthToken
        || localStorage.getItem('pixel_token')
        || sessionStorage.getItem('pixel_token')
        || '').trim();
    }catch(_){return String(window.__pxlAuthToken||'').trim();}
  }

  function sendToken(frame){
    const value=token();
    if(!frame?.contentWindow||!value)return false;
    frame.contentWindow.postMessage({type:'PXL_AUTH_TOKEN',token:value},location.origin);
    return true;
  }

  function closeInvoice(){
    document.getElementById(WRAP_ID)?.remove();
    document.documentElement.style.overflow='';
  }

  function openInvoice(){
    const authToken=token();
    if(!authToken){alert('Sesi login tidak ditemukan. Silakan login ulang.');return;}
    let wrap=document.getElementById(WRAP_ID);
    if(wrap){sendToken(wrap.querySelector('iframe'));return;}
    wrap=document.createElement('div');
    wrap.id=WRAP_ID;
    wrap.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#f7f4f1;display:flex;flex-direction:column';
    const src='/invoice-v1.html?v=PXL-STG-0008A15#pxl_token='+encodeURIComponent(authToken);
    wrap.innerHTML='<div style="height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;background:#fff;border-bottom:1px solid #ddd;font-family:Arial,sans-serif"><b>Invoice</b><button type="button" id="pxl-invoice-close" style="border:1px solid #d7cec6;background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer">Tutup</button></div><iframe id="'+FRAME_ID+'" src="'+src+'" style="border:0;width:100%;flex:1;background:#f7f4f1" title="Invoice"></iframe>';
    document.body.appendChild(wrap);
    document.documentElement.style.overflow='hidden';
    wrap.querySelector('#pxl-invoice-close').onclick=closeInvoice;
    const frame=wrap.querySelector('iframe');
    frame.addEventListener('load',function(){sendToken(frame);setTimeout(()=>sendToken(frame),150);setTimeout(()=>sendToken(frame),600);});
  }

  function hideLegacy(){
    document.querySelectorAll('h1,h2,h3,h4,strong,b').forEach(title=>{
      if(String(title.textContent||'').trim()!=='Upload Invoice ke Tiket')return;
      let box=title;
      for(let i=0;i<7&&box.parentElement;i++,box=box.parentElement){
        const text=String(box.textContent||'');
        if(text.includes('Upload Invoice ke Tiket')&&text.includes('Invoice yang sudah diupload')){box.style.display='none';break;}
      }
    });
  }

  function apply(){
    hideLegacy();
    const nodes=[...document.querySelectorAll('a,button,[role="button"],div,span')];
    const menu=nodes.find(el=>String(el.textContent||'').trim()==='Invoice'&&el.closest('nav,.sidebar,.menu,.top-nav,#sidebar,.app-sidebar'));
    if(!menu)return;
    const clickable=menu.closest('a,button,[role="button"]')||menu;
    clickable.onclick=function(e){e.preventDefault();e.stopPropagation();openInvoice();};
    if(clickable.tagName==='A')clickable.setAttribute('href','#invoice');
    clickable.dataset.pxlInvoiceIframe='true';
  }

  window.addEventListener('message',function(event){
    if(event.origin!==location.origin)return;
    if(event.data?.type==='PXL_INVOICE_READY'||event.data?.type==='PXL_INVOICE_TOKEN_REQUEST')sendToken(document.getElementById(FRAME_ID));
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeInvoice();});
  document.addEventListener('click',function(e){
    const t=e.target.closest('a,button,[role="button"],div,span');
    if(t&&String(t.textContent||'').trim()==='Invoice'&&t.closest('nav,.sidebar,.menu,.top-nav,#sidebar,.app-sidebar')){e.preventDefault();e.stopPropagation();openInvoice();}
  },true);
  new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();
