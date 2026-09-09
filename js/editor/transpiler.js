// Transpiles FoxDot-style Python syntax to JavaScript.
//
//   p1 >> dbass([0,2,4], oct=3, cutoff=800)
//   → __p('p1').__rshift__(dbass([0,2,4], {oct:3, cutoff:800}))
//
// Also rewrites:
//   var(...)    → _var(...)    (JS reserved word)
//   linvar(...) → _linvar(...) etc.

// Every pass below that walks the line character by character has to skip string
// literals, and each one used to hand-roll it. Three of the fourteen handled a
// backslash escape and eleven did not; six knew about backticks and eight did not.
// So the CONTENTS of a string were rewritten by whichever passes happened to be
// blind to it. One primitive now, from the same module the editor's gutter uses.
import { skipString, splitArgs } from './scan.js';

const QUOTE = (c) => c === '"' || c === "'" || c === '`';

// Hoisted regexes (built once, not per line per eval).
const RE_COMMENT  = /^(\s*)#/;
const RE_DOT_REST = /(?<=[,\[(]\s*)\.(?=\s*[,\]\)])/g;
// Standalone `_` or bare `rest` between list/arg delimiters → a true rest (silence).
const RE_UNDERSCORE_REST = /(?<=[,\[(]\s*)_(?=\s*[,\]\)])/g;
const RE_WORD_REST       = /(?<=[,\[(]\s*)rest(?=\s*[,\]\)])/g;
const RE_RSHIFT   = /^(\s*)(~?)\s*([a-zA-Z_]\w*)\s*>>\s*(.+)$/;
const RE_ATTR     = /^(\s*)([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)\s*=(?!=)\s*(.+)$/;
const RE_RESERVED = /^(Clock|Scale|Root|Master|Server)$/;
const RE_METHOD   = /\b([a-zA-Z_]\w*)\.(every|solo|soloDrop|stutter|reverse|shuffle|stop|only|reroll|degrade|jump|once|penta|mirror|rotate|offbeat|accompany|follow|strum|multiply|map|drummer|chroma|gtr)\s*\(/g;

// Rewrite the FoxDot P object with a depth-aware scanner (regex `[^\]]*` couldn't
// handle nesting, so P[0,[4,2]] produced a mismatched-paren syntax error):
//   P*[a,b] → PRand([a,b])   ·   P[a,b] → Ppat([a,b])   ·   P(a,b) → __group(a,b)
// Nested P forms are rewritten recursively; string literals are copied verbatim.
function rewriteP(s) {
    let out = '', i = 0;
    const idChar = (c) => c && /[\w$]/.test(c);
    while (i < s.length) {
        const c = s[i];
        if (QUOTE(c)) { const j = skipString(s, i); out += s.slice(i, j); i = j; continue; }
        // Not after an identifier char AND not after a '.': obj.P[0] is a member
        // access on somebody's object, not FoxDot's P.
        const m = (c === 'P' && !idChar(s[i - 1]) && s[i - 1] !== '.')
            ? /^P(\s*\*)?\s*([[(])/.exec(s.slice(i)) : null;
        if (m) {
            const isRand = !!m[1], open = m[2];
            const openIdx = i + m[0].length - 1;           // the [ or ( char
            let j = scanToMatch(s, openIdx);
            if (j === -1) j = s.length;                    // unmatched — take the rest
            const inner = rewriteP(s.slice(openIdx + 1, j));   // recurse for nested P
            out += open === '[' ? (isRand ? `PRand([${inner}])` : `Ppat([${inner}])`) : `__group(${inner})`;
            i = j + 1;
            continue;
        }
        out += c; i++;
    }
    return out;
}

// From an opening bracket at s[openIdx], return the index of its matching close
// bracket — honouring nested ()[]{} and skipping string literals ('/"/`, \-escapes).
// Returns -1 if unmatched. The one shared scanner behind rewriteP/convertCurly/findSlice.
function scanToMatch(s, openIdx) {
    let depth = 0;
    for (let j = openIdx; j < s.length; j++) {
        const c = s[j];
        if (QUOTE(c)) { j = skipString(s, j) - 1; continue; }
        if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c)) { depth--; if (depth === 0) return j; }
    }
    return -1;
}

// Blank out string literals (returning a restore fn) so line-level regexes don't
// rewrite tokens that sit inside a quoted string. Placeholder uses NUL so it can't
// collide with real source or match the rest/bracket regexes.
function maskStrings(s) {
    const strs = [];
    const masked = s.replace(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/g, m => `\x00${strs.push(m) - 1}\x00`);
    return { masked, restore: (t) => t.replace(/\x00(\d+)\x00/g, (_, i) => strs[+i]) };
}

// Run a whole-line regex pass with string literals hidden, so a rewrite can never
// reach INSIDE a quoted string. The character-by-character passes skip strings as
// they walk; the regex ones have no such option, and used to rewrite the contents of
// any string that happened to look like code — Server.log("p1.stop()") came out as
// Server.log("__p('p1').stop()").
function maskedReplace(text, fn) {
    const { masked, restore } = maskStrings(text);
    return restore(fn(masked));
}

export function transpile(code) {
    return code.split('\n').map(line => {
        const stripped = line.trim();
        if (!stripped) return line;

        // Full-line Python comment
        if (stripped.startsWith('#')) return line.replace(RE_COMMENT, '$1//');

        // Strip inline comment
        let main = line, tail = '';
        const ci = findCommentChar(line);
        if (ci !== -1) { main = line.slice(0, ci); tail = '  //' + line.slice(ci + 1); }

        // FoxDot P object (no JS operator overloading, so rewrite the syntax):
        //   P*[a,b,c] → PRand([a,b,c])   (random pick from the list)
        //   P[a,b,c]  → Ppat([a,b,c])    (cyclic pattern with chainable methods)
        //   P(a,b,c)  → __group(a,b,c)   (simultaneous group)
        main = rewriteP(main);

        // .follow(p1) / .accompany(p1) — the NAME of another player, written bare.
        // Both are documented as taking a name and both do String(name) on it, so the
        // quoted form has always worked; the bare form is what every set in the wild
        // is written with, and it threw "p1 is not defined" before the call was even
        // made. Quote it. Only a bare identifier is touched — a string, a number or
        // anything with a dot or a bracket in it is left exactly as written.
        main = maskedReplace(main, (t) => t.replace(/\.(follow|accompany)\(\s*([A-Za-z_]\w*)\s*(?=[,)])/g,
                                                   (all, meth, name) => `.${meth}('${name}'`));

        // Rest substitutions in array/argument positions — but NOT inside string
        // literals (mask them first so foo="(.)" / play("x.o") are left alone):
        //   dbass([0, ., 4]) → [0, null, 4]  (null → degree 0, still sounds)
        //   cs80([4, _, 1]) / cs80([4, rest, 1]) → [4, __REST, 1]  (true silence)
        {
            const { masked, restore } = maskStrings(main);
            main = restore(masked.replace(RE_DOT_REST, 'null')
                                 .replace(RE_UNDERSCORE_REST, '__REST')
                                 .replace(RE_WORD_REST, '__REST'));
        }

        // Python slice that freezes a generator into a repeating phrase:
        //   melody()[:8] / PWhite(0,1)[:8]  →  Pslice(melody(), null, 8)
        main = convertSlice(main);

        // >> operator: [~]name >> synth(...)  [+ transpose ...]
        // A leading ~ resets the player to defaults (no attribute inheritance).
        const m = main.match(RE_RSHIFT);
        if (m) {
            const [, indent, tilde, player, rhs] = m;
            // Player arithmetic: synth(...) + N / + (a,b,c) transposes the degree; - N drops it.
            const parts = splitTopLevelAddSub(rhs.trim());
            // convertAlt/convertCurly after autoQuotePlay (so play strings are
            // already quoted & skipped) but before kwargify (so dur=<1 2> →
            // {dur:_alt(1,2)} parses and {2,4} → PRand([2,4]) before kwargs run).
            // convertPlayerRefs runs BEFORE kwargify so a player ref becomes
            // getAttr(...) — a pattern token — and any arithmetic on it (b1.degree+2)
            // is then wrapped in Pmath instead of evaluating to NaN.
            let expr = kwargify(convertCurly(convertAlt(convertPlayerRefs(autoQuotePlay(parts[0].text.trim())))));
            for (let i = 1; i < parts.length; i++) {
                const method = parts[i].op === '-' ? '__sub__' : '__add__';
                expr = `(${expr}).${method}(${kwargify(convertCurly(convertAlt(convertPlayerRefs(parts[i].text.trim()))))})`;
            }
            const resetArg = tilde ? ', true' : '';
            return `${indent}__p('${player}').__rshift__(${expr}${resetArg})${tail}`;
        }

        // Player attribute assignment: p1.lpf = linvar(...)  (live-tweak one attr
        // of a running player). Not Clock/Scale/Root/Master/Server, not == .
        const am = main.match(RE_ATTR);
        if (am && !RE_RESERVED.test(am[2])) {
            const [, indent, player, attr, value] = am;
            return `${indent}__p('${player}').setAttr('${attr}', ${patMath(kwargify(convertCurly(convertAlt(convertPlayerRefs(value.trim())))))})${tail}`;
        }

        // p1.method(...) → __p('p1').method(...)
        main = maskedReplace(main, (t) => t.replace(RE_METHOD, (_, name, method) => `__p('${name}').${method}(`));

        // kwargify the rest too, so kwargs in any call work — Server.addFx(lpf=800),
        // p1.every(4, "stutter", mverb=0.5), drop(...), etc.
        return kwargify(main) + tail;
    }).join('\n');
}

// Apply TimeVar renames so runCode can eval safely
export function applyRenames(js) {
    return maskedReplace(js, (t) => t
        .replace(/\bvar\(/g,    '_var(')
        .replace(/\blinvar\(/g, '_linvar(')
        .replace(/\bsinvar\(/g, '_sinvar(')
        .replace(/\bexpvar\(/g, '_expvar('));
}

// Transpile a bare pattern EXPRESSION (not a statement) — used by the Alt+I inspector.
// Applies the same depth-aware P[…]/P*[…] (→ Ppat/PRand, nesting-safe), <a b> and {a,b}
// rewrites the statement path uses, so e.g. P[0,[4,2]].shuffle() evaluates correctly.
export function transpileExpr(s) {
    return applyRenames(convertCurly(convertAlt(rewriteP(s))));
}

// SUBDIVISION: <a b c> / <a, b, c> → _sub(a, b, c) — cram the items into one step
// (a ratchet/flam). Only on a player's RHS (and attr-assignment value), where <...>
// unambiguously means a bracket group — never on whole lines (would clash with
// comparison / the >> operator). Skips quoted strings so play("x.<o->") is left to the
// sampler. Flat only for now (no nested <…<…>…>). Alternation is now nested [ ].
function convertAlt(s) {
    let out = '', i = 0;
    while (i < s.length) {
        const c = s[i];
        if (QUOTE(c)) { const j = skipString(s, i); out += s.slice(i, j); i = j; continue; }
        // a lone '<' (not <<, <=) opening a flat <…> with content → alternation
        if (c === '<' && s[i + 1] !== '<' && s[i + 1] !== '=') {
            const close = s.indexOf('>', i + 1);
            const inner = close === -1 ? null : s.slice(i + 1, close);
            if (inner !== null && !inner.includes('<') && inner.trim() !== '') {
                out += '_sub(' + splitAltItems(inner).join(', ') + ')';
                i = close + 1;
                continue;
            }
        }
        out += c; i++;
    }
    return out;
}

// FoxDot inline random choice: {a, b, c} → PRand([a, b, c]) (pick one each step).
// A "{...}" is a random group only when its top-level content has no ':' (so dicts
// like PChain({0:[1]}) and kwarg objects survive) and no ';' / '=>' (code blocks /
// arrow bodies). Strings are skipped; nested {...} convert recursively. Run on a
// player RHS / attr value only, before kwargify.
function convertCurly(s) {
    let out = '', i = 0;
    while (i < s.length) {
        const c = s[i];
        if (QUOTE(c)) { const j = skipString(s, i); out += s.slice(i, j); i = j; continue; }
        if (c !== '{') { out += c; i++; continue; }
        const j = scanToMatch(s, i);                       // matching }
        if (j === -1) { out += s.slice(i); break; }        // unmatched — leave rest
        const inner = s.slice(i + 1, j);
        out += isRandChoice(inner) ? `PRand([${convertCurly(inner)}])` : `{${convertCurly(inner)}}`;
        i = j + 1;
    }
    return out;
}

// True if "{inner}" is a FoxDot random-choice group rather than a dict / code block.
function isRandChoice(inner) {
    if (!inner.trim()) return false;
    let depth = 0;
    for (let i = 0; i < inner.length; i++) {
        const c = inner[i];
        if (QUOTE(c)) { i = skipString(inner, i) - 1; continue; }
        if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c)) depth--;
        else if (depth === 0) {
            if (c === ':' || c === ';') return false;            // dict / statements
            if (c === '=' && inner[i + 1] === '>') return false;  // arrow body
        }
    }
    return true;
}

// Python slice → Pslice(operand, start, stop). A "slice" bracket is a [...] whose
// top-level content has a ':' but no ',' and no '?' (so arrays [0,2,4] and
// ternaries are left alone). Rewrites the leftmost slice each pass until none
// remain. Strings are skipped so play("k:.") is untouched.
function convertSlice(s) {
    let guard = 0;
    while (guard++ < 100) {
        const f = findSlice(s);
        if (!f) break;
        const opStart = captureOperandStart(s, f.openIdx);
        const operand = s.slice(opStart, f.openIdx).trim();
        if (!operand) break;                  // no operand to slice → leave verbatim
        s = s.slice(0, opStart) + `Pslice(${operand}, ${f.start}, ${f.stop})` + s.slice(f.closeIdx + 1);
    }
    return s;
}

// First slice bracket in s → { openIdx, closeIdx, start, stop } (or null).
function findSlice(s) {
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (QUOTE(c)) { i = skipString(s, i) - 1; continue; }
        if (c !== '[') continue;
        const j = scanToMatch(s, i);          // matching ]
        if (j === -1) continue;               // unmatched — give up on this one
        const sl = parseSliceInner(s.slice(i + 1, j));
        if (sl) return { openIdx: i, closeIdx: j, start: sl.start, stop: sl.stop };
        // Not a slice (an array/ternary) — DON'T skip its interior: a real slice may
        // be nested inside, e.g. Pvar([a, melody()[:8]], 16). Fall through and keep
        // scanning from the next char so the inner […:…] still gets found.
    }
    return null;
}

// "[:8]" inner "…" → { start, stop } ('null' when omitted), or null if not a slice.
function parseSliceInner(inner) {
    let depth = 0, hasComma = false, hasQ = false; const colons = [];
    for (let i = 0; i < inner.length; i++) {
        const c = inner[i];
        if (QUOTE(c)) { i = skipString(inner, i) - 1; continue; }
        if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c)) depth--;
        else if (depth === 0) {
            if (c === ':') colons.push(i);
            else if (c === ',') hasComma = true;
            else if (c === '?') hasQ = true;
        }
    }
    if (hasComma || hasQ || colons.length < 1 || colons.length > 2) return null;
    const startStr = inner.slice(0, colons[0]).trim();
    const stopStr  = inner.slice(colons[0] + 1, colons[1] ?? inner.length).trim();
    return { start: startStr || 'null', stop: stopStr || 'null' };
}

// Walk backward from a '[' to the start of the expression it slices: a trailing
// chain of identifiers/member access and balanced ()/[] (so melody(), PWhite(0,1),
// b1.degree, arr all capture cleanly).
function captureOperandStart(s, openIdx) {
    let k = openIdx - 1;
    while (k >= 0 && s[k] === ' ') k--;
    const consumeClose = () => {
        const close = s[k], open = close === ')' ? '(' : '[';
        let depth = 0;
        while (k >= 0) {
            const c = s[k];
            if (c === close) depth++;
            else if (c === open) { depth--; if (depth === 0) { k--; return; } }
            k--;
        }
    };
    let moved = true;
    while (moved && k >= 0) {
        moved = false;
        if (s[k] === ')' || s[k] === ']') { consumeClose(); moved = true; }
        while (k >= 0 && /[A-Za-z0-9_$.]/.test(s[k])) { k--; moved = true; }
    }
    return k + 1;
}

// Cross-player attribute read on a player RHS: another player's live value, e.g.
//   i9 >> faim(b1.degree, …)   →   faim(__p('b1').getAttr('degree'), …)
// Only a read (not a method call .x( or assignment .x=), only known attrs, and
// skips quoted strings. Player names start lowercase, so Clock/Scale/Root are safe.
const READABLE_ATTRS = /\b([a-z][a-zA-Z0-9]*)\.(degree|amp|dur|oct|sus|pan|rate|amplify|cutoff)\b(?!\s*[(=])/g;
function convertPlayerRefs(s) {
    let out = '', i = 0;
    while (i < s.length) {
        const c = s[i];
        if (QUOTE(c)) { const j = skipString(s, i); out += s.slice(i, j); i = j; continue; }
        let run = '';
        while (i < s.length && !QUOTE(s[i])) run += s[i++];
        out += run.replace(READABLE_ATTRS, (_, n, a) => `__p('${n}').getAttr('${a}')`);
    }
    return out;
}

// Split <…> contents on top-level spaces/commas, respecting () [] {} so a nested
// chord or sub-list stays one item: "<[0,2] 4>" → ["[0,2]", "4"].
function splitAltItems(inner) {
    const items = []; let depth = 0, cur = '';
    for (const ch of inner) {
        if ('([{'.includes(ch)) depth++;
        else if (')]}'.includes(ch)) depth--;
        if (depth === 0 && (ch === ',' || ch === ' ')) {
            if (cur.trim()) items.push(cur.trim());
            cur = '';
        } else cur += ch;
    }
    if (cur.trim()) items.push(cur.trim());
    return items;
}

function findCommentChar(line) {
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        // Escapes matter MOST here. A line like  pluck([0], t="a\\"b") # tail  ended
        // its string one character early, so the '#' looked quoted, no comment was
        // stripped, and the '#' went into the JavaScript — a syntax error on a line
        // that is perfectly legal FoxDot.
        if (QUOTE(c)) { i = skipString(line, i) - 1; continue; }
        if (c === '#') return i;
    }
    return -1;
}

// Convert Python kwargs inside function call parens to trailing JS object
// bleep([0,2], oct=5, amp=0.7)  →  bleep([0,2], {oct:5, amp:0.7})
//
// A bare parenthesised comma-list that is NOT a function call — e.g. (0,4,7)
// or pan=(0,0,x,0) — is a group/chord. In plain JS those collapse via the
// comma operator to the last value, so they're rewritten to __group(...).
// ── Pattern arithmetic ────────────────────────────────────────────────────────
// linvar([1.4,0],32) * P[1,0,0.9] can't work as plain JS (object*array=NaN). When
// an argument value involves a pattern (an array literal or a pattern/timevar
// call) AND a top-level operator, rewrite it into Pmath(a,'op',b) (left-assoc,
// +/- below */). Pure-scalar arithmetic (1/4, 2400/600) is left as native JS.
// P[A-Za-z] (not just P[A-Z]) so lowercase-second-letter patterns like Pacc are
// recognised — otherwise Pacc("offbeat")*1.3 stays raw JS ({get}*num = NaN).
//
// EVERY name here returns a {get()} object, and the consequence of leaving one out is
// not a syntax error — it is `object * number`, which is NaN, which goes into the
// audio graph and poisons the summed bus. The master limiter sanitises it to zero, so
// the whole mix goes silent and STAYS silent until a page refresh. That is what
// `amp=aud('bass', 1, 50) * 1` did.
//
// The list has now drifted twice (Pacc, then the live controls), so js/editor/
// livevalues.js holds the names shared with the eval scope, and a test asserts that
// every live-value builder the language exposes appears here.
const PATTERN_TOKEN = /\[|\b(P[A-Za-z]\w*|_alt|_sub|_group|__group|var|linvar|sinvar|expvar|lininf|expinf|fperlin|fi|fo|fb|getAttr|aud|midi|mlearn)\s*\(/;

function patMath(s) {
    return PATTERN_TOKEN.test(s) ? compilePatternMath(s) : s;
}

function compilePatternMath(s) {
    s = s.trim();
    for (const ops of ['+-', '*/']) {                 // lowest precedence first
        const idx = findTopLevelBinaryOp(s, ops);
        if (idx >= 0) {
            return `Pmath(${compilePatternMath(s.slice(0, idx))}, '${s[idx]}', ${compilePatternMath(s.slice(idx + 1))})`;
        }
    }
    return s;   // atom (call / array / literal) — kwargify already handled nesting
}

// Rightmost top-level binary +,-,*,/ in `opChars`, skipping bracketed/quoted
// regions, unary +/-, and ** . Returns its index, or -1.
function findTopLevelBinaryOp(s, opChars) {
    let depth = 0, found = -1;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (QUOTE(c)) { i = skipString(s, i) - 1; continue; }
        if ('([{'.includes(c)) { depth++; continue; }
        if (')]}'.includes(c)) { depth--; continue; }
        if (depth !== 0 || !opChars.includes(c)) continue;
        if (c === '*' && s[i + 1] === '*') { i++; continue; }      // skip exponent
        const prev = s.slice(0, i).trimEnd();
        const pc = prev[prev.length - 1] ?? '';
        if ((c === '+' || c === '-') && (pc === '' || '([{,*/+-=<>!&|%'.includes(pc))) continue;  // unary
        found = i;
    }
    return found;
}

function kwargify(expr) {
    let result = '', i = 0;
    while (i < expr.length) {
        let parenIdx = -1;
        for (let j = i; j < expr.length; j++) {
            if (expr[j] === '(') { parenIdx = j; break; }
        }
        if (parenIdx === -1) { result += expr.slice(i); break; }

        // Is this '(' a function call (preceded by identifier/`)`/`]`) or a
        // grouping/tuple paren?
        const prevChar = parenIdx > 0 ? expr[parenIdx - 1] : '';
        const isCall   = /[A-Za-z0-9_$\])]/.test(prevChar);
        result += expr.slice(i, parenIdx);  // everything up to (but not incl) '('

        // Find matching close paren (skip brackets that sit inside string literals)
        let depth = 1, j = parenIdx + 1;
        while (j < expr.length && depth > 0) {
            const c = expr[j];
            if (QUOTE(c)) { j = skipString(expr, j); continue; }
            if ('([{'.includes(c)) depth++;
            else if (')]}'. includes(c)) depth--;
            j++;
        }
        // No matching ')' on this line — the '(' opens a multi-line construct (e.g.
        // a defsynth arrow body `(...) => {` continuing on later lines). Leave the
        // rest verbatim; reformatting it would mangle the trailing brace.
        if (depth > 0) { result += expr.slice(parenIdx); break; }
        const closeIdx = j - 1;
        const inner    = expr.slice(parenIdx + 1, closeIdx);

        const args = splitArgs(inner);
        const pos  = [], kw = {};
        for (const arg of args) {
            const t  = arg.trim();
            const km = t.match(/^([a-zA-Z_]\w*)\s*=(?![=<>!])\s*(.+)$/s);
            if (km) kw[km[1]] = patMath(kwargify(km[2].trim()));
            else    pos.push(patMath(kwargify(t)));
        }
        const all = [...pos];
        const keys = Object.keys(kw);
        if (keys.length) all.push('{' + keys.map(k => `${k}: ${kw[k]}`).join(', ') + '}');

        // Grouping paren with ≥2 comma-separated values and no kwargs → __group()
        const isGroup = !isCall && keys.length === 0 && pos.length >= 2;
        result += (isGroup ? '__group(' : '(') + all.join(', ') + ')';
        i = closeIdx + 1;
    }
    return result;
}

// If play()'s first arg is unquoted, wrap it in double quotes.
// play(X  o X  o, amp=0.9)  → play("X  o X  o", amp=0.9)
// play(XoXo, amp=0.9)       → play("XoXo", amp=0.9)
// play("X o", amp=0.9)      → unchanged
function autoQuotePlay(rhs) {
    const tag = 'play(';
    const idx = rhs.indexOf(tag);
    if (idx === -1) return rhs;
    const start = idx + tag.length;
    // Find matching close paren
    let depth = 1, j = start;
    while (j < rhs.length && depth > 0) {
        const c = rhs[j];
        if ('([{'.includes(c)) depth++;
        else if (')]}'. includes(c)) depth--;
        j++;
    }
    const inner = rhs.slice(start, j - 1);
    // Extract first arg (before first comma at depth 0)
    let d = 0, commaAt = -1;
    for (let k = 0; k < inner.length; k++) {
        const c = inner[k];
        if ('([{'.includes(c)) d++;
        else if (')]}'. includes(c)) d--;
        else if (c === ',' && d === 0) { commaAt = k; break; }
    }
    const firstArg = (commaAt === -1 ? inner : inner.slice(0, commaAt)).trim();
    const rest     = commaAt === -1 ? '' : inner.slice(commaAt);
    // Leave it unquoted when it's already a string literal or a function call
    // (PEuclid2(...) / PRand(...) etc.). Play-string brackets like [--] / <x.>
    // and bare tokens still get auto-quoted.
    const isExpr = /^["'`]/.test(firstArg)             // already a string literal
        || /^[A-Za-z_]\w+\s*\(/.test(firstArg);        // multi-char function call
    if (isExpr) return rhs;
    return rhs.slice(0, idx) + 'play("' + firstArg + '"' + rest + ')' + rhs.slice(j);
}

// Split on '+' only at bracket depth 0 (player transposition operator).
// '+' inside (...)/[...] (args, groups) stays put.
// Split a player RHS on top-level `+` / `-` transpose operators, returning segments
// tagged with the operator that precedes each ('' for the base). A `-` counts only when
// it's BINARY (preceded by an operand-ender) so unary minus inside a term is left alone;
// brackets and string literals are skipped so `saw([0], amp=1-0.2)` / `play("a-b")` stay whole.
function splitTopLevelAddSub(s) {
    const segs = []; let depth = 0, cur = '', op = '';
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (QUOTE(c)) { const j = skipString(s, i); cur += s.slice(i, j); i = j - 1; continue; }
        if ('([{'.includes(c)) { depth++; cur += c; continue; }
        if (')]}'.includes(c)) { depth--; cur += c; continue; }
        if (depth === 0 && (c === '+' || c === '-')) {
            const prev = cur.replace(/\s+$/, '').slice(-1);
            if (prev && /[)\]}\w]/.test(prev)) { segs.push({ op, text: cur }); op = c; cur = ''; continue; }
        }
        cur += c;
    }
    segs.push({ op, text: cur });
    return segs;
}

