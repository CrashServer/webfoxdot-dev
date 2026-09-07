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

import { initCanvas, resetView, getZoom, onViewChange } from './canvas.js';
import { createPanel, resetAllLayouts } from './panel.js';
import { mountScreen, toggleBackdrop } from './screens.js';

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

/**
 * Switch the running app onto the canvas. Call once, after the editor and the
 * crash panel exist.
 * @param {object} editor      CodeMirror instance (told to refresh on resize)
 * @param {function} onReady   called with the desktop element once built
 */
export function initDesktop(editor, clock = null, onReady = null) {
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
            onResize: spec.id === 'wfd-editor' ? refresh : undefined,
        });
        panelBody.classList.add('wfd-panel-body', `wfd-body-${spec.id}`);
        if (spec.screen) mountScreen(panelBody, clock);
        for (const el of src) panelBody.appendChild(el);   // adopt, don't rebuild

        addBackdropButton(panelEl, clock);
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
        const fix = () => unskewGutter(editor);
        editor.on('update', fix);
        editor.on('refresh', fix);
        onViewChange(fix);
        fix();
        setTimeout(fix, 100);
    }

    onReady?.(desktop);
    return { desktop, canvas, resetView, getZoom, resetAllLayouts };
}
