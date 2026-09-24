# ─────────────────────────────────────────────────────────────────────────────
#  MIDI + LIVE SAMPLING + LIGHTS — the whole toolbox, one block at a time
#
#  Gear this is written for:
#    · Korg nanoKONTROL2  — faders, knobs, buttons (CC in) and the button LIGHTS
#                           (CC out) — played as a mixing desk, one column a track
#    · Medeli SP5600      — keys in (notes), sounds out (notes, CC, program, NRPN),
#                           and its AUDIO back in through your interface
#    · an audio interface — line in / mic, for audioin()
#
#  Open with Ctrl+O. Put the cursor on a line and Ctrl+Enter (Ctrl+Alt+Enter runs
#  a selection). Boot the audio first. MIDI needs Chromium / Edge / Brave; the
#  first midi() asks for permission.
# ─────────────────────────────────────────────────────────────────────────────

Clock.bpm = 110


# ── 0 · The desk ────────────────────────────────────────────────────────────
#  nanoKONTROL2, factory CC mode:
#    faders 1-8   CC 0..7          knobs 1-8   CC 16..23
#    S buttons    CC 32..39        M buttons   CC 48..55      R buttons  CC 64..71
#    transport    play 41 · stop 42 · rew 43 · ff 44 · rec 45 · cycle 46
#                 track◀ 58 · track▶ 59 · set 60 · marker◀ 61 · marker▶ 62
#  Buttons send 127 while held, 0 on release ("momentary"); set to "toggle" (in
#  the Korg editor) they latch instead. Everything below works both ways —
#  momentary means hold-to-mute / hold-to-solo, toggle means press on, press off.
#
#  LIGHTS: the same CC numbers, sent TO the nano, light the buttons (127 on,
#  0 off). Every button has one except track◀▶ and the marker buttons.
#  port="nano" sends to the nano by name whatever the MIDI panel has selected,
#  so the SP5600 stays the panel's output and keeps playing.
midicc(45, 127, port="nano")     # rec lit?
midicc(45, 0, port="nano")

#  The 5th argument of midi() is a DEVICE fragment. Both boxes send low CC
#  numbers (the SP5600's own volume is CC7, the nano's 8th fader is CC7 too),
#  so name the box whenever it matters. midimap() lists every binding.
#
#  The columns, used all the way down:
#    1 d1 drums · 2 p1 bass · 3 p2 pads · 4 p3 pluck · 5 m1 the SP5600
#    6-8 s1..s3, the sampled loops (section 7 onwards)


# ── 1 · A mixing desk, with lights ──────────────────────────────────────────
d1 >> play("x-o-x-o-", dur=1/2, sample=2)
p1 >> dbass([0, 0, 3, 5], dur=1/2, oct=4)
p2 >> pads([(0, 2, 4), (3, 5, 7)], dur=8)
p3 >> pluck([0, 4, 7, 9], dur=1/4, oct=6, amp=0.6)

#  faders → levels, knobs → tone ("exp" for Hz: half the knob, half the octaves)
d1.amp = midi(0, 0, 1.2, "lin", "nano")
p1.amp = midi(1, 0, 1.2, "lin", "nano")
p2.amp = midi(2, 0, 1, "lin", "nano")
p3.amp = midi(3, 0, 1, "lin", "nano")
p1.lpf = midi(17, 120, 6000, "exp", "nano")
p2.hpf = midi(18, 20, 2000, "exp", "nano")
p3.echo = midi(19, 0, 0.6, "lin", "nano")

#  M = mute, S = solo. A track plays when its own M is up AND no OTHER column's
#  S is down — so holding S1 silences 2, 3 and 4. init=1: a button starts
#  "up" (an untouched midi() sits mid-range, which for a mute is half volume).
d1.amplify = midi(48, 1, 0, "lin", "nano", init=1) * midi(33, 1, 0, "lin", "nano", init=1) * midi(34, 1, 0, "lin", "nano", init=1) * midi(35, 1, 0, "lin", "nano", init=1)
p1.amplify = midi(49, 1, 0, "lin", "nano", init=1) * midi(32, 1, 0, "lin", "nano", init=1) * midi(34, 1, 0, "lin", "nano", init=1) * midi(35, 1, 0, "lin", "nano", init=1)
p2.amplify = midi(50, 1, 0, "lin", "nano", init=1) * midi(32, 1, 0, "lin", "nano", init=1) * midi(33, 1, 0, "lin", "nano", init=1) * midi(35, 1, 0, "lin", "nano", init=1)
p3.amplify = midi(51, 1, 0, "lin", "nano", init=1) * midi(32, 1, 0, "lin", "nano", init=1) * midi(33, 1, 0, "lin", "nano", init=1) * midi(34, 1, 0, "lin", "nano", init=1)

#  S and M lights show their own buttons: lit = soloing / muted
n1 >> midiout(_, dur=1/8, port="nano", cc32=midi(32, 0, 127, "lin", "nano", init=0), cc33=midi(33, 0, 127, "lin", "nano", init=0), cc34=midi(34, 0, 127, "lin", "nano", init=0), cc35=midi(35, 0, 127, "lin", "nano", init=0), cc48=midi(48, 0, 127, "lin", "nano", init=0), cc49=midi(49, 0, 127, "lin", "nano", init=0), cc50=midi(50, 0, 127, "lin", "nano", init=0), cc51=midi(51, 0, 127, "lin", "nano", init=0))

#  R lights play each track's RHYTHM, times whether you can hear it — so a muted
#  or soloed-away column goes dark. A light line with the same dur as its track
#  is locked to it: a player's step is its beat ÷ dur, whenever it was started.
n2 >> midiout(_, dur=1/2, port="nano", cc64=[127, 0, 0, 0, 127, 0, 0, 0] * d1.amplify)
n3 >> midiout(_, dur=1/4, port="nano", cc65=[127, 0] * p1.amplify)
n4 >> midiout(_, dur=4, port="nano", cc66=[127, 0] * p2.amplify)
n5 >> midiout(_, dur=1/8, port="nano", cc67=[127, 0] * p3.amplify)

#  the transport row is a clock: play = the bar's downbeat, rew/ff swing
#  beat to beat, cycle = the first bar of every 4-bar phrase (a cue to change)
n6 >> midiout(_, dur=1, port="nano", cc41=[127, 0, 0, 0], cc43=[127, 0], cc44=[0, 127], cc46=[127, 127, 127, 127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])


# ── 2 · MIDI learn — no CC numbers needed ───────────────────────────────────
#  Run the line, then move the control you want. It latches onto the one that
#  MOVES and remembers which box it was on.
p1.cutoff = mlearn(200, 4000, "exp")

#  Several on one line learn one control each, in order:
p2 >> pads([(0, 2, 4)], dur=8, lpf=mlearn(300, 8000, "exp"), room=mlearn(0, 1))

#  One control, several params — learn it twice to make a macro:
p1.dist = mlearn(0, 0.8)
p3.crush = mlearn(0, 8)

#  a learned control can drive a light as well as a sound: learn a fader, and
#  rec lights once it passes halfway (the steep range makes it a clean switch —
#  see section 5)
n7 >> midiout(_, dur=1/8, port="nano", cc45=mlearn(-8128, 8128))

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
#  Pick the SP5600 as the OUTPUT in the MIDI panel (or add port="sp5600" to each
#  line). Its map, read off the keyboard itself: bank 121/100 + program,
#  CC74 brightness, CC91 reverb, CC93 chorus, NRPN 50/12.
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

#  THE NANO SHOWS THE MELODY: a random line on the SP5600, and the S row lights
#  the scale degree it is playing, 0..7 left to right. .map reads m1's degree at
#  the same step m1 plays it — PRand gives the same value to both.
#  (stop n1 first: it drives the S row too)
n1.stop()
m1 >> midiout(PRand(0, 8), channel=1, oct=5, dur=1/4, amp=PWhite(0.5, 1))
n8 >> midiout(_, dur=1/4, port="nano")
n8.map("m1", {0: 127, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0}, "cc32")
n8.map("m1", {0: 0, 1: 127, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0}, "cc33")
n8.map("m1", {0: 0, 1: 0, 2: 127, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0}, "cc34")
n8.map("m1", {0: 0, 1: 0, 2: 0, 3: 127, 4: 0, 5: 0, 6: 0, 7: 0}, "cc35")
n8.map("m1", {0: 0, 1: 0, 2: 0, 3: 0, 4: 127, 5: 0, 6: 0, 7: 0}, "cc36")
n8.map("m1", {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 127, 6: 0, 7: 0}, "cc37")
n8.map("m1", {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 127, 7: 0}, "cc38")
n8.map("m1", {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 127}, "cc39")
m1.stop(); n8.stop()


# ── 5 · More lights ─────────────────────────────────────────────────────────
#  These reuse the rows above — stop section 1's light lines first:
n1.stop(); n2.stop(); n3.stop(); n4.stop(); n5.stop(); n6.stop()

#  THE SWITCH TRICK. A light only needs 0 or 127, but aud() and midi() give a
#  smooth range. Map it through a range so steep that it jumps from 0 to 127
#  across a sliver, and the light becomes a clean switch at a threshold t:
#      aud(band, -2540 * t, 2540 * (1 - t))    on once the band passes t
#  (below 0 is sent as 0, above 127 as 127). It also means it does not matter
#  whether the nano lights at 1 or only from 64.

#  a LEVEL METER on the S row — the mix, from quiet (left) to loud (right)
n1 >> midiout(_, dur=1/8, port="nano", cc32=aud("level", -127, 2413), cc33=aud("level", -254, 2286), cc34=aud("level", -381, 2159), cc35=aud("level", -508, 2032), cc36=aud("level", -762, 1778), cc37=aud("level", -1016, 1524), cc38=aud("level", -1270, 1270), cc39=aud("level", -1524, 1016))

#  a KICK DETECTOR on play, a HAT DETECTOR on stop — the sound itself, no pattern
n2 >> midiout(_, dur=1/16, port="nano", cc41=aud("bass", -1270, 1270), cc42=aud("treble", -762, 1778))

#  a KNOB AS A BAR GRAPH on the R row: knob 1's position, eighth by eighth
#  (same trick on midi(): for the k-th light, -1016 * k up to 8128 - 1016 * k)
n3 >> midiout(_, dur=1/8, port="nano", cc64=midi(16, 0, 8128, "lin", "nano"), cc65=midi(16, -1016, 7112, "lin", "nano"), cc66=midi(16, -2032, 6096, "lin", "nano"), cc67=midi(16, -3048, 5080, "lin", "nano"), cc68=midi(16, -4064, 4064, "lin", "nano"), cc69=midi(16, -5080, 3048, "lin", "nano"), cc70=midi(16, -6096, 2032, "lin", "nano"), cc71=midi(16, -7112, 1016, "lin", "nano"))

#  an 8-BAR COUNTDOWN on the M row: one more light each bar, then a fresh start
#  — run it 8 bars before the drop
n4 >> midiout(_, dur=4, port="nano", cc48=[127, 127, 127, 127, 127, 127, 127, 127], cc49=[0, 127, 127, 127, 127, 127, 127, 127], cc50=[0, 0, 127, 127, 127, 127, 127, 127], cc51=[0, 0, 0, 127, 127, 127, 127, 127], cc52=[0, 0, 0, 0, 127, 127, 127, 127], cc53=[0, 0, 0, 0, 0, 127, 127, 127], cc54=[0, 0, 0, 0, 0, 0, 127, 127], cc55=[0, 0, 0, 0, 0, 0, 0, 127])

#  a CHASER along the S row, and SPARKLE on the R row
n5 >> midiout(_, dur=1/4, port="nano", cc32=[127,0,0,0,0,0,0,0], cc33=[0,127,0,0,0,0,0,0], cc34=[0,0,127,0,0,0,0,0], cc35=[0,0,0,127,0,0,0,0], cc36=[0,0,0,0,127,0,0,0], cc37=[0,0,0,0,0,127,0,0], cc38=[0,0,0,0,0,0,127,0], cc39=[0,0,0,0,0,0,0,127])
n6 >> midiout(_, dur=1/4, port="nano", cc64=PRand([0, 127]), cc65=PRand([0, 127]), cc66=PRand([0, 127]), cc67=PRand([0, 127]), cc68=PRand([0, 127]), cc69=PRand([0, 127]), cc70=PRand([0, 127]), cc71=PRand([0, 127]))

#  a light that MEANS something: rec is lit while a take records
sample("grab", 4); midicc(45, 127, port="nano"); Clock.future(8, () => midicc(45, 0, port="nano"))

#  LIGHTS OFF: stop every light line, then one step of zeros to clear what they
#  left lit — n0 has not played yet on the next line, so it stops at the next
#  even beat, after its first step
n1.stop(); n2.stop(); n3.stop(); n4.stop(); n5.stop(); n6.stop(); n7.stop(); n8.stop()
n0 >> midiout(_, dur=1, port="nano", cc32=0, cc33=0, cc34=0, cc35=0, cc36=0, cc37=0, cc38=0, cc39=0, cc48=0, cc49=0, cc50=0, cc51=0, cc52=0, cc53=0, cc54=0, cc55=0, cc64=0, cc65=0, cc66=0, cc67=0, cc68=0, cc69=0, cc70=0, cc71=0, cc41=0, cc42=0, cc43=0, cc44=0, cc45=0, cc46=0)
n0.stop(2)


# ── 6 · Record the MIDI you play ────────────────────────────────────────────
midi_rec()                   # arm — every note that plays is captured, as heard
midi_map("x", 36)            # put play()'s "x" on the GM kick for the export
midi_save("sp-jam", 1/16)    # stop + download a .mid, onsets snapped to 16ths


# ── 7 · Live sampling — the mix ─────────────────────────────────────────────
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


# ── 8 · Live sampling — the audio input (the SP5600's own sound) ────────────
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


# ── 9 · Playing with takes ──────────────────────────────────────────────────
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


# ── 10 · Put the whole desk back ─────────────────────────────────────────────
s1.stop(8)                   # stop at the next 8-beat boundary
p1.stop(); p2.stop(); p3.stop(); d1.stop(); d2.stop()
s1.stop(); s2.stop(); s3.stop(); s4.stop(); m1.stop()
n1.stop(); n2.stop(); n3.stop(); n4.stop(); n5.stop(); n6.stop(); n7.stop(); n8.stop()
audioin(False)
midiin(0)
