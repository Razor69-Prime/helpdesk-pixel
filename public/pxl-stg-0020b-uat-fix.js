/* PXL-STG-0020A + PXL-PROD-0022DB2 — UAT Fix & Startup/Dashboard Optimization. */
(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

 // showApp() memanggil hook ini. Compatibility guard mencegah startup terhenti.
 window.installUniversalReportButtons=window.installUniversalReportButtons||function(){};

 // PXL-PROD-0022DB2 — request sekunder tidak perlu berebut dengan initial ticket/dashboard load.
 // Notifikasi tetap polling 60 detik, tetapi first fetch dimulai sesaat setelah UI utama tampil.
 if(typeof window.startNotifPolling==='function'&&!window.startNotifPolling.__pxlDb2){
   const originalStartNotif=window.startNotifPolling;
   window.startNotifPolling=function(){
     clearInterval(window.notifPollTimer);
     setTimeout(()=>{
       try{ if(typeof window.loadNotifications==='function') window.loadNotifications(); else originalStartNotif(); }catch(_){ originalStartNotif(); }
       try{
         clearInterval(window.notifPollTimer);
         window.notifPollTimer=setInterval(()=>{if(!document.hidden&&typeof window.loadNotifications==='function')window.loadNotifications();},60000);
       }catch(_){}
     },1200);
   };
   window.startNotifPolling.__pxlDb2=true;
 }

 // Pastikan Dashboard Manager/Superadmin langsung memakai hasil initial /tickets.
 // loadTickets() sudah mempunyai ticketsLoadPromise sehingga wrapper ini tidak membuat GET ganda.
 if(typeof window.showApp==='function'&&!window.showApp.__pxlDb2){
   const originalShowApp=window.showApp;
   window.showApp=function(){
     const out=originalShowApp.apply(this,arguments);
     requestAnimationFrame(async()=>{
       try{
         if(typeof window.loadTickets==='function') await window.loadTickets(true);
         if(typeof allTickets!=='undefined'&&Array.isArray(allTickets)&&typeof dashData!=='undefined') dashData=allTickets;
         const dash=document.getElementById('tab-dashboard');
         if(dash?.classList.contains('active')&&typeof window.renderDashboard==='function') window.renderDashboard();
       }catch(e){console.warn('PXL-PROD-0022DB2 dashboard hydrate:',e);}
     });
     return out;
   };
   window.showApp.__pxlDb2=true;
 }

 window.renderTechChart=window.renderTechChart||function(data,target='dash-tech-chart'){
   const el=document.getElementById(target);if(!el)return;
   const map={};(data||[]).forEach(t=>{const a=Array.isArray(t.technicians)?t.technicians:[t.technician].filter(Boolean);a.forEach(n=>{map[n]=map[n]||{total:0,done:0};map[n].total++;if(t.status==='done')map[n].done++;});});
   const rows=Object.entries(map).sort((a,b)=>b[1].total-a[1].total).slice(0,10);
   el.innerHTML=rows.length?`<div class="dash-bar-list">${rows.map(([n,v])=>`<div class="dash-bar-row"><div class="dash-bar-label">${esc(n)}</div><div class="dash-bar-bg"><div class="dash-bar-fill" style="width:${Math.round(v.done/Math.max(1,v.total)*100)}%"></div></div><div class="dash-bar-val">${v.done}/${v.total}</div></div>`).join('')}</div>`:'<div class="no-data">Belum ada data teknisi.</div>';
 };
 window.renderSalesChart=window.renderSalesChart||function(_data,target='dash-sales-chart'){
   const el=document.getElementById(target);if(!el)return;
   const invoices=typeof getDashInvoices==='function'?getDashInvoices():[];
   const sums={};invoices.forEach(x=>{const p=x.sales_pic||'(Tanpa PIC)';sums[p]=(sums[p]||0)+Number(x.total_amount||0);});
   const rows=Object.entries(sums).sort((a,b)=>b[1]-a[1]).slice(0,10),max=Math.max(1,...rows.map(x=>x[1]));
   el.innerHTML=rows.length?`<div class="dash-bar-list">${rows.map(([n,v])=>`<div class="dash-bar-row"><div class="dash-bar-label">${esc(n)}</div><div class="dash-bar-bg"><div class="dash-bar-fill" style="width:${Math.round(v/max*100)}%"></div></div><div class="dash-bar-val">${Number(v).toLocaleString('id-ID')}</div></div>`).join('')}</div>`:'<div class="no-data">Belum ada data invoice per Sales.</div>';
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
 window.PXL_STG_0020A={revision:'PXL-PROD-0022DB2',criticalFixes:['dashboard-tech','dashboard-invoice','kanban','purchase-request-validation','dashboard-initial-load','startup-request-priority']};
})();
