export const SETTINGS_PAGES=Object.freeze(["ai","speech","backup","import","export","grammar"]);
const enc=value=>encodeURIComponent(String(value));
const dec=value=>decodeURIComponent(value);

export function routeFor(state={}){
  const view=state.view||"practice";
  let path="/";
  if(state.modal?.kind==="word")path="/words/"+enc(state.modal.id);
  else if(state.modal?.kind==="kanji")path="/kanji/"+enc(state.modal.id);
  else if(state.modal?.kind==="grammar")path="/grammar/"+enc(state.modal.id);
  else if(view==="sentence"&&state.sentenceId)path="/sentences/"+enc(state.sentenceId);
  else if(view==="review"||view==="session")path="/review";
  else if(view==="library")path="/library";
  else if(view==="map")path=state.mapView==="words"?"/words":state.mapView==="grammar"?"/grammar":"/kanji";
  else if(view==="mora")path="/mora";
  else if(view==="radio")path="/radio";
  else if(view==="notes")path="/words";
  else if(view==="search")path="/search";
  // Settings is a page with two sub-pages for what lives only on this device.
  else if(view==="settings")path=SETTINGS_PAGES.includes(state.settingsPage)?"/settings/"+state.settingsPage:"/settings";
  else if(view==="setup")path="/setup";
  else if(view==="onboard")path="/onboard";
  else if(state.extractMode)path="/extract";
  else if(state.readingMode)path="/reading";
  else if(state.discussionMode)path="/discussion";
  const q=new URLSearchParams();
  if(path==="/library"){if(state.historyQuery)q.set("q",state.historyQuery);if(state.historyFilter&&state.historyFilter!=="all")q.set("filter",state.historyFilter);if(state.historyOrder&&state.historyOrder!=="created")q.set("order",state.historyOrder);if(state.historyDirection&&state.historyDirection!=="desc")q.set("direction",state.historyDirection)}
  // Mora sections: Base is the plain /mora; the others carry ?section=.
  if(path==="/mora"&&["voiced","combined","specials"].includes(state.moraSection))q.set("section",state.moraSection);
  // One search for sentences, words and kanji; the query survives reload.
  if(view==="search"&&state.searchQuery)q.set("q",state.searchQuery);
  // Echo's notes is the Words wall filtered to the words with a note.
  if(view==="notes")q.set("notes","1");
  if(["/words","/kanji","/grammar"].includes(path)&&state.mapQuery&&view!=="notes")q.set("q",state.mapQuery);
  // Group by: JLPT level is the default wall; Meaning groups the same cells by family topic.
  if(path==="/kanji"&&state.kanjiGroup==="meaning")q.set("group","meaning");
  return path+(q.size?"?"+q:"");
}

export function parseRoute(input){
  const url=input instanceof URL?input:new URL(input,"https://echo.local");
  const p=url.pathname.replace(/\/+$/,"")||"/",q=url.searchParams;
  const base={view:"practice",discussionMode:false,modal:null};
  if(p==="/")return base;
  if(p==="/discussion")return {...base,discussionMode:true};
  if(p==="/reading")return {...base,readingMode:true};
  if(p==="/extract")return {...base,extractMode:true};
  if(p==="/review")return {...base,view:"review"};
  if(p==="/mora")return {...base,view:"mora",moraSection:["voiced","combined","specials"].includes(q.get("section"))?q.get("section"):"base"};
  if(p==="/radio")return {...base,view:"radio"};
  if(p==="/search")return {...base,view:"search",searchQuery:q.get("q")||""};
  if(p==="/settings")return {...base,view:"settings",settingsPage:"main"};
  { const sm=p.match(/^\/settings\/([a-z]+)$/);if(sm)return SETTINGS_PAGES.includes(sm[1])?{...base,view:"settings",settingsPage:sm[1]}:{...base,notFound:true}; }
  if(p==="/library")return {...base,view:"library",historyQuery:q.get("q")||"",historyFilter:q.get("filter")||"all",historyOrder:q.get("order")||"created",historyDirection:q.get("direction")||"desc"};
  if(p==="/setup")return {...base,view:"setup"};
  if(p==="/onboard")return {...base,view:"onboard"};
  let m=p.match(/^\/sentences\/([^/]+)$/);if(m)return {...base,view:"sentence",sentenceId:dec(m[1])};
  m=p.match(/^\/(words|kanji|grammar)\/([^/]+)$/);if(m)return {...base,view:"map",mapView:m[1]==="words"?"words":m[1]==="grammar"?"grammar":"kanji",modal:{kind:m[1]==="words"?"word":m[1],id:dec(m[2])}};
  if(p==="/words"&&q.get("notes")==="1")return {...base,view:"notes"};
  m=p.match(/^\/(words|kanji|grammar)$/);if(m)return {...base,view:"map",mapView:m[1]==="words"?"words":m[1]==="grammar"?"grammar":"kanji",mapQuery:q.get("q")||"",...(m[1]==="kanji"?{kanjiGroup:q.get("group")==="meaning"?"meaning":"jlpt"}:{})};
  return {...base,notFound:true};
}
