const CACHE="jp-echo-v125";
const PREFS_CACHE="jp-echo-prefs",PREFS_KEY="./reminder",REMINDER_TAG="echo-due";
const ASSETS=["./","./index.html","./404.html","./styles.css","./styles.css?v=96","./app.js","./components.js","./actions.js","./routes.js","./anki-export.js","./srs.js","./review-modes.js","./vendor/sql-wasm.wasm","./core.js","./catalogues.js","./mini-imports.js","./imports.js","./diff.js","./reminders.js","./db.js","./api.js","./speech.js","./repair.js","./kanji.js","./kanji-data.js","./kanji-readings.js","./grammar.js","./grammar-spans.js","./grammar-data.js","./lookup.js","./notes.js","./stories.js","./words.js","./japanese-words.js","./words-data.js","./i18n.js","./i18n/ja.js","./manifest.webmanifest","./icon.svg","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./apple-touch-icon.png","./favicon.ico","./mask-icon.svg"];

self.addEventListener("install",event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(path=>new Request(path,{cache:"reload"})))).then(()=>self.skipWaiting())
));

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith("jp-echo-v")&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

// Serve one complete installed version. Mixing live app.js with a cached API
// module can prevent startup; upgrades replace the whole pre-cached shell.
self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=="GET"||url.origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const route=/^\/(?:$|index\.html$|(?:sentences|words|kanji|grammar)(?:\/|$)|(?:review|library|mora|setup|onboard|reading|discussion)\/?$)/.test(url.pathname);
    if(event.request.mode==="navigate"&&route){const shell=await cache.match("./index.html");if(shell)return shell}
    const asset=ASSETS.some(path=>new URL(path,self.registration.scope).pathname===url.pathname);
    if(asset){const installed=await cache.match(event.request,{ignoreSearch:true});if(installed)return installed}
    try{const response=await fetch(event.request);if(response.ok)return response;
      const cached=await cache.match(event.request,{ignoreSearch:true});return cached||response;
    }catch(error){const cached=await cache.match(event.request,{ignoreSearch:true});if(cached)return cached;throw error}
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
    return self.clients.openWindow("./review");
  })());
});
