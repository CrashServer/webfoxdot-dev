// ASCII Waveform — oscilloscope + spectrum analyser drawn with char ramp.
// Mode 0 = scope only, 1 = spectrum only, 2 = both stacked.

const RAMP = " .:-=+*#%@";
const _state = new WeakMap();

export const asciiWaveformParams = () => ({
    gain:   { base: 1,   min: 0.1, max: 5,   mod: { source: "" } },
    mode:   { base: 2,   min: 0,   max: 2,   mod: { source: "" } },
    hue:    { base: 140, min: 0,   max: 360, mod: { source: "" } },
    cols:   { base: 80,  min: 40,  max: 160, mod: { source: "" } },
    speed:  { base: 1,   min: 0.1, max: 4,   mod: { source: "" } },
});

export function drawAsciiWaveform(ctx, w, h, p, t, extra) {
    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2.5) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2.5) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2.5) : 0;
    const mode   = Math.round(p.mode) % 3;
    const hue = p.hue;
    const tr = Math.sin((hue)*Math.PI/180)*0.5+0.5;
    const tg = Math.sin((hue+120)*Math.PI/180)*0.5+0.5;
    const tb = Math.sin((hue+240)*Math.PI/180)*0.5+0.5;

    let st = _state.get(ctx);
    if (!st) { st = { hist: new Float32Array(256), bars: new Float32Array(64) }; _state.set(ctx, st); }

    const sample = (bass - treble + Math.sin(t*20*p.speed)*treble) * p.gain;
    for (let i = st.hist.length-1; i > 0; i--) st.hist[i] = st.hist[i-1]; st.hist[0] = sample;
    const nb = st.bars.length;
    for (let i = 0; i < nb; i++) {
        const v = sp ? sp[(i/nb*sp.length)|0]*p.gain : Math.abs(Math.sin(t*2+i))*bass;
        st.bars[i] += (v - st.bars[i])*0.35;
    }

    const U = Math.min(w, h);
    const C = Math.max(48, Math.round(p.cols)), R = Math.max(24, (C*h/w)|0);
    const cw = w/C, ch = h/R, fs = Math.min(cw,ch)*1.5;
    ctx.fillStyle = "#02050a"; ctx.fillRect(0,0,w,h);
    ctx.font = `${fs|0}px 'Courier New',monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";

    const put = (cx, cy, v) => {
        if (cx < 0 || cx >= C || cy < 0 || cy >= R || v < 0.08) return;
        const gi = Math.min(RAMP.length-1, (v*RAMP.length)|0);
        ctx.fillStyle = `rgba(${(tr*255*(0.5+v*0.5))|0},${(tg*255)|0},${(tb*255*(0.6+v*0.4))|0},${Math.min(1,v)})`;
        ctx.fillText(RAMP[gi], cx*cw+cw/2, cy*ch+ch/2);
    };

    if (mode === 0 || mode === 2) {
        const midY = R*0.28, amp = R*0.22;
        for (let cx = 0; cx < C; cx++) {
            const s = st.hist[(cx/C*st.hist.length)|0]||0;
            const y = midY - s*amp;
            const cyi = Math.max(0, Math.min(R-1, y|0));
            for (let yy = Math.min(cyi, midY|0); yy <= Math.max(cyi, midY|0); yy++) put(cx, yy, 0.3+Math.abs(s));
            put(cx, cyi, 0.6+Math.abs(s));
        }
    }
    if (mode === 1 || mode === 2) {
        const baseY = R*0.72, maxH = R*0.24;
        for (let cx = 0; cx < C; cx++) {
            const b = st.bars[(cx/C*nb)|0]||0;
            const bh = Math.min(maxH, b*maxH*3);
            for (let yy = 0; yy <= bh; yy++) { const v = 0.3+(yy/Math.max(1,bh))*0.7; put(cx,(baseY-yy)|0,v); put(cx,(baseY+yy)|0,v*0.6); }
        }
        ctx.strokeStyle = `rgba(${tr*255|0},${tg*255|0},${tb*255|0},0.2)`; ctx.beginPath(); ctx.moveTo(0,baseY*ch); ctx.lineTo(w,baseY*ch); ctx.stroke();
    }
}
