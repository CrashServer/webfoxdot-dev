// Modular-synth block palette — 14 block types wrapping the real UGen
// factories in js/scsynth/ugens.js. Each block declares:
//   params  — compile-time choices (waveform, filter type…) picked via a
//             dropdown; baked into which factory codegen() emits, not
//             runtime-tweakable (regenerate + Define to change).
//   inputs  — named sockets. Each is ALSO a knob: unwired, it uses its own
//             numeric default; wired, the upstream node's value overrides it.
//             An unwired input becomes a live extraParam on the compiled
//             synth, named after the PORT ITSELF by default — a Filter's
//             cutoff/rq ports generate p1 >> mypatch(cutoff=2000, rq=0.3),
//             matching the exact convention every hand-written synth in
//             js/synths/registry.js already uses (cutoff/rq/rate/dist…), so
//             nothing manual is needed to get a coherent, mnemonic param.
//             A knob can still be tagged a different name (or the same name
//             as ANOTHER knob, to deliberately share one control between
//             them) via the UI's per-knob role dropdown — see
//             js/modular/codegen.js's resolveKnob() for the exact resolution
//             order and the STD-control-reuse rule (a knob named exactly
//             out/note/amp/sus/pan/attack/release reuses that control
//             directly, bare, instead of adding a redundant new one).
//   output  — 'audio' | 'control', just for cosmetic wire colouring in the UI.
//   codegen(node, ins, knobRef) — ins is { portName: 'jsExprString' } already
//             resolved (wired → upstream var name, unwired → the knob's
//             live-param expression, role-aware). knobRef(key, default) is
//             the same role-aware resolver for a block with no input ports
//             of its own (the Number block uses it for its `value`).
//             Returns the source line(s) for this node.
//
// codegen never calls .add()/.mul() directly on an input expression, because
// an unwired input's expression is a bare param reference that MIGHT resolve
// to a plain number at runtime (UGenOut methods don't exist on numbers) — it
// goes through the add()/mul() helpers (js/modular/codegen.js, thin wrappers
// around synthdef.js's binaryOp, which coerces either operand) instead.

export const BLOCKS = {
    osc: {
        label: 'Oscillator',
        output: 'audio',
        params: [{ name: 'wave', kind: 'select', options: ['sine', 'saw', 'pulse', 'triangle', 'varsaw', 'blip'], default: 'sine' }],
        inputs: [{ name: 'freq', default: 440 }],
        codegen(node, ins) {
            const factory = { sine: 'SinOsc', saw: 'Saw', pulse: 'Pulse', triangle: 'LFTri', varsaw: 'VarSaw', blip: 'Blip' }[node.params.wave] || 'SinOsc';
            return `${factory}.ar(${ins.freq})`;
        },
    },

    impulse: {
        label: 'Impulse',
        output: 'audio',
        params: [],
        inputs: [{ name: 'freq', default: 1 }],
        // A train of clicks at `freq` Hz (DC between them) — an excitation
        // source for percussive hits (through a resonant Filter + short
        // Envelope) or a trigger-rate clock; freq=0 is a single unit impulse
        // at t=0, matching SC's Impulse UGen.
        codegen(node, ins) {
            return `Impulse.ar(${ins.freq})`;
        },
    },

    noise: {
        label: 'Noise',
        output: 'audio',
        params: [{ name: 'color', kind: 'select', options: ['white', 'pink'], default: 'white' }],
        inputs: [],
        codegen(node) {
            return node.params.color === 'pink' ? 'PinkNoise.ar()' : 'WhiteNoise.ar()';
        },
    },

    filter: {
        label: 'Filter',
        output: 'audio',
        params: [{ name: 'mode', kind: 'select', options: ['resonant', 'resonant-hp', 'lowpass', 'highpass', 'bandpass'], default: 'resonant' }],
        inputs: [{ name: 'in', default: 0 }, { name: 'cutoff', default: 800 }, { name: 'rq', default: 0.5 }],
        codegen(node, ins) {
            // LPF/HPF ignore a 3rd (rq) argument harmlessly — ugens.js's make()
            // only maps over its OWN defaults array, extra args are dropped.
            const factory = { resonant: 'RLPF', 'resonant-hp': 'RHPF', lowpass: 'LPF', highpass: 'HPF', bandpass: 'BPF' }[node.params.mode] || 'RLPF';
            return `${factory}.ar(${ins.in}, ${ins.cutoff}, ${ins.rq})`;
        },
    },

    clip: {
        label: 'Clip',
        output: 'audio',
        params: [],
        inputs: [{ name: 'in', default: 0 }, { name: 'lo', default: -1 }, { name: 'hi', default: 1 }],
        // Soft-limits a signal to [lo, hi] — a HARD ceiling (feed it an
        // over-driven signal and it flattens dead at lo/hi), or a safety
        // limiter after a Mix that could otherwise sum past ±1. For actual
        // distortion character, the Distortion block's tanh curve sounds far
        // less harsh — this is closer to a brick-wall limiter.
        codegen(node, ins) {
            return `clip(${ins.in}, ${ins.lo}, ${ins.hi})`;
        },
    },

    distortion: {
        label: 'Distortion',
        output: 'audio',
        params: [],
        // Matches the "dist" convention used by every gritty hand-written synth
        // (war/dab/growl/tekno/guitar all end their drive stage in `(sig *
        // dist).tanh`) — a soft-saturation curve, louder drive rounds off
        // instead of hard-clipping flat.
        inputs: [{ name: 'in', default: 0 }, { name: 'dist', default: 1 }],
        codegen(node, ins) {
            return `tanh(mul(${ins.in}, ${ins.dist}))`;
        },
    },

    env: {
        label: 'Envelope',
        output: 'audio',
        params: [
            { name: 'shape', kind: 'select', options: ['perc', 'linen', 'adsr'], default: 'perc' },
            // Only meaningful for the adsr shape — plain number PARAMS (not
            // wireable ports) rather than always-present inputs, so a perc/
            // linen Envelope doesn't carry two dead, unused extraParams (see
            // the conditional knobRef() calls below).
            { name: 'decay', kind: 'number', default: 0.1 },
            { name: 'sustainLevel', kind: 'number', default: 0.5 },
        ],
        // attack/release default to the STD attack/release controls when left
        // unwired and untagged (resolveKnob reuses them bare — same behavior
        // as every built-in synth, no wiring needed for the common case), but
        // are real ports now: wire in a Number/Ramp, or tag with a different
        // role, to give ONE Envelope instance its own attack/release distinct
        // from the note's — useful once a patch has more than one voice/stage.
        // sus stays unexposed (bare STD only) — it's the note's own duration,
        // not really a per-voice "character" knob the way attack/release are.
        inputs: [{ name: 'in', default: 0 }, { name: 'attack', default: 0.01 }, { name: 'release', default: 0.1 }],
        codegen(node, ins, knobRef) {
            let env;
            if (node.params.shape === 'adsr') {
                const decay = knobRef('decay', node.params.decay);
                const susLevel = knobRef('sustainLevel', node.params.sustainLevel);
                env = `Env.adsr(${ins.attack}, ${decay}, ${susLevel}, sus, ${ins.release}, 1)`;
            } else if (node.params.shape === 'linen') {
                env = `Env.linen(${ins.attack}, sus, ${ins.release}, 1)`;
            } else {
                env = `Env.perc(${ins.attack}, sus, 1, -4)`;
            }
            return `mul(EnvGen.ar(${env}, { doneAction: 2 }), ${ins.in})`;
        },
    },

    lfo: {
        label: 'LFO',
        output: 'control',
        // noise = LFNoise1 (smoothly interpolated random), stepped = LFNoise0
        // (sample-and-hold, zippery), smooth = LFNoise2 (quadratic-interpolated,
        // rounder than noise).
        params: [{ name: 'shape', kind: 'select', options: ['sine', 'noise', 'stepped', 'smooth'], default: 'sine' }],
        inputs: [{ name: 'rate', default: 4 }],
        codegen(node, ins) {
            const factory = { noise: 'LFNoise1', stepped: 'LFNoise0', smooth: 'LFNoise2' }[node.params.shape];
            return factory ? `${factory}.kr(${ins.rate})` : `SinOsc.kr(${ins.rate})`;
        },
    },

    ramp: {
        label: 'Ramp',
        output: 'control',
        // linear (Line) glides start→end with no restriction; exponential
        // (XLine) needs same-sign, nonzero start/end (it's log-spaced) — a
        // sweep that crosses zero will glitch, that's an XLine/SC constraint,
        // not this block's.
        params: [{ name: 'shape', kind: 'select', options: ['linear', 'exponential'], default: 'linear' }],
        inputs: [{ name: 'start', default: 1 }, { name: 'end', default: 0 }, { name: 'dur', default: 1 }],
        codegen(node, ins) {
            const factory = node.params.shape === 'exponential' ? 'XLine' : 'Line';
            // doneAction 0 — only the Envelope block frees the voice, so a
            // Ramp finishing early never fights the note's own release.
            return `${factory}.kr(${ins.start}, ${ins.end}, ${ins.dur}, 0)`;
        },
    },

    mix: {
        label: 'Mix',
        output: 'audio',
        params: [{ name: 'mode', kind: 'select', options: ['add', 'multiply'], default: 'add' }],
        inputs: [{ name: 'a', default: 0 }, { name: 'b', default: 0 }],
        codegen(node, ins) {
            const fn = node.params.mode === 'multiply' ? 'mul' : 'add';
            return `${fn}(${ins.a}, ${ins.b})`;
        },
    },

    scale: {
        label: 'Scale',
        output: 'audio',
        params: [],
        inputs: [{ name: 'in', default: 0 }, { name: 'mul', default: 1 }, { name: 'add', default: 0 }],
        codegen(node, ins) {
            return `add(mul(${ins.in}, ${ins.mul}), ${ins.add})`;
        },
    },

    note2freq: {
        label: 'Note → Pitch',
        output: 'control',
        params: [],
        inputs: [],
        codegen() { return 'note.midicps()'; },
    },

    number: {
        label: 'Number',
        output: 'control',
        params: [{ name: 'value', kind: 'number', default: 220 }],
        inputs: [],
        // Goes through knobRef (same live-param mechanism as an unwired input)
        // instead of inlining a literal, so a Number block's value is always
        // tweakable at play time — p1 >> mypatch(freq=880) — not baked in.
        codegen(node, ins, knobRef) { return knobRef('value', node.params.value); },
    },

    output: {
        label: 'Output',
        output: null,           // terminal — no output port
        isTerminal: true,
        params: [],
        // pan defaults to the STD pan control when unwired (identical to the
        // old hardcoded behavior) — but wire an LFO (through a Scale to set
        // the sweep width) into it for automatic panning, a whole new trick
        // the old hardcoded `pan` couldn't do. amp deliberately stays
        // hardcoded, not a port: every note's own amp/velocity should always
        // scale the voice, never be silently replaceable by a wire.
        inputs: [{ name: 'in', default: 0 }, { name: 'pan', default: 0 }],
        codegen(node, ins) {
            return `Out.ar(out, Pan2.ar(mul(${ins.in}, amp), ${ins.pan}))`;
        },
    },
};

export function blockDef(type) {
    const b = BLOCKS[type];
    if (!b) throw new Error(`unknown block type "${type}"`);
    return b;
}

// Default params object for a fresh node of this type. Covers BOTH the
// compile-time select params (wave/mode/shape…) AND each input port's own
// knob value (used when that port isn't wired) — same namespace, since a
// block's param names and its own input-port names never collide by design.
export function defaultParams(type) {
    const b = blockDef(type);
    const p = {};
    for (const param of b.params) p[param.name] = param.default;
    for (const inp of b.inputs) if (!(inp.name in p)) p[inp.name] = inp.default;
    return p;
}
