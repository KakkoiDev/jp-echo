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
  else if(view==="setup")path="/setup";
  else if(view==="onboard")path="/onboard";
  else if(state.discussionMode)path="/discussion";
  const q=new URLSearchParams();
  if(path==="/library"){if(state.historyQuery)q.set("q",state.historyQuery);if(state.historyFilter&&state.historyFilter!=="all")q.set("filter",state.historyFilter);if(state.historyOrder&&state.historyOrder!=="created")q.set("order",state.historyOrder);if(state.historyDirection&&state.historyDirection!=="desc")q.set("direction",state.historyDirection)}
  if(["/words","/kanji","/grammar"].includes(path)&&state.mapQuery)q.set("q",state.mapQuery);
  return path+(q.size?"?"+q:"");
}

export function parseRoute(input){
  const url=input instanceof URL?input:new URL(input,"https://echo.local");
  const p=url.pathname.replace(/\/+$/,"")||"/",q=url.searchParams;
  const base={view:"practice",discussionMode:false,modal:null};
  if(p==="/")return base;
  if(p==="/discussion")return {...base,discussionMode:true};
  if(p==="/review")return {...base,view:"review"};
  if(p==="/library")return {...base,view:"library",historyQuery:q.get("q")||"",historyFilter:q.get("filter")||"all",historyOrder:q.get("order")||"created",historyDirection:q.get("direction")||"desc"};
  if(p==="/setup")return {...base,view:"setup"};
  if(p==="/onboard")return {...base,view:"onboard"};
  let m=p.match(/^\/sentences\/([^/]+)$/);if(m)return {...base,view:"sentence",sentenceId:dec(m[1])};
  m=p.match(/^\/(words|kanji|grammar)\/([^/]+)$/);if(m)return {...base,view:"map",mapView:m[1]==="words"?"words":m[1]==="grammar"?"grammar":"kanji",modal:{kind:m[1]==="words"?"word":m[1],id:dec(m[2])}};
  m=p.match(/^\/(words|kanji|grammar)$/);if(m)return {...base,view:"map",mapView:m[1]==="words"?"words":m[1]==="grammar"?"grammar":"kanji",mapQuery:q.get("q")||""};
  return {...base,notFound:true};
}
