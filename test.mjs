import assert from 'node:assert/strict';
import {validateEmisCsv,analyse,proposalCsv} from './logic.mjs';
assert.deepEqual(validateEmisCsv('EMIS Number\r\n0012\r\n0045\r\n0012').ids,['0012','0045']);
for (const input of ['Name,EMIS Number\nJane,123','DOB\n01/02/1989','EMIS Number,NHS Number\n1,999999','EMIS Number\nJane','EMIS Number\n=IMPORTXML(1)','EMIS Number\n12,34']) assert.throws(()=>validateEmisCsv(input));
const cohorts=[{kind:'owner',gp:'A',ids:['1','2']},{kind:'owner',gp:'B',ids:['3','4']},{kind:'notseen',gp:'A',ids:['1','2']},{kind:'notseen',gp:'B',ids:['3','4']},{kind:'seen',gp:'B',ids:['1','2']},{kind:'seen',gp:'A',ids:['3']}];
const out=analyse(cohorts);assert.equal(out.pairs.length,1);assert.equal(out.unmatched.length,1);
assert.equal(out.pairs[0].first.id,'1');assert.equal(out.pairs[0].second.id,'3');
assert.match(proposalCsv(out),/For clinical review/);
assert.equal(analyse([...cohorts,{kind:'seen',gp:'C',ids:['1']}]).pairs.length,1); // 2 still matches 3
console.log('All ContinuityBuddy tests passed');
