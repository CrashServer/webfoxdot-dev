// scenes-glsl.js — the GPU twin of scenes/index.js. Each scene's field() ported to a
// GLSL ES 3.00 function. Order MUST match scenes/index.js (defines the scene id).
//
// Prelude assumed present above these functions:
//   #define PI 3.141592653589793
//   float hash1(float n){ return fract(sin(n)*43758.5453123); }
//   float hash2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
// Signature: float scene_<name>(vec2 uv, float t, float sp, float sc, vec4 aud)
//   sp = resolved speed, sc = resolved scale, aud = vec4(bass, mid, treble, level).

export const SCENE_GLSL_ORDER = [
    'plasma', 'tunnel', 'wave', 'rain', 'spiral', 'cells', 'starfield', 'nebula', 'moire', 'bars',
    'grid', 'ripple', 'fire', 'aurora', 'kaleido', 'warp', 'metaballs', 'hexgrid', 'checker', 'swarm',
    'flow', 'contour', 'voronoi', 'helix', 'mandala', 'lattice', 'truchet', 'noise', 'rings', 'spectrum',
    'marble',
    'testpattern', 'interference', 'biomech', 'escher', 'circuit', 'panopticon',
];

export const SCENE_GLSL = {
    plasma: `float scene_plasma(vec2 uv, float t, float sp, float sc, vec4 aud){
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

    tunnel: `float scene_tunnel(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float hasA = step(0.0001, aud.x + aud.y + aud.z + aud.w);
    float dx = u - 0.5, dy = v - 0.5;
    float r = length(vec2(dx, dy)) + 0.0001;
    float ang = atan(dy, dx);
    float depth = sin(1.0 / r * (1.5 * sc) - t * sp * 2.0) * 0.5 + 0.5;
    float sectors = sin(ang * 6.0 + t * sp) * 0.5 + 0.5;
    return depth * 0.7 + sectors * 0.3 * mix(1.0, 0.5 + aud.x, hasA);
}`,

    wave: `float scene_wave(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float hasA = step(0.0001, aud.x + aud.y + aud.z + aud.w);
    float k = sc * 10.0;
    float amp = 0.18 + mix(0.12, aud.w * 0.22, hasA);
    float y = 0.5 + sin(u * k + t * sp * 2.0) * amp + sin(u * k * 0.5 - t * sp) * amp * 0.5;
    return max(0.0, 1.0 - abs(v - y) * 9.0);
}`,

    rain: `float scene_rain(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float cols = 40.0 * sc;
    float col = floor(u * cols);
    float off = hash1(col * 12.9898);
    float speed = sp * (0.4 + off * 1.2);
    float head = mod(t * speed * 0.3 + off, 1.0);
    float d = mod(v - head + 1.0, 1.0);
    return max(0.0, 1.0 - d * 4.0);
}`,

    spiral: `float scene_spiral(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float dx = u - 0.5, dy = v - 0.5;
    float r = length(vec2(dx, dy));
    float ang = atan(dy, dx);
    float arms = 3.0;
    return sin(ang * arms + r * sc * 22.0 - t * sp * 2.0 - aud.y * 3.0) * 0.5 + 0.5;
}`,

    cells: `float scene_cells(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    int n = int(max(2.0, floor(4.0 * sc + 0.5)));
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

    starfield: `float scene_starfield(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float n = max(6.0, floor(28.0 * sc + 0.5));
    float vv = mod(v + t * sp * 0.06, 1.0);
    float cx = floor(u * n), cy = floor(vv * n);
    float hf = hash2(vec2(cx, cy));
    if (hf < 0.86) return 0.0;
    return (sin(t * sp * 2.0 + hf * 30.0) * 0.5 + 0.5) * ((hf - 0.86) / 0.14);
}`,

    nebula: `float scene_nebula(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float k = sc;
    float val = 0.0, amp = 0.5, f = 3.0 * k;
    for (int i = 0; i < 4; i++){
        val += amp * sin(u * f + t * sp * 0.3 + float(i)) * cos(v * f - t * sp * 0.2 - float(i));
        f *= 2.0; amp *= 0.5;
    }
    return val * 0.6 + 0.5;
}`,

    moire: `float scene_moire(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float k = sc * 40.0;
    float a1 = t * sp * 0.2, a2 = -t * sp * 0.13;
    float g1 = sin((u * cos(a1) + v * sin(a1)) * k);
    float g2 = sin((u * cos(a2) + v * sin(a2)) * k * 1.05);
    return g1 * g2 * 0.5 + 0.5;
}`,

    bars: `float scene_bars(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float hasA = step(0.0001, aud.x + aud.y + aud.z + aud.w);
    float n = 16.0;
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

    grid: `float scene_grid(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float k = floor(sc * 10.0 + 0.5);
    float drift = t * sp * 0.05;
    float gx = abs(sin((u + drift) * PI * k));
    float gy = abs(sin((v - drift) * PI * k));
    float line = max(gx, gy);
    return pow(line, 10.0) * (0.55 + 0.45 * sin(t * sp * 1.5));
}`,

    ripple: `float scene_ripple(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float dx = u - 0.5, dy = v - 0.5;
    float r = length(vec2(dx, dy));
    float kick = aud.x * 5.0;
    float rings = sin(r * sc * 44.0 - t * sp * 3.0 - kick) * 0.5 + 0.5;
    return rings * (1.0 - r * 1.2);
}`,

    fire: `float scene_fire(vec2 uv, float t, float sp, float sc, vec4 aud){
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

    aurora: `float scene_aurora(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float hasA = step(0.0001, aud.x + aud.y + aud.z + aud.w);
    float wave = sin(u * 6.0 * sc + t * sp) + sin(u * 11.0 * sc - t * sp * 0.7) * 0.5;
    float band = 0.42 + wave * 0.14;
    float curtain = max(0.0, 1.0 - abs(v - band) * 3.5);
    float shimmer = 0.6 + 0.4 * sin(u * 44.0 + t * sp * 3.0);
    return curtain * shimmer * (0.7 + mix(0.2, aud.y * 0.5, hasA));
}`,

    kaleido: `float scene_kaleido(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float seg = max(3.0, floor(sc * 6.0 + 0.5));
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

    warp: `float scene_warp(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float n1 = sin(u * 10.0 * sc + t * sp) + cos(v * 10.0 * sc - t * sp);
    float n2 = sin((u + n1 * 0.12) * 10.0 * sc + t * sp * 0.5) + cos((v - n1 * 0.12) * 10.0 * sc);
    return n2 * 0.25 + 0.5;
}`,

    metaballs: `float scene_metaballs(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float hasA = step(0.0001, aud.x + aud.y + aud.z + aud.w);
    int k = int(max(2.0, floor(sc * 3.0 + 0.5)));
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

    hexgrid: `float scene_hexgrid(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float k = sc * 7.0;
    float x = u * k, y = v * k * 1.1547;
    float h = cos(x * PI * 2.0)
            + cos((x * 0.5 + y * 0.866) * PI * 2.0)
            + cos((x * 0.5 - y * 0.866) * PI * 2.0);
    float cell = h / 3.0 * 0.5 + 0.5;
    return pow(cell, 3.0) * (0.7 + 0.3 * sin(t * sp));
}`,

    checker: `float scene_checker(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float k = max(2.0, floor(sc * 8.0 + 0.5));
    float wu = u + sin(v * 4.0 + t * sp) * 0.05;
    float wv = v + cos(u * 4.0 - t * sp) * 0.05;
    int c = (int(floor(wu * k)) + int(floor(wv * k))) & 1;   // exact parity (mod() misses on some GPUs)
    return c == 1 ? 1.0 : 0.06;
}`,

    swarm: `float scene_swarm(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    int n = int(max(3.0, floor(sc * 6.0 + 0.5)));
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

    flow: `float scene_flow(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float ang = sin(u * 5.0 * sc + t * sp * 0.3) + cos(v * 5.0 * sc - t * sp * 0.2);
    float stream = sin((u * cos(ang) + v * sin(ang)) * 22.0 - t * sp * 2.0);
    return stream * 0.5 + 0.5;
}`,

    contour: `float scene_contour(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float h = sin(u * 6.0 * sc + t * sp * 0.3)
            + cos(v * 6.0 * sc - t * sp * 0.2)
            + sin((u + v) * 4.0 * sc);
    float lines = abs(sin(h * PI * 2.5));
    return pow(lines, 6.0);
}`,

    voronoi: `float scene_voronoi(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    int n = int(max(2.0, floor(sc * 4.0 + 0.5)));
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

    helix: `float scene_helix(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float phase = v * 8.0 * sc - t * sp * 2.0;
    float x1 = 0.5 + sin(phase) * 0.3;
    float x2 = 0.5 + sin(phase + PI) * 0.3;
    float d = min(abs(u - x1), abs(u - x2));
    return max(0.0, 1.0 - d * 12.0) * (0.6 + 0.4 * cos(phase));
}`,

    mandala: `float scene_mandala(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float pet = max(3.0, floor(sc * 8.0 + 0.5));
    float dx = u - 0.5, dy = v - 0.5;
    float r = length(vec2(dx, dy));
    float ang = atan(dy, dx);
    float petals = abs(cos(ang * pet + t * sp * 0.5));
    float rings = abs(sin(r * 30.0 - t * sp));
    return max(0.0, petals * rings * (1.0 - r * 1.3));
}`,

    lattice: `float scene_lattice(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float k = sc * 11.0;
    float rot = t * sp * 0.2, c = cos(rot), si = sin(rot);
    float x = (u - 0.5) * c - (v - 0.5) * si, y = (u - 0.5) * si + (v - 0.5) * c;
    float gx = abs(sin(x * k * PI)), gy = abs(sin(y * k * PI));
    return pow(max(gx, gy), 8.0);
}`,

    truchet: `float scene_truchet(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float k = max(2.0, floor(sc * 6.0 + 0.5));
    float cx = floor(u * k), cy = floor(v * k);
    float hval = hash1(cx * 127.1 + cy * 311.7 + floor(t * sp));
    bool flip = hval > 0.5;
    float fx = u * k - cx, fy = v * k - cy;
    float d = flip ? abs(length(vec2(fx, fy)) - 0.5) : abs(length(vec2(1.0 - fx, fy)) - 0.5);
    return max(0.0, 1.0 - d * 8.0);
}`,

    noise: `float scene_noise(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float k = max(4.0, floor(sc * 60.0 + 0.5));
    float cx = floor(u * k), cy = floor(v * k), frame = floor(t * sp * 12.0);
    return hash1(cx * 127.1 + cy * 311.7 + frame * 13.73);
}`,

    rings: `float scene_rings(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float dx = u - 0.5, dy = v - 0.5, r = length(vec2(dx, dy));
    float ph = r * sc * 10.0 - t * sp * 1.5 - aud.x * 2.0;
    ph = ph - floor(ph);
    return ph < 0.16 ? 1.0 - ph / 0.16 * 0.5 : 0.0;
}`,

    spectrum: `float scene_spectrum(vec2 uv, float t, float sp, float sc, vec4 aud){
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

    marble: `float scene_marble(vec2 uv, float t, float sp, float sc, vec4 aud){
    float u = uv.x, v = uv.y;
    float turb = 0.0, amp = 0.5, f = 4.0 * sc;
    for (int i = 0; i < 4; i++){
        turb += amp * abs(sin(u * f + t * sp * 0.2) * cos(v * f - t * sp * 0.15));
        f *= 2.0; amp *= 0.5;
    }
    return sin((u + v) * 8.0 * sc + turb * 6.0) * 0.5 + 0.5;
}`,

    testpattern: `float scene_testpattern(vec2 uv, float t, float sp, float sc, vec4 aud){
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

    interference: `float scene_interference(vec2 uv, float t, float sp, float sc, vec4 aud){
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

    biomech: `float scene_biomech(vec2 uv, float t, float sp, float sc, vec4 aud){
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

    escher: `float scene_escher(vec2 uv, float t, float sp, float sc, vec4 aud){
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

    circuit: `float scene_circuit(vec2 uv, float t, float sp, float sc, vec4 aud){
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

    panopticon: `float scene_panopticon(vec2 uv, float t, float sp, float sc, vec4 aud){
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
};
