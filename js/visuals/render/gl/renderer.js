// renderer.js — the WebGL2 backend. THE quality + performance win: every scene's field
// is evaluated per-pixel on the GPU at native resolution (the old CPU path sampled a
// ~1/9-res grid and upscaled → blurry, and melted phones). One static program holds all
// 31 scene functions + a uniform-driven dispatch, so live-coding never triggers a shader
// recompile — layers, params, palette, crossfader and post-fx are ALL uniforms.
//
// Pipeline per frame:
//   scene program → offscreen FBO (with feedback read of last frame = trails)
//   present program → screen (applies glitch/scan/vignette/invert on the way out)
// Two FBO textures ping-pong so this frame can read last frame. clear() wipes both.
//
// createGLRenderer(canvas) → a renderer, or null if WebGL2 is unavailable (caller then
// keeps the CPU compositor). It mirrors compositor.js's math exactly (field-MAX per deck,
// colourise once, value-space crossfade) so switching backends never changes the look.

import { SCENE_GLSL, SCENE_GLSL_ORDER } from './scenes-glsl.js';
import { PALETTE_NAMES, paletteLut } from '../../vdata.js';

const MAXL = 12;                                  // hard cap on simultaneous layers
const NPAL = PALETTE_NAMES.length;
const PAL_IDX = new Map(PALETTE_NAMES.map((n, i) => [n, i]));
const ICE = PAL_IDX.has('ice') ? PAL_IDX.get('ice') : 0;   // palette default (matches palette.js)
const SID = new Map(SCENE_GLSL_ORDER.map((n, i) => [n, i]));

const num = (x, d) => { const n = Number(x); return (x == null || Number.isNaN(n)) ? d : n; };
const cl01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
// palette by NAME ("cyber") or by integer INDEX (8 → wraps) — so pal can be pattern-driven
function paletteIndex(v) {
    if (v == null) return ICE;
    if (typeof v === 'number' && isFinite(v)) return (((Math.round(v) % NPAL) + NPAL) % NPAL);
    return PAL_IDX.has(String(v)) ? PAL_IDX.get(String(v)) : ICE;
}

// ── shared GLSL prelude (the scene bodies assume these) ──────────────────────
const PRELUDE = `#version 300 es
precision highp float;
#define PI 3.141592653589793
float hash1(float n){ return fract(sin(n)*43758.5453123); }
float hash2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
`;

// A fullscreen triangle from gl_VertexID — no vertex buffers needed.
const VERT = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }
`;

// ── the scene / compositor fragment program ──────────────────────────────────
function sceneFrag() {
    const bodies = SCENE_GLSL_ORDER.map((n) => SCENE_GLSL[n]).join('\n');
    let dispatch = 'float sceneEval(int id, vec2 uv, float t, float sp, float sc, vec4 a){\n';
    SCENE_GLSL_ORDER.forEach((n, i) => { dispatch += `  ${i ? 'else ' : ''}if(id==${i}) return scene_${n}(uv,t,sp,sc,a);\n`; });
    dispatch += '  return 0.0;\n}\n';

    return PRELUDE + bodies + '\n' + dispatch + `
uniform vec2  uRes;
uniform float uTime;
uniform vec4  uAud;              // bass, mid, treble, level
uniform sampler2D uPal;         // palette LUT (256 x NPAL)
uniform float uNPal;
uniform sampler2D uPrev;        // last frame (feedback)
uniform float uTrails;          // 0 = clear each frame, →1 = long trails
uniform float uFeedback;        // zooming echo of the last frame (infinite-tunnel feedback)
uniform float uMix;             // crossfader 0..1
uniform int   uBlend;           // blend index 0..6
uniform int   uN;               // active layer count
uniform vec4  uL0[${MAXL}];     // sceneId, speed, scale, deck
uniform vec4  uL1[${MAXL}];     // zoom, rot, panx, pany
uniform vec4  uL2[${MAXL}];     // bright, gain, contrast, inv
uniform vec2  uPalA;            // palIndexA, hueA
uniform vec2  uPalB;            // palIndexB, hueB
out vec4 fragColor;

vec3 palSample(float palIdx, float v, float hue){
    float x = fract(clamp(v,0.0,0.999999) + hue);   // cap below 1.0 so peak value hits the ramp TOP, not fract(1)=0 (black)
    float y = (palIdx + 0.5) / uNPal;
    return texture(uPal, vec2(x, y)).rgb;
}

// one layer: transform coords (zoom·rot·pan), run the field, transform the value
float layerVal(int i, vec2 uv, float t, vec4 a){
    vec4 L0 = uL0[i], L1 = uL1[i], L2 = uL2[i];
    float iz = L1.x == 0.0 ? 1.0 : 1.0 / L1.x;         // 1/zoom
    vec2 d = (uv - 0.5) * iz;
    if (L1.y != 0.0){ float c = cos(L1.y), s = sin(L1.y); d = vec2(d.x*c - d.y*s, d.x*s + d.y*c); }
    vec2 p = d + 0.5 - L1.zw;                          // pan
    float f = sceneEval(int(L0.x + 0.5), p, t, L0.y, L0.z, a);
    f = f * L2.x * L2.y;                               // bright * gain
    if (L2.z != 0.0) f = 0.5 + (f - 0.5) * (1.0 + L2.z);   // contrast
    if (L2.w > 0.5) f = 1.0 - f;                       // invert
    return clamp(f, 0.0, 1.0);
}

// deck A ↔ deck B crossfade — mirrors blends.js exactly, in 0..1 colour space
vec3 blendCol(float av, float bv, vec3 ca, vec3 cb, float x, vec2 uv){
    if (uBlend == 1) return clamp(ca + cb*x, 0.0, 1.0);                    // add
    if (uBlend == 2) return 1.0 - (1.0 - ca) * (1.0 - cb*x);              // screen
    if (uBlend == 3) return ca * (1.0 - x + x*cb);                        // multiply
    if (uBlend == 4) return abs(ca - cb*x);                              // difference
    if (uBlend == 5) return uv.x < x ? cb : ca;                          // wipe
    if (uBlend == 6) return hash2(vec2(uv.x*97.0, uv.y*61.0)) < x ? cb : ca; // dissolve
    return mix(ca, cb, x);                                               // 0 = classic mix
}

void main(){
    vec2 uv = vec2(gl_FragCoord.x/uRes.x, 1.0 - gl_FragCoord.y/uRes.y);   // v down (matches CPU scenes)
    float av = 0.0, bv = 0.0;
    for (int i = 0; i < ${MAXL}; i++){
        if (i >= uN) break;
        float f = layerVal(i, uv, uTime, uAud);
        if (uL0[i].w < 0.5) av = max(av, f); else bv = max(bv, f);
    }
    vec3 ca = palSample(uPalA.x, av, uPalA.y);
    vec3 cb = palSample(uPalB.x, bv, uPalB.y);
    vec3 col = blendCol(av, bv, ca, cb, uMix, uv);
    vec2 tc = gl_FragCoord.xy / uRes;
    col = max(col, texture(uPrev, tc).rgb * uTrails);            // trails = static feedback
    if (uFeedback > 0.001){                                      // feedback = zooming echo
        vec2 z = (tc - 0.5) * (1.0 - 0.035) + 0.5;
        col = max(col, texture(uPrev, z).rgb * uFeedback);
    }
    fragColor = vec4(col, 1.0);
}
`;
}

// ── present program: FBO texture → screen, with post-fx ──────────────────────
const PRESENT_FRAG = PRELUDE + `
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uTime, uGlitch, uScan, uVignette, uInvert, uBlur, uBloom, uPosterize;
uniform float uDroste, uFold, uHue, uDither, uPixelsort, uMirror;
out vec4 fragColor;

float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }

// 3×3 tap average around uv, step in pixels — the kernel for blur + bloom.
vec3 box9(vec2 uv, vec2 px){
    vec3 s = vec3(0.0);
    for (int y = -1; y <= 1; y++)
        for (int x = -1; x <= 1; x++)
            s += texture(uTex, uv + vec2(float(x), float(y)) * px).rgb;
    return s / 9.0;
}
// Bayer 4×4 ordered-dither threshold at a pixel, 0..1 (adapted from fxl_dither.wgsl).
float bayer4(vec2 fc){
    int x = int(mod(fc.x, 4.0)), y = int(mod(fc.y, 4.0));
    int i = y * 4 + x;
    float m = i==0?0.0:i==1?8.0:i==2?2.0:i==3?10.0:i==4?12.0:i==5?4.0:i==6?14.0:i==7?6.0:
              i==8?3.0:i==9?11.0:i==10?1.0:i==11?9.0:i==12?15.0:i==13?7.0:i==14?13.0:5.0;
    return m / 16.0;
}

void main(){
    vec2 uv = gl_FragCoord.xy / uRes;
    if (uGlitch > 0.01){                               // shift random horizontal bands
        float band = floor(uv.y * 48.0);
        float h = hash1(band + floor(uTime * 14.0));
        if (h > 0.72) uv.x = fract(uv.x + (h - 0.86) * uGlitch * 0.5);
    }
    vec3 c = texture(uTex, uv).rgb;
    if (uDroste > 0.001){                              // recursive log-spiral zoom (fxl_droste)
        vec2 p = uv - 0.5; float r = length(p) + 1e-5, ang = atan(p.y, p.x);
        float period = log(2.0);
        float lr = log(r) - uTime * 0.1; lr = lr - period * floor(lr / period);
        float a2 = ang + uDroste * 3.14159 * (lr / period) + uTime * 0.2;
        vec2 np = vec2(cos(a2), sin(a2)) * exp(lr) + 0.5;
        c = mix(c, texture(uTex, fract(np)).rgb, clamp(uDroste, 0.0, 1.0));
    }
    if (uFold > 0.001){                                // kaleidoscope mirror-fold (fxl_fold)
        vec2 q = abs(uv - 0.5) / (1.0 - uFold * 0.45) + 0.5;
        c = mix(c, texture(uTex, clamp(q, 0.0, 1.0)).rgb, clamp(uFold, 0.0, 1.0));
    }
    if (uMirror > 0.001){                              // N-way radial kaleidoscope (fxl_mirror)
        vec2 q = uv - 0.5; float rad = length(q);
        float wedge = 6.2831853 / 6.0;                 // 6 segments
        float ang = atan(q.y, q.x);
        ang = abs(ang - wedge * floor((ang + wedge * 0.5) / wedge));
        vec2 mq = vec2(cos(ang), sin(ang)) * rad + 0.5;
        c = mix(c, texture(uTex, clamp(mq, 0.0, 1.0)).rgb, clamp(uMirror, 0.0, 1.0));
    }
    if (uPixelsort > 0.001){                           // bright-run streak = pixel-sort glitch (fxl_pixelsort)
        float thr = 0.35; int maxLen = int(4.0 + uPixelsort * 60.0);
        vec3 found = c;
        if (luma(c) > thr){
            for (int k = 0; k < 64; k++){ if (k >= maxLen) break;
                float nx = uv.x - float(k + 1) / uRes.x; if (nx < 0.0) break;
                vec3 sc2 = texture(uTex, vec2(nx, uv.y)).rgb;
                found = sc2; if (luma(sc2) <= thr) break;
            }
        }
        c = mix(c, found, clamp(uPixelsort, 0.0, 1.0));
    }
    if (uBlur > 0.001){                                // box blur, radius scales with amount
        vec2 px = (1.0 + uBlur * 6.0) / uRes;
        c = mix(c, box9(uv, px), clamp(uBlur, 0.0, 1.0));
    }
    if (uBloom > 0.001){                               // bright-pass, blurred, added back = glow
        vec2 px = (2.0 + uBloom * 5.0) / uRes;
        vec3 b = max(box9(uv, px) - 0.55, 0.0);
        c += b * uBloom * 2.2;
    }
    if (uInvert > 0.5) c = 1.0 - c;
    if (abs(uHue) > 0.001){                            // hue rotation in turns (fxl_hueshift)
        vec3 k = vec3(0.57735027); float a = uHue * 6.28318, ca = cos(a), sa = sin(a);
        c = max(c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca), 0.0);
    }
    if (uPosterize > 1.5){                             // quantise to N levels (N = amount)
        float n = floor(uPosterize);
        c = floor(c * n) / max(1.0, n - 1.0);
    }
    if (uDither > 0.001){                              // Bayer ordered dither → data/ikeda quantise
        float lv = mix(8.0, 2.0, clamp(uDither, 0.0, 1.0));
        c = floor(c * lv + (bayer4(gl_FragCoord.xy) - 0.5)) / max(1.0, lv - 1.0);
    }
    if (uScan > 0.01){                                 // CRT scanlines
        float s = 0.5 + 0.5 * sin(gl_FragCoord.y * PI);
        c *= 1.0 - uScan * 0.6 * s;
    }
    if (uVignette > 0.01){
        float d = length(uv - 0.5);
        c *= 1.0 - uVignette * smoothstep(0.35, 0.85, d);
    }
    fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh);
        console.error('visuals GL: shader compile failed —', log);
        gl.deleteShader(sh); throw new Error('shader compile: ' + log);
    }
    return sh;
}
function program(gl, vsrc, fsrc) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vsrc));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fsrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    return p;
}

export function createGLRenderer(canvas) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: false });
    if (!gl) return null;

    let sceneProg, presentProg;
    try { sceneProg = program(gl, VERT, sceneFrag()); presentProg = program(gl, VERT, PRESENT_FRAG); }
    catch (e) { console.error('visuals GL: init failed —', e.message); return null; }

    const vao = gl.createVertexArray();                // empty VAO (fullscreen tri needs no attribs)
    const dpr = Math.min(2, (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) || 1);
    let userScale = null;                              // vres() override (backing px per CSS px); null → dpr

    // uniform locations — scene program
    const uLoc = {};
    for (const n of ['uRes', 'uTime', 'uAud', 'uPal', 'uNPal', 'uPrev', 'uTrails', 'uFeedback', 'uMix', 'uBlend',
        'uN', 'uL0', 'uL1', 'uL2', 'uPalA', 'uPalB']) uLoc[n] = gl.getUniformLocation(sceneProg, n);
    const pLoc = {};
    for (const n of ['uTex', 'uRes', 'uTime', 'uGlitch', 'uScan', 'uVignette', 'uInvert', 'uBlur', 'uBloom', 'uPosterize',
        'uDroste', 'uFold', 'uHue', 'uDither', 'uPixelsort', 'uMirror']) pLoc[n] = gl.getUniformLocation(presentProg, n);

    // palette LUT texture (256 × NPAL): all palettes baked once, linear-sampled in x
    const palTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, palTex);
    const pd = new Uint8Array(256 * NPAL * 4);
    PALETTE_NAMES.forEach((name, row) => {
        const lut = paletteLut(name);
        for (let i = 0; i < 256; i++) { const c = lut[i]; const o = (row * 256 + i) * 4; pd[o] = c[0]; pd[o + 1] = c[1]; pd[o + 2] = c[2]; pd[o + 3] = 255; }
    });
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, NPAL, 0, gl.RGBA, gl.UNSIGNED_BYTE, pd);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // ping-pong FBOs for feedback (this-frame reads last-frame)
    let W = 0, H = 0, fb = [null, null], tex = [null, null], cur = 0, needClear = true;
    function makeTarget(i) {
        const tx = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tx);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const f = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tx, 0);
        tex[i] = tx; fb[i] = f;
    }
    function resize() {
        const scale = userScale || dpr;
        const w = Math.max(1, Math.round((canvas.clientWidth || innerWidth) * scale));
        const h = Math.max(1, Math.round((canvas.clientHeight || innerHeight) * scale));
        if (w === W && h === H) return;
        W = w; H = h; canvas.width = W; canvas.height = H;
        for (const t of tex) if (t) gl.deleteTexture(t);
        for (const f of fb) if (f) gl.deleteFramebuffer(f);
        makeTarget(0); makeTarget(1); needClear = true;
    }
    resize();

    // vres(scale): render-scale override in backing px per CSS px (clamped). null → dpr default.
    function setResolution(s) {
        const v = Number(s);
        const next = (s == null || !isFinite(v) || v <= 0) ? null : Math.max(0.25, Math.min(2, v));
        if (next === userScale) return;
        userScale = next; W = H = 0; resize();          // force a rebuild at the new scale
    }

    // reusable uniform scratch
    const L0 = new Float32Array(MAXL * 4), L1 = new Float32Array(MAXL * 4), L2 = new Float32Array(MAXL * 4);

    // build one deck's per-layer uniform rows + its palette/hue (last layer on the deck wins)
    function pack(layers, base, count, globalPal) {
        let pal = globalPal, hue = 0, n = count;
        for (const l of layers) {
            if (n >= MAXL) break;
            const id = SID.get(l.scene); if (id == null) continue;
            const p = l.params || {};
            const o = n * 4;
            L0[o] = id; L0[o + 1] = num(p.speed, 1); L0[o + 2] = num(p.scale, 1); L0[o + 3] = base;
            L1[o] = num(p.zoom, 1); L1[o + 1] = num(p.rot, 0); L1[o + 2] = num(p.panx, 0); L1[o + 3] = num(p.pany, 0);
            L2[o] = num(p.bright, 1); L2[o + 1] = num(p.gain, 1); L2[o + 2] = num(p.contrast, 0); L2[o + 3] = (p.inv === true || p.inv === 1) ? 1 : 0;
            if (p.pal != null) pal = p.pal;                 // name or index, resolved below
            if (p.hue != null) hue = num(p.hue, 0);
            n++;
        }
        return { count: n, palIdx: paletteIndex(pal), hue };
    }

    function render(vstate, tSec, aud, fx) {
        resize();
        const layers = (vstate.layers || []);
        const A = layers.filter((l) => l.ch !== 1);
        const B = layers.filter((l) => l.ch === 1);
        const gpal = vstate.palette;
        const da = pack(A, 0, 0, gpal);
        const db = pack(B, 1, da.count, gpal);
        const n = db.count;

        let x = vstate.mix ? vstate.mix.value : (B.length && !A.length ? 1 : 0);
        x = cl01(x);
        const blend = vstate.mix ? (vstate.mix.blend | 0) : 0;
        const trails = Math.max(0, Math.min(0.995, num(fx.trails, 0)));
        const feedback = Math.max(0, Math.min(0.995, num(fx.feedback, 0)));

        const src = cur, dst = 1 - cur;                // read src (last frame), write dst
        gl.bindVertexArray(vao);

        // ── pass 1: scene + feedback → dst FBO ──
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb[dst]);
        gl.viewport(0, 0, W, H);
        if (needClear) { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); gl.bindFramebuffer(gl.FRAMEBUFFER, fb[src]); gl.clear(gl.COLOR_BUFFER_BIT); gl.bindFramebuffer(gl.FRAMEBUFFER, fb[dst]); needClear = false; }
        gl.useProgram(sceneProg);
        gl.uniform2f(uLoc.uRes, W, H);
        gl.uniform1f(uLoc.uTime, tSec);
        gl.uniform4f(uLoc.uAud, aud.bass || 0, aud.mid || 0, aud.treble || 0, aud.level || 0);
        gl.uniform1f(uLoc.uNPal, NPAL);
        gl.uniform1f(uLoc.uTrails, trails);
        gl.uniform1f(uLoc.uFeedback, feedback);
        gl.uniform1f(uLoc.uMix, x);
        gl.uniform1i(uLoc.uBlend, blend);
        gl.uniform1i(uLoc.uN, n);
        gl.uniform4fv(uLoc.uL0, L0); gl.uniform4fv(uLoc.uL1, L1); gl.uniform4fv(uLoc.uL2, L2);
        gl.uniform2f(uLoc.uPalA, da.palIdx, da.hue);
        gl.uniform2f(uLoc.uPalB, db.palIdx, db.hue);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, palTex); gl.uniform1i(uLoc.uPal, 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex[src]); gl.uniform1i(uLoc.uPrev, 1);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        // ── pass 2: present dst → screen + post-fx ──
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, W, H);
        gl.useProgram(presentProg);
        gl.uniform2f(pLoc.uRes, W, H);
        gl.uniform1f(pLoc.uTime, tSec);
        gl.uniform1f(pLoc.uGlitch, num(fx.glitch, 0));
        gl.uniform1f(pLoc.uScan, num(fx.scan, 0));
        gl.uniform1f(pLoc.uVignette, num(fx.vignette, 0));
        gl.uniform1f(pLoc.uInvert, fx.invert ? 1 : 0);
        gl.uniform1f(pLoc.uBlur, num(fx.blur, 0));
        gl.uniform1f(pLoc.uBloom, num(fx.bloom, 0));
        gl.uniform1f(pLoc.uPosterize, num(fx.posterize, 0));
        gl.uniform1f(pLoc.uDroste, num(fx.droste, 0));
        gl.uniform1f(pLoc.uFold, num(fx.fold, 0));
        gl.uniform1f(pLoc.uHue, num(fx.hueshift, 0));
        gl.uniform1f(pLoc.uDither, num(fx.dither, 0));
        gl.uniform1f(pLoc.uPixelsort, num(fx.pixelsort, 0));
        gl.uniform1f(pLoc.uMirror, num(fx.mirror, 0));
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[dst]); gl.uniform1i(pLoc.uTex, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        cur = dst;                                     // dst becomes next frame's src
    }

    function clear() { needClear = true; }             // wipe the feedback buffers (clear() reset)

    return { render, resize, clear, setResolution, gl, get size() { return { W, H }; } };
}
