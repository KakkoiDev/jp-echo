import {bookIds,bookName} from "./n2-forms.js";

export const prefix="echo-n2-mock-v1-";
const tables=["papers","history","recall"];
let connection;
function open() {
  if(!connection) connection=new Promise((resolve,reject)=>{
    const request=indexedDB.open("echo-n2-training",1);
    request.onupgradeneeded=()=>tables.forEach(name=>request.result.createObjectStore(name,{keyPath:"id"}));
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
  return connection;
}
export async function access(table,method,value) {
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(table,method==="put"?"readwrite":"readonly");
    const request=tx.objectStore(table)[method](value);
    tx.oncomplete=()=>resolve(request.result);
    tx.onabort=tx.onerror=()=>reject(tx.error);
  });
}
export function currentAttempts() {
  const result=[];
  for(const key of Object.keys(localStorage).filter(key=>key.startsWith(prefix))){
    const id=key.slice(prefix.length);
    const data=JSON.parse(localStorage.getItem(prefix+id)||"null");
    if(data && data.phase!=="ready") result.push({...data,book:id,id:data.id||"legacy-"+id});
  }
  return result;
}
export async function report() {
  const [papers,archived,recall]=await Promise.all(tables.map(t=>access(t,"getAll")));
  const attempts=new Map(archived.map(a=>[a.id,a]));
  currentAttempts().forEach(a=>attempts.set(a.id,a));
  return {schema:"echo.n2.study.v1",exportedAt:new Date().toISOString(),papers,attempts:[...attempts.values()],recall};
}
export function scored(data) {
  const papers=new Map(data.papers.map(p=>[p.id,p]));
  const rows=[];
  for(const a of data.attempts){
    const paper=papers.get(a.paper||a.book);
    if(!paper) continue;
    paper.questions.forEach((q,index)=>{
      if(a.phase!=="results" && (a.phase==="written" || q.skill===3)) return;
      rows.push({book:a.book,attemptId:a.id,paper:paper.id,index,skill:q.skill,target:q.target,dimension:q.dimension,context:q.context,
        correct:a.answers[index]===q.key,guessed:!!a.guesses[index],answered:!!a.answers[index],seconds:Math.round(a.time[index]/1000)});
    });
  }
  return rows;
}
function download(data) {
  const link=document.createElement("a");
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
  link.href=url;link.download="echo-n2-"+new Date().toISOString().slice(0,10)+".json";
  link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function activateProgress(inventory) {
  const el=id=>document.getElementById(id);
  let data=await report();
  let evidence=scored(data);
  let selected=null, revealed=false;
  for(const p of data.papers.filter(p=>p.id.startsWith("adaptive-"))){
    const line=document.createElement("p"),link=document.createElement("a");link.href="?book="+p.id;link.textContent=p.title+" · "+p.questions.length+" questions";line.append(link);el("adaptive-list").append(line);
  }
  el("adaptive").onclick=async()=>{
    const btn=el("adaptive");btn.disabled=true;
    try{const {generateAdaptive}=await import("./n2-adaptive.js");const paper=await generateAdaptive(s=>el("analysis").textContent=s);location.assign("?book="+paper.id);}
    catch(e){el("analysis").textContent=e.message;btn.disabled=false;}
  };
  const items={
    meaning:inventory.words.map(([w,r,m])=>({target:["word",w,r],prompt:w,answer:m})),
    reading:inventory.words.filter(([w,r])=>w!==r).map(([w,r,m])=>({target:["word",w,r],prompt:w,answer:r+" · "+m})),
    grammar:inventory.grammar.map(([id,name,hint])=>({target:["grammar",id],prompt:name,answer:hint||"Explain this construction and give an example. Verify the meaning in your grammar reference."}))
  };
  function showRecords(){
    if(!el("recall-log").open)return;
    const needle=el("recall-search").value.trim().toLowerCase();
    const list=el("recall-list");list.replaceChildren();
    const records=data.recall.filter(r=>r.dimension===el("dimension").value && [r.prompt,r.answer,r.last].join(" ").toLowerCase().includes(needle)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    if(!records.length)list.textContent="No matching checks.";
    for(const r of records){
      const row=document.createElement("li");
      row.textContent=r.prompt+" · "+r.last+" · "+r.checks+" checks · "+r.day;list.append(row);
    }
  }
  el("recall-log").ontoggle=el("recall-search").oninput=showRecords;
  function showStats(){
    showRecords();
    el("coverage").replaceChildren();
    for(const [type,list] of Object.entries(items)){
      const records=data.recall.filter(x=>x.dimension===type);
      const automatic=records.filter(x=>x.days?.length>=2 && x.last==="instant").length;
      const tested=new Set(evidence.filter(x=>x.dimension===(type==="grammar"?"meaning":type) && x.target?.[0]===(type==="grammar"?"grammar":"word") && x.answered).map(x=>JSON.stringify(x.target)));
      const row=document.createElement("p");
      row.textContent=({meaning:"Word meanings",reading:"Kanji readings",grammar:"Grammar"})[type]+" · "+records.length+" / "+list.length+" checked · "+automatic+" recalled quickly on two days · "+tested.size+" tested in exams";
      el("coverage").append(row);
    }
    const passages=new Set(evidence.filter(r=>r.skill===2 && r.context && r.answered).map(r=>r.context));
    const rd=evidence.filter(r=>r.skill===2 && r.answered);
    el("passages").textContent=passages.size+" distinct passages answered in Echo sets · "+rd.filter(r=>r.correct).length+" / "+rd.length+" reading questions correct across submitted sections.";
    el("passage-list").replaceChildren();
    for(const passage of passages){
      const answers=rd.filter(r=>r.context===passage);
      const li=document.createElement("li"),detail=document.createElement("details"),title=document.createElement("summary");
      title.textContent=passage.slice(0,32)+"… · "+answers.filter(a=>a.correct&&!a.guessed).length+"/"+answers.length+" confident correct";
      detail.append(title,passage);li.append(detail);el("passage-list").append(li);
    }
    el("history-list").replaceChildren();
    for(const a of [...data.attempts].sort((a,b)=>(b.startedAt||"").localeCompare(a.startedAt||""))){
      const li=document.createElement("li"),link=document.createElement("a");
      link.href="?book="+a.book+(a.phase==="results"?"&attempt="+encodeURIComponent(a.id):"");link.textContent=data.papers.find(p=>p.id===(a.paper||a.book))?.title||bookName(a.book);
      const answered=a.answers.filter(Boolean).length;
      li.append(link," · "+(a.startedAt?.slice(0,10)||"Earlier attempt")+" · "+a.phase+" · "+answered+"/"+a.answers.length+" answered");el("history-list").append(li);
    }
  }
  function draw(){
    showRecords();
    const type=el("dimension").value, filter=el("practice-filter").value;
    const records=new Map(data.recall.filter(x=>x.dimension===type).map(x=>[x.id,x]));
    const weak=new Set(evidence.filter(x=>x.target && (x.guessed||!x.correct) && x.answered && (type==="grammar"?x.target[0]==="grammar":x.dimension===type)).map(x=>JSON.stringify(x.target)));
    const today=new Date().toLocaleDateString("en-CA");
    let best=Infinity;selected=null;
    for(const item of items[type]){
      const id=JSON.stringify([type,...item.target]), r=records.get(id);
      // With kana-only headwords the written form already gives away the reading.
      if(type==="reading" && item.target[1]===item.target[2]) continue;
      const weakItem = r ? r.last!=="instant" : weak.has(JSON.stringify(item.target));
      if(filter==="weak" && !weakItem || filter==="new" && r) continue;
      const priority=r?.day===today ? 4 : weakItem ? 0 : !r ? 1 : r.days?.length>=2 ? 3 : 2;
      if(priority<best || priority===best && (r?.updatedAt||"") < (selected?.r?.updatedAt||"")){
        best=priority;selected={item,id,r,type};
      }
    }
    revealed=false;
    el("study-prompt").textContent=selected?.item.prompt||"No items in this filter.";
    el("study-answer").textContent="";el("reveal").hidden=!selected;el("ratings").hidden=true;
  }
  el("reveal").onclick=()=>{if(!selected)return;revealed=true;el("study-answer").textContent=selected.item.answer;el("reveal").hidden=true;el("ratings").hidden=false;};
  el("dimension").onchange=el("practice-filter").onchange=draw;
  el("ratings").onclick=async e=>{
    const grade=e.target.dataset.grade;if(!selected||!grade||!revealed)return;
    revealed=false;
    const {id,r,type,item}=selected,now=new Date(),day=now.toLocaleDateString("en-CA");
    const record={id,target:item.target,dimension:type,prompt:item.prompt,answer:item.answer,last:grade,day,updatedAt:now.toISOString(),checks:(r?.checks||0)+1,
      days:grade==="instant"?[...new Set([...(r?.days||[]),day])]:[],events:[...(r?.events||[]),{at:now.toISOString(),grade}]};
    try{await access("recall","put",record);data.recall=data.recall.filter(x=>x.id!==id);data.recall.push(record);showStats();draw();}
    catch(error){revealed=true;el("warning").textContent="Could not save this rating: "+error.message;}
  };
  el("export-report").onclick=async()=>{try{download(await report());}catch(e){el("warning").textContent=e.message;}};
  el("analyze-report").onclick=async()=>{
    const btn=el("analyze-report");btn.disabled=true;
    const out=el("analysis");out.textContent="Analyzing study history…";
    try{
      data=await report();evidence=scored(data);
      const summary=data.attempts.map(a=>({exam:a.book,started:a.startedAt,phase:a.phase,skills:[0,1,2,3].map(skill=>{
        const s=evidence.filter(r=>r.attemptId===a.id&&r.skill===skill);
        return {skill:["Vocabulary","Grammar","Reading","Listening"][skill],questions:s.length,correct:s.filter(r=>r.correct).length,guessed:s.filter(r=>r.guessed).length};
      })}));
      const misses=evidence.filter(x=>!x.correct||x.guessed).sort((a,b)=>Number(b.answered)-Number(a.answered)||b.seconds-a.seconds).slice(0,35).map(x=>{
        const q=data.papers.find(p=>p.id===x.paper).questions[x.index], a=data.attempts.find(a=>a.id===x.attemptId);
        return {exam:x.book,prompt:q.prompt||q.label,context:q.context,selected:q.choices?.[a.answers[x.index]-1]||a.answers[x.index],correct:q.choices?.[q.key-1]||q.key,seconds:x.seconds,guessed:x.guessed};
      });
      const weak=data.recall.filter(x=>x.last!=="instant").sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,50).map(x=>[x.dimension,x.prompt,x.last]);
      if(!summary.length&&!data.recall.length){out.textContent="Complete a check or take an exam first.";return;}
      const {askModel}=await import("./api.js");
      const settings=JSON.parse(localStorage.getItem("jp-echo-settings")||"{}");
      const result=await askModel(JSON.stringify({summary,misses,weak,recallChecks:data.recall.length}),"You are a Japanese N2 coach. Use only supplied observations. These practice scores are uncalibrated. Give a concise diagnosis, three precise next drills and a six-hour plan. Return JSON with a single string field advice.",settings);
      out.textContent=result.advice||JSON.stringify(result);
    }catch(e){out.textContent="Analysis unavailable. "+e.message;}finally{btn.disabled=false;}
  };
  showStats();draw();
}
