// state.js — the renderer's inbox. Listens on the shared BroadcastChannel and holds
// the latest visual-language state (V) + audio/transport (AUD) + transient triggers
// (S). The main window resolves patterns/TimeVars on the audio clock and streams the
// plain-number `vstate`, so nothing here has to know about patterns.

export const V   = { layers: [], mix: null, palette: null, mode: null, res: null, clearSeq: 0 };   // visual language
export const AUD = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Array(32).fill(0), bpm: 120, beat: 0, bar: 0, section: '', autoplay: false };
export const S   = { lastMsg: 0, beatPulse: false, lastBeat: -1 };

const chan = new BroadcastChannel('crashdot-visuals');
chan.onmessage = (e) => {
    const m = e.data; S.lastMsg = performance.now();
    if (m.t === 'vstate') {
        V.layers = m.layers || []; V.mix = m.mix || null; V.palette = m.palette || null; V.mode = m.mode || null;
        V.res = (typeof m.res === 'number' && isFinite(m.res)) ? m.res : null;
        if (typeof m.clearSeq === 'number') V.clearSeq = m.clearSeq;
    } else if (m.t === 'audio') {
        AUD.bass = m.bass; AUD.mid = m.mid; AUD.treble = m.treble; AUD.level = m.level;
        if (Array.isArray(m.spectrum)) AUD.spectrum = m.spectrum;
        AUD.bpm = m.bpm; AUD.beat = m.beat; AUD.bar = m.bar;
        AUD.section = m.section || ''; AUD.autoplay = !!m.autoplay;
        const fb = Math.floor(m.beat);
        if (fb !== S.lastBeat) { S.lastBeat = fb; S.beatPulse = true; }
    }
    // ('code' / 'instant' / 'players' / 'step' are available on the channel but the
    //  clean 2-channel mixer doesn't need them — reactivity comes from AUD.)
};
