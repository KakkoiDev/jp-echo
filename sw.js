const CACHE="jp-echo-v18";
const ASSETS=["./","./index.html","./styles.css","./app.js","./anki-export.js","./srs.js","./vendor/sql-wasm.wasm","./core.js","./diff.js","./db.js","./api.js","./speech.js","./manifest.webmanifest","./icon.svg","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./apple-touch-icon.png","./favicon.ico","./mask-icon.svg"];

self.addEventListener("install",event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())
));

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
  // Deliberately outside waitUntil. A navigation is served by this worker's own
  // fetch handler, and fetch events are not dispatched while the worker is
  // still activating — so awaiting the reload here waits on a request that is
  // waiting on us, and every open page hangs until the tab is killed.
  reloadClients();
});

async function reloadClients(){
  const clients=await self.clients.matchAll({type:"window"});
  await Promise.all(clients.map(client=>client.navigate(client.url).catch(()=>{})));
}

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
