// setfile.js — open and save a set as an ordinary file.
//
// A set lived in localStorage and in a #c= URL hash, and nowhere else. share.js says
// what is wrong with the hash in its own header: "a big #@ track makes a long URL
// that some chat apps truncate". And localStorage is this browser, this profile, this
// machine — a set cannot be put in a folder with the rest of your work, cannot go in
// a repo, cannot be mailed to anyone.
//
// Which in practice meant that tracks written as .py files on disk — where people
// actually keep them — got into crashDot by being pasted in by hand.
//
// Two ways in, because one of them is not always available:
//   · showOpenFilePicker / showSaveFilePicker where the browser has them (Chromium),
//     which remembers the handle, so Save after Open writes back to the same file
//   · a hidden <input type=file> and a download link everywhere else
// Plus drag-and-drop onto the editor, which is how most people will actually do it.
//
// .py is the default extension because that is what FoxDot sets have always been
// called and what is already sitting in people's folders. The content is crashDot's
// own dialect either way; the extension is about what opens it in an editor.

import { snapshotWorkspace, encodeWorkspace, decodeWorkspace, restoreWorkspace } from './workspace.js';

const EXT = '.py';
const TYPES = [{ description: 'crashDot set', accept: { 'text/plain': ['.py', '.txt', '.fd'] } }];

let _get = null, _set = null, _log = null, _name = null, _ws = null;
let _handle = null;        // the file this buffer came from, where the browser keeps one

/**
 * @param {object} api  get() -> the buffer's text · set(text, name) -> replace it
 *                      name() -> a suggested filename · log(msg, kind)
 *                      workspace -> the hooks workspace.js needs, or null to save
 *                      the set text alone
 */
export function initSetFile({ get, set, name, log, workspace } = {}) {
    _get = get; _set = set; _name = name; _log = log || (() => {}); _ws = workspace || null;
}

// The set, plus everything around it. Built here rather than in saveSet so both the
// picker path and the download path write the same bytes — they had drifted before.
function fileBody() {
    const text = _get ? _get() : '';
    if (!_ws) return text;
    try { return text.replace(/\s+$/, '') + encodeWorkspace(snapshotWorkspace(_ws)); }
    catch (_) { return text; }     // never let the extras cost you the set
}

const hasPicker = () => typeof window.showSaveFilePicker === 'function';
const suggested = () => {
    const n = (_name && _name()) || 'set';
    return String(n).replace(/[^\w.-]+/g, '_').replace(/\.(py|txt|fd)$/i, '') + EXT;
};

/** Save. Writes back to the opened file when the browser lets us hold on to it. */
export async function saveSet({ saveAs = false } = {}) {
    const bare = _get ? _get() : '';
    if (!bare.trim()) { _log('nothing to save — the buffer is empty', 'warn'); return false; }
    const text = fileBody();
    if (hasPicker()) {
        try {
            if (saveAs || !_handle) _handle = await window.showSaveFilePicker({ suggestedName: suggested(), types: TYPES });
            const w = await _handle.createWritable();
            await w.write(text); await w.close();
            _log(`saved — ${_handle.name}`, 'ok');
            return true;
        } catch (e) {
            // A dismissed picker is not an error: the answer was "actually, no".
            if (e && e.name === 'AbortError') return false;
            _log(`save failed — ${e.message}`, 'warn');
            return false;
        }
    }
    // Everywhere else: hand the browser a download.
    const a = document.createElement('a');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.href = url; a.download = suggested();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    _log(`saved — ${a.download}`, 'ok');
    return true;
}

/** Open a file into the buffer. */
export async function openSet() {
    if (hasPicker()) {
        try {
            const [h] = await window.showOpenFilePicker({ types: TYPES, multiple: false });
            const f = await h.getFile();
            _handle = h;                       // Save now writes back here
            applyFile(f.name, await f.text());
            return true;
        } catch (e) {
            if (e && e.name === 'AbortError') return false;
            _log(`open failed — ${e.message}`, 'warn');
            return false;
        }
    }
    return new Promise((resolve) => {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = '.py,.txt,.fd,text/plain'; inp.hidden = true;
        inp.onchange = async () => {
            const f = inp.files && inp.files[0];
            inp.remove();
            if (!f) return resolve(false);
            applyFile(f.name, await f.text());
            resolve(true);
        };
        document.body.appendChild(inp);
        inp.click();
    });
}

function applyFile(filename, raw) {
    if (!_set) return;
    const { text, state } = decodeWorkspace(raw);
    // Into a NEW buffer rather than over the one on screen. Opening a file should
    // never be the thing that loses what you were working on, and the tab strip is
    // where a second set belongs anyway.
    _set(text, String(filename).replace(/\.(py|txt|fd)$/i, ''));
    _log(`opened — ${filename} (${text.split('\n').length} lines)`, 'ok');

    if (!state || !_ws) return;
    // A workspace is a bigger thing than a file: restoring it replaces your pads and
    // moves your panels. That is what it is FOR, and it is also not something to do
    // to someone who only wanted to read a set — so it is asked, once, plainly.
    const pads = Array.isArray(state.pads) ? state.pads.length : 0;
    const keys = state.storage ? Object.keys(state.storage).length : 0;
    _log(`${filename} carries a workspace — ${pads} pad${pads === 1 ? '' : 's'} and ${keys} settings`, 'info');
    const ok = window.confirm(
        `"${filename}" was saved with its whole workspace:\n\n` +
        `  · ${pads} pad${pads === 1 ? '' : 's'} (the set and any scratch buffers)\n` +
        `  · ${keys} settings — panel layouts, theme, kit, seed, UI size\n\n` +
        `Restore it? This REPLACES the pads you have open now.\n` +
        `Cancel keeps just the set you have already got.`);
    if (!ok) { _log('workspace not restored — you have the set only', 'info'); return; }

    const r = restoreWorkspace(state, _ws);
    _log(`workspace restored — ${r.live.join(', ') || 'nothing live'}`
        + (r.onReload.length ? ` · ${r.onReload.join(', ')} on next load` : ''), 'ok');
}

/**
 * Dropping a file on the editor opens it. This is how most people will do it, and it
 * is the one path that needs no picker, no permission and no menu.
 */
export function enableDropOpen(el) {
    if (!el) return;
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    el.addEventListener('dragover', (e) => {
        if (!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
        stop(e); e.dataTransfer.dropEffect = 'copy'; el.classList.add('wfd-drop');
    });
    el.addEventListener('dragleave', () => el.classList.remove('wfd-drop'));
    el.addEventListener('drop', async (e) => {
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (!f) return;
        stop(e); el.classList.remove('wfd-drop');
        // A .json here is a modular patch, not a set — say so rather than paste
        // a wall of JSON into the buffer.
        if (/\.json$/i.test(f.name)) { _log(`${f.name} looks like a modular patch — load it from the modular panel`, 'warn'); return; }
        applyFile(f.name, await f.text());
    });
}
