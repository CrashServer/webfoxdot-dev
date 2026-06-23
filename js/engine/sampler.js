// Sampler — buffer loading and character→bufferID map for play() patterns.

let _manifest = {};
let _loaded   = false;
let _sc       = null;             // SuperSonic ref, set at boot for runtime loading

// User/external samples get buffer IDs from 600 up (built-ins use 0–519).
const USER_BUF_START = 600;
let   _nextUserBuf   = USER_BUF_START;

export function samplesLoaded() { return _loaded; }

// Load manifest + all WAVs into SC buffers. Call once at boot.
// Returns number of samples actually loaded, or 0 if sample files are unreachable.
export async function loadSamples(sc, onProgress) {
    _sc = sc;
    const resp = await fetch('./samples/manifest.json');
    _manifest  = await resp.json();

    const allEntries = [];
    for (const [, info] of Object.entries(_manifest)) {
        for (let i = 0; i < info.count; i++) {
            allEntries.push({ url: info.urls[i], bufId: info.bufStart + i });
        }
    }

    if (allEntries.length === 0) { _loaded = true; return 0; }

    // Probe first entry before loading all — skip if files are not reachable
    try {
        const probe = await fetch(allEntries[0].url, { method: 'HEAD' });
        if (!probe.ok) throw new Error();
    } catch {
        console.warn('loadSamples: sample files unreachable — run setup_samples.py to configure your sample bank.');
        return 0;
    }

    let done = 0;
    const BATCH = 8;
    for (let i = 0; i < allEntries.length; i += BATCH) {
        await Promise.all(allEntries.slice(i, i + BATCH).map(async ({ url, bufId }) => {
            try {
                const r   = await fetch(url);
                const buf = await r.arrayBuffer();
                await sc.loadSample(bufId, buf);
            } catch (_) {}
            if (onProgress) onProgress(++done, allEntries.length);
        }));
    }
    _loaded = true;
    return done;
}

// char + sampleIndex → SC buffer ID
export function charToBufId(char, sampleIdx = 0) {
    const info = _manifest[char];
    if (!info || info.count === 0) return null;
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
    _manifest[char] = { urls, bufStart, count };
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

    // Register chars now so patterns work as buffers arrive.
    for (const e of entries) _manifest[e.char] = { urls: e.urls, bufStart: e.bufStart, count: e.urls.length };

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
import { parseSometimes } from '../patterns/sequences.js';

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
        this._sometimes = null;
    }
    // b1 >> play("x-o-").sometimes("stutter", 2)
    sometimes(...a) { this._sometimes = parseSometimes(a); return this; }
}
