const CACHE_NAME="sbs-hq-v13-large-photo-shoot-options";
const ASSETS=["./","./index.html","./styles-v7.css?v=large-photo-shoot-options","./app-v11.js?v=large-photo-shoot-options","./manifest.json?v=sbs-hq-icon","./spaceboi-logo.png","./apple-touch-icon.png?v=sbs-hq-icon","./icon-192.png","./icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)))});
