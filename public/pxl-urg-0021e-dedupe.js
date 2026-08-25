/* PXL-URG-0021E — force duplicate UI cleanup for SO Maps + material source. */
(function(){
  'use strict';

  function cleanupMaps(){
    const preferred=document.getElementById('pxlGoogleMapsWrap');
    const legacy=document.getElementById('pxl-google-maps-field');
    if(preferred&&legacy) legacy.remove();

    const all=[...document.querySelectorAll('#pxlGoogleMapsWrap,#pxl-google-maps-field')];
    if(all.length<=1) return;
    const keep=preferred||all[0];
    all.forEach(node=>{if(node!==keep)node.remove();});
  }

  function cleanupMaterialRow(row){
    if(!row) return;
    const selects=[...row.querySelectorAll('.pxl-material-source')];
    if(selects.length<=1) return;
    const keep=selects.find(select=>select.closest('.item-picker'))||selects[0];
    selects.forEach(select=>{if(select!==keep)select.remove();});
  }

  function cleanup(){
    cleanupMaps();
    document.querySelectorAll('.material-row').forEach(cleanupMaterialRow);
  }

  let queued=false;
  function queueCleanup(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      cleanup();
    });
  }

  function start(){
    cleanup();
    const observer=new MutationObserver(queueCleanup);
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(cleanup,100);
    setTimeout(cleanup,500);
    setTimeout(cleanup,1500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
