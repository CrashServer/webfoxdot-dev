// ── Windows panel ────────────────────────────────────────────────────────────
//
// The list of every window on the canvas, with a chip per panel that shows
// whether it is open and toggles it.
//
// It exists because panels became CLOSABLE. A × with no way back is a trap door,
// and the obvious way back — a row of buttons in a fixed top bar — is exactly what
// this layout no longer has: the toolbar is a panel now too, and a panel can be
// closed, panned away from, or buried. So the reopen list is itself a panel, but
// the one panel with no × of its own (closable:false). Whatever else you put away,
// this is still here to bring it back.
//
// Two kinds of window are listed and they are toggled differently:
//
//   OWNED    panels the desktop built (editor, log, clock, screen, toolbar…) —
//            show/hide the panel directly; it keeps its DOM and its geometry.
//   HOSTED   modules that predate the canvas (mixer, docs, galaxy…). Each owns its
//            own open flag and its own toggle button, so we press THAT button
//            rather than hiding the panel behind the module's back — otherwise the
//            two disagree and the next click does nothing.

/**
 * @param {Element} container  the panel body to draw into
 * @param {Array}   entries    [{ id, title, isOpen(), toggle() }]
 */
export function buildWindowsPanel(container, entries) {
    const wrap = document.createElement('div');
    wrap.className = 'wfd-win-wrap';
    container.appendChild(wrap);

    const chips = new Map();

    function render() {
        for (const [id, btn] of chips) {
            const e = entries.find(x => x.id === id);
            btn.classList.toggle('on', !!e?.isOpen());
        }
    }

    for (const e of entries) {
        const btn = document.createElement('button');
        btn.className = 'wfd-win-chip';
        btn.textContent = e.title;
        btn.title = `show / hide the ${e.title} window`;
        btn.addEventListener('click', () => {
            e.toggle();
            // A hosted module flips its own flag asynchronously (its toggle may
            // build the thing on first press), so re-read rather than assume.
            setTimeout(render, 0);
            setTimeout(render, 120);
        });
        chips.set(e.id, btn);
        wrap.appendChild(btn);
    }

    // Anything can change a panel's state without going through a chip — the ×
    // in its own header, the module's own ✕, Escape, a recalled layout. Poll
    // rather than ask every one of those to report in: this is a dozen boolean
    // reads a second on a panel you are usually not even looking at.
    const timer = setInterval(render, 400);
    container.addEventListener('DOMNodeRemovedFromDocument', () => clearInterval(timer));
    render();
    return { render };
}
