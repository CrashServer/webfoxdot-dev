// ── Stock Ticker ──────────────────────────────────────────────────────────────
// Scrolling financial ticker tape with fake symbols, prices, and % changes.
// Bass hits cause red flash sell-offs; treble causes green rallies.

const _st = new WeakMap();

const SYMBOLS = [
    "BTC","ETH","BASS","VIBE","SOL","NRG","LIVE","STR","VJ1","MIDI",
    "DRM","FRQ","OSC","SPK","SUB","AMP","LFO","MOD","CLK","SYN",
    "NVDA","AAPL","META","GOOG","AMZN","MSFT","TSM","ASML","TSLA","AMD",
];

function makeEntry(sym, lcg) {
    const r = () => { lcg = (lcg * 1664525 + 1013904223) & 0x7fffffff; return lcg / 0x7fffffff; };
    const price = (r() * 999 + 1).toFixed(2);
    const chg = ((r() - 0.5) * 10).toFixed(2);
    const vol = Math.round(r() * 9999) + "K";
    return { sym, price, chg: parseFloat(chg), vol, lcg };
}

export const stockTickerParams = () => ({
    rows:     { base: 3,    min: 1,  max: 6,   step: 1,  mod: { source: "" } },
    speed:    { base: 60,   min: 10, max: 300,            mod: { source: "" } }, // px/sec
    fontSize: { base: 18,   min: 10, max: 36,  step: 1,  mod: { source: "" } },
    hue:      { base: 140,  min: 0,  max: 360,            mod: { source: "" } }, // positive change color
    pulse:    { base: 0.5,  min: 0,  max: 1,              mod: { source: "" } },
    glow:     { base: 0.4,  min: 0,  max: 1,              mod: { source: "" } },
    bgAlpha:  { base: 0.85, min: 0,  max: 1,              mod: { source: "" } },
    flash:    { base: 0.6,  min: 0,  max: 1,              mod: { source: "" } }, // bass flash intensity
});

export function drawStockTicker(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const rows    = Math.round(Math.max(1, Math.min(6, p.rows ?? 3)));
    const speed   = (p.speed ?? 60) * (1 + bass * (p.pulse ?? 0.5) * 0.5);
    const fsize   = Math.round(Math.max(10, Math.min(36, p.fontSize ?? 18)));
    const hue     = p.hue ?? 140;
    const glow    = p.glow ?? 0.4;
    const bgAlpha = p.bgAlpha ?? 0.85;
    const flash   = p.flash ?? 0.6;

    let st = _st.get(ctx);
    if (!st) {
        st = { rowData: [], scrollX: [], lcg: 42, lastT: t };
        for (let r = 0; r < 6; r++) {
            const entries = [];
            let seed = r * 7919 + 1;
            for (let i = 0; i < SYMBOLS.length; i++) {
                const e = makeEntry(SYMBOLS[i], seed);
                seed = e.lcg;
                entries.push(e);
            }
            st.rowData.push(entries);
            st.scrollX.push(w * r * 0.33);
        }
        _st.set(ctx, st);
    }

    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // Occasional price updates on treble
    if (treble > 0.6 && Math.random() < 0.1) {
        const ri = Math.floor(Math.random() * rows);
        const ei = Math.floor(Math.random() * st.rowData[ri].length);
        const e = st.rowData[ri][ei];
        const newPrice = (parseFloat(e.price) * (1 + (treble - 0.3) * 0.05)).toFixed(2);
        const newChg = e.chg + (treble - 0.5) * 3;
        st.rowData[ri][ei] = { ...e, price: newPrice, chg: newChg };
    }
    if (bass > 0.6 && Math.random() < 0.1) {
        const ri = Math.floor(Math.random() * rows);
        const ei = Math.floor(Math.random() * st.rowData[ri].length);
        const e = st.rowData[ri][ei];
        const newChg = e.chg - bass * 5;
        st.rowData[ri][ei] = { ...e, chg: newChg };
    }

    const rowH = h / rows;
    ctx.font = `bold ${fsize}px "Courier New", monospace`;
    ctx.textBaseline = "middle";

    if (glow > 0.05) {
        ctx.shadowBlur = glow * 10;
    }

    for (let r = 0; r < rows; r++) {
        st.scrollX[r] = (st.scrollX[r] - speed * dt + 99999999) % 99999999;
        const y = r * rowH + rowH / 2;
        const entries = st.rowData[r];

        // Separator line
        ctx.fillStyle = "rgba(60,60,60,0.5)";
        ctx.fillRect(0, r * rowH, w, 1);

        // Build one row string width
        let xPos = -st.scrollX[r] % (entries.length * (fsize * 12));
        while (xPos < -fsize * 12 * entries.length) xPos += fsize * 12 * entries.length;

        for (let i = 0; i < entries.length * 2; i++) {
            const e = entries[i % entries.length];
            const isPos = e.chg >= 0;
            const entryColor = isPos
                ? `hsl(${hue},90%,${50 + treble * 20}%)`
                : `hsl(0,90%,55%)`;

            // Flash on bass: red tint
            ctx.shadowColor = bass > 0.6 && !isPos
                ? `rgba(255,50,50,${flash})`
                : `hsl(${isPos ? hue : 0},100%,60%)`;

            const chgStr = (e.chg >= 0 ? "+" : "") + e.chg.toFixed(2) + "%";
            const text = `${e.sym} ${e.price} ${chgStr} `;

            ctx.fillStyle = entryColor;
            ctx.fillText(text, xPos, y);
            xPos += ctx.measureText(text).width + fsize;
        }
    }
    ctx.shadowBlur = 0;

    // Bass flash overlay
    if (bass > 0.5 && flash > 0.05) {
        ctx.fillStyle = `rgba(255,30,30,${bass * flash * 0.15})`;
        ctx.fillRect(0, 0, w, h);
    }
}
