// Generative players — chaos() (one-shot burst) and the building blocks a future
// son()/soff() bot will reuse (see generator-spec.md). Pure: it only BUILDS code
// lines; the caller runs them through runCode (so they also broadcast to peers).

import { SYNTH_DEFS } from '../synths/registry.js';

const pick   = (a) => a[Math.floor(Math.random() * a.length)];
const rint   = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const chance = (p) => Math.random() < p;
const flt    = (lo, hi, d = 2) => (lo + Math.random() * (hi - lo)).toFixed(d);
// pick n DISTINCT thunks from a list and call each (so we never emit lpf= twice).
const pickN  = (a, n) => { const c = [...a], out = []; for (let i = 0; i < n && c.length; i++) out.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]); return out; };

// Melodic/tonal synths worth generating (skip the sampler/loop/master helpers).
const GEN_SYNTHS = Object.keys(SYNTH_DEFS).filter(n => !/sampler|loop|master|fx/.test(n));

// Rough role → so we pick musically-appropriate patterns/octaves per synth.
const ROLES = {
    bass:  ['dbass', 'bass', 'ebass', 'acidbass', 'pumpbass', 'tb303', 'a_gesa', 'a_daft'],
    lead:  ['saw', 'ssaw', 'pulse', 'blip', 'hoover', 'prophet', 'cs80', 'plaits', 'faim', 'fm'],
    pad:   ['pads', 'choir', 'brass', 'organ'],
    keys:  ['bell', 'basic', 'karp'],
    pluck: ['pluck', 'moogpluck', 'guit', 'donk', 'lapin'],
};
const roleOf = (n) => { for (const [r, list] of Object.entries(ROLES)) if (list.includes(n)) return r; return 'lead'; };

const CHORDLIST = () => pick(['[0,4,7]', '[0,3,7]', '[0,4,7,11]', '[0,2,4,7]', '[0,3,5,7]', '[0,4,7,10]']);
const ROMAN     = () => pick(['"I V vi IV"', '"i VI III VII"', '"ii V I"', '"I vi IV V"', '"i iv VII"', '"i iv v"']);
const randList  = (n, lo, hi) => '[' + Array.from({ length: n }, () => rint(lo, hi)).join(', ') + ']';

// Degree strategies — the clever bit: draw widely from the pattern library per role.
function degBass() {
    return pick([`[0]`, `[0, 0, ${rint(3, 7)}, 0]`, `[0, ${rint(-3, 0)}, ${rint(3, 7)}, 0]`,
                 `PRange(0, 4)`, randList(rint(2, 4), 0, 5), `[0, {0, 3, 5}]`,
                 `PWalk(4, 1)`, `PxRand(0, 5)`, `[0, <0 5>, ${rint(2, 5)}, 0]`, `PStep(4, ${rint(3, 7)}, 0)`]);
}
function degLead() {
    return pick([`arp(${CHORDLIST()}, "${pick(['up', 'down', 'updown', 'downup'])}")`, `PArp(${CHORDLIST()}, ${rint(0, 9)})`,
                 `PGrowArp(${CHORDLIST()})`, `melody()[:${rint(4, 8)}]`, `motif(${rint(3, 5)})`,
                 `PContour(${rint(0, 4)}, 8, 7)`, `PContour(${randList(rint(3, 5), 0, 7)}, 8, 7)`,
                 `PRange(0, ${rint(5, 12)})`, `PCircle(8)`, `PWalk(${rint(5, 9)}, 1)`, `PxRand(0, ${rint(6, 10)})`,
                 `PShuf(${CHORDLIST()})`, `PStutter(${randList(rint(3, 4), 0, 7)}, 2)`, `PAlt(${randList(2, 0, 4)}, ${randList(2, 4, 9)})`,
                 `P*${randList(rint(3, 5), 0, 9)}`, randList(rint(3, 6), 0, 9)]);
}
function degPad() {
    return pick([`PRoman(${ROMAN()})`, `PProg("${pick(['50s', '251', 'pop', 'andalusian', 'canon'])}")`,
                 `PChord(0, "${pick(['7', '9', 'sus4', 'add9', '11'])}")`, `PCircle(8, 0, "7")`,
                 `[0, (0,4,7), 5, (2,5,9)]`, `(0,4,7,11)`, `PZip(${CHORDLIST()}, ${randList(3, 4, 9)})`]);
}
const degForRole = (role) => role === 'bass' ? degBass()
    : (role === 'pad' || role === 'keys') ? degPad()
    : role === 'pluck' ? (chance(0.5) ? degLead() : pick([`PCircle(8)`, `arp(${CHORDLIST()}, "up")`, `PGrowArp(${CHORDLIST()})`, randList(rint(3, 6), 0, 9)]))
    : degLead();

const durForRole = (role) => role === 'bass' ? pick(['1/2', '1', '1', '2', 'PDur(3,8)', 'PDur(<3,5>,8)'])
    : (role === 'pad' || role === 'keys') ? pick(['2', '4', '4', '1', '<2 4>'])
    : pick(['1/4', '1/4', '1/2', 'PDur(3,8)', `PDur(<3,5>,8)`, 'PGroove("swing")', 'PGroove("gallop")', 'PBeat("x xx x")', '<1/4 1/2>']);
// oct — usually a number, sometimes an alternation for movement.
const octForRole = (role) => {
    const base = role === 'bass' ? [3, 3, 4] : role === 'pluck' ? [5, 6] : (role === 'pad' || role === 'keys') ? [4, 5] : [5, 5, 6];
    if (chance(0.18)) { const a = pick(base); return `<${a} ${a + 1}>`; }
    return String(pick(base));
};
// amp — usually a float, sometimes a random/accent pattern for dynamics.
const ampForRole = (role) => {
    const lo = role === 'bass' ? 0.5 : (role === 'pad' || role === 'keys') ? 0.3 : 0.28;
    const hi = role === 'bass' ? 0.8 : (role === 'pad' || role === 'keys') ? 0.45 : 0.42;
    if (chance(0.2)) return `PWhite(${flt(lo, lo + 0.1)}, ${flt(hi - 0.05, hi)})`;
    if (chance(0.12)) return `Pacc("${pick(['offbeat', 'ghost', 'backbeat'])}")`;
    return flt(lo, hi);
};
// Occasional extra param that is itself a pattern/timevar — pan movement, a transpose.
const panExtra = () => !chance(0.3) ? '' : ', ' + pick([
    `pan=PGauss(0, ${flt(0.3, 0.6)})`, `pan=sinvar([-1, 1], [${pick([8, 16])}])`, `pan=PWhite(-0.7, 0.7)`, `pan=<-0.5 0.5>`,
]);
const transposeExtra = () => !chance(0.22) ? '' : ' + ' + pick([`${rint(2, 7)}`, `(0,4,7)`, `(0,3,7)`, `<0 ${rint(2, 5)}>`]);

// FX ideas — a broad palette; many use a TimeVar sweep so the sound moves. Each
// is a distinct thunk (pickN never picks the same one twice, so no doubled keys).
const FX = [
    () => `lpf=linvar([${rint(300, 800)}, ${rint(2500, 6000)}], [${pick([8, 16])}])`,
    () => `lpf=sinvar([${rint(400, 900)}, ${rint(2500, 5000)}], [${pick([4, 8])}]), lpf_rq=${flt(0.2, 0.6)}`,
    () => `hpf=${rint(200, 1200)}`,
    () => `bpf=${rint(600, 3000)}, bpf_rq=${flt(0.1, 0.5)}`,
    () => `djf=${pick([flt(0.15, 0.4), flt(0.6, 0.85)])}`,
    () => `mverb=${flt(0.3, 0.7)}, mverbmix=0.6`,
    () => `room=${flt(0.5, 0.9)}, reverb=${flt(0.3, 0.6)}`,
    () => `cheapverb=${flt(0.4, 0.7)}`,
    () => `chorus=${flt(0.3, 0.7)}, chorus_rate=${flt(0.2, 0.8)}`,
    () => `echo=${flt(0.2, 0.5)}, echo_time=${pick(['0.25', '0.375', '0.5'])}`,
    () => `fbdelay=${flt(0.4, 0.6)}, fbtime=0.25, fbfeed=${flt(0.3, 0.6)}, fbcutoff=3000`,
    () => `pong=${flt(0.3, 0.6)}, pongtime=${pick(['0.25', '0.375'])}`,
    () => `spin=${flt(0.4, 0.8)}`,
    () => `chop=${pick([2, 4, 4, 8])}`,
    () => `rgate=${flt(0.5, 0.9)}, rgaterate=${pick([4, 8])}`,
    () => `tremolo=${flt(0.4, 0.7)}, trem_rate=${pick([4, 8])}`,
    () => `vibrato=${flt(0.4, 0.8)}, vib_rate=${rint(4, 8)}`,
    () => `flanger=${flt(0.4, 0.7)}, flanger_rate=${flt(0.2, 0.6)}`,
    () => `phaser=${flt(0.4, 0.7)}, phaser_rate=${flt(0.2, 0.6)}`,
    () => `ringmod=${flt(0.3, 0.6)}, ringmod_freq=${rint(100, 900)}`,
    () => `formant=${flt(0.4, 0.8)}, formant_vowel=${rint(0, 4)}`,
    () => `vowel=${flt(0.4, 0.7)}`,
    () => `drive=${flt(1, 5, 1)}, tanh=${flt(0.3, 0.6)}`,
    () => `shape=${flt(0.4, 0.7)}`,
    () => `dist2=${flt(0.4, 0.7)}, dist2shape=${flt(0.1, 0.5)}`,
    () => `crush=${flt(0.4, 0.7)}, bits=${rint(3, 8)}`,
    () => `multicrush=${flt(0.4, 0.7)}`,
    () => `fold=${flt(0.3, 0.6)}, symetry=${rint(1, 3)}`,
    () => `lofi=${flt(0.4, 0.7)}`,
    () => `tube=${flt(0.4, 0.8)}`,
    () => `resonbank=${flt(0.2, 0.4)}, rbfreq=${rint(40, 80)}`,
    () => `eq3=1, eqlow=${rint(-4, 5)}, eqhigh=${rint(-4, 5)}`,
];
// Live transforms + fatteners chained onto the player.
const METHODS = [
    () => `.every(${pick([4, 8, 8, 16])}, "${pick(['rotate', 'reverse', 'mirror'])}")`,
    () => `.sometimes("${pick(['stutter', 'mirror', 'reverse'])}"${chance(0.5) ? ', ' + rint(2, 4) : ''})`,
    () => `.unison(${pick([2, 2, 3, 4])}${chance(0.4) ? ', ' + flt(0.2, 0.5) : ''})`,
    () => `.penta()`,
    () => `.human(${rint(15, 35)}, ${rint(4, 10)})`,
];

function synthLine(name) {
    const synth = pick(GEN_SYNTHS);
    const role  = roleOf(synth);
    const fxN   = chance(0.78) ? (chance(0.4) ? 2 : 1) : 0;
    const fx    = fxN ? ', ' + pickN(FX, fxN).map(f => f()).join(', ') : '';
    const mN    = chance(0.6) ? (chance(0.3) ? 2 : 1) : 0;
    const meth  = pickN(METHODS, mN).map(f => f()).join('');
    return `${name} >> ${synth}(${degForRole(role)}, oct=${octForRole(role)}, dur=${durForRole(role)}, amp=${ampForRole(role)}${panExtra()}${fx})${meth}${transposeExtra()}`;
}

function drumLine(name, chars) {
    const hit = () => pick(chars);
    let patt;
    if (chance(0.4)) {
        // a Euclidean drum pattern using a real loaded char
        patt = `PEuclid2(${rint(3, 5)}, ${pick([8, 16])}, ".", "${hit()}")`;
        patt = `play(${patt}`;
    } else {
        // a hand-rolled string, sometimes with a [subdivided] or (layered) step
        const len = pick([8, 8, 16]); let s = '';
        for (let i = 0; i < len; i++) {
            if (chance(0.12) && i < len - 1) s += '[' + hit() + hit() + ']';
            else if (chance(0.08)) s += '(' + hit() + hit() + ')';
            else s += chance(0.5) ? '.' : hit();
        }
        if (!/[^.[\]()]/.test(s)) s = hit() + s.slice(1);
        patt = `play("${s}"`;
    }
    const dur  = pick(['1/4', '1/2', '1/2']);
    const fx   = chance(0.35) ? ', ' + pick(FX)() : '';
    const meth = chance(0.3) ? `.sometimes("stutter", ${rint(2, 4)})` : '';
    return `${name} >> ${patt}, dur=${dur}, amp=${flt(0.55, 0.9)}${fx})${meth}`;
}

// Generate `n` random player lines. type: 'synth' | 'drum' | null (mix).
// opts: { sampleChars: [...], taken: Set<existing names> } → names avoid collisions.
export function chaosLines(n = 4, type = null, { sampleChars = [], taken = new Set() } = {}) {
    const lines = [];
    let idx = 1;
    const freeName = () => { while (taken.has('g' + idx)) idx++; const nm = 'g' + idx; taken.add(nm); idx++; return nm; };
    for (let i = 0; i < Math.max(1, n | 0); i++) {
        let t = type;
        if (!t) t = (sampleChars.length && chance(0.35)) ? 'drum' : 'synth';
        const name = freeName();
        lines.push(t === 'drum' && sampleChars.length ? drumLine(name, sampleChars) : synthLine(name));
    }
    return lines;
}

// ── son() / soff() — generative jam bot ───────────────────────────────────────
// A self-rescheduling bot that adds / stops / mutates its own `g*` players over
// time (kept apart from the user's players so it never fights manual code). Every
// line runs through `run` (= runCode) so in a session the bot's output broadcasts
// to peers automatically. See generator-spec.md. Dependencies are injected so this
// module stays pure/testable: { clock, run, sampleChars }.
// FX trigger params only (each activates its own effect node); single-value so
// they work as a live `gN.<param> = <value>` mutation line.
const FX_MUTATE = [
    () => ['lpf', rint(400, 6000)],
    () => ['hpf', rint(200, 2000)],
    () => ['bpf', rint(600, 4000)],
    () => ['mverb', (0.2 + Math.random() * 0.5).toFixed(2)],
    () => ['reverb', (0.3 + Math.random() * 0.4).toFixed(2)],
    () => ['chorus', (0.3 + Math.random() * 0.5).toFixed(2)],
    () => ['tanh', (0.3 + Math.random() * 0.5).toFixed(2)],
    () => ['echo', (0.2 + Math.random() * 0.4).toFixed(2)],
    () => ['crush', (0.4 + Math.random() * 0.5).toFixed(2)],
];

export class JamBot {
    constructor({ clock, run, sampleChars = () => [], prefix = 'g' } = {}) {
        this.clock = clock; this.run = run; this.sampleChars = sampleChars; this.prefix = prefix;
        this.running = false;
        this.active = new Set();   // generated player names currently live
        this.born   = new Map();   // name → tick it was created (so fresh ones survive)
        this.tick   = 0;
        this.opts   = {};
    }

    start(opts = {}) {
        // max is a HARD cap on the bot's own g* players (your manual players don't
        // count). Default 3–5 — it keeps turning voices over to stay under it.
        this.opts = { synth: 0.5, drum: 0.35, min: 3, max: 5, every: [2, 6], ...opts };
        if (this.opts.max < 1) this.opts.max = 1;
        if (this.opts.min > this.opts.max) this.opts.min = this.opts.max;
        if (this.running) return `jam bot already running (${this.active.size} players)`;
        this.running = true;
        this._next();
        return `jam bot on — g* players, ${this.opts.min}–${this.opts.max} voices`;
    }

    stop(clearPlayers = false) {
        this.running = false;
        if (clearPlayers) { for (const n of [...this.active]) this._stopByName(n); }
        return 'jam bot off' + (clearPlayers ? ' (players stopped)' : '');
    }

    _next() {
        const [lo, hi] = this.opts.every;
        const dur = lo + Math.random() * Math.max(0, hi - lo);
        this.clock.future(dur, () => { if (this.running) { try { this._order(); } catch (e) { /* keep the loop alive */ } this._next(); } });
    }

    _order() {
        this.tick++;
        // Prune names whose players the user/Alt+X stopped out from under us.
        for (const n of [...this.active]) { const p = this.clock._players.get(n); if (!p || p._active === false) this._forget(n); }
        const n = this.active.size;
        if (n >= this.opts.max) {
            // At the hard cap → make room by retiring a voice (even a fresh one), or
            // just tweak an existing one. NEVER add.
            if (Math.random() < 0.55) this._stopOne(true);
            else if (Math.random() < 0.5) this._mutate();
            else this._fx();
            return;
        }
        if (n < this.opts.min) { this._add(); return; }
        // In-band: mostly add/tweak, but regularly stop one so voices keep turning over.
        const action = pick(['add', 'add', 'stop', 'stop', 'mutate', 'mutate', 'fx', 'fx']);
        if (action === 'add') this._add();
        else if (action === 'stop') this._stopOne();
        else if (action === 'mutate') this._mutate();
        else this._fx();
    }

    _freeName() {
        let i = 1; while (this.active.has(this.prefix + i) || this.clock._players.get(this.prefix + i)) i++;
        return this.prefix + i;
    }

    _add() {
        if (this.active.size >= this.opts.max) return;
        const name  = this._freeName();
        const chars = this.sampleChars();
        const wantDrum = chars.length && Math.random() < this.opts.drum / (this.opts.synth + this.opts.drum);
        const line = wantDrum ? drumLine(name, chars) : synthLine(name);
        this.active.add(name); this.born.set(name, this.tick);
        this.run(line);
    }

    _stopOne(force = false) {
        // Prefer retiring players that have lived a couple ticks (let fresh ones
        // breathe). At the cap (force) we retire even a fresh one to make room.
        let pool = [...this.active].filter(n => this.tick - (this.born.get(n) ?? this.tick) >= 2);
        if (!pool.length && force) pool = [...this.active];
        if (pool.length) this._stopByName(pick(pool));
    }

    _stopByName(name) {
        const p = this.clock._players.get(name);
        if (p) p.stop();
        this._forget(name);
    }

    _forget(name) { this.active.delete(name); this.born.delete(name); }

    _live() { return [...this.active]; }

    _mutate() {
        const names = this._live(); if (!names.length) return this._add();
        const name = pick(names);
        const attr = pick(['amp', 'oct', 'dur', 'degree']);
        let v;
        if (attr === 'amp')  v = (0.25 + Math.random() * 0.4).toFixed(2);
        else if (attr === 'oct') v = pick([3, 4, 4, 5, 5, 6]);
        else if (attr === 'dur') v = pick(['1/4', '1/2', '1', '2']);
        else v = randDegrees();
        this.run(`${name}.${attr} = ${v}`);
    }

    _fx() {
        const names = this._live(); if (!names.length) return this._add();
        const [k, v] = pick(FX_MUTATE)();
        this.run(`${pick(names)}.${k} = ${v}`);
    }
}
