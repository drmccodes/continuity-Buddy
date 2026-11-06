import {parseCsv,normaliseConsultations,clinicianCounts,analyse,proposalCsv,syntheticDemo} from './engine.mjs';
import {validateExportHeaders,validateSelectedMapping,filenameIsCsv} from './import-security.mjs';
const $=id=>document.getElementById(id);
let rows=null,events=[],quality=null,result=null,decisions={},statuses={},aliases={},isDemo=false,listSizes={},sessions={},validatedHeaders=null;
const show=(id,on=true)=>{
 $(id).hidden=!on;
 if(['clinicianPanel','resultsPanel'].includes(id)){
  $('clinicianOverview').hidden=!$('clinicianPanel').hidden || !$('resultsPanel').hidden;
  $('resultsOverview').hidden=!$('resultsPanel').hidden;
 }
};
const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=String(value??'');return e;};
const clear=id=>$(id).replaceChildren();
const percent=v=>v==null?'Not available':(100*v).toFixed(1)+'%';
const select=(items,value,change)=>{const s=document.createElement('select');for(const [v,label] of items){const o=text('option',label);o.value=v;s.append(o);}s.value=value;s.addEventListener('change',()=>change(s.value));return s;};
function error(message){$('message').textContent=message;$('message').className='status error';}
function tableRow(id,values){const tr=text('tr','');for(const v of values){const td=document.createElement('td');if(v instanceof Node)td.append(v);else td.textContent=String(v??'');tr.append(td);}$(id).append(tr);}
async function load(file){
 try{
  if(file.size>60_000_000)throw Error('File exceeds 60 MB.');
  if(!filenameIsCsv(file.name))throw Error('Please choose a CSV export, not an Excel file.');
  rows=parseCsv(await file.text());validatedHeaders=validateExportHeaders(rows[0],'consultations');isDemo=false;show('mapPanel');
  const cols={...validatedHeaders};clear('mappings');
  for(const [key,title] of [['patient','Patient identifier'],['date','Consultation date'],['clinician','Consulting clinician'],['usual','Usual GP'],['type','Consultation / slot type (optional)'],['status','Attendance status (optional)']]){
   const label=text('label',title);
   const options=[['-1','Not provided'],...rows[0].map((h,i)=>[String(i),h||'Column '+(i+1)])];
   const s=select(options,String(cols[key]??-1),()=>{});s.id='map-'+key;
   label.append(s);$('mappings').append(label);
  }
  $('message').textContent='CSV read locally. '+(rows.length-1).toLocaleString('en-GB')+' rows detected. Confirm column mappings.';$('message').className='status';
 }catch(e){rows=null;validatedHeaders=null;show('mapPanel',false);error(e.message);}
}
function runParsing(){
 try{
  const map=Object.fromEntries(['patient','date','clinician','usual','type','status'].map(k=>[k,Number($('map-'+k).value)]));
  if(!$('importConfirmed').checked)throw Error('Confirm this is an attended-GP-appointments export from an approved EMIS search.');
  validateSelectedMapping(validatedHeaders,map);
  const parsed=normaliseConsultations(rows,map,{referenceDate:$('referenceDate').value});
  events=parsed.events;quality=parsed.quality;isDemo=false;$('reviewConfirmed').checked=false;renderClinicians();show('clinicianPanel');show('importPanel',false);show('resultsPanel',false);
 }catch(e){error(e.message);}
}
function renderClinicians(){
 clear('clinicians');const clinicians=clinicianCounts(events);
 const names=clinicians.map(c=>c.name);
 for(const c of clinicians){
  if(statuses[c.name]==null)statuses[c.name]=/^(system|unknown|automated|booking|reception|administrator|admin|emis)/i.test(c.name)?'exclude':c.usualRows>0?'eligible':'nonlist';
  const status=select([['eligible','Eligible list holder'],['nonlist','Count visits, no list'],['exclude','Exclude from analysis'],['departed','Departed']],statuses[c.name],v=>{statuses[c.name]=v;});
  status.setAttribute('aria-label','Status of '+c.name);
  const alias=select([['','Not merged'],...names.filter(n=>n!==c.name).map(n=>[n,n])],aliases[c.name]||'',v=>{if(v&&aliases[v]===c.name){alias.value='';return;}aliases[c.name]=v;});
  alias.setAttribute('aria-label','Merge '+c.name+' into');
  tableRow('clinicians',[c.name,c.consultations.toLocaleString('en-GB'),status,alias]);
 }
}
function calculate(){
 try{
  if(!$('reviewConfirmed').checked)throw Error('Confirm you have checked list holders, locums and departed clinicians.');
  const minVisits=Number($('minVisits').value),high=Number($('high').value)/100,medium=Number($('medium').value)/100;
  if(!Number.isInteger(minVisits)||minVisits<1||minVisits>30||high<medium||high>1||medium<0.3)throw Error('Check the thresholds.');
  result=analyse(events,{statuses,aliases,minVisits,high,medium,listSizes,sessions});
  decisions={};show('clinicianPanel',false);show('resultsPanel');renderResults();
 }catch(e){window.alert(e.message);}
}
function renderResults(){
 const m=result.metrics;
 $('mPatients').textContent=m.frequent.toLocaleString('en-GB');$('mAccuracy').textContent=percent(m.usualAccuracy);$('mUpc').textContent=percent(m.meanUPC);$('mSlicc').textContent=percent(m.slicc);
 const names=result.gpRows.filter(g=>statuses[g.gp]!=='exclude').map(g=>g.gp);
 const selected=$('selectedGp').value;clear('selectedGp');
 for(const n of names){const o=text('option',n);o.value=n;$('selectedGp').append(o);}
 if(names.includes(selected))$('selectedGp').value=selected;
 renderPartnerRows();clear('swaps');clear('gpRows');clear('proposals');
 $('swapCount').textContent=result.pairs.length+' proposed reciprocal pairs. Export contains only approved rows, after manual review.';
 result.pairs.forEach((pair,index)=>{
  for(const p of [pair.a,pair.b]){
   const decision=select([['For review','For review'],['Approved','Suitable in principle'],['Rejected','Do not swap']],decisions[p.id]||'For review',v=>{decisions[p.id]=v;});
   decision.setAttribute('aria-label','Review patient '+p.id);
   tableRow('swaps',[index+1,p.id,p.from,p.to,p.top+' / '+p.n,decision]);
  }
 });
 for(const g of result.gpRows){
  const session=document.createElement('input');session.type='number';session.min='0.1';session.step='0.5';session.placeholder='-';session.value=sessions[g.gp]??'';
  session.setAttribute('aria-label','Weekly clinical sessions for '+g.gp);
  const per=text('span',g.perSession==null?'-':g.perSession.toFixed(1));
  session.addEventListener('change',()=>{const n=Number(session.value);if(session.value&&n>0&&n<100)sessions[g.gp]=n;else delete sessions[g.gp];per.textContent=listSizes[g.gp]!=null&&sessions[g.gp]? (listSizes[g.gp]/sessions[g.gp]).toFixed(1):'-';});
  tableRow('gpRows',[g.gp,g.patients,g.frequent,g.aligned,g.outgoing,g.incoming,percent(g.slicc),g.registered??'-',session,per]);
 }
 for(const p of result.proposals.slice(0,1500))tableRow('proposals',[p.id,p.from,p.to,p.n,percent(p.topShare),p.confidence]);
 const q=quality||{};clear('quality');
 const summary=text('p','Analysed '+m.consultations+' consultations across '+m.patients+' patient identifiers. '+result.excluded+' rows excluded by clinician settings. '+(q.duplicates||0)+' identical-looking appointment rows retained for review; '+(q.missingUsual||0)+' records lacked a usual GP; '+(q.excludedStatus||0)+' non-attended appointments filtered; '+(q.skippedDate||0)+' invalid dates excluded.');$('quality').append(summary);
}
function renderPartnerRows(){
 clear('partners');const mine=$('selectedGp').value;const count=new Map();
 for(const p of result.proposals){
  if(p.from!==mine&&p.to!==mine)continue;
  const other=p.from===mine?p.to:p.from;
  if(!count.has(other))count.set(other,{from:0,to:0});
  const item=count.get(other);if(p.from===mine)item.from++;else item.to++;
 }
 const ranked=[...count.entries()].sort((a,b)=>Math.min(b[1].from,b[1].to)-Math.min(a[1].from,a[1].to)||b[1].from+b[1].to-a[1].from-a[1].to);
 for(const [gp,c] of ranked)tableRow('partners',[gp,c.from,c.to,Math.min(c.from,c.to)]);
 if(!ranked.length)tableRow('partners',['No matching GP partners','-','-','-']);
}
function reset(){rows=null;events=[];quality=null;result=null;decisions={};statuses={};aliases={};isDemo=false;listSizes={};sessions={};validatedHeaders=null;$('importConfirmed').checked=false;$('reviewConfirmed').checked=false;$('file').value='';$('listFile').value='';$('listStatus').textContent='';show('mapPanel',false);show('resultsPanel',false);show('clinicianPanel',false);show('importPanel');$('message').textContent='';}
$('referenceDate').value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
$('listFile').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>60_000_000||!/\\.csv$/i.test(file.name))throw Error('Choose a CSV under 60 MB.');
  const data=parseCsv(await file.text()),columns=validateExportHeaders(data[0],'list');
  if(columns.patient<0||columns.usual<0)throw Error('List file must contain patient identifier and usual GP columns.');
  const seen=new Map();
  for(const row of data.slice(1)){
   const id=String(row[columns.patient]||'').trim(),gp=String(row[columns.usual]||'').trim();
   if(!id||!gp)continue;
   if(seen.has(id)&&seen.get(id)!==gp)throw Error('Conflicting usual GP values for the same patient identifier.');
   seen.set(id,gp);
  }
  if(seen.size===0)throw Error('No registered patient rows were found.');
  listSizes={};for(const gp of seen.values())listSizes[gp]=(listSizes[gp]||0)+1;
  $('listStatus').textContent='Loaded '+seen.size+' unique registered patients across '+Object.keys(listSizes).length+' lists. Data stays in memory.';
  if(result){result=analyse(events,{statuses,aliases,listSizes,sessions,minVisits:Number($('minVisits').value),high:Number($('high').value)/100,medium:Number($('medium').value)/100});renderResults();}
 }catch(err){$('listStatus').textContent='List import not accepted: '+err.message;}
});
$('file').addEventListener('change',e=>{if(e.target.files?.[0])load(e.target.files[0]);});
const drop=$('drop');
drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('drag');});
drop.addEventListener('dragleave',()=>drop.classList.remove('drag'));
drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag');if(e.dataTransfer.files?.[0])load(e.dataTransfer.files[0]);});
$('process').addEventListener('click',runParsing);
$('demo').addEventListener('click',()=>{reset();events=syntheticDemo();quality={totalRows:events.length};isDemo=true;$('reviewConfirmed').checked=false;renderClinicians();show('importPanel',false);show('clinicianPanel');});
$('run').addEventListener('click',calculate);
$('backImport').addEventListener('click',()=>{show('clinicianPanel',false);show('importPanel');});
$('editClinicians').addEventListener('click',()=>{show('resultsPanel',false);show('clinicianPanel');});
$('reset').addEventListener('click',reset);
$('selectedGp').addEventListener('change',renderPartnerRows);
$('download').addEventListener('click',()=>{
 const reviewed=result.pairs.filter(p=>decisions[p.a.id]==='Approved'&&decisions[p.b.id]==='Approved').flatMap(p=>[p.a,p.b]);
 if(!reviewed.length){window.alert('Approve both patients in at least one reciprocal pair before exporting.');return;}
 if(!window.confirm('This download contains confidential patient identifiers. Save it only to an approved NHS location. Continue?'))return;
 const csv=proposalCsv(reviewed,decisions);
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='continuitybuddy-reviewed-proposals.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);
});
