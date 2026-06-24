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

        // >> operator: name >> synth(...)  [+ transpose ...]
        const m = main.match(/^(\s*)([a-zA-Z_]\w*)\s*>>\s*(.+)$/);
        if (m) {
            const [, indent, player, rhs] = m;
            // Player arithmetic: synth(...) + N / + (a,b,c) adds to the degree.
            const parts = splitTopLevelPlus(rhs.trim());
            let expr = kwargify(autoQuotePlay(parts[0].trim()));
            for (let i = 1; i < parts.length; i++) {
                expr = `(${expr}).__add__(${kwargify(parts[i].trim())})`;
            }
            return `${indent}__p('${player}').__rshift__(${expr})${tail}`;
        }

        // p1.method(...) → __p('p1').method(...)
        main = main.replace(
            /\b([a-zA-Z_]\w*)\.(every|solo|soloDrop|stutter|reverse|shuffle|stop)\s*\(/g,
            (_, name, method) => `__p('${name}').${method}(`
        );

        return main + tail;
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
    // Already a string literal — leave it alone
    const alreadyQuoted = firstArg.startsWith('"') || firstArg.startsWith("'") || firstArg.startsWith('`');
    if (alreadyQuoted) return rhs;
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
