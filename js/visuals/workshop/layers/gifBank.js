// ── GIF Bank ──────────────────────────────────────────────────────────────
// Plays this project's own transparent clips — the keyed GIFs that
// tools/make_transparent_gifs.py cuts out of the video library into gif/clips.
//
// Frames are decoded explicitly with WebCodecs' ImageDecoder rather than leaning
// on an <img> to animate itself. Chrome does NOT advance the animation of an
// image that is off-screen or invisible, so the <img> route silently froze every
// clip on frame 0 — invisible in a screenshot, obvious in a set. Decoding also
// buys what a VJ actually wants: a `speed` control and a clock we own, so clips
// can be scrubbed and beat-synced instead of free-running.
//
// Only the NAMES are read up front. An image is fetched when `clip` selects it
// and the least-recently-used are dropped, so a folder of hundreds costs one
// JSON fetch rather than hundreds of decoded images sitting in memory.

// Resolved against the APP ROOT (workshop/), not document.baseURI: a page in
// tools/ would otherwise look for tools/gif/clips/ and find nothing.
const APP_ROOT = new URL("../../", import.meta.url);   // src/layers/ -> workshop/
const CLIPS = new URL("gif/clips/", APP_ROOT);
const MANIFEST = new URL("manifest.json", CLIPS);
const MAX_CACHE = 10;

let entries = null;                 // [{name, url}] once the manifest lands
let status = "loading clip list…";
const cache = new Map();            // name -> {frames[], durs[], total} (null while decoding)
const recent = [];                  // names, least-recently-used first
const clipDefs = [];                // param defs whose max tracks the list length

function touch(name) {
    const i = recent.indexOf(name);
    if (i >= 0) recent.splice(i, 1);
    recent.push(name);
    while (recent.length > MAX_CACHE) {
        const drop = recent.shift();
        const clip = cache.get(drop);
        if (clip) for (const f of clip.frames) f.close?.();      // release the bitmaps
        cache.delete(drop);
    }
}

const MAX_FRAMES = 120;             // our clips are ~30; the cap is for stray long ones

async function decode(entry) {
    const blob = await (await fetch(entry.url)).blob();
    if (typeof ImageDecoder !== "undefined") {
        const dec = new ImageDecoder({ data: await blob.arrayBuffer(), type: blob.type || "image/gif" });
        await dec.tracks.ready;
        const track = dec.tracks.selectedTrack;
        const n = Math.min(track?.frameCount ?? 1, MAX_FRAMES);
        const frames = [], durs = [];
        for (let i = 0; i < n; i++) {
            const { image } = await dec.decode({ frameIndex: i });
            frames.push(await createImageBitmap(image));
            // VideoFrame.duration is microseconds; 0/absent on some encoders.
            durs.push((image.duration ? image.duration / 1e6 : 0) || 0.083);
            image.close?.();
        }
        dec.close?.();
        if (frames.length) return { frames, durs, total: durs.reduce((a, b) => a + b, 0) };
    }
    // No WebCodecs: fall back to a single still rather than nothing.
    const bmp = await createImageBitmap(blob);
    return { frames: [bmp], durs: [1], total: 1 };
}

function clipFor(entry) {
    const hit = cache.get(entry.name);
    if (hit !== undefined) { if (hit) touch(entry.name); return hit; }
    cache.set(entry.name, null);                       // in flight — don't ask twice
    decode(entry).then(
        (c) => { cache.set(entry.name, c); touch(entry.name); },
        (e) => { cache.delete(entry.name); status = `failed: ${entry.name} (${e.message})`; },
    );
    return null;
}

async function loadList() {
    try {
        const res = await fetch(MANIFEST, { cache: "no-cache" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json = await res.json();
        const items = Array.isArray(json) ? json : (json.items ?? []);
        const root = CLIPS;
        entries = items
            .map((e) => (typeof e === "string" ? e : e.file))
            .filter((n) => typeof n === "string" && /\.(gif|webp|apng|png)$/i.test(n))
            .map((n) => ({ name: n, url: new URL(encodeURIComponent(n), root).href }));
        status = entries.length ? "" : "no clips in gif/clips/manifest.json";
        for (const d of clipDefs) d.max = Math.max(0, entries.length - 1);
    } catch (e) {
        entries = [];
        status = `no clips — run tools/make_transparent_gifs.py (${e.message})`;
    }
}
if (typeof fetch !== "undefined" && typeof document !== "undefined") loadList();

export const gifBankParams = () => {
    const clip = { base: 0, min: 0, max: Math.max(0, (entries?.length ?? 1) - 1), step: 1, mod: { source: "" } };
    clipDefs.push(clip);                     // max is corrected when the list lands
    return {
        clip,
        cycle:    { base: 0,   min: 0,   max: 30,  mod: { source: "" } },  // seconds per clip, 0 = manual
        beatCut:  { base: 0,   min: 0,   max: 1,   step: 1, mod: { source: "" } },
        shuffle:  { base: 0,   min: 0,   max: 1,   step: 1, mod: { source: "" } },
        zoom:     { base: 0.5, min: 0.1, max: 4,   mod: { source: "" } },
        offsetX:  { base: 0,   min: -1,  max: 1,   mod: { source: "" } },
        offsetY:  { base: 0,   min: -1,  max: 1,   mod: { source: "" } },
        rotation: { base: 0,   min: -180, max: 180, mod: { source: "" } },
        fit:      { base: 1,   min: 0,   max: 2,   step: 1, mod: { source: "" } },  // 0=cover 1=contain 2=stretch
        speed:    { base: 1,   min: 0,   max: 4,   mod: { source: "" } },  // 0 freezes on `frame`
        frame:    { base: 0,   min: 0,   max: 1,   mod: { source: "" } },  // scrub position when speed = 0
        mirror:   { base: 0,   min: 0,   max: 1,   step: 1, mod: { source: "" } },
        hueShift: { base: 0,   min: 0,   max: 360, mod: { source: "" } },
        bright:   { base: 100, min: 0,   max: 300, mod: { source: "" } },
    };
};

// Auto-advance state (module-level: one bank, shared clock).
let lastT = 0, cycleAcc = 0, autoIdx = 0, prevBass = 0, clipClock = 0, lastIdx = -1;

function bassLevel(s) {
    if (!s?.length) return 0;
    const n = Math.max(1, (s.length * 0.08) | 0);
    let v = 0; for (let i = 1; i <= n; i++) v += s[i];
    return Math.min(1, (v / n) * 2.5);
}

export function drawGifBank(ctx, w, h, p, t, extra) {
    ctx.clearRect(0, 0, w, h);
    if (!entries || !entries.length) {
        if (status) {
            ctx.save();
            ctx.fillStyle = "#8a8"; ctx.font = `${Math.max(10, w * 0.022)}px monospace`;
            ctx.textAlign = "center"; ctx.fillText(status, w / 2, h / 2);
            ctx.restore();
        }
        return;
    }

    const n = entries.length;
    let dt = t - lastT; lastT = t;
    if (!(dt > 0) || dt > 1) dt = 0;

    // `clip` picks the file; cycle/beatCut add an offset on top so the slider
    // stays meaningful (and driver-assignable) while the bank auto-advances.
    const cycle = p.cycle ?? 0;
    if (cycle > 0.01) {
        cycleAcc += dt;
        if (cycleAcc >= cycle) { cycleAcc = 0; autoIdx = (p.shuffle ?? 0) > 0.5 ? (Math.random() * n) | 0 : autoIdx + 1; }
    }
    if ((p.beatCut ?? 0) > 0.5) {
        const bass = bassLevel(extra?.spectrum);
        if (bass > 0.55 && prevBass <= 0.55) autoIdx = (p.shuffle ?? 0) > 0.5 ? (Math.random() * n) | 0 : autoIdx + 1;
        prevBass = bass;
    }

    const idx = ((((Math.round(p.clip ?? 0) + autoIdx) % n) + n) % n);
    if (idx !== lastIdx) { clipClock = 0; lastIdx = idx; }   // a cut restarts the clip
    const entry = entries[idx];
    const clip = clipFor(entry);
    // Prefetch the next one so a cut does not land on an empty frame.
    if (n > 1) clipFor(entries[(idx + 1) % n]);
    if (!clip) return;                                  // still decoding — draw nothing

    // Our own clock: `speed` scales it, speed 0 freezes and `frame` scrubs.
    const speed = p.speed ?? 1;
    let pos;
    if (speed < 0.01) pos = Math.max(0, Math.min(0.999, p.frame ?? 0)) * clip.total;
    else { clipClock += dt * speed; pos = clip.total > 0 ? clipClock % clip.total : 0; }
    let fi = 0, acc = 0;
    for (; fi < clip.durs.length - 1; fi++) { acc += clip.durs[fi]; if (acc > pos) break; }
    const img = clip.frames[fi];
    if (!img) return;

    const ew = img.width, eh = img.height;
    const fit = Math.round(p.fit ?? 1);
    let dw, dh;
    if (fit === 2) { dw = w; dh = h; }
    else if (fit === 0) { const s = Math.max(w / ew, h / eh); dw = ew * s; dh = eh * s; }
    else { const s = Math.min(w / ew, h / eh); dw = ew * s; dh = eh * s; }

    ctx.save();
    ctx.translate(w / 2 + (p.offsetX ?? 0) * w, h / 2 + (p.offsetY ?? 0) * h);
    ctx.rotate(((p.rotation ?? 0) * Math.PI) / 180);
    const z = p.zoom ?? 1;
    ctx.scale(((p.mirror ?? 0) > 0.5 ? -1 : 1) * z, z);
    ctx.filter = `hue-rotate(${p.hueShift ?? 0}deg) brightness(${p.bright ?? 100}%)`;
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.filter = "none";
    ctx.restore();
}

// Exposed for the headless check in tools/.
export const _gifBankState = () => ({ entries, status, cached: cache.size });
