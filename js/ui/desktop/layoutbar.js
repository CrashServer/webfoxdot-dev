// ── Layout bar ───────────────────────────────────────────────────────────────
// The named-layout machinery (layouts.js) had no way to reach it. This is that
// way: a chip beside the zoom indicator that saves the current workspace under a
// name and puts it back later.
//
// A layout is every panel's position, size and collapsed state PLUS the view —
// where you were looking is as much a part of a workspace as where things were.
// So "mixing", "writing" and "performing" can be three arrangements of the same
// panels at three different zooms, one click apart.

import { listLayouts, saveLayout, applyLayout, deleteLayout } from './layouts.js';
import { resetView } from './canvas.js';
import { resetAllLayouts } from './panel.js';

export function initLayoutBar(desktop, log = () => {}) {
    const wrap = document.createElement('div');
    wrap.id = 'wfd-layoutbar';

    const btn = document.createElement('button');
    btn.className = 'wfd-lb-btn';
    btn.textContent = 'layouts';
    btn.title = 'save and recall workspaces — panel positions, sizes and the view';

    const pop = document.createElement('div');
    pop.className = 'wfd-lb-pop';
    pop.hidden = true;

    wrap.append(btn, pop);
    desktop.appendChild(wrap);

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
                pop.hidden = true;
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
        fit.onclick = () => { resetView(); pop.hidden = true; };

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

    btn.onclick = (e) => {
        e.stopPropagation();
        if (pop.hidden) render();
        pop.hidden = !pop.hidden;
    };
    document.addEventListener('pointerdown', (e) => {
        if (!pop.hidden && !wrap.contains(e.target)) pop.hidden = true;
    });

    return { render };
}
