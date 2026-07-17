// ikedaglitch — row-corruption datamosh glitch: hashed per-row offset + per-pixel on/off (adapted from stars / CLIFT).
export default {
    name: 'ikedaglitch',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1), sc = (p.scale ?? 1);
        const bass = a ? a.bass : 0, volume = a ? a.level : 0;
        const beatDetected = bass > 0.5;
        const tt = t * s;
        const glBaseProb = 0.3, glRowProbBase = 0.05, glRowCount = 40, glOffsetScale = 1.0;
        const hash2 = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123; return n - Math.floor(n); };
        const frameId = Math.floor(tt * 60);
        const baseProb = glBaseProb + bass * 0.25;
        const rowProb = glRowProbBase + bass * 0.2 + (beatDetected ? 0.3 : 0);
        const rowCount = Math.max(1, Math.floor(glRowCount * Math.max(sc, 0.1)));
        const row = Math.floor(v * rowCount);
        const col = Math.floor(u * rowCount * 2);
        const rowR = hash2(row, frameId);
        const rowGlitch = rowR < rowProb;
        let colOffset = 0;
        if (rowGlitch) {
            const sign = hash2(row + 19.3, frameId + 7.1) < 0.5 ? -1 : 1;
            const mag = (5 + volume * 15) * glOffsetScale;
            colOffset = Math.round(sign * mag);
        }
        const sx = col + colOffset;
        let val = 0;
        const pixR = hash2(sx, row + frameId * 7919);
        if (pixR < baseProb) val = 0.5 + hash2(sx + 2.7, row + frameId * 7919 + 4.1) * 0.5;
        if (rowGlitch) {
            const rowPixR = hash2(sx + 8.8, row + frameId * 7919 + 1.3);
            val = rowPixR < 0.6 ? (0.7 + bass * 0.3) : 0;
        }
        return Math.min(1, Math.max(0, val));
    },
};
