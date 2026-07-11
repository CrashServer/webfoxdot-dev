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

    // ── Install — ALWAYS offer the affordance (the site tells people to click it) ──
    // Chrome/Edge over HTTPS(or localhost) fire `beforeinstallprompt` → one-click
    // install. Firefox/Safari/plain-http never fire it, so the button would silently
    // never appear. Instead we always show it (unless already installed) and, when
    // there's no native prompt, explain the manual path.
    let deferred = null;
    const standalone = () =>
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

    function installHint() {
        let tip = document.getElementById('pwa-install-tip');
        if (tip) { tip.remove(); return; }
        const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
        tip = document.createElement('div');
        tip.id = 'pwa-install-tip';
        tip.style.cssText = 'position:fixed;top:46px;right:12px;max-width:310px;z-index:9999;background:#0d1512;color:#c8d6cd;'
            + 'border:1px solid #1f4d2b;border-radius:8px;padding:12px 14px;font:12px/1.55 monospace;box-shadow:0 8px 28px rgba(0,0,0,.55)';
        tip.innerHTML = '<b style="color:#63b982">Install crashDot</b><br>'
            + (secure ? '' : '⚠ Install needs <b>HTTPS</b> (or localhost). This page is plain http, so browsers won\'t offer it.<br><br>')
            + '<b>Chrome / Edge</b> — the ⊕ / install icon in the address bar, or ⋮ menu → “Install crashDot…”.<br>'
            + '<b>iPhone / iPad</b> — Share → Add to Home Screen.<br>'
            + '<b>Firefox</b> — no app install, but it still runs offline in the browser.'
            + '<div style="text-align:right;margin-top:9px"><button id="pwa-tip-x" style="padding:2px 9px">got it</button></div>';
        document.body.appendChild(tip);
        document.getElementById('pwa-tip-x').onclick = () => tip.remove();
    }

    // Our custom install chip is HIDDEN until the PWA flow is thoroughly tested. The
    // service worker still registers (offline works), and Chrome/Edge still show their
    // native address-bar install icon — we just don't surface our own button yet.
    const SHOW_INSTALL_BUTTON = false;
    function showInstall() {
        if (!SHOW_INSTALL_BUTTON) return;
        if (standalone()) return;                 // already installed → nothing to do
        const btn = chip('btn-install', '⬇ install', 'Install crashDot as an app — runs offline');
        if (!btn) return;
        btn.style.display = '';
        btn.onclick = async () => {
            if (deferred) {                        // native one-click install available
                btn.disabled = true;
                deferred.prompt();
                try { await deferred.userChoice; } catch (_) {}
                deferred = null; btn.disabled = false;
            } else {
                installHint();                     // explain the manual path
            }
        };
    }

    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; showInstall(); });
    window.addEventListener('appinstalled', () => {
        deferred = null;
        const btn = document.getElementById('btn-install'); if (btn) btn.remove();
        const tip = document.getElementById('pwa-install-tip'); if (tip) tip.remove();
    });
    // Surface it immediately, without waiting for a prompt event that may never come.
    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', showInstall);
    else showInstall();
})();
