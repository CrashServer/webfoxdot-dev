// ── CPU Heat Cascade ──────────────────────────────────────────────────────────
// Adapted from CRIC/512_VISUALISATION CPUHeatCascadeScene (Three.js → Canvas2D).
// Thermal heatmap grid, cascading heat particles, overload flash, core temp readout.
// Bass = heat spike / overload. Mid = cascade speed. Treble = particle spray.

const _st = new WeakMap();
const TAU = Math.PI * 2;

const GRID_W = 32, GRID_H = 18; // thermal grid resolution

function heatColor(v) {
    // 0=black → 1=red → 2=yellow → 3=white
    v = Math.max(0, Math.min(3, v));
    if (v < 1) return [v*180, 0, 0];
    if (v < 2) { const f=v-1; return [180+f*75, f*180, 0]; }
    const f=v-2; return [255, 180+f*75, f*255];
}

export const cpuHeatParams = () => ({
    hue:       { base: 20,   min: 0,   max: 360,          mod: { source: "" } }, // thermal hue shift
    cores:     { base: 4,    min: 1,   max: 8,   step: 1, mod: { source: "" } },
    pulse:     { base: 0.8,  min: 0,   max: 1,            mod: { source: "" } },
    cascade:   { base: 0.6,  min: 0,   max: 1,            mod: { source: "" } }, // thermal spread rate
    particles: { base: 0.7,  min: 0,   max: 1,            mod: { source: "" } },
    glow:      { base: 0.7,  min: 0,   max: 1,            mod: { source: "" } },
    bgAlpha:   { base: 0.88, min: 0,   max: 1,            mod: { source: "" } },
    showHud:   { base: 1,    min: 0,   max: 1,   step: 1, mod: { source: "" } },
    cooldown:  { base: 0.4,  min: 0.1, max: 1,            mod: { source: "" } }, // cooling rate
});

export function drawCpuHeat(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const nCores  = Math.round(Math.max(1, Math.min(8, p.cores ?? 4)));
    const hueShift= p.hue ?? 20;
    const pulse   = p.pulse ?? 0.8;
    const cascade = p.cascade ?? 0.6;
    const showPart= (p.particles ?? 0.7) > 0.1;
    const glow    = p.glow ?? 0.7;
    const bgAlpha = p.bgAlpha ?? 0.88;
    const showHud = (p.showHud ?? 1) > 0.5;
    const cooldown= p.cooldown ?? 0.4;

    let st = _st.get(ctx);
    if (!st || st.nCores !== nCores) {
        const grid = new Float32Array(GRID_W * GRID_H);
        // Place cores
        const cores = [];
        for (let c = 0; c < nCores; c++) {
            const gx = Math.floor((c + 0.5) / nCores * GRID_W);
            const gy = Math.floor(GRID_H / 2);
            cores.push({ gx, gy, temp: 0, phase: c * TAU / nCores });
        }
        st = { grid, cores, nCores, particles: [], prevBass: 0, overload: 0,
               avgTemp: 0, peakTemp: 0, lastT: t };
        _st.set(ctx, st);
    }
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    const { grid, cores } = st;

    // ── Update core temperatures from audio
    for (let c = 0; c < cores.length; c++) {
        const freqBand = spectrum ? Math.min(1, spectrum[c * 4 + 2] * 5) : 0;
        const target = bass * pulse * 2.5 + freqBand * 1.5 + mid * 0.5;
        cores[c].temp += (target - cores[c].temp) * dt * 4;
        // Inject heat into grid
        const { gx, gy } = cores[c];
        const heatAmt = cores[c].temp * dt * 3;
        const r = 2;
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                const ix = (gx + dx + GRID_W) % GRID_W;
                const iy = Math.max(0, Math.min(GRID_H-1, gy + dy));
                grid[iy*GRID_W+ix] = Math.min(3, grid[iy*GRID_W+ix] + heatAmt * (1-Math.hypot(dx,dy)/r*0.6));
            }
        }
    }

    // ── Bass → overload + particle spray
    if (bass > 0.55 && bass > st.prevBass + 0.1) {
        st.overload = bass * pulse;
        // Supercharge all core cells
        for (const { gx, gy } of cores) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const ix = (gx+dx+GRID_W)%GRID_W;
                    const iy = Math.max(0, Math.min(GRID_H-1, gy+dy));
                    grid[iy*GRID_W+ix] = Math.min(3, grid[iy*GRID_W+ix] + bass * 1.5);
                }
            }
        }
        if (showPart) {
            const nP = Math.ceil(bass * pulse * 30);
            for (const {gx, gy} of cores) {
                const px = (gx/GRID_W)*w, py = (gy/GRID_H)*h;
                for (let i = 0; i < nP; i++) {
                    const ang = Math.random()*TAU;
                    const spd = 40 + Math.random()*120;
                    st.particles.push({ x:px, y:py, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd,
                                        life:0.5+Math.random()*0.8, temp:2+Math.random() });
                }
            }
        }
    }
    st.prevBass = bass;
    st.overload *= 0.9;

    // ── Thermal cascade (diffuse + cool)
    const newGrid = new Float32Array(GRID_W * GRID_H);
    const cascRate = cascade * dt * 2 * (1 + mid * 0.5);
    for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
            const v = grid[y*GRID_W+x];
            const n = grid[((y-1+GRID_H)%GRID_H)*GRID_W+x];
            const s = grid[((y+1)%GRID_H)*GRID_W+x];
            const l = grid[y*GRID_W+(x-1+GRID_W)%GRID_W];
            const r = grid[y*GRID_W+(x+1)%GRID_W];
            // Heat rises (upward bias)
            const diffuse = (n + s + l + r) / 4;
            const rise    = grid[((y+1)%GRID_H)*GRID_W+x]; // cell below rises up
            newGrid[y*GRID_W+x] = Math.max(0,
                v + (diffuse - v) * cascRate + (rise - v) * cascRate * 0.5
                - v * cooldown * dt * 0.8);
        }
    }
    grid.set(newGrid);

    // Stats
    let avg = 0, peak = 0;
    for (let i = 0; i < grid.length; i++) { avg += grid[i]; if (grid[i] > peak) peak = grid[i]; }
    st.avgTemp = avg / grid.length;
    st.peakTemp = peak;

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // ── Draw thermal grid
    const cellW = w / GRID_W, cellH = h / GRID_H;
    const imgData = ctx.createImageData(Math.ceil(w), Math.ceil(h));
    const data = imgData.data;

    for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
            const v = grid[y*GRID_W+x];
            let [r, g, b] = heatColor(v);
            // Apply hue shift (tint toward p.hue)
            if (hueShift !== 20 && v > 0.05) {
                const hs = hueShift/360;
                r = r * (1-hs*0.3) + (hs > 0.5 ? 0 : 255*hs*0.5);
                b = b * (1-hs*0.3) + (hs > 0.5 ? 255*(hs-0.5)*0.6 : 0);
            }
            const px0 = Math.round(x * cellW), py0 = Math.round(y * cellH);
            const px1 = Math.round((x+1)*cellW), py1 = Math.round((y+1)*cellH);
            for (let py = py0; py < py1 && py < h; py++) {
                for (let px = px0; px < px1 && px < w; px++) {
                    const idx = (py * Math.ceil(w) + px) * 4;
                    data[idx]   = r;
                    data[idx+1] = g;
                    data[idx+2] = b;
                    data[idx+3] = Math.round(Math.min(255, v * 140 + 30));
                }
            }
        }
    }
    ctx.putImageData(imgData, 0, 0);

    // ── Core indicators
    for (let c = 0; c < cores.length; c++) {
        const { gx, gy, temp } = cores[c];
        const cx2 = (gx + 0.5) * cellW, cy2 = (gy + 0.5) * cellH;
        const [r2, g2, b2] = heatColor(temp);
        const cR = 6 + temp * 4;
        if (glow > 0.05) { ctx.shadowBlur = glow * temp * 20; ctx.shadowColor = `rgb(${r2},${g2},${b2})`; }
        ctx.strokeStyle = `rgb(${r2},${g2},${b2})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.rect(cx2-cR, cy2-cR, cR*2, cR*2); ctx.stroke();
        ctx.fillStyle = `rgba(${r2},${g2},${b2},0.2)`;
        ctx.fillRect(cx2-cR, cy2-cR, cR*2, cR*2);
    }
    ctx.shadowBlur = 0;

    // ── Particles
    for (const pk of st.particles) {
        pk.x += pk.vx*dt; pk.y += pk.vy*dt;
        pk.vy -= 40*dt; // buoyancy upward
        pk.life -= dt*1.2;
        const [r2,g2,b2] = heatColor(pk.temp);
        ctx.fillStyle = `rgba(${r2},${g2},${b2},${Math.max(0,pk.life)})`;
        ctx.beginPath(); ctx.arc(pk.x, pk.y, 2, 0, TAU); ctx.fill();
    }
    st.particles = st.particles.filter(pk => pk.life > 0);

    // ── Overload flash
    if (st.overload > 0.05) {
        ctx.fillStyle = `rgba(255,60,0,${st.overload*0.25})`;
        ctx.fillRect(0, 0, w, h);
    }

    // ── HUD
    if (showHud) {
        const tempC = Math.floor(st.peakTemp * 40 + 20); // mapped to °C range
        ctx.font = '9px monospace';
        ctx.fillStyle = 'rgba(255,120,0,0.7)';
        ctx.fillText(`CPU TEMP: ${tempC}°C  CORES: ${nCores}  LOAD: ${Math.floor(st.avgTemp/3*100)}%`, 8, h-10);
        // Core temp bars
        for (let c = 0; c < cores.length; c++) {
            const bw = (w * 0.5) / nCores - 2;
            const bh2 = cores[c].temp / 3 * 25;
            const [r2,g2,b2] = heatColor(cores[c].temp);
            ctx.fillStyle = `rgb(${r2},${g2},${b2})`;
            ctx.fillRect(8 + c*(bw+2), h-35-bh2, bw, bh2);
        }
    }
}
