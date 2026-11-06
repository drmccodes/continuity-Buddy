import assert from 'node:assert/strict';
import {validateExportHeaders,validateSelectedMapping,filenameIsCsv,extractReportTable} from './import-security.mjs';

import {parseCsv} from './engine.mjs';
const preamble='EMIS report\nGenerated locally\nPatient ID,Usual GP,Appointment Date,Consulting clinician\n001,Dr Ash,2026-10-01,Dr Birch';
const extracted=extractReportTable(parseCsv(preamble,{allowPreamble:true}));
assert.equal(extracted.headerLine,3);
assert.equal(extracted.rows.length,2);
assert.throws(()=>extractReportTable(parseCsv(preamble+'\n002,Dr Ash,2026-10-02,Dr Birch,extra',{allowPreamble:true})),/row 5 has 5 columns/);
assert.throws(()=>extractReportTable(parseCsv('EMIS report\nPatient ID,Usual GP,Appointment Date,Consulting clinician,Patient Name\n001,Dr Ash,2026-10-01,Dr Birch,Jane',{allowPreamble:true})),/rejected/);
const clinical=['Patient ID','Usual GP Full Name','Appt. Date',"Staff Member's Full Name","Session Holder's User Type"];
const cols=validateExportHeaders(clinical);
assert.deepEqual(cols,{patient:0,usual:1,date:2,clinician:3,type:4});
assert.equal(validateSelectedMapping(cols,{...cols,status:-1}),true);
assert.throws(()=>validateSelectedMapping(cols,{...cols,patient:1}),/mapping/);
assert.deepEqual(validateExportHeaders(['Patient ID','Usual GP Full Name'],'list'),{patient:0,usual:1});
for(const forbidden of ['NHS Number','Patient Name','DOB','Address','Postcode','Diagnosis','Consultation Notes','Email','Gender','Age','Free text','Symptoms','Phone']){
 assert.throws(()=>validateExportHeaders([...clinical,forbidden]),/rejected/i,forbidden);
}
assert.throws(()=>validateExportHeaders([...clinical,'Patient ID']),/duplicate/i);
assert.throws(()=>validateExportHeaders(['Patient ID','Usual GP Full Name','Appt. Date']),/required/i);
assert.throws(()=>validateExportHeaders(['Patient ID','Usual GP Full Name','Patient Name'],'list'),/rejected/i);
assert.equal(filenameIsCsv('emis-export.csv'),true);
assert.equal(filenameIsCsv('malware.csv.exe'),false);
console.log('Minimal data import regression assertions passed');
