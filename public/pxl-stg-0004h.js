/* PXL-STG-0004J — relasi WO MR otomatis tanpa bergantung global let di index.html. */
(function(){
  'use strict';

  var activeMR=null;
  var activeEditId='';

  function same(a,b){return String(a==null?'':a)===String(b==null?'':b);}

  function extractEditId(element){
    var node=element&&element.closest?element.closest('[onclick*="showMRForm"]'):null;
    if(!node)return '';
    var code=String(node.getAttribute('onclick')||'');
    var match=code.match(/showMRForm\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    return match?match[1]:'';
  }

  async function loadActiveMR(editId){
    if(!editId)return null;
    activeEditId=editId;
    try{
      var response=await fetch('/api/material-requests-form',{credentials:'same-origin',cache:'no-store'});
      if(!response.ok)throw new Error(await response.text());
      var rows=await response.json();
      activeMR=(Array.isArray(rows)?rows:[]).find(function(row){return same(row.id,editId);})||null;
      return activeMR;
    }catch(error){
      console.error('PXL-STG-0004J gagal mengambil MR:',error);
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
    select.dataset.integratedMrId=mr.id||activeEditId;
    select.disabled=true;

    var project=document.getElementById('mr-project');
    if(project&&!project.value)project.value=mr.project_name||option.dataset.project||'';

    var error=document.getElementById('mr-form-error');
    if(error&&/Pilih Nomor WO/i.test(error.textContent||'')){
      error.textContent='';
      error.style.display='none';
    }
    return Boolean(select.value);
  }

  // Tangkap ID MR sebelum onclick inline menjalankan showMRForm().
  document.addEventListener('click',function(event){
    var editId=extractEditId(event.target);
    if(editId){
      activeMR=null;
      loadActiveMR(editId).then(function(mr){
        applyWorkOrder(mr);
        setTimeout(function(){applyWorkOrder(mr);},100);
        setTimeout(function(){applyWorkOrder(mr);},350);
      });
      return;
    }

    var submit=event.target&&event.target.closest?event.target.closest('#mr-submit-btn'):null;
    if(submit&&activeMR){
      applyWorkOrder(activeMR);
      setTimeout(function(){applyWorkOrder(activeMR);},0);
    }
  },true);

  // Fallback: saat form tampil tetapi data belum terpasang, gunakan ID terakhir.
  var observer=new MutationObserver(function(){
    var form=document.getElementById('mr-form-section');
    if(!form||form.style.display==='none'||!activeEditId)return;
    if(activeMR)applyWorkOrder(activeMR);
    else loadActiveMR(activeEditId).then(applyWorkOrder);
  });
  document.addEventListener('DOMContentLoaded',function(){
    var form=document.getElementById('mr-form-section');
    if(form)observer.observe(form,{attributes:true,attributeFilter:['style']});
  });
})();
