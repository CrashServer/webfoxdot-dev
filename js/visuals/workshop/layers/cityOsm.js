// ── OSM 3D — the real streets around a lat/lon, as a neon wireframe ────────
// Fetches OpenStreetMap building footprints via Overpass, extrudes them to
// their tagged height and draws them as projected wireframe prisms.
//
// The WebGPU build rasterises OSM into a heightmap and raymarches it. Canvas2D
// wants the opposite: keep the polygons as VECTORS and stroke them. That plays
// to what this renderer is good at (crisp lines, cheap glow) instead of fighting
// it with a per-pixel march, and it is why this is a rewrite rather than a port.
//
// Defaults are the venue: Château de Saint-Martin, Montiéramey.

const OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const cache = new Map();          // "lat,lon,r" -> {buildings, roads} | "loading" | {error}
let status = "";

function heightFromTags(tags) {
    if (!tags) return 8;
    const n = (s) => { const v = parseFloat(s); return isFinite(v) ? v : null; };
    if (tags.height) { const v = n(tags.height); if (v) return Math.max(2, v); }
    if (tags["building:levels"]) { const v = n(tags["building:levels"]); if (v) return Math.max(2, v * 3.2); }
    return 8;
}

async function fetchCity(lat, lon, radiusM) {
    const dLat = radiusM / 111320, dLon = radiusM / (111320 * Math.cos(lat * Math.PI / 180));
    const b = `${lat - dLat},${lon - dLon},${lat + dLat},${lon + dLon}`;
    const q = `[out:json][timeout:25];(way["building"](${b});way["highway"](${b}););out geom;`;
    let lastErr = "";
    for (const ep of OVERPASS) {
        try {
            const r = await fetch(ep, { method: "POST", body: "data=" + encodeURIComponent(q),
                headers: { "Content-Type": "application/x-www-form-urlencoded" } });
            if (!r.ok) { lastErr = "HTTP " + r.status; continue; }
            return toLocal(await r.json(), lat, lon);
        } catch (e) { lastErr = e.message; }
    }
    throw new Error(lastErr || "all Overpass endpoints failed");
}

// lat/lon → metres east/north of the centre (equirectangular; fine at this scale)
function toLocal(json, cLat, cLon) {
    const mLat = 111320, mLon = 111320 * Math.cos(cLat * Math.PI / 180);
    const buildings = [], roads = [];
    for (const el of json.elements ?? []) {
        if (!el.geometry || el.geometry.length < 2) continue;
        const pts = el.geometry.map((g) => ({ x: (g.lon - cLon) * mLon, z: (g.lat - cLat) * mLat }));
        if (el.tags?.building) buildings.push({ pts, h: heightFromTags(el.tags) });
        else if (el.tags?.highway) roads.push({ pts });
    }
    return { buildings, roads };
}

// Never leave the layer empty: a plausible block grid when OSM is unreachable.
function proceduralCity(seed = 1) {
    const rnd = (() => { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); })();
    const buildings = [], roads = [];
    for (let gx = -5; gx <= 5; gx++) for (let gz = -5; gz <= 5; gz++) {
        if (rnd() < 0.25) continue;
        const cx = gx * 90 + (rnd() - 0.5) * 20, cz = gz * 90 + (rnd() - 0.5) * 20;
        const w = 22 + rnd() * 34, d = 22 + rnd() * 34;
        buildings.push({ pts: [{ x: cx - w, z: cz - d }, { x: cx + w, z: cz - d }, { x: cx + w, z: cz + d }, { x: cx - w, z: cz + d }],
                         h: 6 + rnd() * rnd() * 70 });
    }
    for (let gx = -5; gx <= 5; gx++) {
        roads.push({ pts: [{ x: gx * 90, z: -500 }, { x: gx * 90, z: 500 }] });
        roads.push({ pts: [{ x: -500, z: gx * 90 }, { x: 500, z: gx * 90 }] });
    }
    return { buildings, roads, procedural: true };
}

export const cityOsmParams = () => ({
    lat:       { base: 48.2316816, min: -85,  max: 85,   mod: { source: "" } },
    lon:       { base: 4.3280742,  min: -180, max: 180,  mod: { source: "" } },
    radius:    { base: 600, min: 100, max: 3000, mod: { source: "" } },   // metres
    heightMul: { base: 1,   min: 0.1, max: 6,    mod: { source: "" } },
    camDist:   { base: 700, min: 50,  max: 3000, mod: { source: "" } },
    camHeight: { base: 260, min: 5,   max: 2000, mod: { source: "" } },
    orbit:     { base: 0.05,min: -1,  max: 1,    mod: { source: "" } },
    tilt:      { base: 0,   min: -0.6,max: 0.6,  mod: { source: "" } },
    fov:       { base: 1,   min: 0.4, max: 2.5,  mod: { source: "" } },
    hue:       { base: 185, min: 0,   max: 360,  mod: { source: "" } },
    hueSpread: { base: 40,  min: 0,   max: 180,  mod: { source: "" } },
    lineWidth: { base: 1.2, min: 0.2, max: 5,    mod: { source: "" } },
    glow:      { base: 0.5, min: 0,   max: 1,    mod: { source: "" } },
    showRoads: { base: 1,   min: 0,   max: 1, step: 1, mod: { source: "" } },
    bassLift:  { base: 0.4, min: 0,   max: 3,    mod: { source: "" } },
    fade:      { base: 1,   min: 0,   max: 1,    mod: { source: "" } },
});

function bassLevel(s) {
    if (!s?.length) return 0;
    const n = Math.max(1, (s.length * 0.08) | 0);
    let v = 0; for (let i = 1; i <= n; i++) v += s[i];
    return Math.min(1, (v / n) * 2.5);
}

export function drawCityOsm(ctx, w, h, p, t, extra) {
    ctx.clearRect(0, 0, w, h);
    const lat = p.lat ?? 0, lon = p.lon ?? 0, rad = Math.round(p.radius ?? 600);
    const key = `${lat.toFixed(5)},${lon.toFixed(5)},${rad}`;
    let city = cache.get(key);
    if (city === undefined) {
        cache.set(key, "loading");
        status = `fetching OSM ${lat.toFixed(4)}, ${lon.toFixed(4)} r=${rad}m…`;
        fetchCity(lat, lon, rad).then(
            (c) => { cache.set(key, c.buildings.length ? c : proceduralCity(rad)); status = c.buildings.length ? "" : "no buildings here — procedural fallback"; },
            (e) => { cache.set(key, proceduralCity(rad)); status = "OSM unreachable — procedural fallback (" + e.message + ")"; },
        );
        city = "loading";
    }
    if (city === "loading") {
        ctx.save();
        ctx.fillStyle = `hsl(${p.hue ?? 185} 80% 60%)`;
        ctx.font = `${Math.max(9, w * 0.018)}px monospace`; ctx.textAlign = "center";
        ctx.fillText(status || "loading…", w / 2, h / 2);
        ctx.restore();
        return;
    }

    // ── camera ──────────────────────────────────────────────────────────────
    const ang = t * (p.orbit ?? 0);
    const cd = p.camDist ?? 700, cy = p.camHeight ?? 260;
    const cx = Math.sin(ang) * cd, cz = Math.cos(ang) * cd;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const tilt = p.tilt ?? 0, ct = Math.cos(tilt), st = Math.sin(tilt);
    const f = (Math.min(w, h) * 0.5) / Math.tan((p.fov ?? 1) * 0.5);
    const lift = 1 + bassLevel(extra?.spectrum) * (p.bassLift ?? 0);
    const hMul = (p.heightMul ?? 1) * lift;

    // world → screen; null when behind the camera
    // Rotate (point - camera) by -orbit so the camera sits on +Z looking at -Z,
    // then negate to get depth increasing away from the eye. Getting that sign
    // wrong puts the whole city behind the near plane and culls every polygon.
    const proj = (x, y, z) => {
        const dx = x - cx, dz = z - cz, dy = y - cy;
        const rx = dx * ca - dz * sa;
        let rz = -(dx * sa + dz * ca);
        const ry = dy * ct - rz * st; rz = dy * st + rz * ct;    // pitch
        if (rz < 6) return null;
        return { sx: w / 2 + (rx * f) / rz, sy: h / 2 - (ry * f) / rz, d: rz };
    };

    ctx.save();
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.lineWidth = p.lineWidth ?? 1.2;
    const glow = p.glow ?? 0.5;
    if (glow > 0.01) { ctx.shadowBlur = glow * 18; }
    const far = cd * 2.6;
    const hue = p.hue ?? 185, spread = p.hueSpread ?? 40, fade = p.fade ?? 1;

    if ((p.showRoads ?? 1) > 0.5) {
        ctx.strokeStyle = `hsla(${(hue + 180) % 360} 70% 45% / 0.5)`;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.beginPath();
        for (const r of city.roads) {
            let started = false;
            for (const pt of r.pts) {
                const s = proj(pt.x, 0, pt.z);
                if (!s) { started = false; continue; }
                if (!started) { ctx.moveTo(s.sx, s.sy); started = true; } else ctx.lineTo(s.sx, s.sy);
            }
        }
        ctx.stroke();
    }

    for (const b of city.buildings) {
        const bh = b.h * hMul;
        // one representative point decides colour + distance fade
        const c0 = proj(b.pts[0].x, 0, b.pts[0].z);
        if (!c0 || c0.d > far) continue;
        const k = Math.min(1, bh / 60);
        const a = Math.max(0, 1 - (c0.d / far) ** 1.5) * fade;
        if (a <= 0.01) continue;
        ctx.strokeStyle = `hsla(${(hue + k * spread) % 360} 90% ${45 + k * 25}% / ${a})`;
        ctx.shadowColor = ctx.strokeStyle;

        ctx.beginPath();
        let prevTop = null, firstTop = null, ok = true;
        for (let i = 0; i < b.pts.length; i++) {
            const pt = b.pts[i];
            const lo = proj(pt.x, 0, pt.z), hi = proj(pt.x, bh, pt.z);
            if (!lo || !hi) { ok = false; break; }
            ctx.moveTo(lo.sx, lo.sy); ctx.lineTo(hi.sx, hi.sy);          // vertical edge
            if (prevTop) { ctx.moveTo(prevTop.sx, prevTop.sy); ctx.lineTo(hi.sx, hi.sy); }
            else firstTop = hi;
            prevTop = hi;
        }
        if (ok && firstTop && prevTop) { ctx.moveTo(prevTop.sx, prevTop.sy); ctx.lineTo(firstTop.sx, firstTop.sy); }
        ctx.stroke();
    }
    ctx.restore();
}

export const _cityStatus = () => status;
