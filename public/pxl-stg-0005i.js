/* PXL-STG-0005I — pertahankan WO tersimpan saat update MR. */
(function(){
  'use strict';

  let editContext=null;

  function findMR(editId){
    const collections=[];
    try{if(Array.isArray(mrData))collections.push(mrData);}catch(_){}
    try{if(Array.isArray(materialRequestsData))collections.push(materialRequestsData);}catch(_){}
    for(const rows of collections){
      const found=rows.find(row=>String(row?.id||'')===String(editId||''));
      if(found)return found;
    }
    return null;
  }

  function currentEditId(){
    try{if(mrEditId)return mrEditId;}catch(_){}
    return editContext?.id||null;
  }

  function ticketIdOf(mr){
    return mr?.ticket_id||mr?.work_order_ticket_id||mr?.linked_ticket_id||mr?.crm_work_order?.ticket_id||null;
  }

  function woNumberOf(mr){
    return mr?.wo_number||mr?.work_order_number||mr?.linked_wo_number||'';
  }

  function clearWOError(){
    const error=document.getElementById('mr-form-error');
    if(error&&/Pilih Nomor WO/i.test(error.textContent||'')){
      error.textContent='';
      error.style.display='none';
    }
  }

  function bindStoredWO(mr){
    if(!mr)return false;
    const select=document.getElementById('mr-wo');
    if(!select)return false;
    const ticketId=ticketIdOf(mr);
    if(!ticketId)return false;
    const value=String(ticketId);
    let option=[...select.options].find(item=>String(item.value)===value);
    if(!option){
      option=document.createElement('option');
      option.value=value;
      option.dataset.wo=woNumberOf(mr);
      option.dataset.project=mr.project_name||'';
      option.textContent=(woNumberOf(mr)||value)+' — '+(mr.project_name||'Work Order tersimpan');
      select.appendChild(option);
    }
    select.value=value;
    select.dataset.pxlStoredTicketId=value;
    select.dataset.pxlStoredWoNumber=woNumberOf(mr);
    select.disabled=true;
    const project=document.getElementById('mr-project');
    if(project&&!project.value)project.value=mr.project_name||option.dataset.project||'';
    editContext={id:mr.id,ticketId:value,mr};
    clearWOError();
    return true;
  }

  function restoreStoredWO(editId){
    const mr=findMR(editId||currentEditId())||editContext?.mr||null;
    if(bindStoredWO(mr))return true;
    const select=document.getElementById('mr-wo');
    if(select&&editContext?.ticketId){
      select.value=editContext.ticketId;
      select.disabled=true;
      clearWOError();
      return true;
    }
    return false;
  }

  function scheduleRestore(editId){
    [0,60,180,400].forEach(delay=>setTimeout(()=>restoreStoredWO(editId),delay));
  }

  const originalShowMRForm=window.showMRForm;
  if(typeof originalShowMRForm==='function'){
    window.showMRForm=function(editId){
      const result=originalShowMRForm.apply(this,arguments);
      if(editId)scheduleRestore(editId);
      else editContext=null;
      return result;
    };
  }

  document.addEventListener('click',function(event){
    if(event.target?.closest?.('#mr-submit-btn'))restoreStoredWO();
  },true);

  const originalSubmitMR=window.submitMR;
  if(typeof originalSubmitMR==='function'){
    window.submitMR=function(){
      restoreStoredWO();
      return originalSubmitMR.apply(this,arguments);
    };
  }
})();
