// sample(): which bar a take starts on, how long it is, and where it listens. Pure
// arithmetic, so it is checked here rather than by ear — the ear finds out one bar
// late, and only on the bars where the edge case happens.
import { planTake, resolveSource } from '../../js/engine/takeplan.js';

export default function ({ test, eq, ok, near }) {
    const at = (nowBeat, extra = {}) => planTake({ nowBeat, bpm: 120, beats: 4, quant: 4, leadSec: 0.3, ...extra });

    test('takeplan: starts on the next bar', () => eq(at(1).startBeat, 4));
    test('takeplan: a bar too close to reach is skipped — the lead is 0.6 beats at 120', () => {
        eq(at(3.5).startBeat, 8);
        eq(at(3.3).startBeat, 4);
    });
    test('takeplan: exactly on a bar that is out of reach goes to the next one', () => eq(at(4).startBeat, 8));
    test('takeplan: quant=0 starts as soon as the lead allows, off the grid', () => near(at(1, { quant: 0 }).startBeat, 1.6));
    test('takeplan: quant=1 snaps to the next beat', () => eq(at(1.1, { quant: 1 }).startBeat, 2));
    test('takeplan: length is fixed in seconds at the tempo asked', () => {
        const p = at(0, { beats: 8, bpm: 90, sampleRate: 48000 });
        near(p.seconds, 8 * 60 / 90);
        eq(p.frames, Math.round(8 * 60 / 90 * 48000));
        eq(p.endBeat, p.startBeat + 8);
    });
    test('takeplan: bytes count both channels as float32', () => eq(at(0, { sampleRate: 1000 }).bytes, 2000 * 2 * 4));
    test('takeplan: no length, no take', () => {
        ok(!at(0, { beats: 0 }).ok);
        ok(!at(0, { beats: 'x' }).ok);
        ok(!at(0, { beats: -2 }).ok);
    });
    test('takeplan: a bpm of 0 does not divide by zero', () => ok(isFinite(at(0, { bpm: 0 }).seconds)));
    test('takeplan: latency is carried, never negative', () => {
        eq(at(0, { latencySec: 0.02 }).latencySec, 0.02);
        eq(at(0, { latencySec: -1 }).latencySec, 0);
    });

    const p1 = { name: 'p1', recBus() { return 70; } };
    const find = (n) => (n === 'p1' ? p1 : null);
    test('source: nothing means the mix', () => eq(resolveSource(undefined).kind, 'master'));
    test('source: names for the mix and the input', () => {
        for (const s of ['master', 'mix', 'OUT']) eq(resolveSource(s).kind, 'master');
        for (const s of ['in', 'input', 'Mic', 'line']) eq(resolveSource(s).kind, 'in');
    });
    test('source: a player object', () => eq(resolveSource(p1).player, p1));
    test('source: a player by name', () => eq(resolveSource('p1', find).player, p1));
    test('source: anything else says so', () => {
        const r = resolveSource('p9', find);
        eq(r.kind, null);
        ok(/p9/.test(r.why));
    });
}
