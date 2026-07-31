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
    if(!option&&woNumber){
      option=[...select.options].find(opt=>same(opt.dataset.wo,woNumber)||String(opt.textContent||'').includes(woNumber));
    }
    if(!option&&ticketId){
      option=document.createElement('option');
      option.value=ticketId;
      option.dataset.wo=woNumber;
      option.dataset.project=mr.project_name||'';
      option.textContent=`${woNumber||ticketId} — ${mr.project_name||mr.customer_name||'Material Request'}`;
      select.appendChild(option);
    }
    if(option){
      select.value=option.value;
      select.dataset.integratedMrTicketId=option.value;
      select.disabled=Boolean(mr.crm_material_request||mr.source_type==='sales_order');
      const project=document.getElementById('mr-project');
      if(project&&!project.value)project.value=mr.project_name||option.dataset.project||'';
      const error=document.getElementById('mr-form-error');
      if(error&&/Pilih Nomor WO/i.test(error.textContent||'')){error.textContent='';error.style.display='none';}
    }
  }

  const originalShow=window.showMRForm;
  if(typeof originalShow==='function'){
    window.showMRForm=function(editId){
      const result=originalShow.apply(this,arguments);
      setTimeout(applyLinkedWorkOrder,0);
      setTimeout(applyLinkedWorkOrder,150);
      return result;
    };
  }

  const originalSubmit=window.submitMR;
  if(typeof originalSubmit==='function'){
    window.submitMR=function(){
      applyLinkedWorkOrder();
      const select=document.getElementById('mr-wo');
      const mr=Array.isArray(window.mrData)?window.mrData.find(row=>same(row.id,window.mrEditId)):null;
      if(select&&!select.value&&mr?.ticket_id){
        const option=document.createElement('option');
        option.value=mr.ticket_id;
        option.dataset.wo=mr.wo_number||'';
        option.dataset.project=mr.project_name||'';
        option.textContent=`${mr.wo_number||mr.ticket_id} — ${mr.project_name||'Material Request'}`;
        select.appendChild(option);
        select.value=mr.ticket_id;
      }
      return originalSubmit.apply(this,arguments);
    };
  }

  document.addEventListener('click',event=>{
    if(event.target.closest('[onclick*="showMRForm"]'))setTimeout(applyLinkedWorkOrder,100);
  });
})();
