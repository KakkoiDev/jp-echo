import test from 'node:test';import assert from 'node:assert/strict';import {createSentence,mergeSentences} from '../core.js';
const card=(id,target='本【ほん】です。')=>createSentence('It is a book.',target,new Date('2026-01-01'),id);
test('same text with different IDs/readings/layout merges without resetting progress',()=>{const old={...card('mine'),echoCount:9,srs:{due:'future'},reviews:[{at:'2026-01-02',rating:'ok'}]};const incoming={...card('starter','本 です。'),updatedAt:'2026-12-01'};const merged=mergeSentences([old],[incoming,incoming]);assert.equal(merged.length,1);assert.equal(merged[0].id,'mine');assert.deepEqual(merged[0].srs,old.srs);assert.equal(merged[0].echoCount,9)});
test('new sentences append and language pairs stay separate',()=>{const a=card('a'),b=card('b','猫です。'),c={...card('c'),sourceLang:'fr'};assert.equal(mergeSentences([a],[b,c]).length,3)});
test('duplicate imports enrich grammar and vocabulary links',()=>{const old={...card('a'),grammar:['です']};const other={...card('b'),grammar:['minihongo:gram-1'],vocabulary:[-1]};const out=mergeSentences([old],[other])[0];assert.deepEqual(out.grammar,['です','minihongo:gram-1']);assert.deepEqual(out.vocabulary,[-1])});

test('untagged imports stay eligible for grammar analysis',()=>{assert.equal(mergeSentences([card('a')],[card('b')])[0].grammar,undefined)});
test('a newer unreviewed backup cannot reset a reviewed card',()=>{const old={...card('a'),srs:{reps:5,due:'2027-01-01'}};const fresh={...card('a'),updatedAt:'2026-12-01',srs:{reps:0,due:'2026-01-01'}};assert.deepEqual(mergeSentences([old],[fresh])[0].srs,old.srs)});

test('review progress follows the schedule that won the merge, in both directions',async()=>{
  const {mergeSentences}=await import('../core.js');
  const base={...card('a'),createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'};
  const behind={...base,srs:{reps:2,state:1,due:'2026-02-01T00:00:00Z'},reviewTrack:{next:'reading'},lastRating:'again',reviews:[{at:'2026-01-02T00:00:00Z',rating:'again'}]};
  const ahead={...base,srs:{reps:5,state:2,due:'2026-03-01T00:00:00Z'},reviewTrack:{next:'writing'},lastRating:'ok',reviews:[{at:'2026-01-02T00:00:00Z',rating:'again'},{at:'2026-01-05T00:00:00Z',rating:'ok'}]};
  const [restored]=mergeSentences([behind],[ahead]);
  assert.equal(restored.srs.reps,5);assert.deepEqual(restored.reviewTrack,{next:'writing'});assert.equal(restored.lastRating,'ok');assert.equal(restored.reviews.length,2);
  const [kept]=mergeSentences([ahead],[behind]);
  assert.equal(kept.srs.reps,5);assert.deepEqual(kept.reviewTrack,{next:'writing'});assert.equal(kept.lastRating,'ok');
});
