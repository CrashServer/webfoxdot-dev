// Section sequencer — handles #@ section headers for live-set arrangement.
// #@name(beats)            — run code, then advance to the next section
// #@goto(target, prob)     — zero-duration router: `prob` chance (default 0.5)
//                            to jump to `target`, else fall through to the next
//                            section. Chain several for a probabilistic set.
// #@loop(beats, a:2, b:1)  — loop this section, or weighted-jump among targets
// #@end(beats) / #@clear   — stop all after beats / immediately
// #@#@ track-name          — fold marker only, no execution
//
// Note: jump targets are resolved by name to the FIRST matching section, so
// keep part names unique.

let _clock  = null;
let _evalFn = null;
let _editor = null;
// The buffer the running arrangement lives in. Editor tabs (js/ui/tabs.js) can put
// a scratch buffer on screen while a #@ set is autoplaying, and the advance has to
// keep reading the buffer it was LAUNCHED from — a line handle still resolves to the
// right number in its own document, but findAllSections() would go looking for the
// next #@ in whatever happens to be showing. So runSection pins the doc for the whole
// chain, and every line read goes through _doc(). Only jumpToActive's viewport calls,
// which are about what you are LOOKING at, stay on the editor.
let _arrDoc = null;
const _doc = () => _arrDoc || (_editor ? _editor.getDoc() : null);
let _onChange = null;      // fired when the active section / autoplay state changes (local UI)
let _onActive = null;      // fired when active section / autoplay changes (for multiplayer broadcast)

// Symbol used as a sequence ID to prevent stale callbacks from firing.
let _sequenceId = Symbol();

// Currently-running section line, and whether an auto-advance is pending.
let _activeLine = -1;
let _autoplay   = false;

// Active section's progress window — start beat + length, for the panel squares.
let _activeStart = 0;
let _activeBeats = null;

// ── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parse a #@ line.
 * Returns one of:
 *   { track: name }                          for #@#@ lines
 *   { name, beats, type, targets }           for #@name(...) lines
 *   null                                     if not a #@ line
 *
 * targets = [{ name, weight }, ...]   parsed from "a:2, b:1" style args
 * type    = 'end' | 'loop' | 'clear' | 'section' (default)
 * beats   = number or null
 */
function parseSectionTag(lineText) {
    const trimmed = lineText.trim();

    if (!trimmed.startsWith('#@')) return null;

    // #@#@ track-name
    if (trimmed.startsWith('#@#@')) {
        const rest = trimmed.slice(4).trim();
        return { track: rest };
    }

    // #@name  or  #@name(...)
    const rest = trimmed.slice(2).trim(); // strip the leading #@
    if (!rest) return null;

    const parenIdx = rest.indexOf('(');

    let name;
    let argStr = '';
    if (parenIdx === -1) {
        name = rest.trim();
    } else {
        name = rest.slice(0, parenIdx).trim();
        const closeIdx = rest.lastIndexOf(')');
        argStr = closeIdx > parenIdx ? rest.slice(parenIdx + 1, closeIdx) : rest.slice(parenIdx + 1);
    }

    if (!name) return null;

    // Determine type from the name itself
    let type = 'section';
    const lname = name.toLowerCase();
    if (lname === 'end' || lname === 'endfade') type = 'end';
    else if (lname === 'loop') type = 'loop';
    else if (lname === 'clear') type = 'clear';
    else if (lname === 'goto') type = 'goto';

    // #@goto(target, prob) — a zero-duration routing node. `prob` chance (default
    // 0.5) to jump to `target`, otherwise fall through to the next section.
    if (type === 'goto') {
        const parts = argStr.split(',').map(s => s.trim()).filter(Boolean);
        const gotoTarget = parts[0] || null;
        const gotoProb   = parts[1] != null && !isNaN(parseFloat(parts[1])) ? parseFloat(parts[1]) : 0.5;
        return { name, type, gotoTarget, gotoProb, beats: 0, targets: [] };
    }

    // Parse argStr: first token may be a bare number (beats), rest are name:weight pairs
    let beats = null;
    const targets = [];

    if (argStr.trim()) {
        const parts = argStr.split(',').map(s => s.trim()).filter(Boolean);
        for (const part of parts) {
            const colonIdx = part.indexOf(':');
            if (colonIdx !== -1) {
                const tname   = part.slice(0, colonIdx).trim();
                const tweight = parseFloat(part.slice(colonIdx + 1).trim());
                if (tname) {
                    targets.push({ name: tname, weight: isNaN(tweight) ? 1 : tweight });
                }
            } else {
                const n = parseFloat(part);
                if (!isNaN(n) && beats === null) {
                    beats = n;
                }
            }
        }
    }

    return { name, beats, type, targets };
}

// ── Init ─────────────────────────────────────────────────────────────────────

function initSections(clock, evalFn, cmEditor, onChange, onActive) {
    _clock    = clock;
    _evalFn   = evalFn;
    _editor   = cmEditor;
    _onChange = onChange || null;
    _onActive = onActive || null;
}

// Notify listeners (multiplayer) of the current active section + autoplay state.
function notifyActive() { if (_onActive) _onActive(_activeLine, _autoplay); }

// Set autoplay and notify, in one place so every change propagates. Refresh the
// local UI (panel + stop button) too — setActive may have rendered before this
// flips, which would leave the "stop autoplay" button stuck greyed-out.
function setAutoplay(v) { _autoplay = v; if (_onChange) _onChange(); notifyActive(); }

// ── Active-section marking ─────────────────────────────────────────────────────

// Mark `line` as the active section (persistent highlight + a brief blink).
function setActive(line) {
    if (_doc() && _activeLine >= 0 && _activeLine < _doc().lineCount()) {
        try { _doc().removeLineClass(_activeLine, 'background', 'section-active'); } catch (_) {}
    }
    _activeLine = line;
    if (line >= 0) {
        try {
            _doc().addLineClass(line, 'background', 'section-active');
            _doc().addLineClass(line, 'background', 'section-blink');
            setTimeout(() => { try { _doc().removeLineClass(line, 'background', 'section-blink'); } catch (_) {} }, 650);
        } catch (_) {}
    }
    if (_onChange) _onChange();
    notifyActive();
}

// Apply a section-active state received from a peer — highlight + panel only.
// The section's CODE arrives separately via the eval broadcast, so this never
// re-evaluates or schedules; it just mirrors the driver's visual state.
function applyRemoteSection(line, autoplay) {
    _autoplay = !!autoplay;
    // Approximate the progress window so peers animate too (start = now of receipt).
    const parsed = line >= 0 && _doc() ? parseSectionTag(_doc().getLine(line)) : null;
    _activeBeats = parsed?.beats ?? null;
    _activeStart = _clock ? _clock.now() : 0;
    setActive(line);
}

// The buffer the running arrangement was launched from (null when none is running),
// so the UI can bring it back on screen before jumping to the active part.
function activeSectionDoc() { return _arrDoc; }

// Progress info for the active section's panel squares: { line, start, beats }.
function getActiveInfo() { return { line: _activeLine, start: _activeStart, beats: _activeBeats }; }

// All #@ sections + #@#@ tracks, in document order, with active flag.
function getSections() {
    if (!_doc()) return [];
    const out = [];
    for (let i = 0; i < _doc().lineCount(); i++) {
        const t = parseSectionTag(_doc().getLine(i));
        if (!t) continue;
        if (t.track !== undefined) out.push({ line: i, track: t.track });
        else out.push({ line: i, name: t.name, beats: t.beats, type: t.type, active: i === _activeLine });
    }
    return out;
}

function isAutoplaying() { return _autoplay; }

// Move the cursor to the active section and reveal it.
function jumpToActive() {
    if (!_editor || _activeLine < 0) return false;
    _doc().setCursor({ line: _activeLine, ch: 0 });
    _editor.scrollIntoView({ line: _activeLine, ch: 0 }, 120);
    _editor.focus();
    return true;
}

// ── Section code extraction ───────────────────────────────────────────────────

/**
 * Read lines from sectionLine+1 until the next #@ line or EOF.
 * Returns the raw code string (without the header line itself).
 */
function getSectionCode(sectionLine) {
    const lineCount = _doc().lineCount();
    const lines = [];
    for (let i = sectionLine + 1; i < lineCount; i++) {
        const line = _doc().getLine(i);
        if (line.trimStart().startsWith('#@')) break;
        lines.push(line);
    }
    return lines.join('\n');
}

// ── Player-stop transform ─────────────────────────────────────────────────────

/**
 * Lines matching `# playerName >> ...` (at the start, possibly indented) become
 * `__p('playerName').stop()`. The rest of the line (the commented-out synth call)
 * is consumed — otherwise it would be left dangling after .stop() and break eval.
 */
function applyPlayerStop(code) {
    return code.replace(
        /^(\s*)#\s*([a-zA-Z]\w*)\s*>>.*$/gm,
        (_match, indent, playerName) => `${indent}__p('${playerName}').stop()`
    );
}

// ── Section discovery ─────────────────────────────────────────────────────────

/**
 * Returns all #@ sections (not #@#@) from the editor.
 * Each entry: { line, name, beats, type, targets }
 */
function findAllSections() {
    if (!_doc()) return [];
    const lineCount = _doc().lineCount();
    const sections = [];
    for (let i = 0; i < lineCount; i++) {
        const parsed = parseSectionTag(_doc().getLine(i));
        if (parsed && !parsed.track) {
            sections.push({ line: i, ...parsed });
        }
    }
    return sections;
}

// ── Section lookup by name ────────────────────────────────────────────────────

function findSectionByName(name) {
    const sections = findAllSections();
    return sections.find(s => s.name === name) ?? null;
}

// ── Cancel ───────────────────────────────────────────────────────────────────

/**
 * Cancel any pending auto-advance by rotating the sequence symbol.
 * The active section keeps playing — this only stops the autoplay chain.
 */
function cancelSection() {
    _sequenceId = Symbol();
    _arrDoc = null;              // no chain running → follow whatever buffer is showing
    setAutoplay(false);
    if (_onChange) _onChange();
}

// ── Run ───────────────────────────────────────────────────────────────────────

/**
 * Main entry point.
 * - Cancels any pending sequence
 * - Reads + transforms code under the header
 * - Evals it via _evalFn
 * - Schedules next section if beats is set
 *
 * Returns false if the line is a #@#@ track header or not a #@ line.
 *
 * Called from the editor, so this is where the arrangement's buffer gets pinned —
 * the auto-advance (_runSection) then keeps reading it whichever tab you switch to.
 */
function runSection(sectionLine) {
    _arrDoc = _editor ? _editor.getDoc() : null;
    return _runSection(sectionLine);
}

function _runSection(sectionLine) {
    if (!_clock || !_evalFn || !_doc()) return false;

    const chainDoc = _doc();   // cancelSection() below drops the pin — this restores it
    const lineText = _doc().getLine(sectionLine);
    if (!lineText) return false;

    const parsed = parseSectionTag(lineText);
    if (!parsed) return false;
    if (parsed.track !== undefined) return false; // #@#@ header — do nothing

    const { name, beats, type, targets } = parsed;

    // Cancel stale sequences
    cancelSection();
    _arrDoc = chainDoc;        // …the chain carries on in the buffer it started in
    const myId = _sequenceId;

    if (type === 'clear') {
        // Immediate stop
        _evalFn('__stopAll()');
        setActive(-1);
        return true;
    }

    if (type === 'goto') {
        // Zero-duration probabilistic router: no code, no highlight. Roll the
        // dice — jump to the target part, or fall through to the next section.
        const target = parsed.gotoTarget ? findSectionByName(parsed.gotoTarget) : null;
        if (target && Math.random() < parsed.gotoProb) _runSection(target.line);
        else advanceToNext(sectionLine);
        return true;
    }

    if (type === 'end') {
        // Terminal control node: stop everything after `beats` (or immediately if
        // none), then halt the sequence. It has NO playable body — the lines below
        // it belong to whatever follows in the document (e.g. a tutorial footer),
        // so they must never be auto-evaluated.
        const stopAll = () => {
            if (_sequenceId !== myId) return;
            _evalFn('__stopAll()');
            setActive(-1);
            setAutoplay(false);
            if (_onChange) _onChange();
        };
        if (beats) {
            setActive(sectionLine);
            _activeStart = _clock.now();
            _activeBeats = beats;
            setAutoplay(true);
            _clock._schedule(_clock.now() + beats, stopAll);
        } else {
            stopAll();
        }
        return true;
    }

    // Mark this as the active section (highlight + blink in the editor)
    setActive(sectionLine);

    // Track this section across edits: a line handle survives inserts/deletes
    // above it, so a scheduled advance still finds the right section if the
    // buffer is edited while autoplay runs.
    const lineHandle = _doc().getLineHandle ? _doc().getLineHandle(sectionLine) : null;

    // Get and transform the code body
    const rawCode  = getSectionCode(sectionLine);
    const stoppedCode = applyPlayerStop(rawCode);

    // Eval the transformed code
    if (stoppedCode.trim()) {
        _evalFn(stoppedCode);
    }

    if (!beats) { _activeBeats = null; setAutoplay(false); if (_onChange) _onChange(); return true; } // no auto-advance
    // Open the progress window for the panel squares
    _activeStart = _clock.now();
    _activeBeats = beats;
    setAutoplay(true);

    const targetBeat = _clock.now() + beats;

    if (type === 'loop') {
        // After beats: weighted-jump to a target, or loop this section if none.
        _clock._schedule(targetBeat, () => {
            if (_sequenceId !== myId) return;
            if (targets.length === 0) { _runSection(liveLine(lineHandle, sectionLine)); return; }
            jumpToTarget(targets);
        });
        return true;
    }

    // Default section type: after beats, advance to the next section in the document.
    // (Probabilistic routing is done with explicit #@goto nodes, not inline args.)
    _clock._schedule(targetBeat, () => {
        if (_sequenceId !== myId) return;
        advanceToNext(liveLine(lineHandle, sectionLine));
    });

    return true;
}

// Resolve a line handle to its current line number (tracks edits); -1 if removed.
function liveLine(handle, fallback) {
    if (!handle) return fallback;
    const n = _doc().getLineNumber(handle);
    return n == null ? -1 : n;
}

// Advance to the next #@ section after `sectionLine` in document order.
function advanceToNext(sectionLine) {
    const sections = findAllSections();
    const idx = sections.findIndex(s => s.line === sectionLine);
    if (idx !== -1 && idx + 1 < sections.length) _runSection(sections[idx + 1].line);
}

// Weighted-random pick from [{name, weight}] and run that section.
function jumpToTarget(targets) {
    const totalWeight = targets.reduce((acc, t) => acc + t.weight, 0);
    let r = Math.random() * totalWeight;
    let chosen = targets[targets.length - 1];
    for (const t of targets) {
        r -= t.weight;
        if (r <= 0) { chosen = t; break; }
    }
    const target = findSectionByName(chosen.name);
    if (target) _runSection(target.line);
}

// ── Exports ───────────────────────────────────────────────────────────────────

export { initSections, runSection, cancelSection, parseSectionTag,
         getSections, jumpToActive, isAutoplaying, applyRemoteSection, getActiveInfo,
         activeSectionDoc };
