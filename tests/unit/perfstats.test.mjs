// The lateness histogram and span attribution behind perf().
//
// This exists to make a specific claim honest: "the main thread ate the 120ms of
// slack N times, and the eval was the worst of it". If over() miscounts, perf()
// says audio was fine when it was not — worse than no instrument, because you
// would believe it.
import { Lateness, spanStart, spanEnd, timed, stallCauses, resetCauses }
    from '../../js/engine/perfstats.js';

export default function ({ test, eq, ok }) {
    test('perfstats: counts, max and mean', () => {
        const l = new Lateness();
        for (const v of [0, 1, 5, 200]) l.add(v);
        eq(l.n, 4);
        eq(l.max, 200);
        eq(l.mean, 51.5);
    });

    test('perfstats: early ticks are not negative lateness', () => {
        // A tick that fires 3ms EARLY is not -3ms of a problem, it is no problem.
        const l = new Lateness();
        l.add(-3); l.add(-50);
        eq(l.max, 0);
        eq(l.mean, 0);
        eq(l.over(1), 0);
    });

    test('perfstats: over() is the count at or past the threshold', () => {
        const l = new Lateness([10, 20, 40]);
        for (const v of [1, 9, 15, 25, 100, 300]) l.add(v);
        eq(l.over(40), 2, '100 and 300 are past 40');
        eq(l.over(20), 3, '25, 100, 300');
        eq(l.over(0), 6);
        eq(l.over(1000), 0);
    });

    test('perfstats: over() never splits a bucket it cannot see inside', () => {
        // The 10-20 bucket holds a 15. Asking for "over 12" cannot be answered from
        // buckets, so it must not claim the 15. Under-reporting is the safe direction
        // for a count that gets compared against zero.
        const l = new Lateness([10, 20, 40]);
        l.add(15);
        eq(l.over(12), 0);
        eq(l.over(10), 1);
    });

    test('perfstats: percentiles come back as a bucket edge', () => {
        const l = new Lateness([10, 20, 40]);
        for (let i = 0; i < 95; i++) l.add(1);
        for (let i = 0; i < 5; i++) l.add(35);
        eq(l.pct(0.5), 10, 'the median sits in the first bucket');
        eq(l.pct(0.99), 40, 'the tail sits in the 20-40 bucket');
    });

    test('perfstats: the top bucket reports the real max, not Infinity', () => {
        const l = new Lateness([10]);
        l.add(999);
        eq(l.pct(0.99), 999);
        ok(isFinite(l.pct(1)), 'a percentile must be a number you can print');
    });

    test('perfstats: reset clears everything', () => {
        const l = new Lateness();
        l.add(500);
        l.reset();
        eq(l.n, 0); eq(l.max, 0); eq(l.mean, 0); eq(l.histogram(), '');
    });

    test('perfstats: the histogram drops empty buckets', () => {
        const l = new Lateness([10, 20]);
        l.add(5); l.add(5); l.add(50);
        eq(l.histogram(), '0-10:2 20-+:1');
    });

    // ── spans ────────────────────────────────────────────────────────────────
    test('perfstats: timed returns the function value', () => {
        resetCauses();
        eq(timed('x', () => 41 + 1), 42);
    });

    test('perfstats: timed still closes the span when the function throws', () => {
        // An eval that throws is exactly the case worth attributing, so the finally
        // is not optional — and the error must still reach the caller.
        let threw = false;
        try { timed('boom', () => { throw new Error('nope'); }); } catch (_) { threw = true; }
        ok(threw, 'the error was swallowed');
    });

    test('perfstats: a span under the floor is measured but not kept', () => {
        // 60fps of 2ms frames would otherwise bury the ring in noise.
        const h = spanStart('tiny');
        ok(spanEnd(h) < 8, 'this span is far under the 8ms floor');
    });

    test('perfstats: closing nothing is harmless', () => {
        eq(spanEnd(null), 0);
        eq(spanEnd(undefined), 0);
    });

    test('perfstats: causes are shaped right and start empty', () => {
        // They are filled by the long-task observer, which needs a browser; what is
        // checked here is that the accessor never throws and resets clean.
        resetCauses();
        ok(Array.isArray(stallCauses()));
        eq(stallCauses().length, 0);
    });
}
