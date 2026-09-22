// lookahead(ms) — the slack, and the fact that it is a trade.
//
// The export is a `let` so that changing it here changes it for player.js too:
// an ES module export is a live binding. If that ever became a `const` copy, the
// clock would dispatch on the new value while the players kept using the old one,
// and the two would disagree about when a note is due — silently.
import { LOOKAHEAD_S, setLookahead } from '../../js/engine/clock.js';

export default function ({ test, eq, ok }) {
    test('lookahead: the default is the documented 120ms', () => {
        eq(Math.round(LOOKAHEAD_S * 1000), 120);
    });

    test('lookahead: setting it moves the live binding', () => {
        setLookahead(0.3);
        eq(Math.round(LOOKAHEAD_S * 1000), 300, 'importers must see the new value');
        setLookahead(0.12);
        eq(Math.round(LOOKAHEAD_S * 1000), 120);
    });

    test('lookahead: clamped to a range that keeps the current architecture true', () => {
        // The ceiling is below the transport's 0.5s bypass window: past it, bundles
        // would sit in the prescheduler worker instead of going to scsynth, which is
        // where cancellation becomes necessary — and it is not wired.
        eq(setLookahead(9), 0.45);
        eq(setLookahead(0), 0.02);
        eq(setLookahead(-1), 0.02);
        setLookahead(0.12);
    });

    test('lookahead: nonsense leaves it alone', () => {
        setLookahead(0.2);
        eq(setLookahead('abc'), 0.2);
        eq(setLookahead(NaN), 0.2);
        eq(setLookahead(undefined), 0.2);
        setLookahead(0.12);
        eq(Math.round(LOOKAHEAD_S * 1000), 120);
    });
}
