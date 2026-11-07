const CACHE="jp-echo-v219";
const PREFS_CACHE="jp-echo-prefs",PREFS_KEY="./reminder",REMINDER_TAG="echo-due";
const ASSETS=["./","./index.html","./404.html","./styles.css","./styles.css?v=170","./app.js","./components.js","./actions.js","./routes.js","./anki-export.js","./srs.js","./review-modes.js","./review-speech.js","./vendor/sql-wasm.wasm","./core.js","./japanese-readings.js","./readings.js","./catalogues.js","./references.js","./text-extraction.js","./epub-import.js","./mini-imports.js","./imports.js","./gist-backup.js","./diff.js","./reminders.js","./db.js","./api.js","./speech.js","./radio.js","./mora-pictures.js","./mora-drill.js","./anchors/a.png","./anchors-dark/a.png","./anchors/i.png","./anchors-dark/i.png","./anchors/u.png","./anchors-dark/u.png","./anchors/e.png","./anchors-dark/e.png","./anchors/o.png","./anchors-dark/o.png","./anchors/ka.png","./anchors-dark/ka.png","./anchors/ki.png","./anchors-dark/ki.png","./anchors/ku.png","./anchors-dark/ku.png","./anchors/ke.png","./anchors-dark/ke.png","./anchors/ko.png","./anchors-dark/ko.png","./anchors/sa.png","./anchors-dark/sa.png","./anchors/shi.png","./anchors-dark/shi.png","./anchors/su.png","./anchors-dark/su.png","./anchors/se.png","./anchors-dark/se.png","./anchors/so.png","./anchors-dark/so.png","./anchors/ta.png","./anchors-dark/ta.png","./anchors/chi.png","./anchors-dark/chi.png","./anchors/tsu.png","./anchors-dark/tsu.png","./anchors/te.png","./anchors-dark/te.png","./anchors/to.png","./anchors-dark/to.png","./anchors/na.png","./anchors-dark/na.png","./anchors/ni.png","./anchors-dark/ni.png","./anchors/nu.png","./anchors-dark/nu.png","./anchors/ne.png","./anchors-dark/ne.png","./anchors/no.png","./anchors-dark/no.png","./anchors/ha.png","./anchors-dark/ha.png","./anchors/hi.png","./anchors-dark/hi.png","./anchors/fu.png","./anchors-dark/fu.png","./anchors/he.png","./anchors-dark/he.png","./anchors/ho.png","./anchors-dark/ho.png","./anchors/ma.png","./anchors-dark/ma.png","./anchors/mi.png","./anchors-dark/mi.png","./anchors/mu.png","./anchors-dark/mu.png","./anchors/me.png","./anchors-dark/me.png","./anchors/mo.png","./anchors-dark/mo.png","./anchors/ya.png","./anchors-dark/ya.png","./anchors/yu.png","./anchors-dark/yu.png","./anchors/yo.png","./anchors-dark/yo.png","./anchors/ra.png","./anchors-dark/ra.png","./anchors/ri.png","./anchors-dark/ri.png","./anchors/ru.png","./anchors-dark/ru.png","./anchors/re.png","./anchors-dark/re.png","./anchors/ro.png","./anchors-dark/ro.png","./anchors/wa.png","./anchors-dark/wa.png","./anchors/wo.png","./anchors-dark/wo.png","./anchors/n.png","./anchors-dark/n.png","./anchors/kya.png","./anchors-dark/kya.png","./anchors/kyu.png","./anchors-dark/kyu.png","./anchors/kyo.png","./anchors-dark/kyo.png","./anchors/sha.png","./anchors-dark/sha.png","./anchors/shu.png","./anchors-dark/shu.png","./anchors/sho.png","./anchors-dark/sho.png","./anchors/cha.png","./anchors-dark/cha.png","./anchors/chu.png","./anchors-dark/chu.png","./anchors/cho.png","./anchors-dark/cho.png","./anchors/nyu.png","./anchors-dark/nyu.png","./anchors/hya.png","./anchors-dark/hya.png","./anchors/hyo.png","./anchors-dark/hyo.png","./anchors/ryu.png","./anchors-dark/ryu.png","./anchors/ryo.png","./anchors-dark/ryo.png","./repair.js","./kanji.js","./kanji-families.js","./decks/kanji-families-curriculum.json","./kanji-data.js","./kanji-readings.js","./grammar.js","./grammar-spans.js","./grammar-data.js","./lookup.js","./notes.js","./stories.js","./words.js","./japanese-words.js","./words-data.js","./i18n.js","./i18n/ja.js","./manifest.webmanifest","./icon.svg","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./apple-touch-icon.png","./favicon.ico","./mask-icon.svg"];

// Keep an update waiting while existing clients use their installed version.
// Never skipWaiting: activation must not replace assets during an open session.
// Each file is fetched at an address unique to this version, so a CDN still
// holding the previous deploy cannot hand back a stale copy: a stale app.js
// next to a new core.js made "Importing a module script failed". Stored under
// its plain address. Any failure fails the whole install, so a version is
// complete or absent, never mixed.
//
// The stored response is rebuilt, not the fetched one: a fetched response
// remembers its address (…app.js?echo-cache=…), and Safari refuses a module
// whose response comes back from the worker under an address other than the
// one it asked for — "Importing a module script failed" on every start. A
// rebuilt response has no address, so the page's own request URL is used.
self.addEventListener("install",event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await Promise.all(ASSETS.map(async path=>{const url=new URL(path,self.registration.scope);url.searchParams.set("echo-cache",CACHE);
    const response=await fetch(new Request(url,{cache:"reload"}));if(!response.ok)throw new Error("Could not cache "+path+" ("+response.status+")");
    const body=await response.arrayBuffer();
    await cache.put(new Request(new URL(path,self.registration.scope)),new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers}))}));
})()));

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith("jp-echo-v")&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

// The one way a waiting version takes over while Echo is open: the person
// taps "Update now" (app.js), the page asks, and the page reloads itself after
// the switch. The worker never reloads or navigates anyone.
self.addEventListener("message",event=>{if(event.data==="echo:activate-update")self.skipWaiting()});

// Serve one complete installed version. Mixing live app.js with a cached API
// module can prevent startup; upgrades replace the whole pre-cached shell.
self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=="GET"||url.origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const route=/^\/(?:$|index\.html$|(?:sentences|words|kanji|grammar)(?:\/|$)|(?:review|library|mora|mora\/drill|radio|search|setup|onboard|reading|discussion|extract)\/?$)/.test(url.pathname);
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
