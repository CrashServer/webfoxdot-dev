# ─────────────────────────────────────────────────────────────────────────────
#  MIDI + LIVE SAMPLING — the whole toolbox, one block at a time
#
#  Gear this is written for:
#    · Korg nanoKONTROL2  — faders, knobs and buttons (CC in)
#    · Medeli SP5600      — keys in (notes), sounds out (notes, CC, program, NRPN),
#                           and its AUDIO back in through your interface
#    · an audio interface — line in / mic, for audioin()
#
#  Open with Ctrl+O. Put the cursor in a block and Ctrl+Enter each line
#  (Ctrl+Alt+Enter runs a selection). Boot the audio first.
#  MIDI needs Chromium / Edge / Brave; the first midi() asks for permission.
# ─────────────────────────────────────────────────────────────────────────────

Clock.bpm = 110


# ── 0 · Where the controls are ──────────────────────────────────────────────
#  nanoKONTROL2, factory CC mode (change it in the Korg editor if yours differs):
#    faders 1-8   CC 0..7          knobs 1-8   CC 16..23
#    S buttons    CC 32..39        M buttons   CC 48..55      R buttons  CC 64..71
#    transport    play 41 · stop 42 · rew 43 · ff 44 · rec 45 · cycle 46
#                 track◀ 58 · track▶ 59 · set 60 · marker◀ 61 · marker▶ 62
#  Buttons send 127 while held and 0 on release ("momentary"). Set them to
#  "toggle" in the Korg editor and they latch: press on, press off.
#
#  The 5th argument of midi() is a DEVICE fragment. Both boxes send low CC
#  numbers (the SP5600's own volume is CC7, the nano's 8th fader is CC7 too),
#  so name the box whenever it matters: "nano" matches "nanoKONTROL2 ...".
#  midimap() lists every binding and the box it listens to.


# ── 1 · The nanoKONTROL2 as a mixer ─────────────────────────────────────────
d1 >> play("x-o-[--]x-o-", sample=2)
p1 >> dbass([0, 0, 3, 5], dur=1/2, oct=4)
p2 >> pads([(0, 2, 4), (3, 5, 7)], dur=8)

# faders → levels (fader 1 = drums, 2 = bass, 3 = pads)
d1.amp = midi(0, 0, 1.2, "lin", "nano")
p1.amp = midi(1, 0, 1.2, "lin", "nano")
p2.amp = midi(2, 0, 1, "lin", "nano")

# knobs → tone. "exp" for anything measured in Hz: half the knob is half the octaves
p1.lpf = midi(16, 120, 6000, "exp", "nano")
p2.hpf = midi(17, 20, 2000, "exp", "nano")
p2.mverb = midi(18, 0, 0.9, "lin", "nano")

# M buttons as mutes: 1 at rest, 0 while held (or while latched, in toggle mode)
d1.amplify = midi(48, 1, 0, "lin", "nano")
p1.amplify = midi(49, 1, 0, "lin", "nano")

# the same thing, inline — the param reads the knob on every step
#  (one line per player — a call cannot continue onto the next line)
p3 >> pluck([0, 4, 7, 9], dur=1/4, oct=6, pan=midi(19, -1, 1, "lin", "nano"), echo=midi(20, 0, 0.6, "lin", "nano"), amp=0.6)

# curves: lin · exp · log · quad · cubic · sqrt · s  (the MIDI panel draws them)
p3.drive = midi(21, 0, 1, "cubic", "nano")


# ── 2 · MIDI learn — no CC numbers needed ───────────────────────────────────
#  Run the line, then move the control you want. It latches onto the one that
#  MOVES and remembers which box it was on.
p1.cutoff = mlearn(200, 4000, "exp")

#  Several on one line learn one control each, in order:
p2 >> pads([(0, 2, 4)], dur=8, lpf=mlearn(300, 8000, "exp"), room=mlearn(0, 1))

#  One control, several params — learn it twice to make a macro:
p1.dist = mlearn(0, 0.8)
p3.crush = mlearn(0, 8)

midimap()


# ── 3 · The SP5600 as a keyboard (notes IN) ─────────────────────────────────
#  Play its keys through any crashDot synth. Velocity scales amp.
midiin("pluck")
midiin("supersaw", amp=0.6, sus=1.5, transpose=-12)
midiin("rhodes", sus=2)
midiin(0)                    # off

#  The PIANO panel does more: play it from the SP5600 and it writes what you
#  played as a line of code — degrees, rhythm (dur), articulation (sus) and
#  velocity (amp) kept apart.

#  Its knobs and wheels are CCs too — give them the device name:
p2.lpf = midi(74, 300, 9000, "exp", "sp5600")      # match the name the MIDI panel shows


# ── 4 · The SP5600 as a sound module (notes, CC, program, NRPN OUT) ─────────
#  Pick the SP5600 as the OUTPUT in the MIDI panel. Its map, read off the
#  keyboard itself: bank 121/100 + program, CC74 brightness, CC91 reverb,
#  CC93 chorus, NRPN 50/12.
m1 >> midiout([0, 2, 4, 7], channel=1, oct=5, dur=1/2, sus=0.4)

#  chords are groups; velocity comes from amp, note length from sus
m1 >> midiout([(0, 2, 4), (3, 5, 7), (4, 6, 8)], channel=1, oct=4, dur=2, amp=[0.9, 0.6, 0.75])

#  pick the sound ON THE LINE — bank first, then program, sent when it changes
m1 >> midiout([0, 2, 4, 7], channel=1, oct=5, dur=1/2, prog=0, bank=121, banklsb=100)

#  CCs on the line are resolved per step like any param — and only sent when
#  the value CHANGES, so a sweep never floods the 31250-baud wire
#  cc74 breathes on its own · nano knob 7 → SP reverb · nano knob 8 → SP chorus
m1 >> midiout([0, 2, 4, 7], channel=1, oct=5, dur=1/4, cc74=sinvar([30, 120], [16]), cc91=midi(22, 0, 127, "lin", "nano"), cc93=midi(23, 0, 127, "lin", "nano"))

#  one-shots, for setting up the instrument between phrases
midiprog(5, 121, 100)        # program 5, bank 121/100
midicc(91, 90)               # reverb send
midicc(93, 40)               # chorus
midinrpn(50, 12, 64)         # the NRPN the SP5600 announces at power-on

#  the player methods work on MIDI out too
m1 >> midiout([0, 2, 4, 7, 9], channel=1, oct=5, dur=1/4).every(8, "stutter", 4)
m1 >> midiout([0, 2, 4, 7, 9], channel=1, oct=5, dur=1/4).sometimes("shuffle")
m1 >> midiout(PRand(0, 7)[:16], channel=1, oct=5, dur=1/4, amp=PWhite(0.4, 1))
m1.stop()


# ── 5 · Record the MIDI you play ────────────────────────────────────────────
midi_rec()                   # arm — every note that plays is captured, as heard
midi_map("x", 36)            # put play()'s "x" on the GM kick for the export
midi_save("sp-jam", 1/16)    # stop + download a .mid, onsets snapped to 16ths


# ── 6 · Live sampling — the mix ─────────────────────────────────────────────
#  sample(name, beats) records the next N beats of what you hear, starting on
#  the next bar. loop(name) plays it back stretched to the tempo.
sample("grab", 4)
s1 >> loop("grab", dur=4)

#  sample the same name again while it loops: the loop keeps playing the old
#  take and GETS RECORDED into the new one — that is how you layer
sample("grab", 4)

#  one player on its own, with its FX, then let the loop take over
sample("bassline", 8, src=p1)
p1.stop()
s2 >> loop("bassline", dur=8)

#  quant=0: start now instead of waiting for the bar (off the grid, on purpose)
sample("smear", 2, quant=0)


# ── 7 · Live sampling — the audio input (the SP5600's own sound) ────────────
#  SP5600 audio out → interface in. Voice-call processing is off (it ruins music).
audioin()                    # open the default input and list the others
audioin("scarlett")          # or pick one by part of its name, or by index: audioin(1)
audioin(monitor=0.6)         # HEAR it through the mix — headphones if a mic is open
audioin(monitor=0)           # silent again (stop-all and panic silence it too)

#  the round trip: crashDot plays the SP5600, the SP5600 comes back as audio,
#  crashDot records it on the bar and loops it
m1 >> midiout([0, 4, 7, 11], channel=1, oct=5, dur=1/2, prog=0, bank=121, banklsb=100)
sample("keys", 8, src="in")
m1.stop()
s3 >> loop("keys", dur=8, hpf=200, mverb=0.2)

#  an input take starts later by the measured round-trip latency; if the loop
#  still sounds early or late on your setup, say it yourself (seconds):
sample("keys", 8, src="in", latency=0.012)

#  one-shots from the input become play() characters — any single character
sample("V", 1, src="in")
d2 >> play("V.. V. V[VV]", amp=0.8)


# ── 8 · Playing with takes ──────────────────────────────────────────────────
#  natural speed instead of stretched: an octave down, half as fast
s1 >> loop("grab", dur=8, stretch=0, rate=0.5)

#  CHOP: short steps, each starting somewhere else in the take (pos = seconds)
s1 >> loop("grab", dur=1/4, stretch=0, pos=[0, 0.5, 0.25, 1.5, 0.75, 1, 0.25, 1.75])
s1 >> loop("grab", dur=1/4, stretch=0, pos=PWhite(0, 2)).sometimes("stutter", 2)

#  the nanoKONTROL drives the take: fader 4 = level, knob → filter, rec button → crush
s1.amp  = midi(3, 0, 1.2, "lin", "nano")
s1.lpf  = midi(16, 150, 9000, "exp", "nano")
s1.crush = midi(64, 0, 6, "lin", "nano")
s3.rate = midi(4, 0.5, 2, "exp", "nano")          # varispeed the SP take (stretch=0 to hear it)

#  effects that lock to the tempo make loops move
s3 >> loop("keys", dur=8, chop=4, fbdelay=0.4, fbtime=3/4, fbfeed=0.5)
s1 >> loop("grab", dur=4, rgate=1, rgaterate=8, pumper=0.6)

#  the sound drives the sound: duck the pads under the kick
p2.amp = aud("bass", 1, 0.25)

#  resample the resample: a take of the looped keys, then of that
sample("keys2", 8, src=s3)
s4 >> loop("keys2", dur=16, stretch=0, rate=0.5, mverb=0.6)


# ── 9 · Put the whole desk back ─────────────────────────────────────────────
s1.stop(8)                   # stop at the next 8-beat boundary
p1.stop(); p2.stop(); p3.stop(); d1.stop(); d2.stop()
s1.stop(); s2.stop(); s3.stop(); s4.stop(); m1.stop()
audioin(False)
midiin(0)
