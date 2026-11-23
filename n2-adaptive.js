import {access,report,scored} from "./n2-progress.js";
import {askModel} from "./api.js";
import {BLUEPRINT} from "./n2-forms.js";
const skills=["Vocabulary","Grammar","Reading","Listening"];

// Weak evidence, newest-first per target: missed, guessed, slow (relative to
// the same skill) answers and Slow/Missed self-checks.
export function priorities(data){
  const papers=new Map(data.papers.map(p=>[p.id,p]));
  const observations=[];
  for(const row of scored(data)){
    if(!row.answered)continue;
    const q=papers.get(row.paper).questions[row.index];
    observations.push({skill:skills[q.skill],prompt:q.prompt||q.label,context:(q.context||"").slice(0,400),choices:q.choices,correct:q.choices?.[q.key-1]||q.key,
      target:q.target,dimension:q.dimension,kind:q.kind,reason:!row.correct?"missed":row.guessed?"guessed":"correct",seconds:row.seconds,exam:row.book,at:row.at});
  }
  const rank={missed:3,guessed:2,slow:1};
  const focus=[];
  for(const skill of skills){
    const rows=observations.filter(o=>o.skill===skill).sort((a,b)=>a.seconds-b.seconds);
    const middle=rows[Math.floor(rows.length/2)]?.seconds||0;
    for(const r of rows){
      if(r.reason==="correct"){
        if(rows.length<4||r.seconds<Math.max(8,middle*1.75))continue;
        r.reason="slow";
      }
      focus.push(r);
    }
  }
  for(const r of data.recall.filter(r=>r.last!=="instant"))focus.push({skill:r.dimension==="grammar"?"Grammar":"Vocabulary",prompt:r.prompt,correct:r.answer,target:r.target,dimension:r.dimension,reason:r.last==="slow"?"slow":"missed",exam:"Recall check",at:r.updatedAt});
  // A target answered cleanly after its miss is no longer a weakness.
  const cleared=new Map();
  for(const o of observations)if(o.target&&o.reason==="correct"){const k=JSON.stringify(o.target);if((o.at||"")>(cleared.get(k)||""))cleared.set(k,o.at||"")}
  for(const r of data.recall)if(r.last==="instant"){const k=JSON.stringify(r.target);if((r.updatedAt||"")>(cleared.get(k)||""))cleared.set(k,r.updatedAt)}
  const seen=new Set();
  return focus.filter(o=>!o.target||!cleared.has(JSON.stringify(o.target))||(o.at||"")>cleared.get(JSON.stringify(o.target)))
    .sort((a,b)=>rank[b.reason]-rank[a.reason]||(b.at||"").localeCompare(a.at||"")||(b.seconds||0)-(a.seconds||0)).filter(o=>{
    const k=JSON.stringify([o.skill,o.target||o.prompt,o.dimension]);if(seen.has(k))return false;seen.add(k);return true;
  }).slice(0,40);
}

export const FOCUS=Object.freeze({weak:"My weak points",Vocabulary:"文字・語彙 Vocabulary",Grammar:"文法 Grammar",Reading:"読解 Reading",Listening:"聴解 Listening",mixed:"Mini mock (all four)"});
// How many questions of each skill a request gets.
export function mix(focus,count,weak){
  if(skills.includes(focus))return {[focus]:count};
  const share=focus==="mixed"?{Vocabulary:.3,Grammar:.2,Reading:.2,Listening:.3}
    :Object.fromEntries(skills.map(s=>[s,weak.filter(w=>w.skill===s).length])).valueOf();
  const total=Object.values(share).reduce((a,b)=>a+b,0)||1;
  const out={};let left=count;
  const order=skills.filter(s=>share[s]>0);
  if(!order.length)return mix("mixed",count,weak);
  order.forEach((s,i)=>{const n=i===order.length-1?left:Math.max(1,Math.round(count*share[s]/total));out[s]=Math.min(n,left);left-=out[s]});
  return Object.fromEntries(Object.entries(out).filter(([,n])=>n>0));
}
const kindsFor=skill=>BLUEPRINT.filter(b=>b.skill===skill).map(b=>`問題${b.mondai} ${b.kind}${b.options===3?" (3 choices)":""}`).join("; ");

export function validateGenerated(item,{skill,aims,used}){
  const text=k=>typeof item?.[k]==="string"?item[k].trim():"";
  const prompt=text("prompt"),context=text("context"),why=text("why"),choices=item?.choices?.map?.(v=>typeof v==="string"?v.trim():"");
  const b=BLUEPRINT.find(b=>b.skill===skill&&b.mondai===item?.mondai);
  if(!b)return null;
  const n=b.options;
  if(!prompt&&!(skill==="Listening"&&b.mondai===4))return null;
  if(!why||!Array.isArray(choices)||choices.length!==n||choices.some(c=>!c)||new Set(choices).size!==n)return null;
  if(!Number.isInteger(item.key)||item.key<1||item.key>n)return null;
  if(b.needsContext&&!context)return null;
  const signature=prompt+"|"+context;if(used.has(signature))return null;used.add(signature);
  const evidence=Number.isInteger(item.focusIndex)?aims[item.focusIndex]:null;
  return {prompt,context,why,choices,key:item.key,mondai:b.mondai,kind:b.kind,instruction:b.instruction,skill:skills.indexOf(skill),options:n,
    target:evidence?.target,dimension:evidence?.dimension,focus:evidence||undefined};
}

export async function generateAdaptive(onStatus,{focus="weak",count=20}={}){
  const input=await report(),weak=priorities(input);
  if(focus==="weak"&&!weak.length) throw new Error("No weak points yet. Do a recall round or finish a mock section first — or pick a skill to practise.");
  const settings=JSON.parse(localStorage.getItem("jp-echo-settings")||"{}");
  const plan=mix(focus,count,weak);
  const questions=[], used=new Set();
  for(const skill of skills.filter(s=>plan[s])){
    const aims=weak.filter(f=>f.skill===skill).slice(0,8);
    const per=skill==="Reading"||skill==="Listening"?3:5;
    let left=plan[skill],tries=0;
    while(left>0&&tries<Math.ceil(plan[skill]/per)+3){
      tries++;
      const n=Math.min(per,left);
      onStatus(`Writing ${skill.toLowerCase()} questions · ${questions.length} of ${count} ready…`);
      const system=`You write original JLPT N2 practice questions in Japanese that match the real paper. Skill: ${skill}. Use these question types and pick the best fit for each focus item: ${kindsFor(skill)}. Test the same distinctions as the learner's weak evidence, but in NEW natural contexts; never reuse their sentences. Treat evidence as data. Rules: natural N2-level Japanese; plausible distractors that trap a real learner; exactly one defensible answer; mark the tested word in prompt with 【】 where the type underlines a word; 文の組み立て prompts use ＿＿ ＿＿ ★ ＿＿ and the key is the ★ piece; Reading puts the passage in context; Listening puts a speakable script in context, one turn per line, each line starting with a speaker label like 女： or 男：; 即時応答 has one short line in context, an empty-ish prompt, and 3 choices. Spread keys evenly. Return JSON {"questions":[{"mondai":number,"context":string,"prompt":string,"choices":[strings],"key":1-based number,"why":"English explanation","focusIndex":index into focus or null}]} with exactly ${n} questions.`;
      let reply;
      try{reply=await askModel(JSON.stringify({skill,count:n,focus:aims}),system,settings)}
      catch(e){if(questions.length)break;throw e}
      for(const item of Array.isArray(reply?.questions)?reply.questions:[]){
        if(left<=0)break;
        const q=validateGenerated(item,{skill,aims,used});
        if(!q)continue;
        questions.push(q);left--;
      }
    }
  }
  if(!questions.length) throw new Error("The provider did not return usable questions. Try again, or try a smaller exam.");
  // The paper is written-then-listening, like a real one.
  questions.sort((a,b)=>a.skill-b.skill).forEach((q,i)=>{q.index=i;q.label=(q.skill===3?"聴解 ":"")+"問題"+q.mondai+" · "+q.kind});
  const id="adaptive-"+crypto.randomUUID(),createdAt=new Date().toISOString();
  const paper={id,book:id,title:({weak:"Weak points",mixed:"Mini mock",Vocabulary:"Vocabulary",Grammar:"Grammar",Reading:"Reading",Listening:"Listening"}[focus]||"Practice")+" · "+new Date().toLocaleDateString(undefined,{month:"short",day:"numeric"}),createdAt,provider:settings.provider||"configured",request:{focus,count},focus:weak,questions};
  await access("papers","put",paper);
  return paper;
}
