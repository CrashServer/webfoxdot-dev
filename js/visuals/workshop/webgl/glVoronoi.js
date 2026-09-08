// ── WebGL2 Voronoi ────────────────────────────────────────────────────────
// Ported from web/shaders/layer_voronoi.wgsl — animated cellular/crystalline
// pattern. The original samples a 3D voronoi field along the dome's fisheye
// direction; here it's sampled on flat screen uv (2D voronoi, drifting on
// the clock) — same simplification every flat-camera port in this app makes.
// Hardcoded "audio reacts brightness" dropped in favor of assignable drivers.
import * as shared from "./glShared.js";

const FS = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uTime;
uniform float uScale;
uniform float uSpeed;
uniform float uEdge;
uniform float uContrast;
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

vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453) ;
}

// Returns (F1, F2) — nearest & 2nd-nearest feature-point distances.
vec2 vcell(vec2 p, float t) {
    vec2 g = floor(p), f = fract(p);
    float f1 = 8.0, f2 = 8.0;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 o = vec2(float(i), float(j));
            vec2 rnd = hash2(g + o);
            vec2 pt = o + 0.5 + 0.5 * sin(t + 6.2831 * rnd) - f;
            float d = dot(pt, pt);
            if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
        }
    }
    return vec2(sqrt(f1), sqrt(f2));
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    float t = uTime * uSpeed;
    vec2 p = uv * max(uScale, 0.1) * 4.0;
    vec2 c = vcell(p, t);
    float edge = smoothstep(0.0, max(uEdge, 0.01), c.y - c.x);
    float cellv = pow(clamp(c.x, 0.0, 1.0), max(uContrast, 0.1));

    vec3 colorA = hsl2rgb(vec3(uHueA / 360.0, uSat / 100.0, uLight / 100.0));
    vec3 colorB = hsl2rgb(vec3(uHueB / 360.0, uSat / 100.0, uLight / 100.0));
    vec3 col = mix(colorA, colorB, cellv) * uBrightness;
    col += colorB * (1.0 - edge) * uGlow;
    outColor = vec4(col, 1.0);
}`;

const NAME = "voronoi";
const UNIFORMS = ["uRes", "uTime", "uScale", "uSpeed", "uEdge", "uContrast", "uHueA", "uHueB", "uSat", "uLight", "uGlow", "uBrightness"];

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
        gl.uniform1f(u.get("uEdge"), p.edge);
        gl.uniform1f(u.get("uContrast"), p.contrast);
        gl.uniform1f(u.get("uHueA"), p.hueA);
        gl.uniform1f(u.get("uHueB"), p.hueB);
        gl.uniform1f(u.get("uSat"), p.sat);
        gl.uniform1f(u.get("uLight"), p.light);
        gl.uniform1f(u.get("uGlow"), p.glow);
        gl.uniform1f(u.get("uBrightness"), p.brightness);
    });
}
