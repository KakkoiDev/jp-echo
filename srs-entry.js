import {createEmptyCard,fsrs,Rating} from "ts-fsrs";

const scheduler=fsrs({request_retention:.9,maximum_interval:36500,enable_fuzz:true,enable_short_term:true,learning_steps:["1m","10m"],relearning_steps:["10m"]});

const serialize=card=>({...card,due:new Date(card.due).toISOString(),last_review:card.last_review?new Date(card.last_review).toISOString():null});

export function ensureSchedule(sentence,now=new Date()){
  if(sentence.srs?.due)return sentence;
  return {...sentence,srs:serialize(createEmptyCard(now))};
}

export function isDue(sentence,now=new Date()){
  return !sentence.srs?.due||Date.parse(sentence.srs.due)<=now.getTime();
}

export function dueSentences(sentences,now=new Date()){
  return sentences.filter(sentence=>isDue(sentence,now)).sort((a,b)=>Date.parse(a.srs?.due||a.createdAt)-Date.parse(b.srs?.due||b.createdAt));
}

export function reviewSentence(sentence,rating,now=new Date()){
  const scheduled=ensureSchedule(sentence,now);
  const result=scheduler.next(scheduled.srs,now,rating==="again"?Rating.Again:Rating.Good);
  return {...scheduled,srs:serialize(result.card),lastRating:rating,updatedAt:now.toISOString()};
}
