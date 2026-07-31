/* PXL-STG-0004I — perbaikan final relasi WO MR otomatis. */
(function(){
  'use strict';

  var activeMR=null;

  function same(a,b){return String(a==null?'':a)===String(b==null?'':b);}

  async function loadActiveMR(editId){
    if(!editId)return null;
    try{
      var response=await fetch('/api/material-requests-form',{credentials:'same-origin',cache:'no-store'});
      if(!response.ok)throw new Error(await response.text());
      var rows=await response.json();
      activeMR=(Array.isArray(rows)?rows:[]).find(function(row){return same(row.id,editId);})||null;
      return activeMR;
    }catch(error){
      console.error('PXL-STG-0004I gagal mengambil MR:',error);
      activeMR=null;
      return null;
    }
  }

  function applyWorkOrder(mr){
    if(!mr)return false;
    var select=document.getElementById('mr-wo');
    if(!select)return false;

    var ticketId=mr.ticket_id||mr.linked_work_order_id||mr.work_order_ticket_id||'';
    var woNumber=mr.wo_number||'';
    var options=Array.prototype.slice.call(select.options);
    var option=options.find(function(opt){
      return (ticketId&&same(opt.value,ticketId))||
        (woNumber&&same(opt.dataset.wo,woNumber))||
        (woNumber&&String(opt.textContent||'').indexOf(woNumber)>=0);
    });

    if(!option){
      option=document.createElement('option');
      option.value=ticketId||('crm-mr-'+mr.id);
      option.dataset.wo=woNumber;
      option.dataset.project=mr.project_name||'';
      option.textContent=(woNumber||'WO terhubung')+' — '+(mr.project_name||'Material Request');
      select.appendChild(option);
    }

    select.value=option.value;
    select.dataset.integratedMrTicketId=ticketId||option.value;
    select.dataset.integratedMrId=mr.id||'';
    select.disabled=true;

    var error=document.getElementById('mr-form-error');
    if(error&&/Pilih Nomor WO/i.test(error.textContent||'')){
      error.textContent='';
      error.style.display='none';
    }
    return Boolean(select.value);
  }

  var originalShow=window.showMRForm;
  if(typeof originalShow==='function'){
    window.showMRForm=function(editId){
      activeMR=null;
      var result=originalShow.apply(this,arguments);
      loadActiveMR(editId).then(function(mr){
        applyWorkOrder(mr);
        setTimeout(function(){applyWorkOrder(mr);},150);
      });
      return result;
    };
  }

  var originalSubmit=window.submitMR;
  if(typeof originalSubmit==='function'){
    window.submitMR=function(){
      if(activeMR)applyWorkOrder(activeMR);
      return originalSubmit.apply(this,arguments);
    };
  }

  document.addEventListener('click',function(event){
    var button=event.target&&event.target.closest?event.target.closest('#mr-submit-btn'):null;
    if(button&&activeMR)applyWorkOrder(activeMR);
  },true);
})();
