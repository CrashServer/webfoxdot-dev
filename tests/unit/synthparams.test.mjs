// Every param the app ADVERTISES must be one the server can actually receive.
//
// This is the bug shape that keeps turning up: a parameter the registry lists and
// the docs describe, sent to a SynthDef that has no such control. scsynth ignores an
// unknown control silently, so the line evaluates, nothing is logged, and nothing
// happens — the worst possible failure. ikea advertised `sn` while its SynthDef's
// control was `snare`, so ikea(sn=…) did nothing from the day it shipped.
//
// The compiled .scsyndef is the only honest answer to "what does this synth accept",
// so this reads the binaries rather than trusting a second list.
import { readFileSync, readdirSync } from 'node:fs';
import { SYNTH_DEFS } from '../../js/synths/registry.js';
import { FX_REGISTRY, FX_EFFECTS } from '../../js/fx/registry.js';

const DIR = new URL('../../synthdefs/compiled/', import.meta.url);

/** Control names of a SynthDef v2 file. */
function controls(buf) {
    let o = 0;
    const u8 = () => buf.readUInt8(o++);
    const i16 = () => { const v = buf.readInt16BE(o); o += 2; return v; };
    const i32 = () => { const v = buf.readInt32BE(o); o += 4; return v; };
    const pstr = () => { const n = u8(); const s = buf.toString('utf8', o, o + n); o += n; return s; };
    if (buf.toString('ascii', 0, 4) !== 'SCgf') return null;
    o = 4; i32(); const nDefs = i16();
    const out = {};
    for (let d = 0; d < nDefs; d++) {
        const name = pstr();
        // Temporaries on purpose: `o += 4 * i32()` reads o BEFORE i32() advances it,
        // so the four bytes the read consumed are thrown away and everything after
        // is garbage. JS evaluates the target of += first.
        const nConst = i32(); o += 4 * nConst;
        const nParams = i32(); o += 4 * nParams;
        const n = i32(), names = [];
        for (let i = 0; i < n; i++) { const nm = pstr(); i32(); names.push(nm); }
        out[name] = names;
    }
    return out;
}

// Controls every note carries, set by buildParams rather than declared per synth.
const BASE = new Set(['out', 'note', 'amp', 'pan', 'attack', 'sus', 'release', 'freq', 'bus',
                      'slide', 'slidefrom', 'slidedelay']);
// Params the JS resolves and never sends: they choose the note, its length or its
// place in the bar, so there is nothing for a SynthDef to receive.
const JS_ONLY = new Set(['oct', 'dur', 'degree', 'leg', 'cut', 'amplify', 'delay', 'pshift', 'sample']);

function loadDefs() {
    const defs = {};
    for (const f of readdirSync(DIR)) {
        if (!f.endsWith('.scsyndef')) continue;
        const c = controls(readFileSync(new URL(f, DIR)));
        if (c) Object.assign(defs, c);
    }
    return defs;
}

export default function ({ test, eq, ok }) {
    const defs = loadDefs();

    test('synthparams: the compiled defs parse at all', () => {
        ok(Object.keys(defs).length > 100, `only ${Object.keys(defs).length} defs parsed`);
        ok(defs.fd_master && defs.fd_master.includes('lpf'), 'fd_master has no lpf control');
    });

    test('synthparams: every advertised synth param is a real control', () => {
        const bad = [];
        for (const [name, def] of Object.entries(SYNTH_DEFS)) {
            const have = defs[def.scName];
            if (!have) { bad.push(`${name}: no compiled ${def.scName}`); continue; }
            const set = new Set(have);
            for (const p of new Set([...(def.extraParams || []), ...Object.keys(def.defaults || {})]))
                if (!set.has(p) && !BASE.has(p) && !JS_ONLY.has(p)) bad.push(`${name}.${p}`);
        }
        eq(bad.join(' '), '', `advertised but not a control: ${bad.join(', ')}`);
    });

    test('synthparams: every FX key is a real control on its effect', () => {
        const bad = [];
        for (const eff of FX_EFFECTS) {
            const have = defs[eff.scName];
            if (!have) { bad.push(`${eff.scName}: not compiled`); continue; }
            const set = new Set(have);
            for (const k of eff.keys) {
                const sp = FX_REGISTRY[k]?.scParam || k;
                if (!set.has(sp)) bad.push(`${eff.scName}.${sp}`);
            }
        }
        eq(bad.join(' '), '', `FX keys with no control: ${bad.join(', ')}`);
    });

    test('synthparams: every registry FX key is consumed by some effect', () => {
        // A key nothing reads is a knob the docs offer and no node receives.
        const used = new Set(FX_EFFECTS.flatMap(e => e.keys));
        const orphan = Object.keys(FX_REGISTRY).filter(k => !used.has(k));
        eq(orphan.join(' '), '', `registry keys no effect consumes: ${orphan.join(', ')}`);
    });

    test('synthparams: the sampler can be trimmed', () => {
        // play(..., sus=) and cut= both need this control; without it they were
        // accepted and ignored, which is how that stayed broken so long.
        ok(defs.fd_sampler?.includes('sus'), 'fd_sampler has no sus control');
    });
}
