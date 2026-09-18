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

    // The caret has to stay ON its character at every size. CodeMirror positions it
    // from cached offsetLeft (unzoomed) against a getBoundingClientRect (scaled), so
    // inside a `zoom` the two drift apart in proportion to how far along the line you
    // are — 67px at 1.3, 165px at 1.6, and refresh() cannot help.
    const caret = JSON.parse(await p.evaluate(`(async () => {
        const M = await import('/js/ui/uiscale.js');
        const cm = document.querySelector('.CodeMirror').CodeMirror;
        cm.setValue('0123456789abcdefghijklmnopqrstuvwxyz');
        const out = [];
        for (const s of [1, 1.3, 1.6]) {
            M.setUiScale(s);
            await new Promise(r => setTimeout(r, 400));
            cm.setCursor({ line: 0, ch: 20 }); cm.focus();
            await new Promise(r => setTimeout(r, 150));
            const el = document.querySelector('.CodeMirror-cursor');
            const ch = cm.charCoords({ line: 0, ch: 20 }, 'window');
            const w = cm.charCoords({ line: 0, ch: 1 }, 'window').left - cm.charCoords({ line: 0, ch: 0 }, 'window').left;
            out.push({ s, gap: Math.abs(el.getBoundingClientRect().left - ch.left), charWidth: w });
        }
        M.setUiScale(1);
        return JSON.stringify(out);
    })()`));
    for (const c of caret)
        T(`the caret sits on its character at uisize ${c.s}`, c.gap < 2, `${c.gap.toFixed(1)}px away`);
    const grew = caret[2].charWidth / caret[0].charWidth;
    T('the editor text actually grows with the interface', Math.abs(grew - 1.6) < 0.1,
      `characters grew ${grew.toFixed(2)}x, expected 1.6`);

    // ── a set as a file ──────────────────────────────────────────────────────
    const drop = JSON.parse(await p.evaluate(`(async () => {
        const file = new File(['# from disk\\np1 >> pluck([0,2,4])\\n'], 'a_track.py', { type: 'text/plain' });
        const dt = new DataTransfer(); dt.items.add(file);
        const wrap = document.getElementById('editor-wrap');
        wrap.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
        const hinted = wrap.classList.contains('wfd-drop');
        wrap.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
        await new Promise(r => setTimeout(r, 600));
        return JSON.stringify({ hinted, text: document.querySelector('.CodeMirror').CodeMirror.getValue() });
    })()`));
    T('dragging a file onto the editor says it will take it', drop.hinted);
    T('dropping a set opens it', drop.text.includes('p1 >> pluck([0,2,4])'), drop.text.slice(0, 60));

    const save = JSON.parse(await p.evaluate(`(async () => {
        const M = await import('/js/ui/setfile.js');
        // the no-picker path, which is what non-Chromium browsers take
        const real = window.showSaveFilePicker; delete window.showSaveFilePicker;
        let captured = null;
        const click = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () { captured = this.download; };
        document.querySelector('.CodeMirror').CodeMirror.setValue('p1 >> pluck([0,4,7])\\n');
        const ok = await M.saveSet();
        HTMLAnchorElement.prototype.click = click;
        // an empty buffer is not a file
        document.querySelector('.CodeMirror').CodeMirror.setValue('   ');
        const empty = await M.saveSet();
        // a dismissed picker is an answer, not a failure — with something TO save,
        // or the empty-buffer guard answers first and this measures that instead
        document.querySelector('.CodeMirror').CodeMirror.setValue('p1 >> pluck([0])\\n');
        window.showSaveFilePicker = () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' }));
        const n0 = document.querySelectorAll('#log div').length;
        const aborted = await M.saveSet({ saveAs: true });
        const noise = document.querySelectorAll('#log div').length - n0;
        if (real) window.showSaveFilePicker = real; else delete window.showSaveFilePicker;
        return JSON.stringify({ ok, captured, empty, aborted, noise });
    })()`));
    T('saving without a picker downloads a named file', save.ok && /\.py$/.test(save.captured || ''), String(save.captured));
    T('an empty buffer is not saved', save.empty === false);
    T('a dismissed save dialog says nothing', save.aborted === false && save.noise === 0, `${save.noise} log lines`);

    // ── the scene contact sheet ──────────────────────────────────────────────
    const sheet = JSON.parse(await p.evaluate(`(async () => {
        document.getElementById('btn-scenes').click();
        await new Promise(r => setTimeout(r, 600));
        const i = document.querySelector('.scenes-filter');
        i.value = 'ikeda'; i.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 5000));
        const M = await import('/js/ui/scenebrowser.js');
        return JSON.stringify(M._diag());
    })()`));
    T('the scene sheet draws every visible tile', sheet.cells > 0 && sheet.drawn === sheet.cells,
      `${sheet.drawn} of ${sheet.cells} drawn`);
    T('no scene fails while drawing its thumbnail', sheet.dead === 0, `${sheet.dead} failed`);

    await p.close();
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
