// Offline PWA client (M1 install · M2 offline · M4 update + degradation).
// Purely additive and defensive: if anything is unsupported or fails, the app runs
// EXACTLY as before. The SW is network-first, so online behaviour is unchanged.
(function () {
    const bar = () => document.getElementById('toolbar');

    // Small dynamically-created toolbar chips (no HTML changes needed).
    function chip(id, text, title) {
        let el = document.getElementById(id);
        if (el) return el;
        el = document.createElement('button');
        el.id = id; el.textContent = text; el.title = title || '';
        el.style.display = 'none';
        const t = bar(); if (t) t.appendChild(el);
        return el;
    }

    // ── Offline degradation ─────────────────────────────────────────────────
    // Solo coding works fully offline; multiplayer + the galaxy need the server, so
    // grey them out (via a body class) and show an "offline" badge. Online = no change.
    function setOffline(off) {
        if (document.body) document.body.classList.toggle('is-offline', off);
        const b = chip('pwa-offline-badge', '⚡ offline',
            'No connection — multiplayer & the galaxy are paused. Solo coding works fully.');
        if (b) b.style.display = off ? '' : 'none';
    }
    window.addEventListener('online',  () => setOffline(false));
    window.addEventListener('offline', () => setOffline(true));
    setOffline(!navigator.onLine);   // script runs at end of <body>, DOM is ready

    if (!('serviceWorker' in navigator)) return;

    // ── Update flow (never reload mid-set) ──────────────────────────────────
    let userTriggeredUpdate = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Only reload when the USER asked to update — never on the first-visit claim.
        if (userTriggeredUpdate) location.reload();
    });

    function showUpdate(worker) {
        const btn = chip('btn-update', '✨ update',
            'A new version of crashDot is ready — click to reload into it.');
        if (!btn) return;
        btn.style.display = '';
        btn.onclick = () => {
            userTriggeredUpdate = true;
            btn.disabled = true;
            worker.postMessage({ type: 'SKIP_WAITING' });   // → activates → controllerchange → reload
        };
    }

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
            console.info('[pwa] offline service worker registered (scope:', reg.scope + ')');
            // An update already downloaded on a previous visit?
            if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
            // An update arriving now.
            reg.addEventListener('updatefound', () => {
                const nw = reg.installing;
                if (!nw) return;
                nw.addEventListener('statechange', () => {
                    if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdate(nw);
                });
            });
        }).catch((e) => {
            console.warn('[pwa] service worker registration failed — app unaffected:', e);
        });
    });

    // ── Install prompt → an "install" chip ──────────────────────────────────
    let deferred = null;
    const standalone = () =>
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferred = e;
        if (standalone()) return;
        const btn = chip('btn-install', '⬇ install', 'Install crashDot as an app — runs offline');
        if (!btn) return;
        btn.style.display = '';
        btn.onclick = async () => {
            if (!deferred) return;
            btn.disabled = true;
            deferred.prompt();
            try { await deferred.userChoice; } catch (_) {}
            deferred = null;
            btn.remove();
        };
    });
    window.addEventListener('appinstalled', () => {
        deferred = null;
        const btn = document.getElementById('btn-install');
        if (btn) btn.remove();
    });
})();
