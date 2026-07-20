// scenes-glsl.js — the GPU twin of scenes/index.js. Each scene's field() ported to a
// GLSL ES 3.00 function. Order MUST match scenes/index.js (defines the scene id).
//
// Prelude assumed present above these functions:
//   #define PI 3.141592653589793
//   float hash1(float n){ return fract(sin(n)*43758.5453123); }
//   float hash2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
// Signature: float scene_<name>(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2)
//   sp = resolved speed, sc = resolved scale, aud = vec4(bass, mid, treble, level).

export const SCENE_GLSL_ORDER = [
    'plasma', 'tunnel', 'wave', 'rain', 'spiral', 'cells', 'starfield', 'nebula', 'moire', 'bars',
    'grid', 'ripple', 'fire', 'aurora', 'kaleido', 'warp', 'metaballs', 'hexgrid', 'checker', 'swarm',
    'flow', 'contour', 'voronoi', 'helix', 'mandala', 'lattice', 'truchet', 'noise', 'rings', 'spectrum',
    'marble',
    'testpattern', 'interference', 'biomech', 'escher', 'circuit', 'panopticon',
    'penrose', 'mobius', 'hexdump', 'lissajous', 'ikedaglitch',
    'barcode', 'equalizer', 'datamatrix',
    'tron', 'butterfly', 'lightning', 'mosaic',
];

export const SCENE_GLSL = {
    plasma: `float scene_plasma(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float k = sc * 8.0;
    float tt = t * sp + aud.w * 1.5;
    float x = u * k, y = v * k;
    float val = sin(x + tt)
              + sin(y + tt * 1.3)
              + sin((x + y) * 0.5 + tt * 0.7)
              + sin(length(vec2(x - k / 2.0, y - k / 2.0)) + tt);
    return val / 8.0 + 0.5;
}`,

    tunnel: `float scene_tunnel(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float hasA = step(0.0001, aud.x + aud.y + aud.z + aud.w);
    float dx = u - 0.5, dy = v - 0.5;
    float r = length(vec2(dx, dy)) + 0.0001;
    float ang = atan(dy, dx);
    float depth = sin(1.0 / r * (1.5 * sc) - t * sp * 2.0) * 0.5 + 0.5;
    float sectors = sin(ang * pp.x + t * sp) * 0.5 + 0.5;
    return depth * 0.7 + sectors * 0.3 * mix(1.0, 0.5 + aud.x, hasA);
}`,

    wave: `float scene_wave(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float hasA = step(0.0001, aud.x + aud.y + aud.z + aud.w);
    float k = sc * 10.0;
    float amp = 0.18 + mix(0.12, aud.w * 0.22, hasA);
    float y = 0.5 + sin(u * k + t * sp * 2.0) * amp + sin(u * k * 0.5 - t * sp) * amp * 0.5;
    return max(0.0, 1.0 - abs(v - y) * pp.x);
}`,

    rain: `float scene_rain(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float cols = 40.0 * sc;
    float col = floor(u * cols);
    float off = hash1(col * 12.9898);
    float speed = sp * (0.4 + off * 1.2);
    float head = mod(t * speed * 0.3 + off, 1.0);
    float d = mod(v - head + 1.0, 1.0);
    return max(0.0, 1.0 - d * 4.0);
}`,

    spiral: `float scene_spiral(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float dx = u - 0.5, dy = v - 0.5;
    float r = length(vec2(dx, dy));
    float ang = atan(dy, dx);
    float arms = pp.x;
    return sin(ang * arms + r * sc * 22.0 - t * sp * 2.0 - aud.y * 3.0) * 0.5 + 0.5;
}`,

    cells: `float scene_cells(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    int n = int(max(2.0, floor(pp.x * sc + 0.5)));
    const int MAXN = 8;
    float best = 9.0;
    for (int gy = 0; gy < MAXN; gy++){ if (gy >= n) break;
      for (int gx = 0; gx < MAXN; gx++){ if (gx >= n) break;
        float px = (float(gx) + 0.5) / float(n) + sin(t * sp + float(gx) * 2.1) * 0.11;
        float py = (float(gy) + 0.5) / float(n) + cos(t * sp + float(gy) * 3.3) * 0.11;
        float d = length(vec2(u - px, v - py));
        if (d < best) best = d;
      } }
    return max(0.0, 1.0 - best * float(n) * 0.9);
}`,

    starfield: `float scene_starfield(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float n = max(6.0, floor(28.0 * sc + 0.5));
    float vv = mod(v + t * sp * 0.06, 1.0);
    float cx = floor(u * n), cy = floor(vv * n);
    float hf = hash2(vec2(cx, cy));
    if (hf < 0.86) return 0.0;
    return (sin(t * sp * 2.0 + hf * 30.0) * 0.5 + 0.5) * ((hf - 0.86) / 0.14);
}`,

    nebula: `float scene_nebula(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float k = sc;
    float val = 0.0, amp = 0.5, f = 3.0 * k;
    for (int i = 0; i < 4; i++){
        val += amp * sin(u * f + t * sp * 0.3 + float(i)) * cos(v * f - t * sp * 0.2 - float(i));
        f *= 2.0; amp *= 0.5;
    }
    return val * 0.6 + 0.5;
}`,

    moire: `float scene_moire(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float k = sc * pp.x;
    float a1 = t * sp * 0.2, a2 = -t * sp * 0.13;
    float g1 = sin((u * cos(a1) + v * sin(a1)) * k);
    float g2 = sin((u * cos(a2) + v * sin(a2)) * k * 1.05);
    return g1 * g2 * 0.5 + 0.5;
}`,

    bars: `float scene_bars(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float hasA = step(0.0001, aud.x + aud.y + aud.z + aud.w);
    float n = pp.x;
    float bar = min(n - 1.0, floor(u * n));
    float lvl;
    if (hasA > 0.5) {
        float band = bar / n;
        lvl = band < 0.34 ? aud.x : (band < 0.67 ? aud.y : aud.z);
    } else {
        lvl = sin(bar * 1.7 + t * sp * 2.0) * 0.4 + 0.5;
    }
    float h = 0.06 + lvl * 0.9;
    return v > (1.0 - h) ? 1.0 - (v - (1.0 - h)) * 0.3 : 0.0;
}`,

    grid: `float scene_grid(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float k = floor(sc * pp.x + 0.5);
    float drift = t * sp * 0.05;
    float gx = abs(sin((u + drift) * PI * k));
    float gy = abs(sin((v - drift) * PI * k));
    float line = max(gx, gy);
    return pow(line, 10.0) * (0.55 + 0.45 * sin(t * sp * 1.5));
}`,

    ripple: `float scene_ripple(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float dx = u - 0.5, dy = v - 0.5;
    float r = length(vec2(dx, dy));
    float kick = aud.x * 5.0;
    float rings = sin(r * sc * 44.0 - t * sp * 3.0 - kick) * 0.5 + 0.5;
    return rings * (1.0 - r * 1.2);
}`,

    fire: `float scene_fire(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float y = v - t * sp * 0.5;
    float n = 0.0, amp = 0.5, f = 6.0 * sc;
    for (int i = 0; i < 3; i++){
        n += amp * sin(u * f + float(i)) * cos(y * f * 1.3 - t * sp * 2.0 + float(i));
        f *= 2.0; amp *= 0.5;
    }
    n = n * 0.6 + 0.5;
    float heat = pow(v, 1.4);
    return max(0.0, n * heat * (1.1 + aud.x * 0.6) - (1.0 - v) * 0.25);
}`,

    aurora: `float scene_aurora(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float hasA = step(0.0001, aud.x + aud.y + aud.z + aud.w);
    float wave = sin(u * 6.0 * sc + t * sp) + sin(u * 11.0 * sc - t * sp * 0.7) * 0.5;
    float band = 0.42 + wave * 0.14;
    float curtain = max(0.0, 1.0 - abs(v - band) * 3.5);
    float shimmer = 0.6 + 0.4 * sin(u * 44.0 + t * sp * 3.0);
    return curtain * shimmer * (0.7 + mix(0.2, aud.y * 0.5, hasA));
}`,

    kaleido: `float scene_kaleido(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float seg = pp.x;
    float dx = u - 0.5, dy = v - 0.5;
    float r = length(vec2(dx, dy));
    float ang = atan(dy, dx) + t * sp * 0.2;
    float wedge = PI * 2.0 / seg;
    ang = abs(mod(mod(ang, wedge) + wedge, wedge) - wedge / 2.0);
    float x = cos(ang) * r * 20.0, y = sin(ang) * r * 20.0;
    float va = sin(x + t * sp) * 0.5 + 0.5;
    float vb = cos(y - t * sp) * 0.5 + 0.5;
    return va * vb;
}`,

    warp: `float scene_warp(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float n1 = sin(u * 10.0 * sc + t * sp) + cos(v * 10.0 * sc - t * sp);
    float n2 = sin((u + n1 * 0.12) * 10.0 * sc + t * sp * 0.5) + cos((v - n1 * 0.12) * 10.0 * sc);
    return n2 * 0.25 + 0.5;
}`,

    metaballs: `float scene_metaballs(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float hasA = step(0.0001, aud.x + aud.y + aud.z + aud.w);
    int k = int(max(2.0, pp.x));
    const int MAXN = 12;
    float sum = 0.0;
    for (int i = 0; i < MAXN; i++){ if (i >= k) break;
        float px = 0.5 + sin(t * sp * 0.7 + float(i) * 2.1) * 0.35;
        float py = 0.5 + cos(t * sp * 0.5 + float(i) * 1.7) * 0.35;
        float d = (u - px) * (u - px) + (v - py) * (v - py);
        sum += 0.02 / (d + 0.002);
    }
    return min(1.0, sum * (0.7 + mix(0.2, aud.x * 0.5, hasA)));
}`,

    hexgrid: `float scene_hexgrid(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float k = sc * pp.x;
    float x = u * k, y = v * k * 1.1547;
    float h = cos(x * PI * 2.0)
            + cos((x * 0.5 + y * 0.866) * PI * 2.0)
            + cos((x * 0.5 - y * 0.866) * PI * 2.0);
    float cell = h / 3.0 * 0.5 + 0.5;
    return pow(cell, 3.0) * (0.7 + 0.3 * sin(t * sp));
}`,

    checker: `float scene_checker(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float k = max(2.0, floor(sc * 8.0 + 0.5));
    float wu = u + sin(v * 4.0 + t * sp) * 0.05;
    float wv = v + cos(u * 4.0 - t * sp) * 0.05;
    int c = (int(floor(wu * k)) + int(floor(wv * k))) & 1;   // exact parity (mod() misses on some GPUs)
    return c == 1 ? 1.0 : 0.06;
}`,

    swarm: `float scene_swarm(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    int n = int(pp.x);
    const int MAXN = 12;
    float sum = 0.0;
    for (int i = 0; i < MAXN; i++){ if (i >= n) break;
        float ph = float(i) * 2.399;
        float px = 0.5 + sin(t * sp * 0.6 + ph) * 0.4 * cos(ph * 3.0);
        float py = 0.5 + cos(t * sp * 0.5 + ph * 1.3) * 0.4 * sin(ph * 2.0);
        float d2 = (u - px) * (u - px) + (v - py) * (v - py);
        sum += exp(-d2 * 140.0);
    }
    return min(1.0, sum);
}`,

    flow: `float scene_flow(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float ang = sin(u * 5.0 * sc + t * sp * 0.3) + cos(v * 5.0 * sc - t * sp * 0.2);
    float stream = sin((u * cos(ang) + v * sin(ang)) * 22.0 - t * sp * 2.0);
    return stream * 0.5 + 0.5;
}`,

    contour: `float scene_contour(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float h = sin(u * 6.0 * sc + t * sp * 0.3)
            + cos(v * 6.0 * sc - t * sp * 0.2)
            + sin((u + v) * 4.0 * sc);
    float lines = abs(sin(h * PI * 2.5));
    return pow(lines, 6.0);
}`,

    voronoi: `float scene_voronoi(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    int n = int(max(2.0, floor(pp.x * sc + 0.5)));
    const int MAXN = 8;
    float d1 = 9.0, d2 = 9.0;
    for (int gy = 0; gy < MAXN; gy++){ if (gy >= n) break;
      for (int gx = 0; gx < MAXN; gx++){ if (gx >= n) break;
        float px = (float(gx) + 0.5) / float(n) + sin(t * sp + float(gx) * 2.1) * 0.11;
        float py = (float(gy) + 0.5) / float(n) + cos(t * sp + float(gy) * 3.3) * 0.11;
        float d = length(vec2(u - px, v - py));
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      } }
    return max(0.0, 1.0 - (d2 - d1) * float(n) * 2.5);
}`,

    helix: `float scene_helix(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float phase = v * 8.0 * sc - t * sp * 2.0;
    float x1 = 0.5 + sin(phase) * 0.3;
    float x2 = 0.5 + sin(phase + PI) * 0.3;
    float d = min(abs(u - x1), abs(u - x2));
    return max(0.0, 1.0 - d * 12.0) * (0.6 + 0.4 * cos(phase));
}`,

    mandala: `float scene_mandala(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float pet = pp.x;
    float dx = u - 0.5, dy = v - 0.5;
    float r = length(vec2(dx, dy));
    float ang = atan(dy, dx);
    float petals = abs(cos(ang * pet + t * sp * 0.5));
    float rings = abs(sin(r * 30.0 - t * sp));
    return max(0.0, petals * rings * (1.0 - r * 1.3));
}`,

    lattice: `float scene_lattice(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float k = sc * 11.0;
    float rot = t * sp * 0.2, c = cos(rot), si = sin(rot);
    float x = (u - 0.5) * c - (v - 0.5) * si, y = (u - 0.5) * si + (v - 0.5) * c;
    float gx = abs(sin(x * k * PI)), gy = abs(sin(y * k * PI));
    return pow(max(gx, gy), 8.0);
}`,

    truchet: `float scene_truchet(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float k = max(2.0, floor(sc * 6.0 + 0.5));
    float cx = floor(u * k), cy = floor(v * k);
    float hval = hash1(cx * 127.1 + cy * 311.7 + floor(t * sp));
    bool flip = hval > 0.5;
    float fx = u * k - cx, fy = v * k - cy;
    float d = flip ? abs(length(vec2(fx, fy)) - 0.5) : abs(length(vec2(1.0 - fx, fy)) - 0.5);
    return max(0.0, 1.0 - d * 8.0);
}`,

    noise: `float scene_noise(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float k = max(4.0, floor(sc * 60.0 + 0.5));
    float cx = floor(u * k), cy = floor(v * k), frame = floor(t * sp * 12.0);
    return hash1(cx * 127.1 + cy * 311.7 + frame * 13.73);
}`,

    rings: `float scene_rings(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float dx = u - 0.5, dy = v - 0.5, r = length(vec2(dx, dy));
    float ph = r * sc * pp.x - t * sp * 1.5 - aud.x * 2.0;
    ph = ph - floor(ph);
    return ph < 0.16 ? 1.0 - ph / 0.16 * 0.5 : 0.0;
}`,

    spectrum: `float scene_spectrum(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float hasA = step(0.0001, aud.x + aud.y + aud.z + aud.w);
    float dx = u - 0.5, dy = v - 0.5;
    float r = length(vec2(dx, dy)) * 2.0, ang = atan(dy, dx);
    float lvl = hasA > 0.5
        ? (r < 0.34 ? aud.x : (r < 0.67 ? aud.y : aud.z))
        : (sin(r * 8.0 + t * sp) * 0.4 + 0.5);
    float spokes = abs(sin(ang * 12.0));
    return (r < lvl * 1.1 ? 1.0 : 0.0) * (0.4 + 0.6 * spokes);
}`,

    marble: `float scene_marble(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float turb = 0.0, amp = 0.5, f = 4.0 * sc;
    for (int i = 0; i < 4; i++){
        turb += amp * abs(sin(u * f + t * sp * 0.2) * cos(v * f - t * sp * 0.15));
        f *= 2.0; amp *= 0.5;
    }
    return sin((u + v) * 8.0 * sc + turb * 6.0) * 0.5 + 0.5;
}`,

    testpattern: `float scene_testpattern(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float bass = aud.x;
    float grating = 0.5 + 0.5 * sin(u * 40.0 * sc * 6.28318 + t * sp * 2.0 + bass * 8.0);
    float blocks = max(2.0, floor(12.0 * sc + 0.5));
    float bx = floor(u * blocks), by = floor(v * blocks * 0.6), tick = floor(t * sp * 8.0);
    float hraw = sin((bx + by * 0.13) * 127.1 + (tick + 0.5) * 311.7) * 43758.5453;
    float h = hraw - floor(hraw);
    float block = h > (0.82 - bass * 0.3) ? 1.0 : 0.0;
    float scan = max(0.0, 1.0 - abs(mod(v - t * sp * 0.3, 1.0) - 0.02) / 0.03);
    return min(1.0, max(max(pow(grating, 2.0) * block, block * 0.9), scan));
}`,

    interference: `float scene_interference(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    vec2 p = (vec2(u, v) - 0.5) * 2.0;
    float freq = 8.0 * sc, contrast = 1.5, audioReact = 1.0;
    float tt = t * sp;
    const int NS = 4;
    float s = 0.0;
    for (int i = 0; i < NS; i++){
        float fi = float(i);
        vec2 src = vec2(cos(tt * 0.5 + fi * 2.1), sin(tt * 0.4 + fi * 1.7)) * 0.6;
        s += sin(length(p - src) * freq * (1.0 + aud.x * audioReact) - tt * 2.0);
    }
    float n = 0.5 + 0.5 * s / float(NS);
    n = pow(clamp(n, 0.0, 1.0), contrast);
    return clamp(n, 0.0, 1.0);
}`,

    biomech: `float scene_biomech(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float bass = aud.x, mid = aud.y, beat = aud.x;
    float tt = t * sp;
    float sway = sin(v * 8.0 + tt * 1.5) * (0.03 + bass * 0.02);
    float du = abs(u - (0.5 + sway));
    du = min(du, 1.0 - du);
    float val = exp(-(du * du) * 6000.0) * (0.55 + bass * 0.35);
    float vertebraT = fract(v * 20.0 + tt * 0.4);
    float vert = exp(-(vertebraT - 0.5) * (vertebraT - 0.5) * 50.0);
    float vertebraW = exp(-(du * du) * 900.0);
    val = max(val, vert * vertebraW * (0.55 + mid * 0.35));
    float ribT = fract(v * 8.0 + tt * 0.2);
    if (ribT > 0.12 && ribT < 0.20){
        float ribW = 0.15 + mid * 0.08 + beat * 0.05;
        float armDist = du - 0.005;
        if (armDist > 0.0 && armDist < ribW){
            float fall = 1.0 - armDist / ribW;
            val = max(val, fall * (0.5 + beat * 0.4));
        }
    }
    return clamp(val, 0.0, 1.0);
}`,

    escher: `float scene_escher(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float bass = aud.x, beat = aud.x;
    float tt = t * sp;
    float cx = (u - 0.5) * 1.8;
    float cy = (v - 0.5) * 1.8;
    float angle = 0.25 + tt * 0.2 + bass * 0.3;
    float ca = cos(angle), sa = sin(angle);
    float rx = ca * cx - sa * cy;
    float ry = sa * cx + ca * cy;
    float stepsPerCycle = 10.0 * max(sc, 0.3);
    float stepIdx = rx * stepsPerCycle * 0.5 + ry * stepsPerCycle * 0.25;
    float stepFrac = fract(stepIdx);
    float cycleIdx = floor(stepIdx + tt * 0.5);
    float val = 0.0;
    float topEdge = abs(stepFrac - 0.5);
    if (topEdge < 0.06) val = max(val, 1.0 - topEdge / 0.06);
    float r = length(vec2(cx, cy));
    val *= max(0.0, 1.0 - r * 1.2);
    val *= 0.6 + 0.4 * bass;
    if (beat > 0.3){
        if (hash2(vec2(cycleIdx, floor(tt * 2.0))) < 0.125){
            val = max(val, beat * 0.9);
        }
    }
    return clamp(val, 0.0, 1.0);
}`,

    circuit: `float scene_circuit(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float tt = t * sp;
    float grid = max(6.0, floor(12.0 * sc + 0.5));
    float halfN = max(2.0, floor(grid * 0.5));
    float cellU = 1.0 / grid;
    float cellV = 1.0 / halfN;
    float cx = floor(u / cellU);
    float cy = floor(v / cellV);
    float localU = (u - cx * cellU) / cellU;
    float localV = (v - cy * cellV) / cellV;
    float prob = 0.5;
    bool hTrace = hash2(vec2(cx, cy)) < 0.5 && hash2(vec2(cx, cy) + 7.3) < prob;
    bool vTrace = hash2(vec2(cx, cy) + 3.1) < 0.5 && hash2(vec2(cx, cy) + 11.7) < prob;
    float traceWidth = 0.04;
    float val = 0.0;
    if (hTrace && abs(localV - 0.5) < traceWidth){
        float fall = 1.0 - abs(localV - 0.5) / traceWidth;
        val = max(val, fall * 0.7);
    }
    if (vTrace && abs(localU - 0.5) < traceWidth){
        float fall = 1.0 - abs(localU - 0.5) / traceWidth;
        val = max(val, fall * 0.7);
    }
    if (hTrace && vTrace){
        float dr = length(vec2(localU - 0.5, localV - 0.5));
        if (dr < 0.15){
            float fall = 1.0 - dr / 0.15;
            fall = fall * fall;
            val = max(val, fall * 0.9 * (1.0 + aud.x));
        }
    }
    if (hTrace){
        float pulsePos = fract(tt * 0.3 * (1.0 + aud.x) + cy * 0.17);
        float dp = abs(localU - pulsePos);
        if (dp < 0.08 && abs(localV - 0.5) < traceWidth * 1.5){
            float pulse = exp(-(dp * dp) * 600.0);
            val = max(val, pulse);
        }
    }
    return clamp(val, 0.0, 1.0);
}`,

    panopticon: `float scene_panopticon(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float cu = u - 0.5, cv = v - 0.5;
    float r = length(vec2(cu, cv)) * 2.0;
    float theta = atan(cv, cu);
    if (theta < 0.0) theta += 2.0 * PI;
    if (r > 1.05) return 0.0;
    const int N = 6;
    float val = 0.0;
    float eyeRadius = 0.12;
    for (int i = 0; i < N; i++){
        float ang = 2.0 * PI * float(i) / float(N);
        float rr = 0.35;
        float ex = rr * cos(ang);
        float ey = rr * sin(ang);
        float d = length(vec2(cu - ex, cv - ey));
        if (d < eyeRadius){
            float fall = 1.0 - d / eyeRadius;
            fall = fall * fall;
            val = max(val, fall * (0.8 + aud.x * 0.2));
        }
        float dAng = abs(theta - ang);
        if (dAng > PI) dAng = 2.0 * PI - dAng;
        if (dAng < 0.015 && r < 0.6){
            float fall = 1.0 - dAng / 0.015;
            val = max(val, fall * 0.3);
        }
    }
    if (abs(cu) < 0.003 && abs(cv) < 0.15) val = max(val, 0.6);
    if (abs(cv) < 0.003 && abs(cu) < 0.15) val = max(val, 0.6);
    return clamp(val, 0.0, 1.0);
}`,

    penrose: `float segDist(vec2 pp, vec2 A, vec2 B){
    vec2 d = B - A;
    float l2 = dot(d, d);
    float tp = 0.0;
    if (l2 > 1e-8) tp = dot(pp - A, d) / l2;
    tp = clamp(tp, 0.0, 1.0);
    vec2 q = A + d * tp;
    return length(pp - q);
}
float scene_penrose(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float bass = aud.x;
    float tt = t * sp;
    float epSize = 0.35, epThickness = 0.02, epRotSpeed = 0.2;
    float cu = u - 0.5, cv = v - 0.5;
    float ang = tt * epRotSpeed;
    float ca = cos(ang), sa = sin(ang);
    vec2 pr = vec2(ca * cu - sa * cv, sa * cu + ca * cv);
    float size = epSize * (1.0 + bass * 0.2);
    vec2 v0 = vec2(0.0, size * 0.866);
    vec2 v1 = vec2(-size * 0.866, -size * 0.433);
    vec2 v2 = vec2(size * 0.866, -size * 0.433);
    float d0 = segDist(pr, v0, v1);
    float d1 = segDist(pr, v1, v2);
    float d2 = segDist(pr, v2, v0);
    vec2 c0 = (v0 + v1) * 0.5;
    vec2 c1 = (v1 + v2) * 0.5;
    vec2 c2 = (v0 + v2) * 0.5;
    float off = epThickness * 2.5;
    float k = off / size;
    vec2 v0b = v0 + (c0 - v0) * k;
    vec2 v1b = v1 + (c1 - v1) * k;
    vec2 v2b = v2 + (c2 - v2) * k;
    float d0b = segDist(pr, v0b, v1b);
    float d1b = segDist(pr, v1b, v2b);
    float d2b = segDist(pr, v2b, v0b);
    float thick = epThickness;
    float dmin = min(min(min(d0, d1), d2), min(min(d0b, d1b), d2b));
    if (dmin > thick) return 0.0;
    float val = 1.0 - dmin / thick;
    val = val * val * (3.0 - 2.0 * val);
    return clamp(val, 0.0, 1.0);
}`,

    mobius: `float scene_mobius(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float tt = t * sp;
    float emRotSpeed = 0.2, emTwists = 1.0, emThickness = 0.03;
    float cu = (u - 0.5) * 1.6, cv = (v - 0.5) * 1.6;
    float rotT = tt * emRotSpeed;
    float ca = cos(rotT), sa = sin(rotT);
    vec2 pr = vec2(ca * cu + sa * cv, -sa * cu + ca * cv);
    const int N = 48;
    const int INNER = 3;
    float closestD = 1e9;
    for (int i = 0; i < N; i++){
        float th = float(i) / float(N) * 2.0 * PI;
        for (int j = 0; j < INNER; j++){
            float w = (float(j) / float(INNER - 1) - 0.5) * 0.15;
            float twist = emTwists * th * 0.5;
            float rad = 0.5 + w * cos(twist);
            float yOff = w * sin(twist);
            float px = cos(th) * rad;
            float py = sin(th) * rad + yOff * 0.5;
            float dx = pr.x - px, dy = pr.y - py;
            float d2 = dx * dx + dy * dy;
            if (d2 < closestD) closestD = d2;
        }
    }
    float d = sqrt(closestD);
    if (d > emThickness) return 0.0;
    float val = 1.0 - d / emThickness;
    val = val * val * (3.0 - 2.0 * val);
    return clamp(val, 0.0, 1.0);
}`,

    hexdump: `float scene_hexdump(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float tt = t * sp;
    float hdColumnDensity = 24.0, hdFallSpeed = 0.5, hdTrailLength = 0.4, hdCharChange = 8.0;
    float cols = max(4.0, floor(hdColumnDensity * sc + 0.5));
    float col = floor(u * cols);
    float h = hash2(vec2(col, 17.0));
    float speed = hdFallSpeed * (0.5 + h);
    float phase = hash2(vec2(col + 5.7, 41.0));
    float headV = 1.0 - fract(tt * speed + phase);
    float rows = max(4.0, floor(hdColumnDensity * 2.0 * sc + 0.5));
    float row = floor(v * rows);
    float rowV = row / rows;
    float dv = headV - rowV;
    if (dv < 0.0) dv += 1.0;
    float trail = hdTrailLength;
    if (dv > trail) return 0.0;
    float val = 1.0 - dv / trail;
    float frame = floor(tt * hdCharChange);
    float on = step(0.125, hash2(vec2(col + 3.3, row + frame * 7.919)));
    if (on < 0.5) return 0.0;
    return clamp(val, 0.0, 1.0);
}`,

    lissajous: `float scene_lissajous(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float bass = aud.x, mid = aud.y, treble = aud.z;
    float tt = t * sp;
    float liThickness = 0.02;
    float av = pp.x + mid * 4.0;
    float bv = pp.y + treble * 5.0;
    float delta = tt * 0.5 + bass * 3.14;
    float cu = (u - 0.5) * 1.6, cy = (v - 0.5) * 1.6;
    const int N = 80;
    float closest = 1e9;
    for (int i = 0; i < N; i++){
        float th = float(i) / float(N) * 2.0 * PI;
        float px = sin(av * th + delta) * 0.6;
        float py = sin(bv * th) * 0.6;
        float dx = px - cu, dy = py - cy;
        float d2 = dx * dx + dy * dy;
        if (d2 < closest) closest = d2;
    }
    float thickness = liThickness + bass * 0.008;
    float d = sqrt(closest);
    float val = 1.0 - min(d / thickness, 1.0);
    val = val * val * (3.0 - 2.0 * val);
    return clamp(val, 0.0, 1.0);
}`,

    ikedaglitch: `float scene_ikedaglitch(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float bass = aud.x, volume = aud.w;
    float beatDetected = step(0.5, bass);
    float tt = t * sp;
    float glBaseProb = 0.3, glRowProbBase = 0.05, glRowCount = 40.0, glOffsetScale = 1.0;
    float frameId = floor(tt * 60.0);
    float baseProb = glBaseProb + bass * 0.25;
    float rowProb = glRowProbBase + bass * 0.2 + beatDetected * 0.3;
    float rowCount = max(1.0, floor(glRowCount * max(sc, 0.1)));
    float row = floor(v * rowCount);
    float col = floor(u * rowCount * 2.0);
    float rowR = hash2(vec2(row, frameId));
    float rowGlitch = (rowR < rowProb) ? 1.0 : 0.0;
    float colOffset = 0.0;
    if (rowGlitch > 0.5){
        float sign = (hash2(vec2(row + 19.3, frameId + 7.1)) < 0.5) ? -1.0 : 1.0;
        float mag = (5.0 + volume * 15.0) * glOffsetScale;
        colOffset = floor(sign * mag + 0.5);
    }
    float sx = col + colOffset;
    float val = 0.0;
    float pixR = hash2(vec2(sx, row + frameId * 7919.0));
    if (pixR < baseProb) val = 0.5 + hash2(vec2(sx + 2.7, row + frameId * 7919.0 + 4.1)) * 0.5;
    if (rowGlitch > 0.5){
        float rowPixR = hash2(vec2(sx + 8.8, row + frameId * 7919.0 + 1.3));
        val = (rowPixR < 0.6) ? (0.7 + bass * 0.3) : 0.0;
    }
    return clamp(val, 0.0, 1.0);
}`,

    barcode: `float scene_barcode(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float x = fract(u * 0.5 + t * sp * 0.08);
    float e = spec(x);
    float lines = 0.5 + 0.5 * sin(u * sc * 200.0);
    return e > 0.4 ? (0.4 + 0.6 * lines) * (0.5 + e * 0.5) : 0.0;
}`,

    equalizer: `float scene_equalizer(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float h = spec(u) * 0.95;
    float bar = step(1.0 - h, v);
    float gap = step(0.1, fract(u * 32.0 * sc));
    return bar * gap;
}`,

    datamatrix: `float scene_datamatrix(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float cu = floor(u * 128.0 * sc), cv = floor(v * 64.0 * sc);
    float th = 0.3 + 0.14 * hash2(vec2(cu, cv));
    float e = spec(u);
    float val = e > th ? (0.55 + e * 0.45) : 0.0;
    float scanV = fract(t * sp * 0.1);
    float sd = abs(v - scanV);
    if (sd < 0.03) val = max(val, (0.55 + aud.w * 0.45) * (1.0 - sd / 0.03));
    return clamp(val, 0.0, 1.0);
}`,

    tron: `float scene_tron(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float bass = aud.x;
    float cx = (u - 0.5) * 2.0, cy = (0.5 - v) * 2.0;
    float r = max(length(vec2(cx, cy)), 0.001);
    float ang = atan(cy, cx);
    float radial = 1.0 / r;
    float density = sc, zFreq = 1.5 + density * 6.0, aFreq = 8.0 + density * 16.0;
    float thick = 0.06, scroll = t * sp;
    float aTwisted = ang + radial * 0.5;
    float zEdge = smoothstep(thick, 0.0, abs(fract(radial * zFreq + scroll) - 0.5));
    float aEdge = smoothstep(thick, 0.0, abs(fract(aTwisted * aFreq * 0.159155 + 0.5) - 0.5));
    float fade = smoothstep(4.0, 1.0, radial);
    float grid = (zEdge + aEdge) * fade;
    float vMax = max(abs(cx), abs(cy));
    float vert = cy / max(vMax, 1e-4);
    float floorMask = smoothstep(-0.4, -1.0, vert), ceilMask = smoothstep(0.4, 1.0, vert);
    float dropoff = smoothstep(1.4, 0.0, r);
    float glow = (floorMask * 0.5 + ceilMask * 0.3) * dropoff;
    return clamp(grid + glow * (1.0 + bass), 0.0, 1.0);
}`,

    butterfly: `float scene_butterfly(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float bass = aud.x, treble = aud.z;
    float cx = (u - 0.5) * 2.0, cy = (0.5 - v) * 2.0;
    float r = length(vec2(cx, cy));
    if (r > 1.0) return 0.0;
    float xMirror = abs(cx), yFromC = abs(cy);
    float nBars = 24.0 * sc;
    float barF = xMirror * nBars, barI = floor(barF), subX = barF - barI;
    float amp = clamp(spec(xMirror) * (1.0 + bass), 0.04, 1.0);
    float gap = 0.15;
    bool inGap = subX < gap || subX > 1.0 - gap;
    float fill = (yFromC <= amp && !inGap) ? (1.0 - yFromC * 0.5) : 0.0;
    float tip = (yFromC > amp - 0.03 && yFromC <= amp && !inGap) ? treble * 0.8 : 0.0;
    float center = abs(cy) < 0.02 ? 0.6 : 0.0;
    return clamp(max(fill + tip, center), 0.0, 1.0);
}`,

    lightning: `float vnoise(vec2 p){
    vec2 ip = floor(p), fp = fract(p);
    float a = hash2(ip);
    float b = hash2(ip + vec2(1.0, 0.0));
    float c = hash2(ip + vec2(0.0, 1.0));
    float d = hash2(ip + vec2(1.0, 1.0));
    vec2 s = fp * fp * (3.0 - 2.0 * fp);
    return a + (b - a) * s.x + (c - a) * s.y + (a - b - c + d) * s.x * s.y;
}
float fbm(vec2 p){
    float val = 0.0, amp = 0.5, f = 1.0;
    for (int i = 0; i < 5; i++){ val += amp * vnoise(p * f); f *= 2.07; amp *= 0.5; }
    return val;
}
float scene_lightning(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float u = uv.x, v = uv.y;
    float sky = fbm(vec2(u * 3.0 + t * sp * 0.1, v * 3.0)) * 0.15;
    float rate = 0.7 * sp;
    float ep = floor(t * rate), age = fract(t * rate);
    float seed = ep * 13.1;
    float boltI = 0.0, env = 0.0;
    if (age < 0.32){
        env = max(exp(-age * 7.0) * (0.55 + 0.45 * sin(age * 85.0)), 0.0);
        float xs = u, ys = 1.0 - v;
        for (int branch = 0; branch < 2; branch++){
            float zigSeed = seed + float(branch) * 7.3;
            float drift = (branch == 0) ? (hash2(vec2(seed, 0.37)) - 0.5) * 0.35
                                        : (hash2(vec2(seed, float(branch) * 2.1)) - 0.5) * 1.4;
            float jit = (branch == 0) ? 0.06 : 0.10;
            float px = 0.5, py = 1.0, minDsq = 1e9;
            for (int k = 1; k <= 20; k++){
                float ny = 1.0 - float(k) / 20.0;
                float bend = (hash2(vec2(zigSeed, float(k))) - 0.5) * jit;
                float nx = px + bend + drift / 20.0;
                float ex = nx - px, ey = ny - py;
                float l2 = ex * ex + ey * ey;
                float tp = l2 > 1e-8 ? ((xs - px) * ex + (ys - py) * ey) / l2 : 0.0;
                tp = clamp(tp, 0.0, 1.0);
                float qx = px + ex * tp, qy = py + ey * tp;
                float dSq = (xs - qx) * (xs - qx) + (ys - qy) * (ys - qy);
                if (dSq < minDsq) minDsq = dSq;
                px = nx; py = ny;
            }
            boltI += exp(-minDsq * 55000.0) + exp(-minDsq * 1500.0) * 0.5;
        }
        boltI *= env;
    }
    float skyFlash = (age < 0.32) ? env * 0.3 : 0.0;
    return clamp(sky + boltI + skyFlash, 0.0, 1.0);
}`,

    // mosaic — the TEMPLATE video synth: a fully-parametric, DETERMINISTIC grid of colour
    // cells that light up on the pattern you choose. Nothing is random beyond your control —
    // the per-cell layout is a seedable hash, not Math.random, so the same params always give
    // the same picture. Cheap: no loops, a handful of fract/step + one mode branch per pixel.
    //   pp.x cells (cols) · pp.y rows (0 = square) · pp.z fill (0..1 lit) · pp.w shift (slide)
    //   pp2.x mode (0 scatter·1 cols·2 rows·3 checker·4 radial·5 diagonal) · pp2.y seed
    //   pp2.z gap (0..0.5 cell inset) · pp2.w react (audio pulse 0..1)     hue/pal recolour it.
    mosaic: `float scene_mosaic(vec2 uv, float t, float sp, float sc, vec4 aud, vec4 pp, vec4 pp2){
    float nx = clamp(floor(pp.x * sc + 0.5), 1.0, 96.0);
    float ny = pp.y < 1.0 ? nx : clamp(floor(pp.y * sc + 0.5), 1.0, 96.0);
    vec2 gridN = vec2(nx, ny);
    vec2 cell = floor(uv * gridN);
    vec2 f = fract(uv * gridN);
    float r = hash2(cell + pp2.y * 7.3 + 1.7);              // deterministic per-cell 0..1 (seeded)
    float fill = clamp(pp.z, 0.0, 1.0);
    float drift = pp.w + t * sp * 0.08;                     // shift knob + slow time slide
    int mode = int(pp2.x + 0.5);
    float key;                                              // 0..1 activation key, compared to fill
    if      (mode == 1) key = fract(cell.x / nx + drift);                        // columns sweep
    else if (mode == 2) key = fract(cell.y / ny + drift);                        // rows sweep
    else if (mode == 3) key = mod(cell.x + cell.y + floor(drift * 2.0), 2.0) < 1.0 ? 0.0 : 1.0;   // checker
    else if (mode == 4) key = fract(length((cell + 0.5) / gridN - 0.5) * 2.0 - drift);            // radial rings
    else if (mode == 5) key = fract((cell.x + cell.y) / (nx + ny) + drift);      // diagonal wipe
    else                key = fract(r + drift);                                  // scatter (seeded hash)
    float on = step(key, fill);
    float bin = mod(cell.x + cell.y * nx, 32.0);
    float a = spec((bin + 0.5) / 32.0) * clamp(pp2.w, 0.0, 1.0);   // per-cell spectrum pulse
    float g = clamp(pp2.z, 0.0, 0.49);                     // cell gap/inset
    float ins = step(g, f.x) * step(f.x, 1.0 - g) * step(g, f.y) * step(f.y, 1.0 - g);
    return on * ins * (0.15 + 0.8 * r) * (0.6 + 0.4 * a);  // per-cell palette colour × brightness
}`,
};
