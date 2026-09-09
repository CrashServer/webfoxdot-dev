// In-app documentation panel — tabs for Shortcuts, Synths, FX, Patterns, Functions.

import { SYNTH_DEFS } from '../synths/registry.js';
import { FX_REGISTRY } from '../fx/registry.js';
import { SCENES as V_SCENE_LIST, PALETTE_NAMES, RENDER_MODE_NAMES, BLEND_NAMES } from '../visuals/vdata.js';

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
    { key: 'Ctrl+Enter',         desc: 'Run the current line (or the selection)' },
    { key: 'Ctrl+Alt+Enter',     desc: 'Run the whole block at the cursor' },
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
    { key: 'Alt+T',              desc: 'Automation record: arm on a number, nudge it live, Alt+T again → var/linvar/sinvar (Alt+T cycles the form, Esc cancels)' },
    { key: 'Ctrl+/',             desc: 'Toggle line comment' },
    { key: 'Ctrl+Alt+N',         desc: 'New scratch buffer — a blank canvas next to your set, local to you' },
    { key: 'Alt+1 … Alt+9',      desc: 'Switch buffer — Alt+1 is the set, the rest are your scratch canvases' },
    { key: 'Shift+Alt+B',        desc: 'Toggle the visuals as a live background behind the editor (or vbg())' },
    { key: 'Shift+Alt+Z',        desc: 'Zen — hide all UI' },
];

export const PATTERNS = [
    { name: 'PRand(lo, hi)',            desc: 'Random integer between lo and hi each step' },
    { name: 'PWhite(lo, hi)',           desc: 'Uniform random float between lo and hi' },
    { name: 'PWalk(max, step, start)',  desc: 'Random walk — moves ±step from start, bounded to [-max, max]' },
    { name: 'PDur(k, n, rotate=0, dur=1)', desc: 'Euclidean durations — k pulses in n steps; rotate cyclically shifts the list. e.g. PDur(3,8)' },
    { name: 'PPing(list)',              desc: 'Ping-pong through a list: [0,1,2] → 0,1,2,1,0,1,…' },
    { name: 'PStutter(p, n)',           desc: 'Repeat each element of p exactly n times' },
    { name: 'PAlt(a, b)',               desc: 'Alternate one step from a, one from b' },
    { name: 'PShuf(values)',            desc: 'Shuffle the list once, cycle the result' },
    { name: 'PBern(p)',                 desc: 'Bernoulli sequence — 1 with probability p' },
    { name: 'PCoin(p)',                 desc: 'Return 0 or 1 with probability p' },
    { name: 'PEuclid(n, k)',            desc: 'Euclidean rhythm — k pulses in n steps' },
    { name: 'PEuclid2(n, k, lo, hi)',   desc: 'Euclidean rhythm of n pulses in k steps, filled with lo/hi (great for play() chars: PEuclid2(3,8,".","x"))' },
    { name: 'PEuclidR(n, k, rotation=0)', desc: 'Rotated Euclidean rhythm as a concrete 0/1 pattern — composes with methods/arithmetic: play(PEuclidR(8,3,1).submap({1:"x",0:"."})) or amp=PEuclidR(16,7,2)' },
    { name: 'PRange(lo, hi)',           desc: 'Linear ramp from lo to hi, then repeat' },
    { name: 'PStep(n, v, default=0)',   desc: 'v every n steps (at 0, n, 2n…), default otherwise → PStep(4,7,6) = [7,6,6,6]' },
    { name: 'PSine(lo, hi, len)',       desc: 'Sine-shaped sweep over len steps' },
    { name: 'PTri(lo, hi, len)',        desc: 'Triangle-shaped sweep over len steps' },
    { name: 'PChain(dict)',             desc: 'Markov chain from {state: [next,...]} dict' },
    { name: 'PMarkov(mapping)',         desc: 'Alias of PChain — Markov walk over {state: [nextStates…]}' },
    { name: 'Pacc(type, steps, int)',   desc: 'Accent pattern for amp/amplify. type 0-6 or name (backbeat fourfloor offbeat ghost synco tresillo halftime)' },
    { name: 'PSwing(amount, steps)',    desc: 'Swing: on-beats 1.0, off-beats softer/later by amount' },
    { name: 'PBin(n)',                  desc: 'Binary digits of n (random if 0): PBin(8)→[1,0,0,0]' },
    { name: 'PFDur((n,k), …)',          desc: 'Layered Euclidean density — 1 where any layer hits' },
    { name: 'PLife(chaos, lo, hi, n)',  desc: 'Cellular-automaton values in [lo,hi]; chaos 0=steady .. 1=chaotic' },
    { name: 'PFr(lo, hi, seed, size)',  desc: 'Fractal step pattern, deterministic from seed, mapped into [lo,hi]' },
    { name: 'PGauss(mean, deviation)',  desc: 'Gaussian-distributed random per step (int mean → ints)' },
    { name: 'PArp(seq, 0-9)',           desc: 'BlueARP arpeggiator: seq=[k1,k2,k3,k4] degrees, index picks an arp shape. e.g. PArp([0,4,7], 5)' },
    { name: 'PStretch(seq, size)',      desc: 'Repeat seq cyclically to exactly size steps' },
    { name: 'PZip(a, b)',               desc: 'Interleave two sequences: [a0,b0,a1,b1,…]' },
    { name: 'PReverse(seq)',            desc: 'The sequence reversed' },
    { name: 'PMorse(text, point, tiret)', desc: 'Morse-code rhythm as a dur pattern (dur=PMorse("sos"))' },
    { name: 'PDrum(k, n, char="x")',    desc: 'Euclidean drum play()-string: k pulses over n steps → play(PDrum(5,8))=".x.xx.xx"' },
    { name: 'PwRand(values, weights)',  desc: 'Weighted random pick each step: PwRand([0,4,7],[8,2,1]) favours 0' },
    { name: 'PxRand(lo, hi)',           desc: 'Random with no immediate repeat. PxRand([values]) picks from a list' },
    { name: 'PLog(mean, deviation)',    desc: 'Log-normal random floats (int if mean is an integer)' },
    { name: 'PTime(low, high, rnd)',    desc: 'Digits of the wall-clock second as a pattern; with low/high maps digits into [low,high]' },
    { name: 'PSum(n, total)',           desc: 'n durations that sum to total: PSum(3,8) → [3, 2.5, 2.5]' },
    { name: 'PDelta(deltas, start=0)',  desc: 'Cumulative sum: start, start+d0, start+d0+d1, … from a delta list' },
    { name: 'PIndex()',                 desc: 'The step index (0,1,2,3,…)' },
    { name: 'PSquare()',                desc: 'The step index squared (0,1,4,9,…)' },
    { name: 'PFib()',                   desc: 'Fibonacci sequence (PFibMod is an alias)' },
    { name: 'PFibMod()',                desc: 'Fibonacci sequence — alias of PFib()' },
    { name: 'PBeat(str, start, dur)',   desc: 'Durations from a pulse string (non space/. = hit): PBeat("x xx x")' },
    { name: 'PJoin(...pats)',           desc: 'Concatenate several lists into one' },
    { name: 'PDelay(k, n, rotate=0)',   desc: 'Group of onset offsets from a Euclidean rhythm — use as delay=PDelay(3,8)' },
    { name: 'P10(n)',                   desc: 'n-length list of random 1s and 0s' },
    { name: 'PSaw(lo, hi, len)',        desc: 'Rising sawtooth ramp over len steps (companion to PSine/PTri)' },
    { name: 'PSq(a, b, c)',             desc: 'Powers: [a^b,(a+1)^b,…] for c terms' },
    { name: 'PZero()',                  desc: 'A constant 0 generator' },
    { name: 'PBool(seq)',               desc: 'Every nonzero value → 1, else 0' },
    { name: 'PPairs(seq, func)',        desc: 'Lace a sequence with func(item) (default n→8-n): PPairs([0,2,4])' },
    { name: 'PChar(text, start=0)',     desc: 'Letters → degrees (a=0,b=1,…), non-letters → 0' },
    { name: 'PQuicken(dur, step, n)',   desc: 'Group of delay amounts that gradually accelerate — use as delay=PQuicken()' },
    { name: 'PStrum(n, spread)',        desc: 'Group of onset delays that fan out like a guitar strum — use as delay=PStrum(4)' },
    { name: 'PZip2(a, b)',              desc: 'Zip two lists into a group per step over their LCM length' },
    { name: 'PZ12(tokens, p)',          desc: '"Dearth" algorithm — emits 2 tokens so their frequency tracks target probs p (evenly spread, not clumped)' },
    { name: 'PChord(deg, type)',        desc: 'Diatonic chord group on a scale degree — quality follows the Scale. type: triad/7/9/6/sus2/sus4/add9/5/oct (integers 7/9/6 work too). BOTH args can MOVE — a pattern advances per step, a var per bar: PChord([0,3,4],"9") walks the root, PChord(0, var([7,9,6])) morphs the quality (voice count changes; absent voices go silent). e.g. PChord(0,"7") · PChord([0,3,4],"9")' },
    { name: 'PRoman("I IV V vi")',      desc: 'Roman-numeral progression → chord groups (I..VII = degrees 0..6). Suffixes work: "V7", "ii7", "Isus4"' },
    { name: 'PProg(name)',              desc: 'Named progression → chords: 50s, pop/axis, 251/jazz, blues, andalusian, minor, canon — by name, an integer index, or a var. Unknown name = a roman string' },
    { name: 'PClave(name)',             desc: '16-step clave/bell play()-string: son, rumba, bossa, shiko, soukous, gahu, son23, rumba23 — by name, an integer index, or a var. e.g. play(PClave("son"))' },
    { name: 'PRhythm([1,(3,8)])',       desc: 'Rhythm parser: any (a,b) tuple/list expands to its PDur(a,b) durations inline; plain numbers pass through' },
    { name: 'PPoly(a, b, span=1)',      desc: 'Cross-rhythm — merge an a-pulse and b-pulse evenly over span beats → gap durations. PPoly(3,4)' },
    { name: 'PLogistic(r, x0, lo, hi)', desc: 'Logistic-map chaos x←r·x·(1-x); r≈3.6–4 is chaotic. Organic drift on any param' },
    { name: 'PBrown(lo, hi, step)',     desc: 'Brownian random walk (float), reflecting at the bounds' },
    { name: 'PHenon(lo, hi)',           desc: 'Hénon strange-attractor stream mapped into [lo,hi]' },
    { name: 'PLorenz(lo, hi, dt)',      desc: 'Lorenz-system stream mapped into [lo,hi] — smooth chaotic drift' },
    { name: 'PPrime(start=2)',          desc: 'Successive prime numbers from start' },
    { name: 'PThue()',                  desc: 'Thue–Morse sequence (0,1,1,0,1,0,0,1,…) — self-similar gate for evolving rhythms' },
    { name: 'PGrowArp(seq)',            desc: 'Growing arpeggio: [a],[a,b],[a,b,c]… flattened. PGrowArp([0,2,4,7])' },
    { name: 'PTree(seed, depth, step)', desc: 'Self-similar melody (L-system): each d → [d, d+step], depth times. PTree([0],3,2)' },
    { name: 'PExp(lo, hi, len)',        desc: 'Exponential ramp over len steps (geometric when lo,hi>0)' },
    { name: 'PPulse(lo, hi, len, w)',   desc: 'Square/pulse wave; w=duty cycle (fraction at hi). w=0.1 → short stabs. Good on dur/sus' },
    { name: 'PSlide(lo, hi, len)',      desc: 'Smoothstep-eased ramp lo→hi (soft S-curve). Good for swells' },
    { name: 'motif(n, range, maxStep, reroll)', desc: 'A frozen n-note random-walk motif that repeats. 4th arg reroll>0 refreshes the motif itself every that many beats — self-contained, no reroll() call. e.g. motif(8, 7, 2, 4)' },
    { name: 'arp(degrees, mode, octaves)', desc: 'Reorder degrees and cycle one per step. mode: a NAME (up/down/updown/downup/random), an INTEGER index, or a var (mode changes over time). octaves>1 spans the pattern across octaves (+7 degrees each; a 4th arg perOct tunes that for non-7-note scales), e.g. arp([0,4,7], 2, 2). A degree can itself be a generator (PRand/nested [..]/var), resolved each step. Tip: for a CRISP arp use sus ≤ dur — a long sus overlaps the notes into a held chord.' },
    { name: 'PContour(shape, n, range)', desc: 'Melodic contour — n scale degrees in [0,range] following shape. shape: a NAME (up/down/arch/valley/wave), a NUMBER index, a var, or an ARRAY of control points to draw your own contour, e.g. PContour([0,7,2,5], 8)' },
    { name: 'PGroove(name)',            desc: 'Named dur feel: straight/eighths/sixteenths/swing/swing16/shuffle/triplet/dotted/gallop/tresillo/habanera — by name, an integer index, or a var (groove changes over time). swing16 is a faster (16th-note) swing. Groove only swings CONSECUTIVE hits — use a solid pattern like play("-"), not "-.-.-". e.g. dur=PGroove("swing") · PGroove(3)' },
    { name: 'PCircle(n, start, type)',  desc: 'Diatonic circle of fifths as scale degrees (I IV vii iii vi ii V…) — stays coherent with Root/Scale. Pass a chord type for chord groups' },
    { name: 'melody(range, maxStep)',   desc: 'Simple melodic generator — a bounded random walk over scale degrees. Freeze a fixed phrase that repeats with a slice: melody()[:8]' },
    { name: 'pat[:N]  (slice)',          desc: 'Freeze a generator: sample N values once and loop them, so a random source becomes a stable N-step phrase that repeats. e.g. PWhite(0,1)[:8], melody()[:8]. Returns Pslice(pat, start, stop) under the hood' },
    { name: 'P[…].method()  (chain)',    desc: 'STATIC (compose-time) transforms — build a fixed reordered pattern once: P[…] and list generators (PDur, PBeat, PCircle…) chain .rotate(n) .reverse() .mirror() .palindrome() .accum(start) .stretch(n) .trim(n)/.ltrim(n) .loop(n) .stutter(n) .shuffle() .sort() .add(v) .offadd(v)/.offmul(v) .zip(other) .amen(n). NB: only P[…] (not a bare [0,1,2]) has these. To transform LIVE, use the player methods below' },
    { name: '.every(n,"rotate") / .sometimes("mirror")', desc: 'LIVE pattern transforms on a player: .rotate(n) cyclically shifts the degree, .mirror() reverses it (a toggle). Fire them over time to HEAR the change: p1 >> saw([0,2,4,7], dur=1/4).every(4, "rotate")' },
];

export const TIMEVARS = [
    { name: 'fperlin(period, lo, hi)',  desc: 'Smooth value-noise LFO — wanders randomly between lo and hi, a new target roughly every `period` beats, eased so it glides rather than jumping (unlike PWhite). Clock-synced like the var family.' },

    { name: 'var(values, durs)',        desc: 'Step through values, hold each for dur beats' },
    { name: 'linvar(values, durs)',     desc: 'Linear interpolation between values over durs' },
    { name: 'sinvar(values, durs)',     desc: 'Sine-shaped interpolation between values' },
    { name: 'expvar(values, durs)',     desc: 'Exponential interpolation (useful for freq/amp)' },
    { name: 'lininf(start, finish, time)', desc: 'Linear ramp start→finish over time beats, then holds at finish forever' },
    { name: 'expinf(start, finish, time)', desc: 'Exponential ramp start→finish over time beats, then holds forever' },
    { name: 'Pvar([patterns], durs)',   desc: 'Pattern-valued timevar: swaps the whole active pattern over clock time (durs beats each) while the player keeps stepping. e.g. Pvar([[0,2,4],[7,4,2,0]], 8)' },
    { name: 'fi(beats, a, b)',          desc: 'Envelope (use with _ suffix): fade in a→b over beats, holds at b. e.g. lpf_=fi(0.5, 400, 4000)' },
    { name: 'fo(beats, a, b)',          desc: 'Envelope (_ suffix): fade out b→a over beats, holds at a' },
    { name: 'fb(beats, a, b)',          desc: 'Envelope (_ suffix): bounce a↔b every beats (wobble). Loops within sus' },
];

export const FUNCTIONS = [
    // ── The console: things you evaluate, not things a player plays ───────────
    // These were reachable only by reading index.html — Alt+I knew every synth, FX,
    // pattern and player method but none of the app's OWN commands, so theme() (ten
    // skins, shipped since beta01) had never been written down anywhere.
    { name: 'ascii_gen(word, style)',   desc: 'Draw a word large IN YOUR CODE, five rows of block characters written in as # comments under the call that asked for them — a title card for a set, or a marker you can actually find while scrolling. Styles: block · shade · light · hash · dot · star · plus · slash · dash · wave · wide (double-width). Letters, digits and common punctuation; anything unmapped draws a box so a typo is visible rather than silently dropped. Call it with no arguments to list the styles.' },
    { name: 'audiviz(band)',            desc: 'A live level meter on a # comment line in your code, under the call. band: 0 overall level · 1 bass · 2 mid · 3 treble. audiviz(false) stops it. Reads the same analyser the visuals use, so the bar and the picture always agree. Needs audio booted — before that every band reads zero. The comment line is real text; the moving bar is drawn on top of it, so it never touches your document. Also spelled audioviz().' },
    { name: 'language(code)',           desc: 'Set the interface language — "fr" or "en". Drives the guided tour.' },
    { name: 'panic()',                  desc: 'Stop everything for EVERYONE in a multiplayer room. Plain stop-all (the ■ button, Ctrl+; / Ctrl+, / Ctrl+.) stays local to you; this is the deliberate, harder-to-hit version. Also on Ctrl+Shift+. and shift-clicking ■.' },
    { name: 'softReload()',             desc: 'Recover a stuck engine without refreshing the page — frees hung audio nodes and restarts the clock, keeping your buffer.' },
    { name: 'soff(clear)',              desc: 'Stop the son()/chaos generative jam bot. soff(true) also clears the players it spawned.' },
    { name: 'parts()',                  desc: 'Open the parts panel — every example on the left, its #@ sections on the right. Clicking one writes a SECTION and the attack() line that fills it (#@stab(16) then attack("dresdensunlight", "stab", 1)), not the borrowed code, so clicking four parts gives you a four-section arrangement you can reorder and re-time. A repeated part name is numbered, since #@goto resolves to the first match. Arm ▶ to run each section as it is written. Filter by block or by part name.' },
    { name: 'attack(id, part, play)',   desc: 'Call up a prepared block from the examples library. attack() lists them · attack("dubplate") writes it into the buffer under your call · attack("showcase", "drop") takes one #@ part · a trailing 1 also plays it. Ctrl+Space inside the brackets browses category → block → part.' },
    { name: 'modular()',                desc: 'Open or close the modular synth builder — same as the MODULAR toolbar button, for when your hands are on the keyboard. Every value in a block is a DRAG knob: pull it up or down to sweep, Shift for fine, double-click to type an exact number, right-click to reset. \u25b6 (or Space, once you have clicked the canvas) plays a test note through the patch, defining it first if needed. Click a block to select it, Shift+click or Shift+drag on empty canvas for several; Delete removes them, Ctrl+D duplicates them with their wiring, arrows nudge. Ctrl+Z / Ctrl+Shift+Z undo and redo every edit, including a whole knob sweep as one step.' },
    { name: 'savePatch()',              desc: 'Download the current modular patch as .json.' },
    { name: 'loadPatch(url)',           desc: 'Fetch a modular patch from a URL and open the builder on it.' },
    { name: 'defsynth(name, params, fn)', desc: 'Define a synth live in the browser, no SuperCollider needed. params is an object of extra knobs with their defaults; fn receives { out, note, amp, sus, pan, attack, release, …knobs } and writes to Out.ar. The modular builder\'s ⇱ show in code button writes one of these for you.' },
    { name: 'tour(n)',                  desc: 'List the guided-tour lessons, or jump to lesson n. start_guided_tour() begins at lesson 1; next() and back() move between them.' },
    { name: 'vbg(on)',                  desc: 'Run the visuals as a live background BEHIND the editor. No argument toggles; vbg(1) / vbg(0) force it. Needs video layers running.' },
    { name: 'rules(on)',                desc: 'Multiplayer room rules. rules() opens the ⚖ panel · rules(true) / rules(false) turns enforcement on or off (host only). See also role(who, r), grant(role, cap, on), tracks(), release(track).' },
    { name: 'Clock.bpm',                desc: 'The tempo. Takes a number or a TimeVar — Clock.bpm = linvar([120, 140], 32) ramps it. Clock.meter sets the bar length.' },
    { name: 'Scale.default',            desc: 'The scale every player reads degrees against. A name ("minor", "dorian", "harmonicMinor" — case-insensitive) or a var([…]) to move through several. Scale.names lists them.' },
    { name: 'Root.default',             desc: 'The key. A number of semitones or a note name ("C", "F#"). Both this and Scale can be patterns or TimeVars.' },
    { name: 'lighter()',                desc: 'Step Scale.default one mode BRIGHTER along lydian → ionian → mixolydian → dorian → aeolian → phrygian → locrian. darker() goes the other way. A fast way to move a piece\'s mood without picking a scale by name.' },
    { name: 'darker()',                 desc: 'Step Scale.default one mode darker (see lighter()).' },
    { name: 'cancelSection()',          desc: 'Stop the #@ arrangement advancing, leaving every player running. Ctrl+Alt+; does the same.' },
    { name: 'start_guided_tour()',      desc: 'Load lesson 1 of the guided tour. next() and back() move between lessons; tour(n) jumps to one.' },
    { name: 'next()',                   desc: 'Guided tour: go to the next lesson.' },
    { name: 'back()',                   desc: 'Guided tour: go to the previous lesson.' },
    { name: 'role(who, role)',          desc: 'Multiplayer, host only: set someone\'s role — "host", "player" or "listener". Names or user ids both work. See rules().' },
    { name: 'grant(role, cap, on)',     desc: 'Multiplayer, host only: turn one capability on or off for a role — code · mixer · transport · macros · claim. e.g. grant("listener", "macros", true).' },
    { name: 'tracks()',                 desc: 'Multiplayer: list which tracks are claimed and by whom.' },
    { name: 'release(track)',           desc: 'Multiplayer: give up a track you claimed so anyone can play it (the host can release any).' },
    { name: 'Server.addFx(opts)',       desc: 'Apply FX to the MASTER bus — everything at once, not one player. Server.clearFx() removes them; Master.key = value sets a single knob.' },
    { name: 'play(pattern, opts)',      desc: 'Drum/sample pattern. Chars map to samples. space=rest, (Xo)=fire both at once, [XoX]=alternate on successive hits, {Xo}=random pick, &lt;Xo&gt;=subdivide into sub-steps. Quotes optional if pattern has spaces. opts: amp, dur (default 1), pan, rate, sample' },
    { name: 'loop(name, dur, opts)',    desc: 'Beat-synced audio-loop player. Plays a named loop buffer, time-stretched to fit dur beats (so it locks to the tempo). Register loops first with loadloop. opts: amp, pan, rate, sample (variant index), pos (start, sec), stretch (1=warp to dur, 0=natural), looping. e.g. b1 >> loop("break", dur=8)' },
    { name: 'loadloop(name, url)',      desc: 'Load a WAV from a URL (or [urls] for variants) and register it as a named loop for loop(). Same buffer store as samples. e.g. loadloop("break", "https://…/amen.wav")' },
    { name: 'piano (toolbar)',         desc: 'Virtual piano — play any synth with the mouse, the computer keyboard (a s d f g h j k · w e t y u · z x octave) or a MIDI keyboard, with one drag-knob per parameter that synth has. ● rec records what you play against the clock and ✎ to code writes it into a buffer you pick as scale degrees in the live Scale/Root. The midi button routes a hardware keyboard into the piano itself — same synth, same knob values, velocity into amp — and right-clicking a knob label binds that parameter to the next MIDI control you move' },
    { name: 'midi_rec()',              desc: 'Record every note that plays, then save it as a Standard MIDI File. Call it once to arm, again to stop and download — one track per player, named after it; play() players land on General MIDI channel 10, synths and midiout() players each get their own melodic channel. Same as the "rec midi" button. It records what you HEARD, so PRand / {a b} / .degrade / a live knob nudge are captured as the take you just played, not as the pattern it came from' },
    { name: 'midi_save(name, quantize)', desc: 'Stop recording and save, naming the file and optionally snapping onsets to a grid in beats. e.g. midi_save("myset", 1/16) for 16ths, midi_save("myset") to keep the performance exactly as played' },
    { name: 'midi_map(char, note)',    desc: 'Point a play() char at a General MIDI drum note for the export. e.g. midi_map("K", 36) puts your kick char on the GM bass drum. midi_map(char) alone restores the default. Known drum chars (x X o O * u - = : ~ # t s + …) are already mapped; anything else is spread over the GM percussion range so distinct chars stay distinct lanes' },
    { name: 'loadsample(char, url)',    desc: 'Load a WAV from a URL (or [urls]) and assign it to a play() char. GitHub raw / release URLs work. e.g. loadsample("K", "https://raw.githubusercontent.com/u/r/main/kick.wav")' },
    { name: 'loadpack(url)',            desc: 'Load a pack: JSON manifest {char: url | [urls]}. Relative URLs resolve against the pack location' },
    { name: 'pbuild(genre, opts)',      desc: 'Genre drum-pattern generator → a play() string. e.g. play(pbuild("techno"), dur=0.25). genre: a name (techno|ebm|dnb|house|breaks|halftime|industrial|reggae|afro) OR an index number (pbuild(0)). opts: evolve (bars before it loops, each a mutation; default 8), fill (a fill every N bars), density (0–1, thins hits), mute, seed. Layer params kick/snare/hat/perc take a literal pattern (kick="X  x "), a genre name (hat="dnb"), or a per-bar GATE: snare=0 (off), snare=1 (on), snare=PBin(4)/{1,0}/[1, 0] (toggle per bar). fill/density may be pattern-valued too (sampled per bar). Second arg can be a number = evolve' },
    { name: 'pkit(genre, opts)',        desc: 'Like pbuild but returns a kit for per-layer access: kit = pkit("house"); b1 >> play(kit.kick, dur=0.25); h1 >> play(kit.hat, dur=0.25). Layers: kick, snare, hat, perc' },
    { name: 'genres()',                 desc: 'List the available pbuild/pkit drum genres' },
    { name: 'chaos(n, type)',           desc: 'Generate n random players (synth/drum mix) into g1,g2,… and PASTE them into the editor as a block — does NOT run them; review/edit then evaluate. Draws widely: all synths (incl. arpy/darkpad/supersaw…), the full FX palette (mpf/shimmer/clouds/pumper…), pattern methods (.layer/.invert), motif/arp reroll, rests, and sometimes a Scale.default + reroll() line. type "synth"|"drum" forces one kind. Default n=4' },
    { name: 'midiin(synth, opts)',      desc: 'Play incoming MIDI-keyboard notes through a synth: midiin("prophet"). opts: amp (velocity scale), sus (note length secs), transpose (semitones). Notes are fixed-length (synths self-release). midiin(0) unbinds. Chromium/Edge/Brave' },
    { name: 'say(text, opts)',          desc: 'Speak text via the browser (Web Speech API — not scsynth). opts: rate, pitch, volume, voice (name substring). e.g. say("acid line dropping")' },
    { name: 'darker() / lighter()',     desc: 'Walk Scale.default one step along the mode-brightness list (Lydian → major → mixolydian → dorian → minor → phrygian → Locrian). Live modal colour control' },
    { name: 'shutup()',                 desc: 'Stop every player (and the jam bot) — a softer panic than Ctrl+; ' },
    { name: 'swap(a, b, key)',          desc: 'Swap one attribute between two named players live: swap("p1","p2","lpf"). (FoxDot calls this switch — reserved in JS)' },
    { name: 'p1 >> synth(...).once()',  desc: 'Play a single event then stop — one-shot stabs/hits. e.g. p1 >> a_stab([0,4,7]).once()' },
    { name: 'b1.degree + 2  (ref)',     desc: 'Read another player live: b1 >> bass(p1.degree + 2) tracks p1 a third up each step. Readable attrs: degree, amp, dur, oct, sus, pan, rate, amplify, cutoff. Arithmetic on the ref now works (wrapped in Pmath)' },
    { name: 'p2.follow("p1")',          desc: 'Track another player\'s degree each step (pass the name as a string). p2 >> pluck([0]).follow("p1")' },
    { name: 'p2.accompany("p1", ivs)',  desc: 'Harmonise around another player\'s degree, cycling scale-degree intervals (default [0,2,4]). e.g. .accompany("p1", [0,4])' },
    { name: 'p2.map("p1", table, attr)',desc: 'Drive one of this player\'s attrs from another player\'s degree via a lookup table: p2.map("p1", {0:5, 4:7}). Missing keys pass through. attr defaults to degree' },
    { name: '.jump(n) / .rotate(n)',    desc: 'jump(n): nudge the playhead forward n steps once (live fill). rotate(n): cyclically rotate the degree array live (n>0 left)' },
    { name: '.strum(spread)',           desc: 'Spread a chord/group\'s notes over `spread` beats (arpeggiated strum) instead of firing them together. e.g. p1 >> rhodes((0,4,7)).strum(0.05)' },
    { name: '.offbeat(amt) / .multiply(n)', desc: 'offbeat(amt=0.5): push every note late by amt beats (land on the offbeat). multiply(n): persistently repeat each step n times within its duration (roll)' },
    { name: 'son(opts) / soff(clear)',  desc: 'Generative jam bot: over time it adds/stops/mutates its own g* players (kept apart from yours; broadcasts to peers in a session). opts: {synth, drum} weights, {min,max} voices, {every:[lo,hi]} beats/tick. soff() stops the loop; soff(true) also stops the g* players. Boot audio first' },
    { name: '.reroll(beats)',           desc: 'Chainable player method: auto-re-evaluate this player line every N beats, so frozen random generators (motif, PShuf, chaos, a PRand degree) reroll on their own — no re-running by hand. e.g. g1 >> pluck(motif(8)).reroll(4). .reroll(0) stops; it also stops when the player stops. (motif also has a built-in reroll as its 4th arg.)' },
    { name: '.drummer(durloop, durPlyr)', desc: 'Chain onto a play() player to turn it into a self-evolving rock drummer (FoxDot/CrashServer port). Picks a random groove + fill, swaps the fill in for the tail of each loop, then re-randomises the groove every durloop beats. durloop default 16, step dur default 0.5. e.g. b1 >> play("x").drummer()' },
    { name: '.gtr(string)',             desc: 'Tune a player like a guitar string (FoxDot/CrashServer): chromatic scale + a per-player root at the string open pitch, so degrees act like frets. string 0–6 → E A D G B e (low→high). e.g. p1 >> guit([0,3,5,7]).gtr(5)' },
    { name: 'Clock.bpm = linvar(...)',  desc: 'Tempo automation — Clock.bpm now accepts a TimeVar/pattern, so it ramps: Clock.bpm = linvar([120,140],[32]). A plain number still sets it instantly' },
    { name: 'linbpm(from, to, beats)',  desc: 'Ramp the tempo from→to over `beats`, then hold. e.g. linbpm(120, 140, 32)' },
    { name: 'dropbpm(to, beats)',       desc: 'Ramp the tempo from the current bpm down/up to `to` over `beats`, then hold' },
    { name: 'Clock.future(dur, fn)',    desc: 'Run fn() `dur` beats from now (one-shot). Clock.schedule(beat, fn) uses an absolute beat' },
    { name: 'Clock.mod(n, fn)',         desc: 'Run fn() at the next beat that is a multiple of n. Clock.nextBar(fn) fires at the next bar (Clock.meter = beats/bar)' },
    { name: 'drop(playTime, dropTime, nbloop)', desc: 'Silence a random subset of players for dropTime beats, then restore — bar-aligned. Default: 14, 2, 1' },
    { name: 'soloRnd(time)',            desc: 'Solo a random active player for `time` beats, beat-aligned. Default: 8' },
    { name: 'unsolo()',                 desc: 'Restore all players muted by solo / Alt+S' },
    { name: 'p1.solo(beats?)',         desc: 'Mute all other players (they keep running); with `beats`, restore after N beats (beat-aligned)' },
    { name: 'p1.stop(beats)',          desc: 'Stop now, or after N beats with `beats`' },
    { name: 'rest()',                   desc: 'True silence for one step. In a degree list use a standalone _ or bare rest (both fire no note). A . instead plays degree 0.' },
    { name: 'print(...args)',           desc: 'Print to the log panel' },
    { name: 'p1.soloDrop(beats)',      desc: 'Solo for N beats, then restore. Default: 8' },
    { name: '...every(beats, method)', desc: 'Call a player method every N beats — chainable on the call: p1 >> saw([0,4]).every(8, "reverse"). Also p1.every(8, "stutter", 4)' },
    { name: '...after(beats, method)', desc: 'One-shot: call a player method after N beats. e.g. play("xGx").after(4, "stop")' },
    { name: 'p1.stutter(n)',           desc: 'Roll the current step n times within its duration (n = number of rapid repeats). Sequence carries on normally' },
    { name: 'p1.reverse()',            desc: 'Reverse degree array for one cycle' },
    { name: 'p1.shuffle()',            desc: 'Shuffle degree array for one cycle' },
    { name: 'midi(cc, lo, hi, curve)', desc: 'Bind a MIDI CC knob/fader to a live value — turn it to sweep any param. Use inline or by assignment: p1.lpf = midi(74, 100, 8000, "exp"). curve: lin (default), exp (cutoffs/freq), log, quad, cubic, sqrt, s (smoothstep) — listed in the MIDI panel. Web MIDI (Chromium/Edge); enables on first use' },
    { name: 'mlearn(lo, hi, curve)',   desc: 'MIDI learn — binds to the NEXT control you touch, then sticks to it. e.g. p1.amp = mlearn(0, 1). One control can drive several params at once (a macro)' },
    { name: 'aud(band, lo, hi, curve)', desc: 'THE SOUND, as a value \u2014 the twin of midi(), so it works on every param in the language. band: level \u00b7 bass \u00b7 mid \u00b7 treble, or an FFT bin 0\u201363 for one narrow \"EQ channel\". e.g. video1 >> plasma(speed=aud(\'bass\', 0.2, 3)) \u00b7 video2 >> freqtower(scale=aud(4)) \u00b7 p1 >> pluck(lpf=aud(\'treble\', 400, 6000)). Same curves as midi(); a 5th arg is the follower time constant in seconds (0.06 default, 0 = raw). Reads the same analyser as audiviz() and the visuals \u2014 in a session that is the ROOM\'s, so a visuals-only machine follows whoever is playing. The \u223f handle on any knob in the LAYERS panel binds one without typing' },
    { name: 'midiout(deg, ...)',       desc: 'MIDI OUT — send notes to an external/virtual MIDI port instead of audio: m1 >> midiout([0,2,4], channel=1, oct=5, dur=1). Velocity from amp, note length from sus/leg, groups make chords. Pick the port in the MIDI panel (Chromium/Edge; route via IAC/loopMIDI/ALSA-JACK to a DAW)' },
    // ── The visual language's globals ────────────────────────────────────────
    // These were missing from here, which meant Alt+I on `vres` — or on palette, mix,
    // vsnap, output, any of them — found nothing at all: the inspector builds its
    // lookup from these arrays, so a function absent here is a function the editor
    // cannot explain. Every one was documented in the guide and none of them was
    // reachable from the cursor.
    { name: 'palette(name|n)',         desc: 'The colour ramp a VIDEO SYNTH is drawn through \u2014 fire \u00b7 ice \u00b7 neon \u00b7 sunset \u00b7 matrix \u00b7 mono \u00b7 blood \u00b7 cyber \u00b7 vhs \u00b7 acid, by name or 0-based index (so a pattern or TimeVar can drive it). palette("off") goes back to raw luminance. It steers field scenes only: a workshop layer is an imperative drawing that brings its own colour, and the palette does nothing to it' },
    { name: 'vmode(name)',             desc: 'How the finished frame is drawn: smooth (default) \u00b7 pixel \u00b7 shade \u00b7 blocks \u00b7 ascii \u00b7 dots \u00b7 bars. The last four map luminance onto a character ramp and run on the CPU; smooth and pixel are the GPU path' },
    { name: 'mix(value, dur, blend)',  desc: 'The A/B crossfader, as a player: video9 >> mix(0.5). 0 is deck A (ch=0), 1 is deck B (ch=1), and blend picks how they combine \u2014 mix \u00b7 add \u00b7 screen \u00b7 multiply \u00b7 difference \u00b7 wipe \u00b7 dissolve, by name or index. Different from a layer\u2019s own blend=, which is how layers stack WITHIN one deck. Patterns and TimeVars drive both: mix(sinvar([0,1],16))' },
    { name: 'vres(scale)',             desc: 'GPU render resolution, as a multiplier of CSS pixels: 1 native, 0.5 half (cheaper), 2 supersampled. vres() or vres(null) restores the default. This is shader work \u2014 the pixel-filling half of the cost. Its partner is wres(), which is main-thread canvas work, and main-thread work is what makes notes late' },
    { name: 'wres(px)',                desc: 'The longest edge the CPU-drawn WORKSHOP layers render at before the GPU stretches them over the frame (default 1280; wres(0) turns the cap off, which is what text and data-wall layers want). Measured: these layers cost almost the same at 640\u00d7360 as at 4K \u2014 they do fixed geometry work, not pixel filling \u2014 so the cap is really about the texture UPLOAD, which at 4K is 33MB a frame per deck' },
    { name: 'vsnap(all, only)',        desc: 'Write what is on screen back out AS CODE \u2014 every live layer with everything you have dialled in, plus the crossfader, palette, mode and any non-default performance settings. vsnap(true) writes every knob, not only the ones you changed; vsnap(false, "video1") does one layer. A live control (midi(), aud()) is written as the control, not as the number it happens to read. It is what the LAYERS panel\u2019s \u2192 code button calls' },
    { name: 'vrand(n, seed)',          desc: 'Paste a random visual look \u2014 n layers, each param drawn from its OWN declared range. The twin of chaos(): it does not change what is on screen, it writes LINES you read, edit and run. Seeded, so vrand(3, 1234) is the same three layers on every machine; an unseeded call writes the seed it chose into the comment, which makes a happy accident reproducible after the fact' },
    { name: 'output(n)',               desc: 'Open a projector window. output() gives it one full-frame surface, output(3) three independently warped ones \u2014 so a flat quad can be pinned onto each visible face of a box and the object reads as mapped without any 3D. Each surface picks its own source: the master mix, one live layer alone, or a code buffer. output("reopen") brings back a saved one with its mapping. In the window: [w] warp \u00b7 [m] 4pt/edge/mesh \u00b7 [ and ] grid \u00b7 [r] reset \u00b7 [f] fullscreen' },
    { name: 'outclose(i)',             desc: 'Close projector window i (outclose() closes them all). The mapping is saved, so output("reopen") brings it back where it was \u2014 it describes where a projector sits in a room, which is why it never travels with a look or into a jam' },
    { name: 'outlist()',               desc: 'List the open projector windows, their surfaces and what each surface is showing' },
    { name: 'vrec(name)',              desc: 'Record the visuals. vrec() arms, vrec() again stops and downloads a .webm, vrec("myset") names the file \u2014 deliberately the same shape as midi_rec(), because it is the same gesture. It records the composited output, the picture the SCREEN panel shows, with projector warping excluded because that describes a room rather than the piece' },
    { name: 'clear()',                 desc: 'Blank the video \u2014 stops every layer and the crossfader and wipes the feedback buffer (or press [c] in the visuals window). The audio is untouched' },
    { name: 'vperf(mode)',             desc: 'The visual/audio CPU trade, as one decision: vperf(\'audio\') \u00b7 vperf(\'balanced\') \u00b7 vperf(\'video\'). Sets the frame cap, the GPU resolution, the workshop-layer size and the per-layer budget together, and vperf() with no argument REPORTS all four plus the frame rate and cost actually measured. Worth knowing what the trade is: the audio ENGINE is not on the main thread \u2014 scsynth is WASM in an AudioWorklet on the real-time audio thread, so drawing can never starve the DSP. What shares the thread with the picture is the CLOCK, and notes go out 120ms early with a timetag, so the main thread can stall that long and nothing is late. These modes decide how much of that slack the visuals may spend' },
    { name: 'vfps(n)',                 desc: 'Cap how often the picture is drawn \u2014 the biggest single lever on visual cost. vfps(30) is half the main-thread work of 60 for a picture most sets cannot tell apart; vfps(0) or vfps() draws every frame the browser offers. Still driven by requestAnimationFrame, so a capped loop lands on real frame boundaries instead of tearing between them' },
    { name: 'vbudget(ms)',             desc: 'How long the CPU-drawn workshop layers may take per frame (default 4ms). A layer over budget redraws every Nth frame instead and its last picture keeps compositing \u2014 so a 17ms layer like slimemold runs at 20fps inside a 60fps mix rather than dragging the mix to its rate. Raise it if the picture matters more than the timing; lower it if a heavy set is pushing notes late' },
    { name: 'theme(name|n)',           desc: 'Switch the skin. A NAME (prefix-matched, so theme("synth") finds synthwave) or a 0-based INDEX that wraps \u2014 the same shape pal= and blend= already use, so it can be computed rather than typed: theme(n + 1) steps through, theme(PRand(0, 9)) picks a different one each time the line runs, and a negative counts back from the end. theme() with no argument lists them all with their numbers and marks the one you are on. The list is read from the Theme dropdown itself, so the two can never disagree' },
    { name: 'link(on)',                desc: 'Ableton Link — follow Ableton\'s tempo + bar phase. link()/link(true) connects to the Link bridge (run: cd server && npm run start-link); link(false) disconnects. Also a toggle in the Link panel. Syncs with Ableton/Link gear on the LAN' },
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
export const VERSION = 'dev01';

// Chained PLAYER METHODS — p1 >> saw([0,4]).unison(3).every(4, "reverse")
//
// These were reachable only by reading the source: Alt+I knew about synths, FX,
// patterns and params but not about anything you chain onto a player, so inspecting
// .unison() gave nothing. Signatures here are taken from their definitions in
// js/synths/registry.js and js/patterns/sequences.js.
export const METHODS = [
    // — voicing / tuning —
    { name: '.unison(n=2, detune=0.125, spread=100)', desc: 'Fatten into n detuned, stereo-spread copies. Sets pan + pshift groups, so unison(4, 0.5) → pan (-1,-0.5,0.5,1), detune (-0.5,-0.25,0.25,0.5) semitones.' },
    { name: '.strum(spread=0.04)',        desc: 'Arpeggiate a chord\'s onsets — each voice starts `spread` beats after the last.' },
    { name: '.penta()',                   desc: 'Constrain this player\'s degrees to the (minor) pentatonic scale.' },
    { name: '.chroma()',                  desc: 'Use the chromatic scale for this player — degrees become semitones.' },
    { name: '.gtr(string=1)',             desc: 'Tune the player like a guitar string (chromatic + that string\'s root).' },
    { name: '.map(name, mapping, attr="degree")', desc: 'Drive an attribute from another player\'s current value via a lookup table.' },

    // — rhythm —
    { name: '.stutter(n=2)',              desc: 'Retrigger each step n times inside its own slot.' },
    { name: '.multiply(n=2)',             desc: 'Repeat every step n times — like stutter, but persistent.' },
    { name: '.offbeat(amt=0.5)',          desc: 'Push every note late by `amt` of a step (delay), so it lands off the beat.' },
    { name: '.human(velocity=20, humanize=5, swing=0)', desc: 'Humanise dynamics and micro-timing: jitters delay by ±humanize% of dur (biased by swing%) and varies amplify by velocity%.' },
    { name: '.fill(on=1)',                desc: 'Instant drum fill — short random durs plus bursty amplify gating. 1 weighted-random · 2 random dur, full amp · 3 steady 1/2 dur, denser · 0 reset.' },
    { name: '.slider(start=0, on=1)',     desc: 'Glissando between notes — each glided note sweeps its frequency into the next.' },
    { name: '.drummer(durloop=16, durPlyr=0.5)', desc: 'Generate an evolving drum part for this player.' },
    { name: '.degrade(prob=0.5)',         desc: 'Randomly silence that fraction of steps (bookkeeping still advances).' },

    // — reordering the sequence —
    { name: '.reverse()',                 desc: 'Play the degree sequence backwards. The highlight follows the played order, not the written one.' },
    { name: '.mirror()',                  desc: 'Play forwards then backwards.' },
    { name: '.rotate(n=1)',               desc: 'Rotate the sequence n places.' },
    { name: '.shuffle()',                 desc: 'Shuffle the sequence into a new random order.' },
    { name: '.jump(n=1)',                 desc: 'Skip n steps forward in the sequence, immediately.' },
    { name: '.reroll(beats=8)',           desc: 'Re-evaluate this player\'s source line every n beats, so frozen random generators (motif, PShuf, PRand as degree) reroll on their own. .reroll(0) stops.' },

    // — following other players —
    { name: '.follow(name)',              desc: 'Take this player\'s degrees from another player, note for note.' },
    { name: '.accompany(name, intervals=[0,2,4])', desc: 'Harmonise against another player, choosing from those scale intervals.' },

    // — probability: run a method on some of the bars —
    { name: '.sometimes(method, ...args)', desc: 'Apply a method on ~50% of bars — e.g. .sometimes("stutter", 4). The whole family, by probability: always 1 · almostAlways 0.9 · often 0.7 · sometimes 0.5 · rarely 0.25 · almostNever 0.1 · never 0. A leading number overrides it: .sometimes(0.3, "reverse").' },
    { name: '.every(beats, method, ...args)', desc: 'Apply a method every n beats — .every(8, "reverse"). Deterministic, unlike the probability family.' },
    { name: '.after(beats, method, ...args)', desc: 'Apply a method once, n beats from now.' },

    // — transport —
    { name: '.solo(beats)',               desc: 'Mute every other player. With `beats`, restore at the next multiple of n.' },
    { name: '.only(beats)',               desc: 'Like solo, but silences the others rather than muting them.' },
    { name: '.stop(beats)',               desc: 'Stop this player, quantised to the next multiple of n beats.' },
    { name: '.once()',                    desc: 'Play a single step, then stop.' },
];

// items: a string, or { t: text, ex: examples-anchor-id } to link to a live example.
const CHANGELOG = [
    { v: 'dev01', title: 'Desktop UI · 190 new visual scenes · virtual piano · scratch buffers', items: [
        'Video layers are in the PLAYERS list. A video layer is a player \u2014 same name space, same >>, stopped the same way \u2014 and it was the one kind that never appeared there, so a set with three scenes running looked like a set with nothing running. It gets a row of its own shape rather than a copy of the audio one: no fader, no solo, no mute, because a layer has no level to ride and muting a picture is not a thing anyone means. What it has instead is the scene it is drawing and WHICH DECK it is on, which is the thing you actually want to see when two of them are stacked and a third is on the other side of the crossfader. The \u25a0 stops the layer for real, not just the row.',
        'The log no longer complains about pastes you did not make. On Linux the middle mouse button pastes the primary selection, so the guard that stops the system pasting into your code on your behalf \u2014 which is the right guard, and stays \u2014 was writing a warning several times a session about something you neither did nor wanted. The block was the point; the commentary was noise.',
        'And a layer that is drawing nothing now says why. A good part of the Ikeda family is literally a spectrum visualiser: ikedadots skips every dot whose bin is under its threshold and paints the rest black, so with nothing playing it is a black rectangle \u2014 and a black rectangle on a deck hides whatever is under it too. Run the line before booting the audio and it reads as broken, which is exactly how it was reported. Measured with a silent spectrum: ikedadots, freqmatrix, datapulse and ikedabarcode draw essentially nothing, ikedamatrix almost nothing; hexdump, ikedascan, ikedacoords and ikedaoscillo have idle structure. Rather than keep a hand-written list of which layers those are \u2014 which would drift, as two other lists in this codebase already have \u2014 the deck MEASURES it: once per layer, on its thirtieth frame, and only while the analyser is actually silent, it reads back its own canvas and says so if nothing was drawn. One getImageData per layer per session, at the single moment the answer is interesting, and said once per scene rather than once per deck (the editor backdrop and the SCREEN panel are two decks, and the same sentence twice reads like a stutter). The note reaches the log through surface.js, which already loads the deck on demand \u2014 wiring it from index.html would have meant importing the deck there, and with it the 1.6MB layer registry, into every audio-only session.',
        'Fixed, and it was most of the workshop catalogue: the spectrum was the WRONG LENGTH. Eighty of the 206 layers read spectrum[38], [48] and [50] to work out their treble \u2014 crashDot\u2019s analyser produced 32 bins, so those reads were undefined, undefined + undefined is NaN, and the NaN went straight into an hsla(). Ten layers threw on their first frame and the rest quietly drew nothing, or drew intermittently. The workshop\u2019s own FX registry loops i < 64 over the spectrum, which settles what it was written against. The analyser makes 64 now. The GL shader still wants 32 and FOLDS PAIRS on the way in rather than taking the lower half, which would have shown the field scenes only the bottom two octaves, and the four CPU spectrum scenes read s.length instead of a hard-coded 32. A survey of all 206 layers: ten throwing became none, and blank went from seven to three \u2014 webcam, media and mastofeed, which are blank because there is no camera, file or feed, not because they are broken. aud() reaches 64 bins now too. And the second half of the same report: the deck CLEARED each layer\u2019s canvas before every draw, but these layers were written for one that persists. coralBranch paints its own 8% black wash and only redraws the coral every 60/speed frames; matrixrain and boidsTrails have fade parameters; several carry a bgAlpha. Clearing under them left coralBranch dark on 89 frames out of 90 and lit on one, which is exactly what \u201cit blinks\u201d means. Measured after the fix: 59 of 90, and speed=4 brings it to 14 \u2014 what is left is the layer\u2019s own fade-versus-redraw ratio, which is a knob rather than a fault. The canvas is cleared once when the slot is created; after that it belongs to the layer.',
        'Fixed, and it silenced the whole mix until a refresh: aud(\u2026) * 1 \u2014 or midi(\u2026) * anything \u2014 produced NaN. The transpiler decides whether an expression involves a pattern by matching the CALL at the front of it against a list of names, and rewrites the arithmetic into Pmath() when it does. aud(), midi() and mlearn() were added to the language after that list was last touched, so they were not on it, and `object * number` in plain JavaScript is NaN. A NaN amp reaches the summed bus, the master limiter\u2019s Sanitize turns it into zero, and everything goes quiet and STAYS quiet \u2014 the same failure mode as the feedback-loop NaN fixed earlier in this cycle, arriving by a completely different road. lininf and expinf were missing too. That list has now drifted twice \u2014 once for Pacc, once for the live controls \u2014 and the cost of a miss is not a syntax error you would notice, it is silence. So there is a test that cross-checks it against the DOCUMENTED vocabulary rather than against a second copy of the same list: anything docs.js lists that actually returns a live {get} value must be a name the transpiler recognises, or `that thing * 2` is NaN. Sixteen builders are checked directly as well, and all 1,065 lines of the 134 shipped examples still transpile.',
        'Fixed: the main menu looked like TWO panels \u2014 an empty one behind and the menu floating on top. A plain name collision: the new column was given the class wfd-menu, which already belonged to the canvas right-click menu and is position:fixed. The panel body inherited that, left the panel\u2019s flow entirely, and drew over the desktop, so the panel it should have been sitting inside was left empty behind it. Renamed to wfd-barmenu. And a layout migration, because the same panel changed SHAPE. A saved size is normally sacred \u2014 you put the panel there, it stays there \u2014 but a 1100\u00d772 frame from yesterday around a 190\u00d7450 column shows three rows and a wide empty box. The stored layout carries a version now, and a bump clears the geometry only of the panels whose default shape actually moved, keeping every other panel where you left it and keeping even the reshaped one\u2019s open/closed state, which is a preference about the workspace rather than about the shape.',
        'The render-load popup is a PERFORMANCE PANEL. A popup was the wrong shape for it: it sat in fixed screen coordinates while the desktop panned and zoomed underneath, so it drifted away from the thing it belonged to and behaved unlike every other window on the canvas. It is an ordinary panel now \u2014 drag it, resize it, close it, save it in a layout, like the layers and outputs desks \u2014 and the button on the menu reveals it instead of opening something. The explanatory paragraph is gone with the popup: the long version lives on the button\u2019s tooltip and in vperf()\u2019s reference entry, which is where there is room for it. \u201cWhat it is costing\u201d is PERF MONITORING, and it has grown the numbers you actually diagnose with, in three groups. Picture: frame rate, cost per frame, how many layers and how many are workshop layers, and the expensive ones by name with their cost and how often they are being allowed to redraw. Scheduling: main-thread lateness, scsynth\u2019s queue depth against its capacity and its peak, how many messages arrived late and the worst of them, what the pre-scheduler is holding, and the clock drift. Audio: engine health, dropped messages, glitches, WASM errors, the AudioContext state and sample rate, voices out of players, private buses against the ceiling, and the tempo. Every one of those is a counter the engine keeps for itself whether anyone reads it or not \u2014 the ?diag flag has been logging a subset to the console for ages; this is the same numbers in a place you can watch while it is happening, read only while the panel is open.',
        'The main menu is a labelled column: one control per row under a word saying what the group is \u2014 ENGINE, PLAY, LEARN, CONTENT, LOOK, APP. A strip of unlabelled buttons makes you learn the icons and their order; a labelled list you read. The dividers that were there for a day are gone, since a label does the same job and says something as well. That needed room a bar-height strip does not have, so the home rectangle \u2014 the area \u201creset view\u201d frames \u2014 now starts to the LEFT of the origin as well as above it. Widening the frame was the cheap answer: every other panel keeps the coordinates it has always had, and the menu and the performance panel share the new left strip. One thing that fell out of testing: the performance panel had been placed BELOW the home rectangle\u2019s bottom edge, so reset view never showed it \u2014 a panel outside the frame is a panel nobody finds.',
        'Fixed: vres() did nothing where you were looking. setResolution existed on the in-page surface and NOTHING EVER CALLED IT \u2014 the pop-out visuals window applied the setting in its own loop, and the SCREEN panel and the editor background, which is where most people watch the picture, never did. The snapshot has carried the value all along; it is read now, and vres(0.5) genuinely halves the backing pixels per CSS pixel (measured: a 400px canvas draws at 200, at 800 under vres(2), and back to 400 on vres(null)). wres() turned out to be working correctly and looking broken, which is its own kind of bug. It caps the WORKSHOP layers\u2019 own canvases and nothing else \u2014 a field scene is a shader and has no canvas to cap \u2014 so setting it with only field scenes on screen does exactly nothing, and there was no way to tell that from a dead control. It now says so when it is set and nothing on screen is a workshop layer, and the menu labels the field \u201cworkshop layers, px\u201d rather than the ambiguous \u201clayer size\u201d.',
        'The render-load menu got shorter, gained a close button, and gained a resources readout. The three-sentence explanation is one line now \u2014 a paragraph in a popup is a paragraph nobody reads, and the long version already lives on the button\u2019s tooltip and in vperf()\u2019s reference entry. Escape closed it and so did clicking away, but neither is visible, and a popup with no visible way out reads as one that is stuck. Under it: what the app is actually costing. Frames and milliseconds, how many layers and how many of them are workshop layers, THE EXPENSIVE ONES BY NAME with their cost and how often they are being allowed to redraw, scheduler lateness, active voices, private buses against the ceiling, the engine\u2019s own health and queue depth, and the JS heap. Every one of those is a number the app already computes for its own reasons \u2014 the frame counter the renderer keeps, the per-layer EMA the frame budget throttles on, the allocator\u2019s bus count, scsynth\u2019s health counters \u2014 so reading them costs nothing, and it only reads them while the menu is open, which is the whole reason this lives behind a button. Two things are deliberately absent. A live NODE count would need a /status round trip to scsynth on every read, because our synthdefs free themselves with doneAction:2 and the client genuinely does not know \u2014 and asking for one is precisely the extra work this is meant to avoid. And nextNodeId() is not a gauge: calling it ALLOCATES an id, so reading it would break the thing it was reporting on.',
        'The main bar is grouped, and the examples menu says where the example is going to land. Four dividers \u2014 the transport, then the tour, then the examples, then what the app looks like and which shape it is in \u2014 adopted into position like every other element on the bar, so the grouping is one list in one place rather than a stylesheet rule guessing where a group starts. They are hidden in the classic toolbar, which wraps and already groups by row. And picking an example REPLACES a buffer, which is a destructive act the menu used to perform silently on whatever you happened to be looking at: you found out by losing your set. There is a \u201cload into\u201d row at the top of the list now. It defaults to the buffer you are in \u2014 the old behaviour, now stated \u2014 names it \u201c(this one)\u201d, lists every other open buffer, and offers a new tab, which leaves everything you have alone. One bug on the way, and a good one to know: a value attribute written through innerHTML does not survive a NUL character, so the \u201cnew tab\u201d option came back with an empty value and every pick fell through to replacing the current buffer \u2014 the exact behaviour the row was added to make optional.',
        'Fixed, and it was worth being told about: Alt+I knew nothing about the VISUAL language. The inspector builds its lookup from the reference arrays in the docs, so a function that is not listed there is a function the editor cannot explain \u2014 and vres, wres, palette, vmode, mix, vsnap, vrand, output, outclose, outlist, vrec and clear were all absent. Every one of them is documented in the guide, and putting the cursor on any of them and pressing Alt+I did nothing at all, which reads as a broken keystroke rather than as a gap in a list. They are all there now, each with what it does and, where it matters, why it is separate from its neighbour \u2014 vres is GPU shader work and wres is main-thread canvas work, and the reason wres exists at all is the texture upload rather than the drawing. theme() had TWO entries, an old one and the new one, and the inspector takes the first it finds, so it was explaining a version of theme() that did not know about indices; the stale one is gone.',
        'The run and menu bars are one bar, and the render-load control is a real menu. Two bars for fourteen controls meant two headers, two edges and two things to move whenever the workspace was rearranged, to separate things nobody confuses anyway \u2014 so there is one bar with a rule inside it instead of a panel edge between them: everything left of the status readout is the music, everything right of it is the app. The readout does the separating on its own, being the one flexible element in the row, which is why no divider is drawn on top of it. The performance button no longer cycles silently through three presets you cannot see. It opens a menu that says what the trade actually is in two sentences, lists the three presets WITH the four numbers each one sets, and then gives you those four numbers as fields \u2014 vfps() vres() wres() vbudget(), labelled as the functions they are, so the menu teaches the language rather than replacing it. Picking a preset fills the fields in and typing in a field drops the preset: they are the same four settings, so there is no second copy of the state to keep in sync. A hand-set value is remembered as \u201ccustom\u201d WITH its numbers, because a value you set by hand is a decision and a reload that quietly put a preset back would be the app overruling you. The icon is gone: the label says perf: balanced or perf: audio first in words, which is one less thing to learn for a control pressed a handful of times.',
        'theme() takes a number as well as a name. A 0-based index that WRAPS \u2014 the same shape pal= and blend= have had for a while \u2014 which is what makes it computable rather than merely typable: theme(n + 1) steps through the set, theme(PRand(0, 9)) picks a different skin every time the line runs, and a negative counts back from the end. Wrapping rather than clamping is the whole reason stepping works at the end of the list. A pattern or TimeVar is sampled ONCE, because this is a command and not a param: it takes the value the moment you run the line. Two things came with it. theme() with no argument now LISTS the skins with their numbers and marks the one you are on, because an index nobody can see is an index nobody can use. And the list is read from the Theme dropdown itself rather than kept as a second copy in the function \u2014 two lists of themes drift, the one people can see is the one that has to be right, and the numbers have to agree with its order or theme(3) means something other than the fourth row.',
        'The learn bar is a MENU bar now \u2014 tour, examples, the theme picker, the classic/desktop switch, the version, and the visual performance control. What they have in common is that every one is a decision you make BETWEEN things rather than during them, which is also why the performance control is here and not on the run bar next to stop: it is a preference about this machine, not a move in the set. The name changed because \u201clearn\u201d had stopped describing what was in it; the panel keeps its old id, so a saved layout keeps its position. The performance control is one button rather than four sliders. The four knobs behind it (vfps \u00b7 vres \u00b7 wres \u00b7 vbudget) are real and stay in the language, but the decision you actually make mid-set is coarse \u2014 the picture matters more right now, or the timing does \u2014 so it cycles audio \u00b7 balanced \u00b7 video and colours itself when it is not balanced. The readout beside it is the part that makes the choice honest: it says what the visuals are costing in frames and milliseconds, once a second (a readout that redraws sixty times a second is part of the problem it is reporting on), so this is something you read rather than guess at. The mode is remembered across reloads and restored quietly \u2014 it is a preference, not an event. The theme picker MOVED rather than being duplicated: one control for one piece of state. In the classic layout it stays where it always was, under Settings, because panels only adopt in desktop mode.',
        'vperf() \u2014 the audio/video CPU trade, as one decision, plus the two knobs it was missing. The question \u201ccan I give priority to audio or to video\u201d has a precise answer here and it is worth stating rather than implying: THE AUDIO ENGINE IS NOT ON THIS THREAD. scsynth is WebAssembly in an AudioWorklet, running on the browser\u2019s real-time audio thread, so no amount of drawing can starve the DSP and a stuttering picture never becomes a crackling sound. What shares the main thread with the picture is the CLOCK \u2014 clock.js re-arms itself with a 10ms timeout \u2014 and therefore the scheduling of every note. Events go out 120ms early carrying an NTP timetag, so scsynth plays them at the right instant no matter how jittery the dispatch was: the main thread can stall for that long and nothing is late. Past it, notes miss their timetag and arrive late. So the trade is real but narrow, and it is a trade about LATENESS rather than about audio quality. vperf(\'audio\') \u00b7 vperf(\'balanced\') \u00b7 vperf(\'video\') set all four knobs coherently, and vperf() with no argument reports them together with the frame rate and cost actually measured, so it is something you read rather than guess at. Two of the four are new. vfps(n) caps how often the picture is drawn and is the biggest single lever there is \u2014 30fps is half the main-thread work of 60 for a picture most sets cannot tell apart; it still runs on requestAnimationFrame rather than a timer, so a capped loop lands on real frame boundaries instead of tearing between them, and a long stall (a backgrounded tab) is rationed at the cap rather than released as a burst of catch-up frames nobody will see. vbudget(ms) exposes what was a hard-coded 4: how long the CPU-drawn workshop layers may take before a layer over budget starts redrawing every Nth frame with its last picture still compositing. The other two, vres() and wres(), already existed and are now reported alongside the rest instead of being two things you had to remember separately. All four ride the visual state to a pop-out visuals window, which has no language of its own, and vsnap() writes back any that are not at their default. And every visual global \u2014 palette · vmode · vres · wres · vfps · vbudget · vperf · vsnap · vrand · output · outclose · outlist · vrec \u2014 is finally in the completion menu; each one was documented and none of them was offered, so you had to already know the name to reach it.',
        'Fixed: the source picker in the OUTPUTS panel closed before you could pick anything. The panel redrew itself every 1.5 seconds by emptying its container and building it again \u2014 and a native dropdown whose element leaves the document closes instantly, so you had at most a second and a half, usually far less, before the list vanished from under the pointer. Two guards, because they cover different halves of it. The panel now rebuilds only when what it would DRAW has actually changed \u2014 which outputs exist, which surfaces they carry, what each shows and how it is warped, and which sources are available to choose from \u2014 and that is almost never, because nothing in this panel animates. And even when something HAS changed it waits while a control in the panel holds focus, since clicking a select focuses it before the popup opens, which is exactly the moment the old code was destroying. A change or a blur runs the render that was skipped, so nothing stays stale once you let go. The same hazard, smaller, in two other places: the SCREEN panel\u2019s picker and the LAYERS panel\u2019s destination both reassigned .value on a timer, and setting the value of a select whose popup is open snaps the highlight back under the pointer. Neither does it while you are in it now. It is the same shape as the autocomplete bug fixed just before it \u2014 a periodic redraw that does not know a human is in the middle of using the thing it is redrawing.',
        'aud() is in the completion menu with its options, not just its name. Under \u2014 live \u2014 at any value position it opens into two groups, because aud and midi are two different questions: \u201cfollow the sound\u201d lists the four bands, a numbered FFT bin, and the three variants you reach for next \u2014 with a range, with a curve, with smoothing; \u201ca controller\u201d holds midi cc, midi + range and mlearn. Picking one inserts the whole call. Every row is labelled with the function it inserts \u2014 aud bass rather than bass \u2014 and that is not cosmetic: typing filters on the label with startsWith, so rows called bass and treble would be invisible to anyone who types aud, which is precisely what you type when you are looking for them. Under the category the prefix reads as mild repetition; in the filtered list it is the only thing that says what the row will do.',
        'aud() \u2014 the SOUND, as a value you can put anywhere a number goes. It is deliberately the twin of midi(): the same {get()} shape, the same seven response curves, the same lo/hi range, which means it needed no new plumbing anywhere and works on EVERY param in the language, audio and visual alike. video1 >> plasma(speed=aud(\'bass\', 0.2, 3)) \u00b7 video2 >> freqtower(scale=aud(4)) \u00b7 p1 >> pluck(lpf=aud(\'treble\', 400, 6000)). Four named bands \u2014 level, bass, mid, treble, the same four audiviz() meters \u2014 plus the 32 spectrum bins by number, which is the narrow \u201cEQ channel\u201d you want when a kick and a hat should not move the same knob. It reads the SAME analyser audiviz() and the visuals read, so a meter, a picture and a bound param can never disagree and nothing extra is connected to the audio graph. In a session that analyser falls back to the room\u2019s shared one, so a machine running visuals with no audio booted still follows whoever is playing. A fifth argument is the follower\u2019s time constant in seconds. It smooths against WALL TIME rather than per call, because the same object is read once a frame by the renderer and again by whatever panel is showing it, and a per-call follower would run at whatever rate that happened to be. 0 is the raw analyser, which flickers; the default takes the twitch off without making it feel late.',
        'And the \u223f handle: every knob in the LAYERS panel can now be handed to the sound or to a MIDI controller without typing. The menu offers the four bands, a numbered FFT bin, and MIDI learn, and a bound param swaps its knob for a tag saying what it follows \u2014 aud bass, midi cc7, or learn\u2026 while it waits for you to touch something. The range it picks matters more than it sounds: a binding sweeps from the value the param HAS RIGHT NOW to the top of its declared range, not from the bottom. So silence leaves the picture exactly as you left it and the sound only pushes it \u2014 binding is additive rather than a replacement, and nothing jumps at the instant you press the button. Starting at the declared minimum would mean a quiet bar slams plasma\u2019s speed to -2 and the scene runs backwards at full tilt whenever nobody is playing. A param already at its ceiling gets pulled DOWN instead, stopping at its own default rather than its minimum, for the same reason. MIDI learn arms at position 0 for the same promise, where a typed mlearn() starts at the middle of its range so a fresh patch is not silent. None of it has to be perfect, and that is the point of the button next to it: \u2192 code writes the numbers into the buffer where you can change them.',
        'Fixed: \u2192 code in the LAYERS panel did not appear to do anything. It wrote the line to the LOG \u2014 which in the desktop layout is a panel you may not have open, so the button looked broken. A generated line belongs in a buffer, and with several buffers open (some of them detached into their own panels) \u201cthe current editor\u201d is not something a panel can point at, so it asks: there is a destination picker at the top of the panel, the same one and the same reasoning as the piano\u2019s. Two things came out of fixing it. vsnap() froze a live control into whatever number it happened to read at that instant \u2014 so a layer driven by midi() snapshotted as a constant, and the movement, which was the whole point, was silently lost. A value that knows how to write itself back as source now does; everything else is sampled as before. And the panel had to learn that not every object on a param is the same thing: a live control can be unbound from the panel, while a pattern or TimeVar still cannot, because its source is not recoverable from the object \u2014 the panel says so and sends you to the line, which is the same honesty the knob rule has always had.',
        'Fixed: the autocomplete menu scrolled itself away from you, so nothing past the first screenful of the workshop layers could be picked. That column is one list of 190 names — long, which is fine — but the menu rebuilt every column from scratch on every hover and every keypress, and a freshly created element starts scrolled to the top. So it then scrolled just far enough to show the selected row, which lands it at the BOTTOM edge of the box: the list shifts under the pointer, a different row is now beneath the mouse, that fires its own hover, and the column races upward on its own. Wheel down as far as you like and one twitch of the mouse threw it all away. A column is reused now while it is still showing the same entries — only the active row moves — so its scroll position simply stays where you put it. And scrolling the selection into view is for the KEYBOARD only, which moves a selection you cannot see; with the mouse the selection is under the pointer already, and scrolling to it is precisely the thing that was breaking. Arrow keys past the fold, and wrap-around, still work exactly as before.',
        'Fixed, and it is the big one: a peer\'s eval often never ran on the other machines — and the reason turned out to be that THE BEAT WAS NEVER ACTUALLY SHARED. clock.now() is a purely local counter. It starts at 0 when a machine boots audio, so two people who booted a minute apart are about 120 beats apart and neither number means anything on the other\'s computer. beat_sync, which sounds like it settles this, only ever repaired the TEMPO and a wall-clock offset; it left the beat number alone. So “our beat clocks are aligned” was simply false, and everything built on that sentence was quietly broken. An eval carried the sender\'s beat, and the receiver, finding it hundreds of beats ahead of its own, dutifully scheduled the line for a moment several minutes away — logged it, showed it in the peer feed, and then swallowed it. And if the sender had booted LATER instead, the same arithmetic ran the line immediately and cried “late eval” about it. The master\'s beat domain is recoverable, though, and that is the one a room can agree on: beat_sync already carries the master\'s beat and the wall time that reading was taken at, and the wall clocks are already aligned, so where the master\'s beat has reached RIGHT NOW is just arithmetic — its reading, plus the time since, at its tempo, minus the one-way hop the message spent in flight. That is held as an OFFSET rather than by jumping the local beat, because _beat is what every scheduled event, every() phase and running player is timed against and moving it would re-time the whole set. It snaps on the first sync and eases afterwards, since beat_sync arrives every eight beats and an offset that twitches re-times every eval landing near it. Measured across two peers whose local counters were a thousand beats apart: they agree on the room beat to within four milliseconds. Evals now travel in that domain and are converted back on arrival, and the wait is bounded — a line held longer than a bar, or held on a clock that is not running, runs immediately instead. Running slightly late is a small musical error; not running at all is not one.',
        'Correction to an earlier entry here: “Visuals sync in a jam now, down to the phase” was not true when it was written. It said workshop layers run on the beat, which is “monotonic because the beat is, identical on every peer because the beat is” — and the second half of that was wrong for the reason above. The beat number was local, so two peers running the same layer animated on unrelated phases, which is exactly what the change was meant to prevent. It is true now: room time comes from the room\'s beat, on this window and on the pop-out visuals window, which has no clock or session of its own and so is sent the shared beat over the bridge alongside the audio. A machine that is not in a session falls back to its own beat and behaves as it always did.',
        'Fixed: two tabs of the same browser showed up as ONE person in a jam. The identity was one object in localStorage carrying the name, the colour AND the id — but those answer different questions and want different lifetimes. Name and colour are YOURS: they should follow you into every room and every window. The id answers “which connection is this”, and it is what peers de-duplicate on, what marks a row “(you)”, and what a role or a track claim attaches to. Sharing it across tabs meant the peer list collapsed to a single row wearing your own name, both entries counted as yourself, and there was no way to tell “nobody has joined” apart from “someone joined and the app is merging us”. That is exactly how everyone tests a jam, so it is exactly the case that had to read truthfully. The id lives in sessionStorage now — one per tab, kept across reloads of that tab, so refreshing still does not spawn a ghost of you, which is the whole reason it was stable in the first place. Name, colour and station stay in localStorage and stay shared. One caveat worth knowing: Chrome COPIES sessionStorage into a duplicated tab, so “Duplicate tab” brings the collapse back; opening the link in a new tab, a new window or another browser does not.',
        'And crashDot now says why nobody else is in your room. serve.py binds 127.0.0.1, so the URL in the address bar names THIS machine and nothing else — hand that link to someone and it resolves, on their computer, to their own localhost: a different server, a different relay, and a room with the same name containing none of the same people. Both ends connect, both look perfectly healthy, and neither sees the other\'s peers, chat or code. It is the worst shape a failure can have, because it presents as a bug in the app rather than as an address that cannot travel. So while you are alone in a room the session panel says so in words — and, if the page came from loopback, says that the link works on this machine only and to run serve-lan.py and share the https://<your-ip>:8765 link instead. The same warning fires when you copy the session link. It disappears the moment anyone actually joins, because at that point the question has answered itself. serve-lan.py speaks TLS for a reason worth repeating: the WASM audio engine needs SharedArrayBuffer, which browsers only expose in a secure context, and http://localhost counts as one while http://<LAN-IP> does not.',
        'Fixed: “go live” dropped you back into the classic layout, and the switch back was hard to find. Every in-app navigation was built as pathname + ?session=slug, which threw away the whole rest of the query string — so anyone running the desktop UI from ?ui=desktop rather than from the persisted toggle lost it the moment they started a jam, joined one from the galaxy, or was handed a session link. The app changed shape under you because you started a session. The query string carries two different KINDS of thing and they were being treated as one: session says which ROOM you are in, and belongs to the jam; ui and diag say how THIS machine is running the app, and belong to you. There are two builders now. navUrl() is where I am going — it keeps my setup and replaces the room, and it clears all three spellings of the session key (session, s and the bare ?=NAME the boot path accepts) so the room you just left cannot win on the next read. roomLink() is what I hand someone else — the room and nothing of mine, because forcing a layout on whoever opens your link is not sharing. For the same reason a blocked clipboard now LOGS the session link instead of pushing it into the address bar: that URL is deliberately stripped, and parking it in the bar would quietly change how your machine starts up next time. And the layout switch is a real button on the desktop canvas, in the learn bar beside the tour and the examples. It was reachable only from the canvas right-click menu, which is a fine place for it and a poor ONLY place — the one control that gets you out of an experimental layout should be visible from inside it. It names its DESTINATION rather than its state, reading “desktop” in the classic layout and “classic” once you are on the canvas, and it is no longer highlighted, since a lit button reading “classic” claims the opposite of what is true. One more hole came out of testing it: ?ui= outranks the stored mode, so with ui=desktop in the address bar the button wrote “classic” to storage, reloaded, and landed on the desktop again — a switch that visibly did nothing. It now navigates with the override stripped, keeping the session, which hands the decision back to the toggle. That is what pressing a toggle means.',
        'A room can now split the work — some machines making the sound, some making the picture, all on the same set. Most of what a merged multiplayer needs was already here and it is worth being exact about that, because the interesting part is the ONE thing that was not. Rooms, peers and colours: already there. Chat: already there, and persistent — it lives in the shared document, so it replays for whoever joins next rather than being a stream you had to be present for. Assignment: already there and richer than the tool this merges with — roles and capabilities, editable live, gated on RECEIVE as well as on send. The code itself: already shared, which is why visuals never needed replicating — a video line is text in the buffer, every peer evaluates it, every peer renders it. And the animation phase: already solved, on the shared beat. What was missing is the thing the workshop\'s own room module names third and calls out by name: THE AUDIO. Every machine ran its analyser on its own output, so a laptop driving a projector with no audio booted saw a flat spectrum and every audio-reactive layer — cymatics, freqtower, chladniplate, the whole reactive half of the catalogue — simply froze. Identical code, identical clock, dead picture. So the analysis is shared now: whoever is making sound publishes bass, mid, treble, level and a 32-bin spectrum, and a machine whose own ears are silent takes the room\'s instead. It rides AWARENESS rather than the document, because awareness is ephemeral and untracked — putting fifteen spectra a second into a CRDT\'s history would grow it forever to describe a sound nobody can hear any more. Quantised to bytes on the way out, since it comes from a byte analyser and JSON floats would triple the payload for precision no eye can use. And it prefers whoever is LOUDEST rather than whoever holds the beat, because the machine keeping time is not necessarily the one making the noise.',
        'Stations — one switch that says what a machine is here to do: music + visuals, music, or visuals. It has exactly ONE mechanical effect, the master gain, and that is the point rather than a shortcut: the analyser taps the master output, so a silent station also has silent EARS, which is precisely the condition under which the visuals fall back to the room\'s shared analysis. Muting the machine is what makes it listen. It survives a boot and a reload, it shows on every peer\'s list as ◈, and beside it a ♪ marks who is actually making sound right now — read from their published analysis rather than from their declared station, because what you can hear beats what anyone claims. It is deliberately a convenience and not a lock: typing Master().gain = 1 on a visuals station will unmute it, and should, because the person at the keyboard outranks the setting.',
        'The LAYERS panel reaches the room, behind a new visuals capability. Turning a knob was purely local — you could dial in a look on a shared set and nobody else saw any of it, which for a room that is supposed to split music and visuals is the whole game. Layer params, per-layer FX and the deck button now ride the same sticky-state map the mixer faders use, which gives live propagation and the join snapshot from one mechanism: a peer arriving mid-set gets the picture you are actually showing, not the one the code happens to describe. Throttled, because a knob drag fires sixty times a second. Gated by its own capability rather than by run code, because turning a knob and rewriting the room\'s set are different amounts of trust — a VJ who is not allowed to retype the music should still be able to open the strobe. Host and player hold it by default, listener does not. One case needed real care, and it is the case that matters most: the replay arrives BEFORE the code that creates the layers, since joining hands you the text but does not run it. An edit for a layer that does not exist yet used to be dropped, which would have meant the room agreed on the code and disagreed about the performance — so vlang holds those edits and drains them the moment the layer appears, once, without stepping on anything newer.',
        'Per-layer opacity and blend, which crashDot never had. Several layers on one deck could only ever stack by field-MAX, and the only blend in the app was the crossfader\\\'s — which combines the two finished DECKS and is a different question entirely. Every layer now takes opacity (0 to 1) and blend: max, add, multiply, screen, difference, over. This is the pair the workshop gives each of its channels, and it is the thing that turns two layers into a picture rather than two pictures. max is the default because it is exactly what stacking did before any of this existed, so a set written last week looks identical today. Both are ordinary params, which means the whole pattern and TimeVar vocabulary drives them — opacity=sinvar([0,1],16) breathes a layer in and out on the clock. It is implemented in three places that have to agree: a blendVal() in the GL scene shader, the same function in the CPU compositor so the glyph modes do not show a different picture, and the canvas composite operation for workshop layers, where `max` maps to `lighten` since Canvas2D has no exact equivalent. One subtlety worth naming: the FIRST layer onto a freshly cleared deck always draws plainly, whatever its blend says, because multiply against transparent black is black and difference against it is a negative — a blend mode is a relationship, and the first layer has nothing yet to be in a relationship with. The LAYERS panel puts opacity and blend under each layer\\\'s header alongside the deck button, since they describe how a layer MEETS the others rather than what it looks like on its own. And the SCREEN panel finally answers "what am I looking at" where you are looking: hover it and a source picker appears top-right, driving the same manager as the first row of the OUTPUTS panel.',
        'The FX chain is on the layer row now — 52 per-layer effects existed and the only way to reach one was to type + vhs(0.6). Each effect is a chip in chain order carrying a knob on its amount and a × to drop it, + fx adds one, and a new effect lands at the END, which is where typing the + would have put it. The picker splits into two groups because they are two different things: crashDot\\\'s own effects are uniforms over the whole finished frame, the workshop\\\'s are drawn on that one layer\\\'s canvas. Two bugs came out of testing which is which, and both were the silent kind. Adding an effect gave it whichever default came to hand, so invert on a video synth got the workshop\\\'s 0.5 — while crashDot\\\'s whole-frame invert is a FLAG that only triggers at 1 or more, meaning the panel would happily add an effect that then never happened. And the test for "does the workshop implement this" was using the wrong set: the forty names crashDot LACKS, rather than the fifty-two the workshop HAS. Those differ by the twelve shared names, and it is exactly the shared ones that route to the workshop on a workshop layer — so invert there took crashDot\\\'s flag, which a canvas effect cannot read. Both now ask the same question the renderer asks, in the same words.',
        'The SCREEN panel can show something other than the master mix. It was the one destination you could not point at anything — every output surface could carry a single layer or a code buffer while SCREEN, the picture you actually look at while working, was hard-wired to the mix. It is the first row of the OUTPUTS panel now, with the same source picker and honestly fewer controls than a projector gets: no warp, because warping inside a pan/zoom workspace is meaningless, and no edge blend, because there is no second projector to blend against. Mechanically it is an overlay over the GL canvas rather than a change to the renderer, so the master path is untouched and free — for the mix the overlay is simply hidden and the renderer draws straight through. Anything else is drawn into it fitted rather than stretched, since a code buffer or a single layer rarely matches the panel\\\'s shape and squashing text is worse than a letterbox.',
        'Fixed: an output surface set to a code buffer showed black. Outputs were driven from the renderer\\\'s frame callback, which is right for the master mix — the GL canvas can only be read there — and wrong for everything else, because the renderer stops early when there are no visual layers to draw. So a surface showing your code only updated while a visual scene happened to be running, which is precisely the case where one is not; and if no renderer was running at all, outputs never drew anything. They run their own loop now, alive exactly as long as an output is open. A layer\\\'s canvas and a code buffer\\\'s canvas are plain 2D and readable whenever, so the loop reads them directly; only the master mix still comes from the renderer, copied inside its callback into a mirror the loop reads. The shape of the mistake is worth remembering: a consumer had been bolted onto a producer\\\'s schedule and inherited that producer\\\'s reasons for STOPPING — the renderer stops when there is nothing to draw, which is correct for a renderer and meaningless for an output whose source is somewhere else entirely.',
        'A LAYERS panel — turn the knobs without typing. crashDot has 239 scenes carrying up to twenty parameters each, and the only way to move one was to type a number and re-run the line: right for composing, wrong for FINDING a look, which you do by turning something and watching what happens. The panel lists every live video layer with its parameters as real dials drawn from each one\\\'s own declared range, a button to move it between the two decks, and → CODE to write that single layer back out as a line carrying everything you have dialled in — perform with the knobs, then keep it as text, which is the loop the piano panel already uses. This is the workshop\\\'s channel panel in job rather than in code: that one is built around its channel-and-driver architecture, which crashDot deliberately does not have, because here a layer IS code and modulation IS patterns and TimeVars. Which leads to the thing the panel is careful about — a param driven by a pattern or a TimeVar shows as "pattern" and deliberately gets NO knob. A knob cannot represent sinvar([0,1],8); giving it one would replace the movement with a fixed number the moment you touched it, and the honest interface says so instead. Two bugs came out of testing it against the running app. The knob list was built from the scene\\\'s declared params plus a fixed universal set, so a param you had actually typed that was in neither — hue on a field scene, for one — never appeared at all, and the panel quietly disagreed with your own line about what the layer had; the list now includes whatever is actually set. And the panel rebuilds its DOM only when the SET of layers changes rather than on every poll, because replacing a knob under the finger that is dragging it is its own kind of broken.',
        'vrand(n, seed) pastes a random visual look — the twin of chaos(), and it works the same way deliberately: it does not change what is on screen, it writes LINES you read, edit and run. A generator that mutates hidden state hands you a picture you cannot keep, cannot edit and cannot share; one that writes code gives you all three, and it reaches a jam because the buffer does. Two changes from the workshop\\\'s own reroll button, both because the output here is CODE rather than a state change. It is seeded: vrand(3, 1234) is the same three layers on every machine, so a look can be described in a message, and an unseeded call writes the seed it chose into the comment, which makes a happy accident reproducible after the fact — the thing you always want and never have. And every value is drawn from that parameter\\\'s own declared range rather than a shared 0 to 1, which meant teaching the generated catalog to carry ranges as well as defaults: 1,987 of them across the 206 layers, since a cutoff at 0.5 and a particle count at 0.5 are not the same request. Three quality bugs came out of testing 1,800 generated lines against the transpiler and the live vocabulary. A count emitted as a fraction — metaballs(count=1.84) is not a look, it is a guess with decimals — fixed by rounding any param the layer itself declares as a whole number, and the rule for deciding that is read off the declared triple rather than a magnitude threshold, because scrollingtext declares rows as base 1 over [1,4] and that is every bit as much a count as a 20. A param whose default is 0 carries no scale at all — in mosaic it even means "same as cells" — so it is left alone rather than randomised around nothing. And the range check itself was initially comparing field scenes against workshop ranges for the sixteen names that exist in both, which is the wrong table: a name crashDot has as a field scene resolves to the field scene.',
        'vrec() records the visuals. crashDot could already record three of the four things a set is made of — the audio, the code and the MIDI — and not what it looked like; this is the fourth, ported from the workshop\\\'s export.js. vrec() arms, vrec() again stops and downloads a .webm, vrec("myset") names the file: deliberately the same shape as midi_rec(), because it is the same gesture. It records the composited output, the same picture the SCREEN panel shows and an output window copies, with projector warping excluded because that describes a room rather than the piece. Two things had to be got right, and both were found by measuring rather than by assuming. MediaRecorder on a WebGL canvas\\\'s own captureStream produces NOTHING — measured here, a 2D canvas drawn in a loop yields a real file while the identical loop on a WebGL2 canvas yields 110 bytes, a header with no frames, with preserveDrawingBuffer both true and false — so this keeps a plain 2D mirror and copies each rendered frame into it, which is the same drawImage the panel backdrops already do, from inside the render callback where the GL canvas can actually be read. And the mirror has to be IN THE DOCUMENT: a detached canvas is barely sampled at all (4.4 KB attached versus 0.7 KB detached, same drawing, same loop), because the browser only captures a canvas that is part of a rendered document. Off-screen is fine; detached is not the same thing as invisible. It costs one blit per frame while recording and nothing at all when not.',
        'The tour finally teaches the VISUALS — two lessons, in all five languages, on the half of crashDot that the tutorial had never once mentioned. Not a single one of the 42 lessons contained the word video1, or palette(), or mix(): the app draws 239 scenes, chains 69 effects and maps projectors, and someone working through the tour end to end would have finished without learning that any of it exists. Lesson 41 is the picture itself — a player named video1 is a visual player and takes a scene the way an audio player takes a synth, there are two KINDS of scene and it is worth knowing which you have (a video synth is a field on the GPU that palette() colours and costs almost nothing; a workshop layer is an imperative drawing that brings its own colour and costs more), every param takes the same patterns and TimeVars as your audio, there are two decks and a crossfader, and effects chain with + exactly like audio FX. Lesson 42 is getting it onto a wall: output() opens a projector window, output(3) gives it three independently warped surfaces so a flat quad can be pinned onto each visible face of a box and the object reads as mapped without any 3D, [w] shows the corner handles, each surface picks its own source — the master mix, one layer alone, or a code buffer, so one face carries the visuals and another carries the code making them as you type it — and the mapping stays on this machine because it describes where a projector sits in a room rather than what the piece is. Every line in both lessons is runnable and was checked through the transpiler and against the live vocabulary, which is the standard the rest of the tour is held to. That makes it 44 lessons; Buffers and the closing lesson moved up two, and the one cross-reference to Buffers moved with them.',
        'Two corrections after actually using the output manager. Running a video line no longer opens a browser window. It did when the pop-out visuals window was the only place a scene could go, and it made sense then; with a SCREEN panel on the desktop and an explicit output manager for projectors, a set that spawns a window every time you evaluate a scene is a set that fights you. Where the picture goes is a decision you make once — output(), or open SCREEN — not a side effect of running a line. crashDot says in the log where the picture went, once per session rather than on every eval. And an output surface can now show A CODE BUFFER: the set or any scratch, rendered as a texture with its syntax colouring, updating as you type, so one face of the object you are mapping carries the visuals and another carries the code making them. That is the thing a live-coding show has always wanted a projector for. It is deliberately not the codeFull layer, and both are worth having — codeFull is a performance, accumulating evals and flashing and scrolling, showing the code that RAN; a buffer source is the code as it is right now, the thing you are typing into. The colouring is five regexes (comment, string, number, the >> arrow, a call) rather than a borrowed tokenizer, because this runs against a plain string on a canvas and those five are what carry the meaning of a FoxDot line; runs of plain text coalesce so a line costs a handful of fillText calls rather than one per character, and the whole thing only redraws when the text or the surface size actually changes.',
        'Output windows, and your code as a texture to map. output() opens a projector window and output(3) gives it three independently warped SURFACES — which is the whole point, and what the first pass at this could not do. One output is one projector; N surfaces in it are N warped patches of content, so you pin a flat quad onto each visible face of a box or a truss corner and the object reads as mapped, without any 3D rendering. It is how MadMapper and Resolume handle faceted objects. Each surface picks its own source, and crashDot has more of those than the tool this came from: the master mix, or any single live workshop layer on its own. That last one is the interesting part, because ten of those layers are ABOUT live coding — codeFull, codeComic, codeConspiracy, liveCode, evalSeismograph, ransomEval, instrumentPop, comicPanels, beatCreatures, toonEQ — and they all now get a real feed from the editor, so they render the code you are actually running, flash on evaluation, and colour each instrument they find in a player >> instrument() line. One face of the box carries the visuals; another carries the code making them. In the output window [w] shows the warp handles, [m] cycles corner-pin to edge-curve to full mesh, [ and ] change the mesh grid, [r] resets and [f] goes fullscreen; the OUTPUTS panel does the same from the desktop with a source picker and edge-blend sliders per surface. The warp is a grid of texture-mapped triangles on a 2D canvas rather than a CSS transform, because CSS can only express a four-point projective map and the mesh mode is exactly what curved walls need — which in turn means each surface has to read its source INSIDE the render callback, since the GL canvas is created with preserveDrawingBuffer off and reads black afterwards. Mapping is saved per machine and is never shared and never part of a look: it describes where a projector sits in a room, not what the piece sounds or looks like, so joining a jam cannot yank a calibrated projector. Outputs are deliberately not reopened by themselves after a refresh — a page reload that spawns projector windows unasked is worse than one that forgets them — and REOPEN brings one back with its mapping intact.',
        'Projection mapping in the visuals window — press [m] and drag the four corners onto whatever surface the projector actually hits, with edge blending underneath for when there are two of them. This is the last piece of the workshop absorption and the one that only matters when you take the visuals out of the laptop and put them on a wall. The warp is a corner-pin homography applied as a CSS matrix3d rather than as a shader, which is the workshop\\\'s idea and a good one: solving the map from the unit square onto four dragged corners and handing it to the compositor costs nothing, needs no change to the render pipeline, and works on any element — which matters here, because crashDot\\\'s output is TWO stacked canvases, the GPU one and the glyph/idle overlay, and they have to warp identically or the overlay slides off the picture. Same matrix on both, and on the blend overlay, so they stay welded. Edge blending is four black CSS gradients rather than the workshop\\\'s canvas gradients, because a WebGL canvas has no 2D context to draw into and a gradient in the DOM is resolution-independent and composited on the GPU anyway; it warps with everything else, so the blend edges follow the projected quad instead of the screen. Corners past the edge are allowed — a projector often has to throw beyond its surface — but not far enough to invert the quad and lose the picture. None of it is shared or saved into a look: it lives in this browser and describes a physical room, so joining a session cannot yank a calibrated projector. That is the same line the workshop draws, and it draws it for the same reason. Two things fixed on the way: the visuals HUD is rewritten every frame, so the static [f]ull/[c]lear hint in the page had been invisible for as long as it has existed (the keys work, the reminder never showed) — the hints are in the live HUD now, along with [m]ap — and the mapping status message holds the HUD while mapping is open instead of being overwritten a frame later.',
        'The VJ workshop is absorbed — 190 new scenes and 52 per-layer effects, rendering in crashDot rather than in a second app. The stars/workshop tool has always been the visual half of this setup, reachable over a BroadcastChannel: crashDot knew 49 of its scene names and forwarded video1 >> mandelbulb() to whatever window happened to be open. Now the layers live here. What made 33,000 lines portable was one number — 191 of its 207 layer files import NOTHING at all: they are pure draw functions, and the workshop resolves their params to plain numbers before calling them, which is exactly what crashDot\\\'s own resolver already produces. crashDot therefore has TWO kinds of visual now, and it is worth knowing which you are using. A video synth (49) is a scalar FIELD — one function evaluated per pixel on the GPU, coloured by palette(), so hue and pal steer it and it costs almost nothing. A workshop layer (190) is an imperative DRAW that brings its own colour — palette() does nothing to it, and it runs on the CPU, so a few at once is the sensible number. Everything else is identical: the same videoN >> syntax, the same two decks, the same crossfader, the same universal knobs, and the full pattern/TimeVar vocabulary on every param, so mandelbulb(power=sinvar([2,9],32)) and boids(count=PRand(60,240), dur=4) do what you would expect. Ctrl+Space after video1 >> now lists both groups, and picking one inserts the full call with every knob at its real default. The catalogue runs from raymarched 3D (mandelbulb · mandelbox · apollonian · kalitunnel · tesseract · supershape) through whole worlds (doomcorridor · neoncity · cityosm · fpvdrone · cyberpunkworld) and simulations that grow (slimemold · mycelium · reactiondiff · fallingsand · langtonsant · lsystem) to audio-reactive instruments (freqtower · cymatics · chladniplate · xyoscope), Ikeda-style data walls, typography, film damage and the CrashServer set (crashserver · cricbombing · resistancenet · nuclearblast). Twelve of them threw on their first frame and had never worked — three different ways of using a delta-time variable that was never declared — so they are fixed here and the fixes belong back upstream.',
        '52 effects that apply to ONE layer, not to the whole frame — vhs · datamosh · oilPaint · neonGlow · ledWall · badSignal · halftone · duotone · thermal · crystalize · displace3d · warholGrid · lensFlare · frameDiff · motionBlur · chromaticAberration · rgbOffset · sliceGlitch · echoZoom · zoomBurst · seamlessScroll · pixelDrift · contourLines · solarize · threshold · chromaKey · ascii · grain · tint · strobe · ripple and more. Chained with + exactly like the existing ones — video1 >> doomcorridor() + vhs(0.6) + neonGlow(0.5) — but they run on that layer\\\'s own canvas before it reaches the deck, which crashDot\\\'s own FX cannot do: those are uniforms in the final shader pass, applied once to the finished frame, so "bloom this one layer" was simply not expressible. Both kinds are kept and a name crashDot already has stays crashDot\\\'s, because a whole-frame effect on the GPU is cheaper and is what existing sets expect. Also new, and the same absorption: a master grade and an output limiter — sat() exposure() contrast() ceiling(). These four are NEUTRAL AT 1 rather than at 0 like every other FX key, which needed two rules of their own: a grade takes the value furthest from neutral rather than the largest, so sat(0) beats sat(1.2) (greyscale is a stronger intent than a slight lift), and two layers asking for different ceilings resolve to the LOWER one, because a ceiling is a promise not to exceed. ceiling() exists for a specific reason: a lighter-blend stacks to solid white on bright content, which is why every professional VJ desk gates output brightness.',
        'Visuals sync in a jam now, down to the phase. They always synced in the sense that matters — a video line is text in the shared buffer, so every peer evaluates it and renders it locally, and there is no visual state to replicate because there is no visual state. What did NOT sync was WHERE IN THE ANIMATION everyone was: a layer animating from its own machine\\\'s clock means a strobe fires on different frames on different laptops and a sweep is halfway round when yours is starting. The workshop hit this first and named it — its effects take "room time, so every machine in a classroom flashes on the same frame instead of each running off its own wall clock". crashDot already has the shared thing: the beat. So workshop layers run on beats converted to seconds at a 120bpm reference — monotonic because the beat is, identical on every peer because the beat is, and tempo-proportional, which for visuals driven by music is what you want anyway: take the set to 138 and the picture moves with it. Field scenes keep wall time, because they are pure functions of position and time in one shader and re-phasing them would change how every existing set looks. What still does not sync is the dice: a layer that calls random differs in its fine detail from peer to peer, exactly as a PRand does in the audio — the program is shared, the throws are not.',
        'vsnap() prints what is on screen as the code that would make it. Every live layer with its params at their CURRENT values, its FX chain, the crossfader and the palette, ready to paste into your set. This is deliberately not a preset system. The workshop saves a look as a blob in localStorage, which is the right answer for a VJ desk and the wrong one here: in crashDot the piece IS the text, so a look you can read, edit and paste is worth more than one you can only recall by name — and it is the only form that survives a jam, since code is in the shared buffer while your localStorage reaches nobody. vsnap(true) writes every knob rather than only the ones you changed, which turns it into a way of DISCOVERING a layer: run it bare, snapshot it, and the line comes back with all twelve of its parameters spelled out at the values it is actually using.',
        'The whole app on an infinite pan/zoom canvas — an OPTIONAL second layout, off by default, with the classic one untouched and still the default. Press DESKTOP and the fixed toolbar, the editor column and the right-hand crash panel are scattered over a zoomable workspace as draggable, resizable, snapping panels, with the editor among them rather than around them. The canvas and panel system are ported from the stars/workshop VJ tool. What makes it cheap is that panels do not REBUILD anything: each is handed an element that already exists — #editor-wrap, #log, a .cp-section, the mixer root — and adopts it, so every getElementById in the rest of the app keeps resolving and every listener stays attached. Ctrl+scroll zooms, drag the background to pan, double-click it to reset; panel edges snap to each other with guide lines (hold Alt to move freely); each panel has a colour, a home position you set and return to, and a pin that locks it to the viewport while the canvas moves under it. Leaving is a reload, deliberately — the mode is persisted, and putting a dozen live nodes back into a layout they no longer remember is a lot of code to get subtly wrong. Two things had to be solved before an editor could live inside a CSS transform at all. CodeMirror mixes scaled measurements (getBoundingClientRect) with unscaled ones (offsetWidth, scrollLeft, line heights), which showed up as the gutter sliding over the text, and as a caret that landed further from the click the further down the document you went — off by lineHeight x (1 - zoom) PER LINE. The editor now sits in a counter-scaled layer: scaled by 1/zoom, sized bodyBox x zoom, font-size base x zoom, so its net screen scale is exactly 1 and it is never inside the transform, while looking identical to a zoomed one. And zooming used to disturb the AUDIO: sixty wheel ticks meant sixty CodeMirror refreshes and sixty synchronous localStorage writes, on the same main thread the note scheduler runs on. Both settle after 140ms now, so a whole zoom gesture costs one of each.',
        'Everything on the canvas is a panel, and panels close — every panel has a × and remembers whether it was open, alongside its position and colour, because an arrangement that forgets what you put AWAY is only half an arrangement. That forced two things to exist. The top bar is not chrome any more: it was fixed above the canvas on the grounds that STOP is a panic button and must never be somewhere you have to pan to find, but stop-all is bound GLOBALLY (Ctrl+; · Ctrl+, · Ctrl+.), so the bar had no claim to be the one exception. Its sixteen buttons are three small panels now, grouped by when you reach for them — RUN (boot · load kit · run · stop · reload), COLLAB (share · go live · split) and LEARN (tour · examples · version) — because one 1900px strip of buttons is a list, not a grouping: it forced BOOT to sit beside RUN and GO LIVE beside EXAMPLES, so you learned positions rather than meanings. And the way back to anything you closed is a RIGHT-CLICK on the canvas: every window, grouped, each with a dot showing whether it is open, a click to toggle it and a ⊕ to open it and centre the view on it. Your buffers are in the same menu whether they are tabs in the strip or panels of their own, because "where did my scratch go" should have one answer wherever it currently lives. One rule decides what is a button and what is a menu row: a bar holds VERBS. Anything whose button only showed or hid a panel is a noun, and keeping both was two controls for one piece of state that could disagree. Right-clicking inside a panel CONTENT still gives you the browser menu, so spell check in the editor and copy in the log are untouched. The panel count fell from 22 to 11 on the way: the six sidebar sections (clock · players · composition · session · midi · settings) are one scrolling column of foldable sections again — which is exactly what they were in the classic layout — and boot and transport share a bar because they are adjacent in the only order that matters, boot then kit then run.',
        'Optional bpm and phrase counters on the canvas floor — the tempo, the 4/8/16/32/64-beat counters and the current bar and beat, drawn large and dim behind the panels like the crashDot wordmark. Right-click ▸ view ▸ bpm & counters; off by default, and the choice is remembered. Those counters are glanced at constantly and read in a tenth of a second, which is exactly the kind of thing that should not require finding a panel and exactly the kind of thing a 10px row in a sidebar is bad at; on the floor they are legible from across a room, which is the situation this layout is for. Because the note scheduler shares the main thread, the loop reads the clock every frame but writes to the DOM only when a displayed VALUE changes — the counters step once per beat, so roughly two DOM touches a second rather than a hundred and twenty — and it does not run at all while hidden.',
        'Detachable buffers — pull a tab out of the strip and it becomes its own panel, so a scratch buffer can sit NEXT TO the set instead of behind it, which is the entire point of having a canvas. ⧉ on a tab detaches it, ⤺ in the panel header sends it back to the strip, × discards it, and double-clicking the title renames it in place. Each detached buffer gets its own CodeMirror on the same document, and focusing one re-points the app editor binding at it, which is what makes Ctrl+Enter, the nudge keys, autocomplete and the var needles work in a detached panel without any of the run machinery knowing that panels exist. A document has to be RELEASED with swapDoc before it can be handed back, because CodeMirror refuses to put one document in two editors. Renaming did nothing at all at first, and the reason is worth writing down: the panel header takes pointer capture in order to drag, and a captured pointer makes the browser retarget the following double-click to the capture element — so it arrived at the header and collapsed the panel instead of reaching the title. It routes on the pointerdown target now, which is not retargeted. Closing asks on the button itself, which turns red and reads ×?, rather than in an unstyled confirm() dialog that stops the world to ask one question — and it only asks when there is text to lose.',
        'A virtual piano — play any synth, record what you play, and turn it into code. Open PIANO, pick a synth, play with the mouse, the computer keyboard or a MIDI keyboard, press REC, play a phrase, and TO CODE writes it out as a player line carrying the degrees and durations you actually played — inverted through the current scale, so it lands as scale degrees rather than as semitone soup. It inherits the SYNTH parameters: every knob under the keys is a real parameter of the voice you picked, drawn as an actual dial with a 270-degree sweep, with a range chosen per parameter rather than a shared 0 to 1 (cutoff and attack are exponential, pan is bipolar, an unknown parameter gets a range around its own default). The knobs are MIDI-learnable, so a controller drives them. The generated code goes to a buffer YOU choose from a picker that refreshes as you add tabs, not to whichever buffer happened to have focus. Two bugs found on the way: the take was thrown away when you pressed REC a second time (it is kept now, so TO CODE still works after you stop), and the recorder logged everything as one chord before the clock had started, which a wall-clock fallback at the current bpm fixes. The whole thing is deliberately self-contained and injected with a small context object rather than importing the engine, so it can be lifted onto another branch as one file.',
        'The visuals get a SCREEN panel and per-panel backdrops — SCREEN is a monitor on the canvas: video1 >> plasma() plays THERE, beside the code that drives it, instead of in a pop-out window on another display. Resize it, drag it, put it wherever you are looking. And the ▦ button in any panel header runs the same picture BEHIND that panel content, which on the editor is vbg() scoped to one window instead of to the whole app. Both are fed by ONE renderer: the screen owns the GL surface and every backdrop is a plain 2D canvas copying its frames, because browsers cap live WebGL2 contexts and each one costs real GPU — N panels showing the same picture must not mean N contexts. With no SCREEN panel open, a backdrop quietly starts the surface without revealing the panel, so the renderer runs either way. The copy has to happen inside the render callback: with preserveDrawingBuffer off, reading the canvas after compositing returns black.',
        'Save and recall workspaces — every panel position, size, colour and collapsed state, PLUS the view, because where you were looking is as much a part of an arrangement as where things were. So "writing", "mixing" and "performing" can be three arrangements of the same panels at three different zooms, one click apart. Named layouts live in the LAYOUTS panel. Whether a panel is OPEN is part of the same record, so recalling a layout puts away what that workspace had put away. Fixed along the way: the colour picker looked like a single colour, because ten swatches in one row were wider than a narrow panel and border-box sizing left 14 of each 18px swatch off the edge, and it was reaching for a --panel variable that does not exist in this app.',
        'Fixed a family of bugs that all came down to one question — WHICH buffer? Code generated at runtime (ascii_gen, audiviz, the piano) went to whichever buffer had focus, so switching tabs while a set was running got that set output pasted into whatever you had just opened, over and over; it goes to the buffer whose code ASKED for it now, and code written by a panel goes where you point it. The live gutter marked lines in buffers that were not playing and the var needles animated over unevaluated code, because both tracked a line NUMBER with no record of which document it belonged to; both are per-buffer now, and a needle only animates on a line that is actually running. Separately, and reported as stray glyphs turning up in the code, the real cause turned out to be genuine PASTES: text from the system clipboard arriving in an editor nobody had asked to paste into. Three plausible mechanisms were found and fixed on the way — panel chrome could be dragged into an editor as text, so could the tab strip own labels, and middle-click panning was pasting the X11 primary selection — and none of them was it. The fix that works is mechanism-independent: an editor accepts a paste only within three seconds of something that could have MEANT one (Ctrl/Cmd+V, Shift+Insert, or opening a context menu), and it logs the ones it turns away. Worth knowing if you ever test this: CodeMirror calls preventDefault on the pastes it handles itself, so defaultPrevented tells you nothing about whether the guard fired.',
        'The tour teaches the LOGIC now, not just the vocabulary — three lessons rewritten and one added, in all five languages. Lesson 6 used to name <xx> and [a b] in a header line and then demonstrate one of them; it now teaches all four brackets as one grammar that differs only in WHEN it acts — <ab> subdivides (both inside one step), [ab] alternates (a this loop, b the next), (ab) sounds together, {ab} re-picks at random — with a runnable line per bracket that changes only step 2, so you hear the difference rather than read about it, and a warning about the trap that produced a wrong example in this very changelog: a SPACE inside brackets is a rest, not a separator, so [x o] alternates x, silence, o. Lesson 9 was three lines about sinvar and linvar; it now starts from the distinction everything else rests on — a LIST is indexed by the STEP counter, a VAR by the BEAT CLOCK — and puts var (step-hold), linvar, sinvar and expvar side by side with what per-value durations actually do. And a new lesson 10, Lists, vars & Pvar, covers the one people miss: a Pvar\'s values are whole PATTERNS, so the clock chooses which phrase is live while the player keeps stepping through it — a LIST changes the note, a VAR changes a number over time, a PVAR changes the entire phrase over time. That is one lesson longer, so the tour grew again and every internal cross-reference was renumbered with it. The same material is on the Patterns page as a new opening section, The logic — steps, brackets & time, which is the mental model written down once: one playhead per player, lists of unequal length as polymeter rather than as a mistake, the four brackets meaning the same thing in a play() string and in a degree list, the two clocks, Pvar as the third kind, and the closing rule that there are no special slots — every argument takes any of them, nested in any combination.',
        'Fixed: one blown-up feedback loop could silence the WHOLE mix until you reloaded the page. The master node has always ended in Sanitize — a NaN or infinity reaching the audio device kills the AudioContext outright — but it sits at the tail, downstream of everything, and it replaces bad samples with ZERO. So a single NaN produced anywhere upstream (an extreme comp or drive value, a division that ran away, a feedback path pushed past unity) landing in fbdelay\'s or pong\'s LocalIn/LocalOut loop would circulate forever, poison the summed bus every block, and be dutifully sanitised to silence — every track dead, and re-running the lines no help at all, because the FX node holding the poison persists across re-evaluations. Only the top bar\'s RELOAD (softReload()) or a page refresh cleared it, which is exactly what it looked like from the outside: lines evaluate, players show as active, no sound. Two guards, at the two right places. The feedback effects now Sanitize what comes back out of LocalIn, so a bad sample is flushed on the next block instead of latching — the delay recovers on its own, with no reset. And fd_fx_out, the tail node every player\'s private bus passes through on its way to the main output, Sanitizes there too, so a player that does blow up silences ITSELF rather than the room. Rebuild note: this changes fd_fx_fbdelay, fd_fx_pong and fd_fx_out, so it needs the compiled synthdefs from this release.',
        'The guided tour is 44 lessons — the new work is taught, not just shipped. Lesson 43, "Buffers — a blank canvas beside your set", is a new one you can actually do: run a player in the set, press +, watch it keep playing in an empty buffer, write over the top of it. Lesson 19 picks up rec midi next to rec code and rec audio, with midi_rec() as a runnable line, and lesson 29\'s shortcut sheet gains Ctrl+Alt+N and Alt+1 … Alt+9. All five languages, because a tutorial that is current in English and stale in Japanese is worse than one that is stale in both. Writing it turned up a bug the lesson would have walked straight into: the tour renders with editor.setValue(), which writes to whatever buffer is showing, so evaluating next() from a scratch canvas dropped the next lesson on top of whatever you were drafting there. The tour now pins the buffer it was started in and comes back to it before it writes — which is the same rule #@ arrangements follow. And with the top bar reading in words, the tour stops naming buttons by an icon that is no longer on them: MIX, SHARE, GO LIVE, GALAXY, EXAMPLES and DOCS are spelled out, in every language, with the monospace columns rebuilt rather than patched so nothing drifts out of alignment. The Workflow page gains a Buffers section and a rec midi paragraph, and the visuals docs stop pointing at a toolbar button that has been hidden for several releases — that window opens by itself the moment you run a video player.',
        'The top bar is words now — TOUR · BOOT · LOAD KIT · RUN · STOP · RELOAD · MIX · PARTS · MODULAR · SHARE · GO LIVE · GALAXY · EXAMPLES · DOCS · SPLIT · ZEN — uppercase, and with no icons at all. It had grown into three vocabularies at once: words (tour, boot, parts), emoji (♪ 🎚 🎛 ⤴ 👥 ☰ 🌌) and bare geometric glyphs (▶ ■ ↻ ? ⬓ ⛶), so every button had to be learned on its own terms and six of them said nothing whatsoever until you hovered for the tooltip — ⬓ and ⛶ in particular are not things anyone reads. One row of same-shaped words scans as a menu instead of as a row of guesses. The caps are done in CSS rather than typed into the markup, so the labels a button rewrites for itself — booting…, kit 3/12, retry boot — come out in the same voice without the code that sets them knowing anything about it. What this costs is the phone: there is no glyph-only fallback to shrink to any more, so instead the labels get smaller and the app title, the synth status and the rarely-reached RELOAD / SPLIT / ZEN drop out, and the bar takes three rows where it used to take two. That is the honest price of words over pictures, and it buys a bar you can read at a glance on the machine you actually perform on. Two buttons were previously named in the docs by their glyph rather than by a word — the ? button and the caret on examples ▾ — so the welcome text and the tour\'s "where to go next" list are rewritten, in all five languages, to name them as DOCS and EXAMPLES.',
        'A blank canvas next to your set — editor tabs, so you can write something from scratch without touching what is playing. Tab 1 is the SET: the buffer examples load into, the one ⤴ share encodes, the one 👥 go live seeds a room with, and — in a session — the one everybody is typing in. The + button (Ctrl+Alt+N) opens a scratch buffer beside it; Alt+1 … Alt+9 switch, double-click a tab to rename it, × closes it. Scratch buffers are yours alone: never shared, never seeded into a room, never carried in a #c= link — they just persist so they survive a refresh. The AUDIO engine is not per-buffer, though, and that is the point: a player you start in a scratch tab keeps playing when you switch back, so you audition there and paste the line over once it works. It is one CodeMirror with several documents rather than a second editor, so everything already wired to the editor follows the buffer on screen — Ctrl+Enter, the live gutter, autocomplete, the drag-a-number knobs, the var needles, the tour. Two things quietly assumed there was only ever one buffer, and both are fixed rather than fenced off. A running #@ arrangement tracks its sections by line, and the auto-advance looked for the next #@ in whatever was ON SCREEN — switching tabs mid-set would have sent it hunting for parts in a blank canvas and the set would simply have stopped advancing; an arrangement now PINS the buffer it was launched from and keeps reading it wherever you are, and Ctrl+Alt+P brings that buffer back before jumping to the active part. And in a session Yjs binds to ONE document: leaving the set attached while a scratch buffer was showing would have written the room\'s edits into your scratch. Text sync is suspended while you are away and re-reads the room when you return, so you come back to the room\'s current state rather than to a stale snapshot — the shared document never stops receiving, only the editor stops mirroring it. Which makes a jam a reasonable place to work an idea up before anyone else hears it.',
        'rec midi writes out the take as a Standard MIDI File, one track per player — open it in a DAW and edit the parts as notes. Press rec midi (or evaluate midi_rec()), play your set, press it again: a .mid downloads. Each track carries its player\'s name. play() players are drums and land on General MIDI channel 10 with their chars mapped to real percussion — x/X kick, o/O snare, * clap, - closed hat, = open hat, ~ ride, # crash, t toms, s shaker, + claves — while synths and midiout() players each take their own melodic channel. Note length follows sus; velocity follows amp, the player\'s amplify (so a muted or dropped player exports nothing) and its mixer fader — but deliberately NOT the master fader, which is your monitoring level rather than part of the piece, so pulling the master down does not save you a quiet take. The important choice is that it RECORDS rather than renders. Half of what makes a set is not in the text: PRand, a {a b} pick, .degrade, a chaos() line, a knob you nudged on the way past. Reading the patterns offline would hand you the score of a performance nobody played — so this taps the note stream the scheduler actually produces, on the same branch that fires the note, which means rests, degraded steps, silenced players and out-of-range degrees are already gone before it sees anything. What you heard is what lands in the file. Timing is kept in beats and written at 480 ticks per quarter, so the take arrives exactly as played, down to strums, stutter rolls and sub-beat delay; midi_save("myset", 1/16) snaps the onsets to a grid instead, and names the file. Notes are then cleaned up the way a DAW needs them: one still held when the same pitch restarts is clipped to the new onset, so a retrigger reads as a retrigger rather than as a hung note. Two things worth knowing. The file carries a SINGLE tempo — the clock\'s bpm — so a set that ramps its tempo still has every note on the right beat, but plays back at one speed until you draw the ramp in yourself. And drums export even when the sample kit was never loaded: a char with no WAV makes no sound, but the pattern is still the one you wrote, and it is exactly what you want in a DAW where the drums are going to be yours anyway. midi_map("K", 36) re-points a char at any GM note; chars with no known drum role are spread across the percussion range so they stay distinct lanes instead of all collapsing onto the kick.',
    ] },
    { v: 'beta11', title: 'Multiplayer performs together · hiss (unified noise) · 5 new voices + tape/bitcrush FX', items: [
        'The modular panel is playable now — every value is a knob you DRAG, and \u25b6 plays the patch without leaving it. A modular synth is an instrument you find by ear, and the panel had no way to search: each value was a typed number field, so exploring a filter meant typing 800, listening, typing 1200, listening. Every one of them drags now — pull up or down to sweep, Shift for fine, double-click to type an exact number, right-click to reset to the block default. Each knob carries a bar showing where the value sits in its own range, so you can see a cutoff is near the bottom of its travel without reading the number. The ranges are per port and chosen by ear rather than shared: frequencies and times are LOGARITHMIC, because a linear 20 Hz-20 kHz sweep spends nine tenths of the gesture above 2 kHz and is useless for finding 400. The signal inlets and the Number block have no fixed range at all — what is sensible depends entirely on what they are wired into — so those drag by PROPORTION instead, which feels the same at 0.5 and at 4400, and adds rather than multiplies so a value can cross zero instead of being trapped by its own sign. A typed value is never clamped to the range: the range is there to make the gesture useful, not to forbid a number the patch might genuinely want. And since live mode already re-compiles on every edit, \u25b6 (or Space, with the canvas focused) fires a test note through the current patch — defining it first if you have not yet — so a drag and the sound it makes are finally the same gesture. Alongside it: selection, undo, and keys. Click a block to select, Shift+click or Shift+drag on empty canvas to lasso several (plain drag still pans, which is the move you make constantly once zoomed in). Delete removes the selection, Ctrl+D duplicates it — with the wires that run BETWEEN the copied blocks, so duplicating a filter and its envelope gives you a working pair rather than two loose blocks — arrows nudge, Escape cancels a wire drag. Ctrl+Z and Ctrl+Shift+Z undo and redo every graph edit there is: add, delete, wire, unwire, move, knob, role, template, clear, file load. A whole knob sweep is ONE step, however long you take over it, because the knob reports which change BEGAN the gesture rather than the panel guessing from a time window — a window long enough to cover a slow, careful sweep would also swallow the next deliberate edit. The shortcuts are bound to the canvas, which now takes focus, not to the window: the panel floats over your code and is not modal, so a window-level Ctrl+Z would undo a patch edit while you were typing a track. Before this, one stray click on a block\'s \u00d7 lost it for good.',
        'Multiplayer syncs the whole PERFORMANCE now, not just the code — and you can join a jam already in progress. Until this release only text edits, evals, section jumps and eval-level solos crossed the wire; everything you did with your hands stayed on your own machine. Pull a fader down or Alt+X a line and your peers would watch the line grey out while still hearing the track at full level. Mute, solo, track volume, the mixer\'s ■ stop, Alt+X, tempo, the Scale and Root menus, perform mode\'s XY pad and its momentary DROP / STUTTER / GATE / ECHO holds all reach the room now — from whichever way you touch them: a mixer click, a bound MIDI control, a perform-mode tile, the crash panel\'s M/S buttons. Tempo was the sneakiest of them: the clock already told everyone the beat, so the room stayed locked to the same downbeat while running the set at different SPEEDS. Two things it deliberately does NOT share: master volume (that\'s your own monitoring level, not the mix) and plain stop-all (your private escape hatch). For stopping the room on purpose there\'s PANIC — Ctrl+Shift+. , shift-clicking ■ , or panic() — because a jam where anyone can silence everyone by reflex is worse than one where you have to mean it. The mix, tempo, key, pad position and any synth you build in the modular panel are now shared STATE rather than one-off messages, so someone arriving mid-set gets the faders where they actually are instead of the composition\'s text over everyone\'s default mix; per-track keys mean two people riding different faders merge cleanly instead of one clobbering the other. That also closes a real trap: a synth built in the modular panel used to be defined on YOUR machine only while the p1 >> line ▸ use it generates went out to everybody, so peers got a player line for a synth they didn\'t have. Its source travels with it now, live-mode redefinitions included. Still live-only, so still lost on a late join: which section is playing, and eval-level .solo() — both re-arrive the moment anyone runs something.',
        'Dark Chill, Film Score, Virtual Reality and Rise are rebuilt as #@ arrangements, and Padding the Bells is gone — both were written as flat buffers you evaluated top to bottom a few lines at a time, re-running player slots by hand to make them evolve — which is a fine way to work but a poor way to SHIP a piece, because the shape only existed in the instructions. Dark Chill is now twelve parts that advance on their own, from a 92-bpm downtempo groove through full techno, breaking on a frozen reverb and shifting to 124 to filter everything down to nothing. Film Score is four, its keys ostinato phrased by per-step var on both dur and sus so it breathes rather than marches, under cs80 and choir swells on slow sinvar sweeps. Virtual Reality is twenty, a 106-bpm D-minor industrial set where each part evolves the last rather than restating it — .stop(), .oct= and .rate= on players already running, so the arrangement reads as a sequence of MOVES instead of a stack of near-identical lines. Rise is seventeen, climbing from a pads intro into driving techno by pushing one ebass through dist2 in stages. Put the cursor on #@intro and press Ctrl+Enter; the rest follows. Padding the Bells is removed outright, from the examples dropdown, the Examples page and the galaxy.',
        'Boot stops re-downloading two megabytes on every refresh — the dev servers sent no-store on EVERYTHING, which is right for the files you are editing — index.html, js, css should never come from cache while you are working on the app itself — and wrong for the built ones. The 141 compiled synthdefs (620K), the WASM engine (1.4M) and the sample bank change only when a build script runs, and no-store forbids the browser from keeping them at all, not even from revalidating, so every refresh fetched the whole lot again before a note could sound. They now get a short max-age with must-revalidate: the browser keeps the bytes and asks whether they are still current, which the server answers with a 304 and no body. Rebuild a synthdef and its timestamp changes, so the next ask returns the new one — nothing goes stale and nothing re-downloads. Worth being exact about what this does NOT fix: scsynth starts with an empty synthdef table, so all 141 still have to be SENT to the engine on every boot. Caching removes the download, not the handover.',
        'A parts panel — build a set by clicking, and stop-all finally stops the picture too. The panel puts the whole examples library in two columns: every block on the left grouped by category with a count of the sections it holds, that block\'s #@ parts on the right, and a filter that matches a part NAME as well as a block name — type rumble and you find the track that contains it without knowing which one that is. Clicking a part writes a SECTION and the attack() line that fills it — #@stab(16) then attack(\'dresdensunlight\', \'stab\', 1) — rather than the borrowed code itself. That is the difference between a clipboard and a composition tool: click four parts and you have a four-section arrangement you can read, reorder and set beat counts on, with the material still living in the tracks it came from until you run it. A repeated part name is numbered, because #@goto resolves to the first match and two sections called stab would quietly shadow each other. Arm ▶ and each new section is run as it is written; off by default, because writing is recoverable and dropping a set into a live mix is not. Separately, a real bug: full stop sometimes left things running. Video players live in the visual language\'s own list rather than the clock\'s, so clearing the clock never touched them and stop-all silenced the audio while the picture carried on — invisible until a set borrows a visuals part, which the new example sets do. A live audiviz meter was missed for the same reason, being a timer rather than a player. Stop everything now means everything.',
        'ascii_gen() and audiviz() — a title card and a level meter, both drawn in your CODE. ascii_gen(\'ACID\', \'shade\') draws a word five rows tall, which is the fastest way to mark where you are in a long scroll, or to put a name up at the start of a set. Eleven styles, all the same glyphs drawn with a different character: block · shade · light · hash · dot · star · plus · slash · dash · wave · wide, the last doubling each cell so the letters read square in a terminal font. Anything it does not know draws a box rather than vanishing, so a typo is visible. audiviz(0) puts a live |||||||| meter on a # comment line and keeps redrawing it in place — 0 is the overall level, 1 bass, 2 mid, 3 treble, and audiviz(false) stops it. It reads the same analyser the visuals use rather than opening a second tap on the audio graph, so the bar and the picture can never disagree. Both land as # comments, which is what makes them usable INSIDE a composition: a comment is inert, so a #@ section can hold a title card and come round to it all night without the drawing ever being evaluated. The card is written once and not redrawn while it is still there — a section re-runs on every pass, and without that guard it would paste itself again each time and grow the file without limit; delete it and it comes back. The meter splits in two, and that split is the whole design: the anchor # audiviz bass is real text, but the BAR is drawn on top of it and never enters the document. Redrawing forty characters twenty times a second into the buffer would put twenty changes a second through the undo history — one Ctrl+Z would step back a fiftieth of a second — and, in a room, twenty updates a second through the shared document, for a reading that is only true on the machine whose audio it measures. Peers see the comment and meter their own sound if they want it. Switching band rewrites the same line rather than stacking anchors, and audiviz(false) takes the line away with it. Ctrl+Space offers the styles and the bands — and now the FUNCTION NAMES too. That menu had a top-level list of commands that had never been extended past the original set, so theme, attack, ascii_gen, audiviz, modular, panic, rules and nine others were documented, several of them with argument menus already written, and reachable only if you already knew the whole name — the completion could not fire because there was nothing to complete to. All eighteen are offered now, audioviz included, since that is the spelling most people reach for first.',
        'The Scale, Root, MIDI-out and Theme dropdowns are actually themed now — they carried the right class and the rule was there, but the rule never reset a select\'s NATIVE appearance — so on most platforms the browser kept drawing its own widget and quietly ignored the background, border and font underneath it, leaving four OS dropdowns sitting in the middle of a skinned panel. Resetting that takes the little arrow away too, so it is redrawn from a pair of gradients in currentColor, which means it follows whatever theme is loaded instead of needing an image per skin. Hover and focus now pick up the accent colour like every other control, and a long scale name truncates rather than spilling out of the panel.',
        'The reference finally covers the app\'s own commands — starting with theme(), which has shipped ten skins since beta01 and was written down nowhere. Alt+I and the docs knew every synth, every FX key, every pattern generator and every player method, but none of the things you actually TYPE at the console, which existed only as comments in the source. All of them are in now: theme · language · panic · softReload · soff · attack · modular · savePatch · loadPatch · defsynth · tour · start_guided_tour · next · back · vbg · lighter · darker · cancelSection · Clock.bpm · Scale.default · Root.default · Server.addFx, the multiplayer set (rules · role · grant · tracks · release), and fperlin, which belonged with the TimeVar family all along. Found by listing the eval scope and subtracting everything already documented: 27 names had no entry anywhere. One is left out on purpose — Pmath, which the transpiler inserts for you and nobody types. Ctrl+Space inside theme() now offers the skins by name, and inside language() the two languages; the theme menu reads the Settings ▸ Theme dropdown at the moment you ask, rather than keeping a copy of the list, so it can never offer a skin the function would reject and it shows the proper labels — paper is Paper & Ink.',
        'attack() now SHOWS you what it fired, and the modular panel can hand you its patch as code — attack(\'dresdensunlight\', \'intro\') pastes that part at the end of your buffer, and a trailing 1 — attack(\'sunsetdribble\', \'middle8\', 1) — plays it as well. Showing is the default because dropping a whole set into a live mix unasked is a bigger thing to do by accident than pasting some text, and the flag is what makes attack usable INSIDE a composition: on a #@ section line it both writes the material in and starts it. Once the material is inline the section simply contains it, so a later pass plays it as ordinary lines and attack() steps aside rather than running it a second time. The paste happens ONCE per block: a #@ section runs again every time the arrangement comes round to it, so a section holding attack(…, 1) would otherwise append the same material on every pass and grow the buffer without limit — pasted blocks are remembered and a repeat call only plays, unless you deleted the text, in which case it comes back. Which means a composition can genuinely pull parts out of OTHER tracks and keep running: a #@ section whose body is attack(\'dresdensunlight\', \'peak\', 1) borrows that peak, writes it into your buffer as a real section you can then edit, and fires it every time your set reaches that point. The autocomplete offers both rows, plain and ▶ play. attack(\'x\', 1) works too — a non-string second argument is read as the flag rather than a part name — a block you cannot read is a black box, and half the reason to call one up is to take it somewhere else. A part keeps its #@ header so what lands is a section you can re-run, jump to and fold, not a loose pile of player lines. The material lands directly UNDER the attack() line that asked for it, so the arrangement and the code it pulls in sit together and read as one thing — the earlier version appended everything to the end of the buffer, which left a row of anonymous sections a long way from the calls that fetched them. Written inline it is JUST the code — no banner, no #@ header. A label naming the source would only repeat the call sitting one line above it, and a header would split the section the call is in and drop a nameless part into the middle of your arrangement. Called from the console instead, with no line to sit under, it appends at the end and there it does carry both: a banner saying which track it came from and the call that fetched it, plus its #@ header so it stands as a section of its own. And the modular builder has a ⇱ show in code button beside Define: the preview pane always showed the compiled body, but that body is a bare closure, not something you can run — this wraps it into a real defsynth(name, params, fn) with every exposed knob spelled out, so the graph becomes ordinary code you can keep with your set, hand-edit past what the block palette can express, or share, since a composition is only text. It pastes without running, because the reason to press it is to look.',
        'Ctrl+Space inside attack() browses the whole library — category, then block, then its sections. Put the cursor between the brackets and the menu unfolds three deep: Live sets · Basics · Patterns & time and so on, each block inside them, and — for the ones that are #@ compositions — every part they contain, so you can fire just the drop without knowing the set had a drop. A block with no parts stays a single row rather than a submenu of one. Picking a part writes the whole call. Typing filters as usual, and if you already know the name, attack(\'showcase\', then Ctrl+Space skips straight to that set\'s sections. The library is read once and cached — asking forty examples for their parts re-parses the examples document forty times, which is not a per-keystroke job. Also fixed from the last round: the linvar / sinvar needle now runs from the START of the first value to the END of the last, instead of beginning mid-number or stopping short of the final digit.',
        'A peer\'s name no longer sits in the middle of your code — it floats under their cursor and fades. The label was rendering INLINE with the line it was on, which is about the worst place to put someone else\'s name while you are reading. The cause was a selector that never matched anything: the editor binding builds the label as a bare div inside the caret and gives it no class at all, while the stylesheet was targeting a class name that does not exist. With no rule applying, the div stayed a block element in normal flow and pushed itself into the code. It is positioned out of the flow now and sits BELOW the caret rather than above — above just moves the problem onto the previous line. It also fades out two seconds after a cursor stops moving: the binding has always asked for that, nothing was listening, so every name stayed up permanently. Names are there while someone is typing and gone while you are reading.',
        'attack() — fire a prepared block mid-set, the move webTroop\'s attack() makes. There it pulls stored code off the FoxDot server; here the library is already sitting in the app, since every bundled example and live set is a runnable buffer. attack() on its own lists what is available, grouped by category. attack(\'dubplate\') fires the whole set. And because most of them are #@ compositions, attack(\'showcase\', \'drop\') fires just that one part — ask for a part that does not exist and it tells you which ones do. Names match on a prefix, so attack(\'dub\') is enough. It RUNS rather than pasting at the cursor: in a shared room pasting moves everyone else\'s lines around, while running touches only the sound — and the code still reaches your peers, because evaluating anything does.',
        'Alt+I knows about chained methods now, and eq3 explains itself — inspecting .unison() used to give nothing at all — the inspector covered synths, FX, patterns and params but not the 35 things you can chain onto a player, which were documented only in the source. All of them are in the reference now: voicing (unison · strum · penta · chroma · gtr · map), rhythm (stutter · multiply · offbeat · human · fill · slider · drummer · degrade), reordering (reverse · mirror · rotate · shuffle · jump · reroll), following another player (follow · accompany), the whole probability family in one entry (always 1 · almostAlways 0.9 · often 0.7 · sometimes 0.5 · rarely 0.25 · almostNever 0.1 · never 0, with a leading number overriding it) plus every and after, and transport (solo · only · stop · once). Separately, eq3 was reported as doing nothing, and it was doing exactly what it was asked: every band defaults to 0 dB, so eq3=1 on its own is a mathematically transparent EQ — wet equals dry. Its description says so now, with an example. Nothing was broken; the knob just needed a second knob.',
        'Fixed: a < > subdivision on its own played one note and silently dropped your parameters — p1 >> saw(<0 4 7>, dur=1, amp=0.3) sounded a single note at the default pitch, with dur and amp ignored. A synth call decides whether its first argument is a degree or an options dict by asking whether it is a plain object — and a subdivision IS a plain object internally, so it was being read as the options, which threw away the real options AND left no degree at all, leaving the player on its default 0. Inside an array it always worked, because there it arrives as a step value rather than as the first argument, which is why [0, 2, <4 4 7>, 7] was fine while <0 4 7> was not. Same fix applied to midiout, which had the identical test. And a play() line now highlights its PARAMS as well as its drum pattern — it used to stop at the pattern and return, so crush={0.3, 0.6, 2} sat dark on a drum line while the identical group on a synth line was boxed. Both branches share one argument scanner now, so anything that lights up on a synth lights up on a drum line too.',
        'One rule for lighting up a line — box what you can pin, box the source when you cannot. Everything that moves on a line now shows it, and shows it the same way. A var or Pvar is step-hold, so the value that is live gets BOXED rather than a sliding needle: a needle would imply a glide that is not happening. That means a Pvar finally shows which whole PATTERN is in charge — with Pvar([PRoman(\'i iv v\'), PRoman(\'ii V I\')], 16) you watch the progression hand over every 16 bars — and a var\'s values no longer have to be numbers, so var([\'major\', \'minor\'], 8) lights up too. It also makes dur=var([6, 2], [4, 2]) legible: you can SEE the box sitting on 6 for four beats and on 2 for two, which is the fastest way to understand why a note grid built from it may never reach the second value. linvar / sinvar / expvar keep the sliding needle, because those really do glide. The sweeping needle also sits ON the numbers now: it used to ride between the BRACKETS, so at value 400 it sat on the [ rather than on the 400 it was describing — moving correctly but visibly out of step with the values. It travels between the written values themselves, positioned from the VALUE rather than from elapsed time, so it follows whatever easing the var uses and you can watch a sinvar lag behind the midpoint. And a P-generator used as an argument — PContour, PRand, PEuclid, PRoman — is boxed as a whole: its values are computed, so no element of any array inside it is the one playing, and pretending otherwise would point at the wrong number. Before this, a line like lapin(PContour([3,7,7],8,7), dur=[1/8, 1]) highlighted its DUR array and nothing else — the one argument that was not making the notes.',
        'Seeing what a line is doing — drum patterns light up at last, and TimeVars slide. Two fixes and a revival. The step highlight only ever recognised QUOTED drum patterns, so play(x.x.x.) — the documented style, and what every bundled example and live set uses — never lit up at all while synth lines pulsed away beside it; unquoted patterns now step through exactly like quoted ones, with a [xx] or <xx> group counting as one step so the highlight stays aligned. And the sliding TimeVar readout is back on: a needle glides across a linvar / sinvar / expvar / var\'s [values] array showing where the value sits between its own lowest and highest, so you can read a sweep\'s shape and speed off the line rather than inferring it from what you hear. It was written before and switched off for smearing across the editor; three separate causes, all fixed — it stored a line NUMBER (insert a line above and every needle below drew on the wrong one, so it uses line handles now), it ignored line WRAPPING (an array straddling a wrap has its two ends on different visual rows, and interpolating between them stretched a bar across the whole screen — those are skipped), and it rebuilt only when a player fired a note and was keyed by player NAME, so two players on one line fought over one set of bars. It follows the VIEWPORT now, which also means a var draws while you are still typing it, not only once something plays. Values that are computed rather than written as plain numbers are skipped rather than guessed at.',
        'The editor gutter shows which line is actually playing — a ▶ beside every line that is sounding right now, and a faint ▷ beside a line that DEFINES a live player while a different line is the one you are hearing. That second marker is the useful one. In any #@ arrangement the same player is defined several times, once per part, and editing the copy that is not currently live looks exactly like the app ignoring you; now the two states are visibly different. It reuses the resolution the degree highlight and the .sometimes() flash already use, so the gutter, the highlight and the mixer always agree about which occurrence is live rather than each having an opinion — and it follows a re-evaluation, so running the intro copy of a track moves the ▶ back up to it.',
        'No more click when a composition stops, and TimeVars read at the beat they land on — the pop at #@end and on stop-all was us freeing a player\'s FX chain and recycling its bus the instant it stopped — while a note was still sounding. Voices have no gate: every synthdef ends in an envelope with doneAction 2 and frees ITSELF when that envelope completes, so cutting the bus underneath one stepped the signal to zero mid-waveform, which is exactly what a click is. Loudest with pads, which are at full amplitude with a long release still to run. The teardown now waits for the tail — sized from the voice\'s own sus and release, capped at 8s so a drone cannot hold a bus indefinitely, and superseded if the player restarts first. Nothing new is scheduled while it waits, so the only cost is one recycled bus for one note\'s length. Separately, TimeVars are now sampled at the beat a note actually lands on rather than at clock.now(). Notes are dispatched ~120ms early so the audio thread is never starved, which meant a var read during that window returned its PREVIOUS value whenever a note sat on one of the var\'s own boundaries — audible as a change arriving one note late. Checked against the real FoxDot (FoxDot/lib/TimeVar.py, run headless): var([6,2],[4,2]) holds 6 across beats 0-4 then 2 across 4-6, and webfoxDot now agrees at every reference beat.',
        'Room rules — who controls what, for workshops. Entirely OPTIONAL and off by default: a normal jam is byte-for-byte unchanged and every check answers yes until a host turns rules on. It exists because the shared mixer, tempo and PANIC that make a jam fun make a classroom unrunnable — with fifteen attendees, any one of them can silence the room. The model is CAPABILITIES rather than fixed roles: a role is just a name for a set of switches (run code · mixer · transport · macros · claim) and the host edits any cell live, so \'listener\' does not have to mean powerless — the default listener holds the MIXER and nothing else, which is exactly what you want for whoever is running the PA. Tracks can be owned too: play a track and it is yours, and nobody else\'s line for it will run — not even locally on their own machine, since running it there would silently desync them from the room. The host is whoever opened the room, and can always take a track back. There is a ⚖ room rules panel — the Session box in the right-hand panel, or evaluate rules() — showing the matrix as an actual grid: click a cell to grant or revoke it, a dropdown per person to set their role, and the claimed tracks with a release button. Everyone sees the same table; non-hosts get it read-only, which is the point — you should be able to see the rules you are playing under. Claimed tracks are marked on the MIXER too — the owner\'s name on the channel strip, struck through and dimmed when it is not yours — because a claim you can only see by opening a panel is one nobody notices, and taking a track now says so in the log. The console still works if you prefer typing: rules(true), role(\'ana\', \'listener\'), grant(\'listener\', \'macros\', true), tracks(), release(\'d1\'). Be clear-eyed about what this is: etiquette, not security. The relay forwards without validating and the document is a CRDT, so a modified client can ignore all of it. Two things make it hold up anyway — the gates run on RECEIVE as well as on send, so your machine honours the room no matter what arrives, and identity is the stable user id rather than the display name anyone can retype.',
        { t: 'New Live set — Dresden Sunlight (svdk): driving techno arranged by SUBTRACTION rather than by chord changes. There is about one bar of material in it; everything that happens over the set is a filter opening, a layer arriving, or a layer leaving, so the linvar sweeps run over 32 bars instead of 4 and the whole thing lives on two notes. A hardstab lead with .unison(3), then re-stated with a CHORD as its octave (oct=(5, 4, 6)) to stack the same figure across three registers; a dbass sub running into its own ping-pong feedback; an industrialdrone felt more than heard under the peak; and the classic techno hole — b1.stop() pulls the kick while everything else keeps running. #@goto(peak, 0.6) keeps the back half from resolving the same way twice. In the examples dropdown, the Examples page and the galaxy.', ex: 'dresdensunlight' },
        { t: 'New Live set — Sunset Dribble (svdk): 80s synthpop, and a study in the two things that date that sound instantly — both arrangement choices rather than particular synths. The GATED snare (heavy room, short sus, so the hit is enormous but the reverb is cut off dead instead of blooming) and the sixteenth arpeggio running under everything, doing the job a rhythm guitar does in a rock band: it never stops, it only changes register and opens up. Its sus is a PATTERN in the verse, so the run breathes unevenly instead of machine-gunning. The bass picks up octclean sub/octave doubling, then multiband drive and .unison(3) for the chorus. And the pop instinct throughout is SUBTRACTION — the middle eight is the sparsest section of the song and also the highest, the arp jumping an octave and turning around on updown. In the examples dropdown, the Examples page and the galaxy.', ex: 'sunsetdribble' },
        'The players-panel faders join the mix — and a fader you have touched stops going deaf. The per-track sliders in the right-hand panel were assigning the player\'s level directly instead of going through the mixer, which made that panel a second source of truth: the two desks showed different numbers for one track, launching a track re-applied the mixer\'s value over whatever you had set in the panel, and none of it reached the room. They go through the same door as the mixer now. Separately, every live control (both sets of faders, the master, the BPM field) refreshed itself only when it was not the focused element — but a slider KEEPS focus after you let go of it, so the first fader you touched quietly stopped updating for the rest of the session. On your own that was a stale number after a ~reset; in a jam it read as \'the faders do not sync\', because the fader you are watching is the one you last touched and it is frozen while the audio follows the room perfectly. Controls now track whether you are actually holding them (pointer down, or a keystroke a moment ago) rather than whether they hold focus.',
        'The players panel\'s ■ stops the track for the room too — and un-soloing no longer leaves everything else silent. That button was the last unsynced control on the panel; it stays IMMEDIATE rather than bar-quantised like the mixer\'s ■, since that is the point of it. Fixing it turned up an older bug underneath: stopping a track drops its mute/solo, and that path deleted the flags without recomputing the gate — so hitting ■ on the only SOLOED track left every other player silenced until something unrelated happened to recompute. It also has to clear the shared flags now, or the room (and anyone joining later) would still believe a stopped track was muted.',
        'A session that drops now says so, reconnects, and stops hiding failures — the eval relay opened one WebSocket and never reopened it, while the document connection reconnects on its own — so after any blip (wifi, a sleeping laptop, a server restart) a jam went on LOOKING perfectly healthy, text still syncing and cursors still moving, while every eval, every beat sync and every action silently reached nobody in both directions. It reconnects with backoff now, and the peers panel goes red with ⚠ relay offline for as long as it is down, because the dangerous part was never the outage, it was not knowing. Nothing is queued while you are disconnected: replaying a backlog of evals minutes late is worse than not sending them. When a peer CANNOT run something you sent — a synth you built and they do not have, a sample kit they never loaded — the error used to land in their console and nowhere else, leaving you the only person in the room who thought it worked; it comes back to you now, named. And peers finally honour the beat an eval was made on: that timestamp has always been sent and always been discarded, so when a sender\'s clock ran ahead their changes landed EARLY on everyone else. A change that arrives late still runs at once (there is no going back), but the room now tells you when it is drifting instead of just sounding loose.',
        'spicebass / spiceseq / spicepad / spicelead — Berlin-School analog voices for the Dune / Stéphane Picq "Spice Opera" palette (Picq\'s own brief: "sandy, crispy, grainy sounds, and deep basses and sequences à la Tangerine Dream"). spicebass is a deep warm detuned-saw + sub bass through a MoogFF ladder with analog drift; spiceseq is the signature pulsing sequencer voice — a resonant ladder with a snappy per-note filter envelope so every 16th "pings" (pair it with pong= for the classic ping-pong bounce, and accent= to open the filter on hit steps); spicepad is a lush evolving 6-saw pad with a breath of airy grain; spicelead is a dark, hollow, breathy ney/duduk reed (triangle + narrow pulse, band-limited — the real record has almost no energy above 2.5kHz) with vibrato + portamento. Tuned against a spectral analysis of the original CD tracks (which are ~85% sub+bass).',
        'opl2 / oplbell / opldrone — OPL2/AdLib-style FM synths, Dune-soundtrack-inspired. opl2 is a 2-operator engine with a genuinely self-feedback modulator (SinOscFB, not just a fixed phase depth) that blends continuously between FM (alg=0) and additive (alg=1) — the two "connection" modes the real chip\'s channels could pick — plus its own modulator brightness envelope (mdec/msus) independent of the amp envelope (the "bright attack, duller sustain" FM voices are known for), and keyscale, which dulls and speeds up higher notes like the real chip\'s key-scale-level/-rate. oplbell reuses the same feedback-FM core tuned for an inharmonic non-integer ratio + a fast-decaying brightness envelope — bell/mallet hits for melodic percussion. opldrone stacks 3 detuned FM voices + a sine sub under heavy feedback and slow vibrato drift for an atmospheric sub-rumble pad, meant to sit under a lead.',
        'The modular synth builder is back on the toolbar — the 🎛 modular button is visible again after a spell hidden behind an eval-only entry point. Evaluating modular() still opens and closes the same panel, for when your hands are already on the keyboard.',
        'Modular synth builder: live editing + a Mini Moog. Define (or ▸ use it) now flips on a ⚡ live badge — every graph edit from then on auto-redefines that synth (debounced), same as editing a hand-typed defsynth() and re-running it; click the badge to pause/resume. ▸ use it itself now pastes AND runs the p1 >> line instead of just pasting it. Two new blocks close a real gap found while porting synths last round: Env Gen (a raw, unfused control-rate envelope — wire it into a Filter\'s cutoff for a classic separate filter-EG sweep, since Envelope\'s own EnvGen is fused with the audio it shapes) and Glide (Lag-based portamento). Together with Distortion/tanh and ADSR from before, they\'re enough for a genuinely "authentic, all parameters" Mini Moog template — 3 individually-tuned-and-leveled oscillators + noise (the real mixer panel), glide, a filter whose cutoff is base-knob + contour-EG-amount + keyboard-tracking (same 3-way sum the real hardware does), separate amp ADSR: p1 >> minimoog(cutoff=500, emphasis=0.3, osc1Vol=1, osc2Vol=0.8, osc2Tune=1.0059, osc3Range=0.5, glideTime=0.03, filterContour=3000, filterTracking=0.3, …). The filter is RLPF (2-pole) standing in for the real 4-pole Moog ladder — not in js/scsynth/ugens.js, and unverified whether it\'s even in this app\'s WASM scsynth build, so not added speculatively. The templates ▾ menu is grouped into Basics / Bass & Percussion / Leads & Pads / Ported synths now that it\'s grown past a flat list, and the toolbar\'s 🧩 became 🎛 (was colliding visually with nothing in particular, just felt off — 🎚 was already "mix", 🎛 reads as "synth controls").',
        'Modular synth builder: real distortion + ADSR, ported from the hand-written voices. Went through synthdefs/src/synths/*.scd to see what porting a real synth into the block palette actually needs — the single biggest gap was tanh soft-saturation (war/dab/growl/tekno/guitar all end their drive stage in it), so it\'s a real UGen unary op now (js/scsynth/synthdef.js\'s UNOP table), with a new Distortion block matching the exact "dist" convention. Envelope gained a 3rd shape, adsr (attack/decay/sustain-level/release), for voices perc/linen can\'t express. Two new templates PORT real synths onto the current block set — "War (ported)" (3 detuned saws → distortion → resonant filter) and "Growl (ported)" (vibrato + fast ring-mod + drive) — both close approximations of the real fd_war/fd_growl voices. Also added LeakDC (a cheap DC-blocking safety net after heavy waveshaping). Known gap this surfaced and didn\'t try to close: true feedback/physical-modeling techniques (Pluck, CombN comb-delay, Moog ladder filters, parametric EQ, envelope-followers/compressors) aren\'t portable yet — they need new UGens in js/scsynth/ugens.js (straightforward, same ugen() factory pattern) or, for actual audio-domain feedback loops, relaxing the modular graph\'s cycle rejection specifically for delay-broken loops (a real ARCHITECTURE change, not just a new block).',
        'Modular synth builder now speaks the same parameter language as the built-in synths. An unwired knob used to generate as an opaque n2_cutoff unless you manually tagged it — now it\'s named after its own port by default: a Filter\'s cutoff/rq ports generate p1 >> mypatch(cutoff=2000, rq=0.3) straight away, matching the exact cutoff/rq/rate/dist convention every hand-written synth in the app already uses. Two DIFFERENT untagged knobs that happen to share a port name (two Filters, say) auto-disambiguate (cutoff, cutoff2) instead of silently merging — turning one never secretly retunes the other; the dropdown still lets you rename a knob or deliberately unify two under one shared name by hand. Output gained a wireable pan port (defaults to the standard pan control, same as before, but wire an LFO in through a Scale and the sound auto-pans — new "Auto-pan lead" template shows it), and Envelope\'s attack/release are real ports now too — untagged they still read the note\'s own attack/release like every synth, but a multi-voice patch can give one Envelope its own independent timing. Beep and Detuned pad now track the played note/degree by default (they didn\'t before — every note sounded the same fixed pitch).',
        'Modular synth builder: 3 new blocks + knob roles + starter templates. Impulse (a click train — excite a resonant filter for zaps/percussion), Ramp (a Line/XLine sweep — pitch drops, filter sweeps) and Clip (soft-limit a signal, basic waveshaping) join the palette (13 blocks now), plus more Oscillator waves (varsaw, blip), a Filter resonant-highpass mode, and 2 more LFO shapes (stepped, smooth). Any unwired knob (an input port, or a Number block\'s value) can be tagged with a semantic role via a dropdown — auto/freq/amp/rate/custom — so it generates as a mnemonic param (p1 >> mypatch(freq=880)) instead of the auto n2_cutoff name; two knobs tagged with the same role deliberately share one param, and tagging a knob out/note/amp/sus/pan/attack/release reuses that built-in control directly instead of adding a new one. A "templates ▾" menu (Beep, Buzz lead, Wobble bass, Detuned pad, Noise click, Zap, Kick drum) drops in a ready-made patch to start from and rewire rather than an empty canvas. Also: a real bug fix — a 2nd Output block used to silently vanish from the compiled synth (only the last one played); both now correctly mix together (with a heads-up, since that can clip). And a perf fix — dragging blocks used to leak a pair of window-level listeners on every add/wire/move, one set per block per redraw, that never got cleaned up for the life of the page; now exactly one shared pair for the whole panel.',
        'Modular synth builder (🎛 toolbar button) — drag Oscillator/Noise/Filter/Envelope/LFO/Mix/Scale/Output blocks onto a canvas and wire them with cables instead of typing a defsynth() closure by hand. The code-preview pane always shows the exact source about to compile (generate text first, then run that same text through defsynth() — no separate path that could drift from what\'s shown), so Define registers a real playable synth (p1 >> mypatch([0,4,7])) through the same pipeline every hand-written synth uses. Unwired inputs become live, tweakable params (mypatch(cutoff=2000)); patches auto-save to localStorage and can be saved/loaded as .json (panel buttons or savePatch() / loadPatch(url) from the eval scope).',
        'The guided tour has real visual hierarchy now instead of reading as one flat wall of commented monospace: each lesson\'s 🎓 header gets a banner (bold, tinted background), and ▶ runnable examples get a left-accent callout block spanning the description + the code line(s) below it — so they visually pop out of the surrounding prose. (The footer\'s "▶ evaluate next()…" nav hint reuses the same ▶ glyph but isn\'t a runnable example, so it\'s deliberately excluded — only decorated if real code actually follows.) Also: evaluating ANY line (Ctrl+Enter, not just in the tour) now gets a brief green pulse on top of the existing flash, so running something reads as a small reward instead of just a color blip.',
        'Alt+M — put the cursor on a number (p1 >> pluck(cutoff=800, ...)) and press Alt+M: it rewrites that number into mlearn(...) itself (bounds guessed from the value — 0..1 stays normalised, negatives stay signed and symmetric, anything else gets 4× headroom) and runs the line for you. Wiggle a knob/fader next and it latches on — no retyping the assignment by hand. Documented in tour lesson 25 (MIDI) alongside the existing p1.lpf = mlearn(200, 8000) / midi(74, 200, 8000) forms, and listed in lesson 28 (shortcuts).',
        'Tour lesson 6 (drums with play()) now actually demonstrates [a b] alternation instead of just naming it — d1 >> play("x[xo]") — after the first draft of that example turned out to alternate x/rest/o instead of x/o (a space inside brackets is itself a rest token; fixed to no-space [xo]).',
        'hiss — one unified noise generator. type picks the color, and takes a string OR an int (both work, e.g. hiss(type="pink") and hiss(type=1) are identical): white · pink · brown · gray · crackle · dust · lfnoise (stepped/zippery). Shared cutoff/rq filtering, plus per-type extras — chaos (crackle), density (dust), rate (lfnoise). Under the hood this introduces a general enums mechanism on the synth registry, so any future synth can take a named-option param the same way patterns already do (arp\'s mode, PProg\'s name…). (Named hiss, not noise — noise was already taken by the video scene of the same name; audio synths and video scenes share one eval-context namespace, and the collision silently no-op\'d until caught.)',
        '5 more CrashServer-rig ports — fbass, sawbass, marimba synths, plus tape and bitcrush FX. fbass (Karplus-Strong comb-filter exciter bass, credit Josh Mitchell), sawbass (detuned saw stack through a filter-envelope sweep + a Padé waveshaper) and marimba (Klank resonator mallet hit over a noise exciter) join the synth list. tape (compand, drive/wobble, cubic warmth, shelving saturation; tapedrive/tapewarm/tapewobble) and bitcrush (true Decimator-based bit/sample-rate reduction; bcbits/bcrate, a distinct character from crush\'s Latch-based quantizer — both are kept side by side) join the FX.',
        'Running a player before boot now tells you why instead of silently doing nothing. p1 >> pluck(...) before clicking ▸ boot used to just make no sound with no clue why the engine wasn\'t there yet; it now logs "boot audio first (top-left)", matching what son()/load kit already did. MIDI-out calls are unaffected (they don\'t need the audio engine).',
        'Fixed the examples ▾ dropdown running off-screen when the toolbar wraps onto two lines on a narrow window. It only guarded against overflowing the right edge, so a button near the left edge on a wrapped toolbar could push the whole panel into negative coordinates; now clamped to both sides.',
        'New Live set — Celeste (svdk): a bright major #@ set built on an inline defsynth — a shimmering additive celeste (sine partials + a faint 4.2× inharmonic shimmer) played as two hard-panned voices detuned by dur=1/3 * 1.012 for a chorus beat, over a PGrowArp organ, a darkpad progression and a deep sine bass, the key floating through var(["major", "lydian", "mixolydian"]). In the examples dropdown + Examples page.',
        '16 new synths ported from CrashServer FoxDot (stock-UGen reimplementations, all audible). Industrial/gritty: tekno · dirt · doom · industrialdrone · glitchbass · hardstab · industrialsnare · crunch. Bass: lbass · wob · acidline · superbass. Leads: darklead · virus. Pads: gaze · waves. Their character knobs follow the house convention (cutoff / rq / dist — never an FX-key name).',
        'chaos() gained an INDUSTRIAL style (doom/glitch bass, tekno/hardstab leads, clipped drones + brutal snares, heavy crush/fold), and the new voices are woven into the punk/techno/ambient pools too.',
        'chaos() writes more varied, less repetitive patterns — durations draw from a much wider palette (51 distinct values, no single one dominating), and degree/duration lists now NEST generator functions among the notes: [0, arp([0,4,7], "up"), (2,5), PWalk(3,1)] or dur=[1/4, PDur(3,8), 1/2]. Plus richer tuplets, polymeter and role-aware sus shaping.',
        'Fixed PStep(n, value, default) with pattern arguments — PStep(4, {5,6,7}, {6,4,3}) now resolves its value/default per step (they were returned raw, so a {…}/pattern arg came back unresolved).',
        'Fixed random patterns in VIDEO params — mosaic(cells=PRand(8), dur=2) now re-rolls every 2 beats, not every frame. A non-deterministic pattern (PRand/PWhite/PxRand) is sampled once per dur-step and held (like a player advancing its pattern) instead of re-randomising at the render frame rate; deterministic patterns, arrays and TimeVars are unaffected.',
        'New video scene — mosaic: the fully-parametric TEMPLATE synth. A cheap, DETERMINISTIC grid of colour cells that light up on the pattern you choose — nothing random beyond your control (a seedable hash, not Math.random, so the same params always give the same picture). 8 knobs: cells (cols), rows (0=square), fill (0..1 lit), shift (slide the lit set), mode (0 scatter · 1 columns · 2 rows · 3 checker · 4 radial · 5 diagonal), seed, gap (cell inset), react (audio pulse) — each cell takes its own palette colour so pal()/hue() recolour the grid. e.g. video1 >> mosaic(cells=12, mode=4, fill=linvar([0.2,0.6],16), react=0.8). Under the hood the per-layer scene-param budget doubled 4→8 (a second pp2 vec4), so every future scene can be this parametric. 49 scenes now.',
        'The toolbar ▦ visuals button is hidden for now — the visuals still open automatically the moment you run a videoN >> line (or call openVisuals()), and vbg() runs them behind the editor.',
        'Visuals-background polish: vbg() no longer persists — the editor background is OFF every session and only appears when you toggle it (opening the visuals pop-out never turns it on by itself). And mosaic now animates over time at any fill — each lit cell twinkles on a deterministic per-cell phase scaled by speed, so mosaic(fill=1) still lives (and speed=0 freezes it to a still). fill stays a 0..1 fraction (fill=1 or 3 = every cell lit); modes are 0–5 (an out-of-range mode falls back to scatter); dur only affects pattern-valued params — speed is the animation rate.',
        'Visuals as an editor BACKGROUND — vbg() (or Shift+Alt+B) runs the WebGL2 video engine live behind your code, not just in the pop-out window. Start any video layer (video1 >> plasma() …) and toggle it on; the code gets a theme-tinted scrim for readability and the visuals dim underneath. It reuses the exact renderer + reads the audio/clock directly in-page (no pop-out needed), and the on/off state persists.',
        'Code-audit pass — a batch of fixes. Subtraction transpose works now (p1 >> saw([0]) - 2 drops the degree, matching FoxDot). The distortion knob is dist everywhere (war/dab/fuzz/guitar were drive/beef, which silently shadowed the tanh FX; hardstab’s comp → squash, gaze’s shimmer → glow), so dist= actually applies on those voices. The diminished scale is now the half-whole octatonic (matches FoxDot). midiout([0, _, 2]) no longer crashes on a rest. Standalone live-tweaks p1.strum()/multiply()/map()/drummer()/chroma()/gtr() no longer throw. A string arg containing a bracket or comma (sample="]") no longer corrupts the line. The dead clouds FX (silent MiClouds) was removed; the offline PWA manifest now caches the visuals renderer.',
    ] },
    { v: 'beta10', title: 'Visuals — a clean 2-channel mixer', items: [
        'Rock / punk grit. Five gritty synths ported from the CrashServer set (stock-UGen reimplementations): war (a power-chord riff machine — detuned saws through heavy tanh drive, play [0,-5,-7] with short sus for palm-muted chug), dab (dirty overdriven bass), fuzz (raw aliased fuzz lead), growl (ring-mod bass-lead) and guitar (Karplus-Strong electric guitar → overdrive → amp-sim). And chaos()/son() no longer only do the 80s: each block now picks a coherent STYLE — punk, techno, synthwave, ambient or the broad eclectic default — biasing the synth pool, scale (minor/phrygian/blues for punk…), degrees (power chords + pentatonic), rhythm (driving chug), register and FX (crush/dist/gate). No new argument — it just lands somewhere different each time.',
        'The pop-out visuals window (▦ visuals) is rebuilt from scratch as a proper A/B video mixer. Video players are named video1, video2, … (the video prefix is the convention) — video1 >> plasma() layers deck A, video2 >> tunnel(ch=1) layers deck B, and video9 >> mix(x) crossfades A↔B (x = 0…1, and x can be a linvar/pattern) with a blend mode (mix · add · screen · multiply · difference · wipe · dissolve). palette("fire") sets the colour ramp, vmode("shade") the look.',
        'The fix for the old overlap/blend mess: mixing now happens in FIELD space (each scene is a scalar field 0…1) and the result is colourised ONCE. So stacking layers on a deck combines by field-max — bright structure wins, never blowing out to white — and the A↔B crossfade is one coherent value blend instead of canvas-compositing guesswork. Each deck can carry its own palette; render as smooth blocks or a glyph ramp.',
        'Under the hood it\'s modular, not a monolith: a tiny engine (grid · compositor · palette · blends · draw · postfx) plus one file per scene behind a registry — adding a scene is a new file + one import, and a WebGL backend later only touches the draw step. Ships with 48 scenes — plasma tunnel wave rain spiral cells starfield nebula moire bars grid ripple fire aurora kaleido warp metaballs hexgrid checker swarm flow contour voronoi helix mandala lattice truchet noise rings spectrum marble, plus testpattern interference biomech escher circuit panopticon penrose mobius hexdump lissajous ikedaglitch, plus the spectrum scenes barcode equalizer datamatrix, plus tron butterfly lightning, adapted from the stars / CLIFT project — all audio-reactive. Every scene also gets universal knobs for free (coords zoom/rot/panx/pany, value bright/gain/contrast/inv), and [] {} patterns / TimeVars work in visual params just like audio. Rendering isn\'t ASCII-first: smooth (interpolated) is the default look, with pixel + the glyph ramps via vmode(). See the "Visuals — scenes, FX & the mixer" example for absolutely everything in one runnable set.',
        'Now GPU-rendered (WebGL2). Every scene is evaluated per-PIXEL at native resolution instead of a coarse upscaled grid — sharp instead of blurry, and the heavy per-pixel work runs on the GPU, so it stays smooth even on a phone. One static shader holds all 48 scenes (layers/params/palette/crossfader are uniforms → no recompile while you code), feedback trails are real FBO ping-pong, and the FX run on the GPU too. Like synth FX, scenes chain FX with + — trails, feedback (zooming echo), blur, bloom (glow), scan, vignette, glitch, invert, posterize — and these are only offered in autocomplete for video players. Glyph modes and any browser without WebGL2 fall back to the CPU renderer automatically. New clear() blanks the video — stops every layer + the crossfader and wipes the buffer (or press [c] in the visuals window). pal and blend now take a 0-based INDEX as well as a name (pal=7, blend=2), so [] {} patterns and TimeVars can drive them. New vres(scale) sets the GPU render resolution (multiplier of CSS pixels: 1 native, 0.5 half for weaker machines, 2 supersampled) — audio always has priority, so dropping resolution keeps the sound smooth. Naming convention for video: a player named video1, video2, … gets the VIDEO vocabulary in autocomplete (scenes, mix, fx — each scene pick inserting all its knobs like a synth); every other name (v1, d4, pad, bass, …) gets the music vocabulary. And a video player stops like any other: Alt+X (comment + stop) and .stop() now stop the video layer too.',
        'Eleven scenes + six FX adapted from the stars / CLIFT project — the Ryoji-Ikeda and glitch aesthetic. Scenes: testpattern (Ikeda data test-card), interference (moving-source moire), biomech (Giger spine + ribs), escher (impossible rotating stairs), circuit (traces + nodes + traveling pulses), panopticon (radial surveillance eyes), penrose (impossible triangle), mobius (Möbius ribbon), hexdump (falling hex rain), lissajous (parametric curve), ikedaglitch (row-corruption datamosh). Post-FX (chain with +, video only): droste (recursive log-spiral zoom), fold (kaleidoscope mirror), hueshift (rotate hue — animate it), dither (Bayer ordered dither, the data-quantise look), pixelsort (bright-run glitch smear), mirror (6-way radial kaleidoscope), edge (Sobel edge-detection outline), pixelate (blocky downsample). The video autocomplete is grouped into "video synths" (scenes) and "fx", and typing <code>+ </code> after a scene on a video line autocompletes the FX (e.g. <code>+ blu</code> → blur/bloom). Each ported field/effect keeps its audio reactivity (bass/mid/treble drive it).',
        'FFT-reactive scenes. The bridge now streams a 32-bin spectrum from the analyser to the renderer (a uSpec[32] uniform), so scenes can read the actual frequency bands — three new ones do: barcode (Ikeda scrolling FFT barcode), equalizer (linear FFT bar graph) and datamatrix (Ikeda cell grid lit by spectrum energy + a scan bar). Play audio and they move to it. 45 scenes now.',
        'Scene-specific params. Beyond the universal knobs, many scenes now expose their own named parameter — spiral(arms=5), tunnel(sectors=12), mandala(petals=16), metaballs/swarm/cells/voronoi(count=), rings(count=), bars(count=), grid(divisions=), moire(lines=), hexgrid(cells=), kaleido(segments=), wave(crest=), lissajous(freqA=,freqB=). Autocomplete inserts a scene\'s own params when you pick it and lists them on Ctrl+Space inside the call. Unset = the old default, so nothing changes unless you ask.',
        'Three more from the stars CUDA layers (48 scenes): tron (a receding neon perspective tunnel — grid lines spiralling into the distance, bass brightens the corridor), butterfly (a mirrored FFT spectrum analyser, both halves from the live spectrum), and lightning (an fbm storm sky pierced by a zig-zag bolt that strikes on a schedule, flickers, and fades).',
    ] },
    { v: 'beta09', title: 'Parameter cleanup — one word per idea', items: [
        'Perform mode (phone) — redesigned for a small screen, no scrolling. The player tiles now FIT the screen: the grid auto-sizes so every track is on screen and one tap away (no more hunting by scroll). Tap = launch / stop, drag up/down = volume, and a LONG-PRESS solos it (shared with the mixer + Players panel — a gold S). The controls are now TABBED — SECTIONS · FX · MACRO — so the space-hungry XY pad only appears on its own tab and the tiles re-fit around whatever\'s open. Plus a tempo beat-dot in the header (accented downbeat), four momentary FX (DROP · STUTTER · GATE · ECHO held to fire), and haptic ticks.',
        'Synth controls are now uniform. Every voice\'s distortion knob is dist — it was spelled distortion / drive / grit / growl / crunch / boost / beef across different synths (8 names for one idea); now it\'s just dist everywhere. Every resonance is rq (was rq / res / resonance), and two stray filter names (filterFreq, pluck_filter) are now cutoff like the rest. Filter-envelope depth is fenv everywhere (was filterEnv), and built-in vibrato is vib (depth) + vibrate (rate) — folding cs80\'s vibdepth / vibspeed in.',
        'Two silent bugs fixed in the process. A synth param named drive used to shadow the tanh saturation FX (unreachable on darkpad / synthbass / a_daftlead), and compkick\'s comp shadowed the compressor FX — both effects are now reachable on every voice. compkick\'s own internal compression moved to squash.',
        'The vocabulary now reads as pairs — cutoff is a synth\'s built-in voice filter, lpf is the post-FX filter; dist is the voice distortion, dist2 is the FX distortion; rq is voice resonance, lpr the FX filter resonance. The FX filter resonances are consistent now — lpr / hpr / bpr (matching mpr, which already used the short form) instead of the old lpf_rq / hpf_rq / bpf_rq. No aliases: the old names are gone (clean break), and every example, lesson and doc is swept to the new spelling.',
    ] },
    { v: 'beta08', title: 'Generative & mixer overhaul — guit audible · chaos evolves every param · live mixer', items: [
        'New theme — Solar Opposites (Settings ▸ Theme, or theme("solar")): complementary contrast — warm solar accents (orange · gold · coral) burning against a cold deep-space teal. The two opposite ends of the colour wheel: high-contrast, punchy, and unlike anything else in the set.',
        'New Live set — The Lake is Green (svdk): a deep evolving #@ set — a stacked-FM faim lead over klank / basic chords, a chaotic cbass (PLorenz) low end, euclidean percussion and layered plaits / organ / synthbass voices, all breathing on Pvar phrase-swaps and TimeVars. In the examples dropdown, the Examples page and the galaxy.',
        'pbuild — the genre can now be an ARRAY or index-pattern, not just a fixed name or index. pbuild(["techno", "house"]) or pbuild([0, 3]) switches genre every bar as the pattern evolves (resolved per bar; the kit rebuilds only when it changes — a static genre is byte-for-byte unchanged). Before, any non-string/number genre silently fell back to techno. Note pbuild bakes a FIXED phrase when the line runs: evolve=N gives an N-bar drifting phrase that then LOOPS — for endless change, re-evaluate or raise evolve. A clock var (var([...])) as genre is sampled once at eval (re-run to advance it), so use an ARRAY for per-bar switching. Reminders: dur is a PLAYER param — play(pbuild("techno", evolve=8), dur=1/16), not dur inside pbuild(...); and layer gates default to ON, so kick=0 mutes and kick=PBin(4) / kick=<1,0> gate (kick=1 is a no-op).',
        'MIDI-learn + audio boot now survive a refresh. Mixer MIDI mappings (faders + action buttons) are remembered and silently rebound on reload. And if audio was running last session, it auto-boots on your first click / keypress and re-loads the sample kit (if you had it), so you don\'t have to hunt for "boot" and "load kit" every time.',
        'guit is audible again — the guitar voice had been ported on top of MiPlaits (a Mutable-Instruments UGen our WASM scsynth doesn\'t ship), so it loaded but produced pure silence. Rebuilt entirely on stock UGens as a Karplus-Strong pluck: two lightly-detuned strings, with tone = string brightness, beef = body drive, mod = vibrato, and decay / fdecay = how long the string rings — a real electric-guitar pluck keeping the exact same parameters.',
        'chaos() and the son() jam bot draw from EVERYTHING again. The four newest synths (varsaw · cbass · klank · svdk) were silently falling through to a generic "lead" role — so cbass, a bass, was generating lead lines up high; they\'re now properly classified (cbass / svdk → bass, varsaw → lead, klank → keys). Degrees gained the pattern families a chaos generator should obviously use: the strange attractors PLorenz / PHenon / PLogistic, the smooth sweeps PSine / PTri / PSaw, and PPing / PDelta contours. The FX palette gained drcomp (the one effect it was missing) plus a chaotic PLorenz filter sweep, and the dead clouds effect was dropped.',
        'chaos() now writes like a person tinkering — EVERY parameter, not just the notes, can be a nested pattern or an evolving TimeVar. Octaves ride a PStep / PxRand / var instead of sitting on one number; amp, filter cutoffs and pan breathe on a sinvar / linvar / PLorenz; lists nest ([0, [4, 7]]) for per-bar alternation; whole phrases swap over time with Pvar([…], 16); and random figures freeze into a repeating slice (melody()[:8], PWhite(0.3,0.5)[:8]). The result evolves and layers instead of being a flat one-shot.',
        'Fixed a transpiler gap — a Python-style slice NESTED inside an array or call (e.g. Pvar([[0,4], melody()[:8]], 16)) was left unconverted and threw a syntax error; only top-level slices like melody()[:8] worked. Nested slices now transpile correctly, so the richer chaos() output (and hand-written code that does the same) runs clean.',
        'Mixer fixes + polish for hand-built compositions: (1) ~player lines (the reset-to-defaults prefix, ~p1 >> …) now register as channels instead of being ignored; (2) parts that share a NAME — two #@intro(8) sections — each get their own source chip now (keyed by line, not name), so a repeated section name no longer collapses to one and the ● playing-marker points at the exact occurrence playing; (3) channels are now ordered the way they appear in your CODE (top-to-bottom, so they group under their #@ parts) instead of alphabetically; (4) each channel has a live LED that lights green while that player is actually playing, so you can see the arrangement breathing at a glance.',
    ] },
    { v: 'beta07', title: 'One bracket vocabulary — { }random ( )chord [ ]array/alt < >subdivide', items: [
        'Brackets now mean the SAME thing in synth patterns AND play() strings: { } random · ( ) chords · [ ] array / alternate · < > subdivision. The change: play() swaps [ ] and < > (so [xo] alternates, <xo> subdivides), and on synths < > becomes SUBDIVISION — a ratchet/flam that crams its notes into one step: p1 >> pluck([0, 2, <4 4 7>, 7]) triplets the third slot; it nests (<0 <4 7>>) and stacks with .stutter. Alternation moves to nested [ ] (which already cycles per bar: [0, [4, 7]] → 0,4,0,7), so nothing is lost. All the examples, the tour and the docs are swept to the new syntax.',
        'Stop / clear now truly stops EVERYTHING — as well as clearing your players it halts the son() jam bot and FREEZES Clock.bpm where it stands, so a tempo linvar or ramp can no longer keep sliding the tempo around after you\'ve stopped the music.',
        'PGroove takes more than a name — as well as dur=PGroove("swing") you can pass an index (PGroove(3)), a var to switch feel over time (PGroove(var([0, 2], 8))) or a per-step list (PGroove([0, 2, 4])). Tour lesson 22 now demonstrates all three, and the mixer lesson is a continuous 4-part set (no #@end) that shows the SOURCE part-picker: launch the same track dry from one part and wet from another. Fixes across lessons 14 / 16 / 24 / 32 too (coherent highlight on every-reverse, soff() emphasis, sane pluck octaves, a cleaner example).',
        'crashDot is open source — licensed GPL-3.0-or-later with a THIRD-PARTY-NOTICES file crediting scsynth / SuperCollider (GPLv3), CodeMirror, Yjs, the Sonic Pi synthdefs and FoxDot, and a public build repo. (The engine is scsynth compiled to WASM, which is GPL — so the sources are now out in the open as the licence requires.)',
    ] },
    { v: 'beta05', title: 'Perform Mode · new synths · parameter-envelope lessons', items: [
        'PERFORM MODE (⊞ perform) — a full-screen, keyboard-free touch surface that turns a phone into a live instrument for a set you authored on desktop (or loaded from a share link / example). TAP a player tile to launch/stop it (bar-quantised), DRAG a tile up/down for its volume, tap a SECTION button to jump the arrangement, and work an XY PAD (X = filter · Y = space/reverb) + a master over everything at once. It drives the same engine as the mixer + the sections sequencer, so it always agrees with your code and the desk. (The idea: stop fighting to type code on a phone — perform the code instead.)',
        'New synths from the CrashServer set (codeBank parity): varsaw (variable-width saw), cbass (compressed dual-osc bass with tanh drive + freq-tracking filter), klank (resonant metallic ring), and svdk (the signature dirty bass/lead — triple saws + harmonics + fat sub + Metal-Zone distortion + stereo drift). All ported from the original SynthDefs.',
        'Mixer — MIDI-learn now covers the BUTTONS, not just the faders. New ⇄MIDI learn-mode + a ◄ / ► part transport in the header: turn learn mode on, click any launch (a track name) / solo / mute / stop / prev-part / next-part control to arm it, then move a hardware control (a pad or button in CC mode) to bind — a "press" is a CC crossing its midpoint. Bound controls show a blue ● + the CC number. So you can trigger patterns, solo/stop tracks, and jump the arrangement entirely from a controller. (Also fixes the source-picker missing "#@ name" parts written with a space.)',
        '.fill() — an instant drum fill on any player: randomises dur to short values and gates amplify in on/off bursts so it stutters in and out. d1 >> play("x-o-").fill() · variants .fill(2)/.fill(3)/.fill(0). And lpr / hpr are now shorthands for lpr / hpr (filter resonance), matching the FoxDot naming.',
        '.slider() — glissando between notes (FoxDot Player.slider port): p1 >> bass([0,3,5]).slider() makes each note pitch-glide. .slider(1) flips the phase, and start also takes a PATTERN or var for per-note control — .slider([0,0,1]) glides every 3rd note, .slider(var([0,1],[6,2])) lets the glide breathe over time. Works on 27 melodic synths (basses, saws, leads, keys, plucks — bass/dbass/cbass/saw/varsaw/ssaw/supersaw/pluck/prophet/organ/tb303/… ) via a control-rate freq-glide baked into their SynthDefs; harmless no-op on synths without it. Zero effect when not used.',
        'The guided tour gains two detailed lessons on PARAMETER ENVELOPES — the "_" suffix that makes any FX param sweep within each note (lpf_=fi(1, 400, 4000) opens the filter on every note). Covers the three shapes (fi fade-in · fo fade-out · fb bounce/wobble), how the note\'s sus gives the shape room, resonance (lpr), the same trick on crush/reverb/chorus/echo/hpf/djf, and the per-note vs clock-synced distinction (lpf_ restarts per note; lpf=fb(...) is one global LFO). Lots of runnable examples.',
    ] },
    { v: 'beta04', title: 'The live mixer · shared solo · mixer tour lesson · mobile zoom fix', items: [
        'Live mixer (experimental, 🎚 mix) — a NON-MODAL floating console (drag it, code while it\'s open) that\'s a clip-launcher + volume desk: a vertical fader per track over a master, plus per-track mute and a bar-quantised STOP. VOLUME is shared per player name (one _mixLevel, read every note, kept separate from amplify so mute/solo/drop can\'t wipe your mix). LAUNCH: tap a track\'s name to evaluate its line and start it on its own — no auto-advance needed. A SOURCE part-picker (auto · a chip per #@ part, ● = the part playing) chooses which part\'s version a launch pulls from, so you can play v1 from part 1, v3 from part 2, v1 from part 4 — building a set by hand. Same fader per track drives the volume in the Players panel too. MIDI: each channel (+ master) has an m button — tap it, move a hardware fader, and that CC drives the channel volume. And the channels the SELECTED source part (re)defines are highlighted, so you see which tracks a launch from that part would fire. (Per-channel VU meters next.)',
        'The mixer gains SOLO — and mute/solo now COOPERATE across every desk. The mixer\'s new S button, the Players panel\'s solo, and eval .solo()/drop()/unsolo() all share ONE owner (a mute+solo gate), so the state is always the same everywhere: solo a track in the mixer and its row lights up in the Players panel; run .solo() in code and both desks follow; and a drop\'s restore re-applies the CURRENT mute/solo instead of blanket un-muting (so a drop can never silently un-mute a track you muted). Volume faders stay independent — they\'re a per-performer monitor mix, kept separate from amplify.',
        'New tour lesson — "The mixer": a hands-on walkthrough of the live desk / clip-launcher — the per-track fader, S / M / ■ stop / MIDI-learn buttons, tap-a-name to LAUNCH a track without autoplay, and the SOURCE part-picker for building a set by hand. (Currently English in every language; per-language translation to follow.)',
        'drop() is more robust — a muted player (during a drop or solo) now spawns NO server nodes at all instead of firing silent ones, so a long or repeated drop can\'t pile nodes up on the audio engine until it stops sounding. Amplitude is still force-restored at every step of the sequence, so sound always comes back.',
        'Mobile fix — no more runaway zoom: the editor auto-zoomed on every tap and after choosing an autocomplete item, because iOS zooms whenever the focused field\'s text is under 16px. The touch editor (and its hidden input) are now 16px, which suppresses the zoom while keeping pinch-to-zoom.',
        'Mobile — a tighter top bar + long-press autocomplete: on a phone the toolbar buttons drop to glyph-only (no more 4–5 wrapped rows), and holding your finger on the editor (long-press) opens the autocomplete menu — the touch equivalent of Ctrl+Space.',
        'New theme — Fiesta 🎉 (Settings ▸ Theme, or theme("fiesta")): the beta 4 celebration skin — a deep aubergine night strung with confetti (magenta ribbon, mint / cyan / gold / coral). Festive and high-contrast, unlike anything else in the set.',
    ] },
    { v: 'beta03', title: 'Phone support — write & perform on mobile', items: [
        'Mobile (Tier 3) — you can now WRITE code on a phone. A scrollable accessory KEY BAR appears above the soft keyboard with the tokens live coding needs (p1 ▸, >>, [ ] ( ), comma, quote, dur=/amp=/oct=, 1/2, #@ …) so you don\'t hunt through keyboard modes; p1 ▸ and >> also pop the context-aware autocomplete (which handles the long synth/param names), and a ⌨ button opens it anywhere. The autocomplete flyout is tap-selectable, and Tier 2\'s drag-to-nudge tunes the numbers — so a full line comes together by tapping + a couple of number drags. The bar pins itself above the keyboard (VisualViewport) and only shows while typing.',
        'Mobile (Tier 2) — perform with touch, no keyboard: DRAG A NUMBER in the editor to nudge it live and re-run the line (touch a number → it\'s a knob, drag up/down; touch anything else = normal editing). The Players panel gained tap-to-MUTE (tap the name — a reversible mute, struck through) and a SOLO button (S) per player; and tapping a #@ part in the Composition panel now JUMPS the arrangement there (runs the section), not just moves the cursor. All work on desktop too. (Builds on Tier 1: the full-width editor + slide-up ☰ panel drawer, and the phone audio-pool/AudioContext-resume fixes.)',
        'Mobile (Tier 1) — the foundation: a full-width editor with a slide-up ☰ drawer for the side panels on narrow screens, plus phone audio fixes (a smaller voice pool sized to the device, and an AudioContext that resumes on tap / when the tab comes back — iOS suspends it on lock/background). Desktop is untouched: the low-RAM voice-pool cap is gated behind a coarse (touch) pointer, so a 4 GB desktop keeps the full pool.',
    ] },
    { v: 'beta02', title: 'Dubplate live set · PChord morphs its chord quality', items: [
        'PChord can now morph its QUALITY over time — the type (2nd arg) accepts a var or pattern, not just a fixed name: PChord(0, var([7,9,6])) walks through a 7th → 9th → 6th (per bar), PChord(0, [7,9,6]) per step. The voice count follows the chord (triad=3 … 13th=7); voices the current chord doesn\'t use fall silent. The root (1st arg) already moved this way — now both do.',
        'New Live set — Dubplate (svdk): a dub-techno #@ set built on a rhodes skank whose chord quality morphs via PChord(0, var([3,7,6],8)), a deep evolving dbass sub, squiz percussion and a pbuild techno engine, unwinding to a frozen-reverb outro. In the examples dropdown, the Examples page, and the galaxy.',
    ] },
    { v: 'beta01', title: 'Beta! · 3 new themes · offline PWA · zoomable galaxy', items: [
        'Three new themes (Settings ▸ Theme): Nova — a cosmic beta-celebration palette (indigo night · gold · aurora-teal · rose); Hacker — pure-black matrix green with a phosphor glow; Brutalist — stark monochrome + one acid-yellow accent, zero rounding and raw blocky borders.',
        'Go offline — crashDot is now a Progressive Web App: install it from your browser (Chrome/Edge: the install icon in the address bar · iPhone/iPad: Share → Add to Home Screen) and it boots and plays with NO connection at all. The engine, every synth/FX, and the examples are cached; load the sample kit once online and it comes offline too. Only live multiplayer + the shared galaxy need a connection — solo coding never does.',
        'Galaxy scales to thousands — jams now sit on a stable spiral (each holds its spot for its lifetime, none overlap, no more central pile-up), and the map is fully zoomable & pannable: scroll to zoom, drag to pan, ⌂ to reset. Labels thin out as you zoom past a crowd and reappear as you zoom in, so a busy galaxy stays readable.',
        'New synth: ikea — CrashServer\'s generative glitch-percussion machine. One note spawns a self-generating texture (glitch bursts, sub sines, noise, a swept bass, snare, a resonant melody). Play it long: p1 >> ikea(dur=8, sus=8). Rebuilt on WASM-safe UGens with musical controls: density, per-layer levels (glitch/noise/bass/tone/snare), bright, harm.',
        'chaos()/son() are far more varied — every synth is now role-classified (nothing silently defaults to "lead"), the FX palette gained the effects it was missing (octclean, squiz, drop, tape echo, csweep, comp…), and the jam bot\'s live mutations went from 9 to ~35 effects. octclean (a clean ±1-octave octaver) is now in the fx autocomplete too.',
        'Fixes — PFDur(3, 8) with bare numbers no longer returns silence; the first Run right after a synth autocomplete now evaluates the whole line instead of the bare "0" placeholder; Alt+I gained info for PEuclidR / PFibMod; and dead pattern tokens that highlighted but didn\'t exist were removed.',
        'The guided tour speaks five languages — English (default), French, German, Spanish and Japanese. Switch it live by evaluating language("fr") / language("de") / language("es") / language("ja") / language("en"); the first lesson lists the others as ready-to-run lines, each with its how-to-evaluate hint written in that language. Only the tour prose is translated — the example CODE stays English, since that\'s the language of the tool. Translations are pure data (one lesson array per language in js/ui/tour.js), so fixing or adding a language never touches code. (Rest-of-UI translation still to come.)',
        'New Sakura theme + Terminal retired — Sakura is a bright light theme (blossom-pink page, plum ink, rose/mint/gold accents), a change of air from the dark-neon set. Terminal was near-identical to Hacker, so it\'s gone (anyone on it is moved to Hacker). Themes live in Settings ▸ Theme — and you can now switch from code too: theme("synthwave") (theme() alone lists them), a keyboard-friendly companion to the dropdown. The theme dropdown\'s popup is also themed now instead of a stark white/black native list.',
        'Tour polish + a groove fix — the tour now points you to the right-side panels (Players, Scale & Root, the Composition progress bar) and their shortcuts (Ctrl+Alt+P jump to the active part, Ctrl+Alt+; stop autoplay); its section examples end with #@end so they don\'t auto-advance into the next lesson; the follow/accompany/reroll lesson is fleshed out; a new "Tempo & the clock" lesson covers Clock.bpm, tempo-as-a-TimeVar ramps, the sidebar counter + tap button, and how quantised player-starts keep layers locked; a ".unison()" lesson covers fattening a voice into detuned, stereo-spread copies; the #@goto lesson is now a full multi-section Markov set (intro/verse/bridge/chorus/drop with weighted branching) that shows the technique properly; and it survives a refresh (next()/back() keep working). Groove note: PGroove only swings CONSECUTIVE hits — the lessons now use play("-") so swing/offbeat accents are actually audible, plus a new faster "swing16" feel. #@end is also now a pure control marker (it never plays the lines beneath it).',
    ] },
    { v: 'alpha34', title: 'Galaxy polish · squiz, PFDur & shortcut fixes', items: [
        'Galaxy — jams take centre stage — live jams now cluster in the middle of the map with the example nebulae ringed around them. The whole map is also much cheaper: capped to 30fps with the star-glows and nebulae pre-rendered (no more ~140 gradients per frame), and it uses zero CPU while closed. It no longer says "no jams" when it actually just can\'t reach the jam server (and the deploy docs now include the required /ws proxy).',
        'squiz FX now actually does something — it was effectively silent (its underlying UGen barely processes in the WASM build); reimplemented as a grainy PitchShift with a proper wet mix, so squiz=0.4 gives an audible lo-fi pitch-up glitch as intended.',
        'Stop-all works everywhere — Ctrl+; (or the easier Ctrl+,) now stops every player from anywhere, not just when the editor is focused — which is why it seemed dead in Chrome. The ■ stop button shows the shortcut on hover.',
        'Editor colours no longer gloomy — code tokens were falling back to CodeMirror\'s defaults (dark-brown comments, dark-purple oct, dark-green numbers) instead of the theme palette. Comments, numbers, keywords and the oct param now read in each theme\'s proper colours.',
        'Tidier boot & panel — booting no longer floods the log with a line per synthdef (a live count + one summary instead), errors stand out with a red bar, and the MIDI section moved below Composition (it\'s used less).',
    ] },
    { v: 'alpha33', title: 'Code audit · galaxy examples · leaner UI', items: [
        'Big code-audit bug-fix pass — a deep pass over the whole codebase fixed a stack of real issues: a stop→re-eval race that could double a player\'s density, synth drive/comp params that were silently swallowed by same-named FX, a guit synth that made no sound, share links that overwrote your saved buffer, a boot timeout that orphaned the audio engine, pattern-generator edge cases (PRange hang, PSine/PTri/PEuclid negative steps, PDur/PZ12, Pmath dropping chord voices, nested P[…]), collab-server leaks / DoS / monitor exposure, and drifted syntax-highlight + docs reference data. Mostly invisible — things just work more correctly.',
        'Collapsible changelog — every entry is now a short headline that expands on click, so the log stays scannable while keeping all the detail (you\'re reading it now).',
        'Galaxy also browses the examples — beyond the live jams, every example shows as a dim star grouped into a coloured nebula per category, built live from the example list. Hover for its title, click to load it into the editor. Live jams stay the bright foreground; "Live sets" get a flashier pulsing / sparkling treatment, and a few slow comets and asteroids drift across for ambience. The session you\'re in glows amber and clicking it just closes the map (no rejoin).',
        'Streamlined the side panel — Clock, Scale and Root now share one section with Players right beneath it; BPM + tap and Scale + Root each share a row; the phrase counters step per beat; and the old bar-count readout + subdivision squares are gone.',
        'Leaner toolbar — run / stop / reset are compact icons (▶ / ■ / ↻), ♪ load kit sits next to boot, about moved into the crashDot sidebar header, and the load/latency diagnostics meter moved to the sidebar footer.',
    ] },
    { v: 'alpha32', title: 'Galaxy map — browse & join live jams', items: [
        '🌌 galaxy (experimental) — a starfield of every live jam session on the server. Each jam is a glowing star: bigger with more people, brighter the more active it is, slowly fading as it goes quiet. Click a star to jump straight into that session. Opens from the toolbar; updates live. Hover any star to see its details (peers, when it was last active, age). When the last person leaves, the jam doesn\'t vanish — it lingers as a "resting" star whose colour slowly cools from green to blue-grey and fades over 24h (its code kept on the server), so you can click to revive it right where it left off. It\'s purged after a day if nobody comes back.',
    ] },
    { v: 'alpha31', title: 'Share by link · go live from a composition', items: [
        'Share button (⤴ in the toolbar) — copies a self-contained link to your clipboard that carries the WHOLE composition inside the URL (#c=…, deflate-compressed), so it needs no server and never expires. Open the link and it loads that exact buffer into the editor, ready to edit & run. Great for short sketches; a big #@ track makes a long URL that some chat apps may truncate — a server-backed short link is coming next. (If the clipboard is blocked, the link is put in the address bar to copy manually.)',
        '"👥 go live" button — turn the composition you\'re working on into a live multiplayer session in one click: it seeds a fresh room with your current buffer and drops you into it with a ?session= link to share. Anyone who opens the link joins and edits with you in real time. Once you\'re in a session the button becomes "⧉ session link" to copy the room URL. (Links are relative to wherever the app is served, so they keep working when it moves off localhost.)',
        'Toolbar tidy-up — removed the rarely-used "clear" button and hid the visuals pop-out until that feature is ready.',
        { t: 'Scale names are now case-insensitive — Scale.default = "HarmonicMinor" resolves the same as "harmonicMinor". And a new Live set: a harmonic-minor karp piece contributed by Daniel M Karlsson.', ex: 'karp_dmk' },
        'For server operators: a live monitor dashboard.',
    ] },
    { v: 'alpha30', title: 'Automation recorder · reroll · rests · flexible args · synthesis tutorials', items: [
        { t: 'Automation recorder — put the cursor on any number and press Alt+T to arm (a ● REC badge shows), then nudge the value live with Alt+↑/↓ as usual; press Alt+T again and your gesture is captured (sampled at one point per beat) and swapped into the code as the most pertinent TimeVar: a smooth ramp becomes linvar, an up-down wobble becomes sinvar, and stepped holds become var (step-hold, not a glide). Timing is quantised to whole beats so it loops cleanly. With the cursor still on the inserted expression, tap Alt+T to CYCLE the form (var → linvar → sinvar → [array]); Esc while recording cancels and restores the original value. e.g. cursor on the 400 in saw(lpf=400), Alt+T, nudge 400→2000 over 4 beats, Alt+T → lpf=linvar([400, 2000], 4).', ex: 'alpha30new' },
        { t: '.reroll(beats) — a chainable player method that auto-re-evaluates the player line every N beats, so frozen random generators (motif, PShuf, chaos, a PRand degree…) reroll on their own without you re-running the line. e.g. g3 >> pluck(motif(8), dur=1/2).reroll(4). .reroll(0) stops it; it also stops when the player stops. motif also has a built-in reroll as its 4th arg — motif(8, 7, 2, 4) refreshes itself every 4 beats with no method at all.', ex: 'reroll' },
        { t: 'Rests in a degree list — a standalone `_` or bare `rest` now fires NO note (true silence): cs80([4, _, 1, rest, 2]) skips the 2nd and 4th steps. (A `.` still plays degree 0 as before, so existing patterns are unchanged.) Works with `+` transposition too.', ex: 'rest' },
        { t: 'Named-option args now also accept an integer index or a var — arp([0,4,7], 2) == arp([0,4,7], "updown"), and arp(deg, var([0,1], 4)) sweeps the mode over time. Same for PGroove, PContour, PClave, PProg (arp/PGroove vary per-step with a var). arp also gained an octaves arg — arp([0,4,7], "up", 2) spans two octaves (a 4th perOct arg tunes the per-octave step for non-7-note scales).', ex: 'optargs' },
        'Autocomplete: typing `.` after a player now auto-opens the method menu (every/sometimes/penta/chroma/solo/only/stop/degrade/…); the pattern-generator list is grouped into families (rhythm/melody/harmony/random/chaos/sequence); and the first arg of a synth call (the degree) suggests pattern generators.',
        'Fix: a nested generator inside arp — e.g. arp([5, 6, PRand([4, 5, (6, 7)]), 6]) — now resolves each step (a random / <alternating> / var element) instead of silently dropping that step. Groups (chords) and plain numbers are unchanged.',
        'Fix: <a b> alternation is now stable under .unison() — it caches per step, so the several reads unison does per step no longer scramble which item is playing. And the play-position highlight lights the ACTIVE <…> item (a brighter amber box) even when it is nested inside a chord — e.g. dbass([…, ([4, 8], 2), …]) shows whether 4 or 8 is sounding.',
        { t: 'Synthesis tutorials — three new worked examples under Examples › Sound design that build a synth from scratch with defsynth(): additive (stack sine harmonics), subtractive (a rich saw through a filter-envelope sweep), and FM (carrier + modulator, ratio & index). Each explains the technique and has runnable code you can tweak.', ex: 'syn-additive' },
        'New synth: synthbass — an 80s / synthwave / Daft-Punk bass. Detuned saws + a sub sine through a Moog ladder filter with a snappy filter envelope and tanh drive. Clear controls: sus=note length, detune=saw spread %, cutoff/res/fenv=filter + its envelope, sub=weight, dist=warmth, glide=portamento. e.g. b1 >> synthbass([0,0,7,0], oct=2, dur=1/4, sus=0.2, detune=0.45, fenv=4, dist=1.7). Showcased in the "Neon Drive" set (example10.txt).',
        'French-electro pack — 5 more CrashServer synths ported: dafbass (Daft-Punk distorted harmonic bass), a_daftlead (Justice/Daft detuned saw lead w/ filter sweep), a_stab (aggressive major-chord stab), a_vlead (glitchy chopped lead), a_vpad (evolving granular pad). e.g. b1 >> dafbass([0,0,3,5], oct=2, dur=1/4) · p1 >> a_stab([0,3,5], oct=5, dur=1/2, dist=6).',
        'Scale.default / Root.default now accept a var, so the KEY can move over time — Root.default = var([0, 2, 4]) or Root.default = var(["E", "F"]) · Scale.default = var(["minor", "major"]). And the Scale / Root dropdowns now reflect changes made from code (Scale.default = "major") and follow a var as it advances.',
    ]},
    { v: 'alpha29', title: '10 new FX · 34 scales · pattern methods · 2 synths · Paper theme · About card', items: [
        { t: 'New FX (CrashServer ports): mpf — Moog ladder low-pass (mpf=cutoff Hz, mpr=resonance 0–4, self-oscillates near 4), fatter/squishier than lpf, great for acid + techno bass; resonz — resonant band-pass (resonz=mix, rfreq=center Hz, rbw=bandwidth ratio, small=narrow/ringing); fshift — frequency shifter (fshift=Hz ±5..±500, fphase 0–1, fmix=wet), a LINEAR/inharmonic shift (metallic, not pitch-shift); shimmer — pitch-shifted feedback reverb for lush octave sheen (shimmer=mix, shimsize=room, shimpitch 0 unison..1 +1oct, shimmix=internal wet). e.g. d1 >> dbass(mpf=600, mpr=3.5) · p1 >> saw([0,4,7], resonz=0.7, rfreq=1200, rbw=0.12) · p2 >> pluck(fshift=150) · p3 >> pads(shimmer=0.7, shimpitch=1).', ex: 'alpha29new' },
        { t: 'Six more FX (CrashServer ports): clouds — MiClouds granular texture/reverb (clouds=drywet, cpos/csize/cdens/ctex/cpitch/cgain/cfb/cmode) · room2 — true-stereo FreeVerb2 (room2=size, mix2, damp2) · combres — tuned comb resonator (combres=mix, combfreq, combdecay, combspread) · subenh — sub-bass enhancer adds a synthesized -1oct sub (subenh, subhfreq, subhgain) · stereowidth — M/S widener that keeps bass mono (stereowidth, swfreq, swnarrow, swwide) · pumper — sidechain-style volume duck on the beat (pumper=depth, pumprate=pumps/beat). e.g. p1 >> pads(clouds=0.6) · b1 >> dbass(subenh=0.7, stereowidth=0.6) · d1 >> play(x.o., pumper=0.8).', ex: 'alpha29new' },
        { t: '~34 more scales (ported from FoxDot) — now 46 total: blues, wholeTone, harmonicMinor/Major, melodicMinor/Major, hungarianMinor, romanianMinor, egyptian, yu, zhi, chinese, indian, prometheus, the bebop scales (bebopMaj/Dorian/Dom/MelMin), lydianDom/Aug/Minor, locrianMajor, halfWhole/wholeHalf, altered, susb9, halfDim, minMaj … Set with Scale.default="blues" or pick from the Scale dropdown (now lists them all).', ex: 'alpha29new' },
        { t: 'New chainable Pattern methods: .layer(method,…) zips a transformed copy over itself for instant harmony (P[0,2,4].layer("add",2)) · .arp([0,4,7]) expands each note by offsets · .invert() reflects the melodic contour · .submap({1:"x",0:"."}) dict-remaps values · .norm() rescales to 0–1 · .select([1,0,1]) keeps steps by a cyclic mask (pairs with PEuclid/PBin) · .swap(n) reverses consecutive blocks · .undup() drops consecutive repeats. Plus PEuclidR(n,k,rotation) — a rotated Euclidean rhythm as a concrete pattern.', ex: 'alpha29new' },
        { t: 'Two new synths (ports): arpy — the classic FoxDot arpeggio pluck (filtered impulse train), perfect for fast arps; darkpad — a dark detuned six-saw pad + sub with a soft-clipped dark filter (cutoff/res/drive/detune/dark/sub) for techno & ambient atmosphere. e.g. p1 >> arpy(P[0,2,4,7], dur=1/4) · p2 >> darkpad([0,3], sus=4, dark=0.7).', ex: 'alpha29new' },
        'New "Paper & Ink" theme (Settings › theme) — the first LIGHT theme: warm cream paper, dark sepia ink, muted ink-coloured syntax (fountain-pen blue, green, sienna). Easy on the eyes for daylight / projector use.',
        'New "about" button (top toolbar, centered) opens an About card — crashDot + version, Crash Server links (website / Instagram / Mastodon / YouTube / Bandcamp / GitHub), thanks, and the full tech stack. Close with ✕, Esc, or click-outside.',
    ]},
    { v: 'alpha28', title: 'Pop-out visuals (clift)', items: [
        { t: 'Pattern autocomplete now inserts a full, closed call with coherent defaults (0 when unsure) so a pick runs immediately — PDur → PDur(3, 8), PBin → PBin(16), PWalk → PWalk(8, 1, 1), PwRand → PwRand([0,4,7],[8,2,1]), PIndex → PIndex(). PDur/PDelay gained a rotate arg (cyclically shifts the duration list).', ex: 'patterns' },
'The examples dropdown is now a fully custom, themed menu (a native select popup cannot be styled) — categorised, scrollable, with hover highlighting. Added a Deep dives section: param-heavy features (pbuild, .drummer, .human, .every/.sometimes kwargs, son, TimeVars, Euclidean rhythms, .unison) explained line by line with how they work and several use cases.',
'New synths (CrashServer ports): a_bd (electro bass-drum / kick, French-electro distortion), rhodes (electric piano), supersaw (fat detuned saw stack), wobble (dubstep Moog-swept bass). In the synth autocomplete families (perc/keys/lead/bass).',
'chaos() and the son() jam bot now generate far more varied players: role-aware degrees (arp/PArp/PGrowArp, PChord/PRoman/PProg/PCircle, melody()[:n], motif, PContour, PWalk/PShuf/PStutter/PAlt/PxRand/PStep, P*[…] picks), musical durations (PDur, PDur([3, 5],8), PGroove, PBeat, [1/4, 1/2]), PLAYER patterns too — oct=<a b>, amp=PWhite/Pacc, pan=PGauss/sinvar, and + transpose (a number, chord or <alt>). Plus a 30-strong FX palette (filters/reverbs/delays/modulation/distortion, many TimeVar-swept) and chained live transforms (.every/.sometimes/.unison/.penta/.human). PContour now also takes a number or a custom array of control points.',
{ t: 'New reference tutorials — ~70 bite-size, one-per-feature examples grouped in the dropdown under Tut · Rhythm / Notes / Harmony / Random & chaos / Time / Player methods / Functions & live / FX. Each is a tiny runnable snippet with a one-line explanation of how it works (PDur, PEuclid2, PChord, PLorenz, var, .every, .drummer, drop, son, pong, chop…). Load one from the ▾ dropdown to learn a feature at a time.', ex: 'u_pdur' },
'Play-position highlight upgrades: a chord group as a direct arg now lights up — dbass((0,4,7)) highlights the whole chord; <a b c> alternation now MOVES the highlight through its items instead of lighting the whole group. And a player line briefly flashes yellow when a .sometimes/.every modifier actually fires, so you can see the transform happen. The Examples dropdown is restyled (wider, coloured optgroups).',
{ t: 'The Examples menu has 6 new technique showcases — Chords & progressions · Arpeggios · Euclidean rhythms · Cross-player modulation · Live transforms · Generative & chaos — each a short runnable set. Pick one from the ▾ dropdown or the Examples tab to load it into the editor.', ex: 't_chords' },
'son() now holds a HARD cap of 5 of its own g* players (default range 3–5; your manual players never count) and actively retires voices — even fresh ones at the cap — to keep turning over. Tune with son({min, max}).',
{ t: 'Fix: the new player methods (accompany/follow/map/jump/rotate/mirror/strum/offbeat/multiply/once) are now chainable directly on a synth/play call — p2 >> pluck([0]).accompany("b1") no longer errors. New .mirror() (reverse the degree, a toggle). To transform a pattern LIVE and actually hear it, use .every(4, "rotate") / .sometimes("mirror"); P[…].rotate() is a static compose-time reorder.', ex: 'alpha28new' },
'Long lines now WRAP instead of running off the right edge (the horizontal scrollbar was hidden, so a big call like a full pumpbass(...) was unreachable). A wrapped line is still ONE logical line — Ctrl+Enter evaluates the whole thing.',
{ t: 'New FX: spin — stereo auto-pan that rotates the image (spin=mix, spinrate=Hz); and pong — a ping-pong stereo delay whose echoes bounce L↔R (pong=mix, pongtime in beats, pongfeed 0–0.9). Both in the fx submenus (spin→modulation, pong→delays). e.g. p1 >> saw([0,4,7], spin=0.6) · b1 >> play(x.o., pong=0.5, pongtime=0.375).', ex: 'alpha28new' },
{ t: 'New player methods: .jump(n) nudges the playhead forward n steps (live fill), .rotate(n) rotates the degree array live, .strum(spread) arpeggiates a chord over `spread` beats, .offbeat(amt) pushes notes onto the offbeat, .multiply(n) repeats each step n times (roll).', ex: 'alpha28new' },
'New midiin(synth) — play a MIDI keyboard through any synth (note-on triggers a voice, velocity → amp): midiin("prophet"), opts amp/sus/transpose, midiin(0) to unbind. And in a shared session, undo is now scoped per user (Y.UndoManager) — Ctrl-Z reverts only your own edits, not a collaborator\'s.',
'Cross-player modulation: reading another player live now supports arithmetic — b1 >> bass(p1.degree + 2) tracks p1 a third up (the +2 is wrapped in Pmath instead of going NaN). New player methods (pass the other player\'s name as a string): .follow("p1") tracks its degree, .accompany("p1", [0,2,4]) harmonises around it, .map("p1", {0:5, 4:7}) drives an attr through a lookup table.',
'New live-control helpers (CrashServer ports): say("text") speaks via the browser (Web Speech API); darker()/lighter() walk Scale.default along the mode-brightness list (live modal colour); shutup() stops every player + the jam bot; swap("p1","p2","lpf") swaps one attribute between two players; and the .once() player method plays a single event then stops (one-shot stabs).',
{ t: 'New son() / soff() — a generative jam bot. Over time it adds, stops, and mutates its own g* players (kept apart from your p1/b1 so it never fights your code), holding between min and max voices; in a session its lines broadcast to peers. son({min:2, max:5, drum:0.5, every:[4,8]}) tunes it; soff() stops the loop, soff(true) also stops its players. Boot audio first.', ex: 'syncgen' },
'Tempo automation: Clock.bpm now accepts a TimeVar, so the tempo can ramp — Clock.bpm = linvar([120,140],[32]), or the helpers linbpm(120,140,32) / dropbpm(90,8). Plus new scheduling: Clock.future(dur, fn), Clock.schedule(beat, fn), Clock.mod(n, fn), Clock.nextBar(fn), and Clock.meter (beats/bar).',
{ t: 'Patterns are now chainable (FoxDot metaPattern methods): P[…] and list generators (PDur/PBeat/PCircle/PProg/PGrowArp/PTree/PPairs/PSum/PJoin…) return a Pattern you can transform — .rotate(n) .reverse() .mirror() .palindrome() .accum() .stretch(n) .trim/.ltrim .loop(n) .stutter(n) .shuffle() .sort() .add(v) .offadd(v)/.offmul(v) .zip(other) .amen(n). e.g. d1 >> pluck(P[0,2,4,7].rotate(1).palindrome()). Also new Pvar([patterns], durs): a pattern-valued timevar that swaps whole phrases over clock time while the player keeps stepping.', ex: 'patterns' },
'New FX (FoxDot/CrashServer ports): bpf — resonant band-pass sweep (bpf=center Hz, bpr=bandwidth, small=narrow/resonant); and eq3 — a 3-band EQ (eq3=mix, eqlow/eqmid/eqhigh in dB ±24, with eqlowf/eqmidf/eqmidq/eqhighf to place the bands). Both live in the fx › filters submenu. e.g. p1 >> saw([0,4,7], bpf=1200, bpr=0.2) · b1 >> play(x.o., eq3=1, eqlow=4, eqhigh=-3).',
'Autocomplete is now a nested flyout menu: category headers (synths · patterns · params · fx …) are rows you unfold to the RIGHT — hover or press → to open, ← to go back, ↑/↓ to move, ↵/Tab to pick, Esc to close. The fx category unfolds a second level by family (filters · reverbs · delays · distortion · modulation · rhythmic). Param/FX names show clean (no trailing = or …) but still insert the full amp= / lpf=2000, … form. Typing filters as a flat list.',
        { t: 'Curve shapes + composition helpers. Curves (per-step LFOs, good on dur/sus too): PExp (exponential), PPulse (square/pulse with a width/duty knob), PSlide (smoothstep swell). Note generators like melody(): motif(n) (a frozen repeating motif), arp([0,4,7],"updown") (directional arpeggiator), PContour("arch",8,7) (a melody following a shape). Duration feels: PGroove("swing"/"gallop"/"triplet"…). Composition: PCircle(8) walks the diatonic circle of fifths (I IV vii iii vi ii V…) staying coherent with the current Root/Scale — pass a chord type for a turnaround of chords; PProg also learned cadences ("perfect"/"plagal"/"half"/"deceptive").', ex: 'patterns' },
        { t: 'Four new pattern families. Harmony: PChord(0,"7") builds a diatonic chord group (quality follows the Scale), PRoman("I V vi IV") a numeral progression, PProg("50s"/"251"/"blues"…) a named one. Rhythm: PClave("son"/"rumba"/"bossa"…) 16-step clave strings, PRhythm([1,(3,8)]) expands tuples to PDur durations, PPoly(3,4) a cross-rhythm. Chaos: PLogistic, PBrown, PHenon, PLorenz — dynamical-system value streams for organic drift. Number sequences: PPrime, PThue (Thue-Morse), PGrowArp (growing arpeggio), PTree (self-similar L-system melody).', ex: 'patterns' },
        { t: 'Many more pattern generators (FoxDot ports): PDrum (Euclidean drum play-string), PwRand (weighted random), PxRand (no-repeat random), PLog (log-normal), PTime (wall-clock digits), PSum (durations summing to a total), PDelta (cumulative), PIndex/PSquare/PFib (index/index²/Fibonacci), PBeat (durations from a pulse string), PJoin (concat), PDelay/PQuicken/PStrum (delay groups), P10 (random bits), PSaw (sawtooth), PSq (powers), PZero/PBool, PPairs, PChar (letters→degrees), PZip2, PZ12 (evenly-spread "dearth" tokens). Plus lininf/expinf timevars (ramp then hold forever).', ex: 'patterns' },
        'Renamed the piano synth to "basic" — it is an additive synth, not a convincing piano. Old code keeps working: piano is kept as an alias for basic.',
        'New ▦ button pops out an audio + code reactive ASCII visuals window (clift-style). It runs in its own window/event-loop, so rendering never competes with the audio clock; the main window just taps one analyser on the scsynth output and posts beat/bpm/bands + each evaluated line + note attacks over a BroadcastChannel. Scenes (plasma/tunnel/spectrum/code-rain) react to bass/mid/treble + the beat; space = next scene, a = auto, f = fullscreen.',
        'The visuals window shows your code stylishly (token-coloured, glowing, typewriter reveal of the newest line, older lines fading up) and the code drives the visuals: the synth type picks the scene (bass→tunnel, leads→plasma, play→spectrum, drums→code-rain), cutoff/oct set the hue, amp the brightness, dur the speed, and each note attack pulses the scene. 18 scenes (plasma/tunnel/spectrum/wave/grid/code-rain/aurora/voronoi-cells/starfield/fire/ripple/interference/DNA-helix/spiral/nebula/flow/lissajous/strange-attractor). The window is an AUTOPILOT — it tracks musical energy + momentum (buildup/breakdown), picks pertinent scenes on bar boundaries (calm scenes when quiet, intense when loud, biased by the live synth), crossfades smoothly between them, and evolves hue / speed / FX (trails when calm, scanlines when loud, vignette) continuously from the energy. The code biases it (synth→scene pool, cutoff/oct→hue, drop()→transition, chaos()→glitch). Keys are optional overrides (space/a/t/s/v/i/p/g/f). Press [m] for a second, code-truthful mode: each active player gets its own panel driven purely by its code — degree sets the wave frequency/height, octave the colour, amp the size, the pattern shows as a step strip with the current step lit, active FX tagged, and a flash on every note (no audio analysis). Both modes show a transport overlay: the active #@ section name + a beat grid (bar phase), and a connection status dot.',
        'Visuals: multiplayer-aware — in a session each peer\'s evals are tagged and coloured by their cursor colour (and tint the scene), so you can see who played what. Instant code: the line under your cursor streams live to the window as you type. BPM changes drive the visuals too — animation speed scales with tempo and a tempo change flashes.',
    ]},
    { v: 'alpha27', title: 'Fixes & polish (user feedback)', items: [
        'Players now phase-lock to the global beat grid: two players started at different times stay in sync (a step is derived from the clock, not from when you pressed play). So b1 >> play(x.o.) and b2 >> play(x-o-) line up no matter when each is launched.',
        'Param coherence: atk/dec/rel are accepted as aliases of attack/decay/release on every synth.',
        'The examples dropdown now shows the example you picked (instead of snapping back to the ▾ placeholder).',
        'Autoclose brackets now includes <>: typing < gives you <>.',
        'The right sidebar is resizable — drag its left edge. Width is remembered. (The sidebar-toggle button was removed last version.)',
        'The beat subdivision (▪◦) now animates smoothly on its own frame loop instead of aliasing/sticking at the 250ms panel refresh.',
        'Editor: plain names (oct, dur, …) are no longer dimmed — .cm-variable is set to the readable text colour.',
        'Alt+X on a commented line now restarts just that line\'s player, not the whole block.',
        'The live play-position highlight now follows bracketed patterns — (), [], {}, <> in both play() strings and synth degree lists (each group is one step) instead of dropping the highlight.',
        'Reworked the piano — a proper acoustic model (6 inharmonic partials with per-partial decay, two detuned strings for beating, a hammer-noise click, velocity-tracked brightness) instead of the old 2-oscillator FM. New params: tone, hammer. (FoxDot uses MdaPiano, an sc3-plugin not in the WASM build, so this is a core-UGen build.)',
    ]},
    { v: 'alpha26', title: 'New synth + FX ports', items: [
        'New synth a_gesa — aggressive Gesaffelstein-style distorted sub-bass (saw + pulse + sub, tanh distortion, resonant env-swept LPF, softclip). Params: dist, cutoff, rq.',
        'New FX djf — a DJ isolator filter (one knob): djf=0.5 is flat, <0.5 sweeps a lowpass down, >0.5 sweeps a highpass up. djfq sets resonance. Great for live builds.',
        'New synth a_daft — Daft Punk-style punchy filter bass (saw stack into an env-driven resonant LPF). Params: cutoff, rq, punch.',
        'New synth a_hhat — French-electro metallic hi-hat (pitchless noise + ring-mod tones). Params: tone, decay, metallic, dist, open.',
        'New synth pumpbass — pumping filter bass with a per-note sidechain-style duck. Params: cutoff, rq, sub, body, dist, fuzz, fuzzgain, noiz, hpr, pump.',
        'Fix: arithmetic on Pacc (and Pslice) now works — e.g. amp=Pacc("offbeat")*1.3. The pattern-math detector only recognised P + UPPERCASE names, so Pacc*n stayed raw JS ({get}*number = NaN) and killed the voice. Now any P-name is wrapped in Pmath.',
        'New player method .chroma() — put a player on the chromatic scale (degrees become semitones), like .penta() but chromatic. Chainable on a call too: faim([...]).chroma().',
    ]},
    { v: 'alpha25', title: 'Pattern fixes', items: [
        { t: 'Inline random choice with braces now works in degree/param patterns for synths AND play: {a, b, c} picks one each step (like P*[a,b,c]). e.g. v1 >> dbass([0, 2, (4, 2), {2, 4}]) or saw([0,4,7], oct={4,5,6}). Patterns nested inside a list (PRand, {…}, etc.) now resolve each step instead of producing a dead note. Dicts (PChain({0:[1]})) and defsynth bodies are left untouched.', ex: 'patterns' },
        'The live play-position highlight now recognises a {…} random group: it lights the whole group when it is the active step (the pick is random, so it cannot point at one element) instead of mis-tracking a value inside it.',
        'Fix: PStep(n, v, default) now matches its documented FoxDot form — v every n steps, default otherwise (PStep(4,7,6) = [7,6,6,6]). It was reading args as a {step:value} map, so PStep(4,7,6) returned 0 forever.',
        'Nested brackets now work in synth lists too: [0,[4,2]] alternates like [4, 2] → 0,4,0,2 (deeper nesting too), so old FoxDot bracket patterns keep working. play() still subdivides. <…> alternation also resolves inside a synth list now.',
        'All synths now share defaults amp=1, pan=0, oct=5; the common params (amp/dur/pan/attack/release) are hidden from autocomplete inserts and the Alt+I signature, leaving just each synth\'s own controls.',
        'Fix: the rgate FX now matches FoxDot/CrashServer chop — rgaterate is slices per beat (tempo-locked to the clock, not a fixed Hz), with 5 wave shapes (pulse/tri/saw/sine/parabola) and a soft floor. chop and fbdelay are tempo-locked automatically now too.',
        { t: 'pbuild gains live, FoxDot-style params: genre can be an index number (pbuild(0)) or a prefix ("indus" → industrial); the layer params kick/snare/hat/perc take a per-bar GATE — snare=0 cuts snares, snare=PBin(4)/{1,0}/[1, 0] toggle them per bar; fill/density can be pattern-valued too. Autocomplete now offers pbuild(…) (full call, every knob exposed) inside play().', ex: 'drums' },
        { t: 'Examples are now grouped into categories (Live sets · Basics · Patterns & time · Sound design · Perform & MIDI) — the dropdown (optgroups) and the Examples page show the same sets in the same order. New live set: Rise (a build into industrial techno).', ex: 'rise' },
    ]},
    { v: 'alpha24', title: 'Slices · .gtr() · quantised Alt+X', items: [
        { t: 'Slice a generator to freeze it: pat[:N] samples N values once and loops them, so a random source becomes a stable N-step phrase that repeats — PWhite(0,1)[:8], melody()[:8], PRange(0,12)[:4]. Also added melody(), a simple melodic random-walk generator.', ex: 'patterns' },
        '.gtr(string) — tune a player like a guitar string (FoxDot/CrashServer port): chromatic scale + a per-player root at the string open pitch, so degrees act like frets. e.g. guit([0,3,5,7]).gtr(5).',
        'Alt+X now stops the player quantised — the line is commented immediately, but the audio stops on the next bar boundary instead of cutting out the instant you press it.',
    ]},
    { v: 'alpha23', title: 'Renamed to crashDot · split view · zen mode', items: [
        'Renamed: WebFoxDot → crashDot (display name).',
        { t: 'Quantised player start: a new player\'s first note now lands on the next beat that is a multiple of its dur (FoxDot-style) — so d1 >> dbass(dur=4) waits for a bar boundary while dur=1/4 starts almost instantly. Players stay in sync. (Re-evaluating a running player keeps its grid.)', ex: 'syncgen' },
        { t: 'Chained player methods on a call now work: p1 >> saw(...).solo(4) / .only(8) / .stop(8). Timed solo/only/stop/soloDrop are grid-aligned (next multiple of N), matching the quantised model.', ex: 'syncgen' },
        { t: 'chaos(n=4, type) — generate n random player lines (synth/drum/mix) into g1,g2,… (kept separate from your own) and PASTE them into the editor as a block — it does not run them, so you can review/edit then evaluate. type "synth" or "drum" forces one kind. A burst of generative material (the one-shot cousin of the planned son()/soff() bot).', ex: 'syncgen' },
        'Split view (⬓): in a session, peers\' evaluations stream in a live, name-tagged, colour-coded feed below the shared editor — top is the shared code, bottom is what everyone is running. Auto-on when you join a session; toggle with the ⬓ button.',
        'Zen mode (⛶): hide all UI for a clean editor-only view (performing / projection). Toggle with the ⛶ button or Shift+Alt+Z (works while everything is hidden, to restore it).',
        'Clock panel now shows phrase counters — which bar of a 4/8/16/32/64-bar phrase you are on, jumping by integer bars (webTroop-style) so you can see a drop/change coming.',
        'Examples are now a dropdown (pick a category to load it), starting with Introduction (boot + load the webfoxdot-kit + a starter). New Terminal theme — pure black, green-phosphor + amber.',
        { t: 'pbuild(genre) — genre drum-pattern generator (port of FoxDot DrumPatterns): play(pbuild("techno"), dur=0.25). 9 genres (techno/ebm/dnb/house/breaks/halftime/industrial/reggae/afro); evolve/fill/density/mute options; pkit() for per-layer access; genres() lists them.', ex: 'drums' },
        { t: '.drummer() — chain onto a play() player to turn it into a self-evolving rock drummer (FoxDot/CrashServer port): random groove + fill, fill dropped in at the end of each loop, re-randomised every durloop beats (default 16). e.g. b1 >> play("x").drummer()', ex: 'drums' },
        'Fix: nudging a value with Alt+↑/↓ now re-runs only the current line (was re-running the whole block, restarting every player in it).',
    ]},
    { v: 'alpha22', title: 'Server usage logging (sessions + solo)', items: [
        'Collab server now logs a [status] line after each change — total instances, the live sessions with per-room counts, and how many people are using it solo. e.g. [status] instances: 4 · sessions: myjam(2) · solo: 2',
        'Solo-usage visibility: running without a ?session= now registers a lightweight presence with the collab server (a keepalive ping only — no audio or edit data) so solo players show up in the count. Silent no-op if the collab server isn\'t reachable',
        'Fixes: a commented-out player line with a body (# v1 >> sine(...)) in a #@ section now stops that player cleanly instead of erroring (the synth call was left dangling); stop-all (stop button / Ctrl+. / Ctrl+;) now also cancels the autoplay sequence, so a pending section advance can no longer restart playback after you stop',
    ]},
    { v: 'alpha21', title: 'MIDI out, control curves, loops + per-effect FX engine', items: [
        'FX engine rebuilt to per-effect on-demand nodes: each effect is its own SynthDef (fd_fx_*) instead of one always-on chain computing all 32 effects every block. A player runs only the effects it uses — absent effects cost zero CPU, so stacking multiple FX-heavy players no longer drops out. A bare player (no FX) bypasses the FX graph entirely; FX n_set updates are diffed; per-step/per-eval overhead trimmed',
        'Fixes: multi-line defsynth; synth params that collided with FX-key names (choir/organ/compkick → vox/cutoff/crunch); boot matches the audio device sample rate (fixes a Firefox hang when another tab held the device)',
        { t: 'MIDI out — drive external/virtual MIDI gear from a player: m1 >> midiout([0,2,4], channel=1, oct=5, dur=1) sends note-on/off to a MIDI port. Velocity follows amp, note length follows sus/leg, groups make chords ((0,4,7)), and degree/transposition/.every/.stutter all work like a synth. Notes are scheduled sub-beat-accurate (performance.now() timestamps) so they stay phase-locked to the internal synths. Pick the output port in the MIDI panel; route through a virtual port (IAC / loopMIDI / ALSA-JACK) to reach a DAW. Stop / Ctrl+. sends all-notes-off', ex: 'midi' },
        { t: 'midi()/mlearn() curves — beyond lin and exp: log, quad, cubic, sqrt, and s (smoothstep). exp now eases-in on 0-based ranges instead of going linear. The MIDI panel lists the curves and labels each active binding', ex: 'midi' },
        { t: 'loop() — beat-synced audio-loop player. loadloop(name, url) registers a loop buffer; b1 >> loop("break", dur=8) plays it time-stretched to lock to 8 beats. opts: amp/pan/rate/sample/pos/stretch/looping. (Ported from FoxDot loop; included here for the first published build.)', ex: 'loop' },
        'Boot now matches the audio device sample rate (was forced to 48 kHz). Fixes a Firefox hang/crash when booting while another tab held the audio device at a different rate (e.g. a playing YouTube tab), plus a boot watchdog with an actionable message if the engine can\'t start',
        'Right sidebar panels are now collapsible — click a section header (Clock / Scale / MIDI / Link / Session / Composition / Players) to fold it; the state persists across reloads',
    ]},
    { v: 'alpha20', title: 'MIDI control + Ableton Link + loops + industrial kick', items: [
        { t: 'loop() — beat-synced audio-loop player. loadloop(name, url) registers a loop buffer; b1 >> loop("break", dur=8) plays it time-stretched to fit 8 beats (locks to tempo). opts: amp/pan/rate/sample/pos/stretch/looping. Ported from FoxDot loop (PlayBuf + beat-stretch); each step self-frees', ex: 'loop' },
        { t: 'MIDI assignment — map a hardware controller to live params over Web MIDI: midi(cc, lo, hi[, curve]) binds a CC knob/fader to any synth or FX param (read every step, like a TimeVar). Use inline or by assignment: p1.lpf = midi(74, 100, 8000, "exp")', ex: 'midi' },
        { t: 'mlearn(lo, hi[, curve]) — MIDI learn: binds to the next control you touch. One control can drive several params at once (a macro)', ex: 'midi' },
        { t: 'New MIDI panel (right sidebar): enable Web MIDI, a live CC monitor to discover your controller\'s numbers (twist a knob → see CC# + value), and the active bindings. Chromium/Edge; enables on first midi()/mlearn() call', ex: 'midi' },
        'Ableton Link — follow Ableton\'s tempo + bar phase over the LAN. A small Link bridge in the Node server (cd server && npm run start-link) joins the Link session and relays tempo/phase to the browser, which disciplines its clock to match. link(true) or the Link panel\'s connect button. Syncs with Ableton Live + any Link app/gear',
        { t: 'New synth: compkick — industrial compressed kick (sub + body + click, internal Compander/Limiter + 4-band EQ). oct=3 ≈ 65Hz punchy; oct=2 for deep sub', ex: 'synths' },
    ]},
    { v: 'alpha19', title: 'CrashServer track support — language, synths & FX', items: [
        { t: 'Pattern arithmetic: time-vars and P patterns combine — linvar([1.4,0],32) * P[1,0,0.9], etc. (a pattern token + a top-level op routes through Pmath; plain scalars stay native)', ex: 'patterns' },
        { t: 'Note-name roots ("E" → 4), .penta() (pentatonic), .degrade(p) (drop a fraction of steps), richer .unison(n, detune, spread), and fperlin(period, lo, hi) noise', ex: 'patterns' },
        'fb / fi / fo usable as plain clock-synced values (not only with the _ envelope suffix); var() durations accept patterns; a player can read another\'s attr live (b1.degree)',
        { t: 'New synths: ebass, faim, guit (MiPlaits), lapin, acidbass, hoover, cs80, moogpluck — 29 total', ex: 'synths' },
        { t: 'New FX: octclean, fold, csweep, eb (echo), tube (+tubedrive), drcomp (compressor), lofi, vowel, feed, sbrk', ex: 'fx' },
    ]},
    { v: 'alpha18', title: 'Sample-accurate clock', items: [
        'Notes are now sent to the audio engine as timestamped OSC bundles — scsynth fires each note on its audio thread at the exact beat time (NTP timetag), not from a main-thread timer',
        'Result: a brief main-thread stall (GC, heavy re-eval, the live highlighter) no longer drops or lags notes — timing holds steady under load',
        'Sub-beat timing (strum, stutter rolls, play() subdivisions) rides the timetag too, instead of nested setTimeouts',
        'Stop / panic now flushes the scheduled-note queue, so it cuts instantly',
        { t: 'Fixed: <a b c> alternation now works on synths & params too (saw([0, 4, 7]), dur=[1, 2]), not just play() strings — cycles each time it\'s reached', ex: 'axis1' },
        'Global stop-all key: Ctrl/Cmd + . (works from anywhere, not just the editor)',
        'Editor: readable colour for built-in tokens (was an unreadable dark purple on dark themes)',
    ]},
    { v: 'alpha17', title: 'Clock robustness', items: [
        'Clock: clamp dt so a backgrounded tab / main-thread stall no longer lurches the beat or dumps a burst of overdue notes on resume — tempo stays steady',
        'Bigger scheduling lookahead (30→80ms) for jitter tolerance',
        'Re-anchor the beat on tab refocus; throttle the live degree highlighter',
    ]},
    { v: 'alpha16', title: 'More synths, FX & patterns', items: [
        { t: 'New synths: organ (drawbar additive), ssaw (supersaw), karp (Karplus string), piano (FM electric piano)', ex: 'synths' },
        { t: 'New FX: ringmod, flanger, phaser, formant (vowel band-pass, 0/1/2 = ah/eh/oh)', ex: 'fx' },
        { t: 'New patterns: PStretch(seq,size), PZip(a,b), PReverse(seq), PMorse(text) — morse rhythm as a dur', ex: 'patterns' },
    ]},
    { v: 'alpha15', title: 'Live-tweak attrs · Master bus · new synths & FX · bus fix', items: [
        'Attribute assignment — p1.lpf = linvar(...) / p1.dur = 1/2: tweak one attr of a running player without re-stating the line (the bank\'s core live idiom)',
        'Master / global FX bus — Server.addFx(lpf=…, hpf=…, mverb=…, echo=…, tanh=…, lofi=…) over the whole mix, Server.clearFx(), and Master().lpf = 800',
        { t: 'New synths: tb303 (acid bass — env-mod filter + drive), choir (formant vowel pad, vowel 0-2), brass (filtered saw + "blat", bright)', ex: 'synths' },
        { t: 'New FX: leg (legato length), shape & dist2 (wavefold/saturation), multicrush (3-band drive), chop (rhythmic gate), vibrato (pitch wobble)', ex: 'fx' },
        { t: 'PArp(seq, 0-9) — BlueARP arpeggiator shapes (ported from FoxDot)', ex: 'patterns' },
        'kwargs now work in any call (e.g. p1.every(4, "stutter", mverb=0.5) outside a >> line)',
        'Fix (important): players went silent after ~32 names — numAudioBusChannels was stuck at 128 (the cap lives in scsynthOptions). Raised to 2048; private buses now recycle on stop; master Sanitizes NaN so one bad synth can\'t kill the output. Toolbar shows lag · voices · bus usage.',
    ]},
    { v: 'alpha14', title: 'Live degree highlight · player age · richer intro', items: [
        'Live degree highlight — the array element a synth player is currently sounding lights up in the editor (parse-once + one moving marker, so it stays cheap)',
        'Players panel: stopped players drop out of the list; each active player shows its age, colour-shifting green → red the longer it runs (FoxDot/webTroop-style)',
        'Multiplayer: the chat + peer-rename fix from before',
        'A richer generative intro track — more #@goto branching and varied sounds (plaits engines, fbdelay, bell, morphing arps)',
    ]},
    { v: 'alpha13', title: 'Groove & feel + fixes — delay, .human(), patterns, reset', items: [
        'delay — per-note timing offset in beats (works on synths and play()); the groove building-block',
        '.human(velocity, humanize, swing) — humanise dynamics + micro-timing (ports FoxDot/CrashServer): sets a delay + amplify jitter',
        { t: 'PEuclid2(n, k, lo, hi) — Euclidean rhythm filled with lo/hi (e.g. play(PEuclid2(3,8,".","x")))', ex: 'patterns' },
        { t: 'PFr(lo, hi, seed, size) — deterministic fractal pattern; PGauss(mean, deviation) — Gaussian random', ex: 'patterns' },
        'Fix: autocomplete now offers FX/params anywhere inside a call — a chord/group/array no longer hides them (proper bracket-depth detection)',
        'Fix: ~player >> … is now a full reset — clears every()/solo gain/transposition AND bypasses the FX chain (stale lpf/reverb gone)',
        'New "↻ reset" button (and softReload() in code) — stop everything & free stuck audio nodes without a page refresh',
        'Composition panel: live progress squares next to each part — watch the active section advance through its beats (mirrors to peers)',
        'Multiplayer: a Session panel lists connected peers (name + colour) + a session chat; renaming updates your entry in place (keyed by client id)',
        'Fix: .every() now fires on play() too (it was synth-only); it also honours a trailing kwarg, e.g. .every(4, "stutter", mverb=0.5)',
        'Load meter in the toolbar — scheduler lag (ms) + active voice count; green/amber/red as the main thread keeps up or struggles',
        { t: 'New FX: fbdelay — stereo feedback delay with filtered feedback (fbtime/fbfeed/fbcutoff/fbspread)', ex: 'fx' },
        { t: 'New synth: plaits — multi-engine macro-oscillator (engine 0-7: VA/FM/fold/harmonic/wavetable/noise/string/modal) with timbre/harm/morph', ex: 'synths' },
        'More from the bank coming next: PArp, PMorse, the leg/chop/shape/dist/multicrush FX, and the Master/Server.addFx global bus',
    ]},
    { v: 'alpha12', title: 'Set your name & cursor colour (multiplayer)', items: [
        'In a session, a name + colour box appears in the toolbar — set your display name and cursor colour',
        'Changes update live: peers see your new name/colour on your cursor immediately, and your evals are tagged with it in the log',
        'Identity persists across reloads (localStorage); the box is hidden in solo mode',
        'Fix: the unknown-param warning now only fires for params you explicitly type — params inherited when a player slot is reused as a different synth (e.g. saw’s rate carried into prophet) are silently ignored, like FoxDot',
    ]},
    { v: 'alpha11', title: '#@goto chains · multiplayer sync · cyberpunk default · UI polish', items: [
        { t: '#@goto(target, prob) — a zero-length probabilistic router: prob chance to jump to a part, else fall through. Chain them for a Markov-style set that never repeats', ex: 'sections' },
        'Multiplayer: solo / unsolo / soloDrop now broadcast (solo mutes for everyone); the active #@ part highlight + autoplay state mirror to all peers',
        'Composition panel: a "stop autoplay" button above the parts list (and Ctrl+Alt+;) halts the auto-advance for everyone, players keep running',
        'Ctrl+Enter now runs the current line (or selection); Ctrl+Alt+Enter runs the whole block',
        'Cyberpunk is the default theme; refreshed the default palette + subtle glow on title / boot / status (carried into all themes)',
        { t: 'New "Full composition" example — a complete live set showing most features, wired with #@goto branching', ex: 'showcase' },
        { t: 'webfoxdot-kit default pack: CDN + GitHub-raw loadpack URLs, with a Firefox caveat', ex: 'samples' },
        'Fixes: PFDur((n,k),…) accepts (n,k) tuples (were rejected as groups); donk anti-click at low octaves (fade-in + LeakDC + freq floor)',
    ]},
    { v: 'alpha10', title: 'Persistent attributes · Workflow tab · audio rec', items: [
        'Re-assigning an active player inherits its previous params — p1 >> dbass(dur=4) then p1 >> dbass(oct=6) keeps dur=4',
        '~p1 >> … resets the player to defaults (no inheritance), like FoxDot\'s tilde',
        'New Workflow docs tab — every shortcut, system and feature explained with examples',
        'rec code (was "rec") + rec audio button — record the audio output to a .webm file',
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

// Turn the Examples tab into a runnable editor buffer: the code blocks, nothing
// else. The prose belongs on the Examples PAGE, which is built from this same
// source and keeps every note — in the editor it is text you have to scroll past
// before you reach a line you can put the cursor on, and attack() pastes this too,
// so a borrowed block would arrive wearing a title banner and a paragraph about
// itself. What lands is what plays.
// One .docs-section → runnable buffer text.
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
function splitItem(text) {
    const d = text.indexOf(' — ');
    if (d > 0) return { summary: text.slice(0, d), detail: text.slice(d + 3) };
    const m = text.match(/^(.+?[.:])\s+(\S.+)$/s);
    if (m && m[1].length <= text.length - 12) return { summary: m[1], detail: m[2] };
    return { summary: text, detail: '' };
}

function buildChangelog() {
    const li = (item) => {
        const raw  = typeof item === 'string' ? item : item.t;
        const link = (typeof item !== 'string' && item.ex)
            ? ` <a class="docs-link" data-anchor="ex-${item.ex}">→ example</a>` : '';
        const { summary, detail } = splitItem(raw);
        if (!detail) return `<li class="cl-item">${summary}${link}</li>`;
        return `<li class="cl-item has-detail">`
             +   `<div class="cl-summary">${summary}${link}<span class="cl-more">▸</span></div>`
             +   `<div class="cl-detail">${detail}</div>`
             + `</li>`;
    };
    return CHANGELOG.map(rel => `
        <div class="docs-section">
            <div class="docs-section-title">${rel.v}${rel.title ? ' — ' + rel.title : ''}</div>
            <ul class="docs-changelog">${rel.items.map(li).join('')}</ul>
        </div>`).join('');
}

// The changelog as markup, for anywhere that is not the docs overlay — the
// desktop UI gives it a panel of its own. Same builder, so the two can never
// drift apart.
export function changelogHTML() { return buildChangelog(); }

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

    function showTab(name) {
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
        if (!cache[name]) cache[name] = CONTENT[name]();
        body.innerHTML = cache[name];
        body.scrollTop = 0;
    }
    _showTab = showTab;

    tabs.forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));

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
