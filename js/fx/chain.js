// FXChain — per-player FX as on-demand per-effect nodes (approach A).
//
// Replaces the old single fd_fx_chain (which computed all 32 effects every block).
// Now each effect a player actually uses gets its own fd_fx_* node on the player's
// private bus, in canonical order; a permanent fd_fx_out node copies the bus to the
// main output. Absent effects = no node = zero CPU.
//
// An effect's node is created the first time one of its `trig` params is present
// and kept alive until the chain is freed (FX args are inherited across re-evals,
// so this matches their lifetime and avoids node churn from a gate crossing 0 —
// the effect's own XFade handles value 0 = dry). Params are /n_set per step, diffed.

import { FX_REGISTRY, FX_EFFECTS } from './registry.js';

export class FXChain {
    constructor(bus, fxGroupId, sc) {
        this._bus   = bus;
        this._group = fxGroupId;
        this._nodes = new Map();   // effect index → { id, last:{scParam:value} }
        this._outId = sc.nextNodeId();
        // Tail router: private bus → main out. Added to the group head; _reorder
        // keeps it after every effect node.
        sc.send('/s_new', 'fd_fx_out', this._outId, 0, fxGroupId, 'in_bus', bus, 'out', 0);
    }

    // resolvedFxArgs: { userKey: value } (already ungrouped) for this step.
    update(resolvedFxArgs, sc) {
        let orderDirty = false;
        for (let i = 0; i < FX_EFFECTS.length; i++) {
            const eff = FX_EFFECTS[i];
            let node = this._nodes.get(i);
            // Activate (create the node once) when a trigger param is present.
            if (!node && eff.trig.some(k => k in resolvedFxArgs)) {
                node = { id: sc.nextNodeId(), last: {} };
                sc.send('/s_new', eff.scName, node.id, 0, this._group, 'in_bus', this._bus);
                this._nodes.set(i, node);
                orderDirty = true;
            }
            if (!node) continue;
            // Push changed params for this effect.
            const changed = [];
            for (const k of eff.keys) {
                if (k in resolvedFxArgs) {
                    const sp = FX_REGISTRY[k].scParam, v = resolvedFxArgs[k];
                    if (node.last[sp] !== v) { changed.push(sp, v); node.last[sp] = v; }
                }
            }
            if (changed.length) sc.send('/n_set', node.id, ...changed);
        }
        if (orderDirty) this._reorder(sc);
    }

    // Order active effect nodes by canonical index, with the out router last, via a
    // /n_after chain. Each player's nodes read/write only its own bus, so their
    // position relative to other players' nodes in the group is irrelevant.
    _reorder(sc) {
        const ids = [...this._nodes.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1].id);
        let prev = null;
        for (const id of ids) {
            if (prev !== null) sc.send('/n_after', id, prev);
            prev = id;
        }
        if (prev !== null) sc.send('/n_after', this._outId, prev);
    }

    free(sc) {
        for (const node of this._nodes.values()) {
            try { sc.send('/n_free', node.id); } catch (_) {}
        }
        this._nodes.clear();
        if (this._outId !== null) {
            try { sc.send('/n_free', this._outId); } catch (_) {}
            this._outId = null;
        }
    }
}
