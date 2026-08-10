const CACHE='helpdesk-v57';
const ASSETS=['/','/index.html','/track.html','/manifest.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{if(e.request.url.includes('/api/')||e.request.url.includes('/uploads/')) return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));});
