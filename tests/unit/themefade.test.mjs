// The colour parsing behind theme("paper", 2).
//
// A palette entry that fails to parse is not an error anywhere — it is simply left
// out of the glide, so that one colour snaps while the rest move. That is quiet
// enough to ship unnoticed, which is why the parser is tested against every form the
// stylesheet actually uses: #rrggbb for the solid colours and rgba(…) for the glows.
import { parseColor } from '../../js/ui/themefade.js';

export default function ({ test, eq, ok }) {
    const p = (s) => JSON.stringify(parseColor(s));

    test('themefade: hex, in every length', () => {
        eq(p('#0a0c10'), '[10,12,16,1]');
        eq(p('#FFF'), '[255,255,255,1]');
        eq(p('#0a0c1080'), '[10,12,16,0.5019607843137255]');
        eq(p('#f00c'), '[255,0,0,0.8]');
    });

    test('themefade: rgb and rgba, comma or space separated', () => {
        eq(p('rgb(63,185,80)'), '[63,185,80,1]');
        eq(p('rgba(63, 185, 80, 0.35)'), '[63,185,80,0.35]');
        eq(p('rgb(63 185 80 / 40%)'), '[63,185,80,0.4]');
    });

    test('themefade: whitespace and case are what getPropertyValue hands back', () => {
        // Custom properties come back as written, leading space and all.
        eq(p('  #0A0C10 '), '[10,12,16,1]');
    });

    test('themefade: a length is not a colour', () => {
        // --cp-width: 240px lives in the same block and must be skipped, not glided.
        eq(p('240px'), 'null');
        eq(p(''), 'null');
        eq(p(null), 'null');
        eq(p('#12345'), 'null');
        eq(p('rgb(1,2)'), 'null');
    });

    test('themefade: every palette colour in the stylesheet parses', async () => {
        // The real guard: read the actual CSS and check nothing in it would snap.
        const { readFileSync } = await import('node:fs');
        const css = readFileSync(new URL('../../css/style.css', import.meta.url), 'utf8');
        const bad = [];
        for (const m of css.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]+);/gm)) {
            const [, name, raw] = m;
            const v = raw.trim();
            if (!/^(#|rgba?\()/.test(v)) continue;     // not meant to be a colour
            if (!parseColor(v)) bad.push(`${name}: ${v}`);
        }
        eq(bad.join(' | '), '', `palette entries that would snap: ${bad.join(', ')}`);
    });
}
