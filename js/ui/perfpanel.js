// The PERFORMANCE panel — what the picture may cost, and what everything is costing.
//
// It was a popup hanging off a button, and that was the wrong shape: it sat in fixed
// screen coordinates while the rest of the desktop pans and zooms underneath it, so
// it slid away from the thing it belonged to and behaved differently from every other
// panel on the canvas. It is an ordinary panel now — drag it, resize it, close it,
// save it in a layout, like the layers and outputs desks.
//
// Two halves, and they are two different jobs. The top half is SETTINGS: three
// presets and the four numbers behind them. The bottom half is MONITORING: what the
// app is actually spending, read from numbers it already computes for its own reasons
// — the renderer's frame counter, the per-layer EMA the frame budget throttles on,
// the bus allocator's count, scsynth's own health counters. Nothing here starts a
// timer in the engine or asks it to measure anything extra.

const FIELDS = [
    ['fps',    'vfps',    'frames per second',   '0 = every frame the browser offers. The biggest single lever: 30 is half the main-thread work of 60.'],
    ['res',    'vres',    'GPU resolution ×',    '1 = native CSS pixels, 0.5 = half (cheaper), 2 = supersampled. Shader work — the pixel-filling half.'],
    ['wres',   'wres',    'workshop layers, px', 'Longest edge the CPU-drawn WORKSHOP layers render at before the GPU stretches them (0 = no cap). It does nothing to a field scene, which is a shader and has no canvas of its own.'],
    ['budget', 'vbudget', 'ms/frame for layers', 'How long those layers may take before one over budget starts redrawing every Nth frame instead.'],
];

export function buildPerfPanel(container, deps) {
    const { modes, current, apply, read, write, resources, log = () => {} } = deps;

    const root = document.createElement('div');
    root.className = 'wfd-perf';
    container.appendChild(root);

    // ── presets ──────────────────────────────────────────────────────────────
    const head1 = document.createElement('div');
    head1.className = 'wfd-perf-head';
    head1.textContent = 'render load';
    root.appendChild(head1);

    const modeRows = [];
    for (const m of modes) {
        const row = document.createElement('button');
        row.className = 'wfd-perf-mode';
        const nm = document.createElement('span');
        nm.className = 'wfd-perf-mode-name'; nm.textContent = m.label;
        const sub = document.createElement('span');
        sub.className = 'wfd-perf-mode-sub'; sub.textContent = m.detail;
        row.append(nm, sub);
        row.onclick = () => { apply(m.id, true); fill(); mark(); };
        root.appendChild(row);
        modeRows.push(row);
    }

    // ── the four numbers ─────────────────────────────────────────────────────
    const grid = document.createElement('div');
    grid.className = 'wfd-perf-grid';
    const inputs = {};
    for (const [key, fn, label, help] of FIELDS) {
        const lab = document.createElement('label');
        lab.className = 'wfd-perf-lab'; lab.textContent = fn + '()'; lab.title = help;
        const inp = document.createElement('input');
        inp.type = 'number'; inp.step = 'any'; inp.className = 'wfd-perf-num'; inp.title = help;
        // Committed on change, not on every keystroke: half a typed number is a
        // number, and applying "3" on the way to "30" makes the picture lurch.
        inp.onchange = () => { write(key, inp.value); mark(); log(`${fn}(${inp.value})`, 'info'); };
        const note = document.createElement('span');
        note.className = 'wfd-perf-note'; note.textContent = label;
        grid.append(lab, inp, note);
        inputs[key] = inp;
    }
    root.appendChild(grid);

    // ── monitoring ───────────────────────────────────────────────────────────
    const head2 = document.createElement('div');
    head2.className = 'wfd-perf-head wfd-perf-head2';
    head2.textContent = 'perf monitoring';
    root.appendChild(head2);

    const mon = document.createElement('div');
    mon.className = 'wfd-perf-mon';
    root.appendChild(mon);

    function fill() {
        const v = read();
        for (const [key] of FIELDS) if (document.activeElement !== inputs[key]) inputs[key].value = v[key];
    }
    function mark() {
        const id = current();
        modeRows.forEach((r, i) => r.classList.toggle('on', modes[i].id === id));
    }

    function draw() {
        const r = resources ? resources() : null;
        mon.textContent = '';
        if (!r) { mon.textContent = 'nothing to measure yet'; return; }
        const group = (name) => {
            const g = document.createElement('div');
            g.className = 'wfd-perf-grp'; g.textContent = name;
            mon.appendChild(g);
        };
        const row = (label, value, cls) => {
            const l = document.createElement('span'); l.className = 'wfd-res-k'; l.textContent = label;
            const v = document.createElement('span'); v.className = 'wfd-res-v' + (cls ? ' ' + cls : ''); v.textContent = value;
            mon.append(l, v);
        };
        const num = (v, d = 0) => (v == null ? '—' : Number(v).toFixed(d));

        group('picture');
        row('drawing', r.fps ? `${num(r.fps)}fps · ${num(r.ms, 1)}ms/frame` : 'not drawing');
        row('layers', r.layers ? `${r.layers} (${r.ws} workshop)` : 'none');
        // Named, because "the visuals are heavy" is not actionable and "video2
        // doomcorridor, 17ms, redrawing every 5th frame" is.
        for (const l of (r.heavy || []))
            row('· ' + l.name, `${l.kind || ''} ${num(l.cost, 1)}ms${l.every > 1 ? ` · every ${l.every}` : ''}`.trim(),
                l.every > 1 ? 'warn' : '');

        // The half that actually decides whether a note is late. Main-thread lateness
        // is what the picture competes for; everything below it is the engine's own
        // account of whether the messages arrived in time to be played.
        group('scheduling');
        row('main thread', `${num(r.lag)}ms late`, r.lag > 30 ? 'bad' : r.lag > 10 ? 'warn' : '');
        if (r.engine) {
            row('queue', `${r.engine.depth} / ${r.engine.capacity || '—'}` + (r.engine.peak ? ` · peak ${r.engine.peak}` : ''),
                r.engine.capacity && r.engine.depth > r.engine.capacity * 0.75 ? 'warn' : '');
            row('late msgs', `${r.engine.lates}${r.engine.maxLateMs ? ` · worst ${num(r.engine.maxLateMs)}ms` : ''}`,
                r.engine.lates ? 'warn' : '');
            row('pre-sched', `${r.engine.pending} pending${r.engine.preLates ? ` · ${r.engine.preLates} late` : ''}`,
                r.engine.preLates ? 'warn' : '');
            row('drift', `${num(r.engine.drift)}ms`, Math.abs(r.engine.drift || 0) > 20 ? 'warn' : '');
        } else row('engine', 'not booted');

        group('audio');
        if (r.engine) {
            row('health', `${num(r.engine.health)}%`, r.engine.health < 90 ? 'bad' : r.engine.health < 99 ? 'warn' : '');
            row('dropped', String(r.engine.dropped), r.engine.dropped ? 'bad' : '');
            row('glitches', String(r.engine.glitches), r.engine.glitches ? 'warn' : '');
            if (r.engine.wasmErrors) row('wasm errors', String(r.engine.wasmErrors), 'bad');
            row('context', `${r.engine.ctx}${r.engine.rate ? ` · ${(r.engine.rate / 1000).toFixed(1)}kHz` : ''}`,
                r.engine.ctx !== 'running' ? 'warn' : '');
        }
        row('voices', `${r.voices} of ${r.players}`);
        row('buses', `${r.bus.used} / ${r.bus.max}`,
            r.bus.used > r.bus.max * 0.9 ? 'bad' : r.bus.used > r.bus.max * 0.7 ? 'warn' : '');
        row('tempo', `${num(r.bpm, 1)} bpm`);

        if (r.heap) { group('page'); row('js heap', `${num(r.heap)} MB`); }
    }

    fill(); mark(); draw();
    // Only while the panel is on screen. A monitor nobody is looking at is exactly the
    // kind of background work this panel exists to help you find.
    const timer = setInterval(() => { if (container.offsetParent !== null) { draw(); fill(); } }, 700);
    return { refresh: () => { fill(); mark(); draw(); }, dispose: () => clearInterval(timer) };
}
