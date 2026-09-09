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
    ['wres',   'wres',    'layer size, px',          'Longest edge the CPU-drawn workshop layers render at before the GPU stretches them. 0 = no cap.'],
    ['budget', 'vbudget', 'ms/frame for layers',     'How long those layers may take before one over budget starts redrawing every Nth frame instead.'],
];

export function buildPerfMenu(anchor, deps) {
    const { modes, current, apply, read, write, stats, log = () => {} } = deps;
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
        head.textContent = 'render load';
        el.appendChild(head);

        const why = document.createElement('p');
        why.className = 'wfd-perf-why';
        // Said here rather than buried in a tooltip, because it is the thing that makes
        // the whole control make sense — and the thing people assume the opposite of.
        why.innerHTML = 'The audio <b>engine</b> is on its own thread and is never starved by drawing. '
                      + 'What shares this one is the note <b>scheduler</b>, which has ~120ms of slack '
                      + 'before a note is late. These decide how much of it the picture may spend.';
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

        const foot = document.createElement('div');
        foot.className = 'wfd-perf-foot';
        el.appendChild(foot);

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

        const timer = setInterval(() => {
            if (!el) { clearInterval(timer); return; }
            const st = stats();
            foot.textContent = st.fps ? `drawing ${st.fps.toFixed(0)}fps at ${st.ms.toFixed(1)}ms/frame`
                                      : 'nothing is drawing right now';
            fill();
        }, 700);
    }

    anchor.addEventListener('click', open);
    return { open, close };
}
