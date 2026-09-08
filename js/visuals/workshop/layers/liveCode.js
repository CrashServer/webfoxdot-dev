// ── LiveCode: displays the live coding session text from FoxDot + webTroop ───
// Reads extra.live.svdk and extra.live.zbdm (or otherUser) windows and renders
// them as a monospace editor overlay.  Useful for a "code visible on screen"
// aesthetic or for audience-facing projections at live coding shows.
//
// Params: user (0=svdk,1=other,2=both), fontSize, opacity, hue, bg, evalFlash

export const liveCodeParams = () => ({
    user:      { base: 0,   min: 0, max: 2,   step: 1,   label: "user (0=me 1=other 2=both)", mod: { source: "" } },
    fontSize:  { base: 14,  min: 8, max: 32,  step: 1,   label: "font size (px)", mod: { source: "" } },
    hue:       { base: 120, min: 0, max: 360, step: 1,   label: "text hue", mod: { source: "" } },
    bg:        { base: 0.7, min: 0, max: 1,   step: 0.01, label: "bg darkness", mod: { source: "" } },
    evalFlash: { base: 0.8, min: 0, max: 1,   step: 0.01, label: "eval flash intensity", mod: { source: "" } },
    split:     { base: 0.5, min: 0.1, max: 0.9, step: 0.01, label: "split position (2-user mode)", mod: { source: "" } },
});

const _st = new WeakMap();

function _drawWindow(ctx, win, x, y, w, h, params, t) {
    const fs     = Math.max(8, Math.round(params.fontSize));
    const hue    = params.hue;
    const dark   = params.bg;
    const pad    = 8;
    const lineH  = fs + 3;

    // Background
    const bgA = dark * 0.92;
    ctx.fillStyle = `rgba(0,0,0,${bgA})`;
    ctx.fillRect(x, y, w, h);

    // Eval flash
    if (win.evalFlashAge >= 0) {
        const a = (1 - win.evalFlashAge * 2) * (params.evalFlash ?? 0.8) * 0.4;
        if (a > 0) {
            ctx.fillStyle = `hsla(${hue},80%,60%,${a})`;
            ctx.fillRect(x, y, w, h);
        }
    }

    if (!win.lines) {
        ctx.fillStyle = `hsla(${hue},30%,40%,0.5)`;
        ctx.font = `${fs}px monospace`;
        ctx.fillText("no code yet…", x + pad, y + pad + fs);
        return;
    }

    const lines = Array.isArray(win.lines) ? win.lines : String(win.lines).split("\n");
    const maxVisible = Math.floor((h - pad * 2) / lineH);

    // Scroll window around cursor
    const cursor = win.cursorRow ?? 0;
    let startLine = Math.max(0, cursor - Math.floor(maxVisible * 0.6));
    startLine = Math.min(startLine, Math.max(0, lines.length - maxVisible));

    ctx.font = `${fs}px monospace`;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    for (let i = 0; i < maxVisible && startLine + i < lines.length; i++) {
        const li = startLine + i;
        const ly = y + pad + i * lineH + fs;
        const line = lines[li] || "";
        const isCursor = li === cursor;

        // Cursor row highlight
        if (isCursor) {
            ctx.fillStyle = `hsla(${hue},40%,50%,0.15)`;
            ctx.fillRect(x, ly - fs, w, lineH);
        }

        // Dim non-active lines, bright cursor line
        const brightness = isCursor ? 85 : (win.active ? 55 : 35);
        ctx.fillStyle = `hsl(${hue},60%,${brightness}%)`;
        ctx.fillText(line, x + pad, ly);
    }
    ctx.restore();

    // Top border accent
    const bA = win.active ? 0.7 : 0.25;
    ctx.fillStyle = `hsla(${hue},70%,55%,${bA})`;
    ctx.fillRect(x, y, w, 2);
}

export function drawLiveCode(ctx, w, h, params, t, extra) {
    const live = extra?.live;
    if (!live || !live.on) {
        ctx.fillStyle = "#060812";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "rgba(180,180,180,0.3)";
        ctx.font = "13px monospace";
        ctx.textAlign = "center";
        ctx.fillText("FoxDot not connected", w / 2, h / 2);
        ctx.textAlign = "left";
        return;
    }

    const mode   = Math.round(params.user) || 0;
    const svdkWin = live.svdk;
    const zbdmWin = live.zbdm;

    if (mode === 0) {
        _drawWindow(ctx, svdkWin, 0, 0, w, h, params, t);
    } else if (mode === 1) {
        _drawWindow(ctx, zbdmWin, 0, 0, w, h, params, t);
    } else {
        // Both side by side
        const sp   = Math.max(0.1, Math.min(0.9, params.split ?? 0.5));
        const lw   = Math.floor(w * sp);
        const rw   = w - lw;
        _drawWindow(ctx, svdkWin, 0, 0, lw, h, params, t);
        _drawWindow(ctx, zbdmWin, lw, 0, rw, h, params, t);
    }
}
