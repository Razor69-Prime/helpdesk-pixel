/* PXL-STG-0008A7 — jadikan /invoice.html sebagai modul Invoice utama; legacy tetap tersimpan. */
(function(){
  'use strict';
  const TARGET='/invoice.html';
  function apply(){
    const nodes=[...document.querySelectorAll('a,button,[role="button"],div,span')];
    const menu=nodes.find(el=>String(el.textContent||'').trim()==='Invoice'&&el.closest('nav,.sidebar,.menu,.top-nav,#sidebar,.app-sidebar'));
    if(menu){
      const clickable=menu.closest('a,button,[role="button"]')||menu;
      clickable.onclick=function(e){e.preventDefault();location.href=TARGET;};
      if(clickable.tagName==='A')clickable.setAttribute('href',TARGET);
      clickable.dataset.pxlInvoiceMain='true';
    }
    document.querySelectorAll('h1,h2,h3,h4,strong,b').forEach(title=>{
      if(String(title.textContent||'').trim()!=='Upload Invoice ke Tiket')return;
      let box=title;
      for(let i=0;i<7&&box.parentElement;i++,box=box.parentElement){
        const text=String(box.textContent||'');
        if(text.includes('Upload Invoice ke Tiket')&&text.includes('Invoice yang sudah diupload')){
          box.style.display='none';
          break;
        }
      }
    });
  }
  new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',e=>{
    const t=e.target.closest('a,button,[role="button"],div,span');
    if(t&&String(t.textContent||'').trim()==='Invoice'){
      e.preventDefault();
      location.href=TARGET;
    }
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();
