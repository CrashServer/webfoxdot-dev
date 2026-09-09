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

import { initCanvas, resetView, getZoom, onViewChange, panToReveal, centerOn } from './canvas.js';
import { createPanel, resetAllLayouts, armButton, LAYOUT_KEY } from './panel.js';
import { mountScreen, toggleBackdrop } from './screens.js';
import { buildLayoutsPanel } from './layoutbar.js';
import { buildOutputsPanel } from './outputspanel.js';
import { buildLayersPanel } from './layerspanel.js';
import { initCanvasMenu } from './menu.js';
import { initHud } from './hud.js';
import { changelogHTML } from '../docs.js';

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
        writePanelOpen(spec.id, !hid);
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
        panel = createPanel(canvas, {
            ...spec,
            onResize: remeasure,
            // These modules own their own open flag and their own toggle button.
            // Hiding the PANEL behind their back would leave the two disagreeing and
            // the next press of the toolbar button would do nothing — so the × in the
            // header presses the same button you would.
            onClose: () => closeFloating(spec),
        });
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

// The hosted modules' open state lives in their own root element, not in ours:
// `hidden` as an attribute for some, a .hidden class for the rest. One reader and
// one writer for both, so nothing else has to remember which is which.
function floatingIsOpen(spec) {
    const el = document.querySelector(spec.sel);
    if (!el) return false;
    return !(spec.attr ? el.hasAttribute('hidden') : el.classList.contains('hidden'));
}
function toggleFloating(spec) {
    const btn = document.querySelector(spec.btn);
    if (btn) { btn.click(); return; }
    // No button (or not built yet) — fall back to the flag the module itself uses.
    const el = document.querySelector(spec.sel);
    if (!el) return;
    if (spec.attr) el.toggleAttribute('hidden');
    else el.classList.toggle('hidden');
}
function closeFloating(spec) {
    if (floatingIsOpen(spec)) toggleFloating(spec);
}

// The changelog, as a panel body rather than a tab behind a small version label.
// It reuses the docs markup and stylesheet verbatim, so an entry looks the same
// wherever you read it — including the click-to-expand detail, which is the whole
// reason the changelog is readable at all.
function buildChangelogBody(body) {
    body.classList.add('wfd-changelog-body');
    body.innerHTML = changelogHTML();
    body.addEventListener('click', (e) => {
        const sum = e.target.closest('.cl-summary');
        if (sum) sum.closest('.cl-item')?.classList.toggle('open');
    });
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
    { id: 'wfd-editor',   group: 'workspace', title: 'editor',      x:   0, y:   0, w: 1080, h: 620, minW: 420, minH: 200, adopt: ['#editor-tabs', '#editor-wrap'] },
    { id: 'wfd-log',      group: 'workspace', title: 'log',         x:   0, y: 642, w: 1080, h: 220, minW: 300, minH: 90,  adopt: ['#log'] },
    // The control column, as ONE panel rather than six. It was six because every
    // .cp-section could be one, not because six was the right number — clock,
    // players and composition are read at a glance and midi and settings are set
    // once, so they cost six headers, six borders and six rows in the window list to
    // save nothing. This is what they already were in the classic layout: a single
    // scrolling column of foldable sections, and the fold headers still work here
    // because initFoldableSections() wires them before the desktop adopts them.
    { id: 'wfd-controls', group: 'status', title: 'controls',    x:1102, y:   0, w:  400, h:1220, minW: 280, minH: 160,
      adopt: ['#cp-clock', '#cp-players', '#cp-compo', '#cp-session', '#cp-link', '#cp-midi', '#cp-settings'] },
    // A monitor on the canvas: video1 >> plasma() plays HERE, next to the code that
    // drives it, instead of in a pop-out window on another screen.
    { id: 'wfd-screen',   group: 'workspace', title: 'screen',      x:   0, y: 884, w: 1080, h: 336, minW: 240, minH: 140, screen: true },
    // Saved workspaces: panel positions, sizes, colours and the view. A panel like
    // the rest — the toolbar's LAYOUTS button pans to it and raises it, so it stays
    // findable after you have panned somewhere else.
    { id: 'wfd-layouts',  group: 'workspace', title: 'layouts',     x:1524, y: 642, w:  390, h:  92, minW: 240, minH: 80, layouts: true },
    // ── The top bar, broken into six small panels ────────────────────────────
    // It sat fixed above the canvas on the reasoning that STOP is a panic button and
    // must never be somewhere you have to pan to find — which is still true, and is
    // why stop-all is bound GLOBALLY (Ctrl+; · Ctrl+, · Ctrl+.) rather than living
    // only on that button. With the key always there, the bar has no claim to be the
    // one part of the app that is not a panel.
    //
    // One 1900px-wide strip of sixteen buttons is a list, not a grouping: it forced
    // BOOT to sit next to RUN and GO LIVE next to EXAMPLES, and you learned positions
    // rather than meanings. Split by WHEN you reach for a thing, which is also how
    // often: engine once at the start, transport constantly, the rest in between.
    // Each is a panel like any other — move it, tint it, close it, or ⊙ pin the one
    // you want to keep on screen while you pan (transport is the candidate).
    //
    // ONE RULE decides what belongs here: a bar holds VERBS. Anything whose button
    // only showed or hid a panel — mix, parts, piano, modular, galaxy, docs,
    // layouts — is a NOUN, and nouns are rows in the canvas context menu, which also
    // shows whether the thing is currently open (a button never did) and can centre
    // the view on it. Keeping both was two controls for one state, and the pair could
    // disagree. ZEN and CLASSIC UI went the same way: they act on the VIEW, and the
    // menu is where the view is managed, so the bar that held them is gone.
    //
    // The buttons are ADOPTED, not rebuilt: same elements, same ids, same listeners,
    // so nothing in index.html knows this happened. The ones no longer on a bar stay
    // in the hidden #toolbar — a programmatic .click() still works on them, which is
    // exactly how a menu row toggles a hosted module.
    // Boot and transport in one bar. They are used at different RATES — the kit
    // loads once, stop gets hit all night — but they are adjacent in the only order
    // that matters: boot, load the kit, then run. Splitting them put a panel edge in
    // the middle of that sentence.
    { id: 'wfd-bar-run',        group: 'bars', title: 'run',       x:   0, y: -78, w: 560, h: 66, minW: 110, minH: 44, bar: true,
      adopt: ['#status-dot', '#btn-boot', '#btn-loadkit', '#btn-run', '#btn-stop', '#btn-reload', '#btn-perform', '#synth-status'] },
    // Named for the people, not the verb: SHARE is one of the buttons INSIDE it, and
    // a panel called "share" holding a button called "SHARE" is the same word doing
    // two jobs.
    { id: 'wfd-bar-collab',     group: 'bars', title: 'collab',    x: 582, y: -78, w: 280, h: 66, minW: 110, minH: 44, bar: true,
      adopt: ['#btn-share', '#btn-multiplayer', '#btn-split'] },
    // The app bar rather than a performance one: what to learn from, and which layout
    // to be in. The classic/desktop switch was reachable only from the canvas
    // right-click menu, which is a fine place for it and a poor ONLY place — the one
    // control that gets you out of an experimental layout should be visible from
    // inside it.
    { id: 'wfd-bar-learn',      group: 'bars', title: 'learn',     x: 884, y: -78, w: 360, h: 66, minW: 110, minH: 44, bar: true,
      adopt: ['#btn-tour', '#examples-dd', '#btn-desktop', '#version-tag'] },

    // The changelog was reachable only as a tab inside the docs overlay, behind the
    // small version label. On a canvas you can just leave it open next to the code.
    // Every live video layer, with its parameters as knobs — finding a look by turning
    // something, rather than by typing a number and re-running the line.
    { id: 'wfd-layers',   group: 'workspace', title: 'layers',    x:1102, y:1004, w: 400, h: 210, minW: 300, minH: 120, layers: true },
    // The projector desk: outputs and their warped surfaces, built during a set
    // rather than configured before one.
    { id: 'wfd-outputs',  group: 'workspace', title: 'outputs',   x:1524, y: 756, w: 390, h: 300, minW: 300, minH: 140, outputs: true },
    { id: 'wfd-changelog',  group: 'workspace', title: 'changelog', x:1524, y:   0, w:  390, h: 620, minW: 320, minH: 200, changelog: true },
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
// `btn` is the toolbar control that opens each one. It is how "this panel was open
// last time" gets restored: these modules build themselves lazily and own their own
// open/closed flag, so the honest way to reopen one is to press its button, exactly
// as you would — rather than to reach in and un-hide a root it does not think is
// showing.
const FLOATING = [
    { sel: '#docs-panel',     id: 'wfd-docs',    group: 'learn',  title: 'docs',       btn: '#docs-toggle-btn', x:1102, y:1106, w: 812, h: 520, minW: 380, minH: 220 },
    { sel: '#mixer-modal',    id: 'wfd-mixer',   group: 'tools',  title: 'mixer',      btn: '#btn-mixer',    x:   0, y:1310, w: 760, h: 400, minW: 300, minH: 180 },
    { sel: '#modular-panel',  id: 'wfd-modular', group: 'tools',  title: 'modular',    btn: '#btn-modular',  x:   0, y:1732, w: 940, h: 580, minW: 400, minH: 260 },
    { sel: '#parts-modal',    id: 'wfd-parts',   group: 'tools',  title: 'parts',      btn: '#btn-parts',    x: 782, y:1310, w: 480, h: 400, minW: 300, minH: 200 },
    { sel: '#rules-modal',    id: 'wfd-rules',   group: 'collab', title: 'room rules', btn: '#btn-rules',    x:1284, y:1310, w: 360, h: 400, minW: 280, minH: 180 },
    { sel: '#piano-modal',    id: 'wfd-piano',   group: 'tools',  title: 'piano',      btn: '#btn-piano',    x:   0, y:2334, w: 660, h: 260, minW: 340, minH: 200 },
    // The galaxy paints an absolutely-positioned starfield canvas, so its host needs
    // to be a positioned ancestor — see .wfd-hosted below.
    { sel: '#galaxy-overlay', id: 'wfd-galaxy',  group: 'collab', title: 'galaxy',     btn: '#btn-galaxy',   x: 962, y:1732, w: 820, h: 580, minW: 320, minH: 240, attr: true },
];

// Whether a panel was open is as much a part of the workspace as where it was —
// coming back to a bare canvas and having to reopen the mixer, the piano and the
// modular every time is not "saved". Kept in the same store panel.js uses for
// geometry, so a named layout snapshots it too.
function readPanelLayout() {
    try { return JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}'); } catch (_) { return {}; }
}
function writePanelOpen(id, open) {
    try {
        const all = readPanelLayout();
        all[id] = { ...(all[id] || {}), open };
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(all));
    } catch (_) {}
}

/**
 * Switch the running app onto the canvas. Call once, after the editor and the
 * crash panel exist.
 * @param {object} editor      CodeMirror instance (told to refresh on resize)
 * @param {function} onReady   called with the desktop element once built
 */
// The output manager is supplied by index.html, which owns the renderer the outputs
// read their frames from. Passed in rather than imported so the desktop keeps knowing
// nothing about the visual engine.
let outputsApi = null;
export function setOutputsApi(a) { outputsApi = a; }
let layersApi = null;
export function setLayersApi(a) { layersApi = a; }

export function initDesktop(editor, clock = null, editorFactory = null, onDropEditor = null, log = () => {}, onReady = null) {
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

    // Nothing on the canvas is draggable text except actual editor content. Panel
    // headers, tab strips, hosted module bars, every button label — all of it is
    // chrome, and a native text drag of any of it ends up inserted into whatever
    // editor you drop it on. Guarding the panel header alone was not enough: the
    // tab strip lives in a panel BODY, which was deliberately left draggable.
    // One rule at the top beats a growing list of exceptions underneath.
    desktop.addEventListener('dragstart', (e) => {
        if (!e.target.closest?.('.CodeMirror-lines')) e.preventDefault();
    });

    initCanvas(canvas);

    // CodeMirror measures its own geometry, so it has to be refreshed whenever its
    // panel changes size — during the drag, not only at the end, or the text lags
    // a frame behind the box it lives in.
    const refresh = () => editor?.refresh?.();

    const ownedPanels = new Map();          // id → panel api, for the windows list
    const BUILT = (spec) => spec.screen || spec.layouts || spec.changelog || spec.outputs || spec.layers;
    for (const spec of PANELS) {
        const src = BUILT(spec) ? [] : spec.adopt.map(sel => document.querySelector(sel)).filter(Boolean);
        if (!BUILT(spec) && !src.length) continue;   // not in this build

        const panelApi = createPanel(canvas, {
            ...spec,
            onResize: spec.id === 'wfd-editor' ? () => scheduleEditorScale(editor) : undefined,
        });
        const { el: panelEl, body: panelBody } = panelApi;
        ownedPanels.set(spec.id, panelApi);
        panelBody.classList.add('wfd-panel-body', `wfd-body-${spec.id}`);
        if (spec.bar) panelBody.classList.add('wfd-bar');
        if (spec.screen) {
            const sc = mountScreen(panelBody, clock);
            // SCREEN is a destination like an output window, so the same manager
            // decides what it shows — see outputs.js.
            const oapi = outputsApi?.api;
            oapi?.setScreen?.(sc.overlay);
            if (sc.picker && oapi?.screenSource) {
                const fill = () => {
                    const cur = oapi.screenSource();
                    // Rebuild only when the SET of sources changed — the list grows and
                    // shrinks as layers come and go, and replacing the <select> while it
                    // is open would close it under the pointer.
                    const want = (outputsApi.sources() || []).map((x) => x.id).join('|');
                    if (sc.picker.dataset.sig !== want) {
                        sc.picker.dataset.sig = want;
                        sc.picker.textContent = '';
                        for (const src of outputsApi.sources() || []) {
                            const o = document.createElement('option');
                            o.value = src.id; o.textContent = src.label;
                            sc.picker.appendChild(o);
                        }
                    }
                    // Never while it is open: setting .value on a select whose popup
                    // is showing snaps the highlight back under the pointer, which is
                    // the same "it resets before I can click" the outputs panel had.
                    if (sc.picker.value !== cur && document.activeElement !== sc.picker) sc.picker.value = cur;
                };
                sc.picker.onchange = () => oapi.setScreenSource(sc.picker.value);
                fill();
                setInterval(() => { if (panelEl.offsetParent !== null) fill(); }, 1000);
            }
        }
        if (spec.layouts) buildLayoutsPanel(panelBody, log);
        if (spec.changelog) buildChangelogBody(panelBody);
        if (spec.outputs && outputsApi) buildOutputsPanel(panelBody, outputsApi.api, outputsApi.sources, log);
        if (spec.layers && layersApi) buildLayersPanel(panelBody, layersApi);
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

    // Right-click the canvas for every window, whether it is open, and a GO TO that
    // centres on it — plus the buffers and the view actions. Built last because it
    // reads every panel, and lazily on each open so it is never stale. Owned panels
    // answer for themselves; hosted ones are asked through their own module, which
    // is the only thing that actually knows whether they are open.
    const menuPanels = () => [
        ...PANELS.filter(p => ownedPanels.has(p.id)).map(p => {
            const api = ownedPanels.get(p.id);
            return {
                id: p.id, title: p.title, group: p.group || 'workspace',
                isOpen: () => api.isOpen(),
                toggle: () => api.setOpen(!api.isOpen()),
                reveal: () => { api.setOpen(true); centerOn(api.el); },
            };
        }),
        ...FLOATING.map(f => ({
            id: f.id, title: f.title, group: f.group || 'tools',
            isOpen: () => floatingIsOpen(f),
            toggle: () => toggleFloating(f),
            reveal: () => {
                if (!floatingIsOpen(f)) toggleFloating(f);
                // A module builds itself on first open, so its panel may not exist
                // for another frame — centre once it does.
                setTimeout(() => { const p = document.querySelector(f.sel)?.closest('.panel'); if (p) centerOn(p); }, 160);
            },
        })),
    ];

    // bpm + phrase counters on the workspace floor, off by default.
    const hud = initHud(canvas, clock);

    initCanvasMenu(desktop, {
        panels: menuPanels,
        toggles: () => [
            { label: 'bpm & counters', title: 'draw the tempo and the phrase counters on the canvas, behind the panels',
              isOn: () => hud.isVisible(), toggle: () => hud.setVisible(!hud.isVisible()) },
        ],
        // A buffer is a tab in the strip or a panel on the canvas, depending on where
        // you last put it. One list either way — index.html supplies the strip half,
        // since that is where the tabs live.
        buffers: () => {
            const strip = (bufferSource?.list?.() || []).map(t => ({
                name: t.name, active: !!t.active, detached: false,
                go: () => bufferSource.go?.(t),
            }));
            const off = [...detached].map(([name, d]) => ({
                name, active: false, detached: true,
                go: () => { d.panel?.setOpen(true); if (d.panel) centerOn(d.panel.el); },
            }));
            return [...strip, ...off];
        },
        actions: [
            { label: 'reset view', title: 'frame the default arrangement again', run: () => resetView() },
            { label: 'zen',        title: 'hide all UI — clean editor (Shift+Alt+Z to restore)',
              run: () => document.getElementById('btn-zen')?.click() },
            { label: 'classic UI', title: 'leave the canvas and go back to the fixed layout',
              run: () => document.getElementById('btn-desktop')?.click() },
        ],
    });

    // Reopen whatever was open last time, by pressing the same buttons you would.
    // Deferred a beat so every module has finished wiring its own toggle first.
    setTimeout(() => {
        const saved = readPanelLayout();
        for (const spec of FLOATING) {
            if (!spec.btn || saved[spec.id]?.open !== true) continue;
            const el = document.querySelector(spec.sel);
            const alreadyShowing = el && !(spec.attr ? el.hasAttribute('hidden') : el.classList.contains('hidden'));
            if (alreadyShowing) continue;
            document.querySelector(spec.btn)?.click();
        }
    }, 300);

    // ── Detached buffers ────────────────────────────────────────────────────
    // A scratch buffer pulled off the tab strip gets its own panel with its own
    // CodeMirror on the SAME document. Two editors, one doc is not allowed by
    // CodeMirror, which is why the strip switches away before handing it over.
    //
    // The new editor is built by index.html's factory, so it carries the identical
    // options and keymap — and focusing it re-points the app's `editor` binding at
    // it, which is what makes Ctrl+Enter and the nudge keys work in a detached
    // panel without any of the run machinery knowing panels exist.
    // The tab strip lives in index.html, so it hands the menu a way to list and
    // switch buffers rather than the desktop reaching into it.
    let bufferSource = null;

    let detachedN = 0;
    // Detached buffers are no longer in the tab strip, so anything offering buffers
    // as a destination has to be able to see them here instead.
    const detached = new Map();
    function detachBuffer(name, doc, onReattach) {
        if (!editorFactory) return false;
        const id = 'wfd-buf-' + String(name).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        const step = detachedN++ % 4;
        const panel = createPanel(canvas, {
            id, title: name,
            x: 1102 + step * 28, y: 1106 + step * 28, w: 720, h: 440, minW: 320, minH: 160,
            // No generic × — a buffer's close DISCARDS a document, so it gets its own
            // (below) that says so and asks twice.
            closable: false,
            // Renaming lives in the panel system now, so a detached buffer renames
            // exactly like a tab does — double-click the name, type, Enter. All this
            // has to do is keep the map key (and therefore the piano's "to" picker
            // and bufferTargets()) pointing at the same document.
            onRename: (v) => { const e = detached.get(name); detached.delete(name); name = v; detached.set(name, e); },
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

        // Tearing the panel down. Both exits release the doc first — CodeMirror
        // refuses to hand a document to a second editor while this one still holds
        // it, and the tab strip is about to do exactly that.
        const teardown = () => {
            clearTimeout(t);
            cm.swapDoc(new CodeMirror.Doc('', 'foxdot'));
            detached.delete(name);
            onDropEditor?.(cm);            // stop it being "the focused editor"
            panel.el.remove();
        };

        const head = panel.el.querySelector('.panel-head');
        const before = panel.el.querySelector('.panel-collapse') || null;

        // ⤺ sends the buffer back to the strip and takes the panel away with it.
        const back = document.createElement('button');
        back.className = 'panel-backdrop-btn';
        back.textContent = '\u2934';
        back.title = 'send this buffer back to the tab strip';
        back.addEventListener('click', (e) => {
            e.stopPropagation();
            const returning = name;        // teardown clears the map entry
            teardown();
            onReattach?.(returning, doc);
        });
        head?.insertBefore(back, before);

        // × discards it. A detached buffer had no way out except back to the strip,
        // so closing one meant reattaching it and then closing it there. Two-step on
        // the button rather than a confirm() dialog — see armButton().
        const close = document.createElement('button');
        close.className = 'panel-backdrop-btn wfd-buf-close';
        close.textContent = '\u00d7';
        close.title = 'close this buffer — its text is discarded';
        armButton(close, { armedText: '\u00d7?', armedTitle: 'click again to discard this buffer',
                           skip: () => !doc.getValue().trim(), onConfirm: teardown });
        head?.insertBefore(close, before);

        addBackdropButton(panel.el, clock);
        panToReveal(panel.el);
        detached.set(name, { doc, panel });
        return true;
    }

    // The bar's contents now live in the six panels above, so the canvas gets the
    // whole viewport back. The element itself is HIDDEN rather than removed: what is
    // left in it is the app title (the canvas has a wordmark for that) and the mobile
    // drawer toggle, and a stray getElementById on either should keep resolving
    // rather than start throwing in one UI mode only.
    document.documentElement.style.setProperty('--toolbar-h', '0px');
    const bar = document.getElementById('toolbar');
    if (bar) bar.style.display = 'none';

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

    // Bring an owned panel back and put it where you can see it.
    const reveal = (id) => {
        const p = ownedPanels.get(id);
        if (!p) return false;
        p.setOpen(true);
        panToReveal(p.el);
        return true;
    };

    onReady?.(desktop);
    return {
        desktop, canvas, resetView, getZoom, resetAllLayouts, detachBuffer,
        setBuffers(src) { bufferSource = src; },
        detachedBuffers: () => [...detached].map(([name, d]) => ({ name, doc: d.doc, detached: true })),
        // The toolbar's LAYOUTS button: bring the panel into view and raise it.
        // Through setOpen, not by poking style.display, so a panel that was CLOSED
        // comes back properly recorded as open rather than reappearing and then
        // vanishing again on the next reload.
        showLayouts() { return reveal('wfd-layouts'); },
    };
}
