/* PXL-STG-0020 — Final Optimization. STAGING ONLY. */
window.PXL_STG_0020={revision:'PXL-STG-0020',baseline:'PXL-STG-0019-STABLE',productionTouched:false};

// PXL-URG-0067 — demand-driven dashboard/invoice egress guard.
(function(){
  'use strict';
  const REV='PXL-URG-0067';
  const INVOICE_CACHE_MS=5*60*1000;
  const DASHBOARD_ALLOW_MS=2*60*1000;
  let invoiceCache=null;
  let invoiceCacheAt=0;
  let invoicePending=null;
  let invoiceAllowUntil=0;
  let dashboardAllowUntil=0;

  const now=()=>Date.now();
  const tabActive=id=>!!document.getElementById(id)?.classList?.contains('active');
  const allowInvoice=()=>now()<invoiceAllowUntil || tabActive('tab-piutang-v1');
  const allowDashboard=()=>now()<dashboardAllowUntil;
  const jsonResponse=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','X-PXL-Egress-Cache':REV}});
  const cloneData=data=>JSON.parse(JSON.stringify(data??[]));

  function filterInvoiceRows(rows,url){
    const status=url.searchParams.get('status');
    if(!status) return rows;
    return (Array.isArray(rows)?rows:[]).filter(row=>String(row?.invoice_status||'')===status);
  }
  function invalidateInvoiceCache(){invoiceCache=null;invoiceCacheAt=0;invoicePending=null;}
  function dashboardFallback(path){
    try{
      if(path==='/sales-visits') return typeof kunjunganData!=='undefined'&&Array.isArray(kunjunganData)?kunjunganData:[];
      if(path==='/material-requests') return typeof dashMRData!=='undefined'&&Array.isArray(dashMRData)?dashMRData:[];
      if(path==='/purchase-requests') return typeof dashPRData!=='undefined'&&Array.isArray(dashPRData)?dashPRData:(typeof prData!=='undefined'&&Array.isArray(prData)?prData:[]);
      if(path==='/projects') return typeof dashProjectData!=='undefined'&&Array.isArray(dashProjectData)?dashProjectData:[];
      if(path==='/invoices/standalone') return typeof standaloneInvoices!=='undefined'&&Array.isArray(standaloneInvoices)?standaloneInvoices:[];
      if(path==='/sales-targets') return typeof salesTargets!=='undefined'&&Array.isArray(salesTargets)?salesTargets:[];
    }catch(_){}
    return [];
  }
  const dashboardPaths=new Set(['/sales-visits','/material-requests','/purchase-requests','/projects','/invoices/standalone','/sales-targets']);

  const nativeApi=typeof window.api==='function'?window.api:null;
  if(nativeApi&&!nativeApi.__pxl0067){
    const guardedApi=async function(method,path){
      const m=String(method||'GET').toUpperCase();
      const p=String(path||'');
      if(m==='GET'&&dashboardPaths.has(p)&&tabActive('tab-dashboard')&&!allowDashboard()) return dashboardFallback(p);
      return nativeApi.apply(this,arguments);
    };
    guardedApi.__pxl0067=true;
    window.api=guardedApi;
  }

  const nativeFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    let url;
    try{url=new URL(typeof input==='string'?input:input.url,location.origin);}catch(_){return nativeFetch(input,init);}
    const method=String(init?.method||(typeof input!=='string'&&input.method)||'GET').toUpperCase();
    if(url.pathname!=='/api/invoice-v1') return nativeFetch(input,init);
    if(method!=='GET'){
      invalidateInvoiceCache();
      return nativeFetch(input,init);
    }
    if(!allowInvoice()){
      const stale=Array.isArray(invoiceCache)?filterInvoiceRows(cloneData(invoiceCache),url):[];
      return jsonResponse(stale);
    }
    if(Array.isArray(invoiceCache)&&now()-invoiceCacheAt<INVOICE_CACHE_MS) return jsonResponse(filterInvoiceRows(cloneData(invoiceCache),url));
    if(!invoicePending){
      const options={...(init||{})};
      options.method='GET';
      invoicePending=(async()=>{
        const r=await nativeFetch('/api/invoice-v1',options);
        const data=await r.clone().json().catch(()=>null);
        if(!r.ok||!Array.isArray(data)) return {ok:false,response:r};
        invoiceCache=cloneData(data);invoiceCacheAt=now();
        return {ok:true,data:invoiceCache};
      })().finally(()=>{invoicePending=null;});
    }
    const result=await invoicePending;
    if(!result.ok) return result.response;
    return jsonResponse(filterInvoiceRows(cloneData(result.data),url));
  };
  window.fetch.__pxl0067=true;

  const oldSales=window.loadSalesDashboard;
  if(typeof oldSales==='function'&&!oldSales.__pxl0067){
    const guardedSales=async function(){invoiceAllowUntil=now()+DASHBOARD_ALLOW_MS;return oldSales.apply(this,arguments);};
    guardedSales.__pxl0067=true;
    window.loadSalesDashboard=guardedSales;
  }

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#pxl-dashboard-refresh-btn')){
      dashboardAllowUntil=now()+DASHBOARD_ALLOW_MS;
      invoiceAllowUntil=now()+DASHBOARD_ALLOW_MS;
    }
  },true);

  window.PXL_URG_0067={
    revision:REV,
    invoiceCacheMs:INVOICE_CACHE_MS,
    allowDashboardRefresh:()=>{dashboardAllowUntil=now()+DASHBOARD_ALLOW_MS;invoiceAllowUntil=now()+DASHBOARD_ALLOW_MS;},
    allowInvoiceRefresh:()=>{invoiceAllowUntil=now()+DASHBOARD_ALLOW_MS;},
    invalidateInvoiceCache,
    getInvoiceCacheAge:()=>invoiceCacheAt?now()-invoiceCacheAt:null
  };
})();

// PXL-URG-0068A — deduplicate burst GET /tickets requests.
// Satu request Supabase ticket membawa invoices + status_history + job_stages,
// jadi mencegah request identik berdekatan langsung mengurangi seluruh relation burst.
(function(){
  'use strict';
  const REV='PXL-URG-0068A';
  const COOLDOWN_MS=8*1000;
  let ticketCache=null;
  let ticketCacheAt=0;
  let ticketPending=null;
  let forceUntil=0;

  const now=()=>Date.now();
  const clone=data=>JSON.parse(JSON.stringify(data??[]));
  const invalidate=()=>{ticketCache=null;ticketCacheAt=0;};

  const previousApi=typeof window.api==='function'?window.api:null;
  if(previousApi&&!previousApi.__pxl0068a){
    const optimizedApi=async function(method,path){
      const m=String(method||'GET').toUpperCase();
      const p=String(path||'');

      if(m==='GET'&&p==='/tickets'){
        const force=now()<forceUntil;
        if(!force&&ticketPending) return ticketPending.then(clone);
        if(!force&&Array.isArray(ticketCache)&&now()-ticketCacheAt<COOLDOWN_MS) return clone(ticketCache);

        const run=Promise.resolve(previousApi.apply(this,arguments)).then(data=>{
          if(Array.isArray(data)){
            ticketCache=clone(data);
            ticketCacheAt=now();
          }
          return data;
        });
        ticketPending=run.finally(()=>{ticketPending=null;});
        return ticketPending.then(clone);
      }

      if(m!=='GET'&&p.startsWith('/tickets')){
        invalidate();
        const result=await previousApi.apply(this,arguments);
        invalidate();
        return result;
      }

      return previousApi.apply(this,arguments);
    };
    optimizedApi.__pxl0068a=true;
    window.api=optimizedApi;
  }

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#pxl-ticket-refresh-btn')){
      forceUntil=now()+3000;
      invalidate();
    }
  },true);

  window.PXL_URG_0068A={
    revision:REV,
    cooldownMs:COOLDOWN_MS,
    invalidateTicketCache:invalidate,
    forceNextTicketRefresh:()=>{forceUntil=now()+3000;invalidate();},
    getTicketCacheAge:()=>ticketCacheAt?now()-ticketCacheAt:null
  };
})();
