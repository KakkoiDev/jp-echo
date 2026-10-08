// Shared, conservative dictionary readings. Context-dependent readings are explicit.
import {rubySegments,segmentsToNotation,stripFurigana,readingsToNotation,KANJI} from './core.js';
export const READING_VERSION=2;
export const readingText=text=>rubySegments(text).map(part=>part.reading||part.text).join('');
// Explicit ruby is a pronunciation hint, not a grammatical particle. Katakana
// keeps browser voices from interpreting a supplied は/へ as wa/e.
export const speechText=text=>rubySegments(text).map(part=>part.reading
 ?part.reading.replace(/[ぁ-ゖ]/g,char=>String.fromCharCode(char.charCodeAt(0)+0x60))
 :part.text).join('');
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
 const trie={};
 const put=(key,value)=>{let node=trie;for(const char of key)node=node[char]||(node[char]={});(node.matches||(node.matches=[])).push(value)};
 const endings={v1:"るたてなまられよず","v1-s":"るたてなまられよず",v5u:"わいうえおっ","v5u-s":"わいうえおっ",v5k:"かきくけこい","v5k-s":"かきくけこっ",v5g:"がぎぐげごい",v5s:"さしすせそ",v5t:"たちつてとっ",v5n:"なにぬねのん",v5b:"ばびぶべぼん",v5m:"まみむめもん",v5r:"らりるれろっ","v5r-i":"らりるれろっ",v5aru:"らりるれろっい","adj-i":"いくかけ","adj-ix":"いくかけ"};
 for(const [key,readings] of exact)put(key,{key,readings});
 for(const word of words){const ending=(word.pos||[]).map(pos=>endings[pos]).find(Boolean);
  if(!ending||!word.w||!word.r||!KANJI.test(word.w))continue;
  const key=word.w.slice(0,-1),reading=word.r.slice(0,-1);
  if(key&&reading&&word.r.endsWith(word.w.slice(-1)))put(key,{key,readings:new Set([reading]),ending,defaultReading:(word.pos||[]).includes("v5k-s")});
 }
 const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('ja',{granularity:'word'}):{segment:text=>[{segment:text,index:0}]};
 return function resolve(text,overrides={}){
  const plain=stripFurigana(text),old=rubySegments(text),issues=[],pieces=[];let offset=0;
  const retained=(start,end)=>{let pos=0;const out=[];for(const part of old){const stop=pos+part.text.length;if(pos>=start&&stop<=end)out.push(part);else if(pos<end&&stop>start)out.push({text:part.text.slice(Math.max(0,start-pos),Math.min(part.text.length,end-pos))});pos=stop}return segmentsToNotation(out)};
  const originalTokens=[...segmenter.segment(plain)],boundaries=new Set(originalTokens.flatMap(t=>[t.index,t.index+t.segment.length]));
  const tokens=[];let cursor=0;
  while(cursor<plain.length){
   let node=trie,best=null,length=0;
   for(const char of plain.slice(cursor)){
    node=node[char];if(!node)break;length+=char.length;
    const matches=(node.matches||[]).filter(m=>m.ending?m.ending.includes(plain[cursor+length]||"!"):boundaries.has(cursor+length));
    if(matches.length)best={length,matches};
   }
   if(best){
    // A conjugated word outranks a noun with the same kanji stem.
    const inflected=best.matches.filter(m=>m.ending);
    const matches=inflected.length?inflected:best.matches;
    let readings=new Set(matches.flatMap(m=>[...m.readings]));
    if(readings.size>1&&inflected.length){
     const supplied=readingText(retained(cursor,cursor+best.length));
     if(readings.has(supplied))readings=new Set([supplied]);
     else {const preferred=matches.find(m=>m.defaultReading);if(preferred)readings=preferred.readings}
    }
tokens.push({segment:plain.slice(cursor,cursor+best.length),index:cursor,dictionaryReadings:readings});cursor+=best.length;continue}
   const token=originalTokens.find(t=>t.index<=cursor&&cursor<t.index+t.segment.length);
   const end=token?token.index+token.segment.length:cursor+1;
   tokens.push({segment:plain.slice(cursor,end),index:cursor});cursor=end;
  }
  for(const token of tokens){
   const surface=token.segment,start=token.index,end=start+surface.length;
   if(start>offset)pieces.push(plain.slice(offset,start));offset=end;
   if(!KANJI.test(surface)){pieces.push(surface);continue}
   const readings=overrides[surface]?new Set([overrides[surface]]):token.dictionaryReadings||exact.get(surface);
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
