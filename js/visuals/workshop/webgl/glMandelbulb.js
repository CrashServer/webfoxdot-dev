// ── WebGL2 Mandelbulb ─────────────────────────────────────────────────────
// Ported from web/shaders/layer_mandelbulb.wgsl — power-N 3D Mandelbulb,
// raymarched, orbit-trap coloring. Cleaner port than FreqTower: no dome
// projection, no storage buffer, no JS-driven animation state, just a
// static-ish camera and a rotating fractal. One change from the original:
// its hardcoded "bass boosts power" reactivity is dropped in favor of just
// letting `power` itself be assigned an audio driver (Bass, etc.) — this
// app's generic driver system already covers that, so a shader-side special
// case would be redundant.
import * as shared from "./glShared.js";

const FS = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uTime;
uniform float uPower;
uniform float uSpin;
uniform float uIters;
uniform float uCamDist;
uniform float uHueA;
uniform float uHueB;
uniform float uSat;
uniform float uLight;
uniform float uGlow;
uniform float uBrightness;

vec3 rotY(vec3 p, float a) { float s = sin(a), c = cos(a); return vec3(c*p.x+s*p.z, p.y, -s*p.x+c*p.z); }
vec3 rotX(vec3 p, float a) { float s = sin(a), c = cos(a); return vec3(p.x, c*p.y-s*p.z, s*p.y+c*p.z); }

float bulbDE(vec3 pos, float power, int iters, out float trap) {
    vec3 z = pos;
    float dr = 1.0, r = 0.0;
    trap = 1e9;
    for (int i = 0; i < 16; i++) {
        if (i >= iters) break;
        r = length(z);
        if (r > 2.0) break;
        trap = min(trap, r);
        float theta = acos(clamp(z.y / r, -1.0, 1.0));
        float phi = atan(z.z, z.x);
        dr = pow(r, power - 1.0) * power * dr + 1.0;
        float zr = pow(r, power);
        float st = sin(theta * power);
        z = zr * vec3(st * cos(phi * power), cos(theta * power), st * sin(phi * power)) + pos;
    }
    return 0.5 * log(max(r, 1e-6)) * r / dr;
}

float mapB(vec3 p, float t, float power, int iters, out float trap) {
    vec3 q = rotX(rotY(p, t), 0.5);
    return bulbDE(q, power, iters, trap);
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
    vec3 rd = normalize(vec3(uv.x, 1.2, uv.y)); // looking mostly "up" at the bulb, like the original

    float power = max(uPower, 2.0);
    int iters = int(clamp(uIters, 4.0, 16.0));
    float t = uTime * uSpin;
    vec3 lightDir = normalize(vec3(0.4, 0.7, 0.4));

    float tt = 0.0, hit = 0.0, trap = 0.0, tp = 0.0, glowAcc = 0.0;
    vec3 pos = vec3(0.0);
    for (int i = 0; i < 100; i++) {
        pos = ro + rd * tt;
        float d = mapB(pos, t, power, iters, tp);
        glowAcc += exp(-d * 20.0);
        if (d < 0.0006) { hit = 1.0; trap = tp; break; }
        if (tt > camDist * 2.6) break;
        tt += d * 0.8;
    }

    vec3 col = vec3(0.0);
    float alpha = 0.0;
    vec3 colorA = hsl2rgb(vec3(uHueA / 360.0, uSat / 100.0, uLight / 100.0));
    vec3 colorB = hsl2rgb(vec3(uHueB / 360.0, uSat / 100.0, uLight / 100.0));
    if (hit > 0.5) {
        float e = 0.0009;
        float td;
        float base = mapB(pos, t, power, iters, td);
        vec3 n = normalize(vec3(
            mapB(pos + vec3(e, 0.0, 0.0), t, power, iters, td) - base,
            mapB(pos + vec3(0.0, e, 0.0), t, power, iters, td) - base,
            mapB(pos + vec3(0.0, 0.0, e), t, power, iters, td) - base
        ));
        float diff = max(dot(n, lightDir), 0.0);
        float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.5);
        col = mix(colorA, colorB, clamp(trap * 1.4, 0.0, 1.0)) * (0.12 + diff * 0.95 + rim * 0.25) * uBrightness;
        alpha = 1.0;
    }
    col += mix(colorA, colorB, 0.5) * glowAcc * uGlow * 0.025;
    outColor = vec4(col, max(alpha, clamp(glowAcc * uGlow * 0.035, 0.0, 0.5)));
}`;

const NAME = "mandelbulb";
const UNIFORMS = ["uRes", "uTime", "uPower", "uSpin", "uIters", "uCamDist", "uHueA", "uHueB", "uSat", "uLight", "uGlow", "uBrightness"];

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
        gl.uniform1f(u.get("uPower"), p.power);
        gl.uniform1f(u.get("uSpin"), p.spin);
        gl.uniform1f(u.get("uIters"), p.iters);
        gl.uniform1f(u.get("uCamDist"), p.camDist);
        gl.uniform1f(u.get("uHueA"), p.hueA);
        gl.uniform1f(u.get("uHueB"), p.hueB);
        gl.uniform1f(u.get("uSat"), p.sat);
        gl.uniform1f(u.get("uLight"), p.light);
        gl.uniform1f(u.get("uGlow"), p.glow);
        gl.uniform1f(u.get("uBrightness"), p.brightness);
    });
}
