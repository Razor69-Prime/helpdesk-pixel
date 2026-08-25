/* PXL-URG-0014A — direct Work Order date selection from Sales Order button. */
(function(){
  'use strict';

  const today = () => {
    const d = new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };

  function findSalesOrder(id){
    try {
      return (typeof D !== 'undefined' && Array.isArray(D?.sales_orders))
        ? D.sales_orders.find(row => String(row.id) === String(id)) || null
        : null;
    } catch (_) { return null; }
  }

  function chooseDate(){
    return new Promise(resolve => {
      document.getElementById('pxl-urg-0014a-wo-date-modal')?.remove();
      const wrap = document.createElement('div');
      wrap.id = 'pxl-urg-0014a-wo-date-modal';
      wrap.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;padding:18px';
      wrap.innerHTML = '<div style="width:min(390px,100%);background:#fff;border-radius:12px;padding:18px;box-shadow:0 18px 50px rgba(0,0,0,.25);font-family:Arial,sans-serif">' +
        '<div style="font-size:17px;font-weight:700;margin-bottom:5px">Buat Work Order</div>' +
        '<div style="font-size:12px;color:#756f66;margin-bottom:14px">Pilih tanggal pelaksanaan Work Order.</div>' +
        '<label style="display:block;font-size:11px;font-weight:700;margin-bottom:5px">Tanggal Work Order</label>' +
        '<input id="pxl-urg-0014a-wo-date" type="date" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ddd8ce;border-radius:8px;font:inherit">' +
        '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">' +
        '<button id="pxl-urg-0014a-cancel" type="button" style="padding:9px 13px;border:1px solid #ddd8ce;border-radius:8px;background:#fff;font-weight:700;cursor:pointer">Batal</button>' +
        '<button id="pxl-urg-0014a-confirm" type="button" style="padding:9px 13px;border:1px solid #df7b3b;border-radius:8px;background:#df7b3b;color:#fff;font-weight:700;cursor:pointer">Buat Work Order</button>' +
        '</div></div>';
      document.body.appendChild(wrap);
      const input = wrap.querySelector('#pxl-urg-0014a-wo-date');
      input.value = today();
      input.focus();
      const done = value => { wrap.remove(); resolve(value); };
      wrap.querySelector('#pxl-urg-0014a-cancel').onclick = () => done(null);
      wrap.querySelector('#pxl-urg-0014a-confirm').onclick = () => done(input.value || today());
      wrap.addEventListener('click', event => { if(event.target === wrap) done(null); });
      input.addEventListener('keydown', event => {
        if(event.key === 'Escape') done(null);
        if(event.key === 'Enter') done(input.value || today());
      });
    });
  }

  async function createWorkOrder(id, button){
    const workedAt = await chooseDate();
    if(!workedAt) return;
    try {
      if(button) button.disabled = true;
      if(typeof api !== 'function') throw new Error('API Sales Order belum tersedia.');
      const result = await api('POST', `/api/sales-orders/${id}/work-order`, { worked_at: workedAt });
      if(typeof toast === 'function') toast(result.created ? 'Work Order berhasil dibuat' : 'Work Order sudah tersedia');
      if(typeof load === 'function') await load();
    } catch (error) {
      if(typeof toast === 'function') toast(error.message || 'Gagal membuat Work Order');
      else window.alert(error.message || 'Gagal membuat Work Order');
    } finally {
      if(button && document.body.contains(button)) button.disabled = false;
    }
  }

  document.addEventListener('click', function(event){
    const button = event.target?.closest?.('[data-act="wo"]');
    if(!button) return;
    const id = button.dataset.id;
    if(!id) return;
    const so = findSalesOrder(id);
    if(so && (so.linked_work_order_id || so.linked_crm_work_order_id)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    createWorkOrder(id, button);
  }, true);
})();
