// ASCII Plasma — retro demoscene plasma on a char grid.
// Overlapping sine waves drive glyph ramp + palette. Audio warps frequencies.

const CHARS = " .:-=+*#%@";
const _state = new WeakMap();

function _pal(v, mode) {
    v = v - Math.floor(v);
    if (mode === 1) return [255, (v*200)|0, (v*v*60)|0];
    if (mode === 2) return [(v*120)|0, (150+v*105)|0, 255];
    if (mode === 3) { const h = v*6; const x = (1 - Math.abs(h%2-1))*255;
        return [[255,x,0],[x,255,0],[0,255,x],[0,x,255],[x,0,255],[255,0,x]][h|0] || [255,0,0]; }
    return [(80+v*120)|0, (v*180)|0, (200-v*120)|0];
}

export const asciiPlasmaParams = () => ({
    scale:      { base: 1,   min: 0.2, max: 4,   mod: { source: "" } },
    speed:      { base: 1,   min: 0,   max: 4,   mod: { source: "" } },
    palette:    { base: 0,   min: 0,   max: 3,   mod: { source: "" } },
    brightness: { base: 1,   min: 0.1, max: 2,   mod: { source: "" } },
    cols:       { base: 60,  min: 24,  max: 120, mod: { source: "" } },
});

export function drawAsciiPlasma(ctx, w, h, p, t, extra) {
    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2.5) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2.5) : 0;
    const audio  = bass + treble*0.5;
    const mode   = Math.round(p.palette) % 4;

    const C = Math.max(24, Math.round(p.cols));
    const R = Math.max(14, (C * h / w) | 0);
    const cw = w/C, ch = h/R, fs = Math.min(cw,ch)*1.5;
    const f  = p.scale * (1 + audio*0.6);

    ctx.fillStyle = "#000"; ctx.fillRect(0,0,w,h);
    ctx.font = `${fs|0}px 'Courier New',monospace`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";

    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
        const u = x/C * 6.283 * f, vv = y/R * 6.283 * f;
        let v = Math.sin(u+t) + Math.sin(vv*0.8-t*0.7) + Math.sin((u+vv)*0.5+t*1.3) + Math.sin(Math.hypot(u-3*f, vv-2*f)-t);
        v = (v+4)/8;
        const [r, g, b] = _pal(v, mode);
        const ci = Math.min(CHARS.length-1, (v*CHARS.length)|0);
        if (ci === 0) continue;
        ctx.fillStyle = `rgb(${(r*p.brightness)|0},${(g*p.brightness)|0},${(b*p.brightness)|0})`;
        ctx.fillText(CHARS[ci], x*cw+cw/2, y*ch+ch/2);
    }
}
