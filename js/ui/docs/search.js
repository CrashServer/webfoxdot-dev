// search.js — one field across every tab.
//
// The panel has ten tabs and something over six hundred entries behind them: 235
// reference rows, 141 synths, 21 whole-frame and 52 per-layer effects, 255 scenes,
// the shortcuts, the examples. Finding `PGauss` or `halftone` meant knowing which
// tab it lived in and then scanning — and Alt+I only helps if you can already spell
// the thing. So: type a name, see it, wherever it lives.
//
// The index is built from the SAME tables the tabs render, not from a second copy of
// the content. Two lists of the vocabulary drift, and this codebase has paid for that
// twice already (the transpiler's pattern list, and theme() with two doc entries).

import { SHORTCUTS, PATTERNS, TIMEVARS, FUNCTIONS, PLAYER_PARAMS, METHODS } from './reference.js';
import { CHANGELOG, splitItem } from './changelog.js';

let _index = null;

/** Build it once, lazily — nobody pays for it until they type. */
export function docIndex({ synths = {}, fx = {}, scenes = [], examples = [] } = {}) {
    if (_index) return _index;
    const out = [];
    // `bare` is the name without its signature — PGauss out of "PGauss(mean, deviation)"
    // — so typing the whole name counts as an exact match on the DEFINITION rather
    // than only on whatever example happens to be titled after it.
    const add = (kind, tab, name, desc, insert, full) =>
        out.push({ kind, tab, name, desc: desc || '', insert: insert || null,
                   bare: String(name).replace(/[(=\s].*$/, '').replace(/^\.+/, '').toLowerCase(),
                   hay: (name + ' ' + (desc || '')).toLowerCase(),
                   // The whole entry, for changelog rows: what you remember about one
                   // is usually a word from the MIDDLE of it — "recycled", "initDrag",
                   // "sw-manifest" — not its opening clause. Lowercased on first use
                   // rather than up front, so a session that never searches does not
                   // pay to fold half a megabyte of prose.
                   full: full || null, _lc: null });

    for (const it of PATTERNS)      add('pattern',  'patterns',  it.name, it.desc, it.name);
    for (const it of TIMEVARS)      add('timevar',  'patterns',  it.name, it.desc, it.name);
    for (const it of FUNCTIONS)     add('function', 'functions', it.name, it.desc, it.name);
    for (const it of PLAYER_PARAMS) add('param',    'functions', it.name, it.desc, it.name + '=');
    for (const it of METHODS)       add('method',   'functions', it.name, it.desc, it.name);
    for (const it of SHORTCUTS)     add('shortcut', 'shortcuts', it.key, it.desc);

    for (const [name, def] of Object.entries(synths)) {
        const params = Object.keys(def.defaults || {}).join(', ');
        add('synth', 'synths', name, `Synth — ${params}`, `p1 >> ${name}([0, 2, 4])`);
    }
    for (const [name, reg] of Object.entries(fx)) add('fx', 'fx', name, reg.desc, `${name}=${reg.default}`);
    for (const name of scenes) add('scene', 'visuals', name, 'Visual scene', `video1 >> ${name}()`);
    for (const ex of examples) add('example', 'examples', ex.title || ex.id, ex.cat || '', `attack("${ex.id}")`);

    // The changelog too. It is the most detailed writing in the project — why a thing
    // works the way it does, and what it used to do instead — and none of it was
    // reachable except by scrolling 233KB of it. Indexed on the HEADLINE plus the
    // version, so the haystack stays small and a match points at something readable;
    // ranked last (see RANK below), so it never crowds out the reference row for a name.
    for (const g of CHANGELOG) {
        for (const item of g.items || []) {
            const raw = typeof item === 'string' ? item : item.t;
            if (!raw) continue;
            const { summary } = splitItem(raw);
            add('changelog', 'changelog', summary.slice(0, 120), g.v || '', null, raw);
        }
    }

    _index = out;
    return out;
}

/**
 * Rank matches. An exact name wins, then a name that starts with the query, then a
 * name that contains it, and only then the description — so typing "rand" puts
 * PRand above the nine entries whose prose mentions randomness.
 */
export function searchDocs(q, index) {
    const s = String(q || '').trim().toLowerCase();
    if (s.length < 2) return [];
    // An example is material that USES a thing; the reference row IS the thing. On an
    // equal match the definition goes first — looking up PGauss should explain PGauss
    // before it offers a set that happens to be named after it.
    const RANK = { example: 1, changelog: 1 };
    const hits = [];
    for (const e of index) {
        const n = e.name.toLowerCase();
        let score = -1;
        if (e.bare === s) score = 0;
        else if (n === s) score = 1;
        else if (e.bare.startsWith(s) || n.startsWith(s)) score = 2;
        else if (n.includes(s)) score = 3;
        else if (e.hay.includes(s)) score = 4;
        else if (e.full) {
            if (e._lc === null) e._lc = e.full.toLowerCase();
            if (e._lc.includes(s)) score = 5;
        }
        if (score >= 0) hits.push({ e, score: score * 2 + (RANK[e.kind] || 0) });
    }
    hits.sort((a, b) => a.score - b.score || a.e.name.length - b.e.name.length || a.e.name.localeCompare(b.e.name));
    return hits.slice(0, 80).map(x => x.e);
}

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Wrap the matched run so the eye lands on why this row is here. */
function mark(text, q) {
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
}

export function renderResults(hits, q) {
    if (!hits.length) return `<div class="docs-note">nothing matches “${esc(q)}”</div>`;
    return `<div class="docs-results">` + hits.map((e, i) => `
        <div class="docs-hit" data-i="${i}" data-tab="${e.tab}"${e.insert ? ` data-insert="${esc(e.insert)}"` : ''}>
            <span class="docs-hit-kind docs-kind-${e.kind}">${e.kind}</span>
            <span class="docs-hit-name">${mark(e.name, q)}</span>
            <span class="docs-hit-desc">${mark(e.desc.slice(0, 220), q)}${e.desc.length > 220 ? '…' : ''}</span>
        </div>`).join('') + `</div>`;
}
