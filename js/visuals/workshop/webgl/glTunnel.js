// ── WebGL2 Tunnel ─────────────────────────────────────────────────────────
// Ported from web/shaders/layer_tunnel.wgsl — the classic angular-stripe
// wormhole racing toward a vanishing point. The original unwraps the dome's
// fisheye direction into (angle, depth) around the zenith; here the screen
// center stands in for that vanishing point, same polar-unwrap trick as
// glKaliTunnel.js. Hardcoded "bass pumps depth" is dropped in favor of
// letting the user assign any driver to `bassReact` directly.
import * as shared from "./glShared.js";

const FS = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uTime;
uniform float uStripes;
uniform float uSpeed;
uniform float uTwist;
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

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    float rr = max(length(uv), 0.02);
    float phi = atan(uv.y, uv.x);
    float depth = 1.0 / rr;
    float t = uTime * uSpeed;

    float ang = phi + depth * uTwist * 0.1;
    float u = ang / 3.14159265 * uStripes;
    float v = depth * 0.35 + t;
    float ring = 0.5 + 0.5 * sin(v * 6.28318);
    float stripe = 0.5 + 0.5 * sin(u * 6.28318);
    float n = ring * stripe;
    n = n * (0.55 + 0.45 * noise(vec2(u * 0.2, v * 0.25 + t * 0.3)));
    n = pow(clamp(n, 0.0, 1.0), max(uContrast, 0.1));

    vec3 colorA = hsl2rgb(vec3(uHueA / 360.0, uSat / 100.0, uLight / 100.0));
    vec3 colorB = hsl2rgb(vec3(uHueB / 360.0, uSat / 100.0, uLight / 100.0));
    vec3 col = mix(colorA, colorB, n) * uBrightness;
    float core = exp(-rr * 4.0) * uGlow;
    col += colorB * core;
    outColor = vec4(col, clamp(n + core, 0.0, 1.0));
}`;

const NAME = "tunnel";
const UNIFORMS = ["uRes", "uTime", "uStripes", "uSpeed", "uTwist", "uContrast", "uHueA", "uHueB", "uSat", "uLight", "uGlow", "uBrightness"];

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
        gl.uniform1f(u.get("uStripes"), p.stripes);
        gl.uniform1f(u.get("uSpeed"), p.speed);
        gl.uniform1f(u.get("uTwist"), p.twist);
        gl.uniform1f(u.get("uContrast"), p.contrast);
        gl.uniform1f(u.get("uHueA"), p.hueA);
        gl.uniform1f(u.get("uHueB"), p.hueB);
        gl.uniform1f(u.get("uSat"), p.sat);
        gl.uniform1f(u.get("uLight"), p.light);
        gl.uniform1f(u.get("uGlow"), p.glow);
        gl.uniform1f(u.get("uBrightness"), p.brightness);
    });
}
