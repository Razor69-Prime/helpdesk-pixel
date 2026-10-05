/* PXL-SALES-RECON-0001 — September 2026 omzet follows Monthly Sales Report / Daily Omset September. */
(function(){
  'use strict';
  const REV='PXL-SALES-RECON-0001';
  const OFFICIAL=Object.freeze({
    'Ni Putu Dea Eka Putri':37435413,
    'Gede Rizky Chandra':41197711,
    'Komang Budha Astawa':17745000,
    'I Putu Eka Hendrayana':437892000,
    'Dewa Gede Satrya Cesa':88106834
  });
  const TOTAL=Object.values(OFFICIAL).reduce((a,b)=>a+b,0);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>'Rp '+Math.round(Number(v)||0).toLocaleString('id-ID');
  const compact=v=>'Rp '+((Number(v)||0)/1000000).toLocaleString('id-ID',{maximumFractionDigits:1})+' jt';
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  function canon(name){
    const raw=String(name||'').trim(),k=raw.toLowerCase().replace(/\s+/g,' ');
    if(['eka','eka hendrayana','i putu eka hendrayana'].includes(k))return'I Putu Eka Hendrayana';
    if(['budha','i komang budha astawa','komang budha astawa'].includes(k))return'Komang Budha Astawa';
    if(['dea','ni putu dea eka putri'].includes(k))return'Ni Putu Dea Eka Putri';
    if(['rizki','rizky','gede rizky chandra','gede rizki chandra'].includes(k))return'Gede Rizky Chandra';
    if(['dode','dewa gede satrya cesa'].includes(k))return'Dewa Gede Satrya Cesa';
    return raw||'(Tanpa PIC)';
  }
  function exactSeptember(from,to){
    if(!from||!to)return false;
    return from.getFullYear()===2026&&from.getMonth()===8&&from.getDate()===1&&to.getFullYear()===2026&&to.getMonth()===8&&to.getDate()===30;
  }
  function targets(){
    const out={};
    const rows=typeof window.getCanonicalSalesTargets==='function'?window.getCanonicalSalesTargets():[];
    (rows||[]).filter(x=>String(x.year_month||'')==='2026-09').forEach(x=>{const p=canon(x.sales_pic);out[p]=(out[p]||0)+(Number(x.target_amount)||0);});
    return out;
  }
  function targetTotal(t){return Object.values(t).reduce((a,b)=>a+b,0);}
  function counts(rows){const out={};(rows||[]).forEach(x=>{const p=canon(x.sales_pic||x.sales_pic_snapshot);out[p]=(out[p]||0)+1;});return out;}
  function initials(name){return String(name||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'?';}
  function salesRows(){try{return typeof window.buildSalesPerformanceInvoices==='function'?window.buildSalesPerformanceInvoices():[];}catch(_){return[];}}
  function dashRows(){try{return typeof window.getDashInvoices==='function'?window.getDashInvoices():[];}catch(_){return[];}}
  function septemberRows(rows){return(rows||[]).filter(x=>{const raw=x.sales_date||x.invoice_date||x.uploaded_at||x.ticket_date||x.created_at,d=new Date(raw||0);return !isNaN(d)&&d.getFullYear()===2026&&d.getMonth()===8;});}
  function perfTable(id,t,withAvatar=false,rowCounts={}){
    const box=document.getElementById(id);if(!box)return;
    const pics=Object.keys(OFFICIAL).sort((a,b)=>OFFICIAL[b]-OFFICIAL[a]);
    if(id==='sd-sales-performance')box.innerHTML=pics.map((p,i)=>{const tar=t[p]||0,pct=tar?Math.round(OFFICIAL[p]/tar*100):0,color=pct>=100?['#E9F8EF','#10B981']:pct>=70?['#FFF8E7','#B77900']:['#FFF0F1','#EF4444'];return `<tr><td>${i+1}</td><td>${esc(p)}</td><td>${money(OFFICIAL[p])}</td><td>${money(tar)}</td><td><span class="pxl-sales-badge" style="background:${color[0]};color:${color[1]}">${tar?pct+'%':'—'}</span></td></tr>`;}).join('');
    else box.innerHTML=pics.map(p=>{const tar=t[p]||0,pct=tar?Math.round(OFFICIAL[p]/tar*100):0,w=tar?Math.min(100,pct):0,cls=pct<70?'warn':'';return `<tr><td><div class="pxl-inv-person"><i class="pxl-inv-avatar">${esc(initials(p))}</i><span title="${esc(p)}">${esc(p)}</span></div></td><td><div class="pxl-inv-progress"><div class="pxl-inv-progress-track"><div class="pxl-inv-progress-fill ${cls}" style="width:${w}%"></div></div><span class="pxl-inv-progress-pct">${tar?pct+'%':'—'}</span></div></td><td>${money(OFFICIAL[p])}</td><td>${money(tar)}</td><td>${rowCounts[p]||0}</td></tr>`;}).join('');
  }
  function contribution(){
    const box=document.getElementById('sd-contribution-list');if(!box)return;
    const max=Math.max(...Object.values(OFFICIAL));
    box.innerHTML=Object.entries(OFFICIAL).sort((a,b)=>b[1]-a[1]).map(([p,v])=>`<div class="pxl-sales-contrib-row"><span title="${esc(p)}">${esc(p)}</span><div class="pxl-sales-track"><div class="pxl-sales-fill" style="width:${Math.round(v/max*100)}%"></div></div><b>${Math.round(v/TOTAL*100)}%</b></div>`).join('');
  }
  function annual(){
    const rows=salesRows(),byPic={...OFFICIAL};
    rows.forEach(x=>{const raw=x.sales_date||x.invoice_date||x.uploaded_at||x.ticket_date,d=new Date(raw||0);if(isNaN(d)||d.getFullYear()!==2026||d.getMonth()<9||d.getMonth()>11)return;const p=canon(x.sales_pic||x.sales_pic_snapshot);byPic[p]=(byPic[p]||0)+(Number(x.total_amount)||0);});
    const total=Object.values(byPic).reduce((a,b)=>a+b,0),tAll=typeof window.getCanonicalSalesTargets==='function'?window.getCanonicalSalesTargets():[],tar={};
    (tAll||[]).filter(x=>/^2026-(09|10|11|12)$/.test(String(x.year_month||''))).forEach(x=>{const p=canon(x.sales_pic);tar[p]=(tar[p]||0)+(Number(x.target_amount)||0);});
    const tt=targetTotal(tar),pct=tt?total/tt*100:0,gap=Math.max(0,tt-total);
    set('sd-annual-real',money(total));set('sd-annual-gap',tt?(gap?money(gap):'Target tercapai'):'—');set('sd-annual-pct',tt?pct.toLocaleString('id-ID',{minimumFractionDigits:1,maximumFractionDigits:1})+'%':'—');set('sd-annual-progress-label',tt?pct.toLocaleString('id-ID',{minimumFractionDigits:1,maximumFractionDigits:1})+'%':'—');
    const bar=document.getElementById('sd-annual-progress-bar');if(bar)bar.style.width=Math.min(100,Math.max(0,pct))+'%';
  }
  function applySales(){
    try{
      const period=document.getElementById('sales-period-select')?.value||'this_month',r=typeof window.getSalesPeriodRange==='function'?window.getSalesPeriodRange(period):null;
      annual();
      if(!r||!exactSeptember(r.from,r.to))return;
      const t=targets(),tt=targetTotal(t),pct=tt?Math.round(TOTAL/tt*100):0,rows=septemberRows(salesRows());
      set('sd-total-real',money(TOTAL));set('sd-total-target',money(tt));set('sd-achievement',tt?pct+'%':'—');set('sd-gap-target',tt?(pct>=100?'Target tercapai':money(Math.max(0,tt-TOTAL))+' lagi'):'target belum diset');set('sd-avg-transaction',money(rows.length?Math.round(TOTAL/rows.length):0));
      perfTable('sd-sales-performance',t);contribution();
      const tab=document.getElementById('tab-sales');if(tab)tab.dataset.revenueSource='official-excel';
    }catch(e){console.error(REV+' sales',e);}
  }
  function dashChart(){
    const box=document.getElementById('dash-sales-chart');if(!box)return,max=Math.max(...Object.values(OFFICIAL));
    box.innerHTML=`<div class="dash-bar-list">${Object.entries(OFFICIAL).sort((a,b)=>b[1]-a[1]).map(([p,v])=>`<div class="dash-bar-row"><div class="dash-bar-label" title="${esc(p)}">👤 ${esc(p)}</div><div class="dash-bar-bg"><div class="dash-bar-fill" style="width:${Math.round(v/max*100)}%;background:var(--teal)"></div></div><div class="dash-bar-val" style="font-size:11px">${money(v)}</div></div>`).join('')}</div>`;
  }
  function targetChart(t){
    const box=document.getElementById('dash-target-chart');if(!box)return,pics=Object.keys(OFFICIAL),max=Math.max(...pics.map(p=>Math.max(OFFICIAL[p],t[p]||0)));
    box.innerHTML=`<div class="dash-bar-list" style="gap:12px">${pics.sort((a,b)=>OFFICIAL[b]-OFFICIAL[a]).map(p=>{const tar=t[p]||0,pct=tar?Math.round(OFFICIAL[p]/tar*100):null;return `<div><div style="display:flex;justify-content:space-between;font-size:12px"><b>👤 ${esc(p)}</b><b>${pct===null?'—':pct+'%'}</b></div><div class="dash-bar-bg" style="margin:4px 0"><div class="dash-bar-fill" style="width:${Math.round(OFFICIAL[p]/max*100)}%;background:var(--teal)"></div></div><small>Realisasi ${money(OFFICIAL[p])} · Target ${tar?money(tar):'—'}</small></div>`;}).join('')}</div>`;
  }
  function applyDashboard(){
    try{
      const r=typeof window.getDashRange==='function'?window.getDashRange():null;if(!r||!exactSeptember(r.from,r.to))return;
      const t=targets(),tt=targetTotal(t),pct=tt?Math.round(TOTAL/tt*100):null,rows=septemberRows(dashRows()),c=counts(rows);
      set('dm-invoice-total',money(TOTAL));set('dm-invoice-count',rows.length+' invoice');set('dm-realisasi-total',money(TOTAL));set('dm-target-total',tt?money(tt):'Rp 0');set('dm-achievement',pct===null?'—':pct+'%');
      const sub=document.getElementById('dm-achievement-sub');if(sub)sub.textContent=pct===null?'Target belum diset':(pct>=100?'🎉 Target tercapai':money(Math.max(0,tt-TOTAL))+' lagi');
      set('pxl3-target-sales',tt?money(tt):'Rp 0');set('pxl3-achievement-card',pct===null?'—':pct+'%');set('pxl3-achievement-sub',pct===null?'Target belum diset':(pct>=100?'Target tercapai':money(Math.max(0,tt-TOTAL))+' lagi'));set('pxl3-revenue-total',compact(TOTAL));
      set('di-total',money(TOTAL));set('di-avg',money(rows.length?Math.round(TOTAL/rows.length):0));set('di-target',money(tt));set('di-achievement',tt?pct+'%':'—');set('di-sales-pic',5);set('di-target-pct',tt?pct+'%':'—');set('di-target-real',money(TOTAL));set('di-target-goal',money(tt));set('di-target-remain',money(Math.max(0,tt-TOTAL)));set('di-target-pics',5);
      perfTable('di-sales-performance',t,true,c);dashChart();targetChart(t);
      const tab=document.getElementById('tab-dashboard');if(tab)tab.dataset.revenueSource='official-excel';
    }catch(e){console.error(REV+' dashboard',e);}
  }
  function after(fn){fn();queueMicrotask(fn);setTimeout(fn,0);setTimeout(fn,300);}
  function wrap(name,fn){const old=window[name];if(typeof old!=='function'||old.__pxlSalesRecon0001)return;const w=function(){const out=old.apply(this,arguments);if(out&&typeof out.then==='function')return out.then(v=>{after(fn);return v;});after(fn);return out;};w.__pxlSalesRecon0001=true;window[name]=w;}
  ['renderSalesDashboard','loadSalesDashboard','setSalesPeriod'].forEach(n=>wrap(n,applySales));
  ['renderDashboard','loadDashboard','setDashPeriod','switchDashSub','PXLInvoiceRevenueRefresh'].forEach(n=>wrap(n,applyDashboard));
  window.PXLSalesRevenueReconciliation={revision:REV,official:OFFICIAL,total:TOTAL,applySales,applyDashboard};
  window.addEventListener('load',()=>setTimeout(()=>{applySales();applyDashboard();},0));
})();
