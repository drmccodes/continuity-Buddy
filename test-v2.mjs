import assert from 'node:assert/strict';
import {validateExportHeaders,extractReportTable} from './import-security.mjs';
import {parseCsv,parseDate,guessColumns,normaliseConsultations,analyse,syntheticDemo,proposalCsv,clinicianCounts,validWeeklySessions,syntheticDemoListBalance} from './engine.mjs';
const emisHeaders=['EMIS Number','Usual GP','Appt. Date','Consulting clinician','Staff Role','Slot Type','Current Slot Status'];
assert.deepEqual(validateExportHeaders(emisHeaders),{patient:0,usual:1,date:2,clinician:3,type:5,status:6});
assert.match(
  (()=>{try{validateExportHeaders([...emisHeaders,'Extra EMIS field']);return '';}catch(error){return error.message;}})(),
  /Unrecognised headings: column 8: "Extra EMIS field"/
);
assert.equal(extractReportTable([emisHeaders,['123','Dr Ash','01/11/2026','Dr Birch','GP','Routine','Attended']]).rows.length,2);
const csv=['Patient ID,Consultation Date,Consulting clinician,Usual GP,Appointment status','001,02/05/2026,Dr Birch,Dr Ash,Attended','001,02/06/2026,Dr Birch,Dr Ash,Attended','001,02/07/2026,Dr Birch,Dr Ash,Attended','001,02/08/2026,Dr Birch,Dr Ash,Attended','002,02/05/2026,Dr Ash,Dr Birch,Attended','002,02/06/2026,Dr Ash,Dr Birch,Attended','002,02/07/2026,Dr Ash,Dr Birch,Attended','002,02/08/2026,Dr Ash,Dr Birch,Attended','003,02/06/2026,Dr Birch,Dr Birch,Cancelled'].join('\n');
const rows=parseCsv(csv);assert.equal(rows.length,10);
assert.deepEqual(parseCsv('A,B\n"1,2","a""b"')[1],['1,2','a"b']);
assert.deepEqual(parseCsv('Patient ID\tUsual GP\r\n001\tDr Ash')[1],['001','Dr Ash']);
assert.deepEqual(parseCsv('Patient ID;Usual GP\r\n001;Dr Ash')[1],['001','Dr Ash']);
assert.deepEqual(parseCsv('Patient ID,Usual GP\r\n001,"Dr Ash, GP"')[1],['001','Dr Ash, GP']);
assert.throws(()=>parseCsv('Patient ID,Usual GP\r\n001,Dr Ash\r\n002,Dr Birch,Extra'),/row 3 has 3 columns/);
assert.equal(parseDate('31/01/2026'),'2026-01-31');
assert.equal(parseDate('31/02/2026'),null);
const map=guessColumns(rows[0]);assert.equal(map.patient,0);assert.equal(map.usual,3);
const emisMap=guessColumns(['Patient ID','Usual GP Full Name','Appt. Date',"Staff Member's Full Name", "Session Holder's User Type"]);
assert.equal(emisMap.patient,0);assert.equal(emisMap.usual,1);assert.equal(emisMap.date,2);assert.equal(emisMap.clinician,3);
const parsed=normaliseConsultations(rows,map,{referenceDate:'2026-11-06'});
assert.equal(parsed.events.length,8);assert.equal(parsed.quality.excludedStatus,1);
const sameDay=parseCsv('Patient ID,Consultation Date,Consulting clinician,Usual GP\n999,02/05/2026,Dr Birch,Dr Ash\n999,02/05/2026,Dr Birch,Dr Ash');
const sameParsed=normaliseConsultations(sameDay,guessColumns(sameDay[0]),{referenceDate:'2026-11-06'});
assert.equal(sameParsed.events.length,2); // Do not silently merge possibly genuine separate appointments
assert.equal(sameParsed.quality.duplicates,1); // Flag matching rows for user review
const res=analyse(parsed.events,{minVisits:4});
assert.equal(res.pairs.length,1);assert.equal(res.proposals.length,2);
assert.equal(res.metrics.meanUPC,1);
assert.equal(res.metrics.slicc,0);
assert.equal(res.metrics.usualAccuracy,0);
assert.equal(res.gpRows.length,2);
assert.equal(analyse(parsed.events,{statuses:{'Dr Birch':'nonlist'}}).proposals.length,1);
assert.equal(analyse(parsed.events,{statuses:{'Dr Birch':'exclude'}}).proposals.length,1); // Existing Dr Birch list still needs reassignment; its non-excluded contacts point to Dr Ash.
const demoEvents=syntheticDemo();
assert.equal(new Set(demoEvents.map(e=>e.id)).size,240);
assert.deepEqual([...new Set(demoEvents.map(e=>e.usual))].sort(),['Dr Ash','Dr Birch','Dr Cedar','Dr Dale']);
assert.equal(clinicianCounts(demoEvents).length,4);
const demoAnalysis=analyse(demoEvents);
assert.equal(demoAnalysis.gpRows.length,4);
assert.equal(demoAnalysis.pairs.length>0,true);
assert.equal(new Set(demoAnalysis.pairs.flatMap(p=>[p.a.from,p.a.to,p.b.from,p.b.to])).size,4);
const output=proposalCsv([{id:'=SUM(1)',from:'A',to:'B',n:4,top:4,ownCount:0,topShare:1,confidence:'high'}]);
assert.match(output,/"'=SUM\(1\)"/);
assert.throws(()=>normaliseConsultations(parseCsv('Patient ID,Consultation Date,Consulting clinician,Usual GP\n,01/01/2026,Dr A,Dr B'),guessColumns(['Patient ID','Consultation Date','Consulting clinician','Usual GP'])));
assert.equal(clinicianCounts(parsed.events).length,2);
const conflict=[{id:'x',usual:'Dr Ash',clinician:'Dr Birch',date:'2026-04-01'},{id:'x',usual:'Dr Birch',clinician:'Dr Birch',date:'2026-04-02'},{id:'x',usual:'Dr Ash',clinician:'Dr Birch',date:'2026-04-03'},{id:'x',usual:'Dr Ash',clinician:'Dr Birch',date:'2026-04-04'}];
assert.equal(analyse(conflict).proposals.length,0);
assert.equal(analyse(conflict).patients[0].category,'conflicting-usual');
assert.equal(analyse([{id:'x',usual:'',clinician:'Dr Birch',date:'2026-04-01'},{id:'x',usual:'',clinician:'Dr Birch',date:'2026-04-02'},{id:'x',usual:'',clinician:'Dr Birch',date:'2026-04-03'},{id:'x',usual:'',clinician:'Dr Birch',date:'2026-04-04'}]).proposals.length,0);

const reference=[];
for(const [id,usual,doctor,count] of [
 ['SYN-A','Dr Ash','Dr Birch',4],['SYN-A','Dr Ash','Dr Ash',1],
 ['SYN-B','Dr Birch','Dr Ash',5],['SYN-B','Dr Birch','Dr Birch',1],
 ['SYN-C','Dr Ash','Dr Ash',4],['SYN-D','Dr Birch','Dr Ash',2],['SYN-D','Dr Birch','Dr Birch',2]
])for(let n=0;n<count;n++)reference.push({id,usual,clinician:doctor,date:'2026-02-'+String(n+1).padStart(2,'0')});
const baseline=analyse(reference);
assert.equal(baseline.metrics.patients,4);
assert.equal(baseline.metrics.consultations,19);
assert.equal(baseline.metrics.frequent,4);
assert.equal(baseline.metrics.slicc,8/19);
assert.equal(baseline.metrics.meanUPC,47/60);
assert.equal(baseline.metrics.usualAccuracy,1/3);
assert.equal(baseline.proposals.length,2);
assert.equal(baseline.pairs.length,1);
assert.equal(baseline.fragmented.some(p=>p.id==='SYN-D'),true);


assert.equal(validWeeklySessions(0.5),true);
assert.equal(validWeeklySessions(1),true);
assert.equal(validWeeklySessions(1.5),true);
assert.equal(validWeeklySessions(10),true);
for(const invalid of [0,0.1,0.6,1.2,-0.5,100,Infinity,NaN])assert.equal(validWeeklySessions(invalid),false);

const demoBalance=syntheticDemoListBalance();
assert.deepEqual(Object.keys(demoBalance.listSizes).sort(),['Dr Ash','Dr Birch','Dr Cedar','Dr Dale']);
assert.deepEqual(Object.keys(demoBalance.sessions).sort(),['Dr Ash','Dr Birch','Dr Cedar','Dr Dale']);
for(const [gp,n] of Object.entries(demoBalance.sessions))assert.equal(validWeeklySessions(n),true);
assert.ok(Object.values(demoBalance.listSizes).every(n=>n>240));
const balancedDemo=analyse(syntheticDemo(),demoBalance);
assert.equal(balancedDemo.gpRows.length,4);
for(const row of balancedDemo.gpRows){
 assert.equal(row.registered,demoBalance.listSizes[row.gp]);
 assert.equal(row.sessions,demoBalance.sessions[row.gp]);
 assert.equal(row.perSession,demoBalance.listSizes[row.gp]/demoBalance.sessions[row.gp]);
}
const noListDemo=analyse(syntheticDemo());
assert.ok(noListDemo.gpRows.every(row=>row.registered===null&&row.perSession===null));

console.log('ContinuityBuddy v2 regression tests passed');
