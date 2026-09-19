// FXChain — the per-player effect chain, which the master bus now reuses.
//
// The master runs it on bus 0, where the tail router must NOT exist: fd_fx_out does
// Out.ar, which adds, so routing bus 0 onto bus 0 would double the entire mix. That
// is the failure these tests are here to stop, because it would not throw — it would
// just be twice as loud as it should be and clip into the limiter.
import { FXChain } from '../../js/fx/chain.js';

// A stand-in server that records what it was told.
function fakeSc() {
    let id = 1000;
    const sent = [];
    return { sent, nextNodeId: () => id++, send: (...m) => sent.push(m) };
}
const defs = (sc) => sc.sent.filter(m => m[0] === '/s_new').map(m => m[1]);

export default function ({ test, eq, ok }) {
    test('fxchain: a player chain gets its out-router', () => {
        const sc = fakeSc();
        new FXChain(16, 3, sc);
        ok(defs(sc).includes('fd_fx_out'), 'no router on a private bus — the player would be silent');
    });

    test('fxchain: the master chain has NO router (it would double the mix)', () => {
        const sc = fakeSc();
        const c = new FXChain(0, 5, sc, { router: false });
        c.update({ chorus: 0.5, fbdelay: 0.4 }, sc);
        ok(!defs(sc).includes('fd_fx_out'), 'fd_fx_out on bus 0 adds the mix to itself');
        eq(c.size, 2);
    });

    test('fxchain: routerless reorder never names a null node', () => {
        const sc = fakeSc();
        const c = new FXChain(0, 5, sc, { router: false });
        c.update({ crush: 6, chorus: 0.5 }, sc);
        const afters = sc.sent.filter(m => m[0] === '/n_after');
        ok(afters.every(m => m[1] != null && m[2] != null), 'an /n_after with a null id');
    });

    test('fxchain: effects are ordered canonically, not by arrival', () => {
        // chorus is asked for first, but crush comes earlier in FX_EFFECTS.
        const sc = fakeSc();
        const c = new FXChain(0, 5, sc, { router: false });
        c.update({ chorus: 0.5 }, sc);
        c.update({ chorus: 0.5, crush: 6 }, sc);
        const byId = new Map(sc.sent.filter(m => m[0] === '/s_new').map(m => [m[2], m[1]]));
        const last = sc.sent.filter(m => m[0] === '/n_after').pop();
        // the final reorder puts chorus AFTER crush
        eq(byId.get(last[1]), 'fd_fx_chorus');
        eq(byId.get(last[2]), 'fd_fx_crush');
    });

    test('fxchain: a built-in-free update adds nothing', () => {
        const sc = fakeSc();
        const c = new FXChain(0, 5, sc, { router: false });
        c.update({ beat_dur: 0.5 }, sc);            // a parameter, not a trigger
        eq(c.size, 0);
    });
}
