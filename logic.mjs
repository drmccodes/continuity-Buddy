export const EMIS_HEADERS = new Set(['emis number','emis no','emis id','emis patient number','emis patient id','patient number','patient id','emisnumber','emisno','emisid']);
const forbidden = /\b(name|surname|forename|firstname|lastname|first name|last name|given|family|dob|birth|address|postcode|post code|phone|mobile|email|e-mail|nhs|gender|sex|age|diagnos|medic|clinical|note|consultation|date|telephone|patient details)\b/i;
export function parseCsv(text) {
  if (typeof text !== 'string' || text.length > 8_000_000) throw Error('File is empty or exceeds the 8 MB local limit.');
  const rows=[]; let row=[],field='',quote=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quote){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quote=false;else field+=c;}
    else if(c==='"'){if(field!=='')throw Error('Invalid CSV quoting.');quote=true;}
    else if(c===','){row.push(field);field='';}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(quote)throw Error('Unclosed quoted CSV field.');row.push(field);if(row.some(x=>x.trim()))rows.push(row);
  return rows;
}
export function validateEmisCsv(text){
  const rows=parseCsv(text);
  if(!rows.length)throw Error('Empty CSV.');
  if(rows.some(r=>r.length!==1))throw Error('Rejected: CSV must contain exactly ONE column: EMIS number. Remove all other columns, even if hidden.');
  const first=rows[0][0].trim();
  if(forbidden.test(first))throw Error('Rejected: identifying or clinical column detected. Export EMIS numbers only (not NHS numbers).');
  const canonical=first.toLowerCase().replace(/[_-]/g,' ').replace(/\s+/g,' ').trim();
  const hasHeader=EMIS_HEADERS.has(canonical);
  if(!hasHeader && /[a-z]/i.test(first))throw Error('Rejected: column heading is not recognised. Use "EMIS Number".');
  const ids=rows.slice(hasHeader?1:0).map(r=>r[0].trim());
  if(!ids.length)throw Error('No EMIS numbers found.');
  if(ids.length>30000)throw Error('Too many rows (max 30,000).');
  for(const id of ids){if(!/^\d{1,15}$/.test(id))throw Error('Rejected: values must contain EMIS numbers only (digits, max 15). No names, NHS numbers, dates or free text.');}
  return {ids:[...new Set(ids)], duplicates:ids.length-new Set(ids).size,rows:ids.length};
}
const pairKey=(a,b)=>[a,b].sort().join('\u0000');
export function analyse(cohorts, threshold=4){
  // Each imported cohort is an exact membership set, NOT proof of most frequent GP.
  const owners=new Map(), contacts=new Map(), excludes=new Map(), conflicts=new Set();
  for(const c of cohorts){
    if(!['owner','seen','notseen'].includes(c.kind)||!c.gp)continue;
    for(const id of c.ids){
      if(c.kind==='owner'){
        if(owners.has(id)&&owners.get(id)!==c.gp)conflicts.add(id);
        owners.set(id,c.gp);
      } else if(c.kind==='seen'){
        if(!contacts.has(id))contacts.set(id,new Set());contacts.get(id).add(c.gp);
      } else {
        if(!excludes.has(id))excludes.set(id,new Set());excludes.get(id).add(c.gp);
      }
    }
  }
  const eligible=[];
  for(const [id, owner] of owners){
    if(conflicts.has(id))continue;
    const contact=contacts.get(id)||new Set();
    const other=[...contact].filter(g=>g!==owner);
    if(other.length!==1)continue; // ambiguous: do not select a preferred clinician by guessing
    if(!excludes.get(id)?.has(owner))continue; // must have evidence of no recent contact with current GP
    eligible.push({id,from:owner,to:other[0],reason:`${threshold}+ recorded consultations with ${other[0]}; none recorded with ${owner} in the year`});
  }
  eligible.sort((a,b)=>a.from.localeCompare(b.from)||a.to.localeCompare(b.to)||a.id.localeCompare(b.id,undefined,{numeric:true}));
  const directions=new Map();
  for(const c of eligible){const k=`${c.from}\u0000${c.to}`;if(!directions.has(k))directions.set(k,[]);directions.get(k).push(c);}
  const pairs=[], visited=new Set();
  for(const c of eligible){const group=pairKey(c.from,c.to);if(visited.has(group))continue;visited.add(group);
    const [a,b]=group.split('\u0000');const ab=directions.get(`${a}\u0000${b}`)||[];const ba=directions.get(`${b}\u0000${a}`)||[];
    for(let i=0;i<Math.min(ab.length,ba.length);i++)pairs.push({first:ab[i],second:ba[i],gpA:a,gpB:b});
  }
  const matched=new Set(pairs.flatMap(p=>[p.first.id,p.second.id]));
  return {pairs,unmatched:eligible.filter(c=>!matched.has(c.id)),eligible,conflicts:[...conflicts],ownerCount:owners.size,contactCount:contacts.size};
}
export function safeCsvField(v){const s=String(v);const safe=/^[=+@\-\t\r]/.test(s)?"'"+s:s;return `"${safe.replace(/"/g,'""')}"`; }
export function proposalCsv(result){
 const lines=[['Swap','EMIS number','Current GP','Proposed GP','Status'].map(safeCsvField).join(',')];
 result.pairs.forEach((p,i)=>[p.first,p.second].forEach(c=>lines.push([i+1,c.id,c.from,c.to,'For clinical review - not approved'].map(safeCsvField).join(','))));
 return lines.join('\r\n')+'\r\n';
}
