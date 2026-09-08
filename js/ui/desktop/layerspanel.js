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

// The knobs every layer has whatever it is — the transform and value controls the
// compositor applies on top of any scene. Matches the documented universal set.
const UNIVERSAL = ['speed', 'scale', 'bright', 'gain', 'contrast', 'hue', 'zoom', 'rot', 'panx', 'pany'];
// `dur` is how often a PATTERN on this layer advances, not a look — a knob for it
// would be a knob for time, and it belongs in the line rather than on the desk.
const HIDE = new Set(['dur', 'ch', 'pal', 'inv']);
const CAT_RANGE = { hue: { min: 0, max: 1, default: 0 } };

export function buildLayersPanel(container, deps) {
    const { liveLayers, setLayerParam, setLayerChannel, setLayerFx, sceneParams, paramRange,
            fxNames, wsFxNames, wsImplements, fxPrimaryRange, ownFxDefaults, snapCode, log = () => {} } = deps;
    const root = document.createElement('div');
    root.className = 'wfd-lay-wrap';
    container.appendChild(root);

    // Rebuilding on every poll would fight the pointer: a knob you are dragging must
    // not be replaced under your finger. So the DOM is rebuilt only when the SET of
    // layers changes, and existing knobs are updated in place otherwise.
    let signature = '';
    const knobs = new Map();          // "layer:param" → knob element

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
            code.onclick = () => { const c = snapCode(L.name); if (c) log(c, 'ok'); };
            head.append(nm, sc, chBtn, code);
            box.appendChild(head);

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
                const isPat = live != null && typeof live === 'object';

                const cell = document.createElement('div');
                cell.className = 'wfd-lay-cell' + (isPat ? ' patterned' : '');
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
                } else {
                    const spec = specFor(L.scene, k, cur);
                    const kn = makeKnob({
                        value: Number(cur) || 0, spec, rotary: true,
                        title: `${L.name} · ${k}`,
                        onInput: (v) => setLayerParam(L.name, k, v),
                    });
                    knobs.set(L.name + ':' + k, kn);
                    cell.appendChild(kn);
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

    function refresh(force) {
        const list = liveLayers();
        // Signature = what would change the SHAPE of the panel. Params are not in it:
        // a value changing must not rebuild the DOM under a finger that is dragging.
        const sig = list.map((l) => `${l.name}:${l.scene}:${l.ch}:${Object.keys(l.params).sort().join(',')}:${Object.keys(l.fx || {}).join(',')}`).join('|');
        if (force || sig !== signature) { signature = sig; render(list); return; }
        for (const l of list) {
            for (const [k, v] of Object.entries(l.params)) {
                const kn = knobs.get(l.name + ':' + k);
                if (kn && typeof v === 'number' && kn.getValue() !== v) kn.setValue(v);
            }
            for (const [k, v] of Object.entries(l.fx || {})) {
                const kn = knobs.get(l.name + ':fx:' + k);
                if (kn && typeof v === 'number' && kn.getValue() !== v) kn.setValue(v);
            }
        }
    }

    refresh(true);
    const timer = setInterval(() => { if (container.offsetParent !== null) refresh(false); }, 500);
    return { refresh, dispose: () => clearInterval(timer) };
}
