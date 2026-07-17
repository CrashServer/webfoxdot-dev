// kaleido — coordinates folded into a mirrored wedge → kaleidoscopic symmetry.
export default {
    name: 'kaleido',
    field(u, v, t, p) {
        const s = (p.speed ?? 1), seg = p.segments ?? 6;
        const dx = u - 0.5, dy = v - 0.5;
        const r = Math.hypot(dx, dy);
        let ang = Math.atan2(dy, dx) + t * s * 0.2;
        const wedge = Math.PI * 2 / seg;
        ang = Math.abs(((ang % wedge) + wedge) % wedge - wedge / 2);   // mirror into one wedge
        const x = Math.cos(ang) * r * 20, y = Math.sin(ang) * r * 20;
        const va = Math.sin(x + t * s) * 0.5 + 0.5;
        const vb = Math.cos(y - t * s) * 0.5 + 0.5;
        return va * vb;
    },
};
