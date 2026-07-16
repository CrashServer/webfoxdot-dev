// plasma — classic interfering sines. The friendly default; reacts to level.
export default {
    name: 'plasma',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1), k = (p.scale ?? 1) * 8;
        const tt = t * s + (a ? a.level * 1.5 : 0);
        const x = u * k, y = v * k;
        const val = Math.sin(x + tt)
                  + Math.sin(y + tt * 1.3)
                  + Math.sin((x + y) * 0.5 + tt * 0.7)
                  + Math.sin(Math.hypot(x - k / 2, y - k / 2) + tt);
        return val / 8 + 0.5;                 // -4..4 → 0..1
    },
};
