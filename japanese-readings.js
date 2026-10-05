// Shared, conservative dictionary readings. Context-dependent readings are explicit.
import {rubySegments,segmentsToNotation,stripFurigana,readingsToNotation,KANJI} from './core.js';
export const READING_VERSION=1;
export const readingText=text=>rubySegments(text).map(part=>part.reading||part.text).join('');
export function createReadingResolver(words){
 const exact=new Map(),stems=new Map();
 const add=(map,key,value)=>{if(!map.has(key))map.set(key,new Set());map.get(key).add(value)};
 for(const word of words){
  if(!word.w||!word.r||!KANJI.test(word.w))continue;
  add(exact,word.w,word.r);
  const annotated=rubySegments(readingsToNotation([[word.w,word.r]]));
  // A lemma's trailing kana may conjugate; its kanji stem reading remains.
  if(annotated.length===2&&annotated[0].reading&&!annotated[1].reading)add(stems,annotated[0].text,annotated[0].reading);
 }
 const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('ja',{granularity:'word'}):{segment:text=>[{segment:text,index:0}]};
 return function resolve(text,overrides={}){
  const plain=stripFurigana(text),old=rubySegments(text),issues=[],pieces=[];let offset=0;
  const retained=(start,end)=>{let pos=0;const out=[];for(const part of old){const stop=pos+part.text.length;if(pos>=start&&stop<=end)out.push(part);else if(pos<end&&stop>start)out.push({text:part.text.slice(Math.max(0,start-pos),Math.min(part.text.length,end-pos))});pos=stop}return segmentsToNotation(out)};
  for(const token of segmenter.segment(plain)){
   const surface=token.segment,start=token.index,end=start+surface.length;
   if(start>offset)pieces.push(plain.slice(offset,start));offset=end;
   if(!KANJI.test(surface)){pieces.push(surface);continue}
   const readings=overrides[surface]?new Set([overrides[surface]]):exact.get(surface);
   if(readings?.size===1){pieces.push(readingsToNotation([[surface,[...readings][0]]]));continue}
   const parts=[];let last=0,uncertain=false;
   for(const match of surface.matchAll(/[㐀-鿿々]+/gu)){
    parts.push({text:surface.slice(last,match.index)});const candidates=overrides[match[0]]?new Set([overrides[match[0]]]):stems.get(match[0]);
    if(!readings&&candidates?.size===1)parts.push({text:match[0],reading:[...candidates][0]});
    else{uncertain=true;parts.push({text:match[0]})}last=match.index+match[0].length;
   }
   parts.push({text:surface.slice(last)});
   if(uncertain){issues.push({surface,candidates:[...(readings||[])]});pieces.push(retained(start,end))}
   else pieces.push(segmentsToNotation(parts));
  }
  pieces.push(plain.slice(offset));return {text:pieces.join(''),issues};
 };
}
export function validateReadingCorrection(original,corrected){
 if(typeof corrected!=='string'||stripFurigana(corrected)!==stripFurigana(original))throw Error('Reading correction changed the sentence text.');
 const segments=rubySegments(corrected);
 if(segments.some(p=>p.reading&&!/^[ぁ-ゖァ-ヺー]+$/.test(p.reading)))throw Error('Reading correction contains an invalid reading.');
 if(segments.some(p=>!p.reading&&KANJI.test(p.text)))throw Error('Reading correction omitted a kanji reading.');
 return corrected;
}
