// Interactive guided tour — teaches the basics of live coding directly in the
// crashDot UI, for people who've never used FoxDot. Launched by evaluating
// start_guided_tour() (which sits in the default starting buffer).
//
// Each step shows a short instruction and AUTO-ADVANCES when it detects you did the
// thing (booted, ran a line, nudged a number, opened autocomplete, pressed Alt+I,
// stopped everything…). The app feeds it eval events via notify(); key presses and
// boot state the tour watches itself. Fully skippable.
//
//   const tour = initTour(editor);
//   tour.start();                 // ← start_guided_tour()
//   tour.notify('eval', codeStr); // ← call from runCode

const STEPS = [
    { title: 'Welcome to live coding 🌍',
      html: 'You write code, <b>evaluate</b> it, and hear sound instantly — then change it <i>while it plays</i>. This 2-minute tour walks you through the essentials. Ready?',
      advance: { manual: true } },

    { title: '1 · Start the audio engine',
      html: 'Click <b>▸ boot</b> in the top-left to load the synth engine (takes a few seconds the first time).',
      spot: '#btn-boot',
      advance: { boot: true } },

    { title: '2 · Make your first sound',
      html: 'I’ve added a line at the bottom of the editor. Put your cursor on it and press <b>Ctrl+Enter</b> to run it.',
      code: 'p1 >> pluck([0, 2, 4, 7])',
      spot: '#btn-run',
      advance: { eval: /pluck/ } },

    { title: '🎉 You’re live!',
      html: '<code>p1</code> is a <b>player</b>. It plays the <code>pluck</code> synth through the notes <code>[0, 2, 4, 7]</code> — looping forever. The list in <code>[…]</code> is the melody.',
      advance: { manual: true } },

    { title: '3 · Change it while it plays',
      html: 'No stopping needed. Put the cursor on a <b>number</b> in the pattern and press <b>Alt+↑ / Alt+↓</b> to nudge it — then Ctrl+Enter to hear the change. Give it a nudge now.',
      advance: { key: 'alt-arrow' } },

    { title: '4 · The one rule',
      html: 'Every player reads <code>name &gt;&gt; synth(pattern, params)</code>. The <b>name</b> (<code>p1</code>, <code>bass</code>, anything) is the track; then a <b>synth</b>; then the notes and knobs like <code>amp=</code>, <code>dur=</code>, <code>oct=</code>.',
      advance: { manual: true } },

    { title: '5 · Autocomplete (Ctrl+Space)',
      html: 'Not sure what to type? Press <b>Ctrl+Space</b>. After <code>&gt;&gt;</code> it lists synths; inside <code>()</code> it lists params. ↑↓ move, → opens a group, ↵ picks. Try it now.',
      advance: { key: 'ctrl-space' } },

    { title: '6 · Layer another player',
      html: 'Players stack and play together. Run this drum line — now two things are going at once.',
      code: 'd1 >> play("x-o-")',
      advance: { eval: /play\s*\(/ } },

    { title: '7 · Instant pattern help (Alt+I)',
      html: 'Functions like <code>PRand</code> generate notes. Put the cursor on <code>PRand</code> in the line below and press <b>Alt+I</b> for an instant explanation.',
      code: 'p2 >> blip(PRand([0, 2, 4, 7]), dur=1/2, amp=0.6)',
      advance: { key: 'alt-i' } },

    { title: '8 · Mute one player (Alt+X)',
      html: 'Press <b>Alt+X</b> on any player’s line to comment it out and stop just that player. Alt+X again (or uncomment + Ctrl+Enter) brings it back.',
      advance: { key: 'alt-x' } },

    { title: '9 · Stop everything (Ctrl+;)',
      html: 'When you want silence, press <b>Ctrl+;</b> to stop all players at once. Try it.',
      advance: { key: 'ctrl-semicolon' } },

    { title: 'You’ve got it! ✨',
      html: 'That’s the whole loop: <b>write → run → change</b>. Now explore the <b>examples ▾</b> (top bar) and the <b>?</b> docs, clear this buffer, and make something. Welcome aboard!',
      advance: { manual: true, last: true } },
];

let editor = null, panel = null, idx = -1, active = false, spotEl = null, pollT = null;

export function initTour(_editor) {
    editor = _editor;
    document.addEventListener('keydown', onKey, true);   // capture — see combos before CodeMirror
    return { start, notify, isActive: () => active };
}

function onKey(e) {
    if (!active) return;
    let k = null;
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) k = 'alt-arrow';
    else if (e.altKey && (e.key === 'i' || e.key === 'I')) k = 'alt-i';
    else if (e.altKey && (e.key === 'x' || e.key === 'X')) k = 'alt-x';
    else if (e.ctrlKey && (e.key === ' ' || e.key === 'Spacebar')) k = 'ctrl-space';
    else if (e.ctrlKey && (e.key === ';' || e.key === ',')) k = 'ctrl-semicolon';
    else if (e.key === 'Escape') { end(); return; }
    if (k) check({ key: k });
}
function notify(ev, data) { if (active) check({ event: ev, data }); }

function start() {
    if (active) return;
    active = true;
    buildPanel();
    pollT = setInterval(() => { if (active) check({ poll: true }); }, 600);
    go(0);
}
function end() {
    active = false;
    clearInterval(pollT); pollT = null;
    clearSpot();
    if (panel) { panel.remove(); panel = null; }
    idx = -1;
}

// Does the current step's advance condition match this signal?
function check(sig) {
    const step = STEPS[idx]; if (!step) return;
    const a = step.advance || {};
    let hit = false;
    if (a.boot && sig.poll) hit = document.getElementById('status-dot')?.className === 'ready';
    else if (a.key && sig.key === a.key) hit = true;
    else if (a.eval && sig.event === 'eval') hit = a.eval.test(String(sig.data || ''));
    if (hit) next();
}

function next() { go(idx + 1); }

function go(i) {
    if (i >= STEPS.length) { end(); return; }
    idx = i;
    clearSpot();
    const step = STEPS[i];
    if (step.code) insertBlock(step.code);
    if (step.spot) setSpot(step.spot);
    render();
}

function render() {
    const step = STEPS[idx];
    const manual = !!(step.advance && step.advance.manual);
    const dots = STEPS.map((_, i) => `<span class="tour-dot${i === idx ? ' on' : ''}${i < idx ? ' done' : ''}"></span>`).join('');
    panel.innerHTML =
        `<div class="tour-head"><span class="tour-step">${idx + 1} / ${STEPS.length}</span>` +
        `<button class="tour-x" title="end tour">✕</button></div>` +
        `<div class="tour-title">${step.title}</div>` +
        `<div class="tour-body">${step.html}</div>` +
        `<div class="tour-dots">${dots}</div>` +
        `<div class="tour-btns">` +
        (step.advance && step.advance.last
            ? `<button class="tour-btn tour-primary" data-act="end">Finish ✓</button>`
            : manual
                ? `<button class="tour-btn" data-act="end">end</button><button class="tour-btn tour-primary" data-act="next">Next →</button>`
                : `<button class="tour-btn" data-act="end">end</button><button class="tour-btn" data-act="next">skip step →</button>`) +
        `</div>`;
    panel.querySelector('.tour-x').onclick = end;
    panel.querySelectorAll('[data-act]').forEach(b => b.onclick = () => (b.dataset.act === 'end' ? end() : next()));
}

function buildPanel() {
    panel = document.createElement('div');
    panel.id = 'tour-panel';
    document.body.appendChild(panel);
}

// Spotlight a UI element with a pulsing outline.
function setSpot(sel) { const el = document.querySelector(sel); if (el) { el.classList.add('tour-spot'); spotEl = el; } }
function clearSpot() { if (spotEl) { spotEl.classList.remove('tour-spot'); spotEl = null; } }

// Append a runnable block at the end of the buffer and drop the cursor on it.
function insertBlock(code) {
    const last = editor.lastLine();
    const end = { line: last, ch: editor.getLine(last).length };
    editor.replaceRange('\n\n' + code, end);
    const line = editor.lastLine();
    editor.setCursor({ line, ch: editor.getLine(line).length });
    editor.scrollIntoView({ line, ch: 0 });
    editor.focus();
}
