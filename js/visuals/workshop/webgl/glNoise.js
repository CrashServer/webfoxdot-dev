// ── Noise layer WebGL2 shader ─────────────────────────────────────────────
// 8 noise subtypes in one fragment shader, selected by uType:
//
//  0  White     — pure per-pixel hash; refreshes at speed×12 fps
//  1  Value     — smooth bilinear value noise (classic cheap noise)
//  2  Perlin    — gradient fBm; the workhorse cloud/smoke type
//  3  Billow    — |Perlin|, fluffy cumulus-cloud bumps
//  4  Ridged    — 1−|Perlin|, sharp mountain ridges
//  5  Warp      — fbm( p + fbm(p) ), highly organic / twisted
//  6  Cellular  — Worley distance noise, animated cell points
//  7  Curl      — divergence-free vector field visualised as hue+value
//
// All run in a single-pass full-screen triangle (no vertex buffer).
// Octaves, lacunarity, and gain affect every fBm-based type (2-5,7).
import * as shared from "./glShared.js";

const FS = /* glsl */`#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2  uRes;
uniform float uTime;
uniform int   uType;
uniform float uScale;
uniform float uSpeed;
uniform float uOctaves;    // 1..8 for fBm types
uniform float uLacunarity; // 1.2..4.0, typically 2.0
uniform float uGain;       // 0.1..0.9, typically 0.5 (persistence)
uniform float uContrast;   // pushes darks dark, brights bright
uniform float uBrightness; // DC shift after contrast
uniform float uHue;        // 0..360  base hue
uniform float uHueRange;   // 0..360  how far hue drifts across the noise
uniform float uSaturation; // 0..100

// ── Hash functions ────────────────────────────────────────────────────────
float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

// ── Value noise ───────────────────────────────────────────────────────────
float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i),              hash12(i + vec2(1,0)), u.x),
               mix(hash12(i + vec2(0,1)),  hash12(i + vec2(1,1)), u.x), u.y);
}

// ── Gradient (Perlin-style) noise ─────────────────────────────────────────
// Each lattice point gets a pseudo-random gradient direction, then we dot the
// offset vector with it and blend with a quintic curve.
vec2 randGrad(vec2 p) {
    float a = hash12(p) * 6.28318;
    return vec2(cos(a), sin(a));
}

float perlin(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); // quintic smoothstep
    float n00 = dot(randGrad(i             ), f            );
    float n10 = dot(randGrad(i + vec2(1,0) ), f - vec2(1,0));
    float n01 = dot(randGrad(i + vec2(0,1) ), f - vec2(0,1));
    float n11 = dot(randGrad(i + vec2(1,1) ), f - vec2(1,1));
    return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y) * 0.5 + 0.5;
}

// ── fBm helpers ───────────────────────────────────────────────────────────
// Looping to a compile-time constant (8) and breaking on the uniform is
// valid GLSL ES 3.0 — the compiler unrolls up to the constant bound.
float fbm(vec2 p, float lac, float gain) {
    float v = 0.0, amp = 0.5, sum = 0.0;
    int oct = clamp(int(round(uOctaves)), 1, 8);
    for (int i = 0; i < 8; i++) {
        if (i >= oct) break;
        v   += amp * perlin(p);
        sum += amp;
        p   *= lac;
        amp *= gain;
    }
    return v / sum;
}

float billowFbm(vec2 p, float lac, float gain) {
    float v = 0.0, amp = 0.5, sum = 0.0;
    int oct = clamp(int(round(uOctaves)), 1, 8);
    for (int i = 0; i < 8; i++) {
        if (i >= oct) break;
        v   += amp * abs(perlin(p) * 2.0 - 1.0); // |signal| → bumps
        sum += amp;
        p   *= lac;
        amp *= gain;
    }
    return v / sum;
}

float ridgedFbm(vec2 p, float lac, float gain) {
    float v = 0.0, amp = 0.5, sum = 0.0;
    int oct = clamp(int(round(uOctaves)), 1, 8);
    for (int i = 0; i < 8; i++) {
        if (i >= oct) break;
        v   += amp * (1.0 - abs(perlin(p) * 2.0 - 1.0)); // ridge = inverted billow
        sum += amp;
        p   *= lac;
        amp *= gain;
    }
    return v / sum;
}

// ── Cellular (Worley) noise ────────────────────────────────────────────────
// Cell-point positions animated with sin so they drift smoothly.
float cellular(vec2 p, float t) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float md = 8.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 nb  = vec2(float(x), float(y));
            vec2 rnd = hash22(i + nb);
            vec2 pt  = 0.5 + 0.45 * sin(t * 0.7 + 6.28318 * rnd);
            float d  = length(nb + pt - f);
            md = min(md, d);
        }
    }
    return md; // 0..~1.4, caller normalises
}

// ── Curl field ────────────────────────────────────────────────────────────
// Returns (angle/2π, magnitude) — angle drives hue, magnitude drives value.
vec2 curlField(vec2 p, float lac, float gain) {
    const float eps = 0.004;
    float dx = fbm(p + vec2(eps, 0.0), lac, gain) - fbm(p - vec2(eps, 0.0), lac, gain);
    float dy = fbm(p + vec2(0.0, eps), lac, gain) - fbm(p - vec2(0.0, eps), lac, gain);
    float angle = atan(dy, dx) / 6.28318 + 0.5; // 0..1
    float mag   = clamp(length(vec2(dx, dy)) / eps * 0.15, 0.0, 1.0);
    return vec2(angle, mag);
}

// ── HSL → RGB ─────────────────────────────────────────────────────────────
vec3 hsl2rgb(float h, float s, float l) {
    vec3 k = mod(vec3(0, 8, 4) + h * 12.0, 12.0);
    float a = s * min(l, 1.0 - l);
    return l - a * clamp(min(k - 3.0, 9.0 - k), -1.0, 1.0);
}

// ── Main ──────────────────────────────────────────────────────────────────
void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    float t  = uTime * uSpeed;
    vec2 p   = uv * uScale;
    float lac = uLacunarity;
    float gn  = uGain;

    float v = 0.0;
    float hueShift = 0.0; // used by curl to override the hue dimension

    if (uType == 0) {
        // White — refresh at speed×12 fps (discrete grain)
        float frame = floor(uTime * max(uSpeed, 0.5) * 12.0);
        v = hash12(gl_FragCoord.xy + vec2(frame * 133.7, frame * 91.3));

    } else if (uType == 1) {
        // Value noise — smooth but no directional gradient bias
        p += vec2(t * 0.41, t * 0.37);
        v = valueNoise(p);

    } else if (uType == 2) {
        // Perlin fBm — the classic cloud/smoke look
        p += vec2(t * 0.31, t * 0.21);
        v = fbm(p, lac, gn);

    } else if (uType == 3) {
        // Billow — fluffy cumulus; all values pushed positive
        p += vec2(t * 0.28, t * 0.19);
        v = billowFbm(p, lac, gn);

    } else if (uType == 4) {
        // Ridged — sharp crests, dark valleys
        p += vec2(t * 0.22, t * 0.17);
        v = ridgedFbm(p, lac, gn);

    } else if (uType == 5) {
        // Domain warp — fbm(p + fbm(p+fbm(p)))
        // Two warp passes for maximum swirl; expensive but worth it visually.
        p += vec2(t * 0.19, t * 0.13);
        vec2 q = vec2(fbm(p,                       lac, gn),
                      fbm(p + vec2(5.2, 1.3),       lac, gn));
        vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2), lac, gn),
                      fbm(p + 4.0 * q + vec2(8.3, 2.8), lac, gn));
        v = fbm(p + 4.0 * r, lac, gn);

    } else if (uType == 6) {
        // Cellular / Worley — distance to nearest animated cell point
        p += vec2(t * 0.12, t * 0.09);
        float raw = cellular(p, uTime * uSpeed * 0.3);
        v = clamp(1.0 - raw * 1.2, 0.0, 1.0); // invert: bright centres, dark edges

    } else {
        // Curl — divergence-free field; hue encodes flow direction
        p += vec2(t * 0.17, t * 0.11);
        vec2 cf = curlField(p, lac, gn);
        hueShift = cf.x; // override hue with flow angle
        v = cf.y;
    }

    // ── Contrast + brightness ─────────────────────────────────────────────
    v = clamp((v - 0.5) * uContrast + 0.5 + uBrightness, 0.0, 1.0);

    // ── Color mapping ─────────────────────────────────────────────────────
    float sat = uSaturation / 100.0;
    float h, s, l;
    if (uType == 7) {
        // Curl: hue = flow direction, value = magnitude
        h = mod(uHue / 360.0 + hueShift * (uHueRange / 360.0 + 0.001), 1.0);
        s = sat;
        l = v * 0.65;
    } else if (uHueRange < 1.0) {
        // Monochrome: tinted grayscale
        h = uHue / 360.0;
        s = sat * 0.3;
        l = v;
    } else {
        // Colorised: noise value maps across the hue range
        h = mod(uHue / 360.0 + v * (uHueRange / 360.0), 1.0);
        s = sat;
        l = v * 0.65 + 0.1;
    }
    outColor = vec4(hsl2rgb(h, s, l), 1.0);
}`;

const NAME     = "noise";
const UNIFORMS = [
    "uRes", "uTime", "uType", "uScale", "uSpeed",
    "uOctaves", "uLacunarity", "uGain",
    "uContrast", "uBrightness", "uHue", "uHueRange", "uSaturation",
];

let cached = null;
export function supported() {
    if (cached !== null) return cached;
    cached = shared.supported();
    if (cached) shared.registerProgram(NAME, FS, UNIFORMS);
    return cached;
}

export function render(w, h, p, t) {
    return shared.render(NAME, w, h, (gl, u) => {
        gl.uniform2f(u.get("uRes"),        w, h);
        gl.uniform1f(u.get("uTime"),       t);
        gl.uniform1i(u.get("uType"),       Math.round(Math.min(7, Math.max(0, p.type))));
        gl.uniform1f(u.get("uScale"),      p.scale);
        gl.uniform1f(u.get("uSpeed"),      p.speed);
        gl.uniform1f(u.get("uOctaves"),    p.octaves);
        gl.uniform1f(u.get("uLacunarity"), p.lacunarity);
        gl.uniform1f(u.get("uGain"),       p.gain);
        gl.uniform1f(u.get("uContrast"),   p.contrast);
        gl.uniform1f(u.get("uBrightness"), p.brightness);
        gl.uniform1f(u.get("uHue"),        p.hue);
        gl.uniform1f(u.get("uHueRange"),   p.hueRange);
        gl.uniform1f(u.get("uSaturation"), p.saturation);
    });
}
