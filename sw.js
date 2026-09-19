const CACHE="jp-echo-v5";
const ASSETS=["./","./index.html","./styles.css","./updates.css","./app.js","./core.js","./db.js","./api.js","./speech.js","./manifest.webmanifest","./icon.svg"];

self.addEventListener("install",event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())
));

self.addEventListener("activate",event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
  const clients=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  await Promise.all(clients.map(client=>client.navigate(client.url)));
})()));

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET"||!event.request.url.startsWith(self.location.origin))return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(event.request);
      if(response.ok){const cache=await caches.open(CACHE);cache.put(event.request,response.clone())}
      return response;
    }catch(error){
      const cached=await caches.match(event.request,{ignoreSearch:true});
      if(cached)return cached;
      if(event.request.mode==="navigate")return caches.match("./index.html");
      throw error;
    }
  })());
});
