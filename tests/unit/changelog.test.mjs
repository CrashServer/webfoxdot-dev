// The changelog is data, and two things about it are easy to get wrong by hand:
// a version group that has grown into a dumping ground, and VERSION disagreeing
// with the newest group in it.
import { CHANGELOG, splitItem } from '../../js/ui/docs/changelog.js';
import { VERSION } from '../../js/ui/docs/reference.js';

export default function ({ test, eq, ok }) {
    test('changelog: every group has a version, a title and items', () => {
        for (const g of CHANGELOG) {
            ok(g.v, 'a group with no version');
            ok(g.title && g.title.length > 8, `${g.v}: title too thin — ${g.title}`);
            ok(Array.isArray(g.items) && g.items.length, `${g.v}: no items`);
        }
    });

    test('changelog: VERSION is the newest group', () => {
        // The toolbar badge is what someone quotes when reporting something; if it
        // names a version the changelog has no section for, there is nowhere to look.
        eq(VERSION, CHANGELOG[0].v);
    });

    test('changelog: versions are unique', () => {
        const seen = new Set();
        for (const g of CHANGELOG) { ok(!seen.has(g.v), `${g.v} appears twice`); seen.add(g.v); }
    });

    test('changelog: no group has become a dumping ground', () => {
        // dev01 reached 82 items covering six unrelated bodies of work, which is not a
        // release note, it is a pile. The cap is generous on purpose — beta11 is 50 —
        // but it is a cap.
        for (const g of CHANGELOG)
            ok(g.items.length <= 50, `${g.v} has ${g.items.length} items — time to start a new version`);
    });

    test('changelog: no entry is empty', () => {
        for (const g of CHANGELOG)
            for (const item of g.items) {
                const raw = typeof item === 'string' ? item : item.t;
                ok(raw && raw.length > 20, `${g.v}: an entry with almost nothing in it`);
            }
    });

    test('changelog: entries in the CURRENT version collapse to a headline', () => {
        // The panel shows the headline and hides the rest behind a click, so an entry
        // whose opening clause runs for 300 characters reads as a wall either way.
        //
        // Scoped to the newest group on purpose. Twenty-two older entries fail this,
        // going back to alpha28 — so it is a habit worth keeping from here rather than
        // a rule the changelog has ever held to, and rewriting years of release notes
        // to satisfy a test would be the tail wagging the dog.
        const g = CHANGELOG[0];
        for (const item of g.items) {
            const raw = typeof item === 'string' ? item : item.t;
            const { summary } = splitItem(raw);
            ok(summary.length <= 220, `${g.v}: headline is ${summary.length} chars — ${summary.slice(0, 70)}…`);
        }
    });
}
