// ── Beat Creatures ───────────────────────────────────────────────────────────
// Ported from web/src/layers/beatCreatures.js (WGSL → Canvas2D). Each active
// FoxDot player (from extra.live.players, else detected in the code) is a round
// creature that bobs on the beat, blinks, and hops / opens its mouth on
// evaluation. Colour per player name; squash-stretch on the bob.

import { collectInstruments, instrumentColor } from "./_livecodeParse.js";

const MAXC = 10, ML = 4;
const variantOf = (name) => { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0; return h % 3; };

export const beatCreaturesParams = () => ({
    size:       { base: 0.12, min: 0.05, max: 0.3, label: "creature size", mod: { source: "" } },
    ringRadius: { base: 0.5,  min: 0,    max: 0.8, label: "ring radius", mod: { source: "" } },
    spin:       { base: 0.1,  min: -1,   max: 1,   label: "ring spin", mod: { source: "" } },
    outline:    { base: 0.14, min: 0,    max: 0.3, label: "outline weight", mod: { source: "" } },
    brightness: { base: 1,    min: 0.3,  max: 2,   label: "brightness", mod: { source: "" } },
    showDemo:   { base: 1,    min: 0, max: 1, step: 1, label: "demo when idle (0/1)", mod: { source: "" } },
});

const rgb = (c, k) => `rgb(${Math.min(255, c[0] * k * 255) | 0},${Math.min(255, c[1] * k * 255) | 0},${Math.min(255, c[2] * k * 255) | 0})`;

export function drawBeatCreatures(ctx, w, h, params, t, extra) {
    const lv = extra?.live || {};
    const pulse = Math.max(0, Math.min(1, lv.pulse ?? 0));

    let players = Array.isArray(lv.players) && lv.players.length ? lv.players.map((x) => String(x)) : [];
    const insts = collectInstruments(lv, MAXC);
    if (!players.length && insts.length) players = insts.map((e) => e.player);
    if (!players.length && (params.showDemo | 0)) players = ["d1", "b1", "p1", "s1"];
    const flashOf = (name) => { const e = insts.find((x) => x.player === name); return e ? e.flash : 0; };

    const n = Math.min(players.length, MAXC);
    ctx.clearRect(0, 0, w, h);
    if (!n) {
        ctx.fillStyle = "rgba(150,150,160,0.35)";
        ctx.font = `${Math.min(w, h) * 0.03 | 0}px 'Courier New',monospace`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("no players", w / 2, h / 2);
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        return;
    }

    const cx = w * 0.5, cy = h * 0.5, R = Math.min(w, h) * 0.5;
    const ringR = R * (params.ringRadius ?? 0.5), baseR = R * (params.size ?? 0.12);
    const outline = Math.max(1, (params.outline ?? 0.14) * Math.min(w, h) * 0.05);
    const bright = params.brightness ?? 1;

    for (let i = 0; i < n; i++) {
        const name = players[i];
        const ang = -Math.PI / 2 + (i / Math.max(n, 1)) * Math.PI * 2 + t * (params.spin ?? 0.1);
        const bobPhase = t * 4 + i * 1.3;
        const bob = Math.sin(bobPhase) * baseR * 0.12 * (0.5 + pulse);
        const bx = n === 1 ? cx : cx + Math.cos(ang) * ringR;
        const by = (n === 1 ? cy : cy + Math.sin(ang) * ringR) - bob;
        const pop = Math.max(0, Math.min(1, flashOf(name)));
        const r = baseR * (1 + pulse * 0.12 + pop * 0.28);
        const sq = Math.sin(bobPhase) * (0.14 + pulse * 0.12) - pop * 0.16;
        const rx = r * (1 - sq), ry = r * (1 + sq);
        const blinkPhase = (t * 0.5 + i * 0.37) % 3.0;
        const blink = blinkPhase < 0.12;
        const mouth = Math.max(pulse * 0.5, pop);
        const col = instrumentColor(name);
        const variant = variantOf(name);

        ctx.save();
        ctx.translate(bx, by);

        // body
        ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = rgb(col, bright); ctx.fill();
        // cell-shade lower
        ctx.save(); ctx.clip();
        ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.fillRect(-rx, ry * 0.2, rx * 2, ry);
        ctx.restore();
        // outline
        ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.lineWidth = outline; ctx.strokeStyle = "#0a0a12"; ctx.stroke();

        // eyes
        const eyeDX = rx * 0.4, eyeY = -ry * 0.2, eyeR = r * (0.18 + variant * 0.03);
        for (const sx of [-1, 1]) {
            ctx.beginPath(); ctx.arc(sx * eyeDX, eyeY, eyeR, 0, Math.PI * 2);
            ctx.fillStyle = "#fff"; ctx.fill();
            ctx.lineWidth = outline * 0.5; ctx.strokeStyle = "#0a0a12"; ctx.stroke();
            if (blink) {
                ctx.beginPath(); ctx.moveTo(sx * eyeDX - eyeR, eyeY); ctx.lineTo(sx * eyeDX + eyeR, eyeY);
                ctx.lineWidth = outline * 0.7; ctx.strokeStyle = "#0a0a12"; ctx.stroke();
            } else {
                const pupR = eyeR * 0.5, look = variant === 1 ? Math.sin(t * 2 + i) * eyeR * 0.3 : 0;
                ctx.beginPath(); ctx.arc(sx * eyeDX + look, eyeY + eyeR * 0.15, pupR, 0, Math.PI * 2);
                ctx.fillStyle = "#0a0a12"; ctx.fill();
            }
        }

        // mouth: opens with `mouth`
        const mw = rx * 0.5, mh = ry * (0.08 + mouth * 0.32), my = ry * 0.32;
        ctx.beginPath(); ctx.ellipse(0, my, mw, mh, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#3a0a14"; ctx.fill();
        ctx.lineWidth = outline * 0.5; ctx.strokeStyle = "#0a0a12"; ctx.stroke();

        // label below
        const label = name.toUpperCase().slice(0, ML);
        const fs = Math.max(8, r * 0.4) | 0;
        ctx.font = `bold ${fs}px 'Courier New',monospace`;
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.lineWidth = Math.max(2, fs * 0.2); ctx.strokeStyle = "#0a0a12";
        ctx.strokeText(label, 0, ry + fs * 0.3);
        ctx.fillStyle = "#fff"; ctx.fillText(label, 0, ry + fs * 0.3);

        ctx.restore();
    }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
