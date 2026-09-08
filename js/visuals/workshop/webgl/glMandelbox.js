// ── WebGL2 Mandelbox ──────────────────────────────────────────────────────
// Ported from web/shaders/layer_mandelbox.wgsl — the Tglad box/sphere-fold
// fractal. Same shape as the Mandelbulb port: static camera below looking
// up, the fractal itself rotates over time. Same change as every other
// ported fractal here: the original's hardcoded "bass boosts brightness" is
// dropped — assign a driver to `brightness` directly instead.
import * as shared from "./glShared.js";

const FS = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uTime;
uniform float uScale;
uniform float uSpin;
uniform float uIters;
uniform float uCamDist;
uniform float uMinR2;
uniform float uHueA;
uniform float uHueB;
uniform float uSat;
uniform float uLight;
uniform float uGlow;
uniform float uBrightness;

vec3 rotY(vec3 p, float a) { float s = sin(a), c = cos(a); return vec3(c*p.x+s*p.z, p.y, -s*p.x+c*p.z); }
vec3 rotX(vec3 p, float a) { float s = sin(a), c = cos(a); return vec3(p.x, c*p.y-s*p.z, s*p.y+c*p.z); }

float mbDE(vec3 p0, float scale, int iters, float minR2, out float trap) {
    vec3 p = p0;
    float dr = 1.0;
    trap = 1e9;
    for (int i = 0; i < 14; i++) {
        if (i >= iters) break;
        p = clamp(p, vec3(-1.0), vec3(1.0)) * 2.0 - p; // box fold
        float r2 = dot(p, p);
        trap = min(trap, r2);
        if (r2 < minR2) { float t = 1.0 / minR2; p *= t; dr *= t; }
        else if (r2 < 1.0) { float t = 1.0 / r2; p *= t; dr *= t; }
        p = scale * p + p0;
        dr = dr * abs(scale) + 1.0;
    }
    return length(p) / abs(dr);
}

float mapB(vec3 p, float t, float scale, int iters, float minR2, out float trap) {
    return mbDE(rotX(rotY(p, t), t * 0.3), scale, iters, minR2, trap);
}

vec3 hsl2rgb(vec3 hsl) {
    float h = hsl.x, s = hsl.y, l = hsl.z;
    vec3 k = mod(vec3(0.0, 8.0, 4.0) + h * 12.0, 12.0);
    float a = s * min(l, 1.0 - l);
    return l - a * clamp(min(k - 3.0, 9.0 - k), -1.0, 1.0);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    float camDist = max(uCamDist, 1.2);
    vec3 ro = vec3(0.0, -camDist, 0.0);
    vec3 rd = normalize(vec3(uv.x, 1.2, uv.y));

    float sgn = -clamp(uScale, 1.5, 3.0); // negative scale gives the classic hollow box
    int iters = int(clamp(uIters, 4.0, 14.0));
    float minR2 = clamp(uMinR2, 0.05, 0.9);
    float t = uTime * uSpin;
    vec3 lightDir = normalize(vec3(0.4, 0.8, 0.35));

    float tt = 0.0, hit = 0.0, trap = 0.0, tp = 0.0, glowAcc = 0.0;
    vec3 pos = vec3(0.0);
    for (int i = 0; i < 90; i++) {
        pos = ro + rd * tt;
        float d = mapB(pos, t, sgn, iters, minR2, tp);
        glowAcc += exp(-d * 15.0);
        if (d < 0.0007) { hit = 1.0; trap = tp; break; }
        if (tt > camDist * 2.6) break;
        tt += d * 0.85;
    }

    vec3 col = vec3(0.0);
    float alpha = 0.0;
    vec3 colorA = hsl2rgb(vec3(uHueA / 360.0, uSat / 100.0, uLight / 100.0));
    vec3 colorB = hsl2rgb(vec3(uHueB / 360.0, uSat / 100.0, uLight / 100.0));
    if (hit > 0.5) {
        float e = 0.0009;
        float td;
        float base = mapB(pos, t, sgn, iters, minR2, td);
        vec3 n = normalize(vec3(
            mapB(pos + vec3(e, 0.0, 0.0), t, sgn, iters, minR2, td) - base,
            mapB(pos + vec3(0.0, e, 0.0), t, sgn, iters, minR2, td) - base,
            mapB(pos + vec3(0.0, 0.0, e), t, sgn, iters, minR2, td) - base
        ));
        float diff = max(dot(n, lightDir), 0.0);
        float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.0);
        col = mix(colorA, colorB, clamp(trap * 0.7, 0.0, 1.0)) * (0.13 + diff * 0.9 + rim * 0.3) * uBrightness;
        alpha = 1.0;
    }
    col += mix(colorA, colorB, 0.5) * glowAcc * uGlow * 0.03;
    outColor = vec4(col, max(alpha, clamp(glowAcc * uGlow * 0.04, 0.0, 0.5)));
}`;

const NAME = "mandelbox";
const UNIFORMS = ["uRes", "uTime", "uScale", "uSpin", "uIters", "uCamDist", "uMinR2", "uHueA", "uHueB", "uSat", "uLight", "uGlow", "uBrightness"];

// Cached — see glVolume.js for why (whether WebGL2/this program are
// available can't change mid-session, so no reason to recheck every frame).
let cached = null;
export function supported() {
    if (cached !== null) return cached;
    cached = shared.supported();
    if (cached) shared.registerProgram(NAME, FS, UNIFORMS);
    return cached;
}

export function render(w, h, p, t) {
    return shared.render(NAME, w, h, (gl, u) => {
        gl.uniform2f(u.get("uRes"), w, h);
        gl.uniform1f(u.get("uTime"), t);
        gl.uniform1f(u.get("uScale"), p.scale);
        gl.uniform1f(u.get("uSpin"), p.spin);
        gl.uniform1f(u.get("uIters"), p.iters);
        gl.uniform1f(u.get("uCamDist"), p.camDist);
        gl.uniform1f(u.get("uMinR2"), p.minR2);
        gl.uniform1f(u.get("uHueA"), p.hueA);
        gl.uniform1f(u.get("uHueB"), p.hueB);
        gl.uniform1f(u.get("uSat"), p.sat);
        gl.uniform1f(u.get("uLight"), p.light);
        gl.uniform1f(u.get("uGlow"), p.glow);
        gl.uniform1f(u.get("uBrightness"), p.brightness);
    });
}
