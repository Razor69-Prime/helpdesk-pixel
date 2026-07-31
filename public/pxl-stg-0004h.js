/* PXL-STG-0004H */
(function(){
  function fixWO(){
    var select=document.getElementById('mr-wo');
    if(!select)return;
    var editId='';
    var data=[];
    try{editId=mrEditId||'';data=Array.isArray(mrData)?mrData:[];}catch(e){}
    var mr=data.find(function(row){return String(row.id)===String(editId);});
    if(!mr)return;
    var ticketId=mr.ticket_id||'';
    var wo=mr.wo_number||'';
    var option=Array.prototype.slice.call(select.options).find(function(opt){return String(opt.value)===String(ticketId)||String(opt.dataset.wo||'')===String(wo);});
    if(!option){option=document.createElement('option');option.value=ticketId||mr.id;option.dataset.wo=wo;option.textContent=(wo||'WO terhubung')+' - '+(mr.project_name||'Material Request');select.appendChild(option);}
    select.value=option.value;
    select.disabled=true;
  }
  document.addEventListener('click',function(event){
    if(event.target&&event.target.id==='mr-submit-btn')fixWO();
    if(event.target&&String(event.target.getAttribute('onclick')||'').indexOf('showMRForm')>=0){setTimeout(fixWO,100);setTimeout(fixWO,300);}
  },true);
})();
