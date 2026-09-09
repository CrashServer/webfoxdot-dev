// Modular synth builder — a non-modal floating panel (mixer.js precedent):
// drag blocks from the palette, wire ports with cables, watch the generated
// JS source update live in the side pane, hit Define to compile it through
// the real defsynth() (js/scsynth/defsynth.js) — same pipeline a hand-typed
// synth uses, nothing new needed there. See js/modular/{graph,blocks,codegen}.js.
//
// Cable geometry is computed from node.x/node.y + fixed per-block layout
// constants (HEADER_H/ROW_H, matched in the CSS), not measured off the DOM —
// keeps port positions deterministic and cheap to recompute on every drag.

import { makeGraph, addNode, removeNode, connect, disconnect, edgeInto, duplicateNodes, toJSON, fromJSON } from '../modular/graph.js';
import { makeUndoStack } from './undostack.js';
import { BLOCKS, blockDef, defaultParams, knobSpec } from '../modular/blocks.js';
import { makeKnob } from './knob.js';
import { playSynthNote } from '../engine/player.js';
import { generateSource, compileAndDefine } from '../modular/codegen.js';
import { TEMPLATES } from '../modular/templates.js';
import { draggable } from './dragpanel.js';

const BLOCK_W = 180, HEADER_H = 26, ROW_H = 22;
const CANVAS_W = 2400, CANVAS_H = 1400;
const STORAGE_KEY = 'wfd-modular-patch';

let _graph = makeGraph();
let _logFn = null, _insertFn = null;
let _panel = null, _wrapEl = null, _sizerEl = null, _canvasEl = null, _svgEl = null, _codeEl = null, _statusEl = null, _hintEl = null, _nameInput = null, _fileInput = null, _zoomValEl = null, _liveBadge = null;
let _open = false;
let _wireDrag = null;   // { fromNode, fromPort, x, y } — clientX/Y of an in-progress cable drag
let _nodeDrag = null;   // { node, sx, sy, ox, oy } — in-progress block drag
let _lastDefined = null; // { name, extraParams } from the most recent successful Define
let _liveMode = false;   // once true, every graph edit re-Defines _lastDefined.name automatically
let _liveTimer = null;   // debounce handle for scheduleLiveRedefine()
const LIVE_REDEFINE_MS = 200;
let _zoom = 1;
const ZOOM_MIN = 0.4, ZOOM_MAX = 2;

// ── Selection ───────────────────────────────────────────────────────────────
// Node ids, not node objects: undo restores the graph by re-parsing JSON, so
// every node object is replaced and a set of stale references would silently
// select nothing.
let _selection = new Set();
let _band = null;        // { x0, y0, x1, y1 } in canvas coords — rubber-band drag

// ── Undo ────────────────────────────────────────────────────────────────────
// Whole-graph JSON snapshots rather than a command log. The graph is small
// (tens of nodes) and this cannot drift out of step with the model the way a
// hand-written inverse for each of a dozen mutations eventually would.
// (the stack itself lives in js/ui/undostack.js — see _history below)

// insertFn(code): pastes a line into the main editor (mirrors chaos()'s
// paste-don't-run convention) — used by the "use it" button.
export function initModular(logFn, insertFn) {
    _logFn = logFn || null;
    _insertFn = insertFn || null;   // (text, { run }) — run:false pastes without evaluating
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) _graph = fromJSON(saved);
    } catch (_) {}
}

function persist() { try { localStorage.setItem(STORAGE_KEY, toJSON(_graph)); } catch (_) {} }

// Undo over the whole graph. restore() also prunes the selection: ids survive a
// round-trip through JSON, so a selection made before the undo still points at
// real nodes — but any node the undo removed has to go, or Delete would try to
// remove something that is no longer there.
const _history = makeUndoStack({
    capture: () => toJSON(_graph),
    restore: (json) => {
        _graph = fromJSON(json);
        const live = new Set(_graph.nodes.map(n => n.id));
        _selection = new Set([..._selection].filter(id => live.has(id)));
        afterStructuralChange();
    },
});
function snapshot(label, key) { if (_history.snapshot(label, key)) updateUndoButtons(); }
function undo() { const l = _history.undo(); setStatus(l ? '↶ ' + l : 'nothing to undo', 'info'); updateUndoButtons(); }
function redo() { const l = _history.redo(); setStatus(l ? '↷ ' + l : 'nothing to redo', 'info'); updateUndoButtons(); }

function updateUndoButtons() {
    if (!_panel) return;
    const u = _panel.querySelector('.modular-undo'), r = _panel.querySelector('.modular-redo');
    if (u) { u.disabled = !_history.canUndo(); u.title = _history.canUndo() ? `undo ${_history.peekUndo()}  (Ctrl+Z)` : 'nothing to undo'; }
    if (r) { r.disabled = !_history.canRedo(); r.title = _history.canRedo() ? `redo ${_history.peekRedo()}  (Ctrl+Shift+Z)` : 'nothing to redo'; }
}

function afterStructuralChange() {
    persist();
    if (_panel) { renderBlocks(); renderCables(); updateCodePreview(); }
    scheduleLiveRedefine();
}
function afterParamChange() {
    persist();
    if (_panel) updateCodePreview();
    scheduleLiveRedefine();
}

// Once live mode is on (flipped by a successful Define — see onDefine()),
// every subsequent graph edit re-compiles and re-registers the SAME synth
// name automatically: defsynth() is the app's normal live-redefinition path
// already (editing a hand-typed defsynth() and re-running it does exactly
// this), so nothing new is needed engine-side — just call it again here.
// Debounced since afterParamChange() fires on every number-input keystroke.
// Already-sounding notes keep their original definition (standard SC
// synth-redefinition semantics); the NEXT triggered note picks up the edit.
function scheduleLiveRedefine() {
    if (!_liveMode || !_lastDefined) return;
    clearTimeout(_liveTimer);
    _liveTimer = setTimeout(async () => {
        const name = _lastDefined.name;
        try {
            const { extraParams, warnings } = await compileAndDefine(name, _graph);
            _lastDefined = { name, extraParams };
            const warn = warnings && warnings.length ? '  ⚠ ' + warnings.join('  ·  ') : '';
            setStatus(`✓ "${name}" live-updated${warn}`, warn ? 'warn' : 'ok');
        } catch (e) {
            setStatus(`✗ live update: ${e.message}`, 'error');
        }
    }, LIVE_REDEFINE_MS);
}

// A template load / clear / file load replaces the patch with something
// unrelated to whatever was last Defined — keep auto-redefining the OLD
// name across that would silently rewrite a synth that might still be
// sounding elsewhere in the composition under its old identity.
function endLiveMode() {
    clearTimeout(_liveTimer);
    _liveMode = false;
    _lastDefined = null;
    updateLiveBadge();
}
function updateLiveBadge() {
    if (!_liveBadge) return;
    _liveBadge.classList.toggle('on', _liveMode);
    _liveBadge.title = _liveMode
        ? 'live: graph edits auto-redefine "' + (_lastDefined ? _lastDefined.name : '') + '" as you go — click to pause'
        : 'live is off — Define (or ▸ use it) to turn it on';
}

// ── Port geometry — deterministic from node position + block layout ────────
function portPos(node, portName, isOutput) {
    if (isOutput) return { x: node.x + BLOCK_W, y: node.y + HEADER_H / 2 };
    const def = blockDef(node.type);
    const idx = Math.max(0, def.inputs.findIndex(p => p.name === portName));
    const y = node.y + HEADER_H + def.params.length * ROW_H + idx * ROW_H + ROW_H / 2;
    return { x: node.x, y };
}

// _canvasEl is CSS-scaled by _zoom (see applyZoom()), so its bounding rect is
// in SCREEN pixels — divide back down to get canvas-space (node.x/y) units.
function clientToCanvas(clientX, clientY) {
    const r = _canvasEl.getBoundingClientRect();
    return { x: (clientX - r.left) / _zoom, y: (clientY - r.top) / _zoom };
}

function nodeHeight(node) {
    const def = blockDef(node.type);
    return HEADER_H + def.params.length * ROW_H + def.inputs.length * ROW_H;
}

// Bounding box of the CURRENT node positions — not a running count, so it
// stays accurate after nodes are dragged around, deleted, or restored from a
// differently-shaped older patch (that mismatch used to send freshly added
// blocks off to a far corner of the canvas — see nextSpawnPos()).
function boundingBox() {
    if (!_graph.nodes.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of _graph.nodes) {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + BLOCK_W);
        maxY = Math.max(maxY, node.y + nodeHeight(node));
    }
    return { minX, minY, maxX, maxY };
}

// Where a newly-palette-added block should land: right next to the existing
// patch, wrapping into a new row once a run gets too wide (or would run off
// the virtual canvas) instead of drifting arbitrarily far from it.
function nextSpawnPos() {
    const GAP = 30, ROW_MAXW = 950;
    const bb = boundingBox();
    if (!bb) return { x: 30, y: 30 };
    let x = bb.maxX + GAP, y = bb.minY;
    if (x - bb.minX > ROW_MAXW || x + BLOCK_W > CANVAS_W - GAP) { x = bb.minX; y = bb.maxY + GAP; }
    return { x, y };
}

// Scroll the canvas so the patch's bounding box is centered in the viewport.
// Node coords are canvas-space (unscaled) — scroll offsets are screen pixels
// in the zoomed sizer, so scale by _zoom going in.
function centerView() {
    const bb = boundingBox();
    if (!bb) { _wrapEl.scrollLeft = 0; _wrapEl.scrollTop = 0; return; }
    _wrapEl.scrollLeft = Math.max(0, ((bb.minX + bb.maxX) / 2) * _zoom - _wrapEl.clientWidth / 2);
    _wrapEl.scrollTop  = Math.max(0, ((bb.minY + bb.maxY) / 2) * _zoom - _wrapEl.clientHeight / 2);
}

// ── Zoom — CSS-transform the canvas, resize its scroll-sizer wrapper to
// match (so native scrolling covers the whole scaled patch), and re-anchor
// scroll on the given viewport-local point so zooming feels anchored, not
// like the patch jumps around under the cursor.
function applyZoom() {
    _sizerEl.style.width = (CANVAS_W * _zoom) + 'px';
    _sizerEl.style.height = (CANVAS_H * _zoom) + 'px';
    _canvasEl.style.transform = `scale(${_zoom})`;
    if (_zoomValEl) _zoomValEl.textContent = Math.round(_zoom * 100) + '%';
}
function setZoomAt(newZoom, localX, localY) {
    newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, newZoom));
    if (newZoom === _zoom) return;
    const cx = (_wrapEl.scrollLeft + localX) / _zoom;
    const cy = (_wrapEl.scrollTop + localY) / _zoom;
    _zoom = newZoom;
    applyZoom();
    _wrapEl.scrollLeft = Math.max(0, cx * _zoom - localX);
    _wrapEl.scrollTop  = Math.max(0, cy * _zoom - localY);
}
// The +/- buttons anchor on the PATCH's own center, not a fixed viewport
// pixel — anchoring on viewport-center regardless of content meant a block
// far from that pixel (e.g. near canvas origin, common right after adding a
// first block) would drift out of the scrollable/clipped viewport after a
// couple of zoom-in clicks: it becomes genuinely un-clickable (the pointer
// then lands on empty canvas behind it, which pans instead of dragging) —
// looks exactly like "drag stopped working after zooming".
function zoomAnchorPoint() {
    const bb = boundingBox();
    if (!bb) return { x: _wrapEl.clientWidth / 2, y: _wrapEl.clientHeight / 2 };
    const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2;
    return { x: cx * _zoom - _wrapEl.scrollLeft, y: cy * _zoom - _wrapEl.scrollTop };
}
function zoomStep(factor) { const p = zoomAnchorPoint(); setZoomAt(_zoom * factor, p.x, p.y); }
function zoomReset() { const p = zoomAnchorPoint(); setZoomAt(1, p.x, p.y); }

// Nudge scroll just enough to bring a node fully into the viewport — not a
// full centerView(), so adding block #4 doesn't yank the whole view around
// the moment blocks #1-3 are still visible and being worked on.
function scrollNodeIntoView(node) {
    const PAD = 20;
    const left = node.x * _zoom, right = (node.x + BLOCK_W) * _zoom;
    const top = node.y * _zoom, bottom = (node.y + nodeHeight(node)) * _zoom;
    const w = _wrapEl;
    if (right + PAD > w.scrollLeft + w.clientWidth) w.scrollLeft = right + PAD - w.clientWidth;
    if (left - PAD < w.scrollLeft) w.scrollLeft = Math.max(0, left - PAD);
    if (bottom + PAD > w.scrollTop + w.clientHeight) w.scrollTop = bottom + PAD - w.clientHeight;
    if (top - PAD < w.scrollTop) w.scrollTop = Math.max(0, top - PAD);
}

// ── Panel construction ──────────────────────────────────────────────────────
function build() {
    _panel = document.createElement('div');
    _panel.id = 'modular-panel';
    _panel.className = 'hidden';
    _panel.innerHTML = `
        <div class="modular-head">
            <span class="modular-title">🎛 modular</span>
            <input type="text" class="modular-name" value="mypatch" spellcheck="false" title="synth name — used as  p1 &gt;&gt; name(...)">
            <button class="modular-define" title="compile this patch into a playable synth">Define ▸</button>
            <button class="modular-audition" title="play a test note through this patch — Defines it first if needed  (Space, with the canvas focused)">▶</button>
            <button class="modular-undo" title="nothing to undo" disabled>↶</button>
            <button class="modular-redo" title="nothing to redo" disabled>↷</button>
            <button class="modular-insert" title="paste AND run a p1 &gt;&gt; line for this synth, every unwired knob spelled out — turns on live editing (see the ⚡ badge)">▸ use it</button>
            <button class="modular-show" title="paste the patch into the editor as a real defsynth() — the same code the graph compiles, ready to hand-edit or keep with your set">⇱ show in code</button>
            <button class="modular-live" title="live is off — Define (or ▸ use it) to turn it on">⚡</button>
            <button class="modular-center" title="center the view on the patch">⌖</button>
            <button class="modular-save" title="save patch to a .json file">⇩</button>
            <button class="modular-loadbtn" title="load a patch .json file">⇧</button>
            <button class="modular-clearbtn" title="clear the patch">clear</button>
            <div class="modular-drag"></div>
            <button class="modular-close" title="close">×</button>
        </div>
        <div class="modular-body">
            <div class="modular-palette">
                <select class="modular-templates" title="load a starter patch — replaces the current one">
                    <option value="">templates ▾</option>
                </select>
                <div class="modular-palette-blocks"></div>
            </div>
            <div class="modular-canvas-wrap">
                <div class="modular-canvas-sizer">
                    <div class="modular-canvas">
                        <svg class="modular-cables"></svg>
                    </div>
                </div>
            </div>
            <div class="modular-side">
                <div class="modular-status"></div>
                <textarea class="modular-code" readonly spellcheck="false"></textarea>
                <div class="modular-hint"></div>
                <div class="modular-keys">knobs: drag · Shift fine · dbl-click type · right-click reset<br>canvas: click to focus, then Space plays · Del removes · Ctrl+D duplicates · Ctrl+Z undoes · Shift+drag lassoes</div>
                <div class="modular-zoom">
                    <button class="modular-zoom-out" title="zoom out">−</button>
                    <span class="modular-zoom-val">100%</span>
                    <button class="modular-zoom-in" title="zoom in">+</button>
                    <button class="modular-zoom-reset" title="reset zoom">reset</button>
                </div>
            </div>
        </div>
        <input type="file" class="modular-file-input" accept="application/json" hidden>`;
    document.body.appendChild(_panel);

    _wrapEl    = _panel.querySelector('.modular-canvas-wrap');
    _sizerEl   = _panel.querySelector('.modular-canvas-sizer');
    _canvasEl  = _panel.querySelector('.modular-canvas');
    _svgEl     = _panel.querySelector('.modular-cables');
    _codeEl    = _panel.querySelector('.modular-code');
    _statusEl  = _panel.querySelector('.modular-status');
    _hintEl    = _panel.querySelector('.modular-hint');
    _nameInput = _panel.querySelector('.modular-name');
    _fileInput = _panel.querySelector('.modular-file-input');
    _zoomValEl = _panel.querySelector('.modular-zoom-val');
    _liveBadge = _panel.querySelector('.modular-live');

    _panel.querySelector('.modular-close').onclick = closeModular;
    _panel.querySelector('.modular-define').onclick = onDefine;
    _panel.querySelector('.modular-insert').onclick = onInsert;
    _panel.querySelector('.modular-show').onclick = onShowInCode;
    _liveBadge.onclick = () => {
        if (!_lastDefined) return;   // nothing live to pause/resume yet
        _liveMode = !_liveMode;
        if (_liveMode) scheduleLiveRedefine();
        updateLiveBadge();
    };
    _panel.querySelector('.modular-audition').onclick = audition;
    _panel.querySelector('.modular-undo').onclick = undo;
    _panel.querySelector('.modular-redo').onclick = redo;
    _panel.querySelector('.modular-center').onclick = centerView;
    _panel.querySelector('.modular-zoom-in').onclick = () => zoomStep(1.2);
    _panel.querySelector('.modular-zoom-out').onclick = () => zoomStep(1 / 1.2);
    _panel.querySelector('.modular-zoom-reset').onclick = zoomReset;
    _wrapEl.addEventListener('wheel', (e) => {
        if (!e.ctrlKey) return;   // plain wheel scrolls natively; Ctrl+wheel (or pinch) zooms
        e.preventDefault();
        const r = _wrapEl.getBoundingClientRect();
        setZoomAt(_zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    _panel.querySelector('.modular-save').onclick = savePatch;
    _panel.querySelector('.modular-loadbtn').onclick = () => _fileInput.click();
    const templatesSel = _panel.querySelector('.modular-templates');
    const groups = new Map();   // category -> <optgroup> — insertion order = first-seen order in TEMPLATES
    for (const tpl of TEMPLATES) {
        const cat = tpl.category || 'Other';
        let grp = groups.get(cat);
        if (!grp) { grp = document.createElement('optgroup'); grp.label = cat; templatesSel.appendChild(grp); groups.set(cat, grp); }
        const o = document.createElement('option');
        o.value = tpl.key; o.textContent = tpl.label; o.title = tpl.desc;
        grp.appendChild(o);
    }
    templatesSel.onchange = () => {
        const key = templatesSel.value;
        templatesSel.value = '';
        if (!key) return;
        const tpl = TEMPLATES.find(t => t.key === key);
        if (!tpl) return;
        if (_graph.nodes.length && !confirm(`Replace the current patch with "${tpl.label}"?`)) return;
        snapshot(`load "${tpl.label}"`);
        endLiveMode();   // a template is an unrelated patch — stop auto-redefining whatever was live
        _selection.clear();
        _graph = makeGraph();
        tpl.build(_graph);
        afterStructuralChange();
        centerView();
    };
    _panel.querySelector('.modular-clearbtn').onclick = () => {
        if (!confirm('clear the patch?')) return;
        snapshot('clear the patch');
        endLiveMode();
        _selection.clear();
        _graph = makeGraph();
        afterStructuralChange();
    };
    _fileInput.onchange = () => {
        const f = _fileInput.files[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
            try { snapshot('load patch file'); endLiveMode(); _selection.clear(); _graph = fromJSON(reader.result); afterStructuralChange(); }
            catch (e) { setStatus('✗ bad patch file: ' + e.message, 'error'); }
        };
        reader.readAsText(f);
        _fileInput.value = '';
    };

    draggable(_panel.querySelector('.modular-head'), _panel, 'button, input');
    initCanvasPan();
    initKeys();
    initNodeDragShared();
    renderPalette();
    applyZoom();
}

// Drag on empty canvas background to pan (scrollbars alone are clumsy once
// zoomed in) — block/port pointerdown handlers stopPropagation() so this
// only fires when the pointer actually starts on empty space.
function initCanvasPan() {
    let sx = 0, sy = 0, startLeft = 0, startTop = 0, on = false;
    _wrapEl.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.modular-block, .modular-dot')) return;
        _wrapEl.focus({ preventScroll: true });
        if (e.shiftKey) {
            const c = clientToCanvas(e.clientX, e.clientY);
            _band = { x0: c.x, y0: c.y, x1: c.x, y1: c.y, add: new Set(_selection) };
            renderBand();
            e.preventDefault();
            return;
        }
        if (_selection.size) { _selection.clear(); renderBlocks(); renderCables(); }
        on = true; sx = e.clientX; sy = e.clientY;
        startLeft = _wrapEl.scrollLeft; startTop = _wrapEl.scrollTop;
        _wrapEl.classList.add('panning');
    });
    window.addEventListener('pointermove', (e) => {
        if (_band) {
            const c = clientToCanvas(e.clientX, e.clientY);
            _band.x1 = c.x; _band.y1 = c.y;
            renderBand();
            return;
        }
        if (!on) return;
        _wrapEl.scrollLeft = startLeft - (e.clientX - sx);
        _wrapEl.scrollTop  = startTop - (e.clientY - sy);
    });
    window.addEventListener('pointerup', () => {
        if (_band) {
            // Shift+band ADDS, matching shift-click — a band is how you extend
            // a selection you already started.
            _selection = new Set([..._band.add, ...nodesInBand().map(n => n.id)]);
            _band = null;
            renderBand();
            renderBlocks(); renderCables();
            setStatus(_selection.size ? `${_selection.size} selected` : '', 'info');
        }
        on = false; _wrapEl.classList.remove('panning');
    });
}


function renderPalette() {
    const paletteEl = _panel.querySelector('.modular-palette-blocks');
    paletteEl.innerHTML = '';
    for (const [type, def] of Object.entries(BLOCKS)) {
        const btn = document.createElement('button');
        btn.className = 'modular-palette-btn';
        btn.textContent = def.label;
        btn.title = `add a ${def.label} block`;
        btn.onclick = () => {
            snapshot(`add ${def.label}`);
            const { x, y } = nextSpawnPos();
            const id = addNode(_graph, type, x, y, defaultParams(type));
            _selection = new Set([id]);
            afterStructuralChange();
            // A row of blocks runs wider than the visible canvas viewport —
            // without this a block spawns off-screen, and dragging a wire to
            // an off-screen (unpainted) port silently fails to connect.
            const node = _graph.nodes.find(n => n.id === id);
            if (node) scrollNodeIntoView(node);
        };
        paletteEl.appendChild(btn);
    }
}

// ── Knob roles — tag an unwired knob (or the Number block's value) with a
// semantic name so the generated param reads e.g. `freq=` instead of the
// auto `n2_freq=`. A real <select> (not a cycle-button — that read as
// decoration, not a control) with a "custom…" option that prompts for a name.
const ROLE_PRESETS = ['freq', 'amp', 'rate'];
function roleTitle(role) {
    return role
        ? `role: ${role} — used as p1 >> patch(${role}=…); naming it out/note/amp/sus/pan/attack/release reuses that built-in control instead of adding a new one`
        : 'auto-named — pick a role so this knob gets a mnemonic param name (freq/amp/rate/custom)';
}
function roleSelect(node, key) {
    const sel = document.createElement('select');
    sel.className = 'modular-role-sel';

    const build = () => {
        const cur = node.roles && node.roles[key];
        const isPreset = ROLE_PRESETS.includes(cur);
        sel.innerHTML = '';
        const opts = [['', 'auto'], ...ROLE_PRESETS.map(r => [r, r]), ['custom', (cur && !isPreset) ? cur : 'custom…']];
        for (const [val, label] of opts) {
            const o = document.createElement('option');
            o.value = val; o.textContent = label.length > 9 ? label.slice(0, 9) : label;
            if (val === (cur ? (isPreset ? cur : 'custom') : '')) o.selected = true;
            sel.appendChild(o);
        }
        sel.className = 'modular-role-sel' + (cur ? ' tagged' : '');
        sel.title = roleTitle(cur);
    };
    build();

    sel.onchange = () => {
        const cur = node.roles && node.roles[key];
        let next = sel.value;
        if (next === 'custom') {
            const name = prompt('param name for this knob (used as p1 >> patch(name=…)):', cur && !ROLE_PRESETS.includes(cur) ? cur : '');
            if (name === null) { build(); return; }   // cancelled — revert the <select> to its prior state
            next = name.trim();
        }
        snapshot(`role ${key}`);
        if (!node.roles) node.roles = {};
        if (next) node.roles[key] = next; else delete node.roles[key];
        build();
        afterParamChange();
    };
    return sel;
}

// A knob for node.params[key]. Every frame of the drag re-compiles, so under
// live mode you HEAR the sweep as you make it; the undo snapshot is taken only
// on the change that BEGINS the gesture, which makes the whole sweep — however
// long you take over it — a single Ctrl+Z.
function paramKnob(node, key, fallback) {
    const spec = knobSpec(node.type, key);
    return makeKnob({
        value: node.params[key] ?? fallback ?? spec.default ?? 0,
        spec,
        onInput: (v, first) => {
            if (first) snapshot(`${blockDef(node.type).label} ${key}`);
            node.params[key] = v;
            afterParamChange();
        },
    });
}

// ── Blocks ───────────────────────────────────────────────────────────────
function renderBlocks() {
    _canvasEl.querySelectorAll('.modular-block').forEach(el => el.remove());
    for (const node of _graph.nodes) {
        const def = blockDef(node.type);
        const el = document.createElement('div');
        el.className = 'modular-block' + (_selection.has(node.id) ? ' selected' : '');
        el.dataset.id = node.id;
        el.style.left = node.x + 'px';
        el.style.top = node.y + 'px';
        el.style.width = BLOCK_W + 'px';

        const header = document.createElement('div');
        header.className = 'modular-block-head';
        header.innerHTML = `<span class="modular-block-label">${def.label}</span><button class="modular-block-del" title="remove">×</button>`;
        header.querySelector('.modular-block-del').onclick = () => { snapshot(`remove ${def.label}`); removeNode(_graph, node.id); _selection.delete(node.id); afterStructuralChange(); };
        initNodeDragHandle(header, node);
        el.appendChild(header);

        if (def.output) {
            const outDot = document.createElement('span');
            outDot.className = 'modular-dot modular-dot-out ' + (def.output === 'control' ? 'ctrl' : 'audio');
            outDot.title = `out (${def.output}) — drag to an input`;
            outDot.onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); startWireDrag(node.id, e); };
            header.appendChild(outDot);
        }

        for (const param of def.params) {
            const row = document.createElement('div');
            row.className = 'modular-block-row';
            if (param.kind === 'select') {
                const sel = document.createElement('select');
                for (const opt of param.options) {
                    const o = document.createElement('option');
                    o.value = opt; o.textContent = opt;
                    if (node.params[param.name] === opt) o.selected = true;
                    sel.appendChild(o);
                }
                sel.onchange = () => { snapshot(`${def.label} ${param.name}`); node.params[param.name] = sel.value; afterParamChange(); };
                row.appendChild(sel);
            } else {
                row.appendChild(paramKnob(node, param.name, param.default));
                row.appendChild(roleSelect(node, param.name));
            }
            el.appendChild(row);
        }

        for (const port of def.inputs) {
            const row = document.createElement('div');
            row.className = 'modular-block-row modular-block-port';
            const wired = !!edgeInto(_graph, node.id, port.name);
            const dot = document.createElement('span');
            dot.className = 'modular-dot modular-dot-in' + (wired ? ' wired' : '');
            dot.dataset.node = node.id; dot.dataset.port = port.name;
            dot.title = wired ? `${port.name} (wired) — click to disconnect` : `${port.name} — drag a wire here`;
            dot.onpointerdown = (e) => {
                e.stopPropagation();
                if (wired) { snapshot(`unwire ${port.name}`); disconnect(_graph, node.id, port.name); afterStructuralChange(); }
            };
            const label = document.createElement('span');
            label.className = 'modular-port-label';
            label.textContent = port.name;
            row.appendChild(dot); row.appendChild(label);
            if (!wired) {
                row.appendChild(paramKnob(node, port.name, port.default));
                row.appendChild(roleSelect(node, port.name));
            }
            el.appendChild(row);
        }

        _canvasEl.appendChild(el);
    }
}

// renderBlocks() destroys + recreates every block's header on EVERY structural
// change, so calling initNodeDrag() per-node-per-render used to attach a fresh
// pair of window pointermove/pointerup listeners each time WITHOUT removing
// the old ones — those never get GC'd (window holds the reference forever),
// so a long editing session leaked more and more listeners that keep firing
// on every mouse move anywhere on the page, even with the panel closed. Fixed
// by registering exactly ONE shared pair (in build()) driven by _nodeDrag,
// the same pattern _wireDrag already uses. Only the pointerdown stays
// per-header — that one's harmless, it's GC'd along with its (removed) element.
function initNodeDragHandle(handle, node) {
    handle.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button, select') || e.target.classList.contains('modular-dot')) return;
        _wrapEl.focus({ preventScroll: true });   // the shortcuts live on the canvas
        // Shift toggles; a plain press on an UNSELECTED block replaces the
        // selection, but on an already-selected one it keeps the set intact —
        // otherwise you could never drag several blocks at once, because the
        // press that begins the drag would collapse the selection first.
        if (e.shiftKey) {
            if (_selection.has(node.id)) _selection.delete(node.id); else _selection.add(node.id);
            renderBlocks(); renderCables();
        } else if (!_selection.has(node.id)) {
            _selection = new Set([node.id]);
            renderBlocks(); renderCables();
        }
        const moving = (_selection.has(node.id) ? [..._selection] : [node.id])
            .map(id => _graph.nodes.find(n => n.id === id)).filter(Boolean);
        // The snapshot is deferred to the first actual movement (see the shared
        // pointermove): most presses on a header are selections, not drags, and
        // snapshotting here would leave an undo step that restores what is
        // already on screen — a Ctrl+Z that visibly does nothing.
        _nodeDrag = { sx: e.clientX, sy: e.clientY, snapped: false,
                      moving: moving.map(n => ({ node: n, ox: n.x, oy: n.y })) };
        e.preventDefault(); e.stopPropagation();
    });
}
function initNodeDragShared() {
    window.addEventListener('pointermove', (e) => {
        if (!_nodeDrag) return;
        const { sx, sy, moving } = _nodeDrag;
        const dx = (e.clientX - sx) / _zoom, dy = (e.clientY - sy) / _zoom;
        if (!_nodeDrag.snapped) {
            if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;   // still just a click
            _nodeDrag.snapped = true;
            snapshot(moving.length > 1 ? `move ${moving.length} blocks` : 'move block');
        }
        for (const m of moving) {
            m.node.x = Math.max(0, m.ox + dx);
            m.node.y = Math.max(0, m.oy + dy);
            const el = _canvasEl.querySelector(`.modular-block[data-id="${m.node.id}"]`);
            if (el) { el.style.left = m.node.x + 'px'; el.style.top = m.node.y + 'px'; }
        }
        renderCables();
    });
    window.addEventListener('pointerup', () => { if (_nodeDrag) { _nodeDrag = null; persist(); } });
}

// ── Commands the keyboard and the buttons share ─────────────────────────────

function deleteSelection() {
    if (!_selection.size) return;
    snapshot(`remove ${_selection.size} block${_selection.size > 1 ? 's' : ''}`);
    for (const id of _selection) removeNode(_graph, id);
    _selection.clear();
    afterStructuralChange();
}

// Copies the selected nodes AND the wires that run between two of them —
// duplicating a filter+envelope pair should give you a working pair, not two
// loose blocks. Wires crossing the selection boundary are dropped: there is no
// second copy of the far end to attach them to.
function duplicateSelection() {
    if (!_selection.size) return;
    snapshot(`duplicate ${_selection.size} block${_selection.size > 1 ? 's' : ''}`);
    const map = duplicateNodes(_graph, [..._selection]);
    _selection = new Set(map.values());
    afterStructuralChange();
    setStatus(`duplicated ${map.size}`, 'ok');
}

function nudgeSelection(dx, dy) {
    if (!_selection.size) return;
    snapshot('nudge', 'nudge');
    for (const id of _selection) {
        const n = _graph.nodes.find(x => x.id === id);
        if (!n) continue;
        n.x = Math.max(0, n.x + dx);
        n.y = Math.max(0, n.y + dy);
    }
    persist();
    renderBlocks(); renderCables();
}

function selectAll() {
    _selection = new Set(_graph.nodes.map(n => n.id));
    renderBlocks(); renderCables();
    setStatus(`${_selection.size} selected`, 'info');
}

// ── Audition — hear the patch without leaving the panel ─────────────────────
//
// The loop this closes: before, hearing an edit meant Define, then switching to
// the editor, then typing a p1 >> line. With live mode already re-compiling on
// every knob move, one key is all that stands between a drag and the sound.
//
// It Defines first if nothing is live yet, so the very first press works on a
// patch you have only just built. playSynthNote() is the same one-shot path
// MIDI note-input uses: straight to the main output, no player, no FX chain,
// nothing to clean up afterwards.
const AUDITION_NOTE = 60, AUDITION_SUS = 1.0;
async function audition() {
    const name = (_nameInput.value || 'mypatch').trim();
    try {
        if (!_lastDefined || _lastDefined.name !== name) {
            const { extraParams } = await compileAndDefine(name, _graph);
            _lastDefined = { name, extraParams };
            _liveMode = true;
            updateLiveBadge();
        }
        const id = playSynthNote(name, AUDITION_NOTE, { sus: AUDITION_SUS, amp: 0.7 });
        if (id === undefined) { setStatus('▶ boot audio first (top-left)', 'warn'); return; }
        setStatus(`▶ "${name}"`, 'ok');
    } catch (e) {
        setStatus('✗ ' + e.message, 'error');
    }
}

// ── Keyboard ────────────────────────────────────────────────────────────────
//
// Bound to the CANVAS, which is focusable, rather than to the window. The panel
// floats over the code editor and is not modal, so a window-level Ctrl+Z would
// undo a graph edit while you were typing code — the canvas has to have been
// clicked for any of this to fire.
function initKeys() {
    _wrapEl.tabIndex = 0;
    _wrapEl.addEventListener('keydown', (e) => {
        // A knob being typed into, a role <select>, the name field: theirs, not ours.
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
        const mod = e.ctrlKey || e.metaKey;
        const key = e.key;

        if (mod && (key === 'z' || key === 'Z')) { e.preventDefault(); e.stopPropagation(); e.shiftKey ? redo() : undo(); return; }
        if (mod && (key === 'y' || key === 'Y')) { e.preventDefault(); e.stopPropagation(); redo(); return; }
        if (mod && (key === 'd' || key === 'D')) { e.preventDefault(); e.stopPropagation(); duplicateSelection(); return; }
        if (mod && (key === 'a' || key === 'A')) { e.preventDefault(); e.stopPropagation(); selectAll(); return; }

        if (key === 'Delete' || key === 'Backspace') { e.preventDefault(); e.stopPropagation(); deleteSelection(); return; }
        if (key === ' ')      { e.preventDefault(); e.stopPropagation(); audition(); return; }
        if (key === 'Escape') {
            e.preventDefault(); e.stopPropagation();
            if (_wireDrag) { _wireDrag = null; renderCables(); return; }
            if (_selection.size) { _selection.clear(); renderBlocks(); renderCables(); }
            return;
        }
        const step = e.shiftKey ? 10 : 1;
        const nudges = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        if (nudges[key] && _selection.size) { e.preventDefault(); e.stopPropagation(); nudgeSelection(...nudges[key]); }
    });
}

// ── Rubber-band select ──────────────────────────────────────────────────────
// Shift+drag on empty canvas. Plain drag stays PAN — that is how the panel has
// always worked and it is the gesture you use constantly once zoomed in; taking
// it away to make room for selection would trade a common move for a rare one.
function bandRect() {
    if (!_band) return null;
    return {
        x0: Math.min(_band.x0, _band.x1), y0: Math.min(_band.y0, _band.y1),
        x1: Math.max(_band.x0, _band.x1), y1: Math.max(_band.y0, _band.y1),
    };
}
function renderBand() {
    let el = _canvasEl.querySelector('.modular-band');
    const r = bandRect();
    if (!r) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.className = 'modular-band'; _canvasEl.appendChild(el); }
    el.style.left = r.x0 + 'px'; el.style.top = r.y0 + 'px';
    el.style.width = (r.x1 - r.x0) + 'px'; el.style.height = (r.y1 - r.y0) + 'px';
}
function nodesInBand() {
    const r = bandRect();
    if (!r) return [];
    // Intersection, not containment — you should be able to lasso a column of
    // blocks without dragging all the way around the widest one.
    return _graph.nodes.filter(n =>
        n.x < r.x1 && n.x + BLOCK_W > r.x0 && n.y < r.y1 && n.y + nodeHeight(n) > r.y0);
}

// ── Wiring — drag from an output dot, drop on an input dot ─────────────────
function startWireDrag(fromNodeId, e) {
    _wireDrag = { fromNode: fromNodeId, x: e.clientX, y: e.clientY };
    renderCables();
    const move = (ev) => { if (_wireDrag) { _wireDrag.x = ev.clientX; _wireDrag.y = ev.clientY; renderCables(); } };
    const up = (ev) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        // Drop target is the whole port ROW, not just the ~10px dot — a
        // pixel-precise circle is an unreasonably small target for a mouse
        // drag (let alone touch), and elementsFromPoint missing it by a few
        // px used to silently drop the connection with no feedback.
        const row = document.elementsFromPoint(ev.clientX, ev.clientY)
            .map(el => el.closest && el.closest('.modular-block-port'))
            .find(Boolean);
        const target = row && row.querySelector('.modular-dot-in');
        _wireDrag = null;
        if (target) { snapshot(`wire → ${target.dataset.port}`); connect(_graph, fromNodeId, 'out', target.dataset.node, target.dataset.port); afterStructuralChange(); }
        else renderCables();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
}

function renderCables() {
    _svgEl.innerHTML = '';
    for (const edge of _graph.edges) {
        const fromNode = _graph.nodes.find(n => n.id === edge.from.node);
        const toNode = _graph.nodes.find(n => n.id === edge.to.node);
        if (!fromNode || !toNode) continue;
        drawCable(portPos(fromNode, 'out', true), portPos(toNode, edge.to.port, false),
            () => { snapshot(`unwire ${edge.to.port}`); disconnect(_graph, toNode.id, edge.to.port); afterStructuralChange(); });
    }
    if (_wireDrag) {
        const fromNode = _graph.nodes.find(n => n.id === _wireDrag.fromNode);
        if (fromNode) drawCable(portPos(fromNode, 'out', true), clientToCanvas(_wireDrag.x, _wireDrag.y), null, true);
    }
}

function drawCable(p1, p2, onClick, ghost) {
    const dx = Math.max(40, Math.abs(p2.x - p1.x) / 2);
    const d = `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'modular-cable' + (ghost ? ' ghost' : ''));
    if (onClick) { path.style.pointerEvents = 'stroke'; path.style.cursor = 'pointer'; path.title = 'click to disconnect'; path.onclick = onClick; }
    _svgEl.appendChild(path);
}

// ── Code preview + Define ───────────────────────────────────────────────────
// True if the compiled extraParams contain a name ending in a disambiguating
// digit (cutoff2, rq3…) — the tell that two DIFFERENT untagged knobs landed
// on the same port name and codegen auto-numbered them apart (see
// resolveKnob() in codegen.js) rather than silently sharing one control.
// Worth a nudge toward the rename/share dropdown; not worth nagging about
// otherwise, since untagged knobs are already well-named by default now.
function hasDisambiguatedName(extraParams) {
    return Object.keys(extraParams).some(k => /\d$/.test(k));
}

function updateCodePreview() {
    const { source, error, warnings, extraParams } = generateSource(_graph);
    _codeEl.value = error ? `// ${error}` : source;
    if (!_graph.nodes.length) {
        _hintEl.textContent = 'tip: drag blocks in from the palette, finish the chain with an Output. Add an Envelope somewhere before it — without one, a note never stops (Env.perc reads the standard attack/sus/release controls automatically, no wiring needed).';
        _hintEl.className = 'modular-hint';
    } else if (warnings && warnings.length) {
        _hintEl.textContent = '⚠ ' + warnings.join('  ·  ');
        _hintEl.className = 'modular-hint warn';
    } else if (extraParams && hasDisambiguatedName(extraParams)) {
        _hintEl.textContent = 'tip: two knobs share a port name (like cutoff/cutoff2) so they stayed independent — use a knob\'s dropdown to rename one, or to deliberately unify them under one shared name.';
        _hintEl.className = 'modular-hint';
    } else {
        _hintEl.textContent = 'knobs are named after their port (cutoff, rq, rate…) by default — same as the built-in synths. Use a knob\'s dropdown to rename one or share it with another.';
        _hintEl.className = 'modular-hint';
    }
}

async function onDefine() {
    const name = (_nameInput.value || '').trim();
    if (!name) { setStatus('name it first', 'error'); return; }
    setStatus('compiling…', 'info');
    try {
        const { extraParams, warnings } = await compileAndDefine(name, _graph);
        _lastDefined = { name, extraParams };
        _liveMode = true;   // from here on, graph edits auto-redefine this name — see scheduleLiveRedefine()
        updateLiveBadge();
        const warn = warnings && warnings.length ? '  ⚠ ' + warnings.join('  ·  ') : '';
        setStatus(`✓ "${name}" defined — try:  p1 >> ${name}([0,4,7])${warn}`, warn ? 'warn' : 'ok');
        if (_logFn) _logFn(`modular: "${name}" defined ✓${warn}`, warn ? 'info' : 'ok');
    } catch (e) {
        _lastDefined = null;
        setStatus(`✗ ${e.message}`, 'error');
    }
}

// Paste a ready-to-run player line for the just-Defined synth, EVERY exposed
// knob spelled out with its CURRENT value (read fresh, not the snapshot from
// Define time, so a knob edited afterward shows up correctly here even
// before the next Define) — proof, not just a claim, that an unwired input
// is already a live, overridable param and never needed a Number block.
function onInsert() {
    const name = (_nameInput.value || '').trim();
    if (!_lastDefined || _lastDefined.name !== name) { setStatus('Define it first', 'error'); return; }
    if (!_insertFn) { setStatus('no editor connected', 'error'); return; }
    const { extraParams } = generateSource(_graph);
    const args = Object.entries(extraParams || {}).map(([k, v]) => `${k}=${v}`).join(', ');
    _insertFn(`p1 >> ${name}(${args})`);
}

// "⇱ show in code" — paste the patch into the editor as a real, hand-editable
// defsynth() call.
//
// The preview pane already shows the compiled body, but that body is a bare arrow
// function: it is what compileToFunction() evaluates, not something you can run from
// the editor. Wrapping it in defsynth(name, params, fn) turns the graph into ordinary
// code — you can keep it with the set, hand-edit past what the block palette can
// express, and share it, since a composition is just text.
//
// It does NOT Define first: the point is to read and edit the source, and requiring a
// Define to look at your own patch would be a strange gate. It also does not RUN what
// it pastes, unlike "▸ use it" — re-running the definition of a synth that is already
// live is a no-op at best, and the reason to press this is to LOOK at it.
function onShowInCode() {
    const name = (_nameInput.value || '').trim() || 'mypatch';
    if (!_insertFn) { setStatus('no editor connected', 'error'); return; }
    const { source, extraParams, error, warnings } = generateSource(_graph);
    if (error) { setStatus(`✗ ${error}`, 'error'); return; }
    const params = Object.keys(extraParams || {}).length
        ? '{ ' + Object.entries(extraParams).map(([k, v]) => `${k}: ${v}`).join(', ') + ' }'
        : '{}';
    _insertFn(`defsynth("${name}", ${params}, ${source})`, { run: false });
    const warn = warnings && warnings.length ? '  ⚠ ' + warnings.join('  ·  ') : '';
    setStatus(`⇱ pasted "${name}" into the editor — edit it there, Ctrl+Enter to define${warn}`, warn ? 'warn' : 'ok');
    if (_logFn) _logFn(`modular: "${name}" pasted as defsynth() — run it to define`, 'ok');
}

function setStatus(msg, kind) {
    _statusEl.textContent = msg;
    _statusEl.className = 'modular-status ' + (kind || '');
}

// ── Panel open/close + persistence-facing API ───────────────────────────────
export function openModular() {
    const firstBuild = !_panel;
    if (firstBuild) build();
    _open = true;
    _panel.classList.remove('hidden');
    afterStructuralChange();
    if (firstBuild) centerView();   // a patch restored from storage may not start near (0,0)
}
export function closeModular() { _open = false; if (_panel) _panel.classList.add('hidden'); }
export function toggleModular() { _open ? closeModular() : openModular(); }
export function isModularOpen() { return _open; }

// savePatch() / loadPatch(url) — eval-scope scriptable counterparts to the
// Save/Load buttons, same convention as loadpack(url) for sample packs.
export function savePatch() {
    const blob = new Blob([toJSON(_graph)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = ((_nameInput && _nameInput.value) || 'patch') + '.json';
    a.click();
    URL.revokeObjectURL(url);
}
export async function loadPatch(url) {
    const res = await fetch(url);
    const text = await res.text();
    snapshot('loadPatch("' + url + '")');
    endLiveMode();
    _selection.clear();
    _graph = fromJSON(text);
    openModular();
    centerView();
}
