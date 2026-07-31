/* PXL-STG-0004G — auto-select linked WO for integrated CRM MR. */
(function(){
  'use strict';

  function same(a,b){return String(a==null?'':a)===String(b==null?'':b);}

  function applyLinkedWorkOrder(){
    const select=document.getElementById('mr-wo');
    if(!select||!window.mrEditId||!Array.isArray(window.mrData))return;
    const mr=window.mrData.find(row=>same(row.id,window.mrEditId));
    if(!mr)return;

    const ticketId=mr.ticket_id||mr.linked_work_order_id||'';
    const woNumber=mr.wo_number||'';
    let option=[...select.options].find(opt=>same(opt.value,ticketId));
    if(!option&&woNumber){option=[...select.options].find(opt=>same(opt.dataset.wo,woNumber)||String(opt.textContent||'').includes(woNumber));}
    if(!option&&ticketId){option=document.createElement('option');option.value=ticketId;option.dataset.wo=woNumber;option.dataset.project=mr.project_name||'';option.textContent=`${woNumber||ticketId} — ${mr.project_name||mr.customer_name||'Material Request'}`;select.appendChild(option);}
    if(option){select.value=option.value;select.dataset.integratedMrTicketId=option.value;select.disabled=Boolean(mr.crm_material_request||mr.source_type==='sales_order');}
  }

  const originalShow=window.showMRForm;
  if(typeof originalShow==='function')window.showMRForm=function(editId){const result=originalShow.apply(this,arguments);setTimeout(applyLinkedWorkOrder,0);setTimeout(applyLinkedWorkOrder,150);return result;};
  const originalSubmit=window.submitMR;
  if(typeof originalSubmit==='function')window.submitMR=function(){applyLinkedWorkOrder();return originalSubmit.apply(this,arguments);};

  const extra=document.createElement('script');
  extra.src='/pxl-stg-0004h.js?v=PXL-STG-0004H';
  document.head.appendChild(extra);
})();
