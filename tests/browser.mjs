#!/usr/bin/env node
// tests/browser.mjs — the checks that need a real page.
//
//   ./serve.py &                         (or any server on 127.0.0.1:8765)
//   node tests/browser.mjs
//
// Separate from tests/run.mjs because it needs chromium, and because a suite that
// cannot run without one is a suite that stops being run. These are the things a
// node process genuinely cannot check: a shader that has to compile on a real GL
// context, a panel that has to track a pointer, a page that has to boot.
//
// It always launches MUTED and with its own profile, and shuts the browser down at
// the end — a test browser left running is audible, and has turned up in a live
// session's peer list before now.

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.WFD_URL || 'http://127.0.0.1:8765';
const PORT = 9440 + (process.pid % 90);
const profile = mkdtempSync(join(tmpdir(), 'wfd-test-'));

const chrome = spawn('chromium', [
    '--headless=new', `--remote-debugging-port=${PORT}`, '--mute-audio', '--no-sandbox',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    `--user-data-dir=${profile}`, '--window-size=1400,900', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const T = (name, cond, extra = '') => {
    if (cond) { pass++; console.log(`  ok    ${name}`); }
    else { fail++; console.log(`  FAIL  ${name}${extra ? '\n        ' + extra : ''}`); }
};

async function main() {
    const { connect } = await import('./browser/cdp.mjs');
    let b = null;
    for (let i = 0; i < 25 && !b; i++) { try { b = await connect(PORT); } catch (_) { await sleep(400); } }
    if (!b) throw new Error('chromium did not come up');

    for (const [label, url] of [['classic', BASE + '/index.html'],
                                ['desktop', BASE + '/index.html?ui=desktop'],
                                ['pop-out', BASE + '/visuals.html']]) {
        const p = await b.page(url + (url.includes('?') ? '&' : '?') + 'cb=' + Math.random());
        await sleep(8000);
        const bad = p.problems().filter(e => !/favicon|AudioContext|Autoplay|WebGL2/i.test(e.text));
        T(`${label} boots with no console errors`, bad.length === 0, bad.map(e => e.text).join(' | ').slice(0, 300));
    }

    const p = await b.page(BASE + '/index.html?cb=' + Math.random());
    await sleep(8000);

    const shader = await p.evaluate(`(async () => {
        const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
        if (!cv.getContext('webgl2')) return 'no webgl2';
        const M = await import('/js/visuals/render/gl/renderer.js');
        try { return M.createGLRenderer(cv) ? 'ok' : 'null'; } catch (e) { return 'THREW: ' + e.message; }
    })()`);
    T('the GL scene + present programs compile and link', shader === 'ok', String(shader));

    const drags = JSON.parse(await p.evaluate(`(async () => {
        const res = {};
        const mods = [['mixer','/js/ui/mixer.js','toggleMixer','#mixer-modal','.mixer-head'],
                      ['piano','/js/ui/piano.js','togglePiano','#piano-modal','.piano-head'],
                      ['parts','/js/ui/partspanel.js','toggleParts','#parts-modal','.parts-head'],
                      ['rules','/js/ui/rulespanel.js','toggleRules','#rules-modal','.rules-head'],
                      ['modular','/js/ui/modular.js','toggleModular','#modular-panel','.modular-head']];
        const mk = (t,x,y) => new PointerEvent(t,{clientX:x,clientY:y,bubbles:true,pointerId:1,isPrimary:true});
        for (const [n, mod, tog, sel, hs] of mods) {
            const m = await import(mod); m[tog](); await new Promise(r => setTimeout(r, 300));
            let el = document.querySelector(sel);
            if (el && el.classList.contains('hidden')) { m[tog](); await new Promise(r => setTimeout(r, 300)); el = document.querySelector(sel); }
            const head = el && el.querySelector(hs);
            if (!el || !head || !el.getBoundingClientRect().width) { res[n] = -1; continue; }
            const r0 = el.getBoundingClientRect();
            head.dispatchEvent(mk('pointerdown', r0.left + 40, r0.top + 6));
            let worst = 0;
            for (let i = 1; i <= 10; i++) { const cx = r0.left + 40 + i * 9, cy = r0.top + 6 + i * 6;
                window.dispatchEvent(mk('pointermove', cx, cy));
                const r = el.getBoundingClientRect();
                worst = Math.max(worst, Math.abs((r.left - r0.left) - i * 9), Math.abs((r.top - r0.top) - i * 6)); }
            window.dispatchEvent(mk('pointerup', r0.left + 130, r0.top + 66));
            res[n] = worst;
        }
        return JSON.stringify(res);
    })()`));
    for (const [n, worst] of Object.entries(drags))
        T(`the ${n} panel tracks the pointer exactly`, worst === 0, `off by ${worst}px`);

    const scale = await p.evaluate(`(async () => {
        const M = await import('/js/ui/uiscale.js');
        // A single BUTTON, not the toolbar: the bar wraps to more rows as things grow,
        // so its height climbs faster than the scale and says nothing useful.
        const btn = document.getElementById('btn-run') || document.querySelector('button');
        const h = () => btn.getBoundingClientRect().height;
        const a = h(); M.setUiScale(1.5); const c = h(); M.setUiScale(1);
        return JSON.stringify({ ratio: c / a, back: Math.abs(h() - a) < 0.5 });
    })()`);
    const { ratio, back } = JSON.parse(scale);
    T('uisize scales the interface', Math.abs(ratio - 1.5) < 0.06, `grew ${ratio.toFixed(2)}x, expected 1.5`);
    T('uisize(1) puts it back exactly', back);

    b.close();
    console.log(`\n  ${pass} passed, ${fail} failed`);
}

try { await main(); }
catch (e) { console.log('  ERROR ' + e.message); fail++; }
finally {
    chrome.kill();
    await sleep(500);
    try { rmSync(profile, { recursive: true, force: true }); } catch (_) {}
}
process.exit(fail ? 1 : 0);
