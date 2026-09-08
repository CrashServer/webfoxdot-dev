// ── Output windows — projector mapping, on the fly ───────────────────────────
//
// Ported from the workshop's outputs.js, and the reason it is worth porting whole
// rather than reducing to "warp the visuals window":
//
//   ONE OUTPUT = ONE PROJECTOR.  N SURFACES IN IT = N INDEPENDENTLY WARPED PATCHES.
//
// That is how you map onto a physical 3D object without 3D rendering: pin a flat quad
// onto each visible face of a box or a truss corner, give each its own source, and the
// object reads as mapped. MadMapper and Resolume do the same thing. A single warped
// window can only ever fit one flat plane.
//
// Each surface picks its own SOURCE, and crashDot has more of those than the workshop
// did: the master mix, either deck on its own, and — because the live-coding layers now
// get a real feed — any single workshop layer, including the ones that draw your code.
// So one face of the box can carry the visuals while another carries the code that is
// making them.
//
// Rendering is a 2D canvas per surface, not a CSS transform. A mesh warp is a grid of
// texture-mapped triangles and CSS can only express a 4-point projective map, so the
// canvas path is what buys `edge` and `mesh` mode. It also means the source has to be
// read INSIDE the render callback: the GL canvas is created with
// preserveDrawingBuffer:false, so reading it after compositing returns black. That is
// why render() is driven from surface.onFrame() rather than from its own loop.
//
// Mapping is per MACHINE (localStorage), never shared and never part of a look — see
// mapping.js for why. Windows reconnect after a page refresh by name.

import { createMeshWarp, WARP_MODES, GRID_SIZES } from './meshwarp.js';
import { applyEdgeBlend } from './edgeblend.js';
import { createCodeCanvas } from './codecanvas.js';

const KEY = 'crashdot-outputs';
const COLORS = ['#4fd1ff', '#ff9a7f', '#a3ff7f', '#ffd94f', '#c98fff', '#ff6fb0'];

const HTML = `<!doctype html><meta charset="utf-8"><title>crashDot · output</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden;cursor:none}
canvas{position:absolute;left:0;top:0;width:100vw;height:100vh;display:block}
#tip{position:fixed;left:8px;bottom:6px;margin:0;font:11px/1.5 monospace;color:#2c3a44;
     user-select:none;pointer-events:none;white-space:pre;z-index:99}</style>
<pre id="tip">crashDot output · [w] warp  [m] mode 4pt/edge/mesh  [ ] grid  [r] reset  [f] fullscreen</pre>`;

/**
 * @param getSources  () => [{id, label, canvas}] — the live workshop layers
 * @param getBuffers  () => [{name, text}] — the editor buffers, rendered to a texture
 *                    on demand so a surface can show the code itself
 */
export function createOutputs({ getSources, getBuffers = null, onLog = () => {} } = {}) {
    // One canvas per buffer, kept between frames: createCodeCanvas only redraws when
    // the text or the size actually changes, and a buffer is static between keystrokes.
    const bufCanvases = new Map();
    function bufferCanvas(name) {
        const buf = (getBuffers?.() || []).find((b) => b.name === name);
        if (!buf) return null;
        let cc = bufCanvases.get(name);
        if (!cc) { cc = createCodeCanvas(); bufCanvases.set(name, cc); }
        return cc.draw(buf.text, W, H);
    }

    const outputs = [];
    let W = 1280, H = 720;
    let restoring = false;

    const save = () => {
        if (restoring) return;
        try {
            localStorage.setItem(KEY, JSON.stringify(outputs.map((o) => ({
                id: o.id,
                surfaces: o.surfaces.map((s) => ({ source: s.source, blend: s.blend,
                    mode: s.warp.getMode(), grid: s.warp.getGridSize(),
                    corners: s.warp.getCorners(), mesh: s.warp.getMesh() })),
            }))));
        } catch (_) {}
    };

    function sourceCanvas(id, master) {
        if (!id || id === 'master') return master;
        if (id.startsWith('buf:')) return bufferCanvas(id.slice(4)) || master;
        const found = (getSources?.() || []).find((s) => s.id === id);
        return found?.canvas || master;
    }

    /** Everything a surface can point at: the mix, each live layer, each code buffer. */
    function sources() {
        return [
            { id: 'master', label: 'master mix' },
            ...(getSources?.() || []),
            ...(getBuffers?.() || []).map((b) => ({ id: 'buf:' + b.name, label: 'code · ' + b.name })),
        ];
    }

    function addSurface(out, spec = {}) {
        const doc = out.win.document;
        const c = doc.createElement('canvas');
        c.width = W; c.height = H;
        doc.body.appendChild(c);
        const colour = COLORS[out.surfaces.length % COLORS.length];
        const surface = { canvas: c, ctx: c.getContext('2d'),
                          source: spec.source || 'master',
                          blend: { left: 0, right: 0, top: 0, bottom: 0, ...(spec.blend || {}) } };
        surface.warp = createMeshWarp(out.win, c, W, H, colour, () => save());
        // Start at corner-pin, not at the mesh the workshop defaults to. Fitting a flat
        // quad onto a surface is the first thing anyone does and four handles is the
        // whole gesture; a 5x5 mesh is 25 handles to say "the projector is off-square".
        // [m] in the output window steps up to edge and mesh when the wall is curved.
        surface.warp.setMode('4pt');
        if (spec.mode) surface.warp.setMode(spec.mode);
        if (spec.grid) surface.warp.setGridSize(spec.grid);
        if (spec.corners) surface.warp.setCorners(spec.corners);
        if (spec.mesh) surface.warp.setMesh(spec.mesh);
        out.surfaces.push(surface);
        save();
        return surface;
    }

    function open(id = null) {
        const oid = id != null ? id : (outputs.reduce((m, o) => Math.max(m, o.id), 0) + 1);
        const win = window.open('', `crashdot-out-${oid}`, `width=${W},height=${H}`);
        if (!win) { onLog('output: the browser blocked the window — allow pop-ups for crashDot', 'warn'); return null; }
        win.document.open(); win.document.write(HTML); win.document.close();
        win.document.title = `crashDot · output ${oid}`;
        // [f] is the one key the output owns itself; the warp binds the rest.
        win.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() !== 'f') return;
            win.document.fullscreenElement ? win.document.exitFullscreen?.()
                                           : win.document.documentElement.requestFullscreen?.();
        });
        const out = { id: oid, win, surfaces: [] };
        outputs.push(out);
        return out;
    }

    /** outputs.add() — a new projector window with one full-frame surface. */
    function addOutput() {
        const out = open();
        if (!out) return null;
        addSurface(out);
        save();
        onLog(`output ${out.id} opened — [w] to warp it, [f] for fullscreen`, 'ok');
        return out;
    }

    function prune() {
        for (let i = outputs.length - 1; i >= 0; i--) if (outputs[i].win.closed) outputs.splice(i, 1);
        save();
    }

    /**
     * Draw every surface. MUST be called from inside the renderer's frame callback —
     * the GL canvas has preserveDrawingBuffer:false, so reading it any later is black.
     */
    function render(master) {
        if (!outputs.length) return;
        if (outputs.some((o) => o.win.closed)) prune();
        for (const o of outputs) {
            if (o.win.closed || o.win.document.hidden) continue;
            for (const s of o.surfaces) {
                const src = sourceCanvas(s.source, master);
                if (!src || !src.width) continue;
                s.ctx.clearRect(0, 0, W, H);
                s.warp.drawMeshWarp(s.ctx, src);          // identity = a straight copy
                const b = s.blend;
                if (b.left || b.right || b.top || b.bottom) applyEdgeBlend(s.ctx, W, H, b);
            }
        }
    }

    function restore() {
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
        if (!Array.isArray(saved) || !saved.length) return 0;
        // Windows are NOT reopened on their own — a page refresh that spawns projector
        // windows unasked is worse than one that forgets them. The mapping is kept and
        // reattached the moment you open an output with that id again.
        return saved.length;
    }

    /** Reopen a saved output by index, warp and all. */
    function reopen(i) {
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
        const spec = Array.isArray(saved) ? saved[i] : null;
        if (!spec) return null;
        const out = open(spec.id);
        if (!out) return null;
        restoring = true;
        for (const s of (spec.surfaces || [{}])) addSurface(out, s);
        restoring = false;
        onLog(`output ${out.id} reopened with its mapping`, 'ok');
        return out;
    }

    return {
        addOutput, addSurface, render, prune, reopen, restore, sources,
        list: () => outputs.map((o) => ({ id: o.id, surfaces: o.surfaces.length, closed: o.win.closed })),
        get: (i) => outputs[i],
        count: () => outputs.length,
        setSize(w, h) { W = w | 0 || W; H = h | 0 || H; },
        removeSurface(out, i) { const s = out.surfaces[i]; if (!s) return; s.warp.destroy?.(); s.canvas.remove(); out.surfaces.splice(i, 1); save(); },
        setSource(out, i, id) { if (out.surfaces[i]) { out.surfaces[i].source = id; save(); } },
        setBlend(out, i, edge, v) { const s = out.surfaces[i]; if (s) { s.blend[edge] = v; save(); } },
        close(i) { outputs[i]?.win.close(); prune(); },
        MODES: WARP_MODES, GRIDS: GRID_SIZES,
    };
}
