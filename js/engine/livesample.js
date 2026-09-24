// livesample.js — sample the room while it plays.
//
//   sample("grab", 4)              the next 4 beats of the mix, from the next bar
//   s1 >> loop("grab", dur=4)      …looped, stretched to the tempo
//   audioin("scarlett")            pick the live input: an interface, a mic, a line
//   sample("vox", 8, src="in")     record it
//   sample("bass", 4, src=p1)      one player on its own, with its FX
//   sample("V", 1, src="in")       a single character is a play() sample:
//   d1 >> play("V.V.")
//
// It all happens inside scsynth. JS allocates a buffer N beats long and sends fd_rec
// with a timetag on the bar, like a note; fd_rec records one pass and frees itself.
// So a take is sample-accurate against everything else the clock schedules, and
// nothing is encoded or copied through JS.
//
// The live input goes into scsynth rather than around it: the scsynth worklet copies
// its Web Audio input into the server's input buses, where SoundIn reads them. So
// audioin() only has to connect a getUserMedia stream to that node. Nothing plays the
// input back out — a mic next to the speakers would feed back — it is only there to
// be recorded — until you ask to hear it: audioin(monitor=0.5) plays it into the mix.
//
// Takes are LOCAL. In a jam, a peer running loop("grab") has no buffer by that name
// and hears nothing; sharing takes through the room is a separate step.

import { osc } from '../../lib/dist/supersonic.js';
import { LOOKAHEAD_S } from './clock.js';
import { allocUserBufId, registerTake } from './sampler.js';
import { resolveCamera as resolveDevice } from '../visuals/camera.js';
import { resolveSource, planTake } from './takeplan.js';
import { PLAYER_GROUP } from './player.js';

let _sc = null, _clock = null, _masterNode = 4, _masterFxGroup = 5, _findPlayer = () => null;
let _log = () => {};

export function initLiveSample(sc, clock, { masterNode = 4, masterFxGroup = 5, findPlayer, log } = {}) {
    _sc = sc; _clock = clock; _masterNode = masterNode; _masterFxGroup = masterFxGroup;
    if (findPlayer) _findPlayer = findPlayer;
    if (log) _log = log;
}

// A take the size of the whole pool would starve every sample after it. 32MB is
// ~87s of stereo at 48k — far past any loop — and a quarter of the desktop pool.
const MAX_TAKE_BYTES = 32 * 1024 * 1024;

// ── The live input ───────────────────────────────────────────────────────────
let _in = { stream: null, source: null, up: null, deviceId: null, label: '', latency: 0 };

export function audioinState() {
    return { live: !!_in.stream, label: _in.label, deviceId: _in.deviceId, latency: _in.latency };
}

async function inputList() {
    try {
        const all = await navigator.mediaDevices.enumerateDevices();
        return all.filter(d => d.kind === 'audioinput')
                  .map((d, i) => ({ id: d.deviceId, label: d.label || `input ${i + 1}` }));
    } catch (_) { return []; }
}

function stopInput() {
    try { _in.source?.disconnect(); } catch (_) {}
    try { _in.up?.disconnect(); } catch (_) {}
    for (const t of _in.stream?.getTracks() || []) { try { t.stop(); } catch (_) {} }
    _in = { stream: null, source: null, up: null, deviceId: null, label: '', latency: 0 };
}

async function openInput(deviceId) {
    // Every one of these defaults is for a voice call, and each one ruins music:
    // echo cancellation ducks whatever the speakers are playing, noise suppression
    // eats sustained tones as "noise", and auto-gain pumps the level between notes.
    const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false,
                    channelCount: { ideal: 2 }, latency: { ideal: 0 } };
    if (deviceId) audio.deviceId = { exact: deviceId };
    const stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
    const ac = _sc.audioContext;
    const source = ac.createMediaStreamSource(stream);
    // The scsynth node's input takes as many channels as it is given ("max" mode),
    // so a mono mic would arrive as ONE channel and SoundIn's right side would be
    // silent. An explicit 2-channel gain up-mixes mono to both sides first.
    const up = ac.createGain();
    up.channelCount = 2; up.channelCountMode = 'explicit'; up.channelInterpretation = 'speakers';
    // sc.node is a frozen wrapper (connect/disconnect only, for OUTPUT); the real
    // AudioWorkletNode — the thing that has an input — is behind .input.
    source.connect(up).connect(_sc.node.input || _sc.node);
    const track = stream.getAudioTracks()[0];
    const st = track?.getSettings?.() || {};
    _in = { stream, source, up, deviceId: st.deviceId || deviceId || null,
            label: track?.label || 'input', latency: Number(st.latency) || 0 };
    track?.addEventListener('ended', () => { if (_in.stream === stream) { stopInput(); _log('audioin: the input stopped', 'warn'); } });
}

// ── Monitoring ───────────────────────────────────────────────────────────────
// fd_monitor plays the input into the mix, in the player group so stop-all and
// panic free it. Off by default and never switched on by anything else: a mic in
// the same room as the speakers howls the moment it is heard.
let _mon = { id: null, amp: 0, pan: 0 };

export function setMonitor(amp, pan = _mon.pan) {
    const a = Math.max(0, Math.min(2, Number(amp) || 0)), p = Math.max(-1, Math.min(1, Number(pan) || 0));
    if (a > 0 && _mon.id == null) {
        _mon.id = _sc.nextNodeId();
        _sc.send('/s_new', 'fd_monitor', _mon.id, 0, PLAYER_GROUP, 'amp', a, 'pan', p);
    } else if (a > 0) {
        _sc.send('/n_set', _mon.id, 'amp', a, 'pan', p);
    } else if (_mon.id != null) {
        _sc.send('/n_set', _mon.id, 'gate', 0);         // fades out and frees itself
        _mon.id = null;
    }
    _mon.amp = a; _mon.pan = p;
}
/** Stop-all: fade the monitor out like any other voice. */
export function stopMonitor() { if (_sc && _mon.id != null) setMonitor(0); }
/** After something freed every node without asking (soft reload): forget the id. */
export function monitorGone() { _mon.id = null; _mon.amp = 0; }

function failWhy(e) {
    const n = e?.name || '';
    return n === 'NotAllowedError' || n === 'SecurityError' ? 'permission was refused'
         : n === 'NotFoundError' || n === 'OverconstrainedError' ? 'no such input on this machine'
         : n === 'NotReadableError' || n === 'AbortError' ? 'another program or tab has the input open'
         : (e?.message || String(e));
}

/**
 * audioin()            open the default input, or list what there is once open
 * audioin(1) / ("scar")   pick one by index or by a fragment of its name
 * audioin(false) / ("off")  close it
 * audioin(monitor=0.5)    hear it, through the mix (0 = silent again); pan= too
 */
export async function audioin(which, opts = {}) {
    if (which && typeof which === 'object' && !Array.isArray(which)) { opts = which; which = undefined; }
    opts = opts || {};
    if (!_sc) { _log('audioin: boot the audio first', 'warn'); return null; }
    if (which === false || (typeof which === 'string' && /^\s*off\s*$/i.test(which))) {
        stopMonitor(); stopInput(); _log('audioin: off', 'info'); return 'off';
    }
    const label = await openAndPick(which, opts.monitor === undefined);
    if (label && opts.monitor !== undefined) {
        setMonitor(opts.monitor, opts.pan);
        _log(_mon.amp > 0 ? `audioin: monitoring ${label} at ${_mon.amp} — use headphones; a mic near the speakers will howl`
                          : 'audioin: monitor off', _mon.amp > 0 ? 'warn' : 'info');
    }
    return label;
}

async function openAndPick(which, chatty) {
    if (!navigator.mediaDevices?.getUserMedia) {
        _log(window.isSecureContext ? 'audioin: this browser cannot open an audio input'
                                    : 'audioin: needs https (or localhost) — this page is not a secure context', 'warn');
        return null;
    }
    try {
        // Labels only exist after permission does, so the first call opens the
        // default input and THEN looks at the list.
        if (!_in.stream) await openInput(null);
        const list = await inputList();
        if (which == null || which === true) {
            if (!chatty) return _in.label;
            _log(`audioin: ${_in.label}${list.length > 1 ? `  ·  ${list.length} inputs:` : ''}`, 'ok');
            if (list.length > 1) list.forEach((d, i) => _log(`  ${String(i).padStart(2)}.  ${d.label}${d.id === _in.deviceId ? '   ◂' : ''}`, 'info'));
            return _in.label;
        }
        const { device, why } = resolveDevice(which, list, _in.deviceId);
        if (!device) { _log(`audioin: ${why.replace('camera', 'input')} — ${list.map(d => d.label).join(' · ')}`, 'warn'); return null; }
        if (device.id !== _in.deviceId) { stopInput(); await openInput(device.id); }
        _log(`audioin: ${_in.label}`, 'ok');
        return _in.label;
    } catch (e) {
        stopMonitor(); stopInput();
        _log(`audioin: ${failWhy(e)}`, 'warn');
        return null;
    }
}

// ── Takes ────────────────────────────────────────────────────────────────────

/**
 * sample(name, beats=4, src="master", quant=<bar>, amp=1, latency=<auto>)
 * @returns {Promise<string|null>} the name, once the take is scheduled
 */
export async function sample(name, beats = 4, opts = {}) {
    if (opts && typeof opts === 'object' && !Array.isArray(opts) && typeof beats === 'object' && beats) { opts = beats; beats = opts.beats ?? 4; }
    if (!_sc || !_clock) { _log('sample: boot the audio first', 'warn'); return null; }
    if (name == null || String(name) === '') { _log('sample: give the take a name — sample("grab", 4)', 'warn'); return null; }
    name = String(name);
    const src = resolveSource(opts.src, _findPlayer);
    if (!src.kind) { _log(`sample: ${src.why}`, 'warn'); return null; }

    let inBus = 0, live = 0, addAction = 3, target = _masterNode, latency = 0;
    if (src.kind === 'in') {
        if (!_in.stream) { await audioin(); if (!_in.stream) return null; }
        live = 1;
        // Round trip: the beat leaves the speakers outputLatency late, the player
        // hears it and plays, and that arrives through the input's own latency.
        const ac = _sc.audioContext;
        latency = opts.latency != null ? Number(opts.latency)
                : (ac.outputLatency || ac.baseLatency || 0) + _in.latency;
    } else if (src.kind === 'player') {
        const bus = src.player.recBus();
        if (bus == null) { _log(`sample: ${src.player.name || 'that player'} is not playing`, 'warn'); return null; }
        // After every player FX (FX_GROUP), so the take has the player's effects on it.
        inBus = bus; addAction = 0; target = _masterFxGroup;
    }

    const plan = planTake({ nowBeat: _clock.beat, bpm: _clock.bpm, beats: Number(beats),
                            quant: opts.quant ?? _clock.meter ?? 4,
                            sampleRate: _sc.audioContext.sampleRate,
                            leadSec: LOOKAHEAD_S + 0.2, latencySec: latency });
    if (!plan.ok) { _log(`sample: ${plan.why}`, 'warn'); return null; }
    if (plan.bytes > MAX_TAKE_BYTES) {
        _log(`sample: ${beats} beats is ${Math.round(plan.seconds)}s — takes are capped at ${Math.round(MAX_TAKE_BYTES / 8 / _sc.audioContext.sampleRate)}s`, 'warn');
        return null;
    }

    const bufId = allocUserBufId();
    try {
        _sc.send('/b_alloc', bufId, plan.frames, 2, _sc.audioContext.sampleRate);
        await _sc.sync();
    } catch (e) { _log(`sample: could not allocate the take (${e.message})`, 'warn'); return null; }

    const when = _clock.beatToNTP(plan.startBeat) + plan.latencySec;
    _sc.sendOSC(osc.encodeSingleBundle(when, '/s_new',
        ['fd_rec', _sc.nextNodeId(), addAction, target, 'buf', bufId, 'in_bus', inBus, 'live', live,
         'amp', Number(opts.amp ?? 1)]));

    // Swap the name over just before the end bar, with more lead than a note has, so
    // a loop step AT the end bar already finds the new take. Until then the name
    // still means the previous take, so re-sampling a loop that is playing keeps it
    // playing — and records it, which is how layering works.
    _clock._schedule(plan.endBeat + plan.latencySec * _clock.bpm / 60, () => {
        const prev = registerTake(name, bufId);
        // The old take may still be sounding (a loop step started just before the
        // swap), so it is freed well after, never under a playing node.
        if (prev != null) setTimeout(() => { try { _sc.send('/b_free', prev); } catch (_) {} }, 1000 * Math.max(30, plan.seconds * 2));
        _log(`● "${name}" ready — ${Math.round(plan.seconds * 100) / 100}s`, 'ok');
    }, LOOKAHEAD_S + 0.05);

    const bar = Math.floor(plan.startBeat / (_clock.meter || 4)) + 1;
    const from = src.kind === 'in' ? `input (${_in.label})` : src.kind === 'player' ? (src.player.name || 'player') : 'the mix';
    _log(`○ sampling "${name}" — ${beats} beats of ${from} from bar ${bar}${latency ? ` · +${Math.round(latency * 1000)}ms input latency` : ''}`, 'info');
    return name;
}
