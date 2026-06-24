// In-app documentation panel — tabs for Shortcuts, Synths, FX, Patterns, Functions.

import { SYNTH_DEFS } from '../synths/registry.js';
import { FX_REGISTRY } from '../fx/registry.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function h(tag, cls, html) {
    return `<${tag}${cls ? ` class="${cls}"` : ''}>${html}</${tag}>`;
}
function section(title, body) {
    return `<div class="docs-section">
        <div class="docs-section-title">${title}</div>
        ${body}
    </div>`;
}
function code(text) {
    return h('pre', 'docs-code', text.replace(/</g,'&lt;').replace(/>/g,'&gt;'));
}
function note(text) { return h('div', 'docs-note', text); }
function step(n, text) {
    return `<div class="docs-step"><span class="docs-step-n">${n}</span><span>${text}</span></div>`;
}

// ── Static content ─────────────────────────────────────────────────────────────

const SHORTCUTS = [
    { key: 'Ctrl+Enter',         desc: 'Run block at cursor / selection' },
    { key: 'Alt+X',              desc: 'Toggle comment + stop / restart player' },
    { key: 'Alt+S',              desc: 'Solo player — mute all others' },
    { key: 'Alt+O',              desc: 'SoloDrop — solo 8 beats then restore all' },
    { key: 'Ctrl+;',             desc: 'Stop all players' },
    { key: 'Ctrl+Space',         desc: 'Autocomplete' },
    { key: 'Alt+↑ / Alt+↓',      desc: 'Nudge value under cursor ±1 or ±0.1' },
    { key: 'Shift+Alt+↑/↓',      desc: 'Nudge value ×10' },
    { key: 'Ctrl+/',             desc: 'Toggle line comment' },
];

const PATTERNS = [
    { name: 'PRand(lo, hi)',            desc: 'Random integer between lo and hi each step' },
    { name: 'PWhite(lo, hi)',           desc: 'Uniform random float between lo and hi' },
    { name: 'PWalk(lo, hi, step)',      desc: 'Random walk — moves ±step, clamps to [lo,hi]' },
    { name: 'PDur(dur, sub)',           desc: 'Euclidean subdivision of dur over sub steps' },
    { name: 'PPing(lo, hi)',            desc: 'Bounce linearly between lo and hi' },
    { name: 'PStutter(p, n)',           desc: 'Repeat each element of p exactly n times' },
    { name: 'PAlt(a, b)',               desc: 'Alternate one step from a, one from b' },
    { name: 'PShuf(values)',            desc: 'Shuffle the list once, cycle the result' },
    { name: 'PBern(p)',                 desc: 'Bernoulli sequence — 1 with probability p' },
    { name: 'PCoin(p)',                 desc: 'Return 0 or 1 with probability p' },
    { name: 'PEuclid(n, k)',            desc: 'Euclidean rhythm — k pulses in n steps' },
    { name: 'PRange(lo, hi)',           desc: 'Linear ramp from lo to hi, then repeat' },
    { name: 'PStep(n, v, default=0)',   desc: 'Return v at step n, else default' },
    { name: 'PSine(lo, hi, len)',       desc: 'Sine-shaped sweep over len steps' },
    { name: 'PTri(lo, hi, len)',        desc: 'Triangle-shaped sweep over len steps' },
    { name: 'PChain(dict)',             desc: 'Markov chain from {state: [next,...]} dict' },
    { name: 'PMarkov(arr)',             desc: 'First-order Markov from value array' },
];

const TIMEVARS = [
    { name: 'var(values, durs)',        desc: 'Step through values, hold each for dur beats' },
    { name: 'linvar(values, durs)',     desc: 'Linear interpolation between values over durs' },
    { name: 'sinvar(values, durs)',     desc: 'Sine-shaped interpolation between values' },
    { name: 'expvar(values, durs)',     desc: 'Exponential interpolation (useful for freq/amp)' },
    { name: 'fi(beats, a, b)',          desc: 'Envelope (use with _ suffix): fade in a→b over beats, holds at b. e.g. lpf_=fi(0.5, 400, 4000)' },
    { name: 'fo(beats, a, b)',          desc: 'Envelope (_ suffix): fade out b→a over beats, holds at a' },
    { name: 'fb(beats, a, b)',          desc: 'Envelope (_ suffix): bounce a↔b every beats (wobble). Loops within sus' },
];

const FUNCTIONS = [
    { name: 'play(pattern, opts)',      desc: 'Drum/sample pattern. Chars map to samples. space=rest, (Xo)=fire both at once, [XoX]=subdivide into sub-steps, {Xo}=random pick, &lt;Xo&gt;=alternate on successive hits. Quotes optional if pattern has spaces. opts: amp, dur (default 1), pan, rate, sample' },
    { name: 'loadsample(char, url)',    desc: 'Load a WAV from a URL (or [urls]) and assign it to a play() char. GitHub raw / release URLs work. e.g. loadsample("K", "https://raw.githubusercontent.com/u/r/main/kick.wav")' },
    { name: 'loadpack(url)',            desc: 'Load a pack: JSON manifest {char: url | [urls]}. Relative URLs resolve against the pack location' },
    { name: 'drop(playTime, dropTime, nbloop)', desc: 'Silence a random subset of players for dropTime beats, then restore. Default: 14, 2, 1' },
    { name: 'unsolo()',                 desc: 'Restore all players muted by solo / Alt+S' },
    { name: 'rest()',                   desc: 'Silence for one step (use in degree list)' },
    { name: 'print(...args)',           desc: 'Print to the log panel' },
    { name: 'p1.solo()',               desc: 'Mute all other players (they keep running)' },
    { name: 'p1.soloDrop(beats)',      desc: 'Solo for N beats, then restore. Default: 8' },
    { name: 'p1.every(beats, fn)',     desc: 'Call fn(player) every N beats. fn can be a string: "stutter", "reverse", "shuffle"' },
    { name: 'p1.stutter(n)',           desc: 'Temporarily halve dur to repeat notes n times' },
    { name: 'p1.reverse()',            desc: 'Reverse degree array for one cycle' },
    { name: 'p1.shuffle()',            desc: 'Shuffle degree array for one cycle' },
];

const PLAYER_PARAMS = [
    { name: 'degree',   desc: 'Scale degree. List for sequences, (a,b) for chords, null for rest' },
    { name: 'oct',      desc: 'Octave (default varies by synth, usually 4–5)' },
    { name: 'amp',      desc: 'Amplitude 0–1 (default 0.7–0.9)' },
    { name: 'dur',      desc: 'Step duration in beats (default 1)' },
    { name: 'sus',      desc: 'Note sustain in beats (defaults to dur)' },
    { name: 'pan',      desc: 'Stereo position -1 (left) to +1 (right)' },
    { name: 'attack',   desc: 'Envelope attack in seconds' },
    { name: 'release',  desc: 'Envelope release in seconds' },
];

// ── HTML builders ──────────────────────────────────────────────────────────────

// Overview / copy-paste examples of everything implemented.
function buildExamples() {
    // Auto-generate one line per registered synth so this never goes stale.
    const synthLines = Object.entries(SYNTH_DEFS).map(([name, def], i) => {
        const oct = def.defaults.oct ?? 4;
        const extra = (def.extraParams ?? [])
            .filter(p => p in def.defaults)
            .map(p => `${p}=${def.defaults[p]}`)
            .join(', ');
        const tail = extra ? `, ${extra}` : '';
        return `p${i + 1} >> ${name}([0, 4, 7, 4], oct=${oct}, amp=0.6${tail})`;
    }).join('\n');

    const start = section('Start here', `
        ${note('Boot audio first (the <b>boot</b> button). Put the cursor in a block and press <b>Ctrl+Enter</b> to run it. Edit and re-run live. <b>Ctrl+;</b> stops everything. Click any code box below to copy it.')}
        ${code(`Clock.bpm = 120
Scale.default = "minor"
Root.default = 0`)}
    `);

    const drums = section('Drums — play()', `
        ${note('Chars map to samples. <code>.</code> or space = rest. Brackets: <code>(Xo)</code> together · <code>[Xo]</code> subdivide · <code>{Xo}</code> random · <code>&lt;Xo&gt;</code> alternate.')}
        ${code(`b1 >> play(x.o.x.o., amp=0.9)              # kick / snare
b2 >> play(x-o-, amp=0.9)                  # - = closed hihat
b3 >> play(x.[oo]x.<o->, amp=0.8)          # subdivide + alternate
b4 >> play((x*)..{o-}.., amp=0.8)          # together + random
b5 >> play(x.o., dur=0.5, sample=1)        # sample-index slot`)}
    `);

    const synths = section('All synths', `
        ${note('Degree arrays are scale steps. Each synth\'s extra params are shown filled in with their defaults.')}
        ${code(synthLines)}
    `);

    const axis1 = section('Axis 1 — sequences, chords & groups', `
        ${note('<code>[a,b,c]</code> = a per-step sequence. <code>(a,b,c)</code> = a chord/group fired together — also works on any param (zipped across voices). <code>.</code> = rest.')}
        ${code(`p1 >> saw([0, (0,4,7), 4, (2,5,9)], oct=4)   # chord on steps 2 & 4
p1 >> dbass((0,4,7), oct=3)                  # a held chord
p1 >> saw([0,4,7], pan=(-1,1), amp=(0.6,0.3)) # grouped params zip into voices
p1 >> sine([0, ., 4, .], oct=5)              # . = rest`)}
    `);

    const sometimes = section('Probabilistic — .sometimes()', `
        ${note('<code>.sometimes(method, ...args)</code> rolls each step (50% by default) and applies a player method. <code>.sometimes(p, method, ...)</code> sets the probability.')}
        ${code(`p1 >> saw([0,4,7,5], oct=4).sometimes("stutter", 4)
p1 >> dbass([0,-3], oct=3).sometimes(0.2, "reverse")
b1 >> play(x-o-).sometimes("stutter", 2)`)}
    `);

    const axis2 = section('Axis 2 — time-varying values (var family)', `
        ${note('Evolve a parameter over beats. <code>var</code> steps; <code>linvar/sinvar/expvar</code> interpolate. Args: (values, durations-in-beats).')}
        ${code(`p1 >> dbass([0,-3,0,4], oct=3, cutoff=linvar([400, 4000], [8, 8]))
p1 >> saw([0,4,7], cutoff=sinvar([500, 5000], [4]))
p1 >> pulse([0,3], width=var([0.2, 0.5, 0.8], [2, 2, 4]))
p1 >> fm([0,7], index=expvar([1, 12], [16]))`)}
    `);

    const axis3 = section('Axis 3 — parameter envelopes ( _ suffix )', `
        ${note('A <code>_</code> suffix runs an envelope per note. <code>fi</code> fade in, <code>fo</code> fade out, <code>fb</code> bounce/wobble. Signature: <code>f(beats, from, to)</code>. <b>FX-chain params only</b> (lpf, hpf, reverb, echo, crush…).')}
        ${code(`p1 >> saw([0,4], oct=4, dur=1, lpf_=fi(0.5, 400, 5000))   # filter opens
p1 >> saw([0,3], oct=3, dur=1, lpf_=fo(1, 5000, 400))     # filter closes
p1 >> saw([0,3], oct=3, dur=1, lpf_=fb(0.25, 300, 3000))  # wobble`)}
    `);

    const fx = section('FX — append to any player', `
        ${note('FX run on a persistent per-player chain. Combine freely — on synths AND on play() drums.')}
        ${code(`p1 >> saw([0,4,7], lpf=2000, lpf_rq=0.3)        # low-pass
p1 >> saw([0,4,7], hpf=300, reverb=0.4, room=0.8)  # high-pass + reverb
p1 >> saw([0,4,7], echo=0.4, echo_time=0.375)      # delay
p1 >> dbass([0,-3], crush=0.6, bits=4, srate=6000) # bitcrush
b1 >> play(x-o-, lpf=1500, reverb=0.3)             # FX on drums too
b2 >> play(x.o., echo=0.4, crush=0.5, bits=4)`)}
    `);

    const samples = section('External samples', `
        ${note('Load WAVs from any public URL into your buffers. In multiplayer everyone loads the same URL, so put a loadpack at the top of the shared doc.')}
        ${code(`# default kit (the original FoxDot bank)
loadpack("https://cdn.jsdelivr.net/gh/CrashServer/webfoxdot-kit@v1/pack.json")
b1 >> play(x-o-, amp=0.9)

# a single sample → a char (or [urls] for sample-index slots)
loadsample("K", "https://raw.githubusercontent.com/USER/REPO/main/kick.wav")
b2 >> play(K.K.K.K.)`)}
    `);

    const patterns = section('Patterns', `
        ${note('Pattern objects produce a new value each step. Drop them into any param.')}
        ${code(`p1 >> saw([0,2,4,7], amp=PWhite(0.4, 0.9))      # random float
p1 >> pluck([0,4,7], oct=PRand(4, 6))           # random int
p1 >> sine(PRange(0, 7), dur=0.5)               # 0..7 ramp
p1 >> saw([0,4,7], pan=PSine(-1, 1, 8))         # auto-pan
b1 >> play(x-o-, amp=PEuclid(5, 8))             # euclidean accents`)}
    `);

    const perf = section('Performance', `
        ${code(`p1.every(8, 'stutter', 4)     # every 8 beats, stutter x4
p1.every(16, 'reverse')       # reverse the degree array
p1.solo()                     # mute everyone else
p1.soloDrop(8)                # solo 8 beats then restore
drop(14, 2)                   # silence a random subset, then restore
unsolo()                      # restore all`)}
        ${note('Shortcuts: <b>Alt+S</b> solo · <b>Alt+O</b> soloDrop(8) · <b>Alt+X</b> comment+stop the player at the cursor.')}
    `);

    const sections = section('Section sequencer ( #@ )', `
        ${note('Put the cursor on a <code>#@</code> line and Ctrl+Enter. Sections auto-advance after their beat count. A commented player line (<code># p1 >></code>) stops that player on entry. <code>#@#@</code> groups sections into a foldable track.')}
        ${code(`#@#@ my_set

#@intro(16)
p1 >> dbass([0,-3,0,4], oct=3)
b1 >> play(x.o.x.o.)

#@verse(32)
p1 >> dbass([0,-3,5,4], oct=3)
p2 >> pads([0,3,5], oct=4, dur=4, reverb=0.4)
# b1 >>

#@loop(8, verse:3, fill:1)

#@fill(4, verse:1)
b1 >> play(<x.ox.> [xox] x.x., crush=0.5, bits=4)

#@end(8)`)}
    `);

    return start + drums + synths + axis1 + sometimes + axis2 + axis3 + fx + samples + patterns + perf + sections;
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
        if (key.startsWith('lpf') || key.startsWith('hpf'))    groups.filter.push([key, reg]);
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
        ${note('All FX live in one persistent SynthDef (<code>fd_fx_chain</code>) — one running instance per active player. Every wet/dry section follows the same XFade2 pattern.')}

        ${step(1, 'Add a section to <code>synthdefs/src/fx/fx_chain.scd</code> inside the SynthDef arg list and body:')}
        ${code(`// Add to the |arg| list:
chorus=0, chorus_depth=0.003, chorus_rate=0.5,

// Add a processing section (after the existing ones):
// ── Chorus ─────────────────────────────────────────────────────────
wet = sig + DelayC.ar(sig, 0.05,
    SinOsc.kr(chorus_rate, [0, 0.5pi]) * chorus_depth + chorus_depth);
sig = XFade2.ar(sig, wet * 0.5, chorus * 2 - 1);
// chorus=0 → XFade2 mix=-1 (all dry)
// chorus=1 → XFade2 mix=+1 (all wet)`)}

        ${step(2, 'Recompile:')}
        ${code('./scripts/build.sh fx_chain')}

        ${step(3, 'Register each user-facing param in <code>js/fx/registry.js</code>:')}
        ${code(`chorus:       { scParam: 'chorus',       default: 0,   desc: 'Chorus mix (0=off)' },
chorus_depth: { scParam: 'chorus_depth', default: 0.003,desc: 'Mod depth in seconds' },
chorus_rate:  { scParam: 'chorus_rate',  default: 0.5,  desc: 'Mod rate Hz' },`)}
        ${note('Any key in <code>FX_REGISTRY</code> is automatically: routed to the FX chain (not the synth), updated every beat step (supports TimeVars), available in autocomplete, and shown in the FX docs tab.')}
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
        ${step(3, 'Copy output into WebFoxDot:')}
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

// ── Panel lifecycle ────────────────────────────────────────────────────────────

export function initDocs() {
    const panel = document.getElementById('docs-panel');
    const tabs  = panel.querySelectorAll('.docs-tab');
    const body  = panel.querySelector('#docs-body');

    const CONTENT = {
        examples:  buildExamples,
        shortcuts: buildShortcuts,
        synths:    buildSynths,
        fx:        buildFX,
        patterns:  buildPatterns,
        functions: buildFunctions,
        guide:     buildGuide,
    };

    // Cache rendered content so we don't rebuild on every switch
    const cache = {};

    function showTab(name) {
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
        if (!cache[name]) cache[name] = CONTENT[name]();
        body.innerHTML = cache[name];
        body.scrollTop = 0;
    }

    tabs.forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));

    // Click any code block to copy it to the clipboard
    body.addEventListener('click', (e) => {
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

export function toggleDocs() {
    document.getElementById('docs-panel').classList.toggle('hidden');
}
