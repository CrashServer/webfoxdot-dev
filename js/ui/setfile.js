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

const EXT = '.py';
const TYPES = [{ description: 'crashDot set', accept: { 'text/plain': ['.py', '.txt', '.fd'] } }];

let _get = null, _set = null, _log = null, _name = null;
let _handle = null;        // the file this buffer came from, where the browser keeps one

/**
 * @param {object} api  get() -> the buffer's text · set(text, name) -> replace it
 *                      name() -> a suggested filename · log(msg, kind)
 */
export function initSetFile({ get, set, name, log } = {}) {
    _get = get; _set = set; _name = name; _log = log || (() => {});
}

const hasPicker = () => typeof window.showSaveFilePicker === 'function';
const suggested = () => {
    const n = (_name && _name()) || 'set';
    return String(n).replace(/[^\w.-]+/g, '_').replace(/\.(py|txt|fd)$/i, '') + EXT;
};

/** Save. Writes back to the opened file when the browser lets us hold on to it. */
export async function saveSet({ saveAs = false } = {}) {
    const text = _get ? _get() : '';
    if (!text.trim()) { _log('nothing to save — the buffer is empty', 'warn'); return false; }
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

function applyFile(filename, text) {
    if (!_set) return;
    // Into a NEW buffer rather than over the one on screen. Opening a file should
    // never be the thing that loses what you were working on, and the tab strip is
    // where a second set belongs anyway.
    _set(text, String(filename).replace(/\.(py|txt|fd)$/i, ''));
    _log(`opened — ${filename} (${text.split('\n').length} lines)`, 'ok');
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
