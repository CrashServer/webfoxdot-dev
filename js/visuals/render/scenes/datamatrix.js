// datamatrix — Ikeda data-matrix: a fine cell grid where each cell lights when the live
// spectrum energy for its column crosses a per-cell threshold, plus a scanning bar
// sweeping down. (adapted from stars / CLIFT)
function specAt(a, u) {
    const s = a && a.spectrum;
    // Length-aware: the analyser's bin count is 64 now (the workshop layers need
    // it) and hard-coding 32 here would sample only the bottom half of the range.
    if (s && s.length) return s[Math.max(0, Math.min(s.length - 1, Math.floor(u * s.length)))] || 0;
    return a ? (u < 0.34 ? a.bass : u < 0.67 ? a.mid : a.treble) : 0;
}
export default {
    name: 'datamatrix',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1), sc = (p.scale ?? 1), level = a ? a.level : 0;
        const cu = Math.floor(u * 128 * sc), cv = Math.floor(v * 64 * sc);
        const hsh = Math.sin(cu * 127.1 + cv * 311.7) * 43758.5453;
        const th = 0.3 + 0.14 * (hsh - Math.floor(hsh));
        const e = specAt(a, u);
        let val = e > th ? 0.55 + e * 0.45 : 0;
        const scanV = (t * s * 0.1) % 1;
        const sd = Math.abs(v - scanV);
        if (sd < 0.03) val = Math.max(val, (0.55 + level * 0.45) * (1 - sd / 0.03));
        return val;
    },
};
