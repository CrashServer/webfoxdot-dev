// biomech — Giger spine with vertebrae and ribs (adapted from stars).
export default {
    name: 'biomech',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1);
        const bass = a ? a.bass : 0, mid = a ? a.mid : 0, beat = bass;
        const tt = t * s;
        const sway = Math.sin(v * 8 + tt * 1.5) * (0.03 + bass * 0.02);
        let du = Math.abs(u - (0.5 + sway));
        du = Math.min(du, 1 - du);
        let val = Math.exp(-(du * du) * 6000) * (0.55 + bass * 0.35);
        const vphase = v * 20 + tt * 0.4;
        const vertebraT = vphase - Math.floor(vphase);
        const vert = Math.exp(-(vertebraT - 0.5) * (vertebraT - 0.5) * 50);
        const vertebraW = Math.exp(-(du * du) * 900);
        val = Math.max(val, vert * vertebraW * (0.55 + mid * 0.35));
        const rphase = v * 8 + tt * 0.2;
        const ribT = rphase - Math.floor(rphase);
        if (ribT > 0.12 && ribT < 0.20) {
            const ribW = 0.15 + mid * 0.08 + beat * 0.05;
            const armDist = du - 0.005;
            if (armDist > 0 && armDist < ribW) {
                const fall = 1 - armDist / ribW;
                val = Math.max(val, fall * (0.5 + beat * 0.4));
            }
        }
        return Math.min(1, Math.max(0, val));
    },
};
