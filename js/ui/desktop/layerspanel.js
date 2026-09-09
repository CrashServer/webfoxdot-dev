// ── Layers panel — turn the knobs without typing ─────────────────────────────
//
// crashDot has 239 scenes carrying up to twenty parameters each, and until now the
// only way to move one was to type a number and re-run the line. That is fine for
// composing and wrong for finding a sound — you find a look by turning something and
// listening to your eyes, which is exactly what the workshop's channel panel is for.
//
// This is that panel, rebuilt on crashDot's own model rather than ported: the
// workshop's version is built around its channel/driver architecture, which crashDot
// deliberately does not have (its layers ARE code and its modulation IS patterns and
// TimeVars). So this reads the live layers from vlang and writes plain numbers back.
//
// THE HONEST PART, and the reason there is a → CODE button on every row: a knob turns
// a param into a plain number, replacing any pattern or TimeVar that was on it. A knob
// cannot represent sinvar([0,1],8), and pretending otherwise would have the movement
// silently reappear on the next frame. So the panel says so, and → CODE writes the
// line back out with everything you have actually dialled in — perform with the
// knobs, then keep it as text, which is the same loop the piano panel uses.
//
// Ranges come from the generated catalog (1,987 of them). A param with no declared
// range gets a knob that works in proportion to its own value, which is what knob.js
// already does for an unbounded spec.

import { makeKnob } from '../knob.js';
import { LAYER_BLENDS, layerBlendIndex } from '../../visuals/vdata.js';

// The knobs every layer has whatever it is — the transform and value controls the
// compositor applies on top of any scene. Matches the documented universal set.
const UNIVERSAL = ['speed', 'scale', 'bright', 'gain', 'contrast', 'hue', 'zoom', 'rot', 'panx', 'pany'];
// `dur` is how often a PATTERN on this layer advances, not a look — a knob for it
// would be a knob for time, and it belongs in the line rather than on the desk.
// opacity and blend have their own row in the header — see render(). dur is how
// often a PATTERN advances, which is time, not a look.
const HIDE = new Set(['dur', 'ch', 'pal', 'inv', 'opacity', 'blend']);
const CAT_RANGE = { hue: { min: 0, max: 1, default: 0 } };

export function buildLayersPanel(container, deps) {
    const { liveLayers, setLayerParam, setLayerChannel, setLayerFx, sceneParams, paramRange,
            fxNames, wsFxNames, wsImplements, fxPrimaryRange, ownFxDefaults, snapCode,
            bindAudio, bindMidi, audBands, targets, insert, log = () => {} } = deps;

    // ── Where → code writes ──────────────────────────────────────────────────
    // It used to only LOG the line, which in the desktop layout means it landed in a
    // panel you may not even have open — the button looked broken because nothing you
    // could see happened. A generated line belongs in a buffer, and with several open
    // the panel has to ask which, exactly as the piano does.
    const bar = document.createElement('div');
    bar.className = 'wfd-lay-bar';
    const barLab = document.createElement('span');
    barLab.className = 'wfd-lay-lab';
    barLab.textContent = '\u2192 code into';
    const dest = document.createElement('select');
    dest.className = 'wfd-lay-dest';
    dest.title = 'which buffer \u2192 code appends to';
    bar.append(barLab, dest);
    container.appendChild(bar);
    let destName = null;
    function renderTargets() {
        // Not while you are choosing — see the outputs panel. This runs twice a second.
        if (document.activeElement === dest) return;
        const list = (targets ? targets() : []) || [];
        if (!list.length) { dest.innerHTML = '<option value="">editor</option>'; return; }
        if (!list.some((t) => t.name === destName)) destName = (list.find((t) => t.active) || list[0]).name;
        const want = list.map((t) => t.name).join('\u0000');
        if (dest.dataset.names !== want) {
            dest.dataset.names = want;
            dest.innerHTML = list.map((t) => `<option value="${t.name}">${t.name}</option>`).join('');
        }
        dest.value = destName;
    }
    dest.onchange = () => { destName = dest.value; };

    const root = document.createElement('div');
    root.className = 'wfd-lay-wrap';
    container.appendChild(root);

    // ── The bind menu ────────────────────────────────────────────────────────
    // One popup, reused, rather than a control per parameter: a layer can carry twenty
    // params and there is no sense building twenty pickers for a choice made rarely.
    let popup = null;
    const closePopup = () => { if (popup) { popup.remove(); popup = null; } };
    document.addEventListener('mousedown', (e) => { if (popup && !popup.contains(e.target)) closePopup(); }, true);

    function openBindMenu(btn, { onAudio, onMidi, onClear, bound }) {
        closePopup();
        popup = document.createElement('div');
        popup.className = 'wfd-bind-menu';
        const row = (label, title, fn) => {
            const b = document.createElement('button');
            b.className = 'wfd-bind-row';
            b.textContent = label; b.title = title;
            b.onmousedown = (e) => { e.preventDefault(); closePopup(); fn(); };
            popup.appendChild(b);
            return b;
        };
        const head = document.createElement('div');
        head.className = 'wfd-bind-head'; head.textContent = 'follow the sound';
        popup.appendChild(head);
        for (const band of (audBands ? audBands() : ['level', 'bass', 'mid', 'treble']))
            row(band, `map this param to the ${band} of whatever is playing`, () => onAudio(band));
        // A bin is one narrow slice of the spectrum rather than a third of it — the
        // "EQ channel" you want when a kick and a snare should not move the same knob.
        const binRow = document.createElement('div');
        binRow.className = 'wfd-bind-bin';
        const binLab = document.createElement('span');
        binLab.textContent = 'bin';
        const bin = document.createElement('input');
        bin.type = 'number'; bin.min = '0'; bin.max = '63'; bin.value = '8';
        bin.title = 'one FFT bin, 0 (lowest) to 63 (highest)';
        const binGo = document.createElement('button');
        binGo.textContent = 'bind'; binGo.className = 'wfd-bind-go';
        binGo.onmousedown = (e) => { e.preventDefault(); const n = Number(bin.value); closePopup(); onAudio(n); };
        binRow.append(binLab, bin, binGo);
        popup.appendChild(binRow);
        const head2 = document.createElement('div');
        head2.className = 'wfd-bind-head'; head2.textContent = 'hardware';
        popup.appendChild(head2);
        row('MIDI learn', 'bind the next control you touch on your controller', onMidi);
        if (bound) row('\u00d7 unbind', 'back to a plain number you can turn', onClear);
        document.body.appendChild(popup);
        const r = btn.getBoundingClientRect();
        popup.style.top = Math.min(r.bottom + 2, window.innerHeight - popup.offsetHeight - 6) + 'px';
        popup.style.left = Math.min(r.left, window.innerWidth - popup.offsetWidth - 6) + 'px';
    }

    // Rebuilding on every poll would fight the pointer: a knob you are dragging must
    // not be replaced under your finger. So the DOM is rebuilt only when the SET of
    // layers changes, and existing knobs are updated in place otherwise.
    let signature = '';
    const knobs = new Map();          // "layer:param" → knob element

    // What a value reads right now — a plain number, or whatever a live control is
    // currently putting out. Used so rebinding and unbinding both start from what you
    // can actually see rather than from a default you never chose.
    function curOf(v, fallback) {
        try { if (v && typeof v.get === 'function') { const n = Number(v.get(0)); if (Number.isFinite(n)) return n; } } catch (_) {}
        const n = Number(v);
        return Number.isFinite(n) ? n : Number(fallback) || 0;
    }

    function specFor(scene, key, current) {
        const r = paramRange(scene, key);
        if (r) return { min: r[1], max: r[2], default: r[0], ...(CAT_RANGE[key] || {}) };
        // No declared range — knob.js treats an unbounded spec as proportional drag,
        // which is the right behaviour when we genuinely do not know the scale.
        const n = Number(current);
        return { default: Number.isFinite(n) ? n : 0 };
    }

    function render(list) {
        root.textContent = '';
        knobs.clear();
        if (!list.length) {
            const empty = document.createElement('div');
            empty.className = 'wfd-lay-empty';
            empty.textContent = 'no video layers running.\nrun  video1 >> plasma()  — or  vrand()  for a random one.';
            root.appendChild(empty);
            return;
        }
        for (const L of list) {
            const box = document.createElement('div');
            box.className = 'wfd-lay-box';

            const head = document.createElement('div');
            head.className = 'wfd-lay-head';
            const nm = document.createElement('span');
            nm.className = 'wfd-lay-name';
            nm.textContent = L.name;
            const sc = document.createElement('span');
            sc.className = 'wfd-lay-scene';
            sc.textContent = L.scene + (L.ws ? '' : ' ·field');
            sc.title = L.ws ? 'a workshop layer — it brings its own colour, palette() does not steer it'
                            : 'a video synth — a field on the GPU, coloured by palette()';
            const chBtn = document.createElement('button');
            chBtn.className = 'wfd-lay-small';
            chBtn.textContent = 'ch' + (L.ch || 0);
            chBtn.title = 'which deck — A (ch0) or B (ch1), what mix() crossfades between';
            chBtn.onclick = () => { setLayerChannel(L.name, L.ch ? 0 : 1); refresh(true); };
            const code = document.createElement('button');
            code.className = 'wfd-lay-small wfd-lay-code';
            code.textContent = '→ code';
            code.title = 'write this layer back out as a line, with everything you have dialled in';
            code.onclick = () => {
                const c = snapCode(L.name);
                if (!c) return;
                const where = insert ? insert(c, destName) : null;
                log(where ? `\u2192 ${where}: ${c}` : c, 'ok');
            };
            head.append(nm, sc, chBtn, code);
            box.appendChild(head);

            // Opacity and blend describe how the layer MEETS the others on its deck,
            // not what it looks like on its own — so they sit in the header with the
            // deck button rather than among the scene's own knobs.
            const mixRow = document.createElement('div');
            mixRow.className = 'wfd-lay-mix';
            const opLab = document.createElement('span');
            opLab.className = 'wfd-lay-lab';
            opLab.textContent = 'opacity';
            const opKnob = makeKnob({
                value: Number(L.params.opacity ?? 1), spec: { min: 0, max: 1, default: 1 },
                rotary: true, title: `${L.name} · opacity — how much of it reaches the deck`,
                onInput: (v) => setLayerParam(L.name, 'opacity', v),
            });
            knobs.set(L.name + ':opacity', opKnob);
            const blSel = document.createElement('select');
            blSel.className = 'wfd-lay-blend';
            blSel.title = 'how this layer combines with the ones under it on the same deck '
                        + '— not the crossfader, which combines the two finished decks';
            for (const b2 of LAYER_BLENDS) {
                const o = document.createElement('option');
                o.value = b2; o.textContent = b2;
                if (layerBlendIndex(L.params.blend) === LAYER_BLENDS.indexOf(b2)) o.selected = true;
                blSel.appendChild(o);
            }
            blSel.onchange = () => setLayerParam(L.name, 'blend', blSel.value === 'max' ? null : blSel.value);
            mixRow.append(opLab, opKnob, blSel);
            box.appendChild(mixRow);

            const grid = document.createElement('div');
            grid.className = 'wfd-lay-knobs';
            const declared = sceneParams(L.scene) || [];
            // Three sources, in this order: the layer's own declared params, the
            // universal knobs every layer gets for free, and — the one that is easy to
            // forget — anything actually SET on this layer. A param you typed must
            // appear even when it is neither declared nor universal, or the panel
            // quietly disagrees with your own line about what the layer has.
            const keys = [...declared.map((p) => p.n), ...UNIVERSAL, ...Object.keys(L.params)];
            const seen = new Set();
            for (const k of keys) {
                if (seen.has(k) || HIDE.has(k)) continue;
                seen.add(k);
                const dflt = declared.find((p) => p.n === k)?.d;
                const cur = L.params[k] ?? dflt ?? (k === 'bright' || k === 'speed' || k === 'scale' || k === 'zoom' ? 1 : 0);
                // A pattern or TimeVar cannot sit on a knob. Show it, disabled, saying so.
                const live = L.params[k];
                const isObj  = live != null && typeof live === 'object';
                // Three kinds of object, and they are not the same thing. A live
                // CONTROL (midi/aud) knows how to write itself back as source and can
                // be unbound from here. A pattern or TimeVar cannot: its source is not
                // recoverable from the object, so the panel says so and sends you to
                // the line, which is the same honesty the knob rule has always had.
                const bound  = isObj && typeof live.toCode === 'function';
                const isPat  = isObj && !bound;
                const spec   = specFor(L.scene, k, cur);

                const cell = document.createElement('div');
                cell.className = 'wfd-lay-cell' + (isPat ? ' patterned' : '') + (bound ? ' bound' : '');
                const lab = document.createElement('span');
                lab.className = 'wfd-lay-lab';
                lab.textContent = k;
                cell.appendChild(lab);

                if (isPat) {
                    const tag = document.createElement('span');
                    tag.className = 'wfd-lay-pat';
                    tag.textContent = 'pattern';
                    tag.title = 'this param is driven by a pattern or TimeVar — turning a knob would '
                              + 'replace it with a fixed number, so edit the line instead';
                    cell.appendChild(tag);
                } else if (bound) {
                    const tag = document.createElement('button');
                    tag.className = 'wfd-lay-bound';
                    tag.dataset.p = L.name + ':' + k;
                    tag.textContent = live.label ? live.label() : 'bound';
                    tag.title = `${k} follows ${live.toCode()} — click to rebind or unbind. `
                              + '\u2192 code writes the binding out as it stands.';
                    tag.onclick = () => openMenuFor(tag, L, k, spec, true, curOf(live, cur));
                    cell.appendChild(tag);
                } else {
                    const kn = makeKnob({
                        value: Number(cur) || 0, spec, rotary: true,
                        title: `${L.name} · ${k}`,
                        onInput: (v) => setLayerParam(L.name, k, v),
                    });
                    knobs.set(L.name + ':' + k, kn);
                    cell.appendChild(kn);
                    // A param you can turn is a param you can hand to something else.
                    const bindBtn = document.createElement('button');
                    bindBtn.className = 'wfd-lay-bind';
                    bindBtn.textContent = '\u223f';
                    bindBtn.title = `bind ${k} to the sound or to a MIDI control`;
                    bindBtn.onclick = () => openMenuFor(bindBtn, L, k, spec, false, cur);
                    cell.appendChild(bindBtn);
                }
                grid.appendChild(cell);
            }
            box.appendChild(grid);

            // ── the FX chain ─────────────────────────────────────────────────
            // 52 per-layer effects exist and the only way to reach one was to type
            // `+ vhs(0.6)` on the line. Order is chain order, and a new one lands at
            // the end — the same place the `+` would have put it.
            const fxRow = document.createElement('div');
            fxRow.className = 'wfd-lay-fx';
            for (const [k, v] of Object.entries(L.fx || {})) {
                if (v == null || v === false) continue;
                const chip = document.createElement('div');
                chip.className = 'wfd-lay-fxchip';
                const nm2 = document.createElement('span');
                nm2.className = 'wfd-lay-fxname';
                nm2.textContent = k;
                chip.appendChild(nm2);
                if (typeof v === 'number') {
                    const useWs = L.ws && wsImplements(k);
                    const spec = (useWs && fxPrimaryRange(k)) || { min: 0, max: 1, default: v };
                    const kn = makeKnob({ value: v, spec, rotary: true, title: `${L.name} · ${k}`,
                                          onInput: (nv) => setLayerFx(L.name, k, nv) });
                    knobs.set(L.name + ':fx:' + k, kn);
                    chip.appendChild(kn);
                }
                const x = document.createElement('button');
                x.className = 'wfd-lay-fxdel';
                x.textContent = '×';
                x.title = 'remove this effect';
                x.onclick = () => { setLayerFx(L.name, k, null); refresh(true); };
                chip.appendChild(x);
                fxRow.appendChild(chip);
            }
            // 69 effects in one flat list is a list nobody reads, so they are grouped
            // by what they DO to the frame: the whole-frame ones crashDot renders on
            // the GPU, and the per-layer ones the workshop draws on the canvas.
            const add = document.createElement('select');
            add.className = 'wfd-lay-fxadd';
            add.title = 'add an effect to this layer';
            const ph = document.createElement('option');
            ph.value = ''; ph.textContent = '+ fx'; add.appendChild(ph);
            const mk = (label, names) => {
                const g = document.createElement('optgroup');
                g.label = label;
                for (const n of names) {
                    if (L.fx && L.fx[n] != null) continue;      // already on this layer
                    const o = document.createElement('option');
                    o.value = n; o.textContent = n;
                    g.appendChild(o);
                }
                if (g.children.length) add.appendChild(g);
            };
            mk('whole frame (GPU)', fxNames());
            mk('this layer only', wsFxNames());
            add.onchange = () => {
                if (!add.value) return;
                // WHICH implementation will run decides the default. A workshop-
                // implemented effect on a workshop layer runs per-layer on the canvas
                // and takes the range that effect declares; anything else falls to
                // crashDot's whole-frame version, which has its own idea of an amount.
                // Getting this backwards is silent, not loud: crashDot's `invert` is a
                // FLAG that triggers at >= 1, so handing it the workshop's 0.5 would
                // add an effect that simply never happens.
                // The test has to be "does the workshop IMPLEMENT this" — the full 52 —
                // not "is it workshop-only" — the 40 crashDot lacks. They differ by the
                // twelve shared names, and fxBundle routes those to the workshop on a
                // workshop layer. Using the narrower set here made `invert` on a
                // workshop layer take crashDot's flag, which its canvas effect cannot
                // read: an effect added and then silently absent.
                const useWs = L.ws && wsImplements(add.value);
                const own = ownFxDefaults();
                const dflt = useWs ? (fxPrimaryRange(add.value)?.default ?? 0.5)
                                   : (own[add.value] ?? 0.5);
                setLayerFx(L.name, add.value, dflt);
                refresh(true);
            };
            fxRow.appendChild(add);
            box.appendChild(fxRow);

            root.appendChild(box);
        }
    }

    /**
     * The range a new binding sweeps. It runs from the value the param HAS RIGHT NOW to
     * the top of its declared range — not from the bottom.
     *
     * Two reasons, and the first is the one that matters: silence must leave the param
     * where you left it. Binding then adds movement on top of the look you dialled in
     * instead of replacing it, and nothing jumps at the instant you bind. Starting at
     * the declared minimum would mean a quiet moment slams `speed` to -2 on a plasma —
     * the scene runs backwards at full tilt whenever nobody is playing.
     *
     * A param already AT the top has nowhere to go up, so the sound pulls it down
     * instead — still no jump at silence, just inverted. It stops at the param's own
     * default rather than at its minimum, because a symmetric range like plasma's
     * speed of [-2, 2] would otherwise turn a loud bar into full reverse, which is a
     * much bigger claim than "make this follow the bass".
     *
     * None of this has to be perfect: the point of → code is that the numbers land in
     * the buffer where you can change them. This only has to be a sane place to start.
     * The declared bounds come from the generated catalog — what those 1,987 are for.
     */
    function bindRange(spec, cur) {
        const min = Number.isFinite(spec.min) ? spec.min : 0;
        const at  = Number.isFinite(Number(cur)) ? Number(cur) : Number(spec.default) || 0;
        const max = Number.isFinite(spec.max) ? spec.max : Math.max(1, at);
        if (max > at) return [at, max];
        const dflt = Number(spec.default);
        const floor = Number.isFinite(dflt) && dflt < at ? dflt : min;
        if (at > floor) return [at, floor];
        return [min, max];                      // min === max: nothing to sweep
    }

    function openMenuFor(btn, L, k, spec, bound, cur) {
        const [lo, hi] = bindRange(spec, cur);
        const set = (v) => { setLayerParam(L.name, k, v); refresh(true); };
        openBindMenu(btn, {
            bound,
            onAudio: (band) => {
                set(bindAudio ? bindAudio(band, lo, hi) : null);
                log(`${L.name}.${k} follows ${typeof band === 'number' ? 'bin ' + band : band} \u2014 `
                  + `silent ${lo}, loud ${hi}. \u2192 code writes it out.`, 'ok');
            },
            onMidi: () => {
                set(bindMidi ? bindMidi(lo, hi) : null);
                log(`${L.name}.${k}: MIDI learn armed \u2014 touch a control on your controller`, 'info');
            },
            // Back to the number it is showing right now, so unbinding does not jump.
            // Back to the number it is showing right now, so unbinding does not jump
            // either — the look you are looking at is the look you keep.
            onClear: () => set(curOf(L.params[k], spec.default ?? 0)),
        });
    }

    function refresh(force) {
        renderTargets();
        const list = liveLayers();
        // Signature = what would change the SHAPE of the panel. Params are not in it:
        // a value changing must not rebuild the DOM under a finger that is dragging.
        // Binding a param swaps its knob for a tag, so WHICH params are objects is part
        // of the panel's shape — without it the knob would stay put over a bound value.
        const kindOf = (v) => (v && typeof v === 'object' ? (typeof v.toCode === 'function' ? 'b' : 'p') : 'n');
        const sig = list.map((l) => `${l.name}:${l.scene}:${l.ch}:${l.params.blend ?? ''}:`
            + Object.keys(l.params).sort().map((k) => k + kindOf(l.params[k])).join(',')
            + ':' + Object.keys(l.fx || {}).join(',')).join('|');
        if (force || sig !== signature) { signature = sig; render(list); return; }
        for (const l of list) {
            for (const [k, v] of Object.entries(l.params)) {
                const kn = knobs.get(l.name + ':' + k);
                if (kn && typeof v === 'number' && kn.getValue() !== v) kn.setValue(v);
            }
            // A MIDI learn resolves the moment you touch a control, and the tag has to
            // stop saying "learn…" when it does.
            for (const [k, v] of Object.entries(l.params)) {
                if (!v || typeof v.label !== 'function') continue;
                const tag = root.querySelector(`.wfd-lay-bound[data-p="${l.name}:${k}"]`);
                if (tag && tag.textContent !== v.label()) tag.textContent = v.label();
            }
            for (const [k, v] of Object.entries(l.fx || {})) {
                const kn = knobs.get(l.name + ':fx:' + k);
                if (kn && typeof v === 'number' && kn.getValue() !== v) kn.setValue(v);
            }
        }
    }

    refresh(true);
    const timer = setInterval(() => { if (container.offsetParent !== null) refresh(false); }, 500);
    return { refresh, dispose: () => { clearInterval(timer); closePopup(); } };
}
