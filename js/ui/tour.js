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
//
// The lessons are DATA (EN[] · FR[] · DE[] · ES[] · JA[]); the engine is shared.
// Language follows the app's lang setting, per-lesson falling back to English. To
// translate a language, edit its content array — no code changes. Example CODE stays
// English (the tool's language); only the # prose is translated.

import { getLang } from '../i18n/lang.js';

const TOTAL = 40;
const DIV = '# ───────────────────────────────────────────────────────────────────────────';

// Localised chrome (header word + footer navigation).
const LABEL = {
    en: { tour: 'TOUR',
          next: `#  ▶ evaluate   next()   for the next lesson        ·        back()   to go back`,
          done: `#  you've finished the tour! 🎉   evaluate   back()   to revisit any lesson.` },
    fr: { tour: 'VISITE',
          next: `#  ▶ évaluez   next()   pour la leçon suivante        ·        back()   pour revenir`,
          done: `#  visite terminée ! 🎉   évaluez   back()   pour revoir une leçon.` },
    de: { tour: 'TOUR',
          next: `#  ▶ werte   next()   für die nächste Lektion aus        ·        back()   zurück`,
          done: `#  Tour abgeschlossen! 🎉   werte   back()   aus, um eine Lektion erneut anzusehen.` },
    es: { tour: 'TOUR',
          next: `#  ▶ evalúa   next()   para la siguiente lección        ·        back()   para volver`,
          done: `#  ¡tour terminado! 🎉   evalúa   back()   para repasar cualquier lección.` },
    ja: { tour: 'ツアー',
          next: `#  ▶  next()  を評価すると次のレッスンへ        ·        back()  で前に戻る`,
          done: `#  ツアー完了！ 🎉   back()  を評価すると、どのレッスンにも戻れます。` },
};

function lesson(n, title, body, lang = 'en') {
    const L = LABEL[lang] || LABEL.en;
    const head =
`# ═══════════════════════════════════════════════════════════════════════════
#  🎓 ${L.tour}   ·   ${n} / ${TOTAL}   ·   ${title}
# ═══════════════════════════════════════════════════════════════════════════`;
    const last = n >= TOTAL;
    const nav = last ? L.done : L.next;
    const text = `${head}
${body}

${DIV}
${nav}
${DIV}${last ? '' : '\nnext()'}`;
    return { n, title, text };
}

const EN = [
    lesson(1, 'Welcome — how this tour works',
`# Live coding = you write code, EVALUATE it, and hear sound instantly — then
# change it WHILE it plays. This whole tour happens right here in the editor.
#
# 🌍  Prefer another language? Put the cursor on one of these lines and press Ctrl+Enter:
language("fr")   # français — place le curseur sur cette ligne et fais Ctrl+Entrée
language("de")   # Deutsch — Cursor auf diese Zeile setzen, dann Strg+Enter
language("es")   # español — pon el cursor en esta línea y pulsa Ctrl+Enter
language("ja")   # 日本語 — この行にカーソルを置いて Ctrl+Enter
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
p1 >> pluck([0, 2, 4, 7], dur=1/2, amp=0.5, oct=5, pan=[-0.5, 0.5])
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
#   X / O louder ·  <xx> = two hits in one step (a roll) ·  [a b] alternates
#
# ▶ A basic beat (needs the kit from lesson 5):
d1 >> play("x-o-")
#
# ▶ Busier — run it to swap the pattern live, no gap:
d1 >> play("x.x.o.<xx>")
#
# ▶ [a b] in action — the 2nd step flips x → o → x → o … once each time the
#   WHOLE pattern loops back (not every step — <x o> would be a fast roll instead):
d1 >> play("x[xo]")`),

    lesson(7, 'Patterns — lists, chords, subdivision',
`# The list in [ … ] is a PATTERN: one value per step, looping. Brackets mean the
# SAME thing here as in play():
#
#   [0, 2, 4]      a sequence — one value per step
#   (0, 4, 7)      a CHORD — those notes sound together (a group)
#   [0, [7, 9]]    a NESTED list ALTERNATES — 7 one cycle, 9 the next, then repeat
#   <7 7 7>        SUBDIVISION — cram those into ONE step (a ratchet/flam)
#   {0, 4, 7}      RANDOM — pick one each step
#
# ▶ All of it in one line — the 3rd slot ratchets, the last alternates:
p1 >> pluck([0, (0,4,7), <4 4 4>, [7, 9]], dur=1/2)`),

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
# Now press Alt+X on the b1 line to mute the bass. Ctrl+; stops all.
# The Players panel (right sidebar) lists everything currently playing — your live overview.`),

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
# #@#@ groups sections into a foldable track ·  #@end  stops the set at the finish.
#
# Watch the Composition panel (right sidebar) while it runs: it lists the parts and
# shows a live progress bar of where the set is — click a part to jump there.
#   Ctrl+Alt+P  jump to the ACTIVE part   ·   Ctrl+Alt+;  (or ■ stop autoplay in the
#   panel) halts the auto-advance but leaves players running   ·   Ctrl+;  stops all.
#
# ▶ A tiny two-part set — put the cursor on  #@a(8)  and press Ctrl+Enter:
#@#@ my_set
#@a(8)
p1 >> pluck([0, 2, 4, 7], dur=1/2)
#@b(8)
p1 >> pluck([7, 4, 2, 0], dur=1/4, echo=0.3)
d1 >> play("x-o-")
#@end`),

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
`# Set the KEY once and everything follows it — in code, or with the Scale & Root
# dropdowns in the right-side panel (under Clock):
Scale.default = "minor"
Root.default  = "C"
#
#   PChord(0, "7")           a 7th chord on the tonic (a group of notes)
#   PRoman("i VI III VII")   a progression written in roman numerals
#   PProg("pop")             a named progression (I V vi IV)
#
# ▶ A pad drifting through a minor progression:
p1 >> pads(PProg("pop"), oct=(6, 7), dur=4, sus=4, reverb=0.6, room=0.9, lpf=1600, amp=0.4)`),

    lesson(16, 'Generative — let the machine surprise you',
`# Two ways to hand over some control:
#
#   chaos()   PASTES a fresh block of random players into the editor — review it,
#             tweak it, then Ctrl+Alt+Enter to run the block (it won't auto-play).
#   son()     starts a "jam bot" that evolves players on its own. It KEEPS RUNNING
#             until you STOP it — soff() ends the bot (the ■ stop button / Ctrl+; too).
#
# ▶ Hand the reins to the bot — then STOP it with  soff()  when you've had enough:
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

    lesson(18, 'Record your set · themes',
`# The right panel (Settings) holds a few live-set tools:
#
#   Theme       a dropdown of 8 skins (top of Settings) — Dark, Nova, Synthwave,
#               Hacker, Sakura, Paper… changes colours instantly, saved for next time.
#   rec code    records your evaluations into a replayable #@ composition
#   rec audio   records the actual audio output to a file (tick "share tab audio")
#
# And  Alt+T  arms the AUTOMATION recorder: nudge a knob with Alt+Up/Down over a few
# beats and it writes the movement as a linvar for you — a hands-on way to automate.
#
# ▶ Prefer the keyboard? Switch skin from code (theme() alone lists them all):
theme("synthwave")   # · solar · fiesta 🎉 · sakura · hacker · nova · paper · brutalist · cyberpunk · dark
#
# (The rec buttons need no code — try them whenever, then evaluate next().)`),

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
`# Straight notes feel robotic — add GROOVE with a dur pattern. The catch: groove is a
# pattern of DURATIONS, so it only swings CONSECUTIVE hits. On an on/off pattern like
# "-.-.-." each hit+rest pair fills a whole beat and the swing cancels out — so use a
# SOLID hit ("-" loops one hat every step) to actually hear it:
#
#   PGroove("swing")   a named feel · "swing16" · "shuffle" · "gallop" · "triplet" · …
#   PGroove(3)         pick a groove by NUMBER · PGroove([0, 2, 5]) cycles grooves
#   PGroove(var([0,3],8))   the feel MORPHS over time — a var/pattern picks the groove
#   PDur(3, 8)         euclidean durations — 3 hits spread across 8
#
# ▶ A swung 16th hat (every step a hit, so the swing is audible) over a galloping bass:
h1 >> play("-", dur=PGroove("swing16"), hpf=6000, amp=0.5)
b1 >> pluck([0, 0, 5, 3], oct=3, dur=PGroove("gallop"), amp=0.5)
#
# ▶ Same hat, but the feel drifts — the var swaps the groove every 8 steps:
h1 >> play("-", dur=PGroove(var([0, 3, 8], 8)), hpf=6000, amp=0.5)`),

    lesson(23, 'Bring your own sounds',
`# Load ANY audio by URL — samples, loops, or a whole kit:
#
#   loadsample("z", "https://…/clap.wav")    then use it:   d1 >> play("z-z-")
#   loadloop("brk", "https://…/loop.wav")    a beat-synced loop:  l1 >> loop("brk", dur=4)
#   loadpack("…/pack.json")                  a whole kit at once (lesson 5)
#
# (Swap in a real URL and run it — the placeholders above won't load as-is.)`),

    lesson(24, 'Sets that never repeat — #@goto',
`# #@goto(part, prob) is a zero-length ROUTER: a  prob  chance to jump to that section,
# else fall THROUGH to the next line. Chain several and you get weighted multi-way
# branching — a Markov-style set that takes a different path every play, forever.
#
# ▶ Cursor on  #@intro(8) , Ctrl+Enter, then just listen — the arrows under each part
#   decide where it goes next (needs the kit from lesson 5 for the drums):
#@#@ markov_set
#@intro(8)
p1 >> pads([0, 4], oct=(5, 6), dur=4, sus=4, reverb=0.7, lpf=1200, amp=0.3)
#@goto(intro, 0.3)      # 30%: linger in the intro — else roll into the verse
#@verse(16)
p1 >> pads([0, 4, 5, 3], oct=5, dur=4, sus=4, reverb=0.5, lpf=1600, amp=0.3)
b1 >> bass([0, 0, 5, 3], oct=3, dur=1/2, amp=0.5)
d1 >> play("x-o-", dur=1/2)
#@goto(chorus, 0.5)     # 50%: jump to the chorus — else fall to the bridge
#@bridge(8)
p1 >> pluck([7, 9, 11, 7], oct=4, dur=1/4, echo=0.3, amp=0.4)
b1 >> bass([5, 5, 3, 0], oct=3, dur=1/2, amp=0.5)
d1 >> play("x-o-", dur=1/2)
#@goto(verse, 0.6)      # 60%: back to the verse — else on to the chorus
#@chorus(16)
p1 >> pluck([0, 4, 7, 4], oct=4, dur=1/4, amp=0.4).unison(2)
b1 >> bass([0, 3, 5, 7], oct=3, dur=1/4, amp=0.5)
d1 >> play("x-<oo>", dur=1/2)
h1 >> play("-", dur=1/4, hpf=6000, amp=0.35)
#@goto(drop, 0.4)       # 40%: into the drop …
#@goto(verse, 1)        # … the other 60%: back to the verse (chained gotos = multi-way)
#@drop(8)
p1 >> pluck([0, 0, 0, 0], oct=4, dur=1/4, amp=0.3).unison(3)
b1 >> bass([0], oct=2, dur=1/4, drive=3, amp=0.6)
d1 >> play("X", dur=1/4, amp=0.9)
#@goto(verse, 1)        # the drop always resolves back to the verse
#@end`),

    lesson(25, 'MIDI — play external gear',
`# crashDot speaks MIDI: drive hardware synths & drum machines, or play from a
# controller. Turn it on with the MIDI button (right panel), then:
#
#   m1 >> midiout([0, 4, 7], channel=0, oct=5, dur=1/2)   send notes out
#   midiin()                                              play the built-in synths FROM a keyboard
#
# ▶ Assigning a param to MIDI is an ASSIGNMENT, same as any other var — mlearn()
#   just fills in the CC for you. Evaluate this, then wiggle any knob/fader on
#   your controller; it latches onto whichever CC it saw move:
p1 >> pluck([0, 4, 7], dur=1/2)
p1.lpf = mlearn(200, 8000)
#
# Already know the CC number? Skip the wiggle — midi(cc, lo, hi) binds straight
# to it: p1.lpf = midi(74, 200, 8000).
#
# ▶ Faster still: put the cursor ON a number (like the 800 below) and press
#   Alt+M. It rewrites that number into mlearn(…) itself (bounds guessed from
#   the value) and runs the line for you — no retyping:
p1 >> pluck([0, 4, 7], cutoff=800, dur=1/2)
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
# ▶ Click just BEFORE the closing  )  below (right after the pattern), press Ctrl+Space,
#   open the  fx  group, pick one:
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
#   Alt+M           MIDI-learn the number under the cursor (lesson 25)
#   Ctrl+Space      autocomplete                     Ctrl+/   toggle comment
#   Alt+T           record a knob move as automation
#   Ctrl+Alt+P      JUMP to the ACTIVE section — where the running set is right now
#   Shift+Alt+Z     zen mode (hide all UI)  ·  F1  docs
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
# ▶ A bass with rests, and a steady hat whose OFFBEATS are accented (needs the kit).
#   The hat is a solid "-" every step so the accents actually land on hits:
p1 >> pluck([0, _, 0, _, 7, _], oct=3, dur=1/4, amp=0.5)
h1 >> play("-", amplify=Pacc("offbeat"), hpf=6000, dur=1/4)`),

    lesson(32, 'Lock players together',
`# Players can WATCH each other, so parts move as one. Four ways to link them:
#
#   p1.degree         a LIVE reference to p1's current note — drop it into another
#                     player's args and that player tracks p1 note-for-note (here the
#                     bass plays p1's root, its own octave & duration).
#   .follow("p1")     shortcut for the same idea: play p1's degree every step — a
#                     UNISON double, but with your own synth / oct / dur.
#   .accompany("p1")  HARMONISE: p1's note plus a cycling chord shape ([0,2,4] thirds
#                     by default) — an automatic harmony line that tracks the melody.
#   p1.reroll(8)      re-evaluate p1 every 8 bars, so a frozen random (PRand, a
#                     shuffled motif…) rolls fresh each time instead of repeating.
#
# ▶ A pad, a bass on its root, a unison double, and a harmony — all locked to p1:
p1 >> pads([0, 3, 5, 4], oct=5, dur=2, amp=0.4, reverb=0.5)
b1 >> bass(p1.degree, oct=4, dur=2, amp=0.5)
b3 >> blip(dur=1/2, oct=4, mverb=0.1, spin=0.5, pan=[-1, 1]).follow("p1")
b4 >> blip(dur=1/4, oct=4).accompany("p1").unison(3)`),

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

    lesson(34, 'Tempo & the clock',
`# Everything rides on one CLOCK. Set the tempo in beats-per-minute:
Clock.bpm = 132
# The Clock panel (right sidebar) shows the current BPM live — you can also type in
# that field, or TAP the tap button in time and it reads the tempo from your taps.
#
# Tempo can MOVE too — Clock.bpm takes a TimeVar, so it ramps like any param:
#   Clock.bpm = linvar([120, 140], [16])   # glide 120→140 over 16 beats
#   linbpm(120, 140, 16)                    # same, as a helper · dropbpm(90, 8) from now
#
# ▶ Start a line, then ramp the tempo under it:
p1 >> pluck([0, 2, 4, 7], dur=1/2)
Clock.bpm = linvar([110, 150], [8])
#
# QUANTISE — why layers stay locked: a new player's first note lands on the next beat
# that's a multiple of its dur. So dur=4 waits for the bar, dur=1/4 starts almost at
# once — add players any time and they snap to the grid (Alt+X stop waits for the bar
# too). Clock.meter is beats-per-bar; Clock.nextBar(fn) / Clock.mod(4, fn) run your own
# one-shots on the grid.`),

    lesson(35, 'Fatten & widen — .unison()',
`# .unison(n) layers n DETUNED copies of a voice, spread across the stereo field — an
# instant "supersaw" thickness and width from one line. Tune it with detune & spread:
#
#   .unison(3)            3 voices, gentle default detune, full-width spread
#   .unison(5, 0.3)       5 voices, ±0.3-semitone detune (wider = more shimmer)
#   .unison(4, 0.2, 60)   4 voices, tighter detune, 60% stereo width
#
# It works on samples too — each copy is pitch-shifted and panned.
#
# ▶ The same line, dry then fattened — run each and hear it bloom:
p1 >> saw([0, 4, 7], oct=5, dur=1/2, lpf=2000, amp=0.35)
p1 >> saw([0, 4, 7], oct=5, dur=1/2, lpf=2000, amp=0.35).unison(5, 0.3)
#
# Great on leads, pads and basses. Keep n small on busy parts — each voice is a real
# extra note, so it costs CPU. Pair with reverb for a huge wall of sound.`),

    lesson(36, 'The mixer — perform your tracks live',
`# The MIXER (🎚 mix, top toolbar) is a live desk + CLIP-LAUNCHER for your tracks. It
# floats and is NON-MODAL — keep coding while it's open.
#
# ▶ Run this 4-part set (NO #@end, so it plays on forever). Cursor on #@ intro(16),
#   Ctrl+Enter — then open  🎚 mix  and perform it. Each part redefines the SAME tracks:
#@ intro(16)
bass  >> dbass(dur=4, mverb=0, chop=0)
drum  >> a_bd(dur=1, oct=3)
bass2 >> ebass([0, <0 5>, 3, 0], oct=4, dur=1, amp=0.5, tremolo=0.48, trem_rate=4).every(16, "rotate")
#@ main(16)
bass  >> dbass(dur=1/2, mverb=0, chop=0)
drum  >> a_bd(dur=1, oct=3)
bass2 >> ebass([0, <0 5>, 3, 0], oct=4, dur=1, amp=0.5, tremolo=0.48, trem_rate=4).every(16, "rotate")
#@ var(16)
bass  >> dbass(dur=1/2, mverb=0.5, chop=4)
drum  >> a_bd(dur=1, oct=3)
bass2 >> ebass([0, <0 5>, 3, 0], oct=5, dur=1, amp=0.5, tremolo=0.48, trem_rate=4).every(16, "rotate")
#@ outro(16)
bass  >> dbass(dur=1/2, mverb=0.6, chop=4)
drum  >> a_bd(dur=1, oct=3)
bass2 >> ebass([0, <0 5>, 3, 0], oct=5, dur=1/2, amp=0.7, tremolo=0.48, trem_rate=4).every(16, "rotate")
#
# Now click  🎚 mix. Each track is a vertical strip:
#   • FADER   its volume — shared per NAME, and kept SEPARATE from amplify, so
#             mute / solo / drop can never wipe your mix. Mirrors the Players panel.
#   • S / M   SOLO and MUTE — shared with the Players panel AND code .solo()/drop(),
#             so all three always agree.
#   • ■       STOP, quantised to the next bar.
#   • m       MIDI-learn — click it, move a hardware fader, and that CC drives the level.
#
# LAUNCH: tap a track's NAME to evaluate its line and start it on its own — no autoplay
# needed. The SOURCE picker (auto · a chip per #@ part) chooses which part's version a
# launch pulls from, so you can fire  bass  DRY from 'intro', then relaunch it WET from
# 'var' (its mverb + chop) while  bass2  climbs an octave — a whole set built by hand.
#
# ▶ Run .solo() here and watch the S light up in BOTH the mixer and the Players panel:
bass.solo(8)`),

    lesson(37, 'Parameter envelopes — lpf_ and the _ sweeps',
`# Add "_" to an FX parameter and it becomes an ENVELOPE — a shape that MOVES that
# param within each note. The classic is a filter sweep: lpf_ glides the low-pass
# cutoff every time a note fires.
#
# Three shapes, each written f(dur, a, b) — dur in BEATS, a & b the two endpoints:
#   fi(dur, a, b)   fade IN   —  a → b, then holds at b
#   fo(dur, a, b)   fade OUT  —  b → a, then holds at a   (fi's mirror)
#   fb(dur, a, b)   BOUNCE    —  a ↔ b triangle, looping every dur (for the note's sus)
#
# ▶ Each pluck OPENS its filter, 400 → 4000 Hz over one beat:
p1 >> pluck([0, 2, 4, 7], dur=1, lpf_=fi(1, 400, 4000))
#
# ▶ The mirror — each note CLOSES, 4000 → 400 (that quacky "pluck" shape):
p1 >> pluck([0, 2, 4, 7], dur=1, lpf_=fo(1, 400, 4000))
#
# ▶ Bounce = a wobble. Hold ONE long note and the cutoff see-saws every half beat:
b1 >> bass([0], dur=8, sus=8, lpf_=fb(1/2, 300, 4000))
#
# The envelope plays over the note's SUS, so give it room — a short note only shows the
# START of a slow sweep. Longer sus = the whole shape unfolds:
p1 >> pads([0, 4, 7], dur=4, sus=4, lpf_=fi(4, 300, 6000))
#
# RESONANCE makes a sweep SING. lpr is the low-pass resonance (LOWER = sharper peak;
# 0.7 default, ~0.15 = squelchy). Note lpr is a SEPARATE param from lpf_ :
b1 >> bass([0, 0, 3, 5], oct=4, dur=1/2, lpf_=fi(1/2, 200, 3500), lpr=0.15)`),

    lesson(38, 'Envelopes everywhere — any FX param + clock-sync',
`# It's not only the filter — EVERY effect param takes a "_" envelope: crush_, reverb_,
# chorus_, echo_, hpf_, djf_ … the same fi / fo / fb shapes sweep that effect per note.
#
# ▶ bit-depth cleaning up — starts gritty (4 levels) and smooths to 16:
p1 >> pluck([0, 2, 4, 7], dur=1, crush=0.6, bits_=fi(1, 4, 16))
#
# ▶ reverb SWELLING in over two beats (dry → drenched):
p1 >> pads([0, 4], dur=4, sus=4, reverb_=fi(2, 0, 0.9), room=0.9)
#
# ▶ a high-pass sweeping up = a riser / filter-out:
d1 >> play("x-o-", dur=1/2, hpf_=fi(4, 100, 4000))
#
# TWO MODES — the "_" is the switch:
#   lpf_=fb(1, 400, 4000)   PER-NOTE: the shape RESTARTS on every note (timed from when
#                           that note fired) — each note gets its own fresh sweep.
#   lpf =fb(8, 400, 4000)   NO "_": ONE clock-synced value shared by everything — a
#                           global LFO on the timeline, so every player moves together.
# ▶ Run both — same wobble, per-note vs global:
p1 >> pluck([0, 2, 4, 7], dur=1/2, lpf_=fb(1, 400, 4000))
b1 >> bass([0], dur=8, sus=8, lpf=fb(8, 400, 4000))
#
# GOTCHAS: "_" envelopes work only on EFFECT params (filters, reverb, crush, echo,
# chorus, djf …) — NOT the note params amp / oct / dur / pan. To move those, use a
# var() (lesson 9). And don't confuse  lpf_  (the envelope) with  lpr  (resonance).`),

    lesson(39, 'Glissando — .slider()',
`# .slider() makes a player GLIDE in pitch between notes — a portamento sweep.
# Chain it onto any melodic synth (basses, saws, leads, keys, plucks).
#
# ▶ The default alternates a steady note and a swept one:
b1 >> bass([0, 3, 5, 7], dur=1/2).slider()
#
# ▶ .slider(1) flips the phase — the OTHER notes sweep:
b1 >> bass([0, 3, 5, 7], dur=1/2).slider(1)
#
# PER-NOTE control — pass a PATTERN of 0/1: 1 = glide THIS note · 0 = steady.
# ▶ every 3rd note glides:
p1 >> pluck([0, 2, 4, 7], dur=1/2).slider([0, 0, 1])
#
# ▶ a var lets the glide breathe over time (mostly steady, then bursts of glide):
d1 >> dbass([0, 3, 5], dur=1/2).slider(var([0, 1], [6, 2]))
#
# Turn it off with .slider(0, 0). On synths with no pitch-glide (drums/samples)
# it's a harmless no-op — safe to chain anywhere. Killer on acid basslines & leads.`),

    lesson(40, 'You’re ready ✨',
`# That's the whole loop:   WRITE  →  RUN (Ctrl+Enter)  →  CHANGE  →  run again.
#
# Where to go next:
#   • examples (top bar)  full tracks & techniques — click one to load it
#   • the docs button     every synth, effect, pattern & shortcut
#   • galaxy              browse & jam with other people, live
#
# Now clear this buffer (Ctrl+A, Delete) and make something of your own.
# Welcome aboard!`),
];

// ── FRANÇAIS ─────────────────────────────────────────────────────────────────
// Traduction des leçons. Le CODE des exemples reste en anglais (c'est le langage de
// l'outil) ; seuls les commentaires # sont traduits. Pour corriger une traduction,
// édite ce tableau — aucune modification de code.
const FR = [
    lesson(1, 'Bienvenue — comment fonctionne cette visite',
`# Le live coding = tu écris du code, tu l'ÉVALUES, et tu entends le son
# instantanément — puis tu le changes PENDANT qu'il joue. Toute la visite se
# passe ici, dans l'éditeur.
#
# 🌍  Une autre langue ? Place le curseur sur une de ces lignes et fais Ctrl+Entrée :
language("en")   # English — put the cursor on this line and press Ctrl+Enter
language("de")   # Deutsch — Cursor auf diese Zeile setzen, dann Strg+Enter
language("es")   # español — pon el cursor en esta línea y pulsa Ctrl+Enter
language("ja")   # 日本語 — この行にカーソルを置いて Ctrl+Enter
#
# COMMENT ÇA MARCHE :
#   • Lis les lignes de commentaire (celles qui commencent par #).
#   • Lance les lignes d'exemple  ▶  : place le curseur dessus, Ctrl+Entrée.
#   • Quand tu es prêt, évalue  next()  (en bas de chaque leçon) pour continuer.
#     back()  revient ·  tour()  liste les leçons ·  tour(5)  saute à la leçon 5.
#     Le son continue quand tu avances — appuie sur  Ctrl+;  pour tout arrêter.
#
# D'ABORD : clique sur  ▸ boot  (en haut à gauche) pour démarrer le moteur audio.
# Puis place le curseur sur la ligne  next()  ci-dessous et fais Ctrl+Entrée.`, 'fr'),

    lesson(2, 'Ton premier player',
`# Un PLAYER produit du son. Il se lit :     nom  >>  synthé( pattern )
#
#   p1          le nom du player (N'IMPORTE quel nom : p1, bass, lead, d1 …)
#   pluck       le synthé — l'instrument
#   [0,2,4,7]   le pattern de notes, une par pas, EN BOUCLE à l'infini
#
# ▶ Lance ceci (curseur sur la ligne, Ctrl+Entrée) — un arpège en boucle :
p1 >> pluck([0, 2, 4, 7])
#
# Ça continue. L'éditer ne l'arrête jamais — c'est tout l'intérêt.`, 'fr'),

    lesson(3, 'Modifie-le pendant qu’il joue',
`# La magie, c'est d'éditer EN DIRECT. Place le curseur sur un nombre ci-dessous,
# appuie sur Alt+Haut / Alt+Bas pour l'ajuster, puis Ctrl+Entrée pour l'entendre.
#
# ▶ Ajuste un nombre ici, relance, recommence :
p1 >> pluck([0, 2, 4, 7])
#
# Essaie de changer un 4 en 5, ou d'ajouter des notes :  [0, 2, 4, 7, 9, 12]
# Rien à compiler, rien à redémarrer — relance simplement.`, 'fr'),

    lesson(4, 'Les params — façonner le son',
`# Après les notes viennent les PARAMS — des réglages, écrits  nom=valeur :
#
#   amp   volume 0–1            dur  durée d'une note en temps (1/2 = croches)
#   oct   octave plus haut/bas  pan  position stéréo (-1 gauche … 1 droite)
#
# ▶ Le même synthé, façonné — plus rapide, plus doux, plus haut, qui dérive G↔D :
p1 >> pluck([0, 2, 4, 7], dur=1/2, amp=0.5, oct=5, pan=[-0.5, 0.5])
#
# Chaque synthé a aussi ses propres réglages — l'autocomplétion (leçon 12) les trouve.`, 'fr'),

    lesson(5, 'Deux sources de son — charger un kit',
`# Il y a DEUX sources de son :
#   • les SYNTHÉS  faits à partir de maths (pluck, saw, pads …) — rien à télécharger.
#   • les SAMPLES  de l'audio enregistré (batterie, hits) — il faut charger un KIT.
#
# ▶ Charge le kit par défaut — évalue ceci et ATTENDS quelques secondes qu'il finisse
#   (la progression s'affiche dans le journal, en bas à gauche) :
loadpack("https://cdn.jsdelivr.net/gh/CrashServer/webfoxdot-kit@v1/pack.json")
#
# Quand il affiche « loaded », évalue  next()  pour la batterie.`, 'fr'),

    lesson(6, 'La batterie avec play()',
`# play("…") déclenche des SAMPLES du kit. Chaque caractère est un pas :
#
#   x = grosse caisse   o = caisse claire   - = charleston   .  ou espace = un silence
#   X / O plus fort ·  <xx> = deux frappes en un pas (un roulement) ·  [a b] alterne
#
# ▶ Un beat de base (nécessite le kit de la leçon 5) :
d1 >> play("x-o-")
#
# ▶ Plus dense — lance-le pour changer le pattern en direct :
d1 >> play("x.x.o.<xx>")
#
# ▶ [a b] en action — le 2e pas passe de x à o à x à o… une fois à chaque
#   boucle COMPLÈTE du pattern (pas à chaque pas — <x o> serait un roulement rapide) :
d1 >> play("x[xo]")`, 'fr'),

    lesson(7, 'Les patterns — listes, accords, subdivision',
`# La liste dans [ … ] est un PATTERN : une valeur par pas, en boucle. Les crochets
# ont le MÊME sens ici que dans play() :
#
#   [0, 2, 4]      une séquence — une valeur par pas
#   (0, 4, 7)      un ACCORD — ces notes sonnent ensemble (un groupe)
#   [0, [7, 9]]    une liste IMBRIQUÉE ALTERNE — 7 un cycle, 9 le suivant, puis répète
#   <7 7 7>        SUBDIVISION — les caser dans UN seul pas (un roulement/flam)
#   {0, 4, 7}      ALÉATOIRE — en choisir une à chaque pas
#
# ▶ Tout en une ligne — le 3e emplacement fait un roulement, le dernier alterne :
p1 >> pluck([0, (0,4,7), <4 4 4>, [7, 9]], dur=1/2)`, 'fr'),

    lesson(8, 'Les générateurs — des patterns automatiques',
`# Plutôt que de taper chaque note, les GÉNÉRATEURS construisent les patterns :
#
#   PRand([0,2,4,7])     choisit une note au hasard à chaque pas
#   PEuclid(3, 8)        un rythme euclidien — 3 frappes réparties sur 8 pas
#   arp([0,4,7], "up")   arpège un accord : up / down / updown / random
#
# ▶ Une ligne de notes aléatoires :
p1 >> blip(PRand([0, 2, 4, 7, 9]), dur=1/2, amp=0.5)
#
# ASTUCE : place le curseur sur  PRand  et appuie sur  Alt+I  pour une explication
# instantanée de N'IMPORTE quelle fonction de pattern.`, 'fr'),

    lesson(9, 'Les TimeVars — des valeurs qui bougent',
`# Une valeur peut ÉVOLUER dans le temps — parfait pour les balayages de filtre :
#
#   sinvar([300, 4000], [8])   glisse 300→4000→300 (une sinusoïde) sur 8 temps
#   linvar([0, 1], [16])       monte 0→1 en ligne droite sur 16 temps
#
# ▶ Un saw dont le filtre passe-bas s'ouvre et se ferme tout seul :
p1 >> saw([0, 4, 7], dur=1/2, lpf=sinvar([400, 5000], [8]), amp=0.4)
#
# N'IMPORTE quel param accepte une var — cutoff, amp, pan, dur … tout peut respirer.`, 'fr'),

    lesson(10, 'Les effets',
`# Les effets ne sont que des params — ajoute-les à n'importe quel player, empile-les :
#
#   lpf / hpf  filtres        reverb + room  espace        echo + echo_time  délai
#   chorus · drive · crush · chop · … (des dizaines — l'autocomplétion les liste)
#
# ▶ Un pad ample à travers une réverb et un filtre doux :
p1 >> pads([0, 4, 7], dur=4, sus=4, reverb=0.6, room=0.9, lpf=1400, chorus=0.4, amp=0.4)`, 'fr'),

    lesson(11, 'Plusieurs players — superposer & contrôler',
`# Les players s'empilent : donne un nom à chacun, ils jouent ensemble. Et tu les contrôles :
#
#   Alt+X sur une ligne  → la commente et ARRÊTE ce player uniquement
#   Ctrl+;               → arrête TOUT d'un coup
#
# ▶ Lance ces trois (une à une, ou tout sélectionner + Ctrl+Alt+Entrée) :
b1 >> pluck([0, 0, 7, 0], oct=3, dur=1/2, amp=0.5)
p1 >> saw([0, 4, 7], dur=1/2, lpf=2000, amp=0.35)
d1 >> play("x-o-")
#
# Maintenant Alt+X sur la ligne b1 pour couper la basse. Ctrl+; arrête tout.
# Le panneau Players (barre de droite) liste tout ce qui joue — ta vue d'ensemble en direct.`, 'fr'),

    lesson(12, 'L’autocomplétion — ne rien mémoriser',
`# Bloqué sur ce qu'il faut taper ? Appuie sur  Ctrl+Espace :
#
#   après  nom >>    la liste des synthés
#   dans   ( )       les params de ce synthé + les effets
#   après  param =   les patterns / vars à insérer
#
# ▶ Clique à la FIN de la ligne suivante et appuie sur Ctrl+Espace pour explorer :
p1 >>
#
# Flèches : déplacer · → / ← ouvrir & fermer un groupe · Entrée / Tab choisir · Échap fermer.`, 'fr'),

    lesson(13, 'Arranger — sections & sets',
`# Pour des morceaux entiers, marque des SECTIONS avec  #@nom(mesures) . Place le
# curseur sur une ligne #@ et Ctrl+Entrée — elle joue et AVANCE toute seule après ce
# nombre de mesures. #@#@ regroupe des sections en une piste repliable ·  #@end  arrête
# le set à la fin.
#
# Regarde le panneau Composition (barre de droite) pendant la lecture : il liste les
# parties et affiche une barre de progression indiquant où en est le set — clique une
# partie pour y sauter.
#   Ctrl+Alt+P  saute à la partie ACTIVE   ·   Ctrl+Alt+;  (ou ■ stop autoplay dans le
#   panneau) stoppe l'avance auto mais laisse les players tourner   ·   Ctrl+;  arrête tout.
#
# ▶ Un petit set en deux parties — curseur sur  #@a(8)  et Ctrl+Entrée :
#@#@ my_set
#@a(8)
p1 >> pluck([0, 2, 4, 7], dur=1/2)
#@b(8)
p1 >> pluck([7, 4, 2, 0], dur=1/4, echo=0.3)
d1 >> play("x-o-")
#@end`, 'fr'),

    lesson(14, 'Partie 2 — transformer un pattern en direct',
`# ✦ Bien joué — voilà les bases. La Partie 2 va plus loin.
#
# Enchaîne des TRANSFORMATIONS sur un player pour le remodeler en jouant :
#
#   .every(8, "reverse")      toutes les 8 mesures, inverse le pattern
#   .sometimes("stutter", 2)  de temps en temps, roule un pas en 2
#   méthodes de liste :  [0,2,4,7].rotate(1) · .mirror() · .shuffle() · .palindrome()
#
# ▶ Une ligne qui se transforme sans cesse :
p1 >> pluck([0, 2, 4, 7, 9], dur=1/2).every(8, "reverse").sometimes("stutter", 2)`, 'fr'),

    lesson(15, 'Harmonie — gamme, accords & progressions',
`# Règle la TONALITÉ une fois et tout la suit — en code, ou avec les menus Scale & Root
# dans le panneau de droite (sous Clock) :
Scale.default = "minor"
Root.default  = "C"
#
#   PChord(0, "7")           un accord de 7e sur la tonique (un groupe de notes)
#   PRoman("i VI III VII")   une progression écrite en chiffres romains
#   PProg("pop")             une progression nommée (I V vi IV)
#
# ▶ Un pad qui dérive à travers une progression mineure :
p1 >> pads(PProg("pop"), oct=(6, 7), dur=4, sus=4, reverb=0.6, room=0.9, lpf=1600, amp=0.4)`, 'fr'),

    lesson(16, 'Génératif — laisse la machine te surprendre',
`# Deux façons de céder un peu de contrôle :
#
#   chaos()   COLLE un bloc de players aléatoires dans l'éditeur — relis-le, ajuste-le,
#             puis Ctrl+Alt+Entrée pour lancer le bloc (il ne joue pas tout seul).
#   son()     lance un « robot de jam » qui fait évoluer les players seul · soff() l'arrête.
#
# ▶ Confie les rênes au robot (soff() ou Ctrl+; pour l'arrêter) :
son()
#
# ▶ …ou génère un bloc à examiner (il apparaît en dessous — lance-le avec Ctrl+Alt+Entrée) :
chaos()`, 'fr'),

    lesson(17, 'Crée ton propre synthé — defsynth()',
`# Tu n'es pas limité aux synthés intégrés — DÉFINIS ton instrument. Donne-lui un nom,
# des params, une fonction de construction en UGens ; convertis la hauteur avec
# note.midicps() ; termine par Out.ar(...).  (Le boot doit être fait.)
#
# ▶ Sélectionne tout ce bloc et fais Ctrl+Alt+Entrée pour définir « buzz » :
defsynth("buzz", { cutoff: 1500 }, ({ out, note, amp, sus, pan, attack, release, cutoff }) => {
  const env = EnvGen.ar(Env.perc(attack, sus, 1, -4), { doneAction: 2 })
  const sig = RLPF.ar(Saw.ar(note.midicps()), cutoff, 0.4).mul(env).mul(amp)
  Out.ar(out, Pan2.ar(sig, pan))
})
#
# ▶ …puis joue-le comme n'importe quel synthé :
p1 >> buzz([0, 3, 7, 3], dur=1/2, cutoff=sinvar([600, 4000], [8]))`, 'fr'),

    lesson(18, 'Enregistre ton set · thèmes',
`# Le panneau de droite (Settings) réunit quelques outils pour jouer en live :
#
#   Theme       un menu de 8 skins (en haut de Settings) — Dark, Nova, Synthwave,
#               Hacker, Sakura, Paper… change les couleurs aussitôt, gardé pour la fois suivante.
#   rec code    enregistre tes évaluations en une composition #@ rejouable
#   rec audio   capture la sortie audio dans un fichier (coche « share tab audio »)
#
# Et  Alt+T  arme l'enregistreur d'AUTOMATION : bouge un réglage avec Alt+Haut/Bas sur
# quelques temps et il écrit le mouvement en linvar pour toi.
#
# ▶ Tu préfères le clavier ? Change de skin en code (theme() seul les liste tous) :
theme("synthwave")   # · solar · fiesta 🎉 · sakura · hacker · nova · paper · brutalist · cyberpunk · dark
#
# (Les boutons rec ne demandent aucun code — essaie-les quand tu veux, puis évalue next().)`, 'fr'),

    lesson(19, 'Jamme avec d’autres',
`# crashDot est multijoueur. Deux façons d'entrer :
#
#   👥 go live   transforme ton code en session partagée — envoie le lien et d'autres
#               éditent le MÊME buffer avec toi, en sync, curseurs compris.
#   🌌 galaxy    une carte en direct de chaque jam public — clique une étoile pour y sauter.
#
# En session, chacun voit les évaluations des autres ; le chat est dans le panneau de droite.
# (Rien à lancer — clique go live quand tu veux partager. Puis évalue next().)`, 'fr'),

    lesson(20, 'Jouer en live — solo & mute',
`# Jouer en live, c'est couper et rallumer. Au clavier, sur la ligne au curseur :
#
#   Alt+X      commente + arrête ce player (rallume de la même façon)
#   Alt+S      SOLO ce player (coupe les autres) · Ctrl+Alt+S annule le solo
#   Alt+O      solo-drop : solo quelques mesures, puis tout revient
#   Ctrl+;     arrête tout
#
# ▶ Lance les trois (tout sélectionner + Ctrl+Alt+Entrée), puis Alt+S sur la ligne p1 :
b1 >> pluck([0, 0, 7, 0], oct=3, dur=1/2, amp=0.5)
p1 >> saw([0, 4, 7], dur=1/2, lpf=2000, amp=0.35)
d1 >> play("x-o-")`, 'fr'),

    lesson(21, 'La boîte à outils P[…]',
`# P[…] construit un pattern que tu TRANSFORMES avec des méthodes enchaînables :
#
#   P[0,2,4,7].rotate(1)     décale la séquence
#   .mirror() · .palindrome() · .shuffle() · .reverse()
#   .stutter(2) · .every(4, "reverse") · .arp([0,4,7]) · .layer("add", 2)
#
# ▶ Une mélodie qui se replie sur elle-même :
p1 >> pluck(P[0, 2, 4, 7, 9].palindrome().rotate(1), dur=1/2)`, 'fr'),

    lesson(22, 'Groove & swing',
`# Des notes rectilignes sonnent robotiques — ajoute du GROOVE avec un pattern de dur.
# Le hic : le groove est un pattern de DURÉES, il ne swingue donc que des frappes
# CONSÉCUTIVES. Sur un pattern on/off comme "-.-.-." chaque frappe+silence remplit un
# temps entier et le swing s'annule — utilise une frappe PLEINE ("-" boucle un charley
# à chaque pas) pour vraiment l'entendre :
#
#   PGroove("swing")   swingué · "swing16" (plus rapide) · "shuffle" · "gallop" · "triplet"
#   PDur(3, 8)         durées euclidiennes — 3 frappes réparties sur 8
#
# ▶ Un charley swingué en doubles-croches (une frappe par pas, swing audible) sur une basse au galop :
h1 >> play("-", dur=PGroove("swing16"), hpf=6000, amp=0.5)
b1 >> pluck([0, 0, 5, 3], oct=3, dur=PGroove("gallop"), amp=0.5)`, 'fr'),

    lesson(23, 'Apporte tes propres sons',
`# Charge N'IMPORTE quel audio par URL — samples, boucles, ou un kit entier :
#
#   loadsample("z", "https://…/clap.wav")    puis utilise-le :   d1 >> play("z-z-")
#   loadloop("brk", "https://…/loop.wav")    une boucle calée sur le tempo :  l1 >> loop("brk", dur=4)
#   loadpack("…/pack.json")                  un kit entier d'un coup (leçon 5)
#
# (Mets une vraie URL et lance-le — les exemples ci-dessus ne se chargeront pas tels quels.)`, 'fr'),

    lesson(24, 'Des sets qui ne se répètent jamais — #@goto',
`# #@goto(partie, prob) est un AIGUILLEUR de durée nulle : une chance  prob  de sauter à
# cette section, sinon on TOMBE sur la ligne suivante. Enchaîne-en plusieurs et tu as un
# branchement pondéré multi-voies — un set à la Markov qui prend un chemin différent à
# chaque lecture, à l'infini.
#
# ▶ Curseur sur  #@intro(8) , Ctrl+Entrée, puis écoute — les flèches sous chaque partie
#   décident de la suite (le kit de la leçon 5 est requis pour les drums) :
#@#@ markov_set
#@intro(8)
p1 >> pads([0, 4], oct=(5, 6), dur=4, sus=4, reverb=0.7, lpf=1200, amp=0.3)
#@goto(intro, 0.3)      # 30% : reste dans l'intro — sinon roule vers le couplet
#@verse(16)
p1 >> pads([0, 4, 5, 3], oct=5, dur=4, sus=4, reverb=0.5, lpf=1600, amp=0.3)
b1 >> bass([0, 0, 5, 3], oct=3, dur=1/2, amp=0.5)
d1 >> play("x-o-", dur=1/2)
#@goto(chorus, 0.5)     # 50% : saute au refrain — sinon tombe sur le pont
#@bridge(8)
p1 >> pluck([7, 9, 11, 7], oct=4, dur=1/4, echo=0.3, amp=0.4)
b1 >> bass([5, 5, 3, 0], oct=3, dur=1/2, amp=0.5)
d1 >> play("x-o-", dur=1/2)
#@goto(verse, 0.6)      # 60% : retour au couplet — sinon vers le refrain
#@chorus(16)
p1 >> pluck([0, 4, 7, 4], oct=4, dur=1/4, amp=0.4).unison(2)
b1 >> bass([0, 3, 5, 7], oct=3, dur=1/4, amp=0.5)
d1 >> play("x-<oo>", dur=1/2)
h1 >> play("-", dur=1/4, hpf=6000, amp=0.35)
#@goto(drop, 0.4)       # 40% : dans le drop …
#@goto(verse, 1)        # … les 60% restants : retour au couplet (gotos chaînés = multi-voies)
#@drop(8)
p1 >> pluck([0, 0, 0, 0], oct=4, dur=1/4, amp=0.3).unison(3)
b1 >> bass([0], oct=2, dur=1/4, drive=3, amp=0.6)
d1 >> play("X", dur=1/4, amp=0.9)
#@goto(verse, 1)        # le drop revient toujours au couplet
#@end`, 'fr'),

    lesson(25, 'MIDI — piloter du matériel externe',
`# crashDot parle MIDI : pilote des synthés & boîtes à rythmes matériels, ou joue depuis
# un contrôleur. Active-le avec le bouton MIDI (panneau de droite), puis :
#
#   m1 >> midiout([0, 4, 7], channel=0, oct=5, dur=1/2)   envoie des notes en sortie
#   midiin()                                              joue les synthés intégrés DEPUIS un clavier
#
# ▶ Assigner un param au MIDI est une AFFECTATION, comme pour n'importe quelle
#   var — mlearn() se contente de trouver le CC pour toi. Évalue ceci, puis
#   bouge n'importe quel bouton/fader de ton contrôleur ; il se fixe sur le CC détecté :
p1 >> pluck([0, 4, 7], dur=1/2)
p1.lpf = mlearn(200, 8000)
#
# Tu connais déjà le numéro de CC ? Pas besoin de bouger un bouton — midi(cc, lo, hi)
# s'y associe directement : p1.lpf = midi(74, 200, 8000).
#
# ▶ Encore plus rapide : place le curseur SUR un nombre (comme le 800 ci-dessous)
#   et appuie sur Alt+M. Ça le transforme en mlearn(…) (bornes devinées à partir
#   de la valeur) et lance la ligne pour toi — rien à retaper :
p1 >> pluck([0, 4, 7], cutoff=800, dur=1/2)
#
# (Nécessite un appareil MIDI + l'autorisation du navigateur — rien à lancer sans ça.)`, 'fr'),

    lesson(26, 'L’autocomplétion en détail',
`# Ctrl+Espace est CONTEXTUEL — il propose exactement ce qui convient là où est le curseur :
#
#   après  nom >>      les synthés, groupés par famille (bass · lead · keys · pads …)
#   dans   ( )         les params de ce synthé + un groupe  fx
#   le groupe  fx      se déplie par famille : filtres · réverbs · délais · distorsion …
#                      en choisir un insère tous ses réglages (ex. reverb + room)
#   après  param =     patterns & vars (PRand, PEuclid, sinvar, var …)
#   Scale.default = "  les noms de gammes   ·   pal="   les noms de palettes
#
# ▶ Clique juste AVANT la  )  fermante ci-dessous (juste après le pattern), Ctrl+Espace,
#   ouvre le groupe  fx , choisis-en un :
p1 >> pluck([0, 2, 4, 7])
#
# → / ← ouvrent & ferment un groupe · ↑ ↓ déplacent · Entrée / Tab choisit · Échap ferme.`, 'fr'),

    lesson(27, 'Plus de patterns',
`# Les patterns sont au cœur de tout. Un tour des GÉNÉRATEURS (curseur dessus → Alt+I) :
#
#   PRand · PWhite · PWalk        tirages aléatoires & marches ivres
#   PEuclid(3,8) · PDur · PBeat    rythmes (frappes/durées réparties sur une longueur)
#   PStep · PRange · PSine         formes & rampes
#   arp · PArp · melody            arpèges & phrases
#
# Les patterns s'IMBRIQUENT — un pattern dans une liste se résout à chaque pas :
#   [0, {2, 4}, 7]    choisit 2 ou 4 au hasard sur ce pas
#   [0, [4, 2]]       une sous-séquence (4 puis 2) dans un seul pas
#
# ▶ Une note d'accent aléatoire avec des durées euclidiennes :
p1 >> pluck([0, {2, 4}, 7, 4], dur=PDur(3, 8), amp=0.5)`, 'fr'),

    lesson(28, 'Raccourcis & navigation',
`# Les raccourcis à connaître (tous marchent pendant l'édition) :
#
#   Ctrl+Entrée     lance la ligne au curseur      Ctrl+Alt+Entrée  lance le bloc
#   Alt+Haut / Bas  ajuste le nombre au curseur, en direct
#   Alt+X           commente + arrête ce player     Ctrl+;   arrête tout
#   Alt+I           explique la fonction au curseur
#   Alt+M           MIDI-learn sur le nombre au curseur (leçon 25)
#   Ctrl+Espace     autocomplétion                  Ctrl+/   commente/décommente
#   Alt+T           enregistre un mouvement de réglage en automation
#   Ctrl+Alt+P      SAUTE à la section ACTIVE — là où le set en cours joue
#   Shift+Alt+Z     mode zen (masque toute l'UI)  ·  F1  docs
#
# Ctrl+Alt+P est le saut « aller à la position de la composition ».`, 'fr'),

    lesson(29, 'Fonctions pratiques',
`# Des fonctions à évaluer quand tu veux :
#
#   drop(14, 2)                une montée → un DROP balayé sur les players en cours
#   shutup()                   arrête tous les players (plus doux que Ctrl+;)
#   swap("p1", "p2", "degree") échange un attribut entre deux players, en direct
#   darker() / lighter()       change l'humeur de la gamme, un mode à la fois
#   linbpm(120, 140, 16)       glisse le tempo 120→140 sur 16 temps
#   say("salut")   print("…")  parle / affiche
#
# ▶ Lance deux players, puis évalue  drop(8, 2)  pour entendre une montée + un drop :
p1 >> saw([0, 4, 7], dur=1/2, lpf=1500, amp=0.4)
b1 >> pluck([0, 0, 7, 0], oct=3, dur=1/2, amp=0.5)`, 'fr'),

    lesson(30, 'Ajuste un réglage à la volée',
`# Pas besoin de retaper toute une ligne pour changer une chose. Sur un player EN COURS :
#
#   p1.lpf = linvar([500, 5000], [8])   règle UN seul attribut (ici, un balayage de filtre)
#   p1.every(8, "reverse")              attache une transfo sans le redémarrer
#   ~p1 >> pluck([0, 4])                le  ~  RÉINITIALISE un player (efface les réglages hérités)
#
# ▶ Lance ceci, puis lance la ligne p1.lpf en dessous pour balayer le filtre en direct :
p1 >> saw([0, 4, 7, 9], dur=1/2, amp=0.4)
p1.lpf = linvar([500, 5000], [8])`, 'fr'),

    lesson(31, 'Silences, trous & dynamique',
`# Le silence façonne un groove autant que les notes :
#
#   [0, _, 4, _]        _  (ou  rest ) = un vrai silence — un trou dans le pattern
#   play("x. .x")       .  ou espace = un silence entre les frappes
#   amp=[0.6, 0.3]      volume par pas · amplify=Pacc("offbeat") = des accents tout prêts
#
# ▶ Une basse avec des silences, et un charley dont les CONTRETEMPS sont accentués (kit
#   requis). Le charley est un "-" plein à chaque pas pour que les accents tombent sur des frappes :
p1 >> pluck([0, _, 0, _, 7, _], oct=3, dur=1/4, amp=0.5)
h1 >> play("-", amplify=Pacc("offbeat"), hpf=6000, dur=1/4)`, 'fr'),

    lesson(32, 'Synchroniser des players',
`# Les players peuvent SE SURVEILLER, pour que les parties bougent comme une seule.
# Quatre façons de les lier :
#
#   p1.degree         une référence VIVE à la note en cours de p1 — glisse-la dans les
#                     args d'un autre player, qui suit p1 note pour note (ici la basse
#                     joue la fondamentale de p1, avec sa propre octave & durée).
#   .follow("p1")     raccourci pour la même idée : joue le degree de p1 à chaque pas —
#                     un doublage à l'UNISSON, mais avec ton synthé / oct / dur.
#   .accompany("p1")  HARMONISE : la note de p1 plus une forme d'accord cyclique ([0,2,4]
#                     tierces par défaut) — une ligne d'harmonie qui suit la mélodie.
#   p1.reroll(8)      réévalue p1 toutes les 8 mesures, pour qu'un aléa figé (PRand, un
#                     motif mélangé…) se relance à chaque fois au lieu de se répéter.
#
# ▶ Un pad, une basse sur sa fondamentale, un doublage à l'unisson et une harmonie — tout calé sur p1 :
p1 >> pads([0, 3, 5, 4], oct=5, dur=2, amp=0.4, reverb=0.5)
b1 >> bass(p1.degree, oct=4, dur=2, amp=0.5)
b3 >> blip(dur=1/2, oct=4, mverb=0.1, spin=0.5, pan=[-1, 1]).follow("p1")
b4 >> blip(dur=1/4, oct=4).accompany("p1").unison(3)`, 'fr'),

    lesson(33, 'Sauvegarder, partager & retrouver',
`# Ton travail est en sécurité et partageable :
#
#   • l'éditeur SAUVEGARDE tout seul dans ce navigateur — recharge la page, il est là.
#   • ⤴ share (en haut) copie un LIEN autonome : toute la composition tient dans l'URL,
#     donc qui l'ouvre récupère ton code exact — aucun serveur nécessaire.
#   • rec code (panneau de droite) enregistre tes évaluations en un set #@ rejouable ;
#     rec audio capture le son lui-même dans un fichier.
#
# (Rien à lancer — clique ⤴ share quand tu as fait quelque chose qui te plaît.)`, 'fr'),

    lesson(34, 'Le tempo & l’horloge',
`# Tout repose sur une seule HORLOGE. Règle le tempo en battements par minute :
Clock.bpm = 132
# Le panneau Clock (barre de droite) affiche le BPM en direct — tu peux aussi taper
# dans ce champ, ou TAPER le bouton tap en rythme : il lit le tempo de tes frappes.
#
# Le tempo peut aussi BOUGER — Clock.bpm accepte une TimeVar, il glisse comme un param :
#   Clock.bpm = linvar([120, 140], [16])   # glisse 120→140 sur 16 temps
#   linbpm(120, 140, 16)                    # pareil, en raccourci · dropbpm(90, 8) depuis maintenant
#
# ▶ Lance une ligne, puis fais glisser le tempo dessous :
p1 >> pluck([0, 2, 4, 7], dur=1/2)
Clock.bpm = linvar([110, 150], [8])
#
# QUANTISATION — pourquoi les couches restent calées : la première note d'un nouveau
# player tombe sur le prochain temps multiple de son dur. Donc dur=4 attend la mesure,
# dur=1/4 démarre presque aussitôt — ajoute des players quand tu veux, ils se calent sur
# la grille (Alt+X attend aussi la mesure). Clock.meter = temps par mesure ; Clock.nextBar(fn)
# / Clock.mod(4, fn) lancent tes propres one-shots sur la grille.`, 'fr'),

    lesson(35, 'Épaissir & élargir — .unison()',
`# .unison(n) empile n copies DÉSACCORDÉES d'une voix, réparties dans le champ stéréo —
# une épaisseur et une largeur « supersaw » instantanées à partir d'une seule ligne.
# Règle-la avec le désaccord & la largeur :
#
#   .unison(3)            3 voix, léger désaccord par défaut, largeur pleine
#   .unison(5, 0.3)       5 voix, ±0,3 demi-ton de désaccord (plus large = plus de chatoiement)
#   .unison(4, 0.2, 60)   4 voix, désaccord plus serré, 60% de largeur stéréo
#
# Ça marche aussi sur les samples — chaque copie est repitchée et panoramiquée.
#
# ▶ La même ligne, sèche puis épaissie — lance chacune et écoute-la s'ouvrir :
p1 >> saw([0, 4, 7], oct=5, dur=1/2, lpf=2000, amp=0.35)
p1 >> saw([0, 4, 7], oct=5, dur=1/2, lpf=2000, amp=0.35).unison(5, 0.3)
#
# Parfait sur les leads, pads et basses. Garde n petit sur les parties chargées — chaque
# voix est une vraie note en plus, donc ça coûte du CPU. Ajoute une réverb pour un mur de son.`, 'fr'),

    lesson(36, 'The mixer — perform your tracks live',
`# The MIXER (🎚 mix, top toolbar) is a live desk + CLIP-LAUNCHER for your tracks. It
# floats and is NON-MODAL — keep coding while it's open.
#
# ▶ Run this 4-part set (NO #@end, so it plays on forever). Cursor on #@ intro(16),
#   Ctrl+Enter — then open  🎚 mix  and perform it. Each part redefines the SAME tracks:
#@ intro(16)
bass  >> dbass(dur=4, mverb=0, chop=0)
drum  >> a_bd(dur=1, oct=3)
bass2 >> ebass([0, <0 5>, 3, 0], oct=4, dur=1, amp=0.5, tremolo=0.48, trem_rate=4).every(16, "rotate")
#@ main(16)
bass  >> dbass(dur=1/2, mverb=0, chop=0)
drum  >> a_bd(dur=1, oct=3)
bass2 >> ebass([0, <0 5>, 3, 0], oct=4, dur=1, amp=0.5, tremolo=0.48, trem_rate=4).every(16, "rotate")
#@ var(16)
bass  >> dbass(dur=1/2, mverb=0.5, chop=4)
drum  >> a_bd(dur=1, oct=3)
bass2 >> ebass([0, <0 5>, 3, 0], oct=5, dur=1, amp=0.5, tremolo=0.48, trem_rate=4).every(16, "rotate")
#@ outro(16)
bass  >> dbass(dur=1/2, mverb=0.6, chop=4)
drum  >> a_bd(dur=1, oct=3)
bass2 >> ebass([0, <0 5>, 3, 0], oct=5, dur=1/2, amp=0.7, tremolo=0.48, trem_rate=4).every(16, "rotate")
#
# Now click  🎚 mix. Each track is a vertical strip:
#   • FADER   its volume — shared per NAME, and kept SEPARATE from amplify, so
#             mute / solo / drop can never wipe your mix. Mirrors the Players panel.
#   • S / M   SOLO and MUTE — shared with the Players panel AND code .solo()/drop(),
#             so all three always agree.
#   • ■       STOP, quantised to the next bar.
#   • m       MIDI-learn — click it, move a hardware fader, and that CC drives the level.
#
# LAUNCH: tap a track's NAME to evaluate its line and start it on its own — no autoplay
# needed. The SOURCE picker (auto · a chip per #@ part) chooses which part's version a
# launch pulls from, so you can fire  bass  DRY from 'intro', then relaunch it WET from
# 'var' (its mverb + chop) while  bass2  climbs an octave — a whole set built by hand.
#
# ▶ Run .solo() here and watch the S light up in BOTH the mixer and the Players panel:
bass.solo(8)`, 'fr'),

    lesson(37, 'Parameter envelopes — lpf_ and the _ sweeps',
`# Add "_" to an FX parameter and it becomes an ENVELOPE — a shape that MOVES that
# param within each note. The classic is a filter sweep: lpf_ glides the low-pass
# cutoff every time a note fires.
#
# Three shapes, each written f(dur, a, b) — dur in BEATS, a & b the two endpoints:
#   fi(dur, a, b)   fade IN   —  a → b, then holds at b
#   fo(dur, a, b)   fade OUT  —  b → a, then holds at a   (fi's mirror)
#   fb(dur, a, b)   BOUNCE    —  a ↔ b triangle, looping every dur (for the note's sus)
#
# ▶ Each pluck OPENS its filter, 400 → 4000 Hz over one beat:
p1 >> pluck([0, 2, 4, 7], dur=1, lpf_=fi(1, 400, 4000))
#
# ▶ The mirror — each note CLOSES, 4000 → 400 (that quacky "pluck" shape):
p1 >> pluck([0, 2, 4, 7], dur=1, lpf_=fo(1, 400, 4000))
#
# ▶ Bounce = a wobble. Hold ONE long note and the cutoff see-saws every half beat:
b1 >> bass([0], dur=8, sus=8, lpf_=fb(1/2, 300, 4000))
#
# The envelope plays over the note's SUS, so give it room — a short note only shows the
# START of a slow sweep. Longer sus = the whole shape unfolds:
p1 >> pads([0, 4, 7], dur=4, sus=4, lpf_=fi(4, 300, 6000))
#
# RESONANCE makes a sweep SING. lpr is the low-pass resonance (LOWER = sharper peak;
# 0.7 default, ~0.15 = squelchy). Note lpr is a SEPARATE param from lpf_ :
b1 >> bass([0, 0, 3, 5], oct=4, dur=1/2, lpf_=fi(1/2, 200, 3500), lpr=0.15)`, 'fr'),

    lesson(38, 'Envelopes everywhere — any FX param + clock-sync',
`# It's not only the filter — EVERY effect param takes a "_" envelope: crush_, reverb_,
# chorus_, echo_, hpf_, djf_ … the same fi / fo / fb shapes sweep that effect per note.
#
# ▶ bit-depth cleaning up — starts gritty (4 levels) and smooths to 16:
p1 >> pluck([0, 2, 4, 7], dur=1, crush=0.6, bits_=fi(1, 4, 16))
#
# ▶ reverb SWELLING in over two beats (dry → drenched):
p1 >> pads([0, 4], dur=4, sus=4, reverb_=fi(2, 0, 0.9), room=0.9)
#
# ▶ a high-pass sweeping up = a riser / filter-out:
d1 >> play("x-o-", dur=1/2, hpf_=fi(4, 100, 4000))
#
# TWO MODES — the "_" is the switch:
#   lpf_=fb(1, 400, 4000)   PER-NOTE: the shape RESTARTS on every note (timed from when
#                           that note fired) — each note gets its own fresh sweep.
#   lpf =fb(8, 400, 4000)   NO "_": ONE clock-synced value shared by everything — a
#                           global LFO on the timeline, so every player moves together.
# ▶ Run both — same wobble, per-note vs global:
p1 >> pluck([0, 2, 4, 7], dur=1/2, lpf_=fb(1, 400, 4000))
b1 >> bass([0], dur=8, sus=8, lpf=fb(8, 400, 4000))
#
# GOTCHAS: "_" envelopes work only on EFFECT params (filters, reverb, crush, echo,
# chorus, djf …) — NOT the note params amp / oct / dur / pan. To move those, use a
# var() (lesson 9). And don't confuse  lpf_  (the envelope) with  lpr  (resonance).`, 'fr'),

    lesson(39, 'Glissando — .slider()',
`# .slider() makes a player GLIDE in pitch between notes — a portamento sweep.
# Chain it onto any melodic synth (basses, saws, leads, keys, plucks).
#
# ▶ The default alternates a steady note and a swept one:
b1 >> bass([0, 3, 5, 7], dur=1/2).slider()
#
# ▶ .slider(1) flips the phase — the OTHER notes sweep:
b1 >> bass([0, 3, 5, 7], dur=1/2).slider(1)
#
# PER-NOTE control — pass a PATTERN of 0/1: 1 = glide THIS note · 0 = steady.
# ▶ every 3rd note glides:
p1 >> pluck([0, 2, 4, 7], dur=1/2).slider([0, 0, 1])
#
# ▶ a var lets the glide breathe over time (mostly steady, then bursts of glide):
d1 >> dbass([0, 3, 5], dur=1/2).slider(var([0, 1], [6, 2]))
#
# Turn it off with .slider(0, 0). On synths with no pitch-glide (drums/samples)
# it's a harmless no-op — safe to chain anywhere. Killer on acid basslines & leads.`, 'fr'),

    lesson(40, 'Tu es prêt ✨',
`# Voilà toute la boucle :   ÉCRIRE  →  LANCER (Ctrl+Entrée)  →  CHANGER  →  relancer.
#
# Où aller ensuite :
#   • examples (en haut)  morceaux & techniques complets — clique pour en charger un
#   • le bouton docs      chaque synthé, effet, pattern & raccourci
#   • galaxy              parcours & jamme avec d'autres, en direct
#
# Maintenant vide ce buffer (Ctrl+A, Suppr) et fais quelque chose à toi.
# Bienvenue à bord !`, 'fr'),
];

// ── DEUTSCH ──────────────────────────────────────────────────────────────────
// Übersetzung der Lektionen. Der CODE der Beispiele bleibt Englisch (die Sprache des
// Werkzeugs); nur die #-Kommentare werden übersetzt. Zum Korrigieren: dieses Array
// bearbeiten — keine Code-Änderung.
const DE = [
    lesson(1, 'Willkommen — wie diese Tour funktioniert',
`# Live Coding = du schreibst Code, WERTEST ihn aus und hörst sofort Klang — dann
# änderst du ihn, WÄHREND er spielt. Die ganze Tour findet hier im Editor statt.
#
# 🌍  Andere Sprache? Setze den Cursor auf eine dieser Zeilen und drücke Strg+Enter:
language("en")   # English — put the cursor on this line and press Ctrl+Enter
language("fr")   # français — place le curseur sur cette ligne et fais Ctrl+Entrée
language("es")   # español — pon el cursor en esta línea y pulsa Ctrl+Enter
language("ja")   # 日本語 — この行にカーソルを置いて Ctrl+Enter
#
# SO GEHT'S:
#   • Lies die Kommentarzeilen (die mit # beginnen).
#   • Führe die  ▶  Beispielzeilen aus: Cursor auf die Zeile, Strg+Enter.
#   • Wenn du bereit bist, werte  next()  (unten in jeder Lektion) aus, um weiterzugehen.
#     back()  geht zurück ·  tour()  listet die Lektionen ·  tour(5)  springt zu Lektion 5.
#     Der Klang läuft weiter, während du fortfährst — drücke  Strg+;  um alles zu stoppen.
#
# ZUERST: klicke auf  ▸ boot  (oben links), um die Audio-Engine zu starten.
# Setze dann den Cursor auf die  next()  Zeile unten und drücke Strg+Enter.`, 'de'),

    lesson(2, 'Dein erster Player',
`# Ein PLAYER erzeugt Klang. Er liest sich:     name  >>  synth( pattern )
#
#   p1          der Name des Players (JEDER Name geht: p1, bass, lead, d1 …)
#   pluck       der Synth — das Instrument
#   [0,2,4,7]   das Noten-Pattern, eine pro Schritt, ENDLOS in der Schleife
#
# ▶ Führe dies aus (Cursor auf die Zeile, Strg+Enter) — ein Arpeggio in der Schleife:
p1 >> pluck([0, 2, 4, 7])
#
# Es läuft weiter. Bearbeiten stoppt es nie — das ist der ganze Sinn.`, 'de'),

    lesson(3, 'Ändere ihn, während er spielt',
`# Der Zauber ist das LIVE-Bearbeiten. Setze den Cursor auf eine Zahl unten,
# drücke Alt+Hoch / Alt+Runter zum Verstellen, dann Strg+Enter, um es zu hören.
#
# ▶ Verstelle hier eine Zahl, führe erneut aus, wiederhole:
p1 >> pluck([0, 2, 4, 7])
#
# Mach aus einer 4 eine 5, oder füge Noten hinzu:  [0, 2, 4, 7, 9, 12]
# Nichts zu kompilieren, nichts neu zu starten — führe einfach erneut aus.`, 'de'),

    lesson(4, 'Params — den Klang formen',
`# Nach den Noten kommen die PARAMS — Regler, geschrieben  name=wert :
#
#   amp   Lautstärke 0–1        dur  Notenlänge in Beats (1/2 = Achtel)
#   oct   Oktave höher/tiefer   pan  Stereo-Position (-1 links … 1 rechts)
#
# ▶ Derselbe Synth, geformt — schneller, leiser, höher, links↔rechts wandernd:
p1 >> pluck([0, 2, 4, 7], dur=1/2, amp=0.5, oct=5, pan=[-0.5, 0.5])
#
# Jeder Synth hat auch eigene Regler — die Autovervollständigung (Lektion 12) findet sie.`, 'de'),

    lesson(5, 'Zwei Klangquellen — ein Kit laden',
`# Es gibt ZWEI Klangquellen:
#   • SYNTHS   aus Mathematik erzeugt (pluck, saw, pads …) — nichts herunterzuladen.
#   • SAMPLES  aufgenommenes Audio (Drums, Hits) — dafür muss ein KIT geladen sein.
#
# ▶ Lade das Standard-Kit — führe dies aus und WARTE ein paar Sekunden, bis es fertig ist
#   (der Fortschritt erscheint im Log, unten links):
loadpack("https://cdn.jsdelivr.net/gh/CrashServer/webfoxdot-kit@v1/pack.json")
#
# Wenn „loaded" erscheint, werte  next()  für die Drums aus.`, 'de'),

    lesson(6, 'Drums mit play()',
`# play("…") triggert SAMPLES aus dem Kit. Jedes Zeichen ist ein Schritt:
#
#   x = Bassdrum   o = Snare   - = Hi-Hat   .  oder Leerzeichen = eine Pause
#   X / O lauter ·  <xx> = zwei Schläge in einem Schritt (ein Wirbel) ·  [a b] alterniert
#
# ▶ Ein einfacher Beat (braucht das Kit aus Lektion 5):
d1 >> play("x-o-")
#
# ▶ Dichter — führe es aus, um das Pattern live zu tauschen:
d1 >> play("x.x.o.<xx>")
#
# ▶ [a b] in Aktion — der 2. Schritt wechselt x → o → x → o … einmal pro
#   komplettem Durchlauf des Patterns (nicht pro Schritt — <x o> wäre ein schneller Wirbel):
d1 >> play("x[xo]")`, 'de'),

    lesson(7, 'Patterns — Listen, Akkorde, Subdivision',
`# Die Liste in [ … ] ist ein PATTERN: ein Wert pro Schritt, in der Schleife. Klammern
# bedeuten hier das GLEICHE wie in play():
#
#   [0, 2, 4]      eine Sequenz — ein Wert pro Schritt
#   (0, 4, 7)      ein AKKORD — diese Noten klingen zusammen (eine Gruppe)
#   [0, [7, 9]]    eine VERSCHACHTELTE Liste ALTERNIERT — 7 einen Zyklus, dann 9
#   <7 7 7>        SUBDIVISION — in EINEN Schritt pressen (ein Wirbel/Flam)
#   {0, 4, 7}      ZUFALL — pro Schritt eine auswählen
#
# ▶ Alles in einer Zeile — der 3. Platz wirbelt, der letzte alterniert:
p1 >> pluck([0, (0,4,7), <4 4 4>, [7, 9]], dur=1/2)`, 'de'),

    lesson(8, 'Generatoren — Patterns, die sich selbst schreiben',
`# Statt jede Note zu tippen, bauen GENERATOREN die Patterns für dich:
#
#   PRand([0,2,4,7])     wählt bei jedem Schritt eine zufällige Note
#   PEuclid(3, 8)        ein euklidischer Rhythmus — 3 Schläge über 8 Schritte verteilt
#   arp([0,4,7], "up")   arpeggiert einen Akkord: up / down / updown / random
#
# ▶ Eine Zeile mit zufälligen Noten:
p1 >> blip(PRand([0, 2, 4, 7, 9]), dur=1/2, amp=0.5)
#
# TIPP: setze den Cursor auf  PRand  und drücke  Alt+I  für eine sofortige Erklärung
# JEDER Pattern-Funktion.`, 'de'),

    lesson(9, 'TimeVars — Werte, die sich bewegen',
`# Ein Wert kann sich über die Zeit ENTWICKELN — perfekt für Filter-Sweeps:
#
#   sinvar([300, 4000], [8])   gleitet 300→4000→300 (eine Sinuskurve) über 8 Beats
#   linvar([0, 1], [16])       steigt 0→1 geradlinig über 16 Beats
#
# ▶ Ein Saw, dessen Tiefpassfilter sich von selbst öffnet und schließt:
p1 >> saw([0, 4, 7], dur=1/2, lpf=sinvar([400, 5000], [8]), amp=0.4)
#
# JEDER Param nimmt eine var — cutoff, amp, pan, dur … alles kann atmen.`, 'de'),

    lesson(10, 'Effekte',
`# Effekte sind auch nur Params — füge sie jedem Player hinzu und staple sie:
#
#   lpf / hpf  Filter        reverb + room  Raum        echo + echo_time  Delay
#   chorus · drive · crush · chop · … (Dutzende — die Autovervollständigung listet sie)
#
# ▶ Ein üppiges Pad durch Hall und einen sanften Filter:
p1 >> pads([0, 4, 7], dur=4, sus=4, reverb=0.6, room=0.9, lpf=1400, chorus=0.4, amp=0.4)`, 'de'),

    lesson(11, 'Mehrere Player — schichten & steuern',
`# Player stapeln sich: gib jedem einen Namen, sie spielen zusammen. Und du steuerst sie:
#
#   Alt+X auf einer Zeile  → kommentiert sie aus und STOPPT nur diesen Player
#   Strg+;                 → stoppt ALLES auf einmal
#
# ▶ Führe diese drei aus (einzeln, oder alles markieren + Strg+Alt+Enter):
b1 >> pluck([0, 0, 7, 0], oct=3, dur=1/2, amp=0.5)
p1 >> saw([0, 4, 7], dur=1/2, lpf=2000, amp=0.35)
d1 >> play("x-o-")
#
# Jetzt Alt+X auf der b1-Zeile, um den Bass stummzuschalten. Strg+; stoppt alles.
# Das Players-Panel (rechte Leiste) listet alles, was gerade spielt — dein Live-Überblick.`, 'de'),

    lesson(12, 'Autovervollständigung — nichts merken',
`# Nicht sicher, was du tippen sollst? Drücke  Strg+Leertaste :
#
#   nach  name >>    die Liste der Synths
#   in    ( )        die Params dieses Synths + die Effekte
#   nach  param =    Patterns / vars zum Einfügen
#
# ▶ Klicke ans ENDE der nächsten Zeile und drücke Strg+Leertaste zum Erkunden:
p1 >>
#
# Pfeile bewegen · → / ← öffnen & schließen eine Gruppe · Enter / Tab wählt · Esc schließt.`, 'de'),

    lesson(13, 'Arrangieren — Sections & Sets',
`# Für ganze Stücke markiere SECTIONS mit  #@name(Takte) . Setze den Cursor auf eine
# #@-Zeile und Strg+Enter — sie spielt und WECHSELT nach so vielen Takten von selbst.
# #@#@ fasst Sections zu einem einklappbaren Track zusammen ·  #@end  stoppt das Set am Ende.
#
# Sieh dabei aufs Composition-Panel (rechte Leiste): es listet die Teile und zeigt eine
# Live-Fortschrittsleiste, wo das Set gerade steht — klicke einen Teil, um dorthin zu springen.
#   Strg+Alt+P  springt zum AKTIVEN Teil   ·   Strg+Alt+;  (oder ■ stop autoplay im Panel)
#   hält das Auto-Weiterschalten an, lässt die Player aber laufen   ·   Strg+;  stoppt alles.
#
# ▶ Ein kleines Set in zwei Teilen — Cursor auf  #@a(8)  und Strg+Enter:
#@#@ my_set
#@a(8)
p1 >> pluck([0, 2, 4, 7], dur=1/2)
#@b(8)
p1 >> pluck([7, 4, 2, 0], dur=1/4, echo=0.3)
d1 >> play("x-o-")
#@end`, 'de'),

    lesson(14, 'Teil 2 — ein Pattern live umformen',
`# ✦ Gut gemacht — das waren die Grundlagen. Teil 2 geht tiefer.
#
# Verkette TRANSFORMATIONEN an einem Player, um ihn im Spielen umzuformen:
#
#   .every(8, "reverse")      alle 8 Takte, kehre das Pattern um
#   .sometimes("stutter", 2)  ab und zu, teile einen Schritt in 2
#   auch Listen-Methoden:  [0,2,4,7].rotate(1) · .mirror() · .shuffle() · .palindrome()
#
# ▶ Eine Zeile, die sich ständig umformt:
p1 >> pluck([0, 2, 4, 7, 9], dur=1/2).every(8, "reverse").sometimes("stutter", 2)`, 'de'),

    lesson(15, 'Harmonie — Tonleiter, Akkorde & Progressionen',
`# Stelle die TONART einmal ein, und alles folgt ihr — im Code, oder mit den Menüs
# Scale & Root im rechten Panel (unter Clock):
Scale.default = "minor"
Root.default  = "C"
#
#   PChord(0, "7")           ein Septakkord auf der Tonika (eine Gruppe von Noten)
#   PRoman("i VI III VII")   eine Progression in römischen Ziffern
#   PProg("pop")             eine benannte Progression (I V vi IV)
#
# ▶ Ein Pad, das durch eine Moll-Progression driftet:
p1 >> pads(PProg("pop"), oct=(6, 7), dur=4, sus=4, reverb=0.6, room=0.9, lpf=1600, amp=0.4)`, 'de'),

    lesson(16, 'Generativ — lass die Maschine dich überraschen',
`# Zwei Wege, etwas Kontrolle abzugeben:
#
#   chaos()   FÜGT einen Block zufälliger Player in den Editor ein — sieh ihn durch,
#             passe ihn an, dann Strg+Alt+Enter, um den Block zu starten (spielt nicht allein).
#   son()     startet einen „Jam-Bot", der Player von selbst weiterentwickelt · soff() stoppt ihn.
#
# ▶ Übergib die Zügel dem Bot (soff() oder Strg+; zum Stoppen):
son()
#
# ▶ …oder erzeuge einen Block zum Ansehen (er erscheint darunter — starte ihn mit Strg+Alt+Enter):
chaos()`, 'de'),

    lesson(17, 'Bau deinen eigenen Synth — defsynth()',
`# Du bist nicht auf die eingebauten Synths beschränkt — DEFINIERE dein Instrument. Gib
# ihm einen Namen, Params und eine Build-Funktion aus UGens; wandle die Tonhöhe mit
# note.midicps(); schließe mit Out.ar(...) ab.  (Boot muss erledigt sein.)
#
# ▶ Markiere diesen ganzen Block und drücke Strg+Alt+Enter, um „buzz" zu definieren:
defsynth("buzz", { cutoff: 1500 }, ({ out, note, amp, sus, pan, attack, release, cutoff }) => {
  const env = EnvGen.ar(Env.perc(attack, sus, 1, -4), { doneAction: 2 })
  const sig = RLPF.ar(Saw.ar(note.midicps()), cutoff, 0.4).mul(env).mul(amp)
  Out.ar(out, Pan2.ar(sig, pan))
})
#
# ▶ …dann spiele ihn wie jeden Synth:
p1 >> buzz([0, 3, 7, 3], dur=1/2, cutoff=sinvar([600, 4000], [8]))`, 'de'),

    lesson(18, 'Nimm dein Set auf · Themes',
`# Das rechte Panel (Settings) bündelt ein paar Werkzeuge fürs Live-Spielen:
#
#   Theme       ein Menü mit 8 Skins (oben in Settings) — Dark, Nova, Synthwave,
#               Hacker, Sakura, Paper… ändert die Farben sofort, für nächstes Mal gespeichert.
#   rec code    nimmt deine Auswertungen als abspielbare #@-Komposition auf
#   rec audio   nimmt das Audio-Signal in eine Datei auf (hake „share tab audio" an)
#
# Und  Alt+T  aktiviert den AUTOMATIONS-Recorder: bewege einen Regler mit Alt+Hoch/Runter
# über ein paar Beats, und er schreibt die Bewegung als linvar für dich.
#
# ▶ Lieber per Tastatur? Wechsle den Skin im Code (theme() allein listet alle auf):
theme("synthwave")   # · solar · fiesta 🎉 · sakura · hacker · nova · paper · brutalist · cyberpunk · dark
#
# (Die rec-Buttons brauchen keinen Code — probiere sie jederzeit, dann werte next() aus.)`, 'de'),

    lesson(19, 'Jamme mit anderen',
`# crashDot ist Mehrspieler. Zwei Wege hinein:
#
#   👥 go live   macht deinen Code zu einer geteilten Session — schicke den Link und andere
#               bearbeiten DENSELBEN Buffer mit dir, synchron, samt Cursorn.
#   🌌 galaxy    eine Live-Karte jedes öffentlichen Jams — klicke einen Stern, um beizutreten.
#
# In einer Session sehen alle die Auswertungen der anderen; der Chat ist im rechten Panel.
# (Nichts auszuführen — klicke go live, wenn du teilen willst. Dann werte next() aus.)`, 'de'),

    lesson(20, 'Live spielen — Solo & Mute',
`# Live spielen heißt stumm- und lautschalten. Per Tastatur, auf der Zeile am Cursor:
#
#   Alt+X      kommentiert aus + stoppt diesen Player (genauso wieder zurück)
#   Alt+S      SOLO für diesen Player (Rest stumm) · Strg+Alt+S hebt Solo auf
#   Alt+O      Solo-Drop: kurz solo, dann kommt alles zurück
#   Strg+;     stoppt alles
#
# ▶ Führe die drei aus (alles markieren + Strg+Alt+Enter), dann Alt+S auf der p1-Zeile:
b1 >> pluck([0, 0, 7, 0], oct=3, dur=1/2, amp=0.5)
p1 >> saw([0, 4, 7], dur=1/2, lpf=2000, amp=0.35)
d1 >> play("x-o-")`, 'de'),

    lesson(21, 'Die P[…]-Werkzeugkiste',
`# P[…] baut ein Pattern, das du mit verkettbaren Methoden TRANSFORMIERST:
#
#   P[0,2,4,7].rotate(1)     verschiebt die Sequenz
#   .mirror() · .palindrome() · .shuffle() · .reverse()
#   .stutter(2) · .every(4, "reverse") · .arp([0,4,7]) · .layer("add", 2)
#
# ▶ Eine Melodie, die sich in sich selbst faltet:
p1 >> pluck(P[0, 2, 4, 7, 9].palindrome().rotate(1), dur=1/2)`, 'de'),

    lesson(22, 'Groove & Swing',
`# Gerade Noten klingen roboterhaft — füge GROOVE mit einem dur-Pattern hinzu. Der Haken:
# Groove ist ein Pattern von DAUERN, es swingt also nur AUFEINANDERFOLGENDE Schläge. Bei
# einem An/Aus-Pattern wie "-.-.-." füllt jedes Schlag+Pause-Paar einen ganzen Beat und der
# Swing hebt sich auf — nimm einen VOLLEN Schlag ("-" loopt jede Stufe eine Hi-Hat), um ihn zu hören:
#
#   PGroove("swing")   Swing-Feel · "swing16" (schneller) · "shuffle" · "gallop" · "triplet"
#   PDur(3, 8)         euklidische Dauern — 3 Schläge über 8 verteilt
#
# ▶ Eine geswingte 16tel-Hi-Hat (jede Stufe ein Schlag, Swing hörbar) über galoppierendem Bass:
h1 >> play("-", dur=PGroove("swing16"), hpf=6000, amp=0.5)
b1 >> pluck([0, 0, 5, 3], oct=3, dur=PGroove("gallop"), amp=0.5)`, 'de'),

    lesson(23, 'Bring deine eigenen Klänge mit',
`# Lade BELIEBIGES Audio per URL — Samples, Loops oder ein ganzes Kit:
#
#   loadsample("z", "https://…/clap.wav")    dann nutze es:   d1 >> play("z-z-")
#   loadloop("brk", "https://…/loop.wav")    ein tempo-synchroner Loop:  l1 >> loop("brk", dur=4)
#   loadpack("…/pack.json")                  ein ganzes Kit auf einmal (Lektion 5)
#
# (Setze eine echte URL ein und führe es aus — die Platzhalter oben laden so nicht.)`, 'de'),

    lesson(24, 'Sets, die sich nie wiederholen — #@goto',
`# #@goto(teil, prob) ist eine WEICHE ohne Länge: eine Chance  prob , zu diesem Teil zu
# springen, sonst FÄLLT es auf die nächste Zeile. Verkette mehrere und du bekommst
# gewichtete Mehrweg-Verzweigung — ein Markov-artiges Set, das bei jedem Durchlauf einen
# anderen Weg nimmt, endlos.
#
# ▶ Cursor auf  #@intro(8) , Strg+Enter, dann hör zu — die Pfeile unter jedem Teil
#   entscheiden, wie es weitergeht (Kit aus Lektion 5 für die Drums nötig):
#@#@ markov_set
#@intro(8)
p1 >> pads([0, 4], oct=(5, 6), dur=4, sus=4, reverb=0.7, lpf=1200, amp=0.3)
#@goto(intro, 0.3)      # 30%: im Intro bleiben — sonst weiter zur Strophe
#@verse(16)
p1 >> pads([0, 4, 5, 3], oct=5, dur=4, sus=4, reverb=0.5, lpf=1600, amp=0.3)
b1 >> bass([0, 0, 5, 3], oct=3, dur=1/2, amp=0.5)
d1 >> play("x-o-", dur=1/2)
#@goto(chorus, 0.5)     # 50%: zum Refrain springen — sonst zur Bridge fallen
#@bridge(8)
p1 >> pluck([7, 9, 11, 7], oct=4, dur=1/4, echo=0.3, amp=0.4)
b1 >> bass([5, 5, 3, 0], oct=3, dur=1/2, amp=0.5)
d1 >> play("x-o-", dur=1/2)
#@goto(verse, 0.6)      # 60%: zurück zur Strophe — sonst weiter zum Refrain
#@chorus(16)
p1 >> pluck([0, 4, 7, 4], oct=4, dur=1/4, amp=0.4).unison(2)
b1 >> bass([0, 3, 5, 7], oct=3, dur=1/4, amp=0.5)
d1 >> play("x-<oo>", dur=1/2)
h1 >> play("-", dur=1/4, hpf=6000, amp=0.35)
#@goto(drop, 0.4)       # 40%: in den Drop …
#@goto(verse, 1)        # … die anderen 60%: zurück zur Strophe (verkettete gotos = Mehrweg)
#@drop(8)
p1 >> pluck([0, 0, 0, 0], oct=4, dur=1/4, amp=0.3).unison(3)
b1 >> bass([0], oct=2, dur=1/4, drive=3, amp=0.6)
d1 >> play("X", dur=1/4, amp=0.9)
#@goto(verse, 1)        # der Drop kehrt immer zur Strophe zurück
#@end`, 'de'),

    lesson(25, 'MIDI — externe Geräte spielen',
`# crashDot spricht MIDI: steuere Hardware-Synths & Drum-Machines oder spiele von einem
# Controller. Schalte es mit dem MIDI-Button ein (rechtes Panel), dann:
#
#   m1 >> midiout([0, 4, 7], channel=0, oct=5, dur=1/2)   sende Noten hinaus
#   midiin()                                              spiele die eingebauten Synths VON einer Tastatur
#
# ▶ Einen Param MIDI zuzuordnen ist eine ZUWEISUNG, wie bei jeder anderen var —
#   mlearn() trägt nur die CC-Nummer für dich ein. Werte das aus, bewege dann
#   irgendeinen Regler/Fader deines Controllers; er koppelt sich an die zuletzt bewegte CC:
p1 >> pluck([0, 4, 7], dur=1/2)
p1.lpf = mlearn(200, 8000)
#
# Kennst du die CC-Nummer schon? Dann brauchst du nicht zu drehen — midi(cc, lo, hi)
# bindet direkt daran: p1.lpf = midi(74, 200, 8000).
#
# ▶ Noch schneller: Cursor AUF eine Zahl setzen (wie die 800 unten) und Alt+M
#   drücken. Das verwandelt sie in mlearn(…) (Grenzen aus dem Wert geschätzt)
#   und führt die Zeile für dich aus — nichts neu tippen:
p1 >> pluck([0, 4, 7], cutoff=800, dur=1/2)
#
# (Braucht ein MIDI-Gerät + die Erlaubnis des Browsers — ohne das nichts auszuführen.)`, 'de'),

    lesson(26, 'Autovervollständigung im Detail',
`# Strg+Leertaste ist KONTEXTBEZOGEN — es bietet genau das, was an der Cursor-Stelle passt:
#
#   nach  name >>      Synths, nach Familie gruppiert (bass · lead · keys · pads …)
#   in    ( )          die Params dieses Synths + eine  fx -Gruppe
#   die  fx -Gruppe    klappt nach Familie auf: Filter · Reverbs · Delays · Distortion …
#                      eine Wahl fügt den ganzen Reglersatz ein (z. B. reverb + room)
#   nach  param =      Patterns & vars (PRand, PEuclid, sinvar, var …)
#   Scale.default = "  Tonleiter-Namen   ·   pal="   Paletten-Namen
#
# ▶ Klicke direkt VOR die schließende  )  unten (gleich hinter dem Pattern), Strg+Leertaste,
#   öffne die  fx -Gruppe, wähle eine:
p1 >> pluck([0, 2, 4, 7])
#
# → / ← öffnen & schließen eine Gruppe · ↑ ↓ bewegen · Enter / Tab wählt · Esc schließt.`, 'de'),

    lesson(27, 'Mehr Patterns',
`# Patterns sind das Herzstück. Eine Tour der GENERATOREN (Cursor drauf → Alt+I):
#
#   PRand · PWhite · PWalk        Zufallsauswahl & Random Walks
#   PEuclid(3,8) · PDur · PBeat    Rhythmen (Schläge/Dauern über eine Länge verteilt)
#   PStep · PRange · PSine         Formen & Rampen
#   arp · PArp · melody            Arpeggien & Phrasen
#
# Patterns SCHACHTELN sich — ein Pattern in einer Liste löst sich pro Schritt auf:
#   [0, {2, 4}, 7]    wählt 2 oder 4 zufällig in diesem Schritt
#   [0, [4, 2]]       eine Unter-Sequenz (4 dann 2) in einem Schritt
#
# ▶ Eine zufällige Akzentnote mit euklidischen Dauern:
p1 >> pluck([0, {2, 4}, 7, 4], dur=PDur(3, 8), amp=0.5)`, 'de'),

    lesson(28, 'Tastenkürzel & Navigation',
`# Die wichtigsten Tastenkürzel (alle beim Bearbeiten):
#
#   Strg+Enter      führt die Zeile am Cursor aus    Strg+Alt+Enter  führt den Block aus
#   Alt+Hoch/Runter verstellt die Zahl am Cursor, live
#   Alt+X           kommentiert aus + stoppt Player   Strg+;   stoppt alles
#   Alt+I           erklärt die Funktion am Cursor
#   Alt+M           MIDI-Learn für die Zahl am Cursor (Lektion 25)
#   Strg+Leertaste  Autovervollständigung             Strg+/   Kommentar umschalten
#   Alt+T           nimmt eine Reglerbewegung als Automation auf
#   Strg+Alt+P      SPRINGT zur AKTIVEN Section — dorthin, wo das Set gerade ist
#   Shift+Alt+Z     Zen-Modus (UI ausblenden)  ·  F1  Docs
#
# Strg+Alt+P ist der Sprung „zur Kompositions-Position".`, 'de'),

    lesson(29, 'Praktische Funktionen',
`# Praktische Funktionen zum jederzeit Auswerten:
#
#   drop(14, 2)                ein Aufbau → ein gefilterter DROP über die laufenden Player
#   shutup()                   stoppt alle Player (sanfter als Strg+;)
#   swap("p1", "p2", "degree") tauscht ein Attribut zwischen zwei Playern, live
#   darker() / lighter()       verschiebt die Stimmung der Tonleiter, Modus für Modus
#   linbpm(120, 140, 16)       gleitet das Tempo 120→140 über 16 Beats
#   say("hallo")   print("…")  sprechen / ausgeben
#
# ▶ Bring zwei Player zum Laufen, dann werte  drop(8, 2)  aus für Aufbau + Drop:
p1 >> saw([0, 4, 7], dur=1/2, lpf=1500, amp=0.4)
b1 >> pluck([0, 0, 7, 0], oct=3, dur=1/2, amp=0.5)`, 'de'),

    lesson(30, 'Regler live drehen',
`# Du musst keine ganze Zeile neu tippen, um eine Sache zu ändern. An einem LAUFENDEN Player:
#
#   p1.lpf = linvar([500, 5000], [8])   setze NUR ein Attribut (hier ein Filter-Sweep)
#   p1.every(8, "reverse")              hänge eine Transfo an, ohne neu zu starten
#   ~p1 >> pluck([0, 4])                das  ~  SETZT einen Player ZURÜCK (löscht geerbte Regler)
#
# ▶ Starte dies, dann führe die p1.lpf-Zeile darunter aus, um den Filter live zu wobbeln:
p1 >> saw([0, 4, 7, 9], dur=1/2, amp=0.4)
p1.lpf = linvar([500, 5000], [8])`, 'de'),

    lesson(31, 'Pausen, Lücken & Dynamik',
`# Stille formt einen Groove genauso wie Noten:
#
#   [0, _, 4, _]        _  (oder  rest ) = eine echte Pause — ein Loch im Pattern
#   play("x. .x")       .  oder Leerzeichen = eine Pause zwischen Schlägen
#   amp=[0.6, 0.3]      Lautstärke pro Schritt · amplify=Pacc("offbeat") = fertige Akzente
#
# ▶ Ein Bass mit Pausen und eine Hi-Hat, deren OFFBEATS betont sind (Kit nötig). Die
#   Hi-Hat ist ein volles "-" pro Stufe, damit die Akzente auf Schläge fallen:
p1 >> pluck([0, _, 0, _, 7, _], oct=3, dur=1/4, amp=0.5)
h1 >> play("-", amplify=Pacc("offbeat"), hpf=6000, dur=1/4)`, 'de'),

    lesson(32, 'Player koppeln',
`# Player können EINANDER BEOBACHTEN, damit sich die Parts wie einer bewegen. Vier Wege,
# sie zu koppeln:
#
#   p1.degree         eine LEBENDE Referenz auf p1s aktuelle Note — setze sie in die Args
#                     eines anderen Players, und der folgt p1 Note für Note (hier spielt
#                     der Bass p1s Grundton, mit eigener Oktave & Dauer).
#   .follow("p1")     Kurzform derselben Idee: spiele p1s degree bei jedem Schritt — eine
#                     UNISONO-Verdopplung, aber mit deinem Synth / oct / dur.
#   .accompany("p1")  HARMONISIERE: p1s Note plus eine zyklische Akkordform ([0,2,4] Terzen
#                     als Default) — eine automatische Harmoniestimme, die der Melodie folgt.
#   p1.reroll(8)      werte p1 alle 8 Takte neu aus, damit ein eingefrorener Zufall (PRand,
#                     ein gemischtes Motiv…) jedes Mal neu würfelt statt sich zu wiederholen.
#
# ▶ Ein Pad, ein Bass auf dem Grundton, eine Unisono-Verdopplung und eine Harmonie — alle an p1 gekoppelt:
p1 >> pads([0, 3, 5, 4], oct=5, dur=2, amp=0.4, reverb=0.5)
b1 >> bass(p1.degree, oct=4, dur=2, amp=0.5)
b3 >> blip(dur=1/2, oct=4, mverb=0.1, spin=0.5, pan=[-1, 1]).follow("p1")
b4 >> blip(dur=1/4, oct=4).accompany("p1").unison(3)`, 'de'),

    lesson(33, 'Speichern, teilen & wiederfinden',
`# Deine Arbeit ist sicher und teilbar:
#
#   • der Editor SPEICHERT automatisch in diesem Browser — lade neu, sie ist noch da.
#   • ⤴ share (oben) kopiert einen eigenständigen LINK: die ganze Komposition steckt in
#     der URL, wer ihn öffnet, bekommt deinen exakten Code — kein Server nötig.
#   • rec code (rechtes Panel) nimmt deine Auswertungen als abspielbares #@-Set auf;
#     rec audio nimmt den Klang selbst in eine Datei auf.
#
# (Nichts auszuführen — klicke ⤴ share, wenn du etwas gemacht hast, das dir gefällt.)`, 'de'),

    lesson(34, 'Tempo & die Clock',
`# Alles hängt an einer CLOCK. Stelle das Tempo in Schlägen pro Minute (BPM):
Clock.bpm = 132
# Das Clock-Panel (rechte Leiste) zeigt das BPM live — du kannst auch ins Feld tippen,
# oder den tap-Button im Takt TIPPEN: er liest das Tempo aus deinen Taps.
#
# Tempo kann sich auch BEWEGEN — Clock.bpm nimmt eine TimeVar, es rampt wie jeder Param:
#   Clock.bpm = linvar([120, 140], [16])   # gleitet 120→140 über 16 Beats
#   linbpm(120, 140, 16)                    # dasselbe als Helfer · dropbpm(90, 8) ab jetzt
#
# ▶ Starte eine Zeile, dann rampe das Tempo darunter:
p1 >> pluck([0, 2, 4, 7], dur=1/2)
Clock.bpm = linvar([110, 150], [8])
#
# QUANTISIERUNG — warum Schichten gekoppelt bleiben: die erste Note eines neuen Players
# fällt auf den nächsten Beat, der ein Vielfaches ihres dur ist. dur=4 wartet also auf den
# Takt, dur=1/4 startet fast sofort — füge Player jederzeit hinzu, sie rasten aufs Raster
# ein (auch Alt+X wartet auf den Takt). Clock.meter = Beats pro Takt; Clock.nextBar(fn) /
# Clock.mod(4, fn) starten eigene One-Shots auf dem Raster.`, 'de'),

    lesson(35, 'Fetter & breiter — .unison()',
`# .unison(n) stapelt n VERSTIMMTE Kopien einer Stimme, über das Stereofeld verteilt —
# sofortige „Supersaw"-Dicke und -Breite aus einer Zeile. Stelle sie mit Verstimmung
# & Breite ein:
#
#   .unison(3)            3 Stimmen, sanfte Standard-Verstimmung, volle Breite
#   .unison(5, 0.3)       5 Stimmen, ±0,3 Halbton Verstimmung (breiter = mehr Schimmer)
#   .unison(4, 0.2, 60)   4 Stimmen, engere Verstimmung, 60% Stereobreite
#
# Es funktioniert auch bei Samples — jede Kopie wird verstimmt und gepannt.
#
# ▶ Dieselbe Zeile, trocken und dann fett — werte jede aus und höre sie aufblühen:
p1 >> saw([0, 4, 7], oct=5, dur=1/2, lpf=2000, amp=0.35)
p1 >> saw([0, 4, 7], oct=5, dur=1/2, lpf=2000, amp=0.35).unison(5, 0.3)
#
# Top für Leads, Pads und Bässe. Halte n bei dichten Parts klein — jede Stimme ist eine
# echte Extra-Note, kostet also CPU. Kombiniere es mit Hall für eine riesige Klangwand.`, 'de'),

    lesson(36, 'The mixer — perform your tracks live',
`# The MIXER (🎚 mix, top toolbar) is a live desk + CLIP-LAUNCHER for your tracks. It
# floats and is NON-MODAL — keep coding while it's open.
#
# ▶ Run this 4-part set (NO #@end, so it plays on forever). Cursor on #@ intro(16),
#   Ctrl+Enter — then open  🎚 mix  and perform it. Each part redefines the SAME tracks:
#@ intro(16)
bass  >> dbass(dur=4, mverb=0, chop=0)
drum  >> a_bd(dur=1, oct=3)
bass2 >> ebass([0, <0 5>, 3, 0], oct=4, dur=1, amp=0.5, tremolo=0.48, trem_rate=4).every(16, "rotate")
#@ main(16)
bass  >> dbass(dur=1/2, mverb=0, chop=0)
drum  >> a_bd(dur=1, oct=3)
bass2 >> ebass([0, <0 5>, 3, 0], oct=4, dur=1, amp=0.5, tremolo=0.48, trem_rate=4).every(16, "rotate")
#@ var(16)
bass  >> dbass(dur=1/2, mverb=0.5, chop=4)
drum  >> a_bd(dur=1, oct=3)
bass2 >> ebass([0, <0 5>, 3, 0], oct=5, dur=1, amp=0.5, tremolo=0.48, trem_rate=4).every(16, "rotate")
#@ outro(16)
bass  >> dbass(dur=1/2, mverb=0.6, chop=4)
drum  >> a_bd(dur=1, oct=3)
bass2 >> ebass([0, <0 5>, 3, 0], oct=5, dur=1/2, amp=0.7, tremolo=0.48, trem_rate=4).every(16, "rotate")
#
# Now click  🎚 mix. Each track is a vertical strip:
#   • FADER   its volume — shared per NAME, and kept SEPARATE from amplify, so
#             mute / solo / drop can never wipe your mix. Mirrors the Players panel.
#   • S / M   SOLO and MUTE — shared with the Players panel AND code .solo()/drop(),
#             so all three always agree.
#   • ■       STOP, quantised to the next bar.
#   • m       MIDI-learn — click it, move a hardware fader, and that CC drives the level.
#
# LAUNCH: tap a track's NAME to evaluate its line and start it on its own — no autoplay
# needed. The SOURCE picker (auto · a chip per #@ part) chooses which part's version a
# launch pulls from, so you can fire  bass  DRY from 'intro', then relaunch it WET from
# 'var' (its mverb + chop) while  bass2  climbs an octave — a whole set built by hand.
#
# ▶ Run .solo() here and watch the S light up in BOTH the mixer and the Players panel:
bass.solo(8)`, 'de'),

    lesson(37, 'Parameter envelopes — lpf_ and the _ sweeps',
`# Add "_" to an FX parameter and it becomes an ENVELOPE — a shape that MOVES that
# param within each note. The classic is a filter sweep: lpf_ glides the low-pass
# cutoff every time a note fires.
#
# Three shapes, each written f(dur, a, b) — dur in BEATS, a & b the two endpoints:
#   fi(dur, a, b)   fade IN   —  a → b, then holds at b
#   fo(dur, a, b)   fade OUT  —  b → a, then holds at a   (fi's mirror)
#   fb(dur, a, b)   BOUNCE    —  a ↔ b triangle, looping every dur (for the note's sus)
#
# ▶ Each pluck OPENS its filter, 400 → 4000 Hz over one beat:
p1 >> pluck([0, 2, 4, 7], dur=1, lpf_=fi(1, 400, 4000))
#
# ▶ The mirror — each note CLOSES, 4000 → 400 (that quacky "pluck" shape):
p1 >> pluck([0, 2, 4, 7], dur=1, lpf_=fo(1, 400, 4000))
#
# ▶ Bounce = a wobble. Hold ONE long note and the cutoff see-saws every half beat:
b1 >> bass([0], dur=8, sus=8, lpf_=fb(1/2, 300, 4000))
#
# The envelope plays over the note's SUS, so give it room — a short note only shows the
# START of a slow sweep. Longer sus = the whole shape unfolds:
p1 >> pads([0, 4, 7], dur=4, sus=4, lpf_=fi(4, 300, 6000))
#
# RESONANCE makes a sweep SING. lpr is the low-pass resonance (LOWER = sharper peak;
# 0.7 default, ~0.15 = squelchy). Note lpr is a SEPARATE param from lpf_ :
b1 >> bass([0, 0, 3, 5], oct=4, dur=1/2, lpf_=fi(1/2, 200, 3500), lpr=0.15)`, 'de'),

    lesson(38, 'Envelopes everywhere — any FX param + clock-sync',
`# It's not only the filter — EVERY effect param takes a "_" envelope: crush_, reverb_,
# chorus_, echo_, hpf_, djf_ … the same fi / fo / fb shapes sweep that effect per note.
#
# ▶ bit-depth cleaning up — starts gritty (4 levels) and smooths to 16:
p1 >> pluck([0, 2, 4, 7], dur=1, crush=0.6, bits_=fi(1, 4, 16))
#
# ▶ reverb SWELLING in over two beats (dry → drenched):
p1 >> pads([0, 4], dur=4, sus=4, reverb_=fi(2, 0, 0.9), room=0.9)
#
# ▶ a high-pass sweeping up = a riser / filter-out:
d1 >> play("x-o-", dur=1/2, hpf_=fi(4, 100, 4000))
#
# TWO MODES — the "_" is the switch:
#   lpf_=fb(1, 400, 4000)   PER-NOTE: the shape RESTARTS on every note (timed from when
#                           that note fired) — each note gets its own fresh sweep.
#   lpf =fb(8, 400, 4000)   NO "_": ONE clock-synced value shared by everything — a
#                           global LFO on the timeline, so every player moves together.
# ▶ Run both — same wobble, per-note vs global:
p1 >> pluck([0, 2, 4, 7], dur=1/2, lpf_=fb(1, 400, 4000))
b1 >> bass([0], dur=8, sus=8, lpf=fb(8, 400, 4000))
#
# GOTCHAS: "_" envelopes work only on EFFECT params (filters, reverb, crush, echo,
# chorus, djf …) — NOT the note params amp / oct / dur / pan. To move those, use a
# var() (lesson 9). And don't confuse  lpf_  (the envelope) with  lpr  (resonance).`, 'de'),

    lesson(39, 'Glissando — .slider()',
`# .slider() makes a player GLIDE in pitch between notes — a portamento sweep.
# Chain it onto any melodic synth (basses, saws, leads, keys, plucks).
#
# ▶ The default alternates a steady note and a swept one:
b1 >> bass([0, 3, 5, 7], dur=1/2).slider()
#
# ▶ .slider(1) flips the phase — the OTHER notes sweep:
b1 >> bass([0, 3, 5, 7], dur=1/2).slider(1)
#
# PER-NOTE control — pass a PATTERN of 0/1: 1 = glide THIS note · 0 = steady.
# ▶ every 3rd note glides:
p1 >> pluck([0, 2, 4, 7], dur=1/2).slider([0, 0, 1])
#
# ▶ a var lets the glide breathe over time (mostly steady, then bursts of glide):
d1 >> dbass([0, 3, 5], dur=1/2).slider(var([0, 1], [6, 2]))
#
# Turn it off with .slider(0, 0). On synths with no pitch-glide (drums/samples)
# it's a harmless no-op — safe to chain anywhere. Killer on acid basslines & leads.`, 'de'),

    lesson(40, 'Du bist bereit ✨',
`# Das ist die ganze Schleife:   SCHREIBEN  →  AUSFÜHREN (Strg+Enter)  →  ÄNDERN  →  erneut.
#
# Wohin als Nächstes:
#   • examples (oben)  ganze Stücke & Techniken — klicke eins zum Laden
#   • der docs-Button  jeder Synth, Effekt, jedes Pattern & Tastenkürzel
#   • galaxy           stöbere & jamme mit anderen, live
#
# Jetzt leere diesen Buffer (Strg+A, Entf) und mach etwas Eigenes.
# Willkommen an Bord!`, 'de'),
];

// ── ESPAÑOL ──────────────────────────────────────────────────────────────────
// El CÓDIGO de los ejemplos permanece en inglés (el idioma de la herramienta); solo
// se traducen los comentarios #. Para corregir: edita este array — sin tocar código.
const ES = [
    lesson(1, 'Bienvenido — cómo funciona este tour',
`# Live coding = escribes código, lo EVALÚAS y oyes sonido al instante — luego
# lo cambias MIENTRAS suena. Todo el tour ocurre aquí mismo, en el editor.
#
# 🌍  ¿Otro idioma? Pon el cursor en una de estas líneas y pulsa Ctrl+Enter:
language("en")   # English — put the cursor on this line and press Ctrl+Enter
language("fr")   # français — place le curseur sur cette ligne et fais Ctrl+Entrée
language("de")   # Deutsch — Cursor auf diese Zeile setzen, dann Strg+Enter
language("ja")   # 日本語 — この行にカーソルを置いて Ctrl+Enter
#
# CÓMO FUNCIONA:
#   • Lee las líneas de comentario (las que empiezan por #).
#   • Ejecuta las líneas de ejemplo  ▶ : pon el cursor en la línea y pulsa Ctrl+Enter.
#   • Cuando estés listo, evalúa  next()  (al pie de cada lección) para seguir.
#     back()  retrocede ·  tour()  lista las lecciones ·  tour(5)  salta a la lección 5.
#     El sonido sigue sonando mientras avanzas — pulsa  Ctrl+;  para parar todo.
#
# PRIMERO: haz clic en  ▸ boot  (arriba a la izquierda) para arrancar el audio.
# Luego pon el cursor en la línea  next()  de abajo y pulsa Ctrl+Enter.`, 'es'),

    lesson(2, 'Tu primer player',
`# Un PLAYER produce sonido. Se lee así:     nombre  >>  synth( pattern )
#
#   p1          el nombre del player (CUALQUIER nombre vale: p1, bass, lead, d1 …)
#   pluck       el synth — el instrumento
#   [0,2,4,7]   el pattern de notas, una por paso, EN BUCLE sin fin
#
# ▶ Ejecuta esto (cursor en la línea, Ctrl+Enter) — un arpegio en bucle:
p1 >> pluck([0, 2, 4, 7])
#
# Sigue sonando. Editar nunca lo detiene — de eso se trata.`, 'es'),

    lesson(3, 'Cámbialo mientras suena',
`# La magia es editar EN VIVO. Pon el cursor sobre un número de abajo,
# pulsa Alt+Arriba / Alt+Abajo para ajustarlo, luego Ctrl+Enter para oírlo.
#
# ▶ Cambia un número aquí, vuelve a ejecutar, repite:
p1 >> pluck([0, 2, 4, 7])
#
# Convierte un 4 en 5, o añade notas:  [0, 2, 4, 7, 9, 12]
# Nada que compilar, nada que reiniciar — solo vuelve a ejecutar.`, 'es'),

    lesson(4, 'Params — dar forma al sonido',
`# Tras las notas vienen los PARAMS — perillas, escritas  nombre=valor :
#
#   amp   volumen 0–1          dur  duración de nota en beats (1/2 = corchea)
#   oct   octava arriba/abajo  pan  posición estéreo (-1 izq … 1 der)
#
# ▶ El mismo synth, moldeado — más rápido, más suave, más agudo, yendo izq↔der:
p1 >> pluck([0, 2, 4, 7], dur=1/2, amp=0.5, oct=5, pan=[-0.5, 0.5])
#
# Cada synth tiene sus propias perillas — el autocompletado (lección 12) las encuentra.`, 'es'),

    lesson(5, 'Dos fuentes de sonido — cargar un kit',
`# Hay DOS fuentes de sonido:
#   • SYNTHS   generados con matemáticas (pluck, saw, pads …) — nada que descargar.
#   • SAMPLES  audio grabado (baterías, hits) — necesitan un KIT cargado.
#
# ▶ Carga el kit por defecto — ejecútalo y ESPERA unos segundos a que termine
#   (el progreso aparece en el log, abajo a la izquierda):
loadpack("https://cdn.jsdelivr.net/gh/CrashServer/webfoxdot-kit@v1/pack.json")
#
# Cuando aparezca «loaded», evalúa  next()  para las baterías.`, 'es'),

    lesson(6, 'Batería con play()',
`# play("…") dispara SAMPLES del kit. Cada carácter es un paso:
#
#   x = bombo   o = caja   - = charles   .  o espacio = un silencio
#   X / O más fuerte ·  <xx> = dos golpes en un paso (un redoble) ·  [a b] alterna
#
# ▶ Un beat sencillo (necesita el kit de la lección 5):
d1 >> play("x-o-")
#
# ▶ Más denso — ejecútalo para cambiar el pattern en vivo:
d1 >> play("x.x.o.<xx>")
#
# ▶ [a b] en acción — el 2º paso cambia x → o → x → o… una vez cada vez que
#   el pattern COMPLETO da la vuelta (no cada paso — <x o> sería un redoble rápido):
d1 >> play("x[xo]")`, 'es'),

    lesson(7, 'Patterns — listas, acordes, subdivisión',
`# La lista en [ … ] es un PATTERN: un valor por paso, en bucle. Los corchetes
# significan lo MISMO aquí que en play():
#
#   [0, 2, 4]      una secuencia — un valor por paso
#   (0, 4, 7)      un ACORDE — esas notas suenan juntas (un grupo)
#   [0, [7, 9]]    una lista ANIDADA ALTERNA — 7 un ciclo, 9 el siguiente, y repite
#   <7 7 7>        SUBDIVISIÓN — meterlas en UN solo paso (un redoble/flam)
#   {0, 4, 7}      ALEATORIO — elegir una en cada paso
#
# ▶ Todo en una línea — el 3.º hueco hace un redoble, el último alterna:
p1 >> pluck([0, (0,4,7), <4 4 4>, [7, 9]], dur=1/2)`, 'es'),

    lesson(8, 'Generadores — patterns que se escriben solos',
`# En vez de teclear cada nota, los GENERADORES construyen los patterns por ti:
#
#   PRand([0,2,4,7])     elige una nota al azar en cada paso
#   PEuclid(3, 8)        un ritmo euclidiano — 3 golpes repartidos en 8 pasos
#   arp([0,4,7], "up")   arpegia un acorde: up / down / updown / random
#
# ▶ Una línea de notas aleatorias:
p1 >> blip(PRand([0, 2, 4, 7, 9]), dur=1/2, amp=0.5)
#
# TRUCO: pon el cursor sobre  PRand  y pulsa  Alt+I  para una explicación instantánea
# de CUALQUIER función de pattern.`, 'es'),

    lesson(9, 'TimeVars — valores que se mueven',
`# Un valor puede EVOLUCIONAR con el tiempo — perfecto para barridos de filtro:
#
#   sinvar([300, 4000], [8])   desliza 300→4000→300 (una onda seno) en 8 beats
#   linvar([0, 1], [16])       sube 0→1 en línea recta en 16 beats
#
# ▶ Un saw cuyo filtro pasa-bajos se abre y se cierra solo:
p1 >> saw([0, 4, 7], dur=1/2, lpf=sinvar([400, 5000], [8]), amp=0.4)
#
# CUALQUIER param acepta una var — cutoff, amp, pan, dur … todo puede respirar.`, 'es'),

    lesson(10, 'Efectos',
`# Los efectos también son params — añádelos a cualquier player y apílalos:
#
#   lpf / hpf  filtros        reverb + room  espacio        echo + echo_time  delay
#   chorus · drive · crush · chop · … (decenas — el autocompletado los lista)
#
# ▶ Un pad exuberante a través de reverb y un filtro suave:
p1 >> pads([0, 4, 7], dur=4, sus=4, reverb=0.6, room=0.9, lpf=1400, chorus=0.4, amp=0.4)`, 'es'),

    lesson(11, 'Varios players — capas y control',
`# Los players se apilan: dale un nombre a cada uno y suenan juntos. Y los controlas:
#
#   Alt+X en una línea  → la comenta y DETIENE solo ese player
#   Ctrl+;              → detiene TODO de golpe
#
# ▶ Ejecuta estos tres (uno a uno, o selecciona todo + Ctrl+Alt+Enter):
b1 >> pluck([0, 0, 7, 0], oct=3, dur=1/2, amp=0.5)
p1 >> saw([0, 4, 7], dur=1/2, lpf=2000, amp=0.35)
d1 >> play("x-o-")
#
# Ahora Alt+X en la línea b1 para silenciar el bajo. Ctrl+; detiene todo.
# El panel Players (barra derecha) lista todo lo que suena — tu vista general en vivo.`, 'es'),

    lesson(12, 'Autocompletado — no memorices nada',
`# ¿No sabes qué teclear? Pulsa  Ctrl+Espacio :
#
#   tras  nombre >>    la lista de synths
#   dentro de ( )      los params de ese synth + los efectos
#   tras  param =      patterns / vars para insertar
#
# ▶ Haz clic al FINAL de la siguiente línea y pulsa Ctrl+Espacio para explorar:
p1 >>
#
# Las flechas mueven · → / ← abren y cierran un grupo · Enter / Tab elige · Esc cierra.`, 'es'),

    lesson(13, 'Arreglar — sections y sets',
`# Para temas completos, marca SECTIONS con  #@nombre(compases) . Pon el cursor en una
# línea #@ y Ctrl+Enter — suena y CAMBIA sola tras esos compases.
# #@#@ agrupa sections en una pista plegable ·  #@end  detiene el set al terminar.
#
# Mira el panel Composition (barra derecha) mientras suena: lista las partes y muestra
# una barra de progreso de por dónde va el set — haz clic en una parte para saltar allí.
#   Ctrl+Alt+P  salta a la parte ACTIVA   ·   Ctrl+Alt+;  (o ■ stop autoplay en el panel)
#   detiene el avance automático pero deja los players sonando   ·   Ctrl+;  detiene todo.
#
# ▶ Un pequeño set en dos partes — cursor en  #@a(8)  y Ctrl+Enter:
#@#@ my_set
#@a(8)
p1 >> pluck([0, 2, 4, 7], dur=1/2)
#@b(8)
p1 >> pluck([7, 4, 2, 0], dur=1/4, echo=0.3)
d1 >> play("x-o-")
#@end`, 'es'),

    lesson(14, 'Parte 2 — transformar un pattern en vivo',
`# ✦ Bien hecho — eso eran los fundamentos. La Parte 2 profundiza.
#
# Encadena TRANSFORMACIONES en un player para remodelarlo mientras suena:
#
#   .every(8, "reverse")      cada 8 compases, invierte el pattern
#   .sometimes("stutter", 2)  de vez en cuando, parte un paso en 2
#   también métodos de lista:  [0,2,4,7].rotate(1) · .mirror() · .shuffle() · .palindrome()
#
# ▶ Una línea que se transforma sin parar:
p1 >> pluck([0, 2, 4, 7, 9], dur=1/2).every(8, "reverse").sometimes("stutter", 2)`, 'es'),

    lesson(15, 'Armonía — escala, acordes y progresiones',
`# Fija la TONALIDAD una vez, y todo la sigue — en código, o con los menús Scale & Root
# del panel derecho (bajo Clock):
Scale.default = "minor"
Root.default  = "C"
#
#   PChord(0, "7")           un acorde de séptima sobre la tónica (un grupo de notas)
#   PRoman("i VI III VII")   una progresión en cifrado romano
#   PProg("pop")             una progresión con nombre (I V vi IV)
#
# ▶ Un pad que deriva por una progresión menor:
p1 >> pads(PProg("pop"), oct=(6, 7), dur=4, sus=4, reverb=0.6, room=0.9, lpf=1600, amp=0.4)`, 'es'),

    lesson(16, 'Generativo — deja que la máquina te sorprenda',
`# Dos formas de ceder algo de control:
#
#   chaos()   INSERTA un bloque de players aleatorios en el editor — revísalo,
#             ajústalo, luego Ctrl+Alt+Enter para lanzar el bloque (no suena solo).
#   son()     arranca un «bot de jam» que evoluciona players solo · soff() lo detiene.
#
# ▶ Cede las riendas al bot (soff() o Ctrl+; para parar):
son()
#
# ▶ …o genera un bloque para revisar (aparece debajo — lánzalo con Ctrl+Alt+Enter):
chaos()`, 'es'),

    lesson(17, 'Crea tu propio synth — defsynth()',
`# No te limitas a los synths incluidos — DEFINE tu instrumento. Dale un nombre,
# params y una función de construcción con UGens; convierte la altura con
# note.midicps(); termina con Out.ar(...).  (Hay que haber hecho boot.)
#
# ▶ Selecciona todo este bloque y pulsa Ctrl+Alt+Enter para definir «buzz»:
defsynth("buzz", { cutoff: 1500 }, ({ out, note, amp, sus, pan, attack, release, cutoff }) => {
  const env = EnvGen.ar(Env.perc(attack, sus, 1, -4), { doneAction: 2 })
  const sig = RLPF.ar(Saw.ar(note.midicps()), cutoff, 0.4).mul(env).mul(amp)
  Out.ar(out, Pan2.ar(sig, pan))
})
#
# ▶ …luego tócalo como cualquier synth:
p1 >> buzz([0, 3, 7, 3], dur=1/2, cutoff=sinvar([600, 4000], [8]))`, 'es'),

    lesson(18, 'Graba tu set · temas',
`# El panel derecho (Settings) reúne varias herramientas para tocar en vivo:
#
#   Theme       un menú de 8 skins (arriba en Settings) — Dark, Nova, Synthwave,
#               Hacker, Sakura, Paper… cambia los colores al instante, guardado para la próxima.
#   rec code    graba tus evaluaciones como una composición #@ reproducible
#   rec audio   graba la señal de audio a un archivo (marca «share tab audio»)
#
# Y  Alt+T  activa el grabador de AUTOMATIZACIÓN: mueve una perilla con Alt+Arriba/Abajo
# durante unos beats y escribe el movimiento como un linvar por ti.
#
# ▶ ¿Prefieres el teclado? Cambia de skin desde código (theme() solo los lista todos):
theme("synthwave")   # · solar · fiesta 🎉 · sakura · hacker · nova · paper · brutalist · cyberpunk · dark
#
# (Los botones rec no necesitan código — pruébalos cuando quieras, luego evalúa next().)`, 'es'),

    lesson(19, 'Improvisa con otros',
`# crashDot es multijugador. Dos formas de entrar:
#
#   👥 go live   convierte tu código en una sesión compartida — pasa el enlace y otros
#               editan EL MISMO buffer contigo, sincronizados, con sus cursores.
#   🌌 galaxy    un mapa en vivo de cada jam público — haz clic en una estrella para unirte.
#
# En una sesión todos ven las evaluaciones de los demás; el chat está en el panel derecho.
# (Nada que ejecutar — haz clic en go live si quieres compartir. Luego evalúa next().)`, 'es'),

    lesson(20, 'Tocar en vivo — solo y mute',
`# Tocar en vivo es silenciar y activar. Con el teclado, en la línea del cursor:
#
#   Alt+X      comenta + detiene este player (reactívalo igual)
#   Alt+S      SOLO este player (silencia el resto) · Ctrl+Alt+S quita el solo
#   Alt+O      solo-drop: solo unos compases, luego vuelve todo
#   Ctrl+;     detiene todo
#
# ▶ Ejecuta los tres (selecciona todo + Ctrl+Alt+Enter), luego Alt+S en la línea p1:
b1 >> pluck([0, 0, 7, 0], oct=3, dur=1/2, amp=0.5)
p1 >> saw([0, 4, 7], dur=1/2, lpf=2000, amp=0.35)
d1 >> play("x-o-")`, 'es'),

    lesson(21, 'La caja de herramientas P[…]',
`# P[…] construye un pattern que TRANSFORMAS con métodos encadenables:
#
#   P[0,2,4,7].rotate(1)     desplaza la secuencia
#   .mirror() · .palindrome() · .shuffle() · .reverse()
#   .stutter(2) · .every(4, "reverse") · .arp([0,4,7]) · .layer("add", 2)
#
# ▶ Una melodía que se pliega sobre sí misma:
p1 >> pluck(P[0, 2, 4, 7, 9].palindrome().rotate(1), dur=1/2)`, 'es'),

    lesson(22, 'Groove y swing',
`# Las notas rectas suenan robóticas — añade GROOVE con un pattern de dur. El truco: el
# groove es un pattern de DURACIONES, así que solo balancea golpes CONSECUTIVOS. En un
# pattern on/off como "-.-.-." cada golpe+silencio llena un beat entero y el swing se
# anula — usa un golpe SÓLIDO ("-" repite un charles en cada paso) para oírlo de verdad:
#
#   PGroove("swing")   swing · "swing16" (más rápido) · "shuffle" · "gallop" · "triplet"
#   PDur(3, 8)         duraciones euclidianas — 3 golpes repartidos en 8
#
# ▶ Un charles con swing en semicorcheas (un golpe por paso, swing audible) sobre un bajo al galope:
h1 >> play("-", dur=PGroove("swing16"), hpf=6000, amp=0.5)
b1 >> pluck([0, 0, 5, 3], oct=3, dur=PGroove("gallop"), amp=0.5)`, 'es'),

    lesson(23, 'Trae tus propios sonidos',
`# Carga CUALQUIER audio por URL — samples, loops o un kit entero:
#
#   loadsample("z", "https://…/clap.wav")    luego úsalo:   d1 >> play("z-z-")
#   loadloop("brk", "https://…/loop.wav")    un loop sincronizado al tempo:  l1 >> loop("brk", dur=4)
#   loadpack("…/pack.json")                  un kit entero de una vez (lección 5)
#
# (Pon una URL real y ejecútalo — los marcadores de arriba no cargan así.)`, 'es'),

    lesson(24, 'Sets que nunca se repiten — #@goto',
`# #@goto(parte, prob) es un ENRUTADOR sin duración: una probabilidad  prob  de saltar a
# esa section, si no CAE a la línea siguiente. Encadena varios y tienes una ramificación
# ponderada de varias vías — un set tipo Markov que toma un camino distinto en cada
# reproducción, sin fin.
#
# ▶ Cursor en  #@intro(8) , Ctrl+Enter, y escucha — las flechas bajo cada parte deciden
#   adónde va después (necesita el kit de la lección 5 para la batería):
#@#@ markov_set
#@intro(8)
p1 >> pads([0, 4], oct=(5, 6), dur=4, sus=4, reverb=0.7, lpf=1200, amp=0.3)
#@goto(intro, 0.3)      # 30%: quédate en la intro — si no, entra al verso
#@verse(16)
p1 >> pads([0, 4, 5, 3], oct=5, dur=4, sus=4, reverb=0.5, lpf=1600, amp=0.3)
b1 >> bass([0, 0, 5, 3], oct=3, dur=1/2, amp=0.5)
d1 >> play("x-o-", dur=1/2)
#@goto(chorus, 0.5)     # 50%: salta al estribillo — si no, cae al puente
#@bridge(8)
p1 >> pluck([7, 9, 11, 7], oct=4, dur=1/4, echo=0.3, amp=0.4)
b1 >> bass([5, 5, 3, 0], oct=3, dur=1/2, amp=0.5)
d1 >> play("x-o-", dur=1/2)
#@goto(verse, 0.6)      # 60%: de vuelta al verso — si no, hacia el estribillo
#@chorus(16)
p1 >> pluck([0, 4, 7, 4], oct=4, dur=1/4, amp=0.4).unison(2)
b1 >> bass([0, 3, 5, 7], oct=3, dur=1/4, amp=0.5)
d1 >> play("x-<oo>", dur=1/2)
h1 >> play("-", dur=1/4, hpf=6000, amp=0.35)
#@goto(drop, 0.4)       # 40%: al drop …
#@goto(verse, 1)        # … el otro 60%: de vuelta al verso (gotos encadenados = varias vías)
#@drop(8)
p1 >> pluck([0, 0, 0, 0], oct=4, dur=1/4, amp=0.3).unison(3)
b1 >> bass([0], oct=2, dur=1/4, drive=3, amp=0.6)
d1 >> play("X", dur=1/4, amp=0.9)
#@goto(verse, 1)        # el drop siempre vuelve al verso
#@end`, 'es'),

    lesson(25, 'MIDI — tocar equipos externos',
`# crashDot habla MIDI: controla synths y cajas de ritmo por hardware, o toca desde un
# controlador. Actívalo con el botón MIDI (panel derecho), luego:
#
#   m1 >> midiout([0, 4, 7], channel=0, oct=5, dur=1/2)   envía notas fuera
#   midiin()                                              toca los synths incluidos DESDE un teclado
#
# ▶ Asignar un param a MIDI es una ASIGNACIÓN, igual que cualquier otra var —
#   mlearn() solo rellena el CC por ti. Evalúa esto, luego mueve cualquier
#   perilla/fader de tu controlador; se fija al CC que acaba de detectar:
p1 >> pluck([0, 4, 7], dur=1/2)
p1.lpf = mlearn(200, 8000)
#
# ¿Ya conoces el número de CC? Sáltate el movimiento — midi(cc, lo, hi) se
# asigna directo: p1.lpf = midi(74, 200, 8000).
#
# ▶ Aún más rápido: pon el cursor SOBRE un número (como el 800 de abajo) y
#   pulsa Alt+M. Lo convierte en mlearn(…) (límites adivinados a partir del
#   valor) y ejecuta la línea por ti — sin volver a escribir:
p1 >> pluck([0, 4, 7], cutoff=800, dur=1/2)
#
# (Necesita un equipo MIDI + permiso del navegador — sin eso, nada que ejecutar.)`, 'es'),

    lesson(26, 'Autocompletado en detalle',
`# Ctrl+Espacio es CONTEXTUAL — ofrece justo lo que encaja en la posición del cursor:
#
#   tras  nombre >>    synths, agrupados por familia (bass · lead · keys · pads …)
#   dentro de ( )      los params de ese synth + un grupo  fx
#   el grupo  fx       se despliega por familia: Filtros · Reverbs · Delays · Distorsión …
#                      una elección inserta el juego entero de perillas (p. ej. reverb + room)
#   tras  param =      patterns y vars (PRand, PEuclid, sinvar, var …)
#   Scale.default = "  nombres de escala   ·   pal="   nombres de paleta
#
# ▶ Haz clic justo ANTES del  )  de cierre de abajo (justo tras el pattern), Ctrl+Espacio,
#   abre el grupo  fx , elige uno:
p1 >> pluck([0, 2, 4, 7])
#
# → / ← abren y cierran un grupo · ↑ ↓ mueven · Enter / Tab elige · Esc cierra.`, 'es'),

    lesson(27, 'Más patterns',
`# Los patterns son el corazón. Un recorrido por los GENERADORES (cursor encima → Alt+I):
#
#   PRand · PWhite · PWalk        selección aleatoria y random walks
#   PEuclid(3,8) · PDur · PBeat    ritmos (golpes/duraciones repartidos en un largo)
#   PStep · PRange · PSine         formas y rampas
#   arp · PArp · melody            arpegios y frases
#
# Los patterns se ANIDAN — un pattern dentro de una lista se resuelve por paso:
#   [0, {2, 4}, 7]    elige 2 o 4 al azar en ese paso
#   [0, [4, 2]]       una sub-secuencia (4 luego 2) en un paso
#
# ▶ Una nota de acento aleatoria con duraciones euclidianas:
p1 >> pluck([0, {2, 4}, 7, 4], dur=PDur(3, 8), amp=0.5)`, 'es'),

    lesson(28, 'Atajos de teclado y navegación',
`# Los atajos clave (todos mientras editas):
#
#   Ctrl+Enter       ejecuta la línea del cursor      Ctrl+Alt+Enter  ejecuta el bloque
#   Alt+Arriba/Abajo ajusta el número del cursor, en vivo
#   Alt+X            comenta + detiene player          Ctrl+;   detiene todo
#   Alt+I            explica la función del cursor
#   Alt+M            MIDI-learn del número bajo el cursor (lección 25)
#   Ctrl+Espacio     autocompletado                    Ctrl+/   alterna comentario
#   Alt+T            graba un movimiento de perilla como automatización
#   Ctrl+Alt+P       SALTA a la section ACTIVA — donde va el set ahora mismo
#   Shift+Alt+Z      modo zen (oculta la UI)  ·  F1  docs
#
# Ctrl+Alt+P es el salto «a la posición de la composición».`, 'es'),

    lesson(29, 'Funciones prácticas',
`# Funciones prácticas para evaluar en cualquier momento:
#
#   drop(14, 2)                una subida → un DROP filtrado sobre los players que suenan
#   shutup()                   detiene todos los players (más suave que Ctrl+;)
#   swap("p1", "p2", "degree") intercambia un atributo entre dos players, en vivo
#   darker() / lighter()       desplaza el ánimo de la escala, modo a modo
#   linbpm(120, 140, 16)       desliza el tempo 120→140 en 16 beats
#   say("hola")   print("…")   habla / imprime
#
# ▶ Pon dos players a sonar, luego evalúa  drop(8, 2)  para subida + drop:
p1 >> saw([0, 4, 7], dur=1/2, lpf=1500, amp=0.4)
b1 >> pluck([0, 0, 7, 0], oct=3, dur=1/2, amp=0.5)`, 'es'),

    lesson(30, 'Girar perillas en vivo',
`# No hace falta reescribir una línea entera para cambiar una cosa. En un player QUE SUENA:
#
#   p1.lpf = linvar([500, 5000], [8])   fija SOLO un atributo (aquí un barrido de filtro)
#   p1.every(8, "reverse")              añade una transfo sin reiniciar
#   ~p1 >> pluck([0, 4])                el  ~  REINICIA un player (borra perillas heredadas)
#
# ▶ Lanza esto, luego ejecuta la línea p1.lpf de abajo para hacer wobble al filtro en vivo:
p1 >> saw([0, 4, 7, 9], dur=1/2, amp=0.4)
p1.lpf = linvar([500, 5000], [8])`, 'es'),

    lesson(31, 'Silencios, huecos y dinámica',
`# El silencio da forma a un groove tanto como las notas:
#
#   [0, _, 4, _]        _  (o  rest ) = un silencio real — un hueco en el pattern
#   play("x. .x")       .  o espacio = un silencio entre golpes
#   amp=[0.6, 0.3]      volumen por paso · amplify=Pacc("offbeat") = acentos listos
#
# ▶ Un bajo con silencios y un charles cuyos CONTRATIEMPOS van acentuados (necesita kit).
#   El charles es un "-" sólido en cada paso para que los acentos caigan sobre golpes:
p1 >> pluck([0, _, 0, _, 7, _], oct=3, dur=1/4, amp=0.5)
h1 >> play("-", amplify=Pacc("offbeat"), hpf=6000, dur=1/4)`, 'es'),

    lesson(32, 'Acoplar players',
`# Los players pueden OBSERVARSE entre sí, para que las partes se muevan como una. Cuatro
# formas de enlazarlos:
#
#   p1.degree         una referencia VIVA a la nota actual de p1 — ponla en los args de
#                     otro player y ese seguirá a p1 nota a nota (aquí el bajo toca la
#                     fundamental de p1, con su propia octava y duración).
#   .follow("p1")     atajo para lo mismo: toca el degree de p1 en cada paso — un doblaje
#                     al UNÍSONO, pero con tu synth / oct / dur.
#   .accompany("p1")  ARMONIZA: la nota de p1 más una forma de acorde cíclica ([0,2,4]
#                     terceras por defecto) — una línea de armonía que sigue a la melodía.
#   p1.reroll(8)      re-evalúa p1 cada 8 compases, para que un azar congelado (PRand, un
#                     motivo barajado…) vuelva a tirar cada vez en lugar de repetirse.
#
# ▶ Un pad, un bajo en su fundamental, un doblaje al unísono y una armonía — todos atados a p1:
p1 >> pads([0, 3, 5, 4], oct=5, dur=2, amp=0.4, reverb=0.5)
b1 >> bass(p1.degree, oct=4, dur=2, amp=0.5)
b3 >> blip(dur=1/2, oct=4, mverb=0.1, spin=0.5, pan=[-1, 1]).follow("p1")
b4 >> blip(dur=1/4, oct=4).accompany("p1").unison(3)`, 'es'),

    lesson(33, 'Guardar, compartir y recuperar',
`# Tu trabajo está a salvo y se puede compartir:
#
#   • el editor GUARDA solo en este navegador — recarga y sigue ahí.
#   • ⤴ share (arriba) copia un ENLACE autónomo: toda la composición va en la URL,
#     quien lo abra recibe tu código exacto — sin servidor.
#   • rec code (panel derecho) graba tus evaluaciones como un set #@ reproducible;
#     rec audio graba el sonido mismo a un archivo.
#
# (Nada que ejecutar — haz clic en ⤴ share cuando hagas algo que te guste.)`, 'es'),

    lesson(34, 'Tempo & el reloj',
`# Todo se apoya en un RELOJ. Fija el tempo en pulsos por minuto (BPM):
Clock.bpm = 132
# El panel Clock (barra derecha) muestra el BPM en vivo — también puedes escribir en
# ese campo, o TOCAR el botón tap a tiempo: lee el tempo de tus toques.
#
# El tempo también puede MOVERSE — Clock.bpm acepta una TimeVar, y rampa como un param:
#   Clock.bpm = linvar([120, 140], [16])   # desliza 120→140 en 16 pulsos
#   linbpm(120, 140, 16)                    # lo mismo, como ayuda · dropbpm(90, 8) desde ahora
#
# ▶ Lanza una línea, luego desliza el tempo por debajo:
p1 >> pluck([0, 2, 4, 7], dur=1/2)
Clock.bpm = linvar([110, 150], [8])
#
# QUANTIZACIÓN — por qué las capas quedan acopladas: la primera nota de un player nuevo
# cae en el próximo pulso múltiplo de su dur. Así dur=4 espera al compás, dur=1/4 arranca
# casi al instante — añade players cuando quieras y encajan en la rejilla (Alt+X también
# espera al compás). Clock.meter = pulsos por compás; Clock.nextBar(fn) / Clock.mod(4, fn)
# lanzan tus propios one-shots en la rejilla.`, 'es'),

    lesson(35, 'Engordar & ensanchar — .unison()',
`# .unison(n) apila n copias DESAFINADAS de una voz, repartidas por el campo estéreo —
# un grosor y una anchura «supersaw» al instante desde una sola línea. Ajústalo con la
# desafinación & la anchura:
#
#   .unison(3)            3 voces, desafinación suave por defecto, anchura completa
#   .unison(5, 0.3)       5 voces, ±0.3 semitonos de desafinación (más ancho = más brillo)
#   .unison(4, 0.2, 60)   4 voces, desafinación más ceñida, 60% de anchura estéreo
#
# También funciona en samples — cada copia se repitcha y se panea.
#
# ▶ La misma línea, seca y luego engordada — ejecuta cada una y óyela abrirse:
p1 >> saw([0, 4, 7], oct=5, dur=1/2, lpf=2000, amp=0.35)
p1 >> saw([0, 4, 7], oct=5, dur=1/2, lpf=2000, amp=0.35).unison(5, 0.3)
#
# Genial en leads, pads y bajos. Mantén n pequeño en partes cargadas — cada voz es una
# nota real extra, así que cuesta CPU. Combínalo con reverb para un muro de sonido enorme.`, 'es'),

    lesson(36, 'The mixer — perform your tracks live',
`# The MIXER (🎚 mix, top toolbar) is a live desk + CLIP-LAUNCHER for your tracks. It
# floats and is NON-MODAL — keep coding while it's open.
#
# ▶ Run this 4-part set (NO #@end, so it plays on forever). Cursor on #@ intro(16),
#   Ctrl+Enter — then open  🎚 mix  and perform it. Each part redefines the SAME tracks:
#@ intro(16)
bass  >> dbass(dur=4, mverb=0, chop=0)
drum  >> a_bd(dur=1, oct=3)
bass2 >> ebass([0, <0 5>, 3, 0], oct=4, dur=1, amp=0.5, tremolo=0.48, trem_rate=4).every(16, "rotate")
#@ main(16)
bass  >> dbass(dur=1/2, mverb=0, chop=0)
drum  >> a_bd(dur=1, oct=3)
bass2 >> ebass([0, <0 5>, 3, 0], oct=4, dur=1, amp=0.5, tremolo=0.48, trem_rate=4).every(16, "rotate")
#@ var(16)
bass  >> dbass(dur=1/2, mverb=0.5, chop=4)
drum  >> a_bd(dur=1, oct=3)
bass2 >> ebass([0, <0 5>, 3, 0], oct=5, dur=1, amp=0.5, tremolo=0.48, trem_rate=4).every(16, "rotate")
#@ outro(16)
bass  >> dbass(dur=1/2, mverb=0.6, chop=4)
drum  >> a_bd(dur=1, oct=3)
bass2 >> ebass([0, <0 5>, 3, 0], oct=5, dur=1/2, amp=0.7, tremolo=0.48, trem_rate=4).every(16, "rotate")
#
# Now click  🎚 mix. Each track is a vertical strip:
#   • FADER   its volume — shared per NAME, and kept SEPARATE from amplify, so
#             mute / solo / drop can never wipe your mix. Mirrors the Players panel.
#   • S / M   SOLO and MUTE — shared with the Players panel AND code .solo()/drop(),
#             so all three always agree.
#   • ■       STOP, quantised to the next bar.
#   • m       MIDI-learn — click it, move a hardware fader, and that CC drives the level.
#
# LAUNCH: tap a track's NAME to evaluate its line and start it on its own — no autoplay
# needed. The SOURCE picker (auto · a chip per #@ part) chooses which part's version a
# launch pulls from, so you can fire  bass  DRY from 'intro', then relaunch it WET from
# 'var' (its mverb + chop) while  bass2  climbs an octave — a whole set built by hand.
#
# ▶ Run .solo() here and watch the S light up in BOTH the mixer and the Players panel:
bass.solo(8)`, 'es'),

    lesson(37, 'Parameter envelopes — lpf_ and the _ sweeps',
`# Add "_" to an FX parameter and it becomes an ENVELOPE — a shape that MOVES that
# param within each note. The classic is a filter sweep: lpf_ glides the low-pass
# cutoff every time a note fires.
#
# Three shapes, each written f(dur, a, b) — dur in BEATS, a & b the two endpoints:
#   fi(dur, a, b)   fade IN   —  a → b, then holds at b
#   fo(dur, a, b)   fade OUT  —  b → a, then holds at a   (fi's mirror)
#   fb(dur, a, b)   BOUNCE    —  a ↔ b triangle, looping every dur (for the note's sus)
#
# ▶ Each pluck OPENS its filter, 400 → 4000 Hz over one beat:
p1 >> pluck([0, 2, 4, 7], dur=1, lpf_=fi(1, 400, 4000))
#
# ▶ The mirror — each note CLOSES, 4000 → 400 (that quacky "pluck" shape):
p1 >> pluck([0, 2, 4, 7], dur=1, lpf_=fo(1, 400, 4000))
#
# ▶ Bounce = a wobble. Hold ONE long note and the cutoff see-saws every half beat:
b1 >> bass([0], dur=8, sus=8, lpf_=fb(1/2, 300, 4000))
#
# The envelope plays over the note's SUS, so give it room — a short note only shows the
# START of a slow sweep. Longer sus = the whole shape unfolds:
p1 >> pads([0, 4, 7], dur=4, sus=4, lpf_=fi(4, 300, 6000))
#
# RESONANCE makes a sweep SING. lpr is the low-pass resonance (LOWER = sharper peak;
# 0.7 default, ~0.15 = squelchy). Note lpr is a SEPARATE param from lpf_ :
b1 >> bass([0, 0, 3, 5], oct=4, dur=1/2, lpf_=fi(1/2, 200, 3500), lpr=0.15)`, 'es'),

    lesson(38, 'Envelopes everywhere — any FX param + clock-sync',
`# It's not only the filter — EVERY effect param takes a "_" envelope: crush_, reverb_,
# chorus_, echo_, hpf_, djf_ … the same fi / fo / fb shapes sweep that effect per note.
#
# ▶ bit-depth cleaning up — starts gritty (4 levels) and smooths to 16:
p1 >> pluck([0, 2, 4, 7], dur=1, crush=0.6, bits_=fi(1, 4, 16))
#
# ▶ reverb SWELLING in over two beats (dry → drenched):
p1 >> pads([0, 4], dur=4, sus=4, reverb_=fi(2, 0, 0.9), room=0.9)
#
# ▶ a high-pass sweeping up = a riser / filter-out:
d1 >> play("x-o-", dur=1/2, hpf_=fi(4, 100, 4000))
#
# TWO MODES — the "_" is the switch:
#   lpf_=fb(1, 400, 4000)   PER-NOTE: the shape RESTARTS on every note (timed from when
#                           that note fired) — each note gets its own fresh sweep.
#   lpf =fb(8, 400, 4000)   NO "_": ONE clock-synced value shared by everything — a
#                           global LFO on the timeline, so every player moves together.
# ▶ Run both — same wobble, per-note vs global:
p1 >> pluck([0, 2, 4, 7], dur=1/2, lpf_=fb(1, 400, 4000))
b1 >> bass([0], dur=8, sus=8, lpf=fb(8, 400, 4000))
#
# GOTCHAS: "_" envelopes work only on EFFECT params (filters, reverb, crush, echo,
# chorus, djf …) — NOT the note params amp / oct / dur / pan. To move those, use a
# var() (lesson 9). And don't confuse  lpf_  (the envelope) with  lpr  (resonance).`, 'es'),

    lesson(39, 'Glissando — .slider()',
`# .slider() makes a player GLIDE in pitch between notes — a portamento sweep.
# Chain it onto any melodic synth (basses, saws, leads, keys, plucks).
#
# ▶ The default alternates a steady note and a swept one:
b1 >> bass([0, 3, 5, 7], dur=1/2).slider()
#
# ▶ .slider(1) flips the phase — the OTHER notes sweep:
b1 >> bass([0, 3, 5, 7], dur=1/2).slider(1)
#
# PER-NOTE control — pass a PATTERN of 0/1: 1 = glide THIS note · 0 = steady.
# ▶ every 3rd note glides:
p1 >> pluck([0, 2, 4, 7], dur=1/2).slider([0, 0, 1])
#
# ▶ a var lets the glide breathe over time (mostly steady, then bursts of glide):
d1 >> dbass([0, 3, 5], dur=1/2).slider(var([0, 1], [6, 2]))
#
# Turn it off with .slider(0, 0). On synths with no pitch-glide (drums/samples)
# it's a harmless no-op — safe to chain anywhere. Killer on acid basslines & leads.`, 'es'),

    lesson(40, 'Estás listo ✨',
`# Este es todo el bucle:   ESCRIBIR  →  EJECUTAR (Ctrl+Enter)  →  CAMBIAR  →  otra vez.
#
# Adónde ir ahora:
#   • examples (arriba)  temas completos y técnicas — haz clic en uno para cargarlo
#   • el botón docs      cada synth, efecto, pattern y atajo
#   • galaxy             explora e improvisa con otros, en vivo
#
# Ahora vacía este buffer (Ctrl+A, Supr) y haz algo tuyo.
# ¡Bienvenido a bordo!`, 'es'),
];

// ── 日本語 ───────────────────────────────────────────────────────────────────
// 例の「コード」は英語のまま（ツールの言語）。訳すのは # のコメントだけ。
// 修正するにはこの配列を編集すればよく、コードには触れない。
const JA = [
    lesson(1, 'ようこそ — このツアーの使い方',
`# ライブコーディング = コードを書いて「評価」すると即座に音が鳴る — そして
# 鳴っている「まま」書き換える。ツアーはすべてこのエディタ内で進む。
#
# 🌍  他の言語で？ 次のいずれかの行にカーソルを置いて Ctrl+Enter：
language("en")   # English — put the cursor on this line and press Ctrl+Enter
language("fr")   # français — place le curseur sur cette ligne et fais Ctrl+Entrée
language("de")   # Deutsch — Cursor auf diese Zeile setzen, dann Strg+Enter
language("es")   # español — pon el cursor en esta línea y pulsa Ctrl+Enter
#
# 使い方：
#   • # で始まるコメント行を読む。
#   •  ▶  の例の行を実行する：行にカーソルを置いて Ctrl+Enter。
#   • 準備ができたら（各レッスン末尾の） next()  を評価して次へ進む。
#     back()  で戻る ·  tour()  で一覧 ·  tour(5)  でレッスン5へジャンプ。
#     進んでも音は鳴り続ける — すべて止めるには  Ctrl+;  を押す。
#
# まず：▸ boot （左上）をクリックしてオーディオエンジンを起動する。
# それから下の  next()  の行にカーソルを置いて Ctrl+Enter。`, 'ja'),

    lesson(2, '最初のプレイヤー',
`# プレイヤーが音を出す。読み方：     名前  >>  synth( pattern )
#
#   p1          プレイヤーの名前（何でもよい：p1, bass, lead, d1 …）
#   pluck       シンセ — 楽器
#   [0,2,4,7]   音符のパターン。1ステップに1つ、無限にループする
#
# ▶ これを実行（行にカーソル、Ctrl+Enter）— ループするアルペジオ：
p1 >> pluck([0, 2, 4, 7])
#
# 鳴り続ける。編集しても止まらない — それが肝心。`, 'ja'),

    lesson(3, '鳴らしたまま書き換える',
`# 魔法は「ライブ編集」。下の数字にカーソルを置き、
# Alt+上 / Alt+下 で増減して、Ctrl+Enter で聴く。
#
# ▶ ここで数字を変えて、再実行、を繰り返す：
p1 >> pluck([0, 2, 4, 7])
#
# 4 を 5 にしたり、音を足したり：  [0, 2, 4, 7, 9, 12]
# コンパイルも再起動も不要 — ただ再実行するだけ。`, 'ja'),

    lesson(4, 'パラメータ — 音を形づくる',
`# 音符のあとに来るのが「パラメータ」— つまみ、書き方は  名前=値 ：
#
#   amp   音量 0–1          dur  音の長さ（ビート単位、1/2 = 8分音符）
#   oct   オクターブ上下     pan  ステレオ位置（-1 左 … 1 右）
#
# ▶ 同じシンセを形づくる — 速く、静かに、高く、左右に動かす：
p1 >> pluck([0, 2, 4, 7], dur=1/2, amp=0.5, oct=5, pan=[-0.5, 0.5])
#
# どのシンセにも固有のつまみがある — オートコンプリート（レッスン12）が見つけてくれる。`, 'ja'),

    lesson(5, '2つの音源 — キットを読み込む',
`# 音源は2種類：
#   • SYNTHS   数式から生成（pluck, saw, pads …）— ダウンロード不要。
#   • SAMPLES  録音された音（ドラム、ヒット）— 「キット」の読み込みが必要。
#
# ▶ デフォルトのキットを読み込む — 実行して数秒「待つ」（完了するまで）
#   （進捗は左下のログに出る）：
loadpack("https://cdn.jsdelivr.net/gh/CrashServer/webfoxdot-kit@v1/pack.json")
#
# 「loaded」と出たら、 next()  を評価してドラムへ。`, 'ja'),

    lesson(6, 'play() でドラム',
`# play("…") はキットの「サンプル」を鳴らす。各文字が1ステップ：
#
#   x = バスドラム   o = スネア   - = ハイハット   .  または空白 = 休符
#   X / O は大きく ·  <xx> = 1ステップに2打（ロール） ·  [a b] は交替
#
# ▶ シンプルなビート（レッスン5のキットが必要）：
d1 >> play("x-o-")
#
# ▶ もっと密に — 実行するとパターンをライブで差し替え：
d1 >> play("x.x.o.<xx>")
#
# ▶ [a b] の実例 — 2番目のステップが x → o → x → o … とパターン全体が
#   一周するたびに切り替わる（1ステップごとではない — <x o> なら高速ロールになる）：
d1 >> play("x[xo]")`, 'ja'),

    lesson(7, 'パターン — リスト・和音・サブディビジョン',
`# [ … ] の中のリストが「パターン」：1ステップに1値、ループする。括弧の意味は
# play() と同じ：
#
#   [0, 2, 4]      シーケンス — 1ステップに1値
#   (0, 4, 7)      「和音」— それらの音が一緒に鳴る（1つのグループ）
#   [0, [7, 9]]    ネストしたリストは交替 — 7を1周、次は9、以降くり返し
#   <7 7 7>        サブディビジョン — 1ステップに詰め込む（ロール/フラム）
#   {0, 4, 7}      ランダム — 各ステップで1つを選ぶ
#
# ▶ 1行に全部 — 3番目はロール、最後は交替：
p1 >> pluck([0, (0,4,7), <4 4 4>, [7, 9]], dur=1/2)`, 'ja'),

    lesson(8, 'ジェネレーター — 自動でパターンを作る',
`# 音符を一つずつ打つ代わりに、「ジェネレーター」がパターンを組み立ててくれる：
#
#   PRand([0,2,4,7])     各ステップでランダムに1音を選ぶ
#   PEuclid(3, 8)        ユークリッドリズム — 8ステップに3打を配分
#   arp([0,4,7], "up")   和音をアルペジオ化：up / down / updown / random
#
# ▶ ランダムな音の1行：
p1 >> blip(PRand([0, 2, 4, 7, 9]), dur=1/2, amp=0.5)
#
# ヒント：PRand  にカーソルを置いて  Alt+I  を押すと、どのパターン関数でも
# その場で説明が出る。`, 'ja'),

    lesson(9, 'TimeVar — 動く値',
`# 値は時間とともに「変化」できる — フィルタースイープに最適：
#
#   sinvar([300, 4000], [8])   300→4000→300 と滑る（サイン波）、8ビートで
#   linvar([0, 1], [16])       0→1 と直線的に上がる、16ビートで
#
# ▶ ローパスフィルターがひとりでに開閉する saw：
p1 >> saw([0, 4, 7], dur=1/2, lpf=sinvar([400, 5000], [8]), amp=0.4)
#
# 「どの」パラメータも var を受け取る — cutoff, amp, pan, dur … すべてが呼吸できる。`, 'ja'),

    lesson(10, 'エフェクト',
`# エフェクトもパラメータ — どのプレイヤーにも足せて、重ねられる：
#
#   lpf / hpf  フィルター       reverb + room  空間        echo + echo_time  ディレイ
#   chorus · drive · crush · chop · …（何十種も — オートコンプリートが一覧）
#
# ▶ リバーブと柔らかいフィルターを通した豊かなパッド：
p1 >> pads([0, 4, 7], dur=4, sus=4, reverb=0.6, room=0.9, lpf=1400, chorus=0.4, amp=0.4)`, 'ja'),

    lesson(11, '複数プレイヤー — 重ねて操る',
`# プレイヤーは重なる：それぞれ名前を付ければ一緒に鳴る。そして操れる：
#
#   行の上で Alt+X  → その行をコメント化し、そのプレイヤーだけ止める
#   Ctrl+;         → 「すべて」を一度に止める
#
# ▶ この3つを実行（1つずつ、または全選択 + Ctrl+Alt+Enter）：
b1 >> pluck([0, 0, 7, 0], oct=3, dur=1/2, amp=0.5)
p1 >> saw([0, 4, 7], dur=1/2, lpf=2000, amp=0.35)
d1 >> play("x-o-")
#
# では b1 の行で Alt+X してベースをミュート。Ctrl+; ですべて停止。
# 右サイドバーの Players パネルに、今鳴っているものがすべて並ぶ — ライブの全体像。`, 'ja'),

    lesson(12, 'オートコンプリート — 何も覚えない',
`# 何を打つか分からない？  Ctrl+スペース を押す：
#
#   名前 >>  の後    シンセの一覧
#   ( ) の中        そのシンセのパラメータ + エフェクト
#   param =  の後    挿入するパターン / var
#
# ▶ 次の行の「末尾」をクリックして Ctrl+スペースで探索：
p1 >>
#
# 矢印で移動 · → / ← でグループを開閉 · Enter / Tab で選択 · Esc で閉じる。`, 'ja'),

    lesson(13, 'アレンジ — セクションとセット',
`# 曲全体には  #@名前(小節数)  で「セクション」を印す。#@ の行にカーソルを置いて
# Ctrl+Enter — 再生され、その小節数のあと自動で「切り替わる」。
# #@#@ はセクションを折りたためるトラックにまとめる ·  #@end  で最後にセットを止める。
#
# 再生中は Composition パネル（右サイドバー）を見る：パートが並び、セットが今どこかを
# 示すライブの進捗バーが出る — パートをクリックするとそこへジャンプ。
#   Ctrl+Alt+P  「アクティブ」なパートへジャンプ   ·   Ctrl+Alt+;  （またはパネルの
#   ■ stop autoplay）は自動送りを止めるがプレイヤーは鳴らし続ける   ·   Ctrl+;  で全停止。
#
# ▶ 2部構成の小さなセット — カーソルを  #@a(8)  に置いて Ctrl+Enter：
#@#@ my_set
#@a(8)
p1 >> pluck([0, 2, 4, 7], dur=1/2)
#@b(8)
p1 >> pluck([7, 4, 2, 0], dur=1/4, echo=0.3)
d1 >> play("x-o-")
#@end`, 'ja'),

    lesson(14, 'パート2 — パターンをライブで変形',
`# ✦ よくできました — ここまでが基礎。パート2はより深く。
#
# プレイヤーに「変形」を連ねて、鳴らしたまま作り替える：
#
#   .every(8, "reverse")      8小節ごとにパターンを反転
#   .sometimes("stutter", 2)  ときどき1ステップを2つに割る
#   リストのメソッドも：  [0,2,4,7].rotate(1) · .mirror() · .shuffle() · .palindrome()
#
# ▶ 絶えず変形し続ける1行：
p1 >> pluck([0, 2, 4, 7, 9], dur=1/2).every(8, "reverse").sometimes("stutter", 2)`, 'ja'),

    lesson(15, 'ハーモニー — スケール・和音・進行',
`# 「調」を一度決めれば、すべてがそれに従う — コードで、または右パネルの
# Scale & Root メニュー（Clock の下）で：
Scale.default = "minor"
Root.default  = "C"
#
#   PChord(0, "7")           主音上の7thコード（音のグループ）
#   PRoman("i VI III VII")   ローマ数字での進行
#   PProg("pop")             名前付きの進行（I V vi IV）
#
# ▶ マイナー進行を漂うパッド：
p1 >> pads(PProg("pop"), oct=(6, 7), dur=4, sus=4, reverb=0.6, room=0.9, lpf=1600, amp=0.4)`, 'ja'),

    lesson(16, 'ジェネラティブ — マシンに驚かせてもらう',
`# コントロールを手放す2つの方法：
#
#   chaos()   ランダムなプレイヤーのブロックをエディタに「挿入」する — 見直して、
#             調整し、Ctrl+Alt+Enter でブロックを起動（単体では鳴らない）。
#   son()     プレイヤーを自ら発展させる「ジャムbot」を起動 · soff() で停止。
#
# ▶ botに手綱を渡す（soff() か Ctrl+; で停止）：
son()
#
# ▶ …または見直し用のブロックを生成（下に出る — Ctrl+Alt+Enter で起動）：
chaos()`, 'ja'),

    lesson(17, '自分のシンセを作る — defsynth()',
`# 内蔵シンセだけに縛られない — 自分の楽器を「定義」する。名前・パラメータ・
# UGenで組む生成関数を与え、音高は note.midicps() で変換し、Out.ar(...) で締める。
# （boot 済みであること。）
#
# ▶ このブロック全体を選択して Ctrl+Alt+Enter で「buzz」を定義：
defsynth("buzz", { cutoff: 1500 }, ({ out, note, amp, sus, pan, attack, release, cutoff }) => {
  const env = EnvGen.ar(Env.perc(attack, sus, 1, -4), { doneAction: 2 })
  const sig = RLPF.ar(Saw.ar(note.midicps()), cutoff, 0.4).mul(env).mul(amp)
  Out.ar(out, Pan2.ar(sig, pan))
})
#
# ▶ …あとは普通のシンセと同じように鳴らす：
p1 >> buzz([0, 3, 7, 3], dur=1/2, cutoff=sinvar([600, 4000], [8]))`, 'ja'),

    lesson(18, 'セットを録音する · テーマ',
`# 右パネル（Settings）にはライブ演奏用のツールがいくつか：
#
#   Theme       8種のスキンのメニュー（Settings の上部）— Dark, Nova, Synthwave,
#               Hacker, Sakura, Paper… 色が即座に変わり、次回まで保存される。
#   rec code    評価の履歴を、再生できる #@ コンポジションとして記録
#   rec audio   音声信号をファイルに録音（「share tab audio」にチェック）
#
# さらに  Alt+T  で「オートメーション」記録がオン：Alt+上/下 でつまみを数ビート動かすと、
# その動きを linvar として書き出してくれる。
#
# ▶ キーボード派？ コードでスキンを切り替え（theme() だけで一覧）：
theme("synthwave")   # · solar · fiesta 🎉 · sakura · hacker · nova · paper · brutalist · cyberpunk · dark
#
# （rec ボタンはコード不要 — 好きなときに試して、next() を評価。）`, 'ja'),

    lesson(19, 'みんなでジャム',
`# crashDot はマルチプレイヤー。入り口は2つ：
#
#   👥 go live   コードを共有セッションにする — リンクを渡せば、他の人が「同じ」
#               バッファをあなたと編集する。同期し、カーソルも見える。
#   🌌 galaxy    公開ジャムのライブ地図 — 星をクリックして参加。
#
# セッションでは全員が互いの評価を見られる。チャットは右パネルに。
# （実行するものはない — 共有したければ go live をクリック。それから next()。）`, 'ja'),

    lesson(20, 'ライブ演奏 — ソロとミュート',
`# ライブ演奏はミュートとオンの切り替え。キーボードで、カーソル行に対して：
#
#   Alt+X      コメント化 + このプレイヤーを停止（同じ操作で戻す）
#   Alt+S      このプレイヤーを「ソロ」（他をミュート） · Ctrl+Alt+S でソロ解除
#   Alt+O      ソロドロップ：数小節ソロ、その後すべて戻る
#   Ctrl+;     すべて停止
#
# ▶ 3つを実行（全選択 + Ctrl+Alt+Enter）、それから p1 の行で Alt+S：
b1 >> pluck([0, 0, 7, 0], oct=3, dur=1/2, amp=0.5)
p1 >> saw([0, 4, 7], dur=1/2, lpf=2000, amp=0.35)
d1 >> play("x-o-")`, 'ja'),

    lesson(21, 'P[…] ツールボックス',
`# P[…] は、連結できるメソッドで「変形」するパターンを作る：
#
#   P[0,2,4,7].rotate(1)     シーケンスをずらす
#   .mirror() · .palindrome() · .shuffle() · .reverse()
#   .stutter(2) · .every(4, "reverse") · .arp([0,4,7]) · .layer("add", 2)
#
# ▶ 自分自身に折り重なるメロディ：
p1 >> pluck(P[0, 2, 4, 7, 9].palindrome().rotate(1), dur=1/2)`, 'ja'),

    lesson(22, 'グルーヴとスウィング',
`# まっすぐな音符はロボット的 — dur のパターンで「グルーヴ」を足す。ただし注意：グルーヴは
# 「長さ」のパターンなので、スウィングするのは「連続する」打だけ。"-.-.-." のようなオン/オフの
# パターンでは、打+休符の各ペアが1拍を埋めてスウィングが打ち消し合う — 実際に聴くには
# 「詰まった」打（"-" は各ステップにハイハットをループ）を使う：
#
#   PGroove("swing")   スウィング · "swing16"（速い）· "shuffle" · "gallop" · "triplet"
#   PDur(3, 8)         ユークリッドの長さ — 8に3打を配分
#
# ▶ スウィングした16分のハイハット（各ステップに1打なのでスウィングが聴こえる）＋疾走するベース：
h1 >> play("-", dur=PGroove("swing16"), hpf=6000, amp=0.5)
b1 >> pluck([0, 0, 5, 3], oct=3, dur=PGroove("gallop"), amp=0.5)`, 'ja'),

    lesson(23, '自分の音を持ち込む',
`# URLから「どんな」音声でも読み込める — サンプル、ループ、キット丸ごと：
#
#   loadsample("z", "https://…/clap.wav")    使う：   d1 >> play("z-z-")
#   loadloop("brk", "https://…/loop.wav")    テンポ同期ループ：  l1 >> loop("brk", dur=4)
#   loadpack("…/pack.json")                  キットを一度に（レッスン5）
#
# （本物のURLを入れて実行 — 上のプレースホルダーではこのままでは読めない。）`, 'ja'),

    lesson(24, '決して繰り返さないセット — #@goto',
`# #@goto(パート, 確率) は長さのない「ルーター」：確率  prob  でそのセクションへ飛び、
# 外れると次の行へ「落ちる」。いくつも連ねると重み付きの多方向分岐になる — 毎回違う道を
# たどる、終わらないマルコフ的なセット。
#
# ▶ カーソルを  #@intro(8)  に置いて Ctrl+Enter、あとは聴くだけ — 各パートの下の矢印が
#   次の行き先を決める（ドラムにはレッスン5のキットが必要）：
#@#@ markov_set
#@intro(8)
p1 >> pads([0, 4], oct=(5, 6), dur=4, sus=4, reverb=0.7, lpf=1200, amp=0.3)
#@goto(intro, 0.3)      # 30%：イントロに留まる — 外れれば verse へ
#@verse(16)
p1 >> pads([0, 4, 5, 3], oct=5, dur=4, sus=4, reverb=0.5, lpf=1600, amp=0.3)
b1 >> bass([0, 0, 5, 3], oct=3, dur=1/2, amp=0.5)
d1 >> play("x-o-", dur=1/2)
#@goto(chorus, 0.5)     # 50%：サビへ飛ぶ — 外れれば bridge へ落ちる
#@bridge(8)
p1 >> pluck([7, 9, 11, 7], oct=4, dur=1/4, echo=0.3, amp=0.4)
b1 >> bass([5, 5, 3, 0], oct=3, dur=1/2, amp=0.5)
d1 >> play("x-o-", dur=1/2)
#@goto(verse, 0.6)      # 60%：verse に戻る — 外れれば chorus へ
#@chorus(16)
p1 >> pluck([0, 4, 7, 4], oct=4, dur=1/4, amp=0.4).unison(2)
b1 >> bass([0, 3, 5, 7], oct=3, dur=1/4, amp=0.5)
d1 >> play("x-<oo>", dur=1/2)
h1 >> play("-", dur=1/4, hpf=6000, amp=0.35)
#@goto(drop, 0.4)       # 40%：drop へ …
#@goto(verse, 1)        # … 残り60%：verse に戻る（goto を連ねる = 多方向）
#@drop(8)
p1 >> pluck([0, 0, 0, 0], oct=4, dur=1/4, amp=0.3).unison(3)
b1 >> bass([0], oct=2, dur=1/4, drive=3, amp=0.6)
d1 >> play("X", dur=1/4, amp=0.9)
#@goto(verse, 1)        # drop は必ず verse に戻る
#@end`, 'ja'),

    lesson(25, 'MIDI — 外部機器を鳴らす',
`# crashDot は MIDI を話す：ハードのシンセやドラムマシンを操ったり、コントローラーから
# 弾いたり。MIDIボタン（右パネル）でオンにして：
#
#   m1 >> midiout([0, 4, 7], channel=0, oct=5, dur=1/2)   音符を外へ送る
#   midiin()                                              キーボード「から」内蔵シンセを弾く
#
# ▶ パラメータをMIDIに割り当てるのは、他のvarと同じ「代入」。mlearn() は
#   CC番号を自動で埋めてくれるだけ。これを評価してから、コントローラーの
#   つまみ/フェーダーを何か動かすと、動かしたCCに紐づく：
p1 >> pluck([0, 4, 7], dur=1/2)
p1.lpf = mlearn(200, 8000)
#
# CC番号が分かっているなら、動かす手間は不要 — midi(cc, lo, hi) で直接割り当て：
# p1.lpf = midi(74, 200, 8000)
#
# ▶ もっと速く：カーソルを数値の上に置いて（下の 800 など）Alt+M を押す。
#   その場で mlearn(…) に書き換え（範囲は値から推測）、行も実行してくれる —
#   打ち直し不要：
p1 >> pluck([0, 4, 7], cutoff=800, dur=1/2)
#
# （MIDI機器 + ブラウザの許可が必要 — なければ実行するものはない。）`, 'ja'),

    lesson(26, 'オートコンプリート詳細',
`# Ctrl+スペースは「文脈依存」— カーソル位置にぴったり合うものを出す：
#
#   名前 >>  の後      シンセ、系統ごとにグループ化（bass · lead · keys · pads …）
#   ( ) の中          そのシンセのパラメータ +  fx  グループ
#   fx  グループ       系統ごとに展開：フィルター · リバーブ · ディレイ · 歪み …
#                     選ぶとつまみ一式を挿入（例：reverb + room）
#   param =  の後      パターンと var（PRand, PEuclid, sinvar, var …）
#   Scale.default = "  スケール名   ·   pal="   パレット名
#
# ▶ 下の閉じ  )  の「直前」（パターンのすぐ後ろ）をクリック、Ctrl+スペース、
#   fx  グループを開いて1つ選ぶ：
p1 >> pluck([0, 2, 4, 7])
#
# → / ← でグループ開閉 · ↑ ↓ で移動 · Enter / Tab で選択 · Esc で閉じる。`, 'ja'),

    lesson(27, 'さらにパターン',
`# パターンが核心。「ジェネレーター」を一巡り（カーソルを置いて → Alt+I）：
#
#   PRand · PWhite · PWalk        ランダム選択とランダムウォーク
#   PEuclid(3,8) · PDur · PBeat    リズム（長さの中に打/長さを配分）
#   PStep · PRange · PSine         形とランプ
#   arp · PArp · melody            アルペジオとフレーズ
#
# パターンは「入れ子」にできる — リスト内のパターンはステップごとに解決される：
#   [0, {2, 4}, 7]    そのステップで 2 か 4 をランダムに選ぶ
#   [0, [4, 2]]       1ステップ内のサブシーケンス（4 のあと 2）
#
# ▶ ユークリッドの長さで、ランダムなアクセント音：
p1 >> pluck([0, {2, 4}, 7, 4], dur=PDur(3, 8), amp=0.5)`, 'ja'),

    lesson(28, 'キーボードショートカットと移動',
`# 主要なショートカット（すべて編集中）：
#
#   Ctrl+Enter      カーソル行を実行         Ctrl+Alt+Enter  ブロックを実行
#   Alt+上/下       カーソルの数字をライブで増減
#   Alt+X           コメント化 + プレイヤー停止   Ctrl+;   すべて停止
#   Alt+I           カーソルの関数を説明
#   Alt+M           カーソルの数値をMIDI-learn（レッスン25）
#   Ctrl+スペース   オートコンプリート          Ctrl+/   コメント切り替え
#   Alt+T           つまみの動きをオートメーションとして記録
#   Ctrl+Alt+P      「アクティブ」なセクションへジャンプ — 今セットが進んでいる場所
#   Shift+Alt+Z     禅モード（UIを隠す）  ·  F1  ドキュメント
#
# Ctrl+Alt+P は「コンポジションの現在位置へ」のジャンプ。`, 'ja'),

    lesson(29, '便利な関数',
`# いつでも評価できる便利な関数：
#
#   drop(14, 2)                盛り上げ → 鳴っているプレイヤーにフィルターの「ドロップ」
#   shutup()                   全プレイヤーを止める（Ctrl+; より柔らかい）
#   swap("p1", "p2", "degree") 2つのプレイヤー間で属性を入れ替え、ライブで
#   darker() / lighter()       スケールの雰囲気をモード単位でずらす
#   linbpm(120, 140, 16)       テンポを 120→140 に、16ビートで滑らせる
#   say("こんにちは")  print("…")  しゃべる / 出力する
#
# ▶ 2つのプレイヤーを鳴らし、 drop(8, 2)  を評価して盛り上げ + ドロップ：
p1 >> saw([0, 4, 7], dur=1/2, lpf=1500, amp=0.4)
b1 >> pluck([0, 0, 7, 0], oct=3, dur=1/2, amp=0.5)`, 'ja'),

    lesson(30, 'ライブでつまみを回す',
`# 1つ変えるのに行全体を打ち直す必要はない。「鳴っている」プレイヤーに対して：
#
#   p1.lpf = linvar([500, 5000], [8])   属性を1つ「だけ」設定（ここではフィルタースイープ）
#   p1.every(8, "reverse")              再起動せずに変形を追加
#   ~p1 >> pluck([0, 4])                 ~  はプレイヤーを「リセット」（継承したつまみを消す）
#
# ▶ これを起動し、下の p1.lpf の行を実行してフィルターをライブでワブル：
p1 >> saw([0, 4, 7, 9], dur=1/2, amp=0.4)
p1.lpf = linvar([500, 5000], [8])`, 'ja'),

    lesson(31, '休符・すき間・ダイナミクス',
`# 静けさは音符と同じくらいグルーヴを形づくる：
#
#   [0, _, 4, _]        _ （または  rest ）= 本当の休符 — パターンの穴
#   play("x. .x")       .  または空白 = 打の間の休み
#   amp=[0.6, 0.3]      ステップごとの音量 · amplify=Pacc("offbeat") = 出来合いのアクセント
#
# ▶ 休符のあるベースと、「オフビート」が強調されたハイハット（キットが必要）。
#   ハイハットは各ステップに詰まった "-"、アクセントが打の上に乗るように：
p1 >> pluck([0, _, 0, _, 7, _], oct=3, dur=1/4, amp=0.5)
h1 >> play("-", amplify=Pacc("offbeat"), hpf=6000, dur=1/4)`, 'ja'),

    lesson(32, 'プレイヤーを連動させる',
`# プレイヤーは互いを「見る」ことができ、パートが一つのように動く。連動のさせ方は4つ：
#
#   p1.degree         p1 の今の音への「生きた」参照 — 別プレイヤーの引数に入れると、その
#                     プレイヤーは p1 に音符ごと追従する（ここではベースが p1 の根音を、
#                     自分のオクターブと長さで弾く）。
#   .follow("p1")     同じことの近道：各ステップで p1 の degree を弾く — 「ユニゾン」の
#                     重ね、ただし自分のシンセ / oct / dur で。
#   .accompany("p1")  「ハモる」：p1 の音に、循環する和音の形（既定は [0,2,4] の3度）を足す
#                     — メロディに追従する自動ハーモニー。
#   p1.reroll(8)      8小節ごとに p1 を再評価 — 固まった乱数（PRand、シャッフルした動機…）が
#                     繰り返さず毎回振り直される。
#
# ▶ パッド、その根音のベース、ユニゾンの重ね、ハーモニー — すべて p1 に連動：
p1 >> pads([0, 3, 5, 4], oct=5, dur=2, amp=0.4, reverb=0.5)
b1 >> bass(p1.degree, oct=4, dur=2, amp=0.5)
b3 >> blip(dur=1/2, oct=4, mverb=0.1, spin=0.5, pan=[-1, 1]).follow("p1")
b4 >> blip(dur=1/4, oct=4).accompany("p1").unison(3)`, 'ja'),

    lesson(33, '保存・共有・呼び戻し',
`# 作業は安全に、共有もできる：
#
#   • エディタはこのブラウザに自動「保存」— 再読み込みしても残っている。
#   • ⤴ share（上）は自己完結の「リンク」をコピー：コンポジション全体がURLに入り、
#     開いた人はあなたの正確なコードを受け取る — サーバー不要。
#   • rec code（右パネル）は評価を再生できる #@ セットとして記録；
#     rec audio は音そのものをファイルに録音。
#
# （実行するものはない — 気に入ったものができたら ⤴ share をクリック。）`, 'ja'),

    lesson(34, 'テンポとクロック',
`# すべては一つの「クロック」に乗っている。テンポを BPM（1分あたりの拍）で設定：
Clock.bpm = 132
# Clock パネル（右サイドバー）に現在の BPM がライブで出る — その欄に入力してもいいし、
# tap ボタンをリズムに合わせて「タップ」すると、そのタップからテンポを読み取る。
#
# テンポは「動かす」こともできる — Clock.bpm は TimeVar を受け取り、他の param のように鳴る：
#   Clock.bpm = linvar([120, 140], [16])   # 16拍かけて 120→140 に滑る
#   linbpm(120, 140, 16)                    # 同じ、ヘルパー版 · dropbpm(90, 8) は今から
#
# ▶ 1行を鳴らし、その下でテンポを滑らせる：
p1 >> pluck([0, 2, 4, 7], dur=1/2)
Clock.bpm = linvar([110, 150], [8])
#
# 「クオンタイズ」— なぜ層が揃うのか：新しいプレイヤーの最初の音は、その dur の倍数に
# あたる次の拍に着地する。だから dur=4 は小節を待ち、dur=1/4 はほぼ即座に始まる — いつ
# プレイヤーを足してもグリッドに吸い付く（Alt+X の停止も小節を待つ）。Clock.meter は
# 1小節の拍数、Clock.nextBar(fn) / Clock.mod(4, fn) で自分の単発処理をグリッドに乗せる。`, 'ja'),

    lesson(35, '太く・広く — .unison()',
`# .unison(n) は1つの声を n 個「デチューン」して重ね、ステレオに広げる — 1行から
# 一瞬で「スーパーソウ」の厚みと広がりが出る。デチューン量と広がりで調整：
#
#   .unison(3)            3声、控えめな既定のデチューン、フル幅
#   .unison(5, 0.3)       5声、±0.3半音のデチューン（広いほど揺らぎが増す）
#   .unison(4, 0.2, 60)   4声、狭めのデチューン、ステレオ幅60%
#
# サンプルにも効く — 各コピーがピッチシフト＋パンされる。
#
# ▶ 同じ1行を、素のまま → 太く — それぞれ実行して開花を聴く：
p1 >> saw([0, 4, 7], oct=5, dur=1/2, lpf=2000, amp=0.35)
p1 >> saw([0, 4, 7], oct=5, dur=1/2, lpf=2000, amp=0.35).unison(5, 0.3)
#
# リード・パッド・ベースに最適。詰まったパートでは n を小さく — 各声は本物の追加音
# なので CPU を食う。リバーブと組み合わせれば巨大な音の壁に。`, 'ja'),

    lesson(36, 'The mixer — perform your tracks live',
`# The MIXER (🎚 mix, top toolbar) is a live desk + CLIP-LAUNCHER for your tracks. It
# floats and is NON-MODAL — keep coding while it's open.
#
# ▶ Run this 4-part set (NO #@end, so it plays on forever). Cursor on #@ intro(16),
#   Ctrl+Enter — then open  🎚 mix  and perform it. Each part redefines the SAME tracks:
#@ intro(16)
bass  >> dbass(dur=4, mverb=0, chop=0)
drum  >> a_bd(dur=1, oct=3)
bass2 >> ebass([0, <0 5>, 3, 0], oct=4, dur=1, amp=0.5, tremolo=0.48, trem_rate=4).every(16, "rotate")
#@ main(16)
bass  >> dbass(dur=1/2, mverb=0, chop=0)
drum  >> a_bd(dur=1, oct=3)
bass2 >> ebass([0, <0 5>, 3, 0], oct=4, dur=1, amp=0.5, tremolo=0.48, trem_rate=4).every(16, "rotate")
#@ var(16)
bass  >> dbass(dur=1/2, mverb=0.5, chop=4)
drum  >> a_bd(dur=1, oct=3)
bass2 >> ebass([0, <0 5>, 3, 0], oct=5, dur=1, amp=0.5, tremolo=0.48, trem_rate=4).every(16, "rotate")
#@ outro(16)
bass  >> dbass(dur=1/2, mverb=0.6, chop=4)
drum  >> a_bd(dur=1, oct=3)
bass2 >> ebass([0, <0 5>, 3, 0], oct=5, dur=1/2, amp=0.7, tremolo=0.48, trem_rate=4).every(16, "rotate")
#
# Now click  🎚 mix. Each track is a vertical strip:
#   • FADER   its volume — shared per NAME, and kept SEPARATE from amplify, so
#             mute / solo / drop can never wipe your mix. Mirrors the Players panel.
#   • S / M   SOLO and MUTE — shared with the Players panel AND code .solo()/drop(),
#             so all three always agree.
#   • ■       STOP, quantised to the next bar.
#   • m       MIDI-learn — click it, move a hardware fader, and that CC drives the level.
#
# LAUNCH: tap a track's NAME to evaluate its line and start it on its own — no autoplay
# needed. The SOURCE picker (auto · a chip per #@ part) chooses which part's version a
# launch pulls from, so you can fire  bass  DRY from 'intro', then relaunch it WET from
# 'var' (its mverb + chop) while  bass2  climbs an octave — a whole set built by hand.
#
# ▶ Run .solo() here and watch the S light up in BOTH the mixer and the Players panel:
bass.solo(8)`, 'ja'),

    lesson(37, 'Parameter envelopes — lpf_ and the _ sweeps',
`# Add "_" to an FX parameter and it becomes an ENVELOPE — a shape that MOVES that
# param within each note. The classic is a filter sweep: lpf_ glides the low-pass
# cutoff every time a note fires.
#
# Three shapes, each written f(dur, a, b) — dur in BEATS, a & b the two endpoints:
#   fi(dur, a, b)   fade IN   —  a → b, then holds at b
#   fo(dur, a, b)   fade OUT  —  b → a, then holds at a   (fi's mirror)
#   fb(dur, a, b)   BOUNCE    —  a ↔ b triangle, looping every dur (for the note's sus)
#
# ▶ Each pluck OPENS its filter, 400 → 4000 Hz over one beat:
p1 >> pluck([0, 2, 4, 7], dur=1, lpf_=fi(1, 400, 4000))
#
# ▶ The mirror — each note CLOSES, 4000 → 400 (that quacky "pluck" shape):
p1 >> pluck([0, 2, 4, 7], dur=1, lpf_=fo(1, 400, 4000))
#
# ▶ Bounce = a wobble. Hold ONE long note and the cutoff see-saws every half beat:
b1 >> bass([0], dur=8, sus=8, lpf_=fb(1/2, 300, 4000))
#
# The envelope plays over the note's SUS, so give it room — a short note only shows the
# START of a slow sweep. Longer sus = the whole shape unfolds:
p1 >> pads([0, 4, 7], dur=4, sus=4, lpf_=fi(4, 300, 6000))
#
# RESONANCE makes a sweep SING. lpr is the low-pass resonance (LOWER = sharper peak;
# 0.7 default, ~0.15 = squelchy). Note lpr is a SEPARATE param from lpf_ :
b1 >> bass([0, 0, 3, 5], oct=4, dur=1/2, lpf_=fi(1/2, 200, 3500), lpr=0.15)`, 'ja'),

    lesson(38, 'Envelopes everywhere — any FX param + clock-sync',
`# It's not only the filter — EVERY effect param takes a "_" envelope: crush_, reverb_,
# chorus_, echo_, hpf_, djf_ … the same fi / fo / fb shapes sweep that effect per note.
#
# ▶ bit-depth cleaning up — starts gritty (4 levels) and smooths to 16:
p1 >> pluck([0, 2, 4, 7], dur=1, crush=0.6, bits_=fi(1, 4, 16))
#
# ▶ reverb SWELLING in over two beats (dry → drenched):
p1 >> pads([0, 4], dur=4, sus=4, reverb_=fi(2, 0, 0.9), room=0.9)
#
# ▶ a high-pass sweeping up = a riser / filter-out:
d1 >> play("x-o-", dur=1/2, hpf_=fi(4, 100, 4000))
#
# TWO MODES — the "_" is the switch:
#   lpf_=fb(1, 400, 4000)   PER-NOTE: the shape RESTARTS on every note (timed from when
#                           that note fired) — each note gets its own fresh sweep.
#   lpf =fb(8, 400, 4000)   NO "_": ONE clock-synced value shared by everything — a
#                           global LFO on the timeline, so every player moves together.
# ▶ Run both — same wobble, per-note vs global:
p1 >> pluck([0, 2, 4, 7], dur=1/2, lpf_=fb(1, 400, 4000))
b1 >> bass([0], dur=8, sus=8, lpf=fb(8, 400, 4000))
#
# GOTCHAS: "_" envelopes work only on EFFECT params (filters, reverb, crush, echo,
# chorus, djf …) — NOT the note params amp / oct / dur / pan. To move those, use a
# var() (lesson 9). And don't confuse  lpf_  (the envelope) with  lpr  (resonance).`, 'ja'),

    lesson(39, 'Glissando — .slider()',
`# .slider() makes a player GLIDE in pitch between notes — a portamento sweep.
# Chain it onto any melodic synth (basses, saws, leads, keys, plucks).
#
# ▶ The default alternates a steady note and a swept one:
b1 >> bass([0, 3, 5, 7], dur=1/2).slider()
#
# ▶ .slider(1) flips the phase — the OTHER notes sweep:
b1 >> bass([0, 3, 5, 7], dur=1/2).slider(1)
#
# PER-NOTE control — pass a PATTERN of 0/1: 1 = glide THIS note · 0 = steady.
# ▶ every 3rd note glides:
p1 >> pluck([0, 2, 4, 7], dur=1/2).slider([0, 0, 1])
#
# ▶ a var lets the glide breathe over time (mostly steady, then bursts of glide):
d1 >> dbass([0, 3, 5], dur=1/2).slider(var([0, 1], [6, 2]))
#
# Turn it off with .slider(0, 0). On synths with no pitch-glide (drums/samples)
# it's a harmless no-op — safe to chain anywhere. Killer on acid basslines & leads.`, 'ja'),

    lesson(40, '準備完了 ✨',
`# これがすべてのループ：   書く  →  実行（Ctrl+Enter）  →  変える  →  また実行。
#
# 次はどこへ：
#   • examples（上）  完成した曲とテクニック — クリックで読み込む
#   • docs ボタン     ドキュメント：各シンセ・エフェクト・パターン・ショートカット
#   • galaxy          他の人とライブで探索し、ジャムする
#
# では、このバッファを空にして（Ctrl+A、Delete）、自分だけの何かを作ろう。
# ようこそ！`, 'ja'),
];

// The lesson set for the current language, falling back to English per lesson.
function lessons() {
    const set = { fr: FR, de: DE, es: ES, ja: JA }[getLang()];
    if (!set) return EN;
    return EN.map((en, i) => set[i] || en);
}

let editor = null, idx = 0, active = false;

export function initTour(_editor) {
    editor = _editor;
    // Recover the tour across a page reload. The editor autosaves its buffer, so if
    // it's still showing a tour lesson, re-activate at THAT lesson's number (read from
    // the header) — otherwise next()/back() would be inert after a refresh (active was
    // reset to false). Tying "active" to the actual buffer (not a stored flag) means a
    // user who cleared the lesson and wrote their own code is correctly NOT in the tour,
    // so a later language() switch can't overwrite their work.
    try {
        const buf = editor.getValue ? editor.getValue() : '';
        const m = buf.match(/🎓[^\n]*·\s*(\d+)\s*\/\s*\d+\s*·/);
        if (m) { const n = parseInt(m[1], 10); if (n >= 1 && n <= TOTAL) { active = true; idx = n - 1; } }
    } catch (_) {}
    // refresh() re-renders the current lesson (used after language() switches).
    return { start, next, back, list, go, refresh: () => { if (active) show(); }, isActive: () => active, notify() {} };
}

// [{ n, title }] for every lesson — for tour() to print a menu.
function list() { return lessons().map(l => ({ n: l.n, title: l.title })); }
// Jump straight to lesson n (1-based), starting the tour there if needed.
function go(n) {
    const set = lessons();
    const i = Math.round(Number(n)) - 1;
    if (i >= 0 && i < set.length) { active = true; idx = i; show(); }
    return '';
}

// ▶-prefixed lines (any language's arrow bullet) introduce a runnable example —
// mark that line and the code line(s) right after it (until blank/next comment)
// so they visually pop out of the surrounding prose instead of reading as more text.
const EXAMPLE_RE = /^#\s*▶/;

function decorate(text) {
    // setValue() throws away the previous doc, so old line-classes are already
    // gone — nothing to clear before applying this lesson's.
    const lines = text.split('\n');
    // Header — lines 0/1/2 are always the ═══ rule / 🎓 title / ═══ rule built by
    // lesson() above. Banner the title, dim the rules so they read as its edges.
    // 'wrap' (not 'background') on the title so the class can style the text too
    // (bold/color), not just a backdrop — CodeMirror's background layer has no text.
    editor.addLineClass(0, 'background', 'tour-header-rule');
    editor.addLineClass(1, 'wrap',       'tour-header-title');
    editor.addLineClass(2, 'background', 'tour-header-rule');
    for (let i = 3; i < lines.length; i++) {
        if (!EXAMPLE_RE.test(lines[i])) continue;
        // The footer nav line ("▶ evaluate next() …") uses the same ▶ bullet but
        // introduces no code — it's always followed by a #─── divider, never a
        // runnable line. Only decorate real examples: collect first, apply only
        // if at least one code line actually follows.
        const codeLines = [];
        for (let j = i + 1; j < lines.length; j++) {
            const t = lines[j].trim();
            if (!t || t.startsWith('#')) break;
            codeLines.push(j);
        }
        if (!codeLines.length) continue;
        editor.addLineClass(i, 'wrap', 'tour-example-label');
        for (const j of codeLines) editor.addLineClass(j, 'background', 'tour-example-code');
    }
}

function show() {
    const text = lessons()[idx].text;
    editor.setValue(text);
    decorate(text);
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
function next() { if (!active) return ''; if (idx < lessons().length - 1) { idx++; show(); } return ''; }
function back() { if (!active) return ''; if (idx > 0) { idx--; show(); } return ''; }
