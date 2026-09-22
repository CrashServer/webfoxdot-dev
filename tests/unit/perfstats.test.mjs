// The lateness histogram behind perf().
//
// This exists to make a specific claim honest: "the main thread ate the 120ms of
// slack N times". If over() miscounts, perf() tells you audio was fine when it was
// not — which is worse than having no instrument, because you would believe it.
import { Lateness } from '../../js/engine/perfstats.js';

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
        // buckets: <=10, <=20, <=40, 40+
        for (const v of [1, 9, 15, 25, 100, 300]) l.add(v);
        eq(l.over(40), 2, '100 and 300 are past 40');
        eq(l.over(20), 3, '25, 100, 300');
        eq(l.over(0), 6);
        eq(l.over(1000), 0);
    });

    test('perfstats: over() never splits a bucket it cannot see inside', () => {
        // The 10-20 bucket holds a 15. Asking for "over 12" cannot answer from
        // buckets, so it must not claim the 15 — it reports only whole buckets at or
        // past the threshold. Under-reporting is the safe direction for a count that
        // is compared against zero.
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
}
