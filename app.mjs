import {validateEmisCsv, analyse, proposalCsv, IMPORT_MAX_BYTES} from './logic.mjs';

const $ = id => document.getElementById(id);
const create = (tag, value, klass) => { const e = document.createElement(tag); if (value !== undefined) e.textContent = value; if (klass) e.className = klass; return e; };
let cohorts = [], result = analyse([]), epoch = 0, busy = false;
const reviews = new Map();
const issuedObjectURLs = new Set();

function clearFile() { $('file').value = ''; }
function setStatus(value, klass = '') { $('message').textContent = value; $('message').className = klass; }
function clearAll() {
  ++epoch; // invalidate any pending asynchronous file read
  cohorts = [];
  result = analyse([]);
  reviews.clear();
  busy = false;
  clearFile();
  $('gp').value = '';
  $('kind').selectedIndex = 0;
  $('source-check').checked = false;
  $('coverage-check').checked = false;
  for (const url of issuedObjectURLs) URL.revokeObjectURL(url);
  issuedObjectURLs.clear();
  setStatus('Session cleared. Browser and operating-system memory cannot be securely erased by a webpage.');
  render();
}
function render() {
  const cohortBody = $('cohorts');
  cohortBody.replaceChildren();
  if (cohorts.length === 0) {
    const tr = create('tr'); const td = create('td', 'No cohorts imported yet.', 'empty');
    td.colSpan = 4; tr.append(td); cohortBody.append(tr);
  }
  cohorts.forEach((c, index) => {
    const tr = create('tr');
    [({owner:'A · Usual GP',seen:'B · Seen 4+',notseen:'C · Not seen'})[c.kind], c.gp, String(c.ids.length)].forEach(value => tr.append(create('td', value)));
    const td = create('td'), button = create('button', 'Remove', 'secondary small');
    button.addEventListener('click', () => { ++epoch; cohorts.splice(index, 1); reviews.clear(); $('coverage-check').checked = false; render(); });
    td.append(button); tr.append(td); cohortBody.append(tr);
  });
  result = analyse(cohorts);
  $('metricOwners').textContent = result.ownerCount;
  $('metricEligible').textContent = result.eligible.length;
  $('metricPairs').textContent = result.pairs.length;
  $('metricUnmatched').textContent = result.unmatched.length;
  const warnings = [];
  if (result.conflicts.length) warnings.push(result.conflicts.length + ' conflicting usual-GP assignments excluded.');
  if (result.contradictoryCount) warnings.push(result.contradictoryCount + ' contradictory seen/not-seen records excluded.');
  if (result.incomplete.length) warnings.push('Missing A/B/C cohorts for: ' + result.incomplete.join(', ') + '. Recommendations withheld.');
  if (cohorts.length && result.incomplete.length === 0)
    warnings.push('Only imported GPs are assessed. Confirm every GP in scope is included before exporting.');
  $('warnings').textContent = warnings.join(' ');
  const canExport = result.pairs.length > 0 && result.incomplete.length === 0 && $('coverage-check').checked;
  $('download').disabled = !canExport;
  $('print').disabled = !canExport;
  $('submit-import').disabled = busy;
  const tbody = $('swaps'); tbody.replaceChildren();
  if (result.pairs.length === 0) {
    const tr = create('tr'), td = create('td', 'No reciprocal pairs identified from complete imported cohorts.', 'empty');
    td.colSpan = 5; tr.append(td); tbody.append(tr);
  }
  result.pairs.forEach((pair, index) => [pair.first, pair.second].forEach((candidate, j) => {
    const tr = create('tr');
    if (j === 0) { const td = create('td', String(index + 1)); td.rowSpan = 2; tr.append(td); }
    tr.append(create('td', candidate.id), create('td', candidate.from), create('td', candidate.to));
    const td = create('td'), select = create('select');
    select.setAttribute('aria-label', 'Review status for patient in pair ' + (index + 1));
    for (const value of ['For review', 'Suitable in principle', 'Do not swap']) {
      const option = create('option', value); option.value = value; select.append(option);
    }
    select.value = reviews.get(candidate.id) || 'For review';
    select.addEventListener('change', () => reviews.set(candidate.id, select.value));
    td.append(select); tr.append(td); tbody.append(tr);
  }));
  const unmatched = $('unmatched');
  unmatched.replaceChildren();
  if (result.unmatched.length === 0) unmatched.textContent = 'None identified.';
  else {
    unmatched.textContent = result.unmatched.length + ' potential transfer(s) without reciprocal match: ';
    unmatched.append(create('span', result.unmatched.map(c => c.id + ' (' + c.from + ' → ' + c.to + ')').join('; ')));
  }
}

$('form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  const file = $('file').files?.[0];
  const gp = $('gp').value.trim().replace(/\s+/g, ' ');
  const kind = $('kind').value;
  if (!file || !/^[\p{L}\p{N}][\p{L}\p{N} .,'()_-]{0,59}$/u.test(gp)) {
    setStatus('Choose a CSV and a GP label containing letters, numbers or ordinary punctuation.', 'error'); return;
  }
  if (!$('source-check').checked) { setStatus('Confirm this is an internal EMIS-number-only export, not an NHS-number export.', 'error'); return; }
  if (file.size > IMPORT_MAX_BYTES || file.size === 0) { setStatus('Rejected: CSV is empty or exceeds 8 MB.', 'error'); return; }
  if (cohorts.some(c => c.kind === kind && c.gp.toLowerCase() === gp.toLowerCase())) {
    setStatus('This GP and search type are already imported. Remove the existing cohort before replacing it.', 'error'); return;
  }
  const requestEpoch = ++epoch;
  busy = true;
  render();
  try {
    const {ids, duplicates} = validateEmisCsv(await file.text());
    if (epoch !== requestEpoch) return;
    // Require a single consistent spelling for a GP across all cohorts.
    if (cohorts.some(c => c.gp.toLowerCase() === gp.toLowerCase() && c.gp !== gp))
      throw Error('GP label differs in capitalisation from an earlier import.');
    cohorts.push({kind, gp, ids});
    reviews.clear();
    $('coverage-check').checked = false;
    setStatus('Accepted ' + ids.length + ' unique EMIS identifiers; ' + duplicates + ' duplicate row(s) ignored. All processing stays in this browser tab.', 'ok');
    clearFile();
    $('source-check').checked = false;
  } catch (_error) {
    if (epoch === requestEpoch) setStatus('Import rejected. Check the exact EMIS Number header, numeric-only rows, file size and GP label. No patient values are shown in errors.', 'error');
  } finally {
    if (epoch === requestEpoch) { busy = false; render(); }
  }
});
$('reset').addEventListener('click', () => { if (window.confirm('Clear patient identifiers, matching results and review decisions from this tab?')) clearAll(); });
$('coverage-check').addEventListener('change', render);
$('toggleGuide').addEventListener('click', () => {
  const hide = !$('guide').hidden;
  $('guide').hidden = hide;
  $('toggleGuide').textContent = hide ? 'Show guide' : 'Hide guide';
  $('toggleGuide').setAttribute('aria-expanded', String(!hide));
});
$('download').addEventListener('click', () => {
  if ($('download').disabled) return;
  const csv = proposalCsv(result, reviews);
  const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
  issuedObjectURLs.add(url);
  const a = create('a'); a.href = url; a.download = 'continuitybuddy-swap-proposal.csv'; a.click();
  // Downloads are explicitly user-initiated; browsers/OS may retain the downloaded file.
  setTimeout(() => { URL.revokeObjectURL(url); issuedObjectURLs.delete(url); }, 10_000);
});
$('print').addEventListener('click', () => { if (!$('print').disabled) window.print(); });
window.addEventListener('pagehide', () => {
  // Best-effort cleanup, not a guarantee of secure deletion.
  ++epoch; cohorts = []; reviews.clear();
  for (const url of issuedObjectURLs) URL.revokeObjectURL(url);
  issuedObjectURLs.clear();
});
render();
if ('serviceWorker' in navigator && window.isSecureContext) {
  // Registration only: do not activate an update while a tab may contain patient data.
  window.addEventListener('load', () => { navigator.serviceWorker.register('./service-worker.js', {updateViaCache:'none'}).catch(() => {
    $('offline-status').textContent = 'Offline installation unavailable. Online use remains possible.';
  }); });
}
