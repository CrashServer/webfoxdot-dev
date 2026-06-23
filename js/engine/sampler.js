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
export async function loadSampleFromURL(char, url) {
    if (!_sc) throw new Error('audio not booted — click "boot" first');
    const urls = Array.isArray(url) ? url : [url];
    const bufStart = _nextUserBuf;
    let count = 0;
    for (const u of urls) {
        try {
            const r   = await fetch(u);
            if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
            const buf = await r.arrayBuffer();
            await _sc.loadSample(_nextUserBuf, buf);
            _nextUserBuf++;
            count++;
        } catch (e) {
            console.error(`loadsample "${char}" ${u}:`, e.message);
        }
    }
    if (count === 0) return false;
    // Register (or override) the char in the manifest
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
    const base  = url.slice(0, url.lastIndexOf('/') + 1);
    const chars = Object.entries(pack);
    const total = chars.length;
    let loaded  = 0;
    for (const [char, entry] of chars) {
        const urls = (Array.isArray(entry) ? entry : [entry])
            .map(u => /^https?:\/\//.test(u) ? u : base + u);
        try {
            if (await loadSampleFromURL(char, urls)) loaded++;
        } catch (e) {
            console.error(`loadpack char "${char}":`, e.message);
        }
        if (onProgress) onProgress(loaded, total, char);
    }
    return loaded;
}

// ── Pattern parsing ────────────────────────────────────────────────────────────
// Returns array of steps. Each step is one of:
//   null              — rest
//   { chars: [c,...], dur_mult: 1 }  — fire these chars simultaneously, full step
//   { sub: [c,...] }                 — subdivision: N chars each at dur/N
//
// "X  o"     → [{chars:['X']}, null, null, {chars:['o']}]
// "(Xo)"     → [{sim:['X','o']}]         — fire all simultaneously (chord-like)
// "[XoXo]"   → [{sub:['X','o','X','o']}] — 4 equal subdivisions
// "{Xo}"     → [{rand:['X','o']}]        — random pick each step
// "<Xo>"     → [{alt:['X','o'],_idx:0}]  — cycle through on successive hits

export function parsePattern(str) {
    const steps = [];
    let i = 0;
    while (i < str.length) {
        const c = str[i];
        if (c === ' ' || c === '.') {
            steps.push(null);
            i++;
        } else if (c === '(') {
            const end = str.indexOf(')', i + 1);
            const slice = end === -1 ? str.slice(i + 1) : str.slice(i + 1, end);
            const chars = [...slice].filter(ch => ch !== ' ');
            steps.push(chars.length ? { sim: chars } : null);
            i = end === -1 ? str.length : end + 1;
        } else if (c === '[') {
            const end = str.indexOf(']', i + 1);
            const slice = end === -1 ? str.slice(i + 1) : str.slice(i + 1, end);
            const chars = [...slice].filter(ch => ch !== ' ');
            steps.push(chars.length ? { sub: chars } : null);
            i = end === -1 ? str.length : end + 1;
        } else if (c === '{') {
            const end = str.indexOf('}', i + 1);
            const slice = end === -1 ? str.slice(i + 1) : str.slice(i + 1, end);
            const chars = [...slice].filter(ch => ch !== ' ');
            steps.push(chars.length ? { rand: chars } : null);
            i = end === -1 ? str.length : end + 1;
        } else if (c === '<') {
            const end = str.indexOf('>', i + 1);
            const slice = end === -1 ? str.slice(i + 1) : str.slice(i + 1, end);
            const chars = [...slice].filter(ch => ch !== ' ');
            steps.push(chars.length ? { alt: chars, _idx: 0 } : null);
            i = end === -1 ? str.length : end + 1;
        } else {
            steps.push({ chars: [c] });
            i++;
        }
    }
    return steps;
}

// ── PlayStringCall — returned by play(), detected in Player.__rshift__ ────────

export class PlayStringCall {
    constructor(pattern, opts) {
        this.pattern = pattern;
        this.opts    = opts;
    }
}
