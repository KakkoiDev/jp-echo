// Only the first oversized, authored Minihongo starter is eligible for repair.
// Personal cards enriched with Minihongo links keep their original IDs/text/SRS.
export function isLegacyMiniCard(sentence){return sentence?.id?.startsWith('echo-import-')&&sentence.translationProvider==='authored-import'&&sentence.provenance?.project==='Minihongo'&&sentence.provenance.starterVersion!==2}
export function planMiniCleanup(sentences,catalogues={}){
 const removed=sentences.filter(isLegacyMiniCard),legacyIds=new Set((catalogues.words||[]).filter(w=>w.origin==='minihongo').map(w=>w.id));
 const words=(catalogues.words||[]).filter(w=>w.origin!=='minihongo'),grammar=(catalogues.grammar||[]).filter(p=>p.origin!=='minihongo');
 const kept=sentences.filter(s=>!isLegacyMiniCard(s)).map(s=>{
  // Compact cards explicitly requested later are never removed.
  if(s.provenance?.starterVersion===2)return s;
  const next={...s};if(Array.isArray(s.vocabulary))next.vocabulary=s.vocabulary.filter(id=>!legacyIds.has(id));
  if(Array.isArray(s.grammar))next.grammar=s.grammar.filter(id=>!id.startsWith('minihongo:'));
  if(Array.isArray(s.grammarAnalysis))next.grammarAnalysis=s.grammarAnalysis.map(a=>({...a,...(Array.isArray(a.grammar)?{grammar:a.grammar.filter(id=>!id.startsWith('minihongo:'))}:{}),...(Array.isArray(a.spans)?{spans:a.spans.filter(span=>!span.id?.startsWith('minihongo:'))}:{})}));
  return next;
 });
 return {removed,kept,catalogues:{words,grammar},changed:removed.length>0||words.length!==(catalogues.words||[]).length||grammar.length!==(catalogues.grammar||[]).length};
}
export async function repairMiniImport(sentences,catalogues,{archive,replace,saveCatalogues}){
 const plan=planMiniCleanup(sentences,catalogues);if(!plan.changed)return plan;
 // Commit the recovery copy before the deletion. Any failure leaves cards intact.
 await archive({schemaVersion:2,sentences:plan.removed,catalogues,kind:'Minihongo oversized starter cleanup',preservedCount:plan.kept.length});
 await replace(plan.kept,plan.removed);await saveCatalogues(plan.catalogues);return plan;
}
