// Alt+I — show info about the symbol under the cursor (synth, FX, pattern,
// function, param). Looks up the word, or the enclosing function call, and
// shows a tooltip near the cursor.

import { SYNTH_DEFS }  from '../synths/registry.js';
import { FX_REGISTRY } from '../fx/registry.js';
import { PATTERNS, TIMEVARS, FUNCTIONS, PLAYER_PARAMS, METHODS } from '../ui/docs.js';

// Build a name → { kind, sig, desc } lookup once.
let _defs = null;
function defs() {
    if (_defs) return _defs;
    // Common params (amp/dur/pan/attack/release) are uniform across synths, so we
    // hide them from the inspected signature to keep it to the synth's own controls.
    const HIDDEN = new Set(['amp', 'dur', 'pan', 'attack', 'release', 'oct']);
    const d = {};
    for (const [name, def] of Object.entries(SYNTH_DEFS)) {
        const params = Object.keys(def.defaults).filter(k => !HIDDEN.has(k)).join(', ');
        d[name] = [{ kind: 'synth', sig: `${name}([degree]${params ? ', ' + params : ''})`,
                     desc: `Synth — params: ${params}` }];
    }
    for (const [name, reg] of Object.entries(FX_REGISTRY)) {
        d[name] = [{ kind: 'fx', sig: `${name}=${reg.default}`, desc: reg.desc }];
    }
    // EVERY sense of a name, not the first one found.
    //
    // Ten names carry more than one meaning in the reference, and keeping only the
    // first meant you could not reach the other: `attack` is both a function that
    // pulls a block out of the examples library and the envelope parameter, `release`
    // is both giving up a claimed track and the envelope, and seven player methods
    // are listed once as functions and once as methods. Alt+I showed whichever
    // happened to be earlier in the file, which is not a property anyone can predict.
    const add = (arr, kind) => {
        for (const it of arr) {
            const nm = it.name.replace(/[(=\s].*$/, '').replace(/^\.*/, '').split('.').pop();
            if (!nm) continue;
            const entry = { kind, sig: it.name.replace(/^\.+/, ''), desc: it.desc };
            // A second entry that says the same thing as the first is a duplicate,
            // not a second meaning — drop it rather than show the tooltip twice.
            if (d[nm]) { if (!d[nm].some(e => e.desc === entry.desc)) d[nm].push(entry); }
            else d[nm] = [entry];
        }
    };
    add(PATTERNS, 'pattern');
    add(TIMEVARS, 'timevar');
    add(FUNCTIONS, 'function');
    add(PLAYER_PARAMS, 'param');
    // Chained player methods (.unison, .every, .sometimes…). Added last so a name
    // that is also a synth or FX keeps its own entry — `solo` and `stop` exist in
    // both worlds, and the eval-scope meaning is the one you are more likely to be
    // looking at when the cursor is on a bare word.
    add(METHODS, 'method');
    _defs = d;
    return d;
}

let _evalSnippet = null;
export function initInspect(evalSnippet) { _evalSnippet = evalSnippet; }

// Find the call (name + full `name(...)` text) under/around `pos`, most specific.
function callAt(line, pos) {
    const re = /([a-zA-Z_]\w*)\s*\(/g;
    let m, best = null, bestOpen = -1;
    while ((m = re.exec(line)) !== null) {
        const start = m.index, open = m.index + m[0].length - 1;
        let depth = 1, close = open;
        for (let i = open + 1; i < line.length && depth > 0; i++) {
            if (line[i] === '(') depth++;
            else if (line[i] === ')') depth--;
            close = i;
        }
        if (pos >= start && pos <= close + 1 && open > bestOpen) {
            best = { name: m[1], text: line.slice(start, close + 1) };
            bestOpen = open;
        }
    }
    return best;
}

const round = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);

function esc(s) { return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function showTip(cm, cursor, word, infos, preview) {
    document.querySelectorAll('.wfd-tip').forEach(e => e.remove());
    const co  = cm.cursorCoords(cursor, 'page');
    const tip = document.createElement('div');
    tip.className = 'wfd-tip';
    let html = (infos && infos.length)
        ? infos.map((info, i) =>
            (i ? '<div class="wfd-tip-sep"></div>' : '') +
            `<span class="wfd-tip-kind wfd-kind-${info.kind}">${info.kind}</span>` +
            `<span class="wfd-tip-sig">${esc(info.sig)}</span>` +
            `<div class="wfd-tip-desc">${esc(info.desc)}</div>`).join('')
        : `<div class="wfd-tip-desc">no info for "<b>${esc(word)}</b>"</div>`;
    if (preview != null) html += `<div class="wfd-tip-val">→ ${esc(preview)}</div>`;
    tip.innerHTML = html;
    tip.style.left = co.left + 'px';
    tip.style.top  = (co.bottom + 4) + 'px';
    document.body.appendChild(tip);
    const remove = () => tip.remove();
    setTimeout(remove, 9000);
    const off = () => { cm.off('keydown', off); cm.off('cursorActivity', off); remove(); };
    cm.on('keydown', off);
    cm.on('cursorActivity', off);
}

// Evaluate a pattern/timevar call and return a preview of its values.
function previewOf(call) {
    if (!_evalSnippet || !call) return null;
    let v;
    try { v = _evalSnippet(call.text); } catch (_) { return null; }
    if (v == null) return null;
    if (typeof v.get === 'function') {           // pattern / timevar → sample 16 steps
        const arr = [];
        for (let i = 0; i < 16; i++) { try { arr.push(round(v.get(i))); } catch (_) { arr.push('?'); } }
        return '[' + arr.join(', ') + ' …]';
    }
    if (Array.isArray(v)) return '[' + v.map(round).join(', ') + ']';
    if (typeof v === 'number') return String(round(v));
    return null;
}

export function inspect(cm) {
    const cursor = cm.getCursor();
    const line = cm.getLine(cursor.line);
    const tok = cm.getTokenAt(cursor);
    let word = (tok.string || '').trim();
    if (word.includes('.')) word = word.split('.').pop();
    const D = defs();
    const call = callAt(line, cursor.ch);
    let infos = D[word];
    if (!infos && call) { infos = D[call.name]; word = call.name; }

    // For patterns/timevars, evaluate the call and show the generated values.
    let preview = null;
    const called = call && D[call.name];
    if (called && called.some(e => e.kind === 'pattern' || e.kind === 'timevar')) {
        preview = previewOf(call);
    }
    showTip(cm, cursor, word, infos, preview);
}
