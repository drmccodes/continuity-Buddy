/* Reviewed shell version: increment manually for every published release. */
const VERSION = 'continuitybuddy-shell-20261106-security-1';
const SHELL = ['/', '/index.html', '/style.css', '/app.mjs', '/logic.mjs', '/manifest.webmanifest', '/privacy.html'];
self.addEventListener('install', event => {
  // Atomic cache transaction. Do not activate over existing open pages.
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    try {
      for (const path of SHELL) {
        const response = await fetch(new Request(new URL(path, self.registration.scope), {cache: 'reload', credentials: 'omit'}));
        if (!response.ok || response.type === 'opaque') throw new Error('Application shell unavailable');
        await cache.put(new URL(path, self.registration.scope).href, response);
      }
    } catch (_error) {
      await caches.delete(VERSION);
      throw new Error('Unable to install verified application shell');
    }
  })());
  // Intentionally NO skipWaiting(). Old version continues controlling active tabs.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('continuitybuddy-shell-') && name !== VERSION) await caches.delete(name);
    }
  })());
  // Intentionally NO clients.claim(). A running clinical session is never taken over.
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin) return; // unrelated external navigations aren't proxied
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    event.respondWith(new Response('Method not allowed', {status: 405})); return;
  }
  const route = url.pathname.slice(scope.pathname.length - 1) || '/';
  if (url.search || !SHELL.includes(route)) {
    event.respondWith(new Response('Not found', {status: 404})); return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const response = await cache.match(new URL(route, scope).href);
    return response || new Response('Offline application asset unavailable', {status: 503});
  })());
});