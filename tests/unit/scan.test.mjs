// The one string-aware scanner. Every case here is a line that was mis-parsed
// before js/editor/scan.js existed — see the commit that introduced it.
import { matchBracket, topArgs, splitArgs, skipString } from '../../js/editor/scan.js';

export default function ({ test, eq, ok }) {
    const CASES = [
        ['plain',                 'p1 >> pluck([0,2,4], dur=1/2)',            2],
        ['comma in a play string','b1 >> play("x,o", sample=1)',              2],
        ['arrow function',        'p1 >> pluck([0,2], amp=(x)=>x*2)',         2],
        ['> inside a string',     'p1 >> pluck([0], text="a>b", amp=1)',      3],
        ['< inside a string',     'p1 >> pluck([0], text="a<b", amp=1)',      3],
        ['alternation is a bracket','p1 >> pluck(<0 4>, dur=1)',              2],
        ['>= comparison',         'p1 >> pluck([0,2], amp=x>=1?0.5:0.2)',     2],
        ['escaped quotes',        'p1 >> pluck([0], t="he said \\"hi\\"", a=1)', 3],
        ['nested alternation',    'p1 >> pluck(P[0,<2 4>], dur=1/4)',         2],
        ['braces in a string',    'p1 >> pluck([0], text="{a,b}", amp=1)',    3],
        ['backtick string',       'p1 >> pluck([0], text=`x,y`, amp=1)',      3],
    ];
    for (const [label, line, want] of CASES) {
        test(`scan: ${label}`, () => {
            const o = line.indexOf('(');
            const c = matchBracket(line, o, true);
            eq(c, line.length - 1, 'closing bracket');
            eq(topArgs(line, o, c).length, want, 'argument count');
        });
    }
    test('scan: skipString handles escapes and is not fooled by the other quotes', () => {
        eq(skipString('"a\\"b" tail', 0), 6);
        eq(skipString("'a\"b' tail", 0), 5);
        eq(skipString('`a${1}b` tail', 0), 8);
    });
    test('scan: an unterminated string still makes progress', () => {
        const s = '"never closed';
        eq(skipString(s, 0), s.length);
    });
    test('scan: splitArgs keeps strings whole', () => {
        eq(splitArgs('1, "a,b", [2,3]').length, 3);
        eq(splitArgs('"x"').length, 1);
    });
    test('scan: an unmatched bracket reports -1 rather than guessing', () => {
        eq(matchBracket('foo(1, 2', 3, true), -1);
    });
}
