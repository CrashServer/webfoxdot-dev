// spans.js — where each STEP of a line lives, in characters.
//
// The live gutter boxes the array element that is sounding right now, and to do that
// something has to read the user's source and say "step 3 of this call is characters
// 14 to 17". That is what this is: pure functions over one line of text, no editor
// and no state.
//
// It used to live inside index.html's inline script, which is where it grew a SECOND
// implementation of "find the matching bracket" and "split the top-level arguments",
// with different rules from the transpiler's — so a line could transpile perfectly and
// still be highlighted at the wrong step. Both now come from js/editor/scan.js, the
// one scanner that knows what a string is; what is left here is the part that is
// genuinely about steps rather than about brackets.

import { matchBracket as _matchBracket, topArgs, skipString } from './scan.js';

// <…> IS a bracket in a player line (a subdivision), so these count it — as a genuine
// alternation only, never an arrow, a comparison or the >> operator itself.
const matchBracket = (text, open) => _matchBracket(text, open, true);

// Element spans of one [...] array opening at `open`; returns {spans,end}.
export function arraySpans(text, open) {
    const j = matchBracket(text, open);
    if (j < 0) return null;
    const spans = []; let d = 0, start = open + 1;
    for (let k = open + 1; k <= j; k++) {
        const c = text[k];
        // A comma inside a string is not a separator: play(["x,o", "b"]) is two
        // elements, not three. This loop keeps its own body rather than calling
        // topArgs because it trims and recurses into nested <…>.
        if ('"\'`'.includes(c)) { k = skipString(text, k) - 1; continue; }
        if (k === j || (c === ',' && d === 0)) {
            let s = start, e = k;
            while (s < e && /\s/.test(text[s])) s++;
            while (e > s && /\s/.test(text[e - 1])) e--;
            if (e > s) { const sp = [s, e]; const a = nestedAltSpans(text, s, e); if (a) sp.alt = a; spans.push(sp); }
            start = k + 1;
        } else if (c === '(' || c === '[' || c === '{' || c === '<') d++;
        else if (c === ')' || c === ']' || c === '}' || c === '>') d--;
    }
    return { spans, end: j };
}

// Element spans of a <…> alternation (split on top-level spaces/commas), so the
// highlight can move through the alternated items like a [...] sequence.
export function altSpans(text, open) {
    const j = matchBracket(text, open);
    if (j < 0) return null;
    const spans = []; let d = 0, start = open + 1;
    for (let k = open + 1; k <= j; k++) {
        const c = text[k];
        if (k === j || ((c === ',' || /\s/.test(c)) && d === 0)) {
            let s = start, e = k;
            while (s < e && /\s/.test(text[s])) s++;
            while (e > s && /\s/.test(text[e - 1])) e--;
            if (e > s) spans.push([s, e]);
            start = k + 1;
        } else if ('([{<'.includes(c)) d++;
        else if (')]}>'.includes(c)) d--;
    }
    return { spans, end: j };
}

// If element text [s,e) contains a <…> alternation (e.g. the (<4, 8>, 2) chord),
// return its item spans (absolute) so the highlight can pin the ACTIVE item.
function nestedAltSpans(text, s, e) {
    for (let k = s; k < e; k++) {
        if (text[k] === '<') { const r = altSpans(text, k); return (r && r.spans.length > 1) ? r.spans : null; }
    }
    return null;
}

const _ARP_MODES = ['up', 'down', 'updown', 'downup', 'random'];

// A mode arg → mode name. "downup"/'downup' → name; an integer → index into
// _ARP_MODES; anything else (a var/expr) → 'up' (a sensible default order).
export function parseArpMode(s) {
    s = (s || '').trim();
    const q = s.match(/^["']([a-zA-Z]+)["']$/); if (q) return q[1].toLowerCase();
    if (/^-?\d+(\.\d+)?$/.test(s)) return _ARP_MODES[((Math.round(+s) % 5) + 5) % 5];
    return 'up';
}

// Parse `arp( … )` whose '(' is at `open`: return the base array's element spans
// plus the resolved mode/octaves, and where the call ends.
export function arpArg(text, open) {
    const close = matchBracket(text, open);
    if (close < 0) return null;
    let depth = 0, arrOpen = -1;
    for (let k = open; k <= close; k++) {
        const c = text[k];
        if ('([{<'.includes(c)) { depth++; if (c === '[' && depth === 2) { arrOpen = k; break; } }
        else if (')]}>'.includes(c)) depth--;
    }
    if (arrOpen < 0) return null;
    const r = arraySpans(text, arrOpen);
    if (!r || !r.spans.length) return null;
    const args = topArgs(text, open, close);
    const mode = parseArpMode(args[1]);
    let oct = 1; if (args[2] != null) { const o = parseFloat(args[2]); if (!isNaN(o)) oct = Math.max(1, Math.round(o)); }
    return { spans: r.spans, mode, oct, end: close };
}

// Which SOURCE index (0..len-1) arp is sounding at `step`. -1 = can't pin (random).
export function arpIndex(len, step, mode, oct) {
    oct = Math.max(1, oct || 1);
    let seq = Array.from({ length: len * oct }, (_, i) => i % len);   // base spanned across octaves
    if (mode === 'random') return -1;
    if (mode === 'down') seq.reverse();
    else if (mode === 'updown') seq = seq.concat(seq.slice(1, -1).reverse());
    else if (mode === 'downup') seq = seq.slice().reverse().concat(seq.slice(1, -1));
    return seq[((step % seq.length) + seq.length) % seq.length];
}

// All stepped arrays on a line: the degree + every direct param=[...] (and for
// play(), the chars of a flat string). Each is highlighted at step % its length.
export function parseArrays(lineText) {
    const ge = lineText.indexOf('>>');
    if (ge < 0) return null;
    const op = lineText.indexOf('(', ge);
    if (op < 0) return null;
    if (/^\s*~?\s*play\b/.test(lineText.slice(ge + 2))) {
        let i = op + 1; while (i < lineText.length && /\s/.test(lineText[i])) i++;
        let q = ''; if (lineText[i] === '"' || lineText[i] === "'") { q = lineText[i]; i++; }
        // UNQUOTED patterns count too — play(x.x.x.) is the documented house style
        // and what every bundled example uses, so requiring quotes here meant drum
        // lines never lit up while synth lines did. Without a quote the pattern
        // runs to the first top-level comma (the start of the params) or to the
        // closing paren.
        const end = q ? -1 : matchBracket(lineText, op);
        // One span per top-level token (char / . / space = one step; a bracket
        // group (..) [..] {..} <..> = one step spanning the whole group) so the
        // highlight stays aligned even with brackets.
        const spans = [];
        let patEnd = lineText.length;
        for (let k = i; k < lineText.length; k++) {
            const c = lineText[k];
            if (q) { if (c === q) { patEnd = k + 1; break; } }
            else if (c === ',' || k === end) { patEnd = k; break; }   // params start here
            else if (/\s/.test(c) && !spans.length) continue;   // leading space
            if ('([{<'.includes(c)) {
                // A THIRD copy of "find the matching bracket" used to live here,
                // counting every < and > and skipping no strings — so a play pattern
                // containing either was measured wrong. One scanner now.
                const j = matchBracket(lineText, k);
                if (j < 0) { spans.push([k, k + 1]); continue; }
                spans.push([k, j + 1]); k = j;
            } else {
                spans.push([k, k + 1]);             // char / . / space — one step each
            }
        }
        // …then the PARAMS, exactly as a synth line's are. `k` stopped either on the
        // comma before the params or at the closing paren.
        const rest = spans.length ? scanArgs(lineText, patEnd, 1) : scanArgs(lineText, op, 0);
        const all = spans.length ? [spans, ...rest] : rest;
        return all.length ? all : null;
    }
    const args = scanArgs(lineText, op, 0);
    return args.length ? args : null;
}

// Every stepped array / group / generator that is a DIRECT argument of the call.
// Shared by both branches: play() reuses it for its params, which used to get
// nothing at all — a play line highlighted its drum pattern and then stopped, so
// crush={0.3, 0.6, 2} sat dark while the identical thing on a synth line was boxed.
// `from`/`depth` let play() start after its pattern, already inside the parens.
function scanArgs(lineText, from, depth) {
    const out = [];
    let pdepth = depth;
    for (let k = from; k < lineText.length; k++) {
        const c = lineText[k];
        if (c === '(') {
            // A chord group as a direct arg — dbass((0,4,7)) — highlights the whole
            // group (its notes fire together). A nested call foo(...) is preceded by
            // an identifier/] , so it just deepens the paren depth instead.
            let p = k - 1; while (p >= 0 && /\s/.test(lineText[p])) p--;
            // arp([…], mode) as a direct arg → track its base array in play order.
            if (pdepth === 1) {
                let q = p; while (q >= 0 && /\w/.test(lineText[q])) q--;
                if (lineText.slice(q + 1, p + 1) === 'arp') {
                    const info = arpArg(lineText, k);
                    if (info) { const arr = info.spans; arr.arp = { mode: info.mode, oct: info.oct }; out.push(arr); k = info.end; continue; }
                }
            }
            if (pdepth === 1 && (p < 0 || lineText[p] === '(' || lineText[p] === ',')) {
                const j = matchBracket(lineText, k);
                if (j > k) { const sp = [k, j + 1]; const a = nestedAltSpans(lineText, k, j + 1); if (a) sp.alt = a; out.push([sp]); k = j; continue; }
            }
            pdepth++;
        }
        else if (c === ')') { pdepth--; if (pdepth === 0) break; }
        else if (c === '[' && pdepth === 1) {
            const r = arraySpans(lineText, k);
            if (r && r.spans.length) { out.push(r.spans); k = r.end; }
        }
        else if (c === '<' && pdepth === 1) {
            // <a b c> is SUBDIVISION — it crams its items into one step (a ratchet).
            // Track its items so the mark moves through them within that step.
            // (ALTERNATION is nested [ ]: [0, [4, 7]] → 0,4,0,7. The two were
            // swapped in beta07 and these comments still said "alternation", which
            // is how a wrong example ended up in the docs.)
            const r = altSpans(lineText, k);
            if (r && r.spans.length) { out.push(r.spans); k = r.end; }
        }
        else if (c === '{' && pdepth === 1) {
            // {a,b,c} random pick — can't pin the element; highlight the group.
            const j = matchBracket(lineText, k);
            if (j > k) { out.push([[k, j + 1]]); k = j; }
        }
        else if (pdepth === 1 && c === 'P' && /^P[A-Za-z]\w*\s*\(/.test(lineText.slice(k)) && !/^Pvar\s*\(/.test(lineText.slice(k))) {
            // A P-generator as a direct argument — PRand, PContour, PEuclid, motif…
            // Its values are COMPUTED, so no element of any array it contains is
            // "the one playing" and boxing one would point at the wrong number.
            // Box the generator instead: the same choice {a,b} gets, and the same
            // honest statement — this is the source, but not which value.
            //
            // Pvar is excluded: it looks like a P-generator but IS pinnable, and the
            // var overlay already boxes whichever of its patterns is live. Marking
            // it here too drew two boxes on one call.
            //
            // Without this a line like  lapin(PContour([3,7,7],8,7), dur=[1/8,1])
            // highlighted its DUR array and nothing else, drawing the eye to the
            // one argument that was not making the notes.
            const o = lineText.indexOf('(', k);
            const j = o > k ? matchBracket(lineText, o) : -1;
            if (j > o) { out.push([[k, j + 1]]); k = j; }
        }
    }
    return out;          // always an array — callers spread it
}

export function arraysFor(lineText) {
    if (_spanCache.has(lineText)) return _spanCache.get(lineText);
    const arrays = parseArrays(lineText);
    if (_spanCache.size > 300) _spanCache.clear();
    _spanCache.set(lineText, arrays);
    return arrays;
}

export function _numArray(s) {               // "[800, 4000]" → [800,4000] | null (plain numbers only)
    const out = [];
    for (const p of s.slice(1, -1).split(',')) { const t = p.trim(); if (!t) continue; const n = Number(t); if (!isFinite(n)) return null; out.push(n); }
    return out.length ? out : null;
}

// Top-level elements of "[a, b, (c,d)]" → their [start,end) spans. Used to box the
// ACTIVE element of a step-hold var, where the values need not be numbers.
export function elementSpans(text, open) {
    const close = matchBracket(text, open);
    if (close < 0) return null;
    const out = [];
    let depth = 0, s = -1;
    for (let k = open + 1; k < close; k++) {
        const c = text[k];
        if ('([{<'.includes(c)) depth++;
        else if (')]}>'.includes(c)) depth--;
        if (depth === 0 && c === ',') { if (s >= 0) { out.push([s, k]); s = -1; } continue; }
        if (s < 0 && !/\s/.test(c)) s = k;
    }
    if (s >= 0) out.push([s, close]);
    return out.length ? out : null;
}

// Which segment of a var is live at `beat`, and how far into it — the same walk
// normDurs/tpos do in js/patterns/timevars.js, kept local so the overlay never has
// to reach into a TimeVar's internals.
export function varPos(durs, beat) {
    const total = durs.reduce((a, b) => a + b, 0);
    if (!(total > 0)) return { idx: 0, t: 0 };
    let t = ((beat % total) + total) % total, i = 0;
    while (i < durs.length - 1 && t >= durs[i]) { t -= durs[i]; i++; }
    return { idx: i, t };
}

export function stepIndex(durs, beat) { return varPos(durs, beat).idx; }
