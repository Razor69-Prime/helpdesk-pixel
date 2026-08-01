/* PXL-STG-0005C — WO-based MR flow and pickup formula. */
(function(){
  'use strict';

  function numberValue(input){
    const value=Number(input?.value);
    return Number.isFinite(value)&&value>0?value:0;
  }

  function applyAutomaticFormula(row){
    if(!row)return;
    const pickup=row.querySelector('.mr-qout');
    const usage=row.querySelector('.mr-quse');
    const returned=row.querySelector('.mr-qret');
    if(!pickup||!usage||!returned)return;
    let pickupQty=numberValue(pickup);
    let usageQty=numberValue(usage);
    if(usageQty>pickupQty){usageQty=pickupQty;usage.value=String(pickupQty);}
    returned.value=String(Number(Math.max(0,pickupQty-usageQty).toFixed(2)));
    usage.max=String(pickupQty);
  }

  function unlockPickupQuantities(){
    document.querySelectorAll('#mr-items-body tr').forEach(row=>{
      const pickup=row.querySelector('.mr-qout');
      const usage=row.querySelector('.mr-quse');
      if(!pickup)return;
      pickup.readOnly=false;
      pickup.disabled=false;
      pickup.removeAttribute('readonly');
      pickup.removeAttribute('max');
      pickup.min='0';
      pickup.step='0.01';
      pickup.style.background='transparent';
      pickup.style.cursor='text';
      if(usage){usage.readOnly=false;usage.disabled=false;usage.removeAttribute('readonly');usage.removeAttribute('disabled');}
      if(!pickup.dataset.pxl0005c){
        pickup.dataset.pxl0005c='1';
        pickup.addEventListener('input',()=>applyAutomaticFormula(row));
        pickup.addEventListener('change',()=>applyAutomaticFormula(row));
      }
      if(usage&&!usage.dataset.pxl0005c){
        usage.dataset.pxl0005c='1';
        usage.addEventListener('input',()=>applyAutomaticFormula(row));
        usage.addEventListener('change',()=>applyAutomaticFormula(row));
      }
      applyAutomaticFormula(row);
    });
  }

  function showMRError(message){
    const error=document.getElementById('mr-form-error');
    if(!error)return;
    error.textContent=message||'';
    error.style.display=message?'block':'none';
  }

  async function loadSOItemsFromWO(){
    const select=document.getElementById('mr-wo');
    const option=select?.options?.[select.selectedIndex];
    if(!option?.value)return;
    const project=document.getElementById('mr-project');
    if(project)project.value=option.dataset.project||'';
    showMRError('');
    try{
      const data=await api('GET','/material-requests-form/work-order/'+encodeURIComponent(option.value)+'/items');
      if(!data||!Array.isArray(data.items))throw new Error('Respons item Sales Order tidak valid.');
      const body=document.getElementById('mr-items-body');
      if(!body)return;
      body.innerHTML='';
      try{mrItemCount=0;}catch(_){}
      data.items.forEach(item=>addMRItemRow(item,true));
      if(!data.items.length){
        addMRItemRow(null,true);
        showMRError('Sales Order tidak memiliki item Inventory yang dapat dimasukkan ke Material Request.');
      }
      setTimeout(unlockPickupQuantities,0);
    }catch(error){
      const body=document.getElementById('mr-items-body');
      if(body)body.innerHTML='';
      showMRError('Gagal mengambil item SO: '+String(error.message||error));
    }
  }

  // Ganti handler lama secara langsung pada halaman utama.
  window.onMRWOChange=loadSOItemsFromWO;

  const originalShowMRForm=window.showMRForm;
  if(typeof originalShowMRForm==='function'){
    window.showMRForm=function(...args){
      const result=originalShowMRForm.apply(this,args);
      setTimeout(unlockPickupQuantities,0);
      setTimeout(unlockPickupQuantities,250);
      return result;
    };
  }

  const originalAddMRItemRow=window.addMRItemRow;
  if(typeof originalAddMRItemRow==='function'){
    window.addMRItemRow=function(...args){
      const row=originalAddMRItemRow.apply(this,args);
      setTimeout(()=>{unlockPickupQuantities();applyAutomaticFormula(row);},0);
      return row;
    };
  }

  function cleanSalesOrderDocument(doc){
    if(!doc)return;
    doc.querySelectorAll('[data-act="mr"]').forEach(button=>button.remove());
    doc.querySelectorAll('.section').forEach(section=>{
      if(/Material Request Trial/i.test(section.textContent||''))section.remove();
    });
    doc.querySelectorAll('.toolbar .sub').forEach(sub=>{
      if(/SO, approval, WO, Material Request/i.test(sub.textContent||''))sub.textContent='SO, approval, dan pembuatan Work Order.';
    });
  }

  function cleanSalesOrderFrames(){
    document.querySelectorAll('iframe').forEach(frame=>{
      try{
        cleanSalesOrderDocument(frame.contentDocument);
        if(!frame.dataset.pxl0005c){
          frame.dataset.pxl0005c='1';
          frame.addEventListener('load',()=>cleanSalesOrderDocument(frame.contentDocument));
        }
      }catch(_){}
    });
  }

  const observer=new MutationObserver(()=>{unlockPickupQuantities();cleanSalesOrderFrames();});
  document.addEventListener('DOMContentLoaded',()=>{
    const body=document.getElementById('mr-items-body');
    if(body)observer.observe(body,{childList:true,subtree:true});
    observer.observe(document.documentElement,{childList:true,subtree:true});
    unlockPickupQuantities();
    cleanSalesOrderFrames();
    setInterval(cleanSalesOrderFrames,1000);
  });
})();
