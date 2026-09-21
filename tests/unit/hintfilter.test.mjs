// What the completion menu keeps when you type.
//
// This has failed silently three separate times, and every failure looks the same
// from the outside: the menu opens, it is full, and it never narrows — which reads
// as "autocomplete works" rather than as a bug. The rows carry decoration on both
// sides (a quote on what they insert, a status dot on what they show), so matching
// either one raw is wrong.
import { matchesTyped } from '../../js/editor/autocomplete.js';

const row = (text, display) => ({ text, displayText: display ?? text });

export default function ({ test, eq, ok }) {
    const kept = (list, typed) => list.filter(it => matchesTyped(it, typed))
                                      .map(it => it.text).join(' ');

    test('hintfilter: nothing typed keeps everything', () => {
        eq(kept([row('a'), row('b')], ''), 'a b');
        eq(kept([row('a'), row('b')], null), 'a b');
    });

    test('hintfilter: a quoted name matches on the name, not the quote', () => {
        // store("ch → chorus. The label is `chorus   · replaces this one`.
        const layouts = [row('"verse"', 'verse   · replaces this one'),
                         row('"chorus"', 'chorus   · replaces this one')];
        eq(kept(layouts, 'ch'), '"chorus"');
        eq(kept(layouts, 've'), '"verse"');
        eq(kept(layouts, 'zz'), '');
    });

    test('hintfilter: a panel matches past its status dot AND its id prefix', () => {
        const panels = [row('"wfd-editor"', '● editor   · or panel(0)'),
                        row('"wfd-galaxy"', '○ galaxy   · or panel(19)'),
                        row('"wfd-mixer"',  '○ mixer    · or panel(12)')];
        eq(kept(panels, 'gal'), '"wfd-galaxy"');
        eq(kept(panels, 'ed'), '"wfd-editor"');
        eq(kept(panels, 'mix'), '"wfd-mixer"');
        // the prefix itself is still a legitimate thing to type
        ok(matchesTyped(panels[0], 'wfd'), 'the literal id no longer matches');
    });

    test('hintfilter: matching is case-insensitive both ways', () => {
        eq(kept([row('"Synthwave"', 'Synthwave')], 'syn'), '"Synthwave"');
        eq(kept([row('"synthwave"', 'synthwave')], 'SYN'), '"synthwave"');
    });

    test('hintfilter: a param keeps matching without its =', () => {
        // Params are offered as `cutoff=` and you type `cut`.
        ok(matchesTyped(row('cutoff='), 'cut'), 'param names stopped matching');
        ok(!matchesTyped(row('cutoff='), 'off'), 'matching is a prefix, not a search');
    });
}
