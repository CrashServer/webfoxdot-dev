// Every video knob the menu offers must actually DO something.
//
// This is the visual twin of synthparams: the same failure, with the same silence.
// A scene took `scale=`, stored it, and no renderer read it — the line evaluated,
// nothing was logged, the picture did not change. Three ways it happened:
//
//   1. The completion wrote the layer's own speed/hue and THEN a universal one, so
//      accepting it reset matrixrain from speed=0.5 to 1 and hue=120 to 0. Duplicate
//      keys in a call: the last wins. 182 of the 194 workshop layers.
//   2. contrast and inv reached a workshop layer and nothing applied them.
//   3. A field scene's field() simply ignores speed or scale, and no list said which.
//
// So the knob lists are not trusted here — each scene is RUN, with two values, and
// asked whether its output moved. A list that drifts from the code fails.
import { getScene, SCENE_NAMES } from '../../js/visuals/render/scenes/index.js';
import { SCENE_PARAMS, SCENE_NO_SPEED, SCENE_NO_SCALE, universalParams, sceneParams } from '../../js/visuals/vdata.js';

// Sample points must NOT line up with any grid a scene builds: an 8x8 sweep over a
// scene with 8 cells lands every sample exactly on a cell edge, where several draw
// nothing — and then every knob looks dead. Irrational-ish strides instead.
const PTS = [];
for (let i = 0; i < 11; i++) for (let j = 0; j < 11; j++)
    PTS.push([(i + 0.3183) / 11.17, (j + 0.2718) / 11.41]);
const TS = [0, 0.37, 1.1, 2.9, 5.5, 11.3];
const AUDS = [{ bass: 0.4, mid: 0.3, treble: 0.2, level: 0.5 },
              { bass: 0, mid: 0, treble: 0, level: 0 }];

/** Does this scene's output change when the knob does? */
function responds(sc, key, base, alts) {
    for (const aud of AUDS) for (const alt of alts) for (const t of TS) for (const [u, v] of PTS) {
        let x, y;
        try {
            x = sc.field(u, v, t, { [key]: base }, aud);
            y = sc.field(u, v, t, { [key]: alt }, aud);
        } catch (_) { return true; }       // throwing is a different bug, not a dead knob
        if (Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) > 1e-9) return true;
    }
    return false;
}

export default function ({ test, eq, ok }) {
    test('vparams: every scene-specific param does something', () => {
        const dead = [];
        for (const name of SCENE_NAMES) {
            const sc = getScene(name);
            if (!sc?.field) { dead.push(`${name}: no field()`); continue; }
            for (const { n, d } of (SCENE_PARAMS[name] || [])) {
                const alts = typeof d === 'number'
                    ? [d + 0.37, d * 2 + 1, d * 0.5 - 0.13, d + 3] : [d];
                if (!responds(sc, n, d, alts)) dead.push(`${name}.${n}`);
            }
        }
        eq(dead.join(' '), '', `advertised but inert: ${dead.join(', ')}`);
    });

    test('vparams: SCENE_NO_SPEED is exactly the scenes that ignore speed', () => {
        const found = SCENE_NAMES.filter(n => {
            const sc = getScene(n);
            return sc?.field && !responds(sc, 'speed', 1, [0.25, 2.5, 7]);
        });
        eq([...found].sort().join(','), [...SCENE_NO_SPEED].sort().join(','));
    });

    test('vparams: SCENE_NO_SCALE is exactly the scenes that ignore scale', () => {
        const found = SCENE_NAMES.filter(n => {
            const sc = getScene(n);
            return sc?.field && !responds(sc, 'scale', 1, [0.3, 2.5, 6]);
        });
        eq([...found].sort().join(','), [...SCENE_NO_SCALE].sort().join(','));
    });

    test('vparams: the offered knobs never repeat a name', () => {
        // The bug that reset matrixrain: the call the menu writes had speed= twice,
        // the layer's own first and the universal one after it, and the second won.
        const bad = [];
        for (const name of [...SCENE_NAMES, 'matrixrain', 'starfield', 'grid', 'webcam']) {
            const keys = [...sceneParams(name).map(x => x.n), ...universalParams(name).map(k => k[0])];
            const seen = new Set(), dup = new Set();
            for (const k of keys) { if (seen.has(k)) dup.add(k); seen.add(k); }
            if (dup.size) bad.push(`${name}: ${[...dup].join('/')}`);
        }
        eq(bad.join(' '), '', `a call that sets the same key twice: ${bad.join(', ')}`);
    });

    test('vparams: a dead knob is never offered', () => {
        const bad = [];
        for (const name of SCENE_NAMES) {
            const offered = universalParams(name).map(k => k[0]);
            if (SCENE_NO_SPEED.has(name) && offered.includes('speed')) bad.push(`${name}.speed`);
            if (SCENE_NO_SCALE.has(name) && offered.includes('scale')) bad.push(`${name}.scale`);
        }
        eq(bad.join(' '), '', `offered anyway: ${bad.join(', ')}`);
    });

    test('vparams: a workshop layer is offered speed/scale only if it has one', () => {
        // wsdeck cannot scale a layer's time or geometry for it — those live inside
        // the layer's own draw(), so a layer without them cannot be given them.
        const offered = universalParams('matrixrain').map(k => k[0]);
        ok(!offered.includes('scale'), 'scale offered on a layer that has none');
        ok(!offered.includes('speed'), 'speed offered twice — matrixrain declares its own');
        // …and the value knobs, which wsdeck now applies, ARE offered.
        for (const k of ['contrast', 'inv', 'zoom', 'rot', 'bright', 'gain', 'opacity', 'blend'])
            ok(offered.includes(k), `${k} missing from a workshop layer`);
    });
}
