import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {bookIds,form} from "../n2-forms.js";
import {scored} from "../n2-progress.js";

const json=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),"utf8"));
const inventory=json("../n2-inventory.json"),base=json("../n2-echo-bank.json");

test("all twenty four-skill forms have usable keys and the themed vocabulary targets are disjoint",()=>{
  assert.equal(bookIds.length,20);
  const words=new Set(), passages=new Set();
  for(const id of bookIds){
    const questions=form(id,inventory,base);
    assert.equal(questions.length,101);
    assert.deepEqual(["Vocabulary","Grammar","Reading","Listening"].map(s=>questions.filter(q=>q.skill===s).length),[30,21,20,30]);
    for(const q of questions){
      assert.ok(q.prompt && q.why && q.choices[q.key-1]);
      assert.equal(new Set(q.choices).size,q.choices.length);
      if(q.skill==="Reading" || q.skill==="Listening")assert.ok(q.context);
      if(id!==bookIds[0] && q.skill==="Vocabulary"){
        const target=JSON.stringify(q.target);
        assert.ok(!words.has(target));words.add(target);
      }
    }
    const passage=questions.find(q=>q.skill==="Reading").context;
    assert.ok(!passages.has(passage));passages.add(passage);
  }
  assert.equal(words.size,570);
});

test("working answers do not count as exam evidence until their section closes",()=>{
  const paper={id:"p",questions:[{skill:0,key:1},{skill:3,key:2}]};
  const attempt={id:"a",book:"p",answers:[1,0],guesses:[true,false],time:[3500,0]};
  const run=phase=>scored({papers:[paper],attempts:[{...attempt,phase}]});
  assert.equal(run("written").length,0);
  assert.equal(run("rest").length,1);
  assert.equal(run("listening").length,1);
  assert.deepEqual(run("results").map(r=>[r.correct,r.guessed,r.answered]),[[true,true,true],[false,false,false]]);
});

test("every N2 inventory target can be checked with an answer",()=>{
  assert.equal(inventory.words.length,1748);assert.equal(inventory.grammar.length,221);
  for(const row of [...inventory.words,...inventory.grammar])assert.ok(row.every(Boolean));
});
