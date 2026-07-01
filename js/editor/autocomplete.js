// FoxDot autocomplete using CodeMirror show-hint addon.
// Ctrl+Space: synths after >>, params inside (), methods after ., general otherwise.
// Empty line: insert new player name + " >> " then immediately show synth list.

import { SYNTH_DEFS }   from '../synths/registry.js';
import { FX_REGISTRY }  from '../fx/registry.js';

const SYNTH_NAMES = Object.keys(SYNTH_DEFS);
const FX_PARAMS   = Object.keys(FX_REGISTRY);

const PLAYER_METHODS = [
    'stop()', 'solo()', 'soloDrop()', 'drummer()', 'gtr(5)', 'penta()', 'chroma()', 'every()', 'stutter()', 'reverse()', 'shuffle()',
    'sometimes("stutter", 2)', 'often("stutter", 2)', 'rarely("stutter", 2)',
    'always()', 'almostNever()', 'after(4, "stop")', 'unison(2)',
];

// Params common to every synth — uniform defaults, so we don't clutter the
// inserted call / signature with them (amp 1, pan 0, oct 5, attack/release).
const HIDDEN_SYNTH_PARAMS = new Set(['amp', 'dur', 'pan', 'attack', 'release']);

// Build a synth call with the synth's own (non-common) params at their defaults.
function fullSynthCall(name) {
    const def = SYNTH_DEFS[name];
    const params = Object.entries(def.defaults)
        .filter(([k]) => !HIDDEN_SYNTH_PARAMS.has(k))
        .map(([k, v]) => `${k}=${v}`).join(', ');
    return params ? `${name}([0], ${params})` : `${name}([0])`;
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
    { name: 'bpf',       on: 1200, params: ['bpf', 'bpf_rq'] },
    { name: 'eq3',       on: 1,    params: ['eq3', 'eqlow', 'eqmid', 'eqhigh'] },
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
    { name: 'shape',     on: 0.5,  params: ['shape'] },
    { name: 'dist2',     on: 0.6,  params: ['dist2', 'dist2shape'] },
    { name: 'chop',      on: 4,    params: ['chop'] },
    { name: 'multicrush',on: 0.6,  params: ['multicrush', 'mclowdrive', 'mcmiddrive', 'mchighdrive', 'mclofreq', 'mchifreq'] },
    { name: 'vibrato',   on: 0.6,  params: ['vibrato', 'vib_rate', 'vib_depth'] },
    { name: 'ringmod',   on: 0.5,  params: ['ringmod', 'ringmod_freq'] },
    { name: 'flanger',   on: 0.6,  params: ['flanger', 'flanger_rate', 'flanger_depth'] },
    { name: 'phaser',    on: 0.6,  params: ['phaser', 'phaser_rate'] },
    { name: 'formant',   on: 0.6,  params: ['formant', 'formant_vowel'] },
    { name: 'echo',      on: 0.4,  params: ['echo', 'echo_time', 'echo_dec'] },
];
function fxItem(g) {
    const parts = g.params.map((p, i) => `${p}=${i === 0 ? g.on : FX_REGISTRY[p].default}`);
    return item(parts.join(', '), 'hint-fx', g.name);
}

// FX grouped into families — the fx category unfolds into these sub-menus.
// Anything not listed falls into an "other" bucket at the end.
const FX_SUBCATS = [
    ['filters',    ['lpf', 'hpf', 'bpf', 'eq3', 'resonbank', 'formant']],
    ['reverbs',    ['reverb', 'mverb', 'cheapverb']],
    ['delays',     ['echo', 'fbdelay']],
    ['distortion', ['crush', 'multicrush', 'tanh', 'shape', 'dist2']],
    ['modulation', ['chorus', 'tremolo', 'vibrato', 'flanger', 'phaser', 'ringmod']],
    ['rhythmic',   ['rgate', 'chop']],
];

const SCALE_NAMES = [
    'major','minor','dorian','phrygian','lydian','mixolydian',
    'pentatonic','minPentatonic','chromatic','diminished','bhairav',
];

// Only patterns we actually implement (keeps suggestions runnable)
const PATTERN_NAMES = [
    'PRand','PWhite','PWalk','PDur','PPing','PStutter','PAlt','PShuf','PBern','PCoin',
    'PEuclid','PRange','PStep','PSine','PTri','PChain','PMarkov',
    'Pacc','PSwing','PBin','PFDur','PLife','PEuclid2','PFr','PGauss','PArp','PStretch','PZip','PReverse','PMorse',
    'PDrum','PwRand','PxRand','PLog','PTime','PSum','PDelta','PIndex','PSquare','PFib','PBeat','PJoin','PDelay',
    'P10','PSaw','PSq','PZero','PBool','PFibMod','PPairs','PChar','PQuicken','PStrum','PZip2','PZ12',
    'PChord','PRoman','PProg','PClave','PRhythm','PPoly','PLogistic','PBrown','PHenon','PLorenz','PPrime','PThue','PGrowArp','PTree',
    'PExp','PPulse','PSlide','PContour','PGroove','PCircle','motif','arp',
];

// Autocomplete inserts a full, closed call with coherent default values (0 when
// unsure), so a pick is immediately runnable — e.g. picking PDur gives PDur(3, 8).
const PATTERN_TEMPLATES = {
    PRand: 'PRand(0, 8)', PWhite: 'PWhite(0, 1)', PWalk: 'PWalk(8, 1, 1)', PDur: 'PDur(3, 8)',
    PPing: 'PPing(0, 7)', PStutter: 'PStutter([0, 2, 4], 2)', PAlt: 'PAlt([0, 2], [4, 7])',
    PShuf: 'PShuf([0, 2, 4, 7])', PBern: 'PBern(0.5)', PCoin: 'PCoin(0.5)', PEuclid: 'PEuclid(3, 8)',
    PRange: 'PRange(0, 8)', PStep: 'PStep(4, 7, 0)', PSine: 'PSine(0, 1, 16)', PTri: 'PTri(0, 1, 16)',
    PChain: 'PChain({0: [1, 2], 1: [0]})', PMarkov: 'PMarkov([0, 2, 4, 2, 0])', Pacc: 'Pacc("offbeat")',
    PSwing: 'PSwing(0.5)', PBin: 'PBin(16)', PFDur: 'PFDur((3, 8))', PLife: 'PLife(0.5)',
    PEuclid2: 'PEuclid2(3, 8, ".", "x")', PFr: 'PFr(0, 7)', PGauss: 'PGauss(0, 1)', PArp: 'PArp([0, 4, 7], 5)',
    PStretch: 'PStretch([0, 2, 4], 8)', PZip: 'PZip([0, 2], [4, 7])', PReverse: 'PReverse([0, 2, 4, 7])',
    PMorse: 'PMorse("sos")', PDrum: 'PDrum(3, 8)', PwRand: 'PwRand([0, 4, 7], [8, 2, 1])', PxRand: 'PxRand(0, 8)',
    PLog: 'PLog(0, 1)', PTime: 'PTime(0, 8)', PSum: 'PSum(3, 8)', PDelta: 'PDelta([1, 2, 1], 0)',
    PIndex: 'PIndex()', PSquare: 'PSquare()', PFib: 'PFib()', PBeat: 'PBeat("x xx x")', PJoin: 'PJoin([0, 2], [4, 7])',
    PDelay: 'PDelay(3, 8)', P10: 'P10(8)', PSaw: 'PSaw(0, 1, 16)', PSq: 'PSq(1, 2, 3)',
    PZero: 'PZero()', PBool: 'PBool([1, 0, 1, 1])', PFibMod: 'PFibMod()', PPairs: 'PPairs([0, 2, 4])',
    PChar: 'PChar("hello")', PQuicken: 'PQuicken(0.5, 3, 6)', PStrum: 'PStrum(4)',
    PZip2: 'PZip2([0, 2], [4, 7])', PZ12: 'PZ12([1, 0], [1, 0.5])',
    PChord: 'PChord(0, "7")', PRoman: 'PRoman("I V vi IV")', PProg: 'PProg("50s")',
    PClave: 'PClave("son")', PRhythm: 'PRhythm([1, (3, 8)])', PPoly: 'PPoly(3, 4)',
    PLogistic: 'PLogistic(3.9)', PBrown: 'PBrown(0, 8)', PHenon: 'PHenon(0, 8)', PLorenz: 'PLorenz(0, 8)',
    PPrime: 'PPrime(2)', PThue: 'PThue()', PGrowArp: 'PGrowArp([0, 2, 4, 7])', PTree: 'PTree([0], 3, 2)',
    PExp: 'PExp(0, 1, 16)', PPulse: 'PPulse(0, 1, 16, 0.5)', PSlide: 'PSlide(0, 1, 16)',
    PContour: 'PContour("arch", 8, 7)', PGroove: 'PGroove("swing")', PCircle: 'PCircle(8)',
    motif: 'motif(4)', arp: 'arp([0, 4, 7], "up")',
};
const patItem = (n) => item(PATTERN_TEMPLATES[n] || (n + '('), 'hint-pattern', n);

const TIMEVAR_NAMES = ['var(','linvar(','sinvar(','expvar(','fi(','fo(','fb('];

const GLOBALS = [
    'Clock.bpm = ','Scale.default = ','Root.default = ','play(',
    'drop(','soloRnd(','unsolo()','rest()','print(','loadsample(','loadpack(','defsynth(',
    'loop(','loadloop(','pbuild(','pkit(','genres()','chaos(','melody(',
    'midi(','mlearn(','midiout(','link(',
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

// pbuild(…) with every knob exposed — genre (a name or an index number), evolve,
// fill, density, and per-layer gates (1=on, 0=off, or a pattern like PBin(4)/{1,0}).
function pbuildItem() {
    return item('pbuild("techno", evolve=8, fill=4, density=1, kick=1, snare=1, hat=1, perc=1)',
                'hint-keyword', 'pbuild(…)  genre drums');
}
function pkitInPlayItem() {
    return item('pkit("techno").kick', 'hint-keyword', 'pkit(…).kick  one layer');
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
                    setTimeout(() => openMenu(editor, synthHint), 30);
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
        // After `param=` — suggest pattern / timevar values (one category)
        list = [
            sep('— patterns —'),
            ...PATTERN_NAMES.map(patItem),
            ...TIMEVAR_NAMES.map(n => item(n, 'hint-timevar', n.replace('(', ''))),
        ];
        list = dropEmptySeps(list.filter(it => it.className === "hint-sep" || filter([it]).length > 0));
    } else if (ctx.type === 'param') {
        let synthParams;
        if (ctx.synth === 'play') {
            synthParams = ['amp=','dur=','pan=','rate=','sample=','amplify=','sus='].map(p => item(p, 'hint-param', p.replace(/=$/, '')));
            // pbuild(…) generates a genre drum pattern as the play() string — offer
            // the full call (every knob exposed) so it can be tweaked in place.
            const gen = [sep('— generators —'), pbuildItem(), pkitInPlayItem()];
            list = dropEmptySeps([...gen, sep('— params —'), ...synthParams,
                                  sep('— fx (full) —'), ...FX_GROUPS.map(fxItem)]
                                 .filter(it => it.className === 'hint-sep' || filter([it]).length > 0));
            return { list, from, to };
        } else if (ctx.synth) {
            synthParams = Object.keys(SYNTH_DEFS[ctx.synth]?.defaults ?? {}).map(p => item(p + '=', 'hint-param', p));
        } else {
            synthParams = COMMON_PARAMS.map(p => item(p + '=', 'hint-param', p));
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
            ...PATTERN_NAMES.map(patItem),
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

// ── Nested flyout menu ────────────────────────────────────────────────────────
// A custom completion popup. hintFn's "— … —" separators become category rows
// that unfold a submenu to the RIGHT; categories can nest arbitrarily (the fx
// category unfolds again into filters/reverbs/delays/…). Navigation uses a stack
// of columns: hover or → opens deeper, ← pops back, ↑/↓ move, ↵/Tab pick.
// A node is  { kind:'leaf', item }  or  { kind:'cat', label, children:[node…] }.

const CM = () => window.CodeMirror;
let menuState = null;

function cleanLabel(s) { return String(s).replace(/—/g, '').replace(/…/g, '').trim(); }
const wrap = (i, n) => ((i % n) + n) % n;
const leaf = (item) => ({ kind: 'leaf', item });

// Split the fx items into family sub-categories (FX_SUBCATS + an "other" bucket).
function groupFx(items) {
    const byName = new Map(items.map(it => [it.displayText, it]));
    const used = new Set(), cats = [];
    for (const [label, names] of FX_SUBCATS) {
        const kids = names.filter(n => byName.has(n)).map(n => { used.add(n); return leaf(byName.get(n)); });
        if (kids.length) cats.push({ kind: 'cat', label, children: kids });
    }
    const rest = items.filter(it => !used.has(it.displayText)).map(leaf);
    if (rest.length) cats.push({ kind: 'cat', label: 'other', children: rest });
    return cats;
}

// Build the node tree from hintFn's flat {list}. `subgroup` nests the fx category
// (skipped while type-filtering, so matches show as a flat list).
function toTree(list, subgroup) {
    const roots = []; let cur = null;
    for (const it of list) {
        if (it.className === 'hint-sep') { cur = { label: cleanLabel(it.displayText), items: [] }; roots.push(cur); }
        else if (cur) cur.items.push(it);
        else roots.push(leaf(it));
    }
    return roots.map(node => {
        if (node.kind === 'leaf') return node;
        const isFx = node.items.length > 1 && node.items.every(i => i.className === 'hint-fx');
        const children = (isFx && subgroup) ? groupFx(node.items) : node.items.map(leaf);
        return { kind: 'cat', label: node.label, children };
    });
}

function closeMenu() {
    const s = menuState; if (!s) return;
    menuState = null;
    if (s.keyMap)    s.cm.removeKeyMap(s.keyMap);
    if (s.onChange)  s.cm.off('changes', s.onChange);
    if (s.onBlur)    s.cm.off('blur', s.onBlur);
    if (s.onDocDown) document.removeEventListener('mousedown', s.onDocDown, true);
    (s.colDivs || []).forEach(d => d.remove());
}

function rowEl(node, onEnter, onClick) {
    const el = document.createElement('div');
    if (node.kind === 'cat') {
        el.className = 'cd-menu-row cd-menu-cat';
        const t = document.createElement('span'); t.textContent = node.label; el.appendChild(t);
        const a = document.createElement('span'); a.className = 'cd-menu-arrow'; a.textContent = '›'; el.appendChild(a);
    } else {
        const it = node.item;
        el.className = 'cd-menu-row ' + (it.className || '');
        el.textContent = it.displayText ?? it.text;
    }
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mousedown', (e) => { e.preventDefault(); onClick(); });
    return el;
}

// Hover row j of column i: cut deeper columns, select it, and (if a category)
// unfold its child column — so the mouse cascades through the tree.
function hoverTo(s, i, j) {
    s.cols.length = i + 1;
    s.cols[i].sel = j;
    const node = s.cols[i].entries[j];
    if (node.kind === 'cat') s.cols.push({ entries: node.children, sel: 0 });
    render(s);
}

function clickRow(s, i, j) {
    const node = s.cols[i].entries[j];
    if (node.kind === 'leaf') { hoverTo(s, i, j); pick(s, node.item); }
    else hoverTo(s, i, j);
}

function render(s) {
    (s.colDivs || []).forEach(d => d.remove());
    s.colDivs = []; s.colEls = [];
    for (let i = 0; i < s.cols.length; i++) {
        const col = s.cols[i];
        const div = document.createElement('div');
        div.className = 'cd-menu' + (i > 0 ? ' cd-submenu' : '');
        const rows = col.entries.map((node, j) => {
            const r = rowEl(node, () => hoverTo(s, i, j), () => clickRow(s, i, j));
            r.classList.toggle('active', j === col.sel);
            div.appendChild(r); return r;
        });
        document.body.appendChild(div);
        s.colDivs.push(div); s.colEls.push(rows);
        if (i === 0) {
            const c = s.cm.cursorCoords(s.from, 'page');
            div.style.top = c.bottom + 'px'; div.style.left = c.left + 'px';
        } else {
            const a = s.colEls[i - 1][s.cols[i - 1].sel].getBoundingClientRect();
            div.style.top = (a.top + window.scrollY) + 'px';
            div.style.left = (a.right + window.scrollX + 2) + 'px';
            if (a.right + div.offsetWidth + 6 > window.innerWidth) div.style.left = (a.left + window.scrollX - div.offsetWidth - 2) + 'px';
        }
    }
}

const lastCol = (s) => s.cols[s.cols.length - 1];

function move(s, dir) {
    const c = lastCol(s);
    c.sel = wrap(c.sel + dir, c.entries.length);
    render(s);
}

function right(s, Pass) {
    const c = lastCol(s), node = c.entries[c.sel];
    if (node && node.kind === 'cat') { s.cols.push({ entries: node.children, sel: 0 }); render(s); }
    else { closeMenu(); return Pass; }
}

function left(s, Pass) {
    if (s.cols.length > 1) { s.cols.pop(); render(s); }
    else { closeMenu(); return Pass; }
}

function choose(s) {
    const c = lastCol(s), node = c.entries[c.sel];
    if (!node) return;
    if (node.kind === 'leaf') pick(s, node.item);
    else { s.cols.push({ entries: node.children, sel: 0 }); render(s); }
}

function pick(s, item) {
    const { cm, from, to } = s; closeMenu();
    if (typeof item.hint === 'function') item.hint(cm, { from, to });
    else cm.replaceRange(item.text, from, to);
}

function typedLen(s) {
    const before = s.cm.getLine(s.from.line).slice(s.from.ch, s.to.ch);
    return before.length;
}

function rebuild(s) {
    const data = s.provide();
    if (!data || !data.list || !data.list.length) { closeMenu(); return; }
    s.from = data.from; s.to = data.to;
    const roots = toTree(data.list, typedLen(s) === 0);
    if (!roots.length) { closeMenu(); return; }
    s.cols = [{ entries: roots, sel: 0 }];   // collapse to root on edit
    render(s);
}

function openMenu(cm, provider = hintFn) {
    closeMenu();
    const data = provider(cm);
    if (!data || !data.list || !data.list.length) return;

    const s = { cm, provide: () => provider(cm), from: data.from, to: data.to };
    const before = cm.getLine(data.from.line).slice(data.from.ch, data.to.ch);
    const roots = toTree(data.list, before.length === 0);
    if (!roots.length) return;
    s.cols = [{ entries: roots, sel: 0 }];
    menuState = s;

    render(s);

    const Pass = CM().Pass;
    s.keyMap = {
        Down: () => move(s, 1),
        Up: () => move(s, -1),
        'Ctrl-N': () => move(s, 1),
        'Ctrl-P': () => move(s, -1),
        Right: () => right(s, Pass),
        Left: () => left(s, Pass),
        Enter: () => choose(s),
        Tab: () => choose(s),
        Esc: () => closeMenu(),
    };
    cm.addKeyMap(s.keyMap);
    s.onChange  = () => rebuild(s);   cm.on('changes', s.onChange);
    s.onBlur    = () => closeMenu();  cm.on('blur', s.onBlur);
    s.onDocDown = (e) => { if (!s.colDivs.some(d => d.contains(e.target))) closeMenu(); };
    setTimeout(() => document.addEventListener('mousedown', s.onDocDown, true), 0);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function triggerAutocomplete(cm) { openMenu(cm, hintFn); }
