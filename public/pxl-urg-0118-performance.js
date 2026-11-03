/* PXL-URG-0118 — module response optimization + 5 minute notifications + dashboard auto-load. */
(()=>{
  'use strict';
  const REV='PXL-URG-0118';
  const NOTIF_MS=5*60*1000;
  const CACHE_MS=60*1000;
  const cache=new Map(),pending=new Map();
  const cacheable=new Set(['/projects','/project-report-summaries','/purchase-requests','/material-requests-form','/sales-performance/bootstrap','/crm/customers','/sales-orders','/sales-visits','/crm/invoices','/invoices/standalone']);
  const clone=v=>{try{return JSON.parse(JSON.stringify(v));}catch(_){return v;}};
  const clear=()=>{cache.clear();pending.clear();};

  const priorApi=typeof window.api==='function'?window.api:null;
  if(priorApi&&!priorApi.__pxl0118){
    const optimized=async function(method,path){
      const m=String(method||'GET').toUpperCase(),p=String(path||'');
      if(m!=='GET'){clear();return priorApi.apply(this,arguments);}
      if(!cacheable.has(p))return priorApi.apply(this,arguments);
      const hit=cache.get(p);
      if(hit&&Date.now()-hit.at<CACHE_MS)return clone(hit.data);
      if(pending.has(p))return pending.get(p).then(clone);
      const ctx=this,args=arguments;
      const run=Promise.resolve(priorApi.apply(ctx,args)).then(data=>{cache.set(p,{at:Date.now(),data:clone(data)});return data;}).finally(()=>pending.delete(p));
      pending.set(p,run);return run.then(clone);
    };
    optimized.__pxl0118=true;
    window.api=optimized;
  }

  async function hydrateMr(id){
    if(!id||typeof window.api!=='function')return null;
    const full=await window.api('GET','/material-requests-form/'+encodeURIComponent(id)+'/detail');
    try{if(typeof mrData!=='undefined'&&Array.isArray(mrData)){const i=mrData.findIndex(x=>String(x.id)===String(id));if(i>=0)mrData[i]=full;}}
    catch(_){}
    return full;
  }
  const oldShow=window.showMRForm;
  if(typeof oldShow==='function'&&!oldShow.__pxl0118){window.showMRForm=async function(id){if(id){try{await hydrateMr(id);}catch(e){console.warn(REV+' MR detail',e);}}return oldShow.apply(this,arguments);};window.showMRForm.__pxl0118=true;}
  const oldPdf=window.exportMRPDF;
  if(typeof oldPdf==='function'&&!oldPdf.__pxl0118){window.exportMRPDF=async function(id){if(id){try{await hydrateMr(id);}catch(e){console.warn(REV+' MR PDF detail',e);}}return oldPdf.apply(this,arguments);};window.exportMRPDF.__pxl0118=true;}

  function canPoll(){try{return typeof currentUser!=='undefined'&&!!currentUser&&!document.hidden;}catch(_){return false;}}
  window.startNotifPolling=function(){
    try{if(typeof notifPollTimer!=='undefined')clearInterval(notifPollTimer);}catch(_){}
    try{if(canPoll()&&typeof loadNotifications==='function')loadNotifications();}catch(_){}
    try{notifPollTimer=setInterval(()=>{if(canPoll()&&typeof loadNotifications==='function')loadNotifications();},NOTIF_MS);}catch(_){}
  };

  async function autoDashboard(){
    try{window.PXL_URG_0067?.allowDashboardRefresh?.();}catch(_){}
    if(window.PXL_URG_0066?.refresh)return window.PXL_URG_0066.refresh();
    return null;
  }
  window.loadDashboard=autoDashboard;
  function dashboardUi(){
    const bar=document.getElementById('pxl-dashboard-manual-refresh');
    if(bar){const span=bar.querySelector('span');if(span)span.innerHTML='Dashboard memuat data otomatis saat dibuka. <b>Refresh</b> tetap tersedia untuk pembaruan manual.';}
  }
  setTimeout(()=>{try{window.startNotifPolling();}catch(_){}dashboardUi();if(document.getElementById('tab-dashboard')?.classList.contains('active'))autoDashboard().catch(()=>{});},800);
  window.PXL_URG_0118={revision:REV,notificationPollMs:NOTIF_MS,cacheMs:CACHE_MS,clearCache:clear,hydrateMr,autoDashboard};
})();