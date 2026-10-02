// Ground grammar highlights in exact quoted evidence, never substrings of titles.
export function validateGrammarAnalysis(text, raw, points) {
 const known=new Set(points.map(p=>p.id)),spans=[];
 for(const item of Array.isArray(raw?.matches)?raw.matches:[]){
  if(!known.has(item?.id)||typeof item.quote!=="string"||!item.quote.trim())continue;
  const occurrence=Number(item.occurrence??0);if(!Number.isInteger(occurrence)||occurrence<0)continue;
  let start=-1,from=0;
  for(let n=0;n<=occurrence;n++){start=text.indexOf(item.quote,from);if(start<0)break;from=start+item.quote.length}
  if(start<0)continue;
  const end=start+item.quote.length;if(!spans.some(s=>s.id===item.id&&s.start===start&&s.end===end))spans.push({id:item.id,start,end,quote:item.quote});
 }
 return {text,grammar:[...new Set(spans.map(s=>s.id))],spans};
}
