// ASCII Fire — Doom-style fire simulation on a char grid.
// Bass feeds the flame base. Colour themes: realistic / blue / green / ghost.

const CHARS = " .,:;+*#%@▒▓█";
const _state = new WeakMap();

function _color(v, theme) {
    v = Math.max(0, Math.min(1, v));
    if (theme === 1) return `rgb(${(v*120)|0},${(v*200)|0},255)`;
    if (theme === 2) return `rgb(${(v*120)|0},255,${(v*120)|0})`;
    if (theme === 3) return `rgba(200,220,255,${v})`;
    const r = Math.min(255, v*3*255), g = Math.min(255, Math.max(0,(v-0.33)*3)*255), b = Math.max(0,(v-0.66)*3)*255;
    return `rgb(${r|0},${g|0},${b|0})`;
}

export const asciiFireParams = () => ({
    cooling:   { base: 0.55, min: 0.1, max: 1.2, mod: { source: "" } },
    wind:      { base: 0.2,  min: -1,  max: 1,   mod: { source: "" } },
    spark:     { base: 0.9,  min: 0,   max: 1,   mod: { source: "" } },
    theme:     { base: 0,    min: 0,   max: 3,   mod: { source: "" } },
    audioReact:{ base: 1,    min: 0,   max: 3,   mod: { source: "" } },
    cols:      { base: 80,   min: 40,  max: 160, mod: { source: "" } },
});

export function drawAsciiFire(ctx, w, h, p, t, extra) {
    const sp = extra?.spectrum;
    const bass = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2.5) : 0;
    const theme = Math.round(p.theme) % 4;
    const C = Math.max(40, Math.round(p.cols)), R = Math.max(20, (C * h / w) | 0);

    let st = _state.get(ctx);
    if (!st || st.C !== C || st.R !== R) {
        st = { C, R, grid: new Float32Array(C * R) };
        _state.set(ctx, st);
    }
    const g = st.grid;
    const audioBoost = bass * (p.audioReact ?? 1);
    // seed bottom row
    for (let x = 0; x < C; x++)
        g[(R-1)*C+x] = Math.random() < p.spark ? Math.min(1, 0.7 + Math.random()*0.3 + audioBoost) : g[(R-1)*C+x]*0.9;
    // propagate upward
    for (let y = 0; y < R-1; y++) for (let x = 0; x < C; x++) {
        const src = (y+1)*C + Math.max(0, Math.min(C-1, x + ((Math.random()*3 - 1 + p.wind*2)|0)));
        g[y*C+x] = Math.max(0, g[src] - p.cooling*(0.6+Math.random()*0.8)/R);
    }
    const cw = w/C, ch = h/R, fs = Math.min(cw, ch)*1.5;
    ctx.fillStyle = "#000"; ctx.fillRect(0,0,w,h);
    ctx.font = `${fs|0}px 'Courier New',monospace`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
        const v = g[y*C+x]; if (v < 0.04) continue;
        ctx.fillStyle = _color(v, theme);
        ctx.fillText(CHARS[Math.min(CHARS.length-1,(v*CHARS.length)|0)], x*cw+cw/2, y*ch+ch/2);
    }
}
