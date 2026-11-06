// Pure, dependency-free, browser-safe ContinuityBuddy analysis engine.
// No network, storage, DOM or logging. All identifiers are confidential.
export function parseCsv(source) {
  if (typeof source !== 'string' || !source.trim()) throw Error('The file is empty.');
  if (source.length > 60_000_000) throw Error('CSV exceeds the 60 MB safety limit.');
  const out=[]; let row=[], field='', quoted=false, afterQuote=false;
  source=source.replace(/^\uFEFF/,'');
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(quoted) { if(c==='"' && source[i+1]==='"'){field+='"';i++;} else if(c==='"'){quoted=false;afterQuote=true;}else field+=c; }
    else if(afterQuote) {if(c===','){row.push(field);field='';afterQuote=false;}else if(c==='\r'||c==='\n'){row.push(field);if(row.some(x=>x.trim()))out.push(row);row=[];field='';afterQuote=false;if(c==='\r'&&source[i+1]==='\n')i++;}else if(c!==' '&&c!=='\t')throw Error('Invalid CSV quoting.');}
    else if(c==='"'){if(field)throw Error('Invalid CSV quoting.');quoted=true;}
    else if(c===','){row.push(field);field='';}
    else if(c==='\r'||c==='\n'){row.push(field);if(row.some(x=>x.trim()))out.push(row);row=[];field='';if(c==='\r'&&source[i+1]==='\n')i++;}
    else field+=c;
  }
  if(quoted)throw Error('Unclosed CSV quote.');
  row.push(field);if(row.some(x=>x.trim()))out.push(row);
  if(out.length>500000)throw Error('Too many rows: maximum 500,000.');
  if(!out.length)throw Error('The file contains no rows.');
  const width=out[0].length;
  if(width>150||out.some(r=>r.length!==width))throw Error('CSV rows have inconsistent column counts.');
  return out;
}
const norm=s=>String(s??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ');
export function guessColumns(headers){
 const rules={
  patient:[/^(emis )?(patient )?(number|id)$/, /nhs number/,/patient identifier/,/patient id/,/patient number/],
  date:[/consultation.*date/,/appointment.*date/,/appt.*date/,/^date$/, /event date/],
  clinician:[/consultation.*(user|clinician|doctor|gp)/,/appointment.*(clinician|user|doctor|gp)/,/consulting (clinician|gp|doctor)/,/seen by/,/staff member.*full name/,/clinician/],
  usual:[/usual gp/,/registered gp/,/named gp/,/allocated gp/,/usual doctor/],
  type:[/consultation type/,/appointment type/,/slot type/,/event type/],
  status:[/appointment status/,/attendance status/]
 };
 const used=new Set();const result={};for(const [name,patterns] of Object.entries(rules)){
  const options=headers.map((h,i)=>({i,h:norm(h)})).filter(x=>!used.has(x.i));
  const match=patterns.map(p=>options.find(x=>p.test(x.h))).find(Boolean);
  result[name]=match?.i??-1;if(match)used.add(match.i);
 }return result;
}
export function parseDate(value){
 const s=String(value??'').trim();if(!s)return null;
 if(/^\d{4}-\d{2}-\d{2}/.test(s)){const d=new Date(s.slice(0,10)+'T12:00:00Z');return Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==s.slice(0,10)?null:s.slice(0,10);}
 const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(m){const iso=m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');return parseDate(iso);}
 if(/^\d{5}(\.\d+)?$/.test(s)){const d=new Date((Number(s)-25569)*86400000);return Number.isNaN(d.getTime())?null:d.toISOString().slice(0,10);}
 return null;
}
function cell(r,index){return index>=0?String(r[index]??'').trim():'';}
export function normaliseConsultations(rows,map,{referenceDate='2026-11-06',months=12}={}){
 if(!Array.isArray(rows)||rows.length<2)throw Error('A header and consultation rows are required.');
 for(const k of ['patient','date','clinician','usual']) if(!Number.isInteger(map[k])||map[k]<0||map[k]>=rows[0].length)throw Error('Please select all four required columns.');
 if(new Set(['patient','date','clinician','usual'].map(k=>map[k])).size<4)throw Error('Required columns must be different.');
 const ref=parseDate(referenceDate);if(!ref)throw Error('Invalid analysis date.');
 const cutoff=new Date(ref+'T12:00:00Z');cutoff.setUTCMonth(cutoff.getUTCMonth()-months);
 const min=cutoff.toISOString().slice(0,10);
 let skippedDate=0,skippedOld=0,skippedFuture=0,missingId=0,missingClinician=0,missingUsual=0,excludedStatus=0,duplicates=0;
 const events=[],unique=new Set();
 for(const r of rows.slice(1)){
  const id=cell(r,map.patient),usual=cell(r,map.usual),clinician=cell(r,map.clinician),date=parseDate(cell(r,map.date));
  if(!id){missingId++;continue;}if(!date){skippedDate++;continue;}if(date<min){skippedOld++;continue;}if(date>ref){skippedFuture++;continue;}
  if(!clinician){missingClinician++;continue;}if(!usual)missingUsual++;
  const status=cell(r,map.status);
  if(/^(cancelled|canceled|did not attend|dna|not attended|booked|pending)$/i.test(status)){excludedStatus++;continue;}
  const type=cell(r,map.type);
  const key=JSON.stringify([id,clinician,date,type,status]);
  if(unique.has(key)){duplicates++;continue;}unique.add(key);
  events.push({id,usual,clinician,date,type,status});
 }
 if(missingId)throw Error(missingId+' rows have no patient identifier. Re-export from EMIS with BOTH replicate patient and usual GP options enabled.');
 if(!events.length)throw Error('No usable consultations within the selected period.');
 return {events,quality:{skippedDate,skippedOld,skippedFuture,missingId,missingClinician,missingUsual,excludedStatus,duplicates,totalRows:rows.length-1},window:{start:min,end:ref}};
}
export function clinicianCounts(events){
 const counts=new Map();for(const e of events){for(const k of [e.clinician,e.usual])if(k&&!counts.has(k))counts.set(k,{name:k,consultations:0,usualRows:0});if(e.clinician)counts.get(e.clinician).consultations++;if(e.usual)counts.get(e.usual).usualRows++;}
 return [...counts.values()].sort((a,b)=>b.consultations-a.consultations||a.name.localeCompare(b.name));
}
export function analyse(events,opts={}){
 const minVisits=Math.max(1,Number(opts.minVisits)||4),high=Math.min(1,Math.max(0,Number(opts.high??0.65))),medium=Math.min(high,Math.max(0,Number(opts.medium??0.5)));
 const statuses=opts.statuses||{},aliases=opts.aliases||{},sessions=opts.sessions||{},listSizes=opts.listSizes||{};
 const statusOf=n=>statuses[n]||'eligible';const canonical=n=>aliases[n]||n;
 const groups=new Map();let excluded=0;
 for(const e of events){
  const doc=canonical(e.clinician),usual=canonical(e.usual);
  if(statusOf(e.clinician)==='exclude'||statusOf(doc)==='exclude'){excluded++;continue;}
  if(!groups.has(e.id))groups.set(e.id,{id:e.id,visits:[],usualValues:new Map()});
  const g=groups.get(e.id);g.visits.push({...e,clinician:doc,usual});
  if(usual)g.usualValues.set(usual,(g.usualValues.get(usual)||0)+1);
 }
 const patients=[],byGp=new Map(),proposals=[],fragmented=[];
 let totalVisits=0,ownVisits=0,upcSum=0,clearAligned=0,clearMismatch=0;
 for(const g of groups.values()){
  const visits=g.visits.sort((a,b)=>a.date.localeCompare(b.date));
  const counts=new Map();for(const v of visits)counts.set(v.clinician,(counts.get(v.clinician)||0)+1);
  const n=visits.length;if(!n)continue;
  const ranked=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  const top=ranked[0][1],tops=ranked.filter(v=>v[1]===top).map(v=>v[0]);
  const usual=[...g.usualValues.entries()].sort((a,b)=>b[1]-a[1]||b[0].localeCompare(a[0]))[0]?.[0]||'';
  const matched=counts.get(usual)||0;
  totalVisits+=n;ownVisits+=matched;
  if(usual&&!byGp.has(usual))byGp.set(usual,{gp:usual,patients:0,frequent:0,visits:0,ownVisits:0,aligned:0,outgoing:0,incoming:0});
  if(usual){const s=byGp.get(usual);s.patients++;s.visits+=n;s.ownVisits+=matched;}
  if(n<minVisits)continue;
  upcSum+=top/n;
  const topEligible=tops.filter(t=>statusOf(t)==='eligible');
  const ownIsTop=tops.includes(usual);
  const departed=statusOf(usual)==='departed';
  const clear=top/n>=medium&&tops.length===1&&topEligible.length===1;
  let category='fragmented',to='',confidence='';
  if(!usual){category='missing-usual';}
  else if(g.usualValues.size>1){category='conflicting-usual';}
  else if(ownIsTop&&!departed){category='aligned';clearAligned++;}
  else if(clear){to=topEligible[0];category=departed?'departed':'reallocate';confidence=top/n>=high?'high':'medium';clearMismatch++;}
  else if(departed){category='departed-review';}
  const p={id:g.id,from:usual,to,n,top,topShare:top/n,ownCount:matched,counts:Object.fromEntries(ranked),category,confidence,dayCount:new Set(visits.map(v=>v.date)).size};
  patients.push(p);
  if(usual){byGp.get(usual).frequent++;if(category==='aligned')byGp.get(usual).aligned++;if(to&&to!==usual)byGp.get(usual).outgoing++;}
  if(to&&to!==usual){proposals.push(p);if(!byGp.has(to))byGp.set(to,{gp:to,patients:0,frequent:0,visits:0,ownVisits:0,aligned:0,outgoing:0,incoming:0});byGp.get(to).incoming++;}
  else if(category!=='aligned')fragmented.push(p);
 }
 proposals.sort((a,b)=>(b.topShare-a.topShare)||(b.n-a.n)||(a.id.localeCompare(b.id)));
 const pairMap=new Map();
 for(const p of proposals){const key=[p.from,p.to].sort().join('\u0000');if(!pairMap.has(key))pairMap.set(key,{key,gps:[p.from,p.to].sort(),forward:[],backward:[]});const pair=pairMap.get(key);(p.from===pair.gps[0]?pair.forward:pair.backward).push(p);}
 const pairs=[];for(const group of pairMap.values())if(group.forward.length&&group.backward.length){
  const count=Math.min(group.forward.length,group.backward.length);
  for(let i=0;i<count;i++)pairs.push({a:group.forward[i],b:group.backward[i],gps:group.gps});
 }
 const gpRows=[...byGp.values()].map(g=>({...g,slicc:g.visits?g.ownVisits/g.visits:null,registered:listSizes[g.gp]??null,sessions:sessions[g.gp]??null,perSession:(listSizes[g.gp]!=null&&sessions[g.gp]>0)?listSizes[g.gp]/sessions[g.gp]:null})).sort((a,b)=>a.gp.localeCompare(b.gp));
 const eligible=patients.length;
 return {patients,proposals,fragmented,pairs,gpRows,excluded,metrics:{patients:groups.size,frequent:eligible,consultations:totalVisits,meanUPC:eligible?upcSum/eligible:null,usualAccuracy:clearAligned+clearMismatch?clearAligned/(clearAligned+clearMismatch):null,slicc:totalVisits?ownVisits/totalVisits:null,clearAligned,clearMismatch}};
}
export function safeCsv(value){const s=String(value??'');const protectedValue=/^[\s\x00-\x1f]*[=+@\-\t\r]/.test(s)?"'"+s:s;return '"'+protectedValue.replace(/"/g,'""')+'"';}
export function proposalCsv(proposals,decisions={}){
 const rows=[['Patient ID','Current usual GP','Proposed usual GP','Consultations','Seen proposed GP','Seen usual GP','Share','Confidence','Review decision']];
 for(const p of proposals)rows.push([p.id,p.from,p.to,p.n,p.top,p.ownCount,(100*p.topShare).toFixed(1)+'%',p.confidence,decisions[p.id]||'For review']);
 return rows.map(r=>r.map(safeCsv).join(',')).join('\r\n');
}
export function syntheticDemo(){
 const events=[];const put=(id,usual,doc,n,offset=0)=>{for(let i=0;i<n;i++)events.push({id,usual,clinician:doc,date:'2026-'+String(1+Math.floor((i+offset)%10)).padStart(2,'0')+'-15',type:'GP',status:'Attended'});};
 for(let j=1;j<=18;j++){const id='DEMO-'+String(j).padStart(3,'0'),owner=j<=9?'Dr Ash':'Dr Birch',other=owner==='Dr Ash'?'Dr Birch':'Dr Ash';put(id,owner,j%3===0?owner:other,j%3===0?5:6,j);if(j%3!==0)put(id,owner,owner,1,j);}
 return events;
}
