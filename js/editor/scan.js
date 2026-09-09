// scan.js — one string-aware scanner for FoxDot source text.
//
// Reading a line of the user's code — to find a call's arguments, to match a
// bracket, to split an argument list — is done in a dozen places across the app,
// and it kept being rewritten. The transpiler had fourteen separate quote-skipping
// loops at three different levels of correctness, and index.html grew a SECOND,
// weaker parser for the live gutter, so a line could transpile perfectly and still
// be highlighted at the wrong step. Measured before this existed:
//
//   b1 >> play("x,o", sample=1)         → split INSIDE the string: 3 args, not 2
//   p1 >> pluck([0,2], amp=(x)=>x*2)    → the arrow's '>' closed the arg list early
//   p1 >> pluck([0], text="a>b", amp=1) → truncated at the '>' in the string
//
// So: one place that knows what a string is, and everything that reads source text
// asks it. A leaf module with no imports, so the transpiler, the editor and the
// index.html gutter code can all share it without pulling anything else along.

// ── The one rule about strings ───────────────────────────────────────────────
// Escapes count. Three of the transpiler's fourteen loops handled `\"`, eleven did
// not, and the ones that did not corrupted the CONTENTS of any string that had one.
const QUOTES = '"\'`';

/**
 * Index just past the string literal opening at `text[i]`.
 * Unterminated (a line still being typed) → text.length, so callers make progress.
 */
export function skipString(text, i) {
    const q = text[i];
    for (let j = i + 1; j < text.length; j++) {
        if (text[j] === '\\') { j++; continue; }        // \" \\ \n … — consume the pair
        if (text[j] === q) return j + 1;
    }
    return text.length;
}

// ── Angle brackets ───────────────────────────────────────────────────────────
// <0 4> is a real bracket in this language (a subdivision), which is why the gutter
// counted < and > as brackets at all. But counting them unconditionally breaks an
// arrow function, a comparison, and the >> operator itself. These two predicates are
// the same rule the transpiler's convertAlt uses, written once.
const opensAngle = (text, i) => text[i] === '<' && text[i + 1] !== '<' && text[i + 1] !== '=';
const closesAngle = (text, i) => text[i] === '>'
    && text[i + 1] !== '=' && text[i + 1] !== '>'        // >= and the first > of >>
    && !'=<>'.includes(text[i - 1]);                     // => <> and the second > of >>

const OPEN = '([{', CLOSE = ')]}';

/**
 * Index of the bracket closing the one at `open`, or -1 if unmatched.
 * @param {boolean} angle  also treat a genuine <…> alternation as a bracket pair
 */
export function matchBracket(text, open, angle = false) {
    let depth = 0;
    for (let j = open; j < text.length; j++) {
        const c = text[j];
        if (QUOTES.includes(c)) { j = skipString(text, j) - 1; continue; }
        if (OPEN.includes(c) || (angle && opensAngle(text, j))) depth++;
        else if (CLOSE.includes(c) || (angle && closesAngle(text, j))) { depth--; if (depth === 0) return j; }
    }
    return -1;
}

/**
 * The top-level, comma-separated argument substrings between `open` and `close`
 * (exclusive of both). Returned verbatim — whitespace and all — because callers
 * map them back onto source positions.
 */
export function topArgs(text, open, close, angle = true) {
    const args = [];
    let depth = 0, start = open + 1;
    for (let k = open + 1; k <= close; k++) {
        const c = text[k];
        if (QUOTES.includes(c)) { k = skipString(text, k) - 1; continue; }
        if (k === close || (c === ',' && depth === 0)) { args.push(text.slice(start, k)); start = k + 1; }
        else if (OPEN.includes(c) || (angle && opensAngle(text, k))) depth++;
        else if (CLOSE.includes(c) || (angle && closesAngle(text, k))) depth--;
    }
    return args;
}

/** Split a bare argument list (no surrounding brackets) at its top-level commas. */
export function splitArgs(str) {
    const args = [];
    let cur = '', depth = 0;
    for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (QUOTES.includes(c)) { const j = skipString(str, i); cur += str.slice(i, j); i = j - 1; continue; }
        if (OPEN.includes(c)) depth++;
        else if (CLOSE.includes(c)) depth--;
        else if (c === ',' && depth === 0) { args.push(cur); cur = ''; continue; }
        cur += c;
    }
    if (cur.trim()) args.push(cur);
    return args;
}
