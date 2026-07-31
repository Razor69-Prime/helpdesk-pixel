/* PXL-STG-0004F — editable pickup quantity with automatic usage/return formula. */
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
    if(usageQty>pickupQty){
      usageQty=pickupQty;
      usage.value=String(pickupQty);
    }
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

      if(usage){
        usage.readOnly=false;
        usage.disabled=false;
        usage.removeAttribute('readonly');
        usage.removeAttribute('disabled');
      }

      if(!pickup.dataset.pxl0004f){
        pickup.dataset.pxl0004f='1';
        pickup.addEventListener('input',()=>applyAutomaticFormula(row));
        pickup.addEventListener('change',()=>applyAutomaticFormula(row));
      }
      if(usage&&!usage.dataset.pxl0004f){
        usage.dataset.pxl0004f='1';
        usage.addEventListener('input',()=>applyAutomaticFormula(row));
        usage.addEventListener('change',()=>applyAutomaticFormula(row));
      }
      applyAutomaticFormula(row);
    });
  }

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

  const observer=new MutationObserver(()=>unlockPickupQuantities());
  document.addEventListener('DOMContentLoaded',()=>{
    const body=document.getElementById('mr-items-body');
    if(body)observer.observe(body,{childList:true,subtree:true});
    unlockPickupQuantities();
  });
})();
