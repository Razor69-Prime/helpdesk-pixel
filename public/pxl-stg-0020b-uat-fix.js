/* PXL-STG-0020A + PXL-PROD-0022DB4 — UAT Fix & Shared Dashboard Data Initialization. */
(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

 // showApp() memanggil hook ini. Compatibility guard mencegah startup terhenti.
 window.installUniversalReportButtons=window.installUniversalReportButtons||function(){};

 // PXL-PROD-0022DB4
 // Root cause: data Kunjungan/PR/MR/Project/Standalone Invoice baru benar-benar
 // masuk ke variable global Dashboard setelah loader tertentu berjalan. Gejalanya:
 // sesudah Purchase Request dibuka, submenu lain mendadak responsif.
 // DB4 menginisialisasi data shared tersebut langsung setelah login, paralel,
 // dan setiap dataset langsung merender submenu terkait saat selesai — tidak menunggu PR.
 const sharedJobs=new Map();
 const sharedLoadedAt=new Map();
 const TTL=120000;

 function dashboardActive(){
   return !!document.getElementById('tab-dashboard')?.classList.contains('active');
 }

 function renderShared(name){
   if(!dashboardActive())return;
   try{
     if(name==='visits'&&typeof currentDashSub!=='undefined'&&currentDashSub==='kunjungan'&&typeof renderDashSubKunjungan==='function') renderDashSubKunjungan();
     else if(name==='mr'&&typeof currentDashSub!=='undefined'&&currentDashSub==='mr'&&typeof renderDashSubMR==='function') renderDashSubMR(dashMRData||[]);
     else if(name==='pr'&&typeof currentDashSub!=='undefined'&&currentDashSub==='pr'&&typeof renderDashSubPR==='function') renderDashSubPR(dashPRData||[]);
     else if(name==='project'&&typeof currentDashSub!=='undefined'&&currentDashSub==='project'&&typeof renderDashSubProject==='function') renderDashSubProject(dashProjectData||[]);
     else if(name==='invoice'&&typeof currentDashSub!=='undefined'&&currentDashSub==='invoice'&&typeof renderDashboard==='function') renderDashboard();
   }catch(e){console.warn('PXL-PROD-0022DB4 render '+name,e);}
 }

 function loadShared(name,force=false){
   if(typeof api!=='function')return Promise.resolve(null);
   if(!force){
     const at=sharedLoadedAt.get(name)||0;
     if(at&&Date.now()-at<TTL)return Promise.resolve(true);
     if(sharedJobs.has(name))return sharedJobs.get(name);
   }

   const run=(async()=>{
     try{
       let data;
       if(name==='visits'){
         data=await api('GET','/sales-visits');
         if(typeof kunjunganData!=='undefined') kunjunganData=Array.isArray(data)?data:[];
       }else if(name==='mr'){
         data=await api('GET','/material-requests');
         if(typeof dashMRData!=='undefined') dashMRData=Array.isArray(data)?data:[];
       }else if(name==='pr'){
         data=await api('GET','/purchase-requests');
         const rows=Array.isArray(data)?data:[];
         if(typeof dashPRData!=='undefined') dashPRData=rows;
         // Sinkronkan data menu PR utama juga. Jadi membuka PR tidak perlu menjadi
         // pemicu request/inisialisasi lagi.
         if(typeof prData!=='undefined') prData=rows;
       }else if(name==='project'){
         data=await api('GET','/projects');
         if(typeof dashProjectData!=='undefined') dashProjectData=Array.isArray(data)?data:[];
       }else if(name==='invoice'){
         data=await api('GET','/invoices/standalone');
         if(typeof standaloneInvoices!=='undefined') standaloneInvoices=Array.isArray(data)?data:[];
       }else if(name==='targets'){
         data=await api('GET','/sales-targets');
         if(typeof salesTargets!=='undefined') salesTargets=Array.isArray(data)?data:[];
       }
       sharedLoadedAt.set(name,Date.now());
       renderShared(name);
       return data;
     }catch(e){
       console.warn('PXL-PROD-0022DB4 load '+name,e);
       return null;
     }finally{
       sharedJobs.delete(name);
     }
   })();
   sharedJobs.set(name,run);
   return run;
 }

 function warmDashboardShared(force=false){
   // Tidak await secara kolektif: setiap submenu menjadi siap begitu endpointnya selesai.
   return [
     loadShared('visits',force),
     loadShared('mr',force),
     loadShared('pr',force),
     loadShared('project',force),
     loadShared('invoice',force),
     loadShared('targets',force)
   ];
 }

 // Notifikasi dijalankan sedikit sesudah critical startup.
 if(typeof window.startNotifPolling==='function'&&!window.startNotifPolling.__pxlDb4){
   const originalStartNotif=window.startNotifPolling;
   window.startNotifPolling=function(){
     setTimeout(()=>{try{originalStartNotif();}catch(_){}},1200);
   };
   window.startNotifPolling.__pxlDb4=true;
 }

 // Initial ticket + shared dashboard data mulai hampir bersamaan.
 if(typeof window.showApp==='function'&&!window.showApp.__pxlDb4){
   const originalShowApp=window.showApp;
   window.showApp=function(){
     const out=originalShowApp.apply(this,arguments);
     requestAnimationFrame(()=>{
       // Warm shared data tanpa menunggu user membuka Purchase Request.
       setTimeout(()=>warmDashboardShared(false),100);
       (async()=>{
         try{
           if(typeof loadTickets==='function') await loadTickets(true);
           if(typeof allTickets!=='undefined'&&Array.isArray(allTickets)&&typeof dashData!=='undefined') dashData=allTickets;
           if(dashboardActive()&&typeof renderDashboard==='function') renderDashboard();
         }catch(e){console.warn('PXL-PROD-0022DB4 dashboard hydrate',e);}
       })();
     });
     return out;
   };
   window.showApp.__pxlDb4=true;
 }

 // Saat submenu diklik, pastikan dataset spesifiknya sudah berjalan/siap.
 if(typeof window.switchDashSub==='function'&&!window.switchDashSub.__pxlDb4){
   const originalSwitchDashSub=window.switchDashSub;
   window.switchDashSub=function(sub,btn){
     const out=originalSwitchDashSub.apply(this,arguments);
     const map={kunjungan:'visits',mr:'mr',pr:'pr',project:'project',invoice:'invoice'};
     const name=map[sub];
     if(name) loadShared(name,false).then(()=>renderShared(name));
     return out;
   };
   window.switchDashSub.__pxlDb4=true;
 }

 // loadDashboard tetap cepat: kick data shared tetapi tidak menunggu semuanya selesai.
 if(typeof window.loadDashboard==='function'&&!window.loadDashboard.__pxlDb4){
   const originalLoadDashboard=window.loadDashboard;
   window.loadDashboard=async function(){
     warmDashboardShared(false);
     return originalLoadDashboard.apply(this,arguments);
   };
   window.loadDashboard.__pxlDb4=true;
 }

 // Menu Purchase Request utama memakai hasil preload bila sudah tersedia.
 if(typeof window.loadPurchaseRequests==='function'&&!window.loadPurchaseRequests.__pxlDb4){
   const originalLoadPR=window.loadPurchaseRequests;
   window.loadPurchaseRequests=async function(){
     try{
       if(typeof prData!=='undefined'&&Array.isArray(prData)&&prData.length){
         if(typeof renderPRList==='function') renderPRList();
         loadShared('pr',false);
         return prData;
       }
     }catch(_){}
     return originalLoadPR.apply(this,arguments);
   };
   window.loadPurchaseRequests.__pxlDb4=true;
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

 window.PXL_DB4={revision:'PXL-PROD-0022DB4',warmDashboardShared,loadShared,sharedJobs,sharedLoadedAt};
 window.PXL_STG_0020A={revision:'PXL-PROD-0022DB4',criticalFixes:['dashboard-tech','dashboard-invoice','kanban','purchase-request-validation','dashboard-initial-load','startup-request-priority','shared-dashboard-data-init']};
})();
