// Beat clock — drives all players. Runs at 10ms resolution with 30ms lookahead.

export class Clock {
    constructor() {
        this._bpm     = 120;
        this._beat    = 0;
        this._lastMs  = null;
        this._events  = [];   // { beat, fn }[]
        this._players = new Map();
        this._running = false;
        this._onBpm   = null; // callback when bpm changes
    }

    start() {
        this._running = true;
        this._lastMs  = performance.now();
        this._tick();
    }

    _tick() {
        if (!this._running) return;
        const now = performance.now();
        let dt    = (now - this._lastMs) / 1000;
        this._lastMs = now;
        // Clamp dt: a backgrounded tab or a main-thread stall makes this 10ms tick
        // fire seconds late. Without clamping, the beat lurches forward and dumps a
        // burst of overdue notes on resume. Capping keeps tempo steady and drains
        // the backlog in order over the next ticks (the beat just shifts later by
        // the stall — fine for a live instrument).
        if (dt > 0.1) dt = 0.1;
        this._beat += dt * this._bpm / 60;

        // ~80ms lookahead gives the note timers slack against jitter.
        const lookahead = (80 / 1000) * this._bpm / 60;
        const horizon   = this._beat + lookahead;

        for (let i = this._events.length - 1; i >= 0; i--) {
            if (this._events[i].beat <= horizon) {
                const evt     = this._events.splice(i, 1)[0];
                const delayMs = Math.max(0, (evt.beat - this._beat) * 60000 / this._bpm);
                setTimeout(evt.fn, delayMs);
            }
        }
        setTimeout(() => this._tick(), 10);
    }

    now()            { return this._beat; }
    _schedule(b, fn) { this._events.push({ beat: b, fn }); }

    get bpm()  { return this._bpm; }
    set bpm(v) {
        this._bpm = Number(v);
        if (this._onBpm) this._onBpm(this._bpm);
    }

    // Stop all players
    clear() {
        for (const p of this._players.values()) p.stop();
    }

    // Get or create a named player
    getPlayer(name, PlayerClass) {
        if (!this._players.has(name)) {
            this._players.set(name, new PlayerClass(name, this));
        }
        return this._players.get(name);
    }
}
