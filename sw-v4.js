const CACHE_NAME="sbs-hq-v12-hero-manager";
const ASSETS=["./","./index.html","./styles-v6.css?v=hero-manager","./app-v10.js?v=hero-manager","./manifest.json?v=sbs-hq-icon","./spaceboi-logo.png","./apple-touch-icon.png?v=sbs-hq-icon","./icon-192.png","./icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)))});
