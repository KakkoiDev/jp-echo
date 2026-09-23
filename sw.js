const CACHE="jp-echo-v38";
const PREFS_CACHE="jp-echo-prefs",PREFS_KEY="./reminder",REMINDER_TAG="echo-due";
const ASSETS=["./","./index.html","./styles.css","./app.js","./anki-export.js","./srs.js","./vendor/sql-wasm.wasm","./core.js","./diff.js","./reminders.js","./db.js","./api.js","./speech.js","./manifest.webmanifest","./icon.svg","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./apple-touch-icon.png","./favicon.ico","./mask-icon.svg"];

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

// Reminders. Echo has no server, so this is the only background path there is:
// the browser wakes the worker now and then while the app is installed, and we
// check whether anything is due. Everywhere else app.js checks on open.
// isDueRecord and shouldRemind mirror reminders.js, which cannot be imported
// into a classic worker; test/reminders.test.js pins both rules.
const isDueRecord=(sentence,now)=>!sentence?.srs?.due||Date.parse(sentence.srs.due)<=now;

function reminderMoment(time,now){
  const [hours,minutes]=String(time||"20:00").split(":").map(Number);
  const moment=new Date(now);
  moment.setHours(Number.isFinite(hours)?hours:20,Number.isFinite(minutes)?minutes:0,0,0);
  return moment.getTime();
}

function shouldRemind({enabled,time,lastShownAt,due,now}){
  if(!enabled||due<1)return false;
  const moment=reminderMoment(time,now);
  return now>=moment&&(!lastShownAt||Number(lastShownAt)<moment);
}

async function readPrefs(){
  try{const cache=await caches.open(PREFS_CACHE),response=await cache.match(PREFS_KEY);return response?await response.json():null}catch{return null}
}

async function writePrefs(prefs){
  try{const cache=await caches.open(PREFS_CACHE);
    await cache.put(PREFS_KEY,new Response(JSON.stringify(prefs),{headers:{"Content-Type":"application/json"}}))}catch{}
}

function readSentences(){
  return new Promise(resolve=>{
    let request;
    try{request=indexedDB.open("jp-echo")}catch{return resolve([])}
    request.onerror=()=>resolve([]);
    request.onsuccess=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains("sentences")){db.close();return resolve([])}
      const all=db.transaction("sentences","readonly").objectStore("sentences").getAll();
      all.onsuccess=()=>{resolve(all.result||[]);db.close()};
      all.onerror=()=>{resolve([]);db.close()};
    };
  });
}

async function remindIfDue(){
  const prefs=await readPrefs();
  if(!prefs?.enabled)return;
  const now=Date.now();
  const due=(await readSentences()).filter(sentence=>isDueRecord(sentence,now)).length;
  if(!shouldRemind({enabled:true,time:prefs.time,lastShownAt:prefs.lastShownAt,due,now}))return;
  await self.registration.showNotification("Echo",{
    body:due===1?"One sentence is due.":due+" sentences are due.",
    tag:REMINDER_TAG,icon:"./icon-192.png",badge:"./icon-192.png",data:{view:"review"}});
  await writePrefs({...prefs,lastShownAt:now});
}

self.addEventListener("periodicsync",event=>{
  if(event.tag===REMINDER_TAG)event.waitUntil(remindIfDue());
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const clients=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of clients)if(client.url.includes(self.registration.scope))return client.focus();
    return self.clients.openWindow("./?view=review");
  })());
});
