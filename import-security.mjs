// Only the minimum reporting fields necessary for continuity analysis are accepted.
// Fail closed on unexpected columns, including accidental clinical or demographic data.
const normalise = value => String(value ?? '').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/[_.-]+/g,' ').replace(/\s+/g,' ');
const headings = {
 patient: ['patient id','patient identifier','emis number','emis id','emis patient id','emis patient number'],
 usual: ['usual gp','usual gp full name','named gp','registered gp','allocated gp','usual doctor'],
 date: ['appt date','appointment date','consultation date','event date'],
 clinician: ['staff members full name',"staff member's full name",'consulting clinician','consulting gp','clinician','consultation clinician','seen by'],
 type: ['session holders user type',"session holder's user type",'appointment type','consultation type','slot type','event type'],
 role: ['staff role'],
 status: ['appointment status','attendance status','current slot status']
};
const allowed = Object.fromEntries(Object.entries(headings).flatMap(([key,values])=>values.map(value=>[normalise(value),key])));
export function validateExportHeaders(headers,mode='consultations'){
 if(!Array.isArray(headers)||headers.length<2||headers.length>8)throw Error('Unexpected CSV structure. Export only the minimum required fields.');
 const encountered = new Set(), columns={};let unexpected=0,duplicated=0;
 const unexpectedHeadings=[];
 for(let i=0;i<headers.length;i++){
  const header=normalise(headers[i]);const key=allowed[header];
  if(!header||!key||(mode==='list'&&!['patient','usual'].includes(key))){unexpected++;unexpectedHeadings.push('column '+(i+1)+': '+JSON.stringify(String(headers[i]??'').trim().slice(0,80)));continue;}
  if(encountered.has(key)){duplicated++;continue;}
  encountered.add(key);if(key!=='role')columns[key]=i;
 }
 if(unexpected||duplicated){
  throw Error('CSV rejected: '+unexpected+' unrecognised or unnecessary column(s), '+duplicated+' duplicate field(s).'+(unexpectedHeadings.length?' Unrecognised headings: '+unexpectedHeadings.join('; ')+'.':'')+' Export the original ContinuityBuddy EMIS report with EMIS Number (or Patient ID), Usual GP, Appt. Date, consulting clinician, Staff Role, Slot Type and Current Slot Status. No patient names, NHS numbers, clinical information or demographic columns.');
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
 for(let i=header+1;i<rows.length;i++){
  if(rows[i].length!==headings.length)throw Error('CSV data row '+(i+1)+' has '+rows[i].length+' columns; the actual table header (row '+(header+1)+') has '+headings.length+'. Check the export for an extra separator, missing quotation or footer. No data was analysed.');
 }
 if(rows.length===header+1)throw Error('EMIS table contains no patient rows.');
 // EMIS sometimes ends every exported row with an unused delimiter. Only discard
 // trailing blank fields when the corresponding cell is blank on EVERY data row.
 // Never discard a field containing data, even if its heading is empty.
 let width=headings.length;
 while(width>required.length && !String(headings[width-1]??'').trim()
   && rows.slice(header+1).every(row=>!String(row[width-1]??'').trim()))width--;
 const tableRows=rows.slice(header).map(row=>row.slice(0,width));
 const columns=validateExportHeaders(tableRows[0],mode);
 // A blank final EMIS CSV line can be exported as a row of empty cells.
 // Remove only completely empty trailing rows, not interior blank records.
 let ignoredEmptyTrailingRows=0;
 while(tableRows.length>1&&tableRows[tableRows.length-1].every(value=>!String(value??'').trim())){
  tableRows.pop();ignoredEmptyTrailingRows++;
 }
 if(tableRows.length===1)throw Error('EMIS table contains no patient rows.');
 let continuedPatientRows=0;
 if(mode==='consultations'){
  let lastPatient='',lastUsual='';
  const seenPatients=new Set();
  for(let i=1;i<tableRows.length;i++){
   const row=tableRows[i],patient=String(row[columns.patient]??'').trim(),usual=String(row[columns.usual]??'').trim();
   if(!patient&&!usual){
    if(!lastPatient||!lastUsual)throw Error('Cannot reconstruct grouped EMIS patients: row '+(header+i+1)+' has no preceding patient and usual GP. Re-export with replicate patient and usual GP enabled.');
    if(row.every(value=>!String(value??'').trim()))throw Error('Unexpected empty row within the EMIS appointment table at row '+(header+i+1)+'. No data was analysed.');
    row[columns.patient]=lastPatient;
    row[columns.usual]=lastUsual;
    continuedPatientRows++;
   }else if(patient&&usual){
    if(seenPatients.has(patient))throw Error('Patient groups are not contiguous in this EMIS export (row '+(header+i+1)+'). Cannot safely reconstruct blank identifiers.');
    seenPatients.add(patient);lastPatient=patient;lastUsual=usual;
   }else{
    throw Error('EMIS row '+(header+i+1)+' has only one of patient identifier and usual GP. Cannot safely reconstruct patient details.');
   }
  }
 }
 return {rows:tableRows,skippedMetadataRows:header,headerLine:header+1,ignoredEmptyTrailingColumns:headings.length-width,ignoredEmptyTrailingRows,continuedPatientRows};
}
