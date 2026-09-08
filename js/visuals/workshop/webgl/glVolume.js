// ── WebGL2 raymarched volume ─────────────────────────────────────────────
// A small raymarched SDF scene (metaball blobs, smooth-union'd, lit +
// shaded) — registered as a program on the shared WebGL2 context (glShared.js)
// rather than owning a context of its own, so it composes with other
// shader-based layers instead of burning one of the ~16 contexts a page gets.
import * as shared from "./glShared.js";

const FS = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uTime;
uniform float uSpin;
uniform float uSmoothK;
uniform float uDist;
uniform vec3 uHsl; // hue(0-360), sat(0-1), light(0-1)

float sphere(vec3 p, vec3 c, float r) { return length(p - c) - r; }

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

float map(vec3 p) {
    float t = uTime * uSpin;
    vec3 c0 = vec3(sin(t) * 0.9, cos(t * 1.3) * 0.6, 0.0);
    vec3 c1 = vec3(cos(t * 0.7) * 0.7, sin(t * 1.6) * 0.7, sin(t) * 0.4);
    vec3 c2 = vec3(sin(t * 1.9) * 0.5, cos(t * 0.5) * 0.5, cos(t * 1.1) * 0.5);
    float d = sphere(p, c0, 0.6);
    d = smin(d, sphere(p, c1, 0.5), uSmoothK);
    d = smin(d, sphere(p, c2, 0.45), uSmoothK);
    return d;
}

vec3 normalAt(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    ));
}

vec3 hsl2rgb(vec3 hsl) {
    float h = hsl.x / 360.0, s = hsl.y, l = hsl.z;
    vec3 k = mod(vec3(0.0, 8.0, 4.0) + h * 12.0, 12.0);
    float a = s * min(l, 1.0 - l);
    return l - a * clamp(min(k - 3.0, 9.0 - k), -1.0, 1.0);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    vec3 ro = vec3(0.0, 0.0, uDist);
    vec3 rd = normalize(vec3(uv, -1.2));

    float dist = 0.0;
    vec3 p = ro;
    bool hit = false;
    for (int i = 0; i < 80; i++) {
        p = ro + rd * dist;
        float d = map(p);
        if (d < 0.001) { hit = true; break; }
        dist += d;
        if (dist > 8.0) break;
    }

    if (!hit) { outColor = vec4(0.0, 0.0, 0.0, 0.0); return; }

    vec3 n = normalAt(p);
    vec3 lightDir = normalize(vec3(0.6, 0.8, 0.6));
    float diff = max(dot(n, lightDir), 0.0);
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.5);
    vec3 base = hsl2rgb(uHsl);
    vec3 col = base * (0.25 + diff * 0.85) + rim * 0.4;
    outColor = vec4(col, 1.0);
}`;

const NAME = "volume";
const UNIFORMS = ["uRes", "uTime", "uSpin", "uSmoothK", "uDist", "uHsl"];

// Cached — the layer's draw() calls this every frame it's active, but
// whether WebGL2/this program are available can't change mid-session, so
// there's no reason to redo the Map lookup and support check each time.
let cached = null;
export function supported() {
    if (cached !== null) return cached;
    cached = shared.supported();
    if (cached) shared.registerProgram(NAME, FS, UNIFORMS);
    return cached;
}

// Renders one frame and returns the shared canvas (draw it with
// ctx.drawImage immediately — the next shader-based layer to render this
// frame reuses the same canvas).
export function render(w, h, p, t) {
    return shared.render(NAME, w, h, (gl, u) => {
        gl.uniform2f(u.get("uRes"), w, h);
        gl.uniform1f(u.get("uTime"), t);
        gl.uniform1f(u.get("uSpin"), p.spin);
        gl.uniform1f(u.get("uSmoothK"), p.smoothK);
        gl.uniform1f(u.get("uDist"), p.dist);
        gl.uniform3f(u.get("uHsl"), p.hue, p.sat / 100, p.light / 100);
    });
}
