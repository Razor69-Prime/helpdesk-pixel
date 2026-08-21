const CACHE='pixelapps-db2-v61';
const CORE=['/','/index.html','/track.html','/manifest.json','/pixel-solusindo-logo.png','/icons/icon-192.png','/icons/icon-512.png'];

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

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);

  // API dan upload harus selalu fresh dan tidak ditahan service-worker cache.
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/uploads/')) return;

  // HTML/navigation tetap network-first agar deploy terbaru segera terambil.
  if(request.mode==='navigate'||url.pathname==='/'||url.pathname.endsWith('.html')){
    event.respondWith(navigationNetworkFirst(request));
    return;
  }

  // JS/CSS/image/font/manifest: tampilkan cache seketika, refresh di background.
  event.respondWith(staleWhileRevalidate(request));
});
