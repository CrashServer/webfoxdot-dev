// Offline PWA (M1 install + M2 offline): register the service worker and surface an
// "install" button when the browser offers it. Purely additive and defensive — if
// anything is unsupported or fails, the app runs EXACTLY as before. The SW is
// network-first, so even once registered the online experience is unchanged.
(function () {
    // ── 1. Register the offline service worker ──────────────────────────────
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').then((reg) => {
                console.info('[pwa] offline service worker registered (scope:', reg.scope + ')');
            }).catch((e) => {
                console.warn('[pwa] service worker registration failed — app unaffected:', e);
            });
        });
    }

    // ── 2. Install prompt → a small "install" button in the toolbar ──────────
    let deferred = null;
    const standalone = () =>
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

    function installButton() {
        let btn = document.getElementById('btn-install');
        if (btn) return btn;
        const bar = document.getElementById('toolbar');
        if (!bar) return null;
        btn = document.createElement('button');
        btn.id = 'btn-install';
        btn.textContent = '⬇ install';
        btn.title = 'Install crashDot as an app — runs offline';
        btn.style.display = 'none';
        btn.onclick = async () => {
            if (!deferred) return;
            btn.disabled = true;
            deferred.prompt();
            try { await deferred.userChoice; } catch (_) {}
            deferred = null;
            btn.remove();
        };
        bar.appendChild(btn);
        return btn;
    }

    // Fired by Chromium browsers once the app is installable (manifest + SW + icons).
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();                 // suppress the mini-infobar; use our button
        deferred = e;
        if (standalone()) return;           // already installed → no button
        const btn = installButton();
        if (btn) btn.style.display = '';
    });

    window.addEventListener('appinstalled', () => {
        deferred = null;
        const btn = document.getElementById('btn-install');
        if (btn) btn.remove();
    });
})();
