// A snapshot undo stack.
//
// Whole-state snapshots rather than a command log with an inverse per command.
// For a graph of tens of nodes the memory is nothing, and it cannot drift out
// of step with the model the way a dozen hand-written inverses eventually do —
// every new mutation would otherwise need its own undo, and the one you forget
// is the one that corrupts the history.
//
//   capture()      → a serialisable snapshot of the current state
//   restore(snap)  → put that snapshot back
//
// Both are supplied by the owner, so this file knows nothing about graphs.

export function makeUndoStack({ capture, restore, max = 100, coalesceMs = 700, now = Date.now }) {
    let undoS = [], redoS = [], coalesce = null;

    return {
        /**
         * Record the state BEFORE a mutation — call it first, then mutate.
         *
         * `key` folds a run of related edits into ONE step. Dragging a knob
         * fires a change on every frame; without this a single sweep would take
         * two hundred presses to undo. The key identifies the gesture, so moving
         * to a different knob starts a new step even inside the time window.
         */
        snapshot(label, key) {
            const snap = capture();
            const t = now();
            if (key && coalesce && coalesce.key === key && t - coalesce.t < coalesceMs) {
                coalesce.t = t;          // still the same gesture — keep the earlier snapshot
                return false;
            }
            coalesce = key ? { key, t } : null;
            // An edit that changed nothing must not consume an undo press.
            if (undoS.length && undoS[undoS.length - 1].snap === snap) return false;
            undoS.push({ snap, label });
            if (undoS.length > max) undoS.shift();
            redoS.length = 0;            // a new edit forks the timeline
            return true;
        },

        /** Returns the label of the step taken, or null when there was none. */
        undo() { return step(undoS, redoS); },
        redo() { return step(redoS, undoS); },

        canUndo: () => undoS.length > 0,
        canRedo: () => redoS.length > 0,
        peekUndo: () => (undoS.length ? undoS[undoS.length - 1].label : null),
        peekRedo: () => (redoS.length ? redoS[redoS.length - 1].label : null),
        depth:    () => ({ undo: undoS.length, redo: redoS.length }),
        clear()   { undoS = []; redoS = []; coalesce = null; },
    };

    function step(from, to) {
        if (!from.length) return null;
        const entry = from.pop();
        // The state we are leaving goes on the other stack under the SAME label,
        // so "undo add Filter" and the redo that puts it back read alike.
        to.push({ snap: capture(), label: entry.label });
        restore(entry.snap);
        coalesce = null;   // never merge an edit made after an undo into one made before it
        return entry.label;
    }
}
