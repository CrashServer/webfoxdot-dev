// The transpiler, including every line that used to come out wrong.
import { transpile, applyRenames } from '../../js/editor/transpiler.js';

const js = (src) => applyRenames(transpile(src));
const valid = (src) => { try { new Function(js(src)); return true; } catch (_) { return false; } };

export default function ({ test, eq, ok }) {
    test('transpiler: the shapes that must keep working', () => {
        const LINES = [
            'p1 >> pluck([0,2,4], dur=1/2)', 'b1 >> play("x-o-")', 'b1 >> play("x.<o->")',
            'p1 >> pluck({0,2,4})', 'p1 >> pluck(P[0,[4,2]])', 'p1 >> pluck(PWhite(0,7)[:8])',
            'p1 >> pluck(PChain({0:[1,2]}))', 'x = 1 << 2', 'if (Clock.now() > 4) { print(1) }',
            'p2 >> pluck([0]).follow(p1)', 'p1.lpf = linvar([200,2000],[8])',
            'i9 >> faim(b1.degree + 2)', '~d1 >> dbass([0])', 'p1 >> pluck([0,2]) + 12',
            'p1 >> pluck([0, ., _, rest, 4])', 'p1.every(4, "stutter", mverb=0.5)',
        ];
        for (const l of LINES) ok(valid(l), `did not produce valid JS: ${l}\n      -> ${js(l)}`);
    });

    test('transpiler: a string is never rewritten from the inside', () => {
        // Eleven of the fourteen scanners used to be blind to escapes, so the CONTENTS
        // of a string were rewritten by whichever pass happened not to see it.
        const KEEP = [
            ['p1 >> pluck([0], text="q\\" <b> c")',   '<b>'],
            ['p1 >> pluck([0], text="q\\" {a,b} c")', '{a,b}'],
            ['p1 >> pluck([0], text="q\\" x[1:2]")',  'x[1:2]'],
            ['p1 >> pluck([0], text=`x{a,b}y`)',      '{a,b}'],
            ['Server.log("P[1,2]")',                  'P[1,2]'],
            ['Server.log("p1.stop()")',               'p1.stop()'],
            ['Server.log(".follow(p1)")',             '.follow(p1)'],
        ];
        for (const [src, must] of KEEP) ok(js(src).includes(must), `${src}\n      -> ${js(src)}`);
    });

    test('transpiler: an escaped quote before a # is still a comment', () => {
        // This one produced INVALID JS: the string ended a character early, so the
        // '#' looked quoted and went through into the JavaScript.
        const out = js('p1 >> pluck([0], text="a\\"b") # tail');
        ok(valid('p1 >> pluck([0], text="a\\"b") # tail'), `not valid JS: ${out}`);
        ok(out.includes('//'), 'the comment was not converted');
    });

    test('transpiler: aud()/midi() arithmetic becomes Pmath, not NaN', () => {
        // A missing name here is not a syntax error you would notice, it is silence.
        for (const fn of ['aud', 'midi', 'mlearn', 'lininf', 'expinf']) {
            const out = js(`d1 >> dbass([0], amp=${fn}('bass',1,50) * 1)`);
            ok(out.includes('Pmath'), `${fn}(…) * 1 was not wrapped: ${out}`);
        }
    });

    test('transpiler: obj.P[0] is a member access, not FoxDot P', () => {
        eq(js('x = obj.P[0]').trim(), 'x = obj.P[0]');
    });
    // Players only exist as __p('p1'); a bare p1 in sample(src=p1) threw "p1 is not
    // defined". It is passed as a name instead — and only there.
    test('transpiler: sample(src=p1) passes the player by name', () => {
        ok(js('sample("s", 2, src=p1)').includes(`{src: 'p1'}`));
        ok(js('sample("s", 2, src="in")').includes(`{src: "in"}`));
        ok(js('foo(src=p1)').includes('{src: p1}'), 'another call changed meaning');
        ok(js('resample(src=p1)').includes('{src: p1}'), 'a name ending in sample matched');
    });
    // applyRenames masks strings over the whole block, and an apostrophe in a
    // comment opened a "string" to the next one: the lines between kept a bare
    // sinvar( and failed with "sinvar is not defined". Found by running the MIDI docs.
    test('transpiler: apostrophes in comments do not hide var/linvar/sinvar', () => {
        const out = js("a = 1   # the nano's CC7\np1 >> pluck([0], amp=sinvar([0.2, 0.8], 8), dur=linvar([1, 2], 4))\nb = 2   # it's done");
        ok(out.includes('_sinvar(') && out.includes('_linvar('), out);
        ok(!/[^_]sinvar\(/.test(out), out);
    });
    test('transpiler: a // inside a string is still part of the string', () => {
        ok(js('loadpack("https://x.org/p.json")  # a url\'s slashes').includes('"https://x.org/p.json"'));
    });

    // // is floor division in Python and a comment in JS: x = 7 // 2 ran as x = 7.
    test('transpiler: // is floor division, with Python\'s signs', () => {
        for (const [src, want] of [['7 // 2', 3], ['-7 // 2', -4], ['7 // -2', -4], ['3 - 7 // 2', 0], ['(1+8) // 2', 4]]) {
            const out = js('y = ' + src).replace(/^y = /, 'return ');
            eq(new Function(out)(), want, src + ' → ' + out);
        }
        ok(valid('p1 >> pluck([0, 2], dur=8//3)'));
        ok(valid('p1 >> pluck([0], dur=1/2).every(4, "stutter", 8//4)'));
    });
}
