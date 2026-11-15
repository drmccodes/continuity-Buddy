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

// Public: demo-only, with no patient file inputs. Offline: the sole mode
// allowed to read local EMIS files. Both are built from the same reviewed sources.
const sourceScript = [engine, security, ui]
 .map(source => source.replace(/^import .*$/gm, '').replace(/^export /gm, ''))
 .join('\n\n');
const offlineScript = sourceScript.replace('const PATIENT_IMPORTS_ENABLED = false;', 'const PATIENT_IMPORTS_ENABLED = true;');
if(offlineScript === sourceScript)throw Error('Missing fail-closed import mode switch');
const sources = {
 'Usual_GP_Continuity_Search.xml': search,
 'Usual_GP_List_Sizes_Search.xml': sizes
};
const downloadHandler = [
 '',
 'const EMBEDDED_SEARCHES=' + JSON.stringify(sources) + ';',
 "for(const link of document.querySelectorAll('a[download$=\".xml\"]')){link.addEventListener('click',event=>{event.preventDefault();const name=link.getAttribute('download');const source=EMBEDDED_SEARCHES[name];if(!source)return;const objectUrl=URL.createObjectURL(new Blob([source],{type:'application/xml;charset=utf-8'}));const a=document.createElement('a');a.href=objectUrl;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),10000);});}",
 ''
].join('\n');
const inlineStyle = css + '\n.check-confirm{display:flex;align-items:center;gap:9px;margin:12px 0;font-weight:500;color:#42546b}.check-confirm input{width:17px;height:17px;flex:none}';
const contentPolicy = script => [
 "default-src 'none'",
 "script-src 'sha256-" + digest(script) + "'",
 "style-src 'sha256-" + digest(inlineStyle) + "'",
 'img-src data:',
 "connect-src 'none'",
 "object-src 'none'",
 "base-uri 'none'",
 "form-action 'none'",
 "frame-src 'none'",
 "worker-src 'none'",
 "manifest-src 'none'"
].join('; ');

const offlineScriptComplete=offlineScript+downloadHandler;
const hostedScript=sourceScript+"\n\n// Avoid browser navigation if a file is dragged into the hosted demo.\nfor(const name of ['dragover','drop'])document.addEventListener(name,event=>{if(event.dataTransfer?.types?.includes('Files'))event.preventDefault();});\n";
const offlineNote=/For real NHS data, <a href="\.\/ContinuityBuddy-Offline\.html" download="ContinuityBuddy-Offline\.html">download the standalone offline version<\/a> and use it on an approved NHS device with your organisation's information governance approval\./;
const offlineIndex=index.replace(offlineNote,"For real NHS data, use this standalone file on an approved NHS device with your organisation's information governance approval.");
if(offlineIndex===index)throw Error('Offline notice not found');
const hostedIntro='<section class="panel" id="importPanel"><div class="panelhead"><h2>1. Explore the fictional example</h2><button type="button" id="demo">Try with fictional data</button></div><div class="hosted-demo"><strong>Fictional data only.</strong><p>Patient CSV files cannot be opened or analysed on this website. Try the four-doctor example, or <a href="./ContinuityBuddy-Offline.html" download="ContinuityBuddy-Offline.html">download the offline edition</a> to analyse EMIS exports on an approved NHS device.</p></div><p id="message" class="status" role="status" aria-live="polite"></p></section>';
const importStart=offlineIndex.indexOf('<section class="panel" id="importPanel">');
const step2Start=offlineIndex.indexOf('<section class="panel step-preview" id="clinicianOverview">');
if(importStart<0||step2Start<importStart)throw Error('Import panel anchors changed');
let hostedIndex=offlineIndex.slice(0,importStart)+hostedIntro+'\n'+offlineIndex.slice(step2Start);
hostedIndex=hostedIndex.replace(/<aside class="privacy"[\s\S]*?<\/aside>/,'<aside class="privacy" aria-label="Privacy"><strong>Online demonstration only.</strong> This website processes fictional data only and does not accept patient files. To analyse real NHS data, <a href="./ContinuityBuddy-Offline.html" download="ContinuityBuddy-Offline.html">download the offline edition</a> for an approved device and obtain your organisation’s information governance approval.</aside>');
hostedIndex=hostedIndex.replace('Import an EMIS CSV above or select <strong>Try with fictional data</strong> to explore without patient information.','Select <strong>Try with fictional data</strong> above to explore the workflow without patient information.');
hostedIndex=hostedIndex.replace('<span class="step-pending">After import</span>','<span class="step-pending">After demo</span>');
if(/<input[^>]+type="file"/.test(hostedIndex)||hostedIndex.includes('id="drop"')||hostedIndex.includes('id="mapPanel"'))throw Error('Hosted HTML contains patient import controls');
const hostedStyle=inlineStyle+'\n.hosted-demo{padding:22px 24px;background:#f4f8fd;border:1px solid #d8e4f4;border-radius:12px;line-height:1.7}.hosted-demo p{margin:9px 0 0}.hosted-demo strong{color:#24528e}';

function assemble(template,script,style){
 if(/<\/script/i.test(script))throw Error('Unsafe inline script terminator');
 const policy=contentPolicy(script).replace("style-src 'sha256-" + digest(inlineStyle) + "'", "style-src 'sha256-" + digest(style) + "'");
 const result=template
  .replace('<link rel="stylesheet" href="./v2.css">','')
  .replace('<script type="module" src="./v2.mjs"></script>','')
  .replace(/<meta http-equiv="Content-Security-Policy"[^>]+>/,'')
  .replace(/href="https:\/\/(?!projectralph\.co\.uk(?:\/|"))[^"]+"/g,'')
  .replace('</head>','<meta http-equiv="Content-Security-Policy" content="'+policy+'"><style>'+style+'</style></head>')
  .replace('</body>','<script>'+script+'</script></body>');
 if(/<script[^>]+src=|<link[^>]+stylesheet/i.test(result))throw Error('External executable asset');
 return result;
}
const offline=assemble(offlineIndex,offlineScriptComplete,inlineStyle);
const hosted=assemble(hostedIndex,hostedScript,hostedStyle);
if(!hosted.includes('PATIENT_IMPORTS_ENABLED = false;')||!offline.includes('PATIENT_IMPORTS_ENABLED = true;'))throw Error('Wrong build permissions');
await Promise.all([
 writeFile(new URL('ContinuityBuddy-Offline.html',root),offline,'utf8'),
 writeFile(new URL('ContinuityBuddy-Hosted.html',root),hosted,'utf8')
]);
console.log('Built hosted demo ('+Buffer.byteLength(hosted)+' bytes) and standalone offline analyser ('+Buffer.byteLength(offline)+' bytes)');
