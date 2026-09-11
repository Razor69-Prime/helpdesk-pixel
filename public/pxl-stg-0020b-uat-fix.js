/* PXL-STG-0020A + PXL-PROD-0022DB4 — UAT Fix & Shared Dashboard Data Initialization. */
(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

 window.installUniversalReportButtons=window.installUniversalReportButtons||function(){};
 const sharedJobs=new Map();
 const sharedLoadedAt=new Map();
 const TTL=120000;
 function dashboardActive(){return !!document.getElementById('tab-dashboard')?.classList.contains('active');}
 function renderShared(name){if(!dashboardActive())return;try{if(name==='visits'&&typeof currentDashSub!=='undefined'&&currentDashSub==='kunjungan'&&typeof renderDashSubKunjungan==='function')renderDashSubKunjungan();else if(name==='mr'&&typeof currentDashSub!=='undefined'&&currentDashSub==='mr'&&typeof renderDashSubMR==='function')renderDashSubMR(dashMRData||[]);else if(name==='pr'&&typeof currentDashSub!=='undefined'&&currentDashSub==='pr'&&typeof renderDashSubPR==='function')renderDashSubPR(dashPRData||[]);else if(name==='project'&&typeof currentDashSub!=='undefined'&&currentDashSub==='project'&&typeof renderDashSubProject==='function')renderDashSubProject(dashProjectData||[]);else if(name==='invoice'&&typeof currentDashSub!=='undefined'&&currentDashSub==='invoice'&&typeof renderDashboard==='function')renderDashboard();}catch(e){console.warn('PXL-PROD-0022DB4 render '+name,e);}}
 function loadShared(name,force=false){if(typeof api!=='function')return Promise.resolve(null);if(!force){const at=sharedLoadedAt.get(name)||0;if(at&&Date.now()-at<TTL)return Promise.resolve(true);if(sharedJobs.has(name))return sharedJobs.get(name);}const run=(async()=>{try{let data;if(name==='visits'){data=await api('GET','/sales-visits');if(typeof kunjunganData!=='undefined')kunjunganData=Array.isArray(data)?data:[];}else if(name==='mr'){data=await api('GET','/material-requests');if(typeof dashMRData!=='undefined')dashMRData=Array.isArray(data)?data:[];}else if(name==='pr'){data=await api('GET','/purchase-requests');const rows=Array.isArray(data)?data:[];if(typeof dashPRData!=='undefined')dashPRData=rows;if(typeof prData!=='undefined')prData=rows;}else if(name==='project'){data=await api('GET','/projects');if(typeof dashProjectData!=='undefined')dashProjectData=Array.isArray(data)?data:[];}else if(name==='invoice'){data=await api('GET','/invoices/standalone');if(typeof standaloneInvoices!=='undefined')standaloneInvoices=Array.isArray(data)?data:[];}else if(name==='targets'){data=await api('GET','/sales-targets');if(typeof salesTargets!=='undefined')salesTargets=Array.isArray(data)?data:[];}sharedLoadedAt.set(name,Date.now());renderShared(name);return data;}catch(e){console.warn('PXL-PROD-0022DB4 load '+name,e);return null;}finally{sharedJobs.delete(name);}})();sharedJobs.set(name,run);return run;}
 function warmDashboardShared(force=false){return [loadShared('visits',force),loadShared('mr',force),loadShared('pr',force),loadShared('project',force),loadShared('invoice',force),loadShared('targets',force)];}
 if(typeof window.startNotifPolling==='function'&&!window.startNotifPolling.__pxlDb4){const originalStartNotif=window.startNotifPolling;window.startNotifPolling=function(){setTimeout(()=>{try{originalStartNotif();}catch(_){}},1200);};window.startNotifPolling.__pxlDb4=true;}
 if(typeof window.showApp==='function'&&!window.showApp.__pxlDb4){const originalShowApp=window.showApp;window.showApp=function(){const out=originalShowApp.apply(this,arguments);requestAnimationFrame(()=>{setTimeout(()=>warmDashboardShared(false),100);setTimeout(()=>{try{if(typeof allTickets!=='undefined'&&Array.isArray(allTickets)&&typeof dashData!=='undefined')dashData=allTickets;if(dashboardActive()&&typeof renderDashboard==='function')renderDashboard();}catch(e){console.warn('PXL-PROD-0022DB4 dashboard hydrate',e);}},800);});return out;};window.showApp.__pxlDb4=true;}
 if(typeof window.switchDashSub==='function'&&!window.switchDashSub.__pxlDb4){const originalSwitchDashSub=window.switchDashSub;window.switchDashSub=function(sub,btn){const out=originalSwitchDashSub.apply(this,arguments);const map={kunjungan:'visits',mr:'mr',pr:'pr',project:'project',invoice:'invoice'};const name=map[sub];if(name)loadShared(name,false).then(()=>renderShared(name));return out;};window.switchDashSub.__pxlDb4=true;}
 if(typeof window.loadDashboard==='function'&&!window.loadDashboard.__pxlDb4){const originalLoadDashboard=window.loadDashboard;window.loadDashboard=async function(){warmDashboardShared(false);return originalLoadDashboard.apply(this,arguments);};window.loadDashboard.__pxlDb4=true;}
 if(typeof window.loadPurchaseRequests==='function'&&!window.loadPurchaseRequests.__pxlDb4){const originalLoadPR=window.loadPurchaseRequests;window.loadPurchaseRequests=async function(){try{if(typeof prData!=='undefined'&&Array.isArray(prData)&&prData.length){if(typeof renderPRList==='function')renderPRList();loadShared('pr',false);return prData;}}catch(_){}return originalLoadPR.apply(this,arguments);};window.loadPurchaseRequests.__pxlDb4=true;}
 window.renderTechChart=window.renderTechChart||function(data,target='dash-tech-chart'){const el=document.getElementById(target);if(!el)return;const map={};(data||[]).forEach(t=>{const a=Array.isArray(t.technicians)?t.technicians:[t.technician].filter(Boolean);a.forEach(n=>{map[n]=map[n]||{total:0,done:0};map[n].total++;if(t.status==='done')map[n].done++;});});const rows=Object.entries(map).sort((a,b)=>b[1].total-a[1].total).slice(0,10);el.innerHTML=rows.length?`<div class="dash-bar-list">${rows.map(([n,v])=>`<div class="dash-bar-row"><div class="dash-bar-label">${esc(n)}</div><div class="dash-bar-bg"><div class="dash-bar-fill" style="width:${Math.round(v.done/Math.max(1,v.total)*100)}%"></div></div><div class="dash-bar-val">${v.done}/${v.total}</div></div>`).join('')}</div>`:'<div class="no-data">Belum ada data teknisi.</div>';};
 window.renderSalesChart=window.renderSalesChart||function(_data,target='dash-sales-chart'){const el=document.getElementById(target);if(!el)return;const invoices=typeof getDashInvoices==='function'?getDashInvoices():[];const sums={};invoices.forEach(x=>{const p=x.sales_pic||'(Tanpa PIC)';sums[p]=(sums[p]||0)+Number(x.total_amount||0);});const rows=Object.entries(sums).sort((a,b)=>b[1]-a[1]).slice(0,10),max=Math.max(1,...rows.map(x=>x[1]));el.innerHTML=rows.length?`<div class="dash-bar-list">${rows.map(([n,v])=>`<div class="dash-bar-row"><div class="dash-bar-label">${esc(n)}</div><div class="dash-bar-bg"><div class="dash-bar-fill" style="width:${Math.round(v/max*100)}%"></div></div><div class="dash-bar-val">${Number(v).toLocaleString('id-ID')}</div></div>`).join('')}</div>`:'<div class="no-data">Belum ada data invoice per Sales.</div>';};
 window.renderTargetChart=window.renderTargetChart||function(_data,target='dash-target-chart'){const el=document.getElementById(target);if(!el)return;const invoices=typeof getDashInvoices==='function'?getDashInvoices():[];const real={};invoices.forEach(x=>{const p=x.sales_pic||'(Tanpa PIC)';real[p]=(real[p]||0)+Number(x.total_amount||0);});const summary=typeof getDashTargetSummary==='function'?getDashTargetSummary():{targetMap:{}};const names=[...new Set([...Object.keys(summary.targetMap||{}),...Object.keys(real)])];const max=Math.max(1,...names.flatMap(n=>[Number(summary.targetMap?.[n]||0),Number(real[n]||0)]));el.innerHTML=names.length?`<div class="dash-bar-list">${names.slice(0,10).map(n=>{const t=Number(summary.targetMap?.[n]||0),r=Number(real[n]||0);return `<div class="dash-bar-row"><div class="dash-bar-label">${esc(n)}</div><div class="dash-bar-bg"><div class="dash-bar-fill" style="width:${Math.round(r/max*100)}%"></div></div><div class="dash-bar-val">${t?Math.round(r/t*100):0}%</div></div>`}).join('')}</div>`:'<div class="no-data">Belum ada target/invoice.</div>';};
 window.PXL_DB4={revision:'PXL-PROD-0022DB4',warmDashboardShared,loadShared,sharedJobs,sharedLoadedAt};window.PXL_STG_0020A={revision:'PXL-PROD-0022DB4',criticalFixes:['dashboard-tech','dashboard-invoice','kanban','purchase-request-validation','dashboard-initial-load','startup-request-priority','shared-dashboard-data-init']};
})();

// PXL-URG-0031H — PR PDF renderer + Master Supplier preload.
(function(){
  'use strict';
  document.querySelectorAll('script[data-pxl-pr-branding]').forEach(el=>el.remove());
  const s=document.createElement('script');
  s.dataset.pxlPrBranding='0031H';
  s.src='/pxl-urg-0031-pr-pdf-branding.js?v=PXL-URG-0031H';
  document.head.appendChild(s);
})();

// PXL-URG-0064 — production-safe egress optimization.
// Ticket background refresh: 10 menit. Notification background refresh: 30 menit.
// Polling berhenti setelah 15 menit idle dan aktif kembali dengan satu refresh saat user kembali.
(function(){
  'use strict';
  const REV='PXL-URG-0064';
  const TICKET_MS=10*60*1000;
  const NOTIF_MS=30*60*1000;
  const IDLE_MS=15*60*1000;
  let idle=false;
  let idleTimer=null;

  function loggedIn(){try{return typeof currentUser!=='undefined'&&!!currentUser;}catch(_){return false;}}
  function canPoll(){return loggedIn()&&!document.hidden&&!idle;}
  function clearPolling(){
    try{if(typeof pollTimer!=='undefined')clearInterval(pollTimer);}catch(_){}
    try{if(typeof notifPollTimer!=='undefined')clearInterval(notifPollTimer);}catch(_){}
  }
  function startTicket0064(){
    try{clearInterval(pollTimer);pollTimer=setInterval(()=>{if(canPoll()&&typeof loadTickets==='function')loadTickets();},TICKET_MS);}catch(e){console.warn(REV+' ticket polling',e);}
  }
  function startNotif0064(){
    try{
      clearInterval(notifPollTimer);
      if(canPoll()&&typeof loadNotifications==='function')loadNotifications();
      notifPollTimer=setInterval(()=>{if(canPoll()&&typeof loadNotifications==='function')loadNotifications();},NOTIF_MS);
    }catch(e){console.warn(REV+' notification polling',e);}
  }
  function scheduleIdle(){
    clearTimeout(idleTimer);
    idleTimer=setTimeout(()=>{idle=true;clearPolling();},IDLE_MS);
  }
  async function resumeFromIdle(){
    const wasIdle=idle;
    idle=false;
    scheduleIdle();
    if(!wasIdle||document.hidden||!loggedIn())return;
    try{if(typeof loadTickets==='function')await loadTickets();}catch(_){}
    try{if(typeof loadNotifications==='function')await loadNotifications();}catch(_){}
    startTicket0064();
    startNotif0064();
  }

  if(typeof window.startPolling==='function')window.startPolling=startTicket0064;
  if(typeof window.startNotifPolling==='function')window.startNotifPolling=startNotif0064;

  ['pointerdown','keydown','touchstart','scroll'].forEach(evt=>document.addEventListener(evt,resumeFromIdle,{passive:true}));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)return;resumeFromIdle();});
  scheduleIdle();

  setTimeout(()=>{
    if(!loggedIn())return;
    startTicket0064();
    startNotif0064();
  },1500);

  window.PXL_URG_0064={revision:REV,ticketPollMs:TICKET_MS,notificationPollMs:NOTIF_MS,idlePauseMs:IDLE_MS};
})();

// PXL-URG-0065 — tampilkan kontrol refresh manual pada Daftar Tiket.
(function(){
  'use strict';
  const REV='PXL-URG-0065';
  function installTicketRefresh(){
    if(document.getElementById('pxl-ticket-refresh-btn')) return true;
    const updated=document.getElementById('last-updated');
    if(!updated || !updated.parentElement) return false;
    const wrap=updated.parentElement;
    const label=[...wrap.querySelectorAll('span')].find(el=>/Diperbarui otomatis/i.test(el.textContent||''));
    if(label) label.textContent='Diperbarui otomatis tiap 10 menit';
    const btn=document.createElement('button');
    btn.id='pxl-ticket-refresh-btn';
    btn.type='button';
    btn.className='btn sm blue';
    btn.style.marginLeft='8px';
    btn.textContent='🔄 Refresh';
    btn.title='Ambil data tiket terbaru sekarang';
    btn.addEventListener('click',async()=>{
      const old=btn.textContent;
      btn.disabled=true;
      btn.textContent='⏳ Memuat...';
      try{
        if(typeof loadTickets==='function') await loadTickets(true);
      }catch(e){console.warn(REV+' manual refresh',e);}
      finally{
        btn.disabled=false;
        btn.textContent=old;
      }
    });
    wrap.appendChild(btn);
    return true;
  }
  document.addEventListener('DOMContentLoaded',installTicketRefresh);
  setTimeout(installTicketRefresh,0);
  setTimeout(installTicketRefresh,500);
  setTimeout(installTicketRefresh,1500);
  window.PXL_URG_0065={revision:REV,installTicketRefresh};
})();

// PXL-URG-0066 — Dashboard manual refresh mode.
// Membuka Dashboard hanya merender data yang sudah ada; fetch baru dilakukan saat tombol Refresh Dashboard ditekan.
(function(){
  'use strict';
  const REV='PXL-URG-0066';
  const networkDashboardLoader=typeof window.loadDashboard==='function'?window.loadDashboard:null;
  let lastRefreshAt=null;
  let refreshing=false;

  function fmtTime(d){
    if(!d) return 'Belum direfresh manual';
    try{return d.toLocaleString('id-ID',{timeZone:'Asia/Makassar',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});}catch(_){return d.toLocaleString('id-ID');}
  }

  function installDashboardRefresh(){
    const tab=document.getElementById('tab-dashboard');
    if(!tab) return false;
    let bar=document.getElementById('pxl-dashboard-manual-refresh');
    if(bar) return true;
    bar=document.createElement('div');
    bar.id='pxl-dashboard-manual-refresh';
    bar.className='card';
    bar.style.cssText='display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 14px;margin-bottom:14px';
    bar.innerHTML='<button type="button" id="pxl-dashboard-refresh-btn" class="btn blue">🔄 Refresh Dashboard</button><span style="font-size:12px;color:var(--muted)">Dashboard tidak mengambil data otomatis. Data terakhir: <b id="pxl-dashboard-refresh-time">Belum direfresh manual</b></span>';
    tab.insertBefore(bar,tab.firstChild);
    const btn=bar.querySelector('#pxl-dashboard-refresh-btn');
    btn.addEventListener('click',async()=>{
      if(refreshing) return;
      refreshing=true;
      const old=btn.textContent;
      btn.disabled=true;
      btn.textContent='⏳ Memuat Dashboard...';
      try{
        if(networkDashboardLoader) await networkDashboardLoader();
        lastRefreshAt=new Date();
        const time=document.getElementById('pxl-dashboard-refresh-time');
        if(time) time.textContent=fmtTime(lastRefreshAt)+' WITA';
      }catch(e){
        console.error(REV+' refresh gagal',e);
        alert('Gagal refresh Dashboard: '+(e?.message||e));
      }finally{
        refreshing=false;
        btn.disabled=false;
        btn.textContent=old;
      }
    });
    return true;
  }

  window.loadDashboard=async function(){
    installDashboardRefresh();
    try{if(typeof renderDashboard==='function')renderDashboard();}catch(e){console.warn(REV+' render cache',e);}
    return null;
  };
  window.loadDashboard.__pxlManual0066=true;

  const oldSwitchDashSub=window.switchDashSub;
  if(typeof oldSwitchDashSub==='function'){
    window.switchDashSub=function(sub,btn){
      const before=window.PXL_DB4?.loadShared;
      if(before){
        const saved=window.PXL_DB4.loadShared;
        window.PXL_DB4.loadShared=()=>Promise.resolve(null);
        try{return oldSwitchDashSub.apply(this,arguments);}finally{window.PXL_DB4.loadShared=saved;}
      }
      return oldSwitchDashSub.apply(this,arguments);
    };
  }

  document.addEventListener('DOMContentLoaded',installDashboardRefresh);
  setTimeout(installDashboardRefresh,0);
  setTimeout(installDashboardRefresh,750);
  setTimeout(installDashboardRefresh,1800);

  window.PXL_URG_0066={revision:REV,manual:true,getLastRefresh:()=>lastRefreshAt,refresh:async()=>networkDashboardLoader&&networkDashboardLoader()};
})();
