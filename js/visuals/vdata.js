// Shared visual constants — imported by both vlang.js (main window, for routing /
// validation / autocomplete) and clift.js (pop-out, for rendering). Single source of
// truth for the scene vocabulary, palettes, blend modes and glyph ramps. Palettes and
// blend modes are ported from CRIC/clift_final (the WebGL original).

// The scenes — each has a fieldVal()/point renderer in clift.js. Order matters only
// for the autopilot pools & docs.
// The scene vocabulary — must match the render/scenes/ registry (one field module each).
// Grows a name here + a file there. Kept small + solid first; port more one at a time.
export const SCENES = [
    'plasma', 'tunnel', 'wave', 'rain', 'spiral', 'cells',
    'starfield', 'nebula', 'moire', 'bars', 'grid', 'ripple',
    'fire', 'aurora', 'kaleido', 'warp', 'metaballs', 'hexgrid',
    'checker', 'swarm', 'flow', 'contour', 'voronoi',
    'helix', 'mandala', 'lattice', 'truchet', 'noise', 'rings', 'spectrum', 'marble',
    'testpattern', 'interference', 'biomech', 'escher', 'circuit', 'panopticon',
    'penrose', 'mobius', 'hexdump', 'lissajous', 'ikedaglitch',
];

// (No point-plotted scenes in the field-based renderer — kept as an empty set so any
//  legacy import still resolves.)
export const POINT_SCENES = new Set();

// ── Palettes (from clift_final/src/palettes/registry.ts) ─────────────────────
// luminance 0..1 → colour ramp. Stops in hex; sampled/lerped on demand.
export const PALETTES = {
    matrix: ['#000000', '#002200', '#00ff00', '#aaffaa', '#ffffff'],
    fire:   ['#000000', '#330000', '#ff2200', '#ffaa00', '#ffff88'],
    ice:    ['#000011', '#002244', '#00aaff', '#88e4ff', '#ffffff'],
    neon:   ['#000000', '#ff00ff', '#ff008f', '#00ffff', '#ffffff'],
    sunset: ['#1a0033', '#660066', '#ff3366', '#ffaa44', '#ffee99'],
    mono:   ['#000000', '#ffffff'],
    blood:  ['#000000', '#330000', '#aa0000', '#ff0033', '#ffcccc'],
    cyber:  ['#000011', '#ff00ff', '#00ffff', '#ffff00', '#ffffff'],
    vhs:    ['#2a003a', '#8a008a', '#ff66cc', '#66ffff', '#ffffcc'],
    acid:   ['#000000', '#004400', '#88ff00', '#ffff00', '#ff00aa'],
};
export const PALETTE_NAMES = Object.keys(PALETTES);

// ── Crossfade blend modes — how the two channels combine at the crossfader ────
// `op` is a canvas globalCompositeOperation (null → custom handling in clift).
export const BLEND_MODES = [
    { name: 'mix',        op: null },        // 0 — alpha crossfade A↔B
    { name: 'add',        op: 'lighter' },   // 1 — additive
    { name: 'screen',     op: 'screen' },    // 2
    { name: 'multiply',   op: 'multiply' },  // 3
    { name: 'difference', op: 'difference' },// 4
    { name: 'wipe',       op: null },        // 5 — horizontal wipe by xfade
    { name: 'dissolve',   op: null },        // 6 — per-cell random threshold
];
export const BLEND_NAMES = BLEND_MODES.map(b => b.name);
export function blendIndex(v) {
    if (typeof v === 'number') return Math.max(0, Math.min(BLEND_MODES.length - 1, Math.round(v)));
    const i = BLEND_NAMES.indexOf(String(v));
    return i < 0 ? 0 : i;
}

// ── Render / glyph modes — the character ramp luminance maps onto ─────────────
// GLYPH ramps — value → character. The pixel modes ('smooth' default, 'pixel' crisp)
// are handled directly in draw.js (they're not ASCII), so vmode() spans both worlds.
export const RENDER_MODES = {
    ascii:  ' .,:;-=+*o#%@',
    shade:  ' ░▒▓█',
    blocks: ' ▁▂▃▄▅▆▇█',
    dots:   ' ·:•●',
    bars:   ' ▏▎▍▌▋▊▉█',
};
export const RENDER_MODE_NAMES = ['smooth', 'pixel', ...Object.keys(RENDER_MODES)];

// Parse "#rrggbb" → [r,g,b] 0..255.
function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }

// Bake a 256-entry [r,g,b] LUT from a palette's stops (lazy, cached).
const _lut = {};
export function paletteLut(name) {
    if (_lut[name]) return _lut[name];
    const stops = (PALETTES[name] || PALETTES.mono).map(hex);
    const lut = new Array(256);
    for (let i = 0; i < 256; i++) {
        const f = i / 255 * (stops.length - 1), lo = Math.floor(f), k = f - lo;
        const a = stops[lo], b = stops[Math.min(stops.length - 1, lo + 1)];
        lut[i] = [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k)];
    }
    return (_lut[name] = lut);
}
