// ── Flicker Film ──────────────────────────────────────────────────────────────
// Tony Conrad ("The Flicker") / Paul Sharits ("Ray Gun Virus") structural film:
// the whole frame is a single flat colour that flips every few frames, cycling a
// small saturated palette with interspersed black frames. Hypnotic, stroboscopic,
// and dead simple. Flips on a fixed rate or locked to the beat; audio can push
// the rate. Reads extra.live (beat) + extra.spectrum (level).

const _st = new WeakMap();

export const flickerFilmParams = () => ({
    rate:        { base: 12,  min: 1, max: 48,  label: "flips / sec", mod: { source: "" } },
    beatSync:    { base: 0,   min: 0, max: 1, step: 1, label: "sync to beat (0/1)", mod: { source: "" } },
    colors:      { base: 4,   min: 2, max: 8, step: 1, label: "palette size", mod: { source: "" } },
    hueBase:     { base: 0,   min: 0, max: 360, label: "hue base", mod: { source: "" } },
    hueStep:     { base: 90,  min: 0, max: 180, label: "hue step", mod: { source: "" } },
    sat:         { base: 100, min: 0, max: 100, label: "saturation", mod: { source: "" } },
    bright:      { base: 100, min: 0, max: 100, label: "brightness", mod: { source: "" } },
    blackChance: { base: 0.35, min: 0, max: 1,  label: "black-frame chance", mod: { source: "" } },
    audioReact:  { base: 0,   min: 0, max: 1,   label: "audio → rate", mod: { source: "" } },
});

// integer hash → [0,1); stable per flip index so a frame's colour doesn't shimmer.
function _hash(n) {
    let h = (n * 2654435761) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
}

export function drawFlickerFilm(ctx, w, h, p, t, extra) {
    let s = _st.get(ctx);
    if (!s) { s = { idx: 0, lastT: t, col: "#ffffff", prevBeat: -1 }; _st.set(ctx, s); }
    const lv = extra?.live || {};
    const sp = extra?.spectrum;
    const level = sp ? Math.min(1, (sp[1] + sp[2] + sp[3]) / 3 * 3) : 0;

    let flip = false;
    if (p.beatSync | 0) {
        const beat = Math.floor(lv.beat ?? 0);
        if (beat !== s.prevBeat) { s.prevBeat = beat; flip = true; }
    } else {
        const rate = Math.max(0.1, p.rate * (1 + level * (p.audioReact ?? 0) * 3));
        if (t - s.lastT >= 1 / rate) { s.lastT = t; flip = true; }
    }

    if (flip || s.idx === 0) {
        s.idx++;
        if (_hash(s.idx) < (p.blackChance ?? 0.35)) {
            s.col = "#000000";
        } else {
            const nColors = Math.max(2, p.colors | 0);
            const ci  = Math.floor(_hash(s.idx * 7 + 1) * nColors);
            const hue = ((p.hueBase ?? 0) + ci * (p.hueStep ?? 90)) % 360;
            const light = Math.max(2, (p.bright ?? 100) * 0.5);   // 50% = most vivid
            s.col = `hsl(${hue | 0},${p.sat | 0}%,${light | 0}%)`;
        }
    }

    ctx.fillStyle = s.col;
    ctx.fillRect(0, 0, w, h);
}
