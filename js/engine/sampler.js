// Sampler — buffer loading and character→bufferID map for play() patterns.

let _manifest = {};
let _loaded   = false;
let _sc       = null;             // SuperSonic ref, set at boot for runtime loading

// User/external samples get buffer IDs from 600 up (built-ins use 0–519).
const USER_BUF_START = 600;
let   _nextUserBuf   = USER_BUF_START;

export function samplesLoaded() { return _loaded; }

// Single-character sample names currently in the bank (for the generator/chaos).
export function loadedSampleChars() {
    return Object.keys(_manifest).filter(c => c.length === 1 && (_manifest[c].count > 0 || _manifest[c]._loaded || _manifest[c]._loading));
}

// Read the manifest at boot — but do NOT fetch any WAVs. Buffer ids are
// pre-assigned (manifest.bufStart), so each char's samples load lazily the
// first time a pattern uses that char. This keeps boot instant and memory
// proportional to what's actually played — essential for large banks and for
// Firefox, which struggles to bulk-copy hundreds of MB into shared WASM memory.
// Returns the number of chars available (0 if the bank is unreachable).
export async function loadSamples(sc /*, onProgress */) {
    _sc = sc;
    try {
        const resp = await fetch('./samples/manifest.json');
        _manifest  = await resp.json();
    } catch {
        console.warn('loadSamples: no manifest — run setup_samples.py to configure your sample bank.');
        _loaded = true;
        return 0;
    }
    const chars = Object.keys(_manifest);
    // Probe one file so we can warn early if the bank is misconfigured.
    const first = chars.map(c => _manifest[c]).find(i => i.count > 0);
    if (first) {
        try { const r = await fetch(first.urls[0], { method: 'HEAD' }); if (!r.ok) throw 0; }
        catch { console.warn('loadSamples: sample files unreachable — check samples/manifest.json paths.'); }
    }
    _loaded = true;
    return chars.length;
}

// Lazily fetch one char's WAVs into its pre-assigned buffer range (once).
async function ensureLoaded(char) {
    const info = _manifest[char];
    if (!info || !_sc || info._loaded || info._loading) return;
    info._loading = true;
    await Promise.all(info.urls.map(async (url, i) => {
        try {
            const r   = await fetch(url);
            const buf = await r.arrayBuffer();
            await _sc.loadSample(info.bufStart + i, buf);
        } catch (e) { console.error(`sample "${char}" ${url}:`, e.message); }
    }));
    info._loaded = true;
    info._loading = false;
}

// char + sampleIndex → SC buffer ID.
// On the first use of a char its buffers load asynchronously and the call
// returns null (one silent hit); subsequent hits play.
export function charToBufId(char, sampleIdx = 0) {
    const info = _manifest[char];
    if (!info || info.count === 0) return null;
    if (!info._loaded) { ensureLoaded(char); return null; }
    return info.bufStart + (((sampleIdx % info.count) + info.count) % info.count);
}

// ── External sample loading (runtime) ────────────────────────────────────────
// Fetch a WAV from any CORS-friendly URL and assign it to a play() char.
// GitHub raw (raw.githubusercontent.com) and release-asset URLs work directly.
//
//   loadsample("K", "https://raw.githubusercontent.com/u/repo/main/kick.wav")
//   play("K.K.")            ← now uses the loaded sample
//
// Multiple URLs assign successive sample-index slots for one char:
//   loadsample("K", [url0, url1])   → play("K", sample=1) picks url1
// Fetch one WAV into a given SC buffer id. Throws on failure.
async function fetchToBuffer(bufId, url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    const buf = await r.arrayBuffer();
    await _sc.loadSample(bufId, buf);
}

// Yield to the event loop so the browser can paint between batches.
const _yield = () => new Promise(res => setTimeout(res, 0));

export async function loadSampleFromURL(char, url) {
    if (!_sc) throw new Error('audio not booted — click "boot" first');
    const urls = Array.isArray(url) ? url : [url];
    const bufStart = _nextUserBuf;
    _nextUserBuf += urls.length;          // reserve a contiguous block up front
    let count = 0;
    for (let i = 0; i < urls.length; i++) {
        try { await fetchToBuffer(bufStart + i, urls[i]); count++; }
        catch (e) { console.error(`loadsample "${char}" ${urls[i]}:`, e.message); }
    }
    if (count === 0) return false;
    _manifest[char] = { urls, bufStart, count, _loaded: true };
    return true;
}

// Load a pack: a JSON manifest mapping chars → url or [urls].
//   loadpack("https://raw.githubusercontent.com/u/repo/main/pack.json")
// pack.json: { "K": "kick.wav", "S": ["snare0.wav","snare1.wav"] }
// Relative URLs in the pack resolve against the pack's own location.
export async function loadPackFromURL(url, onProgress) {
    if (!_sc) throw new Error('audio not booted — click "boot" first');
    let pack;
    try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        pack = await r.json();
    } catch (e) {
        throw new Error(`could not fetch pack (${e.message})`);
    }
    const base = url.slice(0, url.lastIndexOf('/') + 1);

    // Pre-allocate buffer ids per char (no races), then flatten to jobs.
    const entries = [];   // { char, urls, bufStart }
    const jobs    = [];   // { bufId, url }
    for (const [char, entry] of Object.entries(pack)) {
        const urls = (Array.isArray(entry) ? entry : [entry])
            .map(u => /^https?:\/\//.test(u) ? u : base + u);
        const bufStart = _nextUserBuf;
        _nextUserBuf += urls.length;
        entries.push({ char, urls, bufStart });
        urls.forEach((u, i) => jobs.push({ bufId: bufStart + i, url: u }));
    }

    // Register chars; mark _loading so the lazy path won't double-fetch them.
    for (const e of entries) _manifest[e.char] = { urls: e.urls, bufStart: e.bufStart, count: e.urls.length, _loading: true };

    // Load in concurrent batches, yielding between them to keep the UI live.
    const BATCH = 8;
    let done = 0;
    for (let i = 0; i < jobs.length; i += BATCH) {
        await Promise.all(jobs.slice(i, i + BATCH).map(async (j) => {
            try { await fetchToBuffer(j.bufId, j.url); }
            catch (e) { console.error(`loadpack ${j.url}:`, e.message); }
            if (onProgress) onProgress(++done, jobs.length);
        }));
        await _yield();
    }
    for (const e of entries) { _manifest[e.char]._loaded = true; _manifest[e.char]._loading = false; }
    return entries.length;
}

// ── Pattern parsing (recursive — brackets nest arbitrarily) ──────────────────
// parsePattern returns an array of STEP tokens, one per beat-slot. A token is:
//   { rest: true }                    — silence
//   { char: 'x' }                     — a single sample char
//   { type, children, _idx }          — a bracket group; children are tokens too
//
// Bracket types:  (sim) together · [sub] subdivide · {rand} random · <alt> cycle
// Brackets nest:  "<x.><[--]>"  →  alt( seq, sub('-','-') )
import { attachModifiers, unisonSpread } from '../patterns/sequences.js';

const OPENERS = {
    '(': { type: 'sim',  close: ')' },
    '[': { type: 'sub',  close: ']' },
    '{': { type: 'rand', close: '}' },
    '<': { type: 'alt',  close: '>' },
};

function parseTokens(str, st, closeChar) {
    const tokens = [];
    while (st.i < str.length) {
        const c = str[st.i];
        if (closeChar && c === closeChar) { st.i++; return tokens; }
        if (c === ' ' || c === '.') { tokens.push({ rest: true }); st.i++; continue; }
        const op = OPENERS[c];
        if (op) {
            st.i++; // consume opener
            const children = parseTokens(str, st, op.close);
            tokens.push(children.length ? { type: op.type, children, _idx: 0 } : { rest: true });
            continue;
        }
        tokens.push({ char: c });
        st.i++;
    }
    return tokens;
}

export function parsePattern(str) {
    return parseTokens(str, { i: 0 }, null);
}

// ── PlayStringCall — returned by play(), detected in Player.__rshift__ ────────

export class PlayStringCall {
    constructor(pattern, opts) {
        this.pattern    = pattern;
        this.opts       = opts;
        this._modifiers = null;
        this._after     = null;
        this._unison    = null;
    }
    // .after(beats, method, ...args) — one-shot: call a player method after N beats
    after(beats, method, ...args) { this._after = { beats, method, args }; return this; }
    // .every(beats, method, ...args) — call a player method every N beats (chainable)
    every(beats, method, ...args) { (this._everys ??= []).push({ beats, method, args }); return this; }
    // play() has no degree to transpose — accept `+` as a no-op so it can't crash
    __add__() { return this; }
    // unison on samples: n layers detuned via playback rate (2^(pshift/12)) + pan spread
    unison(n = 2, detune = 0.125, spread = 100) { this._unison = n ? unisonSpread(n, detune, spread) : null; return this; }
    // .degrade(prob) — randomly silence prob (0–1) of steps (default 0.5)
    degrade(prob = 0.5) { this._degrade = prob; return this; }
    // Chained player methods (applied on activation): b1 >> play(...).solo(4) etc.
    solo(beats) { (this._calls ??= []).push(['solo', beats]); return this; }
    only(beats) { (this._calls ??= []).push(['only', beats]); return this; }
    stop(beats) { (this._calls ??= []).push(['stop', beats]); return this; }
}
// .sometimes / .often / .rarely / .always / … — chainable probability modifiers
attachModifiers(PlayStringCall);

// ── LoopCall — returned by loop(), detected in Player.__rshift__ ──────────────
// loop("break", dur=8) plays a named loop buffer, beat-stretched to dur beats.
// Named loops are registered with loadloop(name, url) and share the same buffer
// store as play() samples (multi-char names never collide with single chars).
export class LoopCall {
    constructor(name, opts) {
        this.name       = name;
        this.opts       = opts;
        this._modifiers = null;
        this._after     = null;
    }
    after(beats, method, ...args) { this._after = { beats, method, args }; return this; }
    every(beats, method, ...args) { (this._everys ??= []).push({ beats, method, args }); return this; }
    __add__() { return this; }
    degrade(prob = 0.5) { this._degrade = prob; return this; }
    solo(beats) { (this._calls ??= []).push(['solo', beats]); return this; }
    only(beats) { (this._calls ??= []).push(['only', beats]); return this; }
    stop(beats) { (this._calls ??= []).push(['stop', beats]); return this; }
}
attachModifiers(LoopCall);
