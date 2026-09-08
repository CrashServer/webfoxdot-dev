// ── Constellation ─────────────────────────────────────────────────────────────
// Animated star map: stars drift, connections form by proximity. Bass triggers
// shooting stars. Treble brightens constellation lines. Mid drives hue cycling.
// Named constellation patterns emerge from the edge network over time.

const _state = new WeakMap();
const rnd = (a, b) => a + Math.random() * (b - a);

const SHOT_MAX = 8;

class ConstellationViz {
    constructor(n, w, h) {
        this.stars = [];
        this.shooters = [];
        this.pulse = 0;
        this.prevBass = 0;
        this.t = 0;
        this._spawnStars(n, w, h);
    }

    _spawnStars(n, w, h) {
        for (let i = 0; i < n; i++) {
            const mag = rnd(0.3, 1.0); // magnitude (brightness)
            this.stars.push({
                x:   rnd(0, w),     y: rnd(0, h),
                vx:  rnd(-0.15, 0.15), vy: rnd(-0.15, 0.15),
                mag, r: 0.6 + mag*1.8,
                flicker: rnd(2, 7),
                phase: Math.random()*Math.PI*2,
            });
        }
    }

    _shootingStar(w, h, hue) {
        if (this.shooters.length >= SHOT_MAX) return;
        const a = rnd(-0.4, 0.4) + Math.PI * 0.25;
        const speed = rnd(6, 14);
        this.shooters.push({
            x: rnd(0, w), y: rnd(0, h*0.5),
            vx: Math.cos(a)*speed, vy: Math.sin(a)*speed + rnd(2,5),
            len: rnd(40, 120), life: 1, hue,
        });
    }

    frame(ctx, w, h, p, t, bass, mid, treble, _pal, pC) {
        if (!this.lastT) this.lastT = t;
        const dt = Math.min(0.05, Math.max(0, t - this.lastT)); this.lastT = t;
        this.t += dt;
        const count    = Math.max(20, Math.min(350, Math.round(p.count)));
        const connDist = p.connDist * Math.min(w, h);
        const hue      = (p.hue + mid * p.midShift) % 360;
        const glow     = p.glow;
        const speed    = p.speed;
        const fade     = p.fade;
        const linePow  = p.linePow;

        // Beat detection
        if (bass > 0.55 && bass > this.prevBass + 0.1) {
            this.pulse = 1.0;
            const shots = 1 + Math.floor(bass * 3);
            for (let i = 0; i < shots; i++) this._shootingStar(w, h, hue);
        }
        this.prevBass = bass;
        this.pulse *= 0.87;

        // Spawn / cull stars
        while (this.stars.length < count) {
            const mag = rnd(0.3, 1.0);
            this.stars.push({ x: rnd(0,w), y: rnd(0,h), vx: rnd(-0.15,0.15), vy: rnd(-0.15,0.15), mag, r: 0.6+mag*1.8, flicker: rnd(2,7), phase: Math.random()*Math.PI*2 });
        }
        if (this.stars.length > count) this.stars.length = count;

        ctx.fillStyle = `rgba(0,2,12,${fade})`;
        ctx.fillRect(0, 0, w, h);

        // Move stars
        for (let i = 0; i < this.stars.length; i++) {
            const s = this.stars[i];
            s.x += s.vx * speed; s.y += s.vy * speed;
            if (s.x < 0) s.x = w; if (s.x > w) s.x = 0;
            if (s.y < 0) s.y = h; if (s.y > h) s.y = 0;
        }

        // Connection lines — treble brightens, pulse flashes
        const edgeDist  = connDist * (0.5 + treble * 0.8);
        const edgeAlpha = (0.06 + treble * linePow * 0.5 + this.pulse * 0.4) * p.lineAlpha;
        const lineW     = 0.5 + treble * 1.2 + this.pulse * 1.5;

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.lineWidth = lineW;
        for (let i = 0; i < this.stars.length; i++) {
            for (let j = i + 1; j < this.stars.length; j++) {
                const dx = this.stars[i].x - this.stars[j].x;
                const dy = this.stars[i].y - this.stars[j].y;
                const d2 = dx*dx + dy*dy;
                if (d2 >= edgeDist*edgeDist) continue;
                const near = 1 - Math.sqrt(d2)/edgeDist;
                const lh = (hue + near*50 + this.pulse*60) % 360;
                const ll = 60 + this.pulse*25 + treble*20;
                ctx.strokeStyle = _pal
                    ? pC(0.5)
                    : `hsla(${lh},80%,${ll}%,${edgeAlpha * near * near})`;
                ctx.beginPath();
                ctx.moveTo(this.stars[i].x, this.stars[i].y);
                ctx.lineTo(this.stars[j].x, this.stars[j].y);
                ctx.stroke();
            }
        }
        ctx.restore();

        // Draw stars
        ctx.save();
        if (glow > 0.05) { ctx.shadowBlur = 0; }
        for (let i = 0; i < this.stars.length; i++) {
            const s   = this.stars[i];
            const flk = 1 + 0.25 * Math.sin(this.t * s.flicker + s.phase);
            const sr  = s.r * flk * (1 + bass*0.5 + this.pulse*0.8);
            const sh  = (hue + s.mag*40) % 360;
            const sl  = 80 + s.mag*20;
            const sa  = s.mag * (0.7 + treble*0.3);
            // Palette: color star by magnitude (brightness/size proxy, range 0.3–1.0)
            const starCol = _pal ? pC(s.mag) : null;
            if (glow > 0.05)            ctx.fillStyle = starCol ?? `hsla(${sh},70%,${sl}%,${sa})`;
            ctx.beginPath(); ctx.arc(s.x, s.y, sr, 0, Math.PI*2); ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.restore();

        // Shooting stars
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const keepShooters = [];
        for (let i = 0; i < this.shooters.length; i++) {
            const sh = this.shooters[i];
            sh.x += sh.vx; sh.y += sh.vy; sh.life -= 0.04;
            if (sh.life <= 0 || sh.x < -200 || sh.x > w+200 || sh.y > h+100) continue;
            const tail = Math.min(sh.len, sh.len * sh.life);
            const sx0  = sh.x - sh.vx*(tail/Math.hypot(sh.vx,sh.vy));
            const sy0  = sh.y - sh.vy*(tail/Math.hypot(sh.vx,sh.vy));
            const sg   = ctx.createLinearGradient(sx0, sy0, sh.x, sh.y);
            sg.addColorStop(0, `hsla(${sh.hue},90%,95%,0)`);
            sg.addColorStop(0.6, `hsla(${sh.hue},80%,80%,${sh.life*0.6})`);
            sg.addColorStop(1,   `hsla(${sh.hue+20},90%,95%,${sh.life})`);
            ctx.strokeStyle = sg;
            ctx.lineWidth   = 2 * sh.life;
            ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(sh.x, sh.y); ctx.stroke();
            keepShooters.push(sh);
        }
        this.shooters = keepShooters;
        ctx.restore();
    }
}

export const constellationParams = () => ({
    count:     { base: 120,  min: 20,   max: 350,  mod: { source: "" } },
    connDist:  { base: 0.22, min: 0.05, max: 0.6,  mod: { source: "" } },
    speed:     { base: 0.35, min: 0,    max: 3,    mod: { source: "" } },
    hue:       { base: 220,  min: 0,    max: 360,  mod: { source: "" } },
    midShift:  { base: 50,   min: 0,    max: 180,  mod: { source: "" } },
    glow:      { base: 1.2,  min: 0,    max: 3,    mod: { source: "" } },
    fade:      { base: 0.05, min: 0.01, max: 0.4,  mod: { source: "" } },
    lineAlpha: { base: 1.0,  min: 0,    max: 2,    mod: { source: "" } },
    linePow:   { base: 1.0,  min: 0,    max: 2,    mod: { source: "" } },
    starSize:  { base: 1.0,  min: 0.2,  max: 3,    mod: { source: "" } },
    usePalette: { base: 0,  min: 0,    max: 1,    mod: { source: "" } },
});

export function drawConstellation(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new ConstellationViz(Math.round(p.count ?? 120), w, h); _state.set(ctx, viz); }
    const s = extra?.spectrum;
    const bass   = s ? Math.min(1, (s[1]+s[2]+s[3])/3*2.5) : 0;
    const mid    = s ? Math.min(1, (s[8]+s[10]+s[12])/3*2.5) : 0;
    const treble = s ? Math.min(1, (s[30]+s[40]+s[50])/3*2.5) : 0;
    const _pal = p.usePalette > 0.5 ? extra?.palette : null;
    const pC = (f) => {
        if (!_pal || _pal.length === 0) return `hsl(${p.hue ?? 200}, 80%, 55%)`;
        return _pal[Math.min(_pal.length - 1, Math.floor(Math.max(0, Math.min(0.9999, f)) * _pal.length))];
    };
    viz.frame(ctx, w, h, p, t, bass, mid, treble, _pal, pC);
}
