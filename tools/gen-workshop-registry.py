# -*- coding: utf-8 -*-
import io, re, os
W='/run/media/svdk/storage/DRIVE/500_Apps/stars/workshop'
src=io.open(W+'/src/channel.js',encoding='utf-8').read()

imports = re.findall(r'import\s*\{\s*([^}]*?)\s*\}\s*from\s*"\./layers/([^"]+)";', src)
sym2file = {}
for names, f in imports:
    for n in [x.strip() for x in names.split(',') if x.strip()]:
        sym2file[n] = f

kinds = re.findall(r'^\s*([A-Za-z0-9_]+):\s*\{\s*label:\s*"((?:[^"\\]|\\.)*)",\s*makeParams:\s*([A-Za-z0-9_]+),\s*draw:\s*([A-Za-z0-9_]+)\s*\},?\s*$',
                   src, re.M)
print('imports:', len(sym2file), 'kinds:', len(kinds))

missing = [k for k in kinds if k[2] not in sym2file or k[3] not in sym2file]
assert not missing, missing[:5]

# group symbols by file so each module is imported once
byfile = {}
for key, label, mp, dr in kinds:
    f = sym2file[mp]
    assert sym2file[dr] == f, (key, f, sym2file[dr])
    byfile.setdefault(f, set()).update([mp, dr])

lines = []
lines.append("""// ── Workshop layer registry ──────────────────────────────────────────────────
//
// GENERATED from the stars/workshop VJ tool's src/channel.js LAYER_KINDS table.
// Do not hand-edit the list: re-run tools/gen-workshop-registry.py against the
// workshop source when layers are added there.
//
// A workshop layer is a different animal from a crashDot scene, and both are kept.
// A crashDot scene is a SCALAR FIELD — field(u,v,t,p,a) → 0..1 — coloured by a
// palette and mirrored into GLSL so it can run per-pixel on the GPU. A workshop
// layer is an imperative RGBA DRAW — draw(ctx,w,h,p,t) — that owns its own colour
// and its own state. Neither can be expressed as the other, so the renderer grew a
// second layer kind rather than trying to translate %d of these into fields.
//
// makeParams() returns descriptors ({ base, min, max, mod }), not values; the
// workshop resolves them through its own modulation matrix. crashDot resolves
// params through vlang (patterns and TimeVars on the audio clock) and hands the
// draw function plain numbers, so defaults() flattens a descriptor set to the
// numbers a draw call expects.
""" % len(kinds))

for f in sorted(byfile):
    syms = ', '.join(sorted(byfile[f]))
    lines.append('import { %s } from \'./layers/%s\';' % (syms, f))

lines.append('')
lines.append('export const WORKSHOP_LAYERS = {')
for key, label, mp, dr in kinds:
    lines.append("    %-16s { label: %-22s makeParams: %-28s draw: %s }," % (key+':', '"%s",' % label, mp+',', dr))
lines.append('};')
lines.append('')
lines.append("""export const WORKSHOP_NAMES = Object.keys(WORKSHOP_LAYERS);

/** Flatten a layer's param descriptors to plain defaults: { name: base }. */
export function defaults(kind) {
    const k = WORKSHOP_LAYERS[kind];
    if (!k) return {};
    let desc = {};
    try { desc = k.makeParams() || {}; } catch (_) { return {}; }
    const out = {};
    for (const [n, d] of Object.entries(desc)) out[n] = (d && typeof d === 'object' && 'base' in d) ? d.base : d;
    return out;
}

/** The declared range of one param, for knobs and for clamping. */
export function paramRange(kind, name) {
    const k = WORKSHOP_LAYERS[kind];
    if (!k) return null;
    let desc = {};
    try { desc = k.makeParams() || {}; } catch (_) { return null; }
    const d = desc[name];
    return (d && typeof d === 'object' && 'base' in d) ? { min: d.min, max: d.max, base: d.base } : null;
}""")

os.makedirs('js/visuals/workshop', exist_ok=True)
io.open('js/visuals/workshop/index.js','w',encoding='utf-8').write('\n'.join(lines) + '\n')
print('wrote js/visuals/workshop/index.js')
