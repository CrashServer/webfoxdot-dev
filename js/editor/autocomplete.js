// FoxDot autocomplete using CodeMirror show-hint addon.
// Ctrl+Space: synths after >>, params inside (), methods after ., general otherwise.
// Empty line: insert new player name + " >> " then immediately show synth list.

import { SYNTH_DEFS }   from '../synths/registry.js';
import { FX_REGISTRY }  from '../fx/registry.js';

const SYNTH_NAMES = Object.keys(SYNTH_DEFS);
const FX_PARAMS   = Object.keys(FX_REGISTRY);

const PLAYER_METHODS = [
    'stop()', 'solo()', 'soloDrop()', 'every()', 'stutter()', 'reverse()', 'shuffle()',
    'sometimes("stutter", 2)', 'often("stutter", 2)', 'rarely("stutter", 2)',
    'always()', 'almostNever()', 'after(4, "stop")', 'unison(2)',
];

// Build a full synth call with every exposed param at its default.
function fullSynthCall(name) {
    const def = SYNTH_DEFS[name];
    const params = Object.entries(def.defaults).map(([k, v]) => `${k}=${v}`).join(', ');
    return `${name}([0], ${params})`;
}

// A synth completion that inserts the full call and selects the degree ([0]).
function synthItem(name) {
    const text = fullSynthCall(name);
    const bracket = text.indexOf('[');
    return {
        text, displayText: name, className: 'hint-synth',
        hint(cm, data) {
            cm.replaceRange(text, data.from, data.to);
            const ch = data.from.ch + bracket + 1;           // inside the first [ ]
            cm.setSelection({ line: data.from.line, ch }, { line: data.from.line, ch: ch + 1 });
        },
    };
}

// play() completion — inserts play() with the cursor inside the parens.
function playItem() {
    return {
        text: 'play()', displayText: 'play', className: 'hint-keyword',
        hint(cm, data) {
            cm.replaceRange('play()', data.from, data.to);
            cm.setCursor({ line: data.from.line, ch: data.from.ch + 5 });
        },
    };
}

const COMMON_PARAMS = ['degree','oct','amp','dur','sus','pan','attack','release'];

// FX grouped by effect — picking one inserts ALL its params (mix at `on`,
// the rest at their registry defaults).
const FX_GROUPS = [
    { name: 'lpf',       on: 2000, params: ['lpf', 'lpf_rq'] },
    { name: 'hpf',       on: 400,  params: ['hpf', 'hpf_rq'] },
    { name: 'crush',     on: 0.6,  params: ['crush', 'bits', 'srate'] },
    { name: 'resonbank', on: 0.3,  params: ['resonbank', 'rbfreq', 'rbdecay', 'rbspread'] },
    { name: 'rgate',     on: 0.8,  params: ['rgate', 'rgaterate', 'rgatewave'] },
    { name: 'reverb',    on: 0.4,  params: ['reverb', 'room', 'damp'] },
    { name: 'mverb',     on: 0.5,  params: ['mverb', 'mverbmix', 'mverbdamp', 'mverbdiff', 'mverbfreeze'] },
    { name: 'cheapverb', on: 0.5,  params: ['cheapverb', 'cvdecay', 'cvdamp'] },
    { name: 'chorus',    on: 0.5,  params: ['chorus', 'chorus_rate', 'chorus_depth'] },
    { name: 'tremolo',   on: 0.6,  params: ['tremolo', 'trem_rate', 'trem_depth'] },
    { name: 'tanh',      on: 0.5,  params: ['tanh', 'drive'] },
    { name: 'fbdelay',   on: 0.5,  params: ['fbdelay', 'fbtime', 'fbfeed', 'fbcutoff', 'fbspread'] },
    { name: 'echo',      on: 0.4,  params: ['echo', 'echo_time', 'echo_dec'] },
];
function fxItem(g) {
    const parts = g.params.map((p, i) => `${p}=${i === 0 ? g.on : FX_REGISTRY[p].default}`);
    return item(parts.join(', '), 'hint-fx', g.name + ' …');
}

const SCALE_NAMES = [
    'major','minor','dorian','phrygian','lydian','mixolydian',
    'pentatonic','minPentatonic','chromatic','diminished','bhairav',
];

// Only patterns we actually implement (keeps suggestions runnable)
const PATTERN_NAMES = [
    'PRand','PWhite','PWalk','PDur','PPing','PStutter','PAlt','PShuf','PBern','PCoin',
    'PEuclid','PRange','PStep','PSine','PTri','PChain','PMarkov',
    'Pacc','PSwing','PBin','PFDur','PLife',
];

const TIMEVAR_NAMES = ['var(','linvar(','sinvar(','expvar(','fi(','fo(','fb('];

const GLOBALS = [
    'Clock.bpm = ','Scale.default = ','Root.default = ','play(',
    'drop(','soloRnd(','unsolo()','rest()','print(','loadsample(','loadpack(','defsynth(',
];

// ── Player name generation ───────────────────────────────────────────────────

// Scan editor content for already-declared player names
function usedPlayerNames(cm) {
    const used = new Set();
    const re = /^\s*([a-zA-Z_]\w*)\s*>>/;
    for (let i = 0; i < cm.lineCount(); i++) {
        const m = cm.getLine(i).match(re);
        if (m) used.add(m[1]);
    }
    return used;
}

// Return the first unused player name from the priority list
const NAME_PREFIXES = 'vapbscdefghijklmnoqrtuwxyz'.split('');
function nextPlayerName(cm) {
    const used = usedPlayerNames(cm);
    for (const p of NAME_PREFIXES) {
        for (let n = 1; n <= 9; n++) {
            const name = p + n;
            if (!used.has(name)) return name;
        }
    }
    return 'p' + (Math.floor(Math.random() * 90) + 10);
}

// ── Context detection ────────────────────────────────────────────────────────

function getContext(cm) {
    const cursor = cm.getCursor();
    const line   = cm.getLine(cursor.line);
    const before = line.slice(0, cursor.ch);
    const wordM  = before.match(/([a-zA-Z_][\w.]*)$/);
    const word   = wordM ? wordM[1].replace(/\.$/, '') : '';

    // Empty line → player name suggestion
    if (line.trim() === '') return { type: 'newplayer' };

    if (before.match(/[a-zA-Z_]\w*\.$/))    return { type: 'method', word: '' };
    if (before.match(/[a-zA-Z_]\w*\.\w+$/)) return { type: 'method', word };
    if (before.match(/[a-zA-Z_]\w*\s*>>\s*[a-zA-Z_]*$/)) return { type: 'synth', word };
    const scaleM = before.match(/Scale\s*\.\s*default\s*=\s*["']([a-zA-Z]*)$/);
    if (scaleM) return { type: 'scale', word: scaleM[1] };

    // Are we inside an unclosed function call? Scan bracket depth so nested
    // chords/groups/arrays (which contain their own ")") don't fool us.
    const call = enclosingCall(before);
    if (call && call.fn) {
        // value position: right after `param=` → suggest patterns/timevars
        if (before.match(/[a-zA-Z_]\w*\s*=\s*[a-zA-Z_]*$/)) return { type: 'value', word };
        if (call.fn === 'play' || SYNTH_NAMES.includes(call.fn)) return { type: 'param', synth: call.fn, word };
        return { type: 'param', synth: null, word };
    }
    return { type: 'general', word };
}

// Walk `before` tracking bracket depth. Returns the innermost UNCLOSED bracket;
// if it's a "(" immediately preceded by an identifier, that's a function call.
function enclosingCall(before) {
    const stack = [];
    for (let i = 0; i < before.length; i++) {
        const c = before[i];
        if (c === '(' || c === '[' || c === '{') stack.push({ c, i });
        else if (c === ')' || c === ']' || c === '}') stack.pop();
    }
    if (stack.length === 0) return null;
    const top = stack[stack.length - 1];
    if (top.c !== '(') return { fn: null };            // inside [...] / {...} / a group
    const m = before.slice(0, top.i).match(/([a-zA-Z_]\w*)\s*$/);
    return { fn: m ? m[1] : null };                    // identifier before "(" → call
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sep(label) {
    return {
        text: '',
        displayText: label,
        className: 'hint-sep',
        hint: () => {},
    };
}

function item(text, cls, display) {
    return { text, displayText: display ?? text, className: cls };
}

// Remove category separators that have no items under them (after filtering).
function dropEmptySeps(list) {
    return list.filter((it, i) => {
        if (it.className !== 'hint-sep') return true;
        const next = list[i + 1];
        return next && next.className !== 'hint-sep';
    });
}

// ── Hint function ─────────────────────────────────────────────────────────────

function hintFn(cm) {
    const ctx    = getContext(cm);
    const cursor = cm.getCursor();
    const line   = cm.getLine(cursor.line);
    const before = line.slice(0, cursor.ch);

    const wordM     = before.match(/([a-zA-Z_][\w.]*)$/);
    const wordStart = wordM ? cursor.ch - wordM[1].length : cursor.ch;
    const typedWord = wordM ? wordM[1] : '';
    const from = { line: cursor.line, ch: wordStart };
    const to   = cursor;

    // ── Empty line: suggest a new player name, then auto-show synths ──────────
    if (ctx.type === 'newplayer') {
        const name = nextPlayerName(cm);
        const insertion = name + ' >> ';
        return {
            list: [{
                text:        insertion,
                displayText: insertion,
                className:   'hint-method',
                hint(editor) {
                    editor.replaceRange(insertion, { line: cursor.line, ch: 0 }, { line: cursor.line, ch: line.length });
                    editor.setCursor({ line: cursor.line, ch: insertion.length });
                    // Show synth list immediately after inserting player name
                    setTimeout(() => {
                        editor.showHint({
                            hint:           synthHint,
                            completeSingle: false,
                            alignWithWord:  true,
                        });
                    }, 30);
                },
            }],
            from: { line: cursor.line, ch: 0 },
            to:   { line: cursor.line, ch: line.length },
        };
    }

    function filter(list) {
        if (!typedWord) return list;
        const lw = typedWord.toLowerCase();
        return list.filter(it => {
            const label = (it.displayText ?? it.text).toLowerCase();
            return label.startsWith(lw) || label.replace('=','').startsWith(lw);
        });
    }

    let list = [];

    if (ctx.type === 'method') {
        list = filter(PLAYER_METHODS.map(m => item(m, 'hint-method')));
    } else if (ctx.type === 'synth') {
        // Picking a synth inserts the full call (all params); play() opens parens.
        list = [playItem(), ...SYNTH_NAMES.map(synthItem)];
        list = list.filter(it => filter([it]).length > 0);
    } else if (ctx.type === 'scale') {
        list = filter(SCALE_NAMES.map(n => item(`"${n}"`, 'hint-param', n)));
    } else if (ctx.type === 'value') {
        // After `param=` — suggest pattern / timevar values
        list = [
            sep('— patterns —'),
            ...PATTERN_NAMES.map(n => item(n + '(', 'hint-pattern', n)),
            sep('— timevars —'),
            ...TIMEVAR_NAMES.map(n => item(n, 'hint-timevar', n.replace('(', ''))),
        ];
        list = dropEmptySeps(list.filter(it => it.className === "hint-sep" || filter([it]).length > 0));
    } else if (ctx.type === 'param') {
        let synthParams;
        if (ctx.synth === 'play') {
            synthParams = ['amp=','dur=','pan=','rate=','sample=','amplify=','sus='].map(p => item(p, 'hint-param'));
        } else if (ctx.synth) {
            synthParams = Object.keys(SYNTH_DEFS[ctx.synth]?.defaults ?? {}).map(p => item(p + '=', 'hint-param'));
        } else {
            synthParams = COMMON_PARAMS.map(p => item(p + '=', 'hint-param'));
        }
        // FX as groups — picking one inserts all its params (FX work on play() too)
        const fxItems = FX_GROUPS.map(fxItem);
        list = [sep('— params —'), ...synthParams, sep('— fx (full) —'), ...fxItems];
        list = dropEmptySeps(list.filter(it => it.className === "hint-sep" || filter([it]).length > 0));
    } else {
        list = [
            sep('— synths —'),
            ...SYNTH_NAMES.map(n => item(n, 'hint-synth')),
            sep('— patterns —'),
            ...PATTERN_NAMES.map(n => item(n + '(', 'hint-pattern', n)),
            sep('— timevars —'),
            ...TIMEVAR_NAMES.map(n => item(n, 'hint-timevar', n.replace('(', ''))),
            sep('— globals —'),
            ...GLOBALS.map(g => item(g, 'hint-keyword')),
        ];
        if (typedWord) {
            list = list.filter(it => {
                if (it.className === 'hint-sep') return false;
                return (it.displayText ?? it.text).toLowerCase().startsWith(typedWord.toLowerCase());
            });
        }
        return { list, from, to };
    }

    return { list: dropEmptySeps(list), from, to };
}

// Minimal hint function for showing just synth names (used after player name insert)
function synthHint(cm) {
    const cursor = cm.getCursor();
    const line   = cm.getLine(cursor.line);
    const before = line.slice(0, cursor.ch);
    const wordM  = before.match(/([a-zA-Z_]\w*)$/);
    const word   = wordM ? wordM[1] : '';
    const from   = { line: cursor.line, ch: cursor.ch - word.length };
    const list   = [
        ...(!word || 'play'.startsWith(word) ? [playItem()] : []),
        ...SYNTH_NAMES.filter(n => !word || n.startsWith(word)).map(synthItem),
    ];
    return { list, from, to: cursor };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function triggerAutocomplete(cm) {
    cm.showHint({
        hint:           hintFn,
        completeSingle: false,
        alignWithWord:  true,
    });
}
