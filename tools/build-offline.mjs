import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = relative => readFile(new URL(relative, root), 'utf8');
const digest = text => createHash('sha256').update(text, 'utf8').digest('base64');

const [index, engine, security, ui, css, search, sizes] = await Promise.all([
 'index.html', 'engine.mjs', 'import-security.mjs', 'v2.mjs', 'v2.css',
 'downloads/Usual_GP_Continuity_Search.xml',
 'downloads/Usual_GP_List_Sizes_Search.xml'
].map(read));

const sources = {
 'Usual_GP_Continuity_Search.xml': search,
 'Usual_GP_List_Sizes_Search.xml': sizes
};
let script = [engine, security, ui]
 .map(source => source.replace(/^import .*$/gm, '').replace(/^export /gm, ''))
 .join('\n\n');
script += [
 '',
 'const EMBEDDED_SEARCHES=' + JSON.stringify(sources) + ';',
 "for(const link of document.querySelectorAll('a[download$=\".xml\"]')){link.addEventListener('click',event=>{event.preventDefault();const name=link.getAttribute('download');const source=EMBEDDED_SEARCHES[name];if(!source)return;const objectUrl=URL.createObjectURL(new Blob([source],{type:'application/xml;charset=utf-8'}));const a=document.createElement('a');a.href=objectUrl;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),10000);});}",
 ''
].join('\n');
if (/<\/script/i.test(script)) throw new Error('Unsafe inline script terminator');

const style = css + '\n.offline-banner{border:1px solid #bfdad0;background:#f3faf7;padding:12px;border-radius:10px;margin:12px 0}.check-confirm{display:flex;align-items:center;gap:9px;margin:12px 0;font-weight:500;color:#42546b}.check-confirm input{width:17px;height:17px;flex:none}';
const csp = [
 "default-src 'none'",
 "script-src 'sha256-" + digest(script) + "'",
 "style-src 'sha256-" + digest(style) + "'",
 'img-src data:',
 "connect-src 'none'",
 "object-src 'none'",
 "base-uri 'none'",
 "form-action 'none'",
 "frame-src 'none'",
 "worker-src 'none'",
 "manifest-src 'none'"
].join('; ');

let html = index
 .replace('<link rel="stylesheet" href="./v2.css">', '')
 .replace('<script type="module" src="./v2.mjs"></script>', '')
 .replace(/<meta http-equiv="Content-Security-Policy"[^>]+>/, '')
 .replace(/href="https:\/\/[^"]+"/g, '')
 .replace('href="./ContinuityBuddy-Offline.html" download="ContinuityBuddy-Offline.html"', '')
 .replace('Download the standalone offline version', 'Standalone offline edition (this file)')
 .replace('</head>', '<meta http-equiv="Content-Security-Policy" content="' + csp + '"><style>' + style + '</style></head>')
 .replace('</body>', '<script>' + script + '</script></body>');
if (/<script[^>]+src=|<link[^>]+stylesheet/i.test(html)) throw new Error('External executable asset found');
await writeFile(new URL('ContinuityBuddy-Offline.html', root), html, 'utf8');
console.log('Built single-file offline analyser: ' + Buffer.byteLength(html) + ' bytes; SHA-256 ' + createHash('sha256').update(html).digest('hex'));
