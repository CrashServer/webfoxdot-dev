// ── Desktop UI — crashDot on an infinite pan/zoom canvas ─────────────────────
//
// An OPTIONAL second layout, off by default. The classic one (fixed toolbar,
// editor column, right-hand crash panel) is untouched and stays the default; this
// takes the same DOM and scatters it across a zoomable workspace as draggable,
// resizable, snapping panels — the editor among them, not around them.
//
// The canvas and panel system are ported from the stars/workshop VJ tool
// (js/ui/desktop/canvas.js · panel.js), which is where the idea comes from.
//
// The trick that makes this cheap: panels do not RE-BUILD anything. Each one is
// handed an element that already exists — #editor-wrap, #log, a .cp-section — and
// adopts it. Every getElementById in the rest of the app keeps resolving, every
// listener stays attached, and the mixer/modular/parts/docs overlays go on
// floating above the canvas exactly as they do now.
//
// Leaving desktop mode is a RELOAD, deliberately. Moving a dozen live nodes back
// into a layout they no longer remember is a lot of code to get subtly wrong, and
// the mode is persisted, so a reload lands you exactly where you asked to be.

import { initCanvas, resetView, getZoom, onViewChange, panToReveal } from './canvas.js';
import { createPanel, resetAllLayouts } from './panel.js';
import { mountScreen, toggleBackdrop } from './screens.js';

/**
 * Give one of the floating overlays a panel, whenever its root shows up.
 * The root keeps its own show/hide logic; the panel just follows it.
 */
function hostFloating(canvas, spec, clock) {
    let panel = null;
    const hiddenNow = (el) => spec.attr ? el.hasAttribute('hidden') : el.classList.contains('hidden');

    // Anything that sizes a canvas from its container measured 0×0 while the panel
    // was display:none, and most of these modules only re-measure on a window
    // resize — the galaxy is the loud case: its canvas stayed 0×0 and it rendered
    // nothing at all. Nudge them once the panel actually has a box.
    // Sent twice on purpose. These modules resize synchronously inside their own
    // show() — while the panel is still display:none, so they measure 0×0 — and the
    // observer that flips the panel visible only runs afterwards. The immediate
    // dispatch catches that (reading a box here forces the pending layout); the
    // rAF one covers anything that needs a settled frame.
    let pending = false;
    const remeasure = () => {
        window.dispatchEvent(new Event('resize'));
        if (pending) return;                  // a resize DRAG calls this per pointermove
        pending = true;
        requestAnimationFrame(() => { pending = false; window.dispatchEvent(new Event('resize')); });
    };

    const sync = (el) => {
        if (!panel) return;
        const hid = hiddenNow(el);
        panel.el.style.display = hid ? 'none' : '';
        if (hid) return;
        panel.bringToFront?.();
        remeasure();
        // These live below the main cluster, so opening one from the toolbar would
        // otherwise put it somewhere off-screen and leave you to go hunting. Only
        // pans when it is actually out of view.
        panToReveal(panel.el);
    };

    const adopt = (el) => {
        if (panel) return;
        panel = createPanel(canvas, { ...spec, onResize: remeasure });
        panel.body.classList.add('wfd-panel-body', 'wfd-float-body');
        panel.body.appendChild(el);
        el.classList.add('wfd-hosted');
        // These modules each brought their own header bar, and it USED to be their
        // drag handle — so that is what people reach for. Make it move the panel
        // rather than doing nothing, which reads as "the position was not saved".
        for (const h of el.querySelectorAll(
            ':scope > .mixer-head, :scope > .modular-head, :scope > .parts-head, ' +
            ':scope > .rules-head, :scope > .piano-head, :scope > #galaxy-head'))
            panel.addDragHandle(h);
        // Its own toggles just add/remove .hidden (or the hidden attribute) — watch
        // for that and move the PANEL, so nothing in those modules has to know.
        new MutationObserver(() => sync(el))
            .observe(el, { attributes: true, attributeFilter: ['class', 'hidden'] });
        addBackdropButton(panel.el, clock);
        sync(el);
    };

    const present = document.querySelector(spec.sel);
    if (present) { adopt(present); return; }
    // Built lazily on first open — wait for it to turn up on <body>.
    const watch = new MutationObserver(() => {
        const el = document.querySelector(spec.sel);
        if (el) { watch.disconnect(); adopt(el); }
    });
    watch.observe(document.body, { childList: true });
}

// A ▦ button in every panel header: run the visuals behind that panel's content.
// Added from out here rather than inside createPanel so the ported panel system
// stays a straight copy of the workshop's — this is crashDot's business, not its.
function addBackdropButton(panelEl, clock) {
    const head = panelEl.querySelector('.panel-head');
    if (!head) return;
    const b = document.createElement('button');
    b.className = 'panel-backdrop-btn';
    b.textContent = '\u25a6';
    b.title = 'run the visuals behind this panel (needs a video player: video1 >> plasma())';
    b.addEventListener('click', (e) => {
        e.stopPropagation();
        b.classList.toggle('on', toggleBackdrop(panelEl, clock));
    });
    // Before the collapse/close cluster, after the title.
    head.insertBefore(b, head.querySelector('.panel-collapse') || null);
}

// ── Keeping CodeMirror out of the canvas scale ───────────────────────────────
//
// CodeMirror converts a screen-space Y delta — from getBoundingClientRect(), which an
// ancestor transform scales — into document space using line heights it measured with
// offsetHeight, which it does not. Inside a scaled canvas the two disagree by
// lineHeight × (1 - zoom) PER LINE, so at 76% zoom a click twelve lines down lands
// three lines high and the caret drifts further the further you go. Unlike the gutter
// offset there is no single value to correct: it is the whole vertical measurement
// layer, and patching that means forking CodeMirror.
//
// So the editor is taken out of the scale instead. Its content sits in a layer that
// is counter-scaled by 1/zoom — net screen scale exactly 1, whatever the canvas is
// doing — sized to bodyBox × zoom so it still fills the panel, with the font size
// scaled by zoom to match. The result looks like zoom because it IS zoom: real
// layout at a real font size, so every measurement CodeMirror makes is consistent
// and the cursor lands where you click.
let editorBody = null, editorLayer = null, baseFontPx = 14;
// The zoom the layer was last laid out for. Between settles the layer keeps this
// geometry and simply rides the canvas transform, which costs nothing.
let settledZoom = 1;

// Re-lay the editor out for the current zoom. This is the expensive path: it writes
// geometry and then makes CodeMirror re-measure and re-render its whole viewport.
function keepEditorUnscaled(editor) {
    if (!editorBody || !editorLayer) return;
    const z = getZoom() || 1;
    const w = editorBody.clientWidth, h = editorBody.clientHeight;
    if (!w || !h) return;
    settledZoom = z;
    editorLayer.style.width  = `${w * z}px`;
    editorLayer.style.height = `${h * z}px`;
    editorLayer.style.transform = z === 1 ? '' : `scale(${1 / z})`;
    editorLayer.style.fontSize  = `${baseFontPx * z}px`;
    editor?.refresh?.();
}

// While a zoom gesture is running, do NOTHING. The layer's CSS size and font stay at
// the last settled zoom and its transform stays scale(1/settledZoom), so the canvas's
// own scale carries it: apparent size is base × settledZoom × canvasZoom / settledZoom
// = base × canvasZoom, which is exactly right. Only the internal measurement basis is
// stale — and nobody places a cursor mid-pinch. One relayout when the gesture stops.
//
// This is the whole fix for zoom disturbing audio: a wheel tick used to force a full
// CodeMirror refresh, and wheel ticks arrive faster than the note scheduler's 120ms
// lookahead can absorb.
let _scaleTimer = null;
function scheduleEditorScale(editor) {
    clearTimeout(_scaleTimer);
    _scaleTimer = setTimeout(() => keepEditorUnscaled(editor), 140);
}

// ── CodeMirror under a scaled ancestor ───────────────────────────────────────
// CodeMirror pins its gutter with
//     r = (scroller.rect.left - sizer.rect.left) - scrollLeft + doc.scrollLeft
//     gutters.style.left = r + gutters.offsetWidth
// and that mixes two coordinate systems: getBoundingClientRect() is scaled by any
// ancestor transform, while scrollLeft, offsetWidth and the style px it writes are
// not. At scale 1 the two terms cancel to 0; at scale z they leave
//     left = gutterWidth × (1 - z)
// which slides the gutter to the RIGHT, over the first character of every line —
// at 48px of gutter and 80% zoom, exactly the 9.2px of text that goes missing.
//
// So recompute the same quantity entirely in unscaled px and write it back. The
// only real input is the horizontal scroll, which is 0 whenever line wrapping is
// on, so in practice this pins the gutter where it belongs.
function unskewGutter(editor) {
    const wrap = editor.getWrapperElement?.();
    const gutters = wrap?.querySelector('.CodeMirror-gutters');
    if (!gutters) return;
    const sl = editor.getScrollInfo().left || 0;
    const gw = gutters.offsetWidth;
    gutters.style.left = `${-sl}px`;
    for (const el of wrap.querySelectorAll('.CodeMirror-gutter-wrapper, .CodeMirror-gutter-background'))
        el.style.left = `${-gw - sl}px`;
}

const MODE_KEY = 'wfd-ui-mode';

export function desktopModeOn() {
    try {
        const q = new URLSearchParams(location.search).get('ui');
        if (q === 'desktop') return true;
        if (q === 'classic') return false;
        return localStorage.getItem(MODE_KEY) === 'desktop';
    } catch (_) { return false; }
}

export function setDesktopMode(on) {
    try { localStorage.setItem(MODE_KEY, on ? 'desktop' : 'classic'); } catch (_) {}
}

// Panels are placed inside the "home" rectangle canvas.js draws (1920×1080), so
// the default arrangement is findable again after any amount of panning.
const PANELS = [
    { id: 'wfd-editor',  title: 'editor',      x:   0, y:   0, w: 1080, h: 620, minW: 420, minH: 200, adopt: ['#editor-tabs', '#editor-wrap'] },
    { id: 'wfd-log',     title: 'log',         x:   0, y: 642, w: 1080, h: 220, minW: 300, minH: 90,  adopt: ['#log'] },
    { id: 'wfd-clock',   title: 'clock',       x:1102, y:   0, w:  400, h: 210, minW: 260, minH: 110, adopt: ['#cp-clock'] },
    { id: 'wfd-players', title: 'players',     x:1102, y: 232, w:  400, h: 300, minW: 260, minH: 110, adopt: ['#cp-players'] },
    { id: 'wfd-compo',   title: 'composition', x:1102, y: 554, w:  400, h: 420, minW: 260, minH: 140, adopt: ['#cp-compo'] },
    { id: 'wfd-session', title: 'session',     x:1524, y:   0, w:  390, h: 420, minW: 280, minH: 140, adopt: ['#cp-session', '#cp-link'] },
    { id: 'wfd-midi',    title: 'midi',        x:1524, y: 442, w:  390, h: 230, minW: 280, minH: 110, adopt: ['#cp-midi'] },
    { id: 'wfd-settings',title: 'settings',    x:1524, y: 694, w:  390, h: 300, minW: 280, minH: 140, adopt: ['#cp-settings'] },
    // A monitor on the canvas: video1 >> plasma() plays HERE, next to the code that
    // drives it, instead of in a pop-out window on another screen.
    { id: 'wfd-screen',  title: 'screen',      x:   0, y: 884, w: 1080, h: 400, minW: 240, minH: 140, screen: true },
];

// The floating overlays — mixer, modular, parts, room rules, docs, galaxy — get
// the same treatment, but they cannot be adopted up front: each builds its root
// lazily the first time you open it, so most of them do not exist yet. Instead we
// watch for the root to appear, adopt it then, and mirror its own hidden state
// onto the panel — which means every existing toggle (the toolbar buttons, the ✕
// in their own headers, Escape) keeps working with no change to those modules.
//
// Perform mode is deliberately NOT here. It is a full-screen, keyboard-free touch
// surface for playing live; shrinking it into a panel on a zoomable canvas would
// take away the one thing it is for.
const FLOATING = [
    { sel: '#docs-panel',     id: 'wfd-docs',    title: 'docs',       x:1102, y:1106, w: 812, h: 520, minW: 380, minH: 220 },
    { sel: '#mixer-modal',    id: 'wfd-mixer',   title: 'mixer',      x:   0, y:1310, w: 760, h: 400, minW: 300, minH: 180 },
    { sel: '#modular-panel',  id: 'wfd-modular', title: 'modular',    x:   0, y:1732, w: 940, h: 580, minW: 400, minH: 260 },
    { sel: '#parts-modal',    id: 'wfd-parts',   title: 'parts',      x: 782, y:1310, w: 480, h: 400, minW: 300, minH: 200 },
    { sel: '#rules-modal',    id: 'wfd-rules',   title: 'room rules', x:1284, y:1310, w: 360, h: 400, minW: 280, minH: 180 },
    { sel: '#piano-modal',    id: 'wfd-piano',   title: 'piano',      x:   0, y:2334, w: 660, h: 260, minW: 340, minH: 200 },
    // The galaxy paints an absolutely-positioned starfield canvas, so its host needs
    // to be a positioned ancestor — see .wfd-hosted below.
    { sel: '#galaxy-overlay', id: 'wfd-galaxy',  title: 'galaxy',     x: 962, y:1732, w: 820, h: 580, minW: 320, minH: 240, attr: true },
];

/**
 * Switch the running app onto the canvas. Call once, after the editor and the
 * crash panel exist.
 * @param {object} editor      CodeMirror instance (told to refresh on resize)
 * @param {function} onReady   called with the desktop element once built
 */
export function initDesktop(editor, clock = null, editorFactory = null, onDropEditor = null, onReady = null) {
    const body = document.body;
    body.classList.add('desktop-ui');

    const desktop = document.createElement('div');
    desktop.id = 'desktop';
    const canvas = document.createElement('div');
    canvas.id = 'wfd-canvas';
    desktop.appendChild(canvas);

    const zoomInd = document.createElement('button');
    zoomInd.id = 'canvas-zoom-ind';
    zoomInd.title = 'zoom — click to reset the view';
    zoomInd.textContent = '100%';
    desktop.appendChild(zoomInd);

    document.body.appendChild(desktop);
    initCanvas(canvas);

    // CodeMirror measures its own geometry, so it has to be refreshed whenever its
    // panel changes size — during the drag, not only at the end, or the text lags
    // a frame behind the box it lives in.
    const refresh = () => editor?.refresh?.();

    for (const spec of PANELS) {
        const src = spec.screen ? [] : spec.adopt.map(sel => document.querySelector(sel)).filter(Boolean);
        if (!spec.screen && !src.length) continue;   // a section this build doesn't have

        const { el: panelEl, body: panelBody } = createPanel(canvas, {
            ...spec,
            onResize: spec.id === 'wfd-editor' ? () => scheduleEditorScale(editor) : undefined,
        });
        panelBody.classList.add('wfd-panel-body', `wfd-body-${spec.id}`);
        if (spec.screen) mountScreen(panelBody, clock);
        if (spec.id === 'wfd-editor') {
            // The editor gets a counter-scale layer — see keepEditorUnscaled().
            editorBody = panelBody;
            editorLayer = document.createElement('div');
            editorLayer.className = 'wfd-cm-layer';
            panelBody.appendChild(editorLayer);
            for (const el of src) editorLayer.appendChild(el);
        } else {
            for (const el of src) panelBody.appendChild(el);   // adopt, don't rebuild
        }

        addBackdropButton(panelEl, clock);
    }

    for (const spec of FLOATING) hostFloating(canvas, spec, clock);

    // ── Detached buffers ────────────────────────────────────────────────────
    // A scratch buffer pulled off the tab strip gets its own panel with its own
    // CodeMirror on the SAME document. Two editors, one doc is not allowed by
    // CodeMirror, which is why the strip switches away before handing it over.
    //
    // The new editor is built by index.html's factory, so it carries the identical
    // options and keymap — and focusing it re-points the app's `editor` binding at
    // it, which is what makes Ctrl+Enter and the nudge keys work in a detached
    // panel without any of the run machinery knowing panels exist.
    let detachedN = 0;
    function detachBuffer(name, doc, onReattach) {
        if (!editorFactory) return false;
        const id = 'wfd-buf-' + String(name).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        const step = detachedN++ % 4;
        const panel = createPanel(canvas, {
            id, title: name,
            x: 1102 + step * 28, y: 1106 + step * 28, w: 720, h: 440, minW: 320, minH: 160,
        });
        panel.body.classList.add('wfd-panel-body', 'wfd-buf-body');
        const layer = document.createElement('div');
        layer.className = 'wfd-cm-layer';
        panel.body.appendChild(layer);
        const cm = editorFactory(layer, doc);

        // Detached editors are counter-scaled the same way the main one is — see
        // keepEditorUnscaled(). Their geometry is simpler: they own their whole body.
        const rescale = () => {
            const z = getZoom() || 1;
            const w = panel.body.clientWidth, h = panel.body.clientHeight;
            if (!w || !h) return;
            layer.style.width = `${w * z}px`;
            layer.style.height = `${h * z}px`;
            layer.style.transform = z === 1 ? '' : `scale(${1 / z})`;
            layer.style.fontSize = `${baseFontPx * z}px`;
            cm.refresh();
            unskewGutter(cm);
        };
        let t = null;
        const schedule = () => { clearTimeout(t); t = setTimeout(rescale, 140); };
        onViewChange(schedule);
        cm.on('update', () => unskewGutter(cm));
        rescale();
        requestAnimationFrame(rescale);

        // ⤺ sends the buffer back to the strip and takes the panel away with it.
        const back = document.createElement('button');
        back.className = 'panel-backdrop-btn';
        back.textContent = '\u2934';
        back.title = 'send this buffer back to the tab strip';
        back.addEventListener('click', (e) => {
            e.stopPropagation();
            clearTimeout(t);
            cm.swapDoc(new CodeMirror.Doc('', 'foxdot'));   // release the doc first
            onReattach?.(name, doc);
            onDropEditor?.(cm);            // stop it being "the focused editor"
            panel.el.remove();
        });
        panel.el.querySelector('.panel-head')
             ?.insertBefore(back, panel.el.querySelector('.panel-collapse') || null);

        addBackdropButton(panel.el, clock);
        panToReveal(panel.el);
        return true;
    }

    // The toolbar is NOT a panel: STOP is a panic button and must never be
    // somewhere you have to pan to find. Lift it out of the (now empty) editor
    // column so it can be pinned over the canvas.
    const toolbar = document.getElementById('toolbar');
    if (toolbar) {
        document.body.appendChild(toolbar);
        // The bar wraps to two rows on a narrow window, so measure it rather than
        // assume — the canvas starts wherever it actually ends.
        const setH = () => document.documentElement.style.setProperty(
            '--toolbar-h', toolbar.offsetHeight + 'px');
        setH();
        new ResizeObserver(setH).observe(toolbar);
    }

    // Whatever is left of the classic chrome is now empty scaffolding.
    document.getElementById('crash-panel')?.remove();
    document.getElementById('cp-backdrop')?.remove();
    document.getElementById('editor-container')?.classList.add('is-desktop-host');

    // CodeMirror caches its gutter width and line geometry from a measurement it
    // takes when it is laid out. It has just been re-parented into a panel that is
    // itself inside a scaled canvas, so the first measurement is of a box that no
    // longer exists — which shows up as the text sliding under the line numbers.
    // Refresh once the browser has actually laid the panel out, then again after
    // the fit-to-home zoom has settled.
    refresh();
    requestAnimationFrame(refresh);
    setTimeout(refresh, 80);
    window.addEventListener('resize', refresh);

    // CodeMirror rewrites the gutter offset on every display update, so the
    // correction has to run after each one — and after any zoom change.
    if (editor) {
        // Remember the authored font size before anything scales it.
        try {
            const px = parseFloat(getComputedStyle(editor.getWrapperElement()).fontSize);
            if (px > 0) baseFontPx = px;
        } catch (_) {}
        onViewChange(() => scheduleEditorScale(editor));   // coalesced — see above
        keepEditorUnscaled(editor);
        requestAnimationFrame(() => keepEditorUnscaled(editor));

        // The gutter correction stays: it is cheap, and it is what keeps the editor
        // correct in the one case the counter-scale cannot cover — a panel BACKDROP
        // or any future content that does sit inside the scale.
        const fix = () => unskewGutter(editor);
        editor.on('update', fix);
        editor.on('refresh', fix);
        fix();
        setTimeout(fix, 100);
    }

    onReady?.(desktop);
    return { desktop, canvas, resetView, getZoom, resetAllLayouts, detachBuffer };
}
