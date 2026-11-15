import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = async name => readFile(new URL(name, root), 'utf8');
const [hosted, offline, source] = await Promise.all([
  read('ContinuityBuddy-Hosted.html'),
  read('ContinuityBuddy-Offline.html'),
  read('v2.mjs')
]);

function inline(content, tag) {
  const result = content.match(new RegExp('<' + tag + '>([\\s\\S]*?)<\\/' + tag + '>'));
  assert.ok(result, 'Missing inline ' + tag);
  return result[1];
}
function hash(source) {
  return createHash('sha256').update(source, 'utf8').digest('base64');
}
for (const [name, html] of [['hosted', hosted], ['offline', offline]]) {
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /connect-src 'none'/);
  assert.ok(html.includes("script-src 'sha256-" + hash(inline(html, 'script')) + "'"), name + ' script integrity');
  assert.ok(html.includes("style-src 'sha256-" + hash(inline(html, 'style')) + "'"), name + ' style integrity');
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+stylesheet/i);
  assert.match(html, /id="demo"/);
  assert.match(html, /class="gp-breakdown-table"/);
}
assert.match(source, /const PATIENT_IMPORTS_ENABLED = false;/);
assert.match(hosted, /const PATIENT_IMPORTS_ENABLED = false;/);
assert.doesNotMatch(hosted, /<input[^>]*type="file"/i);
assert.doesNotMatch(hosted, /id="(?:file|listFile|drop|mapPanel|prepareCsv|process)"/);
assert.doesNotMatch(hosted, /<form[^>]*enctype=/i);
assert.match(hosted, /Fictional data only|Online demonstration only/);
assert.match(offline, /const PATIENT_IMPORTS_ENABLED = location\.protocol === 'file:';/);
assert.match(offline, /id="file"/);
assert.match(offline, /id="listFile"/);
assert.match(offline, /id="drop"/);
assert.match(offline, /EMBEDDED_SEARCHES/);
assert.match(offline, /Usual_GP_List_Sizes_Search\.xml/);
assert.doesNotMatch(offline, /<script[^>]+src=/i);
console.log('Dual-mode build checks passed: hosted fictional-only; offline EMIS imports enabled.');
