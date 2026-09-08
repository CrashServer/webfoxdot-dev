// ── WebGL2 Kali Tunnel ────────────────────────────────────────────────────
// Ported from web/shaders/layer_kalitunnel.wgsl — the classic kaleidoscopic
// fractal tunnel. The original unwraps the DOME's fisheye direction into
// (angle, depth) tunnel coordinates; we don't have a fisheye camera here, so
// this uses centered screen uv directly for the same polar unwrap (radius +
// angle from screen center) — a standard flat-camera tunnel trick, and it
// needs no camera/raymarch machinery at all, same as Apollonian.
// Audio-reactivity is dropped from the shader (was hardcoded "audio pumps
// brightness") in favor of assigning a driver to `brightness`/`glow`
// directly — same change as every other ported fractal layer.
import * as shared from "./glShared.js";

const FS = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uTime;
uniform float uFoldC;
uniform float uSpeed;
uniform float uScale;
uniform float uIters;
uniform float uSpin;
uniform float uWarp;
uniform float uContrast;
uniform float uHueA;
uniform float uHueB;
uniform float uSat;
uniform float uLight;
uniform float uBrightness;
uniform float uGlow;

vec3 hsl2rgb(vec3 hsl) {
    float h = hsl.x, s = hsl.y, l = hsl.z;
    vec3 k = mod(vec3(0.0, 8.0, 4.0) + h * 12.0, 12.0);
    float a = s * min(l, 1.0 - l);
    return l - a * clamp(min(k - 3.0, 9.0 - k), -1.0, 1.0);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    float t = uTime;
    float rr = max(length(uv), 0.02);
    float a = atan(uv.y, uv.x) + t * uSpin;
    float depth = 1.4 / rr + t * uSpeed;
    vec2 p = vec2(a / 3.14159265 * uScale * 2.0, depth * 0.35);

    vec3 colorA = hsl2rgb(vec3(uHueA / 360.0, uSat / 100.0, uLight / 100.0));
    vec3 colorB = hsl2rgb(vec3(uHueB / 360.0, uSat / 100.0, uLight / 100.0));

    float cc = uFoldC + 0.12 * sin(t * 0.3);
    vec3 col = vec3(0.0);
    float amp = 1.0, trap = 1e9;
    int iters = int(min(uIters, 10.0));
    for (int k = 0; k < 10; k++) {
        if (k >= iters) break;
        p = abs(p) / max(dot(p, p), 1e-3) - vec2(cc);
        p += uWarp * 0.15 * sin(p.yx * 3.0 + t);
        trap = min(trap, abs(p.x));
        float cix = 0.5 + 0.5 * sin(float(k) * 1.3 + depth * 0.15 + t);
        col += mix(colorA, colorB, cix) * exp(-abs(p.y) * 2.5) * amp;
        amp *= 0.82;
    }
    col += mix(colorA, colorB, 0.5) * exp(-trap * 7.0) * (1.0 + uGlow);
    col *= uBrightness;
    col = pow(max(col, vec3(0.0)), vec3(uContrast));
    col *= smoothstep(0.0, 0.15, rr); // fade the exact center singularity
    outColor = vec4(col, clamp(length(col) * 0.8, 0.0, 1.0));
}`;

const NAME = "kalitunnel";
const UNIFORMS = ["uRes", "uTime", "uFoldC", "uSpeed", "uScale", "uIters", "uSpin", "uWarp", "uContrast", "uHueA", "uHueB", "uSat", "uLight", "uBrightness", "uGlow"];

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
        gl.uniform1f(u.get("uFoldC"), p.foldC);
        gl.uniform1f(u.get("uSpeed"), p.speed);
        gl.uniform1f(u.get("uScale"), p.scale);
        gl.uniform1f(u.get("uIters"), p.iters);
        gl.uniform1f(u.get("uSpin"), p.spin);
        gl.uniform1f(u.get("uWarp"), p.warp);
        gl.uniform1f(u.get("uContrast"), p.contrast);
        gl.uniform1f(u.get("uHueA"), p.hueA);
        gl.uniform1f(u.get("uHueB"), p.hueB);
        gl.uniform1f(u.get("uSat"), p.sat);
        gl.uniform1f(u.get("uLight"), p.light);
        gl.uniform1f(u.get("uBrightness"), p.brightness);
        gl.uniform1f(u.get("uGlow"), p.glow);
    });
}
