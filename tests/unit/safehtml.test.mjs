// Peer data in innerHTML. A peer's colour went into style="…" unchecked, and the
// troop panel's escaper had no quote — either let a room member run script in
// every other browser, whatever the room rules said.
import { esc, safeColor } from '../../js/ui/safehtml.js';

export default function ({ test, eq, ok }) {
    test('safehtml: esc covers body text and both quote styles', () => {
        eq(esc(`<b>"x" & 'y'</b>`), '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
        eq(esc(null), '');
    });
    test('safehtml: an escaped value cannot close its attribute', () => {
        ok(!esc('red"><img src=x onerror=alert(1)>').includes('"'));
    });
    test('safehtml: real colours pass', () => {
        for (const c of ['#8cf', '#88ccff', '#88ccff80', 'rgb(1, 2, 3)', 'rgba(1,2,3,0.5)', 'hsl(200 50% 50%)', 'teal'])
            eq(safeColor(c), c);
    });
    test('safehtml: anything more than a colour becomes the fallback', () => {
        for (const c of ['red"><img src=x onerror=alert(1)>', 'red;background:url(//x.example/t)',
                         'url(javascript:alert(1))', 'expression(alert(1))', '#fff" onmouseover="x', '', undefined, 42])
            eq(safeColor(c), '#888', String(c));
        eq(safeColor('bad"', '#8cf'), '#8cf');
    });
}
