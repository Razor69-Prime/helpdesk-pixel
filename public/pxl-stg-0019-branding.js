/* PXL-STG-0019 — PixelApps Branding. STAGING ONLY. */
window.PXL_STG_0019={revision:'PXL-STG-0019',application:'PixelApps'};

/* PXL-SALES-RECON-0001C — direct loader, independent from Service Worker HTML injection. */
(function(){
  if(window.__pxlSalesReconDirectLoader0001C)return;
  window.__pxlSalesReconDirectLoader0001C=true;
  const run=()=>{
    if(window.PXLSalesRevenueReconciliation){
      try{window.PXLSalesRevenueReconciliation.applySales?.();}catch(_){}
      try{window.PXLSalesRevenueReconciliation.applyDashboard?.();}catch(_){}
      return;
    }
    const s=document.createElement('script');
    s.src='/pxl-sales-recon-0001-hotfix.js?v=PXL-SALES-RECON-0001C';
    s.async=false;
    s.dataset.pxlSalesRecon='0001C';
    document.head.appendChild(s);
  };
  run();
})();

/* PXL-PROBUS-BADGE-0001 — visual badge loader for main app / Material Request. */
(function(){
  if(window.__pxlProbusBadgeLoader0001)return;
  window.__pxlProbusBadgeLoader0001=true;
  const s=document.createElement('script');
  s.src='/pxl-probus-badge-0001.js?v=PXL-PROBUS-BADGE-0001';
  s.async=false;
  s.dataset.pxlProbusBadge='0001';
  document.head.appendChild(s);
})();

/* PXL-TICKET-PAGE-0001 — isolated ticket pagination loader. */
(function(){
  if(window.__pxlTicketPageLoader0001)return;
  window.__pxlTicketPageLoader0001=true;
  const s=document.createElement('script');
  s.src='/pxl-ticket-page-0001.js?v=PXL-TICKET-PAGE-0001';
  s.async=false;
  s.dataset.pxlTicketPage='0001';
  document.head.appendChild(s);
})();
