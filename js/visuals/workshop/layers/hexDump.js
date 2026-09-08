// ── Hex Dump ──────────────────────────────────────────────────────────────────
// Classic memory hex dump: address column, hex bytes, ASCII column.  Audio-
// reactive: bass hits corrupt a random chunk; treble accelerates scroll.
// Bytes in "hot" regions flicker to simulate live memory reads.

const _st = new WeakMap();
const BUF_SIZE = 4096;
const HEX = "0123456789ABCDEF";

function toHex(v) { return HEX[(v >> 4) & 0xF] + HEX[v & 0xF]; }
function toPrintable(v) { return (v >= 32 && v < 127) ? String.fromCharCode(v) : "."; }

// LCG to generate plausible-looking memory content (includes strings + code)
function fillBuffer(buf) {
    // Embed a few ASCII strings so the ASCII column looks interesting
    const strings = [
        "VBIOS", "GTX", "PCI\\VEN_10DE", "NVIDIA GeForce RTX",
        "kernel", "linux", "/dev/sda", "EXT4", "GRUB",
        "MZ\x90\x00", "PE\x00\x00", "ELF\x02\x01\x01",
        "workshop", "LIVE", "VJ SESSION",
        "0x0000", "FFFF", "NULL", "DEAD", "BEEF", "CAFE",
    ];
    // Random fill first
    let lcg = 0xDEADBEEF;
    for (let i = 0; i < BUF_SIZE; i++) {
        lcg = (Math.imul(lcg, 1664525) + 1013904223) >>> 0;
        buf[i] = lcg & 0xFF;
    }
    // Embed readable strings at scattered offsets
    for (let s = 0; s < strings.length; s++) {
        const off = (s * 137 + 42) % (BUF_SIZE - 32);
        for (let c = 0; c < strings[s].length && off + c < BUF_SIZE; c++) {
            buf[off + c] = strings[s].charCodeAt(c);
        }
    }
}

export const hexDumpParams = () => ({
    cols:     { base: 16,  min: 8,   max: 32,  step: 8,  mod: { source: "" } }, // bytes per row
    fontSize: { base: 12,  min: 8,   max: 18,  step: 1,  mod: { source: "" } },
    hue:      { base: 120, min: 0,   max: 360,           mod: { source: "" } }, // 120=green,40=amber,220=blue
    speed:    { base: 0.8, min: -4,  max: 4,             mod: { source: "" } }, // rows/sec (neg=up)
    noise:    { base: 0.3, min: 0,   max: 1,             mod: { source: "" } }, // fraction of bytes live-flickering
    pulse:    { base: 0.5, min: 0,   max: 1,             mod: { source: "" } }, // bass corruption amount
    highlight:{ base: 0.4, min: 0,   max: 1,             mod: { source: "" } }, // highlight hot bytes
    addrBase: { base: 0,   min: 0,   max: 7,   step: 1,  mod: { source: "" } }, // address segment preset
});

const ADDR_BASES = [
    0x00000000, 0xDEAD0000, 0xCAFE0000, 0xBEEF0000,
    0xFFFF8000, 0x7FFF0000, 0x0040C000, 0xC0000000,
];

export function drawHexDump(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;
    const prevB  = extra?._prevB ?? 0;
    if (extra) extra._prevB = bass;

    const cols     = Math.round(Math.max(8, Math.min(32, p.cols ?? 16)));
    const fs       = Math.max(8, Math.round(p.fontSize ?? 12));
    const hue      = p.hue ?? 120;
    const speed    = (p.speed ?? 0.8) * (1 + treble * 0.8);
    const noise    = p.noise ?? 0.3;
    const pulse    = p.pulse ?? 0.5;
    const highlight= p.highlight ?? 0.4;
    const addrSeg  = Math.round(Math.max(0, Math.min(7, p.addrBase ?? 0)));
    const baseAddr = ADDR_BASES[addrSeg];

    let st = _st.get(ctx);
    if (!st) {
        const data = new Uint8Array(BUF_SIZE);
        fillBuffer(data);
        st = { data, scroll: 0, lastT: t, corruption: new Uint8Array(BUF_SIZE), corrTimer: 0 };
        _st.set(ctx, st);
    }

    const dt = Math.min(0.1, t - st.lastT);
    st.lastT = t;
    st.scroll += speed * dt;

    // Keep scroll in bounds (wrap)
    const totalRows = Math.ceil(BUF_SIZE / cols);
    if (st.scroll < 0)          st.scroll += totalRows;
    if (st.scroll >= totalRows) st.scroll -= totalRows;

    // Bass hit: corrupt a random chunk
    const bassHit = bass > 0.65 && bass > prevB + 0.08;
    if (bassHit && pulse > 0.05) {
        const chunkSize = Math.floor(32 + pulse * bass * 128);
        const off = Math.floor(Math.random() * (BUF_SIZE - chunkSize));
        let lcg = (Date.now() & 0xFFFF) ^ (off);
        for (let i = 0; i < chunkSize; i++) {
            lcg = (Math.imul(lcg, 1664525) + 1013904223) >>> 0;
            st.data[(off + i) % BUF_SIZE] = lcg & 0xFF;
            st.corruption[(off + i) % BUF_SIZE] = 8; // frames to highlight
        }
    }

    // Decay corruption highlights
    st.corrTimer += dt;
    if (st.corrTimer > 0.05) {
        st.corrTimer = 0;
        for (let i = 0; i < BUF_SIZE; i++) { if (st.corruption[i] > 0) st.corruption[i]--; }
    }

    // ── Draw ──────────────────────────────────────────────────────────────────
    ctx.clearRect(0, 0, w, h);

    const mono  = `${fs}px "Courier New", Courier, monospace`;
    ctx.font    = mono;
    ctx.textBaseline = "top";
    const cw    = Math.round(fs * 0.6);   // approx char width
    const lineH = Math.round(fs * 1.6);

    const addrCols = 10;  // "0xDEAD0000" = 10 chars
    const addrW    = addrCols * cw;
    const hexW     = cols * 3 * cw;       // "XX " per byte
    const sepW     = cw * 2;
    const asciiW   = cols * cw;

    const totalW   = addrW + 2 + hexW + sepW + asciiW;
    const ox       = Math.round((w - totalW) / 2);

    const visRows  = Math.ceil(h / lineH) + 1;
    const topRow   = Math.floor(st.scroll);
    const subPx    = (st.scroll % 1) * lineH;

    // Header
    ctx.fillStyle = `hsl(${hue},60%,35%)`;
    let headerHex = "";
    for (let c = 0; c < cols; c++) headerHex += toHex(c) + (c < cols-1 ? " " : "");
    ctx.fillText("  Offset  ", ox, 0);
    ctx.fillText(headerHex, ox + addrW + 2, 0);
    ctx.fillText("  Decoded", ox + addrW + 2 + hexW + sepW - cw, 0);

    // Separator line
    ctx.fillStyle = `hsl(${hue},40%,22%)`;
    ctx.fillRect(ox, lineH - 2, totalW, 1);

    // Use an LCG seeded per-frame for the live-noise flicker
    let lcg = (Math.floor(t * 20)) >>> 0;
    const rng = () => { lcg = (Math.imul(lcg, 1664525) + 1013904223) >>> 0; return lcg / 0x100000000; };

    for (let row = 0; row < visRows; row++) {
        const dataRow = (topRow + row) % totalRows;
        const byteOff = dataRow * cols;
        const y       = lineH + row * lineH - subPx;
        if (y > h) break;

        // Address
        const addr = (baseAddr + byteOff) >>> 0;
        const addrStr = "0x" + addr.toString(16).toUpperCase().padStart(8, "0");
        ctx.fillStyle = `hsl(${hue},50%,45%)`;
        ctx.fillText(addrStr, ox, y);

        // Hex bytes + ASCII
        let asciiStr = "";
        for (let c = 0; c < cols; c++) {
            const bi  = (byteOff + c) % BUF_SIZE;
            let   bv  = st.data[bi];

            // Live noise: randomly flicker some bytes
            if (noise > 0 && rng() < noise * 0.04) {
                bv = Math.floor(rng() * 256);
            }

            const isCorrupt = st.corruption[bi] > 0;
            const isHighlight = highlight > 0 && (bv === 0x00 || bv === 0xFF || bv === 0x0D || bv === 0x0A || (bv >= 0x20 && bv < 0x7F));

            // Color coding per byte category
            let color;
            if (isCorrupt) {
                color = `hsl(0,90%,${60 + st.corruption[bi] * 4}%)`;
            } else if (bv === 0x00) {
                color = `hsl(${hue},20%,25%)`;   // null = dim
            } else if (bv === 0xFF) {
                color = `hsl(${hue},90%,85%)`;   // 0xFF = bright
            } else if (bv >= 0x20 && bv < 0x7F) {
                color = isHighlight && highlight > 0.3
                    ? `hsl(${(hue+80)%360},90%,70%)`  // printable = highlighted
                    : `hsl(${hue},70%,65%)`;
            } else {
                color = `hsl(${hue},55%,50%)`;    // control chars
            }

            // Draw each byte individually to allow per-byte colouring
            ctx.fillStyle = color;
            if (isCorrupt) {
                ctx.save();
                ctx.shadowBlur = 6;
                ctx.shadowColor = `hsl(0,100%,60%)`;
            }
            ctx.fillText(toHex(bv), ox + addrW + 2 + c * 3 * cw, y);
            if (isCorrupt) ctx.restore();

            if (c < cols - 1) {
                ctx.fillStyle = `hsl(${hue},30%,30%)`;
                ctx.fillText(" ", ox + addrW + 2 + c * 3 * cw + 2 * cw, y);
            }

            asciiStr += toPrintable(bv);
        }

        // ASCII column
        ctx.fillStyle = `hsl(${hue},50%,45%)`;
        ctx.fillText("|", ox + addrW + 2 + hexW, y);
        ctx.fillText(asciiStr, ox + addrW + 2 + hexW + cw, y);
        ctx.fillText("|", ox + addrW + 2 + hexW + cw + asciiW, y);
    }

    // Scanline overlay for CRT feel
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#000";
    for (let sy = 0; sy < h; sy += 4) ctx.fillRect(0, sy, w, 2);
    ctx.restore();
}

