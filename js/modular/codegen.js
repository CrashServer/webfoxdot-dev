// Graph → JS source text → real buildFn → the EXISTING, unmodified defsynth().
//
// The code-preview pane and the actually-compiled synth are always the same
// string: generateSource() produces the text first, compileToFunction() runs
// THAT text through `new Function` to get the callable closure. There's no
// separate "build the graph directly" path that could drift from what's shown.

import { topoSort, edgeInto } from './graph.js';
import { blockDef } from './blocks.js';
import { binaryOp, unaryOp } from '../scsynth/synthdef.js';
import * as UGENS from '../scsynth/ugens.js';
import { defsynth } from '../scsynth/defsynth.js';

// add()/mul() — thin wrappers around synthdef.js's real binaryOp(), which
// coerces either side via asInput(). Blocks whose codegen combines TWO
// possibly-unwired inputs (Mix, Scale, Envelope's amp stage, Output's amp
// stage) go through these instead of calling `.add()`/`.mul()` directly on
// an expression, because an unwired input's expression is a bare knob
// reference that may resolve to a plain JS number at runtime — and numbers
// don't have `.add()`/`.mul()` methods, only UGenOut does.
export function add(a, b) { return binaryOp('+', a, b); }
export function mul(a, b) { return binaryOp('*', a, b); }
// min()/max() back the Clip block (soft-limit a signal between lo/hi) — the
// same possibly-a-plain-number concern as add/mul applies, so it goes through
// binaryOp too rather than a UGenOut method (there isn't one for min/max).
export function min(a, b) { return binaryOp('min', a, b); }
export function max(a, b) { return binaryOp('max', a, b); }
export function clip(x, lo, hi) { return min(max(x, lo), hi); }
// tanh() backs the Distortion block — soft-saturation drive, the single most
// common technique in the hand-written synth set (war/dab/growl/tekno/guitar
// all end their drive stage in `.tanh`). Goes through unaryOp for the same
// plain-number reason as above.
export function tanh(x) { return unaryOp('tanh', x); }

// The generated buildFn's own top-level params — tagging a knob's role with
// one of these EXACT names reuses that control directly (a bare reference,
// e.g. `amp`) instead of adding a redundant new extraParam.
const STD_NAMES = new Set(['out', 'note', 'amp', 'sus', 'pan', 'attack', 'release']);

// A role/custom name → valid JS identifier, or null if nothing usable is left.
function sanitizeIdent(s) {
    const id = String(s).trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[^a-zA-Z_]+/, '');
    return id || null;
}

// Resolves one knob (an unwired input port, or a param-less block's own
// value, e.g. Number) to a source expression.
//
// Untagged, a knob's OWN port name is already the house convention every
// hand-written synth in js/synths/registry.js uses — cutoff, rq, rate, dist…
// — so it's used directly (p1 >> mypatch(cutoff=2000)) rather than an opaque
// n2_cutoff. Two DIFFERENT untagged knobs that happen to share a port name
// (two Filter blocks both have 'cutoff') are NOT silently merged — that
// would mean turning one knob secretly retunes the other block too — they
// auto-disambiguate instead (cutoff, cutoff2, cutoff3…).
//
// Explicitly tagging a role (the UI's per-knob dropdown) always wins over
// the port name, and — unlike the untagged case — two knobs deliberately
// tagged with the SAME role DO collapse onto one shared extraParam; that's
// the point of tagging by hand, an intentional "these are the same logical
// control" the auto-disambiguation can't infer on its own.
//
// Either way, if the resolved name matches a STD control exactly (out/note/
// amp/sus/pan/attack/release) it reuses that control directly — a bare
// reference, e.g. `attack` — instead of adding a redundant new extraParam.
function resolveKnob(node, key, defaultVal, extraParams, usedDefaultNames) {
    const role = node.roles && node.roles[key];
    const roleIdent = role ? sanitizeIdent(role) : null;

    if (roleIdent) {
        if (STD_NAMES.has(roleIdent)) return roleIdent;
        if (!(roleIdent in extraParams)) extraParams[roleIdent] = defaultVal;
        return `knobs.${roleIdent}`;
    }

    if (STD_NAMES.has(key)) return key;
    let name = key;
    if (usedDefaultNames.has(name)) {
        let n = 2;
        while (usedDefaultNames.has(name + n)) n++;
        name = name + n;
    }
    usedDefaultNames.add(name);
    extraParams[name] = defaultVal;
    return `knobs.${name}`;
}

// graph → { source, extraParams } | { error }
export function generateSource(graph) {
    const sorted = topoSort(graph);
    if (sorted.error) return { error: `cycle detected — can't compile a loop: ${sorted.cycle.join(', ')}` };
    if (!graph.nodes.length) return { error: 'empty patch — add some blocks first' };

    const byId = new Map(graph.nodes.map(n => [n.id, n]));
    const varName = new Map();      // nodeId → js var name
    const extraParams = {};         // knob param name → default value
    const usedDefaultNames = new Set(); // port names already claimed by an untagged knob — see resolveKnob
    const lines = [];
    const outputLines = [];         // every terminal (Output) node's line — see below

    for (const id of sorted.order) {
        const node = byId.get(id);
        const def = blockDef(node.type);
        const v = 'v_' + id;
        varName.set(id, v);

        const ins = {};
        for (const port of def.inputs) {
            const edge = edgeInto(graph, id, port.name);
            if (edge && varName.has(edge.from.node)) {
                ins[port.name] = varName.get(edge.from.node);
            } else {
                ins[port.name] = resolveKnob(node, port.name, node.params?.[port.name] ?? port.default, extraParams, usedDefaultNames);
            }
        }
        const knobRef = (key, defaultVal) => resolveKnob(node, key, defaultVal, extraParams, usedDefaultNames);

        const expr = def.codegen(node, ins, knobRef);
        // A previous version kept only the LAST terminal node's line (each new
        // one silently overwrote outputLine) — a second Output block's audio
        // vanished from the generated source with no error and no trace. Every
        // terminal node emits its own Out.ar line now; SC sums same-bus writes,
        // so two Output blocks correctly mix together instead of one going mute.
        if (def.isTerminal) outputLines.push('  ' + expr + ';');
        else lines.push(`  const ${v} = ${expr};`);
    }

    if (!outputLines.length) return { error: 'patch has no Output block — nothing would play' };

    const source = [
        `({ out, note, amp, sus, pan, attack, release, ...knobs }) => {`,
        ...lines,
        ...outputLines,
        `}`,
    ].join('\n');

    // Every built-in synth's node frees itself via an EnvGen(..., doneAction: 2) —
    // the engine never separately sends /n_free for a note (js/engine/player.js).
    // A patch with no Envelope block has no doneAction, so each triggered note's
    // synth node runs forever: it never stops sounding and never gets freed, so
    // node count (and CPU) climbs with every note played. Not a compile error —
    // a deliberately-sustained drone is legitimate — just flagged.
    const warnings = [];
    if (!graph.nodes.some(n => n.type === 'env')) {
        warnings.push('no Envelope block — notes will sustain forever and their synth nodes will never free (leaks a node per note). Add an Envelope between your sound source and Output, or wire it in deliberately if you want a held drone.');
    }
    if (outputLines.length > 1) {
        warnings.push(`${outputLines.length} Output blocks — their signals all sum onto the same output bus (that's usually what you want, but can clip if it's not).`);
    }

    return { source, extraParams, warnings };
}

// UGen factories the generated source is allowed to reference by bare name —
// exactly what a hand-written defsynth() build function can already use
// (js/scsynth/ugens.js), plus the add/mul helpers above.
const UGEN_NAMES = [
    'SinOsc', 'Saw', 'VarSaw', 'Blip', 'Pulse', 'LFTri', 'Impulse', 'Line', 'XLine',
    'WhiteNoise', 'PinkNoise', 'LFNoise0', 'LFNoise1', 'LFNoise2',
    'RLPF', 'RHPF', 'LPF', 'HPF', 'BPF', 'LeakDC', 'EnvGen', 'Env', 'Pan2', 'Out',
];

// source text → callable ({out,note,amp,...}) => {...}. Binds the UGen
// factories as named arguments so the generated body can call them bare,
// same as a human typing a defsynth() build function.
export function compileToFunction(source) {
    const argNames  = [...UGEN_NAMES, 'add', 'mul', 'clip', 'tanh'];
    const argValues = [...UGEN_NAMES.map(n => UGENS[n]), add, mul, clip, tanh];
    const factory = new Function(...argNames, `return (${source});`);
    return factory(...argValues);
}

// graph → registered, playable synth (via the real defsynth() — no changes
// to js/scsynth/* needed). Returns what was generated, for the preview pane.
export async function compileAndDefine(name, graph) {
    const { source, extraParams, error, warnings } = generateSource(graph);
    if (error) throw new Error(error);
    const buildFn = compileToFunction(source);
    await defsynth(name, extraParams, buildFn);
    return { source, extraParams, warnings };
}
