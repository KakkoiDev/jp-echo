import {isLanguage,migrateSentence,SCHEMA_VERSION} from './core.js';

// Validate the entire file before any catalogue or sentence store is changed.
export function validateDeckBackup(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||!Number.isInteger(value.schemaVersion)||value.schemaVersion<1||value.schemaVersion>SCHEMA_VERSION||!Array.isArray(value.sentences))throw new Error('This is not an Echo deck or backup: it needs "schemaVersion": 2 and a "sentences" array. See DECK-FORMAT.md.');
 const sentences=value.sentences.map((record,index)=>{
  if(!record||typeof record!=='object'||Array.isArray(record))throw new Error(`Sentence ${index+1} is invalid.`);
  const sentence=migrateSentence({...record,schemaVersion:record.schemaVersion??value.schemaVersion});
  for(const key of ['id','source','target'])if(typeof sentence[key]!=='string'||!sentence[key].trim())throw new Error(`Sentence ${index+1} needs a non-empty ${key}.`);
  for(const key of ['casualTarget','politeTarget'])if(sentence[key]!=null&&typeof sentence[key]!=='string')throw new Error(`Sentence ${index+1} has an invalid ${key}.`);
  // Language codes are rendered into lang="" attributes: only known codes pass.
  for(const key of ['sourceLang','targetLang'])if(sentence[key]!=null&&!isLanguage(sentence[key]))throw new Error(`Sentence ${index+1} has an unknown ${key}.`);
  for(const key of ['grammar','vocabulary','reviews','grammarAnalysis'])if(sentence[key]!=null&&!Array.isArray(sentence[key]))throw new Error(`Sentence ${index+1} has an invalid ${key}.`);
  const createdAt=typeof sentence.createdAt==='string'&&Number.isFinite(Date.parse(sentence.createdAt))?sentence.createdAt:'1970-01-01T00:00:00.000Z';
  return {...sentence,createdAt,updatedAt:sentence.updatedAt||createdAt};
 });
 return {...value,sentences};
}
export function deckJSONURL(input){
 let url;try{url=new URL(String(input).trim())}catch{throw new Error('Enter a complete JSON download URL.');}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('Use an HTTP or HTTPS JSON download URL without login credentials.');
 if(url.hostname==='github.com'){const match=url.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/);if(match){url=new URL(`https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}`);}}
 return url.href;
}
export async function fetchDeckBackup(input,{fetchImpl=fetch,signal}={}){
 let response;try{response=await fetchImpl(deckJSONURL(input),{cache:'no-store',signal})}catch(error){if(error.name==='AbortError')throw new Error('Download timed out. Try again or import the downloaded JSON file.');throw new Error('Could not download this deck. Download the JSON and use Import deck JSON instead.');}
 if(!response.ok)throw new Error(`Deck download failed (${response.status}).`);
 let data;try{data=await response.json()}catch{throw new Error('The download is not a JSON file. Use a direct JSON link or import the downloaded file.');}
 return validateDeckBackup(data);
}

// Yield before parsing/merging so the browser can paint the pending status.
export async function runImportFeedback({status,buttons=[],label='file',load,save,onComplete=()=>{},yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0))}){
 const previous=buttons.map(button=>button.disabled);
 const show=(message,state)=>{status.textContent=message;status.dataset.state=state;status.classList.toggle('error',state==='error')};
 buttons.forEach(button=>button.disabled=true);status.setAttribute('aria-busy','true');
 try{
  show(`Reading ${label}…`,'pending');await yieldUI();
  const data=await load();
  show(`Importing ${(data.sentences?.length||0).toLocaleString()} sentences…`,'pending');await yieldUI();
  const result=await save(data);
  const message=`Import complete. ${result.added.toLocaleString()} new sentences added; existing sentences merged. ${result.total.toLocaleString()} in your library.`;
  show(message,'success');onComplete(message);return result;
 }catch(error){show(`Import failed: ${error.message||'Please try again.'}`,'error');return null}
 finally{status.setAttribute('aria-busy','false');buttons.forEach((button,index)=>button.disabled=previous[index])}
}

// One way in. The Import page takes whatever the person has — a file they chose
// or dropped, or text they pasted — and this says what it is, so the page can
// hand it to the one place that already handles it: a deck or backup merges
// (importBackupData), a gist link restores (gist backup), a book or a passage
// opens Extract from text. Pure: it reads names, types and text, nothing else.
const JAPANESE=/[぀-ヿ㐀-鿿]/;
export function classifyImport({file=null,text=""}={}){
 if(file){
  const name=String(file.name||"").toLowerCase(),type=String(file.type||"").toLowerCase();
  if(name.endsWith(".json")||type==="application/json")return {kind:"deck-file"};
  if(name.endsWith(".epub")||type==="application/epub+zip")return {kind:"book"};
  if(name.endsWith(".txt")||name.endsWith(".md")||type.startsWith("text/"))return {kind:"text-file"};
  return {kind:"unknown",reason:"Echo reads a deck or backup (.json), a book (.epub) or a text file (.txt)."};
 }
 const value=String(text||"").trim();
 if(!value)return {kind:"empty"};
 if(value.startsWith("{")){
  try{const data=JSON.parse(value);return data&&typeof data==="object"&&!Array.isArray(data)?{kind:"deck-json",data}:{kind:"unknown",reason:"That JSON is not an Echo deck or backup."}}
  catch{return {kind:"unknown",reason:"That looks like JSON but does not parse. Check it is the whole file."}}
 }
 if(/^[0-9a-f]{20,}$/i.test(value))return {kind:"gist",gist:value};
 let url=null;try{url=new URL(value)}catch{url=null}
 if(url&&/^https?:$/.test(url.protocol)&&!/\s/.test(value)){
  const host=url.host.toLowerCase();
  if(host==="gist.github.com"||host==="gist.githubusercontent.com"||(host==="api.github.com"&&url.pathname.startsWith("/gists/")))return {kind:"gist",gist:value};
  return {kind:"deck-url",url:value};
 }
 if(JAPANESE.test(value))return {kind:"passage",text:value};
 return {kind:"unknown",reason:"Paste Japanese text, a deck, or a link to a deck or a gist."};
}
// One line saying what will happen, shown under the box before anything runs.
export function importIntent(result){
 return ({"deck-file":"A deck or backup file. It merges; nothing here is lost.","book":"A book. It opens in Extract from text, where you pick the sentences to keep.","text-file":"A text file. It opens in Extract from text, where you pick the sentences to keep.","deck-json":"A deck or backup. It merges; nothing here is lost.","gist":"A gist backup. It merges into this device; nothing here is lost.","deck-url":"A link to a deck. Echo downloads it and merges it.","passage":"Japanese text. It opens in Extract from text, where you pick the sentences to keep."})[result?.kind]||result?.reason||"";
}
