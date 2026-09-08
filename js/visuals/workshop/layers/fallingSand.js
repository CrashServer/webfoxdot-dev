// ── Falling Sand ─────────────────────────────────────────────────────────────
// Adapted from CRIC/512_VISUALISATION ASCIIFallingSandScene.
// Cellular automaton: Sand, Water, Fire, Smoke, Stone, Oil, Acid.
// Bass = spawn burst. Mid = fire spread. Auto-spawns material at top.

const _st = new WeakMap();

const EMPTY=0, SAND=1, WATER=2, STONE=3, FIRE=4, SMOKE=5, OIL=6, ACID=7;
const GW=120, GH=68;

const MAT_COLOR = [
    null,
    (t,x,y)=>`hsl(${38+Math.sin(x*0.3+t)*4},${70+Math.sin(y*0.2+t)*10}%,${45+Math.random()*8}%)`,
    (t,x,y)=>`hsl(${205+Math.sin(x*0.1+t)*5},${60+Math.sin(y*0.3+t)*15}%,${38+Math.random()*6}%)`,
    ()=>`hsl(0,0%,${22+Math.random()*6}%)`,
    (t,x,y)=>`hsl(${20+Math.random()*30},${90+Math.random()*10}%,${50+Math.random()*20}%)`,
    (t,x,y)=>`hsl(0,0%,${28+Math.random()*12}%)`,
    (t,x,y)=>`hsl(${30+Math.sin(x*0.2+t)*5},${55+Math.random()*15}%,${28+Math.random()*8}%)`,
    (t,x,y)=>`hsl(${90+Math.random()*30},${80+Math.random()*20}%,${35+Math.random()*15}%)`,
];

function idx(x,y){ return y*GW+x; }
function inBounds(x,y){ return x>=0&&x<GW&&y>=0&&y<GH; }

export const fallingSandParams = () => ({
    material: { base: 0,   min: 0,   max: 6,   step: 1, mod: { source: "" } }, // 0=sand,1=water,2=stone,3=fire,4=smoke,5=oil,6=acid
    spawnRate:{ base: 0.6, min: 0,   max: 1,            mod: { source: "" } },
    pulse:    { base: 0.8, min: 0,   max: 1,            mod: { source: "" } },
    gravity:  { base: 0.7, min: 0.1, max: 1,            mod: { source: "" } },
    spread:   { base: 0.5, min: 0,   max: 1,            mod: { source: "" } }, // liquid/fire spread
    hue:      { base: 0,   min: 0,   max: 360,          mod: { source: "" } }, // tint
    bgAlpha:  { base: 1,   min: 0,   max: 1,            mod: { source: "" } },
    reset:    { base: 0,   min: 0,   max: 1,   step: 1, mod: { source: "" } },
});

export function drawFallingSand(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;

    const matParam  = Math.round(p.material ?? 0);
    const spawnRate = p.spawnRate ?? 0.6;
    const pulse     = p.pulse ?? 0.8;
    const gravity   = p.gravity ?? 0.7;
    const spread    = p.spread ?? 0.5;
    const bgAlpha   = p.bgAlpha ?? 1;
    const doReset   = (p.reset ?? 0) > 0.5;

    // Material map: param 0-6 → internal 1-7
    const matMap = [SAND, WATER, STONE, FIRE, SMOKE, OIL, ACID];
    const mat = matMap[matParam] ?? SAND;

    let st = _st.get(ctx);
    if (!st || doReset) {
        st = { grid: new Uint8Array(GW*GH), prevBass: 0, lastT: t };
        _st.set(ctx, st);
    }
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    const { grid } = st;

    // ── Spawn at top (auto + bass burst)
    const nSpawn = Math.floor(spawnRate * 3 * (1 + bass * pulse * 6));
    for (let i = 0; i < nSpawn; i++) {
        const x = Math.floor(GW * 0.15 + Math.random() * GW * 0.7);
        const y = 0;
        if (inBounds(x,y) && grid[idx(x,y)]===EMPTY) grid[idx(x,y)] = mat;
    }
    if (bass > 0.5 && bass > st.prevBass + 0.1) {
        // Bass: stone ring to create structure
        const cx2 = Math.floor(GW/2), cy2 = Math.floor(GH/3);
        for (let a = 0; a < 40; a++) {
            const ang = (a/40)*Math.PI*2;
            const r = 8 + Math.floor(bass*pulse*10);
            const sx = cx2 + Math.round(Math.cos(ang)*r);
            const sy = cy2 + Math.round(Math.sin(ang)*r);
            if (inBounds(sx,sy)) grid[idx(sx,sy)] = mat === STONE ? STONE : FIRE;
        }
    }
    st.prevBass = bass;

    // ── Simulate (bottom-up for proper falling)
    const gravProb = gravity;
    const sprdProb = spread;
    const newGrid = new Uint8Array(grid);

    for (let y = GH-2; y >= 0; y--) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        for (let xi = 0; xi < GW; xi++) {
            const x = dir > 0 ? xi : GW-1-xi;
            const c = grid[idx(x,y)];
            if (c === EMPTY) continue;

            if (c === SAND || c === STONE) {
                // Fall down
                if (c === STONE) continue; // stone is static
                if (Math.random() < gravProb && inBounds(x,y+1) && newGrid[idx(x,y+1)]===EMPTY) {
                    newGrid[idx(x,y+1)]=SAND; newGrid[idx(x,y)]=EMPTY;
                } else {
                    const dx = Math.random()<0.5?-1:1;
                    if (inBounds(x+dx,y+1) && newGrid[idx(x+dx,y+1)]===EMPTY) {
                        newGrid[idx(x+dx,y+1)]=SAND; newGrid[idx(x,y)]=EMPTY;
                    }
                }
            } else if (c === WATER || c === OIL) {
                if (Math.random() < gravProb && inBounds(x,y+1) && newGrid[idx(x,y+1)]===EMPTY) {
                    newGrid[idx(x,y+1)]=c; newGrid[idx(x,y)]=EMPTY;
                } else if (Math.random() < sprdProb) {
                    const dx = Math.random()<0.5?-1:1;
                    if (inBounds(x+dx,y) && newGrid[idx(x+dx,y)]===EMPTY) {
                        newGrid[idx(x+dx,y)]=c; newGrid[idx(x,y)]=EMPTY;
                    }
                }
            } else if (c === FIRE) {
                // Rise + spread
                if (inBounds(x,y-1) && newGrid[idx(x,y-1)]===EMPTY && Math.random()<0.4)
                    newGrid[idx(x,y-1)]=FIRE;
                if (Math.random() < sprdProb * (0.4 + mid*0.4)) {
                    const dx = Math.round(Math.random()*2-1);
                    if (inBounds(x+dx,y) && newGrid[idx(x+dx,y)]===EMPTY) newGrid[idx(x+dx,y)]=FIRE;
                }
                // Fire → smoke
                if (Math.random() < 0.04) { newGrid[idx(x,y)]=SMOKE; }
                // Fire ignites oil
                for (const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
                    if (inBounds(nx,ny) && grid[idx(nx,ny)]===OIL && Math.random()<0.3) newGrid[idx(nx,ny)]=FIRE;
                }
            } else if (c === SMOKE) {
                if (inBounds(x,y-1) && newGrid[idx(x,y-1)]===EMPTY && Math.random()<gravProb)
                    { newGrid[idx(x,y-1)]=SMOKE; newGrid[idx(x,y)]=EMPTY; }
                if (Math.random()<0.015) newGrid[idx(x,y)]=EMPTY;
            } else if (c === ACID) {
                // Acid falls, dissolves sand/stone
                if (inBounds(x,y+1)) {
                    const below = newGrid[idx(x,y+1)];
                    if (below===EMPTY && Math.random()<gravProb) { newGrid[idx(x,y+1)]=ACID; newGrid[idx(x,y)]=EMPTY; }
                    else if (below===SAND||below===STONE) { newGrid[idx(x,y+1)]=EMPTY; newGrid[idx(x,y)]=EMPTY; }
                }
                if (Math.random()<sprdProb*0.4) {
                    const dx=Math.random()<0.5?-1:1;
                    if (inBounds(x+dx,y)&&newGrid[idx(x+dx,y)]===EMPTY){newGrid[idx(x+dx,y)]=ACID;newGrid[idx(x,y)]=EMPTY;}
                }
                if (Math.random()<0.008) newGrid[idx(x,y)]=EMPTY;
            }
        }
    }
    grid.set(newGrid);

    // ── Draw
    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);
    const cw = w/GW, ch = h/GH;
    for (let y = 0; y < GH; y++) {
        for (let x = 0; x < GW; x++) {
            const c = grid[idx(x,y)];
            if (c === EMPTY) continue;
            ctx.fillStyle = MAT_COLOR[c](t,x,y);
            ctx.fillRect(x*cw, y*ch, cw+0.5, ch+0.5);
        }
    }

    // Material label
    const LABELS = ['SAND','WATER','STONE','FIRE','SMOKE','OIL','ACID'];
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(LABELS[matParam], 6, h-8);
}
