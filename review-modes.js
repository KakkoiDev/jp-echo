export const REVIEW_MODES=Object.freeze(["listening","reading","writing"]);
// Skill glyphs extend the app's single-kanji motif (休 了 学 音): 聴 listen,
// 読 read, 書 write. `icon` is the glyph; `title` heads the review card.
export const REVIEW_MODE_META=Object.freeze({
  listening:Object.freeze({icon:"聴",label:"Listening",title:"Listen",verb:"hear",past:"heard"}),
  reading:Object.freeze({icon:"読",label:"Reading",title:"Read it",verb:"read",past:"read"}),
  writing:Object.freeze({icon:"書",label:"Writing",title:"Write it",verb:"write",past:"wrote"})
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

// The skill after `mode` — where a sentence goes when it is graded OK. Again
// keeps the same skill (recordReviewMode), so "next" is always conditional.
export const nextSkill=mode=>REVIEW_MODES[(REVIEW_MODES.indexOf(validMode(mode))+1)%REVIEW_MODES.length];

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

// How many of these sentences each skill will take, for "Today you will".
export function skillMix(sentences=[]){
  const mix=Object.fromEntries(REVIEW_MODES.map(mode=>[mode,0]));
  for(const sentence of sentences)mix[reviewMode(sentence)]+=1;
  return mix;
}
