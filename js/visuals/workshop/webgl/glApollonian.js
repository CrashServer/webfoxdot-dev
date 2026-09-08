// ── WebGL2 Apollonian gasket ──────────────────────────────────────────────
// Ported from web/shaders/layer_apollonian.wgsl — a fractal circle-packing
// gasket via iq-style fold + circle inversion. The cleanest port yet: the
// original operates on a flat 2D plane (dir.xz from the dome ray), not a
// raymarched volume, so it maps onto our uv-based fragment shader with zero
// camera work at all — just scale uv and iterate.
// Same change as Mandelbulb: the original's hardcoded "bass nudges k" is
// dropped in favor of letting `kBase` itself take any driver (Bass or
// otherwise) — this app's generic driver system already covers that.
import * as shared from "./glShared.js";

const FS = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uTime;
uniform float uScale;
uniform float uSpeed;
uniform float uIters;
uniform float uKBase;
uniform float uHueA;
uniform float uHueB;
uniform float uSat;
uniform float uLight;
uniform float uGlow;
uniform float uBrightness;

vec3 hsl2rgb(vec3 hsl) {
    float h = hsl.x, s = hsl.y, l = hsl.z;
    vec3 k = mod(vec3(0.0, 8.0, 4.0) + h * 12.0, 12.0);
    float a = s * min(l, 1.0 - l);
    return l - a * clamp(min(k - 3.0, 9.0 - k), -1.0, 1.0);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    float t = uTime * uSpeed;
    vec2 p = uv * uScale;
    float s = 1.0;
    float kk = uKBase + 0.4 * sin(t * 0.5);
    int iters = int(clamp(uIters, 3.0, 12.0));
    for (int i = 0; i < 12; i++) {
        if (i >= iters) break;
        p = -1.0 + 2.0 * fract(0.5 * p + 0.5); // reflect into cell
        float k = kk / dot(p, p);
        p *= k; s *= k; // circle inversion
    }
    float d = abs(p.y) / s; // gasket distance (circle rims)
    float v = exp(-d * 70.0);

    vec3 colorA = hsl2rgb(vec3(uHueA / 360.0, uSat / 100.0, uLight / 100.0));
    vec3 colorB = hsl2rgb(vec3(uHueB / 360.0, uSat / 100.0, uLight / 100.0));
    vec3 col = mix(colorA, colorB, fract(log(s) * 0.25 + t * 0.05)) * (0.2 + v * (0.8 + uGlow)) * uBrightness;
    outColor = vec4(col, clamp(0.2 + v, 0.0, 1.0));
}`;

const NAME = "apollonian";
const UNIFORMS = ["uRes", "uTime", "uScale", "uSpeed", "uIters", "uKBase", "uHueA", "uHueB", "uSat", "uLight", "uGlow", "uBrightness"];

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
        gl.uniform1f(u.get("uSpeed"), p.speed);
        gl.uniform1f(u.get("uIters"), p.iters);
        gl.uniform1f(u.get("uKBase"), p.kBase);
        gl.uniform1f(u.get("uHueA"), p.hueA);
        gl.uniform1f(u.get("uHueB"), p.hueB);
        gl.uniform1f(u.get("uSat"), p.sat);
        gl.uniform1f(u.get("uLight"), p.light);
        gl.uniform1f(u.get("uGlow"), p.glow);
        gl.uniform1f(u.get("uBrightness"), p.brightness);
    });
}
