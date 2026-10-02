import test from 'node:test';import assert from 'node:assert/strict';import {validateGrammarAnalysis} from '../grammar-spans.js';
const points=[{id:'を'},{id:'ます'}];
test('grammar spans require a known point and exact sentence evidence',()=>{const r=validateGrammarAnalysis('本を読みます。',{matches:[{id:'を',quote:'を'},{id:'ます',quote:'読みます'},{id:'invented',quote:'本'},{id:'を',quote:'が'}]},points);assert.deepEqual(r.grammar,['を','ます']);assert.equal(r.spans[1].start,2);assert.equal(r.spans[1].end,6)});
test('repeated particles use the specified occurrence and reject missing occurrences',()=>{const r=validateGrammarAnalysis('本を、手紙を',{matches:[{id:'を',quote:'を',occurrence:1},{id:'を',quote:'を',occurrence:4}]},points);assert.equal(r.spans.length,1);assert.equal(r.spans[0].start,5)});
