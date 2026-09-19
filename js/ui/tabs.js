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
    // Buffers that have been handed to a panel of their own. They are out of `tabs`
    // — that is what detaching means — but their TEXT is still yours, so it has to
    // keep being saved. It was not: detach() spliced the tab out and then saved the
    // strip, which by then no longer mentioned it, so a detached buffer's code lived
    // in memory and nowhere else and a refresh took it.
    const detached = [];        // [{ name, doc }]
    // Names restored from disk that were detached when they were saved. They come
    // back as ordinary tabs first, because the desktop that hosts them is not built
    // yet at this point; restoreDetached() sends them back out once it is.
    let pendingDetach = [];

    // ── persistence ─────────────────────────────────────────────────────────
    // Scratch buffers only: the set has its own autosave, and in a session it
    // lives in the shared Yjs doc.
    // Where you were in a buffer, not just what was in it. Coming back to a file
    // and being thrown to line 1 of a 300-line set is a small thing that happens
    // every single refresh.
    //
    // CodeMirror keeps scroll on the DOC for every buffer except the one on screen —
    // it only copies the live position back when you swap away — so the visible one
    // has to be read from the editor instead.
    function place(t) {
        const d = t.doc;
        const sc = (d === editor.getDoc()) ? editor.getScrollInfo() : { left: d.scrollLeft, top: d.scrollTop };
        const c = d.getCursor();
        return { line: c.line | 0, ch: c.ch | 0, sl: Math.round(sc.left || 0), st: Math.round(sc.top || 0) };
    }
    function applyPlace(doc, w) {
        if (!w) return;
        try {
            // Clamp: the text can be shorter than it was (a share link, an example),
            // and setCursor past the end throws rather than settling for the end.
            const last = doc.lineCount() - 1;
            const line = Math.max(0, Math.min(w.line | 0, last));
            doc.setCursor({ line, ch: Math.min(w.ch | 0, doc.getLine(line)?.length ?? 0) });
            doc.scrollLeft = w.sl | 0;
            doc.scrollTop  = w.st | 0;
            // The doc on screen is never swapped in, so nothing reads those two off
            // it — the editor has to be scrolled directly or the set alone comes
            // back at the top while every other buffer remembers its place.
            if (doc === editor.getDoc()) editor.scrollTo(w.sl | 0, w.st | 0);
        } catch (_) {}
    }

    let saveTimer = null;
    function save() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            try {
                localStorage.setItem(STORE, JSON.stringify({
                    active,
                    // The set's TEXT lives in wfd-buffer (index.html owns that), but
                    // its place belongs with the other buffers' — the strip is what
                    // knows about buffers.
                    setWhere: tabs[0] ? place(tabs[0]) : null,
                    scratch: tabs.slice(1).map(t => ({ name: t.name, text: t.doc.getValue(), where: place(t) })),
                    detached: detached.map(d => ({ name: d.name, text: d.doc.getValue(), where: place(d) })),
                }));
            } catch (_) {}
        }, 400);
    }

    // Moving the caret or scrolling is a change worth remembering too — without
    // these the place is only written when the TEXT changes, so reading through a
    // set and refreshing puts you back wherever you last typed.
    editor.on('cursorActivity', save);
    editor.on('scroll', save);

    function restore() {
        let st = null;
        try { st = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (_) {}
        if (!st || !Array.isArray(st.scratch)) return;
        for (const s of st.scratch.slice(0, MAX - 1)) {
            const t = add(s.name, s.text, false);
            if (t) applyPlace(t.doc, s.where);
        }
        for (const d of (Array.isArray(st.detached) ? st.detached : []).slice(0, MAX - 1)) {
            const t = add(d.name, d.text, false);
            if (t) { applyPlace(t.doc, d.where); pendingDetach.push(d.name); }
        }
        if (st.setWhere && tabs[0]) applyPlace(tabs[0].doc, st.setWhere);
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
        // Keep saving it. The doc already has a change listener from add(), so this
        // only has to remember that the buffer still exists.
        detached.push({ name: t.name, doc: t.doc });
        save();
    }

    // Take a detached buffer back into the strip.
    function reattach(name, doc) {
        if (tabs.length >= MAX) return false;
        const at = detached.findIndex(d => d.doc === doc);
        if (at >= 0) detached.splice(at, 1);
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
        // Close every scratch buffer, keeping the set. Restoring a saved workspace
        // has to start from a clean strip or the pads pile up on each open.
        closeScratch: () => {
            for (let i = tabs.length - 1; i >= 1; i--) tabs.splice(i, 1);
            active = 0;
            editor.swapDoc(tabs[0].doc);
            render(); save();
        },
        reattach,
        // Send the restored ones back to their panels. Called once the desktop is up,
        // because before that there is nowhere for them to go — and the panel they
        // land in remembers its own position by id, so they come back where they were.
        restoreDetached: () => {
            const names = pendingDetach; pendingDetach = [];
            let n = 0;
            for (const name of names) {
                const i = tabs.findIndex(t => t.name === name && !t.main);
                if (i > 0) { detach(i); n++; }
            }
            if (n) go(0);
            return n;
        },
        go,
    };
}
