// Modular-synth block palette — 13 block types wrapping the real UGen
// factories in js/scsynth/ugens.js. Each block declares:
//   params  — compile-time choices (waveform, filter type…) picked via a
//             dropdown; baked into which factory codegen() emits, not
//             runtime-tweakable (regenerate + Define to change).
//   inputs  — named sockets. Each is ALSO a knob: unwired, it uses its own
//             numeric default; wired, the upstream node's value overrides it.
//             An unwired input becomes a live extraParam on the compiled
//             synth (p1 >> mypatch(n2_cutoff=2000)), so nothing is silently
//             fixed at compile time. A knob can be tagged with a semantic
//             role (freq/amp/rate/custom, via node.roles[portName] — set by
//             the UI's role button) so it generates as a mnemonic param name
//             (p1 >> mypatch(freq=880)) instead of the auto nodeId_port one;
//             tagging a knob with a STD control name (out/note/amp/sus/pan/
//             attack/release) reuses that control directly instead of adding
//             a new one (see js/modular/codegen.js's resolveKnob()).
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
        // Soft-limits a signal to [lo, hi] — basic waveshaping/distortion (feed
        // it an over-driven signal and clip tight), or a safety limiter after
        // a Mix that could otherwise sum past ±1.
        codegen(node, ins) {
            return `clip(${ins.in}, ${ins.lo}, ${ins.hi})`;
        },
    },

    env: {
        label: 'Envelope',
        output: 'audio',
        params: [{ name: 'shape', kind: 'select', options: ['perc', 'linen'], default: 'perc' }],
        inputs: [{ name: 'in', default: 0 }],
        // Reads the standard attack/sus/release controls automatically — no
        // manual wiring needed, same convention as every built-in synth.
        // (Env.perc has no separate sustain phase, so — matching tour lesson
        // 17's hand-written buzz example exactly — `sus` doubles as its release.)
        codegen(node, ins) {
            const env = node.params.shape === 'linen'
                ? 'Env.linen(attack, sus, release, 1)'
                : 'Env.perc(attack, sus, 1, -4)';
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
        inputs: [{ name: 'in', default: 0 }],
        codegen(node, ins) {
            return `Out.ar(out, Pan2.ar(mul(${ins.in}, amp), pan))`;
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
