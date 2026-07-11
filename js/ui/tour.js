// Guided tour — an interactive tutorial that lives IN THE EDITOR (no popup).
//
// Pressing 🎓 tour (or evaluating start_guided_tour()) loads Lesson 1 into the
// editor. You read the comments, run the ▶ example lines with Ctrl+Enter, and then
// evaluate  next()  to move on (or  back()  to go back). Your sounds keep playing as
// you progress; Ctrl+; stops everything. It's a real live-coding session that
// teaches itself, top to bottom — booting, synths, editing live, params, loading a
// sample kit, drums, patterns, generators, TimeVars, effects, multiple players,
// autocomplete, and arranging a set.
//
//   const tour = initTour(editor);
//   tour.start();  // ← 🎓 button / start_guided_tour()
//   tour.next();   // ← next()      tour.back(); // ← back()

const TOTAL = 34;
const DIV = '# ───────────────────────────────────────────────────────────────────────────';

function lesson(n, title, body) {
    const head =
`# ═══════════════════════════════════════════════════════════════════════════
#  🎓 TOUR   ·   ${n} / ${TOTAL}   ·   ${title}
# ═══════════════════════════════════════════════════════════════════════════`;
    const last = n >= TOTAL;
    const nav = last
        ? `#  you've finished the tour! 🎉   evaluate   back()   to revisit any lesson.`
        : `#  ▶ evaluate   next()   for the next lesson        ·        back()   to go back`;
    const text = `${head}
${body}

${DIV}
${nav}
${DIV}${last ? '' : '\nnext()'}`;
    return { n, title, text };
}

const LESSONS = [
    lesson(1, 'Welcome — how this tour works',
`# Live coding = you write code, EVALUATE it, and hear sound instantly — then
# change it WHILE it plays. This whole tour happens right here in the editor.
#
# HOW IT WORKS:
#   • Read the # comment lines.
#   • Run the  ▶  example lines: put the cursor on the line, press Ctrl+Enter.
#   • When ready, evaluate  next()  (bottom of each lesson) to continue.
#     back()  goes back ·  tour()  lists every lesson ·  tour(5)  jumps to lesson 5.
#     Your sounds keep playing as you move on — press  Ctrl+;  to stop everything.
#
# FIRST: click  ▸ boot  (top-left) to start the audio engine.
# Then put the cursor on the  next()  line below and press Ctrl+Enter.`),

    lesson(2, 'Your first player',
`# A PLAYER makes sound. It reads:     name  >>  synth( pattern )
#
#   p1          the player's name (ANY name works: p1, bass, lead, d1 …)
#   pluck       the synth — the instrument
#   [0,2,4,7]   the pattern of notes, one per step, LOOPING forever
#
# ▶ Run this (cursor on the line, Ctrl+Enter) — a looping arpeggio:
p1 >> pluck([0, 2, 4, 7])
#
# It keeps going. Editing never stops it — that's the whole idea.`),

    lesson(3, 'Change it while it plays',
`# The magic is editing LIVE. Put the cursor on a number below, press
# Alt+Up / Alt+Down to nudge it, then Ctrl+Enter to hear the change.
#
# ▶ Nudge a number here, re-run, repeat:
p1 >> pluck([0, 2, 4, 7])
#
# Try turning a 4 into a 5, or add notes:  [0, 2, 4, 7, 9, 12]
# Nothing to compile, nothing to restart — just run it again.`),

    lesson(4, 'Params — shaping the sound',
`# After the notes come PARAMS — knobs, written  name=value :
#
#   amp   volume 0–1            dur  note length in beats (1/2 = eighth notes)
#   oct   octave up/down        pan  stereo position (-1 left … 1 right)
#
# ▶ The same synth, shaped — faster, softer, higher, drifting L↔R:
p1 >> pluck([0, 2, 4, 7], dur=1/2, amp=0.5, oct=5, pan=<-0.5 0.5>)
#
# Every synth has its own extra knobs too — autocomplete (lesson 12) finds them.`),

    lesson(5, 'Two kinds of sound — load a kit',
`# There are TWO sound sources:
#   • SYNTHS   made from math (pluck, saw, pads …) — nothing to download.
#   • SAMPLES  recorded audio (drums, hits) — these need a KIT loaded first.
#
# ▶ Load the default kit — evaluate this and WAIT a few seconds for it to finish
#   (progress shows in the log, bottom-left):
loadpack("https://cdn.jsdelivr.net/gh/CrashServer/webfoxdot-kit@v1/pack.json")
#
# Once it says loaded, evaluate  next()  for drums.`),

    lesson(6, 'Drums with play()',
`# play("…") triggers SAMPLES from the kit. Each character is one step:
#
#   x = kick     o = snare     - = hi-hat     .  or space = a rest (silence)
#   X / O louder ·  [xx] = two hits in one step (a roll) ·  <a b> alternates
#
# ▶ A basic beat (needs the kit from lesson 5):
d1 >> play("x-o-")
#
# ▶ Busier — run it to swap the pattern live, no gap:
d1 >> play("x.x.o.[xx]")`),

    lesson(7, 'Patterns — lists, chords, alternation',
`# The list in [ … ] is a PATTERN: one value per step, looping. It's how
# EVERYTHING cycles. Three building blocks:
#
#   [0, 2, 4]    a sequence — one note per step
#   (0, 4, 7)    a CHORD — those notes sound together (a group)
#   <7 9>        ALTERNATE — 7 one cycle, 9 the next, then repeat
#
# ▶ All three in one line:
p1 >> pluck([0, (0,4,7), 4, <7 9>], dur=1/2)`),

    lesson(8, 'Generators — patterns that write themselves',
`# Instead of typing every note, GENERATORS build patterns for you:
#
#   PRand([0,2,4,7])     pick a random note each step
#   PEuclid(3, 8)        a euclidean rhythm — 3 hits spread over 8 steps
#   arp([0,4,7], "up")   arpeggiate a chord: up / down / updown / random
#
# ▶ A random-note line:
p1 >> blip(PRand([0, 2, 4, 7, 9]), dur=1/2, amp=0.5)
#
# TIP: put the cursor on  PRand  and press  Alt+I  for an instant explanation of
# ANY pattern function.`),

    lesson(9, 'TimeVars — values that move',
`# A value can EVOLVE over time — perfect for filter sweeps and slow motion:
#
#   sinvar([300, 4000], [8])   glides 300→4000→300 (a sine) over 8 beats
#   linvar([0, 1], [16])       ramps 0→1 in a straight line over 16 beats
#
# ▶ A saw whose low-pass filter opens and closes on its own:
p1 >> saw([0, 4, 7], dur=1/2, lpf=sinvar([400, 5000], [8]), amp=0.4)
#
# ANY param takes a var — cutoff, amp, pan, dur … everything can breathe.`),

    lesson(10, 'Effects',
`# Effects are just params — add them to any player and stack them:
#
#   lpf / hpf  filters        reverb + room  space        echo + echo_time  delay
#   chorus · drive · crush · chop · … (dozens — autocomplete lists them all)
#
# ▶ A lush pad through reverb and a gentle filter:
p1 >> pads([0, 4, 7], dur=4, sus=4, reverb=0.6, room=0.9, lpf=1400, chorus=0.4, amp=0.4)`),

    lesson(11, 'Many players — layer & control',
`# Players stack: give each a name and they all play together. And you control them:
#
#   Alt+X on a line  → comments it out and STOPS just that player
#   Ctrl+;           → stops EVERYTHING at once
#
# ▶ Run these three (one at a time, or select all + Ctrl+Alt+Enter):
b1 >> pluck([0, 0, 7, 0], oct=3, dur=1/2, amp=0.5)
p1 >> saw([0, 4, 7], dur=1/2, lpf=2000, amp=0.35)
d1 >> play("x-o-")
#
# Now press Alt+X on the b1 line to mute the bass. Ctrl+; stops all.`),

    lesson(12, 'Autocomplete — never memorise',
`# Stuck on what to type? Press  Ctrl+Space :
#
#   after  >>    the list of synths
#   inside ( )   that synth's params + effects
#   after  =     patterns / vars you can drop in
#
# ▶ Click at the END of the next line and press Ctrl+Space to explore:
p1 >>
#
# Arrows move · → / ← open & close a group · Enter / Tab picks · Esc closes.`),

    lesson(13, 'Arranging — sections & sets',
`# For whole tracks, mark SECTIONS with  #@name(bars) . Put the cursor on a #@
# line and Ctrl+Enter — it plays and AUTO-ADVANCES after that many bars.
# #@#@ groups sections into a foldable track.
#
# ▶ A tiny two-part set — put the cursor on  #@a(8)  and press Ctrl+Enter:
#@#@ my_set
#@a(8)
p1 >> pluck([0, 2, 4, 7], dur=1/2)
#@b(8)
p1 >> pluck([7, 4, 2, 0], dur=1/4, echo=0.3)
d1 >> play("x-o-")`),

    lesson(14, 'Part 2 — transforms: reshape a pattern live',
`# ✦ Nice — that's the basics. Part 2 goes deeper.
#
# Chain TRANSFORMS onto a player to reshape it as it plays, periodically:
#
#   .every(8, "reverse")      every 8 bars, reverse the pattern
#   .sometimes("stutter", 2)  now and then, roll a step into 2
#   list methods too:  [0,2,4,7].rotate(1) · .mirror() · .shuffle() · .palindrome()
#
# ▶ A line that keeps mutating itself:
p1 >> pluck([0, 2, 4, 7, 9], dur=1/2).every(8, "reverse").sometimes("stutter", 2)`),

    lesson(15, 'Harmony — scale, chords & progressions',
`# Set the KEY once and everything follows it:
Scale.default = "minor"
Root.default  = "C"
#
#   PChord(0, "7")           a 7th chord on the tonic (a group of notes)
#   PRoman("i VI III VII")   a progression written in roman numerals
#   PProg("pop")             a named progression (I V vi IV)
#
# ▶ A pad drifting through a minor progression:
p1 >> pads(PProg("pop"), oct=4, dur=4, sus=4, reverb=0.6, room=0.9, lpf=1600, amp=0.4)`),

    lesson(16, 'Generative — let the machine surprise you',
`# Two ways to hand over some control:
#
#   chaos()   PASTES a fresh block of random players into the editor — review it,
#             tweak it, then Ctrl+Alt+Enter to run the block (it won't auto-play).
#   son()     starts a "jam bot" that evolves players on its own · soff() stops it.
#
# ▶ Hand the reins to the bot (soff() or Ctrl+; to stop):
son()
#
# ▶ …or generate a block to inspect (it appears below — run it with Ctrl+Alt+Enter):
chaos()`),

    lesson(17, 'Build your own synth — defsynth()',
`# You're not limited to the built-ins — DEFINE your own instrument. Give it a name,
# params, and a build function of UGens; convert pitch with note.midicps(); end with
# Out.ar(...).  (Boot must be done.)
#
# ▶ Select this whole block and press Ctrl+Alt+Enter to define "buzz":
defsynth("buzz", { cutoff: 1500 }, ({ out, note, amp, sus, pan, attack, release, cutoff }) => {
  const env = EnvGen.ar(Env.perc(attack, sus, 1, -4), { doneAction: 2 })
  const sig = RLPF.ar(Saw.ar(note.midicps()), cutoff, 0.4).mul(env).mul(amp)
  Out.ar(out, Pan2.ar(sig, pan))
})
#
# ▶ …then play it like any synth:
p1 >> buzz([0, 3, 7, 3], dur=1/2, cutoff=sinvar([600, 4000], [8]))`),

    lesson(18, 'Record your set',
`# Capture what you make — the buttons live in the right panel (Settings):
#
#   rec code    records your evaluations into a replayable #@ composition
#   rec audio   records the actual audio output to a file (tick "share tab audio")
#
# And  Alt+T  arms the AUTOMATION recorder: nudge a knob with Alt+Up/Down over a few
# beats and it writes the movement as a linvar for you — a hands-on way to automate.
#
# (Nothing to run here — try the buttons whenever you like, then evaluate next().)`),

    lesson(19, 'Jam with other people',
`# crashDot is multiplayer. Two ways in:
#
#   👥 go live   turns your current code into a shared session — send the link and
#               others edit the SAME buffer with you, in sync, cursors and all.
#   🌌 galaxy    a live map of every public jam — click a star to hop into one.
#
# In a session everyone sees each other's evals; the chat is in the right panel.
# (Nothing to run — press go live when you want to share. Then evaluate next().)`),

    lesson(20, 'Perform — solo & mute',
`# Playing live is muting and un-muting. Keyboard, on the line at the cursor:
#
#   Alt+X      comment out + stop this player (toggle it back the same way)
#   Alt+S      SOLO this player (mute the rest) · Ctrl+Alt+S un-solos
#   Alt+O      solo-drop: solo for a few bars, then everything returns
#   Ctrl+;     stop everything
#
# ▶ Run all three (select + Ctrl+Alt+Enter), then press Alt+S on the p1 line:
b1 >> pluck([0, 0, 7, 0], oct=3, dur=1/2, amp=0.5)
p1 >> saw([0, 4, 7], dur=1/2, lpf=2000, amp=0.35)
d1 >> play("x-o-")`),

    lesson(21, 'Pattern toolbox — P[…] methods',
`# P[…] builds a pattern you can TRANSFORM with chainable methods:
#
#   P[0,2,4,7].rotate(1)     shift the sequence along
#   .mirror() · .palindrome() · .shuffle() · .reverse()
#   .stutter(2) · .every(4, "reverse") · .arp([0,4,7]) · .layer("add", 2)
#
# ▶ A self-folding melody:
p1 >> pluck(P[0, 2, 4, 7, 9].palindrome().rotate(1), dur=1/2)`),

    lesson(22, 'Groove & swing',
`# Straight notes feel robotic — add GROOVE with a dur pattern:
#
#   PGroove("swing")   swung feel   ·   "shuffle" · "gallop" · "dotted" · "triplet"
#   PDur(3, 8)         euclidean durations — 3 hits spread across 8
#
# ▶ A swung hat over a galloping bass:
h1 >> play("-.-.-.-.", dur=PGroove("swing"), hpf=6000, amp=0.5)
b1 >> pluck([0, 0, 5, 3], oct=3, dur=PGroove("gallop"), amp=0.5)`),

    lesson(23, 'Bring your own sounds',
`# Load ANY audio by URL — samples, loops, or a whole kit:
#
#   loadsample("z", "https://…/clap.wav")    then use it:   d1 >> play("z-z-")
#   loadloop("brk", "https://…/loop.wav")    a beat-synced loop:  l1 >> loop("brk", dur=4)
#   loadpack("…/pack.json")                  a whole kit at once (lesson 5)
#
# (Swap in a real URL and run it — the placeholders above won't load as-is.)`),

    lesson(24, 'Sets that never repeat — #@goto',
`# #@goto(part, prob) is a zero-length ROUTER: a  prob  chance to jump to another
# section, else fall through. Chain them for a set that branches differently every
# time — a Markov-style arrangement.
#
# ▶ Cursor on  #@a(8)  and Ctrl+Enter — it may loop A or move to B, 50/50:
#@#@ branching
#@a(8)
p1 >> pluck([0, 2, 4, 7], dur=1/2)
#@goto(a, 0.5)
#@b(8)
p1 >> pluck([7, 4, 2, 0], dur=1/4, echo=0.3)`),

    lesson(25, 'MIDI — play external gear',
`# crashDot speaks MIDI: drive hardware synths & drum machines, or play from a
# controller. Turn it on with the MIDI button (right panel), then:
#
#   m1 >> midiout([0, 4, 7], channel=0, oct=5, dur=1/2)   send notes out
#   midiin()      play the built-in synths FROM a keyboard
#   mlearn()      wiggle a knob to map it to a param (MIDI CC)
#
# (Needs a MIDI device + the browser's permission — nothing to run without one.)`),

    lesson(26, 'Autocomplete in depth',
`# Ctrl+Space is CONTEXT-AWARE — it offers exactly what fits where the cursor is:
#
#   after  name >>      synths, grouped by family (bass · lead · keys · pads …)
#   inside ( )          that synth's params + an  fx  group
#   the  fx  group      unfolds by family: filters · reverbs · delays · distortion …
#                       picking one inserts its whole knob set (e.g. reverb + room)
#   after  param =      patterns & vars (PRand, PEuclid, sinvar, var …)
#   Scale.default = "   scale names   ·   pal="   palette names
#
# ▶ Click just after the  (  below, press Ctrl+Space, open the  fx  group, pick one:
p1 >> pluck([0, 2, 4, 7])
#
# → / ← open & close a group · ↑ ↓ move · Enter / Tab picks · Esc closes.`),

    lesson(27, 'More patterns',
`# Patterns are the heart of it. A tour of GENERATORS (cursor on any → Alt+I):
#
#   PRand · PWhite · PWalk        random picks & drunk walks
#   PEuclid(3,8) · PDur · PBeat    rhythms (hits/durations spread over a span)
#   PStep · PRange · PSine         shapes & ramps
#   arp · PArp · melody            arpeggios & phrases
#
# Patterns NEST — one inside a list resolves each step:
#   [0, {2, 4}, 7]    picks 2 or 4 randomly on that step
#   [0, [4, 2]]       a sub-sequence (4 then 2) inside one step
#
# ▶ A random accent note with euclidean note-lengths:
p1 >> pluck([0, {2, 4}, 7, 4], dur=PDur(3, 8), amp=0.5)`),

    lesson(28, 'Shortcuts & navigation',
`# The shortcuts worth knowing (all work while editing):
#
#   Ctrl+Enter      run the line at the cursor      Ctrl+Alt+Enter  run the block
#   Alt+Up / Down   nudge the number under the cursor, live
#   Alt+X           comment out + stop this player   Ctrl+;   stop everything
#   Alt+I           explain the function at the cursor
#   Ctrl+Space      autocomplete                     Ctrl+/   toggle comment
#   Alt+T           record a knob move as automation
#   Ctrl+Alt+P      JUMP to the ACTIVE section — where the running set is right now
#   Shift+Alt+Z     zen mode (hide all UI)  ·  F1 / ?  docs
#
# Ctrl+Alt+P is the "go to composition position" jump — handy in a long #@ set.`),

    lesson(29, 'Handy functions',
`# Global helpers you can evaluate any time:
#
#   drop(14, 2)                a build → filter-sweep DROP over the running players
#   shutup()                   stop every player (a softer Ctrl+;)
#   swap("p1", "p2", "degree") swap one attribute between two players, live
#   darker() / lighter()       shift the scale's mood one mode at a time
#   linbpm(120, 140, 16)       glide the tempo 120→140 over 16 beats
#   say("hi")   print("…")     speak / log
#
# ▶ Get two players going, then evaluate  drop(8, 2)  to hear a build + drop:
p1 >> saw([0, 4, 7], dur=1/2, lpf=1500, amp=0.4)
b1 >> pluck([0, 0, 7, 0], oct=3, dur=1/2, amp=0.5)`),

    lesson(30, 'Live-tweak — change one knob mid-flight',
`# You don't have to retype a whole line to change one thing. On a RUNNING player:
#
#   p1.lpf = linvar([500, 5000], [8])   set just ONE attribute (here, a filter sweep)
#   p1.every(8, "reverse")              attach a transform without restarting it
#   ~p1 >> pluck([0, 4])                the  ~  RESETS a player (drops inherited knobs)
#
# ▶ Start this, then run the p1.lpf line below it to sweep the filter live:
p1 >> saw([0, 4, 7, 9], dur=1/2, amp=0.4)
p1.lpf = linvar([500, 5000], [8])`),

    lesson(31, 'Rests, gaps & dynamics',
`# Silence shapes a groove as much as notes:
#
#   [0, _, 4, _]        _  (or  rest ) = a true rest — a hole in the pattern
#   play("x. .x")       .  or space = a rest between hits
#   amp=[0.6, 0.3]      per-step volume · amplify=Pacc("offbeat") = ready-made accents
#
# ▶ A bass with rests, and a hat with offbeat accents (needs the kit for the hat):
p1 >> pluck([0, _, 0, _, 7, _], oct=3, dur=1/4, amp=0.5)
h1 >> play("-.-.-.-.", amplify=Pacc("offbeat"), hpf=6000)`),

    lesson(32, 'Lock players together',
`# Players can WATCH each other so parts move as one:
#
#   p1.degree           reference another player's current note inside a pattern
#   p2.follow("p1")     make p2 track p1's degree every step
#   p1.reroll(8)        auto-re-evaluate every 8 beats (frozen randoms reroll on their own)
#
# ▶ A pad, and a bass that plays the pad's root two octaves down:
p1 >> pads([0, 3, 5, 4], oct=5, dur=2, amp=0.4, reverb=0.5)
b1 >> bass(p1.degree, oct=2, dur=2, amp=0.5)`),

    lesson(33, 'Save, share & recall',
`# Your work is safe and shareable:
#
#   • the editor AUTO-SAVES to this browser — reload the page and it's still here.
#   • ⤴ share (top bar) copies a self-contained LINK: the whole composition rides in
#     the URL, so anyone who opens it gets your exact code — no server needed.
#   • rec code (right panel) records your evals into a replayable #@ set;
#     rec audio captures the sound itself to a file.
#
# (Nothing to run — press ⤴ share once you've made something you like.)`),

    lesson(34, 'You’re ready ✨',
`# That's the whole loop:   WRITE  →  RUN (Ctrl+Enter)  →  CHANGE  →  run again.
#
# Where to go next:
#   • examples ▾ (top bar)  full tracks & techniques — click one to load it
#   • the  ?  button        docs: every synth, effect, pattern & shortcut
#   • 🌌 galaxy             browse & jam with other people, live
#
# Now clear this buffer (Ctrl+A, Delete) and make something of your own.
# Welcome aboard!`),
];

let editor = null, idx = 0, active = false;

export function initTour(_editor) {
    editor = _editor;
    return { start, next, back, list, go, isActive: () => active, notify() {} };
}

// [{ n, title }] for every lesson — for tour() to print a menu.
function list() { return LESSONS.map(l => ({ n: l.n, title: l.title })); }
// Jump straight to lesson n (1-based), starting the tour there if needed.
function go(n) {
    const i = Math.round(Number(n)) - 1;
    if (i >= 0 && i < LESSONS.length) { active = true; idx = i; show(); }
    return '';
}

function show() {
    const text = LESSONS[idx].text;
    editor.setValue(text);
    // Drop the cursor on the first runnable line (the ▶ example) so Ctrl+Enter works
    // right away; if the lesson has no example, land on next()/back().
    const lines = text.split('\n');
    let target = -1;
    for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (t && !t.startsWith('#') && t !== 'next()' && t !== 'back()') { target = i; break; }
    }
    if (target < 0) for (let i = lines.length - 1; i >= 0; i--) { const t = lines[i].trim(); if (t === 'next()' || t === 'back()') { target = i; break; } }
    if (target < 0) target = 0;
    editor.setCursor({ line: target, ch: lines[target].length });
    editor.scrollTo(0, 0);
    editor.focus();
}

function start() { active = true; idx = 0; show(); }
function next() { if (!active) return ''; if (idx < LESSONS.length - 1) { idx++; show(); } return ''; }
function back() { if (!active) return ''; if (idx > 0) { idx--; show(); } return ''; }
