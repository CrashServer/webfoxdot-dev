// Minimal shared language state — the seed of the i18n system (see translate.md).
// For now it drives the guided tour (EN / FR); the full UI catalog builds on this.

export const LANGS = ['en', 'fr'];

export function getLang() {
    try { const l = localStorage.getItem('lang'); if (LANGS.includes(l)) return l; } catch (_) {}
    try { return (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en'; } catch (_) {}
    return 'en';
}

export function setLang(l) {
    try { localStorage.setItem('lang', LANGS.includes(l) ? l : 'en'); } catch (_) {}
}
