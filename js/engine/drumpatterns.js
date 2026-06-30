// Genre-aware drum-pattern generator — port of FoxDot's DrumPatterns (pbuild).
//
//   b1 >> play(pbuild("techno"), dur=0.25)
//   b1 >> play(pbuild("techno", evolve=8, fill=4, density=0.8), dur=0.25)
//   b1 >> play(pbuild("techno", 4), dur=0.25)        # positional: evolve=4
//   kit = pkit("house");  b1 >> play(kit.kick, dur=0.25);  b2 >> play(kit.hat, dur=0.25)
//
// pbuild(genre, opts) returns a play() string. Each genre defines kick/snare/hat/
// perc layers (16-step variations); a kit picks one per layer and merges them by
// priority into one string. `evolve` concatenates N mutated bars so the groove
// drifts; `fill` drops a fill every N bars; `density` (0..1) thins hits; `mute`
// silences layers; per-layer overrides (kick="X  x ", hat="dnb") replace a layer.
// Char map follows play(): X/x kick · o/O/*/u snare/clap · -/= hats · t/s/+/:/~ perc.

const _genres = {"techno": {"kick": ["X   X   X   X   ", "X   X   X  XX   ", "X     X X   X   ", "X   X   X   X X ", "X  X  X X  X  X ", "X   X    X  X   ", "X  X    X   X   ", "X   X   X X X   ", "X     X X     X ", "X   X  XX   X  X", "X  XX   X   X   ", "X   X X   X X   "], "snare": ["    o       o   ", "    *       *   ", "    o     o o   ", "    *   o   *   ", "    o      oo   ", "  o     o   o   ", "    o  o    o   ", "    *     * *   ", "    o   o   o   ", "  o o       o   ", "    *  o    *  o", "    o       o  o"], "hat": ["-.-.-.-.-.-.-.--", "----------------", "-.-.--=--.-.--=-", "--.--.---.------", "-.---.-.-.---.--", "--=---=---=---=-", "-.-.-.---.-.-.--", "---.-.-----.-.--", "-.--=-.--.--=-.-", "-.-.-.-.-.-=-.--", "=.-.=.-.=.-.=.--", "-...-..-...-..-."], "perc": ["                ", "  t   t   t   t ", "s   s   s   s   ", "    +     + +   ", "  :   :   :  :  ", "t     t     t   ", "  s     s     s ", "+   + +   +   + ", "  : :   : :   : ", "    t       t   "]}, "ebm": {"kick": ["X   X   X   X   ", "X X X X X X X X ", "X  XX   X  XX   ", "X X X   X X X   ", "X   X X X   X X ", "X X   X X X   X ", "XX  X   XX  X   ", "X  XX  XX  XX   ", "X X X X   X X X ", "X   XX  X   XX  ", "XX  XX    XX  XX", "X X   X X   X X "], "snare": ["    O       O   ", "    *       *   ", "    O     O O   ", "   oO      oO   ", "    O  o    O  o", "    *  *    *   ", "    O   *   O   ", "  o O   o   O   ", "    O o     O o ", "    *   o  o*   ", "   oO  o   oO   ", "    O     o O  o"], "hat": ["-.-.-.-.-.-.-.--", "----------------", "-.--.---.-.--.--", "-.-.-=-.-.-.-=-.", "-.---.---.---.--", "---.---.-.--.---", "-.-.-.-.---.-.--", "--=--.----=--.--"], "perc": ["                ", "  t   t   t   t ", "+  + +  +  + +  ", "  r   r   r   r ", "+   +   +   + + ", "t t   t t t   t "]}, "dnb": {"kick": ["X     X   X     ", "X       X   X   ", "X     X    X    ", "X  X      X     ", "X       X     X ", "X   X     X     ", "X      X  X     ", "X  X       X    ", "X     X       X ", "X        X  X   ", "X   X       X   ", "X  X    X       "], "snare": ["    o       o   ", "    o       o o ", "    o     o o   ", "   uo      uo   ", "    o  u    o u ", "    o       o  u", "    o  o    o   ", "   uo       o o ", "    o u     o   ", "    o     u o   ", "    o  u   uo   ", "    o   u   o u "], "hat": ["-.-.-.-.-.-.-.--", "-.---.-.-.---.--", "--=---=---=---=-", "-.-.=.-.-.-.=.--", "-.--.-=--.--.-=-", "=.-.-.=.-.-.-.=-", "-.-.-.---.-.-.--", "-.--=.-.-.--=.--"], "perc": ["                ", "  ~   ~   ~   ~ ", "    s     s s   ", "~     ~     ~   ", "  s   s       s ", "  ~ ~   ~ ~   ~ "]}, "house": {"kick": ["X   X   X   X   ", "X   X   X   X X ", "X   X  XX   X   ", "X   X   X  XX   ", "X   X X X   X   ", "X  XX   X   X   ", "X   X   X   XX  ", "X   X  XX   X X "], "snare": ["    *       *   ", "    H       H   ", "    *   *   *   ", "    *       * * ", "    H   *   H   ", "    *  *    *   ", "    H     * H   ", "    *   H   *   "], "hat": ["-.-.-.-.-.-.-.--", "--=---=---=---=-", "================", "-.--.-=--.--.-=-", "-.-.=.-.-.-.=.--", "=-.-=-=-.-.-=-=-", "-=.-=.-=-=.-=.--", "-.-.-.-=-.-.-.=-"], "perc": ["                ", "s s s s s s s s ", "  +   +   +   + ", "s   s   s   s   ", "  + + +   + + + ", "s     s s     s ", "  +   + +   +   "]}, "breaks": {"kick": ["X  X    X  X    ", "X     X  X      ", "X  X      X   X ", "X       X  X    ", "X    X  X       ", "X  X  X     X   ", "X       X X     ", "X  X       X  X ", "X     X     X   ", "X  X    X    X  "], "snare": ["    o  o    o   ", "    o   o  oo   ", "   oo       o o ", "    o o     o o ", "    o  o   oo   ", "   oo  o    o   ", "    o o  o  o   ", "    o  oo   o o ", "   oo   o   o   ", "    o o     oo  "], "hat": ["-.-.-.-.-.-.-.--", "-.---.-.-.---.--", "--=--.-.--=--.--", "-.-.-.---.-.-.--", "-.--=-.--.--=-.-", "-.---.---.---.--", "--.--.-.--.--.--"], "perc": ["                ", "  t     t   t   ", "  ~ ~ ~   ~ ~ ~ ", "t   t   t     t ", "  ~     ~   ~   ", "  t ~ t   t ~ t "]}, "halftime": {"kick": ["X       X       ", "X         X     ", "X       X    X  ", "X           X   ", "X     X         ", "X       X     X ", "X          X    ", "X   X           "], "snare": ["        o       ", "        o     o ", "    u   o       ", "        o   u   ", "        o  o    ", "    u   o     u ", "        *       ", "        o u     "], "hat": ["-.-.-.-.-.-.-.--", "-.--.--.-.--.---", "-.-.-=-.-.-.-=-.", "-.---.-.-.---.--", "-.--.-.--.--.---", "-.-.-.---.-.-.--"], "perc": ["                ", "  s   s   s   s ", "s       s       ", "    ~       ~   ", "  s     s     s "]}, "industrial": {"kick": ["X X X X X X X X ", "X  XX  XX  XX  X", "X X X   X X X X ", "XX  XX  XX  XX  ", "XXX   XXX   XXX ", "X XX  X XX  X XX", "X X XX  X X XX  ", "XX XX XX XX XX X", "X  XX X X  XX X ", "X X   XXX X   XX", "XX  X X XX  X X ", "X XXX   X XXX   "], "snare": ["    O       O   ", "    *   O   *   ", "  o O     o O   ", "    O O     O O ", "    *  O    *  O", "  O *     O *   ", "    O   *  oO   ", "  o O  *  o O  *", "    O o   O O o ", "    * O o   * O "], "hat": ["----------------", "-.-.-.-.-.-.-.--", "---.---.---.---.", "-.---.---.---.--", "----.-----.--.--", "-.-.---.-.-.---.", "--.--.--.--.--.."], "perc": ["                ", "r r r r r r r r ", "  +   + +   + + ", "K   K   K   K   ", "r   r r   r r r ", "+ + +   + + +   ", "K K   K K K   K ", "  r +   r +   r "]}, "reggae": {"kick": ["X       X       ", "X  X    X       ", "X     X X       ", "X       X   X   ", "X  X        X   ", "X     X   X     ", "X       X  X    ", "X   X   X       "], "snare": ["   o       o    ", "   *       *    ", "   o     o o    ", "   o  o    o    ", "   *     * *    ", "   o       o  o ", "   o   o   o    ", "   *  o    *  o "], "hat": [" - - - - - - - -", " -=- -=- -=- -=-", " - -=- - - -=- -", " -=- - - -=- - -", " - - -=- - - -=-", " --=- --=- --=- "], "perc": ["                ", "  s   s   s   s ", "t   t   t   t   ", "s     s s     s ", "  t   t     t   ", "s   s     s   s "]}, "afro": {"kick": ["X  X  X   X   X ", "X    XX  X    X ", "X  X   X  X  X  ", "X   X  X  X     ", "X  X    X   X   ", "X    X  X  X    ", "X  X  X     X  X", "X     X X  X    ", "X  X   X    X   ", "X    X    X  X  "], "snare": ["    o     o     ", "   o  o  o  o   ", "    o   o   o o ", "  o   o     o   ", "    o  o  o     ", "   o    o   o   ", "    o     o  o  ", "  o o   o   o   ", "    o  o    o o ", "   o  o   o   o "], "hat": ["-.-.-.-.-.-.-.--", "-.--.-.--.--.---", "-.---.-.-.---.--", "-.--.--.-.--.---", "-.-.---.-.-.---.", "-.--.-.-.--.-.-."], "perc": ["s  s  s  s  s  s", " t t  t  t t  t ", ":  :  :  :  :  :", "s  s    s  s    ", " t   t t   t t  ", ":    ::    ::   ", "s t s   s t s   ", " : t :   : t :  "]}};
const _fills  = {"techno": ["X X X X X X XXXX", "X  XX  XXXXXXX X", "X   X   XXXXXXXX", "XXXX    o o XXXX", "X X XXXX  XXXXXX", "X   X XXXXXXXXXX", "XX XX XX XXXXXXX", "X  X  X  X XXXXX"], "ebm": ["X X X X XXXXXXXX", "X X XXXXX X XXXX", "XXXXXXXXX X X X ", "XX XX XXXXXXXXXX", "X XXXXX XXXXXXXX", "XXXX X XXXXXXXXX"], "dnb": ["X  oo  oX oXoo o", "X  o  XXXX oo oo", "X     oooooooooo", "X oX oXo oo oooo", "X  oo X oooooo o", "X   oooX ooooooo"], "house": ["X   X   XXXX*  *", "X   X X X X XXXX", "X   X   * * XXXX", "X X X   XXXX* * ", "X   X ***   XXXX"], "breaks": ["X oXo oXXoXo oXo", "X  oo XoXo ooXXo", "XoXo oXoXoXo oXo", "X oo oo ooXoXo o", "X  oXoXo oo  oXo"], "halftime": ["X       oooooooo", "X     X oooXXXXX", "X       ooooo oo", "X     oo  oooooo"], "industrial": ["XXXXXXXXXXXXXXXX", "X X XXXXX X XXXX", "XX XXXXX XX XXXX", "XXXXXX XXXXXXXXX", "X XXXXXXX XXXXXX"], "reggae": ["X  X  X  X ooooo", "X  X oo  X oo oo", "X    X X  ooo oo"], "afro": ["X oXo X oXo X oX", "XoX oXoXo oXoX o", "X o oXo oXoXo oX"]};

const LAYER_ORDER = ['kick', 'snare', 'hat', 'perc'];
const MUT_CHARS   = { kick: 'Xx', snare: 'oO*u', hat: '-=', perc: 'ts+:~' };

// Seedable RNG (mulberry32) so `seed` is reproducible; no seed → Math.random.
function makeRng(seed) {
    if (seed == null) return Math.random;
    let s = (Number(seed) >>> 0) || 1;
    return function () {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const choice = (rng, arr) => arr[Math.floor(rng() * arr.length)];

function mutAdd(rng, layer, chars) {
    const empties = [...layer].map((c, i) => (c === ' ' ? i : -1)).filter(i => i >= 0);
    if (!empties.length) return layer;
    const pos = choice(rng, empties);
    return layer.slice(0, pos) + choice(rng, chars) + layer.slice(pos + 1);
}
function mutRemove(rng, layer) {
    const hits = [...layer].map((c, i) => (c !== ' ' ? i : -1)).filter(i => i >= 0);
    if (!hits.length) return layer;
    const pos = choice(rng, hits);
    return layer.slice(0, pos) + ' ' + layer.slice(pos + 1);
}
function mutShift(rng, layer) {
    const hits = [...layer].map((c, i) => (c !== ' ' ? i : -1)).filter(i => i >= 0);
    if (!hits.length) return layer;
    const pos = choice(rng, hits);
    const dir = choice(rng, [-1, 1]);
    const np = (((pos + dir) % layer.length) + layer.length) % layer.length;
    if (layer[np] !== ' ') return layer;
    const ch = layer[pos];
    let L = layer.slice(0, pos) + ' ' + layer.slice(pos + 1);
    return L.slice(0, np) + ch + L.slice(np + 1);
}

class DrumKit {
    constructor(genre = 'techno', opts = {}) {
        const steps = opts.steps ?? 16;
        this.genre  = _genres[genre] ? genre : 'techno';
        this.steps  = steps;
        this._density = opts.density ?? 1.0;
        this.mute = new Set(typeof opts.mute === 'string'
            ? opts.mute.split(',').map(s => s.trim()) : (opts.mute || []));
        this._rng = makeRng(opts.seed ?? null);

        const gdef = _genres[this.genre];
        this._layers = {};
        if (opts.layers) Object.assign(this._layers, opts.layers);
        else for (const name of LAYER_ORDER) this._layers[name] = choice(this._rng, gdef[name] || [' '.repeat(steps)]);

        // Per-layer overrides: kick="X  x " or hat="dnb" (cross-genre variation).
        for (const name of LAYER_ORDER) {
            if (name in opts) {
                const val = opts[name];
                if (typeof val === 'string' && _genres[val]) this._layers[name] = choice(this._rng, _genres[val][name] || [' '.repeat(steps)]);
                else this._layers[name] = val;
            }
        }
        this._fills = _fills[this.genre] || _fills.techno;
    }

    _merge(layers = this._layers) {
        const r = Array(this.steps).fill(' ');
        for (const name of LAYER_ORDER) {
            if (!(name in layers) || this.mute.has(name)) continue;
            const layer = layers[name];
            for (let i = 0; i < Math.min(layer.length, this.steps); i++) {
                if (layer[i] !== ' ' && r[i] === ' ') r[i] = layer[i];
            }
        }
        return r.join('');
    }

    _applyDensity(pattern, density) {
        if (density >= 1.0) return pattern;
        const r = [...pattern];
        for (let i = 0; i < r.length; i++) if (r[i] !== ' ' && this._rng() > density) r[i] = ' ';
        return r.join('');
    }

    toString() {
        let p = this._merge();
        let d = this._density;
        if (d && typeof d.get === 'function') d = d.get(0);   // TimeVar
        if (Number(d) < 1.0) p = this._applyDensity(p, Number(d));
        return p;
    }

    layer(name) { return this._layers[name] || ' '.repeat(this.steps); }
    _getFill()  { return choice(this._rng, this._fills); }

    // Mutate one random layer — add/remove/shift a hit, or swap the variation.
    _evolve() {
        const name = choice(this._rng, LAYER_ORDER);
        if (!(name in this._layers)) return;
        const L = this._layers[name];
        switch (choice(this._rng, ['add', 'remove', 'shift', 'swap'])) {
            case 'add':    this._layers[name] = mutAdd(this._rng, L, MUT_CHARS[name] || 'x'); break;
            case 'remove': this._layers[name] = mutRemove(this._rng, L); break;
            case 'shift':  this._layers[name] = mutShift(this._rng, L); break;
            case 'swap': {
                const v = (_genres[this.genre] || {})[name];
                if (v && v.length) this._layers[name] = choice(this._rng, v);
                break;
            }
        }
    }
}

// pbuild(genre, opts) — opts can be an object {evolve, fill, density, mute, seed,
// kick, snare, hat, perc} or a number (= evolve). Returns a play() string.
export function pbuild(genre = 'techno', opts = {}) {
    if (typeof opts === 'number') opts = { evolve: opts };
    const evolve = opts.evolve ?? 8;
    const fill   = opts.fill ?? 0;
    const kit = new DrumKit(genre, opts);
    if (evolve <= 1) return kit.toString();
    const parts = [];
    for (let i = 0; i < evolve; i++) {
        if (fill > 0 && (i + 1) % fill === 0) parts.push(kit._getFill());
        else parts.push(kit.toString());
        kit._evolve(); kit._evolve();   // two mutations per bar — groove drifts
    }
    return parts.join('');
}

// pkit(genre, opts) — a kit object for per-layer play(): kit.kick / .snare / .hat / .perc.
export function pkit(genre = 'techno', opts = {}) {
    const kit = new DrumKit(genre, typeof opts === 'number' ? { evolve: opts } : opts);
    return {
        toString: () => kit.toString(),
        kick: kit.layer('kick'), snare: kit.layer('snare'),
        hat:  kit.layer('hat'),  perc:  kit.layer('perc'),
    };
}

// genres() — list available genre names.
export function genres() { return Object.keys(_genres); }
