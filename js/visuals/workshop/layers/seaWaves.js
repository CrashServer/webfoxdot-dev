// Sea Waves — layered sinusoidal ocean surface with foam and depth haze.
// Bass pushes wave height; treble shimmers the foam edge.

export const seaWavesParams = () => ({
    waveCount: { base: 6,    min: 2,  max: 16,  mod: { source: "" } },
    amplitude: { base: 0.06, min: 0,  max: 0.2, mod: { source: "" } },
    speed:     { base: 1,    min: 0,  max: 4,   mod: { source: "" } },
    hue:       { base: 200,  min: 0,  max: 360, mod: { source: "" } },
    horizon:   { base: 0.42, min: 0,  max: 0.8, mod: { source: "" } },
    foam:      { base: 0.5,  min: 0,  max: 1,   mod: { source: "" } },
    depth:     { base: 0.6,  min: 0,  max: 1,   mod: { source: "" } },
});

export function drawSeaWaves(ctx, w, h, p, t, extra) {
    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1,(sp[1]+sp[2]+sp[3])/3*2.5) : 0;
    const treble = sp ? Math.min(1,(sp[30]+sp[40]+sp[50])/3*2.5) : 0;

    const hue = p.hue;
    const n   = Math.max(2, Math.round(p.waveCount));
    const amp = (p.amplitude + bass*0.04) * h;
    const hor = p.horizon * h;

    // sky gradient
    const sky = ctx.createLinearGradient(0,0,0,hor);
    sky.addColorStop(0,   `hsl(${hue+30},40%,8%)`);
    sky.addColorStop(1,   `hsl(${hue+10},50%,18%)`);
    ctx.fillStyle = sky; ctx.fillRect(0,0,w,hor);

    // moonlight / sun shimmer on horizon
    const moonG = ctx.createRadialGradient(w*0.5, hor, 0, w*0.5, hor, w*0.3);
    moonG.addColorStop(0, `hsla(${hue+20},60%,80%,0.12)`);
    moonG.addColorStop(1, "transparent");
    ctx.fillStyle = moonG; ctx.fillRect(0,0,w,hor);

    // water layers — back to front
    for (let i = n-1; i >= 0; i--) {
        const frac  = i/(n-1);
        const depth = (p.horizon + (1-p.horizon)*frac) * h;
        const freq  = 1.5 + frac*3.5;
        const spd   = p.speed * (0.6 + frac*1.4) * (1 + bass*0.3);
        const phase = i * 0.83;
        const wh    = (i === 0 ? h : (i+1 < n ? (n-1-i)*h/n*0.7+depth : h)) - depth;
        const dark  = (1-frac)*p.depth;
        const lightL= 12 + (1-dark)*28;

        // wave outline path
        ctx.beginPath();
        ctx.moveTo(-10, depth);
        for (let x = -10; x <= w+10; x += 4) {
            const nx = x/w;
            const y  = depth + Math.sin(nx*freq*Math.PI*2 - t*spd + phase)*amp*(0.3+frac*0.7)
                              + Math.sin(nx*freq*1.7*Math.PI*2 - t*spd*1.3 + phase+1)*amp*0.3;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(w+10, h+2); ctx.lineTo(-10, h+2); ctx.closePath();

        const wg = ctx.createLinearGradient(0, depth, 0, depth+wh);
        wg.addColorStop(0, `hsl(${hue-dark*20},${60-dark*20}%,${lightL+8}%)`);
        wg.addColorStop(1, `hsl(${hue-dark*30},${50-dark*15}%,${lightL-4}%)`);
        ctx.fillStyle = wg; ctx.fill();

        // foam line at wave crest
        if (p.foam > 0.01 && i < n-1) {
            ctx.beginPath();
            for (let x = -10; x <= w+10; x += 4) {
                const nx = x/w;
                const y  = depth + Math.sin(nx*freq*Math.PI*2 - t*spd + phase)*amp*(0.3+frac*0.7)
                                  + Math.sin(nx*freq*1.7*Math.PI*2 - t*spd*1.3 + phase+1)*amp*0.3;
                x === -10 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
            }
            ctx.strokeStyle = `rgba(255,255,255,${p.foam*(0.25+frac*0.4)*(1+treble*0.5)})`;
            ctx.lineWidth   = 1.5 + frac*1.5 + treble*2;
            ctx.stroke();
        }
    }

    // deep vignette
    const vig = ctx.createRadialGradient(w/2,h,h*0.1,w/2,h,h*0.8);
    vig.addColorStop(0,"rgba(0,0,0,0)"); vig.addColorStop(1,"rgba(0,0,0,0.45)");
    ctx.fillStyle = vig; ctx.fillRect(0,hor,w,h-hor);
}
