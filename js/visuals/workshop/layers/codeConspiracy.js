// ── Code Conspiracy ──────────────────────────────────────────────────────────
// Ported from web/src/layers/codeConspiracy.js. Each eval pins a code snippet
// note to a cork board and connects it with red string to recent notes. BPM
// drives the string sway; svdk pins cyan, zbdm magenta. Reads extra.live.

const _st = new WeakMap();
const _rnd = (a, b) => a + Math.random() * (b - a);
const PAPER_TINTS = ["rgba(255,252,228,", "rgba(252,255,228,", "rgba(255,248,238,", "rgba(250,252,240,"];

export const codeConspiracyParams = () => ({
    maxNotes: { base: 18, min: 4, max: 30, step: 1, label: "max notes", mod: { source: "" } },
    sway:     { base: 1,  min: 0, max: 3,          label: "string sway", mod: { source: "" } },
});

function _init(w, h) {
    return {
        W: w, H: h, U: Math.min(w, h),
        notes: [], strings: [], lastEval: -1, t: 0, lastT: null, idc: 0,
        grain: Array.from({ length: 700 }, () => [_rnd(0, w), _rnd(0, h), Math.random()]),
    };
}

function _addNote(s, code, user, w, h, maxNotes) {
    const U = s.U, m = U * 0.09;
    const id = ++s.idc;
    const note = {
        id, x: _rnd(m, w - m), y: _rnd(m, h - m),
        text: code.slice(0, 32), user,
        hue: user === "svdk" ? 185 : 305,
        angle: _rnd(-0.26, 0.26),
        tint: PAPER_TINTS[Math.random() * PAPER_TINTS.length | 0],
        age: 0,
    };
    if (s.notes.length > 0) {
        const srcIdx = Math.max(0, s.notes.length - 1 - (Math.random() * 3 | 0));
        s.strings.push({ fromId: s.notes[srcIdx].id, toId: id });
    }
    s.notes.push(note);
    while (s.notes.length > maxNotes) {
        const dead = s.notes.shift().id;
        s.strings = s.strings.filter((st) => st.fromId !== dead && st.toId !== dead);
    }
}

export function drawCodeConspiracy(ctx, w, h, params, t, extra) {
    let s = _st.get(ctx);
    if (!s || s.W !== w || s.H !== h) { s = _init(w, h); _st.set(ctx, s); }

    const dt = s.lastT == null ? 1 / 60 : Math.max(0, Math.min(0.1, t - s.lastT));
    s.lastT = t;
    s.t += dt;

    const lv = extra?.live || {};
    const ec = lv.evalCount ?? 0;
    const bpm = lv.bpm || 120;
    const maxNotes = Math.round(params.maxNotes ?? 18);
    const swayK = params.sway ?? 1;
    const tt = s.t;
    const swayHz = bpm / 60;

    if (ec !== s.lastEval) {
        s.lastEval = ec;
        const user = lv.lastEvalUser || "svdk";
        const win = (user === "svdk" ? lv.svdk : lv.zbdm) || {};
        const rawL = win.lines;
        const raw = rawL ? (Array.isArray(rawL) ? rawL.join("\n") : rawL) : "";
        const lines = raw.split("\n");
        const code = (lines.find((l) => l.trim()) || "eval").trim();
        _addNote(s, code, user, w, h, maxNotes);
    }

    // cork board background
    ctx.fillStyle = "#c09050"; ctx.fillRect(0, 0, w, h);
    for (const [gx, gy, ga] of s.grain) {
        ctx.fillStyle = ga > 0.62 ? "rgba(185,145,55,0.14)" : "rgba(70,42,8,0.10)";
        ctx.fillRect(gx, gy, ga > 0.88 ? 3 : 1, 1);
    }
    ctx.strokeStyle = "rgba(80,50,10,0.4)"; ctx.lineWidth = 3;
    ctx.strokeRect(1, 1, w - 2, h - 2);

    const U = s.U;
    const noteMap = new Map(s.notes.map((n) => [n.id, n]));
    ctx.lineWidth = Math.max(1, U * 0.0022);
    for (const st of s.strings) {
        const a = noteMap.get(st.fromId), b = noteMap.get(st.toId);
        if (!a || !b) continue;
        const sway = Math.sin(tt * swayHz * Math.PI * 2 + st.fromId * 0.001) * U * 0.022 * swayK;
        const sway2 = Math.sin(tt * swayHz * Math.PI * 2 + st.toId * 0.001 + 1.4) * U * 0.016 * swayK;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + U * 0.05;
        const age = Math.min(1, Math.min(a.age, b.age) * 2);
        ctx.strokeStyle = `rgba(140,8,8,${0.75 * age})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.bezierCurveTo(mx + sway, my, mx - sway2, my, b.x, b.y);
        ctx.stroke();
    }

    const nw = U * 0.26, nh = U * 0.105, fs = U * 0.014;
    for (const n of s.notes) {
        n.age += dt;
        const al = Math.min(1, n.age * 3);
        ctx.save();
        ctx.translate(n.x, n.y);
        ctx.rotate(n.angle + Math.sin(tt * swayHz * Math.PI * 2 * 0.5 + n.id * 0.0001) * 0.007);

        ctx.shadowColor = "rgba(0,0,0,0.52)";
        ctx.shadowBlur = U * 0.018;
        ctx.shadowOffsetX = U * 0.007;
        ctx.shadowOffsetY = U * 0.009;
        ctx.fillStyle = `${n.tint}${al})`; ctx.fillRect(-nw / 2, -nh / 2, nw, nh);
        ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

        ctx.strokeStyle = `rgba(170,170,200,${al * 0.4})`; ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let l = 1; l < 3; l++) { ctx.moveTo(-nw / 2 + 4, -nh / 2 + l * nh / 3); ctx.lineTo(nw / 2 - 4, -nh / 2 + l * nh / 3); }
        ctx.stroke();

        ctx.font = `bold ${(fs * 0.66) | 0}px 'Courier New',monospace`;
        ctx.fillStyle = `hsla(${n.hue},75%,38%,${al})`; ctx.textAlign = "left"; ctx.textBaseline = "top";
        ctx.fillText(`[${n.user.toUpperCase()}]`, -nw / 2 + U * 0.007, -nh / 2 + U * 0.006);

        ctx.font = `${(fs * 0.9) | 0}px 'Courier New',monospace`;
        ctx.fillStyle = `rgba(15,15,35,${al})`; ctx.textBaseline = "middle";
        ctx.fillText(n.text, -nw / 2 + U * 0.007, nh * 0.10);

        ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = U * 0.014;
        ctx.fillStyle = `hsla(${n.hue},90%,36%,${al})`;
        ctx.beginPath(); ctx.arc(0, -nh / 2, U * 0.016, 0, 6.28); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = `hsla(${n.hue},90%,70%,${al * 0.7})`;
        ctx.beginPath(); ctx.arc(0, -nh / 2, U * 0.006, 0, 6.28); ctx.fill();

        ctx.restore();
    }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
