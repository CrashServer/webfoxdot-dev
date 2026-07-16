// scenes/index.js — the scene registry. This is the ONE file that grows a line when
// you add a scene: import it, drop it in `list`. The engine only ever asks getScene()
// by name, so it never imports a concrete scene. Each scene is:
//     export default { name, field(u, v, t, p, a) → 0..1 }
//   u,v ∈ [0,1] cell coords · t seconds · p resolved params · a audio {bass,mid,treble,level}

import plasma    from './plasma.js';
import tunnel    from './tunnel.js';
import wave      from './wave.js';
import rain      from './rain.js';
import spiral    from './spiral.js';
import cells     from './cells.js';
import starfield from './starfield.js';
import nebula    from './nebula.js';
import moire     from './moire.js';
import bars      from './bars.js';
import grid      from './grid.js';
import ripple    from './ripple.js';

const list = [plasma, tunnel, wave, rain, spiral, cells, starfield, nebula, moire, bars, grid, ripple];
const byName = new Map(list.map((s) => [s.name, s]));

export const SCENE_NAMES = list.map((s) => s.name);
export function getScene(name) { return byName.get(name) || null; }
