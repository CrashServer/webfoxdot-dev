// ── Slime Mold (Physarum) ─────────────────────────────────────────────────
// Agent-based Physarum: agents sense, steer, deposit on a diffusing trail grid.
// Bass warps sensor angles; mid biases growth direction; treble adds scatter.
// Hue cycles slowly with audio energy. Multi-color trail option.

const _state = new WeakMap();

function bassLevel(s)   { if (!s?.length) return 0; const n=Math.max(1,s.length*.08|0); let v=0; for(let i=1;i<=n;i++) v+=s[i]; return Math.min(1, v/n*2.5); }
function midLevel(s)    { if (!s?.length) return 0; const a=s.length*.1|0, b=s.length*.4|0; let v=0; for(let i=a;i<b;i++) v+=s[i]; return Math.min(1, v/Math.max(1,b-a)*3); }
function trebleLevel(s) { if (!s?.length) return 0; const a=s.length*.5|0; let v=0; for(let i=a;i<s.length;i++) v+=s[i]; return Math.min(1, v/Math.max(1,s.length-a)*3); }

class SlimeMoldViz {
    constructor(gw, gh, nAgents) {
        this.GW = gw; this.GH = gh;
        const N = gw * gh;
        this.trail  = new Float32Array(N);
        this._buf   = new Float32Array(N);
        this.hueMap = new Float32Array(N);
        this._hBuf  = new Float32Array(N);
        this.agents = [];
        this.img    = new ImageData(gw, gh);
        this.img32  = new Uint32Array(this.img.data.buffer);
        this.off    = new OffscreenCanvas(gw, gh);
        this.offCtx = this.off.getContext("2d");
        this.time   = 0;
        this.lastT  = 0;
        this._init(nAgents);
    }

    _init(nAgents) {
        const { GW, GH } = this;
        this.agents.length = 0;
        for (let i = 0; i < nAgents; i++) {
            const a = Math.random()*6.28;
            const r = Math.sqrt(Math.random())*0.3;
            this.agents.push({
                x: (0.5 + Math.cos(a)*r)*GW,
                y: (0.5 + Math.sin(a)*r)*GH,
                ang: a + Math.PI,
                hue: Math.random()*360,
            });
        }
    }

    step(p, bass, mid, treble, dt) {
        this.time += dt;
        const { GW, GH } = this;
        const N = GW * GH;
        const T = this.trail, B = this._buf;
        const H = this.hueMap, HB = this._hBuf;
        const decay   = 1 - (p.decay ?? 0.05) * (1 + bass*0.8);
        const saDeg   = (p.sensorAngle ?? 30) * (Math.PI/180) * (1 + bass*0.6);
        const sDist   = Math.max(2, (p.sensorDist ?? 9) | 0);
        const moveSpd = (p.speed ?? 1) * (1 + bass*0.8 + treble*0.5);
        const deposit = p.deposit ?? 0.5;
        const jitter  = p.jitter ?? 0.2;
        const driftAng = mid * 0.4;

        // Diffuse + decay
        for (let y = 0; y < GH; y++) {
            for (let x = 0; x < GW; x++) {
                let s = 0, hs = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    const yy = (y+dy+GH)%GH;
                    for (let dx = -1; dx <= 1; dx++) {
                        const idx2 = yy*GW+((x+dx+GW)%GW);
                        s += T[idx2]; hs += H[idx2];
                    }
                }
                const i = y*GW+x;
                B[i]  = (s/9)*decay;
                HB[i] = hs/9;
            }
        }
        T.set(B); H.set(HB);

        const sense = (x, y, ang) => {
            const sx = ((x+Math.cos(ang)*sDist+GW)%GW)|0;
            const sy = ((y+Math.sin(ang)*sDist+GH)%GH)|0;
            return T[sy*GW+sx];
        };

        for (let ai = 0; ai < this.agents.length; ai++) {
            const ag = this.agents[ai];
            const fl = sense(ag.x, ag.y, ag.ang - saDeg);
            const fc = sense(ag.x, ag.y, ag.ang);
            const fr = sense(ag.x, ag.y, ag.ang + saDeg);

            if (fc >= fl && fc >= fr) { /* keep */ }
            else if (fl > fr) ag.ang -= 0.3 + treble*0.3;
            else if (fr > fl) ag.ang += 0.3 + treble*0.3;
            else ag.ang += (Math.random()-0.5) * (0.5 + jitter + treble*0.8);

            ag.ang += Math.sin(this.time*0.3 + ag.x*0.01) * driftAng * 0.1;

            ag.x = (ag.x + Math.cos(ag.ang)*moveSpd + GW) % GW;
            ag.y = (ag.y + Math.sin(ag.ang)*moveSpd + GH) % GH;
            const idx = (ag.y|0)*GW + (ag.x|0);
            if (idx >= 0 && idx < N) {
                T[idx] = Math.min(1, T[idx] + deposit);
                H[idx] = H[idx]*0.8 + ag.hue*0.2;
                ag.hue = (ag.hue + 0.2 + bass*2) % 360;
            }
        }
    }

    render(ctx, w, h, p) {
        const { GW, GH } = this;
        const N = GW * GH;
        const hueBase = p.hue ?? 140;
        const multicolor = p.multicolor ?? 0;
        const brightness = p.brightness ?? 1;
        const T = this.trail, H = this.hueMap;
        const img32 = this.img32;
        for (let i = 0; i < N; i++) {
            const v = Math.min(1, T[i] * brightness);
            const b = v*v*v;
            const hue = multicolor > 0.5 ? H[i] : hueBase;
            const h6 = (hue/60) % 6;
            const hi = h6|0;
            const f = h6 - hi;
            const lv = 0.1 + b*0.8;
            const sv = 0.9;
            const p2 = lv*(1-sv), q2 = lv*(1-sv*f), t2 = lv*(1-sv*(1-f));
            let r,g,bl;
            if (hi===0){r=lv;g=t2;bl=p2;} else if(hi===1){r=q2;g=lv;bl=p2;}
            else if(hi===2){r=p2;g=lv;bl=t2;} else if(hi===3){r=p2;g=q2;bl=lv;}
            else if(hi===4){r=t2;g=p2;bl=lv;} else{r=lv;g=p2;bl=q2;}
            img32[i] = (255<<24)|((bl*255&0xff)<<16)|((g*255&0xff)<<8)|(r*255&0xff);
        }
        this.offCtx.putImageData(this.img, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(this.off, 0, 0, w, h);
    }
}

export const slimeMoldParams = () => ({
    speed:       { base: 1.2,  min: 0.2, max: 4,    mod: { source: "" } },
    sensorAngle: { base: 30,   min: 5,   max: 90,   mod: { source: "" } },
    sensorDist:  { base: 9,    min: 2,   max: 28,   mod: { source: "" } },
    decay:       { base: 0.045,min: 0.005,max: 0.3, mod: { source: "" } },
    deposit:     { base: 0.6,  min: 0.1, max: 1,    mod: { source: "" } },
    jitter:      { base: 0.2,  min: 0,   max: 2,    mod: { source: "" } },
    hue:         { base: 140,  min: 0,   max: 360,  mod: { source: "" } },
    multicolor:  { base: 0,    min: 0,   max: 1,    mod: { source: "" } },
    agentCount:  { base: 4000, min: 500, max: 8000, step: 500, mod: { source: "" } },
    resolution:  { base: 320,  min: 80,  max: 480,  step: 40,  mod: { source: "" } },
    brightness:  { base: 1,    min: 0.2, max: 3,    mod: { source: "" } },
});

export function drawSlimeMold(ctx, w, h, p, t, extra) {
    const res     = Math.round(p.resolution ?? 320);
    const nAgents = Math.round(p.agentCount  ?? 4000);

    let viz = _state.get(ctx);
    if (!viz || viz.GW !== res || viz.GH !== res) {
        viz = new SlimeMoldViz(res, res, nAgents);
        _state.set(ctx, viz);
    }

    if (!viz.lastT) viz.lastT = t;
    const dt = Math.min(0.05, t - viz.lastT); viz.lastT = t;

    const s = extra?.spectrum;
    viz.step(p, bassLevel(s), midLevel(s), trebleLevel(s), dt);
    viz.render(ctx, w, h, p);
}
