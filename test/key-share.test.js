import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sealKey,openKey,readToken,normalizeUnlockCode,KeyShareError} from '../key-share.js';
import {exportBackup} from '../core.js';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('a shared key opens with its unlock code and only with it',async()=>{
 const {token,code}=await sealKey({provider:'deepseek',key:'sk-test',model:'deepseek-chat'},30);
 assert.match(code,/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/,'12 Crockford characters in three groups');
 assert.equal(token.split('.').length,4);assert.ok(token.startsWith('v1.'));
 assert.doesNotMatch(token,/sk-test/,'the key is not readable in the link');
 const body=await openKey(token,code.toLowerCase().replace(/-/g,' '));
 assert.equal(body.provider,'deepseek');assert.equal(body.key,'sk-test');assert.equal(body.model,'deepseek-chat');
 assert.ok(body.exp>Date.now()+29*86400000);
 await assert.rejects(openKey(token,'0000-0000-0000'),e=>e instanceof KeyShareError&&e.code==='wrong-code');
});

test('expired, damaged and foreign links are refused',async()=>{
 const {token,code}=await sealKey({provider:'openai',key:'k'},7,Date.now()-8*86400000);
 await assert.rejects(openKey(token,code),e=>e.code==='expired');
 await assert.rejects(openKey('v1.abc',code),e=>e.code==='malformed');
 await assert.rejects(openKey('v2.a.b.c',code),e=>e.code==='malformed');
 const forever=await sealKey({provider:'openai',key:'k'},0);assert.equal((await openKey(forever.token,forever.code)).exp,undefined,'no limit has no expiry');
});

test('the unlock code survives being typed: case, spaces, missing dashes, O and I/L',()=>{
 assert.equal(normalizeUnlockCode('ab1o-2il3 4567'),'AB1021134567');
 assert.equal(readToken('#key=v1.a.b.c'),'v1.a.b.c');assert.equal(readToken('#tools'),null);
});

test('a shared key is a credential: never in an export, a backup or the gist',()=>{
 const backup=exportBackup([],{provider:'deepseek',providerKeys:{deepseek:'sk-shared'},sharedKey:{provider:'deepseek',exp:1}},[]);
 assert.equal(JSON.stringify(backup).includes('sk-shared'),false);
});

test('Invite someone and the arrival sheet: the key travels in the #fragment, then leaves the address',()=>{
 const app=read('app.js'),html=read('index.html'),sw=read('sw.js');
 assert.match(html,/id="settings-row-invite"/);assert.match(html,/<dialog id="invite-dialog"/);assert.match(html,/<dialog id="arrival-dialog"/);
 assert.match(html,/Unlock code: send it separately, not with the link/);
 assert.match(app,/url\.hash="key="\+invite\.sealed\.token/,'the token goes after #, which browsers never send to a server');
 assert.match(app,/history\.replaceState\(history\.state,"",location\.pathname\+location\.search\);/,'after unlocking, the token leaves the address');
 assert.match(app,/navigator\.share\(\{title:"Echo",url:\$\("#invite-url"\)\.value\}\)/,'Share sends the link only, never the code');
 assert.match(app,/SHAREABLE_PROVIDERS=\["google","deepseek","openai","anthropic"\]/);
 assert.match(app,/function expireSharedKey/);
 assert.match(sw,/"\.\/key-share\.js"/,'cached for offline');
});
