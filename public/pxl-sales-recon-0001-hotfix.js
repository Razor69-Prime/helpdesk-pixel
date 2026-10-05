/* PXL-SALES-RECON-0001 — official September 2026 revenue by Sales PIC. */
(function(){
  'use strict';
  const REV='PXL-SALES-RECON-0001';
  const O={
    'Ni Putu Dea Eka Putri':37435413,
    'Gede Rizky Chandra':41197711,
    'Komang Budha Astawa':17745000,
    'I Putu Eka Hendrayana':437892000,
    'Dewa Gede Satrya Cesa':88106834
  };
  const TOTAL=622376958;
  const money=n=>'Rp '+Math.round(Number(n)||0).toLocaleString('id-ID');
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function canon(v){const r=String(v||'').trim(),k=r.toLowerCase().replace(/\s+/g,' ');if(['eka','eka hendrayana','i putu eka hendrayana'].includes(k))return'I Putu Eka Hendrayana';if(['budha','i komang budha astawa','komang budha astawa'].includes(k))return'Komang Budha Astawa';if(['dea','ni putu dea eka putri'].includes(k))return'Ni Putu Dea Eka Putri';if(['rizki','rizky','gede rizky chandra','gede rizki chandra'].includes(k))return'Gede Rizky Chandra';if(['dode','dewa gede satrya cesa'].includes(k))return'Dewa Gede Satrya Cesa';return r||'(Tanpa PIC)';}
  function exactSep(r){const a=r&&r.from,b=r&&r.to;return !!(a&&b&&a.getFullYear()===2026&&a.getMonth()===8&&a.getDate()===1&&b.getFullYear()===2026&&b.getMonth()===8&&b.getDate()===30);}
  function targetMap(){const m={};const rows=typeof window.getCanonicalSalesTargets==='function'?window.getCanonicalSalesTargets():[];(rows||[]).filter(x=>String(x.year_month||'')==='2026-09').forEach(x=>{const p=canon(x.sales_pic);m[p]=(m[p]||0)+(Number(x.target_amount)||0);});return m;}
  function targetTotal(m){return Object.values(m).reduce((a,b)=>a+b,0);}
  function pct(real,tar){return tar?Math.round(real/tar*100):0;}
  function salesRange(){const p=document.getElementById('sales-period-select')?.value||'this_month';return typeof window.getSalesPeriodRange==='function'?window.getSalesPeriodRange(p):null;}
  function dashRange(){return typeof window.getDashRange==='function'?window.getDashRange():null;}
  function salesTable(t){const e=document.getElementById('sd-sales-performance');if(!e)return;e.innerHTML=Object.keys(O).sort((a,b)=>O[b]-O[a]).map((p,i)=>{const q=pct(O[p],t[p]||0);return `<tr><td>${i+1}</td><td>${esc(p)}</td><td>${money(O[p])}</td><td>${money(t[p]||0)}</td><td><span class="pxl-sales-badge">${t[p]?q+'%':'—'}</span></td></tr>`;}).join('');}
  function contribution(){const e=document.getElementById('sd-contribution-list');if(!e)return;const mx=Math.max(...Object.values(O));e.innerHTML=Object.entries(O).sort((a,b)=>b[1]-a[1]).map(([p,v])=>`<div class="pxl-sales-contrib-row"><span>${esc(p)}</span><div class="pxl-sales-track"><div class="pxl-sales-fill" style="width:${Math.round(v/mx*100)}%"></div></div><b>${Math.round(v/TOTAL*100)}%</b></div>`).join('');}
  function applySales(){try{if(!exactSep(salesRange()))return;const t=targetMap(),tt=targetTotal(t),a=pct(TOTAL,tt);set('sd-total-real',money(TOTAL));set('sd-total-target',money(tt));set('sd-achievement',tt?a+'%':'—');set('sd-gap-target',tt?(a>=100?'Target tercapai':money(Math.max(0,tt-TOTAL))+' lagi'):'target belum diset');salesTable(t);contribution();const tab=document.getElementById('tab-sales');if(tab)tab.dataset.revenueSource='official-excel';}catch(e){console.error(REV+' sales',e);}}
  function dashSales(t){const e=document.getElementById('dash-sales-chart');if(!e)return;const mx=Math.max(...Object.values(O));e.innerHTML='<div class="dash-bar-list">'+Object.entries(O).sort((a,b)=>b[1]-a[1]).map(([p,v])=>`<div class="dash-bar-row"><div class="dash-bar-label">👤 ${esc(p)}</div><div class="dash-bar-bg"><div class="dash-bar-fill" style="width:${Math.round(v/mx*100)}%;background:var(--teal)"></div></div><div class="dash-bar-val" style="font-size:11px">${money(v)}</div></div>`).join('')+'</div>';const x=document.getElementById('dash-target-chart');if(!x)return;const max=Math.max(...Object.keys(O).map(p=>Math.max(O[p],t[p]||0)));x.innerHTML='<div class="dash-bar-list" style="gap:12px">'+Object.keys(O).sort((a,b)=>O[b]-O[a]).map(p=>{const tar=t[p]||0,q=tar?pct(O[p],tar):null;return `<div><div style="display:flex;justify-content:space-between;font-size:12px"><b>👤 ${esc(p)}</b><b>${q===null?'—':q+'%'}</b></div><div class="dash-bar-bg" style="margin:4px 0"><div class="dash-bar-fill" style="width:${Math.round(O[p]/max*100)}%;background:var(--teal)"></div></div><small>Realisasi ${money(O[p])} · Target ${tar?money(tar):'—'}</small></div>`;}).join('')+'</div>';}
  function invoiceSales(t){const e=document.getElementById('di-sales-performance');if(!e)return;const counts={};let rows=[];try{rows=typeof window.getDashInvoices==='function'?window.getDashInvoices():[];}catch(_){}rows.forEach(x=>{const p=canon(x.sales_pic||x.sales_pic_snapshot);counts[p]=(counts[p]||0)+1;});e.innerHTML=Object.keys(O).sort((a,b)=>O[b]-O[a]).map(p=>{const tar=t[p]||0,q=tar?pct(O[p],tar):0;return `<tr><td><div class="pxl-inv-person"><span>${esc(p)}</span></div></td><td>${tar?q+'%':'—'}</td><td>${money(O[p])}</td><td>${money(tar)}</td><td>${counts[p]||0}</td></tr>`;}).join('');}
  function applyDash(){try{if(!exactSep(dashRange()))return;const t=targetMap(),tt=targetTotal(t),a=tt?pct(TOTAL,tt):null;set('dm-invoice-total',money(TOTAL));set('dm-realisasi-total',money(TOTAL));set('dm-target-total',tt?money(tt):'Rp 0');set('dm-achievement',a===null?'—':a+'%');set('pxl3-target-sales',tt?money(tt):'Rp 0');set('pxl3-achievement-card',a===null?'—':a+'%');set('pxl3-revenue-total','Rp '+(TOTAL/1000000).toLocaleString('id-ID',{maximumFractionDigits:1})+' jt');set('di-total',money(TOTAL));set('di-target',money(tt));set('di-achievement',a===null?'—':a+'%');set('di-target-real',money(TOTAL));set('di-target-goal',money(tt));dashSales(t);invoiceSales(t);const tab=document.getElementById('tab-dashboard');if(tab)tab.dataset.revenueSource='official-excel';}catch(e){console.error(REV+' dashboard',e);}}
  function later(fn){fn();queueMicrotask(fn);setTimeout(fn,0);setTimeout(fn,300);}
  function wrap(name,fn){const old=window[name];if(typeof old!=='function'||old.__pxlSalesRecon)return;const w=function(){const r=old.apply(this,arguments);if(r&&typeof r.then==='function')return r.then(v=>{later(fn);return v;});later(fn);return r;};w.__pxlSalesRecon=true;window[name]=w;}
  ['renderSalesDashboard','loadSalesDashboard','setSalesPeriod'].forEach(n=>wrap(n,applySales));
  ['renderDashboard','loadDashboard','setDashPeriod','switchDashSub','PXLInvoiceRevenueRefresh'].forEach(n=>wrap(n,applyDash));
  window.PXLSalesRevenueReconciliation={revision:REV,official:O,total:TOTAL};
  window.addEventListener('load',()=>setTimeout(()=>{applySales();applyDash();},0));
})();
