// defsplit.js — pull defsynth(...) blocks out of a block of code, so they can run first.
//
// A block that defines a synth and plays it —
//     defsynth("mylead", …, ({ … }) => { … })
//     p1 >> mylead([0, 4, 7])
// — failed with "mylead is not defined", every time: the names a run can see are
// fixed before it starts, and a defsynth only registers its name once the compiled
// synth has loaded, which is after. So the definitions run on their own, the rest
// runs when they have loaded. Every defsynth example in the docs, and any set that
// opens with its own voices, is written exactly this way.
//
// Pure: text in, text out. The rest keeps its line count (definition lines become
// empty), so anything that maps a line of the rest back to the editor still lands.

import { skipString } from './scan.js';

const START = /^\s*defsynth\s*\(/;

/**
 * @returns {{ defs: string, rest: string }} defs is '' when there are none
 */
export function splitDefsynths(code) {
    const lines = String(code).split('\n');
    const isDef = new Array(lines.length).fill(false);
    let found = false;
    for (let i = 0; i < lines.length; i++) {
        if (isDef[i] || !START.test(lines[i])) continue;
        // Walk from the opening bracket to its match, across lines, skipping strings
        // and comments (a ")" in either would end the block early).
        const text = lines.slice(i).join('\n');
        let depth = 0, end = -1;
        for (let k = text.indexOf('('); k < text.length; k++) {
            const c = text[k];
            if (c === '"' || c === "'" || c === '`') { k = skipString(text, k) - 1; continue; }
            if ((c === '/' && text[k + 1] === '/') || c === '#') { const nl = text.indexOf('\n', k); if (nl < 0) break; k = nl; continue; }
            if (c === '(' || c === '[' || c === '{') depth++;
            else if (c === ')' || c === ']' || c === '}') { depth--; if (depth === 0) { end = k; break; } }
        }
        if (end < 0) continue;                           // unclosed — leave it where it is
        const lastLine = i + (text.slice(0, end).match(/\n/g) || []).length;
        for (let j = i; j <= lastLine; j++) isDef[j] = true;
        found = true;
    }
    if (!found) return { defs: '', rest: code };
    return {
        defs: lines.filter((_, i) => isDef[i]).join('\n'),
        rest: lines.map((l, i) => (isDef[i] ? '' : l)).join('\n'),
    };
}
