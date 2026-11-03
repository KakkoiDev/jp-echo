import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FAMILY_TOPICS,familyTopics,validateFamilyCurriculum} from '../kanji-families.js';
const deck=validateFamilyCurriculum(JSON.parse(readFileSync(new URL('../decks/kanji-families-curriculum.json',import.meta.url),'utf8')));
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8'),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('the eighteen curriculum themes fold into the ten topics of MapFamilies.dc.html, losing no family',()=>{
  const topics=familyTopics(deck);
  assert.deepEqual(topics.map(t=>t.label),FAMILY_TOPICS.map(t=>t.label));
  assert.equal(topics.length,10);
  const families=deck.families||deck.kanjiFamilies;
  assert.equal(topics.reduce((n,t)=>n+t.families.length,0),families.length);
  for(const topic of topics){assert.match(topic.key,/^topic-/);assert.equal(topic.level,'');assert.ok(topic.chars.length>0)}
});

test('a theme the fold does not know keeps a topic of its own',()=>{
  const topics=familyTopics({kanjiFamilies:[{kanji:'行',theme:'Actions'},{kanji:'海',theme:'Seas & islands'}]});
  assert.deepEqual(topics.map(t=>[t.label,t.chars.join('')]),[['Actions','行'],['Seas & islands','海']]);
});

test('Group by is one segmented control over one wall, not a second panel',()=>{
  assert.match(html,/<div id="kanji-group" class="segmented" role="tablist"/);
  assert.match(html,/data-group="jlpt"[^>]*>JLPT level</);assert.match(html,/data-group="meaning"[^>]*>Meaning</);
  // Topics are drawn by the same band renderer as the JLPT wall.
  assert.match(app,/for\(const topic of topics\)host\.append\(renderKanjiBand\(/);
  assert.match(app,/kanjiGroup:settings\.kanjiGroup\|\|"jlpt"/);
});
