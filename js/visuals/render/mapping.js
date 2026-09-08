// ── Projection mapping for the output window ─────────────────────────────────
//
// Corner-pin warp + edge blending, ported from the workshop's warp.js and
// edgeBlend.js. This is the thing you need the moment the projector is not
// square-on to the wall, and the thing you need twice the moment there are two
// projectors.
//
// The workshop's key insight, kept: the warp is a CSS **matrix3d**, not a shader.
// Solving the homography that maps the unit square onto four dragged corners and
// handing it to the compositor costs nothing, needs no render-pass changes, and works
// on ANY element — which matters here, because crashDot's output is two stacked
// canvases (#visgl for the GPU path, #vis for glyph modes and the idle screen) and
// they must warp identically or the overlay slides off the picture. Same matrix on
// both, plus the blend overlay, and they stay welded together.
//
// Edge blending is a DOM overlay of four black gradients rather than the workshop's
// canvas gradients, for the same reason: the GL canvas has no 2D context to draw into,
// and a CSS gradient is resolution-independent and composited on the GPU. It is warped
// with everything else, so the blend edges follow the projected quad rather than the
// screen.
//
// [w] shows the handles here, the same key an output window uses, and for the same
// reason: with two places you can warp — this window, and any output surface — one
// verb has to mean one thing. ([m] is taken: inside an output it cycles the warp MODE.)
//
// NOT SHARED, and that is deliberate. Corners and blends describe a physical room —
// where this projector sits, what it overlaps. They live in localStorage and never
// touch the vstate or the collab channel, so joining a jam cannot yank a calibrated
// projector. The workshop reached the same conclusion and excludes output mapping from
// its presets: "tied to the physical room, not a visual look".

const KEY = 'crashdot-mapping';
const FLAT = () => [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const NO_BLEND = () => ({ left: 0, right: 0, top: 0, bottom: 0 });

// Unit square (0,0)(1,0)(1,1)(0,1) → quad, as a column-major 4x4 for matrix3d().
// The standard 8-DOF adjoint solution; `corners` are in the box's own pixel space.
function homography(corners, w, h) {
    const [p0, p1, p2, p3] = corners;
    const x0 = p0.x, y0 = p0.y, x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y, x3 = p3.x, y3 = p3.y;
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
    const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    let g, h_;
    if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) { g = 0; h_ = 0; }
    else {
        const det = dx1 * dy2 - dx2 * dy1;
        if (Math.abs(det) < 1e-12) return null;          // degenerate quad — keep the last good one
        g = (dx3 * dy2 - dx2 * dy3) / det;
        h_ = (dx1 * dy3 - dx3 * dy1) / det;
    }
    const a = x1 - x0 + g * x1, b = x3 - x0 + h_ * x3, c = x0;
    const d = y1 - y0 + g * y1, e = y3 - y0 + h_ * y3, f = y0;
    const sx = 1 / w, sy = 1 / h;
    const m = [a * sx, b * sy, c, d * sx, e * sy, f, g * sx, h_ * sy, 1];
    return [m[0], m[3], 0, m[6], m[1], m[4], 0, m[7], 0, 0, 1, 0, m[2], m[5], 0, m[8]];
}

function load() {
    try {
        const s = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (s && Array.isArray(s.corners) && s.corners.length === 4)
            return { corners: s.corners.map(p => ({ x: +p.x, y: +p.y })), blend: { ...NO_BLEND(), ...(s.blend || {}) } };
    } catch (_) {}
    return { corners: FLAT(), blend: NO_BLEND() };
}

/**
 * @param {Element} host      where the handles and overlay live (document.body)
 * @param {Element[]} targets the elements to warp together (both canvases)
 * @param {function} [onLog]  optional status line
 */
export function attachMapping(host, targets, onLog = () => {}) {
    let { corners, blend } = load();
    let editing = false;

    const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ corners, blend })); } catch (_) {} };

    // The blend overlay warps WITH the picture — four black gradients, one per edge,
    // each fading inward. That is what a projector in an overlap zone actually does:
    // it fades its own light out where the neighbour's begins.
    const overlay = document.createElement('div');
    overlay.className = 'wfd-map-blend';
    overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3;transform-origin:0 0;';
    host.appendChild(overlay);

    const ui = document.createElement('div');
    ui.className = 'wfd-map-ui';
    ui.style.cssText = 'position:fixed;inset:0;z-index:10;display:none;';
    host.appendChild(ui);

    const handles = corners.map((_, i) => {
        const el = document.createElement('div');
        el.style.cssText = 'position:absolute;width:22px;height:22px;margin:-11px;border-radius:50%;'
            + 'background:#63b982;border:2px solid #000;cursor:grab;touch-action:none;box-shadow:0 0 0 1px #63b982;';
        el.title = ['top-left', 'top-right', 'bottom-right', 'bottom-left'][i];
        ui.appendChild(el);
        return el;
    });

    const panel = document.createElement('div');
    panel.style.cssText = 'position:absolute;left:12px;top:12px;padding:8px 10px;background:rgba(0,0,0,.82);'
        + 'border:1px solid #2c3a44;border-radius:5px;font:11px/1.6 monospace;color:#8a97a0;min-width:186px;';
    panel.innerHTML = '<div style="color:#63b982;margin-bottom:4px">PROJECTION MAPPING</div>'
        + '<div style="margin-bottom:6px">drag the corners · [w] done · [r] reset</div>';
    const rows = {};
    for (const edge of ['left', 'right', 'top', 'bottom']) {
        const row = document.createElement('label');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;';
        const name = document.createElement('span'); name.textContent = 'blend ' + edge.padEnd(6); name.style.whiteSpace = 'pre';
        const r = document.createElement('input');
        r.type = 'range'; r.min = '0'; r.max = '0.5'; r.step = '0.005'; r.value = String(blend[edge]);
        r.style.cssText = 'flex:1;accent-color:#63b982;';
        const val = document.createElement('span'); val.style.width = '30px'; val.textContent = blend[edge].toFixed(2);
        r.addEventListener('input', () => { blend[edge] = +r.value; val.textContent = (+r.value).toFixed(2); paintBlend(); save(); });
        row.append(name, r, val);
        panel.appendChild(row);
        rows[edge] = { r, val };
    }
    ui.appendChild(panel);

    function box() {
        const t = targets[0];
        return { w: t?.offsetWidth || innerWidth, h: t?.offsetHeight || innerHeight };
    }

    let lastMatrix = null;
    function apply() {
        const { w, h } = box();
        const px = corners.map((c) => ({ x: c.x * w, y: c.y * h }));
        const m = homography(px, w, h) || lastMatrix;
        if (!m) return;
        lastMatrix = m;
        const css = `matrix3d(${m.join(',')})`;
        const flat = corners[0].x === 0 && corners[0].y === 0 && corners[1].x === 1 && corners[1].y === 0
                  && corners[2].x === 1 && corners[2].y === 1 && corners[3].x === 0 && corners[3].y === 1;
        for (const t of targets) { if (!t) continue; t.style.transformOrigin = '0 0'; t.style.transform = flat ? '' : css; }
        overlay.style.transform = flat ? '' : css;
        handles.forEach((el, i) => { el.style.left = px[i].x + 'px'; el.style.top = px[i].y + 'px'; });
    }

    function paintBlend() {
        const g = [];
        if (blend.left)   g.push(`linear-gradient(to right, #000 0%, transparent ${blend.left * 100}%)`);
        if (blend.right)  g.push(`linear-gradient(to left,  #000 0%, transparent ${blend.right * 100}%)`);
        if (blend.top)    g.push(`linear-gradient(to bottom,#000 0%, transparent ${blend.top * 100}%)`);
        if (blend.bottom) g.push(`linear-gradient(to top,   #000 0%, transparent ${blend.bottom * 100}%)`);
        overlay.style.background = g.join(',');
        overlay.style.display = g.length ? '' : 'none';
    }

    handles.forEach((el, i) => {
        el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            try { el.setPointerCapture(e.pointerId); } catch (_) {}
            const move = (ev) => {
                const { w, h } = box();
                // Past the edge is allowed — a projector often has to throw beyond the
                // surface — but not so far that the quad inverts and the picture is lost.
                corners[i] = { x: Math.max(-0.5, Math.min(1.5, ev.clientX / w)),
                               y: Math.max(-0.5, Math.min(1.5, ev.clientY / h)) };
                apply();
            };
            const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); save(); };
            el.addEventListener('pointermove', move);
            el.addEventListener('pointerup', up);
        });
    });

    function setEditing(on) {
        editing = !!on;
        ui.style.display = editing ? '' : 'none';
        document.documentElement.style.cursor = editing ? 'default' : '';
        if (editing) for (const e of ['left', 'right', 'top', 'bottom']) {
            rows[e].r.value = String(blend[e]); rows[e].val.textContent = blend[e].toFixed(2);
        }
        onLog(editing ? 'mapping: drag the corners · [w] done · [r] reset' : 'mapping: off');
    }
    function reset() { corners = FLAT(); blend = NO_BLEND(); apply(); paintBlend(); save(); setEditing(editing); }

    addEventListener('resize', apply);
    document.addEventListener('fullscreenchange', apply);
    addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (k === 'w') { setEditing(!editing); e.preventDefault(); }
        else if (k === 'r' && editing) { reset(); e.preventDefault(); }
        else if (k === 'escape' && editing) setEditing(false);
    });

    apply(); paintBlend();
    // A warp that survives a reload but has no visible handles is a bug report waiting
    // to happen ("the picture is crooked and I can't fix it"), so say so once.
    const warped = corners.some((c, i) => c.x !== FLAT()[i].x || c.y !== FLAT()[i].y);
    if (warped) onLog('mapping: a saved projection warp is active — press [w] to adjust, [r] to reset');

    return { setEditing, reset, isEditing: () => editing,
             getCorners: () => corners.map(c => ({ ...c })), getBlend: () => ({ ...blend }) };
}
