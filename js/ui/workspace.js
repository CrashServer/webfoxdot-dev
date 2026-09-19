// workspace.js — the whole workspace in one line of the set file.
//
// Save used to write the editor buffer and nothing else, which is most of a set and
// not all of one. The scratch pads you worked the idea up in, where you had dragged
// the panels, which kit was loaded, the seed that makes the random choices come out
// the same twice — all of that lived in localStorage, which is this browser, this
// profile, this machine. Open the file somewhere else and you got the text back and
// none of the room it was written in.
//
// So the file carries both. The set stays exactly what it was — readable, pasteable,
// runnable, a .py like any other — and everything else goes on ONE comment line at
// the end:
//
//     #:crashdot:{"v":1,"pads":[…],"storage":{…}}
//
// A comment, so nothing about running the file changes. One line, so a diff of two
// versions of a set still shows you the music. And deletable: strip that line and
// you have the bare set, which is sometimes exactly what you want to send someone.
//
// What "everything" means here is deliberately the whole of localStorage rather than
// a list of keys this module knows about. A hand-kept list is wrong the first time
// somebody adds a setting and forgets, and the failure is silent — you find out when
// a set opens missing something months later.

const MARK = '#:crashdot:';

// Two exceptions to "everything", and both would do harm rather than nothing.
// wfd-tab-id identifies this BROWSER TAB inside a session; restoring it into another
// tab gives two of them the same identity. wfd-tabs is the pads, which travel in
// `pads` below as live text rather than as whatever was last debounced to disk.
const SKIP = new Set(['wfd-tab-id', 'wfd-tabs']);

/**
 * Everything, as a plain object.
 * @param {object} api  tabs() -> [{name, doc, main}] · set() -> the set's text
 */
export function snapshotWorkspace({ tabs, set } = {}) {
    const pads = [];
    try {
        for (const t of (tabs ? tabs() : [])) {
            // The live doc, not the persisted copy: tabs.js debounces its writes by
            // 400ms, so saving within a keystroke of typing would store the text as
            // it was before the last word.
            pads.push({ name: t.name, main: !!t.main, text: t.doc ? t.doc.getValue() : '' });
        }
    } catch (_) {}
    if (!pads.length && set) pads.push({ name: 'set', main: true, text: set() });

    const storage = {};
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || SKIP.has(k)) continue;
            storage[k] = localStorage.getItem(k);
        }
    } catch (_) {}

    return { v: 1, app: 'crashDot', saved: new Date().toISOString(), pads, storage };
}

/** The comment line to append to a set file, or '' when there is nothing to say. */
export function encodeWorkspace(state) {
    if (!state) return '';
    let json;
    try { json = JSON.stringify(state); } catch (_) { return ''; }
    return '\n\n'
        + '# ── crashDot workspace ───────────────────────────────────────────────\n'
        + '# Everything that is not the set itself: the other pads, where the panels\n'
        + '# were, the theme, the kit, the seed. One comment line, so this is still a\n'
        + '# .py you can read and run. Delete it and you have the bare set.\n'
        + MARK + json + '\n';
}

/**
 * Pull the workspace back out of a set file.
 * @returns {{ text: string, state: object|null }}  text has the block removed
 */
export function decodeWorkspace(raw) {
    const src = String(raw || '');
    const at = src.lastIndexOf('\n' + MARK);
    if (at < 0) return { text: src, state: null };
    const lineEnd = src.indexOf('\n', at + 1);
    const json = src.slice(at + 1 + MARK.length, lineEnd < 0 ? undefined : lineEnd);
    let state = null;
    try { state = JSON.parse(json); } catch (_) { state = null; }
    // A state line we could not read is still not part of the music, so it comes out
    // either way — leaving it in would put a wall of JSON in the editor.
    let text = src.slice(0, at) + (lineEnd < 0 ? '' : src.slice(lineEnd + 1));
    // The comment header we wrote above it goes too, or opening and saving twice
    // stacks a header each time.
    // (?:\n|$) on the last line: after the state line is cut the header is the end of
    // the string with no newline after it, and requiring one made this match nothing
    // — so every save-then-open stacked another header.
    text = text.replace(/\n*# ── crashDot workspace ─+\n(?:#[^\n]*(?:\n|$))*$/, '\n');
    return { text: text.replace(/\s+$/, '') + '\n', state };
}

/**
 * Put it back.
 *
 * Some of this lands immediately and some of it cannot: a panel layout is read when
 * the desktop builds its panels, so writing the key now and applying it now are two
 * different things. Rather than pretend, this reports what it actually did, and the
 * caller says so out loud.
 *
 * @param {object} state
 * @param {object} api  newPad(name, text) · setMain(text) · closePads()
 *                      applyTheme(name) · applyScale(n) · applyLayoutNow()
 * @returns {{ pads: number, keys: number, live: string[], onReload: string[] }}
 */
export function restoreWorkspace(state, api = {}) {
    const out = { pads: 0, keys: 0, live: [], onReload: [] };
    if (!state || typeof state !== 'object') return out;

    // ── configuration ───────────────────────────────────────────────────────
    if (state.storage && typeof state.storage === 'object') {
        for (const [k, v] of Object.entries(state.storage)) {
            if (SKIP.has(k) || typeof v !== 'string') continue;
            try { localStorage.setItem(k, v); out.keys++; } catch (_) {}
        }
    }

    // ── the pads ────────────────────────────────────────────────────────────
    if (Array.isArray(state.pads) && state.pads.length) {
        const main = state.pads.find(p => p.main) || state.pads[0];
        try { if (api.setMain) api.setMain(main.text || ''); } catch (_) {}
        try { if (api.closePads) api.closePads(); } catch (_) {}
        for (const p of state.pads) {
            if (p === main) continue;
            try { if (api.newPad) { api.newPad(p.name, p.text || ''); out.pads++; } } catch (_) {}
        }
        out.live.push(`${out.pads + 1} pad${out.pads ? 's' : ''}`);
    }

    // ── the things that can change under you right now ──────────────────────
    const s = state.storage || {};
    if (s.theme && api.applyTheme) { try { api.applyTheme(s.theme); out.live.push('theme'); } catch (_) {} }
    if (s['wfd-uiscale'] && api.applyScale) {
        const n = Number(s['wfd-uiscale']);
        if (isFinite(n) && n > 0) { try { api.applyScale(n); out.live.push('ui size'); } catch (_) {} }
    }
    if (s['wfd-desktop-panels'] && api.applyLayoutNow) {
        try { out[api.applyLayoutNow() ? 'live' : 'onReload'].push('panel layout'); }
        catch (_) { out.onReload.push('panel layout'); }
    } else if (s['wfd-desktop-panels']) out.onReload.push('panel layout');

    // Everything else is read at boot by whoever owns it.
    const rest = Object.keys(s).filter(k => !['theme', 'wfd-uiscale', 'wfd-desktop-panels'].includes(k));
    if (rest.length) out.onReload.push(`${rest.length} other setting${rest.length === 1 ? '' : 's'}`);
    return out;
}
