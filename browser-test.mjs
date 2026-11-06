/**
 * Dependency-free Chromium/CDP end-to-end security test.
 * Test data is synthetic. Run with: node browser-test.mjs
 * Chrome/Chromium is the only external test prerequisite.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {spawn, execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const allowed = new Set(['/', '/index.html', '/style.css', '/app.mjs', '/logic.mjs', '/service-worker.js', '/manifest.webmanifest', '/privacy.html']);
const types = {'.html':'text/html', '.css':'text/css', '.mjs':'text/javascript', '.js':'text/javascript', '.webmanifest':'application/manifest+json'};
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; manifest-src 'self'; worker-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'";
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const route = url.pathname;
  if (req.method !== 'GET' || !allowed.has(route) || url.search) {res.writeHead(404);res.end();return;}
  try {
    const path = route === '/' ? 'index.html' : route.slice(1);
    const bytes = await readFile(join(process.cwd(), path));
    const suffix = '.' + path.split('.').at(-1);
    res.writeHead(200, {'Content-Type': (types[suffix] || 'text/plain') + ';charset=utf-8','Content-Security-Policy':route === '/service-worker.js' ? CSP.replace("connect-src 'none'", "connect-src 'self'") : CSP,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
    res.end(bytes);
  } catch {res.writeHead(404);res.end();}
});
const delay = t => new Promise(resolve => setTimeout(resolve, t));
async function main(){
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const profile = await mkdtemp(join(tmpdir(), 'continuitybuddy-browser-'));
  const chrome = process.env.CHROME_PATH || (()=>{
    try {return execFileSync('which',['chromium'],{encoding:'utf8'}).trim();}
    catch {return 'google-chrome';}
  })();
  const proc = spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
  let socket;
  try {
    const endpoint = await new Promise((resolve,reject)=>{
      let stderr='';let timeout=setTimeout(()=>reject(Error('Chrome debugging endpoint did not appear')),15000);
      proc.stderr.on('data',d=>{stderr += String(d);const match=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timeout);resolve(match[1]);}});
      proc.on('exit',code=>{clearTimeout(timeout);reject(Error('Chrome exited before CDP connection: '+code));});
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
    let nextId=0; const pending=new Map(), requests=[];
    socket.addEventListener('message',e=>{
      const m=JSON.parse(e.data);
      if(m.id && pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}
      if(m.method==='Network.requestWillBeSent')requests.push({url:m.params.request.url,method:m.params.request.method,postData:m.params.request.postData||''});
    });
    function send(method,params={},sessionId){
      const id=++nextId;
      return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timed out: '+method));},12000);
        pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value)},reject:error=>{clearTimeout(timer);reject(error)}});
        socket.send(JSON.stringify({id,method,params,...sessionId?{sessionId}:{}}));});
    }
    const target=await send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});
    await send('Page.enable',{},sessionId);
    await send('Runtime.enable',{},sessionId);
    await send('Network.enable',{},sessionId);
    async function evaluate(expression){
      const value=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);
      if(value.exceptionDetails)throw Error('In-browser exception: '+value.exceptionDetails.text);
      return value.result?.value;
    }
    async function waitFor(expression,timeout=12000){
      const until=Date.now()+timeout;
      do {try{if(await evaluate(expression))return;}catch{}await delay(120);}while(Date.now()<until);
      throw Error('Browser assertion timeout: '+expression);
    }
    await send('Page.navigate',{url:origin+'/'},sessionId);
    await waitFor("document.querySelector('h1')?.textContent?.includes('Better usual GP allocations.')");
    await waitFor("!!navigator.serviceWorker");
    await evaluate("navigator.serviceWorker.ready.then(()=>true)");
    await send('Page.reload',{ignoreCache:true},sessionId);
    await waitFor("!!navigator.serviceWorker.controller");
    await waitFor("document.getElementById('form') !== null");

    const data=[
      ['owner','Dr Alpha','900001','900002'],
      ['owner','Dr Beta','900003','900004'],
      ['notseen','Dr Alpha','900001','900002'],
      ['notseen','Dr Beta','900003','900004'],
      ['seen','Dr Beta','900001','900002'],
      ['seen','Dr Alpha','900003']
    ];
    async function importCohorts(){
      for(const [kind,gp,...ids] of data){
        await evaluate(`(() => {document.getElementById('kind').value=${JSON.stringify(kind)};document.getElementById('gp').value=${JSON.stringify(gp)};
          document.getElementById('source-check').checked=true;
          const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify('EMIS Number\n')}+${JSON.stringify(ids.join('\n'))}], 'synthetic.csv',{type:'text/csv'}));
          document.getElementById('file').files=dt.files;
          document.getElementById('form').requestSubmit();return true;})()`);
        await waitFor("!document.getElementById('submit-import').disabled");
      }
    }
    await importCohorts();
    assert.equal(await evaluate("document.getElementById('metricPairs').textContent"),'1');
    assert.equal(await evaluate("document.getElementById('download').disabled"),true);
    await evaluate("document.getElementById('coverage-check').click()");
    assert.equal(await evaluate("document.getElementById('download').disabled"),false);
    const report=await evaluate("(async()=>{const saved=URL.createObjectURL;let blob;URL.createObjectURL=function(v){blob=v;return saved.call(this,v)};document.getElementById('download').click();URL.createObjectURL=saved;return await blob.text();})()");
    assert.match(report,/900001/);assert.match(report,/900003/);assert.doesNotMatch(report,/900002/);
    assert.doesNotMatch(report,/(Name|DOB|Address|NHS Number|https?:\/\/)/);

    const state=await evaluate("(async()=>({local:localStorage.length,session:sessionStorage.length,dbs:(await indexedDB.databases()).length,caches:await Promise.all((await caches.keys()).map(async name=>(await caches.open(name)).keys().then(keys=>keys.map(k=>k.url))))}))()");
    assert.equal(state.local,0);assert.equal(state.session,0);assert.equal(state.dbs,0);
    assert.ok(state.caches.flat().every(url=>allowed.has(new URL(url).pathname)));
    await evaluate("window.confirm=()=>true;document.getElementById('reset').click()");
    assert.equal(await evaluate("document.body.textContent.includes('900001')"),false);

    // An asynchronous import must not resurrect identifiers after Clear.
    await evaluate("(() => {let done;File.prototype.text=()=>new Promise(r=>{done=r;window.__finishImport=()=>r('EMIS Number\\n999987')});const dt=new DataTransfer();dt.items.add(new File(['EMIS Number\\n999987'],'synthetic.csv'));document.getElementById('file').files=dt.files;document.getElementById('gp').value='Dr Alpha';document.getElementById('source-check').checked=true;document.getElementById('form').requestSubmit();document.getElementById('reset').click();window.__finishImport();return true})()");
    await delay(200);
    assert.equal(await evaluate("document.body.textContent.includes('999987')"),false);

    // Offline refresh: the cached application shell must load without a server.
    await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0},sessionId);
    await send('Page.reload',{ignoreCache:true},sessionId);
    await waitFor("document.getElementById('form') !== null && document.querySelector('h1')?.textContent.includes('Better usual GP allocations.')");
    await importCohorts();
    assert.equal(await evaluate("document.getElementById('metricPairs').textContent"),'1');
    // No synthetic patient value may occur in outbound requests, regardless of online/offline.
    assert.ok(requests.every(x=>x.url.startsWith(origin+'/')), 'Unexpected cross-origin browser request');
    assert.ok(requests.every(x=>!/(900001|900002|900003|900004|999987)/.test(x.url+x.postData)), 'Patient marker leaked in network traffic');
    assert.ok(requests.every(x=>x.method==='GET'), 'Unexpected network write');
    console.log('PASS: browser import, matching, review, minimised export, clear, async race, storage, network isolation and offline reload');
  } finally {
    try{socket?.close();}catch{}
    proc.kill('SIGTERM');
    await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:250});
    server.close();
  }
}
main().catch(error=>{console.error('Browser security test failed:',error.message);process.exitCode=1;server.close();});
