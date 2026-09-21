// The wave generators take numbers that may themselves be patterns or lists.
//
// They used to use their arguments raw, so a list reached a comparison as an ARRAY:
// PPulse(0, 4, 16, [0.7, 0.7]) coerced [0.7,0.7] to NaN, the comparison was false on
// every step, and the pulse sat on `lo` forever — a line that looks right and does
// nothing. A single-element [0.7] coerced to 0.7 and worked, which made the failure
// look like a quirk of the values rather than a bug.
import { PPulse, PSine, PSaw, PTri, PSlide } from '../../js/patterns/sequences.js';

const take = (p, n) => Array.from({ length: n }, (_, i) => p.get(i));

export default function ({ test, eq, ok }) {
    test('waveargs: a list width is honoured, not coerced to NaN', () => {
        // 70% of 16 steps high.
        eq(take(PPulse(0, 4, 16, [0.7, 0.7]), 16).join(' '),
           '4 4 4 4 4 4 4 4 4 4 4 4 0 0 0 0');
    });

    test('waveargs: a plain number still behaves exactly as before', () => {
        eq(take(PPulse(0, 4, 8, 0.5), 8).join(' '), '4 4 4 4 0 0 0 0');
        eq(take(PSaw(0, 4, 4), 4).join(' '), '0 1 2 3');
    });

    test('waveargs: lo/hi can be lists, cycling per step', () => {
        eq(take(PPulse(0, [4, 9], 8, 0.5), 8).join(' '), '4 9 4 9 0 0 0 0');
    });

    test('waveargs: a width that varies actually varies the duty', () => {
        // width alternates 0.25 / 0.75, so the high region differs step to step.
        const p = PPulse(0, 1, 4, [0.25, 0.75]);
        eq(take(p, 4).join(' '), '1 1 0 0');
    });

    test('waveargs: an argument can be a pattern object', () => {
        const widening = { get: (s) => (s < 4 ? 0.25 : 0.75) };
        const p = PPulse(0, 1, 4, widening);
        eq(take(p, 8).join(' '), '1 0 0 0 1 1 1 0');
    });

    test('waveargs: steps can be a pattern, and never divides by zero', () => {
        ok(take(PSaw(0, 1, 0), 4).every(Number.isFinite), 'a zero cycle produced NaN');
        ok(take(PSine(0, 1, [8, 4]), 8).every(Number.isFinite), 'a list cycle produced NaN');
    });

    test('waveargs: nonsense falls back instead of poisoning the pattern', () => {
        // One bad element costs that step, not the whole line — a NaN reaching a
        // synth param is silence, and silence with no message is the worst outcome.
        ok(take(PPulse(0, 4, 8, ['x', 0.5]), 8).every(Number.isFinite), 'NaN leaked out');
        ok(take(PTri([null, 2], 5, 4), 4).every(Number.isFinite), 'NaN leaked out');
        ok(take(PSlide(0, 'nope', 4), 4).every(Number.isFinite), 'NaN leaked out');
    });
}
