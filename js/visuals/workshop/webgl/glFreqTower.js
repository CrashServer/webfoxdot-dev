// ── WebGL2 FreqTower v2 ───────────────────────────────────────────────────────
// Full port of web/shaders/layer_freqtower.wgsl:
//   16 rings stacked vertically, each ring's radius = its FFT bin group energy
//   Oscillating per-ring Y positions   (evolveAmt × per-ring phase)
//   Inner counter-rotating rings       (fade in above evolveAmt 0.15)
//   Variable N-spokes per ring         (bass=3 → treble=12, alternate direction)
//   4-fold vertical struts             (connect adjacent rings at baseR)
//   Ping-pong wave pulse               (glowing torus travels bass→treble→bass)
//   JS burst peak-hold                 (per-ring white-hot flash on energy peak)
//   Dominant-frequency glow color      (bass/treble mix tracks live spectrum)
//   Smooth-minimum blending            (outer+inner merge when close)
// JS-driven burst[] is peak-hold with exponential decay — computed in freqtower.js.
import * as shared from "./glShared.js";

const FS = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2  uRes;
uniform float uTime;
uniform float uSpin;
uniform float uCamDist;
uniform float uCamHeight;
uniform float uScale;
uniform float uThickReact;
uniform float uEvolveAmt;
uniform float uEvolveSpd;
uniform float uBurstStr;
uniform float uGlow;
uniform float uBrightness;
uniform float uHueBass;
uniform float uHueTreble;
uniform float uSat;
uniform float uLight;
uniform float uSpectrum[64];
uniform float uBurst[16];

const int   RINGS = 16;
const float PI    = 3.14159265359;

float segSpec(int i) {
    int b = i * 4;
    return clamp((uSpectrum[b] + uSpectrum[b+1] + uSpectrum[b+2] + uSpectrum[b+3]) * 0.25, 0.0, 1.0);
}

float sdTor(vec3 p, float R, float r) {
    return length(vec2(length(p.xz) - R, p.y)) - r;
}
float sdCylY(vec3 p, float r, float h) {
    vec2 d = vec2(length(p.xz) - r, abs(p.y) - h);
    return min(max(d.x, d.y), 0.0) + length(max(d, vec2(0.0)));
}
float sdCap(vec3 p, vec3 a, vec3 b, float r) {
    vec3  ab = b - a;
    float tt = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    return length(p - (a + ab * tt)) - r;
}
float sminK(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
}
// Radial domain repeat — fold into one sector so spokes only need one SDF call
vec3 radRep(vec3 p, int n) {
    float angle = 2.0 * PI / float(n);
    float a = atan(p.z, p.x);
    float ra = mod(a, angle);
    if (ra < 0.0) ra += angle;
    ra -= angle * 0.5;
    float r = length(p.xz);
    return vec3(cos(ra) * r, p.y, sin(ra) * r);
}
vec3 rY(vec3 p, float a) {
    float s = sin(a), c = cos(a);
    return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z);
}
vec3 hsl2rgb(vec3 hsl) {
    vec3 k = mod(vec3(0.0, 8.0, 4.0) + hsl.x * 12.0, 12.0);
    float a = hsl.y * min(hsl.z, 1.0 - hsl.z);
    return hsl.z - a * clamp(min(k - 3.0, 9.0 - k), -1.0, 1.0);
}

// Returns (dist, ring_index)
vec2 ftMap(vec3 p, float sc, float T) {
    float baseR  = 0.18 * sc;
    float thkR   = uThickReact;
    float evAmt  = uEvolveAmt;
    float bStr   = uBurstStr;
    float d      = 1e9;
    float seg    = 0.0;

    // Per-ring Y: oscillates with unique frequency + phase
    float ringY[16];
    for (int i = 0; i < RINGS; i++) {
        float frac  = float(i) / float(RINGS - 1);
        ringY[i] = (-0.92 + frac * 1.84) * sc
                 + evAmt * 0.055 * sc * sin(T * (0.38 + float(i) * 0.065) + float(i) * 0.523);
    }

    for (int i = 0; i < RINGS; i++) {
        float energy = segSpec(i);
        float bst    = 1.0 + uBurst[i] * bStr * 0.5;
        float yy     = ringY[i];

        // Burst displaces the ring outward in a per-ring direction
        float bdir  = float(i) * 0.392699082; // i * PI/8
        float bdisp = uBurst[i] * bStr * 0.22 * sc;
        vec3  pR    = bdisp > 0.002
                    ? vec3(p.x - cos(bdir)*bdisp, p.y, p.z - sin(bdir)*bdisp)
                    : p;

        // Outer torus: radius driven by FFT energy + breathing
        float R   = (baseR + energy * 0.72 * sc
                   + evAmt * 0.1 * sc * sin(T + float(i) * 0.785)) * bst;
        float thR = (0.024 + energy * thkR * 0.016) * sc;
        vec3  pp  = vec3(pR.x, pR.y - yy, pR.z);
        float dr  = sdTor(pp, R, thR);

        // Inner counter-rotating ring (fades in above evolveAmt 0.15)
        if (evAmt > 0.15) {
            float vis  = min(1.0, (evAmt - 0.15) / 0.35);
            float dir2 = (i & 1) == 1 ? -1.0 : 1.0;
            vec3  ppI  = rY(pp, T * (0.22 + float(i) * 0.028) * dir2);
            float iR   = R * (0.40 + energy * 0.12);
            float iT   = thR * (0.55 + energy * 0.2) * vis;
            float di   = sdTor(ppI, iR, iT);
            // Smooth-merge when outer and inner are close; min otherwise
            dr = (R - iR) < 0.3 * sc ? sminK(dr, di, 0.04 * sc) : min(dr, di);
        }
        if (dr < d) { d = dr; seg = float(i); }

        // Variable N-spokes: bass=3 → treble=12, alternating rotation direction
        if (energy > 0.02 || evAmt > 0.2) {
            int   nSp = 3 + (i * 9) / 15;
            float sdir = (i & 1) == 1 ? -1.0 : 1.0;
            vec3  qSp  = radRep(rY(pp, T * 0.08 * sdir), nSp);
            float sL   = R * 0.88;
            float sR2  = thR * (0.45 + energy * thkR * 0.25);
            float ds   = sdCap(qSp, vec3(baseR * 0.12, 0.0, 0.0), vec3(sL, 0.0, 0.0), sR2);
            if (ds < d) { d = ds; seg = float(i); }
        }

        // Vertical struts connecting adjacent rings (4-fold radial)
        if (i < RINGS - 1) {
            vec3  qS  = radRep(p, 4);
            float cR2 = 0.011 * sc * (1.0 + energy * thkR * 0.22);
            float dc  = sdCap(qS, vec3(baseR, ringY[i], 0.0), vec3(baseR, ringY[i+1], 0.0), cR2);
            if (dc < d) { d = dc; seg = float(i); }
        }
    }

    // Ping-pong wave pulse: glowing torus travels bass→treble→bass
    {
        float wPos = mod(T * 1.8, 32.0);
        float wi_f = wPos < 16.0 ? wPos : 32.0 - wPos;
        int   wi   = min(int(wi_f), 14); // clamp so wi+1 stays in range
        float wf   = wi_f - float(wi);
        for (int k = 0; k < 2; k++) {
            int   ri = wi + k;
            float wt = k == 0 ? wf : 1.0 - wf;
            if (wt < 0.04) continue;
            float wR = (baseR + segSpec(ri) * 0.72 * sc) * (0.85 + wt * 0.3);
            vec3  pw = vec3(p.x, p.y - ringY[ri], p.z);
            float dw = sdTor(pw, wR, 0.028 * sc * wt);
            if (dw < d) { d = dw; seg = float(ri); }
        }
    }

    // Central axis — breathes with bass ring energy
    {
        float rodR = (0.022 + segSpec(0) * 0.018 + evAmt * 0.006 * sin(T * 2.3)) * sc;
        float da   = sdCylY(p, rodR, 0.92 * sc);
        if (da < d) { d = da; seg = 0.0; }
    }

    return vec2(d, seg);
}

void main() {
    vec2  uv  = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    float ang = uTime * uSpin;
    vec3  ro  = vec3(sin(ang) * uCamDist, uCamHeight * uCamDist, cos(ang) * uCamDist);
    vec3  camFwd   = normalize(-ro);
    vec3  camRight = normalize(cross(camFwd, vec3(0.0, 1.0, 0.001)));
    vec3  camUp    = cross(camRight, camFwd);
    vec3  rd       = normalize(camFwd * 1.5 + uv.x * camRight + uv.y * camUp);

    float sc      = max(uScale, 0.2);
    float T       = uTime * uEvolveSpd;
    float hitT    = -1.0;
    float hitSeg  = 0.0;
    float glowAcc = 0.0;
    float t       = 0.02;

    for (int i = 0; i < 100; i++) {
        vec3  pos = ro + rd * t;
        vec2  res = ftMap(pos, sc, T);
        float dd  = res.x;
        int   ns  = clamp(int(res.y), 0, RINGS - 1);
        float nEn = segSpec(ns);
        float nBst = uBurst[ns] * uBurstStr;
        glowAcc += exp(-max(dd, 0.0) * 15.0) * (0.025 + nEn * 0.07 + nBst * 0.04);
        if (dd < 0.001 + t * 0.0005) { hitT = t; hitSeg = res.y; break; }
        if (t > uCamDist * 3.5) break;
        t += max(dd * 0.72, 0.002);
    }

    float sat = uSat   / 100.0;
    float lit = uLight / 100.0;
    vec3 colorBass   = hsl2rgb(vec3(uHueBass   / 360.0, sat, lit));
    vec3 colorTreble = hsl2rgb(vec3(uHueTreble / 360.0, sat, lit));

    // Glow tracks dominant frequency
    float bass     = segSpec(0) + segSpec(1);
    float treb     = segSpec(13) + segSpec(14) + segSpec(15);
    float glowFrac = treb / (bass + treb + 0.001);
    vec3  glowCol  = mix(colorBass, colorTreble, glowFrac);

    vec3  col   = vec3(0.0);
    float alpha = 0.0;

    if (hitT > 0.0) {
        vec3  pos = ro + rd * hitT;
        float eps = 0.003;
        float r0  = ftMap(pos, sc, T).x;
        vec3  n   = normalize(vec3(
            ftMap(pos + vec3(eps, 0.0, 0.0), sc, T).x - r0,
            ftMap(pos + vec3(0.0, eps, 0.0), sc, T).x - r0,
            ftMap(pos + vec3(0.0, 0.0, eps), sc, T).x - r0
        ));

        float frac   = clamp(hitSeg / float(RINGS - 1), 0.0, 1.0);
        float energy = segSpec(clamp(int(hitSeg), 0, RINGS - 1));
        vec3  baseCol = mix(colorBass, colorTreble, frac);

        // Burst: flash the ring white-hot on energy peak
        float bAmt  = clamp(uBurst[clamp(int(hitSeg), 0, RINGS-1)] * uBurstStr, 0.0, 1.0);
        vec3  segCol = mix(baseCol, vec3(1.0, 0.93, 0.72), bAmt);

        vec3  lightDir = normalize(vec3(0.5, 0.8, 0.3));
        float diff  = max(dot(n, lightDir), 0.0);
        float rim   = pow(max(1.0 - abs(dot(n, -rd)), 0.0), 2.5);
        float spec  = pow(max(dot(reflect(-lightDir, n), -rd), 0.0), 24.0);

        col   = segCol * (0.06 + diff * 0.85 + rim * 0.25);
        col  += segCol * energy * uGlow * 1.8;
        col  += vec3(0.8, 0.9, 1.0) * spec * 0.4;
        // Bass-kick warm pulse
        col  += colorBass * bass * 0.5 * bAmt * 0.3;
        alpha = 1.0;
    }

    // Glow halo — tracks dominant frequency
    col += glowCol * glowAcc * uGlow;

    outColor = vec4(col * uBrightness, max(alpha, clamp(glowAcc * uGlow * 0.55, 0.0, 0.85)));
}`;

const NAME = "freqtower";
const UNIFORMS = [
    "uRes", "uTime", "uSpin", "uCamDist", "uCamHeight",
    "uScale", "uThickReact", "uEvolveAmt", "uEvolveSpd", "uBurstStr",
    "uGlow", "uBrightness", "uHueBass", "uHueTreble", "uSat", "uLight",
    "uSpectrum", "uBurst",
];

let cached = null;
export function supported() {
    if (cached !== null) return cached;
    cached = shared.supported();
    if (cached) shared.registerProgram(NAME, FS, UNIFORMS);
    return cached;
}

export function render(w, h, p, t, spectrum, burst) {
    return shared.render(NAME, w, h, (gl, u) => {
        gl.uniform2f(u.get("uRes"),        w, h);
        gl.uniform1f(u.get("uTime"),       t);
        gl.uniform1f(u.get("uSpin"),       p.spin        ?? 0.25);
        gl.uniform1f(u.get("uCamDist"),    p.camDist     ?? 2.4);
        gl.uniform1f(u.get("uCamHeight"),  p.camHeight   ?? 0.12);
        gl.uniform1f(u.get("uScale"),      p.scale       ?? 1.0);
        gl.uniform1f(u.get("uThickReact"), p.thickReact  ?? 1.0);
        gl.uniform1f(u.get("uEvolveAmt"),  p.evolveAmt   ?? 0.4);
        gl.uniform1f(u.get("uEvolveSpd"),  p.evolveSpd   ?? 0.7);
        gl.uniform1f(u.get("uBurstStr"),   p.burstStr    ?? 1.2);
        gl.uniform1f(u.get("uGlow"),       p.glow        ?? 0.8);
        gl.uniform1f(u.get("uBrightness"), p.brightness  ?? 1.0);
        gl.uniform1f(u.get("uHueBass"),    p.hueBass     ?? 10);
        gl.uniform1f(u.get("uHueTreble"),  p.hueTreble   ?? 200);
        gl.uniform1f(u.get("uSat"),        p.sat         ?? 85);
        gl.uniform1f(u.get("uLight"),      p.light       ?? 55);
        gl.uniform1fv(u.get("uSpectrum"),  spectrum);
        gl.uniform1fv(u.get("uBurst"),     burst);
    });
}
