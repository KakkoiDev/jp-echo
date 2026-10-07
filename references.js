import {stripFurigana} from './core.js';
export const REFERENCE_KINDS=['word','kanji','grammar'];
const cjk=/^[㐀-鿿々\u{20000}-\u{3134f}]$/u;
export function referenceKey(kind,term){return `custom:${kind}:${String(term).normalize('NFC').trim()}`}
export function validReference(value){
 if(!value||!REFERENCE_KINDS.includes(value.kind)||typeof value.term!=='string'||!value.term.trim()||typeof value.text!=='string'||!value.text.trim()||value.text.length>30000)return false;
 try{const url=new URL(value.sourceUrl);return url.protocol==='https:'&&['en.wiktionary.org','kanjiapi.dev'].includes(url.hostname)&&value.id===referenceKey(value.kind,value.term)}catch{return false}
}
export function mergeReferences(current=[],incoming=[]){return [...new Map([...(Array.isArray(current)?current:[]),...(Array.isArray(incoming)?incoming:[])].filter(validReference).map(entry=>[entry.id,entry])).values()]}
export function missingReferenceCandidates(text,{spans=[],knownKanji=()=>false,references=[]}={}){
 const plain=stripFurigana(text),saved=new Set(references.map(r=>referenceKey(r.kind,r.term))),result=[];
 for(const char of new Set([...plain]))if(cjk.test(char)&&!knownKanji(char)&&!saved.has(referenceKey('kanji',char)))result.push({kind:'kanji',term:char});
 const katakana=[...plain.matchAll(/[ァ-ヺー]+/gu)].map(match=>({term:match[0],start:match.index,end:match.index+match[0].length}));
 for(const token of katakana)if(!spans.some(span=>span.id!=null&&span.start<=token.start&&span.end>=token.end)&&!saved.has(referenceKey('word',token.term)))result.push({kind:'word',term:token.term});
 if(typeof Intl.Segmenter==='function')for(const token of new Intl.Segmenter('ja',{granularity:'word'}).segment(plain)){
  if(katakana.some(range=>range.start<=token.index&&range.end>=token.index+token.segment.length))continue;
  if(!token.isWordLike||!/[㐀-鿿ァ-ヺ]/u.test(token.segment))continue;
  if(spans.some(span=>span.id!=null&&span.start<=token.index&&span.end>=token.index+token.segment.length))continue;
  if(!saved.has(referenceKey('word',token.segment)))result.push({kind:'word',term:token.segment});
 }
 return [...new Map(result.map(item=>[referenceKey(item.kind,item.term),item])).values()];
}
async function json(url,fetchImpl,signal){const response=await fetchImpl(url,{signal,credentials:'omit'});if(!response.ok)throw new Error(`Reference lookup failed (${response.status}).`);return response.json()}
export function wiktionaryText(html,{parseHTML=html=>new DOMParser().parseFromString(html,'text/html')}={}){
 const document=parseHTML(html);let root=document.body;const anchor=document.getElementById('Japanese');
 if(!anchor)throw new Error('This source has no Japanese entry for that term. Try its dictionary form or a shorter grammar construction.');
 const heading=anchor.closest('h2')||anchor.closest('.mw-heading');
 const fragments=[];let node=heading?.parentElement?.classList.contains('mw-heading')?heading.parentElement.nextElementSibling:heading?.nextElementSibling;
 while(node){if(node.matches('h2,.mw-heading2'))break;const clone=node.cloneNode(true);clone.querySelectorAll('script,style,.mw-editsection,.NavFrame,table').forEach(item=>item.remove());fragments.push(clone.textContent.trim());node=node.nextElementSibling}
 const text=fragments.filter(Boolean).join('\n\n').replace(/[ \t]+/g,' ').trim();
 if(!text)throw new Error('The Japanese entry has no readable definition.');return text.slice(0,28000);
}
export async function fetchReference({kind,term},{fetchImpl=fetch,signal,extractText=wiktionaryText,now=()=>new Date().toISOString()}={}){
 term=String(term||'').normalize('NFC').trim();if(!REFERENCE_KINDS.includes(kind)||!term||term.length>100)throw new Error('Enter a word, kanji, or grammar construction (up to 100 characters).');
 let text,sourceUrl,sourceLabel;
 if(kind==='kanji'){
  if(!cjk.test(term))throw new Error('Enter exactly one kanji character.');
  sourceUrl=`https://kanjiapi.dev/v1/kanji/${encodeURIComponent(term)}`;const data=await json(sourceUrl,fetchImpl,signal);
  if(data.kanji!==term||!Array.isArray(data.meanings)||!data.meanings.length)throw new Error('No kanji definition was returned.');
  text=[`Meaning: ${data.meanings.join('; ')}`,`On readings: ${(data.on_readings||[]).join('、')||'—'}`,`Kun readings: ${(data.kun_readings||[]).join('、')||'—'}`,`Name readings: ${(data.name_readings||[]).join('、')||'—'}`,`Strokes: ${data.stroke_count??'—'}`].join('\n');sourceLabel='KANJIDIC / kanjiapi.dev';
 }else{
  const url=new URL('https://en.wiktionary.org/w/api.php');url.search=new URLSearchParams({action:'parse',page:term,prop:'text',redirects:'1',format:'json',formatversion:'2',origin:'*'}).toString();
  const data=await json(url.href,fetchImpl,signal);if(data.error||typeof data.parse?.text!=='string')throw new Error('No dictionary entry found. Try the dictionary form, or look up a shorter grammar construction.');
  text=extractText(data.parse.text);sourceUrl=`https://en.wiktionary.org/wiki/${encodeURIComponent(data.parse.title||term)}#Japanese`;sourceLabel='Wiktionary · CC BY-SA / GFDL';
 }
 return {id:referenceKey(kind,term),kind,term,text,sourceUrl,sourceLabel,fetchedAt:now()};
}

export function customReferenceSpans(text,references=[]){
 const spans=[];
 for(const entry of references.filter(validReference).sort((a,b)=>b.term.length-a.term.length)){
  let from=0,index;while((index=text.indexOf(entry.term,from))!==-1){const end=index+entry.term.length;if(!spans.some(span=>index<span.end&&end>span.start))spans.push({start:index,end,id:null,ids:[],referenceId:entry.id});from=end}
 }
 return spans.sort((a,b)=>a.start-b.start);
}
