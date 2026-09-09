// renderer.js — the WebGL2 backend. THE quality + performance win: every scene's field
// is evaluated per-pixel on the GPU at native resolution (the old CPU path sampled a
// ~1/9-res grid and upscaled → blurry, and melted phones). One static program holds all
// 48 scene functions + a uniform-driven dispatch, so live-coding never triggers a shader
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
import { PALETTE_NAMES, paletteLut, SCENE_PARAMS, layerBlendIndex } from '../../vdata.js';

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
    let dispatch = 'float sceneEval(int id, vec2 uv, float t, float sp, float sc, vec4 a, vec4 pp, vec4 pp2){\n';
    SCENE_GLSL_ORDER.forEach((n, i) => { dispatch += `  ${i ? 'else ' : ''}if(id==${i}) return scene_${n}(uv,t,sp,sc,a,pp,pp2);\n`; });
    dispatch += '  return 0.0;\n}\n';

    // uSpec + spec() go BEFORE the scene bodies so FFT scenes (barcode/datamatrix/…) can
    // sample the 32-bin spectrum by u ∈ [0,1].
    const specDecl = `uniform float uSpec[32];
float spec(float u){ int i = int(clamp(u, 0.0, 0.99999) * 32.0); return uSpec[i]; }
`;
    return PRELUDE + specDecl + bodies + '\n' + dispatch + `
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
uniform vec4  uL3[${MAXL}];     // scene-specific params (pp.x..pp.w)
uniform vec4  uL4[${MAXL}];     // extra scene params (pp2.x..pp2.w) — 8 per scene total
uniform vec4  uL5[${MAXL}];     // opacity, blend op, -, -
uniform vec2  uPalA;            // palIndexA, hueA
uniform vec2  uPalB;            // palIndexB, hueB
// Workshop layers are the OTHER kind of scene: imperative RGBA draws that own their
// colour, composited on the CPU into one canvas per deck and handed here as a texture.
// They join the picture at deck level — after the field layers have been coloured by
// the palette, before the A↔B crossfade — so the crossfader, the trails/feedback pass
// and every post-fx apply to them exactly as they do to a field scene.
uniform sampler2D uWsA;
uniform sampler2D uWsB;
uniform vec2  uHasWs;           // x: deck A carries workshop pixels · y: deck B
// ── Deck-to-deck ─────────────────────────────────────────────────────────────
// The mixer has had two decks from the start and the only thing it could do with them
// was crossfade: seven blend modes, all answering "how much of B do I see". These read
// deck B as DATA for deck A instead, which is what turns mix() from a fader into a
// router — and it is nearly free, because both decks are already being evaluated in
// this same fragment.
uniform float uDisplace;        // B's red/green push where A is sampled from
uniform float uLumakey;         // A shows through where B is brighter than this
uniform float uMatte;           // B's luminance as A's alpha, over black
out vec4 fragColor;

float luma3(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }

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
    float f = sceneEval(int(L0.x + 0.5), p, t, L0.y, L0.z, a, uL3[i], uL4[i]);
    f = f * L2.x * L2.y;                               // bright * gain
    if (L2.z != 0.0) f = 0.5 + (f - 0.5) * (1.0 + L2.z);   // contrast
    if (L2.w > 0.5) f = 1.0 - f;                       // invert
    return clamp(f, 0.0, 1.0);
}

// How a layer combines with the ones already on its deck. op 0 = max, which is what
// stacking always did — so a set written before per-layer blend existed is untouched.
float blendVal(int op, float a, float b){
    if (op == 1) return min(1.0, a + b);            // add
    if (op == 2) return a * b;                      // multiply
    if (op == 3) return 1.0 - (1.0 - a) * (1.0 - b);// screen
    if (op == 4) return abs(a - b);                 // difference
    if (op == 5) return b;                          // over — the later layer wins
    return max(a, b);                               // 0 = max
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

// One deck, evaluated at an ARBITRARY uv. Split out of main so deck A can be read
// somewhere other than the fragment it is being drawn to, which is all a displacement
// map is. Same loop as before; the deck argument picks which layers take part.
// (No backticks in this shader source — it is a JS template literal.)
float deckVal(int deck, vec2 uv){
    float v = 0.0;
    for (int i = 0; i < ${MAXL}; i++){
        if (i >= uN) break;
        int d = uL0[i].w < 0.5 ? 0 : 1;
        if (d == deck){
            float f = layerVal(i, uv, uTime, uAud) * uL5[i].x;   // × opacity
            v = blendVal(int(uL5[i].y + 0.5), v, f);
        }
    }
    return v;
}

void main(){
    vec2 uv = vec2(gl_FragCoord.x/uRes.x, 1.0 - gl_FragCoord.y/uRes.y);   // v down (matches CPU scenes)
    // Deck B FIRST: with displace on it is the map deck A is read through, so it has
    // to exist before A is sampled.
    float bv = deckVal(1, uv);
    vec3 cb = palSample(uPalB.x, bv, uPalB.y);
    // Workshop pixels over the field colour, by their own alpha. av/bv are raised too:
    // the crossfade blends in VALUE space as well as colour, so a deck that is entirely
    // workshop would otherwise read as empty and wipe/dissolve would misbehave.
    if (uHasWs.y > 0.5){ vec4 w = texture(uWsB, uv); cb = mix(cb, w.rgb, w.a); bv = max(bv, w.a * luma3(w.rgb)); }

    // Red pushes x and green pushes y — the convention every displacement map uses. It
    // means a COLOURED layer on deck B pushes diagonally while a monochrome one pushes
    // only along the diagonal, which is why the palette on B is worth changing here.
    vec2 auv = uv;
    if (uDisplace > 0.001) auv = clamp(uv + (cb.rg - 0.5) * uDisplace * 0.4, 0.0, 1.0);
    float av = deckVal(0, auv);
    vec3 ca = palSample(uPalA.x, av, uPalA.y);
    if (uHasWs.x > 0.5){ vec4 w = texture(uWsA, auv); ca = mix(ca, w.rgb, w.a); av = max(av, w.a * luma3(w.rgb)); }

    vec3 col = blendCol(av, bv, ca, cb, uMix, uv);
    // Luma key: A shows through where B is brighter than the threshold. Not a fade — a
    // decision per pixel, with a soft edge so it does not alias into a jagged mask.
    if (uLumakey > 0.001){
        float k = smoothstep(uLumakey - 0.12, uLumakey + 0.12, luma3(cb));
        col = mix(cb, ca, k);
    }
    // Matte: B's luminance IS A's alpha, over black. A text or grid layer on deck B
    // becomes a stencil for whatever is on deck A.
    if (uMatte > 0.001) col = mix(col, ca * luma3(cb), clamp(uMatte, 0.0, 1.0));
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
uniform float uDroste, uFold, uHue, uDither, uPixelsort, uMirror, uEdge, uPixelate;
// Master grade + limiter — the workshop's lut.js and limiter.js, as uniforms. It does
// them with a ctx.filter blit and a getImageData loop over the finished frame; here
// they are three multiplies at the end of a pass that is already running, so the
// neutral case costs nothing and the active case costs nothing either.
uniform float uSat, uExposure, uContrast, uCeiling;
// lut — the finished frame's luminance, read through a palette ramp.
// palette() only ever steered FIELD scenes: a workshop layer brings its own colour and
// nothing could recolour it, which left 206 of the 255 scenes outside the palette
// system entirely. This is the way in. 1-based, because 0 has to mean off and palette
// index 0 is a real palette.
uniform sampler2D uPal;
uniform float uNPal, uLut, uLutMix;
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
    if (uPixelate > 0.001){                            // blocky downsample (aspect-square cells)
        float n = mix(180.0, 8.0, clamp(uPixelate, 0.0, 1.0));
        vec2 g = vec2(n, max(1.0, floor(n * uRes.y / uRes.x)));
        uv = (floor(uv * g) + 0.5) / g;
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
    if (uEdge > 0.001){                                // Sobel edge detect on the source luma
        vec2 px = 1.0 / uRes;
        float tl = luma(texture(uTex, uv + vec2(-px.x, -px.y)).rgb);
        float tm = luma(texture(uTex, uv + vec2(0.0,  -px.y)).rgb);
        float tr = luma(texture(uTex, uv + vec2( px.x, -px.y)).rgb);
        float ml = luma(texture(uTex, uv + vec2(-px.x,  0.0)).rgb);
        float mr = luma(texture(uTex, uv + vec2( px.x,  0.0)).rgb);
        float bl = luma(texture(uTex, uv + vec2(-px.x,  px.y)).rgb);
        float bm = luma(texture(uTex, uv + vec2(0.0,   px.y)).rgb);
        float br = luma(texture(uTex, uv + vec2( px.x,  px.y)).rgb);
        float gx = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
        float gy = -tl - 2.0*tm - tr + bl + 2.0*bm + br;
        float e = clamp(sqrt(gx*gx + gy*gy) * 2.2, 0.0, 1.0);
        vec3 ec = mix(vec3(e), c * (0.4 + e), 0.35);    // mostly white outlines, a hint of source hue
        c = mix(c, ec, clamp(uEdge, 0.0, 1.0));         // edge-detection: bright outlines, black flats
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
    // ── master grade, last, over everything ──
    if (uExposure != 1.0) c *= uExposure;
    if (uContrast != 1.0) c = (c - 0.5) * uContrast + 0.5;
    if (uSat != 1.0) c = mix(vec3(luma(c)), c, uSat);
    if (uLut > 0.5){
        float y = (floor(uLut - 1.0) + 0.5) / uNPal;
        vec3 mapped = texture(uPal, vec2(clamp(luma(c), 0.0, 0.999999), y)).rgb;
        c = mix(c, mapped, clamp(uLutMix, 0.0, 1.0));
    }
    // The limiter is the lesson bloom teaches: a 'lighter' blend stacks to solid white
    // on bright content, and every professional VJ desk gates output brightness for
    // exactly that reason. Clamped per channel, like the original.
    // (No backticks in here — this whole shader is a JS template literal.)
    if (uCeiling < 0.999) c = min(c, vec3(uCeiling));
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
        'uN', 'uL0', 'uL1', 'uL2', 'uL3', 'uL4', 'uL5', 'uPalA', 'uPalB', 'uSpec', 'uWsA', 'uWsB', 'uHasWs',
        'uDisplace', 'uLumakey', 'uMatte']) uLoc[n] = gl.getUniformLocation(sceneProg, n);
    const pLoc = {};
    for (const n of ['uTex', 'uRes', 'uTime', 'uGlitch', 'uScan', 'uVignette', 'uInvert', 'uBlur', 'uBloom', 'uPosterize',
        'uDroste', 'uFold', 'uHue', 'uDither', 'uPixelsort', 'uMirror', 'uEdge', 'uPixelate',
        'uSat', 'uExposure', 'uContrast', 'uCeiling',
        'uPal', 'uNPal', 'uLut', 'uLutMix']) pLoc[n] = gl.getUniformLocation(presentProg, n);

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

    // ── workshop deck textures ──
    // Uploaded from a 2D canvas each frame. A canvas source is the one texImage2D
    // overload the browser can hand straight to the driver, so this stays cheap even
    // at native resolution; the alternative (readback to an ArrayBuffer) would not.
    function makeWsTex() {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
    }
    const wsTex = [makeWsTex(), makeWsTex()];
    let wsSrc = [null, null];        // the two deck canvases for THIS frame, or null
    // The canvas's own top-left origin has to survive the upload: GL's texture origin is
    // bottom-left, and uv in the scene shader is already v-down, so flipping here would
    // put every workshop layer upside down.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    function setWorkshop(a, b) { wsSrc[0] = a || null; wsSrc[1] = b || null; }

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
    const L0 = new Float32Array(MAXL * 4), L1 = new Float32Array(MAXL * 4), L2 = new Float32Array(MAXL * 4), L3 = new Float32Array(MAXL * 4), L4 = new Float32Array(MAXL * 4), L5 = new Float32Array(MAXL * 4);
    const SPEC = new Float32Array(32);            // FFT spectrum → uSpec[32]

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
            // opacity defaults to 1 and blend to max, so a layer that says nothing
            // composites exactly as it did before either existed.
            L5[o] = Math.max(0, Math.min(1, num(p.opacity, 1)));
            L5[o + 1] = layerBlendIndex(p.blend);
            L5[o + 2] = L5[o + 3] = 0;
            L3[o] = L3[o + 1] = L3[o + 2] = L3[o + 3] = 0;   // scene params pp.x..pp.w
            L4[o] = L4[o + 1] = L4[o + 2] = L4[o + 3] = 0;   // extra scene params pp2.x..pp2.w
            const specs = SCENE_PARAMS[l.scene];
            if (specs) for (let si = 0; si < specs.length && si < 8; si++) {
                const val = num(p[specs[si].n], specs[si].d);
                if (si < 4) L3[o + si] = val; else L4[o + si - 4] = val;   // first 4 → pp, next 4 → pp2
            }
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

        // freeze — hold the frame that is already in the buffer. The cheapest effect
        // here by a distance: pass 1 is simply not run, so the scene costs nothing
        // while it is held, and the post-fx and the grade still run over the held
        // frame. freeze(var([0,1],[7,1])) is a stutter on the beat; a held frame is
        // also the only way to look at one.
        const frozen = num(fx.freeze, 0) >= 0.5 && !needClear;
        const src = cur, dst = frozen ? cur : 1 - cur;   // read src (last frame), write dst
        gl.bindVertexArray(vao);

        // ── pass 1: scene + feedback → dst FBO ──
        if (!frozen) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb[dst]);
        gl.viewport(0, 0, W, H);
        if (needClear) { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); gl.bindFramebuffer(gl.FRAMEBUFFER, fb[src]); gl.clear(gl.COLOR_BUFFER_BIT); gl.bindFramebuffer(gl.FRAMEBUFFER, fb[dst]); needClear = false; }
        gl.useProgram(sceneProg);
        gl.uniform2f(uLoc.uRes, W, H);
        gl.uniform1f(uLoc.uTime, tSec);
        gl.uniform4f(uLoc.uAud, aud.bass || 0, aud.mid || 0, aud.treble || 0, aud.level || 0);
        // The analyser hands out 64 bins for the workshop layers; the shader's uSpec is
        // 32, so fold pairs rather than taking the lower half — which would have shown
        // the field scenes only the bottom two octaves.
        const sp = aud.spectrum;
        if (sp) {
            const n = sp.length | 0;
            if (n === 32) { for (let i = 0; i < 32; i++) SPEC[i] = sp[i] || 0; }
            else { const k = n / 32; for (let i = 0; i < 32; i++) {
                let a2 = 0, c = 0; for (let j = Math.floor(i * k); j < Math.floor((i + 1) * k); j++) { a2 += sp[j] || 0; c++; }
                SPEC[i] = c ? a2 / c : 0; } }
        }
        gl.uniform1fv(uLoc.uSpec, SPEC);
        gl.uniform1f(uLoc.uNPal, NPAL);
        gl.uniform1f(uLoc.uTrails, trails);
        gl.uniform1f(uLoc.uFeedback, feedback);
        gl.uniform1f(uLoc.uMix, x);
        gl.uniform1i(uLoc.uBlend, blend);
        gl.uniform1f(uLoc.uDisplace, num(fx.displace, 0));
        gl.uniform1f(uLoc.uLumakey, num(fx.lumakey, 0));
        gl.uniform1f(uLoc.uMatte, num(fx.matte, 0));
        gl.uniform1i(uLoc.uN, n);
        gl.uniform4fv(uLoc.uL0, L0); gl.uniform4fv(uLoc.uL1, L1); gl.uniform4fv(uLoc.uL2, L2); gl.uniform4fv(uLoc.uL3, L3); gl.uniform4fv(uLoc.uL4, L4); gl.uniform4fv(uLoc.uL5, L5);
        gl.uniform2f(uLoc.uPalA, da.palIdx, da.hue);
        gl.uniform2f(uLoc.uPalB, db.palIdx, db.hue);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, palTex); gl.uniform1i(uLoc.uPal, 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex[src]); gl.uniform1i(uLoc.uPrev, 1);
        for (let d = 0; d < 2; d++) {
            gl.activeTexture(gl.TEXTURE2 + d);
            gl.bindTexture(gl.TEXTURE_2D, wsTex[d]);
            const c = wsSrc[d];
            if (c && c.width && c.height) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
            gl.uniform1i(d ? uLoc.uWsB : uLoc.uWsA, 2 + d);
        }
        gl.uniform2f(uLoc.uHasWs, wsSrc[0] ? 1 : 0, wsSrc[1] ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        }

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
        gl.uniform1f(pLoc.uEdge, num(fx.edge, 0));
        gl.uniform1f(pLoc.uPixelate, num(fx.pixelate, 0));
        // These four are NEUTRAL AT 1, not at 0 like every other fx key — an absent
        // grade must leave the picture alone, not black it out.
        gl.uniform1f(pLoc.uSat, num(fx.sat, 1));
        gl.uniform1f(pLoc.uExposure, num(fx.exposure, 1));
        gl.uniform1f(pLoc.uContrast, num(fx.contrast, 1));
        gl.uniform1f(pLoc.uCeiling, num(fx.ceiling, 1));
        // lut() carries the palette in its VALUE (1-based), and how much of it in
        // lutmix — so lut(3) is a full recolour and lut(3) + lutmix(0.4) is a tint.
        gl.uniform1f(pLoc.uLut, num(fx.lut, 0));
        gl.uniform1f(pLoc.uLutMix, num(fx.lutmix, 1));
        gl.uniform1f(pLoc.uNPal, NPAL);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, palTex); gl.uniform1i(pLoc.uPal, 1);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[dst]); gl.uniform1i(pLoc.uTex, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        cur = dst;                                     // dst becomes next frame's src
    }

    function clear() { needClear = true; }             // wipe the feedback buffers (clear() reset)

    return { render, resize, clear, setResolution, setWorkshop, gl, get size() { return { W, H }; } };
}
