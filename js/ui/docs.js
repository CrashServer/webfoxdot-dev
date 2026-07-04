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
    { key: 'Ctrl+/',             desc: 'Toggle line comment' },
];

export const PATTERNS = [
    { name: 'PRand(lo, hi)',            desc: 'Random integer between lo and hi each step' },
    { name: 'PWhite(lo, hi)',           desc: 'Uniform random float between lo and hi' },
    { name: 'PWalk(lo, hi, step)',      desc: 'Random walk — moves ±step, clamps to [lo,hi]' },
    { name: 'PDur(k, n, rotate=0, dur=1)', desc: 'Euclidean durations — k pulses in n steps; rotate cyclically shifts the list. e.g. PDur(3,8)' },
    { name: 'PPing(lo, hi)',            desc: 'Bounce linearly between lo and hi' },
    { name: 'PStutter(p, n)',           desc: 'Repeat each element of p exactly n times' },
    { name: 'PAlt(a, b)',               desc: 'Alternate one step from a, one from b' },
    { name: 'PShuf(values)',            desc: 'Shuffle the list once, cycle the result' },
    { name: 'PBern(p)',                 desc: 'Bernoulli sequence — 1 with probability p' },
    { name: 'PCoin(p)',                 desc: 'Return 0 or 1 with probability p' },
    { name: 'PEuclid(n, k)',            desc: 'Euclidean rhythm — k pulses in n steps' },
    { name: 'PEuclid2(n, k, lo, hi)',   desc: 'Euclidean rhythm of n pulses in k steps, filled with lo/hi (great for play() chars: PEuclid2(3,8,".","x"))' },
    { name: 'PRange(lo, hi)',           desc: 'Linear ramp from lo to hi, then repeat' },
    { name: 'PStep(n, v, default=0)',   desc: 'v every n steps (at 0, n, 2n…), default otherwise → PStep(4,7,6) = [7,6,6,6]' },
    { name: 'PSine(lo, hi, len)',       desc: 'Sine-shaped sweep over len steps' },
    { name: 'PTri(lo, hi, len)',        desc: 'Triangle-shaped sweep over len steps' },
    { name: 'PChain(dict)',             desc: 'Markov chain from {state: [next,...]} dict' },
    { name: 'PMarkov(arr)',             desc: 'First-order Markov from value array' },
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
    { name: 'PDrum(k, n, char="x")',    desc: 'Euclidean drum play()-string: k pulses over n steps → play(PDrum(5,8))="x.xx.xx."' },
    { name: 'PwRand(values, weights)',  desc: 'Weighted random pick each step: PwRand([0,4,7],[8,2,1]) favours 0' },
    { name: 'PxRand(lo, hi)',           desc: 'Random with no immediate repeat. PxRand([values]) picks from a list' },
    { name: 'PLog(mean, deviation)',    desc: 'Log-normal random floats (int if mean is an integer)' },
    { name: 'PTime(low, high, rnd)',    desc: 'Digits of the wall-clock second as a pattern; with low/high maps digits into [low,high]' },
    { name: 'PSum(n, total)',           desc: 'n durations that sum to total: PSum(3,8) → [3,3,2]' },
    { name: 'PDelta(deltas, start=0)',  desc: 'Cumulative sum: start, start+d0, start+d0+d1, … from a delta list' },
    { name: 'PIndex()',                 desc: 'The step index (0,1,2,3,…)' },
    { name: 'PSquare()',                desc: 'The step index squared (0,1,4,9,…)' },
    { name: 'PFib()',                   desc: 'Fibonacci sequence (PFibMod is an alias)' },
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
    { name: 'PChord(deg, type)',        desc: 'Diatonic chord group on a scale degree — quality follows the Scale. type: triad/7/9/6/sus2/sus4/add9/5/oct. e.g. PChord(0,"7")' },
    { name: 'PRoman("I IV V vi")',      desc: 'Roman-numeral progression → chord groups (I..VII = degrees 0..6). Suffixes work: "V7", "ii7", "Isus4"' },
    { name: 'PProg(name)',              desc: 'Named progression → chords: 50s, pop/axis, 251/jazz, blues, andalusian, minor, canon. Unknown = a roman string' },
    { name: 'PClave(name)',             desc: '16-step clave/bell play()-string: son, rumba, bossa, shiko, soukous, gahu, son23, rumba23. e.g. play(PClave("son"))' },
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
    { name: 'motif(n, range, maxStep)', desc: 'A frozen n-note motif (random walk sampled once) that repeats — like melody()[:n] in one call' },
    { name: 'arp(degrees, mode)',       desc: 'Arpeggiate chord degrees: mode up/down/updown/downup/random. e.g. arp([0,4,7],"updown")' },
    { name: 'PContour(shape, n, range)', desc: 'Melodic contour — n scale degrees in [0,range] following shape: up/down/arch/valley/wave' },
    { name: 'PGroove(name)',            desc: 'Named dur feel: straight/eighths/sixteenths/swing/shuffle/triplet/dotted/gallop/tresillo/habanera. e.g. dur=PGroove("swing")' },
    { name: 'PCircle(n, start, type)',  desc: 'Diatonic circle of fifths as scale degrees (I IV vii iii vi ii V…) — stays coherent with Root/Scale. Pass a chord type for chord groups' },
    { name: 'melody(range, maxStep)',   desc: 'Simple melodic generator — a bounded random walk over scale degrees. Freeze a fixed phrase that repeats with a slice: melody()[:8]' },
    { name: 'pat[:N]  (slice)',          desc: 'Freeze a generator: sample N values once and loop them, so a random source becomes a stable N-step phrase that repeats. e.g. PWhite(0,1)[:8], melody()[:8]. Returns Pslice(pat, start, stop) under the hood' },
    { name: 'P[…].method()  (chain)',    desc: 'STATIC (compose-time) transforms — build a fixed reordered pattern once: P[…] and list generators (PDur, PBeat, PCircle…) chain .rotate(n) .reverse() .mirror() .palindrome() .accum(start) .stretch(n) .trim(n)/.ltrim(n) .loop(n) .stutter(n) .shuffle() .sort() .add(v) .offadd(v)/.offmul(v) .zip(other) .amen(n). NB: only P[…] (not a bare [0,1,2]) has these. To transform LIVE, use the player methods below' },
    { name: '.every(n,"rotate") / .sometimes("mirror")', desc: 'LIVE pattern transforms on a player: .rotate(n) cyclically shifts the degree, .mirror() reverses it (a toggle). Fire them over time to HEAR the change: p1 >> saw([0,2,4,7], dur=1/4).every(4, "rotate")' },
];

export const TIMEVARS = [
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
    { name: 'play(pattern, opts)',      desc: 'Drum/sample pattern. Chars map to samples. space=rest, (Xo)=fire both at once, [XoX]=subdivide into sub-steps, {Xo}=random pick, &lt;Xo&gt;=alternate on successive hits. Quotes optional if pattern has spaces. opts: amp, dur (default 1), pan, rate, sample' },
    { name: 'loop(name, dur, opts)',    desc: 'Beat-synced audio-loop player. Plays a named loop buffer, time-stretched to fit dur beats (so it locks to the tempo). Register loops first with loadloop. opts: amp, pan, rate, sample (variant index), pos (start, sec), stretch (1=warp to dur, 0=natural), looping. e.g. b1 >> loop("break", dur=8)' },
    { name: 'loadloop(name, url)',      desc: 'Load a WAV from a URL (or [urls] for variants) and register it as a named loop for loop(). Same buffer store as samples. e.g. loadloop("break", "https://…/amen.wav")' },
    { name: 'loadsample(char, url)',    desc: 'Load a WAV from a URL (or [urls]) and assign it to a play() char. GitHub raw / release URLs work. e.g. loadsample("K", "https://raw.githubusercontent.com/u/r/main/kick.wav")' },
    { name: 'loadpack(url)',            desc: 'Load a pack: JSON manifest {char: url | [urls]}. Relative URLs resolve against the pack location' },
    { name: 'pbuild(genre, opts)',      desc: 'Genre drum-pattern generator → a play() string. e.g. play(pbuild("techno"), dur=0.25). genre: a name (techno|ebm|dnb|house|breaks|halftime|industrial|reggae|afro) OR an index number (pbuild(0)). opts: evolve (bars before it loops, each a mutation; default 8), fill (a fill every N bars), density (0–1, thins hits), mute, seed. Layer params kick/snare/hat/perc take a literal pattern (kick="X  x "), a genre name (hat="dnb"), or a per-bar GATE: snare=0 (off), snare=1 (on), snare=PBin(4)/{1,0}/<1,0> (toggle per bar). fill/density may be pattern-valued too (sampled per bar). Second arg can be a number = evolve' },
    { name: 'pkit(genre, opts)',        desc: 'Like pbuild but returns a kit for per-layer access: kit = pkit("house"); b1 >> play(kit.kick, dur=0.25); h1 >> play(kit.hat, dur=0.25). Layers: kick, snare, hat, perc' },
    { name: 'genres()',                 desc: 'List the available pbuild/pkit drum genres' },
    { name: 'chaos(n, type)',           desc: 'Generate n random players (synth/drum mix) into g1,g2,… and PASTE them into the editor as a block — does NOT run them; review/edit then evaluate. type "synth"|"drum" forces one kind. Default n=4' },
    { name: 'midiin(synth, opts)',      desc: 'Play incoming MIDI-keyboard notes through a synth: midiin("prophet"). opts: amp (velocity scale), sus (note length secs), transpose (semitones). Notes are fixed-length (synths self-release). midiin(0) unbinds. Chromium/Edge/Brave' },
    { name: 'say(text, opts)',          desc: 'Speak text via the browser (Web Speech API — not scsynth). opts: rate, pitch, volume, voice (name substring). e.g. say("acid line dropping")' },
    { name: 'darker() / lighter()',     desc: 'Walk Scale.default one step along the mode-brightness list (Lydian → major → mixolydian → dorian → minor → phrygian → Locrian). Live modal colour control' },
    { name: 'shutup()',                 desc: 'Stop every player (and the jam bot) — a softer panic than Ctrl+; ' },
    { name: 'swap(a, b, key)',          desc: 'Swap one attribute between two named players live: swap("p1","p2","lpf"). (FoxDot calls this switch — reserved in JS)' },
    { name: 'p1 >> synth(...).once()',  desc: 'Play a single event then stop — one-shot stabs/hits. e.g. p1 >> stab([0,4,7]).once()' },
    { name: 'b1.degree + 2  (ref)',     desc: 'Read another player live: b1 >> bass(p1.degree + 2) tracks p1 a third up each step. Readable attrs: degree, amp, dur, oct, sus, pan, rate, amplify, cutoff. Arithmetic on the ref now works (wrapped in Pmath)' },
    { name: 'p2.follow("p1")',          desc: 'Track another player\'s degree each step (pass the name as a string). p2 >> pluck([0]).follow("p1")' },
    { name: 'p2.accompany("p1", ivs)',  desc: 'Harmonise around another player\'s degree, cycling scale-degree intervals (default [0,2,4]). e.g. .accompany("p1", [0,4])' },
    { name: 'p2.map("p1", table, attr)',desc: 'Drive one of this player\'s attrs from another player\'s degree via a lookup table: p2.map("p1", {0:5, 4:7}). Missing keys pass through. attr defaults to degree' },
    { name: '.jump(n) / .rotate(n)',    desc: 'jump(n): nudge the playhead forward n steps once (live fill). rotate(n): cyclically rotate the degree array live (n>0 left)' },
    { name: '.strum(spread)',           desc: 'Spread a chord/group\'s notes over `spread` beats (arpeggiated strum) instead of firing them together. e.g. p1 >> keys((0,4,7)).strum(0.05)' },
    { name: '.offbeat(amt) / .multiply(n)', desc: 'offbeat(amt=0.5): push every note late by amt beats (land on the offbeat). multiply(n): persistently repeat each step n times within its duration (roll)' },
    { name: 'son(opts) / soff(clear)',  desc: 'Generative jam bot: over time it adds/stops/mutates its own g* players (kept apart from yours; broadcasts to peers in a session). opts: {synth, drum} weights, {min,max} voices, {every:[lo,hi]} beats/tick. soff() stops the loop; soff(true) also stops the g* players. Boot audio first' },
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
    { name: 'midi(cc, lo, hi, curve)', desc: 'Bind a MIDI CC knob/fader to a live value — turn it to sweep any param. Use inline or by assignment: p1.lpf = midi(74, 100, 8000, "exp"). curve: lin (default), exp (cutoffs/freq), log, quad, cubic, sqrt, s (smoothstep) — listed in the MIDI panel. Web MIDI (Chromium/Edge); enables on first use' },
    { name: 'mlearn(lo, hi, curve)',   desc: 'MIDI learn — binds to the NEXT control you touch, then sticks to it. e.g. p1.amp = mlearn(0, 1). One control can drive several params at once (a macro)' },
    { name: 'midiout(deg, ...)',       desc: 'MIDI OUT — send notes to an external/virtual MIDI port instead of audio: m1 >> midiout([0,2,4], channel=1, oct=5, dur=1). Velocity from amp, note length from sus/leg, groups make chords. Pick the port in the MIDI panel (Chromium/Edge; route via IAC/loopMIDI/ALSA-JACK to a DAW)' },
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
export const VERSION = 'alpha28';

// items: a string, or { t: text, ex: examples-anchor-id } to link to a live example.
const CHANGELOG = [
    { v: 'alpha28', title: 'Pop-out visuals (clift)', items: [
        { t: 'Pattern autocomplete now inserts a full, closed call with coherent defaults (0 when unsure) so a pick runs immediately — PDur → PDur(3, 8), PBin → PBin(16), PWalk → PWalk(8, 1, 1), PwRand → PwRand([0,4,7],[8,2,1]), PIndex → PIndex(). PDur/PDelay gained a rotate arg (cyclically shifts the duration list).', ex: 'patterns' },
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
'New FX (FoxDot/CrashServer ports): bpf — resonant band-pass sweep (bpf=center Hz, bpf_rq=bandwidth, small=narrow/resonant); and eq3 — a 3-band EQ (eq3=mix, eqlow/eqmid/eqhigh in dB ±24, with eqlowf/eqmidf/eqmidq/eqhighf to place the bands). Both live in the fx › filters submenu. e.g. p1 >> saw([0,4,7], bpf=1200, bpf_rq=0.2) · b1 >> play(x.o., eq3=1, eqlow=4, eqhigh=-3).',
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
        'New synth a_gesa — aggressive Gesaffelstein-style distorted sub-bass (saw + pulse + sub, tanh distortion, resonant env-swept LPF, softclip). Params: distortion, cutoff, resonance.',
        'New FX djf — a DJ isolator filter (one knob): djf=0.5 is flat, <0.5 sweeps a lowpass down, >0.5 sweeps a highpass up. djfq sets resonance. Great for live builds.',
        'New synth a_daft — Daft Punk-style punchy filter bass (saw stack into an env-driven resonant LPF). Params: cutoff, resonance, punch.',
        'New synth a_hhat — French-electro metallic hi-hat (pitchless noise + ring-mod tones). Params: tone, decay, metallic, distortion, open.',
        'New synth pumpbass — pumping filter bass with a per-note sidechain-style duck. Params: cutoff, res, sub, body, growl, fuzz, fuzzgain, noiz, hpr, pump.',
        'Fix: arithmetic on Pacc (and Pslice) now works — e.g. amp=Pacc("offbeat")*1.3. The pattern-math detector only recognised P + UPPERCASE names, so Pacc*n stayed raw JS ({get}*number = NaN) and killed the voice. Now any P-name is wrapped in Pmath.',
        'New player method .chroma() — put a player on the chromatic scale (degrees become semitones), like .penta() but chromatic. Chainable on a call too: faim([...]).chroma().',
    ]},
    { v: 'alpha25', title: 'Pattern fixes', items: [
        { t: 'Inline random choice with braces now works in degree/param patterns for synths AND play: {a, b, c} picks one each step (like P*[a,b,c]). e.g. v1 >> dbass([0, 2, (4, 2), {2, 4}]) or saw([0,4,7], oct={4,5,6}). Patterns nested inside a list (PRand, {…}, etc.) now resolve each step instead of producing a dead note. Dicts (PChain({0:[1]})) and defsynth bodies are left untouched.', ex: 'patterns' },
        'The live play-position highlight now recognises a {…} random group: it lights the whole group when it is the active step (the pick is random, so it cannot point at one element) instead of mis-tracking a value inside it.',
        'Fix: PStep(n, v, default) now matches its documented FoxDot form — v every n steps, default otherwise (PStep(4,7,6) = [7,6,6,6]). It was reading args as a {step:value} map, so PStep(4,7,6) returned 0 forever.',
        'Nested brackets now work in synth lists too: [0,[4,2]] alternates like <4 2> → 0,4,0,2 (deeper nesting too), so old FoxDot bracket patterns keep working. play() still subdivides. <…> alternation also resolves inside a synth list now.',
        'All synths now share defaults amp=1, pan=0, oct=5; the common params (amp/dur/pan/attack/release) are hidden from autocomplete inserts and the Alt+I signature, leaving just each synth\'s own controls.',
        'Fix: the rgate FX now matches FoxDot/CrashServer chop — rgaterate is slices per beat (tempo-locked to the clock, not a fixed Hz), with 5 wave shapes (pulse/tri/saw/sine/parabola) and a soft floor. chop and fbdelay are tempo-locked automatically now too.',
        { t: 'pbuild gains live, FoxDot-style params: genre can be an index number (pbuild(0)) or a prefix ("indus" → industrial); the layer params kick/snare/hat/perc take a per-bar GATE — snare=0 cuts snares, snare=PBin(4)/{1,0}/<1,0> toggle them per bar; fill/density can be pattern-valued too. Autocomplete now offers pbuild(…) (full call, every knob exposed) inside play().', ex: 'drums' },
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
        { t: 'Fixed: <a b c> alternation now works on synths & params too (saw(<0 4 7>), dur=<1 2>), not just play() strings — cycles each time it\'s reached', ex: 'axis1' },
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

// Turn the Examples tab into a self-documenting editor buffer: section titles
// become headers, explanations (notes) become # comments, code stays runnable.
// Same source as the docs tab, so they never drift.
const _EX_HEADER = [
    '# crashDot examples — put the cursor on a line and press Ctrl+Enter to run it.',
    '# Ctrl+Alt+Enter runs the whole block. Lines starting with # are notes.',
    '',
];
function _wrap(text, width = 78) {
    const words = text.replace(/\s+/g, ' ').trim().split(' ');
    const lines = []; let cur = '';
    for (const w of words) {
        if (cur && (cur + ' ' + w).length > width) { lines.push(cur); cur = w; }
        else cur = cur ? cur + ' ' + w : w;
    }
    if (cur) lines.push(cur);
    return lines;
}
// One .docs-section → runnable buffer text (title header, notes as # comments,
// code verbatim).
function _sectionToCode(sec) {
    const out = [];
    const title = sec.querySelector('.docs-section-title')?.textContent.trim();
    if (title) out.push('# ══ ' + title + ' ══');
    sec.querySelectorAll('.docs-note, .docs-code').forEach(el => {
        if (el.classList.contains('docs-note')) _wrap(el.textContent).forEach(l => out.push('# ' + l));
        else out.push(el.textContent.replace(/\s+$/, ''));
    });
    return out.join('\n');
}

// [{ id, title, cat }] for the example sections, in document order, tagged with the
// category header (.docs-cat) they fall under — so the dropdown can build optgroups
// matching the Examples page exactly.
export function exampleList() {
    const doc = new DOMParser().parseFromString(buildExamples(), 'text/html');
    const out = [];
    let cat = '';
    for (const el of doc.querySelectorAll('.docs-cat, .docs-section')) {
        if (el.classList.contains('docs-cat')) { cat = el.textContent.trim(); continue; }
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
    return _EX_HEADER.join('\n') + '\n' + _sectionToCode(sec) + '\n';
}

// Turn the whole Examples tab into a self-documenting editor buffer.
export function examplesAsCode() {
    const doc = new DOMParser().parseFromString(buildExamples(), 'text/html');
    const out = [..._EX_HEADER];
    doc.querySelectorAll('.docs-section').forEach(sec => { out.push(_sectionToCode(sec)); out.push(''); });
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
b1 >> play(X.[xx]X.x., amplify=PFDur((3,8),(5,8)), amp=0.9)
h1 >> play(<-.><-o>, hpf=6000, amp=Pacc("offbeat"))

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
        ${note('Chars map to samples. <code>.</code> or space = rest. Brackets: <code>(Xo)</code> together · <code>[Xo]</code> subdivide · <code>{Xo}</code> random · <code>&lt;Xo&gt;</code> alternate.')}
        ${code(`b1 >> play(x.o., amp=0.9)              # kick / snare
b2 >> play(x-o-, amp=0.9)                  # - = closed hihat
b3 >> play(x.[oo]x.<o->, amp=0.8)          # subdivide + alternate
b4 >> play((x*)..{o-}.., amp=0.8)          # together + random
b5 >> play(<x.><[--]><x.>, amp=0.8)        # brackets nest
b6 >> play(x-o-, lpf=1500, reverb=0.3)     # FX work on drums
b7 >> play(x-o-).sometimes("stutter", 2)   # probabilistic`)}
        ${note('<b>pbuild(genre)</b> generates a genre drum pattern as a play() string. Genres: techno · ebm · dnb · house · breaks · halftime · industrial · reggae · afro. <code>evolve</code> = bars before it loops (each a mutation, so the groove drifts) · <code>fill</code> every N bars · <code>density</code> 0–1 thins hits · <code>mute</code> a layer · per-layer access via <code>pkit()</code>.')}
        ${code(`b1 >> play(pbuild("techno"), dur=0.25)
b1 >> play(pbuild("house", evolve=8, fill=4, density=0.8), dur=0.25)
b1 >> play(pbuild(0, 16), dur=0.25)                  # genre by index + evolve=16
b1 >> play(pbuild("dnb", snare=PBin(4), hat=<1,0>), dur=0.25)   # gate layers per bar
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

    const axis1 = section('Sequences, chords & groups', `
        ${note('<code>[a,b,c]</code> = a per-step sequence. <code>(a,b,c)</code> = a chord/group fired together — also works on any param (zipped across voices). <code>.</code> = rest.')}
        ${code(`p1 >> saw([0, (0,4,7), 4, (2,5,9)], oct=4)   # chord on steps 2 & 4
p1 >> dbass((0,4,7), oct=4)                  # a held chord
p1 >> saw([0,4,7], pan=(-1,1), amp=(0.6,0.3)) # grouped params zip into voices
p1 >> sine([0, ., 4, .], oct=5)              # . = rest
p1 >> saw(<0 4 7>, dur=<1 2>)                # <..> alternates each time it's reached`)}
    `, 'axis1');

    const sometimes = section('Probability modifiers', `
        ${note('Roll a chance each step and apply a player method. Aliases by likelihood: <code>always</code>(1) · <code>almostAlways</code>(.9) · <code>often</code>(.7) · <code>sometimes</code>(.5) · <code>rarely</code>(.25) · <code>almostNever</code>(.1) · <code>never</code>(0). A leading number overrides the chance. Trailing kwargs temporarily change params for that trigger. Chain several — each rolls on its own.')}
        ${code(`p1 >> saw([0,4,7,5], oct=4).sometimes("stutter", 4)
p1 >> dbass([0,-3], oct=4).often(0.8, "reverse")
b1 >> play(x-o-).rarely("stutter", 2, rate=2, amp=0.6)   # kwargs override
b1 >> play(x.o.).often("stutter", 2).sometimes("stutter", 8)  # chained`)}
    `, 'sometimes');

    const axis2 = section('Time-varying values (var)', `
        ${note('Evolve a parameter over beats. <code>var</code> steps; <code>linvar/sinvar/expvar</code> interpolate. Args: (values, durations-in-beats).')}
        ${code(`p1 >> dbass([0,-3,0,4], oct=4, cutoff=linvar([400, 4000], [8, 8]))
p1 >> saw([0,4,7], cutoff=sinvar([500, 5000], [4]))
p1 >> pulse([0,3], width=var([0.2, 0.5, 0.8], [2, 2, 4]))
p1 >> fm([0,7], index=expvar([1, 12], [16]))`)}
    `, 'axis2');

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

    const fx = section('FX — append to any player', `
        ${note('FX run on a persistent per-player chain. Combine freely — on synths AND on play() drums. Available: lpf hpf crush reverb mverb cheapverb resonbank rgate chorus tremolo tanh echo fbdelay shape dist2 chop multicrush vibrato ringmod flanger phaser formant. (And <code>leg</code> scales note length: leg&gt;1 overlaps, leg&lt;1 staccato.)')}
        ${code(`p1 >> saw([0,4,7], lpf=2000, lpf_rq=0.3)        # low-pass
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
b2 >> play(<X.><o.> [--], amp=0.7)`)}
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
b1 >> play(<x.ox.> [xox] x.x., crush=0.5, bits=4)

#@goto(verse, 0.6)   # 60% back to verse, else resolve

#@end(8)`)}
    `, 'sections');

    const rise = section('Rise', `
        ${note('A live build — evaluate the numbered blocks top to bottom and it rises from a pad intro into driving industrial techno. Shows the tempo-locked <code>rgate</code> + <code>fbdelay</code>, <code>ebass</code> with <code>dist2</code>, a <code>compkick</code>, and <code>pbuild</code> with per-bar layer gates. Boot + load the kit first.')}
        ${code(`Clock.bpm = 126
Root.default = "E"
Scale.default = "minor"

# 1 — pads + a sine motif
p1 >> pads([0, 3, (0,3,7), 5], oct=4, dur=8, attack=2, release=5, reverb=0.6, room=0.9, lpf=linvar([500, 2200], [16]), amp=0.5)
p2 >> sine([7, 5, 3, 0], oct=5, dur=4, amp=0.25, mverb=0.6)

# 2 — the motif picks up a feedback delay
p2 >> sine([0, 3, 5, 7], oct=5, dur=2, amp=0.3, lpf=sinvar([800, 5000], [8]), fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)

# 3 — gated saw + ebass come in
p3 >> saw([0, 0, 7, 0], oct=3, dur=0.25, lpf=sinvar([400, 4000], [8]), rgate=0.7, rgaterate=4, amp=0.3, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)
p4 >> ebass([0, 0, 7, 0], oct=4, dist2=0.6, dist2shape=1, dur=0.25, lpf=sinvar([400, 4000], [8]), rgate=0.7, rgaterate=4, amp=0.3, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)

# 4 — lift the pads an octave
p1 >> pads([0, 3, (0,3,7), 5], oct=6, dur=8, attack=2, release=5, reverb=0.6, room=0.9, lpf=linvar([500, 2200], [16]), amp=0.5)

# 5 — the drop: compkick + industrial drums (snare/hat gated out)
~p2 >> compkick([0], oct=3, punch=4, comp=80, click=40, crunch=120, sub=4, body=0.6, tone=4)
v1 >> play(pbuild("indus", evolve=8, fill=4, density=1, kick=1, snare=0, hat=0, perc=1), dur=1/2, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)
v2 >> play("X ", amp=1)
p4 >> ebass([0, 0, 7, 4], oct=4, dist2=0.6, dist2shape=1, dur=0.25, lpf=sinvar([400, 4000], [8]), rgate=0.7, rgaterate=4, amp=0.3, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)

# 6 — open the saw up an octave
p3 >> saw([0, 0, 7, 0], oct=5, dur=0.25, lpf=sinvar([400, 4000], [8]), rgate=0.7, rgaterate=4, amp=0.3, fbdelay=0.5, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02)`)}
    `, 'rise');

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
b1 >> play(X.[xx]X.x., amplify=PFDur((3,8),(5,8)), amp=0.9)
h1 >> play(<-.><-o>, hpf=6000, amp=Pacc("offbeat"))

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

    const whatsNew = section('New in alpha28', `
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
        ${code(`p1 >> saw([0,4,7], oct=5, dur=1/4, bpf=1200, bpf_rq=0.2, spin=0.6)
b1 >> play("x.o.", eq3=1, eqlow=4, eqhigh=-3, pong=0.5, pongtime=0.375)`)}
        ${note('<b>Live control + player methods</b>.')}
        ${code(`darker()                                # scale one mode darker
p1 >> pads((0,4,7), oct=5, dur=2).strum(0.06)   # arpeggiated chord
p2 >> blip([0,4,7,11], oct=6, dur=1/4).jump(1).multiply(2)`)}
        ${note('<b>MIDI keyboard → synth</b> (Chromium / Edge / Brave). midiin(0) unbinds.')}
        ${code(`midiin("prophet")     # play the prophet synth from a MIDI keyboard`)}
    `, 'alpha28new');

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

    const t_euclid = section('Euclidean rhythms', `
        ${note('PEuclid2 spreads k hits over n steps as a play string, PClave gives classic claves, PDur turns a euclid grid into note durations, PBeat reads a pulse string.')}
        ${code(`Clock.bpm = 120
b1 >> play(PEuclid2(5,8,".","x"), amp=0.8)
h1 >> play(PClave("son"), hpf=6000, amp=0.5)
p1 >> pluck([0,3,5,7], oct=5, dur=PDur(3,8), echo=0.3, amp=0.35)
p2 >> bass([0], oct=3, dur=PBeat("x xx x"), amp=0.5)`)}
    `, 't_euclid');

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

    // Grouped into categories — a <div class="docs-cat"> header precedes each group.
    // exampleList() reads these headers so the dropdown (optgroups) and this page
    // show the exact same sets in the same order.
    const cat = (name) => `<div class="docs-cat">${name}</div>`;
    return [
        cat('New in alpha28'),   whatsNew,
        cat('Live sets'),        rise, showcase,
        cat('Techniques'),       t_chords, t_arps, t_euclid, t_cross, t_live, t_gen,
        cat('Basics'),           welcome, start, drums, synths, tweak,
        cat('Patterns & time'),  axis1, sometimes, axis2, axis3, patterns, grooves, syncGen,
        cat('Sound design'),     fx, defsynthEx, samples, loop,
        cat('Perform & MIDI'),   sections, midi, perf,
    ].join('');
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
    `, 'wf-rec');

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

    return run + nudge + auto + inspectS + perf + compo + rec + inherit + save;
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
