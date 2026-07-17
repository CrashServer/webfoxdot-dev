// equalizer — a classic linear FFT bar graph: 32 columns rising from the bottom with
// the live spectrum, thin gaps between them. (adapted from stars / CLIFT)
function specAt(a, u) {
    const s = a && a.spectrum;
    if (s) return s[Math.max(0, Math.min(31, Math.floor(u * 32)))] || 0;
    return a ? (u < 0.34 ? a.bass : u < 0.67 ? a.mid : a.treble) : 0;
}
export default {
    name: 'equalizer',
    field(u, v, t, p, a) {
        const sc = (p.scale ?? 1);
        const h = specAt(a, u) * 0.95;
        const bar = v > (1 - h) ? 1 : 0;                 // v down: fill from the bottom up
        const gap = (u * 32 * sc) % 1 > 0.1 ? 1 : 0;     // thin gaps between columns
        return bar * gap;
    },
};
