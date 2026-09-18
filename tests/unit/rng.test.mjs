// seed() — the properties that make a set reproduce and a room agree.
import * as R from '../../js/patterns/rng.js';
import * as S from '../../js/patterns/sequences.js';

const take = (mk, n = 16) => { const p = mk(); return Array.from({ length: n }, (_, i) => p.get(i)); };
const GENS = {
    PRand:  () => S.PRand([0, 4, 7]),      PWhite: () => S.PWhite(0, 1),
    melody: () => S.melody(),              PWalk:  () => S.PWalk(0, 1, 3),
    PBrown: () => S.PBrown(0, 1),          PGauss: () => S.PGauss(0, 1),
    PxRand: () => S.PxRand([1, 2, 3]),     PBern:  () => S.PBern(0.5),
    PShuf:  () => S.PShuf([1, 2, 3, 4]),   PLog:   () => S.PLog(0, 1),
    PwRand: () => S.PwRand([1, 2, 3], [3, 1, 1]),
    PChain: () => S.PChain({ 0: [1], 1: [0, 2], 2: [0] }),
};

export default function ({ test, eq, ok, near }) {
    test('rng: unseeded is the default and stays random', () => {
        R.setSeed(null);
        ok(!R.isSeeded(), 'should start unseeded');
        ok(R.randAt(0, 5) !== R.randAt(0, 5), 'unseeded draws should differ');
    });

    for (const [name, mk] of Object.entries(GENS)) {
        test(`rng: ${name} reproduces under a seed`, () => {
            R.setSeed(42); R.beginEvalScope('a line'); const a = take(mk);
            R.setSeed(42); R.beginEvalScope('a line'); const b = take(mk);
            eq(a, b, `${name} differed between two identical runs`);
        });
    }

    test('rng: a value is ADDRESSED, so call history cannot matter', () => {
        // This is the property a sequential PRNG cannot give, and the reason two
        // peers stayed in step: one machine drawing more numbers must not shift
        // the other's answer for a given step.
        R.setSeed(9); R.beginEvalScope('L'); const A = S.PRand([0, 4, 7]);
        R.setSeed(9); R.beginEvalScope('L'); const B = S.PRand([0, 4, 7]);
        const fwd = Array.from({ length: 20 }, (_, i) => A.get(i));
        const back = []; for (let i = 19; i >= 0; i--) back[i] = B.get(i);
        eq(fwd, back, 'forward and reverse call orders disagreed');
    });

    test('rng: a different seed, or different code, gives different music', () => {
        R.setSeed(42); R.beginEvalScope('L1'); const a = take(GENS.PRand);
        R.setSeed(43); R.beginEvalScope('L1'); const b = take(GENS.PRand);
        R.setSeed(42); R.beginEvalScope('L2'); const c = take(GENS.PRand);
        ok(JSON.stringify(a) !== JSON.stringify(b), 'seed 42 and 43 matched');
        ok(JSON.stringify(a) !== JSON.stringify(c), 'two different lines matched');
    });

    test('rng: the salt is what makes .reroll() reroll under a fixed seed', () => {
        R.setSeed(42); R.beginEvalScope('L', 0); const a = take(GENS.PRand);
        R.setSeed(42); R.beginEvalScope('L', 1); const b = take(GENS.PRand);
        ok(JSON.stringify(a) !== JSON.stringify(b), 'salt did not change the draw');
    });

    test('rng: construction-time draws restart with the scope', () => {
        // PShuf shuffles once when it is built. If the one-shot counter does not
        // reset, the second run of a line does not match the first.
        R.setSeed(1); R.beginEvalScope('L'); const a = take(GENS.PShuf);
        R.setSeed(1); R.beginEvalScope('L'); const b = take(GENS.PShuf);
        eq(a, b);
    });

    test('rng: a walk replays, so joining late lands in the same place', () => {
        R.setSeed(5); R.beginEvalScope('W'); const A = S.PBrown(0, 1);
        R.setSeed(5); R.beginEvalScope('W'); const B = S.PBrown(0, 1);
        for (let i = 0; i < 40; i++) A.get(i);          // one peer has been running
        near(A.get(40), B.get(40), 1e-12, 'a peer that joined at step 40');
    });

    test('rng: the hash is uniform', () => {
        R.setSeed(7); R.beginEvalScope('u');
        const N = 60000, B = 10, bins = new Array(B).fill(0);
        for (let i = 0; i < N; i++) bins[Math.min(B - 1, Math.floor(R.randAt(i % 64, i) * B))]++;
        const exp = N / B, chi = bins.reduce((a, b) => a + (b - exp) ** 2 / exp, 0);
        ok(chi < 27, `chi-square ${chi.toFixed(1)} — not uniform (9 df, p=0.001 is 27.9)`);
    });

    test('rng: patGet on an empty list returns the default, not undefined', () => {
        eq(S.patGet([], 0, 'DEF'), 'DEF');
        eq(S.patGet(null, 0, 'DEF'), 'DEF');
        eq(S.patGet([5], 3, 'DEF'), 5);
    });
    R.setSeed(null);
}
