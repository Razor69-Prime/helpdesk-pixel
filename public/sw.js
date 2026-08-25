const CACHE='pixelapps-inv1-v70';
const CORE=['/','/index.html','/track.html','/manifest.json','/pixel-solusindo-logo.png','/icons/icon-192.png','/icons/icon-512.png','/pxl-ui-0022-mobile-cleanup.css','/pxl-ui-0023-kanban-mobile-compact.css','/pxl-urg-0010-wo-autonumber.js','/pxl-urg-0024-dashboard-kpi-role-access.js'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));
  self.clients.claim();
});

async function staleWhileRevalidate(request){
  const cache=await caches.open(CACHE);
  const cached=await cache.match(request);
  const network=fetch(request).then(response=>{
    if(response&&response.ok) cache.put(request,response.clone()).catch(()=>{});
    return response;
  }).catch(()=>null);
  return cached || (await network) || Response.error();
}

async function navigationNetworkFirst(request){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(request);
    if(response&&response.ok) cache.put(request,response.clone()).catch(()=>{});
    return response;
  }catch(_){
    return (await cache.match(request)) || (await cache.match('/index.html')) || Response.error();
  }
}

async function indexHtml(request){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(!response.ok)return response;
    let html=await response.text();
    const uiTag='<link rel="stylesheet" href="/pxl-ui-0022-mobile-cleanup.css?v=PXL-UI-0022">';
    const woTag='<script src="/pxl-urg-0010-wo-autonumber.js?v=PXL-URG-0014"></script>';
    const dashKpiTag='<script src="/pxl-urg-0024-dashboard-kpi-role-access.js?v=PXL-URG-0024"></script>';
    if(!html.includes('/pxl-ui-0022-mobile-cleanup.css')) html=html.replace('</head>',uiTag+'\n</head>');
    if(!html.includes('/pxl-urg-0010-wo-autonumber.js')) html=html.replace('</body>',woTag+'\n</body>');
    if(!html.includes('/pxl-urg-0024-dashboard-kpi-role-access.js')) html=html.replace('</body>',dashKpiTag+'\n</body>');
    const headers=new Headers(response.headers);
    headers.delete('content-length');
    headers.set('Cache-Control','no-store, max-age=0');
    return new Response(html,{status:response.status,statusText:response.statusText,headers});
  }catch(_){
    return navigationNetworkFirst(request);
  }
}

async function invoiceHtml(request){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(!response.ok)return response;
    const html=(await response.text()).replace('<small style="display:block;color:#777">PXL-STG-0008A28</small>','');
    const headers=new Headers(response.headers);
    headers.delete('content-length');
    return new Response(html,{status:response.status,statusText:response.statusText,headers});
  }catch(_){
    return navigationNetworkFirst(request);
  }
}

async function salesOrderHtml(request){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(!response.ok)return response;
    let html=await response.text();
    const workDateTag='<script src="/pxl-urg-0020-sales-order-work-date.js?v=PXL-URG-0020"></script>';
    const dedupeTag='<script src="/pxl-urg-0021e-dedupe.js?v=PXL-URG-0021E"></script>';
    if(!html.includes('/pxl-urg-0020-sales-order-work-date.js')) html=html.replace('</body>',workDateTag+'\n</body>');
    if(!html.includes('/pxl-urg-0021e-dedupe.js')) html=html.replace('</body>',dedupeTag+'\n</body>');
    const headers=new Headers(response.headers);
    headers.delete('content-length');
    headers.set('Cache-Control','no-store, max-age=0');
    return new Response(html,{status:response.status,statusText:response.statusText,headers});
  }catch(_){
    return navigationNetworkFirst(request);
  }
}

async function kanbanHtml(request){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(!response.ok)return response;
    let html=await response.text();
    const compactTag='<link rel="stylesheet" href="/pxl-ui-0023-kanban-mobile-compact.css?v=PXL-UI-0023">';
    if(!html.includes('/pxl-ui-0023-kanban-mobile-compact.css')) html=html.replace('</head>',compactTag+'\n</head>');
    const headers=new Headers(response.headers);
    headers.delete('content-length');
    headers.set('Cache-Control','no-store, max-age=0');
    return new Response(html,{status:response.status,statusText:response.statusText,headers});
  }catch(_){
    return navigationNetworkFirst(request);
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);

  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/uploads/')) return;

  if(url.pathname==='/invoice-v1-a16.html'){
    event.respondWith(invoiceHtml(request));
    return;
  }

  if(url.pathname==='/sales-order.html'){
    event.respondWith(salesOrderHtml(request));
    return;
  }

  if(url.pathname==='/kanban.html'){
    event.respondWith(kanbanHtml(request));
    return;
  }

  if(url.pathname==='/'||url.pathname==='/index.html'){
    event.respondWith(indexHtml(request));
    return;
  }

  if(request.mode==='navigate'||url.pathname.endsWith('.html')){
    event.respondWith(navigationNetworkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
