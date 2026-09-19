// docs.js — the in-app documentation panel: which tabs there are, and how each one
// is rendered. The CONTENT lives next door, in js/ui/docs/:
//
//   html.js        the four builders the docs are written in
//   reference.js   the vocabulary tables — what Alt+I and autocomplete read
//   changelog.js   the release notes
//   examples.js    the examples library
//
// They were all one 472KB file, which meant Alt+I imported the entire changelog and
// the whole examples library to show a one-line tooltip. Splitting them costs
// nothing at runtime — the browser parses the same bytes when the panel opens — and
// saves them for everything that only wants a corner of it.

import { SYNTH_DEFS } from '../synths/registry.js';
import { FX_REGISTRY } from '../fx/registry.js';
import { SCENES as V_SCENE_LIST, PALETTE_NAMES, RENDER_MODE_NAMES, BLEND_NAMES } from '../visuals/vdata.js';
import { h, section, code, note, step } from './docs/html.js';
import { SHORTCUTS, PATTERNS, TIMEVARS, FUNCTIONS, PLAYER_PARAMS, METHODS, VERSION } from './docs/reference.js';
import { CHANGELOG, splitItem, buildChangelog, changelogHTML } from './docs/changelog.js';
import { buildExamples, exampleList, exampleCode, examplesAsCode } from './docs/examples.js';
import { docIndex, searchDocs, renderResults } from './docs/search.js';
import { WORKSHOP_NAMES } from '../visuals/workshop/catalog.js';

// Re-exported so existing importers keep working — and so there is ONE name for each
// of these in the app, rather than a second path to the same table.
export { SHORTCUTS, PATTERNS, TIMEVARS, FUNCTIONS, PLAYER_PARAMS, METHODS, VERSION };
export { CHANGELOG, changelogHTML };
export { exampleList, exampleCode, examplesAsCode };

function key(k) { return `<span class="docs-key">${k}</span>`; }

function buildWorkflow() {
    const run = section('Running & editing live', `
        ${note('Code is organised into <b>blocks</b> — runs of lines with no blank line between them. ' + key('Ctrl+Enter') + ' runs the single line at the cursor (or the current selection); ' + key('Ctrl+Alt+Enter') + ' runs the whole block. Edit any line and press it again to change that player live — the rest keep playing.')}
        ${note(key('Ctrl+;') + ' stops everything · ' + key('Alt+X') + ' comments the line at the cursor and stops that player (uncomment + ' + key('Ctrl+Enter') + ' to bring it back).')}
        ${code(`b1 >> play(x.o.)        # cursor here, Ctrl+Enter
p1 >> bass([0,-3], oct=3)   # a second block`)}
    `);

    const nudge = section('Tweaking values live (nudge)', `
        ${note('Put the cursor on a number and use ' + key('Alt+↑') + ' / ' + key('Alt+↓') + ' to nudge it (±1, or ±0.1 if it has decimals) — the current line re-runs automatically, so you hear the change instantly. ' + key('Shift+Alt+↑/↓') + ' nudges ×10. Great for dialing in cutoff, amp, rate while it plays.')}
        ${code(`p1 >> saw([0,4,7], cutoff=2000, amp=0.6)
#                        ^ cursor here, Alt+↑ → 2001 … Shift+Alt+↑ → 2010`)}
    `, 'wf-nudge');

    const auto = section('Autocomplete (Ctrl+Space)', `
        ${note('Context-aware — what it offers depends on where the cursor is:')}
        ${code(`(empty line)   → a fresh player name + " >> " then the synth list
xx >> |        → synths (pick one = full call, cursor on the degree)
saw([0], |)    → params + FX groups (pick an FX = ALL its params)
cutoff=|       → patterns & timevars (PRand, linvar, …)`)}
        ${note('Picking a synth inserts the whole call with every parameter at its default and selects the degree so you can type your notes. Picking an FX (e.g. <code>reverb …</code>) drops in <code>reverb=0.4, room=0.6, damp=0.5</code>.')}
    `, 'wf-auto');

    const inspectS = section('Inspect a symbol (Alt+I)', `
        ${note('Put the cursor on any name and press ' + key('Alt+I') + ' for a tooltip: what it is, its signature, and a description. For a <b>pattern</b> it goes further — it evaluates the call and shows the values it generates.')}
        ${code(`p1 >> saw([0,4], amp=Pacc("ghost"))
#                        ^ Alt+I → "Pacc … → [1, 0.25, 0.3, 0.25, 0.7, …]"`)}
    `, 'wf-inspect');

    const perf = section('Performance moves', `
        ${note('Shortcuts act on the player at the cursor:')}
        ${code(`Alt+S        solo (mute all others)
Ctrl+Alt+S   unsolo (restore all)
Alt+O        soloDrop(8) — solo 8 beats then restore`)}
        ${note('Functions, beat-aligned:')}
        ${code(`p1.solo(8)        # solo 8 beats then restore
p1.stop(16)       # stop this player after 16 beats
soloRnd(8)        # solo a random player for 8 beats
drop(14, 2, 3)    # drop a random subset every 14+2 beats, 3 times (bar-aligned)`)}
    `, 'wf-perf');

    const compo = section('Composition — #@ sections', `
        ${note('Arrange a whole set. A <code>#@name(beats)</code> line starts a <b>part</b> (its code is the lines until the next #@). Put the cursor on it and ' + key('Ctrl+Enter') + ' — it runs, then auto-advances to the next part after <code>beats</code>. <code>#@#@ name</code> groups parts into a foldable <b>track</b>.')}
        ${note('A commented player line (<code># p1 >></code>) <b>stops</b> that player on entry — so you describe a part by what\'s active and comment out the rest. <code>#@loop(8, verse:3, fill:1)</code> jumps to a weighted-random part; <code>#@end(beats)</code> stops; <code>#@clear</code> stops now.')}
        ${code(`#@#@ my_set

#@intro(16)
b1 >> play(x.o.)
p1 >> bass([0,-3])

#@drop(32)
b1 >> play(x-o-, crush=0.5)
p1 >> bass([0,-3,5,4])
# p2 >>            # p2 was playing — this stops it

#@loop(8, intro:1, drop:3)

#@end(8)`)}
        ${note('<b>Live aids:</b> the active part highlights green and blinks each time it (re)evaluates. The <b>Composition</b> side-panel lists every part — click one to jump there. ' + key('Ctrl+Alt+P') + ' jumps to the active part. ' + key('Ctrl+Alt+;') + ' stops the autoplay chain but <b>keeps players running</b> (freeze on a part and take manual control) — distinct from ' + key('Ctrl+;') + ' which stops everything.')}
    `, 'wf-compo');

    const rec = section('Recording', `
        ${note('<b>rec code</b> captures your performance as code. Press it (blinks red), play your set with ' + key('Ctrl+Enter') + ', press again — crashDot writes a <code>#@</code> composition of everything you ran (grouped into parts by timing) and appends it to the buffer. Run its <code>#@</code> parts to replay the set.')}
        ${note('<b>rec audio</b> records the actual sound to a <code>.webm</code> file. The browser asks you to share the tab — tick <b>“share tab audio”</b>. Press again to stop; the file downloads automatically. (Chromium recommended; needs https or localhost.)')}
        ${note('<b>rec midi</b> saves the take as a Standard MIDI File — one track per player, named after it, <code>play()</code> players on General MIDI channel 10 with their chars mapped to real percussion, synths and <code>midiout()</code> players each on their own melodic channel. It RECORDS rather than renders: <code>PRand</code>, a <code>{a b}</code> pick, <code>.degrade</code> and a knob you nudged on the way past all land in the file as you actually played them. Note length follows <code>sus</code>, velocity follows <code>amp</code> and the mixer fader — but not the master, which is a monitoring level. From code: <code>midi_rec()</code> to arm and again to save, <code>midi_save("myset", 1/16)</code> to quantise, <code>midi_map("K", 36)</code> to re-point a drum char.')}
    `, 'wf-rec');

    const buffers = section('Buffers — the set + scratch canvases', `
        ${note('The tabs above the editor are separate buffers. The first, <b>SET</b>, is your composition — the one examples load into, the one <b>SHARE</b> encodes into a link, the one <b>GO LIVE</b> hands to a room, and in a session the one everybody is typing in. <b>+</b> (' + key('Ctrl+Alt+N') + ') opens a <b>scratch</b> buffer beside it; ' + key('Alt+1') + ' … ' + key('Alt+9') + ' switch, double-click a tab to rename, × closes.')}
        ${note('The sound does <b>not</b> switch with the tab. A player started in a scratch buffer keeps playing while you work in the set, so you can try an idea over what is already running and paste the line across once it works. A <code>#@</code> arrangement keeps advancing through the buffer it was launched from whichever tab you are on, and ' + key('Ctrl+Alt+P') + ' brings that buffer back before jumping to the active part.')}
        ${note('Scratch buffers are <b>local to you</b>: never shared into a session, never seeded into a room, never carried in a <code>#c=</code> link — but kept across a refresh. In a jam that is the point: somewhere to work an idea up before the room hears it.')}
    `, 'wf-buffers');

    const inherit = section('Player attribute inheritance', `
        ${note('A <b>playing</b> player keeps its params when you re-run it — you only change what you re-type. Prefix <code>~</code> to reset to defaults.')}
        ${code(`p1 >> saw([0,4], dur=4, cutoff=800)
p1 >> saw([0,4], oct=6)     # dur=4 and cutoff=800 are kept; oct=6 added
~p1 >> saw([0,4])           # reset — back to default dur, cutoff, …`)}
    `, 'wf-inherit');

    const save = section('Saving & sharing', `
        ${note('Solo edits <b>autosave</b> to the browser and survive a refresh. The <b>clear</b> button empties the editor; <b>examples</b> loads the full example tour (both undoable with ' + key('Ctrl+Z') + ').')}
        ${note('<b>Multiplayer:</b> open <code>?session=NAME</code> in the URL to share a live editor — shared text, cursors, and synced evals. Put a <code>loadpack(...)</code> at the top so everyone loads the same samples.')}
    `, 'wf-save');

    return run + nudge + auto + inspectS + perf + compo + rec + buffers + inherit + save;
}

function buildShortcuts() {
    return `<table class="docs-table">
        <thead><tr><th>Key</th><th>Action</th></tr></thead>
        <tbody>${SHORTCUTS.map(s =>
            `<tr><td class="docs-key">${s.key}</td><td>${s.desc}</td></tr>`
        ).join('')}</tbody>
    </table>`;
}

function buildSynths() {
    return Object.entries(SYNTH_DEFS).map(([name, def]) => {
        const params = Object.entries(def.defaults)
            .map(([k, v]) => `<span class="docs-param">${k}</span><span class="docs-val">${v}</span>`)
            .join('');
        return `<div class="docs-synth">
            <div class="docs-synth-name">${name}</div>
            <div class="docs-synth-params">${params}</div>
        </div>`;
    }).join('');
}

function buildFX() {
    const groups = { filter: [], reverb: [], saturation: [], echo: [] };
    for (const [key, reg] of Object.entries(FX_REGISTRY)) {
        if (key.startsWith('lpf') || key.startsWith('hpf') || key.startsWith('bpf') || key.startsWith('eq')) groups.filter.push([key, reg]);
        else if (key.startsWith('rev') || key === 'reverb' || key === 'room' || key === 'damp') groups.reverb.push([key, reg]);
        else if (key === 'tanh' || key === 'drive')             groups.saturation.push([key, reg]);
        else                                                     groups.echo.push([key, reg]);
    }
    return Object.entries(groups).map(([group, entries]) => {
        if (!entries.length) return '';
        return `<div class="docs-fx-group">
            <div class="docs-group-label">${group}</div>
            <table class="docs-table">
                <thead><tr><th>Param</th><th>Default</th><th>Description</th></tr></thead>
                <tbody>${entries.map(([k, r]) =>
                    `<tr><td class="docs-key">${k}</td><td class="docs-val">${r.default}</td><td>${r.desc}</td></tr>`
                ).join('')}</tbody>
            </table>
        </div>`;
    }).join('');
}

function buildPatterns() {
    const patRows = PATTERNS.map(p =>
        `<tr><td class="docs-key">${p.name}</td><td>${p.desc}</td></tr>`
    ).join('');
    const tvRows = TIMEVARS.map(p =>
        `<tr><td class="docs-key">${p.name}</td><td>${p.desc}</td></tr>`
    ).join('');
    return `
        <div class="docs-group-label">Patterns</div>
        <table class="docs-table"><tbody>${patRows}</tbody></table>
        <div class="docs-group-label" style="margin-top:14px">Time-varying values</div>
        <table class="docs-table"><tbody>${tvRows}</tbody></table>`;
}

function buildGuide() {
    const deploy = section('Deploy', `
        ${note('The WASM audio worklet needs two HTTP headers. You cannot open index.html as a <code>file://</code> URL.')}
        ${step(1, 'Start the local dev server:')}
        ${code('python3 serve.py\n# then open http://127.0.0.1:8765')}
        ${step(2, 'For a real server, set these headers on every response:')}
        ${code('Cross-Origin-Opener-Policy: same-origin\nCross-Origin-Embedder-Policy: require-corp')}
        ${step(3, 'Deploy the whole project directory. Only <code>synthdefs/compiled/</code> must be up to date. <code>serve.py</code>, <code>scripts/</code>, and <code>synthdefs/src/</code> are optional on the server.')}
        <div class="docs-sub-title">Nginx snippet</div>
        ${code(`location / {
    add_header Cross-Origin-Opener-Policy   "same-origin"  always;
    add_header Cross-Origin-Embedder-Policy "require-corp" always;
    add_header Cache-Control               "no-store"      always;
}
location ~* \\.scsyndef$ { default_type application/octet-stream; }`)}
        <div class="docs-sub-title">Caddy snippet</div>
        ${code(`yourdomain.com {
    root * /var/www/webfoxdot
    file_server
    header {
        Cross-Origin-Opener-Policy   "same-origin"
        Cross-Origin-Embedder-Policy "require-corp"
        Cache-Control                "no-store"
    }
}`)}
    `);

    const newSynth = section('New synth', `
        ${step(1, 'Create <code>synthdefs/src/synths/mysynth.scd</code>:')}
        ${code(`// mysynth — description
// Standard params: out, note, amp, sus, pan, attack, release
// Extra params:    myParam=440

SynthDef(\\fd_mysynth, {|out=0, note=60, amp=0.8, sus=1, pan=0,
                          attack=0.01, release=0.1, myParam=440|
    var freq, sig, env;
    freq = note.midicps;
    // sus = total duration in seconds (attack+sustain+release)
    env  = EnvGen.ar(
        Env.linen(attack, (sus - attack - release).max(0.001), release, amp, \\sin),
        doneAction: 2
    );
    sig  = SinOsc.ar(freq + myParam) * env;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);  // ~outDir set by build script — do not hardcode
"fd_mysynth done".postln;`)}

        ${step(2, 'Compile it:')}
        ${code('./scripts/build.sh mysynth    # single\n./scripts/build.sh             # all')}
        ${note('<code>sclang</code> must be in PATH. Arch: <code>sudo pacman -S supercollider</code>')}

        ${step(3, 'Register the new file in <code>scripts/compile.scd</code> (add to the synths array):')}
        ${code('"synthdefs/src/synths/mysynth.scd",')}

        ${step(4, 'Add an entry to <code>js/synths/registry.js</code>:')}
        ${code(`mysynth: {
    scName:      'fd_mysynth',
    defaults:    { oct: 4, amp: 0.7, dur: 1, pan: 0,
                   attack: 0.01, release: 0.1, myParam: 440 },
    extraParams: ['myParam'],
    // rawSus: true  ← set if sus is a raw decay in seconds (like donk),
    //                 not a total envelope duration
},`)}

        ${step(5, 'Add <code>"fd_mysynth"</code> to <code>SYNTHDEFS_TO_LOAD</code> in <code>index.html</code>.')}
        ${note('The eval context auto-includes all keys from <code>SYNTH_DEFS</code> — no further step needed. The synth appears in autocomplete immediately.')}
    `);

    const newFX = section('New FX', `
        ${note('Each FX is its own SynthDef (<code>fd_fx_*</code>), inserted on demand only when a player uses it (absent effects cost zero CPU). An effect reads the player\'s private bus, processes it, and writes back in-place; a permanent <code>fd_fx_out</code> node routes the bus to the main output.')}

        ${step(1, 'Add a standalone SynthDef to <code>synthdefs/src/fx/fx_effects.scd</code> — read the bus, process, ReplaceOut with the XFade2 wet/dry blend:')}
        ${code(`SynthDef(\\fd_fx_chorus, {|in_bus=64, chorus=0, chorus_rate=0.5, chorus_depth=0.003|
    var sig = In.ar(in_bus, 2), wet;
    wet = sig + DelayC.ar(sig, 0.05,
        SinOsc.kr(chorus_rate, [0, 0.5pi]) * chorus_depth + chorus_depth);
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet * 0.5, chorus * 2 - 1));
}).writeDefFile(~outDir);
// chorus=0 → XFade2 mix=-1 (all dry) · chorus=1 → +1 (all wet)`)}

        ${step(2, 'Recompile:')}
        ${code('./scripts/build.sh fx_effects')}

        ${step(3, 'Register the params in <code>js/fx/registry.js</code> (FX_REGISTRY) and add an entry to <code>FX_EFFECTS</code> in chain order:')}
        ${code(`// FX_REGISTRY:
chorus:       { scParam: 'chorus',       default: 0,   desc: 'Chorus mix (0=off)' },
chorus_rate:  { scParam: 'chorus_rate',  default: 0.5,  desc: 'Mod rate Hz' },
chorus_depth: { scParam: 'chorus_depth', default: 0.003,desc: 'Mod depth in seconds' },

// FX_EFFECTS (position = where it sits in the chain):
{ scName: 'fd_fx_chorus', keys: ['chorus','chorus_rate','chorus_depth'], trig: ['chorus'] },`)}
        ${note('Any key in <code>FX_REGISTRY</code> is automatically routed to the FX chain (not the synth), updated every beat step (supports TimeVars), in autocomplete, and shown in the FX docs tab. The <code>trig</code> param activates the node.')}
    `);

    const newFn = section('New pattern or function', `
        ${note('Patterns and global functions are pure JS — no compilation needed.')}

        <div class="docs-sub-title">New pattern class</div>
        ${step(1, 'Add the class to <code>js/patterns/sequences.js</code> and export it:')}
        ${code(`export class PMyPattern {
    constructor(lo, hi) { this.lo = lo; this.hi = hi; this._i = 0; }
    // patGet() calls .get(step) on pattern objects
    get(step) {
        // return a value for this step
        return this.lo + (step % (this.hi - this.lo));
    }
}`)}

        ${step(2, 'Import and add it to the destructuring import in <code>index.html</code>:')}
        ${code(`import { PRand, ..., PMyPattern } from './js/patterns/sequences.js';`)}

        ${step(3, 'Add it to the eval context in <code>runCode()</code>:')}
        ${code(`PMyPattern,`)}

        ${step(4, 'Add it to <code>PATTERN_NAMES</code> in <code>js/editor/autocomplete.js</code>:')}
        ${code(`const PATTERN_NAMES = [\n    ..., 'PMyPattern',\n];`)}

        <div class="docs-sub-title" style="margin-top:12px">New global function</div>
        ${step(1, 'Write the function (e.g. in <code>js/engine/player.js</code> or inline).')}
        ${step(2, 'Add it to the eval context in <code>runCode()</code>:')}
        ${code(`myFn: (arg) => doSomething(arg, clock),`)}
        ${step(3, 'Add it to <code>GLOBALS</code> in <code>autocomplete.js</code>:')}
        ${code(`const GLOBALS = [..., 'myFn(', ...];`)}
        ${step(4, 'Add a row to the Functions tab in <code>js/ui/docs.js</code> → <code>FUNCTIONS</code> array.')}
    `);

    const supersonic = section('SuperSonic WASM engine', `
        ${note('Pre-built files in <code>lib/dist/</code> are committed to the repo. <strong>You do not need Emscripten or any C++ toolchain for normal use.</strong>')}

        <div class="docs-sub-title">What's in lib/dist/</div>
        <table class="docs-table"><tbody>
            <tr><td class="docs-key">supersonic.js</td><td>JS wrapper + OSC transport (115K, bundled with esbuild)</td></tr>
            <tr><td class="docs-key">wasm/scsynth-nrt.wasm</td><td>scsynth C++ engine compiled to WebAssembly via Emscripten (1.4MB)</td></tr>
            <tr><td class="docs-key">workers/</td><td>AudioWorklet processor + OSC in/out workers</td></tr>
        </tbody></table>

        <div class="docs-sub-title" style="margin-top:12px">Upgrade via npm (easiest)</div>
        ${code(`npm install supersonic-scsynth@latest
cp -r node_modules/supersonic-scsynth/dist/supersonic.js lib/dist/
cp -r node_modules/supersonic-scsynth/dist/wasm/         lib/dist/wasm/
cp -r node_modules/supersonic-scsynth/dist/workers/      lib/dist/workers/`)}
        ${note('After upgrading, check the SuperSonic changelog. You may need to recompile SynthDefs if the WASM API changed between versions.')}

        <div class="docs-sub-title" style="margin-top:12px">Build from source (needs Emscripten + Node.js)</div>
        ${step(1, 'Install Emscripten SDK (activate it in every build shell):')}
        ${code(`git clone https://github.com/emscripten-core/emsdk.git
cd emsdk && ./emsdk install latest && ./emsdk activate latest
source ./emsdk_env.sh`)}
        ${step(2, 'Clone SuperSonic and build:')}
        ${code(`git clone https://github.com/samaaron/supersonic
cd supersonic && npm install && npm run build
# output → dist/`)}
        ${step(3, 'Copy output into crashDot:')}
        ${code(`cp dist/supersonic.js     lib/dist/
cp -r dist/wasm/          lib/dist/wasm/
cp -r dist/workers/       lib/dist/workers/`)}
        <div class="docs-sub-title" style="margin-top:12px">Build via Docker (no local toolchain needed)</div>
        ${code(`cd supersonic
docker build -t supersonic-build .
docker run --rm -v "$(pwd)/out:/app/dist" supersonic-build`)}
    `);

    return deploy + supersonic + newSynth + newFX + newFn;
}

function buildFunctions() {
    const fnRows = FUNCTIONS.map(f =>
        `<tr><td class="docs-key">${f.name}</td><td>${f.desc}</td></tr>`
    ).join('');
    const paramRows = PLAYER_PARAMS.map(p =>
        `<tr><td class="docs-key">${p.name}</td><td>${p.desc}</td></tr>`
    ).join('');
    return `
        <div class="docs-group-label">Global functions &amp; player methods</div>
        <table class="docs-table"><tbody>${fnRows}</tbody></table>
        <div class="docs-group-label" style="margin-top:14px">Common player params</div>
        <table class="docs-table"><tbody>${paramRows}</tbody></table>`;
}

// Visual language reference — the vN >> scene(...) mini-language rendered in the
// pop-out visuals window. Scene/palette/mode/blend lists come from vdata.js.
const V_PARAMS = [
    ['hue', '0–1 colour (a pattern like [0,.3] or a var like sinvar([0,1],8) animates it)'],
    ['speed', 'animation rate multiplier (default 1)'],
    ['bright', 'brightness multiplier (default 1)'],
    ['alpha', 'layer opacity 0–1 (default 1) — dial a stacked layer back over the one below'],
    ['dur', 'beats per step for any patterned param (default 1)'],
    ['ch', 'channel 0 or 1 — which mixer deck this layer feeds (default 0). Layers on a channel stack (upper over lower)'],
    ['pal', 'per-layer palette, e.g. pal="fire" (overrides the global palette())'],
    ['mode', 'per-layer glyph set, e.g. mode="shade"'],
];
const V_FX = [
    ['scan(x)', 'CRT scanlines, 0–1'],
    ['trails(x)', 'feedback / motion trails, 0–1'],
    ['vignette(x)', 'darken the edges, 0–1'],
    ['glitch(x)', 'datamosh slice burst'],
    ['invert()', 'invert the colours'],
    ['posterize(n)', 'quantise to n brightness steps'],
];
function buildVisuals() {
    const scenes = V_SCENE_LIST.map(s => `<code class="docs-key">${s}</code>`).join(' ');
    const params = V_PARAMS.map(([k, d]) => `<tr><td class="docs-key">${k}</td><td>${d}</td></tr>`).join('');
    const fxs    = V_FX.map(([k, d]) => `<tr><td class="docs-key">${k}</td><td>${d}</td></tr>`).join('');
    const pals   = PALETTE_NAMES.map(s => `<code class="docs-key">${s}</code>`).join(' ');
    const modes  = RENDER_MODE_NAMES.map(s => `<code class="docs-key">${s}</code>`).join(' ');
    const blends = BLEND_NAMES.map((s, i) => `<code class="docs-key">${i} ${s}</code>`).join(' ');
    return `
        <div class="docs-group-label">Code your visuals</div>
        <p class="docs-p">The pop-out window opens by itself the moment you run a video player (or call
        <code>openVisuals()</code>). Then, in the <b>same editor</b> as your
        audio, give <b>any player a scene</b> and it drives the visuals — the <i>scene</i> on the right is what routes
        it to video (a synth makes sound), so <code>v1</code>, <code>bg</code>, whatever all work for either. Layers
        stack (upper over lower) and react to the live audio; <code>+ fx()</code> chains screen effects.</p>
        <pre class="docs-code">v1 &gt;&gt; plasma(hue=0.6, speed=2)
v2 &gt;&gt; tunnel(hue=sinvar([0,1],8)) + scan(.5)
palette("fire")   vmode("shade")     # global colour ramp / glyph set
v1.stop()                            # remove one layer · shutup() clears all</pre>
        <div class="docs-group-label" style="margin-top:14px">2-channel video mixer</div>
        <p class="docs-p">Put layers on channel 0 or 1 with <code>ch=</code>; <code>mix()</code> is the A↔B crossfader
        (0 = channel&nbsp;0 … 1 = channel&nbsp;1). Its value can be a number, a pattern, or a TimeVar — so it animates
        on the beat. <code>mix</code> is a <b>singleton</b>: a new one replaces the old.</p>
        <pre class="docs-code">v1 &gt;&gt; tunnel(pal="ice")               # deck A (channel 0)
v3 &gt;&gt; nebula(ch=1, pal="acid")        # deck B (channel 1)
v9 &gt;&gt; mix(linvar([0,1],16), dur=1/4, blend="screen")   # auto-fade A→B
v9 &gt;&gt; mix(PWhite(0,1), dur=1)         # or a random crossfader</pre>
        <div class="docs-group-label" style="margin-top:14px">Scenes (the visual "synths")</div>
        <p class="docs-p">${scenes}</p>
        <div class="docs-group-label" style="margin-top:14px">Scene params</div>
        <table class="docs-table"><tbody>${params}</tbody></table>
        <div class="docs-group-label" style="margin-top:14px">Post-FX (chain with +)</div>
        <table class="docs-table"><tbody>${fxs}</tbody></table>
        <div class="docs-group-label" style="margin-top:14px">Palettes  ·  palette("…")  or  pal="…"</div>
        <p class="docs-p">${pals}</p>
        <div class="docs-group-label" style="margin-top:14px">Glyph modes  ·  vmode("…")  or  mode="…"</div>
        <p class="docs-p">${modes}</p>
        <div class="docs-group-label" style="margin-top:14px">Blend modes  ·  mix(x, blend=…)</div>
        <p class="docs-p">${blends}</p>
        <p class="docs-p" style="margin-top:12px">By default the window is <b>idle</b> (dark) until you run visual code —
        no code, no visual. <b>[m]</b> cycles the modes: <b>idle</b> · <b>live</b> (your <code>vN</code> layers) ·
        <b>autopilot</b> (audio-reactive scene director, or press <b>[a]</b>) · <b>code</b> (one panel per audio player).
        It runs in its own window, so it never competes with the audio clock.</p>`;
}

// ── Panel lifecycle ────────────────────────────────────────────────────────────

// Where a search hit's call goes when you click it. index.html supplies the same
// inserter the layers panel uses, so a looked-up name lands in the buffer you are
// actually writing in.
let _insertFn = null;
export function setDocsInsert(fn) { _insertFn = fn; }

export function initDocs() {
    const panel = document.getElementById('docs-panel');
    const tabs  = panel.querySelectorAll('.docs-tab');
    const body  = panel.querySelector('#docs-body');

    const CONTENT = {
        examples:  buildExamples,
        workflow:  buildWorkflow,
        shortcuts: buildShortcuts,
        synths:    buildSynths,
        fx:        buildFX,
        patterns:  buildPatterns,
        functions: buildFunctions,
        guide:     buildGuide,
        visuals:   buildVisuals,
        changelog: buildChangelog,
    };

    // Cache rendered content so we don't rebuild on every switch
    const cache = {};

    // ── Search ───────────────────────────────────────────────────────────────
    // Ten tabs and something over six hundred entries behind them. Finding a name
    // meant knowing which tab it lived in first.
    const input = panel.querySelector('#docs-search');
    let lastTab = 'examples';
    const index = () => docIndex({
        synths: SYNTH_DEFS, fx: FX_REGISTRY,
        // Both kinds of scene: the 49 field scenes AND the 194 workshop layers, which
        // were reachable only by already knowing the name.
        scenes: [...V_SCENE_LIST, ...WORKSHOP_NAMES],
        examples: exampleList(),
    });
    function runSearch(q) {
        if (!q || q.trim().length < 2) { showTab(lastTab); return; }
        tabs.forEach(t => t.classList.remove('active'));
        body.innerHTML = renderResults(searchDocs(q, index()), q.trim());
        body.scrollTop = 0;
    }

    function showTab(name) {
        lastTab = name;
        if (input && input.value) input.value = '';     // leaving search by picking a tab
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
        if (!cache[name]) cache[name] = CONTENT[name]();
        body.innerHTML = cache[name];
        body.scrollTop = 0;
    }
    _showTab = showTab;

    tabs.forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));

    if (input) {
        let t = null;
        input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => runSearch(input.value), 90); });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { input.value = ''; showTab(lastTab); input.blur(); }
            // Enter on a single hit takes you to it, which is what you meant by typing
            // the whole name.
            if (e.key === 'Enter') { const one = body.querySelector('.docs-hit'); if (one) one.click(); }
        });
    }

    // A hit takes you to the tab it lives in, and copies its call if it has one —
    // the point of looking something up is usually to use it.
    body.addEventListener('click', (e) => {
        const hit = e.target.closest('.docs-hit');
        if (!hit) return;
        const ins = hit.dataset.insert;
        if (ins && _insertFn) { _insertFn(ins); }
        else showTab(hit.dataset.tab);
    });

    body.addEventListener('click', (e) => {
        // Examples table-of-contents chip: expand + scroll to that category
        const toc = e.target.closest('.docs-toc-link');
        if (toc) {
            const grp = body.querySelector('#' + toc.dataset.cat);
            if (grp) { grp.classList.remove('collapsed'); grp.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
            return;
        }
        // Category header: fold / unfold its sections
        const toggle = e.target.closest('.docs-cat-toggle');
        if (toggle) { toggle.closest('.docs-catgroup')?.classList.toggle('collapsed'); return; }
        // Changelog "→ example" link: jump to the Examples tab + scroll to anchor
        const link = e.target.closest('.docs-link');
        if (link) {
            const anchor = link.dataset.anchor;
            showTab('examples');
            const el = body.querySelector('#' + anchor);
            if (el) {
                el.closest('.docs-catgroup')?.classList.remove('collapsed');   // reveal if collapsed
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                el.classList.add('ex-flash'); setTimeout(() => el.classList.remove('ex-flash'), 1200);
            }
            return;
        }
        // Changelog entry: click the headline to expand/collapse its details
        const clSummary = e.target.closest('.cl-summary');
        if (clSummary) { clSummary.closest('.cl-item')?.classList.toggle('open'); return; }
        // Click any code block to copy it to the clipboard
        const pre = e.target.closest('.docs-code');
        if (!pre) return;
        navigator.clipboard?.writeText(pre.textContent).then(() => {
            pre.classList.add('copied');
            setTimeout(() => pre.classList.remove('copied'), 600);
        });
    });

    // Close button
    panel.querySelector('#docs-close').addEventListener('click', () => toggleDocs());

    // Escape to close
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !panel.classList.contains('hidden')) toggleDocs();
    });

    // Open on first show
    showTab('examples');
}

let _showTab = null;

export function toggleDocs() {
    document.getElementById('docs-panel').classList.toggle('hidden');
}

// Open the docs panel directly on a given tab (e.g. from the version label).
export function openDocs(tab) {
    const panel = document.getElementById('docs-panel');
    panel.classList.remove('hidden');
    if (tab && _showTab) _showTab(tab);
}
