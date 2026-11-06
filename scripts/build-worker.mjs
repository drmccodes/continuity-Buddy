/**
 * Reproducible, zero-dependency Cloudflare Worker static bundle.
 * This generator accepts no data-file path and can only include reviewed public assets.
 */
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const entries=['index.html','style.css','app.mjs','logic.mjs','service-worker.js','manifest.webmanifest','privacy.html'];
const assets={};
for(const name of entries) assets[name]=await readFile(new URL('../'+name, import.meta.url),'utf8');
const csp="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; manifest-src 'self'; worker-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'";
const contents=`// Generated public code only. Never include EMIS exports or clinical data.
const assets = ${JSON.stringify(assets)};
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8'};
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if(request.method !== 'GET' && request.method !== 'HEAD')
      return new Response('Method not allowed', {status:405,headers:{Allow:'GET, HEAD'}});
    if(url.search || url.hash)
      return new Response('Not found',{status:404});
    const key = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if(!Object.prototype.hasOwnProperty.call(assets, key))
      return new Response('Not found',{status:404});
    const ext = '.'+key.split('.').at(-1);
    return new Response(request.method==='HEAD' ? null : assets[key],{
      headers:{
        'Content-Type': mime[ext] || 'text/plain; charset=utf-8',
        'Content-Security-Policy': ${JSON.stringify(csp)},
        'Cache-Control':'no-store',
        'Referrer-Policy':'no-referrer',
        'X-Content-Type-Options':'nosniff',
        'X-Frame-Options':'DENY',
        'Cross-Origin-Opener-Policy':'same-origin',
        'Cross-Origin-Resource-Policy':'same-origin',
        'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
        'Strict-Transport-Security':'max-age=31536000; includeSubDomains'
      }
    });
  }
};`;
await mkdir(new URL('../dist/',import.meta.url),{recursive:true});
await writeFile(new URL('../dist/worker.mjs',import.meta.url),contents);
console.log('Built reviewed allowlist of '+entries.length+' static assets.');
