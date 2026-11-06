import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const sh=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
const current=readFileSync('service-worker.js','utf8');
const version=text=>text.match(/const VERSION = '([^']+)'/)?.[1];
assert.match(version(current)||'',/^continuitybuddy-shell-[a-z0-9-]+$/);
assert.doesNotMatch(current,/^\s*(?:self\.)?skipWaiting\(/m);
assert.doesNotMatch(current,/^\s*(?:self\.)?clients\.claim\(/m);
try {
 const base=sh('merge-base','HEAD','origin/main');
 const previous=sh('show',base+':service-worker.js');
 const changed=sh('diff','--name-only',base,'HEAD').split('\n');
 const shell=new Set(['index.html','style.css','app.mjs','logic.mjs','manifest.webmanifest','privacy.html','service-worker.js']);
 if(changed.some(file=>shell.has(file)))assert.notEqual(version(current),version(previous),'Release shell changed without a new cache VERSION; unsafe for active sessions.');
} catch(e){
 if(e?.code==='ERR_ASSERTION')throw e;
 // Initial release has no service worker in main. Subsequent releases must be checked.
 console.log('No previous service worker at base: initial release.');
}
console.log('PASS: service-worker version/update policy');
