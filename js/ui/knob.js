// Drag-to-change number field — the control behind every knob in the modular
// panel (js/ui/modular.js).
//
// A modular synth is an instrument you find by ear: you want to take hold of a
// cutoff and MOVE it. A typed number field cannot do that — it can only jump
// from one value to another, so exploring a range means typing 800, listening,
// typing 1200, listening. This drags: press anywhere on the field and pull.
//
// The maths (toNorm/fromNorm/dragValue/roundValue/formatValue) is deliberately
// separate from the DOM and exported on its own, so the mapping can be tested
// headlessly — the feel of a knob is entirely in that mapping, and it is the
// part most likely to be wrong in a way no type checker would catch.
//
// A spec is { min, max, curve, default } and comes from the block definition
// (js/modular/blocks.js). Ports with no range — signal inlets, the Number
// block's value — drag RELATIVELY instead; see dragValue().

export const DRAG_PX = 170;    // pixels of travel to cross a bounded range top to bottom
export const FINE    = 0.25;   // Shift multiplier
export const REL_K   = 0.01;   // unbounded: fraction of the current magnitude per pixel

export function isBounded(s) {
    return !!s && Number.isFinite(s.min) && Number.isFinite(s.max) && s.max > s.min;
}
// An exponential mapping needs both ends strictly positive — log(0) is -inf and
// a range crossing zero has no log-spacing at all. A spec that asks for 'exp'
// but cannot have it falls back to linear rather than producing NaN.
function isExp(s) { return s.curve === 'exp' && s.min > 0 && s.max > 0; }

/** value → 0..1 along the spec's range. Out-of-range values clamp. */
export function toNorm(v, s) {
    if (!isBounded(s) || !Number.isFinite(v)) return 0;
    const c = Math.min(s.max, Math.max(s.min, v));
    return isExp(s) ? Math.log(c / s.min) / Math.log(s.max / s.min)
                    : (c - s.min) / (s.max - s.min);
}

/** 0..1 → value along the spec's range. */
export function fromNorm(t, s) {
    const c = Math.min(1, Math.max(0, t));
    return isExp(s) ? s.min * Math.pow(s.max / s.min, c)
                    : s.min + c * (s.max - s.min);
}

// Trim float noise to something a person would have typed. Precision follows
// magnitude: 0.001 matters on an attack time, 0.001 on a 12000 Hz cutoff does
// not, and carrying it makes the field unreadable while it moves.
export function roundValue(v) {
    if (!Number.isFinite(v)) return 0;
    const a = Math.abs(v);
    if (a >= 1000) return Math.round(v);
    if (a >= 100)  return Math.round(v * 10) / 10;
    if (a >= 10)   return Math.round(v * 100) / 100;
    if (a >= 1)    return Math.round(v * 1000) / 1000;
    return Math.round(v * 100000) / 100000;
}

/**
 * The value after dragging `dy` pixels from `start` (dy < 0 is upward = more).
 *
 * Bounded: the whole range lives in DRAG_PX pixels of travel, along the spec's
 * own curve — so an exponential cutoff moves in musical proportion rather than
 * spending nine tenths of the gesture above 2 kHz.
 *
 * Unbounded: the step is proportional to the CURRENT magnitude, so one gesture
 * feels the same on 0.5 and on 4400 — but it is ADDITIVE, not multiplicative.
 * Multiplying would mean dragging up made a negative number more negative, and
 * would trap a value at zero forever; adding lets the sign change and gives the
 * same "up is more" everywhere. The magnitude floor keeps zero draggable.
 */
export function dragValue(start, dy, s, fine) {
    const k = fine ? FINE : 1;
    const v0 = Number.isFinite(start) ? start : 0;
    if (isBounded(s)) return roundValue(fromNorm(toNorm(v0, s) - (dy / DRAG_PX) * k, s));
    const mag = Math.max(Math.abs(v0), 0.01);
    return roundValue(v0 + (-dy) * mag * REL_K * k);
}

/** Short display form — the field is ~44px wide and repaints while you drag. */
export function formatValue(v) {
    if (!Number.isFinite(v)) return '0';
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 10000) return String(Math.round(v));
    if (a >= 100)   return String(Math.round(v * 10) / 10);
    if (a >= 1)     return String(Math.round(v * 100) / 100);
    return String(Math.round(v * 10000) / 10000);
}

export function knobTitle(spec) {
    const range = isBounded(spec)
        ? `${formatValue(spec.min)}…${formatValue(spec.max)}${spec.curve === 'exp' ? ', log' : ''}`
        : 'no fixed range — drags by proportion';
    return `drag to change · Shift for fine · double-click to type · right-click resets  (${range})`;
}

/**
 * Build the control.
 *
 *   onInput(v, first) — every frame of a drag. `first` is true exactly once per
 *                       gesture, on the change that begins it.
 *   onCommit(v)       — once, when the gesture ends.
 *
 * `first` is what makes a drag ONE undo step rather than two hundred: the owner
 * snapshots only when it is set. It is a flag rather than a time window because
 * a slow, careful sweep of a cutoff is still a single gesture, and a window long
 * enough to cover one would also swallow the next deliberate edit.
 */
// Rotary dial geometry: a 270° sweep, the conventional dead zone pointing down so
// "off" and "full" are visually distinct and the pointer never hides behind itself.
const SWEEP = 270, START = 135;      // degrees; 135 = bottom-left, running clockwise
const R = 15, CX = 18, CY = 18;
const polar = (deg, r) => [
    CX + r * Math.cos((deg - 90) * Math.PI / 180),
    CY + r * Math.sin((deg - 90) * Math.PI / 180),
];
function arcPath(fromT, toT) {
    const a0 = START + fromT * SWEEP, a1 = START + toT * SWEEP;
    const [x0, y0] = polar(a0, R), [x1, y1] = polar(a1, R);
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${(a1 - a0) > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/**
 * @param {object} o  value · spec · onInput · onCommit · title
 *                    rotary: draw a real dial instead of a horizontal bar. Same
 *                    drag maths, same curves, same type-to-set — only the paint
 *                    differs, so the two cannot drift apart in feel.
 */
export function makeKnob({ value, spec = {}, onInput, onCommit, title, rotary = false }) {
    const el = document.createElement('div');
    el.className = 'mod-knob' + (isBounded(spec) ? ' bounded' : '') + (rotary ? ' rotary' : '');
    el.title = title || knobTitle(spec);
    el.tabIndex = -1;

    const label = document.createElement('span');
    label.className = 'mod-knob-val';
    let fill = null, valArc = null, pointer = null;

    if (rotary) {
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 36 36');
        svg.setAttribute('class', 'mod-knob-dial');
        const track = document.createElementNS(NS, 'path');
        track.setAttribute('class', 'mk-track');
        track.setAttribute('d', arcPath(0, 1));
        valArc = document.createElementNS(NS, 'path');
        valArc.setAttribute('class', 'mk-arc');
        const cap = document.createElementNS(NS, 'circle');
        cap.setAttribute('class', 'mk-cap');
        cap.setAttribute('cx', CX); cap.setAttribute('cy', CY); cap.setAttribute('r', R - 5);
        pointer = document.createElementNS(NS, 'line');
        pointer.setAttribute('class', 'mk-pointer');
        svg.append(track, valArc, cap, pointer);
        el.append(svg, label);
    } else {
        fill = document.createElement('div');
        fill.className = 'mod-knob-fill';
        el.append(fill, label);
    }

    let v = Number.isFinite(value) ? value : 0;
    function paint() {
        label.textContent = formatValue(v);
        const t = isBounded(spec) ? toNorm(v, spec) : 0;
        if (!rotary) { fill.style.width = isBounded(spec) ? (t * 100) + '%' : '0'; return; }
        // An unbounded parameter has no meaningful position on a dial, so it shows
        // the value and a centred pointer rather than a lie about where it sits.
        const tt = isBounded(spec) ? t : 0.5;
        valArc.setAttribute('d', tt <= 0.001 ? '' : arcPath(0, tt));
        const [px, py] = polar(START + tt * SWEEP, R - 3);
        const [ix, iy] = polar(START + tt * SWEEP, R - 9);
        pointer.setAttribute('x1', ix.toFixed(2)); pointer.setAttribute('y1', iy.toFixed(2));
        pointer.setAttribute('x2', px.toFixed(2)); pointer.setAttribute('y2', py.toFixed(2));
    }
    paint();

    // ── drag ──────────────────────────────────────────────────────────────
    // stopPropagation on pointerdown so grabbing a knob never also starts the
    // block drag or the canvas pan underneath it.
    let drag = null;
    el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || el.querySelector('input')) return;
        e.preventDefault(); e.stopPropagation();
        drag = { y: e.clientY, start: v, moved: false };
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
        el.classList.add('dragging');
    });
    el.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const dy = e.clientY - drag.y;
        // A couple of pixels of slop, so a click that is really a double-click
        // does not nudge the value before the second press arrives.
        if (!drag.moved && Math.abs(dy) < 3) return;
        v = dragValue(drag.start, dy, spec, e.shiftKey);
        paint();
        if (onInput) onInput(v, !drag.moved);
        drag.moved = true;
    });
    function endDrag(e) {
        if (!drag) return;
        const moved = drag.moved;
        drag = null;
        el.classList.remove('dragging');
        try { el.releasePointerCapture(e.pointerId); } catch (_) {}
        if (moved && onCommit) onCommit(v);
    }
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);

    // ── type it ───────────────────────────────────────────────────────────
    el.addEventListener('dblclick', (e) => { e.preventDefault(); e.stopPropagation(); beginEdit(); });
    function beginEdit() {
        if (el.querySelector('input')) return;
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'mod-knob-edit';
        inp.value = String(v);
        el.appendChild(inp);
        inp.focus();
        inp.select();
        const done = (commit) => {
            if (!inp.isConnected) return;
            const parsed = parseFloat(inp.value);
            inp.remove();
            // A TYPED value is not clamped to the range. The range exists to
            // make the gesture useful, not to forbid a value the patch might
            // genuinely want — a 30 kHz cutoff is a legitimate "off".
            if (commit && Number.isFinite(parsed) && parsed !== v) {
                v = parsed;
                paint();
                if (onInput) onInput(v, true);
                if (onCommit) onCommit(v);
            } else {
                paint();
            }
        };
        // Keys are swallowed here or the panel's own shortcuts would fire:
        // Delete would remove the block you are typing a value into.
        inp.addEventListener('keydown', (ev) => {
            ev.stopPropagation();
            if (ev.key === 'Enter')       { ev.preventDefault(); done(true); }
            else if (ev.key === 'Escape') { ev.preventDefault(); done(false); }
        });
        inp.addEventListener('blur', () => done(true));
        inp.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    }

    // ── right-click resets ────────────────────────────────────────────────
    el.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!Number.isFinite(spec.default) || v === spec.default) return;
        v = spec.default;
        paint();
        if (onInput) onInput(v, true);
        if (onCommit) onCommit(v);
    });

    el.setValue = (nv) => { v = Number.isFinite(nv) ? nv : 0; paint(); };
    el.getValue = () => v;
    return el;
}
