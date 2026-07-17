// barcode — Ryoji-Ikeda scrolling FFT barcode: fine vertical lines lit where the
// live spectrum has energy, drifting sideways. (adapted from stars / CLIFT)
function specAt(a, u) {
    const s = a && a.spectrum;
    if (s) return s[Math.max(0, Math.min(31, Math.floor(u * 32)))] || 0;
    return a ? (u < 0.34 ? a.bass : u < 0.67 ? a.mid : a.treble) : 0;
}
export default {
    name: 'barcode',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1), sc = (p.scale ?? 1);
        const x = ((u * 0.5 + t * s * 0.08) % 1 + 1) % 1;
        const e = specAt(a, x);
        const lines = 0.5 + 0.5 * Math.sin(u * sc * 200);
        return e > 0.4 ? (0.4 + 0.6 * lines) * (0.5 + e * 0.5) : 0;
    },
};
