# Third-party components & licensing

crashDot is licensed under the **GNU General Public License v3.0 or later**
(see [`LICENSE`](LICENSE)). It is licensed under the GPL because it bundles and
distributes **scsynth** (the SuperCollider audio server), which is GPL-3.0-or-later.

The project bundles the following third-party software, each used under its own
license:

## scsynth / SuperCollider — GPL-3.0-or-later
`lib/dist/wasm/scsynth-nrt.wasm` and the `lib/dist/` runtime are the SuperCollider
audio server compiled to WebAssembly via **SuperSonic**.

- SuperCollider — <https://github.com/supercollider/supercollider> (GPL-3.0-or-later)
- SuperSonic (the SuperCollider → WebAssembly build) — <https://github.com/samaaron/supersonic>

**Corresponding source** for the compiled `scsynth-nrt.wasm` is the SuperCollider
and SuperSonic repositories above. As required by the GPL, that source is publicly
available there, and crashDot as a whole is distributed under GPL-3.0-or-later.

scsynth runs as a self-contained audio server; crashDot drives it with **OSC**
messages (SuperCollider's standard control protocol), the same arm's-length interface
FoxDot, Sonic Pi and TidalCycles use.

## CodeMirror 5 — MIT
`lib/codemirror/` — <https://github.com/codemirror/codemirror5>

## Yjs — MIT
`lib/yjs/` — <https://github.com/yjs/yjs>

## Sonic Pi synthdefs — MIT
`lib/synthdefs/sonic-pi-*.scsyndef` — from Sonic Pi, <https://github.com/sonic-pi-net/sonic-pi>

## FoxDot — CC-BY-SA-4.0
crashDot reimplements FoxDot-style syntax and player semantics in the browser.
FoxDot by Ryan Kirkbride — <https://github.com/Qirky/FoxDot>. CC-BY-SA-4.0 material
is one-way compatible with GPLv3 (per Creative Commons' compatibility declaration),
so crashDot's GPL-3.0 licensing is compatible with it.

## Samples
Audio samples are **not** bundled in this repository; they load separately from the
sample kit and carry their own licenses (many are CC0 / public-domain from
freesound.org). See the kit repository for details.

---
crashDot — Copyright (C) 2026 CrashServer and contributors.
This program is free software under the GNU GPL v3.0 or later; see [`LICENSE`](LICENSE).
It comes with ABSOLUTELY NO WARRANTY.
