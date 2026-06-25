// In-app documentation panel — tabs for Shortcuts, Synths, FX, Patterns, Functions.

import { SYNTH_DEFS } from '../synths/registry.js';
import { FX_REGISTRY } from '../fx/registry.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function h(tag, cls, html) {
    return `<${tag}${cls ? ` class="${cls}"` : ''}>${html}</${tag}>`;
}
function section(title, body, id) {
    return `<div class="docs-section"${id ? ` id="ex-${id}"` : ''}>
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
    { key: 'Alt+S',              desc: 'Solo player at cursor — mute all others' },
    { key: 'Ctrl+Alt+S',         desc: 'Unsolo — restore all players' },
    { key: 'Alt+O',              desc: 'SoloDrop — solo 8 beats then restore all' },
    { key: 'Ctrl+;',             desc: 'Stop all players' },
    { key: 'Ctrl+Alt+;',         desc: 'Stop #@ autoplay (players keep running)' },
    { key: 'Ctrl+Alt+P',         desc: 'Jump to the active #@ part' },
    { key: 'Ctrl+Space',         desc: 'Autocomplete (synths, params, FX, patterns, full-call templates)' },
    { key: 'Alt+I',              desc: 'Info on the symbol under the cursor (synth / FX / pattern / function)' },
    { key: 'Alt+↑ / Alt+↓',      desc: 'Nudge value under cursor ±1 or ±0.1' },
    { key: 'Shift+Alt+↑/↓',      desc: 'Nudge value ×10' },
    { key: 'Ctrl+/',             desc: 'Toggle line comment' },
];

export const PATTERNS = [
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
    { name: 'Pacc(type, steps, int)',   desc: 'Accent pattern for amp/amplify. type 0-6 or name (backbeat fourfloor offbeat ghost synco tresillo halftime)' },
    { name: 'PSwing(amount, steps)',    desc: 'Swing: on-beats 1.0, off-beats softer/later by amount' },
    { name: 'PBin(n)',                  desc: 'Binary digits of n (random if 0): PBin(8)→[1,0,0,0]' },
    { name: 'PFDur((n,k), …)',          desc: 'Layered Euclidean density — 1 where any layer hits' },
    { name: 'PLife(chaos, lo, hi, n)',  desc: 'Cellular-automaton values in [lo,hi]; chaos 0=steady .. 1=chaotic' },
];

export const TIMEVARS = [
    { name: 'var(values, durs)',        desc: 'Step through values, hold each for dur beats' },
    { name: 'linvar(values, durs)',     desc: 'Linear interpolation between values over durs' },
    { name: 'sinvar(values, durs)',     desc: 'Sine-shaped interpolation between values' },
    { name: 'expvar(values, durs)',     desc: 'Exponential interpolation (useful for freq/amp)' },
    { name: 'fi(beats, a, b)',          desc: 'Envelope (use with _ suffix): fade in a→b over beats, holds at b. e.g. lpf_=fi(0.5, 400, 4000)' },
    { name: 'fo(beats, a, b)',          desc: 'Envelope (_ suffix): fade out b→a over beats, holds at a' },
    { name: 'fb(beats, a, b)',          desc: 'Envelope (_ suffix): bounce a↔b every beats (wobble). Loops within sus' },
];

export const FUNCTIONS = [
    { name: 'play(pattern, opts)',      desc: 'Drum/sample pattern. Chars map to samples. space=rest, (Xo)=fire both at once, [XoX]=subdivide into sub-steps, {Xo}=random pick, &lt;Xo&gt;=alternate on successive hits. Quotes optional if pattern has spaces. opts: amp, dur (default 1), pan, rate, sample' },
    { name: 'loadsample(char, url)',    desc: 'Load a WAV from a URL (or [urls]) and assign it to a play() char. GitHub raw / release URLs work. e.g. loadsample("K", "https://raw.githubusercontent.com/u/r/main/kick.wav")' },
    { name: 'loadpack(url)',            desc: 'Load a pack: JSON manifest {char: url | [urls]}. Relative URLs resolve against the pack location' },
    { name: 'drop(playTime, dropTime, nbloop)', desc: 'Silence a random subset of players for dropTime beats, then restore — bar-aligned. Default: 14, 2, 1' },
    { name: 'soloRnd(time)',            desc: 'Solo a random active player for `time` beats, beat-aligned. Default: 8' },
    { name: 'unsolo()',                 desc: 'Restore all players muted by solo / Alt+S' },
    { name: 'p1.solo(beats)',          desc: 'Mute others; with `beats`, restore after N beats (beat-aligned)' },
    { name: 'p1.stop(beats)',          desc: 'Stop now, or after N beats with `beats`' },
    { name: 'rest()',                   desc: 'Silence for one step (use in degree list)' },
    { name: 'print(...args)',           desc: 'Print to the log panel' },
    { name: 'p1.solo()',               desc: 'Mute all other players (they keep running)' },
    { name: 'p1.soloDrop(beats)',      desc: 'Solo for N beats, then restore. Default: 8' },
    { name: '...every(beats, method)', desc: 'Call a player method every N beats — chainable on the call: p1 >> saw([0,4]).every(8, "reverse"). Also p1.every(8, "stutter", 4)' },
    { name: '...after(beats, method)', desc: 'One-shot: call a player method after N beats. e.g. play("xGx").after(4, "stop")' },
    { name: 'p1.stutter(n)',           desc: 'Roll the current step n times within its duration (n = number of rapid repeats). Sequence carries on normally' },
    { name: 'p1.reverse()',            desc: 'Reverse degree array for one cycle' },
    { name: 'p1.shuffle()',            desc: 'Shuffle degree array for one cycle' },
];

export const PLAYER_PARAMS = [
    { name: 'degree',   desc: 'Scale degree. List for sequences, (a,b) for chords, null for rest' },
    { name: 'oct',      desc: 'Octave (default varies by synth, usually 4–5)' },
    { name: 'amp',      desc: 'Amplitude 0–1 (default 0.7–0.9)' },
    { name: 'dur',      desc: 'Step duration in beats (default 1)' },
    { name: 'sus',      desc: 'Note sustain in beats (defaults to dur)' },
    { name: 'pan',      desc: 'Stereo position -1 (left) to +1 (right)' },
    { name: 'attack',   desc: 'Envelope attack in seconds' },
    { name: 'release',  desc: 'Envelope release in seconds' },
];

// ── Changelog ────────────────────────────────────────────────────────────────
// Keep this updated with every alpha. Newest first. The version shown next to
// the title in the toolbar should match the top entry's `v`.
export const VERSION = 'alpha10';

// items: a string, or { t: text, ex: examples-anchor-id } to link to a live example.
const CHANGELOG = [
    { v: 'alpha10', title: 'Persistent player attributes', items: [
        'Re-assigning an active player inherits its previous params — p1 >> dbass(dur=4) then p1 >> dbass(oct=6) keeps dur=4',
        '~p1 >> … resets the player to defaults (no inheritance), like FoxDot\'s tilde',
    ]},
    { v: 'alpha09', title: 'Editor inspector · solo/drop · anti-click', items: [
        'Alt+I — info tooltip on the symbol under the cursor (synth, FX, pattern, function); for patterns/timevars it evaluates and shows the generated values',
        'Autocomplete: full-call templates (synth with every param), FX on play() too, pattern/timevar value suggestions after "=", "⋯ all params" / "⋯ all fx" expansions',
        { t: 'solo(beats) and stop(beats) — auto-restore/stop after N beats; soloRnd(time) solos a random player; all beat-aligned', ex: 'perf' },
        { t: 'drop() now lands on the bar grid (beat-scheduled, not wall-clock)', ex: 'perf' },
        'Ctrl+Alt+S — unsolo (restore all)',
        'saw anti-click: sine-curve envelope + DC blocker + minimum edge times',
        'Composition: active #@ part highlighted + blinks on (re)eval; Composition side-panel lists parts (click to jump); Ctrl+Alt+P jump to active part; Ctrl+Alt+; stop autoplay',
        '.every(beats, method) now chainable on the call: p1 >> saw([0,4]).every(8, "reverse")',
        'rec button — records your live evals and generates a #@ composition you can replay',
    ]},
    { v: 'alpha08', title: 'Probability · P patterns · .after · editor', items: [
        { t: 'Probability family: .always .almostAlways .often .sometimes .rarely .almostNever .never — default chance overridable with a leading number; trailing kwargs temporarily override params; chainable; rolls once per cycle', ex: 'sometimes' },
        'stutter() rewritten: rolls the current step n times within its duration (n = repeats), no longer mangles dur',
        { t: 'P patterns: P*[a,b,c] → random pick, P[a,b,c] → cyclic list, P(a,b,c) → chord', ex: 'patterns' },
        { t: 'TimeVars accept patterns inside them: var([PRand([4,16,32]), 1/4])', ex: 'patterns' },
        { t: 'Player transposition: synth(...) + N or + (a,b,c) adds to the degree (a chord)', ex: 'patterns' },
        { t: '.unison(n, detune) — n detuned + stereo-spread voices (synths and samples)', ex: 'patterns' },
        '.after(beats, method) — one-shot delayed action (e.g. play(...).after(4, "stop"))',
        { t: 'Patterns: Pacc (accents), PSwing, PBin, PFDur, PLife (cellular automaton)', ex: 'grooves' },
        { t: 'amplify param — per-step amp multiplier (e.g. amp=Pacc("ghost"))', ex: 'grooves' },
        { t: 'FX: resonbank (resonator), rgate (rhythmic gate), mverb + cheapverb (reverbs), chorus, tremolo', ex: 'fx' },
        { t: 'Synths: bass, prophet', ex: 'synths' },
        'Param aliases: atk→attack, rel→release',
        'Editor: solo-mode autosave across refresh; clear / examples toolbar buttons; dbass default octave 3→4',
    ]},
    { v: 'alpha07', title: 'In-browser synths · lazy samples', items: [
        { t: 'defsynth() — define SynthDefs live in the browser, no SuperCollider or server (in-browser .scsyndef compilation, validated against sclang)', ex: 'defsynth' },
        { t: 'UGen DSL: oscillators, noise, filters, Pan2, Out, EnvGen + Env.perc/linen/triangle', ex: 'defsynth' },
        { t: 'Lazy sample loading — boot reads the manifest only; each char loads on first use (instant boot, memory scales with use)', ex: 'samples' },
        'Firefox stability — buffer pool allocated once at boot so shared-memory grow() (a Firefox crash trigger) is never called',
    ]},
    { v: 'alpha06', title: 'Groups · probability · nested brackets · drum FX', items: [
        { t: 'Group/chord params: (0,4,7) plays a chord; grouped params like pan=(-1,1) zip across simultaneous voices', ex: 'axis1' },
        { t: '.sometimes(method, …) / .sometimes(prob, method, …) — probabilistic per-step modifiers', ex: 'sometimes' },
        { t: 'Nested play() brackets via a recursive parser: &lt;x.&gt;&lt;[--]&gt;&lt;x.&gt;', ex: 'drums' },
        { t: 'play() now routes through the FX chain — lpf/hpf/reverb/echo/crush work on drums', ex: 'fx' },
        'Unknown-param safety warnings in the log (synths and play)',
        'Async pack loading — concurrent batches + yields, no UI freeze on large packs',
    ]},
    { v: 'alpha05', title: 'Config · examples · collab fix', items: [
        'config.json — one source of truth for hosts/ports (static server, collab server, browser)',
        'Examples docs tab — copy-paste overview of everything (click to copy)',
        'Multiplayer: separated Yjs and app-message channels (fixed "Unexpected end of array")',
        'loadpack progress in the log + clearer sample error reporting',
    ]},
    { v: 'alpha04', title: 'Deploy routing · mobile · resilience', items: [
        'Multiplayer WebSocket URL derived from the page (works behind a reverse proxy)',
        'Mobile / responsive layout fixes',
        'Graceful skip when the sample bank is unreachable',
    ]},
    { v: 'alpha03', title: 'Multiplayer · sections · samples · envelopes', items: [
        'Multiplayer (opt-in via ?session=slug): Yjs collaborative editing, shared cursors, eval broadcast, clock sync',
        { t: 'Section sequencer: #@ sections + #@#@ tracks, auto-advance, weighted loop, end/clear', ex: 'sections' },
        { t: 'External samples: loadsample / loadpack from any public URL (+ the webfoxdot-kit default pack)', ex: 'samples' },
        { t: 'Axis-3 parameter envelopes (fi/fo/fb via the _ suffix) on FX params', ex: 'axis3' },
        { t: 'New synths: bell, pads · new FX: crush (bitcrush)', ex: 'synths' },
    ]},
    { v: 'alpha02', title: 'Unified language · more synths', items: [
        { t: 'Unified bracket system across synths and play(): () simultaneous · [] subdivide · {} random · &lt;&gt; alternate', ex: 'axis1' },
        { t: 'New synths: pluck, pulse, blip, fm', ex: 'synths' },
        '. = universal rest · play() quotes optional · p1.method() supported',
        'Theme-aware editor token colours · dur default unified to 1',
    ]},
    { v: 'alpha01', title: 'Foundation', items: [
        'Browser-native FoxDot: scsynth compiled to WebAssembly (SuperSonic)',
        'JS transpiler for FoxDot-style syntax · pattern + time-var layer · per-player FX chain',
        'Crashpanel, in-app docs, themes, live nudge/solo/drop performance tools',
    ]},
];

// ── HTML builders ──────────────────────────────────────────────────────────────

// Extract every Examples code block as runnable editor text (same source as the
// Examples tab, so they never drift). Section titles become comment headers.
export function examplesAsCode() {
    const doc = new DOMParser().parseFromString(buildExamples(), 'text/html');
    const out = ['# WebFoxDot examples — run a block with Ctrl+Enter (blocks are separated by blank lines)', ''];
    doc.querySelectorAll('.docs-section').forEach(sec => {
        const title = sec.querySelector('.docs-section-title')?.textContent.trim();
        sec.querySelectorAll('.docs-code').forEach(pre => {
            if (title) out.push('# ══ ' + title + ' ══');
            out.push(pre.textContent.replace(/\s+$/, ''), '');
        });
    });
    return out.join('\n');
}

function buildChangelog() {
    const li = (item) => {
        if (typeof item === 'string') return `<li>${item}</li>`;
        const link = item.ex
            ? ` <a class="docs-link" data-anchor="ex-${item.ex}">→ example</a>` : '';
        return `<li>${item.t}${link}</li>`;
    };
    return CHANGELOG.map(rel => `
        <div class="docs-section">
            <div class="docs-section-title">${rel.v}${rel.title ? ' — ' + rel.title : ''}</div>
            <ul class="docs-changelog">${rel.items.map(li).join('')}</ul>
        </div>`).join('');
}

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
        ${note('<b>Ctrl+Space</b> autocompletes (synths, params, FX, patterns). <b>Alt+I</b> shows info on the symbol under the cursor — and for a pattern it evaluates and shows the values it makes.')}
        ${code(`Clock.bpm = 120
Scale.default = "minor"
Root.default = 0`)}
    `);

    const drums = section('Drums — play()', `
        ${note('Chars map to samples. <code>.</code> or space = rest. Brackets: <code>(Xo)</code> together · <code>[Xo]</code> subdivide · <code>{Xo}</code> random · <code>&lt;Xo&gt;</code> alternate.')}
        ${code(`b1 >> play(x.o., amp=0.9)              # kick / snare
b2 >> play(x-o-, amp=0.9)                  # - = closed hihat
b3 >> play(x.[oo]x.<o->, amp=0.8)          # subdivide + alternate
b4 >> play((x*)..{o-}.., amp=0.8)          # together + random
b5 >> play(<x.><[--]><x.>, amp=0.8)        # brackets nest
b6 >> play(x-o-, lpf=1500, reverb=0.3)     # FX work on drums
b7 >> play(x-o-).sometimes("stutter", 2)   # probabilistic`)}
    `, 'drums');

    const grooves = section('Grooves & accents', `
        ${note('Accent / density patterns shape amp & feel. <code>Pacc</code> templates (ghost, tresillo, offbeat…), <code>PSwing</code> shuffle, <code>PFDur</code> Euclidean density, <code>PLife</code> generative. Drop them on <code>amp</code> or <code>amplify</code> (a per-step multiplier).')}
        ${code(`b1 >> play(x., amp=Pacc("tresillo"))        # 3+3+2 accents
b2 >> play(-, amp=Pacc("ghost", 8))         # ghost-note hats
b3 >> play(x-o-, amplify=PSwing(0.3))              # swing feel
b4 >> play(x..x..x., amplify=PFDur((3,8),(5,8)))   # layered density
b5 >> play(o., amplify=PLife(0.6))           # generative accents`)}
    `, 'grooves');

    const synths = section('All synths', `
        ${note('Degree arrays are scale steps. Each synth\'s extra params are shown filled in with their defaults. Newest: bass, prophet.')}
        ${note('A playing player <b>inherits</b> its params on re-run — <code>p1 >> saw([0,4], dur=4)</code> then <code>p1 >> saw([0,4], oct=6)</code> keeps <code>dur=4</code>. Prefix <code>~</code> to reset to defaults: <code>~p1 >> saw([0,4])</code>.')}
        ${code(synthLines)}
    `, 'synths');

    const axis1 = section('Axis 1 — sequences, chords & groups', `
        ${note('<code>[a,b,c]</code> = a per-step sequence. <code>(a,b,c)</code> = a chord/group fired together — also works on any param (zipped across voices). <code>.</code> = rest.')}
        ${code(`p1 >> saw([0, (0,4,7), 4, (2,5,9)], oct=4)   # chord on steps 2 & 4
p1 >> dbass((0,4,7), oct=4)                  # a held chord
p1 >> saw([0,4,7], pan=(-1,1), amp=(0.6,0.3)) # grouped params zip into voices
p1 >> sine([0, ., 4, .], oct=5)              # . = rest`)}
    `, 'axis1');

    const sometimes = section('Probability modifiers', `
        ${note('Roll a chance each step and apply a player method. Aliases by likelihood: <code>always</code>(1) · <code>almostAlways</code>(.9) · <code>often</code>(.7) · <code>sometimes</code>(.5) · <code>rarely</code>(.25) · <code>almostNever</code>(.1) · <code>never</code>(0). A leading number overrides the chance. Trailing kwargs temporarily change params for that trigger. Chain several — each rolls on its own.')}
        ${code(`p1 >> saw([0,4,7,5], oct=4).sometimes("stutter", 4)
p1 >> dbass([0,-3], oct=4).often(0.8, "reverse")
b1 >> play(x-o-).rarely("stutter", 2, rate=2, amp=0.6)   # kwargs override
b1 >> play(x.o.).often("stutter", 2).sometimes("stutter", 8)  # chained`)}
    `, 'sometimes');

    const axis2 = section('Axis 2 — time-varying values (var family)', `
        ${note('Evolve a parameter over beats. <code>var</code> steps; <code>linvar/sinvar/expvar</code> interpolate. Args: (values, durations-in-beats).')}
        ${code(`p1 >> dbass([0,-3,0,4], oct=4, cutoff=linvar([400, 4000], [8, 8]))
p1 >> saw([0,4,7], cutoff=sinvar([500, 5000], [4]))
p1 >> pulse([0,3], width=var([0.2, 0.5, 0.8], [2, 2, 4]))
p1 >> fm([0,7], index=expvar([1, 12], [16]))`)}
    `);

    const axis3 = section('Axis 3 — parameter envelopes ( _ suffix )', `
        ${note('A <code>_</code> suffix runs an envelope per note. <code>fi</code> fade in, <code>fo</code> fade out, <code>fb</code> bounce/wobble. Signature: <code>f(beats, from, to)</code>. <b>FX-chain params only</b> (lpf, hpf, reverb, echo, crush…).')}
        ${code(`p1 >> saw([0,4], oct=4, dur=1, lpf_=fi(0.5, 400, 5000))   # filter opens
p1 >> saw([0,3], oct=3, dur=1, lpf_=fo(1, 5000, 400))     # filter closes
p1 >> saw([0,3], oct=3, dur=1, lpf_=fb(0.25, 300, 3000))  # wobble`)}
    `, 'axis3');

    const defsynthEx = section('Define synths live — defsynth()', `
        ${note('Build a SynthDef in the browser (no SuperCollider needed) and play it like a built-in. The build fn gets the standard controls (out, note, amp, sus, pan, attack, release) + your extras, each a UGen. Convert pitch with <code>note.midicps()</code>; end with <code>Out.ar(out, …)</code>; use <code>doneAction:2</code> to free the voice. Run the defsynth block once, then play it.')}
        ${code(`defsynth("mylead", { cutoff: 2000, rq: 0.4 }, ({ out, note, amp, sus, pan, attack, release, cutoff, rq }) => {
  const freq = note.midicps()
  const env  = EnvGen.ar(Env.linen(attack, sus, release), { doneAction: 2 })
  const sig  = RLPF.ar(Saw.ar(freq), cutoff, rq).mul(env).mul(amp)
  Out.ar(out, Pan2.ar(sig, pan))
})

p1 >> mylead([0, 4, 7, 4], oct=4, cutoff=3000, dur=0.5)`)}
        ${note('UGens available: SinOsc Saw LFSaw Pulse VarSaw LFTri Blip Impulse, WhiteNoise PinkNoise LFNoise0/1/2, RLPF RHPF LPF HPF BPF, Line XLine, Pan2, Out, EnvGen + Env.perc/linen/triangle. Math: .mul .add .sub .div .midicps() .abs() .neg()')}
    `, 'defsynth');

    const fx = section('FX — append to any player', `
        ${note('FX run on a persistent per-player chain. Combine freely — on synths AND on play() drums. Available: lpf hpf crush reverb mverb cheapverb resonbank rgate chorus tremolo tanh echo.')}
        ${code(`p1 >> saw([0,4,7], lpf=2000, lpf_rq=0.3)        # low-pass
p1 >> saw([0,4,7], hpf=300, reverb=0.4, room=0.8)  # high-pass + reverb
p1 >> saw([0,4,7], echo=0.4, echo_time=0.375)      # delay
p1 >> dbass([0,-3], crush=0.6, bits=4, srate=6000) # bitcrush
p1 >> prophet([0,4,7], chorus=0.6, chorus_rate=0.5)# chorus
b1 >> play(x.o., resonbank=0.3, rbfreq=[47,50,62]) # resonator bank
b2 >> play(x-o-, rgate=0.8, rgaterate=8)           # rhythmic gate
b3 >> play(x.o., mverb=0.6, mverbfreeze=1)         # frozen reverb
b4 >> play(x-o-, tremolo=0.8, trem_rate=8)         # tremolo`)}
    `, 'fx');

    const samples = section('External samples', `
        ${note('Load WAVs from any public URL into your buffers. In multiplayer everyone loads the same URL, so put a loadpack at the top of the shared doc.')}
        ${code(`# default kit (the original FoxDot bank)
loadpack("https://cdn.jsdelivr.net/gh/CrashServer/webfoxdot-kit@v1/pack.json")
b1 >> play(x-o-, amp=0.9)

# a single sample → a char (or [urls] for sample-index slots)
loadsample("K", "https://raw.githubusercontent.com/USER/REPO/main/kick.wav")
b2 >> play(K.K.K.K.)`)}
    `, 'samples');

    const patterns = section('Patterns', `
        ${note('Pattern objects produce a new value each step. P shorthands: <code>P*[a,b,c]</code> random pick · <code>P[a,b,c]</code> cyclic list · <code>P(a,b,c)</code> chord. TimeVars can hold patterns.')}
        ${code(`p1 >> saw([0,2,4,7], amp=PWhite(0.4, 0.9))      # random float
p1 >> pluck([0,4,7], oct=PRand(4, 6))           # random int
p1 >> sine(PRange(0, 7), dur=0.5)               # 0..7 ramp
p1 >> saw([0, 3, 5, P*[7,10,5]], oct=4)         # P*[...] = random pick
p1 >> saw([0,4,7], dur=var([P*[1,2], 1/4]))     # pattern inside a var
p1 >> saw([0,4,7], oct=4) + 7                    # transpose up
p1 >> dbass([0,3,5]) + (0,3,7)                   # + a group = chord
p1 >> saw([0,4,7], oct=4).unison(4, 0.4)         # 4 detuned voices, spread
b1 >> play(x., amp=Pacc("ghost"))         # accent pattern
b2 >> play(x-o-, amplify=PLife(0.5))            # cellular-automaton amp`)}
    `, 'patterns');

    const perf = section('Performance', `
        ${code(`p1.every(8, 'stutter', 4)     # every 8 beats, stutter x4
p1.every(16, 'reverse')       # reverse the degree array
p1.solo(8)                    # solo 8 beats then restore (beat-aligned)
p1.stop(16)                   # stop after 16 beats
soloRnd(8)                    # solo a random player for 8 beats
drop(14, 2)                   # bar-aligned drop, then restore
unsolo()                      # restore all`)}
        ${note('Shortcuts: <b>Alt+S</b> solo · <b>Ctrl+Alt+S</b> unsolo · <b>Alt+O</b> soloDrop(8) · <b>Alt+X</b> comment+stop the player at the cursor.')}
    `, 'perf');

    const sections = section('Section sequencer ( #@ )', `
        ${note('Put the cursor on a <code>#@</code> line and Ctrl+Enter. Sections auto-advance after their beat count. A commented player line (<code># p1 >></code>) stops that player on entry. <code>#@#@</code> groups sections into a foldable track.')}
        ${code(`#@#@ my_set

#@intro(16)
p1 >> dbass([0,-3,0,4], oct=4)
b1 >> play(x.o.)

#@verse(32)
p1 >> dbass([0,-3,5,4], oct=4)
p2 >> pads([0,3,5], oct=4, dur=4, reverb=0.4)
# b1 >>

#@loop(8, verse:3, fill:1)

#@fill(4, verse:1)
b1 >> play(<x.ox.> [xox] x.x., crush=0.5, bits=4)

#@end(8)`)}
    `, 'sections');

    return start + drums + grooves + synths + axis1 + sometimes + axis2 + axis3 + defsynthEx + fx + samples + patterns + perf + sections;
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
        changelog: buildChangelog,
    };

    // Cache rendered content so we don't rebuild on every switch
    const cache = {};

    function showTab(name) {
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
        if (!cache[name]) cache[name] = CONTENT[name]();
        body.innerHTML = cache[name];
        body.scrollTop = 0;
    }
    _showTab = showTab;

    tabs.forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));

    body.addEventListener('click', (e) => {
        // Changelog "→ example" link: jump to the Examples tab + scroll to anchor
        const link = e.target.closest('.docs-link');
        if (link) {
            const anchor = link.dataset.anchor;
            showTab('examples');
            const el = body.querySelector('#' + anchor);
            if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.classList.add('ex-flash'); setTimeout(() => el.classList.remove('ex-flash'), 1200); }
            return;
        }
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
