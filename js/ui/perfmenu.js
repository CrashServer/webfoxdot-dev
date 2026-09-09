// The render-load menu — the three presets and the four numbers behind them.
//
// It hangs off one button on the main bar because a bar is a row of decisions, not a
// control surface: four number fields sitting permanently next to STOP would be four
// things to read past every time you look for the transport. Here they are one click
// away and fully visible when you want them, which is the shape the layers panel's
// bind menu already uses.
//
// The presets and the fields are the SAME four settings, so picking a preset fills the
// fields in and editing a field leaves the preset marked as custom — there is no
// hidden second copy of the state, and nothing to keep in sync.

const FIELDS = [
    ['fps',    'vfps',    'frames per second',       '0 = every frame the browser offers. The biggest single lever: 30 is half the main-thread work of 60.'],
    ['res',    'vres',    'GPU resolution ×',   '1 = native CSS pixels, 0.5 = half (cheaper), 2 = supersampled. Shader work — the pixel-filling half.'],
    ['wres',   'wres',    'workshop layers, px',     'Longest edge the CPU-drawn WORKSHOP layers render at before the GPU stretches them (0 = no cap). It does nothing to a field scene, which is a shader and has no canvas of its own.'],
    ['budget', 'vbudget', 'ms/frame for layers',     'How long those layers may take before one over budget starts redrawing every Nth frame instead.'],
];

export function buildPerfMenu(anchor, deps) {
    const { modes, current, apply, read, write, stats, resources, log = () => {} } = deps;
    let el = null;

    const close = () => { if (el) { el.remove(); el = null; } };
    document.addEventListener('mousedown', (e) => { if (el && !el.contains(e.target) && e.target !== anchor) close(); }, true);
    document.addEventListener('keydown', (e) => { if (el && e.key === 'Escape') { close(); e.stopPropagation(); } }, true);

    function open() {
        if (el) { close(); return; }
        el = document.createElement('div');
        el.className = 'wfd-perf-menu';

        const head = document.createElement('div');
        head.className = 'wfd-perf-head';
        const title = document.createElement('span');
        title.textContent = 'render load';
        const x = document.createElement('button');
        x.className = 'wfd-perf-x';
        x.textContent = '\u00d7';
        x.title = 'close  (Esc)';
        x.onclick = close;
        head.append(title, x);
        el.appendChild(head);

        const why = document.createElement('p');
        why.className = 'wfd-perf-why';
        // ONE line. The full version — the AudioWorklet, the 120ms of lookahead, why
        // lateness rather than fidelity is the thing at stake — is a paragraph, and a
        // paragraph in a popup is a paragraph nobody reads. It lives on the button's
        // own tooltip and in vperf()'s entry, where there is room for it.
        why.innerHTML = 'The picture shares a thread with the note <b>scheduler</b> \u2014 '
                      + 'not with the audio engine, which is never starved.';
        el.appendChild(why);

        const cur = current();
        for (const m of modes) {
            const row = document.createElement('button');
            row.className = 'wfd-perf-mode' + (m.id === cur ? ' on' : '');
            const nm = document.createElement('span');
            nm.className = 'wfd-perf-mode-name';
            nm.textContent = m.label;
            const sub = document.createElement('span');
            sub.className = 'wfd-perf-mode-sub';
            sub.textContent = m.detail;
            row.append(nm, sub);
            row.onclick = () => { apply(m.id, true); fill(); markMode(m.id); };
            el.appendChild(row);
        }

        const grid = document.createElement('div');
        grid.className = 'wfd-perf-grid';
        const inputs = {};
        for (const [key, fn, label, help] of FIELDS) {
            const lab = document.createElement('label');
            lab.className = 'wfd-perf-lab';
            lab.textContent = fn + '()';
            lab.title = help;
            const inp = document.createElement('input');
            inp.type = 'number'; inp.step = 'any'; inp.className = 'wfd-perf-num';
            inp.title = help;
            // Committed on change, not on every keystroke: half a typed number is a
            // number, and applying "3" on the way to "30" makes the picture lurch.
            inp.onchange = () => { write(key, inp.value); markMode(current()); log(`${fn}(${inp.value})`, 'info'); };
            const note = document.createElement('span');
            note.className = 'wfd-perf-note';
            note.textContent = label;
            grid.append(lab, inp, note);
            inputs[key] = inp;
        }
        el.appendChild(grid);

        // ── What it is costing ───────────────────────────────────────────────
        // Every number here is one the app ALREADY computes for its own reasons — the
        // frame cost the fps counter keeps, the per-layer EMA the budget throttles on,
        // the bus count the allocator tracks, the engine's own health counters. So
        // this reads them, and only while the menu is open: closed, it costs nothing,
        // which is the whole reason it lives behind a button rather than on the bar.
        const resHead = document.createElement('div');
        resHead.className = 'wfd-perf-head wfd-perf-head2';
        resHead.textContent = 'what it is costing';
        el.appendChild(resHead);

        const foot = document.createElement('div');
        foot.className = 'wfd-perf-foot';
        el.appendChild(foot);

        function renderResources() {
            const r = resources ? resources() : null;
            if (!r) { foot.textContent = 'nothing to measure yet'; return; }
            foot.textContent = '';
            const row = (label, value, cls) => {
                const l = document.createElement('span'); l.className = 'wfd-res-k'; l.textContent = label;
                const v = document.createElement('span'); v.className = 'wfd-res-v' + (cls ? ' ' + cls : ''); v.textContent = value;
                foot.append(l, v);
            };
            row('picture', r.fps ? `${r.fps.toFixed(0)}fps \u00b7 ${r.ms.toFixed(1)}ms/frame` : 'not drawing');
            row('layers', r.layers ? `${r.layers} (${r.ws} workshop)` : 'none');
            // Named, because "the visuals are heavy" is not actionable and "slimemold
            // is 17ms, redrawing every 5th frame" is.
            // Both names: the LAYER is what you would edit or stop, the SCENE is what
            // is actually expensive. "the visuals are heavy" is not actionable;
            // "video2 doomcorridor, 17ms, redrawing every 5th frame" is.
            for (const l of (r.heavy || []))
                row('\u00b7 ' + l.name,
                    `${l.kind || ''} ${l.cost.toFixed(1)}ms${l.every > 1 ? ` \u00b7 every ${l.every}` : ''}`.trim(),
                    l.every > 1 ? 'warn' : '');
            row('scheduler', `${r.lag.toFixed(0)}ms late`, r.lag > 30 ? 'bad' : r.lag > 10 ? 'warn' : '');
            row('voices', String(r.voices));
            row('buses', `${r.bus.used} / ${r.bus.max}`, r.bus.used > r.bus.max * 0.9 ? 'bad' : r.bus.used > r.bus.max * 0.7 ? 'warn' : '');
            if (r.engine) row('engine', `${r.engine.health}% \u00b7 queue ${r.engine.depth}`
                                      + (r.engine.dropped ? ` \u00b7 ${r.engine.dropped} dropped` : ''),
                              r.engine.health < 90 || r.engine.dropped ? 'warn' : '');
            else row('engine', 'not booted');
            if (r.heap) row('js heap', `${r.heap.toFixed(0)} MB`);
        }

        function fill() {
            const v = read();
            for (const [key] of FIELDS) if (document.activeElement !== inputs[key]) inputs[key].value = v[key];
        }
        function markMode(id) {
            [...el.querySelectorAll('.wfd-perf-mode')].forEach((r, i) => r.classList.toggle('on', modes[i].id === id));
        }
        fill();

        document.body.appendChild(el);
        const r = anchor.getBoundingClientRect();
        el.style.top = Math.min(r.bottom + 4, window.innerHeight - el.offsetHeight - 8) + 'px';
        el.style.left = Math.max(6, Math.min(r.left, window.innerWidth - el.offsetWidth - 8)) + 'px';

        renderResources();
        const timer = setInterval(() => {
            if (!el) { clearInterval(timer); return; }
            renderResources();
            fill();
        }, 700);
    }

    anchor.addEventListener('click', open);
    return { open, close };
}
