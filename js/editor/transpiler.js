// Transpiles FoxDot-style Python syntax to JavaScript.
//
//   p1 >> dbass([0,2,4], oct=3, cutoff=800)
//   → __p('p1').__rshift__(dbass([0,2,4], {oct:3, cutoff:800}))
//
// Also rewrites:
//   var(...)    → _var(...)    (JS reserved word)
//   linvar(...) → _linvar(...) etc.

export function transpile(code) {
    return code.split('\n').map(line => {
        const stripped = line.trim();
        if (!stripped) return line;

        // Full-line Python comment
        if (stripped.startsWith('#')) return line.replace(/^(\s*)#/, '$1//');

        // Strip inline comment
        let main = line, tail = '';
        const ci = findCommentChar(line);
        if (ci !== -1) { main = line.slice(0, ci); tail = '  //' + line.slice(ci + 1); }

        // FoxDot P object (no JS operator overloading, so rewrite the syntax):
        //   P*[a,b,c] → PRand([a,b,c])   (random pick from the list)
        //   P[a,b,c]  → [a,b,c]          (plain cyclic pattern)
        //   P(a,b,c)  → __group(a,b,c)   (simultaneous group)
        main = main.replace(/\bP\s*\*\s*\[([^\]]*)\]/g, 'PRand([$1])');
        main = main.replace(/\bP\s*\[([^\]]*)\]/g, '[$1]');
        main = main.replace(/\bP\s*\(([^)]*)\)/g, '__group($1)');

        // Standalone . used as rest → null in array/argument positions
        // dbass([0, ., 4]) → dbass([0, null, 4])
        main = main.replace(/(?<=[,\[(]\s*)\.(?=\s*[,\]\)])/g, 'null');

        // >> operator: [~]name >> synth(...)  [+ transpose ...]
        // A leading ~ resets the player to defaults (no attribute inheritance).
        const m = main.match(/^(\s*)(~?)\s*([a-zA-Z_]\w*)\s*>>\s*(.+)$/);
        if (m) {
            const [, indent, tilde, player, rhs] = m;
            // Player arithmetic: synth(...) + N / + (a,b,c) adds to the degree.
            const parts = splitTopLevelPlus(rhs.trim());
            // convertAlt after autoQuotePlay (so play strings are already quoted &
            // skipped) but before kwargify (so dur=<1 2> → {dur:_alt(1,2)} parses).
            let expr = kwargify(convertAlt(autoQuotePlay(parts[0].trim())));
            for (let i = 1; i < parts.length; i++) {
                expr = `(${expr}).__add__(${kwargify(convertAlt(parts[i].trim()))})`;
            }
            const resetArg = tilde ? ', true' : '';
            return `${indent}__p('${player}').__rshift__(${convertPlayerRefs(expr)}${resetArg})${tail}`;
        }

        // Player attribute assignment: p1.lpf = linvar(...)  (live-tweak one attr
        // of a running player). Not Clock/Scale/Root/Master/Server, not == .
        const am = main.match(/^(\s*)([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)\s*=(?!=)\s*(.+)$/);
        if (am && !/^(Clock|Scale|Root|Master|Server)$/.test(am[2])) {
            const [, indent, player, attr, value] = am;
            return `${indent}__p('${player}').setAttr('${attr}', ${kwargify(convertAlt(value.trim()))})${tail}`;
        }

        // p1.method(...) → __p('p1').method(...)
        main = main.replace(
            /\b([a-zA-Z_]\w*)\.(every|solo|soloDrop|stutter|reverse|shuffle|stop)\s*\(/g,
            (_, name, method) => `__p('${name}').${method}(`
        );

        // kwargify the rest too, so kwargs in any call work — Server.addFx(lpf=800),
        // p1.every(4, "stutter", mverb=0.5), drop(...), etc.
        return kwargify(main) + tail;
    }).join('\n');
}

// Apply TimeVar renames so runCode can eval safely
export function applyRenames(js) {
    return js
        .replace(/\bvar\(/g,    '_var(')
        .replace(/\blinvar\(/g, '_linvar(')
        .replace(/\bsinvar\(/g, '_sinvar(')
        .replace(/\bexpvar\(/g, '_expvar(');
}

// FoxDot alternation: <a b c> / <a, b, c> → _alt(a, b, c). Only run on a player's
// RHS (and attr-assignment value), where <...> unambiguously means alternation —
// never on whole lines (would clash with comparison / the >> operator). Skips
// quoted strings so play("x.<o->") is left alone. Flat only (no nested <…<…>…>).
function convertAlt(s) {
    let out = '', i = 0;
    while (i < s.length) {
        const c = s[i];
        if (c === '"' || c === "'") {                 // copy quoted region verbatim
            const q = c; out += c; i++;
            while (i < s.length && s[i] !== q) out += s[i++];
            if (i < s.length) out += s[i++];
            continue;
        }
        // a lone '<' (not <<, <=) opening a flat <…> with content → alternation
        if (c === '<' && s[i + 1] !== '<' && s[i + 1] !== '=') {
            const close = s.indexOf('>', i + 1);
            const inner = close === -1 ? null : s.slice(i + 1, close);
            if (inner !== null && !inner.includes('<') && inner.trim() !== '') {
                out += '_alt(' + splitAltItems(inner).join(', ') + ')';
                i = close + 1;
                continue;
            }
        }
        out += c; i++;
    }
    return out;
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
        if (c === '"' || c === "'") {                 // copy quoted region verbatim
            const q = c; out += c; i++;
            while (i < s.length && s[i] !== q) out += s[i++];
            if (i < s.length) out += s[i++];
            continue;
        }
        let run = '';
        while (i < s.length && s[i] !== '"' && s[i] !== "'") run += s[i++];
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
    let inStr = false, ch = '';
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inStr)           { if (c === ch) inStr = false; }
        else if (c === '"' || c === "'") { inStr = true; ch = c; }
        else if (c === '#')  { return i; }
    }
    return -1;
}

// Convert Python kwargs inside function call parens to trailing JS object
// bleep([0,2], oct=5, amp=0.7)  →  bleep([0,2], {oct:5, amp:0.7})
//
// A bare parenthesised comma-list that is NOT a function call — e.g. (0,4,7)
// or pan=(0,0,x,0) — is a group/chord. In plain JS those collapse via the
// comma operator to the last value, so they're rewritten to __group(...).
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

        // Find matching close paren
        let depth = 1, j = parenIdx + 1;
        while (j < expr.length && depth > 0) {
            const c = expr[j];
            if ('([{'.includes(c)) depth++;
            else if (')]}'. includes(c)) depth--;
            j++;
        }
        const closeIdx = j - 1;
        const inner    = expr.slice(parenIdx + 1, closeIdx);

        const args = splitArgs(inner);
        const pos  = [], kw = {};
        for (const arg of args) {
            const t  = arg.trim();
            const km = t.match(/^([a-zA-Z_]\w*)\s*=(?![=<>!])\s*(.+)$/s);
            if (km) kw[km[1]] = kwargify(km[2].trim());
            else    pos.push(kwargify(t));
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
function splitTopLevelPlus(s) {
    const parts = [];
    let depth = 0, cur = '';
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c)) depth--;
        if (c === '+' && depth === 0) { parts.push(cur); cur = ''; continue; }
        cur += c;
    }
    parts.push(cur);
    return parts;
}

function splitArgs(str) {
    const args = [];
    let cur = '', depth = 0;
    for (const c of str) {
        if ('([{'.includes(c)) depth++;
        else if (')]}'. includes(c)) depth--;
        else if (c === ',' && depth === 0) { args.push(cur); cur = ''; continue; }
        cur += c;
    }
    if (cur.trim()) args.push(cur);
    return args;
}
