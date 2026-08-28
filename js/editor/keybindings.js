// Editor keybinding handlers.

import { stopVisual } from '../visuals/vlang.js';
import { share } from '../collab/actions.js';

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
// Stop a player's audio AND its video on the standard Alt+X grid. Exported so a peer's
// 'stopLine' replays through the exact same path (and the same STOP_GRID) as the local
// keystroke — the shared beat clock puts both stops on the same bar line.
export function silence(clock, name) {
    clock._players.get(name)?.stop(STOP_GRID);   // audio (quantised)
    stopVisual(name);                            // video
}

export function stopPlayerAtCursor(cm, clock, runLineFn, recCapture) {
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
        if (runLineFn) runLineFn();   // restart just this player's line, not the block (also recCaptures)
    } else {
        // Comment out + stop
        cm.replaceRange(indent + '# ' + trimmed,
            { line: lineNo, ch: 0 },
            { line: lineNo, ch: line.length });
        const name = playerNameFromLine(line);
        if (name) {
            silence(clock, name);
            // Multiplayer: the COMMENT itself rides the Yjs text sync, but the stop it
            // triggers doesn't — without this a peer watches the line grey out and
            // keeps hearing the track until the next time that line is evaluated.
            share('stopLine', { name });
            // This bypasses runCode() (a direct player call, not eval'd source), so
            // without this the recorder (index.html's recCapture) never sees the stop —
            // a recorded composition would replay this player straight through the
            // point it was actually silenced live. `name.stop()` is valid typed syntax
            // (js/editor/transpiler.js's RE_METHOD rewrites it to __p(name).stop()),
            // so it replays correctly when the section is re-run.
            if (recCapture) recCapture(`${name}.stop()`);
        }
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

// Alt+M — turn the number under/near the cursor into a MIDI-learnable knob.
// `cutoff=800` → `cutoff=mlearn(0, 3200)`, then re-runs the line so it's armed:
// wiggle any knob/fader on your controller next and it latches onto that CC.
// Bounds are guessed from the current value, never hidden — the text is the
// truth, so a bad guess is just as visible (and editable) as a hand-typed one:
//   0..1        → mlearn(0, 1)             normalised params (amp, rq, mix…)
//   negative n  → mlearn(-hi, hi)          signed params (pan…), symmetric
//   otherwise   → mlearn(0, round(|n|*4))  headroom for cutoff/freq-like params
export function midiLearnAtCursor(cm, runFn) {
    const cursor = cm.getCursor();
    const line   = cm.getLine(cursor.line);
    const re = /([a-zA-Z_]\w*)\s*=\s*(-?\d+\.?\d*)/g;
    let m, hit = null;
    while ((m = re.exec(line)) !== null) {
        const start = m.index, end = m.index + m[0].length;
        if (cursor.ch >= start && cursor.ch <= end) {
            hit = { end, num: m[2], valStart: end - m[2].length };
            break;
        }
    }
    if (!hit) return false;

    const n = parseFloat(hit.num);
    const hi = Number.isFinite(n) && Math.abs(n) <= 1 ? 1 : Math.max(1, Math.round(Math.abs(n) * 4));
    const lo = n < 0 ? -hi : 0;

    const replacement = `mlearn(${lo}, ${hi})`;
    cm.replaceRange(replacement,
        { line: cursor.line, ch: hit.valStart },
        { line: cursor.line, ch: hit.end });
    cm.setCursor({ line: cursor.line, ch: hit.valStart + replacement.length });

    if (runFn) runFn();
    return true;
}
