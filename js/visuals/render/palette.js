// palette.js — value → colour. Wraps the shared 256-entry LUTs (vdata) so the rest of
// the renderer never touches hex parsing. A per-channel palette is picked from the
// channel's layers; `hue` rotates the ramp for quick variation without new palettes.

import { paletteLut, PALETTES } from '../vdata.js';

const DEFAULT = 'ice';

export function paletteName(name) {
    return (name && PALETTES[name]) ? name : DEFAULT;
}

// Sample a palette at v ∈ [0,1] → [r,g,b] (0..255). `hue` (0..1) optionally rotates
// the sampling position, which slides the ramp — a cheap recolour knob.
export function sample(name, v, hue = 0) {
    const lut = paletteLut(paletteName(name));
    let x = v + hue;                          // hue slides where we read the ramp
    x = x - Math.floor(x);                    // wrap into 0..1
    const i = Math.max(0, Math.min(255, (x * 255) | 0));
    return lut[i];
}
