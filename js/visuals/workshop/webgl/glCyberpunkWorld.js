// ── WebGL2 Cyberpunk World ────────────────────────────────────────────────────
// Raymarched industrial/cyberpunk tunnel: arched concrete corridor, cable
// bundles, neon floor channel, amber hub rings, warm ceiling lights, fog.
// Camera flies forward. Audio-reactive: bass pulses floor + hubs, treble
// brightens ceiling lights.
//
// Fix notes vs prior version:
//   • Arch SDF changed to circle centred at (0,0) radius 2.8 — avoids the
//     corner regions where the old (0,1.5) arc dipped below the floor and
//     produced negative SDF values that sent the marcher backward.
//   • Step formula clamped to max(..., 0.01) — never negative.
//   • Ambient lifted to 0.18 and a back-key light added so concrete is visible.
//   • Metallic wall ribs every hubSpacing units give the marcher Z-targets.
//   • Hub torus moved to XY plane (ring faces camera) for a proper cross-section.
import * as shared from "./glShared.js";

const FS = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2  uRes;
uniform float uTime;
uniform float uCamSpeed;
uniform float uCamSway;
uniform float uFov;
uniform float uFogDensity;
uniform float uChannelHue;
uniform float uChannelBrightness;
uniform float uLightSpacing;
uniform float uHubSpacing;
uniform float uHubGlow;
uniform float uCableSway;
uniform float uBrightness;
uniform float uContrast;
uniform float uBass;
uniform float uMid;
uniform float uTreble;

// ── Utility ───────────────────────────────────────────────────────────────────

float hash(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
}

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// Torus in XY plane (visible as a ring when looking along Z)
float sdTorusXY(vec3 p, float R, float r) {
    vec2 q = vec2(length(p.xy) - R, p.z);
    return length(q) - r;
}

vec3 hsl2rgb(float h, float s, float l) {
    h = mod(h, 360.0) / 360.0;
    float a = s * min(l, 1.0 - l);
    vec3 k  = mod(vec3(0.0, 8.0, 4.0) + h * 12.0, 12.0);
    return l - a * clamp(min(k - 3.0, 9.0 - k), -1.0, 1.0);
}

// ── Scene SDF ─────────────────────────────────────────────────────────────────
// Material IDs:
//   1 = concrete   2 = cable   3 = channel (emissive)
//   4 = hub ring   5 = ceiling light   6 = wall rib (metal)

const float ARCH_R  = 2.8;   // arch radius (centre at origin)
const float FLOOR_Y = -1.5;  // floor height

vec2 map(vec3 pos) {
    // ── Arch tunnel (half-cylinder) ───────────────────────────────────────
    // Circle centred at (0,0,z) with radius ARCH_R; floor closes the bottom.
    // dArch  > 0 inside the circle, → 0 as you approach the wall.
    // dFloor > 0 above the floor,   → 0 as you approach the floor.
    // Both are >= 0 inside the corridor, so dTunnel is always >= 0. ✓
    float dArch   = ARCH_R - length(pos.xy);
    float dFloor  = pos.y - FLOOR_Y;
    float dTunnel = min(dArch, dFloor);
    vec2  res     = vec2(dTunnel, 1.0);   // concrete

    // ── Wall ribs (metallic strips every hubSpacing along Z) ─────────────
    // These give the sphere-marcher a Z-varying target so it converges while
    // looking straight down the tunnel rather than marching to max distance.
    float ribPeriod = max(uHubSpacing, 2.0);
    float ribZ = mod(pos.z + ribPeriod * 0.5, ribPeriod) - ribPeriod * 0.5;
    // Left and right ribs on the arch wall
    vec3  lRib = vec3(pos.x + 2.3, pos.y - 0.25, ribZ);
    vec3  rRib = vec3(pos.x - 2.3, pos.y - 0.25, ribZ);
    float dRib = min(sdBox(lRib, vec3(0.08, 2.2, 0.12)),
                     sdBox(rRib, vec3(0.08, 2.2, 0.12)));
    if (dRib < res.x) res = vec2(dRib, 6.0);

    // ── Floor channel (emissive strip on floor centreline) ────────────────
    float dChY = abs(pos.y - (FLOOR_Y + 0.08)) - 0.06;
    float dChX = abs(pos.x) - 0.22;
    float dCh  = max(dChY, dChX);
    if (dCh < res.x) res = vec2(dCh, 3.0);

    // ── Hub connectors (ring in XY plane, repeated in Z) ─────────────────
    float hs  = max(uHubSpacing, 2.0);
    float hbZ = mod(pos.z + hs * 0.5, hs) - hs * 0.5;
    float dHub = sdTorusXY(vec3(pos.x, pos.y - 0.25, hbZ), 1.5, 0.14);
    if (dHub < res.x) res = vec2(dHub, 4.0);

    // ── Ceiling strip lights (small boxes, repeated in Z) ─────────────────
    float ls  = max(uLightSpacing, 1.0);
    float lzR = mod(pos.z + ls * 0.5, ls) - ls * 0.5;
    float dLtL = sdBox(vec3(pos.x + 1.8, pos.y - 2.5, lzR), vec3(0.06, 0.05, 0.45));
    float dLtR = sdBox(vec3(pos.x - 1.8, pos.y - 2.5, lzR), vec3(0.06, 0.05, 0.45));
    float dLt  = min(dLtL, dLtR);
    if (dLt < res.x) res = vec2(dLt, 5.0);

    // ── Cables (6 × infinite cylinders with Z-sag) ────────────────────────
    float sway = uCableSway * (1.0 + uMid * 0.5);
    const int NC = 6;
    float cxArr[6];
    cxArr[0] = -1.9; cxArr[1] = -1.1; cxArr[2] = -0.35;
    cxArr[3] =  0.35; cxArr[4] =  1.1; cxArr[5] =  1.9;
    for (int i = 0; i < NC; i++) {
        float cx = cxArr[i];
        float cy = 2.3 + 0.12 * sin(pos.z * 0.45 + float(i) * 1.35) * sway;
        float dc = length(vec2(pos.x - cx, pos.y - cy)) - 0.08;
        if (dc < res.x) res = vec2(dc, 2.0);
    }

    return res;
}

// ── Normal via central differences ───────────────────────────────────────────
vec3 calcNormal(vec3 p) {
    const float e = 0.002;
    return normalize(vec3(
        map(p + vec3(e, 0, 0)).x - map(p - vec3(e, 0, 0)).x,
        map(p + vec3(0, e, 0)).x - map(p - vec3(0, e, 0)).x,
        map(p + vec3(0, 0, e)).x - map(p - vec3(0, 0, e)).x
    ));
}

// ── Shading ───────────────────────────────────────────────────────────────────
vec3 shade(vec3 pos, vec3 nor, float matId, float dist) {
    vec3 chanColor = hsl2rgb(uChannelHue, 0.95, 0.55);

    // Emissive surfaces return immediately
    if (matId > 2.5 && matId < 3.5) {
        float pulse = uChannelBrightness * (1.0 + uBass * 2.5);
        return chanColor * pulse;
    }
    if (matId > 3.5 && matId < 4.5) {
        return vec3(0.95, 0.65, 0.15) * uHubGlow * (1.0 + uBass * 3.0);
    }
    if (matId > 4.5 && matId < 5.5) {
        return vec3(1.0, 0.75, 0.35) * (1.8 + uTreble * 2.0);
    }

    // Base material color
    vec3 col;
    if (matId > 5.5) {
        // Metal rib: dark steel with highlight
        col = vec3(0.10, 0.10, 0.12);
    } else if (matId > 1.5) {
        // Cable: dark rubber
        col = vec3(0.07, 0.06, 0.05);
    } else {
        // Concrete: dark grey with hash texture
        float n  = hash(floor(pos * 6.0)) * 0.04;
        float n2 = hash(floor(pos * 2.0 + 0.9)) * 0.03;
        col = vec3(0.11, 0.09, 0.08) + n + n2;
    }

    // ── Lighting ─────────────────────────────────────────────────────────
    // Bright ambient so concrete is always visible
    vec3 lit = vec3(0.18, 0.14, 0.20) * col;

    // Back-key light (warm, from slightly above+behind camera, typical film rig)
    vec3 keyDir = normalize(vec3(0.25, 0.6, -1.0));
    float keyD  = max(0.0, dot(nor, -keyDir));
    lit += col * vec3(0.45, 0.35, 0.28) * keyD;

    // Channel glow: point-like, below and forward of camera
    vec3  chPos   = vec3(0.0, FLOOR_Y + 0.08, pos.z);
    float chDist  = length(chPos - pos);
    float chAtt   = 1.0 / (1.0 + chDist * chDist * 0.25);
    float chDiff  = max(0.0, dot(nor, normalize(chPos - pos)));
    lit += col * chanColor * chDiff * chAtt * uChannelBrightness * (1.0 + uBass * 2.0) * 0.5;

    // Hub glow: nearest hub ring
    float hubZ0 = floor(pos.z / uHubSpacing + 0.5) * uHubSpacing;
    vec3  hubCtr = vec3(0.0, 0.25, hubZ0);
    float hubD   = length(hubCtr - pos);
    float hubAtt = 1.0 / (1.0 + hubD * hubD * 0.2);
    float hubDif = max(0.0, dot(nor, normalize(hubCtr - pos)));
    lit += col * vec3(0.9, 0.6, 0.15) * hubDif * hubAtt * uHubGlow * (1.0 + uBass * 1.5) * 0.55;

    // Ceiling strip: nearest strip
    float lz0   = floor((pos.z + uLightSpacing * 0.5) / uLightSpacing) * uLightSpacing - uLightSpacing * 0.5;
    vec3  sPos  = vec3(1.8, 2.5, lz0);
    float sDist = length(sPos - pos);
    float sAtt  = 1.0 / (1.0 + sDist * sDist * 0.15);
    float sDif  = max(0.0, dot(nor, normalize(sPos - pos)));
    lit += col * vec3(1.0, 0.75, 0.35) * sDif * sAtt * (1.0 + uTreble * 1.5) * 0.5;

    return lit;
}

// ── Main ──────────────────────────────────────────────────────────────────────
void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;

    float t      = uTime;
    float camZ   = t * uCamSpeed;
    float swayX  = uCamSway * sin(t * 0.31);
    float swayY  = uCamSway * 0.55 * sin(t * 0.21);
    vec3  camPos = vec3(swayX, swayY, camZ);

    vec3 lookAt  = camPos + vec3(swayX * 0.04, swayY * 0.04, 1.0);
    vec3 forward = normalize(lookAt - camPos);
    vec3 right   = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up      = cross(right, forward);

    float fovRad = radians(uFov);
    float scale  = tan(fovRad * 0.5);
    vec3  rd     = normalize(uv.x * right * scale + uv.y * up * scale + forward);

    // ── Raymarching ───────────────────────────────────────────────────────
    float tt    = 0.02;
    vec2  hit   = vec2(-1.0);
    bool  didHit = false;

    for (int i = 0; i < 80; i++) {
        vec3 p  = camPos + rd * tt;
        vec2 h  = map(p);
        if (h.x < 0.001) { hit = h; didHit = true; break; }
        // Clamp step to always be positive — prevents marching backward if
        // any SDF value goes slightly negative due to floating-point error.
        tt += max(h.x * 0.8, 0.01);
        if (tt > 30.0) break;
    }

    vec3 fogColor = vec3(0.04, 0.03, 0.07);
    vec3 col;

    if (didHit) {
        vec3 p   = camPos + rd * tt;
        vec3 nor = calcNormal(p);
        col = shade(p, nor, hit.y, tt);

        // Exponential fog
        float fogAmt = 1.0 - exp(-tt * uFogDensity * 0.065);
        col = mix(col, fogColor, clamp(fogAmt, 0.0, 1.0));
    } else {
        col = fogColor;
    }

    // Brightness / contrast + mild vignette
    col  = (col - 0.5) * uContrast + 0.5;
    col *= uBrightness;
    float vig = 1.0 - 0.35 * dot(uv, uv);
    col  = clamp(col * vig, 0.0, 1.0);

    outColor = vec4(col, 1.0);
}`;

const NAME = "cyberpunkworld";
const UNIFORMS = [
    "uRes", "uTime",
    "uCamSpeed", "uCamSway", "uFov", "uFogDensity",
    "uChannelHue", "uChannelBrightness",
    "uLightSpacing", "uHubSpacing", "uHubGlow",
    "uCableSway", "uBrightness", "uContrast",
    "uBass", "uMid", "uTreble",
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
        gl.uniform2f(u.get("uRes"),               w, h);
        gl.uniform1f(u.get("uTime"),              t);
        gl.uniform1f(u.get("uCamSpeed"),          p.camSpeed          ?? 1.5);
        gl.uniform1f(u.get("uCamSway"),           p.camSway           ?? 0.4);
        gl.uniform1f(u.get("uFov"),               p.fov               ?? 80);
        gl.uniform1f(u.get("uFogDensity"),        p.fogDensity        ?? 1.2);
        gl.uniform1f(u.get("uChannelHue"),        p.channelHue        ?? 140);
        gl.uniform1f(u.get("uChannelBrightness"), p.channelBrightness ?? 2.0);
        gl.uniform1f(u.get("uLightSpacing"),      p.lightSpacing      ?? 7);
        gl.uniform1f(u.get("uHubSpacing"),        p.hubSpacing        ?? 15);
        gl.uniform1f(u.get("uHubGlow"),           p.hubGlow           ?? 1.5);
        gl.uniform1f(u.get("uCableSway"),         p.cableSway         ?? 1.0);
        gl.uniform1f(u.get("uBrightness"),        p.brightness        ?? 1.0);
        gl.uniform1f(u.get("uContrast"),          p.contrast          ?? 1.2);
        gl.uniform1f(u.get("uBass"),              p.bass              ?? 0.0);
        gl.uniform1f(u.get("uMid"),               p.mid               ?? 0.0);
        gl.uniform1f(u.get("uTreble"),            p.treble            ?? 0.0);
    });
}
