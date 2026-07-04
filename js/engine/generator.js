// Generative players — chaos() (one-shot burst) and the building blocks a future
// son()/soff() bot will reuse (see generator-spec.md). Pure: it only BUILDS code
// lines; the caller runs them through runCode (so they also broadcast to peers).

import { SYNTH_DEFS } from '../synths/registry.js';

const pick   = (a) => a[Math.floor(Math.random() * a.length)];
const rint   = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const chance = (p) => Math.random() < p;

// Melodic/tonal synths worth generating (skip the sampler/loop/master helpers).
const GEN_SYNTHS = Object.keys(SYNTH_DEFS)
    .filter(n => !/sampler|loop|master|fx/.test(n));

function randDegrees() {
    const n = pick([2, 3, 4, 4, 5, 8]);
    const out = [];
    for (let i = 0; i < n; i++) {
        if (chance(0.15))      out.push('(' + [0, rint(2, 4), rint(4, 7)].join(',') + ')'); // chord
        else if (chance(0.1))  out.push('.');                                               // rest
        else                   out.push(rint(0, 7));
    }
    return '[' + out.join(', ') + ']';
}

function randFx() {
    return pick([
        `lpf=${rint(400, 6000)}`,
        `mverb=${(0.2 + Math.random() * 0.5).toFixed(2)}`,
        `room=${(0.4 + Math.random() * 0.5).toFixed(2)}, reverb=${(0.3 + Math.random() * 0.4).toFixed(2)}`,
        `chorus=${(0.3 + Math.random() * 0.5).toFixed(2)}`,
        `drive=${(1 + Math.random() * 4).toFixed(1)}, tanh=${(0.3 + Math.random() * 0.4).toFixed(2)}`,
        `echo=${(0.2 + Math.random() * 0.4).toFixed(2)}, echo_time=${pick(['0.25', '0.375', '0.5'])}`,
    ]);
}

function synthLine(name) {
    const synth = pick(GEN_SYNTHS);
    const dur   = pick(['1/4', '1/2', '1', '1', '2']);
    const oct   = pick([3, 4, 4, 5, 5, 6]);
    const amp   = (0.3 + Math.random() * 0.35).toFixed(2);
    const fx    = chance(0.6) ? ', ' + randFx() : '';
    const uni   = chance(0.3) ? '.unison(2)' : '';
    return `${name} >> ${synth}(${randDegrees()}, oct=${oct}, dur=${dur}, amp=${amp}${fx})${uni}`;
}

function drumLine(name, chars) {
    const len = pick([4, 8, 8]);
    let s = '';
    for (let i = 0; i < len; i++) s += chance(0.5) ? '.' : pick(chars);
    if (!/[^.]/.test(s)) s = pick(chars) + s.slice(1);   // ensure at least one hit
    const fx = chance(0.3) ? ', ' + randFx() : '';
    return `${name} >> play("${s}", amp=${(0.5 + Math.random() * 0.4).toFixed(2)}${fx})`;
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
