// Minimal shared language state — the seed of the i18n system (see docs/translate.md).
// For now it drives the guided tour (EN / FR); the full UI catalog builds on this.

export const LANGS = ['en', 'fr', 'de', 'es', 'ja'];

// English is the default; a user opts into another with language("fr") / language("de") / …
export function getLang() {
    try { const l = localStorage.getItem('lang'); if (LANGS.includes(l)) return l; } catch (_) {}
    return 'en';
}

export function setLang(l) {
    try { localStorage.setItem('lang', LANGS.includes(l) ? l : 'en'); } catch (_) {}
}
