// crashDot offline service worker — M2 spike.
//
// Goal: after ONE online visit, the whole solo app (scsynth engine + synths/FX +
// editor + examples) boots and plays FULLY OFFLINE.
//
// Design so the ONLINE / dev experience is byte-identical to having no SW:
//   • NETWORK-FIRST — every request goes to the network first and is returned
//     UNMODIFIED when online; we only stash a clone in the cache in the background.
//     (So serve.py always wins during dev — fresh files, no staleness.)
//   • The app needs cross-origin isolation (SharedArrayBuffer → scsynth threads).
//     Responses cached while online keep the COOP/COEP the server sent, and on the
//     OFFLINE path we also re-assert them as a safety net.
//   • Only same-origin GET is intercepted. The collab WebSocket, /sessions, and the
//     cross-origin GitHub sample kit are left entirely alone (they just fail offline,
//     which is expected — multiplayer/galaxy/samples degrade).
//
// To remove the SW during dev: DevTools → Application → Service Workers → Unregister
// (or bump CACHE below).

const CACHE = 'wfd-offline-spike-v1';
const COI = {
    'Cross-Origin-Opener-Policy':   'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin',
};

// self.__WFD_PRECACHE — the app-shell file list (scripts/gen-sw-manifest.sh).
try { importScripts('./sw-manifest.js'); } catch (_) { self.__WFD_PRECACHE = ['./index.html']; }

self.addEventListener('install', (e) => {
    e.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        // Precache resiliently: one missing file must NOT fail the whole install.
        await Promise.all((self.__WFD_PRECACHE || []).map(u =>
            cache.add(new Request(u, { cache: 'reload' })).catch(() => {})));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (e) => {
    e.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

// Re-assert COI headers (offline path only). Opaque responses can't be rewritten —
// they keep whatever the source sent; we skip them.
function withCOI(resp) {
    if (!resp || resp.status === 0 || resp.type === 'opaque' || resp.type === 'opaqueredirect') return resp;
    const h = new Headers(resp.headers);
    for (const k in COI) h.set(k, COI[k]);
    return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
}

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;                      // leave POST/etc. alone
    let url;
    try { url = new URL(req.url); } catch (_) { return; }
    if (url.origin !== self.location.origin) return;       // cross-origin → untouched

    e.respondWith((async () => {
        try {
            // NETWORK-FIRST: online is unchanged. Cache a clone for offline use.
            const net = await fetch(req);
            if (net && net.ok && net.type === 'basic') {
                const copy = net.clone();
                caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
            }
            return net;                                    // UNMODIFIED response online
        } catch (err) {
            // OFFLINE: serve from cache, re-asserting COI so scsynth still gets threads.
            const cached = await caches.match(req);
            if (cached) return withCOI(cached);
            if (req.mode === 'navigate') {
                const shell = (await caches.match('./index.html')) || (await caches.match('./'));
                if (shell) return withCOI(shell);
            }
            throw err;                                     // genuinely unavailable
        }
    })());
});
