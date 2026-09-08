// ── Layouts panel ────────────────────────────────────────────────────────────
// The named-layout machinery (layouts.js) had no way to reach it. This is that
// way: a panel like every other one, listing saved workspaces.
//
// It was a fixed chip beside the zoom indicator first, on the reasoning that the
// control which gets you back to a known workspace should not itself be somewhere
// you can pan away from and lose. That is still true, and it is why the toolbar has
// a LAYOUTS button that pans to this panel and raises it — but the panel is where
// the controls live, consistent with everything else on the canvas.
//
// A layout is every panel's position, size and collapsed state PLUS the view —
// where you were looking is as much a part of a workspace as where things were.
// So "mixing", "writing" and "performing" can be three arrangements of the same
// panels at three different zooms, one click apart.

import { listLayouts, saveLayout, applyLayout, deleteLayout } from './layouts.js';
import { resetView } from './canvas.js';
import { resetAllLayouts } from './panel.js';

/** Draw the layouts UI into a panel body. */
export function buildLayoutsPanel(container, log = () => {}) {
    const pop = document.createElement('div');
    pop.className = 'wfd-lb-pop';
    container.appendChild(pop);

    function render() {
        pop.textContent = '';
        const all = listLayouts();
        const names = Object.keys(all).sort();
        if (!names.length) {
            const empty = document.createElement('div');
            empty.className = 'wfd-lb-empty';
            empty.textContent = 'no saved layouts yet';
            pop.appendChild(empty);
        }
        for (const name of names) {
            const row = document.createElement('div');
            row.className = 'wfd-lb-row';
            const use = document.createElement('button');
            use.className = 'wfd-lb-use';
            use.textContent = name;
            use.title = 'restore this workspace';
            use.onclick = () => {
                applyLayout(name);
                log(`layout: restored "${name}"`, 'ok');
            };
            const over = document.createElement('button');
            over.className = 'wfd-lb-small';
            over.textContent = '↺';
            over.title = 'overwrite with the workspace as it is now';
            over.onclick = (e) => { e.stopPropagation(); saveLayout(name); log(`layout: "${name}" updated`, 'ok'); render(); };
            const del = document.createElement('button');
            del.className = 'wfd-lb-small wfd-lb-del';
            del.textContent = '×';
            del.title = 'delete this layout';
            del.onclick = (e) => { e.stopPropagation(); deleteLayout(name); log(`layout: deleted "${name}"`, 'info'); render(); };
            row.append(use, over, del);
            pop.appendChild(row);
        }

        const foot = document.createElement('div');
        foot.className = 'wfd-lb-foot';

        const save = document.createElement('button');
        save.className = 'wfd-lb-action';
        save.textContent = '+ save current…';
        save.onclick = () => {
            const name = prompt('name this workspace');
            if (name == null) return;
            const n = name.trim();
            if (!n) return;
            saveLayout(n);
            log(`layout: saved "${n}" — panels and the view`, 'ok');
            render();
        };

        const fit = document.createElement('button');
        fit.className = 'wfd-lb-action';
        fit.textContent = 'reset view';
        fit.title = 'frame the whole layout again (same as double-clicking the background)';
        fit.onclick = () => resetView();

        const wipe = document.createElement('button');
        wipe.className = 'wfd-lb-action wfd-lb-danger';
        wipe.textContent = 'reset panels';
        wipe.title = 'forget every panel position and reload — this cannot be undone';
        wipe.onclick = () => {
            if (confirm('Forget every panel position and size, and reload?')) resetAllLayouts();
        };

        foot.append(save, fit, wipe);
        pop.appendChild(foot);
    }

    render();
    return { render };
}
