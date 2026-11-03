/* PXL-URG-0122 — WO mobile action layout + Detail button restore. UI only. */
(()=>{
  'use strict';
  const REV='PXL-URG-0122';
  const style=document.createElement('style');
  style.id='pxl-urg-0122-style';
  style.textContent=`
  @media (max-width: 700px){
    .ticket-actions{max-width:100%!important;display:flex!important;flex-wrap:wrap!important;justify-content:flex-start!important;align-items:center!important;gap:6px!important;margin-top:6px!important;overflow:visible!important}
    .ticket-actions .btn,.ticket-actions .status-select{flex:0 0 auto!important;max-width:100%!important;white-space:nowrap!important}
  }`;
  if(!document.getElementById(style.id)) document.head.appendChild(style);

  function refreshDetail(){
    try{window.PXL_URG_0038?.refresh?.();}catch(_){}
  }
  function ensureDetailLoader(){
    if(window.PXL_URG_0038){refreshDetail();return;}
    if(document.querySelector('script[data-pxl-0122-detail]'))return;
    const script=document.createElement('script');
    script.src='/pxl-urg-0038-ticket-detail-modal.js?v=PXL-URG-0122';
    script.dataset.pxl0122Detail='1';
    script.onload=()=>{refreshDetail();setTimeout(refreshDetail,120);};
    document.head.appendChild(script);
  }
  const schedule=()=>{ensureDetailLoader();setTimeout(refreshDetail,100);};
  document.addEventListener('DOMContentLoaded',schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(schedule,0);setTimeout(schedule,500);
  window.PXL_URG_0122={revision:REV,refresh:schedule};
})();