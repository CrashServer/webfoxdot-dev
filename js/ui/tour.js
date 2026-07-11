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
// The lessons are DATA (English EN[] + French FR[]); the engine is shared. Language
// follows the app's lang setting, per-lesson falling back to English. To translate a
// language, edit its content array — no code changes. (See translate.md.)

import { getLang } from '../i18n/lang.js';

const TOTAL = 34;
const DIV = '# ───────────────────────────────────────────────────────────────────────────';

// Localised chrome (header word + footer navigation).
const LABEL = {
    en: { tour: 'TOUR',
          next: `#  ▶ evaluate   next()   for the next lesson        ·        back()   to go back`,
          done: `#  you've finished the tour! 🎉   evaluate   back()   to revisit any lesson.` },
    fr: { tour: 'VISITE',
          next: `#  ▶ évaluez   next()   pour la leçon suivante        ·        back()   pour revenir`,
          done: `#  visite terminée ! 🎉   évaluez   back()   pour revoir une leçon.` },
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
# 🇫🇷  En français ?  évalue   language("fr")   pour faire la visite en français.
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

// ── FRANÇAIS ─────────────────────────────────────────────────────────────────
// Traduction des leçons. Le CODE des exemples reste en anglais (c'est le langage de
// l'outil) ; seuls les commentaires # sont traduits. Pour corriger une traduction,
// édite ce tableau — aucune modification de code. (Voir translate.md.)
const FR = [
    lesson(1, 'Bienvenue — comment fonctionne cette visite',
`# Le live coding = tu écris du code, tu l'ÉVALUES, et tu entends le son
# instantanément — puis tu le changes PENDANT qu'il joue. Toute la visite se
# passe ici, dans l'éditeur.
#
# 🇬🇧  In English?  evaluate   language("en")   to take the tour in English.
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
p1 >> pluck([0, 2, 4, 7], dur=1/2, amp=0.5, oct=5, pan=<-0.5 0.5>)
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
#   X / O plus fort ·  [xx] = deux frappes en un pas (un roulement) ·  <a b> alterne
#
# ▶ Un beat de base (nécessite le kit de la leçon 5) :
d1 >> play("x-o-")
#
# ▶ Plus dense — lance-le pour changer le pattern en direct :
d1 >> play("x.x.o.[xx]")`, 'fr'),

    lesson(7, 'Les patterns — listes, accords, alternance',
`# La liste dans [ … ] est un PATTERN : une valeur par pas, en boucle. C'est ainsi
# que TOUT tourne. Trois briques de base :
#
#   [0, 2, 4]    une séquence — une note par pas
#   (0, 4, 7)    un ACCORD — ces notes sonnent ensemble (un groupe)
#   <7 9>        ALTERNE — 7 un cycle, 9 le suivant, puis ça se répète
#
# ▶ Les trois dans une seule ligne :
p1 >> pluck([0, (0,4,7), 4, <7 9>], dur=1/2)`, 'fr'),

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
# Maintenant Alt+X sur la ligne b1 pour couper la basse. Ctrl+; arrête tout.`, 'fr'),

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
# nombre de mesures. #@#@ regroupe des sections en une piste repliable.
#
# ▶ Un petit set en deux parties — curseur sur  #@a(8)  et Ctrl+Entrée :
#@#@ my_set
#@a(8)
p1 >> pluck([0, 2, 4, 7], dur=1/2)
#@b(8)
p1 >> pluck([7, 4, 2, 0], dur=1/4, echo=0.3)
d1 >> play("x-o-")`, 'fr'),

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
`# Règle la TONALITÉ une fois et tout la suit :
Scale.default = "minor"
Root.default  = "C"
#
#   PChord(0, "7")           un accord de 7e sur la tonique (un groupe de notes)
#   PRoman("i VI III VII")   une progression écrite en chiffres romains
#   PProg("pop")             une progression nommée (I V vi IV)
#
# ▶ Un pad qui dérive à travers une progression mineure :
p1 >> pads(PProg("pop"), oct=4, dur=4, sus=4, reverb=0.6, room=0.9, lpf=1600, amp=0.4)`, 'fr'),

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

    lesson(18, 'Enregistre ton set',
`# Capture ce que tu fais — les boutons sont dans le panneau de droite (Settings) :
#
#   rec code    enregistre tes évaluations en une composition #@ rejouable
#   rec audio   capture la sortie audio dans un fichier (coche « share tab audio »)
#
# Et  Alt+T  arme l'enregistreur d'AUTOMATION : bouge un réglage avec Alt+Haut/Bas sur
# quelques temps et il écrit le mouvement en linvar pour toi.
#
# (Rien à lancer ici — essaie les boutons quand tu veux, puis évalue next().)`, 'fr'),

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
`# Des notes rectilignes sonnent robotiques — ajoute du GROOVE avec un pattern de dur :
#
#   PGroove("swing")   feeling swingué   ·   "shuffle" · "gallop" · "dotted" · "triplet"
#   PDur(3, 8)         durées euclidiennes — 3 frappes réparties sur 8
#
# ▶ Un charleston swingué sur une basse au galop :
h1 >> play("-.-.-.-.", dur=PGroove("swing"), hpf=6000, amp=0.5)
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
`# #@goto(partie, prob) est un AIGUILLEUR de durée nulle : une chance  prob  de sauter
# à une autre section, sinon on continue. Enchaîne-les pour un set qui bifurque
# différemment à chaque fois — un arrangement à la Markov.
#
# ▶ Curseur sur  #@a(8)  et Ctrl+Entrée — il peut boucler A ou passer à B, 50/50 :
#@#@ branching
#@a(8)
p1 >> pluck([0, 2, 4, 7], dur=1/2)
#@goto(a, 0.5)
#@b(8)
p1 >> pluck([7, 4, 2, 0], dur=1/4, echo=0.3)`, 'fr'),

    lesson(25, 'MIDI — piloter du matériel externe',
`# crashDot parle MIDI : pilote des synthés & boîtes à rythmes matériels, ou joue depuis
# un contrôleur. Active-le avec le bouton MIDI (panneau de droite), puis :
#
#   m1 >> midiout([0, 4, 7], channel=0, oct=5, dur=1/2)   envoie des notes en sortie
#   midiin()      joue les synthés intégrés DEPUIS un clavier
#   mlearn()      bouge un réglage pour l'associer à un param (MIDI CC)
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
# ▶ Clique juste après le  (  ci-dessous, Ctrl+Espace, ouvre le groupe  fx , choisis-en un :
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
#   Ctrl+Espace     autocomplétion                  Ctrl+/   commente/décommente
#   Alt+T           enregistre un mouvement de réglage en automation
#   Ctrl+Alt+P      SAUTE à la section ACTIVE — là où le set en cours joue
#   Shift+Alt+Z     mode zen (masque toute l'UI)  ·  F1 / ?  docs
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
# ▶ Une basse avec des silences, et un charleston aux accents à contretemps (kit requis) :
p1 >> pluck([0, _, 0, _, 7, _], oct=3, dur=1/4, amp=0.5)
h1 >> play("-.-.-.-.", amplify=Pacc("offbeat"), hpf=6000)`, 'fr'),

    lesson(32, 'Synchroniser des players',
`# Les players peuvent SE SURVEILLER pour que les parties bougent ensemble :
#
#   p1.degree           référence la note en cours d'un autre player dans un pattern
#   p2.follow("p1")     fait suivre à p2 le degree de p1 à chaque pas
#   p1.reroll(8)        se réévalue toutes les 8 mesures (les aléas figés se relancent)
#
# ▶ Un pad, et une basse qui joue la fondamentale du pad deux octaves plus bas :
p1 >> pads([0, 3, 5, 4], oct=5, dur=2, amp=0.4, reverb=0.5)
b1 >> bass(p1.degree, oct=2, dur=2, amp=0.5)`, 'fr'),

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

    lesson(34, 'Tu es prêt ✨',
`# Voilà toute la boucle :   ÉCRIRE  →  LANCER (Ctrl+Entrée)  →  CHANGER  →  relancer.
#
# Où aller ensuite :
#   • examples ▾ (en haut)  morceaux & techniques complets — clique pour en charger un
#   • le bouton  ?          docs : chaque synthé, effet, pattern & raccourci
#   • 🌌 galaxy             parcours & jamme avec d'autres, en direct
#
# Maintenant vide ce buffer (Ctrl+A, Suppr) et fais quelque chose à toi.
# Bienvenue à bord !`, 'fr'),
];

// The lesson set for the current language, falling back to English per lesson.
function lessons() {
    if (getLang() !== 'fr') return EN;
    return EN.map((en, i) => FR[i] || en);
}

let editor = null, idx = 0, active = false;

export function initTour(_editor) {
    editor = _editor;
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

function show() {
    const text = lessons()[idx].text;
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
