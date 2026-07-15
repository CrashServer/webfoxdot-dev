# crashDot — Offline PWA spec

**Goal:** make crashDot an installable Progressive Web App that runs **fully offline
after the first visit** — boot the audio engine, all synths/FX, the editor, and the
examples — with **no app store, no git, no install steps** for the user. Multiplayer
and the galaxy degrade gracefully offline (they need the collab server).

This is a design spec, not code. It calls out the parts that are hard *specifically
for crashDot* (cross-origin isolation + WASM threads + the GitHub sample kit).

---

## 0. TL;DR / effort

| Milestone | What | Effort |
|-----------|------|--------|
| **M1** | Web manifest + icons + install button → "installable" | ~0.5 d |
| **M2** | Service worker: precache app shell + WASM + synthdefs, **inject COOP/COEP** → boots offline | ~1 d |
| **M3** | Runtime cache-on-use for samples + a tiny bundled starter kit | ~0.5 d |
| **M4** | Update flow + offline UX (degrade multiplayer/galaxy, offline badge) | ~0.5 d |
| **M5** | Cross-platform testing + Lighthouse | ~0.5 d |
| | **Total** | **~3 days** |

---

## 1. The crux: cross-origin isolation must survive offline

crashDot uses `SharedArrayBuffer` (scsynth's audio worklet threads), which requires
the page to be **cross-origin isolated**. That needs two response headers on the
document *and every resource the SW serves*:

```
Cross-Origin-Opener-Policy:   same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Today the **server** sends these (see the nginx/Caddy blocks in README). Offline,
the **service worker serves the responses**, so **the SW MUST re-inject these headers
on every response it returns from cache** — otherwise `crossOriginIsolated` becomes
`false`, `SharedArrayBuffer` disappears, and scsynth won't boot.

**Consequences to design around:**
- **First load must be online** (to fetch + install the SW and precache). After that,
  offline works. The very first document load gets the headers from the server; the
  SW takes over on subsequent loads.
- **`COEP: require-corp` is contagious:** every subresource (including the GitHub
  sample fetch) must carry `Cross-Origin-Resource-Policy`/CORS or it's blocked. This
  is *already true* in the online app, so caching just preserves it — but opaque
  cross-origin responses **can't have headers added by the SW**, so cache them as-is
  and rely on the source's CORP (see §4, samples).
- **Acceptance check:** `crossOriginIsolated === true` while offline. This is the
  single most important test.

> The public `coi-serviceworker` snippet *enables* COI by injecting headers, but it
> doesn't precache for offline. We need a **custom SW that does both**: precache +
> header injection.

---

## 2. Assets to precache (the app shell)

Same-origin, versioned, precached at SW install:

| Group | Paths | Notes |
|-------|-------|-------|
| Document | `index.html`, `config.json` | navigation fallback |
| Styles | `css/style.css` | |
| App JS | `js/**/*.js` | the ES-module tree (many files) |
| Editor | `lib/codemirror/*` | CM5 + addons |
| Engine | `lib/dist/supersonic.js`, `lib/dist/wasm/scsynth-nrt.wasm` | **~1.4 MB wasm** |
| Multiplayer client | `lib/yjs/yjs-bundle.js` | ~0.7 MB (kept for when online) |
| Synthdefs | `synthdefs/compiled/*.scsyndef` | ~100 small binaries |
| PWA | `manifest.webmanifest`, `icons/*` | |

**Estimated precache: ~5–6 MB.** Fine for Cache Storage. **Not precached:** the
sample kit (potentially tens of MB — handled at runtime, §4).

**Maintaining the list without a build step:** crashDot ships as native ES modules
(no bundler), so the precache list can't be auto-derived from a bundle. Options:
- **(a) A tiny dev script** `scripts/gen-sw-manifest` that globs `js/**`, `lib/**`,
  `css/**`, `synthdefs/compiled/**` + the fixed files and writes a `PRECACHE = [...]`
  array (or a `sw-manifest.json`) with a content hash. **Recommended** — one command,
  run before deploy. It is a *dev* step; the *user* still just opens the URL.
- (b) Hand-maintained array in `sw.js`. Brittle (easy to forget a new file).

---

## 3. Service worker design (`sw.js`, root scope)

Served from the site root so it controls the whole app (`scope: /`; if served from a
subdir, set `Service-Worker-Allowed`).

**install**
- Open cache `wfd-<VERSION>` (VERSION from `js/ui/docs.js`, or a build hash).
- `addAll(PRECACHE)`. Fail the install if any core asset (wasm, index) is missing.
- **Do not** `skipWaiting()` automatically (see updates, §5).

**activate**
- Delete caches whose name ≠ `wfd-<VERSION>`.
- `clients.claim()`.

**fetch** (routing by request)
- **Same-origin GET → cache-first**, network fallback (then cache the network
  result). **Every returned response is re-served through a header-injecting wrapper**
  that clones it and sets COOP/COEP (+ `Cross-Origin-Resource-Policy: same-origin`).
- **Navigation requests** (`mode: 'navigate'`) → return cached `index.html` (offline
  shell), with headers injected.
- **Cross-origin** (GitHub samples, unpkg if ever used) → **network-first, cache the
  response** for later offline use (opaque responses cached as-is; §4).
- **Collab server** (`/ws`, `?session=`, `/sessions`) → **never cache**; let it fail
  when offline so multiplayer/galaxy degrade (§6).

**Header injection wrapper** (pseudocode intent, not code):
> read the cached/networked `Response`, build a new `Response(body, {headers:
> {...original, COOP, COEP, CORP}})`. Only works for same-origin / CORS responses;
> opaque responses pass through untouched.

---

## 4. The samples problem (the real offline gap)

The sample kit (drum sounds etc.) is **lazy-loaded from GitHub** on `♪ load kit` /
first use. Offline that fetch fails. Three complementary strategies:

1. **Cache-on-use (baseline).** The SW caches each sample response the first time
   it's fetched (while online). After a user loads the kit once online, it's available
   offline forever. *Requirement:* the sample host must send CORP/CORS compatible with
   `COEP: require-corp` (already required today) — verify GitHub's raw/CDN does, or
   move the kit to a CORP-friendly host / same origin.
2. **Bundle a tiny starter kit (recommended add-on).** Ship a minimal built-in set
   (kick/snare/hat/clap, a few hundred KB) in the precache so **basic drums work fully
   offline out of the box**, zero config.
3. **Local folder import (later).** File System Access API → user picks a sample
   folder → fully offline, user-owned samples. Bigger feature; nice for power users.

**Recommendation:** ship **1 + 2** for M3. Add 3 later.

---

## 5. Updates (critical for a *live* tool)

The classic PWA failure is "user stuck on stale cached code." And crashDot has a
special rule: **never reload the user mid-performance.**

- Cache name is keyed to `VERSION` (bump it every release, as we already do).
- New deploy → new SW downloads + precaches in the background → enters **waiting**.
- **Do not auto-activate.** Show a subtle, dismissible **"New version — reload"**
  prompt (toolbar/about). On click: `skipWaiting()` → `clients.claim()` → reload.
- Offline users keep running the last-good version indefinitely — which is correct.

---

## 6. Offline degradation UX

| Feature | Offline? | Behaviour |
|---------|----------|-----------|
| Boot, editor, all synths/FX | ✅ works | precached engine + synthdefs |
| Examples / Live sets | ✅ works | they're in `docs.js` (precached) |
| Share-by-link (`#c=`) | ✅ works | self-contained URL, no server |
| Load kit (GitHub) | ⚠️ only if cached | else "kit unavailable offline — load it once online" + fall back to the bundled starter kit |
| 👥 go live / multiplayer | ❌ needs server | disable + tooltip "needs a connection" |
| 🌌 galaxy | ❌ needs server | the existing honest message already covers "can't reach the jam server" |

- Detect offline via `navigator.onLine` + fetch failures; show a small **offline
  badge** in the toolbar.
- Grey out server-dependent buttons when offline; re-enable on `online` event.

---

## 7. Web app manifest (`manifest.webmanifest`)

```
name:             "crashDot — live-code music"
short_name:       "crashDot"
description:      "Browser-native live coding music — offline."
start_url:        "./?src=pwa"
scope:            "./"
display:          "standalone"
background_color: "#0d1117"      // match the dark theme
theme_color:      "#0d1117"
icons:            192 / 512 / 512-maskable  (PNG)
id:               "/"
```

- Link in `index.html`: `<link rel="manifest" href="manifest.webmanifest">` +
  `<meta name="theme-color">`.
- **Icons are a design task** — need a crashDot mark exported at 192/512 + a maskable
  variant (safe-zone padded).

---

## 8. Install UX

- Capture `beforeinstallprompt`, stash it, reveal a subtle **"install"** action
  (toolbar or the About card). Call `prompt()` on click; hide once `appinstalled`.
- **iOS Safari** has no `beforeinstallprompt` → show a one-liner "Add to Home Screen
  via the Share menu" when appropriate.
- Desktop Chrome/Edge get an install icon in the omnibox automatically once the
  manifest + SW criteria are met.

---

## 9. Testing plan

- **Cross-origin isolation offline** — `crossOriginIsolated === true` with the network
  cut (DevTools → offline). **Then boot audio and play a synth.** (The make-or-break test.)
- **Lighthouse → PWA** audit passes (installable, offline start).
- **Cold offline:** clear network, reload → app shell + engine boot from cache.
- **Samples:** load kit online → go offline → samples still play (cache-on-use);
  fresh offline → starter kit works.
- **Update flow:** bump VERSION, deploy, reload → "new version" prompt, not a forced reload.
- **Platforms:** Android Chrome (install), desktop Chrome/Edge/Firefox, iOS Safari
  (Add to Home Screen). Note: Firefox desktop has no install, but offline still works.
- **Degradation:** offline → go-live/galaxy disabled with tooltips, no console errors.

---

## 10. Risks / open questions

- **COEP + SW-injected headers:** confirm `SharedArrayBuffer` stays available offline
  across target browsers (the whole thing hinges on this — prototype M2 first).
- **Sample host CORP:** GitHub raw/CDN must be `require-corp`-compatible; if not, host
  the kit same-origin or on a CORP-friendly CDN.
- **Precache manifest drift:** without the generator script, a new JS/synthdef file
  won't be cached → works online, silently missing offline. The `gen-sw-manifest`
  step + a CI check mitigate this.
- **Storage quota:** app shell (~6 MB) is safe; large user sample libraries via the
  future local-import could hit Cache/quota limits — use the Storage API + eviction UX.
- **Never reload mid-set:** the update prompt must be user-initiated, always.

---

## 11. Suggested build order

1. **M2 first as a spike** — prove `crossOriginIsolated` + audio boot survive offline
   with a header-injecting SW. If that works, everything else is routine.
2. Manifest + icons + install (M1).
3. Samples: cache-on-use + starter kit (M3).
4. Update prompt + offline UX (M4).
5. Cross-platform + Lighthouse (M5).

Deliverables: `sw.js`, `manifest.webmanifest`, `icons/`, `scripts/gen-sw-manifest`,
a small `js/pwa/register-sw.js` (registration + install/update UI), and the offline
degradation hooks in the toolbar.
