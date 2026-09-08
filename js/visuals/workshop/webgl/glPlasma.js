// ── WebGL2 plasma ─────────────────────────────────────────────────────────
// Classic shader VJ content: interference of sine waves — the kind of thing
// that's either a per-pixel JS loop (slow) or genuinely nice in a fragment
// shader (fast). Second program on the shared context (glShared.js),
// proving the "one context, many layers" pattern isn't just Volume's.
import * as shared from "./glShared.js";

const FS = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uTime;
uniform float uSpeed;
uniform float uScale;
uniform float uHue;
uniform float uHueSpread;
uniform float uSat;
uniform float uLight;

vec3 hsl2rgb(vec3 hsl) {
    float h = hsl.x, s = hsl.y, l = hsl.z;
    vec3 k = mod(vec3(0.0, 8.0, 4.0) + h * 12.0, 12.0);
    float a = s * min(l, 1.0 - l);
    return l - a * clamp(min(k - 3.0, 9.0 - k), -1.0, 1.0);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    float t = uTime * uSpeed;
    float v = sin(uv.x * uScale + t);
    v += sin(uv.y * uScale - t * 0.7);
    v += sin((uv.x + uv.y) * uScale * 0.7 + t * 1.3);
    v += sin(length(uv) * uScale * 1.4 - t * 1.6);
    v = v * 0.25 + 0.5; // -> 0..1

    float hue = mod(uHue / 360.0 + v * (uHueSpread / 360.0), 1.0);
    vec3 col = hsl2rgb(vec3(hue, uSat / 100.0, (uLight / 100.0) * (0.4 + 0.7 * v)));
    outColor = vec4(col, 1.0);
}`;

const NAME = "plasma";
const UNIFORMS = ["uRes", "uTime", "uSpeed", "uScale", "uHue", "uHueSpread", "uSat", "uLight"];

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
        gl.uniform1f(u.get("uSpeed"), p.speed);
        gl.uniform1f(u.get("uScale"), p.scale);
        gl.uniform1f(u.get("uHue"), p.hue);
        gl.uniform1f(u.get("uHueSpread"), p.hueSpread);
        gl.uniform1f(u.get("uSat"), p.sat);
        gl.uniform1f(u.get("uLight"), p.light);
    });
}
