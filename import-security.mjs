// Only the minimum reporting fields necessary for continuity analysis are accepted.
// Fail closed on unexpected columns, including accidental clinical or demographic data.
const normalise = value => String(value ?? '').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/[_.-]+/g,' ').replace(/\s+/g,' ');
const headings = {
 patient: ['patient id','patient identifier','emis number','emis id','emis patient id','emis patient number'],
 usual: ['usual gp','usual gp full name','named gp','registered gp','allocated gp','usual doctor'],
 date: ['appt date','appointment date','consultation date','event date'],
 clinician: ['staff members full name',"staff member's full name",'consulting clinician','consulting gp','clinician','consultation clinician','seen by'],
 type: ['session holders user type',"session holder's user type",'appointment type','consultation type','slot type','event type'],
 status: ['appointment status','attendance status']
};
const allowed = Object.fromEntries(Object.entries(headings).flatMap(([key,values])=>values.map(value=>[normalise(value),key])));
export function validateExportHeaders(headers,mode='consultations'){
 if(!Array.isArray(headers)||headers.length<2||headers.length>8)throw Error('Unexpected CSV structure. Export only the minimum required fields.');
 const encountered = new Set(), columns={};let unexpected=0,duplicated=0;
 for(let i=0;i<headers.length;i++){
  const header=normalise(headers[i]);const key=allowed[header];
  if(!header||!key||(mode==='list'&&!['patient','usual'].includes(key))){unexpected++;continue;}
  if(encountered.has(key)){duplicated++;continue;}
  encountered.add(key);columns[key]=i;
 }
 if(unexpected||duplicated){
  throw Error('CSV rejected: '+unexpected+' unrecognised or unnecessary column(s), '+duplicated+' duplicate field(s). Export only patient ID, usual GP, appointment date, consulting clinician and optional appointment type/status. No names, NHS numbers, clinical information or demographic columns.');
 }
 const required=mode==='list'?['patient','usual']:['patient','usual','date','clinician'];
 const missing=required.filter(k=>columns[k]===undefined);
 if(missing.length)throw Error('CSV rejected: required reporting field(s) missing: '+missing.join(', ')+'. Re-export using the ContinuityBuddy EMIS XML.');
 return columns;
}
export function validateSelectedMapping(validated,map,mode='consultations'){
 const required=mode==='list'?['patient','usual']:['patient','usual','date','clinician'];
 for(const key of required)if(map[key]!==validated[key])throw Error('Column mapping does not match verified minimal-data headings. Check the EMIS export.');
 for(const key of ['type','status'])if(map[key]!==undefined&&map[key]!==-1&&map[key]!==validated[key])throw Error('Optional column mapping does not match the verified header.');
 return true;
}
export function filenameIsCsv(name){return typeof name==='string'&&/\.csv$/i.test(name);}

/** Find the actual EMIS table header after optional report metadata.
 * Reject unknown headers and inconsistent table rows; never silently discard patient rows.
 */
export function extractReportTable(rows,mode='consultations'){
 if(!Array.isArray(rows)||!rows.length)throw Error('Empty CSV.');
 const required=mode==='list'?['patient','usual']:['patient','usual','date','clinician'];
 const limit=Math.min(rows.length,40);
 let header=-1;
 for(let i=0;i<limit;i++){
  const row=rows[i];
  if(!Array.isArray(row)||row.length<required.length||row.length>8)continue;
  const fields=row.map(v=>allowed[normalise(v)]).filter(Boolean);
  if(required.every(k=>fields.includes(k))){header=i;break;}
 }
 if(header<0){
  // A single-line title or metadata at the top is not a valid header.
  if(rows[0].length<required.length)throw Error('Could not locate the EMIS column headings in the first 40 rows. The export may contain a report title above the table, or be the wrong report. Expected: patient ID, usual GP, appointment date and consulting clinician. Nothing was analysed.');
  validateExportHeaders(rows[0],mode);
  throw Error('EMIS column headings were not found. Nothing was analysed.');
 }
 const headings=rows[header];
 validateExportHeaders(headings,mode);
 for(let i=header+1;i<rows.length;i++){
  if(rows[i].length!==headings.length)throw Error('CSV data row '+(i+1)+' has '+rows[i].length+' columns; the actual table header (row '+(header+1)+') has '+headings.length+'. Check the export for an extra separator, missing quotation or footer. No data was analysed.');
 }
 if(rows.length===header+1)throw Error('EMIS table contains no patient rows.');
 return {rows:rows.slice(header),skippedMetadataRows:header,headerLine:header+1};
}
