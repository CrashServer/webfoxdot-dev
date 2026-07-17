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
import fire      from './fire.js';
import aurora    from './aurora.js';
import kaleido   from './kaleido.js';
import warp      from './warp.js';
import metaballs from './metaballs.js';
import hexgrid   from './hexgrid.js';
import checker   from './checker.js';
import swarm     from './swarm.js';
import flow      from './flow.js';
import contour   from './contour.js';
import voronoi   from './voronoi.js';
import helix     from './helix.js';
import mandala   from './mandala.js';
import lattice   from './lattice.js';
import truchet   from './truchet.js';
import noise     from './noise.js';
import rings     from './rings.js';
import spectrum  from './spectrum.js';
import marble    from './marble.js';
import testpattern  from './testpattern.js';
import interference from './interference.js';
import biomech      from './biomech.js';
import escher       from './escher.js';
import circuit      from './circuit.js';
import panopticon   from './panopticon.js';
import penrose      from './penrose.js';
import mobius       from './mobius.js';
import hexdump      from './hexdump.js';
import lissajous    from './lissajous.js';
import ikedaglitch  from './ikedaglitch.js';
import barcode      from './barcode.js';
import equalizer    from './equalizer.js';
import datamatrix   from './datamatrix.js';
import tron         from './tron.js';
import butterfly    from './butterfly.js';
import lightning    from './lightning.js';

const list = [
    plasma, tunnel, wave, rain, spiral, cells, starfield, nebula, moire, bars, grid, ripple,
    fire, aurora, kaleido, warp, metaballs, hexgrid, checker, swarm, flow, contour, voronoi,
    helix, mandala, lattice, truchet, noise, rings, spectrum, marble,
    testpattern, interference, biomech, escher, circuit, panopticon,
    penrose, mobius, hexdump, lissajous, ikedaglitch,
    barcode, equalizer, datamatrix,
    tron, butterfly, lightning,
];
const byName = new Map(list.map((s) => [s.name, s]));

export const SCENE_NAMES = list.map((s) => s.name);
export function getScene(name) { return byName.get(name) || null; }
