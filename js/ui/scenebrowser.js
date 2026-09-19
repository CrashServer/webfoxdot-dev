// scenebrowser.js — a contact sheet for the 243 scenes.
//
// crashDot ships 49 field scenes and 194 workshop layers, and until now the only way
// to find out what `truchettiles` or `gyroidslice` or `hitomezashi` looked like was
// to type it into a live mix and watch. The names do not help and there are 255 of
// them, so in practice everyone used the same dozen they happened to remember.
//
// ── How it renders ───────────────────────────────────────────────────────────
// A workshop layer is an imperative draw — draw(ctx, w, h, params, t, extra) — so a
// thumbnail is just that call against a small 2D canvas. A field scene is a shader,
// so those go through ONE shared GL renderer: render scene N into it, blit the result
// into thumbnail N, move on. One GL context for the whole sheet rather than 49.
//
// ROUND-ROBIN, not all-at-once. 255 thumbnails redrawn every frame would be a far
// heavier picture than anything the mixer ever puts on screen, on the thread the note
// scheduler runs on. Each tick draws a handful, in order, so the sheet develops like
// a contact print and the cost per tick stays flat whether you are showing twelve
// scenes or two hundred. Only what is actually scrolled into view is drawn at all.
//
// On a TIMER rather than requestAnimationFrame, deliberately. rAF exists to align
// with the compositor, which is worth having for the mix you are performing and
// worth nothing for a sheet of thumbnails refreshing a few times a second — and it
// puts this on the same callback path as the surfaces the audio clock shares a
// thread with. A slow sheet should not be scheduled like a fast picture.

import { SCENES as FIELD_SCENES } from '../visuals/vdata.js';
import { WORKSHOP_NAMES, defaults as wsDefaults } from '../visuals/workshop/catalog.js';
import { draggable } from './dragpanel.js';

const THUMB_W = 132, THUMB_H = 84;
const PER_TICK = 3;           // thumbnails advanced per animation frame
const FPS = 12;               // the sheet does not need to be smooth, only alive

let _modal = null, _open = false, _grid = null, _filter = null, _count = null;
let _insert = null, _log = null;
let _timer = null, _t0 = 0, _cursor = 0;
let _cells = [];              // { name, kind, canvas, ctx, el, drawn }
let _gl = null, _glCanvas = null, _wsLayers = null;

export function initSceneBrowser({ insert, log } = {}) { _insert = insert; _log = log; }

const ALL = () => [
    ...FIELD_SCENES.map(n => ({ name: n, kind: 'field' })),
    ...WORKSHOP_NAMES.filter(n => !FIELD_SCENES.includes(n)).map(n => ({ name: n, kind: 'layer' })),
];

function build() {
    _modal = document.createElement('div');
    _modal.id = 'scenes-modal';
    _modal.className = 'hidden';
    _modal.innerHTML = `
        <div class="scenes-head">
            <span class="scenes-title">▦ scenes</span>
            <input type="search" class="scenes-filter" placeholder="filter…" spellcheck="false">
            <span class="scenes-count"></span>
            <button class="scenes-close" title="close">✕</button>
        </div>
        <div class="scenes-grid"></div>
        <div class="scenes-hint">click a tile to write its line · shift-click to write it on ch=1</div>`;
    document.body.appendChild(_modal);
    _grid   = _modal.querySelector('.scenes-grid');
    _filter = _modal.querySelector('.scenes-filter');
    _count  = _modal.querySelector('.scenes-count');
    _modal.querySelector('.scenes-close').onclick = closeSceneBrowser;
    _filter.addEventListener('input', () => populate(_filter.value));
    _filter.addEventListener('keydown', (e) => { if (e.key === 'Escape') { _filter.value = ''; populate(''); } });
    draggable(_modal.querySelector('.scenes-head'), _modal, 'button, input');
    populate('');
}

function populate(q) {
    const s = String(q || '').trim().toLowerCase();
    const list = ALL().filter(x => !s || x.name.includes(s));
    _grid.innerHTML = '';
    _cells = list.map(({ name, kind }) => {
        const el = document.createElement('div');
        el.className = 'scene-cell';
        el.title = `${name} — ${kind === 'field' ? 'field scene (shader)' : 'workshop layer'}\nclick to write video1 >> ${name}()`;
        const canvas = document.createElement('canvas');
        canvas.width = THUMB_W; canvas.height = THUMB_H;
        const label = document.createElement('div');
        label.className = 'scene-name'; label.textContent = name;
        el.appendChild(canvas); el.appendChild(label);
        el.addEventListener('click', (e) => {
            const line = `video1 >> ${name}(${e.shiftKey ? 'ch=1' : ''})`;
            if (_insert) _insert(line);
            else if (_log) _log(line, 'info');
        });
        _grid.appendChild(el);
        return { name, kind, canvas, ctx: canvas.getContext('2d'), el, drawn: false };
    });
    _count.textContent = `${_cells.length} / ${ALL().length}`;
    _cursor = 0;
}

// Only draw what someone can actually see. With 255 tiles the sheet is several
// screens tall, and rendering the ones scrolled past is work nobody asked for.
function visible(cell) {
    const r = cell.el.getBoundingClientRect(), g = _grid.getBoundingClientRect();
    return r.bottom > g.top - 80 && r.top < g.bottom + 80;
}

async function ensureWorkshop() {
    if (_wsLayers) return _wsLayers;
    // The layer registry is 1.6MB and is loaded on demand everywhere else too —
    // opening the sheet is exactly the moment it becomes worth having.
    const m = await import('../visuals/workshop/index.js');
    _wsLayers = m.WORKSHOP_LAYERS;
    return _wsLayers;
}

function ensureGL() {
    if (_gl !== null) return _gl;
    try {
        _glCanvas = document.createElement('canvas');
        _glCanvas.width = THUMB_W; _glCanvas.height = THUMB_H;
        // Imported here rather than at module load: a session that never opens the
        // sheet should not pay for the shader source or the program build.
        _gl = _glMod ? _glMod.createGLRenderer(_glCanvas) : null;
    } catch (_) { _gl = null; }
    return _gl;
}
let _glMod = null;

const AUD = { bass: 0.35, mid: 0.3, treble: 0.25, level: 0.35, spectrum: new Array(64).fill(0).map((_, i) => 0.55 / (1 + i * 0.06)) };
const NEUTRAL_FX = { sat: 1, exposure: 1, contrast: 1, ceiling: 1, lutmix: 1, invert: false };

function drawCell(cell, t) {
    if (cell.kind === 'layer') {
        const kinds = _wsLayers;
        const k = kinds && kinds[cell.name];
        if (!k) return;
        try { k.draw(cell.ctx, THUMB_W, THUMB_H, wsDefaults(cell.name), t, { spectrum: AUD.spectrum, message: null, live: null }); }
        catch (_) { markDead(cell); }
        cell.drawn = true;
        return;
    }
    const gl = ensureGL();
    if (!gl) return;
    try {
        // One shared context: render the scene, then copy it out before the next one
        // overwrites it. preserveDrawingBuffer is false, so the copy has to happen now.
        gl.render({ layers: [{ name: 'thumb', scene: cell.name, ch: 0, params: {}, fx: {} }],
                    mix: null, palette: null, mode: 'smooth', res: null }, t, AUD, NEUTRAL_FX);
        cell.ctx.drawImage(_glCanvas, 0, 0, THUMB_W, THUMB_H);
        cell.drawn = true;
    } catch (_) { markDead(cell); }
}

function markDead(cell) {
    cell.el.classList.add('scene-dead');
    cell.drawn = true;
}

function tick() {
    if (!_open || !_cells.length) return;
    if (!_t0) _t0 = performance.now();
    const t = (performance.now() - _t0) / 1000;
    tick._ticks = (tick._ticks || 0) + 1;
    // Walk forward from the cursor until PER_TICK visible cells have been drawn, or
    // the whole list has been looked at once — so a sheet scrolled to the bottom does
    // not spin over two hundred off-screen tiles looking for work.
    let done = 0, n = 0;
    for (; n < _cells.length && done < PER_TICK; n++) {
        const cell = _cells[(_cursor + n) % _cells.length];
        if (!visible(cell)) continue;
        drawCell(cell, t);
        tick._draws = (tick._draws || 0) + 1;
        done++;
    }
    _cursor = (_cursor + n) % _cells.length;
}

export async function openSceneBrowser() {
    if (!_modal) build();
    _open = true;
    _modal.classList.remove('hidden');
    if (!_glMod) { try { _glMod = await import('../visuals/render/gl/renderer.js'); } catch (_) {} }
    await ensureWorkshop();
    _t0 = 0;
    if (!_timer) _timer = setInterval(tick, Math.round(1000 / FPS));
    _filter?.focus();
}
export function closeSceneBrowser() {
    _open = false;
    if (_modal) _modal.classList.add('hidden');
    if (_timer) { clearInterval(_timer); _timer = null; }
}
export function toggleSceneBrowser() { _open ? closeSceneBrowser() : openSceneBrowser(); }
export function isSceneBrowserOpen() { return _open; }
/** Counters, for tests/browser.mjs and for working out why a sheet is not developing. */
export function _diag() {
    return { open: _open, cells: _cells.length, cursor: _cursor,
             drawn: _cells.filter(c => c.drawn).length, dead: _cells.filter(c => c.el.classList.contains('scene-dead')).length,
             gl: !!_gl, glMod: !!_glMod, ws: _wsLayers ? Object.keys(_wsLayers).length : 0,
             ticks: tick._ticks || 0, draws: tick._draws || 0, running: !!_timer };
}
