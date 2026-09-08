// ── Canvas HUD — bpm & phrase counters on the workspace floor ────────────────
//
// The same numbers the clock section carries, drawn big and dim BEHIND the panels
// like the wordmark. Optional, off by default, toggled from the canvas menu.
//
// Why it earns its place: the phrase counters are glanced at constantly and read
// for a tenth of a second — exactly the kind of thing that should not require
// finding a panel, and exactly the kind of thing a 10px row in a sidebar is bad at.
// On the floor they are legible from across a room, which is the situation this
// whole layout is for.
//
// It lives IN the canvas, so it pans and zooms with the workspace and sits under
// every panel; pointer-events:none so it can never eat a drag.
//
// Cost matters here. The note scheduler runs on the main thread, so a per-frame
// loop that writes DOM every frame is a loop that jitters the audio (that is how
// zoom used to disturb timing). This reads the clock each frame but writes only
// when a displayed VALUE changes — the counters step once per beat, so at 120bpm
// that is two DOM touches a second rather than 120 — and the loop does not run at
// all while the HUD is hidden.

const KEY = 'wfd-hud';
const LENS = [4, 8, 16, 32, 64];

export function initHud(canvas, clock, { x = 0, y = 700, w = 1920, h = 340 } = {}) {
    const root = document.createElement('div');
    root.className = 'canvas-hud';
    root.style.cssText =
        `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;` +
        `pointer-events:none;user-select:none;`;

    const bpmEl = document.createElement('div');
    bpmEl.className = 'hud-bpm';
    const bpmN = document.createElement('span');
    bpmN.className = 'hud-bpm-n';
    const bpmU = document.createElement('span');
    bpmU.className = 'hud-bpm-u';
    bpmU.textContent = 'bpm';
    bpmEl.append(bpmN, bpmU);

    const barsEl = document.createElement('div');
    barsEl.className = 'hud-bars';
    const cells = LENS.map((len) => {
        const cell = document.createElement('div');
        cell.className = 'hud-cell';
        const fill = document.createElement('i');
        const label = document.createElement('span');
        cell.append(fill, label);
        barsEl.appendChild(cell);
        return { len, fill, label };
    });

    const posEl = document.createElement('div');
    posEl.className = 'hud-pos';

    root.append(bpmEl, barsEl, posEl);
    canvas.appendChild(root);

    let on = false, raf = 0, lastIdx = -1, lastBpm = -1;

    function paint() {
        raf = on ? requestAnimationFrame(paint) : 0;
        if (!clock) return;

        const bpm = Math.round(clock.bpm);
        if (bpm !== lastBpm) { lastBpm = bpm; bpmN.textContent = bpm; }

        // Everything below steps once per BEAT. Bail on the frames in between —
        // which is most of them — before touching the DOM at all.
        const now = clock.now();
        const idx = Math.floor(now);
        if (idx === lastIdx) return;
        lastIdx = idx;

        for (const { len, fill, label } of cells) {
            const pos = (idx % len) + 1;
            fill.style.width = `${(pos / len) * 100}%`;
            label.textContent = `${pos}/${len}`;
        }
        const meter = clock.meter || 4;
        posEl.textContent = `bar ${Math.floor(idx / meter) + 1} · beat ${(idx % meter) + 1}`;
    }

    function setVisible(v) {
        on = !!v;
        root.style.display = on ? '' : 'none';
        try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (_) {}
        if (!on) { if (raf) cancelAnimationFrame(raf); raf = 0; return; }
        // Paint SYNCHRONOUSLY rather than waiting for a frame: turning it on and
        // seeing empty boxes until the next tick reads as broken, and a hidden tab
        // (or a throttled rAF) can make that wait arbitrarily long. paint() schedules
        // the loop itself, so this both draws and starts it.
        lastIdx = -1; lastBpm = -1;
        if (!raf) paint();
    }

    let saved = false;
    try { saved = localStorage.getItem(KEY) === '1'; } catch (_) {}
    setVisible(saved);

    return { setVisible, isVisible: () => on, el: root };
}
