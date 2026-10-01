export const REVIEW_MODES=Object.freeze(["listening","reading","writing"]);
export const REVIEW_MODE_META=Object.freeze({
  listening:Object.freeze({icon:"👂",label:"Listening"}),
  reading:Object.freeze({icon:"📖",label:"Reading"}),
  writing:Object.freeze({icon:"✍️",label:"Writing"})
});

const zeroes=()=>({listening:0,reading:0,writing:0});
const validMode=value=>REVIEW_MODES.includes(value)?value:"listening";
const count=value=>Number.isFinite(Number(value))&&Number(value)>=0?Math.floor(Number(value)):0;

export function ensureReviewTrack(sentence){
  if(!sentence)return sentence;
  const raw=sentence.reviewTrack||{},completed={...zeroes(),...(raw.completed||{})},attempts={...zeroes(),...(raw.attempts||{})};
  for(const mode of REVIEW_MODES){completed[mode]=count(completed[mode]);attempts[mode]=count(attempts[mode])}
  const next=validMode(raw.next),last=raw.last&&REVIEW_MODES.includes(raw.last.mode)?{mode:raw.last.mode,rating:raw.last.rating||"",at:raw.last.at||null}:null;
  const same=raw.next===next&&REVIEW_MODES.every(mode=>raw.completed?.[mode]===completed[mode]&&raw.attempts?.[mode]===attempts[mode])&&
    ((raw.last==null&&last==null)||(raw.last?.mode===last?.mode&&raw.last?.rating===last?.rating&&raw.last?.at===last?.at));
  return same?sentence:{...sentence,reviewTrack:{next,completed,attempts,last}};
}

export function reviewMode(sentence){return validMode(sentence?.reviewTrack?.next)}

export function reviewModeMeta(sentenceOrMode){
  const mode=typeof sentenceOrMode==="string"?validMode(sentenceOrMode):reviewMode(sentenceOrMode);
  return REVIEW_MODE_META[mode];
}

export function recordReviewMode(sentence,rating,at=new Date()){
  const tracked=ensureReviewTrack(sentence),mode=reviewMode(tracked),passed=rating==="ok";
  const completed={...tracked.reviewTrack.completed},attempts={...tracked.reviewTrack.attempts};
  attempts[mode]+=1;
  if(passed)completed[mode]+=1;
  const index=REVIEW_MODES.indexOf(mode),next=passed?REVIEW_MODES[(index+1)%REVIEW_MODES.length]:mode;
  return {...tracked,reviewTrack:{next,completed,attempts,last:{mode,rating,at:new Date(at).toISOString()}}};
}
