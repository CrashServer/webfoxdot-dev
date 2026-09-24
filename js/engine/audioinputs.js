// audioinputs.js — the machine's audio inputs, as last seen.
//
// Asking the browser is asynchronous (enumerateDevices) and an autocomplete menu is
// not, so the list is kept here and read synchronously. It is refreshed whenever
// audioin() runs and whenever a device is plugged in or out, which covers the two
// moments it can change. No imports: the editor reads this, and it should not drag
// the audio engine in with it.
//
// Labels only exist once the page has permission to use an input. Before that the
// browser lists the devices with empty names, which is still worth knowing — the
// menu can say how many there are and how to reveal them.

let _list = [];            // [{ id, label }] in the browser's order — audioin(n) indexes this
let _named = false;        // whether the labels are real (permission granted)
let _watching = false;

export function audioInputs() { return { list: _list, named: _named }; }

/** Re-read the device list. Resolves to it; never throws. */
export async function refreshAudioInputs() {
    try {
        const all = await navigator.mediaDevices.enumerateDevices();
        const ins = all.filter(d => d.kind === 'audioinput');
        _named = ins.some(d => d.label);
        _list = ins.map((d, i) => ({ id: d.deviceId, label: d.label || `input ${i + 1}` }));
    } catch (_) { /* no mediaDevices (http, old browser): keep what we had */ }
    if (!_watching && typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
        _watching = true;
        navigator.mediaDevices.addEventListener('devicechange', () => { refreshAudioInputs(); });
    }
    return _list;
}
