/* PXL-STG-0020A + PXL-PROD-0022DB3 — UAT Fix & Dashboard Submenu Preload/Cache. */
(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

 // showApp() memanggil hook ini. Compatibility guard mencegah startup terhenti.
 window.installUniversalReportButtons=window.installUniversalReportButtons||function(){};

 // PXL-PROD-0022DB3 — cache GET dashboard/submenu agar klik ulang tidak menunggu network lagi.
 // Cache hanya untuk endpoint data referensi/dashboard; tiket/notifikasi/auth tetap fresh.
 if(typeof window.api==='function'&&!window.api.__pxlDb3){
   const originalApi=window.api;
   const cache=new Map();
   const inflight=new Map();
   const TTL=120000;
   const noCache=/\/(tickets|notifications|login|logout|session|me)(?:\?|$)/i;
   const cacheable=/\/(invoice|invoices|sales-visits|visits|purchase-requests|material-requests|material_request|projects|sales-targets)(?:\?|$)/i;

   window.api=async function(method,path,body){
     const isGet=String(method||'GET').toUpperCase()==='GET';
     if(!isGet||noCache.test(path)||!cacheable.test(path)) return originalApi(method,path,body);
     const key='GET:'+path;
     const hit=cache.get(key);
     if(hit&&Date.now()-hit.at<TTL) return hit.data;
     if(inflight.has(key)) return inflight.get(key);
     const p=Promise.resolve(originalApi(method,path,body)).then(data=>{
       cache.set(key,{at:Date.now(),data});
       return data;
     }).finally(()=>inflight.delete(key));
     inflight.set(key,p);
     return p;
   };
   window.api.__pxlDb3=true;
   window.api.__pxlOriginal=originalApi;
   window.PXL_DB3_CACHE={cache,inflight,clear:()=>cache.clear()};
 }

 // Request sekunder tidak perlu berebut dengan initial ticket/dashboard load.
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

 async function prefetchDashboardSubmenus(){
   if(typeof window.api!=='function')return;
   // Endpoint lama/newer berbeda antar modul; request yang tidak tersedia diabaikan.
   // Endpoint yang valid langsung mengisi cache DB3 dan dipakai ketika submenu diklik.
   const paths=[
     '/invoices/standalone',
     '/sales-visits',
     '/purchase-requests',
     '/material-requests',
     '/sales-targets',
     '/projects'
   ];
   await Promise.allSettled(paths.map(path=>window.api('GET',path)));
 }

 // Pastikan Dashboard langsung hydrate lalu preload data submenu secara paralel di background.
 if(typeof window.showApp==='function'&&!window.showApp.__pxlDb3){
   const originalShowApp=window.showApp;
   window.showApp=function(){
     const out=originalShowApp.apply(this,arguments);
     requestAnimationFrame(async()=>{
       try{
         if(typeof window.loadTickets==='function') await window.loadTickets(true);
         if(typeof allTickets!=='undefined'&&Array.isArray(allTickets)&&typeof dashData!=='undefined') dashData=allTickets;
         const dash=document.getElementById('tab-dashboard');
         if(dash?.classList.contains('active')&&typeof window.renderDashboard==='function') window.renderDashboard();
       }catch(e){console.warn('PXL-PROD-0022DB3 dashboard hydrate:',e);}
       setTimeout(()=>{prefetchDashboardSubmenus().catch(()=>{});},250);
     });
     return out;
   };
   window.showApp.__pxlDb3=true;
 }

 // Tombol refresh Dashboard harus tetap dapat memaksa data terbaru.
 if(typeof window.loadDashboard==='function'&&!window.loadDashboard.__pxlDb3){
   const originalLoadDashboard=window.loadDashboard;
   window.loadDashboard=async function(){
     const out=await originalLoadDashboard.apply(this,arguments);
     setTimeout(()=>{prefetchDashboardSubmenus().catch(()=>{});},0);
     return out;
   };
   window.loadDashboard.__pxlDb3=true;
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
 window.PXL_STG_0020A={revision:'PXL-PROD-0022DB3',criticalFixes:['dashboard-tech','dashboard-invoice','kanban','purchase-request-validation','dashboard-initial-load','startup-request-priority','dashboard-submenu-prefetch-cache']};
})();
