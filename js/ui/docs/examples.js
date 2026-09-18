// examples.js — the examples library, and the accessors that turn a section of it
// back into runnable code.
//
// 154KB of material. attack() pulls parts out of it, the examples dropdown lists it
// and the galaxy links to it; autocomplete needs only exampleList/exampleCode and
// used to import the whole of docs.js — changelog included — to reach them.

import { h, section, code, note, step } from './html.js';
// One example builds a row per synth from the registry — the only thing outside the
// docs this file needs.
import { SYNTH_DEFS } from '../../synths/registry.js';

export function buildExamples() {
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

    const welcome = section('Introduction — boot, load the kit, run #@intro', `
        ${note('Hiya! <b>1.</b> Click <b>boot</b> (top-left). <b>2.</b> Put the cursor on a <code>loadpack</code> line below and press <b>Ctrl+Enter</b> to load the sound kit. <b>3.</b> Put the cursor on <code>#@intro(16)</code> and press Ctrl+Enter — the set plays and auto-advances (it branches with <code>#@goto</code>, so it never plays the same way twice). <b>Ctrl+;</b> stops everything.')}
        ${note('Best in Chromium / Brave / Edge — Firefox has audio + sample issues. Keys: Ctrl+Enter run line · Ctrl+Alt+Enter run block · Alt+X stop · Alt+↑/↓ nudge a number live. In a <code>?session=</code> room, say hi in the chat (right panel) — leave a comment if you connect!')}
        ${code(`# load the kit — evaluate ONE of these (cursor on it, Ctrl+Enter)
loadpack("https://raw.githubusercontent.com/CrashServer/webfoxdot-kit/v1/pack.json")
# CDN mirror (faster, but sometimes cold — hard-refresh & try the other if silent):
# loadpack("https://cdn.jsdelivr.net/gh/CrashServer/webfoxdot-kit@v1/pack.json")`)}
        ${code(`#@#@ welcome_set

#@intro(16)
p1 >> pads([0, (0,4,7), 5, (2,5,9)], oct=4, dur=4, attack=0.5, lpf=linvar([400, 4500], [16]), reverb=0.5, room=0.85, amp=0.5)
b1 >> play(x..., amp=0.6)

#@build(16)
p1 >> dbass([0, -3, 0, 4], oct=4, mverb=0.3, tanh=0.4, drive=3, amp=0.8).unison(2)
b1 >> play(x.x.x.x., amp=0.8).sometimes("stutter", 2)
h1 >> play(-.-.-.-., hpf=5000, amp=Pacc("ghost"))
p2 >> saw([0, (0,4,7), 4, (2,5,9)], oct=4, dur=0.5, chorus=0.6, lpf=sinvar([900, 6000], [8]), amp=0.4).every(8, "reverse")

#@dropA(16)
p2 >> saw([0, (0,4,7), 4, (2,5,9)], oct=4, dur=0.5, chorus=0.6, lpf=sinvar([900, 6000], [8]), amp=0.4).every(8, "reverse")
b1 >> play(X.x.X.x., amp=0.9)

#@dropB(16)
p3 >> blip([0,4,7,5,7,4], oct=6, dur=0.25, echo=0.4, echo_time=0.375, amp=0.25).sometimes("stutter", 4)
b1 >> play(X.<xx>X.x., amplify=PFDur((3,8),(5,8)), amp=0.9)
h1 >> play([-.][-o], hpf=6000, amp=Pacc("offbeat"))

#@goto(dropA, 0.5)   # 50% loop the drop, else go on

#@dropC(16)
p2 >> prophet([0, (0,4,7), 4, (2,5,9)], oct=6, dur=0.5, chorus=0.7, lpf=sinvar([1200, 7000], [4]), amp=0.35).every(8, "reverse")

#@goto(dropB, 0.4)   # 40% back to dropB, else continue

#@break(16)
# p3 >>
# h1 >>
p2 >> prophet((0,4,7), oct=4, dur=2, mverb=0.85, mverbfreeze=1, amp=0.4)
b1 >> play(x..., amp=0.6)

#@goto(dropA, 0.5)   # 50% back into the drop, else resolve

#@outro(16)
~p1 >> bell([0, 4, 7, 11], oct=5, dur=1, reverb=0.6, room=0.9, lpf=linvar([5000, 600], [16]), amp=linvar([0.5, 0], [16]))

#@end(8)`)}
    `, 'welcome');

    const start = section('Start here', `
        ${note('Boot audio first (the <b>boot</b> button). Put the cursor on a line and press <b>Ctrl+Enter</b> to run it; <b>Ctrl+Alt+Enter</b> runs the whole block. Edit and re-run live. <b>Ctrl+;</b> stops everything (or <b>Ctrl/Cmd+.</b> from anywhere). Click any code box below to copy it.')}
        ${note('<b>Ctrl+Space</b> autocompletes (synths, params, FX, patterns). <b>Alt+I</b> shows info on the symbol under the cursor — and for a pattern it evaluates and shows the values it makes.')}
        ${code(`Clock.bpm = 120
Scale.default = "minor"
Root.default = 0`)}
    `, 'start');

    const drums = section('Drums — play()', `
        ${note('Chars map to samples. <code>.</code> or space = rest. Brackets: <code>(Xo)</code> together · <code>[Xo]</code> alternate · <code>{Xo}</code> random · <code>&lt;Xo&gt;</code> subdivide.')}
        ${code(`b1 >> play(x.o., amp=0.9)              # kick / snare
b2 >> play(x-o-, amp=0.9)                  # - = closed hihat
b3 >> play(x.<oo>x.[o-], amp=0.8)          # subdivide + alternate
b4 >> play((x*)..{o-}.., amp=0.8)          # together + random
b5 >> play([x.][<-->][x.], amp=0.8)        # brackets nest
b6 >> play(x-o-, lpf=1500, reverb=0.3)     # FX work on drums
b7 >> play(x-o-).sometimes("stutter", 2)   # probabilistic`)}
        ${note('<b>pbuild(genre)</b> generates a genre drum pattern as a play() string. Genres: techno · ebm · dnb · house · breaks · halftime · industrial · reggae · afro. <code>evolve</code> = bars before it loops (each a mutation, so the groove drifts) · <code>fill</code> every N bars · <code>density</code> 0–1 thins hits · <code>mute</code> a layer · per-layer access via <code>pkit()</code>.')}
        ${code(`b1 >> play(pbuild("techno"), dur=0.25)
b1 >> play(pbuild("house", evolve=8, fill=4, density=0.8), dur=0.25)
b1 >> play(pbuild(0, 16), dur=0.25)                  # genre by index + evolve=16
b1 >> play(pbuild("dnb", snare=PBin(4), hat=[1,0]), dur=0.25)   # gate layers per bar
b1 >> play(pbuild("house", snare=0, fill={4,2}), dur=0.25)      # cut snare; random fills
kit = pkit("breaks")                                 # per-layer access
b1 >> play(kit.kick, dur=0.25)
h1 >> play(kit.hat, dur=0.25)`)}
        ${note('<b>.drummer()</b> turns a play() player into a self-evolving rock drummer (FoxDot/CrashServer port): it picks a random groove + fill, drops the fill in at the end of each loop, then re-randomises every <code>durloop</code> beats (default 16). Step dur defaults to 0.5.')}
        ${code(`b1 >> play("x").drummer()                   # auto rock drummer
b1 >> play("x").drummer(8, 0.25)            # 8-beat loop, 1/16 steps
b1 >> play("x", sample=2).drummer().solo()  # chains with solo/stop`)}
    `, 'drums');

    const grooves = section('Grooves & accents', `
        ${note('Accent / density patterns shape amp & feel. <code>Pacc</code> templates (ghost, tresillo, offbeat…), <code>PSwing</code> shuffle, <code>PFDur</code> Euclidean density, <code>PLife</code> generative. Drop them on <code>amp</code> or <code>amplify</code> (a per-step multiplier).')}
        ${code(`b1 >> play(x., amp=Pacc("tresillo"))        # 3+3+2 accents
b2 >> play(-, amp=Pacc("ghost", 8))         # ghost-note hats
b3 >> play(x-o-, amplify=PSwing(0.3))              # swing feel
b4 >> play(x..x..x., amplify=PFDur((3,8),(5,8)))   # layered density
b5 >> play(o., amplify=PLife(0.6))           # generative accents`)}
        ${note('<b>Feel:</b> <code>delay</code> nudges a note off the grid (in beats) — micro-timing without changing the pattern. <code>.human(velocity, humanize, swing)</code> does it for you: random velocity + timing jitter, with optional swing %.')}
        ${code(`b1 >> play(x-o-, delay=[0, 0.04])          # push the off-beats late
b2 >> play(x-o-).human(30, 8, 10)          # humanise: vel 30, jitter 8%, swing 10%
p1 >> saw([0,4,7], dur=0.5).human(20, 6)   # human feel on a synth too
b3 >> play(PEuclid2(3, 8, ".", "x"))       # euclid rhythm as play chars → "..x..x.x"`)}
    `, 'grooves');

    const rhythms = section('Rhythm generators (PDur · PBeat · PEuclid · PStep)', `
        ${note('Generate DURATIONS and hit-patterns instead of typing them out. <b>PDur(k, n)</b> spreads k onsets as evenly as possible over n steps and returns their DURATIONS — the classic Euclidean rhythm as a dur pattern (PDur(3,8) = the tresillo). <b>PBeat("x.x.")</b> turns a hit-string into durations (the gaps between the x’s). <b>PEuclid(k,n)</b> returns a 1/0 on/off pattern — great on <code>amplify</code> as a gate; <b>PEuclid2(k,n,off,on)</b> fills two symbols instead (use it as a play() string). <b>PStep(n, a, b)</b> = value a every n-th step, b otherwise (accents / stairs). All accept an alternation <code>&lt;3 5&gt;</code> or a pattern where a number goes, so the rhythm itself can evolve.')}
        ${code(`p1 >> pluck([0,2,4,7], oct=5, dur=PDur(3, 8))          # tresillo dur pattern (3-in-8)
p1 >> pluck([0,2,4,7], oct=5, dur=PDur([3, 5], 8))     # alternate 3-in-8 and 5-in-8
b1 >> play("x", dur=PBeat("x.x.xx.."))                # durations straight from a hit-string
b1 >> play(PEuclid2(5, 8, ".", "x"), dur=0.25)        # 5-in-8 as a play() pattern
h1 >> play("-", dur=0.25, amplify=PEuclid(5, 8))      # 5-in-8 as an on/off gate on amp
p1 >> pluck([0,2,4,7,9,11], oct=5, dur=PStep(4, 1/2, 1/4))  # every 4th step held longer
b1 >> play("x", dur=PDur(7, 16, 0, 1/2))              # 7-in-16, base step 1/2`)}
    `, 'rhythms');

    const synths = section('All synths', `
        ${note('Degree arrays are scale steps. Each synth\'s extra params are shown filled in with their defaults. Newest: plaits.')}
        ${note('A playing player <b>inherits</b> its params on re-run — <code>p1 >> saw([0,4], dur=4)</code> then <code>p1 >> saw([0,4], oct=6)</code> keeps <code>dur=4</code>. Prefix <code>~</code> to reset to defaults: <code>~p1 >> saw([0,4])</code>.')}
        ${code(synthLines)}
        ${note('<b>plaits</b> — a multi-engine macro-oscillator (stock-UGen take on Mutable\'s Plaits). <code>engine</code> 0-7 picks the model: 0 virtual-analog · 1 FM · 2 wavefold · 3 harmonic · 4 wavetable · 5 noise · 6 string · 7 modal. <code>timbre</code>/<code>harm</code>/<code>morph</code> are the three voice controls. Morph the engine live with a var.')}
        ${code(`p1 >> plaits([0,4,7], oct=4, engine=0, timbre=0.6)        # virtual analog
p1 >> plaits([0,4,7], oct=5, engine=1, harm=0.3, timbre=0.7)  # FM
p1 >> plaits([0,4,7], oct=4, engine=var([0,1,4,6], 8), timbre=sinvar([0.2,0.9],[8]))  # morph engines`)}
        ${note('<b>tb303</b> — acid bass: a resonant filter swept by a per-note envelope (<code>env</code> = mod amount, <code>rq</code> = resonance, <code>dist</code> = drive). Pairs beautifully with <code>PArp</code> arpeggios, and tweak <code>cutoff</code> live with attribute assignment.')}
        ${code(`p1 >> tb303(PArp([0,3,7], 5), oct=3, cutoff=300, rq=0.15, env=4, dur=1/4, dist=0.3)
p1.cutoff = linvar([200, 3000], 16)        # ride the filter live
p1.env = PStep(8, 6, 2)`)}
        ${note('<b>choir</b> — formant vowel pad (<code>vowel</code> 0/1/2 = ah/eh/oh). <b>brass</b> — filtered saw with a per-note "blat" (<code>bright</code> scales the sweep). Both love long chords + reverb; add <code>vibrato</code> for life.')}
        ${code(`ch >> choir([(0,3,5),(6,1,3),(5,0,3)], oct=4, dur=4, attack=2, vowel=0, amp=0.4, reverb=0.9, room=0.95)
br >> brass([0,3,5,7,5,3,7,5], oct=5, dur=1/2, bright=0.7, amp=0.4, reverb=0.5, room=0.6)
vc >> prophet([0,5,3,4], oct=4, dur=2, vibrato=0.6, vib_rate=5, vib_depth=0.01, reverb=0.8, room=0.9)  # strings w/ vibrato`)}
    `, 'synths');

    const tweak = section('Live tweaking', `
        ${note('Run this, then put the cursor ON the 2000 and press Alt+Up / Alt+Down — cutoff changes live (±1, or ±0.1 on decimals; Shift+Alt for ×10). The current line re-runs automatically so you hear it instantly.')}
        ${code(`p1 >> saw([0,4,7], oct=4, cutoff=2000, amp=0.5)`)}
        ${note('Alt+I on a name shows what it is — for a pattern it shows the values it makes. Try Alt+I on Pacc below. Ctrl+Space anywhere autocompletes (pick a synth = full call, pick an FX = all its params).')}
        ${code(`b1 >> play(x.x.x.x., amp=Pacc("ghost"))`)}
        ${note('Re-run a player and only change one thing — the rest is kept. Run the first line, then the second: the lpf stays.')}
        ${code(`p2 >> bass([0,-3], oct=3, lpf=900)
p2 >> bass([0,-3,5,4])`)}
        ${note('Or tweak <b>one attribute of a running player</b> without re-stating the line — <code>player.attr = value</code> (the bank\'s core live-coding move):')}
        ${code(`p2 >> tb303([0,3,5,7], oct=3, cutoff=400, rq=0.2, env=3).every(8, "reverse")
p2.cutoff = linvar([300, 4000], 16)        # sweep the filter live
p2.dur = 1/4                               # tighten the rhythm
p2.env = PArp([0,3,7], 5)`)}
        ${note('<b>Master / global FX</b> over the whole mix — for live drops & risers. <code>Server.clearFx()</code> resets it.')}
        ${code(`Server.addFx(lpf=600, mverb=0.4)          # global filter + space
Master().lpf = 4000                        # ride it back open
Server.clearFx()`)}
    `, 'tweak');

    // The mental model, written down once. Everything else on this page is
    // vocabulary; this is the grammar those words belong to.
    const logic = section('The logic — steps, brackets & time', `
        ${note('<b>One player, one playhead.</b> <code>p1 >> saw([0,4,7], dur=1/2)</code> fires a STEP every <code>dur</code> beats and takes the next value from every list you gave it. The lists do not have to be the same length — each advances on its own, so <code>[0,4,7]</code> against <code>dur=[1,1/2]</code> is a 6-step polymeter, not a mistake. That is the first rule: a LIST is indexed by the STEP COUNTER.')}
        ${note('<b>The four brackets are one vocabulary</b>, and they mean the same thing in a <code>play()</code> string as in a degree list. They differ only in WHEN they act: <code>&lt;a b&gt;</code> SUBDIVIDES — both inside one step (a roll/ratchet/flam); <code>[a b]</code> ALTERNATES — a this time round, b the next, one swap per outer loop; <code>(a b)</code> is SIMULTANEOUS — one instant, several voices (a chord, or zipped params); <code>{a b}</code> is RANDOM — re-picked every time that step comes round. They nest freely, and the nesting is where grooves live.')}
        ${note('In a <code>play()</code> string a SPACE (like <code>.</code>) is a REST, not a separator — so <code>[x o]</code> is a three-way alternation x → silence → o. Write <code>[xo]</code> when you mean two things. In a degree LIST the outer <code>[ … ]</code> is the sequence itself, so alternation is a NESTED list: <code>[0, [4, 7]]</code> → 0 4 0 7.')}
        ${code(`d1 >> play("x<xo>o-")     # step 2: two hits INSIDE one step
d1 >> play("x[xo]o-")     # step 2: x, then o, then x … one swap per LOOP
d1 >> play("x(xo)o-")     # step 2: kick and snare in the same instant
d1 >> play("x{xo}o-")     # step 2: a coin flip, every loop
d1 >> play("x.[o<-->]{o-}")                  # …and they nest

p1 >> pluck([0, <4 4 7>, [2, 9], (0,4,7)], oct=5, dur=1/2)   # the same four, on notes`)}
        ${note('<b>Two clocks.</b> A LIST advances per STEP. A TIME-VAR advances on the BEAT CLOCK, whatever the player is doing — so the same <code>var</code> handed to three players moves all three together, and a var on a player that is not even stepping still moves. Ask which one you want and the answer writes itself: "a different note each time it plays" is a list; "this number should be somewhere else in 8 beats" is a var.')}
        ${code(`p1 >> saw([0, 4, 7], dur=1/2)                          # LIST — one value per step
p1 >> saw([0, 4, 7], dur=1/2, lpf=var([400, 4000], 8))  # VAR  — jumps on the clock
p1 >> saw([0, 4, 7], dur=1/2, lpf=linvar([400, 4000], 8))   # …the same, gliding
p1 >> saw([0, 4, 7], dur=1/2) + var([0, 3], 8)         # transpose the whole line on the clock`)}
        ${note('<b>And a third kind: Pvar.</b> Its values are whole PATTERNS — the clock picks which pattern is live while the player keeps stepping through whichever one that is. So a LIST changes the note, a VAR changes a number over time, and a <b>PVAR changes the entire phrase over time</b>. That is how a set moves between parts on its own.')}
        ${code(`p1 >> pluck(Pvar([[0,2,4,7], [7,5,4,0]], 8), oct=5, dur=1/2)      # phrase swap every 8 beats
p1 >> pluck(Pvar([PRoman("i iv v"), PRoman("ii V I")], 16), dur=1)  # progression swap
p1 >> pluck(Pvar([[0,2,4,7], [7,5,4,0]], 16), oct=var([5, 6], 8), dur=1/2, lpf=sinvar([500, 4000], [8]))`)}
        ${note('<b>There are no special slots.</b> Every argument — degree, dur, oct, amp, pan, any FX key — accepts a constant, a list, a group, a generator (<code>PRand</code>, <code>PEuclid</code>, <code>melody()</code>…), a time-var or a Pvar, and they nest inside each other in any combination. When a line stops making sense, the question is almost always "is this thing indexed by the step, or by the clock?"')}
        ${note('<b>Reading it back off the screen:</b> a running line boxes the value currently in charge for a <code>var</code>/<code>Pvar</code> (they step and hold), and slides a needle along the values of a <code>linvar</code>/<code>sinvar</code>/<code>expvar</code> (they really do glide). A computed generator is boxed as a whole, because no written number in it is the one playing.')}
    `, 'logic');

    const axis1 = section('Sequences, chords & groups', `
        ${note('<code>[a,b,c]</code> = a per-step sequence. <code>(a,b,c)</code> = a chord/group fired together — also works on any param (zipped across voices). <code>.</code> = rest.')}
        ${code(`p1 >> saw([0, (0,4,7), 4, (2,5,9)], oct=4)   # chord on steps 2 & 4
p1 >> dbass((0,4,7), oct=4)                  # a held chord
p1 >> saw([0,4,7], pan=(-1,1), amp=(0.6,0.3)) # grouped params zip into voices
p1 >> sine([0, ., 4, .], oct=5)              # . = rest
p1 >> saw([0, 4, 7], dur=[1, 2])                # [..] alternates each time it's reached`)}
    `, 'axis1');

    const sometimes = section('Probability modifiers', `
        ${note('Roll a chance each step and apply a player method. Aliases by likelihood: <code>always</code>(1) · <code>almostAlways</code>(.9) · <code>often</code>(.7) · <code>sometimes</code>(.5) · <code>rarely</code>(.25) · <code>almostNever</code>(.1) · <code>never</code>(0). A leading number overrides the chance. Trailing kwargs temporarily change params for that trigger. Chain several — each rolls on its own.')}
        ${code(`p1 >> saw([0,4,7,5], oct=4).sometimes("stutter", 4)
p1 >> dbass([0,-3], oct=4).often(0.8, "reverse")
b1 >> play(x-o-).rarely("stutter", 2, rate=2, amp=0.6)   # kwargs override
b1 >> play(x.o.).often("stutter", 2).sometimes("stutter", 8)  # chained`)}
    `, 'sometimes');

    const transforms = section('Player transforms (rotate · reverse · stutter…)', `
        ${note('These all reorder or re-fire a player LIVE, and they share ONE technique: each is a player METHOD, so you fire it over time to hear it — chain <code>.every(n, "name")</code> (every n beats), or a probability alias <code>.sometimes("name")</code> / <code>.often(…)</code>, or call it once. They act on the sequence: the degree array for a synth, the drum pattern for <code>play()</code>. (Transforming the pattern OBJECT instead — <code>P[0,2,4].rotate(1)</code> — is a one-time compose-time reorder; these methods change things AS it runs.)')}
        ${note('<b>rotate(n)</b> shifts the sequence n places, permanently — repeated fires keep walking it. <b>mirror()</b> reverses it in place, permanently — a flip that toggles back next fire. <b>reverse()</b> flips for ONE cycle then restores. <b>shuffle()</b> randomises the order for one cycle. <b>stutter(n)</b> rolls a step n fast repeats inside its own duration (a fill); chained directly it rolls every step (= <code>.multiply(n)</code>). <b>degrade(p)</b> silences a random fraction p of steps. <b>jump(n)</b> nudges the playhead n steps (a glitch).')}
        ${code(`# the shared technique — a method + .every() to fire it over time:
p1 >> saw([0, 2, 4, 7], oct=4, dur=1/4).every(4, "rotate")     # walks the riff
p1 >> saw([0, 2, 4, 7], oct=4, dur=1/4).every(8, "mirror")     # flips back & forth
p1 >> saw([0, 2, 4, 7], oct=4, dur=1/4).sometimes("reverse")   # occasional 1-cycle flip
p1 >> saw([0, 2, 4, 7], oct=4, dur=1/4).often("shuffle")       # jumbled order

# stutter — a roll/fill. one-shot via a trigger, or persistent when chained:
b1 >> play(x.o.).every(4, "stutter", 8)     # a x8 fill every 4 beats
b1 >> play(x.o.).sometimes("stutter", 4)    # random rolls
b1 >> play(x.o.).stutter(4)                 # roll EVERY step (= .multiply(4))

# identical on play() drums — rotate/mirror reorder the pattern itself:
d1 >> play(x-o-x-o-).every(4, "rotate")
d1 >> play(x-o-x-o-).sometimes("mirror")

# glitch: thin steps with degrade, nudge with jump, stack transforms:
h1 >> play(-, dur=1/4).degrade(0.3)                     # drop 30% of the hats
h1 >> play(-, dur=1/4).every(8, "jump", 1)              # shove the playhead
p1 >> saw([0,2,4,7], dur=1/4).degrade(0.2).every(4, "rotate")`)}
    `, 'transforms');

    const axis2 = section('Time-varying values (var · linvar · sinvar · expvar · Pvar)', `
        ${note('A time-var evolves a value over BEATS (clock time), independent of the player stepping. The family shares one signature — <code>f(values, durations)</code>: a list of values and how many beats each holds (cycling forever). They differ only in how they move BETWEEN values: <b>var</b> jumps (step/hold), <b>linvar</b> ramps linearly, <b>sinvar</b> eases on a sine curve (smooth to-and-fro), <b>expvar</b> ramps exponentially (musical for pitch/cutoff). Durations may be one number (each value held that long) or a per-value list. <b>Pvar</b> is special: its values are whole PATTERNS, swapped over time — so a player can change its entire phrase mid-flow.')}
        ${note('Put a time-var on ANY param — cutoff, amp, pan, width, index, even dur. A bare number holds; a time-var breathes.')}
        ${code(`p1 >> saw([0,4,7], oct=4, cutoff=var([400, 4000], [4, 4]))    # JUMP: 400 for 4 beats, then 4000 for 4
p1 >> saw([0,4,7], oct=4, cutoff=linvar([400, 4000], [8]))    # RAMP up over 8 beats, then back down
p1 >> saw([0,4,7], oct=4, cutoff=sinvar([400, 4000], [4]))    # SINE sweep — smooth, 4-beat period
p1 >> saw([0,4,7], oct=4, cutoff=expvar([200, 8000], [16]))   # EXP ramp (musical for a filter)
p1 >> saw([0,4,7], oct=4, amp=sinvar([0.2, 0.5], [1]))        # tremolo — amp breathes each beat
b1 >> dbass([0,-3], oct=4, cutoff=linvar([400, 4000], [8, 8]), lpf=sinvar([500,3000],[4]))  # stack several
p1 >> saw(Pvar([[0,4,7], [0,3,7]], [16]), oct=4)              # Pvar: swap the WHOLE riff every 16 beats`)}
    `, 'axis2');

    const randomness = section('Randomness (PRand · PWhite · PBrown · PLorenz · PxRand)', `
        ${note('These pick a fresh value each STEP (unlike time-vars, which follow clock time). <b>PRand(list)</b> or <b>PRand(lo,hi)</b> picks uniformly at random; <b>PxRand</b> is PRand that never repeats the same value twice in a row; <b>PWhite(lo,hi)</b> is continuous white noise (any float in range); <b>PBrown(lo,hi,step)</b> is a random WALK (each value drifts from the last by up to step — smooth wandering); <b>PLorenz(lo,hi)</b> maps a chaotic attractor into the range (organic, non-repeating but structured). Use them on degree for melodies, or on any param for movement.')}
        ${code(`p1 >> saw(PRand([0,2,4,7,9]), oct=4, dur=1/4)          # random note from the set each step
p1 >> saw(PxRand(0, 7), oct=4, dur=1/4)               # random scale degree, never repeats
p1 >> saw(PBrown(0, 12, 1), oct=4, dur=1/4)           # a wandering melody (drifts by <=1)
p1 >> saw([0], oct=5, dur=1/4, cutoff=PLorenz(400, 4000))   # chaotic filter — organic motion
b1 >> play("x", dur=1/4, amp=PWhite(0.4, 1))          # humanised velocity on every hit
p1 >> saw([0,2,4], oct=4, pan=PWhite(-1, 1), dur=1/4) # random stereo placement each step`)}
    `, 'randomness');

    const axis3 = section('Parameter envelopes (_)', `
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

    const synAdditive = section('Synthesis 1 — additive (stack sines)', `
        ${note('<b>Additive synthesis builds a tone by ADDING sine waves.</b> Each partial is a sine at a whole-number multiple of the base frequency (a harmonic); the recipe of amplitudes IS the timbre. Roughly: <code>1/n</code> amplitudes → a bright saw-ish tone · only odd harmonics → hollow/square (clarinet) · a few low partials → soft organ/flute. Run the <code>defsynth</code> block once (Ctrl+Alt+Enter), then play the line below it.')}
        ${code(`defsynth("myadd", {}, ({ out, note, amp, sus, pan, attack, release }) => {
  const f = note.midicps()
  const env = EnvGen.ar(Env.perc(attack, sus, 1, -4), { doneAction: 2 })
  let sig = SinOsc.ar(f)                          // 1st harmonic (fundamental)
  sig = sig.add(SinOsc.ar(f.mul(2)).mul(0.5))     // 2nd, half as loud
  sig = sig.add(SinOsc.ar(f.mul(3)).mul(0.33))    // 3rd
  sig = sig.add(SinOsc.ar(f.mul(4)).mul(0.25))    // 4th
  sig = sig.add(SinOsc.ar(f.mul(5)).mul(0.2))     // 5th
  sig = sig.mul(env).mul(amp).mul(0.15)
  Out.ar(out, Pan2.ar(sig, pan))
})

p1 >> myadd([0, 4, 7], oct=5, dur=1)`)}
        ${note('Try it: change the partial amplitudes (drop the even ones for a hollow tone), or use non-integer ratios like <code>f.mul(2.4)</code> for a bell/metallic sound (inharmonic partials).')}
    `, 'syn-additive');

    const synSubtractive = section('Synthesis 2 — subtractive (filter a rich wave)', `
        ${note('<b>Subtractive synthesis starts from a harmonically RICH wave</b> (saw, pulse, noise) and REMOVES harmonics with a filter. The trick is a filter ENVELOPE sweeping the cutoff — that gives the classic "wow" / pluck. <code>rq</code> is resonance (lower = more emphasis at the cutoff). Two slightly detuned saws make it fat.')}
        ${code(`defsynth("mysub", { cutoff: 2500, rq: 0.3 }, ({ out, note, amp, sus, pan, attack, release, cutoff, rq }) => {
  const f = note.midicps()
  const ampEnv = EnvGen.ar(Env.perc(attack, sus, 1, -4), { doneAction: 2 })
  const fEnv = EnvGen.ar(Env.perc(0.005, sus, 1, -4)).mul(cutoff).add(120)  // cutoff sweep
  const raw = Saw.ar(f).add(Saw.ar(f.mul(1.006)))   // 2 detuned saws = fat
  const sig = RLPF.ar(raw, fEnv, rq).mul(ampEnv).mul(amp).mul(0.25)
  Out.ar(out, Pan2.ar(sig, pan))
})

p1 >> mysub([0, 4, 7], oct=4, cutoff=3500, rq=0.2, dur=1)`)}
        ${note('Try it: lower <code>rq</code> toward 0.1 for a screaming resonant sweep, swap <code>Saw</code> for <code>Pulse.ar(f, 0.5)</code>, or feed <code>WhiteNoise.ar()</code> through the filter for a snare/hat.')}
    `, 'syn-subtractive');

    const synFM = section('Synthesis 3 — FM (frequency modulation)', `
        ${note('<b>FM modulates the FREQUENCY of the carrier oscillator with a second oscillator</b> (the modulator). Two knobs: the carrier:modulator <b>ratio</b> sets harmonicity — integer ratios (1, 2, 3…) sound musical/harmonic, non-integer ratios sound metallic/bell-like; the <b>index</b> (modulation depth) sets brightness (how many sidebands). A decaying index envelope gives the classic DX-style bell / electric piano.')}
        ${code(`defsynth("myfm", { ratio: 2, index: 5 }, ({ out, note, amp, sus, pan, attack, release, ratio, index }) => {
  const car = note.midicps()                       // carrier frequency
  const modFreq = car.mul(ratio)                   // modulator = carrier × ratio
  const env  = EnvGen.ar(Env.perc(attack, sus, 1, -4), { doneAction: 2 })
  const iEnv = EnvGen.ar(Env.perc(0.001, sus, 1, -4)).mul(index).mul(modFreq)  // index falls off
  const mod  = SinOsc.ar(modFreq).mul(iEnv)        // the modulation signal (Hz deviation)
  const sig  = SinOsc.ar(car.add(mod)).mul(env).mul(amp).mul(0.25)
  Out.ar(out, Pan2.ar(sig, pan))
})

p1 >> myfm([0, 4, 7], oct=5, ratio=2, index=6, dur=1)`)}
        ${note('Try it: <code>ratio=1</code> is warm/harmonic, <code>ratio=3.5</code> is clangy/metallic, <code>ratio=1.41</code> is bell-like. Raise <code>index</code> for brightness. A long <code>dur</code> with ratio 1 and low index ≈ an electric piano.')}
    `, 'syn-fm');

    const fx = section('FX — append to any player', `
        ${note('FX run on a persistent per-player chain. Combine freely — on synths AND on play() drums. Available: lpf hpf crush reverb mverb cheapverb resonbank rgate chorus tremolo tanh echo fbdelay shape dist2 chop multicrush vibrato ringmod flanger phaser formant. (And <code>leg</code> scales note length: leg&gt;1 overlaps, leg&lt;1 staccato.)')}
        ${code(`p1 >> saw([0,4,7], lpf=2000, lpr=0.3)        # low-pass
p1 >> saw([0,4,7], hpf=300, reverb=0.4, room=0.8)  # high-pass + reverb
p1 >> saw([0,4,7], echo=0.4, echo_time=0.375)      # delay
p1 >> dbass([0,-3], crush=0.6, bits=4, srate=6000) # bitcrush
p1 >> prophet([0,4,7], chorus=0.6, chorus_rate=0.5)# chorus
b1 >> play(x.o., resonbank=0.3, rbfreq=[47,50,62]) # resonator bank
b2 >> play(x-o-, rgate=0.8, rgaterate=8)           # rhythmic gate
b3 >> play(x.o., mverb=0.6, mverbfreeze=1)         # frozen reverb
b4 >> play(x-o-, tremolo=0.8, trem_rate=8)         # tremolo
p1 >> blip([0,4,7], dur=1/2, fbdelay=0.5, fbtime=0.25, fbfeed=0.7, fbspread=0.3)  # ping-pong feedback delay
p1 >> saw([0,4,7], oct=3, shape=0.6)               # sine wavefolder
p1 >> dbass([0,-3], oct=4, dist2=0.7, dist2shape=0.4)        # fold + tanh saturation
p1 >> dbass([0,-3], oct=4, multicrush=0.7, mchighdrive=5)    # 3-band multiband drive
p1 >> saw([0,4,7], dur=1/2, chop=4)                # rhythmic gate, 4 slices/beat
p1 >> pads([0,4,7], oct=4, dur=1, leg=4)           # legato — notes overlap (pad)
p1 >> prophet([0,4,7], dur=2, vibrato=0.6, vib_rate=5, vib_depth=0.01)  # pitch vibrato
p1 >> ssaw([0,4,7], oct=4, ringmod=0.5, ringmod_freq=180)          # ring mod
p1 >> ssaw([0,4,7], oct=4, flanger=0.6, flanger_rate=0.3)         # flanger
p1 >> ssaw([0,4,7], oct=4, phaser=0.7, phaser_rate=0.4)          # phaser
p1 >> saw([0,4,7], oct=4, formant=0.8, formant_vowel=1)         # vowel filter (eh)`)}
    `, 'fx');

    const samples = section('External samples — the webfoxdot-kit pack', `
        ${note('Boot the default kit (the original FoxDot bank, hosted on our public <b>webfoxdot-kit</b> repo) with one <code>loadpack</code>. In multiplayer, put it at the <b>top of the shared doc</b> so every peer loads the same samples from the same URL.')}
        ${note('⚠️ <b>Firefox:</b> sample loading can be unstable in Firefox (shared-memory WASM growth). Chrome / Chromium / Edge are recommended for sample-heavy or multiplayer sets.')}
        ${code(`# default kit via CDN (jsDelivr — fast, cached)
loadpack("https://cdn.jsdelivr.net/gh/CrashServer/webfoxdot-kit@v1/pack.json")

# …or straight from GitHub (raw) if the CDN is cold:
# loadpack("https://raw.githubusercontent.com/CrashServer/webfoxdot-kit/v1/pack.json")

b1 >> play(x-o-, amp=0.9)
b2 >> play([X.][o.] <-->, amp=0.7)`)}
        ${note('Or load a single WAV from any public URL and bind it to a play() char (use <code>[urls]</code> for sample-index slots):')}
        ${code(`loadsample("K", "https://raw.githubusercontent.com/USER/REPO/main/kick.wav")
b3 >> play(K.K.K.K.)`)}
    `, 'samples');

    const loop = section('Audio loops ( loop )', `
        ${note('<code>loadloop(name, url)</code> registers an audio loop under a multi-character name; <code>b1 >> loop("name", dur=N)</code> plays it time-stretched to lock to N beats (so it follows the tempo). opts: <code>amp · pan · rate · sample · pos · stretch · looping</code>. Loops share the sample buffer store, so the name just can\'t be a single play() character.')}
        ${code(`loadloop("break", "https://example.com/amen.wav")   # register once
b1 >> loop("break", dur=8)               # stretch to fit 8 beats (locks to tempo)
b1 >> loop("break", dur=8, rate=1.5)     # faster playback (also raises pitch)
b1 >> loop("break", dur=4, pos=0.5)      # start halfway in
b1 >> loop("break", dur=8, lpf=1200, mverb=0.3)   # loops route through the FX chain
b1 >> loop("break", dur=8).every(8, "reverse")    # player methods work too`)}
    `, 'loop');

    const patterns = section('Patterns', `
        ${note('Pattern objects produce a new value each step. P shorthands: <code>P*[a,b,c]</code> random pick · <code>P[a,b,c]</code> cyclic list · <code>P(a,b,c)</code> chord. Inline in a list: <code>(a,b)</code> = chord, <code>{a,b}</code> = random pick. TimeVars can hold patterns.')}
        ${code(`p1 >> saw([0,2,4,7], amp=PWhite(0.4, 0.9))      # random float
p1 >> pluck([0,4,7], oct=PRand(4, 6))           # random int
p1 >> sine(PRange(0, 7), dur=0.5)               # 0..7 ramp
p1 >> saw([0, 3, 5, P*[7,10,5]], oct=4)         # P*[...] = random pick
v1 >> dbass([0, 2, (4, 2), {2, 4}])             # (chord) + {random pick}
p1 >> saw([0,4,7], dur=var([P*[1,2], 1/4]))     # pattern inside a var
p1 >> saw([0,4,7], oct=4) + 7                    # transpose up
p1 >> dbass([0,3,5]) + (0,3,7)                   # + a group = chord
p1 >> saw([0,4,7], oct=4).unison(4, 0.4)         # 4 detuned voices, spread
b1 >> play(x., amp=Pacc("ghost"))         # accent pattern
b2 >> play(x-o-, amplify=PLife(0.5))            # cellular-automaton amp`)}
        ${note('<b>Freeze a generator with a slice</b> — <code>[:N]</code> samples N values <b>once</b> and loops them, so a random source becomes a stable N-step phrase that repeats (instead of a fresh value every step). Works on <code>melody()</code>, <code>PWhite</code>, any pattern.')}
        ${code(`d1 >> dbass(melody()[:8], dur=1/2)       # an 8-note melody, looped
p1 >> saw([0,4,7], amp=PWhite(0.3, 1)[:8])   # 8 fixed random amps, repeating
p1 >> saw(PRange(0, 12)[:4], oct=5)          # first 4 of a ramp`)}
        ${note('<b>Chords &amp; progressions</b> — built in scale degrees, so the quality follows the current <code>Scale</code>/<code>Root</code>. <code>PChord</code> is one chord, <code>PRoman</code>/<code>PProg</code> are progressions, <code>PCircle</code> walks the diatonic circle of fifths (stays in key automatically).')}
        ${code(`Scale.default = "minor"
k1 >> pads(PRoman("i VI III VII"), oct=4, dur=4, reverb=0.4, amp=0.5)
k2 >> prophet(PProg("251"), oct=4, dur=2)             # ii–V–I as chords
p1 >> pluck(PCircle(8), oct=5, dur=1)                 # circle-of-fifths roots
p2 >> organ(PCircle(8, 0, "7"), oct=4, dur=2)         # …as 7th chords
b1 >> play(PClave("son"))                             # son clave`)}
        ${note('<b>Melody generators</b> (like <code>melody()</code>) — <code>motif(n)</code> is a frozen repeating phrase, <code>arp()</code> arpeggiates a chord, <code>PContour(shape)</code> draws a melodic shape and the scale keeps it sweet.')}
        ${code(`p1 >> pluck(motif(4), oct=5, dur=1/2)                 # fixed 4-note motif
p2 >> saw(PContour("arch", 8, 7), oct=5, dur=1/2)     # rise then fall
p3 >> blip(arp([0,4,7,11], "updown"), oct=6, dur=1/4) # arpeggio up/down
p4 >> pluck(P[0,2,4,7].rotate(1).palindrome(), oct=5, dur=1/4)  # chainable transforms
p5 >> saw(Pvar([[0,2,4], [7,4,2,0]], 8), oct=5, dur=1/2)        # swap phrase every 8 beats`)}
        ${note('<b>Chaos &amp; feels</b> — dynamical-system streams (<code>PLogistic/PBrown/PHenon/PLorenz</code>) give organic drift on any param; <code>PGroove</code> is named dur feels; <code>PThue</code>/<code>PEuclid</code> shape accents.')}
        ${code(`p1 >> saw([0,4,7], oct=5, lpf=PLorenz(400, 4000))     # chaotic filter drift
p2 >> pluck([0,2,4,7], oct=5, dur=PGroove("gallop"))  # galloping durations
b1 >> play(x.x.x., amp=PThue()*0.4 + 0.4)             # Thue–Morse accents
d1 >> dbass([0,3,5], oct=4, dur=PDur(3, 8, rotate=1)) # euclid dur, rotated`)}
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

    const syncGen = section('Sync, timed solo/stop & chaos', `
        ${note('<b>Quantised start.</b> A new player begins on the next beat that is a multiple of its <code>dur</code>: <code>dur=4</code> waits for a bar, <code>dur=1/4</code> starts almost at once — so everything stays in sync. Run the kick, then the pads a beat later: the pads snap onto the bar.')}
        ${code(`b1 >> play(x.x.x.x., amp=0.7)
p1 >> pads([0, (0,4,7), 5], oct=4, dur=4, lpf=1200, amp=0.5)   # lands on the next bar`)}
        ${note('<b>Timed solo / only / stop</b> — chain them right on the player, or call as methods. The number is grid-aligned (the next multiple of N), like the dur grid.')}
        ${code(`p1 >> prophet([0,4,7], oct=5, dur=1/2).solo(8)   # solo 8 beats, then restore
p2 >> blip([0,4,7,5], oct=6, dur=1/4).only(8)    # at the next mult of 8, stop the others
b1 >> play(x-x-, amp=0.8).stop(16)               # stop on the next mult of 16
p1.soloDrop(8)                                   # solo-drop 8 beats (method form)`)}
        ${note('<b>chaos(n)</b> — generate <code>n</code> random player lines into <code>g1, g2, …</code> (kept apart from your own) and <b>paste them into the editor as a block — it does not run them</b>. Review/edit, then evaluate (<b>Ctrl+Alt+↵</b>). <code>chaos(3, "drum")</code> or <code>chaos(2, "synth")</code> forces one kind; re-run to add more.')}
        ${code(`chaos(4)             # 4 random players (synth + drum mix)
chaos(2, "synth")    # 2 random melodic/bass players
chaos(3, "drum")     # 3 random drum patterns`)}
        ${note('<b>son() / soff()</b> — a generative <b>jam bot</b>. Unlike <code>chaos</code> (which pastes text for you to run), <code>son()</code> runs itself: every couple of beats it adds, stops, or mutates one of its own <code>g*</code> players, keeping between <code>min</code> and <code>max</code> voices. It never touches your own players, and in a session its lines broadcast to peers. <code>soff()</code> stops the loop; <code>soff(true)</code> also stops its players. Boot audio first.')}
        ${code(`son()                       # start the bot (3–5 g* voices)
son({min:2, max:5, drum:0.5})   # fewer voices, more drums
son({every:[4, 8]})             # a change every 4–8 beats (slower)
soff()                          # stop the loop (leaves g* playing)
soff(true)                      # stop the loop AND its players`)}
        ${note('<b>Tempo automation</b> — <code>Clock.bpm</code> now takes a TimeVar, so the tempo can ramp: <code>Clock.bpm = linvar([120,140],[32])</code>, or the helpers <code>linbpm(120,140,32)</code> / <code>dropbpm(90,8)</code>. And you can schedule one-shots: <code>Clock.future(8, fn)</code>, <code>Clock.mod(4, fn)</code>, <code>Clock.nextBar(fn)</code>.')}
    `, 'syncgen');

    const midi = section('MIDI — control in, notes out', `
        ${note('Web MIDI (Chromium / Edge / Brave). Enables on the first <code>midi()</code> / <code>mlearn()</code> / <code>midiout()</code> call (the eval keypress is the required user gesture). Discover CC numbers and pick the output port in the <b>MIDI panel</b> (Alt+I sidebar).')}
        ${note('<b>Control in</b> — a <code>midi()</code> value is sampled every step (like a TimeVar), so a knob sweeps any synth/FX param live. One CC can drive several params (a macro). Curves: <code>lin</code>, <code>exp</code> (cutoffs/freq), <code>log</code>, <code>quad</code>, <code>cubic</code>, <code>sqrt</code>, <code>s</code> (smoothstep).')}
        ${code(`p1 >> prophet([0, (0,4,7), 4], oct=5, dur=0.5)
p1.lpf = midi(74, 100, 8000, "exp")    # CC74 knob → filter cutoff (exp)
p1.amp = midi(7, 0, 1)                  # CC7 fader → volume (linear)
p2 >> saw([0,4,7], room=midi(1, 0, 1, "s"))   # mod-wheel → reverb size
p1.mverb = mlearn(0, 1)                 # MIDI learn: twist the NEXT control`)}
        ${note('<b>Notes out</b> — <code>midiout()</code> sends to an external/virtual MIDI port instead of making sound. Velocity follows <code>amp</code>, note length follows <code>sus</code>/<code>leg</code>, groups <code>(0,4,7)</code> make chords, and <code>degree / +transpose / .every / .stutter / .sometimes</code> all work like a synth. Notes are scheduled sub-beat-accurate, phase-locked to the internal synths. Route through a virtual port (IAC · loopMIDI · ALSA/JACK) to drive a DAW. Stop / Ctrl+. sends all-notes-off.')}
        ${code(`m1 >> midiout([0, 2, 4, 7], channel=1, oct=5, dur=0.5)
m2 >> midiout([0, (0,4,7), 5, (2,5,9)], channel=2, oct=4, dur=1, amp=0.9)
m1 >> midiout([0,2,4], channel=1, sus=2, leg=1.5)   # long, overlapping notes
m1 >> midiout(P[0,3,5,7], channel=10).every(4, "reverse")   # drum machine on ch10

# layer: hear it locally AND send it out
p1 >> prophet([0,4,7], oct=5, dur=0.5)
m1 >> midiout([0,4,7], channel=1, oct=5, dur=0.5)`)}
    `, 'midi');

    const sections = section('Section sequencer ( #@ )', `
        ${note('Put the cursor on a <code>#@</code> line and Ctrl+Enter. Sections auto-advance after their beat count. A commented player line (<code># p1 >></code>) stops that player on entry. <code>#@#@</code> groups sections into a foldable track.')}
        ${note('<b>Branching:</b> <code>#@goto(target, prob)</code> is a zero-length router — <code>prob</code> chance (default 0.5) to jump to <code>target</code>, else fall through to the next section. Chain them for a probabilistic set that never repeats. (<code>#@loop(beats, a:2, b:1)</code> still does a timed weighted-jump.) Keep part names unique — jumps resolve to the first match.')}
        ${code(`#@#@ my_set

#@intro(16)
p1 >> dbass([0,-3,0,4], oct=4)
b1 >> play(x.o.)

#@verse(32)
p1 >> dbass([0,-3,5,4], oct=4)
p2 >> pads([0,3,5], oct=4, dur=4, reverb=0.4)
# b1 >>

#@fill(4)
b1 >> play([x.ox.] <xox> x.x., crush=0.5, bits=4)

#@goto(verse, 0.6)   # 60% back to verse, else resolve

#@end(8)`)}
    `, 'sections');

    const rise = section('Rise', `
        ${note('A 126-bpm E-minor build as a <code>#@</code> chain — Ctrl+Enter on <code>#@intro</code> and it climbs from a <code>pads</code> intro into driving industrial techno on its own. Shows the tempo-locked <code>rgate</code> + <code>fbdelay</code>, <code>ebass</code> pushed through <code>dist2</code> in stages, a <code>compkick</code>, and <code>pbuild</code> with per-layer gates. Boot + load the kit first.')}
        ${code(`#@intro(16)
Clock.bpm = 126
Root.default = "E"
Scale.default = "minor"
p1 >> pads([0, 3, (0,3,7), 5], oct=4, dur=8, attack=2, release=5, reverb=0.6, room=0.9, lpf=linvar([500, 2200], [16]), amp=0.5)

#@build(16)
p2 >> sine([7, 5, 3, 0], oct=5, dur=4, amp=0.25, mverb=0.6)

#@peak(16)
p2 >> sine([0, 3, 5, 7], oct=5, dur=2, amp=0.3, lpf=sinvar([800, 5000], [8]), fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)

#@break(20)
p3 >> saw([0, 0, 7, 0], oct=3, dur=0.25, lpf=sinvar([400, 4000], [8]), rgate=0.7, rgaterate=4, amp=0.3, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)
p4 >> ebass([0, 0, 7, 0], oct=4, dist2=0.6, dist2shape=1, dur=0.25, lpf=sinvar([400, 4000], [8]), rgate=0.7, rgaterate=4, amp=0.3, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)

#@drop(8)
p1 >> pads([0, 3, (0,3,7), 5], oct=6, dur=8, attack=2, release=5, reverb=0.6, room=0.9, lpf=linvar([500, 2200], [16]), amp=0.5)

#@outro(8)
~p2 >> compkick([0], oct=3, punch=4, squash=80, click=40, dist=120, sub=4, body=0.6, tone=4)

#@part7(8)
v1 >> play(pbuild("indus", evolve=8, fill=4, density=1, kick=1, snare=0, hat=0, perc=1), dur=1/2, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)

#@part8(28)
v2 >> play("X ", amp=1)
p4 >> ebass([0, 0, 7, 4], oct=4, dist2=0.6, dist2shape=1, dur=0.25, lpf=sinvar([400, 4000], [8]), rgate=0.7, rgaterate=4, amp=0.3, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)

#@part9(12)
p1 >> pads([0, 3, (0,3,7), 5], oct=6, dur=8, attack=2, release=5, reverb=0.6, room=0.9, lpf=linvar([500, 2200], [16]), amp=1)

#@part10(8)
p4 >> ebass([0, 0, 7, 0], oct=4, dist2=1, dist2shape=1, dur=0.25, lpf=sinvar([400, 4000], [8]), rgate=0.7, rgaterate=4, amp=0.3, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)

#@part11(12)
p4 >> ebass([0, 0, 7, 0], oct=4, dist2=2, dist2shape=1, dur=0.25, lpf=sinvar([400, 4000], [8]), rgate=0.7, rgaterate=4, amp=0.3, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)

#@part12(8)
p4 >> ebass([0, 0, 7, 0], oct=4, dist2=2, dist2shape=1, dur=0.25, lpf=sinvar([400, 4000], [8]), rgate=0.7, rgaterate=4, amp=0.4, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)

#@part13(8)
p3 >> saw([0, 0, 7, 0], oct=5, dur=0.25, lpf=sinvar([400, 4000], [8]), rgate=0.7, rgaterate=4, amp=0.3, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)

#@part14(24)
p3 >> saw([0, 0, 7, 0], oct=5, dur=0.25, lpf=sinvar([400, 4000], [8]), rgate=0.7, rgaterate=4, amp=0.4, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)

#@part15(8)
p4 >> ebass([0, 0, 7, 0], oct=4, dist2=2, dist2shape=1, dur=0.25, lpf=sinvar([400, 4000], [8]), rgate=0.7, rgaterate=4, amp=0.6, fbdelay=0.5, fbtime=0.5, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)

#@part16(8)
p3 >> saw([0, 0, 7, 0], oct=3, dur=0.25, lpf=sinvar([400, 4000], [8]), rgate=0.7, rgaterate=4, amp=0.3, fbdelay=0.5, fbtime=0.5, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)

#@part17(40)
p3 >> saw([0, 0, 7, 0], oct=3, dur=0.25, lpf=sinvar([400, 4000], [8]), rgate=0.7, rgaterate=4, amp=0.4, fbdelay=0.5, fbtime=0.5, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)

#@end(16)`)}
    `, 'rise');

    const dresdensunlight = section('Dresden Sunlight', `
        ${note('Driving techno, arranged by SUBTRACTION rather than by chord changes — there is about one bar of material here and everything that happens is a filter opening, a layer arriving, or a layer leaving. Worth reading for how little the notes move: the whole set lives on two of them, with the interest in timbre, so the <code>linvar</code> sweeps run over 32 bars rather than 4. Shows <code>#@goto</code> branching, <code>.unison(3)</code> on the stab, a CHORD used as an octave (<code>oct=(5, 4, 6)</code> stacks the same stab across three registers), a <code>pong</code> feedback line on the sub, and the classic techno hole — <code>b1.stop()</code> takes the kick out while everything else keeps running. Boot + load the kit first.')}
        ${code(`Clock.bpm = 134
Root.default = 0
Scale.default = "minor"

#@#@ techno

#@intro(32)
b1 >> play(x, amp=1)
h1 >> play(.-, dur=1/2, hpf=8000, amp=0.3)

#@rumble(32)
b1 >> play(x, amp=1)
h1 >> play(.-, dur=1/2, hpf=8000, amp=0.32)
n1 >> dbass([0], oct=4, dur=1, sus=0.9, lpf=180, tanh=0.8, amp=0.8, pong=0.5, pongtime=0.25, pongfeed=0.5)
r1 >> play(..-., dur=1/2, hpf=4000, crush=0.3, amp=0.25)

#@stab(32)
b1 >> play(x, amp=1)
h1 >> play(.-, dur=1/2, hpf=8000, amp=0.32)
n1 >> dbass([0], oct=4, dur=1, sus=0.9, lpf=linvar([200, 1200], 32), tanh=0.3, amp=0.8, fbdelay=0.5)
r1 >> play(..-., dur=1/2, hpf=4000, crush=0.3, amp=0.25)
s1 >> hardstab([0, 0, 3, 0], oct=6, dur=[3/2, 1/2, 1, 1], sus=0.25, lpf=linvar([500, 4500], [32]), lpr=0.35, pong=0.35, pongtime=0.75, amp=0.5).unison(3)

#@peak(32)
b1 >> play(x, amp=1)
h1 >> play(-, dur=1/4, hpf=9000, amp=0.28)    # sixteenth hats = lift
n1 >> dbass([0], oct=4, dur=1, sus=0.9, lpf=220, tanh=0.45, drive=2, amp=0.85)
r1 >> play(..-., dur=1/2, hpf=4000, crush=0.4, amp=0.3)
s1 >> hardstab([0, 0, 3, 0], oct=4, dur=[3/2, 1/2, 1, 1], sus=0.25, lpf=sinvar([2000, 7000], [16]), lpr=0.4, pong=0.4, pongtime=0.75, amp=0.55)
p1 >> industrialdrone([0], oct=4, dur=16, sus=16, attack=4, lpf=2500, reverb=0.6, room=0.9, amp=0.25)

#@strip(16)
# Kick out, everything else keeps running — the classic techno "hole".
b1.stop()
h1 >> play(-, dur=1/4, hpf=11000, amp=0.3)
s1 >> hardstab([0, 0, 3, 0], oct=(5, 4, 6), dur=[3/2, 1/2, 1, 1], sus=0.25, lpf=linvar([7000, 900], [16]), lpr=0.4, pong=0.5, amp=0.5)
n1 >> dbass([0], oct=4, dur=1, sus=0.9, lpf=180, tanh=0.8, amp=0.8, pong=0.5, pongtime=0.25, pongfeed=0.5)

#@goto(peak, 0.6)

#@end(16)`)}
    `, 'dresdensunlight');

    const sunsetdribble = section('Sunset Dribble', `
        ${note('80s synthpop, and two things date that sound instantly — both arrangement choices rather than particular synths. The GATED snare: heavy room with a short <code>sus</code>, so the hit is enormous but the reverb is cut off dead instead of blooming. And the sixteenth-note ARPEGGIO running underneath everything, doing the job a rhythm guitar does in a rock band — it never stops, it just changes register and opens up. Also shows <code>octclean</code> sub/octave doubling and a multiband-driven <code>.unison(3)</code> bass, and the pop instinct of building by SUBTRACTION: the middle eight is the sparsest part of the song. Boot + load the kit first.')}
        ${code(`Clock.bpm = 112
Root.default = 4
Scale.default = "minor"

#@#@ sunsetdribble

#@intro(16)
# The arp alone, filter opening across the whole 16 bars.
a1 >> pluck(arp([0, 3, 7, 10], "up", 2), oct=5, dur=1/2, sus=0.2, lpf=linvar([800, 5000], [16]), pong=0.3, pongtime=0.375, amp=0.35)

#@verse(32)
# Same arp at double speed, its sus now a pattern so the run breathes unevenly.
a1 >> pluck(arp([0, 3, 7, 10], "up", 2), oct=5, dur=1/4, sus=[0.2, 0.1, 0.2, 0.1, 0.1, 0.3], lpf=3500, pong=0.1, pongtime=0.25, amp=0.25, lpr=0.4)
b1 >> play(x...vx.., dur=1/2, amp=0.9)
# The gated snare: heavy room, short sus so the reverb is cut off dead.
d1 >> play(..o., sus=0.25, reverb=0.7, room=0.9, damp=0.8, amp=0.9)
n1 >> synthbass([0, 0, 0, 0, 5, 5, 3, 3], oct=3, dur=1/2, sus=[0.35, 0.35, 0.7, 0.35], lpf=1100, amp=0.9, lpr=0.2, octclean=0.6, ocsub=0.5, ocup=0.3)

#@chorus(32)
# Arp drops an octave to make room up top; the bass gets multiband drive and
# three detuned voices; pad and lead open the song out.
a1 >> pluck(arp([0, 3, 7, 10], "up", 2), oct=4, dur=1/4, sus=0.2, lpf=2500, pong=0.3, pongtime=0.5, amp=0.4)
b1 >> play(x...x, dur=1/2, amp=0.95)
d1 >> play(..o., sus=0.25, reverb=0.7, room=0.9, damp=0.8, amp=1)
n1 >> synthbass([0, 0, 0, 0, 5, 5, 3, 3], oct=3, dur=1/2, sus=1, lpf=1400, amp=0.75, multicrush=0.6, mclowdrive=2, mcmiddrive=2, mchighdrive=2, mclofreq=300, mchifreq=2500).unison(3)
# Once the big bass is in, the arp drops another octave into it and picks up a
# shape pattern, so it stops reading as a line and starts reading as texture.
a1.oct=3
a1.shape=[0.3, 0.4, 0.4, 0.5]
p1 >> prophet([(0,3,7), (5,8,12), (3,7,10), (10,14,17)], oct=5, dur=4, sus=4, attack=0.15, chorus=0.7, reverb=0.45, room=0.8, stereowidth=1.4, amp=0.6).unison(3)
l1 >> supersaw([7, 12, 10, 14], oct=5, dur=4, sus=3, attack=0.05, vibrato=0.3, reverb=0.4, amp=0.28)

#@middle8(16)
# Everything out but the arp and the pad — pop arranges by SUBTRACTION. The arp
# goes UP an octave, turns around ("updown") and slows to quarter the speed, so
# the thinnest section is also the highest and the least busy.
a1 >> pluck(arp([0, 3, 7, 10], "updown", 2), oct=6, dur=1, sus=0.2, lpf=linvar([1000, 6000], [16]), pong=0.45, pongtime=0.375, amp=0.35)
p1 >> prophet([(0,3,7), (10,14,17)], oct=4, dur=8, sus=8, attack=0.5, chorus=0.7, reverb=0.6, room=0.9, amp=0.35)
b1.stop()
d1.stop()
n1.stop()
l1.stop()

#@goto(chorus, 0.6)

#@end(8)`)}
    `, 'sunsetdribble');

    const showcase = section('Full composition', `
        ${note('A complete live set wired as a <code>#@</code> arrangement. Run <code>#@intro</code> and let it auto-advance. The drop is split into layered parts (<code>dropA/B/C</code>) joined by <b><code>#@goto</code> routers</b>: <code>#@goto(dropA, 0.5)</code> is a zero-length node that, when reached, has a 50% chance to jump back to <code>dropA</code> and 50% to fall through to the next section — so the drop loops a random number of times and the set never plays the same way twice. It also uses chords &amp; groups, FX chains, <code>linvar/sinvar</code>, P-patterns, probability, accents and <code>~</code>reset. Boot audio first. (Keep part names unique — jumps resolve to the first match.)')}
        ${code(`#@#@ showcase_set

#@intro(16)
# pads fade in on an opening filter + sparse kick, then advance to build
p1 >> pads([0, (0,4,7), 5, (2,5,9)], oct=4, dur=4, attack=0.5, lpf=linvar([400, 4500], [16]), reverb=0.5, room=0.85, amp=0.5)
b1 >> play(x...x...x...x..., amp=0.6)

#@build(16)
# add driven sub-bass + ghosted hats; the kick sometimes stutters
p1 >> dbass([0, -3, 0, 4], oct=4, mverb=0.3, tanh=0.4, drive=3, amp=0.8)
b1 >> play(x.x.x.x., amp=0.7).sometimes("stutter", 2)
h1 >> play(-.-.-.-., hpf=5000, amp=Pacc("ghost"))

#@dropA(16)
# drop layer 1: arpeggio on a moving filter, four-on-the-floor kick
p2 >> saw([0, (0,4,7), 4, (2,5,9)], oct=4, dur=0.5, chorus=0.6, chorus_rate=0.5, lpf=sinvar([900, 6000], [8]), amp=0.4).every(8, "reverse")
b1 >> play(X.x.X.x., amp=0.9)

#@dropB(16)
# drop layer 2: add a high blip lead + euclid-accented kick
p3 >> blip(PRange(0, 7), oct=6, dur=0.25, echo=0.4, echo_time=0.375, amp=0.25).sometimes("stutter", 4)
b1 >> play(X.<xx>X.x., amplify=PFDur((3,8),(5,8)), amp=0.9)
h1 >> play([-.][-o], hpf=6000, amp=Pacc("offbeat"))

#@goto(dropA, 0.5)   # 50% loop back to dropA (re-vary the drop), else go on

#@dropC(16)
# drop layer 3: chord stabs an octave up, reversing every 8 beats
p2 >> prophet([0, (0,4,7), 4, (2,5,9)], oct=6, dur=0.5, chorus=0.7, lpf=sinvar([1200, 7000], [4]), amp=0.35).every(8, "reverse")

#@goto(dropB, 0.4)   # 40% drop back to dropB, else continue to the break

#@break(16)
# strip back to a single frozen-reverb chord stab
# p3 >>
# h1 >>
p2 >> prophet((0,4,7), oct=4, dur=2, mverb=0.85, mverbfreeze=1, amp=0.4)
b1 >> play(x..., amp=0.6)

#@goto(dropA, 0.5)   # 50% back into the drop, else resolve to the outro

#@outro(16)
# ~p1 resets that slot to a fresh bell; everything fades on a closing filter
~p1 >> bell([0, 4, 7, 11], oct=5, dur=1, reverb=0.6, room=0.9, lpf=linvar([5000, 600], [16]), amp=linvar([0.5, 0], [16]))
# p2 >>
# b1 >>

#@end(8)`)}
    `, 'showcase');

    const nocturne = section('Nocturne', `
        ${note('A slow build from an ambient chord bed into a driving industrial coda — evaluate it top to bottom, a few lines at a time, and let each layer settle before adding the next. Boot + load the kit first. Shows a PRoman chord progression, TimeVar filter/pan sweeps, .accompany harmony, chord groups, human/unison, and pbuild drums.')}
        ${code(`Clock.bpm = 68
Root.default = "A"
Scale.default = "dorian"
p1 >> pads(PRoman("i VII VI III"), oct=4, dur=8, attack=3, release=6, lpf=linvar([400, 2600], [32]), mverb=0.7, mverbmix=0.6, amp=0.42)
p2 >> sine([0, 4, 2, 7], oct=5, dur=2, amp=0.22, lpf=sinvar([800, 4000], [16]), pan=sinvar([-0.6, 0.6], [12]), pong=0.4, pongtime=0.5, room=0.7)
p3 >> bell(PContour(4, 6, 7), oct=6, dur=3, mverb=0.8, spin=0.5, amp=0.2).sometimes("mirror")

b1 >> dbass([0, 0, -2, 3], oct=4, dur=8, tanh=0.25, lpf=600, amp=0.5)
~p4 >> pluck([0], oct=6, dur=1, amp=0.13, echo=0.4, echo_time=0.375, room=0.6).accompany("p2", [4, 7, 11])

g21 >> brass([0, (0,4,7), 5, (2,5,9)], oct=5, dur=4, amp=0.35, room=0.74, reverb=0.32, pong=0.44, pongtime=0.25).human(32, 6)
g55 >> choir([3, 2], oct=6, dur=1/4, amp=0.59, mverb=0.62).unison(2)

g15 >> basic([4, ., 5, (0,3,4), 0], oct=4, dur=1/4, amp=0.3, chorus=0.59, tanh=0.2).unison(3)
g24 >> pumpbass([5, 7, 4, (0,3,6), 7], oct=6, dur=1, amp=1)

g21 >> brass([4, (0,4,7), 5, (2,5,9)], oct=4, atk=0.5, dur=4, amp=1, hpf=1200, room=0, reverb=0, pong=0.44)

g39 >> a_hhat([(0,2,5), 7, 2, 2], oct=5, dur=1/2, amp=0.50, drive=2.6, tanh=0.41).unison(2)
v1 >> play(<-------->, amp=Pacc("offbeat"))
v2 >> play("X ", echo=0.5, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)

p2 >> ebass([0, 0, 7, 0], oct=5, dur=0.25, dist2=0.5, dist2shape=1, lpf=sinvar([400, 3500], [8]), rgate=0.7, rgaterate=4, amp=0.4)
b2 >> play(pbuild("industrial", kick=0, snare=1, hat=1, perc=1), dur=0.25, amp=0.8)

p2 >> ebass([0, 0, 7, 4], oct=6, dur=0.25, dist2=0.6, dist2shape=1, lpf=sinvar([400, 4000], [8]), rgate=0.7, rgaterate=4, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, amp=1)`)}
    `, 'nocturne');

    const darkchill = section('Dark Chill', `
        ${note('A dark 92-bpm downtempo groove that grows into full techno and back out again — twelve <code>#@</code> parts that advance on their own: put the cursor on <code>#@intro</code> and press Ctrl+Enter. The acid root and the chord progression move as it goes, it peaks on a modulating supersaw with a noise riser, breaks on a frozen reverb (<code>mverbfreeze</code>), then shifts the tempo up to 124 and filters everything down to nothing. Boot + load the kit first; Ctrl+; stops all.')}
        ${code(`#@intro(32)
Clock.bpm = 92
Root.default = "A"
Scale.default = "minor"
m0 >> bass(var([0, -2, -4], [32]), oct=3, dur=8, lpf=sinvar([180, 500], [16]), tanh=0.15, amp=0.6).unison(2)

#@build(16)
o9 >> prophet([6, 3, PRand([4, 2, 5])], oct=5, dur=PRand([2, 4, 8]), sus=3, mverb=0.8, lpf=PRand([1200, 3000]), hpf=300, amp=0.4).unison(2) + (-7, 0)

#@peak(12)
t0 >> play("d", dur=0.5, rate=PWhite(1, 3), pan=PWhite(-1, 1), mverb=0.2, amp=Pacc("ghost")).often("stutter", PRand([2, 4, 8]))

#@break(20)
d6 >> play("x..<x.>x.", dur=0.5, shape=0.4, drcomp=0.4, amp=0.7)
q2 >> play("x", dur=1, amp=0.9)
s1 >> play("-.-.-.-.", hpf=8000, amp=Pacc("offbeat"))
s2 >> play("....o...", dur=0.5, room=0.4, amp=0.7).sometimes("stutter", 2)

#@drop(28)
h4 >> supersaw([0, 3, 5, 0, 3, 5, 7, 0], oct=5, dur=0.5, cutoff=linvar([800, 4500], [8]), amp=0.32, resonbank=0.3, rbfreq=60, rbdecay=0.5, rbspread=1, lpf=1200, lpr=0.1, bpf=1200).every(8, "reverse")
e2 >> acidbass(var([0, 5, 6], [8, 4, 4]), oct=4, dur=0.5, lpf=PFr(1400, 4000, 512), lpr=0.2, chorus=0.4, amp=0.5, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000).unison(3)

#@outro(32)
h4.stop()
p3 >> rhodes([0, 4, 7, 5], oct=5, dur=2, cutoff=2200, echo=0.4, echo_time=0.375, comp=0.4, amp=0.28, mverb=0.5)
q2 >> play("x", dur=1/2, amp=0.9, sample=2)
g17 >> a_gesa([0, [0, 5], 4, 0], oct=6, dur=1/2, amp=0.79, pan=[-0.5, 0.5], pong=0.35, pongtime=0.375, fbdelay=0.46, fbtime=0.25, fbfeed=0.44, fbcutoff=3000)

#@part7(16)
g17.only()

#@part8(12)
v2 >> play("X<-->", sample=4, amp=1, dur=1/2)
q2 >> play("x", dur=1, amp=1, drive=2, tanh=0.3)
s2 >> play("....o.......o.o.", dur=0.25, room=0.3, amp=0.6).sometimes("stutter", 2)

#@part9(16)
h4 >> supersaw([0, 3, 7, (0,3,7), 5, 2], oct=5, dur=0.25, cutoff=sinvar([600, 5000], [4]), spin=0.5, drive=3, tanh=0.4, amp=0.32).every(8, "rotate")
p1 >> blip(PxRand(0, 12), oct=6, dur=PRand([1/4, 1/8]), crush=0.5, bits=4, squiz=0.4, squizpitch=3, bpf=PLorenz(600, 5000), amp=0.25).every(4, "shuffle")
o9 >> prophet(PRoman("i VI iv v"), oct=5, dur=4, sus=3, mverb=0.7, lpf=linvar([800, 4000], [16]), amp=0.3)

#@part10(8)
g17.stop()
m0 >> bass(var([0, 3, 5, 2], [16]), oct=2, dur=4, lpf=sinvar([200, 1200], [8]), tanh=0.3, dist2=0.3, amp=0.6).unison(2)
h4 >> supersaw([0, 3, 7, (0,3,7), 5, 2], oct=6, dur=0.25, cutoff=linvar([600, 6000, 600], [4, 4]), spin=0.6, drive=4, tanh=0.5, chop=8, amp=0.34).every(4, "rotate")

#@part11(8)
e2.rgaterate = 16
n1 >> a_hhat([0], oct=6, dur=16, tone=linvar([200, 8000], [16]), open=1, dist=2, amp=linvar([0, 0.5], [16]))
o9 >> prophet((0,3,7), oct=5, dur=8, sus=7, mverb=0.9, mverbfreeze=1, lpf=linvar([5000, 400], [16]), amp=0.35)
e2 >> acidbass([0], oct=3, dur=0.5, lpf=linvar([4000, 400], [16]), lpr=0.15, amp=0.4)

#@part12(16)
Clock.bpm = 124
m0 >> bass([0], oct=2, dur=8, lpf=linvar([1200, 200], [16]), amp=linvar([0.6, 0], [16]))
h4 >> supersaw([0, 3, 7], oct=5, dur=1, lpf=linvar([5000, 300], [16]), amp=linvar([0.3, 0], [16]))
v1 >> play("X", amp=4)
o9.amp = linvar([0.3, 0], [16])

#@end(16)`)}
    `, 'darkchill');

    const filmscore = section('Film Score', `
        ${note('A slow cinematic score — 60 bpm, C minor, four <code>#@</code> parts that advance on their own: put the cursor on <code>#@intro</code> and press Ctrl+Enter. A keys ostinato with per-step <code>var</code> phrasing on both <code>dur</code> and <code>sus</code> (so it breathes rather than marching), cs80 and choir chord swells riding slow <code>sinvar</code> amp and filter sweeps, and a soft feedback-delay pulse underneath. Boot + load the kit first.')}
        ${code(`#@intro(4)
Clock.bpm = 60
Scale.default = "minor"
Root.default = "C"
oj >> basic([0,6,5,6], oct=3, dur=1, sus=0.88, amp=1, room=0.7, reverb=0.6)

#@build(4)
pt >> basic([0,3,5,7,5,3,7,5], oct=5, dur=var([1,1,1,0.5,1,1,2,2],[1,1,1,1,1,1,1,2]), sus=var([0.8,0.8,0.8,0.4,0.8,0.8,1.5,1.5],[1,1,1,1,1,1,1,2]), amp=0.5, room=0, reverb=0.5, pan=sinvar([-0.2,0.2],16))

#@peak(8)
hp >> basic([0,3,5,7,5,3, 6,1,3,6,3,1, 5,0,3,5,3,0, 4,6,1,4,1,6], oct=6, dur=0.5, sus=PRand([0.4,0.6,0.8],6), amp=0.28, cheapverb=0.5, cvdecay=2, pan=sinvar([-0.4,0.4],6))
cx >> cs80([(0,3,5),(6,1,3),(5,0,3),(4,6,1)], oct=4, dur=4, sus=5, amp=sinvar([0.12,0.32],32), cutoff=sinvar([1000,3500],24), vibrate=3.5, vib=0.012, room=0.9, reverb=0)

#@break(16)
ch >> choir([(0,3,5),(6,1,3),(5,0,3),(4,6,1)], oct=6, dur=4, sus=5.5, amp=sinvar([0.3,0.55],16), room=0.99, reverb=0.95, lpf=linvar([800,3000],32))
v1 >> play("<--->.<-->.x...", lpf=1200, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)
oj >> choir([4,6,12,6], oct=3, dur=1, sus=0.88, amp=1, room=0.7, reverb=0.6)
pt >> basic([4,3,5,7,5,3,7,5], oct=5, dur=var([1,1,1,0.5,1,1,2,2],[1,1,1,1,1,1,1,2]), sus=var([0.8,0.8,0.8,0.4,0.8,0.8,1.5,1.5],[1,1,1,1,1,1,1,2]), amp=0.5, room=0, reverb=0.5, pan=sinvar([-0.2,0.2],16))

#@end(16)`)}
    `, 'filmscore');

    const virtualreality = section('Virtual Reality', `
        ${note('A 106-bpm D-minor industrial set as a <code>#@</code> chain — Ctrl+Enter on <code>#@intro</code> and it runs itself. The reese opens ALONE (a <code>~dbass</code> under a slow <code>sinvar</code> filter), a multicrushed <code>supersaw</code> builds under it, and the peak stacks two <code>plaits</code> lines — a 16-step against a 32-step, so the phrase never lands the same way twice. The break hands the tune to a distorted <code>a_gesa</code> lead answered by a <code>brass</code> motif, the drop swaps the bass for <code>ebass</code> + a <code>ssaw</code> reese, and the gated <code>pbuild</code> drum engine arrives LAST. Parts evolve the last one with <code>.oct=</code> and <code>.rate=</code> rather than restating it.')}
        ${code(`#@#@ virtualreality

#@intro(8)
# The reese alone — no drums, no tempo set yet, just the filter breathing.
~wr >> dbass([0, 0, -5, -5, -7, -7, 0, 0], oct=5, dur=0.5, drive=5, tanh=0.5, lpf=sinvar([600, 3000], [16]), fbdelay=0.5, fbtime=0.25, fbfeed=0.4, fbcutoff=3000, amp=0.8).unison(3)

#@build(12)
Clock.bpm = 106
Scale.default = "minor"
Root.default = "D"
ba >> supersaw([0,0,-5,0,-7,0,-5,-3], oct=4, dur=0.25, sus=var([0.3,0.2,0.35,0.25],[4,4,4,4]), amp=0.45, hpf=120, lpf=sinvar([400,2000],16), multicrush=0.8, mclowdrive=1.5, mcmiddrive=2, mchighdrive=1.8, mclofreq=200, mchifreq=3000).unison(3)

#@peak(8)
# Two plaits lines over the same bass figure: 16 steps against 32, so they
# only agree every other bar.
bb >> plaits([0,0,-5,0,-7,0,3,5, 0,0,-5,7,-7,6,3,6], oct=5, dur=0.25, sus=var([0.3,0.2,0.35,0.25],[4,4,4,4]), amp=1, hpf=120, lpf=sinvar([400,2000],16), multicrush=0.8, mclowdrive=1.5, mcmiddrive=2, mchighdrive=1.8, mclofreq=200, mchifreq=3000)
bc >> plaits([0,0,-5,0,-7,0,3,5, 0,0,-5,7,-7,6,3,6, 0,0,4,0,-7,0,3,5, 0,0,6,7,7,6,3,6], oct=5, dur=0.25, sus=var([0.3,0.2,0.35,0.25],[4,4,4,4]), amp=0.85, hpf=120, lpf=sinvar([400,2000],16), multicrush=0.8, mclowdrive=1.5, mcmiddrive=2, mchighdrive=4, mclofreq=200, mchifreq=3000)

#@break(8)
# Lead and answer — the a_gesa states it loud, brass replies, then the same
# a_gesa line comes back quiet and one octave narrower.
ag >> a_gesa([7, 5, 0, 7, ., 5, 7, .], oct=(6, 5, 7), dur=0.5, dist=4, cutoff=sinvar([800, 6000], [4]), spin=0.5, fbdelay=0.5, fbtime=0.25, fbfeed=0.7, fbcutoff=3000, amp=1)
br >> brass([0, -5, -7, -5, 0, ., 0, .], oct=6, dur=0.5, sus=0.2, room=0.3, reverb=0.25, comp=0.5, amp=0.4)
ag >> a_gesa([7, 5, 0, 7, ., 5, 7, .], oct=6, dur=0.5, dist=4, cutoff=sinvar([800, 6000], [4]), spin=0.5, fbdelay=0.5, fbtime=0.25, fbfeed=0.7, fbcutoff=3000, amp=0.35)

#@drop(8)
ba >> ebass([0,0,-5,0,-7,0,-5,-3], oct=5, dur=0.25, sus=var([0.3,0.2,0.35,0.25],[4,4,4,4]), amp=0.85, dist2=0.2, hpf=240, lpf=sinvar([400,2000],16))
wr >> ssaw([0,0,-5,-5,-7,-7,0,0], oct=5, dur=0.5, sus=0.4, amp=0.8, cutoff=sinvar([300,14000],8), rq=0.45, fbdelay=0.5, fbtime=0.25, fbfeed=0.85, fbcutoff=6000, fbspread=0.05).unison(3)

#@outro(8)
ag.oct=3
dk.rate=4
~ag >> a_gesa([2, 1, 0, [7, 4], ., 5, 4, .], oct=(6, 5, 7), dur=0.5, dist=4, cutoff=sinvar([800, 6000], [4]), spin=0.0, fbdelay=0.25, fbtime=0.25, fbfeed=0.7, fbcutoff=3000, amp=0.35).unison(3)
~wr >> dbass([0, 0, -5, -5, -7, -7, 0, 0], oct=5, dur=0.5, drive=5, tanh=0.5, lpf=sinvar([600, 3000], [16]), fbdelay=0.5, fbtime=0.25, fbfeed=0.4, fbcutoff=3000, amp=0.4).unison(3)

#@part7(8)
wr >> hoover([0,0,-5,-5,-7,-7,0,0], oct=6, dur=0.5, sus=0.1, amp=0.2, lpf=sinvar([300,14000],8), lpr=0.45, fbdelay=0.5, fbtime=0.25, fbfeed=0.85, fbcutoff=6000, fbspread=0.05).unison(3)

#@part8(8)
ag >> a_gesa([7, 5, 0, 7, ., 5, 7, .], oct=(6, 5, 7), dur=0.5, dist=4, cutoff=sinvar([800, 6000], [4]), spin=0.5, fbdelay=0.5, fbtime=0.25, fbfeed=0.7, fbcutoff=3000, amp=0.35)

#@part9(4)
ag >> a_xbass([7,5,0,7,5,7,0,5], oct=PStep(4, 5, 6), dur=0.5, sus=PRand([0.2,0.4,0.6],4), amp=sinvar([0.2,0.6],8), cutoff=sinvar([800,12000],4), rq=0.1, fbdelay=0.5, attack=0.01, fbtime=0.25, fbfeed=0.7, fbcutoff=3000, fbspread=0.02, eq3=3, eqlow=0, eqmid=2, eqhigh=2)

#@part10(16)
# The drums arrive last — a gated, multicrushed pbuild engine under everything.
~dk >> play(pbuild("industrial"), dur=0.25, amp=var([1,0.9,1,0.88],4), rgate=0.1, rgaterate=4, multicrush=4, mclowdrive=1.5, mcmiddrive=2, mchighdrive=1.8, mclofreq=200, mchifreq=3000)

#@end(16)`)}
    `, 'virtualreality');

    const tenebrae = section('Tenebrae', `
        ${note('Slow evolving chord clusters (60, C minor) — cs80 / bass / a_gesa / a_daft with grouped per-voice octaves and [1, 1/2] alternating durations.')}
        ${code(`Clock.bpm = 60
Scale.default = "minor"
Root.default = "C"

g3 >> cs80([4, 4, ., 1, 2, 3, (0,3,4), 4], oct=6, dur=1, amp=0.44, room=0.60, reverb=0.65).unison(2)
g3 >> cs80([4, 4, ., 1, 2, 3, (0,3,4), 4], oct=(7, 6), dur=1, amp=0.44, room=0.60, reverb=0.65).unison(2)
g3 >> cs80([4, 4, ., 1, 2, 3, (0,3,4), 4], oct=(7, 6, 5), dur=1, amp=0.44, room=0.60, reverb=0.65).unison(0)
g0 >> bass([4, 1, ., 4, 2, 3, (0,3,4), 4], oct=((3, 5), PStep(4, 5, 6), 5), dur=[1, 1/2], amp=1, room=0.60, reverb=0.65, attack=0.2).unison(0)
g3 >> cs80([4, 4, ., 1, 2, 3, (0,3,4), 4], oct=5, dur=4, amp=1, room=0.60, reverb=0.65).unison(0)
g3 >> a_gesa([4, 0, ., 1, (2,0,4), 0, (0,3,4), 4], oct=(4, 6, 7), dur=4, amp=0.44, room=0.2, reverb=0.2).unison(2)
g0 >> a_gesa([4, 1, ., 4, 2, 3, (0,3,4), 4], oct=((3, 5), PStep(4, 5, 6), 5), dur=[1, 1/2], amp=1, lpf=1200, room=0.60, reverb=0.65, attack=0.2).unison(2)
g0 >> bass([4, 2, ., 4, 2, 3, (0,3,4), 4], oct=(7, PStep(4, 5, 6), 5), dur=[1, 1/2], amp=0.44, room=0.60, reverb=0.65).unison(2)
g0 >> a_daft([4, 1, ., 4, 2, 3, (0,3,4), 4], oct=((3, 5), PStep(4, 5, 6), 5), dur=[1, 1/2], amp=1, room=0.60, reverb=0.65, attack=0.2).unison(2)`)}
    `, 'tenebrae');

    const scorched = section('Scorched', `
        ${note('Hard techno (126, phrygian) — a tuned compkick, gated pumpbass, a distorted a_daft acid lead that morphs over the take, industrial hits.')}
        ${code(`Scale.default = "phrygian"
Root.default = 0
Clock.bpm = 126

k1 >> compkick(punch=1, squash=1, release=0.4, oct=4, click=120, drive=0, sub=40, body=10, fbdelay=0.5, fbtime=0.25, fbfeed=0.7, fbcutoff=3000, fbspread=0.01, tone=var([2, 4, 6, 8, 16], 2), dur=1)
h1 >> a_hhat(0, dur=1/2, amp=Pacc("offbeat"), beat_dur=0.5, decay=0.04, hpf=9000)
t1 >> a_daft([0, rest(0), 1, 0, rest(0), 1, rest(0), 0], dur=4, sus=4, oct=5, amp=1.1, cutoff=linvar([600,3600],4), rq=0.95, punch=2.5, dist2=0.5, dist2shape=0.6, hpf=200).unison(2)
t1 >> a_daft([0, rest(0), 1, 0, rest(0), 3, rest(0), 4], echo=4, dur=1/2, sus=1/2, oct=5, amp=1.1, cutoff=linvar([600,3600],4), rq=0.95, punch=2.5, dist2=0.5, dist2shape=0.6, hpf=200).unison(2)
t2 >> pumpbass([0, 5, 0, 3, 0, 4, 0, 3], dur=1/2, sus=0.3, oct=6, amp=1.0, cutoff=linvar([400,3000],4), dist2=1, dist2shape=1, fuzz=0.0, noiz=1, noizr=0, noizt=0.9, fuzzgain=0.0, hpr=0.9, hpf=1080, fbdelay=0.5, fbtime=0.25, fbfeed=0.7, fbcutoff=3000, fbspread=0.02, beat_dur=1, rgate=0.5, rgaterate=4, rgatewave=0).unison(3)
h1 >> a_hhat(0, dur=1/2, amp=Pacc("offbeat"), beat_dur=0.5, decay=0.4, hpf=9000)
t1 >> a_daft([0, rest(0), 1, 0, rest(0), 3, rest(0), 4], echo=4, dur=1/2, sus=1/2, oct=6, amp=1.1, cutoff=linvar([600,3600],4), rq=0.95, punch=2.5, dist2=0.5, dist2shape=0.6, hpf=200).unison(2)
v2 >> play("X ", amp=2, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)
t1.lpf=1200
t2.stop()
t1.oct=7
t1 >> a_daft([0, rest(0), 1, 0, rest(0), 1, rest(0), 0], dur=4, sus=4, oct=5, amp=1.1, cutoff=linvar([600,3600],4), rq=0.95, punch=2.5, dist2=0.5, dist2shape=0.6, hpf=200).unison(2)
t1 >> a_daft([0, rest(0), 1, 0, rest(0), 1, rest(0), 0], dur=1/2, sus=1/2, oct=5, amp=1.1, cutoff=linvar([600,3600],4), rq=0.95, punch=2.5, dist2=0.5, dist2shape=0.6, hpf=200).unison(2)
t2 >> blip([0, 5, 0, 3, 0, 4, 0, 3], dur=1/2, sus=0.2, oct=5, amp=1.0, cutoff=linvar([400,3000],4), dist2=0, dist2shape=1, fuzz=0.0, noiz=0, noizr=0, noizt=0.9, fuzzgain=0.0, hpr=0.8, hpf=180, fbdelay=0.5, fbtime=0.25, fbfeed=0.7, fbcutoff=3000, fbspread=0.02, beat_dur=1, rgate=0.5, rgaterate=4, rgatewave=0).unison(3)
v3 >> play("Xx")
t1 >> a_daft([0, rest(0), 1, 0, rest(0), 3, rest(0), 4], echo=0.5, dur=1/2, sus=1/2, oct=6, amp=1.1, cutoff=linvar([600,3600],4), rq=0.15, punch=12, dist2=0.0, dist2shape=0.6, hpf=20).unison(2)
k1 >> compkick(punch=1, squash=1, release=0.6, oct=3, click=1200, drive=4, sub=40, body=100, fbdelay=0.5, fbtime=0.25, fbfeed=0.7, fbcutoff=3000, fbspread=1, tone=var([20, 4, 6, 8, 16], 2), dur=1)
v5 >> play("X", amp=4, sample=1)
t1 >> a_daft([0, rest(0), 1, 0, rest(0), 3, rest(0), 4], echo=0.5, dur=1/2, sus=1/2, oct=5, amp=1.1, cutoff=linvar([600,3600],4), rq=0.15, punch=12, dist2=0.0, dist2shape=0.6, hpf=20).unison(3)
t2 >> dbass(dist2=1)`)}
    `, 'scorched');

    const inthemood = section('In the mood for CS80 (recorded #@ set)', `
        ${note('A full recorded composition arranged with #@ parts. <b>Load the kit first</b> (LOAD KIT), then put the cursor on <code>#@intro</code> and press Ctrl+Enter — it auto-plays and advances through the parts while you can still edit live. (The free-text narration lines are commented so each section evaluates cleanly.)')}
        ${code(`#@#@ in_the_mood_for_cs80

#@intro(12)
Root.default = "E#"
g59 >> bass([0, {0, 3, 5}], oct=6, dur=1/2, amp=Pacc(4), mverb=0.63, mverbmix=0.6).human(26, 4)
# of our new live coding
# environnement

#@build(16)
g89 >> bass([0], oct=[4, 5], dur=2, amp=0.55)
# 100% web
# based on FoxDot

#@peak(16)
g8 >> rsin(PRange(0, 5), oct=arp([5, 6, PRand([4, 5, (6, 7)]), 6, (4, 5, 6)]), dur=1/2, amp=0.41, reverb=0.4, room=0.6, damp=0.1)

#@break(20)
g71 >> cs80(PCircle(1), oct=6, dur=1/2, a=PWhite(0, 1), amp=0.39, pan=sinvar([-1, 1], [8])).human(15, 4)

#@drop(16)
g71 >> cs80(PCircle(16), oct=(6, 5), dur=1/2, amp=0.39, pan=sinvar([-1, 1], [8])).human(15, 4)
# demoed here! i can auto play and still code and adjust

#@outro(12)
g72 >> cs80(arp([0,2,4,7], "down"), oct=5, dur=1/2, amp=0.29, tremolo=0.68, trem_rate=4).every(8, "reverse")

#@part7(8)
g71 >> cs80(PCircle(16), oct=(4, 5), dur=1/2, amp=0.39, pan=sinvar([-1, 1], [8])).human(15, 4)

#@part8(16)
g72 >> cs80(arp([0,2,4,7], "up"), oct=(4, 5), dur=1/2, amp=0.6, tremolo=0.68, trem_rate=4).every(8, "reverse")

#@part9(16)
g59 >> bass([0, {0, 3, 5}], oct=7, dur=1/2, amp=Pacc(4), mverb=0.53, mverbmix=0.6).human(26, 4).degrade()
g8 >> rsin(PRange(0, 8), oct=arp([5, 6, 5, 8, (4, 5, 6)]), dur=1/2, amp=0.41, reverb=0.4, room=0.6, damp=0.1)

#@part10(16)
g71.stop()
g59 >> bass([0, {0, 3, 5}], oct=7, dur=1/2, amp=Pacc(4), mverb=0.63, mverbmix=0.6).human(26, 4)

#@part11(16)
g73 >> karp(PChord(0, "sus4"), oct=6, dur=1/2, amp=PWhite(0.36, 0.44), fold=0.36, symetry=3, multicrush=0.61, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02).unison(3)
g59.stop()
g89.stop()
g8 >> rsin(PRange(0, 5), oct=arp([5, 6, PRand([4, 5, (6, 7)]), 6, (4, 5, 6)]), dur=1/2, amp=0.41, reverb=0.4, room=0.6, damp=0.1)
g71 >> cs80(PCircle(1), oct=6, dur=1/2, amp=0.39, pan=sinvar([-1, 1], [8])).human(15, 4)
g72 >> cs80(arp([0,2,4,7], "down"), oct=5, dur=1/2, amp=0.29, tremolo=0.68, trem_rate=4).every(8, "reverse")

#@part12(20)
g73 >> karp(PChord(0, "sus4"), oct=4, dur=4, amp=PWhite(0.36, 0.44), fold=0.36, symetry=3, multicrush=0.61)
g203 >> pluck(PGrowArp([0,3,7]), oct=[6, 7], dur=PBeat("x xx x"), amp=PWhite(0.36, 0.41), cheapverb=0.70, rgate=0.75, rgaterate=8).penta() + [0, 3]
g59 >> bass([0, {0, 3, 5}], oct=6, dur=1/2, amp=Pacc(4), mverb=0.63, mverbmix=0.6).human(26, 4)
g89 >> bass([0], oct=[4, 5], dur=2, amp=0.55)

#@part13(16)
g72 >> cs80(arp([0,2,4,7], "up"), oct=(4, 5), dur=1/2, amp=0.6, tremolo=0.68, trem_rate=4).every(8, "reverse")
Root.default = "C"

#@part14(16)
g8.stop()
g72.stop()
g71.stop()
g73 >> dbass(PChord(0, "sus4"), oct=5, dur=1/2, amp=PWhite(0.36, 0.44), fold=0.36, symetry=3, multicrush=0.61)
Root.default = "E#"

#@part15(12)
g74 >> sine(motif(3), oct=5, dur=PGroove("gallop"), amp=PWhite(0.32, 0.42), mverb=0.55, mverbmix=0.6)
g88 >> donk(arp([0,4,7,11], "up"), oct=[5, 6], dur=1/4, amp=0.40, pan=PWhite(-0.7, 0.7), ringmod=0.44, ringmod_freq=147)
g95 >> pads(PCircle(8, 0, "7"), oct=4, dur=[2, 4], amp=0.45, pan=[-0.5, 0.5], flanger=0.68, flanger_rate=0.30)

#@part16(12)
g239 >> acidbass(PRange(0, 4), oct=[4, 5], dur=1, amp=1, chop=4, echo=0.21, echo_time=0.375)
g233 >> rhodes(arp([0,4,7,11], "downup"), oct=5, dur=[1/4, 1/2], amp=0.36, pan=PWhite(-0.7, 0.7), lofi=0.49) + (0,3,7)

#@part17(8)
g73 >> karp(PChord(0, "sus4"), oct=6, dur=1/2, amp=PWhite(0.36, 0.44), fold=0.36, symetry=3, multicrush=0.61, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02).unison(3)
g59.stop()
g89.stop()

#@part18(12)
Root.default = "C"
g8 >> rsin(PRange(0, 5), oct=arp([5, 6, PRand([4, 5, (6, 7)]), 6, (4, 5, 6)]), dur=1/2, amp=0.41, reverb=0.4, room=0.6, damp=0.1)
g71 >> cs80(PCircle(1), oct=6, dur=1/2, amp=0.39, pan=sinvar([-1, 1], [8])).human(15, 4)
g72 >> cs80(arp([0,2,4,7], "down"), oct=5, dur=1/2, amp=0.29, tremolo=0.68, trem_rate=4).every(8, "reverse")

#@part19(4)
v1 >> play("<-X>", hpf=4200, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)
g98 >> play(PEuclid2(3, 8, ".", "B"), dur=1/2, amp=0.76, dist2=0.6, dist2shape=1).sometimes("stutter", 3)

#@part20(12)
g73.stop()
g203.stop()
g59.stop()
g74.stop()
g95.stop()
g88.stop()
g239.stop()
v1 >> play("<-X>", hpf=4200, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)
g98 >> play(PEuclid2(3, 8, ".", "B"), dur=1/2, amp=0.76, dist2=0.6, dist2shape=1).sometimes("stutter", 3)

#@part23(8)
v1 >> play("<<--><Xx>>", hpf=4200, fbdelay=1, fbtime=0.5, fbfeed=0.5, fbcutoff=3000, fbspread=0.14)
v2 >> play("b ", hpf=1200, fbdelay=1, fbtime=0.5, fbfeed=0.5, fbcutoff=3000, fbspread=0.14)
g59 >> bass([0, {0, 3, 5}], oct=4, dur=1/2, amp=Pacc(4), mverb=0.63, mverbmix=0.6).human(26, 4)

#@part24(8)
g239 >> acidbass(PRange(0, 4), oct=[4, 5], dur=1, amp=1, chop=4, echo=0.21, echo_time=0.375)
g233 >> rhodes(arp([0,4,7,11], "downup"), oct=4, dur=[1/4, 1/2], amp=0.36, pan=PWhite(-0.7, 0.7), lofi=0.49) + (0,3,7)

#@part25(8)
v3 >> play("K", hpf=100, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02, dist2=0.1, dist2shape=1)

#@part26(8)
g136 >> a_bd([2, 9, 0, 2, 9], oct=4, dur=1/4, amp=1, pan=PGauss(0, 0.35), lpf=sinvar([541, 2599], [4]), lpr=0.35, multicrush=0.52).human(33, 5)

#@part27(16)
g8 >> rsin(PRange(0, 5), oct=arp([5, 6, PRand([4, 5, (6, 7)]), 6, (4, 5, 6)]), dur=1/2, amp=0.41, reverb=0.4, room=0.6, damp=0.1)
g71 >> cs80(PCircle(16), oct=(6, 5), dur=1/2, amp=0.39, pan=sinvar([-1, 1], [8])).human(15, 4)

#@end(16)`)}
    `, 'in_the_mood');

    const karpDMK = section('Untitled — Daniel M Karlsson', `
        ${note('A community contribution by <b>Daniel M Karlsson</b>. Six karp voices (p0–p5) shuffle a harmonic-minor scale across octaves, each rolling random 1/4 &amp; 1/2 durations, thickening as you run the #@ parts top to bottom. Boot, put the cursor on #@intro and Ctrl+Enter.')}
        ${code(`# Untitled — by Daniel M Karlsson (contribution)
#@#@ recorded

#@intro(32)
Scale.default = "HarmonicMinor"
p0 >> karp(PShuf([0, 3, 4, 5, 6, 7, 9, 11, 12, 13]), oct=4, amp=PRand([0.3, 0.3, 0.3, 0.9]), dur= 1 / PRand([4, 4, 2]))

#@build(8)
p0 >> karp(PShuf([0, 3, 4, 5, 6, 7, 9, 11, 12, 13]), oct=4, amp=PRand([0.3, 0.3, 0.3, 0.9]), dur= 1 / PRand([4, 4, 2]))

#@peak(12)
p0 >> karp(PShuf([0, 3, 4, 5, 6, 7, 9, 11, 12, 13]), oct=4, amp=PRand([0.3, 0.3, 0.3, 0.9]), dur= 1 / PRand([4, 4, 2]))

#@break(20)
p0 >> karp(PShuf([0, 3, 4, 5, 6, 7, 9, 11, 12, 13]), oct=4, amp=PRand([0.3, 0.3, 0.3, 0.9]), dur= 1 / PRand([4, 4, 2]))

#@drop(24)
p1 >> karp(PShuf([0, 3, 4, 5, 6, 7, 9, 11, 12]), oct=4, amp=PRand([0.3, 0.3, 0.3, 0.9]), dur= 1 / PRand([4, 4, 2]))

#@outro(16)
p1 >> karp(PShuf([0, 3, 4, 5, 6, 7, 9, 11, 12]), oct=4, amp=PRand([0.3, 0.3, 0.3, 0.9]), dur= 1 / PRand([4, 4, 2]))

#@part7(40)
p2 >> karp(PShuf([0, 3, 4, 5, 6, 7, 9, 11]), oct=5, amp=PRand([0.3, 0.3, 0.3, 0.9]), dur= 1 / PRand([4, 4, 2]))

#@part8(20)
p2 >> karp(PShuf([0, 3, 4, 5, 6, 7, 9, 11]), oct=5, amp=PRand([0.3, 0.3, 0.3, 0.9]), dur= 1 / PRand([4, 4, 2]))

#@part9(20)
p3 >> karp(PShuf([0, 3, 4, 5, 6, 7, 9]), oct=5, amp=PRand([0.3, 0.3, 0.3, 0.9]), dur= 1 / PRand([4, 4, 2]))

#@part10(12)
p4 >> karp(PShuf([0, 3, 4, 5, 6, 7]), oct=6, amp=PRand([0.3, 0.3, 0.3, 0.9]), dur= 1 / PRand([4, 4, 2]))

#@part11(12)
p4 >> karp(PShuf([0, 3, 4, 5, 6, 7]), oct=6, amp=PRand([0.3, 0.3, 0.3, 0.9]), dur= 1 / PRand([4, 4, 2]))

#@part12(28)
p4 >> karp(PShuf([0, 3, 4, 5, 6, 7]), oct=6, amp=PRand([0.3, 0.3, 0.3, 0.9]), dur= 1 / PRand([4, 4, 2]))

#@part13(16)
p5 >> karp(PShuf([0, 3, 4, 5, 6]), oct=6, amp=PRand([0.3, 0.3, 0.3, 0.9]), dur= 1 / PRand([4, 4, 2]))

#@part14(20)
p5 >> karp(PShuf([0, 3, 4, 5, 6]), oct=6, amp=PRand([0.3, 0.3, 0.3, 0.9]), dur= 1 / PRand([4, 4, 2]))

#@part15(12)
p4 >> karp(PShuf([0, 3, 4, 5, 6, 7]), oct=6, amp=PRand([0.3, 0.3, 0.3, 0.9]), dur= 1 / PRand([4, 4, 2]))

#@part16(16)
p3 >> karp(PShuf([0, 3, 4, 5, 6, 7, 9]), oct=5, amp=PRand([0.3, 0.3, 0.3, 0.9]), dur= 1 / PRand([4, 4, 2]))

#@part17(16)
p2 >> karp(PShuf([0, 3, 4, 5, 6, 7, 9, 11]), oct=5, amp=PRand([0.3, 0.3, 0.3, 0.9]), dur= 1 / PRand([4, 4, 2]))

#@part18(20)
p1 >> karp(PShuf([0, 3, 4, 5, 6, 7, 9, 11, 12]), oct=4, amp=PRand([0.3, 0.3, 0.3, 0.9]), dur= 1 / PRand([4, 4, 2]))

#@part19(28)
p0 >> karp(PShuf([0, 3, 4, 5, 6, 7, 9, 11, 12, 13]), oct=4, amp=PRand([0.3, 0.3, 0.3, 0.9]), dur= 1 / PRand([4, 4, 2]))

#@part20(16)
p0 >> karp(PShuf([0, 3, 4, 5, 6, 7, 9, 11, 12, 13]), oct=4, amp=PRand([0.3, 0.3, 0.3, 0.9]), dur= 1 / PRand([4, 4, 2]))

#@end(16)`)}
    `, 'karp_dmk');


    const whatsNew = section('Live-coding tour — transforms · cross-player · FX · MIDI', `
        ${note('The headline additions in alpha28 — boot audio, then evaluate any line (Ctrl+Enter).')}
        ${note('<b>Transform a pattern LIVE</b> — .every(n, "rotate") / .sometimes("mirror") reshape the degree each time they fire, so you HEAR it change. (rotate = cyclic shift, mirror = play it backwards.)')}
        ${code(`p1 >> saw([0, 2, 4, 7], oct=5, dur=1/4).every(4, "rotate")   # shifts every 4 beats
p2 >> pluck([0, 2, 4, 7, 9], oct=5, dur=1/4).sometimes("mirror")
p3 >> bass(Pvar([[0,2,4], [7,4,2,0]], 8), oct=4, dur=1/2)    # swap whole phrase every 8 beats`)}
        ${note('<b>Static (compose-time) transforms</b> — on P[…] or a generator they build a fixed reordered pattern once (not audible as a change). Use these to shape a phrase, the .every/.sometimes above to animate it.')}
        ${code(`p4 >> pluck(P[0,2,4,7].rotate(1), oct=5, dur=1/4)   # a fixed [2,4,7,0]
p5 >> saw(PDur(3,8).palindrome(), oct=4, dur=1/4)   # euclid durs, there-and-back`)}
        ${note('<b>Cross-player modulation</b> — read another player live (arithmetic works), or follow/accompany/map.')}
        ${code(`b1 >> bass([0,3,5,7], oct=4, dur=1/2)
d1 >> saw(b1.degree + 4, oct=5, dur=1/2)            # a 5th above b1, live
d2 >> pluck([0], oct=5, dur=1/2).accompany("b1", [0,2,4])`)}
        ${note('<b>Tempo automation + generative jam bot</b>.')}
        ${code(`Clock.bpm = linvar([120, 140], [32])    # ramp tempo over 32 beats
son({min:2, max:5})                     # start the jam bot (g* players)
soff()                                  # stop it`)}
        ${note('<b>New FX</b> — bpf (band-pass), eq3 (3-band EQ), spin (auto-pan), pong (ping-pong delay).')}
        ${code(`p1 >> saw([0,4,7], oct=5, dur=1/4, bpf=1200, bpr=0.2, spin=0.6)
b1 >> play("x.o.", eq3=1, eqlow=4, eqhigh=-3, pong=0.5, pongtime=0.375)`)}
        ${note('<b>Live control + player methods</b>.')}
        ${code(`darker()                                # scale one mode darker
p1 >> pads((0,4,7), oct=5, dur=2).strum(0.06)   # arpeggiated chord
p2 >> blip([0,4,7,11], oct=6, dur=1/4).jump(1).multiply(2)`)}
        ${note('<b>MIDI keyboard → synth</b> (Chromium / Edge / Brave). midiin(0) unbinds.')}
        ${code(`midiin("prophet")     # play the prophet synth from a MIDI keyboard`)}
        ${note('<b>Fixes</b> — stutter now works on play() (and is chainable: <code>.stutter(4)</code> rolls every step); reverse/rotate/shuffle/mirror now reorder play() drum patterns too, not just synth degrees; drop() is fully bar-quantized so the breakdown lands on a downbeat. The examples ▾ menu is a foldable two-pane flyout, and the docs have new grouped sections (Player transforms · Randomness · Rhythm generators).')}
        ${code(`b1 >> play("x.o.").stutter(4)                 # roll every step
d1 >> play("x-o-x-o-").every(4, "rotate")     # reorder the drum pattern live
drop(16, 4)                                   # bar-locked breakdown`)}
    `, 'alpha28new');

    const alpha29new = section('New synths, scales, FX & pattern methods', `
        ${note('The alpha29 additions — boot audio first, then evaluate any line (Ctrl+Enter).')}
        ${note('<b>Two new synths</b> — arpy (the classic FoxDot arpeggio pluck) and darkpad (dark detuned six-saw pad + sub). And <b>34 more scales</b> — set with Scale.default or pick from the Scale dropdown.')}
        ${code(`Scale.default = "blues"
p1 >> arpy(P[0,2,4,7], oct=5, dur=1/4)              # bright arp pluck
p2 >> darkpad([0,3], oct=4, sus=4, dark=0.7)        # dark pad + sub`)}
        ${note('<b>New chainable Pattern methods.</b> .layer(method,…) zips a transformed copy over itself for instant harmony; .arp expands each note by offsets; .invert flips the melodic contour; .submap dict-remaps values; .select keeps steps by a mask.')}
        ${code(`p3 >> pluck(P[0,2,4,7].layer("add", 2), oct=5, dur=1/4)   # harmony a 3rd up
p4 >> blip(P[0,4].arp([0,7,12]), oct=5, dur=1/8)         # arpeggiate offsets
p5 >> saw(P[0,2,4,7].invert(), oct=5, dur=1/4)           # inverted contour`)}
        ${note('<b>PEuclidR(n, k, rotation)</b> — a rotated Euclidean rhythm as a concrete pattern; .submap turns the 1/0 grid into a play string.')}
        ${code(`d1 >> play(PEuclidR(8, 3, 1).submap({1:"x", 0:"."}))     # rotated euclid kick
h1 >> play("-", dur=1/2).stutter(4)`)}
        ${note('<b>New FX — filters & colour.</b> mpf (Moog ladder LPF), resonz (resonant band-pass), fshift (metallic frequency shift), shimmer (lush octave reverb), clouds (MiClouds granular).')}
        ${code(`b1 >> darkpad([0,3], oct=4, sus=4, mpf=700, mpr=3)                 # fat ladder filter
p6 >> arpy(P[0,4,7], oct=6, dur=1/4, shimmer=0.6, clouds=0.4)     # shimmer + granular
p7 >> saw([0,7], oct=5, dur=1/2, resonz=0.7, rfreq=1400, fshift=80)`)}
        ${note('<b>New FX — techno glue.</b> subenh (adds a sub octave), stereowidth (M/S widener, keeps bass mono), pumper (sidechain-style duck on the beat), room2 (true-stereo reverb), combres (metallic comb resonance).')}
        ${code(`k1 >> play("X", subenh=0.7, stereowidth=0.6)
b2 >> bass([0,0,3,5], oct=4, dur=1/2, pumper=0.8, pumprate=1)   # ducks each beat
p8 >> pads((0,4,7), oct=5, dur=2, room2=0.8, combres=0.4)`)}
    `, 'alpha29new');

    const alpha30new = section('Automation recorder (Alt+T)', `
        ${note('<b>Record a live knob-move into a TimeVar.</b> Put the cursor on any number, press <b>Alt+T</b> to arm (a ● REC badge appears), nudge the value with <b>Alt+↑/↓</b> as usual, then press <b>Alt+T</b> again — your gesture is captured (one point per beat) and swapped into the code as the most pertinent TimeVar. Timing is quantised to whole beats so it loops cleanly.')}
        ${note('Boot audio and run this, then park the cursor on the <code>800</code> and try it:')}
        ${code(`p1 >> saw([0,2,4,7], oct=5, dur=1/4, lpf=800)
#                                          ^ cursor here → Alt+T, sweep Alt+↑ a few beats, Alt+T`)}
        ${note('<b>It picks the pertinent form automatically:</b> a smooth ramp → <code>linvar</code>, an up-then-down wobble → <code>sinvar</code>, and stepped holds → <code>var</code> (a step-hold, not a glide). For example the sweep above becomes something like:')}
        ${code(`p1 >> saw([0,2,4,7], oct=5, dur=1/4, lpf=linvar([800, 4200], 4))`)}
        ${note('<b>Not the form you wanted?</b> With the cursor still on the inserted expression, tap <b>Alt+T</b> to CYCLE through the forms: <code>var → linvar → sinvar → [array]</code>. <b>Esc</b> while recording cancels and restores the original number.')}
        ${code(`# stepped holds (a few big jumps) capture as a step-hold var:
b1 >> bass([0,3], oct=4, dur=1/2, cutoff=var([300, 1200, 600], [2, 2, 4]))
# an up-down move captures as a wobble:
p2 >> pads((0,4,7), oct=5, dur=2, room2=sinvar([0.2, 0.9], 8))`)}
    `, 'alpha30new');

    const exReroll = section('Auto-reroll a generative pattern (reroll)', `
        ${note('<b>.reroll(beats)</b> is a chainable player method — it re-evaluates that player line every N beats, so a FROZEN random generator (motif, PShuf, chaos, a PRand degree) picks new values on its own, no re-running by hand. .reroll(0) stops it; it also stops when the player stops.')}
        ${code(`g1 >> pluck(motif(8), oct=5, dur=1/2, amp=0.5).reroll(4)   # new 8-note motif every 4 beats`)}
        ${note('<b>motif</b> also has a built-in reroll as its 4th arg — <code>motif(n, range, maxStep, reroll)</code> — so it refreshes itself with no method at all:')}
        ${code(`g2 >> pluck(motif(8, 7, 2, 4), oct=5, dur=1/2)   # fresh motif every 4 beats`)}
    `, 'reroll');

    const exOptArgs = section('Option args as a number or a var (arp · PGroove)', `
        ${note('Functions that take a named string option — <b>arp, PGroove, PContour, PClave, PProg</b> — also accept an INTEGER index or a var. With a var, arp and PGroove reshape over time.')}
        ${code(`p1 >> pluck(arp([0,4,7], "updown"), oct=5, dur=1/8)          # by name
p1 >> pluck(arp([0,4,7], 2), oct=5, dur=1/8)                 # 2 == "updown"
p1 >> pluck(arp([0,4,7], var([0,1,3], 4)), oct=5, dur=1/8)   # mode changes every 4 beats
b1 >> bass([0,3], oct=4, dur=PGroove(1))                     # groove by index`)}
    `, 'optargs');

    const exRest = section('Rests in a degree list ( _ / rest )', `
        ${note('A standalone <code>_</code> or bare <code>rest</code> in a degree list fires NO note (true silence). A <code>.</code> still plays degree 0 — so the two are different on purpose.')}
        ${code(`p1 >> pluck([0, _, 4, _, 7, rest, 4, _], oct=5, dur=1/8)   # _ and rest = silence
p2 >> pluck([0, ., 4, ., 7, ., 4, .], oct=4, dur=1/8)      # . plays 0 (compare)`)}
    `, 'rest');

    // ── Technique showcases — one idea at a time ──────────────────────────────
    const t_chords = section('Chords & progressions', `
        ${note('Chords are built in scale degrees, so they stay in key. PChord is one chord, PRoman a numeral progression, PProg a named one, PCircle walks the circle of fifths.')}
        ${code(`Scale.default = "minor"
k1 >> pads(PRoman("i VI III VII"), oct=4, dur=4, reverb=0.4, amp=0.4)
k2 >> organ(PProg("251"), oct=4, dur=2, chorus=0.4, amp=0.3)
p1 >> pluck(PCircle(8), oct=5, dur=1, echo=0.3, amp=0.3)
b1 >> bass([0,5,2,6], oct=3, dur=4, amp=0.5)`)}
    `, 't_chords');

    const t_arps = section('Arpeggios', `
        ${note('arp() walks a chord up / down / updown, PArp uses built-in arp shapes, PGrowArp grows the chord note by note.')}
        ${code(`p1 >> pluck(arp([0,4,7,11], "updown"), oct=5, dur=0.25, echo=0.3, amp=0.35)
p2 >> blip(PArp([0,4,7], 5), oct=6, dur=0.25, room=0.5, amp=0.25)
p3 >> pluck(PGrowArp([0,2,4,7]), oct=5, dur=0.5, amp=0.3)
b1 >> play(x., amp=0.7)   # a short play string just repeats (x. = x.x.x.x.…)`)}
    `, 't_arps');

    const t_cross = section('Cross-player modulation', `
        ${note('Read another player live (arithmetic works), or follow / accompany / map to lock parts together. Pass the other name as a string to the methods.')}
        ${code(`b1 >> bass([0,3,5,7], oct=3, dur=1, amp=0.5)
d1 >> saw(b1.degree + 7, oct=5, dur=1, lpf=1500, amp=0.3)
d2 >> pluck([0], oct=6, dur=0.5, amp=0.3).accompany("b1", [0,2,4])
d3 >> blip([0], oct=6, dur=1, amp=0.25).follow("b1")`)}
    `, 't_cross');

    const t_live = section('Live transforms', `
        ${note('Reshape a pattern over time so you HEAR it change: every / sometimes with rotate, mirror, reverse, stutter.')}
        ${code(`p1 >> saw([0,2,4,7], oct=5, dur=0.25, amp=0.35).every(4, "rotate")
p2 >> pluck([0,2,4,7,9], oct=5, dur=0.25, amp=0.3).sometimes("mirror")
p3 >> blip([0,4,7], oct=6, dur=0.5, amp=0.25).every(8, "reverse")
b1 >> play(x., amp=0.8).sometimes("stutter", 2)`)}
    `, 't_live');

    const t_gen = section('Generative & chaos', `
        ${note('Chaotic maps (PBrown / PLorenz / PLogistic) drift params organically; PThue gives a self-similar accent; son() is a jam bot that builds its own g* players. Boot audio first.')}
        ${code(`p1 >> saw([0,4,7], oct=5, dur=0.25, lpf=PLorenz(400, 4000), amp=0.35)
p2 >> pluck(PBrown(0, 7), oct=5, dur=0.5, room=0.5, amp=0.3)
b1 >> play(x., amp=PThue()*0.4 + 0.5)
# son()     # start the jam bot   —   soff()  stops it`)}
    `, 't_gen');

    // ── Reference tutorials — one tiny runnable example per feature ───────────
    // Data-driven: [id, title, note, code]. Kept short so each is a bite-size lesson
    // you can load from the dropdown and evaluate line by line.
    const tut = (id, title, noteText, codeText) => section(title, note(noteText) + code(codeText), id);
    const TUT_CATS = [
        ['Tut · Rhythm', [
            tut('u_pdur',   'PDur',   'PDur(k, n) — k note-durations spread evenly over n steps (a Euclidean rhythm as durations).', `p1 >> pluck([0,2,4,7], oct=5, dur=PDur(3,8), amp=0.4)`),
            tut('u_peuclid','PEuclid2','PEuclid2(k, n, ".", "x") — a Euclidean rhythm as a play() string: k hits over n steps.', `b1 >> play(PEuclid2(5,8,".","x"), amp=0.8)`),
            tut('u_pbeat',  'PBeat',  'PBeat("x xx x") — durations from a pulse string (a hit starts a new note).', `p1 >> bass([0], oct=3, dur=PBeat("x xx x"), amp=0.5)`),
            tut('u_pbin',   'PBin',   'PBin(n) — the binary digits of n as a 1/0 pattern (great as a gate). PBin(0) is random.', `b1 >> play(x., amplify=PBin(11), amp=0.8)`),
            tut('u_pdrum',  'PDrum',  'PDrum(k, n) — a Euclidean drum play-string, k hits over n steps.', `b1 >> play(PDrum(5,8), amp=0.8)`),
            tut('u_pacc',   'Pacc',   'Pacc(name) — an accent pattern for amp/amplify: backbeat, offbeat, ghost, tresillo…', `h1 >> play(-., amp=Pacc("offbeat"))`),
            tut('u_pclave', 'PClave', 'PClave(name) — a classic clave play-string: son, rumba, bossa, shiko…', `h1 >> play(PClave("son"), hpf=6000, amp=0.5)`),
            tut('u_pgroove','PGroove','PGroove(name) — a named dur feel: swing, shuffle, gallop, triplet, dotted…', `p1 >> pluck([0,2,4], oct=5, dur=PGroove("gallop"), amp=0.4)`),
        ]],
        ['Tut · Notes', [
            tut('u_prand',  'PRand',  'PRand(lo, hi) — a random integer each step. PRand([a,b,c]) picks from a list.', `p1 >> pluck(PRand(0,8), oct=5, dur=0.5, amp=0.4)`),
            tut('u_pwalk',  'PWalk',  'PWalk(max, step) — a random walk that drifts up and down within ±max.', `p1 >> saw(PWalk(7,1), oct=5, dur=0.5, amp=0.35)`),
            tut('u_prange', 'PRange', 'PRange(lo, hi) — a rising ramp lo…hi that repeats.', `p1 >> blip(PRange(0,8), oct=6, dur=0.25, amp=0.3)`),
            tut('u_pstep',  'PStep',  'PStep(n, value, default) — value every n steps, default otherwise. An accent grid.', `p1 >> pluck([0,4,3], oct=5, dur=0.5, amp=PStep(4, 0.7, 0.3))`),
            tut('u_pshuf',  'PShuf',  'PShuf(list) — shuffles the list once at eval, then loops that order.', `p1 >> pluck(PShuf([0,2,4,7]), oct=5, dur=0.5, amp=0.4)`),
            tut('u_pstutter','PStutter','PStutter(list, n) — repeats each value n times.', `p1 >> pluck(PStutter([0,4,7], 2), oct=5, dur=0.25, amp=0.4)`),
            tut('u_palt',   'PAlt',   'PAlt(a, b) — alternates one step from a, one from b.', `p1 >> saw(PAlt([0,2], [7,5]), oct=5, dur=0.5, amp=0.35)`),
            tut('u_psine',  'PSine',  'PSine(lo, hi, len) — a sine sweep over len steps (nice on a param).', `p1 >> saw([0,4,7], oct=5, dur=0.25, lpf=PSine(400, 3000, 16), amp=0.35)`),
            tut('u_melody', 'melody', 'melody() — a wandering random-walk melody. Freeze it with [:n] to loop a fixed phrase.', `p1 >> pluck(melody()[:8], oct=5, dur=0.5, amp=0.4)`),
            tut('u_motif',  'motif',  'motif(n) — a fixed n-note phrase (sampled once) that repeats.', `p1 >> pluck(motif(4), oct=5, dur=0.5, amp=0.4)`),
            tut('u_pcontour','PContour','PContour(shape, n, range) — a melody following a shape: up, down, arch, valley, wave.', `p1 >> saw(PContour("arch", 8, 7), oct=5, dur=0.5, amp=0.35)`),
        ]],
        ['Tut · Harmony', [
            tut('u_pchord', 'PChord', 'PChord(deg, type) — a diatonic chord group on a scale degree. type: 7, 9, sus4…', `k1 >> pads(PChord(0, "7"), oct=4, dur=2, amp=0.4)`),
            tut('u_proman', 'PRoman', 'PRoman("I V vi IV") — a roman-numeral chord progression, in key.', `k1 >> organ(PRoman("i VI III VII"), oct=4, dur=4, amp=0.35)`),
            tut('u_pprog',  'PProg',  'PProg(name) — a named progression: 50s, pop, 251, blues, andalusian…', `k1 >> pads(PProg("50s"), oct=4, dur=4, amp=0.4)`),
            tut('u_pcircle','PCircle','PCircle(n) — walks the diatonic circle of fifths as scale degrees (stays in key).', `p1 >> pluck(PCircle(8), oct=5, dur=1, amp=0.35)`),
            tut('u_arp',    'arp',    'arp(chord, mode) — arpeggiate a chord up / down / updown / random.', `p1 >> pluck(arp([0,4,7,11], "updown"), oct=5, dur=0.25, amp=0.35)`),
            tut('u_pgrowarp','PGrowArp','PGrowArp(chord) — grows the chord note by note: [a],[a,b],[a,b,c]…', `p1 >> pluck(PGrowArp([0,2,4,7]), oct=5, dur=0.5, amp=0.35)`),
        ]],
        ['Tut · Random & chaos', [
            tut('u_pwrand', 'PwRand', 'PwRand(values, weights) — a weighted random pick (first values more likely).', `p1 >> pluck(PwRand([0,4,7],[8,2,1]), oct=5, dur=0.5, amp=0.4)`),
            tut('u_pxrand', 'PxRand', 'PxRand(lo, hi) — random with no immediate repeat.', `p1 >> pluck(PxRand(0,8), oct=5, dur=0.5, amp=0.4)`),
            tut('u_pgauss', 'PGauss', 'PGauss(mean, dev) — Gaussian random (clusters near mean). Great on pan.', `p1 >> saw([0,4,7], oct=5, dur=0.25, pan=PGauss(0, 0.4), amp=0.35)`),
            tut('u_pbrown', 'PBrown', 'PBrown(lo, hi) — a brownian random walk (smooth drift) for organic params.', `p1 >> saw([0,4,7], oct=5, dur=0.25, lpf=PBrown(500, 3500), amp=0.35)`),
            tut('u_plorenz','PLorenz','PLorenz(lo, hi) — a chaotic Lorenz-attractor stream, mapped into a range.', `p1 >> pluck(PLorenz(0, 7), oct=5, dur=0.5, amp=0.35)`),
            tut('u_pthue',  'PThue',  'PThue() — the Thue-Morse sequence (0,1,1,0,1,0,0,1…): a self-similar gate.', `b1 >> play(x., amp=PThue()*0.4 + 0.5)`),
        ]],
        ['Tut · Time (vars)', [
            tut('u_var',    'var',    'var([a,b], [d1,d2]) — steps through values, holding each for d beats (clock time).', `p1 >> saw([0,4,7], oct=var([4,5],[8]), dur=0.5, amp=0.35)`),
            tut('u_linvar', 'linvar', 'linvar([a,b], [dur]) — ramps smoothly a…b over dur beats, then loops. Great on cutoff.', `p1 >> saw([0,4,7], oct=5, dur=0.25, lpf=linvar([400,4000],[8]), amp=0.35)`),
            tut('u_sinvar', 'sinvar', 'sinvar([a,b], [dur]) — a smooth sine ease between values (LFO-like).', `p1 >> saw([0,4,7], oct=5, dur=0.25, lpf=sinvar([500,3000],[8]), amp=0.35)`),
            tut('u_pvar',   'Pvar',   'Pvar([patA, patB], dur) — swaps whole phrases over time while the player keeps stepping.', `p1 >> pluck(Pvar([[0,2,4], [7,4,2,0]], 8), oct=5, dur=0.5, amp=0.4)`),
            tut('u_bpmvar', 'Clock.bpm ramp', 'Clock.bpm accepts a TimeVar so the tempo can ramp. linbpm(from, to, beats) is a shortcut.', `linbpm(120, 140, 32)`),
        ]],
        ['Tut · Player methods', [
            tut('u_every',  '.every',  '.every(n, "method") — call a player method every n beats. Try rotate/reverse/stutter.', `p1 >> saw([0,2,4,7], oct=5, dur=0.25, amp=0.35).every(4, "rotate")`),
            tut('u_sometimes','.sometimes','.sometimes("method", …) — a 50% chance per cycle to apply a method (the line flashes when it fires).', `p1 >> pluck([0,2,4,7,9], oct=5, dur=0.25, amp=0.35).sometimes("mirror")`),
            tut('u_stutter','.stutter','.stutter(n) — roll the next step n times within its own duration.', `b1 >> play(x., amp=0.8).every(4, "stutter", 4)`),
            tut('u_reverse','.reverse','.reverse() — play the degree array backwards for one cycle.', `p1 >> blip([0,2,4,7], oct=6, dur=0.25, amp=0.3).every(4, "reverse")`),
            tut('u_rotate', '.rotate', '.rotate(n) — cyclically shift the degree array live (hear it move with .every).', `p1 >> saw([0,2,4,7], oct=5, dur=0.25, amp=0.35).every(4, "rotate")`),
            tut('u_degrade','.degrade','.degrade(p) — randomly silence a fraction p of steps (thins a pattern out).', `b1 >> play(x., amp=0.8).degrade(0.3)`),
            tut('u_unison', '.unison', '.unison(n, detune) — n detuned, stereo-spread voices for a fat sound.', `p1 >> saw([0,4,7], oct=4, dur=1, amp=0.35).unison(4, 0.4)`),
            tut('u_drummer','.drummer','.drummer() — turn a play() player into a self-evolving rock drummer.', `b1 >> play("x").drummer()`),
            tut('u_solo',   '.solo',   '.solo(beats) — mute everyone else; restore after beats (grid-aligned).', `p1 >> saw([0,4,7], oct=5, dur=0.5, amp=0.4).solo(8)`),
            tut('u_gtr',    '.gtr',    '.gtr(string) — tune a player like a guitar string (chromatic frets). 0–6 = E A D G B e.', `p1 >> guit([0,3,5,7], dur=0.5, amp=0.4).gtr(5)`),
            tut('u_penta',  '.penta',  '.penta() — snap the degrees to the minor pentatonic (always sounds sweet).', `p1 >> pluck(PRand(0,10), oct=5, dur=0.5, amp=0.4).penta()`),
            tut('u_follow', '.follow', '.follow("p1") — track another player degree each step (pass the name as a string).', `b1 >> bass([0,3,5,7], oct=3, dur=1, amp=0.5)
d1 >> pluck([0], oct=6, dur=0.5, amp=0.3).follow("b1")`),
            tut('u_jump',   '.jump',   '.jump(n) — nudge the playhead forward n steps once (a live fill).', `p1 >> saw([0,2,4,7,9,11], oct=5, dur=0.25, amp=0.35).every(3, "jump", 2)`),
            tut('u_strum',  '.strum',  '.strum(spread) — spread a chord over spread beats (an arpeggiated strum).', `p1 >> pads((0,4,7), oct=5, dur=2, amp=0.4).strum(0.06)`),
            tut('u_human',  '.human',  '.human(vel, timing) — humanise dynamics and micro-timing.', `p1 >> pluck([0,2,4,7], oct=5, dur=0.5, amp=0.4).human(20, 8)`),
        ]],
        ['Tut · Functions & live', [
            tut('u_play',   'play',    'play("string") — a drum/sample pattern. A short string repeats: play(x.) = x.x.x.x…', `b1 >> play(x.o., amp=0.8)`),
            tut('u_pbuild', 'pbuild',  'pbuild(genre) — a genre drum-pattern generator: techno, house, dnb, breaks…', `b1 >> play(pbuild("techno"), dur=0.25)`),
            tut('u_loop',   'loop',    'loop(name, dur) — a beat-synced audio loop (register the buffer with loadloop first).', `b1 >> loop("break", dur=8)`),
            tut('u_chaos',  'chaos',   'chaos(n) — paste n random players into the editor to review, then run.', `chaos(3)`),
            tut('u_son',    'son / soff','son() — a generative jam bot that builds and turns over its own g* players (max 5).', `son()
# soff()   to stop`),
            tut('u_drop',   'drop',    'drop(playTime, dropTime) — silence a random subset of players, then restore (bar-aligned).', `drop(14, 2)`),
            tut('u_say',    'say',     'say("text") — speak text via the browser (Web Speech API).', `say("welcome to crashdot")`),
            tut('u_darker', 'darker / lighter','darker() / lighter() — shift Scale.default one mode darker or brighter, live.', `darker()`),
            tut('u_midiin', 'midiin',  'midiin(synth) — play incoming MIDI-keyboard notes through a synth. midiin(0) unbinds.', `midiin("prophet")`),
        ]],
        ['Tut · FX', [
            tut('u_lpf',    'lpf / hpf','lpf / hpf = cutoff Hz — low/high-pass filter. Sweep it with a TimeVar.', `p1 >> saw([0,4,7], oct=5, dur=0.25, lpf=linvar([400,4000],[8]), amp=0.35)`),
            tut('u_bpf',    'bpf',     'bpf = center Hz — a resonant band-pass. bpr sets the width (small = narrow).', `p1 >> saw([0,4,7], oct=5, dur=0.25, bpf=1200, bpr=0.2, amp=0.35)`),
            tut('u_eq3',    'eq3',     'eq3 = mix — a 3-band EQ. eqlow/eqmid/eqhigh in dB.', `b1 >> play(x.o., eq3=1, eqlow=4, eqhigh=-3, amp=0.8)`),
            tut('u_reverb', 'reverb',  'reverb = mix — room reverb. room sets size, damp the tone.', `p1 >> pads([0,4,7], oct=5, dur=4, reverb=0.5, room=0.9, amp=0.4)`),
            tut('u_echo',   'echo',    'echo = mix — a delay. echo_time in beats.', `p1 >> blip([0,4,7], oct=6, dur=0.5, echo=0.4, echo_time=0.375, amp=0.3)`),
            tut('u_pong',   'pong',    'pong = mix — a ping-pong delay that bounces L↔R. pongtime in beats.', `p1 >> pluck([0,4,7], oct=6, dur=0.5, pong=0.5, pongtime=0.375, amp=0.3)`),
            tut('u_spin',   'spin',    'spin = mix — a stereo auto-pan that rotates the sound. spinrate in Hz.', `p1 >> saw([0,4,7], oct=5, dur=0.5, spin=0.6, amp=0.35)`),
            tut('u_chop',   'chop',    'chop = slices per beat — a tempo-locked gate that chops the sound rhythmically.', `p1 >> saw([0,4,7], oct=4, dur=2, chop=4, amp=0.4)`),
            tut('u_crush',  'crush',   'crush = mix — bitcrush. bits sets the depth (lower = grittier).', `p1 >> pluck([0,4,7], oct=5, dur=0.5, crush=0.6, bits=4, amp=0.35)`),
        ]],
    ];

    // ── Deep dives — param-heavy features explained line by line ──────────────
    const deep = (id, title, notes, codeText) => section(title, notes.map(n => note(n)).join('') + code(codeText), id);
    const DEEP = [
        deep('d_pbuild', 'pbuild — genre drums', [
            `<b>pbuild(genre, opts)</b> generates a genre drum pattern as a play() string — feed it to play() with a small dur (0.25 = sixteenths). Every knob is a keyword:`,
            `<b>genre</b>: a name (techno · ebm · house · dnb · breaks · halftime · industrial · reggae · afro) or an index number. &nbsp; <b>evolve</b>: bars before it loops, each a small mutation (default 8). &nbsp; <b>fill</b>: drop a fill every N bars. &nbsp; <b>density</b>: 0–1, thins hits out below 1.`,
            `<b>kick / snare / hat / perc</b> are per-bar GATES: 1 = on, 0 = off, a genre name to borrow that layer, or a pattern (PBin(4) / {1,0} / &lt;1 0&gt;) to toggle the layer bar by bar.`,
        ], `b1 >> play(pbuild("techno"), dur=0.25)                        # the simplest form
b1 >> play(pbuild("dnb", evolve=16, fill=4, density=0.8), dur=0.25)  # evolves, fills, a bit sparser
b1 >> play(pbuild("house", snare=[1, 0], hat="dnb"), dur=0.25)   # snare every other bar, borrow dnb hats`),
        deep('d_drummer', '.drummer — evolving drums', [
            `<b>.drummer(durloop, durPlayer)</b> turns a play() player into a self-evolving rock drummer. It picks a random groove + fill, swaps the fill in for the tail of each loop, and re-randomises the groove every durloop beats.`,
            `<b>durloop</b>: beats before it re-rolls the groove (default 16). &nbsp; <b>durPlayer</b>: the step duration (default 0.5). Chain it onto any play() seed.`,
        ], `b1 >> play("x").drummer()             # defaults: re-roll every 16 beats, dur 0.5
b1 >> play("x").drummer(8, 0.25)      # busier: re-roll every 8 beats, sixteenth steps`),
        deep('d_human', '.human — feel', [
            `<b>.human(velocity, humanize, swing)</b> humanises a player. <b>velocity</b> spreads amp (dynamics), <b>humanize</b> jitters the timing (± % of the step), <b>swing</b> pushes the offbeats later (%).`,
            `Under the hood it sets a 2-step <code>delay</code> (timing) and <code>amplify</code> (velocity) pattern — so it works on synths and play() alike.`,
        ], `p1 >> pluck([0,2,4,7], oct=5, dur=0.5, amp=0.4).human(20, 8)     # a loose, breathing feel
b1 >> play(x., amp=0.8).human(30, 5, 20)   # a short play string just repeats (x. = x.x.x.x.…)`),
        deep('d_every', '.every / .sometimes — triggers', [
            `<b>.every(n, "method", …args)</b> calls a player method every n beats; <b>.sometimes("method", …)</b> gives a 50% chance per cycle (also often / rarely / almostNever / always). The line flashes when a modifier fires.`,
            `A trailing <code>name=value</code> is a KWARG: it overrides that param just for the trigger, then restores a step later — perfect for a splash of reverb or crush on a fill.`,
        ], `p1 >> saw([0,2,4,7], oct=5, dur=0.25, amp=0.35).every(8, "reverse")
p1 >> pluck([0,4,7], oct=5, dur=0.5, amp=0.4).sometimes("stutter", 4, mverb=0.6)
b1 >> play(x., amp=0.8).every(4, "stutter", 4, crush=0.6)`),
        deep('d_son', 'son — the jam bot', [
            `<b>son(opts)</b> starts a generative jam bot that builds, tweaks and retires its own g* players over time. It holds a HARD cap of 5 of its own voices (your manual players never count) and keeps turning them over.`,
            `<b>opts</b> — min / max: the voice count (default 3–5). synth / drum: how often it adds each type. every: [lo, hi] beats between changes. In a session its lines broadcast to peers. <b>soff()</b> stops the loop; <b>soff(true)</b> also stops its players.`,
        ], `son()                                       # start (3–5 g* voices)
son({min:2, max:4, drum:0.5, every:[4,8]})  # fewer voices, more drums, slower changes
# soff()      # stop the loop   —   soff(true)   stop and clear its players`),
        deep('d_timevar', 'TimeVars — how they sweep', [
            `A TimeVar advances against the CLOCK (real beat time), not the step count — so two players stay perfectly in sync. <b>var([a,b],[d1,d2])</b> holds each value for d beats; <b>linvar</b> ramps smoothly between them; <b>sinvar / expvar</b> ease differently.`,
            `The durations list LOOPS: linvar([400,4000],[8]) sweeps up over 8 beats then jumps back. Add values for a longer, smoother cycle: linvar([400,4000,400],[4,4]) goes up then back down.`,
        ], `p1 >> saw([0,4,7], oct=5, dur=0.25, lpf=linvar([400,4000],[8]), amp=0.35)
p1 >> saw([0,4,7], oct=5, dur=0.25, lpf=linvar([400,4000,400],[4,4]), amp=0.35)`),
        deep('d_euclid', 'Euclidean rhythms — how', [
            `The Euclidean algorithm spreads k hits as evenly as possible over n steps (Bjorklund). <b>PEuclid2(k, n, off, on)</b> renders it as a play string; <b>PDur(k, n)</b> turns the same grid into note DURATIONS instead; PDur takes a <b>rotate</b> arg to shift the pattern.`,
        ], `b1 >> play(PEuclid2(3,8,".","x"), amp=0.8)     # 3 in 8  ->  x..x..x.
b1 >> play(PEuclid2(5,8,".","x"), amp=0.8)     # 5 in 8  ->  x.xx.xx.
p1 >> bass([0], oct=3, dur=PDur(3,8, rotate=1), amp=0.5)   # same grid, rotated, as durations`),
        deep('d_unison', '.unison — fat sounds', [
            `<b>.unison(n, detune, spread)</b> stacks n copies of every note, detuned by ± detune semitones and panned across the stereo field (spread 0–100). Turns a thin saw into a wide supersaw.`,
        ], `p1 >> saw([0,4,7], oct=4, dur=1, amp=0.35).unison(2)           # subtle doubling
p1 >> saw([0,4,7], oct=4, dur=1, amp=0.3).unison(6, 0.5, 100)  # wide, detuned stack`),
    ];

    const shorelines = section('Shorelines — svdk', `
        ${note('A live <code>#@</code> set by <b>svdk</b> — put the cursor on <code>#@intro</code> and Ctrl+Enter, then let it auto-advance through the arrangement: an <code>ebass</code> + <code>brass</code> build, a gallop <code>dafbass</code> groove, <code>a_vpad</code> &amp; <code>darkpad</code> textures, and a <code>pbuild</code> techno drop. Boot + load the kit first.')}
        ${code(`#@#@ shorelines

#@intro(12)
v1 >> ebass([0], pick=0.414, rq=0.5, cutoff=250, decay=0.01, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02).unison(3)

#@build(8)
v2 >> a_hhat([0], tone=8000, decay=0.1, metallic=1, dist=2, open=PBin(8), echo=0.5, mverb=0.5)

#@peak(12)
v3 >> brass([PRoman("I V vi IV")], cutoff=2000, rq=0.4, bright=0.5, dur=8, amp=0.5, lpf=200)

# new fx, synths
#@break(8)
g12 >> dafbass([6, 0, 9, 7, 9, 7], sus=1/4, oct=PStep(4, 5, 4), dur=PGroove("gallop"), amp=0.21).human(32, 5) + (0,3,7)

#@drop(8)
g12 >> dafbass([6, 0, 9, 7, 9, 7], sus=1/2, oct=PStep(4, 3, 4), dur=PGroove("gallop"), amp=0.21).human(32, 5) + (0,3,7)

# galaxy map — to see active jam sessions
#@outro(8)
g22 >> a_vpad(PContour([4, 2, 1], 8, 7), oct=[5, 6], dur=PDur(3,8), amp=PWhite(0.32, 0.40), fshift=292, fmix=0.39).sometimes("reverse", 4).after(4, "stop") + 7

#@part7(12)
g16 >> a_bd(arp([0,4,7,11], var([0, 1, 2], 4)), oct=[5, 6], dur=[1/4, 1/2], amp=0.41).every(4, "mirror")
g61 >> a_hhat(arp([0,4,7], "updown"), oct=6, dur=PGroove(8), amp=PWhite(0.31, 0.39)) + [0, 3]
g22.oct=4

# bug fixes
#@part8(12)
v1.dur=4
v3.stop()
g12.stop()
g5 >> darkpad(PProg("andalusian"), oct=5, dur=4, amp=0.39, shape=0.0, tremolo=0.69, trem_rate=8).penta().human(27, 4)
v4 >> a_bd([0], click=1, punch=PRhythm([1, (3, 8)]), oct=3, sub=1, dist=1, sus=1/2, dur=PDur(5, 8))
g22.stop()

#@part9(4)
g1 >> dbass(PStep(4, 7, 0), oct=6, dur=1, amp=0.74, vowel=0.52)
g22.dur=4
g16.oct=3

#@part10(16)
g126 >> rsin(PGrowArp([0,4,7]), oct=5, dur=1/4, amp=0.33, tube=0.73).sometimes("reverse", 3)

#@part11(16)
v2.stop()
g16.stop()
g5.oct=4
g1.oct=4
g126.oct=4
g6 >> cs80(motif(4), oct=5, dur=PDur([3, 5],8), amp=0.32, vowel=0.60, pong=0.39, pongtime=0.25)
v1 >> ebass(PCircle(2), pick=0.414, rq=0.5, cutoff=250, decay=0.01, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02).unison(3)

#@part12(12)
g22 >> a_vpad(PContour([4, 2, 1], 8, 7), oct=[5, 6], dur=PDur(3,8), amp=PWhite(0.32, 0.40), fshift=292, fmix=0.39).sometimes("reverse", 4).after(4, "stop") + 7
v4 >> play("..C.", fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)
v5 >> play("k")

# music in your browser!
#@part13(12)
v2 >> a_hhat([0], tone=8000, decay=0.1, metallic=1, dist=2, open=PBin(8), echo=0.5, mverb=0.5)
v4.stop()

#@part14(8)
v1 >> ebass([0], pick=0.414, rq=0.5, cutoff=250, decay=0.01, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02).unison(3)

#@part15(8)
v6 >> play(pbuild("techno", evolve=8, fill=4, density=1, kick=1, snare=1, hat=1, perc=1))

#@part16(24)
v3 >> brass([PRoman("I V vi IV")], cutoff=2000, rq=0.4, bright=0.5, dur=8, amp=0.5, lpf=200)
g16 >> a_bd(arp([0,4,7,11], var([0, 1, 2], 4)), oct=[5, 6], dur=[1/4, 1/2], amp=0.41).every(4, "mirror")

# try alpha now!
#@part20(16)
v1 >> ebass([0], pick=0.414, rq=0.5, cutoff=250, decay=0.01, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02).unison(3).only()

#@end(16)`)}
    `, 'shorelines');

    const dubplate = section('Dubplate — svdk', `
        ${note('A dub-techno live <code>#@</code> set by <b>svdk</b> — a <code>rhodes</code> skank on the offbeat whose chord quality morphs via <code>PChord(0, var([3,7,6], 8))</code>, a deep evolving <code>dbass</code> sub, <code>squiz</code> percussion and a <code>pbuild</code> techno engine, unwinding to a frozen-reverb outro. Boot + load the kit first, then put the cursor on <code>#@intro</code> and Ctrl+Enter — it auto-advances through the whole arrangement.')}
        ${code(`#@#@ dubplate

#@intro(8)
Clock.bpm = 130
Root.default = "D"
Scale.default = "minor"

# a rhodes chord skank on the offbeat, drenched in delay + reverb, glued with comp
#@build(28)
k1 >> rhodes(PChord(0, var([3, 7, 6], 8)), oct=4, dur=1, sus=0.35, release=0.3, cutoff=1800, echo=0.5, echo_time=0.375, mverb=0.6, comp=0.6, compthresh=0.2, amp=0.35).offbeat()

#@peak(16)
b1 >> dbass([0, 0, 5, 3], oct=(5, 4), dur=2, tanh=0.2, lpf=linvar([700, 1000, 1100, 1400, 1700, 2000, 2300, 2400, 2700, 2900], [1, 2, 1, 1, 1, 1, 1, 2, 1, 0.25]), amp=0.6).unison(3)

#@break(8)
b1 >> dbass([0, 0, 5, 3], fbdelay=0.5, fbtime=0.5, fbfeed=0.5, fbcutoff=3000, fbspread=0.02, oct=(5, 6), dur=2, tanh=0.2, lpf=linvar([700, 1000, 1100, 1400, 1700, 2000, 2300, 2400, 2700, 2900], [1, 2, 1, 1, 1, 1, 1, 2, 1, 0.25]), amp=0.6).unison(3)

#@drop(8)
d2 >> play("...c", dur=1, squiz=0.6, squizpitch=3, room=0.5, amp=0.4).sometimes("stutter", 3)

#@outro(16)
k1 >> rhodes(PChord(0, var([3, 7, 6], 8)), oct=(4, 5), dur=2, sus=0.5, cutoff=1800, echo=0.5, echo_time=0.375, mverb=0.6, comp=0.6, compthresh=0.2, amp=0.35).offbeat()

#@part7(8)
p1 >> supersaw([0, (0,3,7)], oct=4, dur=1, cutoff=sinvar([600, 4000], [8]), squiz=0.4, squizpitch=2, amp=0.3).every(8, "reverse")

#@part8(8)
d1 >> play("x", dur=1, amp=0.8)
h1 >> play(".-", dur=0.5, hpf=7000, amp=0.4)

#@part9(8)
k1 >> rhodes(PChord(0, var([3, 7, 6], 8)), oct=4, dur=2, sus=0.5, cutoff=1800, echo=0.5, echo_time=0.375, mverb=0.6, comp=0.6, compthresh=0.2, amp=0.35).offbeat()

#@part10(8)
d1 >> play("x", dur=1, amp=0.8, sample=2)
h1 >> play("<-->", dur=0.5, hpf=7000, amp=0.4)
d2 >> play("...c", dur=1, squiz=0.6, squizpitch=3, room=0.5, amp=0.4).sometimes("stutter", 3)

#@part11(4)
k1 >> rhodes(PChord(0, var([3, 7, 6], 8)), oct=5, dur=2, sus=0.5, cutoff=1800, echo=0.5, echo_time=0.375, mverb=0.6, comp=0.6, compthresh=0.2, amp=0.35).offbeat()

#@part12(8)
b1 >> dbass([0, 0, 5, 3], oct=5, hpf=200, dur=2, tanh=0.2, lpf=linvar([700, 1000, 1100, 1400, 1700, 2000, 2300, 2400, 2700, 2900], [1, 2, 1, 1, 1, 1, 1, 2, 1, 0.25]), amp=0.6).unison(3)

#@part13(16)
h1.stop()
k1 >> rhodes(PChord(0, var([3, 7, 6], 8)), oct=5, dur=1, sus=0.5, cutoff=1800, echo=0.5, echo_time=0.375, mverb=0.6, comp=0.6, compthresh=0.2, amp=0.35).offbeat()
d1.rate=2
d1.fbdelay=0.25
p1.oct=4
k1.oct=4
b1.stop()

#@part14(8)
v1 >> play(pbuild("techno", evolve=8, fill=4, density=1, kick=1, snare=1, hat=1, perc=1))

#@part15(8)
p1.stop()
d2.stop()
v1.stop()

#@part16(8)
d1.stop()
k1 >> rhodes(PChord(0, var([3, 7, 6], 8)), oct=[5, 6], dur=2, sus=1, cutoff=linvar([1800, 700], [16]), echo=0.6, echo_time=0.375, echo_dec=0.85, mverb=0.7, comp=0.6, compthresh=0.2, amp=0.32).offbeat()
b1 >> dbass([0, 5], oct=4, dur=4, lpf=linvar([1600, 250], [16]), tanh=0.2, amp=linvar([0.6, 0.15], [16])).unison(3)
h1 >> play("-", dur=2, hpf=9000, amp=0.2)

#@part17(16)
h1.stop()
b1.stop()
k1 >> rhodes(PChord(0, "add9"), oct=5, dur=16, sus=16, cutoff=520, echo=0.7, echo_dec=0.9, mverb=0.9, mverbfreeze=1, comp=0.6, compthresh=0.2, amp=linvar([0.3, 0], [16])).offbeat()

#@end(16)`)}
    `, 'dubplate');

    const thelakeisgreen = section('The Lake is Green — svdk', `
        ${note('A deep evolving <code>#@</code> set by <b>svdk</b> — a stacked-FM <code>faim</code> lead over <code>klank</code> / <code>basic</code> chords, a chaotic <code>cbass</code> (<code>PLorenz</code>) low end, euclidean percussion, and layered <code>plaits</code> / <code>organ</code> / <code>synthbass</code> voices, all breathing on <code>Pvar</code> phrase-swaps and TimeVars. Boot audio, put the cursor on <code>#@intro</code> and Ctrl+Enter — no <code>#@end</code>, so it runs on.')}
        ${code(`#@#@ thelakeisgreen

#@intro(8)
Clock.bpm = 124
Scale.default = "minor"
faim >> faim(Pvar([PPing([0, 5, 1, 0]), P[5, 1, 6, 6].mirror()], 16), oct=5, dur=PGroove(0), amp=PWhite(0.29, 1), pan=var([-0.5, 0.5], 8), drop=0.60, dropof=0.39, mverb=PWhite(0.37, 0.68), mverbmix=0.6).reroll(16).sometimes("reverse", 2) + (0,4,7)

#@temp(8)
tempo >> basic(PChord(0, "add9"), oct=4, dur=Pvar([2, 4], 16), amp=0.43, pan=sinvar([-1, 1], [16]), spin=0.58).every(8, "mirror")
klank >> klank(PChord(0, "sus4"), oct=4, dur=2, amp=var([0.38, 0.44, 0.37], 8), pan=var([-0.5, 0.5], 4), room2=0.63, mix2=0.21, ebmix=0.64, ebfeed=0.59).penta().reroll(4) + [0, 3]
basic >> basic((0,4,7,11), oct=Pvar([4, 6], 8), dur=4, amp=sinvar([0.33, 0.42], [8]), pan=PWhite(-0.7, 0.7), rgate=0.51, rgaterate=8, tanh=0.5).penta().every(16, "rotate")

#@temp2(8)
heavy >> cbass(PLorenz(0, 5), oct=4, dur=2, amp=sinvar([0.57, 0.73], [8]), flanger=0.1, flanger_rate=0.55, room=0.75, reverb=0.34).penta()

#@intro3(8)
heavy >> cbass([0, -1, 7, 0], oct=4, dur=1, amp=PWhite(0.73, 0.63)[:4], ringmod=0.2, echo=var([0, 1], 4), leg=[0, 0, 0.2, 1, 2, 2, 4], ringmod_freq=790).sometimes("mirror") + (0,4,7)
air  >> blip(Pvar([[7], [7, 11]], 8), oct=6, dur=[4, 2, 2], fbdelay=0.5, lpf=1800, lpr=0.1, amp=0.13, mverb=0.85, echo=0.4, echo_time=0.5, pan=PWhite(-0.6, 0.6))
basic >> basic(PRoman("i iv VII"), oct=4, dur=[4, [2, 2]], amp=linvar([0.32, 0.33], [16]), pan=sinvar([-1, 1], [16]), pong=0.40, pongtime=0.25).penta()

#@intro4(8)
perc >> play(PEuclid2(5, 8, ".", "R"), dur=1/4, amp=0.76, octclean=0.53, ocsub=0.68, ocup=0.41, leg=12).sometimes("stutter", 3)
lead >> plaits(Pvar([PShuf([0,3,5,7]), arp([0,4,7,11], var([0, 1, 2], 8))], 8), oct=5, dur=1/2, amp=Pacc("offbeat"), pan=sinvar([-1, 1], [8]), tanh=0.5, mverb=0.8, pong=0.5, pongtime=0.25, pongfeed=0.5).reroll(4)
bell >> bell((0,4,7,11), oct=5, dur=Pvar([2, 4], 16), amp=PWhite(0.33, 0.35)[:4], pan=PWhite(-0.7, 0.7), feed=0.54, feedfreq=1548).every(16, "rotate")
organ >> organ(P[0,4,7,11].layer("add", 4), oct=[4, 6, 4], dur=[4, [2, 2]], amp=Pacc("offbeat"), pan=PWhite(-0.7, 0.7), formant=0.71, formant_vowel=4, spin=0.43)

#@intro5(8)
organ >> organ(P[0,4,7,11].layer("add", 4), oct=[4, 6, 4], dur=[4, [2, 2]], amp=Pacc("offbeat"), pan=PWhite(-0.7, 0.7), formant=0.71, formant_vowel=4, spin=0.43)
pad  >> pads((0, 4, 7), oct=4, dur=8, amp=0.26, mverb=0.7, lpf=linvar([400, 2200], [16]))
lead  >> pluck(arp([0, 4, 7], "up"), oct=5, dur=1/2, amp=0.4, leg=0.6, lpf=sinvar([1200, 5000], [8]), echo=0.3, echo_time=0.375).penta().every(8, "reverse")
bassline >> acidbass([0, {0, 3, 5}], oct=var([3, 5], 4), dur=var([1, 1/2], 8), amp=Pacc("offbeat"), room2=0.61, mix2=0.5).penta().unison(3)
plaits >> plaits(Pvar([PShuf([0,3,5,7]), arp([0,4,7,11], var([0, 1, 2], 8))], 8), oct=4, dur=1/2, amp=Pacc("offbeat"), pan=sinvar([-1, 1], [8]), tanh=0.4, mverb=0.5).reroll(4)

#@intro6(8)
ssaw >> ssaw([2, 0, 6, 7, 7, 2], oct=PRand([5, 5, 7]), dur=var([1/4, 1/2], 8), amp=sinvar([0.31, 0.39], [8]), pan=PGauss(0, 0.50), lofi=0.53, drcomp=0.67).sometimes("mirror", 3)
perc >> play(PEuclid2(5, 8, ".", "R"), dur=1/4, amp=0.76, octclean=0.53, ocsub=0.68, ocup=0.41, leg=12).sometimes("stutter", 3)
pad >> choir(Pvar([(0, 4, 7), (2, 5, 9)], 8), oct=4, dur=8, amp=0.3, mverb=0.7)
lead >> synthbass(Pvar([PShuf([0,3,5,7]), arp([0,4,7,11], var([2, 4, 2], 8))], 8), oct=(4, 5), dur=1/2, amp=Pacc("offbeat"), pan=sinvar([-1, 1], [8]), tanh=0.5, mverb=0.8, pong=0.5, pongtime=0.1, pongfeed=4, attack=0.1).reroll(4)

#@intro7(8)
stab  >> prophet([0, _, 3, _, 5, _, 7, _], oct=5, dur=1/2, sus=0.2, leg=0.4, amp=0.26, pan=sinvar([-0.6, 0.6], [8])) + (0, 4, 7)
accompany >> basic((0,4,7,11), oct=Pvar([4, 6], 8), dur=4, amp=sinvar([0.33, 0.42], [8]), pan=PWhite(-0.7, 0.7), rgate=0.51, rgaterate=8, tanh=0.5).penta().every(16, "rotate")
lead  >> pluck(Pvar([arp([0, 4, 7], "up"), melody()[:8]], 8), oct=[5, 6], dur=1/2, amp=0.42, lpf=sinvar([1500, 6000], [8])).penta()
perc >> play(PEuclid2(5, 8, ".", "X"), dur=1/4, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02, leg=4, octclean=4, rate=0.5, ocsub=40, ocup=0.3, amp=0.26, octclean=0.53, ocsub=0.68, ocup=0.41, leg=12).sometimes("stutter", 3)`)}
    `, 'thelakeisgreen');

    const no_harm = section('no_harm — svdk', `
        ${note('A hard phrygian techno <code>#@</code> set by <b>svdk</b> — a distorted <code>a_bd</code> kick over evolving <code>dbass</code> / <code>ebass</code> / <code>a_daft</code> layers driven by <code>multicrush</code>, <code>resonbank</code> sweeps and feedback delays, stacked and re-soloed through the <code>#@noise2</code> parts into a <code>pbuild</code> techno engine. Boot + load the kit first, then put the cursor on <code>#@settings</code> and Ctrl+Enter — it auto-advances through the whole arrangement.')}
        ${code(`#@settings(2)
Clock.bpm = 138
Root.default = "C"
Scale.default = "phrygian"

#@bd(8)
k1 >> a_bd([0], oct=2, dur=1, dist=4, punch=PLorenz(4, 8), amp=1, echo=0.125)


#@snare(8)
d1 >> play("....o...", dur=0.5, sample=9, comp=0.5, amp=0.8, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02, mverb=0.2, echo=0.1, rate=(12, 6), pan=[-1, 1])

#@bass(16)
p1 >> dbass([0, 3, 5, 0, 7, 5, 3, 0], oct=3, cheapverb=0.5, cvdecay=4, cvdamp=0.2, dur=0.25, cutoff=linvar([500, 4500], [8]), drive=2, tanh=1, spin=0, comp=0.1, amp=0.83, multicrush=0.6, mclowdrive=2, mcmiddrive=2, mchighdrive=2, mclofreq=300, mchifreq=2500)

#@bass2(16)
p2 >> dbass([0, 3, 5, 0, 7, 5, 3, 0], oct=4, cheapverb=0.1, cvdecay=1, cvdamp=0.1, dur=0.25, cutoff=linvar([500, 4500], [8]), drive=1, tanh=1, spin=0, comp=0.1, amp=0.83, multicrush=var([0, 1], [14, 2]), mclowdrive=0.3, mcmiddrive=[2, 3,2, 2, 4, 5], mchighdrive=0, octclean=5, ocsub=10, ocup=0.6, mclofreq=300, mchifreq=2500).unison(3)

#@bassone(16)
p1 >> dbass([0, 3, 5, 0, 7, 5, 3, 0], oct=5, cheapverb=0.2, cvdecay=4, cvdamp=0.2, dur=0.25, cutoff=linvar([500, 4500], [8]), drive=2, tanh=1, spin=0, comp=0.1, amp=0.83, multicrush=0.6, mclowdrive=1, mcmiddrive=0, mchighdrive=2, mclofreq=300, mchifreq=2500)

#@hihat(16)
h1 >> play("-", dur=0.25, hpf=8000, amp=Pacc("offbeat"))

#@noise(16)
p2 >> dbass([0, 3, 5, 0, 7, 5, 3, 0], oct=4, cheapverb=0.3, cvdecay=1, cvdamp=0.1, dur=0.25, cutoff=linvar([500, 4500], [8]), drive=2, tanh=1, spin=0, comp=0.1, amp=0.83, multicrush=0.6, mclowdrive=1, mcmiddrive=2, mchighdrive=2, octclean=1, ocsub=5, ocup=0.4, mclofreq=300, mchifreq=2500, phaser=0.5).unison(3)

#@noise2(16)
p2 >> dbass([0, 3, 5, 0, 7, 5, 3, 0], oct=4, cheapverb=0.3, cvdecay=1, cvdamp=0.1, dur=0.25, cutoff=linvar([500, 4500], [8]), drive=2, tanh=1, spin=0, comp=0.1, amp=0.83, multicrush=0.6, mclowdrive=1, mcmiddrive=2, mchighdrive=4, octclean=3, ocsub=6, ocup=0.6, mclofreq=300, mchifreq=2500, phaser=0.6, phaser_rate=4).unison(3)

#@noise2(16)
p1 >> dbass([0, 3, 5, 0, 7, 5, 3, 0], oct=6, cheapverb=0.5, cvdecay=4, cvdamp=0.2, dur=0.25, cutoff=linvar([500, 4500], [8]), drive=2, tanh=0, spin=0, comp=0.1, amp=0.83, multicrush=0.2, mclowdrive=0.2, mcmiddrive=0, mchighdrive=2, mclofreq=300, mchifreq=2500)

#@noise2(32)
p1 >> dbass([0, 3, 5, 0, 7, 5, 3, 0], oct=6, cheapverb=0.5, cvdecay=4, cvdamp=0.2, dur=0.25, cutoff=linvar([500, 4500], [8]), drive=1, tanh=0, spin=0, comp=0.1, amp=0.83, multicrush=0.6, resonbank=0.03, rbfreq=70, rbdecay=0.5, rbspread=1, mclowdrive=4, mcmiddrive=2, mchighdrive=2, mclofreq=300, mchifreq=2500).unison(3)

#@noise2(16)
p2.oct=5
p1.oct=5
soloRnd()

#@noise2(32)
d1 >> play([--], sample=3)
v2 >> play(X)
h1 >> play("[-]", dur=0.25, hpf=8000, amp=Pacc("offbeat"))
p2.oct=4
p1.oct=4

#@noise2(16)
v3 >> a_bd(amp=4, click=4, sub=1, oct=3, tanh=4, dist2=0.3).unison(5)

#@noise2(16)
v3 >> a_bd(amp=4, click=40, sub=10, oct=3, tanh=1, dist2=0.2).unison(5).every(4, "stutter", click=12, oct=2)

#@noise2(32)
v4 >> play(pbuild("techno", evolve=8, fill=4, density=1, kick=1, snare=1, hat=1, perc=1), comp=0.5, compthresh=0.3, compratio=4, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)
soloRnd()

#@noise2(16)
p1 >> dbass([0, 3, 5, 0, 7, 5, 3, 0], oct=6, cheapverb=0.5, cvdecay=4, cvdamp=0.2, dur=0.25, cutoff=linvar([500, 4500], [8]), drive=1, tanh=0, spin=0, comp=0.1, amp=0.83, multicrush=0.2, resonbank=linvar([0.03, 0.08], 128), rbfreq=70, rbdecay=0.5, rbspread=1, mclowdrive=4, mcmiddrive=2, mchighdrive=2, mclofreq=300, mchifreq=2500, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02).unison(3)

#@noise2(16)
v3 >> a_bd(amp=2, click=40, sub=50, oct=3, tanh=1, dist2=0.2).unison(5).every(4, "stutter", click=12, oct=2)
v5 >> play([XX], comp=4, tanh=4, dist2=2)

#@noise2(16)
p1.comp=12

#@noise2(16)
p2.comp=24
soloRnd()

#@noise2(16)
p2 >> pads([0, 3, 5, 0, 7, 5, 3, 0], oct=4, cheapverb=0.3, cvdecay=1, cvdamp=0.1, dur=0.25, cutoff=linvar([500, 4500], [8]), drive=2, tanh=1, spin=0, comp=0.1, amp=0.83, multicrush=0.6, mclowdrive=1, mcmiddrive=2, mchighdrive=2, octclean=4, ocsub=4, ocup=4, mclofreq=300, mchifreq=2500, phaser=0.5).unison(3)

#@noise2(16)
p1 >> ebass([0, 3, 5, 0, 7, 5, 3, 0], oct=6, cheapverb=0.5, cvdecay=4, cvdamp=0.2, dur=0.25, cutoff=linvar([500, 4500], [8]), drive=1, tanh=1, spin=0, comp=0.7, amp=0.83, multicrush=0.2, resonbank=linvar([0.03, 0.08], 128), rbfreq=12, rbdecay=0.5, rbspread=1, mclowdrive=4, mcmiddrive=8, mchighdrive=2, mclofreq=300, mchifreq=2500, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02).unison(3)

#@noise2(16)
v1 >> play(..C., fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02, mverb=0.5, sample=4, echo=0.5, amp=2)

#@noise2(16)
v2 >> play([KKXX], amp=2)

#@noise2(16)
p1 >> a_daft([0, 3, 5, 0, 7, 5, 3, 0], oct=5, cheapverb=0.5, cvdecay=4, cvdamp=0.2, dur=0.25, cutoff=linvar([500, 4500], [8]), drive=1, tanh=0, spin=0, comp=0.1, amp=0.83, multicrush=0.2, resonbank=linvar([0.03, 0.08], 128), rbfreq=70, rbdecay=0.5, rbspread=1, mclowdrive=4, mcmiddrive=2, mchighdrive=2, mclofreq=300, mchifreq=2500, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02).unison(3)

#@noise2(16)
v6 >> play(V, amp=8).every(32, "stutter", 8)



k1.oct=5
v5.stop()`)}
    `, 'no_harm');

    const flickering = section('Flickering Streets at Dawn — svdk', `
        ${note('A long dark <code>#@</code> set by <b>svdk</b> — detuned <code>synthbass</code> arps drifting through root &amp; scale changes, then an andalusian <code>darkpad</code> with rich <code>cs80</code> chords (<code>PRoman</code> / <code>PProg</code>) and a slow unwind to a lone <code>cs80</code>. Boot audio, put the cursor on <code>#@intro</code> and Ctrl+Enter — it auto-advances through the whole arrangement.')}
        ${code(`#flickering streets at dawn
#svdk
Clock.bpm = 120

#@intro(20)
Root.default = "F"
ld >> synthbass(arp([0, 3, [3, 7], 10, 12], 3), oct=4, dur=1/4, sus=0.5, detune=0.25, cutoff=sinvar([1200, 4000], [4]), rq=0.35, fenv=2, dist=1.3, echo=0.3, echo_time=0.375, pan=[-0.4, 0.4], amp=0.45).every(8, "shuffle").unison(3)

#@synth(32)
b4 >> synthbass([0, _, _, 0, 0, _, (4, 3), 3], oct=(6, 3), dur=2, atk=0.5, mverb=0.8, sus=2, detune=0.45, cutoff=sinvar([500, 1400], [8]), rq=0.42, fenv=4, dist=1.7, pumper=0.7).unison(5)

#@rootchange(24)
Root.default = "C"
ld >> synthbass(arp([0, 3, 7, 10, 12], 3), oct=4, dur=1/4, sus=0.5, detune=0.25, cutoff=sinvar([1200, 4000], [4]), rq=0.35, fenv=4, dist=1.3, echo=0.3, echo_time=0.375, pan=[-0.4, 0.4], amp=0.45).every(8, "shuffle").unison(3)



#@varyingroot(16)
Root.default = var(["E", "G", "E#", "A"])
b1 >> synthbass([0, 0, 7, 0, 0, 3, 5, 3], oct=6, dur=1/2, sus=0.7, detune=0.45, cutoff=linvar([1200, 300], [16]), rq=0.4, fenv=3, dist=0.6, amp=linvar([0.9, 0], [16]), octclean=1, ocsub=0, ocup=1).unison(3)

#@tweakb4(8)
b4 >> synthbass([0, _, _, 0, 0, _, (4, 3), 3], oct=(6, 3), dur=2, atk=0.5, mverb=0.8, sus=2, detune=0.45, cutoff=sinvar([500, 1400], [8]), rq=0.42, fenv=8, dist=1.7, pumper=0.7).unison(5)

#@masteroctave(16)
b4.oct=3
ld.oct=3
b1.oct=4

#@follow(24)
b1 >> synthbass([0, 0, 7, 0, 0, 3, 5, 3], oct=6, dur=1/2, sus=0.7, detune=0.45, cutoff=linvar([1200, 300], [16]), rq=0.4, fenv=3, dist=1.6, amp=linvar([0.9, 0], [16]), octclean=1, ocsub=0, ocup=1).unison(3)

#@padding(16)
Scale.default = "minor"
Root.default = "C"
pad >> darkpad(PProg("andalusian"), oct=4, dur=4, sus=4, attack=1.6, amp=0.4, cutoff=sinvar([500, 2200], [16]), rq=0.3, reverb=0.6, room=0.9, chorus=0.5)
ld.stop()
key >> cs80(PRoman("i9 VII VI7 V"), oct=6, dur=4, sus=3.5, amp=0.2, attack=1.2, lpf=3200, rq=0.2, reverb=0.5, chorus=0.4)
top >> pluck(PContour("wave", 8, 7), oct=5, dur=1/2, sus=0.3, amp=0.24, echo=0.3, echo_time=0.375, lpf=sinvar([1800, 6000], [8]), pan=[-0.3, 0.3])

#@part10(8)
bs >> synthbass([0, 6, 5, 4], oct=5, dur=4, sus=2, detune=0.3, cutoff=linvar([400, 1300], [16]), rq=0.4, fenv=3, dist=1.5, amp=0.5).unison(3)

#@part11(4)
b4.oct=3
b1.oct=2
pad.oct=2

#@part12(12)
key >> cs80(PRoman("i VI III VII"), drive=0.5, tanh=1, amp=1)

#@part13(8)
key >> cs80(PRoman("i iv VI v7 III VII iv V"), oct=5, dur=2)

#@part14(16)
pad >> darkpad(PProg("minor"))
top >> pluck(arp([0,2,4,6], "updown", 2), oct=(4, 5), dur=1/4)

#@part15(16)
b4.stop()
pad.stop()

#@part16(16)
b1.stop()

#@part17(16)
key.only()

#@part18(12)
top.stop()

#@part19(12)
bs.stop()

#@part20(16)
key.stop()

#@end(16)`)}
    `, 'flickering');

    // Grouped into COLLAPSIBLE categories, with a table-of-contents overview at
    // the top (the page got long). Each category is a <div class="docs-catgroup">
    // whose header (.docs-cat-toggle) folds its .docs-catbody; all but the first
    // start collapsed so the tab opens as a scannable overview. exampleList() reads
    // the .docs-cat-name header (in document order) so the dropdown optgroups stay
    // in sync with this page.
    // The workshop absorption (see vj-port.md). Its own section rather than a
    // paragraph in vAll, because it is a second KIND of scene, not more of the same.
    const vWorkshop = section('Workshop layers — 190 more scenes & 52 per-layer FX', `
        ${note('crashDot has <b>two kinds of visual</b> now, and it is worth knowing which you are using. A <b>video synth</b> (49 of them) is a scalar FIELD — one function evaluated per pixel on the GPU and coloured by the <code>palette()</code>, so <code>hue</code>/<code>pal</code> steer it and it costs almost nothing. A <b>workshop layer</b> (190) is an imperative DRAW that brings its own colour, ported from the stars/workshop VJ tool — <code>palette()</code> does nothing to it, and it runs on the CPU, so a few at once is the sensible number. Everything else is identical: same <code>videoN &gt;&gt;</code> syntax, same channels, same crossfader, same universal knobs, same patterns and TimeVars on every param.')}
        ${code(`video1 >> doomcorridor(speed=1.4, fog=0.6)          # a workshop layer
video2 >> plasma(ch=1)                              # a field scene on deck B
video9 >> mix(sinvar([0, 1], 16))                   # crossfade between the two kinds

video1 >> mandelbulb(power=sinvar([2, 9], 32))      # every param takes a pattern/TimeVar
video1 >> boids(count=PRand(60, 240), dur=4)        # …re-rolled every 4 beats, like a player`)}
        ${note('<b>Where to find them:</b> Ctrl+Space after <code>video1 &gt;&gt; </code> lists both groups — "video synths" then "workshop layers" — and picking one inserts the full call with every knob at its real default, so the controls are in front of you. That is the index; the families below are just a map.')}
        ${note('<b>3D & raymarched</b> — mandelbulb · mandelbox · apollonian · volume · kalitunnel · tesseract · torusknot · gyroidslice · supershape · mobiusstrip · platonicsolid · cubefield · neongrid3d · sphere3d · wireframe3d · hyperspace')}
        ${note('<b>Worlds</b> — doomcorridor · cityosm · neoncity · mazecity · wireframecity · cyberpunkworld · fpvdrone · icecave · redroom · trontunnel · starnest · galaxyspiral')}
        ${note('<b>Life & simulation</b> — boids · boidstrails · slimemold · mycelium · rhizome · gol · cyclicca · langtonsant · diffgrowth · turingpattern · bzreaction · reactiondiff · evolutionplayground · virusspread · fallingsand · sandpile · crystalgrowth · coralbranch · fractaltree · lsystem · dnahelix · neuralnet')}
        ${note('<b>Maths & attractors</b> — clifford · lorenzsystem · attractor · ifsfractal · burningship · newtonfractal · juliacycles · ulamspiral · quasicrystal · hyperbolictile · phyllotaxis · spirograph · hitomezashi · truchettiles · floweroflife · polarmandala · magiccircle · runecircle · arabesque')}
        ${note('<b>Audio-reactive</b> — freqtower · waveform · spectrogramscroll · freqmatrix · vumeter · tooneq · xyoscope · cymatics · chladniplate · audiotterrain · beatcreatures · instrumentpop')}
        ${note('<b>Data & Ikeda</b> — ikedabarcode · ikedacircuit · ikedamatrix · ikedaoscillo · ikedascan · ikedadots · ikedacoords · datapulse · matrixrain · binaryrain · dnasequence · mathsymbols · quantumascii')}
        ${note('<b>Text & typography</b> — text · impacttext · newsticker · mastofeed · propaganda · neonsign · sevensegment · stockticker · scrollingtext · countdown · glitchword · typoburst · terminalprompt · systemboot · codefull · codeconspiracy · livecode · codecomic · comicpanels · ransomeval')}
        ${note('<b>Glitch & film</b> — vhsstatic · punkstatic · glitchstorm · scratchfilm · flickerfilm · filmleader · breakingoverlay · bloodsplatter · drostefeedback · pixelsort · fractalkaleidoscope')}
        ${note('<b>System & crash</b> — biospost · sysmonitor · cpuheat · surveillance · crashserver · cricbombing · cricwifiattack · resistancenet · nuclearblast · circuitboard · circuitscanner · evalseismograph · systemgauge')}
        ${note('<b>Organic & motion</b> — ferrofluid · lavalamp · inkblot · nebuladust · sanddune · seawaves · bubblesfloat · ribbonflow · prismlight · lasershow · magneticfield · holographicwave · elasticgrid · voronoiflow · curlflow · flowfield · particleburst · orbitsystem · pendulum · pendulumwave · arcdischarge · crystallattice · moirepattern · waveinterference · morphshape · clockface · radarsweep · stringart · constellation · splineweave · starburst · hypnoscope · quantumwave · organicmachine · organicmorphing · bodyhorror · biospine · tileflip · oceandata · danceparty · cliftscene · asciifire · asciiplasma · asciiradar · asciiwaveform · shapes · testpat · black · pong')}
        ${note('<b>Live input</b> — <code>webcam</code>, <code>media</code> (a video/image you pick) and <code>gifbank</code>. These are the only layers that draw nothing until you give them a source.')}
        ${note('<b>52 per-layer FX.</b> Chain them with <code>+</code> like any other, but these apply to <b>that layer alone</b>, on its own canvas — which crashDot\'s own FX cannot do, being uniforms over the whole frame. New here: <code>vhs · datamosh · oilPaint · neonGlow · ledWall · badSignal · halftone · duotone · thermal · crystalize · displace3d · warholGrid · lensFlare · frameDiff · motionBlur · chromaticAberration · rgbOffset · sliceGlitch · echoZoom · zoomBurst · zoomPulse · seamlessScroll · pixelDrift · pixelWarp · contourLines · solarize · threshold · chromaKey · ascii · grain · tint · colorAdjust · strobe · ripple · dropShadow · tileGrid3d</code>. A bare call sets the effect\'s first parameter — <code>vhs(0.6)</code> — or pass an object for the rest.')}
        ${code(`video1 >> doomcorridor() + vhs(0.6) + neonGlow(0.5)     # both on this layer only
video2 >> plasma(ch=1) + bloom(0.4)                     # a GLOBAL fx, whole frame

# master grade + output limiter (neutral at 1, unlike every other fx)
video1 >> plasma() + sat(1.5) + exposure(1.1) + contrast(1.2) + ceiling(0.85)`)}
        ${note('<b>ceiling()</b> caps output brightness. It is the answer to something bloom does: a lighter-blend stacks to solid white on bright content, which is why every VJ desk gates output level. <b>sat/exposure/contrast</b> are the master grade — one look knob over the finished frame, separate from any layer\'s own hue.')}
        ${note('<b>Running a video line no longer opens a window.</b> It used to, back when the pop-out WAS the only place visuals could go. Now there is the SCREEN panel on the desktop and an explicit output manager for projectors, so where the picture goes is a decision you make once — with <code>output()</code>, or by opening SCREEN — rather than a side effect of evaluating a line. A set that spawns a browser window every time you run a scene is a set that fights you. crashDot says once, in the log, where the picture went.')}
        ${note('<b>What the SCREEN panel shows</b> is the master mix by default, and it is a picker now — hover the panel and one appears top-right, or use the first row of OUTPUTS; both drive the same manager so they cannot disagree. It used to show the master mix and nothing else, which made it the one place a picture could go that you could not point at anything. It is the first row of the OUTPUTS panel now, with the same source picker: the mix, any single live layer, or a code buffer. Fewer controls than a projector, honestly — a warp inside a pan/zoom workspace is meaningless and there is no second projector to edge-blend it against. Showing the mix costs exactly what it always did: the picker\'s overlay is hidden and the renderer draws straight through it.')}
        ${note('<b>Output windows — the projector desk.</b> <code>output()</code> opens a projector window; <code>output(3)</code> gives it three independently warped SURFACES, and that is the point: one output is one projector, and N surfaces in it are N warped patches of content. Pin a flat quad onto each visible face of a box or a truss corner and the object reads as mapped — it is how MadMapper and Resolume handle faceted objects, without any 3D rendering. Each surface picks its own <b>source</b>: the master mix, any single live workshop layer on its own, or <b>a code buffer</b> — the set, or any scratch, rendered as a texture with its syntax colouring, updating as you type. So one face of the object carries the visuals and another carries the code making them, which is the thing a live-coding show has always wanted a projector for. (The buffer source is the code as it is RIGHT NOW; the <code>codefull</code> layer is the other reading — the code that RAN, accumulating and flashing on each eval.) In the output window: <b>[w]</b> shows the warp handles · <b>[m]</b> cycles 4pt → edge → mesh · <b>[</b> and <b>]</b> change the mesh grid · <b>[r]</b> resets · <b>[f]</b> fullscreen. The OUTPUTS panel does the same from the desktop, with a source picker and edge-blend sliders per surface. Mapping is saved on this machine and never shared or stored in a look — it describes where a projector sits in a room. Outputs are not reopened by themselves after a refresh (a reload that spawns projector windows unasked is worse than one that forgets); REOPEN brings one back with its mapping.')}
        ${note('<b>Projection mapping.</b> In the pop-out visuals window press <b>[w]</b> — the same key an output window uses for the same gesture: four corner handles appear, and dragging them warps the output onto whatever quad your projector actually lands on — the same corner-pin every mapping tool gives you. Four sliders below set <b>edge blending</b>, which fades the output to black along an edge so two projectors can overlap without a bright seam; each one fades its own light where the neighbour begins. <b>[r]</b> resets, <b>[w]</b> again leaves. It is saved on this machine and is deliberately NOT part of a session or a saved look: corners and blends describe where a projector sits in a room, not what the piece looks like, so joining a jam can never yank a calibrated projector.')}
        ${note('<b>Per-layer opacity and blend.</b> Until now several layers on one deck could only stack by field-MAX, and the only blend in the app was the crossfader\'s — which combines the two finished DECKS, a different question. Every layer takes <code>opacity</code> (0–1) and <code>blend</code>: <code>max</code> · <code>add</code> · <code>multiply</code> · <code>screen</code> · <code>difference</code> · <code>over</code>. <code>max</code> is the default because it is exactly what stacking did before this existed, so an old set looks identical. Both are ordinary params, so a pattern or TimeVar drives them like anything else — <code>opacity=sinvar([0,1],16)</code> breathes a layer in and out. The LAYERS panel puts them under each layer\'s header, with the deck button, because they describe how a layer MEETS the others rather than what it looks like alone.')}
        ${code(`video1 >> plasma(ch=0)
video2 >> rings(ch=0, blend="multiply", opacity=0.6)     # stack them, not just max
video3 >> boids(ch=0, blend="add", opacity=sinvar([0, 1], 16))`)}
        ${note('<b>The FX chain, on the layer row.</b> Each effect on a layer is a chip in chain order with a knob on its amount and a × to drop it; <code>+ fx</code> adds one, and a new effect lands at the END — the same place typing <code>+ vhs(0.6)</code> would have put it. The picker is in two groups because they are two different things: <b>whole frame (GPU)</b> is crashDot\'s own, a uniform over the finished picture, and <b>this layer only</b> is the workshop\'s, drawn on that layer\'s canvas. Which one runs also decides the default you get: on a workshop layer the workshop implements it, so the value comes from that effect\'s own declared range; anywhere else it is crashDot\'s. That is why <code>invert</code> arrives as <code>true</code> on a video synth and as a number on a workshop layer.')}
        ${note('<b>The LAYERS panel — turn the knobs without typing.</b> 239 scenes carrying up to twenty parameters each, and until now the only way to move one was to type a number and re-run the line. That is right for composing and wrong for FINDING a look, which you do by turning something and watching. The panel lists every live video layer with its params as real dials, using each one\'s declared range; <code>ch0</code>/<code>ch1</code> moves a layer between the decks; <b>→ CODE</b> writes that one layer back out as a line with everything you have dialled in. Perform with the knobs, then keep it as text — the same loop the piano panel uses. One thing it is honest about: a param driven by a pattern or a TimeVar shows as <b>pattern</b> and gets no knob, because a knob cannot represent <code>sinvar([0,1],8)</code> and turning one would replace the movement with a fixed number.')}
        ${note('<b>vrand(n, seed)</b> pastes a random look — the visual twin of <code>chaos()</code>, and it works the same way on purpose: it does not change what is on screen, it writes LINES you read, edit and run. A generator that mutates hidden state gives you a picture you cannot keep, edit or share; one that writes code gives you all three, and it reaches a jam because the buffer does. It is <b>seeded</b>: <code>vrand(3, 1234)</code> is the same three layers on every machine, so a look can be described in a message, and an unseeded call writes the seed it used into the comment — so a happy accident is reproducible after the fact. Values are drawn from each param\'s OWN declared range (1,987 of them across the 206 layers), not a shared 0–1: a cutoff at 0.5 and a particle count at 0.5 are not the same request.')}
        ${note('<b>vrec()</b> records the picture. crashDot could already record the three other things a set is made of — <code>rec audio</code>, <code>rec code</code>, <code>rec midi</code> — and not what it looked like. <code>vrec()</code> arms, <code>vrec()</code> again stops and downloads a <code>.webm</code>; <code>vrec("myset")</code> names the file. Deliberately the same shape as <code>midi_rec()</code>, because it is the same gesture. It records the composited output — the same picture the SCREEN panel shows and an output window copies — with projector warping excluded, since that describes a room rather than the piece.')}
        ${note('<b>vsnap()</b> prints what is on screen as the code that would make it — every live layer with its params at their CURRENT values, its FX chain, the crossfader and the palette. Paste it into your set to keep a look. <code>vsnap(true)</code> writes every knob, which is how you find out what a layer even has. This is deliberately code rather than a saved preset: a look you can read and edit is worth more than one you can only recall, and code is in the shared buffer, so it reaches everyone in a jam.')}
        ${note('<b>Cost, and what crashDot does about it.</b> A workshop layer draws on the CPU, on the same thread as the note scheduler — so an expensive one makes the AUDIO late, which is the one thing that must not happen. Most are cheap (0.1–0.8ms a frame) and it never comes up. A few are not: <code>slimemold</code> runs a per-agent simulation and costs ~17ms, more than a whole frame at 60fps. Those are throttled automatically — a layer that cannot afford a frame does not get one, it redraws every 2nd or 6th frame instead and its last picture keeps compositing, so it runs at 10 or 20fps inside a 60fps mix rather than dragging the mix down to its rate. You will see a line in the console naming any layer that gets throttled. Interestingly the cost barely depends on RESOLUTION — these layers do fixed geometry work, not pixel filling — so <code>wres(px)</code>, which caps the size they draw at (default 1280 on the longest edge), is about the texture upload rather than the drawing. <code>wres(0)</code> turns the cap off, which is what you want for text and data-wall layers where sharpness is the point.')}
        ${note('<b>In a session</b>, visuals sync because they are text: every peer evaluates the same line and renders it locally. Workshop layers animate on the <b>shared beat</b> rather than on each machine\'s clock, so a strobe fires on the same frame everywhere and a sweep is at the same point — which also means the picture speeds up with the tempo. What does not sync is the dice: a layer that calls random differs in its fine detail per peer, exactly as <code>PRand</code> does in the audio.')}
    `, 'vworkshop');

    const vAll = section('Visuals — scenes, FX & the mixer', `
        ${note('The pop-out <b>visuals</b> window is a <b>2-channel video mixer</b>, coded in this same editor. Name a player <code>video1</code>, <code>video2</code>, … (the <code>video</code> prefix is the convention — autocomplete then offers scenes/FX): <code>video1 &gt;&gt; plasma()</code> puts a scene on <b>deck A</b> (<code>ch=0</code>), <code>video2 &gt;&gt; tunnel(ch=1)</code> on <b>deck B</b>, and <code>video9 &gt;&gt; mix(x)</code> crossfades A↔B (x = 0→A … 1→B; a number, pattern or TimeVar) with a <code>blend=</code> mode. Layers on a deck stack by field-max. <code>palette()</code> sets the colour ramp, <code>vmode()</code> the look (smooth · pixel · glyph ramps). Chain post-FX with <code>+</code> — <code>video1 &gt;&gt; plasma() + bloom(0.5)</code>. Ctrl+Space after <code>video1 &gt;&gt; </code> lists scenes; after <code>+ </code> lists FX.')}
        ${note('The whole catalogue of the FIELD scenes as one runnable <code>#@</code> set — all <b>49</b> of them, all <b>17</b> global FX and all 7 blends. (The 190 workshop layers and their 52 per-layer FX are the next section.) Boot audio, run a video player to open the visuals window, put the cursor on <code>#@intro</code> and Ctrl+Enter — it auto-advances through every scene family, each part chaining different FX.')}
        ${code(`#@#@ all visuals — every scene & FX

#@intro(8)
Clock.bpm = 128
Scale.default = "minor"
d1 >> play("x-o-", amp=0.7)                     # any audio makes the scenes react
b1 >> dbass([0, 3, 5], oct=4, dur=1/2, amp=0.5)
palette("neon")
vmode("smooth")                                 # smooth · pixel · shade · blocks · ascii · dots · bars
# vres(0.5)                                     # ↓ render resolution if a weak machine struggles

# ═══ CLASSIC — plasma tunnel wave rain spiral cells ═══
#@classic(16)
video1 >> plasma(ch=0, pal="fire") + bloom(0.5)
video2 >> tunnel(ch=0)
video3 >> wave(ch=0)
video4 >> rain(ch=1, pal="matrix")
video5 >> spiral(ch=1)
video6 >> cells(ch=1)
video9 >> mix(sinvar([0, 1], [16]), blend="screen")

# ═══ FIELDS — starfield nebula moire bars grid ripple ═══
#@fields(16)
video1 >> starfield(ch=0) + trails(0.85)
video2 >> nebula(ch=0, pal="ice")
video3 >> moire(ch=0)
video4 >> bars(ch=1, pal="acid")
video5 >> grid(ch=1)
video6 >> ripple(ch=1)
video9 >> mix(linvar([0, 1], [8]), blend="add")

# ═══ ENERGY — fire aurora kaleido warp metaballs hexgrid ═══
#@energy(16)
video1 >> fire(ch=0, pal="blood") + blur(0.3)
video2 >> aurora(ch=0)
video3 >> kaleido(ch=0)
video4 >> warp(ch=1, pal="cyber") + vignette(0.5)
video5 >> metaballs(ch=1)
video6 >> hexgrid(ch=1)
video9 >> mix(0.5, blend="difference")

# ═══ GEOMETRY — checker swarm flow contour voronoi helix ═══
#@geometry(16)
video1 >> checker(ch=0) + scan(0.4)
video2 >> swarm(ch=0)
video3 >> flow(ch=0)
video4 >> contour(ch=1, pal="vhs") + glitch(0.6)
video5 >> voronoi(ch=1)
video6 >> helix(ch=1)
video7 >> mosaic(ch=1, cells=10, mode=4, fill=sinvar([0.2, 0.6], [8]), shift=linvar([0, 1], 8), react=0.8)
video9 >> mix(sinvar([0.2, 0.8], [8]), blend="wipe")

# ═══ SYMMETRY — mandala lattice truchet noise rings spectrum marble ═══
#@symmetry(16)
video1 >> mandala(ch=0) + droste(0.6)
video2 >> lattice(ch=0)
video3 >> truchet(ch=0) + fold(0.5)
video4 >> noise(ch=1)
video5 >> rings(ch=1) + hueshift(linvar([0, 1], [8]))
video6 >> spectrum(ch=1)
video7 >> marble(ch=1)
video9 >> mix(0.5, blend="multiply")
palette("sunset")

# ═══ IKEDA — testpattern interference biomech escher circuit panopticon ═══
#@ikeda(16)
video7.stop()
video1 >> testpattern(ch=0) + dither(0.7)
video2 >> interference(ch=0)
video3 >> biomech(ch=0)
video4 >> escher(ch=1) + edge(0.9)
video5 >> circuit(ch=1) + pixelsort(0.6)
video6 >> panopticon(ch=1)
video9 >> mix(sinvar([0, 1], [8]), blend="dissolve")
palette("mono")

# ═══ CLIFT — penrose mobius hexdump lissajous ikedaglitch ═══
#@clift(16)
video6.stop()
video1 >> penrose(ch=0) + mirror(0.8)
video2 >> mobius(ch=0) + pixelate(0.5)
video3 >> hexdump(ch=1, pal="matrix") + feedback(0.7)
video4 >> lissajous(ch=1) + posterize(4)
video5 >> ikedaglitch(ch=1) + invert()
video9 >> mix(0.5, blend="add")

# ═══ SPECTRUM (FFT-reactive) — barcode equalizer datamatrix ═══
#@spectrum(16)
video6.stop()
video1 >> barcode(ch=0, pal="cyber")            # driven by the live FFT — play some audio
video2 >> datamatrix(ch=0)
video3 >> equalizer(ch=1, pal="acid")
video4 >> butterfly(ch=1, pal="neon")           # mirrored FFT bars
video5.stop()
video9 >> mix(sinvar([0, 1], [8]), blend="screen")

# ═══ STORM & TUNNEL — tron lightning ═══
#@storm(16)
video2.stop()
video3.stop()
video4.stop()
video1 >> tron(ch=0, pal="cyber")               # receding neon tunnel
video6 >> lightning(ch=1, pal="ice")            # bolts over an fbm sky
video9 >> mix(sinvar([0, 1], [16]), blend="add")

#@outro(16)
clear()                                         # wipe the trails for a clean finale ([c] in the window)
video2.stop()
video3.stop()
video4.stop()
video5.stop()
video1 >> aurora(ch=0, pal="ice", bright=1.2) + trails(0.9)
video9 >> mix(0)`)}
        ${note('<b>49 scenes</b> — plasma tunnel wave rain spiral cells starfield nebula moire bars grid ripple fire aurora kaleido warp metaballs hexgrid checker swarm flow contour voronoi helix mandala lattice truchet noise rings spectrum marble · testpattern interference biomech escher circuit panopticon penrose mobius hexdump lissajous ikedaglitch · barcode equalizer datamatrix (FFT-reactive) · tron butterfly lightning · mosaic (a fully-parametric colour grid — cells/rows/fill/shift/mode/seed/gap/react, 6 activation modes). <b>17 FX</b> (chain with <code>+</code>) — trails feedback blur bloom scan vignette glitch invert posterize droste fold hueshift dither pixelsort mirror edge pixelate. <b>7 blends</b> — mix add screen multiply difference wipe dissolve. <b>10 palettes</b> — fire ice neon sunset matrix mono blood cyber vhs acid (also by index: <code>pal=7</code>). <b>7 render modes</b> — smooth pixel shade blocks ascii dots bars via <code>vmode()</code>.')}
    `, 'vis-all');

    const celeste = section('Celeste — svdk', `
        ${note('A bright <code>major</code> <code>#@</code> set by <b>svdk</b> built on an inline <code>defsynth</code> — a shimmering additive <b>celeste</b> (sine partials + a faintly inharmonic 4.2× shimmer) played as two hard-panned voices detuned by <code>dur=1/3 * 1.012</code> for a chorus beat, over a <code>PGrowArp</code> organ, a <code>darkpad</code> progression and a deep <code>sine</code> bass — then the key floats through <code>var(["major", "lydian", "mixolydian"])</code>. Boot audio, put the cursor on <code>#@intro</code> and Ctrl+Enter — it auto-advances through the arrangement.')}
        ${code(`#@#@ celeste

#@intro(8)
Clock.bpm = 138
Scale.default = "major"
Root.default = "C"

# an additive celeste voice, defined live in the browser (no sclang)
defsynth("celeste", { bright: 1 }, ({ out, note, amp, sus, pan, attack, release, bright }) => {
  const f = note.midicps()
  const env = EnvGen.ar(Env.perc(0.001, sus, 1, -4), { doneAction: 2 })
  let sig = SinOsc.ar(f)
  sig = sig.add(SinOsc.ar(f.mul(2)).mul(0.5))
  sig = sig.add(SinOsc.ar(f.mul(3)).mul(0.25).mul(bright))
  sig = sig.add(SinOsc.ar(f.mul(4.2)).mul(0.12).mul(bright))   // slight inharmonic shimmer
  sig = sig.mul(env).mul(amp).mul(0.4)
  Out.ar(out, Pan2.ar(sig, pan))
})

#@lead(16)
p1 >> celeste([0, 2, 4, 7, 4, 2], oct=5, dur=1/3,         sus=0.2, amp=0.4, pan=-0.4, room=0.6, reverb=0.6)
p2 >> celeste([0, 2, 4, 7, 4, 2], oct=5, dur=1/3 * 1.012, sus=0.1, amp=0.4, pan=0.4,  room=0.6, reverb=0.6)

#@full(16)
ar >> organ(PGrowArp([0, 2, 4, 7, 9]), oct=5, dur=1/8, sus=0.12, amp=0.24, lpf=4500, room=0.4)
pd >> darkpad(PProg("pop"), oct=4, dur=8, sus=8, amp=0.28, attack=2.5, cutoff=1400, reverb=0.6, room=0.9, chorus=0.4)
bs >> sine([0, 4, 5, 3], oct=2, dur=8, sus=6, amp=0.5, lpf=700)      # roots of I V vi IV

#@shift(16)
Scale.default = var(["major", "lydian", "mixolydian"])
pd >> darkpad(PProg("andalusian"), oct=4, dur=8)

#@end(16)`)}
    `, 'celeste');

    const slug = (s) => 'cat-' + s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const GROUPS = [
        ['Live sets',       [celeste, no_harm, thelakeisgreen, rise, dresdensunlight, sunsetdribble, shorelines, flickering, dubplate, showcase, nocturne, darkchill, filmscore, virtualreality, tenebrae, scorched, inthemood, karpDMK]],
        ['Techniques',      [t_chords, t_arps, t_cross, t_live, t_gen, whatsNew, alpha30new, exReroll]],
        ['Basics',          [welcome, start, drums, synths, tweak]],
        ['Patterns & time', [logic, axis1, sometimes, transforms, axis2, randomness, axis3, patterns, grooves, rhythms, syncGen, exOptArgs, exRest]],
        ['Sound design',    [fx, defsynthEx, synAdditive, synSubtractive, synFM, alpha29new, samples, loop]],
        ['Perform & MIDI',  [sections, midi, perf]],
        ['Visuals',         [vAll, vWorkshop]],
        ['Deep dives',      DEEP],
        ...TUT_CATS,
    ];
    const toc = `<div class="docs-toc"><span class="docs-toc-lbl">Jump to</span>` +
        GROUPS.map(([name, secs]) =>
            `<a class="docs-toc-link" data-cat="${slug(name)}">${name}<span class="docs-toc-n">${secs.length}</span></a>`
        ).join('') + `</div>`;
    const groups = GROUPS.map(([name, secs], i) =>
        `<div class="docs-catgroup${i === 0 ? '' : ' collapsed'}" id="${slug(name)}">
            <div class="docs-cat docs-cat-toggle"><span class="docs-cat-arrow">▸</span><span class="docs-cat-name">${name}</span><span class="docs-cat-n">${secs.length}</span></div>
            <div class="docs-catbody">${secs.join('')}</div>
        </div>`).join('');
    return toc + groups;
}

// ── Workflow tab — how the editor & systems work, with examples ────────────────

function _sectionToCode(sec) {
    const out = [];
    sec.querySelectorAll('.docs-code').forEach(el => out.push(el.textContent.replace(/\s+$/, '')));
    return out.join('\n\n');   // a blank line between blocks, where a section has several
}

// [{ id, title, cat }] for the example sections, in document order, tagged with the
// category header (.docs-cat) they fall under — so the dropdown can build optgroups
// matching the Examples page exactly.
export function exampleList() {
    const doc = new DOMParser().parseFromString(buildExamples(), 'text/html');
    const out = [];
    let cat = '';
    for (const el of doc.querySelectorAll('.docs-cat, .docs-section')) {
        if (el.classList.contains('docs-cat')) { cat = (el.querySelector('.docs-cat-name')?.textContent || el.textContent).trim(); continue; }
        const id = (el.id || '').replace(/^ex-/, '');
        if (id) out.push({ id, title: (el.querySelector('.docs-section-title')?.textContent || '').trim(), cat });
    }
    return out;
}

// Runnable buffer for ONE example section (by id), or all of them ('all').
export function exampleCode(id) {
    if (id === 'all' || !id) return examplesAsCode();
    const doc = new DOMParser().parseFromString(buildExamples(), 'text/html');
    const sec = doc.getElementById('ex-' + id);
    if (!sec) return '';
    return _sectionToCode(sec) + '\n';
}

// Turn the whole Examples tab into a runnable editor buffer.
export function examplesAsCode() {
    const doc = new DOMParser().parseFromString(buildExamples(), 'text/html');
    const out = [];
    doc.querySelectorAll('.docs-section').forEach(sec => { out.push(_sectionToCode(sec)); out.push(''); });
    return out.join('\n');
}

// Split a long entry into a scannable headline + the rest (revealed on click).
// Prefer the "Headline — details" dash; else the first sentence.
