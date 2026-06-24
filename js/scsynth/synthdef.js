// SynthDef binary serializer + UGen graph builder.
//
// Produces .scsyndef (version 2) bytes in the browser — no sclang, no server.
// Send the result to scsynth via sc.loadSynthDef(bytes) / sc.send('/d_recv', bytes).
//
// Format (big-endian):
//   "SCgf" int32:version(=2) int16:numDefs
//   per def:
//     pstring name
//     int32 nConst, float32 × nConst
//     int32 nParam, float32 × nParam              (control default values)
//     int32 nParamNames, (pstring name, int32 index) × n
//     int32 nUGens, per ugen:
//        pstring className, int8 rate, int32 nIn, int32 nOut, int16 special,
//        (int32 ugenIndex, int32 outIndex) × nIn      (ugenIndex -1 ⇒ constant)
//        int8 outputRate × nOut
//     int16 nVariants (=0)

export const RATE = { ir: 0, kr: 1, ar: 2, dr: 3 };

// ── Byte writer (big-endian, grows as needed) ─────────────────────────────────
class Writer {
    constructor() { this.bytes = []; }
    u8(v)  { this.bytes.push(v & 0xff); }
    i8(v)  { this.bytes.push(v & 0xff); }
    i16(v) { this.bytes.push((v >> 8) & 0xff, v & 0xff); }
    i32(v) { this.bytes.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff); }
    f32(v) {
        const b = new Uint8Array(4);
        new DataView(b.buffer).setFloat32(0, v, false); // big-endian
        this.bytes.push(b[0], b[1], b[2], b[3]);
    }
    pstr(s) {
        const enc = new TextEncoder().encode(s);
        this.u8(enc.length);
        for (const c of enc) this.u8(c);
    }
    toUint8Array() { return new Uint8Array(this.bytes); }
}

// ── Low-level encoder ─────────────────────────────────────────────────────────
// def = {
//   name, constants:[float], params:[float],
//   paramNames:[{name,index}],
//   ugens:[{ name, rate, special, inputs:[[ugenIdx,outIdx]], outRates:[rate] }]
// }
export function encodeSynthDef(def) {
    const w = new Writer();
    w.i32(0x53436766);          // "SCgf"
    w.i32(2);                    // version 2
    w.i16(1);                    // numDefs

    w.pstr(def.name);

    w.i32(def.constants.length);
    for (const c of def.constants) w.f32(c);

    w.i32(def.params.length);
    for (const p of def.params) w.f32(p);

    w.i32(def.paramNames.length);
    for (const pn of def.paramNames) { w.pstr(pn.name); w.i32(pn.index); }

    w.i32(def.ugens.length);
    for (const u of def.ugens) {
        w.pstr(u.name);
        w.i8(u.rate);
        w.i32(u.inputs.length);
        w.i32(u.outRates.length);
        w.i16(u.special || 0);
        for (const [uidx, oidx] of u.inputs) { w.i32(uidx); w.i32(oidx); }
        for (const r of u.outRates) w.i8(r);
    }

    w.i16(0);                    // numVariants
    return w.toUint8Array();
}

// ── Graph builder ─────────────────────────────────────────────────────────────
// UGen nodes are created during a build and accumulated on a SynthGraph.
// Inputs are either another UGen output (UGenOut) or a JS number (constant).

let _graph = null;   // current graph during a defsynth build

export class UGen {
    constructor(name, rate, inputs, numOutputs = 1, special = 0) {
        this.name    = name;
        this.rate    = rate;
        this.inputs  = inputs;     // array of UGenOut | number
        this.special = special;
        this.outs    = [];
        for (let i = 0; i < numOutputs; i++) this.outs.push(new UGenOut(this, i));
        if (_graph) _graph.add(this);
    }
    // multi-out access; default value is first output
    out(i = 0) { return this.outs[i]; }
}

// A reference to one output channel of a UGen — supports math via methods.
export class UGenOut {
    constructor(ugen, index) { this.ugen = ugen; this.index = index; }
    get rate() { return this.ugen.rate; }
    mul(b) { return binaryOp('*', this, b); }
    add(b) { return binaryOp('+', this, b); }
    sub(b) { return binaryOp('-', this, b); }
    div(b) { return binaryOp('/', this, b); }
    midicps()  { return unaryOp('midicps', this); }
    midiratio(){ return unaryOp('midiratio', this); }
    abs()      { return unaryOp('abs', this); }
    neg()      { return unaryOp('neg', this); }
}

export class SynthGraph {
    constructor() { this.ugens = []; }
    add(u) { u._idx = this.ugens.length; this.ugens.push(u); return u; }
}

// SC binary-operator selector indices (subset)
const BINOP = { '+': 0, '-': 1, '*': 2, '/': 4, 'min': 5, 'max': 6, '%': 5 };

// Coerce an input to a UGenOut or leave as a number (constant)
function asInput(v) {
    if (v instanceof UGenOut) return v;
    if (v instanceof UGen)    return v.out(0);
    return v;                 // number → constant
}

export function binaryOp(op, a, b) {
    const ia = asInput(a), ib = asInput(b);
    // rate = audio if either operand is audio, else control
    const rate = ([ia, ib].some(x => x instanceof UGenOut && x.rate === RATE.ar)) ? RATE.ar : RATE.kr;
    return new UGen('BinaryOpUGen', rate, [ia, ib], 1, BINOP[op] ?? 0).out(0);
}

// SC unary-operator selector indices (validated against sclang)
const UNOP = { neg: 0, abs: 5, recip: 16, midicps: 17, cpsmidi: 18, midiratio: 19 };

export function unaryOp(op, a) {
    const ia = asInput(a);
    const rate = (ia instanceof UGenOut) ? ia.rate : RATE.kr;
    return new UGen('UnaryOpUGen', rate, [ia], 1, UNOP[op] ?? 0).out(0);
}

// ── Build + serialize ─────────────────────────────────────────────────────────
// controls: [{ name, default, rate }]  (rate defaults to kr)
// build(controlsObj) → returns the graph's output (an Out UGen is created by DSL)
export function buildSynthDef(name, controls, buildFn) {
    const prev = _graph;
    _graph = new SynthGraph();
    try {
        // Control UGen: one output per param, all at control rate
        const ctlNames = controls.map(c => c.name);
        const ctl = new UGen('Control', RATE.kr, [], ctlNames.length, 0);
        const params = {};
        controls.forEach((c, i) => { params[c.name] = ctl.out(i); });
        buildFn(params);    // DSL builds the graph; must create an Out ugen
        return serializeGraph(name, _graph, controls);
    } finally {
        _graph = prev;
    }
}

function serializeGraph(name, graph, controls) {
    // Collect unique constants
    const constants = [];
    const constIdx = new Map();
    const constantIndex = (v) => {
        if (constIdx.has(v)) return constIdx.get(v);
        const i = constants.length;
        constIdx.set(v, i); constants.push(v); return i;
    };

    // First pass: register constants in input order so indices match sclang-ish output
    for (const u of graph.ugens) {
        for (const inp of u.inputs) if (!(inp instanceof UGenOut)) constantIndex(inp);
    }

    const ugens = graph.ugens.map(u => ({
        name: u.name,
        rate: u.rate,
        special: u.special,
        inputs: u.inputs.map(inp =>
            inp instanceof UGenOut ? [inp.ugen._idx, inp.index] : [-1, constantIndex(inp)]),
        outRates: u.outs.map(() => u.rate),
    }));

    return encodeSynthDef({
        name,
        constants,
        params: controls.map(c => c.default ?? 0),
        paramNames: controls.map((c, i) => ({ name: c.name, index: i })),
        ugens,
    });
}
