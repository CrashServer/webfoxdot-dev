// Graph → JS source text → real buildFn → the EXISTING, unmodified defsynth().
//
// The code-preview pane and the actually-compiled synth are always the same
// string: generateSource() produces the text first, compileToFunction() runs
// THAT text through `new Function` to get the callable closure. There's no
// separate "build the graph directly" path that could drift from what's shown.

import { topoSort, edgeInto } from './graph.js';
import { blockDef } from './blocks.js';
import { binaryOp } from '../scsynth/synthdef.js';
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

// graph → { source, extraParams } | { error }
export function generateSource(graph) {
    const sorted = topoSort(graph);
    if (sorted.error) return { error: `cycle detected — can't compile a loop: ${sorted.cycle.join(', ')}` };
    if (!graph.nodes.length) return { error: 'empty patch — add some blocks first' };

    const byId = new Map(graph.nodes.map(n => [n.id, n]));
    const varName = new Map();      // nodeId → js var name
    const extraParams = {};         // knob param name → default value
    const lines = [];
    let outputLine = null;

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
                const paramName = `${id}_${port.name}`;
                extraParams[paramName] = node.params?.[port.name] ?? port.default;
                ins[port.name] = `knobs.${paramName}`;
            }
        }

        const expr = def.codegen(node, ins);
        if (def.isTerminal) outputLine = expr + ';';
        else lines.push(`  const ${v} = ${expr};`);
    }

    if (!outputLine) return { error: 'patch has no Output block — nothing would play' };

    const source = [
        `({ out, note, amp, sus, pan, attack, release, ...knobs }) => {`,
        ...lines,
        `  ${outputLine}`,
        `}`,
    ].join('\n');

    return { source, extraParams };
}

// UGen factories the generated source is allowed to reference by bare name —
// exactly what a hand-written defsynth() build function can already use
// (js/scsynth/ugens.js), plus the add/mul helpers above.
const UGEN_NAMES = [
    'SinOsc', 'Saw', 'Pulse', 'LFTri', 'WhiteNoise', 'PinkNoise', 'LFNoise1',
    'RLPF', 'LPF', 'HPF', 'BPF', 'EnvGen', 'Env', 'Pan2', 'Out',
];

// source text → callable ({out,note,amp,...}) => {...}. Binds the UGen
// factories as named arguments so the generated body can call them bare,
// same as a human typing a defsynth() build function.
export function compileToFunction(source) {
    const argNames  = [...UGEN_NAMES, 'add', 'mul'];
    const argValues = [...UGEN_NAMES.map(n => UGENS[n]), add, mul];
    const factory = new Function(...argNames, `return (${source});`);
    return factory(...argValues);
}

// graph → registered, playable synth (via the real defsynth() — no changes
// to js/scsynth/* needed). Returns what was generated, for the preview pane.
export async function compileAndDefine(name, graph) {
    const { source, extraParams, error } = generateSource(graph);
    if (error) throw new Error(error);
    const buildFn = compileToFunction(source);
    await defsynth(name, extraParams, buildFn);
    return { source, extraParams };
}
