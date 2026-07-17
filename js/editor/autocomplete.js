// FoxDot autocomplete using CodeMirror show-hint addon.
// Ctrl+Space: synths after >>, params inside (), methods after ., general otherwise.
// Empty line: insert new player name + " >> " then immediately show synth list.

import { SYNTH_DEFS }   from '../synths/registry.js';
import { FX_REGISTRY }  from '../fx/registry.js';
import { SCENES as VSCENES, PALETTE_NAMES, RENDER_MODE_NAMES, BLEND_NAMES } from '../visuals/vdata.js';

const SYNTH_NAMES = Object.keys(SYNTH_DEFS);
const VSCENE_SET  = new Set(VSCENES);
const VFX_NAMES   = ['trails', 'feedback', 'blur', 'bloom', 'scan', 'vignette', 'glitch', 'invert', 'posterize', 'droste', 'fold', 'hueshift', 'dither'];
// Every knob a scene understands. Scenes only read speed/scale (+ audio); the rest are
// universal controls the compositor applies to any scene. Ctrl+Space inside a scene call
// lists them all. `pal`/`dur` are discoverable here but kept OUT of the inserted template
// (pal would force a palette; dur is a pattern-timing meta-param).
const VSCENE_PARAMS = ['ch=', 'speed=', 'scale=', 'bright=', 'gain=', 'contrast=', 'hue=', 'pal=', 'zoom=', 'rot=', 'panx=', 'pany=', 'inv=', 'dur='];
// The template a scene pick inserts — all knobs at NO-OP defaults (behaves like name()),
// so every control is visible and tweakable in place, the way a synth pick exposes its.
const VSCENE_DEFAULTS = [['ch', 0], ['speed', 1], ['scale', 1], ['bright', 1], ['gain', 1], ['contrast', 0], ['hue', 0], ['zoom', 1], ['rot', 0], ['panx', 0], ['pany', 0], ['inv', 0]];
const FX_PARAMS   = Object.keys(FX_REGISTRY);

const PLAYER_METHODS = [
    'stop()', 'stop(4)', 'solo()', 'solo(8)', 'only()', 'only(8)', 'soloDrop()', 'unsolo()',
    'once()', 'drummer()', 'gtr(5)', 'penta()', 'chroma()', 'degrade(0.5)', 'human()', 'reroll(4)',
    'every()', 'stutter()', 'reverse()', 'shuffle()', 'unison(2)',
    'sometimes("stutter", 2)', 'often("stutter", 2)', 'rarely("stutter", 2)',
    'always()', 'almostNever()', 'after(4, "stop")',
    'follow("p1")', 'accompany("p1")', 'map("p1", {0: 5, 4: 7})',
    'jump(1)', 'rotate(1)', 'mirror()', 'strum(0.05)', 'offbeat()', 'multiply(2)',
    'every(4, "rotate")', 'sometimes("mirror")',
];

// Params common to every synth — uniform defaults, so we don't clutter the
// inserted call / signature with them (amp 1, pan 0, oct 5, attack/release).
const HIDDEN_SYNTH_PARAMS = new Set(['amp', 'dur', 'pan', 'attack', 'release', 'oct']);

// Build a synth call with the synth's own (non-common) params at their defaults.
function fullSynthCall(name) {
    const def = SYNTH_DEFS[name];
    const params = Object.entries(def.defaults)
        .filter(([k]) => !HIDDEN_SYNTH_PARAMS.has(k))
        .map(([k, v]) => `${k}=${v}`).join(', ');
    return params ? `${name}([0], ${params})` : `${name}([0])`;
}

// True when a call `(…)` already follows the cursor — e.g. the player name was
// deleted from `v1 >> foo(…)`. Then a synth pick should replace just the NAME,
// not paste a second ([0], …) template on top of the existing args.
function callFollows(cm, data) {
    return /^\s*\(/.test(cm.getLine(data.to.line).slice(data.to.ch));
}

// Build the synth-context list grouped by family: sep(family), …synthItems.
// Families come from SYNTH_SUBCATS; anything unlisted lands in "other".
function synthFamilyList() {
    const out = [], used = new Set();
    for (const [fam, names] of SYNTH_SUBCATS) {
        const have = names.filter(n => SYNTH_DEFS[n]);
        if (!have.length) continue;
        out.push(sep(fam));
        have.forEach(n => { used.add(n); out.push(synthItem(n)); });
    }
    const rest = SYNTH_NAMES.filter(n => !used.has(n));
    if (rest.length) { out.push(sep('other')); rest.forEach(n => out.push(synthItem(n))); }
    return out;
}

// A synth completion that inserts the full call and selects the degree ([0]).
function synthItem(name) {
    const text = fullSynthCall(name);
    const bracket = text.indexOf('[');
    return {
        text, displayText: name, className: 'hint-synth',
        hint(cm, data) {
            if (callFollows(cm, data)) {                       // just swap the name in
                cm.replaceRange(name, data.from, data.to);
                cm.setCursor({ line: data.from.line, ch: data.from.ch + name.length });
                return;
            }
            cm.replaceRange(text, data.from, data.to);
            // Put a plain CARET just after the default degree (inside the [ ]) rather
            // than SELECTING it: a live cursor on the line means the very next Ctrl+Enter
            // runs the whole player (a selected "0" used to be evaluated on its own —
            // "eval: 0" — so you had to press Run twice). The degree is still right at
            // the cursor to edit.
            const ch = data.from.ch + bracket + 1;           // the 0 inside the first [ ]
            cm.setCursor({ line: data.from.line, ch: ch + 1 });
        },
    };
}

// A video-scene completion. Like synthItem, it inserts the FULL call (every knob at its
// no-op default) so the controls are exposed for tweaking, and drops a caret just inside
// the parens (on ch) rather than selecting anything.
function fullSceneCall(name) {
    return `${name}(${VSCENE_DEFAULTS.map(([k, v]) => `${k}=${v}`).join(', ')})`;
}
function sceneItem(name) {
    const text = fullSceneCall(name);
    return {
        text, displayText: name, className: 'hint-synth',
        hint(cm, data) {
            if (callFollows(cm, data)) {                       // just swap the name in
                cm.replaceRange(name, data.from, data.to);
                cm.setCursor({ line: data.from.line, ch: data.from.ch + name.length });
                return;
            }
            cm.replaceRange(text, data.from, data.to);
            cm.setCursor({ line: data.from.line, ch: data.from.ch + name.length + 1 });   // just inside the (
        },
    };
}

// play() completion — inserts play() with the cursor inside the parens.
function playItem() {
    return {
        text: 'play()', displayText: 'play', className: 'hint-keyword',
        hint(cm, data) {
            if (callFollows(cm, data)) {                       // args already there
                cm.replaceRange('play', data.from, data.to);
                cm.setCursor({ line: data.from.line, ch: data.from.ch + 4 });
                return;
            }
            cm.replaceRange('play()', data.from, data.to);
            cm.setCursor({ line: data.from.line, ch: data.from.ch + 5 });
        },
    };
}

const COMMON_PARAMS = ['degree','oct','amp','dur','sus','pan','attack','release'];

// FX grouped by effect — picking one inserts ALL its params (mix at `on`,
// the rest at their registry defaults).
const FX_GROUPS = [
    { name: 'lpf',       on: 2000, params: ['lpf', 'lpr'] },
    { name: 'hpf',       on: 400,  params: ['hpf', 'hpr'] },
    { name: 'bpf',       on: 1200, params: ['bpf', 'bpr'] },
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
    { name: 'pong',      on: 0.5,  params: ['pong', 'pongtime', 'pongfeed'] },
    { name: 'spin',      on: 0.6,  params: ['spin', 'spinrate'] },
    { name: 'squiz',     on: 0.6,  params: ['squiz', 'squizpitch'] },
    { name: 'drop',      on: 0.5,  params: ['drop', 'dropof'] },
    { name: 'octclean',  on: 0.6,  params: ['octclean', 'ocsub', 'ocup'] },
    { name: 'comp',      on: 0.6,  params: ['comp', 'compthresh', 'compratio'] },
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
    ['delays',     ['echo', 'fbdelay', 'pong']],
    ['distortion', ['crush', 'multicrush', 'tanh', 'shape', 'dist2']],
    ['modulation', ['chorus', 'tremolo', 'vibrato', 'flanger', 'phaser', 'ringmod', 'spin']],
    ['glitch',     ['squiz', 'drop', 'octclean']],
    ['dynamics',   ['comp']],
    ['rhythmic',   ['rgate', 'chop']],
];

// Synths grouped into families — the long synth list unfolds into these sub-menus
// (like fx). Anything not listed falls into an "other" bucket at the end.
const SYNTH_SUBCATS = [
    ['bass',  ['dbass', 'bass', 'ebass', 'acidbass', 'pumpbass', 'wobble', 'tb303', 'a_gesa', 'a_daft']],
    ['lead',  ['saw', 'ssaw', 'supersaw', 'pulse', 'blip', 'hoover', 'prophet', 'cs80', 'plaits', 'faim']],
    ['keys',  ['bell', 'organ', 'basic', 'karp', 'rhodes']],
    ['pads',  ['pads', 'choir', 'brass']],
    ['pluck', ['pluck', 'moogpluck', 'guit', 'donk', 'lapin']],
    ['perc',  ['compkick', 'a_hhat', 'a_bd', 'ikea']],
    ['tone',  ['fm', 'sine', 'rsin']],
];

const SCALE_NAMES = [
    'major','minor','dorian','phrygian','lydian','mixolydian',
    'pentatonic','minPentatonic','chromatic','diminished','bhairav',
];

// Pattern generators grouped into families — the long P* list unfolds into these
// sub-menus (mirrors SYNTH_SUBCATS / FX_SUBCATS). Anything unlisted lands in "other".
const PATTERN_SUBCATS = [
    ['rhythm',   ['PDur','PBeat','PEuclid','PEuclidR','PEuclid2','PDrum','PBin','PFDur','PRhythm','PPoly','PClave','PSum','PDelta','PDelay','PStrum','PQuicken','PGroove','PSwing','Pacc','PStep']],
    ['melody',   ['PWalk','PPing','PContour','PSine','PTri','PSaw','PExp','PPulse','PSlide','PRange','PAlt','PStutter','PStretch','motif','arp']],
    ['harmony',  ['PChord','PRoman','PProg','PCircle','PArp','PGrowArp']],
    ['random',   ['PRand','PWhite','PwRand','PxRand','PGauss','PLog','PCoin','PBern','PShuf','P10','PBool']],
    ['chaos',    ['PLogistic','PBrown','PHenon','PLorenz','PLife','PMarkov','PChain']],
    ['sequence', ['PIndex','PSquare','PFib','PFibMod','PSq','PPrime','PThue','PTree','PZero','PZ12','PZip','PZip2','PJoin','PReverse','PPairs','PChar','PTime','PFr','PMorse']],
];

// Only patterns we actually implement (keeps suggestions runnable)
const PATTERN_NAMES = [
    'PRand','PWhite','PWalk','PDur','PPing','PStutter','PAlt','PShuf','PBern','PCoin',
    'PEuclid','PEuclidR','PRange','PStep','PSine','PTri','PChain','PMarkov',
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
    PShuf: 'PShuf([0, 2, 4, 7])', PBern: 'PBern(0.5)', PCoin: 'PCoin(0.5)', PEuclid: 'PEuclid(8, 3)',
    PRange: 'PRange(0, 8)', PStep: 'PStep(4, 7, 0)', PSine: 'PSine(0, 1, 16)', PTri: 'PTri(0, 1, 16)',
    PChain: 'PChain({0: [1, 2], 1: [0]})', PMarkov: 'PMarkov([0, 2, 4, 2, 0])', Pacc: 'Pacc("offbeat")',
    PSwing: 'PSwing(0.5)', PBin: 'PBin(16)', PFDur: 'PFDur((3, 8))', PLife: 'PLife(0.5)',
    PEuclid2: 'PEuclid2(3, 8, ".", "x")', PEuclidR: 'PEuclidR(8, 3, 1)', PFr: 'PFr(0, 7)', PGauss: 'PGauss(0, 1)', PArp: 'PArp([0, 4, 7], 5)',
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
    motif: 'motif(8, 7, 2)', arp: 'arp([0, 4, 7], "up", 2)',
};
const patItem = (n) => item(PATTERN_TEMPLATES[n] || (n + '('), 'hint-pattern', n);

const TIMEVAR_NAMES = ['var(','linvar(','sinvar(','expvar(','lininf(','expinf(','Pvar(','fperlin(','fi(','fo(','fb('];

// Shared list for value/degree positions: pattern generators (auto-grouped into
// families by toTree) then time-varying values. Timevars get their OWN separator
// so the "— patterns —" category is purely hint-pattern (→ family-grouped).
function patternValueItems() {
    return [
        sep('— patterns —'),
        ...PATTERN_NAMES.map(patItem),
        sep('— timevars —'),
        ...TIMEVAR_NAMES.map(n => item(n, 'hint-timevar', n.replace('(', ''))),
    ];
}

const GLOBALS = [
    'Clock.bpm = ','Scale.default = ','Root.default = ','play(',
    'drop(','soloRnd(','unsolo()','rest()','print(','loadsample(','loadpack(','defsynth(',
    'loop(','loadloop(','pbuild(','pkit(','genres()','chaos(','son()','soff()','linbpm(','dropbpm(',
    'say(','darker()','lighter()','shutup()','swap(','melody(',
    'midi(','midiin(','mlearn(','midiout(','link(',
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

    // Method after an identifier OR a closed call/bracket — so saw([0]).rev and
    // p1.pen both offer player methods (a `)`/`]` before the dot used to fall through).
    if (before.match(/(?:[a-zA-Z_]\w*|[)\]])\.$/))    return { type: 'method', word: '' };
    if (before.match(/(?:[a-zA-Z_]\w*|[)\]])\.\w+$/)) return { type: 'method', word };
    // `name >> ` — any player can be audio (a synth) OR video (a scene); offer both.
    // Capture the player name so a vN (video) name can float the visuals category up top.
    const rhsM = before.match(/([a-zA-Z_]\w*)\s*>>\s*[a-zA-Z_]*$/);
    if (rhsM) return { type: 'synth', word, player: rhsM[1] };
    const scaleM = before.match(/Scale\s*\.\s*default\s*=\s*["']([a-zA-Z]*)$/);
    if (scaleM) return { type: 'scale', word: scaleM[1] };

    // Are we inside an unclosed function call? Scan bracket depth so nested
    // chords/groups/arrays (which contain their own ")") don't fool us.
    const call = enclosingCall(before);
    if (call && call.fn) {
        // ── Visual language: scene(...) / mix(...) / palette(...) / vmode(...) ──
        const vfn = call.fn;
        if (vfn === 'palette') return { type: 'vnames', kind: 'palette', word };
        if (vfn === 'vmode')   return { type: 'vnames', kind: 'mode', word };
        if (VSCENE_SET.has(vfn) || vfn === 'mix') {
            const eqM = before.match(/([a-zA-Z_]\w*)\s*=\s*["']?[\w.]*$/);
            if (eqM) {
                if (eqM[1] === 'pal')   return { type: 'vnames', kind: 'palette', word };
                if (eqM[1] === 'mode')  return { type: 'vnames', kind: 'mode', word };
                if (eqM[1] === 'blend') return { type: 'vnames', kind: 'blend', word };
                return { type: 'value', word };                 // hue=, mix value → patterns/timevars
            }
            return { type: 'vparam', vfn, word };
        }
        // value position: right after `param=` → suggest patterns/timevars
        if (before.match(/[a-zA-Z_]\w*\s*=\s*[a-zA-Z_]*$/)) return { type: 'value', word };
        // First positional arg of a synth = the DEGREE → suggest pattern generators
        // (a degree can be PWalk(…)/PCircle(…)/var(…)…). Only before the first comma.
        if (SYNTH_NAMES.includes(call.fn) && call.open != null
                && !hasTopLevelComma(before.slice(call.open + 1))) {
            return { type: 'degree', synth: call.fn, word };
        }
        if (call.fn === 'play' || SYNTH_NAMES.includes(call.fn)) return { type: 'param', synth: call.fn, word };
        return { type: 'param', synth: null, word };
    }
    return { type: 'general', word };
}

// True if `s` contains a comma at bracket-depth 0 (so nested [..]/(..) commas
// don't count) — used to tell the first synth arg (degree) from later ones.
function hasTopLevelComma(s) {
    let depth = 0;
    for (const c of s) {
        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') depth--;
        else if (c === ',' && depth === 0) return true;
    }
    return false;
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
    return { fn: m ? m[1] : null, open: top.i };        // identifier before "(" → call
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
    let   wordStart = wordM ? cursor.ch - wordM[1].length : cursor.ch;
    let   typedWord = wordM ? wordM[1] : '';
    // Member access (player.method): complete only the part AFTER the last dot, so
    // p1. filters/inserts the method — not the whole "p1." (which matches nothing).
    const dotIdx = typedWord.lastIndexOf('.');
    if (dotIdx >= 0) { wordStart += dotIdx + 1; typedWord = typedWord.slice(dotIdx + 1); }
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
        // Synths are grouped into families (bass/lead/keys/…) so the list is
        // browsable; typing filters across all of them (dropEmptySeps prunes).
        // Audio synths (grouped by family) + a visuals category (scenes/mixer/fx) —
        // any player can be either; the RHS you pick decides. A scene pick inserts the
        // full knob call (sceneItem), like a synth. When the player is a vN (video by
        // convention), the visuals block floats to the TOP so it's the first thing offered.
        // Any player can be video (v1, x4, z2, video, …) — so scenes are ALWAYS listed
        // FLAT and directly choosable (audio synths stay compact under family flyouts).
        // Scenes float to the TOP when the name looks/behaves like video: a vN name, a
        // name containing "vid", or one that's already a live video layer.
        // Convention: VIDEO players are named video1, video2, … — they get the VIDEO
        // vocabulary (scenes + mix + fx, each scene pick inserting all its knobs like a
        // synth). Every other name (v1, d4, pad, bass, …) gets the MUSIC vocabulary.
        if (/^video\d*$/i.test(ctx.player || '')) {
            list = [...VSCENES.map(sceneItem),
                item('mix()', 'hint-keyword', 'mix'),
                ...VFX_NAMES.map(n => item(n + '()', 'hint-param', n))];
        } else {
            list = [playItem(), ...synthFamilyList()];
        }
        list = dropEmptySeps(list.filter(it => it.className === 'hint-sep' || filter([it]).length > 0));
    } else if (ctx.type === 'vparam') {
        const ps = ctx.vfn === 'mix' ? ['blend=', 'dur='] : VSCENE_PARAMS;
        list = filter(ps.map(p => item(p, 'hint-param', p.replace('=', ''))));
    } else if (ctx.type === 'vnames') {
        const names = ctx.kind === 'palette' ? PALETTE_NAMES : ctx.kind === 'mode' ? RENDER_MODE_NAMES : BLEND_NAMES;
        list = filter(names.map(n => item(`"${n}"`, 'hint-param', n)));
    } else if (ctx.type === 'scale') {
        list = filter(SCALE_NAMES.map(n => item(`"${n}"`, 'hint-param', n)));
    } else if (ctx.type === 'value') {
        // After `param=` — suggest pattern / timevar values
        list = dropEmptySeps(patternValueItems().filter(it => it.className === "hint-sep" || filter([it]).length > 0));
    } else if (ctx.type === 'degree') {
        // First positional arg of a synth = the DEGREE. Pattern generators / timevars
        // first (a degree can be a pattern), then the synth's params + fx so those
        // stay reachable too.
        const params = Object.keys(SYNTH_DEFS[ctx.synth]?.defaults ?? {}).map(p => item(p + '=', 'hint-param', p));
        list = [
            ...patternValueItems(),
            sep('— params —'), ...params,
            sep('— fx (full) —'), ...FX_GROUPS.map(fxItem),
        ];
        list = dropEmptySeps(list.filter(it => it.className === 'hint-sep' || filter([it]).length > 0));
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
            ...patternValueItems(),
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

// Hint function for the synth menu that auto-opens after a player name is
// inserted. Uses the SAME family-grouped list as the `p1 >> ` synth context, so
// the menu is identical whether it auto-opened or you triggered it yourself
// (previously this showed a flat, un-categorised list — the inconsistency).
function synthHint(cm) {
    const cursor = cm.getCursor();
    const before = cm.getLine(cursor.line).slice(0, cursor.ch);
    const wordM  = before.match(/([a-zA-Z_]\w*)$/);
    const word   = wordM ? wordM[1] : '';
    const lw     = word.toLowerCase();
    const from   = { line: cursor.line, ch: cursor.ch - word.length };
    let list = [playItem(), ...synthFamilyList()];
    list = dropEmptySeps(list.filter(it =>
        it.className === 'hint-sep' || !word || (it.displayText ?? it.text).toLowerCase().startsWith(lw)));
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

// Split a list of items into family sub-categories (by displayText) + an "other"
// bucket. Used for both fx (FX_SUBCATS) and synths (SYNTH_SUBCATS).
function groupByFamily(items, families) {
    const byName = new Map(items.map(it => [it.displayText, it]));
    const used = new Set(), cats = [];
    for (const [label, names] of families) {
        const kids = names.filter(n => byName.has(n)).map(n => { used.add(n); return leaf(byName.get(n)); });
        if (kids.length) cats.push({ kind: 'cat', label, children: kids });
    }
    const rest = items.filter(it => !used.has(it.displayText)).map(leaf);
    if (rest.length) cats.push({ kind: 'cat', label: 'other', children: rest });
    return cats;
}

// Collapse needless nesting so single options don't require a submenu:
//  - a lone wrapping category unwraps to its children (recursively);
//  - a category with a single leaf child becomes that leaf.
function collapse(nodes) {
    while (nodes.length === 1 && nodes[0].kind === 'cat') nodes = nodes[0].children;
    return nodes.map(n => {
        if (n.kind !== 'cat') return n;
        const kids = collapse(n.children);
        if (kids.length === 1 && kids[0].kind === 'leaf') return kids[0];
        return { ...n, children: kids };
    });
}

// Build the node tree from hintFn's flat {list}. `subgroup` nests the fx/synth
// categories into families (skipped while type-filtering, so matches stay flat).
function toTree(list, subgroup) {
    const roots = []; let cur = null;
    for (const it of list) {
        if (it.className === 'hint-sep') { cur = { label: cleanLabel(it.displayText), items: [] }; roots.push(cur); }
        else if (cur) cur.items.push(it);
        else roots.push(leaf(it));
    }
    const tree = roots.map(node => {
        if (node.kind === 'leaf') return node;
        const allFx    = node.items.length > 1  && node.items.every(i => i.className === 'hint-fx');
        // Only auto-group a BIG flat synth list (the general context's "synths"
        // category). The synth-after->> context emits its own family seps, which
        // are already small — don't re-group those into families-of-one.
        const allSynth = node.items.length > 10 && node.items.every(i => i.className === 'hint-synth');
        const allPat   = node.items.length > 10 && node.items.every(i => i.className === 'hint-pattern');
        const children = (subgroup && allFx)    ? groupByFamily(node.items, FX_SUBCATS)
                       : (subgroup && allSynth) ? groupByFamily(node.items, SYNTH_SUBCATS)
                       : (subgroup && allPat)   ? groupByFamily(node.items, PATTERN_SUBCATS)
                       : node.items.map(leaf);
        return { kind: 'cat', label: node.label, children };
    });
    return collapse(tree);
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
            // position:fixed → use viewport ('window') coords so where the menu is
            // PAINTED matches where the browser hit-tests a click (page/scroll coords
            // desynced the two, so clicks landed on the element behind the menu).
            const c = s.cm.cursorCoords(s.from, 'window');
            div.style.top = c.bottom + 'px'; div.style.left = c.left + 'px';
        } else {
            const a = s.colEls[i - 1][s.cols[i - 1].sel].getBoundingClientRect();
            div.style.top = a.top + 'px';
            div.style.left = (a.right + 2) + 'px';
            if (a.right + div.offsetWidth + 6 > window.innerWidth) div.style.left = (a.left - div.offsetWidth - 2) + 'px';
        }
        // Keep the active row visible when the column overflows (scroll the div,
        // not the page) — so ↑/↓ past the fold works and wrap-around is visible.
        const arow = rows[col.sel];
        if (arow) {
            const rt = arow.offsetTop, rb = rt + arow.offsetHeight;
            if (rt < div.scrollTop) div.scrollTop = rt;
            else if (rb > div.scrollTop + div.clientHeight) div.scrollTop = rb - div.clientHeight;
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
    cm.focus();   // keep the editor active so the very next Ctrl+Enter lands on the line
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
    s.onDocDown = (e) => {
        // If the event target is a menu element, the row's own mousedown handles it.
        if (s.colDivs.some(d => d.contains(e.target))) return;
        // Otherwise the target may have mis-resolved (a body-appended popup can hit-test
        // to <body> in some browsers, so the row handler never fires and the click is
        // lost). Fall back to COORDINATES: if the click lands on a row, pick it there.
        for (let ci = (s.colEls || []).length - 1; ci >= 0; ci--) {
            const rows = s.colEls[ci];
            for (let ri = 0; ri < rows.length; ri++) {
                const r = rows[ri].getBoundingClientRect();
                if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
                    e.preventDefault(); clickRow(s, ci, ri); return;
                }
            }
        }
        closeMenu();   // genuinely outside the menu
    };
    setTimeout(() => document.addEventListener('mousedown', s.onDocDown, true), 0);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function triggerAutocomplete(cm) { openMenu(cm, hintFn); }
