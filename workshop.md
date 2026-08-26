# Workshop setup — running webfoxDot / crashDot on another machine

Everything to get it running and presenting on a **different laptop**, fully **offline**.

**TL;DR**
1. On *this* machine: turn the sample symlinks into real files (one command), then copy the whole `webfoxDot` folder over.
2. On the *workshop* machine: `python3 serve.py` → open **http://127.0.0.1:8765** in **Chrome** → click **boot** → play.
3. Only dependency: **Python 3.8+**. No SuperCollider. No internet.

---

## 0. Before you leave — make the folder self-contained (do this on THIS laptop)

The `samples/` folder is **519 symlinks** into `~/UltimateSamples`, which won't exist on the other machine. Turn them into real files so `samples/` is portable:

```bash
cd ~/webfoxDot
find samples -type l -name '*.wav' | while read f; do cp --remove-destination "$(readlink -f "$f")" "$f"; done

# verify — expect 0 symlinks and ~170 MB of real audio:
find samples -type l -name '*.wav' | wc -l      # → 0
du -sh samples                                   # → ~170M
```

Then copy the **entire `webfoxDot` folder** (USB stick / cloud drive) to the workshop machine.

> Don't `git clone` on the other machine instead — you'd get the sample symlinks with no target, so **drums would be silent**. Copy the folder (with real samples), or on the target run `python3 scripts/setup_samples.py --sample-path /path/to/YourSamples`.

---

## 1. On the workshop machine — prerequisites

| Need | Check / install |
|------|-----------------|
| **Python 3.8+** (the dev server) | `python3 --version` · macOS: preinstalled or `brew install python3` · Ubuntu/Debian: `sudo apt install python3` · Windows: python.org installer (tick **Add to PATH**) |
| **Chrome** (recommended) | Best WebGL2 (visuals) + WASM audio. Firefox 90+ also works. |
| SuperCollider | **Not needed** — synthdefs are precompiled and checked in. |
| Internet | **Not needed** — server + samples are local. |

---

## 2. Run it

```bash
cd path/to/webfoxDot
python3 serve.py
```

You'll see: `WebFoxDot static server → http://127.0.0.1:8765`

Open **http://127.0.0.1:8765** in Chrome.

> ⚠️ **Do NOT open `index.html` as a `file://`** — it won't boot. The server sets the `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers the WASM audio (SharedArrayBuffer) requires. Always use the `http://127.0.0.1:8765` URL.

---

## 3. Boot + smoke test (do this before the audience arrives)

1. Click **boot** (top-left). Wait a few seconds — the WASM SuperCollider engine loads.
2. Put the cursor on a line and press **Ctrl+Enter**:

```
d1 >> play("x-o-", dur=1/2)          # drums — you should hear kick / hat / snare
b1 >> dbass([0, 0, 3, 5], dur=1/2)   # bass
p1 >> pluck([0, 2, 4, 7], dur=1/2)   # a synth
```

3. **Ctrl+;** stops everything.

If you hear drums, the local kit is working — **you do NOT need the "load kit" button** (that only pulls an online pack). The local kit auto-loads at boot.

---

## 4. Presenting — copy/paste starters

**A quick build:**
```
Clock.bpm = 124
d1 >> play("x-o-", dur=1/2)
h1 >> play("--", dur=1/4, amp=0.3, hpf=6000)
b1 >> dbass([0, 0, 3, 5], oct=3, dur=1/2, lpf=linvar([400, 2000], [8]))
p1 >> pluck(PProg("pop"), oct=5, dur=1, sus=0.3, room=0.4)
```

**Generative (it writes music for you):**
```
chaos()        # a fresh generative piece · run again for a new one
son()           # a jam bot that keeps evolving
```

**Visuals — behind the editor:**
```
video1 >> mosaic(cells=12, mode=P[0,1,3,4], fill=0.5, pal="neon")
vbg()           # run the visuals as the editor background (toggle off with vbg() again)
```

**Discover more:** the **tour** button (top toolbar) teaches live-coding from scratch, and the **examples ▾** dropdown has full runnable sets.

---

## 5. Handy shortcuts

| Key | Action |
|-----|--------|
| **Ctrl+Enter** | Run the current line (or selection) |
| **Ctrl+Alt+Enter** | Run the whole block at the cursor |
| **Ctrl+;** | Stop all players |
| **Ctrl+/** | Toggle comment |
| **Shift+Alt+B** | Visuals as editor background (`vbg()`) |
| **Shift+Alt+Z** | Zen — hide all UI |

---

## 6. Troubleshooting

| Symptom | Fix |
|---------|-----|
| No sound at all | Did you click **boot**? Is the browser tab un-muted? Is `python3 serve.py` still running in the terminal? |
| "boot" fails / `crossOriginIsolated` error | You opened `file://` — use the **http://127.0.0.1:8765** URL instead. |
| Synths play but **drums are silent** | Samples weren't materialized on this machine — re-run the `find … cp` from step 0, or click **load kit** (needs internet once). |
| Port **8765 already in use** | Edit `config.json` → `static.port` to another value, restart `serve.py`, use the new port. |
| Firefox acting up | Prefer **Chrome** for the workshop. |
| Page looks stale after edits | Hard-refresh (Ctrl+Shift+R) — the server sends no-cache headers, but the browser/PWA may hold on. |

---

## 7. Optional / advanced

- **Change the sample bank:** `python3 scripts/setup_samples.py --sample-path /path/to/Samples --bank 0` (regenerates `samples/` + `samples/manifest.json`).
- **Load a kit live, no files:** in the editor, `loadpack("http://…/pack.json")` or `loadsample("K", "http://…/kick.wav")`.
- **Let the audience run it too (one server, whole room):** `python3 serve-lan.py` — same static files, but over **HTTPS** on your LAN IP, with a self-signed cert generated on first run into `.cert/`. Attendees open the printed `https://<your-ip>:8765`, click **Advanced → Proceed** past the cert warning once, then boot normally. HTTPS is not optional here: SharedArrayBuffer needs a secure context, and a plain `http://<LAN-IP>` is not one. Everyone must be on the same Wi-Fi and your firewall must allow the port (`sudo ufw allow 8765`, or on Arch `sudo iptables -I INPUT -p tcp --dport 8765 -j ACCEPT`). Flags: `--port N`, `--regen-cert` (after your IP changes), `--http` (plain HTTP, localhost only). Note the browser will refuse to install the PWA/service worker on a self-signed cert — harmless, everything else works. For a public server, deploy over real HTTPS (see the nginx block in `README.md`).
- **Multiplayer / galaxy** (not needed to present solo): `node server/collab-server.js` + the proxy config in `README.md`.
- **Record the set:** the **rec audio** button captures the output to a `.webm`.
