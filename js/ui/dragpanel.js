// dragpanel.js — make a floating panel draggable by its header.
//
// Five panels (mixer, modular, parts, piano, rules) each carried their own copy of
// this, identical apart from the variable holding the element and which child
// elements should be left alone for clicking. Each copy also registered its own
// permanent pointermove/pointerup pair on window, so every mouse movement anywhere
// in the app woke five handlers to ask whether their own panel was being dragged.
//
// One implementation, and ONE pair of window listeners for all of them: only one
// panel can be under the pointer at a time, so a single `active` is all the state
// there is. The listeners are attached on the first drag rather than at import, so
// a session that never drags a panel never pays for them at all.

let active = null;     // { el, ox, oy, sx, sy } — the panel currently being dragged
let wired  = false;

function onMove(e) {
    if (!active) return;
    active.el.style.left = Math.max(0, active.ox + e.clientX - active.sx) + 'px';
    active.el.style.top  = Math.max(0, active.oy + e.clientY - active.sy) + 'px';
}
function onUp() { active = null; }

/**
 * @param {HTMLElement} handle  the header to drag by
 * @param {HTMLElement} el      the panel to move (defaults to the handle's parent)
 * @param {string} ignore       selector for children that should CLICK, not drag —
 *                              the head's own buttons, inputs and selects
 */
export function draggable(handle, el = handle?.parentElement, ignore = 'button, input, select') {
    if (!handle || !el) return;
    handle.addEventListener('pointerdown', (e) => {
        if (ignore && e.target.closest(ignore)) return;
        const r = el.getBoundingClientRect();
        active = { el, ox: r.left, oy: r.top, sx: e.clientX, sy: e.clientY };
        // Pin it to where it currently IS before switching to left/top positioning:
        // a panel laid out from the right or bottom would otherwise jump on grab.
        el.style.left = r.left + 'px'; el.style.top = r.top + 'px';
        el.style.right = 'auto'; el.style.bottom = 'auto';
        e.preventDefault();
        if (!wired) {
            wired = true;
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        }
    });
}
