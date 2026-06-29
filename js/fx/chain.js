// FXChain — manages one fd_fx_chain synth node per player.
// Created on first player activation, freed when player stops.
// FX params updated live via /n_set each step.

import { buildFxParams } from './registry.js';

export class FXChain {
    constructor(bus, fxGroupId, sc) {
        this._nodeId = sc.nextNodeId();
        this._last = {};   // scParam → last value sent, to skip unchanged /n_set
        sc.send('/s_new', 'fd_fx_chain', this._nodeId, 0, fxGroupId, 'in_bus', bus, 'out', 0);
    }

    // Apply resolved FX args, sending /n_set ONLY for params whose value changed.
    // A static FX (e.g. lpf=2000) then sends one message and nothing more; a
    // patterned/linvar FX still changes each step and still updates. Big OSC cut.
    update(resolvedFxArgs, sc) {
        const params = buildFxParams(resolvedFxArgs);
        const changed = [];
        for (let i = 0; i < params.length; i += 2) {
            const k = params[i], v = params[i + 1];
            if (this._last[k] !== v) { changed.push(k, v); this._last[k] = v; }
        }
        if (changed.length > 0) sc.send('/n_set', this._nodeId, ...changed);
    }

    free(sc) {
        if (this._nodeId !== null) {
            try { sc.send('/n_free', this._nodeId); } catch (_) {}
            this._nodeId = null;
        }
    }
}
