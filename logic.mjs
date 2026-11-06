/**
 * ContinuityBuddy: pure, dependency-free clinical cohort logic.
 * No networking, persistence, DOM access or diagnostics containing identifiers.
 */
export const IMPORT_MAX_BYTES = 8_000_000;
export const IMPORT_MAX_ROWS = 30_000;
export const EMIS_HEADER = 'EMIS Number';

function invalid(message) { throw new Error(message); }
export function parseCsv(text) {
  if (typeof text !== 'string' || !text.length || text.length > IMPORT_MAX_BYTES)
    invalid('Invalid CSV size (maximum 8 MB).');
  const rows = [];
  let row = [], cell = '', quoted = false, afterQuote = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; afterQuote = true; }
      else cell += c;
    } else if (c === '"') {
      if (cell !== '' || afterQuote) invalid('Malformed CSV quotation marks.');
      quoted = true;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(cell);
      if (c === ',') { cell = ''; afterQuote = false; }
      else {
        if (row.some(x => x.trim())) rows.push(row);
        if (rows.length > IMPORT_MAX_ROWS + 1) invalid('CSV exceeds 30,000 patient rows.');
        row = []; cell = ''; afterQuote = false;
        if (c === '\r' && text[i + 1] === '\n') i++;
      }
    } else {
      if (afterQuote && c !== ' ' && c !== '\t') invalid('Unexpected characters after a quoted CSV value.');
      if (!afterQuote) cell += c;
    }
  }
  if (quoted) invalid('Unclosed CSV quotation mark.');
  row.push(cell);
  if (row.some(x => x.trim())) rows.push(row);
  return rows;
}

export function validateEmisCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) invalid('CSV is empty.');
  if (rows.some(row => row.length !== 1)) invalid('Rejected: exactly one column headed EMIS Number is required. No other fields are permitted.');
  const first = rows[0][0].trim().replace(/^\uFEFF/, '');
  if (first !== EMIS_HEADER) invalid('Rejected: expected the exact header EMIS Number. Names, NHS numbers and unlabelled files are not accepted.');
  const values = rows.slice(1).map(row => row[0].trim());
  if (!values.length) invalid('CSV contains no patient rows.');
  if (values.length > IMPORT_MAX_ROWS) invalid('CSV exceeds 30,000 patient rows.');
  if (values.some(v => !/^\d{1,15}$/.test(v))) invalid('Rejected: an EMIS number is missing or contains unexpected characters. No names, dates, formulas or clinical fields permitted.');
  const unique = [...new Set(values)];
  return { ids: unique, duplicates: values.length - unique.length, rows: values.length };
}

export function safeCsvField(value) {
  const raw = String(value);
  // Spreadsheet formula injection defence: defend even if the GP label comes from a future UI.
  const sanitized = /^[\s\u0000-\u001f]*[=+@\-]/.test(raw) ? "'" + raw : raw;
  return '"' + sanitized.replace(/"/g, '""') + '"';
}

export function analyse(cohorts, threshold = 4) {
  const owners = new Map(), seen = new Map(), notseen = new Map(), conflicts = new Set();
  const registered = new Map();
  for (const c of cohorts) {
    if (!['owner', 'seen', 'notseen'].includes(c.kind) || typeof c.gp !== 'string' || !Array.isArray(c.ids)) continue;
    const gp = c.gp.trim();
    if (!gp) continue;
    let types = registered.get(gp);
    if (!types) { types = new Set(); registered.set(gp, types); }
    types.add(c.kind);
    for (const id of c.ids) {
      if (c.kind === 'owner') {
        if (owners.has(id) && owners.get(id) !== gp) conflicts.add(id);
        owners.set(id, gp);
      } else {
        const target = c.kind === 'seen' ? seen : notseen;
        if (!target.has(id)) target.set(id, new Set());
        target.get(id).add(gp);
      }
    }
  }
  // All three cohorts must exist for every GP, otherwise incomplete coverage
  // can incorrectly produce a unique alternative clinician.
  const incomplete = [...registered].filter(([, types]) => types.size !== 3).map(([gp]) => gp);
  const contradictory = new Set();
  for (const [id, gps] of seen)
    for (const gp of gps)
      if (notseen.get(id)?.has(gp)) contradictory.add(id);

  const eligible = [];
  if (!incomplete.length) for (const [id, owner] of owners) {
    if (conflicts.has(id) || contradictory.has(id) || !notseen.get(id)?.has(owner)) continue;
    const alternatives = [...(seen.get(id) || [])].filter(g => g !== owner);
    if (alternatives.length !== 1) continue;
    eligible.push({ id, from: owner, to: alternatives[0], reason: threshold + '+ consultation records with alternative GP, none with usual GP in one-year search' });
  }
  eligible.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.id.localeCompare(b.id, undefined, {numeric: true}));
  const buckets = new Map();
  for (const c of eligible) {
    const key = JSON.stringify([c.from, c.to]);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(c);
  }
  const pairs = [], visited = new Set();
  for (const c of eligible) {
    const ordered = [c.from, c.to].sort();
    const key = JSON.stringify(ordered);
    if (visited.has(key)) continue;
    visited.add(key);
    const forward = buckets.get(JSON.stringify(ordered)) || [];
    const backward = buckets.get(JSON.stringify([...ordered].reverse())) || [];
    for (let i = 0; i < Math.min(forward.length, backward.length); i++)
      pairs.push({ first: forward[i], second: backward[i], gpA: ordered[0], gpB: ordered[1] });
  }
  const used = new Set(pairs.flatMap(p => [p.first.id, p.second.id]));
  return {
    pairs,
    unmatched: eligible.filter(c => !used.has(c.id)),
    eligible,
    conflicts: [...conflicts],
    contradictoryCount: contradictory.size,
    incomplete,
    ownerCount: owners.size,
    contactCount: seen.size
  };
}

export function proposalCsv(result, reviews = new Map()) {
  const rows = [['Swap', 'EMIS number', 'Current GP', 'Proposed GP', 'Status']];
  result.pairs.forEach((pair, index) => {
    for (const candidate of [pair.first, pair.second])
      rows.push([index + 1, candidate.id, candidate.from, candidate.to, reviews.get(candidate.id) || 'For review']);
  });
  return rows.map(row => row.map(safeCsvField).join(',')).join('\r\n') + '\r\n';
}
