// Modular synth builder — a non-modal floating panel (mixer.js precedent):
// drag blocks from the palette, wire ports with cables, watch the generated
// JS source update live in the side pane, hit Define to compile it through
// the real defsynth() (js/scsynth/defsynth.js) — same pipeline a hand-typed
// synth uses, nothing new needed there. See js/modular/{graph,blocks,codegen}.js.
//
// Cable geometry is computed from node.x/node.y + fixed per-block layout
// constants (HEADER_H/ROW_H, matched in the CSS), not measured off the DOM —
// keeps port positions deterministic and cheap to recompute on every drag.

import { makeGraph, addNode, removeNode, connect, disconnect, edgeInto, toJSON, fromJSON } from '../modular/graph.js';
import { BLOCKS, blockDef, defaultParams } from '../modular/blocks.js';
import { generateSource, compileAndDefine } from '../modular/codegen.js';
import { TEMPLATES } from '../modular/templates.js';

const BLOCK_W = 180, HEADER_H = 26, ROW_H = 22;
const CANVAS_W = 2400, CANVAS_H = 1400;
const STORAGE_KEY = 'wfd-modular-patch';

let _graph = makeGraph();
let _logFn = null, _insertFn = null;
let _panel = null, _wrapEl = null, _sizerEl = null, _canvasEl = null, _svgEl = null, _codeEl = null, _statusEl = null, _hintEl = null, _nameInput = null, _fileInput = null, _zoomValEl = null;
let _open = false;
let _wireDrag = null;   // { fromNode, fromPort, x, y } — clientX/Y of an in-progress cable drag
let _lastDefined = null; // { name, extraParams } from the most recent successful Define
let _zoom = 1;
const ZOOM_MIN = 0.4, ZOOM_MAX = 2;

// insertFn(code): pastes a line into the main editor (mirrors chaos()'s
// paste-don't-run convention) — used by the "use it" button.
export function initModular(logFn, insertFn) {
    _logFn = logFn || null;
    _insertFn = insertFn || null;
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) _graph = fromJSON(saved);
    } catch (_) {}
}

function persist() { try { localStorage.setItem(STORAGE_KEY, toJSON(_graph)); } catch (_) {} }

function afterStructuralChange() {
    persist();
    _lastDefined = null;   // patch changed — the last Define no longer matches it
    if (_panel) { renderBlocks(); renderCables(); updateCodePreview(); }
}
function afterParamChange() {
    persist();
    if (_panel) updateCodePreview();
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
            <span class="modular-title">🧩 modular</span>
            <input type="text" class="modular-name" value="mypatch" spellcheck="false" title="synth name — used as  p1 &gt;&gt; name(...)">
            <button class="modular-define" title="compile this patch into a playable synth">Define ▸</button>
            <button class="modular-insert" title="paste a p1 &gt;&gt; line into the editor with every unwired knob spelled out — proof they're already live params, no Number block needed">▸ use it</button>
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

    _panel.querySelector('.modular-close').onclick = closeModular;
    _panel.querySelector('.modular-define').onclick = onDefine;
    _panel.querySelector('.modular-insert').onclick = onInsert;
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
    for (const tpl of TEMPLATES) {
        const o = document.createElement('option');
        o.value = tpl.key; o.textContent = tpl.label; o.title = tpl.desc;
        templatesSel.appendChild(o);
    }
    templatesSel.onchange = () => {
        const key = templatesSel.value;
        templatesSel.value = '';
        if (!key) return;
        const tpl = TEMPLATES.find(t => t.key === key);
        if (!tpl) return;
        if (_graph.nodes.length && !confirm(`Replace the current patch with "${tpl.label}"?`)) return;
        _graph = makeGraph();
        tpl.build(_graph);
        afterStructuralChange();
        centerView();
    };
    _panel.querySelector('.modular-clearbtn').onclick = () => {
        if (!confirm('clear the patch?')) return;
        _graph = makeGraph();
        afterStructuralChange();
    };
    _fileInput.onchange = () => {
        const f = _fileInput.files[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
            try { _graph = fromJSON(reader.result); afterStructuralChange(); }
            catch (e) { setStatus('✗ bad patch file: ' + e.message, 'error'); }
        };
        reader.readAsText(f);
        _fileInput.value = '';
    };

    initDrag(_panel.querySelector('.modular-head'));
    initCanvasPan();
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
        on = true; sx = e.clientX; sy = e.clientY;
        startLeft = _wrapEl.scrollLeft; startTop = _wrapEl.scrollTop;
        _wrapEl.classList.add('panning');
    });
    window.addEventListener('pointermove', (e) => {
        if (!on) return;
        _wrapEl.scrollLeft = startLeft - (e.clientX - sx);
        _wrapEl.scrollTop  = startTop - (e.clientY - sy);
    });
    window.addEventListener('pointerup', () => { on = false; _wrapEl.classList.remove('panning'); });
}

// Drag the panel by its header (non-modal — move it off your code).
function initDrag(handle) {
    let ox = 0, oy = 0, sx = 0, sy = 0, on = false;
    handle.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button, input')) return;
        on = true; const r = _panel.getBoundingClientRect();
        ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
        _panel.style.left = ox + 'px'; _panel.style.top = oy + 'px';
        _panel.style.right = 'auto'; _panel.style.bottom = 'auto';
        e.preventDefault();
    });
    window.addEventListener('pointermove', (e) => {
        if (!on) return;
        _panel.style.left = Math.max(0, ox + e.clientX - sx) + 'px';
        _panel.style.top  = Math.max(0, oy + e.clientY - sy) + 'px';
    });
    window.addEventListener('pointerup', () => { on = false; });
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
            const { x, y } = nextSpawnPos();
            const id = addNode(_graph, type, x, y, defaultParams(type));
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
// auto `n2_freq=`. Compact click-to-cycle badge instead of a dropdown so it
// fits the fixed-height row layout without touching portPos()'s row math.
const ROLE_PRESETS = ['freq', 'amp', 'rate'];
function roleLabel(node, key) {
    const r = node.roles && node.roles[key];
    if (!r) return '·';
    return r.length > 6 ? r.slice(0, 6) : r;
}
function roleTitle(node, key) {
    const r = node.roles && node.roles[key];
    return r
        ? `role: ${r} — click to change (used as p1 >> patch(${r}=…); naming it out/note/amp/sus/pan/attack/release reuses that built-in control instead of adding a new one)`
        : 'auto-named — click to tag this knob\'s role (freq/amp/rate/custom)';
}
function cycleRole(node, key, btn) {
    const cur = node.roles && node.roles[key];
    const presetIdx = ROLE_PRESETS.indexOf(cur);
    let next;
    if (!cur) next = ROLE_PRESETS[0];
    else if (presetIdx >= 0 && presetIdx < ROLE_PRESETS.length - 1) next = ROLE_PRESETS[presetIdx + 1];
    else if (presetIdx === ROLE_PRESETS.length - 1) next = 'custom';
    else next = null;   // was a custom name -> back to auto
    if (next === 'custom') {
        const name = prompt('param name for this knob (used as p1 >> patch(name=…)):', cur && presetIdx < 0 ? cur : '');
        if (name === null) return;   // cancelled — leave role unchanged
        next = name.trim() || null;
    }
    if (!node.roles) node.roles = {};
    if (next) node.roles[key] = next; else delete node.roles[key];
    btn.textContent = roleLabel(node, key);
    btn.title = roleTitle(node, key);
    btn.classList.toggle('tagged', !!next);
    afterParamChange();
}
function roleButton(node, key) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'modular-role-btn' + (node.roles && node.roles[key] ? ' tagged' : '');
    btn.textContent = roleLabel(node, key);
    btn.title = roleTitle(node, key);
    btn.onclick = () => cycleRole(node, key, btn);
    return btn;
}

// ── Blocks ───────────────────────────────────────────────────────────────
function renderBlocks() {
    _canvasEl.querySelectorAll('.modular-block').forEach(el => el.remove());
    for (const node of _graph.nodes) {
        const def = blockDef(node.type);
        const el = document.createElement('div');
        el.className = 'modular-block';
        el.dataset.id = node.id;
        el.style.left = node.x + 'px';
        el.style.top = node.y + 'px';
        el.style.width = BLOCK_W + 'px';

        const header = document.createElement('div');
        header.className = 'modular-block-head';
        header.innerHTML = `<span class="modular-block-label">${def.label}</span><button class="modular-block-del" title="remove">×</button>`;
        header.querySelector('.modular-block-del').onclick = () => { removeNode(_graph, node.id); afterStructuralChange(); };
        initNodeDrag(header, node);
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
                sel.onchange = () => { node.params[param.name] = sel.value; afterParamChange(); };
                row.appendChild(sel);
            } else {
                const inp = document.createElement('input');
                inp.type = 'number'; inp.step = 'any'; inp.className = 'modular-num';
                inp.value = node.params[param.name];
                inp.oninput = () => { node.params[param.name] = parseFloat(inp.value) || 0; afterParamChange(); };
                row.appendChild(inp);
                row.appendChild(roleButton(node, param.name));
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
                if (wired) { disconnect(_graph, node.id, port.name); afterStructuralChange(); }
            };
            const label = document.createElement('span');
            label.className = 'modular-port-label';
            label.textContent = port.name;
            row.appendChild(dot); row.appendChild(label);
            if (!wired) {
                const inp = document.createElement('input');
                inp.type = 'number'; inp.step = 'any'; inp.className = 'modular-num modular-port-val';
                inp.value = node.params[port.name] ?? port.default;
                inp.oninput = () => { node.params[port.name] = parseFloat(inp.value) || 0; afterParamChange(); };
                row.appendChild(inp);
                row.appendChild(roleButton(node, port.name));
            }
            el.appendChild(row);
        }

        _canvasEl.appendChild(el);
    }
}

function initNodeDrag(handle, node) {
    let sx = 0, sy = 0, ox = 0, oy = 0, on = false;
    handle.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button') || e.target.classList.contains('modular-dot')) return;
        on = true; sx = e.clientX; sy = e.clientY; ox = node.x; oy = node.y;
        e.preventDefault(); e.stopPropagation();
    });
    window.addEventListener('pointermove', (e) => {
        if (!on) return;
        node.x = Math.max(0, ox + (e.clientX - sx) / _zoom);
        node.y = Math.max(0, oy + (e.clientY - sy) / _zoom);
        const el = _canvasEl.querySelector(`.modular-block[data-id="${node.id}"]`);
        if (el) { el.style.left = node.x + 'px'; el.style.top = node.y + 'px'; }
        renderCables();
    });
    window.addEventListener('pointerup', () => { if (on) { on = false; persist(); } });
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
        if (target) { connect(_graph, fromNodeId, 'out', target.dataset.node, target.dataset.port); afterStructuralChange(); }
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
            () => { disconnect(_graph, toNode.id, edge.to.port); afterStructuralChange(); });
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
function updateCodePreview() {
    const { source, error, warnings } = generateSource(_graph);
    _codeEl.value = error ? `// ${error}` : source;
    if (!_graph.nodes.length) {
        _hintEl.textContent = 'tip: drag blocks in from the palette, finish the chain with an Output. Add an Envelope somewhere before it — without one, a note never stops (Env.perc reads the standard attack/sus/release controls automatically, no wiring needed).';
        _hintEl.className = 'modular-hint';
    } else if (warnings && warnings.length) {
        _hintEl.textContent = '⚠ ' + warnings.join('  ·  ');
        _hintEl.className = 'modular-hint warn';
    } else {
        _hintEl.textContent = '';
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
    _graph = fromJSON(text);
    openModular();
    centerView();
}
