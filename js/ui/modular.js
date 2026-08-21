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

const BLOCK_W = 160, HEADER_H = 26, ROW_H = 22;
const STORAGE_KEY = 'wfd-modular-patch';

let _graph = makeGraph();
let _logFn = null;
let _panel = null, _canvasEl = null, _svgEl = null, _codeEl = null, _statusEl = null, _nameInput = null, _fileInput = null;
let _open = false;
let _wireDrag = null;   // { fromNode, fromPort, x, y } — clientX/Y of an in-progress cable drag

export function initModular(logFn) {
    _logFn = logFn || null;
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) _graph = fromJSON(saved);
    } catch (_) {}
}

function persist() { try { localStorage.setItem(STORAGE_KEY, toJSON(_graph)); } catch (_) {} }

function afterStructuralChange() {
    persist();
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

function clientToCanvas(clientX, clientY) {
    const r = _canvasEl.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
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
            <button class="modular-save" title="save patch to a .json file">⇩</button>
            <button class="modular-loadbtn" title="load a patch .json file">⇧</button>
            <button class="modular-clearbtn" title="clear the patch">clear</button>
            <div class="modular-drag"></div>
            <button class="modular-close" title="close">×</button>
        </div>
        <div class="modular-body">
            <div class="modular-palette"></div>
            <div class="modular-canvas-wrap">
                <div class="modular-canvas">
                    <svg class="modular-cables"></svg>
                </div>
            </div>
            <div class="modular-side">
                <div class="modular-status"></div>
                <textarea class="modular-code" readonly spellcheck="false"></textarea>
            </div>
        </div>
        <input type="file" class="modular-file-input" accept="application/json" hidden>`;
    document.body.appendChild(_panel);

    _canvasEl  = _panel.querySelector('.modular-canvas');
    _svgEl     = _panel.querySelector('.modular-cables');
    _codeEl    = _panel.querySelector('.modular-code');
    _statusEl  = _panel.querySelector('.modular-status');
    _nameInput = _panel.querySelector('.modular-name');
    _fileInput = _panel.querySelector('.modular-file-input');

    _panel.querySelector('.modular-close').onclick = closeModular;
    _panel.querySelector('.modular-define').onclick = onDefine;
    _panel.querySelector('.modular-save').onclick = savePatch;
    _panel.querySelector('.modular-loadbtn').onclick = () => _fileInput.click();
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
    renderPalette();
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
    const paletteEl = _panel.querySelector('.modular-palette');
    paletteEl.innerHTML = '';
    for (const [type, def] of Object.entries(BLOCKS)) {
        const btn = document.createElement('button');
        btn.className = 'modular-palette-btn';
        btn.textContent = def.label;
        btn.title = `add a ${def.label} block`;
        btn.onclick = () => {
            const n = _graph.nodes.length;
            const x = 30 + (n % 5) * 190;
            const y = 30 + Math.floor(n / 5) * 170;
            addNode(_graph, type, x, y, defaultParams(type));
            afterStructuralChange();
        };
        paletteEl.appendChild(btn);
    }
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
            outDot.onpointerdown = (e) => { e.stopPropagation(); startWireDrag(node.id, e); };
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
        node.x = Math.max(0, ox + e.clientX - sx);
        node.y = Math.max(0, oy + e.clientY - sy);
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
        const target = document.elementsFromPoint(ev.clientX, ev.clientY)
            .find(x => x.classList && x.classList.contains('modular-dot-in'));
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
    const { source, error } = generateSource(_graph);
    _codeEl.value = error ? `// ${error}` : source;
}

async function onDefine() {
    const name = (_nameInput.value || '').trim();
    if (!name) { setStatus('name it first', 'error'); return; }
    setStatus('compiling…', 'info');
    try {
        await compileAndDefine(name, _graph);
        setStatus(`✓ "${name}" defined — try:  p1 >> ${name}([0,4,7])`, 'ok');
        if (_logFn) _logFn(`modular: "${name}" defined ✓`, 'ok');
    } catch (e) {
        setStatus(`✗ ${e.message}`, 'error');
    }
}

function setStatus(msg, kind) {
    _statusEl.textContent = msg;
    _statusEl.className = 'modular-status ' + (kind || '');
}

// ── Panel open/close + persistence-facing API ───────────────────────────────
export function openModular() {
    if (!_panel) build();
    _open = true;
    _panel.classList.remove('hidden');
    afterStructuralChange();
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
}
