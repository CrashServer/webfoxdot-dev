// mandala — radial petals over pulsing rings; symmetric and hypnotic.
export default {
    name: 'mandala',
    field(u, v, t, p) {
        const s = (p.speed ?? 1), pet = p.petals ?? 8;
        const dx = u - 0.5, dy = v - 0.5;
        const r = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
        const petals = Math.abs(Math.cos(ang * pet + t * s * 0.5));
        const rings = Math.abs(Math.sin(r * 30 - t * s));
        return Math.max(0, petals * rings * (1 - r * 1.3));
    },
};
