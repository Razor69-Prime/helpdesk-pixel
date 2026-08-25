/* PXL-URG-0014 — choose Work Order date before creating WO from Sales Order. */
(function(){
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const today = () => {
    const d = new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };

  function chooseDate(){
    return new Promise(resolve => {
      const old = document.getElementById('pxl-urg-0014-wo-date-modal');
      if(old) old.remove();
      const wrap = document.createElement('div');
      wrap.id = 'pxl-urg-0014-wo-date-modal';
      wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.38);display:flex;align-items:center;justify-content:center;padding:18px';
      wrap.innerHTML = '<div style="width:min(380px,100%);background:#fff;border-radius:12px;padding:18px;box-shadow:0 18px 50px rgba(0,0,0,.22);font-family:Arial,sans-serif">' +
        '<div style="font-size:17px;font-weight:700;margin-bottom:5px">Buat Work Order</div>' +
        '<div style="font-size:12px;color:#756f66;margin-bottom:14px">Pilih tanggal pelaksanaan Work Order.</div>' +
        '<label style="display:block;font-size:11px;font-weight:700;margin-bottom:5px">Tanggal Work Order</label>' +
        '<input id="pxl-urg-0014-wo-date" type="date" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ddd8ce;border-radius:8px;font:inherit">' +
        '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">' +
        '<button id="pxl-urg-0014-cancel" type="button" style="padding:9px 13px;border:1px solid #ddd8ce;border-radius:8px;background:#fff;font-weight:700;cursor:pointer">Batal</button>' +
        '<button id="pxl-urg-0014-confirm" type="button" style="padding:9px 13px;border:1px solid #df7b3b;border-radius:8px;background:#df7b3b;color:#fff;font-weight:700;cursor:pointer">Buat Work Order</button>' +
        '</div></div>';
      document.body.appendChild(wrap);
      const input = wrap.querySelector('#pxl-urg-0014-wo-date');
      input.value = today();
      input.focus();
      const finish = value => { wrap.remove(); resolve(value); };
      wrap.querySelector('#pxl-urg-0014-cancel').onclick = () => finish(null);
      wrap.querySelector('#pxl-urg-0014-confirm').onclick = () => finish(input.value || today());
      wrap.addEventListener('click', e => { if(e.target === wrap) finish(null); });
      input.addEventListener('keydown', e => {
        if(e.key === 'Escape') finish(null);
        if(e.key === 'Enter') finish(input.value || today());
      });
    });
  }

  window.fetch = async function pxlUrg0014Fetch(input, init){
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = String(init?.method || (input && input.method) || 'GET').toUpperCase();
    if(method === 'POST' && /\/api\/sales-orders\/[^/]+\/work-order(?:\?|$)/.test(url)){
      let body = {};
      try { body = init?.body ? JSON.parse(init.body) : {}; } catch(_){ body = {}; }
      if(!body.worked_at){
        const workedAt = await chooseDate();
        if(!workedAt) throw new Error('Pembuatan Work Order dibatalkan.');
        init = { ...(init || {}), body: JSON.stringify({ ...body, worked_at: workedAt }) };
      }
    }
    return nativeFetch(input, init);
  };
})();
