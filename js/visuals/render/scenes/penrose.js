// penrose — impossible (Penrose) triangle line-art, slowly rotating (adapted from stars / CLIFT).
export default {
    name: 'penrose',
    field(u, v, t, p, a) {
        const s = (p.speed ?? 1), sc = (p.scale ?? 1);
        const bass = a ? a.bass : 0;
        const tt = t * s;
        const epSize = 0.35, epThickness = 0.02, epRotSpeed = 0.2;
        const cu = u - 0.5, cv = v - 0.5;
        const ang = tt * epRotSpeed;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const rx = ca * cu - sa * cv, ry = sa * cu + ca * cv;
        const size = epSize * (1 + bass * 0.2);
        // Three vertices of an equilateral triangle.
        const v0x = 0.0, v0y = size * 0.866;
        const v1x = -size * 0.866, v1y = -size * 0.433;
        const v2x = size * 0.866, v2y = -size * 0.433;
        // point-to-segment distance
        const segDist = (px, py, ax, ay, bx, by) => {
            const dx = bx - ax, dy = by - ay;
            const l2 = dx * dx + dy * dy;
            let tp = 0;
            if (l2 > 1e-8) tp = ((px - ax) * dx + (py - ay) * dy) / l2;
            tp = Math.min(Math.max(tp, 0), 1);
            const qx = ax + dx * tp, qy = ay + dy * tp;
            return Math.hypot(px - qx, py - qy);
        };
        // Outer edges.
        const d0 = segDist(rx, ry, v0x, v0y, v1x, v1y);
        const d1 = segDist(rx, ry, v1x, v1y, v2x, v2y);
        const d2 = segDist(rx, ry, v2x, v2y, v0x, v0y);
        // Inner offset edges toward edge midpoints (fakes the impossibility).
        const c0x = (v0x + v1x) * 0.5, c0y = (v0y + v1y) * 0.5; // centres[2] = mid(v0,v1)
        const c1x = (v1x + v2x) * 0.5, c1y = (v1y + v2y) * 0.5; // centres[0] = mid(v1,v2)
        const c2x = (v0x + v2x) * 0.5, c2y = (v0y + v2y) * 0.5; // centres[1] = mid(v0,v2)
        const off = epThickness * 2.5;
        const k = off / size;
        const v0bx = v0x + (c0x - v0x) * k, v0by = v0y + (c0y - v0y) * k;
        const v1bx = v1x + (c1x - v1x) * k, v1by = v1y + (c1y - v1y) * k;
        const v2bx = v2x + (c2x - v2x) * k, v2by = v2y + (c2y - v2y) * k;
        const d0b = segDist(rx, ry, v0bx, v0by, v1bx, v1by);
        const d1b = segDist(rx, ry, v1bx, v1by, v2bx, v2by);
        const d2b = segDist(rx, ry, v2bx, v2by, v0bx, v0by);
        const thick = epThickness;
        const dmin = Math.min(Math.min(d0, d1, d2), Math.min(d0b, d1b, d2b));
        if (dmin > thick) return 0;
        let val = 1 - dmin / thick;
        val = val * val * (3 - 2 * val);
        return Math.min(1, Math.max(0, val));
    },
};
