/* Browser-only synthetic QA. This script is NOT part of the public application bundle. */
(async function(){
 const report={checks:[],errors:[]};
 const check=(label,passed)=>{report.checks.push({label,passed:!!passed});if(!passed)report.errors.push(label)};
 const delay=t=>new Promise(r=>setTimeout(r,t));
 const get=id=>document.getElementById(id);
 const flush=async()=>{for(let i=0;i<100;i++){if(!get('submit-import').disabled)return;await delay(30)}throw Error('Import timed out')};
 const sample=[
  ['owner','Dr Alpha',['900101','900102']],
  ['owner','Dr Beta',['900103','900104']],
  ['notseen','Dr Alpha',['900101','900102']],
  ['notseen','Dr Beta',['900103','900104']],
  ['seen','Dr Beta',['900101','900102']],
  ['seen','Dr Alpha',['900103']]
 ];
 const mark=()=>performance.getEntriesByType('resource').map(x=>x.name);
 try{
  check('App started',!!get('form')&&!!get('submit-import'));
  const initial=mark();
  for(const [kind,gp,ids] of sample){
   get('kind').value=kind;get('gp').value=gp;get('source-check').checked=true;
   const dt=new DataTransfer();
   dt.items.add(new File(['EMIS Number\n'+ids.join('\n')],'synthetic-only.csv',{type:'text/csv'}));
   get('file').files=dt.files;
   get('form').requestSubmit();
   await flush();
   if(!get('message').textContent.startsWith('Accepted'))throw Error('Synthetic import rejected');
  }
  check('Cohorts imported',get('cohorts').children.length===6);
  check('One reciprocal swap',get('metricPairs').textContent==='1');
  check('Export gated',get('download').disabled===true);
  get('coverage-check').click();
  check('Coverage confirmation enables export',get('download').disabled===false);
  const original=URL.createObjectURL;let blob;
  URL.createObjectURL=function(arg){blob=arg;return original.call(URL,arg)};
  get('download').click();
  URL.createObjectURL=original;
  const text=await blob.text();
  check('Minimised report',text.includes('900101')&&text.includes('900103')&&!text.includes('900102')&&!text.includes('900104'));
  check('No clinical text in report',!/(DOB|Address|Diagnosis|NHS Number)/.test(text));
  check('No browser storage',localStorage.length===0&&sessionStorage.length===0&&(await indexedDB.databases()).length===0);
  const reg=await Promise.race([navigator.serviceWorker.ready,delay(8000).then(()=>null)]);
  check('Offline shell installed',!!reg);
  if(reg){
   const names=await caches.keys();
   const urls=(await Promise.all(names.map(async n=>(await (await caches.open(n)).keys()).map(x=>x.url)))).flat();
   check('Only public shell assets cached',urls.length===7&&urls.every(u=>['/','/index.html','/style.css','/app.mjs','/logic.mjs','/manifest.webmanifest','/privacy.html'].includes(new URL(u).pathname)));
  }
  const later=mark().slice(initial.length);
  check('No patient IDs in network resource URLs',later.every(x=>!/(900101|900102|900103|900104)/.test(x)));
  window.confirm=()=>true;get('reset').click();
  check('Clear removes visible IDs',!document.body.textContent.includes('900101')&&!document.body.textContent.includes('900103'));
  check('Clear disables export',get('download').disabled===true);
  get('gp').value='Dr Alpha';get('kind').value='owner';get('source-check').checked=true;
  const evil=new DataTransfer();evil.items.add(new File(['EMIS Number\nJane Doe'],'malicious.csv',{type:'text/csv'}));get('file').files=evil.files;
  get('form').requestSubmit();await flush();
  check('Reject malicious record without leaking input',get('message').textContent.startsWith('Import rejected')&&!get('message').textContent.includes('Jane'));
 }catch(err){report.errors.push('Harness: '+String(err.message||err))}
 const node=document.createElement('pre');node.id='qa-result';node.textContent=JSON.stringify(report);document.body.append(node);
 document.documentElement.setAttribute('data-qa-complete','yes');
})();