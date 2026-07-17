// bars — a spectrum analyser: columns rise from the bottom with the audio bands
// (bass→treble left→right). No audio → a gentle animated fallback.
export default {
    name: 'bars',
    field(u, v, t, p, a) {
        const n = p.count ?? 16, bar = Math.min(n - 1, Math.floor(u * n));
        let lvl;
        if (a && (a.bass || a.mid || a.treble)) {
            const band = bar / n;
            lvl = band < 0.34 ? a.bass : band < 0.67 ? a.mid : a.treble;
        } else {
            lvl = Math.sin(bar * 1.7 + t * (p.speed ?? 1) * 2) * 0.4 + 0.5;
        }
        const h = 0.06 + lvl * 0.9;
        return v > (1 - h) ? 1 - (v - (1 - h)) * 0.3 : 0;   // solid bar, slight top fade
    },
};
