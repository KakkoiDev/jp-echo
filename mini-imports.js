import {mergeSentences,replaceSentenceContent,stripFurigana} from './core.js';
// Only the first oversized, authored Minihongo starter is eligible for repair.
// Personal cards enriched with Minihongo links keep their original IDs/text/SRS.
export function isLegacyMiniCard(sentence){return sentence?.id?.startsWith('echo-import-')&&sentence.translationProvider==='authored-import'&&sentence.provenance?.project==='Minihongo'&&(sentence.provenance.starterVersion==null||sentence.provenance.starterVersion===1)}
export function planMiniCleanup(sentences,catalogues={}){
 const removed=sentences.filter(isLegacyMiniCard),legacyIds=new Set((catalogues.words||[]).filter(w=>w.origin==='minihongo').map(w=>w.id));
 const words=(catalogues.words||[]).filter(w=>w.origin!=='minihongo'),grammar=(catalogues.grammar||[]).filter(p=>p.origin!=='minihongo');
 const kept=sentences.filter(s=>!isLegacyMiniCard(s)).map(s=>{
  // Compact cards explicitly requested later are never removed.
  if(s.provenance?.starterVersion>=2)return s;
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

// Only an explicit version-3 reimport replaces compact version-2 word cards.
export function planMiniSentenceUpgrade(current,backup){
 if(backup.title!=='Mini Hongo starter library'||backup.starterVersion!==3)return {sentences:mergeSentences(current,backup.sentences),removed:[]};
 const incoming=new Map(backup.sentences.map(s=>[s.id,s])),links=new Map((backup.replacesWordCards||[]).map(r=>[r.oldId,r])),removed=[],candidates=new Map();
 const plain=s=>stripFurigana(s||'').normalize('NFKC').replace(/\s+/g,'');
 for(const old of current){const link=links.get(old.id),next=incoming.get(link?.newId);
  if(!next||old.translationProvider!=='authored-import'||old.provenance?.project!=='Minihongo'||old.provenance.starterVersion!==2||old.provenance.path!=='data/words.csv'||plain(old.casualTarget||old.target)!==plain(link.oldTarget))continue;
  removed.push(old);const previous=candidates.get(next.id);
  // Shared examples become one card; retain the most practised word's schedule.
  if(previous&&(Number(previous.srs?.reps)||0)>(Number(old.srs?.reps)||0))continue;
  const updated=replaceSentenceContent(old,{source:next.source,casual:next.casualTarget||next.target,polite:next.politeTarget||next.target});
  candidates.set(next.id,{...updated,id:next.id,provenance:next.provenance,vocabulary:next.vocabulary,grammar:next.grammar||[]});
 }
 const ids=new Set(removed.map(s=>s.id)),kept=current.filter(s=>!ids.has(s.id));
 return {removed,sentences:mergeSentences(mergeSentences(kept,[...candidates.values()]),backup.sentences)};
}
