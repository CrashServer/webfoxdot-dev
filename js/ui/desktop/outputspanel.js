// ── Outputs panel — the projector desk ───────────────────────────────────────
//
// The workshop's output manager, as a crashDot panel. Its job is to make outputs
// something you build DURING a set rather than configure before one: add a projector
// window, add surfaces to it, point each surface at a different source, all while the
// visuals keep running.
//
// One row per surface, because a surface is the unit that matters — it is one warped
// patch of content, and mapping a physical object means pinning several of them onto
// its faces. The row carries everything that makes a surface what it is: which source
// it shows, which warp mode, and how much its edges are blended for the projector
// beside it. The warp handles themselves live in the output WINDOW, where the picture
// is, because you drag them while looking at the wall, not at this panel.

const EDGES = ['left', 'right', 'top', 'bottom'];

export function buildOutputsPanel(container, api, getSources, log = () => {}) {
    const root = document.createElement('div');
    root.className = 'wfd-out-wrap';
    container.appendChild(root);

    function sourceOptions(sel, current) {
        sel.textContent = '';
        // The manager owns the list — the master mix, every live layer, and every code
        // buffer — so the panel and output() can never disagree about what exists.
        const list = getSources?.() || [{ id: 'master', label: 'master mix' }];
        for (const s of list) {
            const o = document.createElement('option');
            o.value = s.id; o.textContent = s.label;
            if (s.id === current) o.selected = true;
            sel.appendChild(o);
        }
        // A source can disappear (its layer stopped). Fall back rather than showing a
        // dead selection that silently renders the master anyway.
        if (!list.some((s) => s.id === current)) sel.value = 'master';
        return sel.value;
    }

    // What the panel would DRAW: the outputs, their surfaces, what each shows and how
    // it is warped, plus the list of sources available to pick from. Everything else
    // (a blend slider mid-drag) is state you are already holding.
    function shape() {
        const src = (getSources?.() || []).map((x) => x.id).join('|');
        const outs = (api.list() || []).map((o, oi) => {
            const out = api.get(oi);
            if (!out) return o.id;
            return o.id + ':' + out.surfaces.map((s) => `${s.source}/${s.warp.getMode()}`).join(',');
        }).join(';');
        return `${src}#${outs}#${api.screenSource ? api.screenSource() : ''}`;
    }

    let sig = null;

    // sig is taken AFTER drawing, not before: sourceOptions() repoints a surface whose
    // source has disappeared, so the shape can change during the draw that reads it.
    function render() { draw(); sig = shape(); }

    function draw() {
        root.textContent = '';

        const bar = document.createElement('div');
        bar.className = 'wfd-out-bar';
        const add = document.createElement('button');
        add.className = 'wfd-out-btn';
        add.textContent = '+ OUTPUT';
        add.title = 'open a projector window — one output is one projector';
        add.onclick = () => { api.addOutput(); render(); };
        const reopen = document.createElement('button');
        reopen.className = 'wfd-out-btn';
        reopen.textContent = 'REOPEN';
        reopen.title = 'bring back a saved output with its mapping intact';
        reopen.onclick = () => { api.reopen(0); render(); };
        bar.append(add, reopen);
        root.appendChild(bar);

        // SCREEN first, because it is the destination you already have. It gets a
        // source picker and nothing else: a warp inside a pan/zoom workspace is
        // meaningless, and there is no second projector to edge-blend it against.
        if (api.screenSource) {
            const box = document.createElement('div');
            box.className = 'wfd-out-box';
            const head = document.createElement('div');
            head.className = 'wfd-out-head';
            const nm = document.createElement('span');
            nm.textContent = 'SCREEN panel';
            head.appendChild(nm);
            box.appendChild(head);
            const row = document.createElement('div');
            row.className = 'wfd-out-row';
            const src = document.createElement('select');
            src.className = 'wfd-out-sel';
            src.title = 'what the SCREEN panel shows — the mix, one layer, or a code buffer';
            sourceOptions(src, api.screenSource());
            src.onchange = () => api.setScreenSource(src.value);
            row.appendChild(src);
            box.appendChild(row);
            root.appendChild(box);
        }

        const outs = api.list();
        if (!outs.length) {
            const empty = document.createElement('div');
            empty.className = 'wfd-out-empty';
            empty.textContent = 'no outputs — + OUTPUT opens a projector window.'
                + '\nin that window: [w] warp · [m] 4pt/edge/mesh · [ ] grid · [r] reset · [f] fullscreen';
            root.appendChild(empty);
            return;
        }

        outs.forEach((o, oi) => {
            const out = api.get(oi);
            if (!out) return;
            const box = document.createElement('div');
            box.className = 'wfd-out-box';

            const head = document.createElement('div');
            head.className = 'wfd-out-head';
            const name = document.createElement('span');
            name.textContent = `OUTPUT ${o.id}`;
            const addS = document.createElement('button');
            addS.className = 'wfd-out-small';
            addS.textContent = '+ surface';
            addS.title = 'another independently warped patch in this projector — one per face of the object';
            addS.onclick = () => { api.addSurface(out); render(); };
            const close = document.createElement('button');
            close.className = 'wfd-out-small wfd-out-del';
            close.textContent = '×';
            close.title = 'close this output window';
            close.onclick = () => { api.close(oi); render(); };
            head.append(name, addS, close);
            box.appendChild(head);

            out.surfaces.forEach((s, si) => {
                const row = document.createElement('div');
                row.className = 'wfd-out-row';

                const src = document.createElement('select');
                src.className = 'wfd-out-sel';
                src.title = 'what this surface shows';
                s.source = sourceOptions(src, s.source);
                src.onchange = () => api.setSource(out, si, src.value);

                const mode = document.createElement('select');
                mode.className = 'wfd-out-sel wfd-out-mode';
                mode.title = 'warp mode — 4pt corner-pin · edge curves · full mesh';
                for (const m of api.MODES) {
                    const o2 = document.createElement('option');
                    o2.value = m; o2.textContent = m;
                    if (m === s.warp.getMode()) o2.selected = true;
                    mode.appendChild(o2);
                }
                mode.onchange = () => s.warp.setMode(mode.value);

                const del = document.createElement('button');
                del.className = 'wfd-out-small wfd-out-del';
                del.textContent = '×';
                del.title = 'remove this surface';
                del.onclick = () => { api.removeSurface(out, si); render(); };

                row.append(src, mode, del);
                box.appendChild(row);

                const blends = document.createElement('div');
                blends.className = 'wfd-out-blends';
                for (const e of EDGES) {
                    const r = document.createElement('input');
                    r.type = 'range'; r.min = '0'; r.max = '0.5'; r.step = '0.005';
                    r.value = String(s.blend[e] || 0);
                    r.title = `edge blend ${e} — fade this projector's light where the next one begins`;
                    r.oninput = () => api.setBlend(out, si, e, +r.value);
                    blends.appendChild(r);
                }
                box.appendChild(blends);
            });

            root.appendChild(box);
        });
    }

    render();
    // The source list grows and shrinks as layers come and go, so the panel has to keep
    // looking. What it must NOT do is rebuild itself while you are using it: this used
    // to blow the whole panel away every 1.5 seconds, and a native <select> whose
    // element is removed closes instantly — so opening a source picker gave you at most
    // a second and a half, usually far less, before the list vanished under the pointer.
    //
    // Two guards, because they cover different halves of the problem. The panel only
    // rebuilds when what it would DRAW has actually changed, which is almost never
    // (nothing here animates). And even then it waits while a control in the panel has
    // focus — clicking a select focuses it before the popup opens, so this covers the
    // exact moment the old code was destroying. A change or a blur runs the render that
    // was skipped, so nothing stays stale once you are done.
    const busy = () => {
        const a = document.activeElement;
        return !!a && root.contains(a) && (a.tagName === 'SELECT' || a.tagName === 'INPUT');
    };
    let missed = false;
    const timer = setInterval(() => {
        if (container.offsetParent === null) return;
        if (sig !== null && shape() === sig) return;      // nothing to redraw
        if (busy()) { missed = true; return; }            // not while you are in it
        render();
    }, 1500);
    // The moment you let go of a control, catch up if the world moved while you held it.
    const done = () => { if (missed) { missed = false; render(); } };
    root.addEventListener('change', done);
    root.addEventListener('focusout', () => setTimeout(done, 0));
    return { render, dispose: () => clearInterval(timer) };
}
