// postfx.js — full-frame passes applied after the mix, driven by layer fx params
// (trails is handled in main as the frame-clear alpha; these are the rest). Each is a
// plain function so adding one is a single export + a call in main.

// slice-shift a few horizontal bands sideways — a digital tear
export function glitch(ctx, W, H, amt) {
    const cv = ctx.canvas, n = 2 + (amt * 4 | 0);
    for (let i = 0; i < n; i++) {
        const y = Math.random() * H, h = 4 + Math.random() * 20;
        const dx = (Math.random() - 0.5) * amt * 70;
        ctx.drawImage(cv, 0, y, W, h, dx, y, W, h);
    }
}

// dark scanlines
export function scan(ctx, W, H, amt) {
    ctx.fillStyle = `rgba(0,0,0,${amt * 0.45})`;
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
}

// darken the edges (cached radial gradient)
let _vg = null, _vgW = 0, _vgH = 0;
export function vignette(ctx, W, H, amt) {
    if (!_vg || _vgW !== W || _vgH !== H) {
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.64);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
        _vg = g; _vgW = W; _vgH = H;
    }
    ctx.globalAlpha = amt; ctx.fillStyle = _vg; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
}

// invert the whole frame
export function invert(ctx, W, H) {
    ctx.globalCompositeOperation = 'difference';
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
}
