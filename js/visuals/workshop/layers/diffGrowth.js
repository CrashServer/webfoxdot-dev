// ── Differential Growth ───────────────────────────────────────────────────
// Growing polygon with spring forces + short-range repulsion.
// Bass triggers vertex bursts and outward pulses. Treble tightens springs.
// Mid shifts hue. Multiple rings mode with different growth rates.
// Smooth chromatic gradient stroke, glow via shadow.

const _state = new WeakMap();

function bassLevel(s)   { if (!s?.length) return 0; const n=Math.max(1,s.length*.08|0); let v=0; for(let i=1;i<=n;i++) v+=s[i]; return Math.min(1, v/n*2.5); }
function midLevel(s)    { if (!s?.length) return 0; const a=s.length*.1|0, b=s.length*.4|0; let v=0; for(let i=a;i<b;i++) v+=s[i]; return Math.min(1, v/Math.max(1,b-a)*3); }
function trebleLevel(s) { if (!s?.length) return 0; const a=s.length*.5|0; let v=0; for(let i=a;i<s.length;i++) v+=s[i]; return Math.min(1, v/Math.max(1,s.length-a)*3); }

function makeRing(w, h, r, n) {
    const verts = [];
    for (let i = 0; i < n; i++) {
        const a = (i/n)*Math.PI*2;
        verts.push({ x: w/2+Math.cos(a)*r, y: h/2+Math.sin(a)*r, vx:0, vy:0 });
    }
    return verts;
}

function initState(w, h, rings) {
    const R = Math.min(w,h)*0.12;
    const ringArr = [];
    for (let ri = 0; ri < rings; ri++) {
        const r = R * (0.4 + ri*0.35);
        const n = 16 + ri*8;
        ringArr.push({ verts: makeRing(w,h,r,n), hueOffset: ri*60, frameNo: 0 });
    }
    return { rings: ringArr, prevBass: 0, pulse: 0, w, h };
}

function simRing(ring, w, h, p, bass, treble, hueBase) {
    const verts  = ring.verts;
    const n      = verts.length;
    const repelR = (p.repel ?? 0.04) * Math.min(w,h) * (1 + bass*1.5);
    const kSpring = 0.06 * (1 + treble*1.5);
    const targetL = (p.targetLen ?? 8) * (1 + ring.hueOffset*0.01);
    const maxEdge = targetL * 1.6;
    const minEdge = targetL * 0.45;
    const damping = 0.82;
    const steps   = Math.max(1, Math.round(p.speed ?? 1));

    for (let step = 0; step < steps; step++) {
        for (let i = 0; i < n; i++) { verts[i].fx = 0; verts[i].fy = 0; }

        // Spring along ring
        for (let i = 0; i < n; i++) {
            const a = verts[i], b = verts[(i+1)%n];
            const dx = b.x-a.x, dy = b.y-a.y;
            const d = Math.sqrt(dx*dx+dy*dy) || 1;
            const f = kSpring*(d-targetL);
            const fx = f*dx/d, fy = f*dy/d;
            a.fx += fx; a.fy += fy; b.fx -= fx; b.fy -= fy;
        }

        // Repulsion — spatial grid O(n) instead of O(n²)
        const rr = repelR * repelR;
        const cellSz = Math.max(1, repelR);
        const grid = new Map();
        for (let i = 0; i < n; i++) {
            const gx = Math.floor(verts[i].x / cellSz);
            const gy = Math.floor(verts[i].y / cellSz);
            const k = (gx * 73856093) ^ (gy * 19349663);
            if (!grid.has(k)) grid.set(k, []);
            grid.get(k).push(i);
        }
        for (let i = 0; i < n; i++) {
            const a = verts[i];
            const gx = Math.floor(a.x / cellSz);
            const gy = Math.floor(a.y / cellSz);
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const k = ((gx+dx) * 73856093) ^ ((gy+dy) * 19349663);
                    const cell = grid.get(k);
                    if (!cell) continue;
                    for (let ci = 0; ci < cell.length; ci++) {
                        const j = cell[ci];
                        if (j <= i) continue;
                        const adj = (j === i+1) || (i === 0 && j === n-1);
                        if (adj) continue;
                        const b = verts[j];
                        const ddx = a.x-b.x, ddy = a.y-b.y;
                        const d2 = ddx*ddx + ddy*ddy;
                        if (d2 < rr && d2 > 0.01) {
                            const d = Math.sqrt(d2);
                            const f = (repelR-d)/d*0.35;
                            a.fx += ddx*f; a.fy += ddy*f;
                            b.fx -= ddx*f; b.fy -= ddy*f;
                        }
                    }
                }
            }
        }

        // Bass pulse: radial outward push
        if (bass > 0.5) {
            const cx = w/2, cy = h/2;
            for (let i = 0; i < n; i++) {
                const v = verts[i];
                const dx = v.x-cx, dy = v.y-cy;
                const d = Math.sqrt(dx*dx+dy*dy) || 1;
                v.fx += dx/d * bass*0.8;
                v.fy += dy/d * bass*0.8;
            }
        }

        for (let i = 0; i < n; i++) {
            const v = verts[i];
            v.vx = (v.vx + (v.fx||0))*damping;
            v.vy = (v.vy + (v.fy||0))*damping;
            v.x += v.vx; v.y += v.vy;
        }

        // Insert long edges
        for (let i = verts.length-1; i >= 0 && verts.length < 1500; i--) {
            const a = verts[i], b = verts[(i+1)%verts.length];
            const dx = b.x-a.x, dy = b.y-a.y;
            if (Math.sqrt(dx*dx+dy*dy) > maxEdge) {
                verts.splice(i+1,0,{x:(a.x+b.x)/2,y:(a.y+b.y)/2,vx:0,vy:0});
            }
        }
        // Prune short edges
        for (let i = verts.length-1; i >= 0 && verts.length > 8; i--) {
            const a = verts[(i-1+verts.length)%verts.length];
            const b = verts[i];
            const c = verts[(i+1)%verts.length];
            if (Math.hypot(b.x-a.x,b.y-a.y) < minEdge && Math.hypot(c.x-b.x,c.y-b.y) < minEdge) verts.splice(i,1);
        }
    }
    ring.frameNo++;
    if (ring.frameNo > 6000 || verts.length > 1500) {
        const r = Math.min(w,h)*(0.1+ring.hueOffset*0.006);
        ring.verts = makeRing(w,h,r,24);
        ring.frameNo = 0;
    }
}

export const diffGrowthParams = () => ({
    hue:       { base: 160,  min: 0,    max: 360,  mod: { source: "" } },
    hueSpan:   { base: 120,  min: 0,    max: 360,  mod: { source: "" } },
    speed:     { base: 1,    min: 1,    max: 6,    mod: { source: "" } },
    repel:     { base: 0.04, min: 0.005,max: 0.15, mod: { source: "" } },
    targetLen: { base: 8,    min: 3,    max: 24,   mod: { source: "" } },
    rings:     { base: 2,    min: 1,    max: 4,    mod: { source: "" } },
    glow:      { base: 1.5,  min: 0,    max: 5,    mod: { source: "" } },
    lineWidth: { base: 1.5,  min: 0.5,  max: 5,    mod: { source: "" } },
    fade:      { base: 0.04, min: 0.005,max: 0.3,  mod: { source: "" } },
    fill:      { base: 0,    min: 0,    max: 1,    mod: { source: "" } },
});

export function drawDiffGrowth(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    const rings = Math.max(1, Math.round(p.rings ?? 2));
    if (!st || st.w !== w || st.h !== h || st.rings.length !== rings) {
        st = initState(w, h, rings); _state.set(ctx, st);
    }

    const s = extra?.spectrum;
    const bass   = bassLevel(s);
    const mid    = midLevel(s);
    const treble = trebleLevel(s);

    // Burst vertices on beat
    if (bass > 0.6 && bass > st.prevBass + 0.12) {
        for (let ri = 0; ri < st.rings.length; ri++) {
            const ring = st.rings[ri];
            const verts = ring.verts;
            const cnt = Math.min(15, (bass*20)|0);
            for (let k = 0; k < cnt && verts.length < 3000; k++) {
                const idx = Math.random()*verts.length | 0;
                const a = verts[idx], b = verts[(idx+1)%verts.length];
                verts.splice(idx+1,0,{x:(a.x+b.x)/2+(Math.random()-0.5)*8,y:(a.y+b.y)/2+(Math.random()-0.5)*8,vx:0,vy:0});
            }
        }
    }
    st.prevBass = bass;

    ctx.fillStyle = `rgba(0,0,0,${p.fade ?? 0.04})`;
    ctx.fillRect(0, 0, w, h);

    const hueBase  = p.hue + mid*40;
    const hueSpan  = p.hueSpan ?? 120;
    const glow     = p.glow ?? 1.5;

    for (let ri = 0; ri < st.rings.length; ri++) {
        simRing(st.rings[ri], w, h, p, bass, treble, hueBase);

        const verts = st.rings[ri].verts;
        const n     = verts.length;
        if (n < 3) continue;

        const hue2 = (hueBase + st.rings[ri].hueOffset) % 360;
        ctx.shadowBlur = 0;
        ctx.lineWidth   = p.lineWidth ?? 1.5;

        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0,   `hsl(${hue2},85%,65%)`);
        grad.addColorStop(0.5, `hsl(${(hue2+hueSpan*0.5)%360},90%,70%)`);
        grad.addColorStop(1,   `hsl(${(hue2+hueSpan)%360},85%,65%)`);

        ctx.beginPath();
        ctx.moveTo(verts[0].x, verts[0].y);
        for (let i = 1; i < n; i++) ctx.lineTo(verts[i].x, verts[i].y);
        ctx.closePath();

        if (p.fill > 0.5) {
            ctx.globalAlpha = 0.15 + bass*0.1;
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = grad;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
}
