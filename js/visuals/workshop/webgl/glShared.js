// ── Shared WebGL2 context ─────────────────────────────────────────────────
// One offscreen WebGL2 canvas + context, shared across every shader-based
// layer — browsers cap you around 16 simultaneous WebGL contexts per page,
// and each channel in an N-channel mixer could plausibly want a GPU layer,
// so a per-layer context (the Volume layer's original approach) doesn't
// scale. Layers instead register a compiled program here by name and call
// render(name, w, h, setUniforms) each frame; since this is all synchronous
// single-threaded JS, one layer's render is fully consumed (drawImage'd into
// that layer's own Canvas2D buffer) before the next layer reuses this same
// canvas — same pattern as fxStack.js's shared scratch canvases.

let canvas = null, gl = null;
const programs = new Map(); // name -> { program, uniforms: Map<string, WebGLUniformLocation> }

function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh);
        gl.deleteShader(sh);
        throw new Error("shader compile failed: " + log);
    }
    return sh;
}

function ensureContext() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false });
}

export function supported() {
    ensureContext();
    return !!gl;
}

// Full-screen-triangle vertex shader shared by every program (no vertex
// buffer needed — gl_VertexID trick). Layers only supply a fragment shader.
const DEFAULT_VS = `#version 300 es
void main() {
    vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// `uniformNames`: list of uniform names the fragment shader declares — looked
// up once at registration so render() calls stay cheap.
export function registerProgram(name, fragmentSrc, uniformNames, vertexSrc = DEFAULT_VS) {
    ensureContext();
    if (!gl || programs.has(name)) return;
    const vs = compile(gl.VERTEX_SHADER, vertexSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fragmentSrc);
    const program = gl.createProgram();
    gl.attachShader(program, vs); gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`program "${name}" link failed: ${gl.getProgramInfoLog(program)}`);
    const uniforms = new Map();
    for (const u of uniformNames) uniforms.set(u, gl.getUniformLocation(program, u));
    programs.set(name, { program, uniforms });
}

// `setUniforms(gl, uniforms)` sets whatever uniforms this frame needs, then
// this draws the full-screen triangle. Returns the shared canvas — draw it
// with ctx.drawImage before any other program renders into it this frame.
// The canvas only ever GROWS. It used to be resized to each layer's exact
// size, which is free when every channel renders at the same scale and costly
// when they don't: with channels at 100% and 50%, one shared canvas is
// reallocated back and forth twice per layer per frame — measured at 240/s
// for three channels and 720/s for six, and each reallocation destroys and
// recreates the GPU drawing buffer.
//
// Instead we keep a high-water mark and render into a viewport of the
// requested size at the canvas ORIGIN. The origin matters: gl_FragCoord is in
// absolute window coordinates, not viewport-relative, so every shader's
// `gl_FragCoord.xy / uRes` UV would break if the viewport moved. (Anchoring
// it to the top-left instead made a 480x270 layer sample uv.y in 1..2 and
// render a solid colour.)
//
// GL's origin is bottom-left, so the rendered region sits at the BOTTOM-left
// of the canvas as an image. Layers blit with the source rect
// (0, glCanvas.height - h, w, h) — no extra API needed, the height is on the
// canvas they already have.
export function render(name, w, h, setUniforms) {
    if (!gl) return null;
    const entry = programs.get(name);
    if (!entry) return null;
    if (canvas.width < w || canvas.height < h) {
        canvas.width = Math.max(canvas.width, w);
        canvas.height = Math.max(canvas.height, h);
    }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(entry.program);
    setUniforms(gl, entry.uniforms);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return canvas;
}
