// Section sequencer — handles #@ section headers for live-set arrangement.
// #@name(beats, target:weight, ...) — run section code then auto-advance
// #@#@ track-name — fold marker only, no execution

let _clock  = null;
let _evalFn = null;
let _editor = null;

// Symbol used as a sequence ID to prevent stale callbacks from firing.
let _sequenceId = Symbol();

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

function initSections(clock, evalFn, cmEditor) {
    _clock  = clock;
    _evalFn = evalFn;
    _editor = cmEditor;
}

// ── Section code extraction ───────────────────────────────────────────────────

/**
 * Read lines from sectionLine+1 until the next #@ line or EOF.
 * Returns the raw code string (without the header line itself).
 */
function getSectionCode(sectionLine) {
    const lineCount = _editor.lineCount();
    const lines = [];
    for (let i = sectionLine + 1; i < lineCount; i++) {
        const line = _editor.getLine(i);
        if (line.trimStart().startsWith('#@')) break;
        lines.push(line);
    }
    return lines.join('\n');
}

// ── Player-stop transform ─────────────────────────────────────────────────────

/**
 * Lines matching `# playerName >>` (at the start, possibly indented) become
 * `__p('playerName').stop()`.
 */
function applyPlayerStop(code) {
    return code.replace(
        /^(\s*)#\s*([a-zA-Z]\w*)\s*>>/gm,
        (_match, indent, playerName) => `${indent}__p('${playerName}').stop()`
    );
}

// ── Section discovery ─────────────────────────────────────────────────────────

/**
 * Returns all #@ sections (not #@#@) from the editor.
 * Each entry: { line, name, beats, type, targets }
 */
function findAllSections() {
    if (!_editor) return [];
    const lineCount = _editor.lineCount();
    const sections = [];
    for (let i = 0; i < lineCount; i++) {
        const parsed = parseSectionTag(_editor.getLine(i));
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
 */
function cancelSection() {
    _sequenceId = Symbol();
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
 */
function runSection(sectionLine) {
    if (!_clock || !_evalFn || !_editor) return false;

    const lineText = _editor.getLine(sectionLine);
    if (!lineText) return false;

    const parsed = parseSectionTag(lineText);
    if (!parsed) return false;
    if (parsed.track !== undefined) return false; // #@#@ header — do nothing

    const { name, beats, type, targets } = parsed;

    // Cancel stale sequences
    cancelSection();
    const myId = _sequenceId;

    if (type === 'clear') {
        // Immediate stop
        _evalFn('__stopAll()');
        return true;
    }

    // Get and transform the code body
    const rawCode  = getSectionCode(sectionLine);
    const stoppedCode = applyPlayerStop(rawCode);

    // Eval the transformed code
    if (stoppedCode.trim()) {
        _evalFn(stoppedCode);
    }

    if (!beats) return true; // no auto-advance

    const targetBeat = _clock.now() + beats;

    if (type === 'end') {
        // After beats, stop all players
        _clock._schedule(targetBeat, () => {
            if (_sequenceId !== myId) return; // stale
            _evalFn('__stopAll()');
        });
        return true;
    }

    if (type === 'loop') {
        // After beats, weighted-random pick from targets, then run that section
        if (targets.length === 0) {
            // No targets: just loop this section
            _clock._schedule(targetBeat, () => {
                if (_sequenceId !== myId) return;
                runSection(sectionLine);
            });
        } else {
            _clock._schedule(targetBeat, () => {
                if (_sequenceId !== myId) return;
                const totalWeight = targets.reduce((acc, t) => acc + t.weight, 0);
                let r = Math.random() * totalWeight;
                let chosen = targets[targets.length - 1];
                for (const t of targets) {
                    r -= t.weight;
                    if (r <= 0) { chosen = t; break; }
                }
                const target = findSectionByName(chosen.name);
                if (target) {
                    runSection(target.line);
                }
            });
        }
        return true;
    }

    // Default section type: after beats, advance to next section in the editor
    _clock._schedule(targetBeat, () => {
        if (_sequenceId !== myId) return;
        const sections = findAllSections();
        const idx = sections.findIndex(s => s.line === sectionLine);
        if (idx !== -1 && idx + 1 < sections.length) {
            runSection(sections[idx + 1].line);
        }
    });

    return true;
}

// ── Exports ───────────────────────────────────────────────────────────────────

export { initSections, runSection, cancelSection, parseSectionTag };
