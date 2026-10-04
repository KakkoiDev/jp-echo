import test from 'node:test';
import assert from 'node:assert/strict';
import {expandableList} from '../components.js';
class Element {
  constructor(){this.children=[];this.dataset={};this.attributes={};this.id='word-sentences'}
  append(...items){this.children.push(...items)}
  setAttribute(key,value){this.attributes[key]=value}
  querySelector(){return this.children.find(child=>child.dataset.component==='list-toggle')||null}
  remove(){}
}
test('vocabulary examples render five initially and toggle the remainder on demand',()=>{
  const previous=global.document;global.document={createElement:()=>new Element()};
  try{
    const host=new Element(),items=Array.from({length:12},(_,i)=>i),calls=[];
    const render=shown=>{calls.push(shown);host.children=[]};
    const control=expandableList({host,items,render});
    assert.deepEqual(calls,[items.slice(0,5)]);
    assert.equal(control.attributes['aria-expanded'],'false');
    assert.equal(control.attributes['aria-controls'],'word-sentences');
    control.onclick();assert.deepEqual(calls[1],items);assert.equal(control.textContent,'See less');
    control.onclick();assert.deepEqual(calls[2],items.slice(0,5));assert.equal(control.textContent,'See more');
    expandableList({host,items:items.slice(0,5),render});assert.equal(host.children.length,0);
    expandableList({host,items:[],render});assert.deepEqual(calls.at(-1),[]);
    expandableList({host,items,render});assert.deepEqual(calls.at(-1),items.slice(0,5));
  }finally{global.document=previous}
});
