/* PXL-URG-0019 — native Sales Order -> Work Order date flow.
   Replaces the Sales Order act('wo') branch instead of intercepting click events. */
(function(){
  'use strict';

  if (typeof act !== 'function') return;
  const originalAct = act;

  function localToday(){
    const d=new Date();
    const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
    return local.toISOString().slice(0,10);
  }

  function getSalesOrder(id){
    try{
      return Array.isArray(D?.sales_orders)
        ? D.sales_orders.find(row=>String(row.id)===String(id))||null
        : null;
    }catch(_){ return null; }
  }

  function chooseWorkOrderDate(){
    return new Promise(resolve=>{
      document.getElementById('pxl-urg-0019-wo-date-modal')?.remove();

      const overlay=document.createElement('div');
      overlay.id='pxl-urg-0019-wo-date-modal';
      overlay.style.cssText='position:fixed;inset:0;z-index:1000000;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;padding:18px';
      overlay.innerHTML=`
        <div style="width:min(400px,100%);background:#fff;border-radius:12px;padding:18px;box-shadow:0 18px 50px rgba(0,0,0,.25)">
          <div style="font-size:17px;font-weight:700;margin-bottom:5px">Buat Work Order</div>
          <div style="font-size:12px;color:#756f66;margin-bottom:14px">Pilih tanggal pelaksanaan Work Order.</div>
          <label for="pxl-urg-0019-wo-date" style="display:block;font-size:11px;font-weight:700;margin-bottom:5px">Tanggal Work Order</label>
          <input id="pxl-urg-0019-wo-date" type="date" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ddd8ce;border-radius:8px;font:inherit">
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
            <button id="pxl-urg-0019-cancel" type="button" class="btn">Batal</button>
            <button id="pxl-urg-0019-confirm" type="button" class="btn primary">Buat Work Order</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      const input=overlay.querySelector('#pxl-urg-0019-wo-date');
      input.value=localToday();

      let finished=false;
      const done=value=>{
        if(finished) return;
        finished=true;
        overlay.remove();
        resolve(value);
      };

      overlay.querySelector('#pxl-urg-0019-cancel').addEventListener('click',()=>done(null));
      overlay.querySelector('#pxl-urg-0019-confirm').addEventListener('click',()=>done(input.value||localToday()));
      overlay.addEventListener('click',event=>{ if(event.target===overlay) done(null); });
      input.addEventListener('keydown',event=>{
        if(event.key==='Escape') done(null);
        if(event.key==='Enter') done(input.value||localToday());
      });
      setTimeout(()=>input.focus(),0);
    });
  }

  act = async function pxlUrg0019Act(id, action){
    if(action!=='wo') return originalAct(id,action);

    const so=getSalesOrder(id);
    if(so && (so.linked_work_order_id || so.linked_crm_work_order_id)){
      return originalAct(id,action);
    }

    const workedAt=await chooseWorkOrderDate();
    if(!workedAt) return;

    try{
      const result=await api('POST',`/api/sales-orders/${id}/work-order`,{worked_at:workedAt});
      toast(result.created?'Work Order berhasil dibuat':'Work Order sudah tersedia');
      if(typeof load==='function') await load();
    }catch(error){
      toast(error?.message||'Gagal membuat Work Order');
    }
  };
})();
