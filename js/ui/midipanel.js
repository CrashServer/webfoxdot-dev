// MIDI panel — enable Web MIDI, discover CC numbers (live monitor), and see
// active CC→param bindings. Binding itself is done in code: `p1.lpf = midi(74,
// 100, 8000)` or `mlearn(...)`; this panel is the discovery + status surface.

import { enableMidi, midiState, onMidiChange, clearMidiBindings, MIDI_CURVES } from '../midi/midi.js';
import { midiOutState, selectMidiOut } from '../midi/midiout.js';

let _wired = false;

export function initMidiPanel() {
    const enableBtn = document.getElementById('cp-midi-enable');
    const clearBtn  = document.getElementById('cp-midi-clear');
    if (enableBtn) enableBtn.onclick = async () => {
        enableBtn.textContent = 'enabling…';
        try { await enableMidi(); } catch (_) { /* state render shows the error */ }
        _render();
    };
    if (clearBtn) clearBtn.onclick = () => { clearMidiBindings(); _render(); };

    const outSel = document.getElementById('cp-midi-out-sel');
    if (outSel) outSel.onchange = () => { selectMidiOut(outSel.value); _render(); };

    // Curve reference — the 4th arg to midi()/mlearn(). Static, so set it once.
    const curvesEl = document.getElementById('cp-midi-curves');
    if (curvesEl) {
        curvesEl.innerHTML = 'curves: ' +
            MIDI_CURVES.map(c => `<span class="midi-curve">${c}</span>`).join(' ');
    }

    onMidiChange(_render);
    _wired = true;
    _render();
}

function bar(norm) {
    const n = Math.round((norm ?? 0) * 12);
    return '▰'.repeat(n) + '▱'.repeat(12 - n);
}

function _render() {
    if (!_wired) return;
    const s = midiState();

    const statusEl = document.getElementById('cp-midi-status');
    const enableBtn = document.getElementById('cp-midi-enable');
    if (statusEl) {
        if (!s.supported)   statusEl.innerHTML = '<span class="midi-bad">Web MIDI unavailable — use Chromium/Edge</span>';
        else if (s.error)   statusEl.innerHTML = `<span class="midi-bad">${s.error}</span>`;
        else if (s.enabled) statusEl.innerHTML = s.inputs.length
            ? `<span class="midi-ok">●</span> ${s.inputs.map(escapeHtml).join(', ')}`
            : '<span class="midi-ok">●</span> on — no input devices';
        else                statusEl.textContent = 'off';
    }
    if (enableBtn) enableBtn.style.display = (s.enabled || !s.supported) ? 'none' : '';

    const learnEl = document.getElementById('cp-midi-learn');
    if (learnEl) learnEl.style.display = s.learning ? '' : 'none';

    // Live CC monitor — twist a knob to discover its number.
    const monEl = document.getElementById('cp-midi-monitor');
    if (monEl) {
        monEl.innerHTML = s.monitor.length
            ? s.monitor.slice(0, 6).map(m =>
                `<div class="midi-row"><span class="midi-cc">CC${m.cc}</span>` +
                `<span class="midi-meter">${bar(m.value)}</span>` +
                `<span class="midi-val">${m.value.toFixed(2)}</span></div>`).join('')
            : (s.enabled ? '<div class="midi-hint">twist a knob…</div>' : '');
    }

    // Active bindings.
    const bindEl = document.getElementById('cp-midi-bindings');
    if (bindEl) {
        bindEl.innerHTML = s.bindings.length
            ? s.bindings.map(b =>
                `<div class="midi-row"><span class="midi-cc bound">CC${b.cc}</span>` +
                `<span class="midi-meter">${bar(b.norm)}</span>` +
                `<span class="midi-curve">${escapeHtml(b.curve || 'lin')}</span>` +
                `<span class="midi-val">${fmt(b.value)}</span></div>`).join('')
            : '';
    }
    const clearBtn = document.getElementById('cp-midi-clear');
    if (clearBtn) clearBtn.style.display = s.bindings.length ? '' : 'none';

    // MIDI-out port picker — only shown once outputs exist (midiout() enabled them).
    const o = midiOutState();
    const outRow = document.getElementById('cp-midi-out');
    const outSel = document.getElementById('cp-midi-out-sel');
    if (outRow && outSel) {
        if (o.outputs.length) {
            outRow.style.display = '';
            const chosen = o.selected || o.outputs.find(d => d.active)?.id;
            outSel.innerHTML = o.outputs.map(d =>
                `<option value="${escapeHtml(d.id)}"${d.id === chosen ? ' selected' : ''}>${escapeHtml(d.name)}</option>`
            ).join('');
        } else {
            outRow.style.display = 'none';
        }
    }
}

function fmt(v) {
    if (v == null) return '—';
    return Math.abs(v) >= 100 ? Math.round(v).toString() : v.toFixed(2);
}
function escapeHtml(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
