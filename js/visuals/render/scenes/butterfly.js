// butterfly — mirrored FFT spectrum bars radiating from centre (adapted from stars).
function specAt(a, u) {
    const s = a && a.spectrum;
    if (s) return s[Math.max(0, Math.min(31, Math.floor(u * 32)))] || 0;
    return a ? (u < 0.34 ? a.bass : u < 0.67 ? a.mid : a.treble) : 0;
}
export default {
    name: 'butterfly',
    field(u, v, t, p, a) {
        const sc = (p.scale ?? 1);
        const bass = a ? a.bass : 0, treble = a ? a.treble : 0;
        const cx = (u - 0.5) * 2, cy = (0.5 - v) * 2;
        const r = Math.hypot(cx, cy);
        if (r > 1) return 0;
        const xMirror = Math.abs(cx), yFromC = Math.abs(cy);
        const nBars = 24 * sc;
        const barF = xMirror * nBars, barI = Math.floor(barF), subX = barF - barI;
        const amp = Math.min(1.0, Math.max(0.04, specAt(a, xMirror) * (1.0 + bass)));
        const gap = 0.15;
        const inGap = subX < gap || subX > 1 - gap;
        const fill = (yFromC <= amp && !inGap) ? (1.0 - yFromC * 0.5) : 0.0;
        const tip = (yFromC > amp - 0.03 && yFromC <= amp && !inGap) ? treble * 0.8 : 0.0;
        const center = Math.abs(cy) < 0.02 ? 0.6 : 0.0;
        return Math.min(1, Math.max(0, Math.max(fill + tip, center)));
    },
};
