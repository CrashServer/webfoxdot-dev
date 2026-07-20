// Editor keybinding handlers.

import { stopVisual } from '../visuals/vlang.js';

// Locate the numeric token straddling column `ch` → { start, end, str } (leading-zero
// normalised, sign-aware) or null. Shared by drag-to-nudge and the automation recorder.
export function numberTokenAt(line, ch) {
    let s = ch, e = ch;
    while (s > 0 && /[\d.\-]/.test(line[s - 1])) s--;
    while (e < line.length && /[\d.]/.test(line[e])) e++;
    let str = line.slice(s, e);
    if (/^\.\d+$/.test(str)) str = '0' + str;
    if (!/^-?\d+(\.\d+)?$/.test(str)) return null;
    return { start: s, end: e, str };
}

// Nudge the number under the cursor by delta, then re-eval (the caller passes the
// run fn — the current line, so a nudge only updates that player).
export function incrementValue(cm, delta, runFn) {
    const cursor = cm.getCursor();
    const line   = cm.getLine(cursor.line);
    const tok = numberTokenAt(line, cursor.ch);
    if (!tok) return;
    const { start: s, end: e, str: numStr } = tok;

    let result;
    if (numStr.includes('.')) {
        const prec = (numStr.split('.')[1] ?? '').length || 1;
        const step = prec > 1 ? 0.01 : 0.1;
        result = (parseFloat(numStr) + delta * step).toFixed(prec);
    } else {
        const n    = parseInt(numStr, 10);
        const step = Math.abs(n) > 300 ? 100 : 1;
        result = String(n + delta * step);
    }

    if (parseFloat(result) > 22000) result = '22000';
    if (delta < 0 && parseFloat(result) < 0 && !numStr.startsWith('-')) result = '0';

    cm.replaceRange(result, { line: cursor.line, ch: s }, { line: cursor.line, ch: e });
    cm.setCursor({ line: cursor.line, ch: s + result.length });

    if (runFn) runFn();
}

// Parse player name from a line (handles both `p1 >>` and `# p1 >>`)
function playerNameFromLine(line) {
    const m = line.match(/^\s*#?\s*([a-zA-Z_]\w*)\s*>>/);
    return m ? m[1] : null;
}

// Alt+X — toggle comment + stop/restart for the player on THIS line.
// Comment out → stop that player.  Uncomment → restart just that line (not the
// whole block). The stop is quantised: the line is commented immediately, but the
// audio stops on the next bar boundary so it ends in time, not instantly.
const STOP_GRID = 4;   // beats — one bar
export function stopPlayerAtCursor(cm, clock, runLineFn) {
    const cursor  = cm.getCursor();
    const lineNo  = cursor.line;
    const line    = cm.getLine(lineNo);
    const indentM = line.match(/^(\s*)/);
    const indent  = indentM ? indentM[1] : '';
    const trimmed = line.slice(indent.length);

    if (trimmed.startsWith('#')) {
        // Uncomment + restart
        const uncommented = indent + trimmed.replace(/^#\s?/, '');
        cm.replaceRange(uncommented,
            { line: lineNo, ch: 0 },
            { line: lineNo, ch: line.length });
        if (runLineFn) runLineFn();   // restart just this player's line, not the block
    } else {
        // Comment out + stop
        cm.replaceRange(indent + '# ' + trimmed,
            { line: lineNo, ch: 0 },
            { line: lineNo, ch: line.length });
        const name = playerNameFromLine(line);
        if (name) { clock._players.get(name)?.stop(STOP_GRID); stopVisual(name); }   // audio (quantised) + video
    }
}

// Alt+S — mute all other players (solo the one at cursor). Returns the name.
export function soloPlayerAtCursor(cm, clock) {
    const line = cm.getLine(cm.getCursor().line);
    const name = playerNameFromLine(line);
    if (name) {
        const p = clock._players.get(name);
        if (p) { p.solo(); return name; }
    }
    return null;
}

// Alt+O — solo for 8 beats then restore all (soloDrop). Returns the name.
export function soloDropAtCursor(cm, clock, beats = 8) {
    const line = cm.getLine(cm.getCursor().line);
    const name = playerNameFromLine(line);
    if (name) {
        const p = clock._players.get(name);
        if (p) { p.soloDrop(beats); return name; }
    }
    return null;
}
