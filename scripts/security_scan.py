"""Fail closed when clinical export files, secrets or forbidden runtime dependencies enter the tracked tree."""
import pathlib,re,subprocess,sys
files=subprocess.check_output(['git','ls-files'],text=True).splitlines()
blocked_suffixes={'.csv','.tsv','.xlsx','.xls','.pdf','.sqlite','.db','.dump','.p12','.pfx','.pem','.key','.env','.zip'}
blocked_names={'.env','.env.local','id_rsa','id_ed25519','credentials.json','secrets.json'}
bad=[]
for name in files:
 p=pathlib.PurePosixPath(name)
 if p.suffix.lower() in blocked_suffixes or p.name.lower() in blocked_names or any(part.lower() in {'data','exports','reports','patient-data','screenshots'} for part in p.parts):
  bad.append(name)
 if pathlib.Path(name).is_file() and pathlib.Path(name).stat().st_size>1_500_000:
  bad.append('oversized tracked file: '+name)
if bad:
 print('Rejected potentially sensitive files: '+', '.join(bad),file=sys.stderr)
 sys.exit(1)
for name in ['index.html','app.mjs','logic.mjs','service-worker.js']:
 text=pathlib.Path(name).read_text()
 if name=='index.html' and (re.search(r'<script[^>]+src=["\']https?://',text) or re.search(r'<link[^>]+href=["\']https?://[^"\']+\.css',text)):
  sys.exit('External runtime assets are forbidden')
 if name in {'app.mjs','logic.mjs'} and re.search(r'localStorage|sessionStorage|indexedDB|sendBeacon|XMLHttpRequest|fetch\(|WebSocket\(',text):
  sys.exit('Potential patient-data persistence/egress primitive in app.mjs; review required')
 if name=='service-worker.js' and (re.search(r'cache\.add\(|cache\.addAll\(',text) or re.search(r'^\s*(?:self\.)?skipWaiting\(',text,re.M) or re.search(r'^\s*(?:self\.)?clients\.claim\(',text,re.M)):
  sys.exit('Unreviewed service-worker cache or live update primitive')
print('PASS: tracked-file policy and forbidden runtime primitives')
