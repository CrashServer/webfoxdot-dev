// ── Canvas context menu ──────────────────────────────────────────────────────
//
// Right-click the desktop: every window, whether it is open, and a GO TO that
// centres the view on it. Plus the buffers, and the handful of view actions that
// are not panels at all.
//
// It replaces a WINDOWS panel that did the same job. A panel that only lists other
// panels is itself a panel — one more thing to place, one more thing in the list,
// and it has to be somewhere you can see before it is any use. A menu costs nothing
// until you ask for it and appears exactly where the pointer already is, which is
// the whole argument for menus.
//
// Two verbs per row, deliberately, because they are different questions:
//   the ROW toggles  — "should this exist right now"
//   ⊕ goes to it     — "where is it" (opens it if it was closed, then centres it)
// Toggling leaves the menu open, so you can set up a workspace in one visit; going
// somewhere closes it, since you asked to be looking at something else.
//
// Buffers are listed for the same reason panels are: with detachable tabs a buffer
// is either a tab in the strip or a panel on the canvas, and "where did my scratch
// go" should have one answer wherever it currently lives.

const GROUP_ORDER = ['workspace', 'status', 'tools', 'learn', 'collab', 'bars'];

/**
 * @param {Element} desktop   #desktop — the right-click surface
 * @param {object}  api
 *   panels()   → [{ id, title, group, isOpen(), toggle(), reveal() }]
 *   buffers()  → [{ name, detached, active, go() }]
 *   actions    → [{ label, title, run() }]
 */
export function initCanvasMenu(desktop, api) {
    const menu = document.createElement('div');
    menu.className = 'wfd-menu';
    menu.hidden = true;
    document.body.appendChild(menu);

    let openRows = [];

    const close = () => { menu.hidden = true; openRows = []; };

    function section(label) {
        const el = document.createElement('div');
        el.className = 'wfd-menu-sec';
        el.textContent = label;
        menu.appendChild(el);
    }

    function row({ name, on, dim, onPick, onGo, goTitle }) {
        const el = document.createElement('div');
        el.className = 'wfd-menu-row' + (on ? ' on' : '') + (dim ? ' dim' : '');
        const dot = document.createElement('span');
        dot.className = 'wfd-menu-dot';
        const nm = document.createElement('span');
        nm.className = 'wfd-menu-name';
        nm.textContent = name;
        el.append(dot, nm);
        if (onGo) {
            const go = document.createElement('button');
            go.className = 'wfd-menu-goto';
            go.textContent = '⊕';
            go.title = goTitle || 'go to it — open it and centre the view';
            go.addEventListener('click', (e) => { e.stopPropagation(); onGo(); close(); });
            el.appendChild(go);
        }
        if (onPick) el.addEventListener('click', onPick);
        menu.appendChild(el);
        return el;
    }

    function build() {
        menu.textContent = '';
        const panels = api.panels?.() || [];
        const groups = [...new Set(panels.map(p => p.group || 'workspace'))]
            .sort((a, b) => (GROUP_ORDER.indexOf(a) + 1 || 99) - (GROUP_ORDER.indexOf(b) + 1 || 99));

        for (const g of groups) {
            section(g);
            for (const p of panels.filter(x => (x.group || 'workspace') === g)) {
                const el = row({
                    name: p.title,
                    on: p.isOpen(),
                    onGo: () => p.reveal(),
                    // Toggling redraws in place rather than closing: setting up a
                    // workspace is several decisions, not one.
                    onPick: () => { p.toggle(); setTimeout(refreshMarks, 0); setTimeout(refreshMarks, 140); },
                });
                el.dataset.panelId = p.id;
            }
        }

        const bufs = api.buffers?.() || [];
        if (bufs.length) {
            section('buffers');
            for (const b of bufs) {
                row({
                    name: b.name + (b.detached ? '  ⧉' : ''),
                    on: !!b.active,
                    goTitle: b.detached ? 'centre the view on this buffer' : 'switch to this buffer',
                    onGo: () => b.go(),
                    onPick: () => { b.go(); close(); },
                });
            }
        }

        const acts = api.actions || [];
        if (acts.length) {
            section('view');
            for (const a of acts) {
                const el = document.createElement('button');
                el.className = 'wfd-menu-act';
                el.textContent = a.label;
                if (a.title) el.title = a.title;
                el.addEventListener('click', () => { a.run(); close(); });
                menu.appendChild(el);
            }
        }
        openRows = [...menu.querySelectorAll('.wfd-menu-row[data-panel-id]')];
    }

    // Re-read the open marks without rebuilding — a rebuild would move the rows out
    // from under the pointer you are about to click again.
    function refreshMarks() {
        const panels = api.panels?.() || [];
        for (const el of openRows) {
            const p = panels.find(x => x.id === el.dataset.panelId);
            if (p) el.classList.toggle('on', p.isOpen());
        }
    }

    function openAt(x, y) {
        build();
        menu.hidden = false;
        // Measure, then clamp, so the menu never opens partly off screen — it is
        // tall, and near the bottom edge that is most of it.
        menu.style.left = '0px';
        menu.style.top  = '0px';
        const r = menu.getBoundingClientRect();
        const M = 6;
        menu.style.left = Math.max(M, Math.min(x, window.innerWidth  - r.width  - M)) + 'px';
        menu.style.top  = Math.max(M, Math.min(y, window.innerHeight - r.height - M)) + 'px';
    }

    desktop.addEventListener('contextmenu', (e) => {
        // Inside a panel's CONTENT the browser's own menu is the right one — spell
        // check in the editor, copy in the log, save-image on the screen. The canvas
        // background and the panel chrome are ours.
        if (e.target.closest('.panel-body')) return;
        e.preventDefault();
        openAt(e.clientX, e.clientY);
    });

    // Dismissal: anywhere else, Escape, or the view moving under it.
    window.addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target)) close(); }, true);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    window.addEventListener('blur', close);
    desktop.addEventListener('wheel', close, { passive: true });

    return { openAt, close };
}
