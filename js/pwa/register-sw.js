// Register the offline service worker (M2 spike). Purely additive and defensive:
// if the browser lacks SW support or registration fails, the app runs EXACTLY as
// before (no SW = no behaviour change). The SW is network-first, so even once
// registered the online experience is unchanged — it only serves cache when offline.
(function () {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
            console.info('[pwa] offline service worker registered (scope:', reg.scope + ')');
        }).catch((e) => {
            console.warn('[pwa] service worker registration failed — app unaffected:', e);
        });
    });
})();
