// Editor tabs — a blank canvas one click away from your set.
//
// Tab 1 is the SET: the buffer examples load into, the one ⤴ share encodes, the one
// "go live" seeds a room with, and — in a session — the one your peers are typing in.
// Every other tab is a local SCRATCH buffer: somewhere to draft a line, sketch a
// synth, or work an idea up from nothing without disturbing the set (or, in a jam,
// without the room watching you flail).
//
// Scratch buffers are yours alone. They are never shared, never seeded, never sent
// in a share link — they just persist in localStorage so they survive a refresh.
// The audio engine is not per-buffer, though: a player you start from a scratch tab
// keeps playing while you switch back to the set, which is the point — you audition
// there and paste the line over once it works.
//
// One CodeMirror instance, several Docs (editor.swapDoc). That is the whole trick,
// and it is why everything already wired to the editor — Ctrl+Enter, the live
// gutter, autocomplete, the drag-a-number knobs, the var needles, the tour — keeps
// working on whichever buffer is showing, with no second copy of any of it.

const STORE = 'wfd-tabs';
const MAX   = 9;            // Alt+1..9 addresses them all

/**
 * @param {object}   editor     CodeMirror instance (its current doc becomes tab 1)
 * @param {Element}  mount      the empty #editor-tabs strip to draw into
 * @param {boolean}  inSession  true in a multiplayer room — see restore()
 * @param {function} onSwitch   (isMain, name) after every switch
 * @param {function} onDetach   (name, doc) → host this buffer somewhere else.
 *                              Returning false declines and the tab stays put.
 * @param {function} canDetach  is there anywhere to detach TO right now? Checked at
 *                              render time, because desktop mode comes up after this
 *                              does — and a button that silently does nothing is
 *                              worse than no button.
 */
export function initTabs({ editor, mount, inSession = false, onSwitch = () => {},
                           onDetach = null, canDetach = () => false } = {}) {
    const tabs = [{ name: 'set', doc: editor.getDoc(), main: true }];
    let active = 0;

    // ── persistence ─────────────────────────────────────────────────────────
    // Scratch buffers only: the set has its own autosave, and in a session it
    // lives in the shared Yjs doc.
    let saveTimer = null;
    function save() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            try {
                localStorage.setItem(STORE, JSON.stringify({
                    active,
                    scratch: tabs.slice(1).map(t => ({ name: t.name, text: t.doc.getValue() })),
                }));
            } catch (_) {}
        }, 400);
    }

    function restore() {
        let st = null;
        try { st = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (_) {}
        if (!st || !Array.isArray(st.scratch)) return;
        for (const s of st.scratch.slice(0, MAX - 1)) add(s.name, s.text, false);
        // Come back to the buffer you left — but never into a scratch tab in a
        // session: joining a room has to put the room's code in front of you.
        if (!inSession && st.active > 0 && st.active < tabs.length) go(st.active);
    }

    // ── buffers ─────────────────────────────────────────────────────────────
    function add(name, text = '', focus = true) {
        if (tabs.length >= MAX) return null;
        const doc = new CodeMirror.Doc(text, 'foxdot');
        const tab = { name: (name || '').trim() || nextName(), doc, main: false };
        tabs.push(tab);
        doc.on('change', save);
        if (focus) go(tabs.length - 1); else render();
        save();
        return tab;
    }

    function nextName() {
        for (let n = 1; n <= MAX; n++) {
            const name = n === 1 ? 'scratch' : `scratch ${n}`;
            if (!tabs.some(t => t.name === name)) return name;
        }
        return 'scratch';
    }

    // ── detach / re-attach ──────────────────────────────────────────────────
    // Hand a buffer to whoever can host it (the desktop opens a panel with its own
    // editor). The doc has to be OFF this editor first — CodeMirror refuses to put
    // one document in two editors — so switch away before letting go of it.
    function detach(i) {
        const t = tabs[i];
        if (!t || t.main || !onDetach) return;
        if (active === i) go(0);
        tabs.splice(i, 1);
        if (active > i) active--;
        render();
        if (onDetach(t.name, t.doc) === false) { tabs.splice(i, 0, t); render(); return; }
        save();
    }

    // Take a detached buffer back into the strip.
    function reattach(name, doc) {
        if (tabs.length >= MAX) return false;
        const tab = { name: name || nextName(), doc, main: false };
        tabs.push(tab);
        doc.on('change', save);
        go(tabs.length - 1);
        save();
        return true;
    }

    function close(i) {
        if (i <= 0 || i >= tabs.length) return;          // the set is never closeable
        tabs.splice(i, 1);
        if (active >= tabs.length) active = tabs.length - 1;
        else if (active > i) active--;
        go(active);                                       // re-attach, redraw, notify
        save();
    }

    function go(i) {
        const t = tabs[i];
        if (!t) return;
        active = i;
        editor.swapDoc(t.doc);
        // swapDoc does not fire "changes", and the var-needle overlay is rebuilt from
        // that (and from "refresh"), so ask for the refresh explicitly or the needles
        // stay pinned to the buffer you just left.
        editor.refresh();
        editor.focus();
        render();
        onSwitch(t.main, t.name);
    }

    // Rename in place. A browser prompt() is an unstyled modal that stops the world
    // to ask one question — for renaming a tab you are already pointing at, the tab
    // itself is the right field.
    function rename(i, labelEl) {
        const t = tabs[i];
        if (!t || t.main || !labelEl || labelEl.querySelector('input')) return;
        const input = document.createElement('input');
        input.className = 'ed-tab-rename';
        input.value = t.name;
        input.spellcheck = false;
        input.size = Math.max(4, t.name.length + 1);
        labelEl.textContent = '';
        labelEl.appendChild(input);
        input.focus();
        input.select();

        let done = false;
        const finish = (commit) => {
            if (done) return;
            done = true;
            if (commit) {
                const v = input.value.trim().slice(0, 24);
                if (v) t.name = v;
            }
            render();
            save();
        };
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();                      // never reaches the editor keymap
            if (e.key === 'Enter')  { e.preventDefault(); finish(true); }
            if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        });
        // Grow with the text rather than clipping a longer name as you type it.
        input.addEventListener('input', () => { input.size = Math.max(4, input.value.length + 1); });
        input.addEventListener('blur', () => finish(true));
        // Clicks inside the field must not switch or drag the tab underneath.
        for (const t2 of ['click', 'pointerdown', 'dblclick'])
            input.addEventListener(t2, (e) => e.stopPropagation());
    }

    // ── strip ───────────────────────────────────────────────────────────────
    function render() {
        mount.textContent = '';
        tabs.forEach((t, i) => {
            const el = document.createElement('div');
            el.className = 'ed-tab' + (i === active ? ' active' : '') + (t.main ? ' is-main' : '');
            el.title = t.main
                ? 'your set — the buffer examples load into, ⤴ share encodes, and a session shares'
                : `scratch buffer (Alt+${i + 1}) — local to you · double-click to rename`;
            const label = document.createElement('span');
            label.className = 'ed-tab-name';
            label.textContent = t.name;
            el.appendChild(label);
            if (!t.main && canDetach()) {
                const dt = document.createElement('button');
                dt.className = 'ed-tab-detach';
                dt.textContent = '\u29c9';
                dt.title = 'detach — give this buffer its own panel, so you can see it next to the set';
                dt.onclick = (e) => { e.stopPropagation(); detach(i); };
                el.appendChild(dt);
            }
            if (!t.main) {
                const x = document.createElement('button');
                x.className = 'ed-tab-close';
                x.textContent = '×';
                x.title = 'close this buffer — its text is discarded';
                x.onclick = (e) => { e.stopPropagation(); close(i); };
                el.appendChild(x);
                el.ondblclick = () => rename(i, label);
            }
            el.onclick = () => go(i);
            mount.appendChild(el);
        });
        const plus = document.createElement('button');
        plus.className = 'ed-tab-add';
        plus.textContent = '+';
        plus.title = 'new scratch buffer (Ctrl+Alt+N) — a blank canvas, local to you';
        plus.disabled = tabs.length >= MAX;
        plus.onclick = () => add();
        mount.appendChild(plus);
    }

    // The strip is chrome, never draggable content. Without this, dragging a tab
    // starts a native text drag of its LABEL — and dropping that on an editor makes
    // CodeMirror insert it, which is where stray "set", "scratch", ⧉, × and + were
    // turning up in buffers.
    mount.addEventListener('dragstart', (e) => e.preventDefault());

    // ── keys ────────────────────────────────────────────────────────────────
    // Bound on the EDITOR, not the window: the panels float over the code and a
    // window-level Alt+2 would fire while you were typing in the chat box.
    const keys = { 'Ctrl-Alt-N': () => add() };
    for (let n = 1; n <= MAX; n++) keys[`Alt-${n}`] = () => go(n - 1);
    editor.addKeyMap(keys);

    render();
    restore();

    return {
        isMain:  () => !!tabs[active]?.main,
        // Bring a specific CodeMirror doc on screen — used to follow a running
        // arrangement back to the buffer it was launched from.
        goToDoc: (doc) => { const i = tabs.findIndex(t => t.doc === doc); if (i >= 0 && i !== active) go(i); },
        name:    () => tabs[active]?.name,
        count:   () => tabs.length,
        newTab:  (name, text) => add(name, text),
        // Every buffer in the strip, for anything that needs to offer them as a
        // destination (the piano's "to" picker).
        list:    () => tabs.map((t, i) => ({ name: t.name, doc: t.doc, main: !!t.main, active: i === active })),
        // Desktop mode comes up after the strip is built, so it asks for a redraw
        // once there is somewhere to detach TO.
        refresh: () => render(),
        reattach,
        go,
    };
}
