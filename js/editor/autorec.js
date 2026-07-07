// Automation recorder — capture live value nudges into a TimeVar.
//
// Alt+T on a number arms recording; nudge it with Alt+↑/↓ (each change is
// timestamped in fractional CLOCK BEATS); Alt+T again converts the gesture into
// the most pertinent form and swaps it into the code + re-evals. With the cursor
// still on the inserted expression, Alt+T cycles var → linvar → sinvar → [array].
// Esc while armed cancels and restores the original value.
//
// Improved over the webTroop original (recUtils.js): sub-beat timing from the
// clock (not integer beats read from the DOM), a var/linvar distinction (stepped
// holds stay stepped instead of always gliding), grid-quantised durations, finer
// value rounding, and the Alt+T form-cycling.

const GRID   = 0.25;   // quantise each hold duration to 1/4 beat
const MINDUR = 0.25;
const FORMS  = ['var', 'linvar', 'sinvar', 'array'];

// ── Pure conversion helpers (unit-testable) ─────────────────────────────────
export function roundValue(v) {
    const a = Math.abs(v);
    if (a >= 100) return Math.round(v);
    if (a >= 10)  return Math.round(v * 10) / 10;
    return Math.round(v * 100) / 100;
}

export function quantize(beats) {
    const q = Math.round(beats / GRID) * GRID;
    return Math.max(MINDUR, Number(q.toFixed(3)));
}

// samples: [{beat, qbeat, value}] in capture order → change-points (value + onset beat).
// Onsets use the quantised beat (qbeat) so durations come out on whole beats.
export function changePoints(samples) {
    const values = [], onsets = [];
    for (const s of samples) {
        const v = roundValue(s.value);
        if (values.length === 0 || v !== values[values.length - 1]) { values.push(v); onsets.push(s.qbeat ?? s.beat); }
    }
    return { values, onsets };
}

// hold duration for each value (last one held until stopBeat)
export function durations(onsets, stopBeat) {
    return onsets.map((on, i) => quantize(Math.max(0, ((i + 1 < onsets.length) ? onsets[i + 1] : stopBeat) - on)));
}

// pick the most pertinent form from the value contour
export function autoForm(values) {
    const distinct = values.filter((v, i) => i === 0 || v !== values[i - 1]);
    if (distinct.length <= 1) return 'static';
    if (distinct.length === 2) return 'linvar';                 // a simple A→B move
    let flips = 0;
    for (let i = 2; i < values.length; i++) {
        const a = Math.sign(values[i - 1] - values[i - 2]);
        const b = Math.sign(values[i] - values[i - 1]);
        if (a !== 0 && b !== 0 && a !== b) flips++;
    }
    if (flips === 0) return 'linvar';                            // monotonic ramp
    const lo = Math.min(...values), hi = Math.max(...values), range = (hi - lo) || 1;
    if (flips === 1 && Math.abs(values[0] - values[values.length - 1]) < range * 0.2) return 'sinvar';
    return 'var';                                                // steppy / wiggly → step-hold
}

const _valStr = (v) => `[${v.join(', ')}]`;
const _durStr = (d) => (d.every(x => x === d[0]) ? String(d[0]) : `[${d.join(', ')}]`);

// build a code expression for a given form from change-points + durations
export function buildExpr(form, values, durs) {
    if (form === 'static' || values.length < 2) return String(values[0]);
    if (form === 'array')  return _valStr(values);
    const total = quantize(durs.reduce((a, b) => a + b, 0));
    if (form === 'sinvar') {
        return `sinvar([${Math.min(...values)}, ${Math.max(...values)}], ${quantize(total / 2)})`;
    }
    if (form === 'linvar') {
        if (values.length === 2) return `linvar([${values[0]}, ${values[1]}], ${total})`;
        return `linvar(${_valStr(values)}, ${_durStr(durs)})`;
    }
    return `var(${_valStr(values)}, ${_durStr(durs)})`;          // var
}

// Locate the number token straddling cursor.ch; null if none.
function numberAt(line, ch) {
    let s = ch, e = ch;
    while (s > 0 && /[\d.\-]/.test(line[s - 1])) s--;
    while (e < line.length && /[\d.]/.test(line[e])) e++;
    let str = line.slice(s, e);
    if (/^\.\d+$/.test(str)) { str = '0' + str; }
    if (!/^-?\d+(\.\d+)?$/.test(str)) return null;
    return { start: s, end: e, value: parseFloat(str) };
}

// ── Stateful recorder ───────────────────────────────────────────────────────
export const autoRec = {
    _armed: false,
    _line: 0,
    _start: 0,           // char offset of the recorded number's start
    _samples: [],        // [{beat, value}]
    _origLine: '',
    _cycle: null,        // { line, start, end, values, durs, isDur, formIdx } after a finalize

    // Alt+T: finalize if armed · cycle form if cursor sits on the last insertion · else arm.
    toggle(cm, ctx) {
        if (this._armed) { this._finalize(cm, ctx); return; }
        if (this._cycle && this._cursorInCycle(cm)) { this._doCycle(cm, ctx); return; }
        this._arm(cm, ctx);
    },

    _arm(cm, ctx) {
        const cur  = cm.getCursor();
        const line = cm.getLine(cur.line);
        const num  = numberAt(line, cur.ch);
        if (!num) { ctx.log?.('put the cursor on a number first', 'warn'); return; }
        this._armed   = true;
        this._line    = cur.line;
        this._start   = num.start;
        this._origLine = line;
        this._cycle   = null;
        const beat = ctx.beatNow();
        this._samples = [{ beat, qbeat: Math.round(beat), value: num.value }];   // seed with the starting value
        this._indicator(true, '● REC');
    },

    // Called after each nudge — record the new value + beat of the tracked number.
    // Coalesces to AT MOST ONE point per beat: several nudges within the same beat
    // just update that beat's value, so rapid nudging / key auto-repeat doesn't
    // produce a jittery sub-beat automation.
    capture(cm, ctx) {
        if (!this._armed) return;
        const cur = cm.getCursor();
        if (cur.line !== this._line) return;                 // only the tracked line
        const num = numberAt(cm.getLine(cur.line), cur.ch);
        if (!num) return;
        this._start = num.start;
        const beat  = ctx.beatNow();
        const qbeat = Math.round(beat);
        const last  = this._samples[this._samples.length - 1];
        if (last && last.qbeat === qbeat) { last.value = num.value; last.beat = beat; }   // same beat → coalesce
        else { this._samples.push({ beat, qbeat, value: num.value }); }
        this._indicator(true, `● REC ${this._samples.length}`);
    },

    _finalize(cm, ctx) {
        this._armed = false;
        this._indicator(false);
        const { values, onsets } = changePoints(this._samples);
        if (values.length < 2) { ctx.log?.('nothing recorded (no change)', 'info'); return; }
        const durs = durations(onsets, Math.round(ctx.beatNow()));
        const form = autoForm(values);
        this._insert(cm, ctx, values, durs, form);
        ctx.log?.(`recorded → ${form} (${values.length} points) — Alt+T to cycle form`, 'ok');
    },

    _doCycle(cm, ctx) {
        const c = this._cycle;
        c.formIdx = (c.formIdx + 1) % FORMS.length;
        const form = FORMS[c.formIdx];
        // replace the current insertion range with the new form
        const expr = buildExpr(form, c.values, c.durs);
        cm.replaceRange(expr, { line: c.line, ch: c.start }, { line: c.line, ch: c.end });
        c.end = c.start + expr.length;
        c.expr = expr;
        cm.setCursor({ line: c.line, ch: c.end });
        ctx.runLine?.();
        ctx.log?.(`form → ${form}`, 'ok');
    },

    _insert(cm, ctx, values, durs, form) {
        const line = cm.getLine(this._line);
        const num  = numberAt(line, this._start) || numberAt(line, this._start + 1);
        const start = this._start;
        const end   = num ? num.end : this._start;
        const expr  = buildExpr(form, values, durs);
        cm.replaceRange(expr, { line: this._line, ch: start }, { line: this._line, ch: end });
        cm.setCursor({ line: this._line, ch: start + expr.length });
        this._cycle = { line: this._line, start, end: start + expr.length, expr, values, durs, formIdx: FORMS.indexOf(form) };
        if (this._cycle.formIdx < 0) this._cycle.formIdx = 0;
        ctx.runLine?.();
    },

    // Esc: restore the original line if we're mid-recording. Returns true if handled.
    cancelIfArmed(cm, ctx) {
        if (!this._armed) return false;
        this._armed = false;
        this._indicator(false);
        cm.replaceRange(this._origLine, { line: this._line, ch: 0 }, { line: this._line, ch: cm.getLine(this._line).length });
        ctx.runLine?.();
        ctx.log?.('recording cancelled', 'info');
        return true;
    },

    // The cursor counts as "on the last insertion" only if the exact inserted
    // expression is still present there — so an edited/replaced line won't mis-fire
    // a cycle (a stale range could otherwise overlap a new number by coincidence).
    _cursorInCycle(cm) {
        const c = this._cycle;
        if (!c) return false;
        const cur = cm.getCursor();
        if (cur.line !== c.line || cur.ch < c.start || cur.ch > c.end) return false;
        if (cm.getLine(c.line).slice(c.start, c.end) !== c.expr) { this._cycle = null; return false; }
        return true;
    },

    _indicator(show, text) {
        let el = document.getElementById('autorec-badge');
        if (show) {
            if (!el) { el = document.createElement('div'); el.id = 'autorec-badge'; document.body.appendChild(el); }
            el.textContent = text || '● REC';
            el.hidden = false;
        } else if (el) { el.hidden = true; }
    },
};
