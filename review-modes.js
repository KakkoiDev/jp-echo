import {stripFurigana} from "./core.js";
import {REVIEW_MODES,ensureReviewTrack,nextSkill,reviewMode} from "./review.js";
// The review state itself — the FSRS schedule, the 聴 読 書 rotation
// (reviewTrack), skillMix and reviewStats — is JP Core's, in review.js. This
// file is Echo's side of it: what each skill looks like and says, and which
// due sentences go into a session.
// Skill glyphs extend the app's single-kanji motif (休 了 学 音): 聴 listen,
// 読 read, 書 write. `icon` is the glyph; `title` heads the review card.
export const REVIEW_MODE_META=Object.freeze({
  listening:Object.freeze({icon:"聴",label:"Listening",title:"Listen",verb:"hear",past:"heard"}),
  reading:Object.freeze({icon:"読",label:"Reading",title:"Read it",verb:"read",past:"read"}),
  writing:Object.freeze({icon:"書",label:"Writing",title:"Write it",verb:"write",past:"wrote"})
});

export function reviewModeMeta(sentenceOrMode){
  const mode=typeof sentenceOrMode==="string"&&REVIEW_MODES.includes(sentenceOrMode)?sentenceOrMode:reviewMode(sentenceOrMode);
  return REVIEW_MODE_META[mode];
}

const WHAT={listening:"Sound only this time.",reading:"The Japanese only this time, without furigana.",writing:"The meaning only this time — you type the Japanese."};

// The one-line reason under the card title, derived from the real track:
// what this visit shows, what happened last visit, and where a pass leads.
export function skillReason(sentence){
  const tracked=ensureReviewTrack(sentence),mode=reviewMode(tracked),last=tracked?.reviewTrack?.last,then=REVIEW_MODE_META[nextSkill(mode)].verb;
  const before=!last?"First visit for this sentence"
    :last.mode===mode?"It did not stick last time, so this skill comes round again"
    :`You ${REVIEW_MODE_META[last.mode].past} it last time`;
  return `${WHAT[mode]} ${before}; get it right and next time you will ${then} it.`;
}

// "Due in 3 days, as a writing card — you will see the meaning and type the
// Japanese." `when` is already in words ("in 3 days", "now").
const EXPECT={listening:"you will hear it with no text",reading:"you will read the Japanese without furigana",writing:"you will see the meaning and type the Japanese"};
export function dueLine(sentence,when){const mode=reviewMode(ensureReviewTrack(sentence));return `Due ${when}, as a ${REVIEW_MODE_META[mode].label.toLowerCase()} card — ${EXPECT[mode]}.`}

// New and existing review allowances span the past 20 hours, across sessions.
const REVIEW_WINDOW_MS=20*60*60*1000;
export function sessionLimit(value){
  if(value==null||String(value).trim()==="")return 20;
  const number=Number(value);
  return Number.isFinite(number)?Math.max(0,Math.floor(number)):20;
}
export function reviewOrder(value){return ['shortest','longest'].includes(value)?value:'scheduled'}
export function reviewSentenceLength(item){
 const text=item.reviewRegister==='polite'?(item.politeTarget||item.target||''):(item.casualTarget||item.target||'');
 return (stripFurigana(text).match(/[\p{L}\p{N}]/gu)||[]).length;
}
export function orderReviewSentences(due,order){
 const direction=reviewOrder(order);
 if(direction==='scheduled')return due;
 const factor=direction==='shortest'?1:-1;
 // Stable ties preserve scheduling priority; never reorder the source array.
 return due.map(item=>({item,length:reviewSentenceLength(item)})).sort((a,b)=>factor*(a.length-b.length)).map(entry=>entry.item);
}
export function dailyReviewBudget(sentences,settings={},now=Date.now()){
 const end=Number(now),cutoff=end-REVIEW_WINDOW_MS,used={new:0,review:0},expires={new:[],review:[]};
 for(const sentence of sentences){
  // Older logs did not record the pre-review state. Their first historical
  // attempt introduced the card; later attempts count as existing reviews.
  const history=(Array.isArray(sentence.reviews)?sentence.reviews:[]).filter(r=>['ok','again'].includes(r.rating)&&Number.isFinite(Date.parse(r.at))).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
  history.forEach((review,index)=>{
   const at=Date.parse(review.at);if(at<=cutoff||at>end)return;
   const kind=(review.state===0||(review.state==null&&index===0))?'new':'review';
   used[kind]++;expires[kind].push(at+REVIEW_WINDOW_MS);
  });
 }
 const limits={new:sessionLimit(settings.reviewNewLimit),review:sessionLimit(settings.reviewExistingLimit)};
 const remaining={new:Math.max(0,limits.new-used.new),review:Math.max(0,limits.review-used.review)};
 const releases=Object.keys(limits).flatMap(kind=>{
  if(!limits[kind]||remaining[kind]>0)return [];
  const times=expires[kind].sort((a,b)=>a-b);
  // Lowering a limit may require several older attempts to expire first.
  return times.length?[times[Math.max(0,times.length-limits[kind])]]:[];
 });
 return {used,remaining,nextAvailable:releases.length?Math.min(...releases):null};
}
export function limitReviewSession(due,settings={},all=due,now=Date.now()){
  const budget=dailyReviewBudget(all,settings,now);
  let fresh=budget.remaining.new,reviews=budget.remaining.review;
  return orderReviewSentences(due,settings.reviewOrder).filter(item=>(item.srs?.state??0)===0?fresh-->0:reviews-->0);
}

// Extra study is an explicit one-session bypass, never a settings change.
export function extraStudySession(due,all,settings={}){
 const ready=due.filter(item=>!item.skipped),eligible=all.filter(item=>!item.skipped);
 const candidates=ready.length?ready:[...eligible].sort((a,b)=>(Date.parse(a.srs?.due)||0)-(Date.parse(b.srs?.due)||0));
 return orderReviewSentences(candidates,settings.reviewOrder).slice(0,20);
}

export function reviewAvailabilityMessage(dueCount,sessionCount,nextDue,now=Date.now()){
 const remaining=Math.max(0,dueCount-sessionCount);
 if(remaining)return `${remaining} more ${remaining===1?'card is':'cards are'} due now. Daily limits apply across sessions.`;
 if(dueCount)return 'These cards are due now. Grading them will set their next review dates.';
 if(Number.isFinite(nextDue)&&nextDue>now){const at=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(nextDue));return `The next scheduled card is due ${at}.`;}
 return 'No cards are due now.';
}
