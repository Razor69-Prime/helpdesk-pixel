/* PXL-STG-0020A — Final UAT Fix & Optimization. STAGING ONLY. */
(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 window.renderTechChart=window.renderTechChart||function(data,target='dash-tech-chart'){
   const el=document.getElementById(target);if(!el)return;
   const map={};(data||[]).forEach(t=>{const a=Array.isArray(t.technicians)?t.technicians:[t.technician].filter(Boolean);a.forEach(n=>{map[n]=map[n]||{total:0,done:0};map[n].total++;if(t.status==='done')map[n].done++;});});
   const rows=Object.entries(map).sort((a,b)=>b[1].total-a[1].total).slice(0,10);
   el.innerHTML=rows.length?`<div class="dash-bar-list">${rows.map(([n,v])=>`<div class="dash-bar-row"><div class="dash-bar-label">${esc(n)}</div><div class="dash-bar-bg"><div class="dash-bar-fill" style="width:${Math.round(v.done/Math.max(1,v.total)*100)}%"></div></div><div class="dash-bar-val">${v.done}/${v.total}</div></div>`).join('')}</div>`:'<div class="no-data">Belum ada data teknisi.</div>';
 };
 window.renderTargetChart=window.renderTargetChart||function(_data,target='dash-target-chart'){
   const el=document.getElementById(target);if(!el)return;
   const invoices=typeof getDashInvoices==='function'?getDashInvoices():[];
   const real={};invoices.forEach(x=>{const p=x.sales_pic||'(Tanpa PIC)';real[p]=(real[p]||0)+Number(x.total_amount||0);});
   const summary=typeof getDashTargetSummary==='function'?getDashTargetSummary():{targetMap:{}};
   const names=[...new Set([...Object.keys(summary.targetMap||{}),...Object.keys(real)])];
   const max=Math.max(1,...names.flatMap(n=>[Number(summary.targetMap?.[n]||0),Number(real[n]||0)]));
   el.innerHTML=names.length?`<div class="dash-bar-list">${names.slice(0,10).map(n=>{const t=Number(summary.targetMap?.[n]||0),r=Number(real[n]||0);return `<div class="dash-bar-row"><div class="dash-bar-label">${esc(n)}</div><div class="dash-bar-bg"><div class="dash-bar-fill" style="width:${Math.round(r/max*100)}%"></div></div><div class="dash-bar-val">${t?Math.round(r/t*100):0}%</div></div>`}).join('')}</div>`:'<div class="no-data">Belum ada target/invoice.</div>';
 };
 window.PXL_STG_0020A={revision:'PXL-STG-0020A',criticalFixes:['dashboard-tech','dashboard-invoice','kanban','purchase-request-validation']};
})();
