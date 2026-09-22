// perfstats.js — how late is the main thread, and how often.
//
// The engine already reports on itself: audioHealthPct, scsynthSchedulerLates,
// preschedulerLates, drift. Those say whether the AUDIO thread kept up. They cannot
// say whether the CLOCK did, because the clock is main-thread JS: it re-arms itself
// with setTimeout(…, 10) and dispatches each note LOOKAHEAD_S early with a timetag.
// A main-thread stall shorter than that lookahead costs nothing at all; a longer one
// makes notes miss their timetag and arrive late. So the question that matters is not
// "what is the average lag" — it is "how often did a stall eat the whole lookahead".
//
// An average cannot answer that and neither can one sample. The readResources() lag
// meter takes ONE sample every 700ms, which sees about 0.2% of a 10ms tick's life and
// misses a 300ms stall that happens to fall between two reads. This keeps a histogram
// of EVERY tick instead, which is ~100 samples a second for the price of an array
// index, and reports the shape: the worst, the 95th percentile, and the count over a
// threshold you name.

/**
 * A bucketed distribution of lateness samples, in ms.
 *
 * Buckets rather than a sample array: a set runs for hours, and keeping every sample
 * would be a slow leak. Percentiles come out of the buckets and are therefore
 * approximate — deliberately, since "p95 is somewhere between 20 and 40ms" is a
 * decision you can act on and a false precision is not.
 */
export class Lateness {
    /** @param {number[]} edges upper bounds, ascending; a final open-ended bucket is added */
    constructor(edges = [1, 2, 4, 8, 16, 32, 64, 128, 256]) {
        this.edges = edges.slice();
        this.reset();
    }

    reset() {
        this.counts = new Array(this.edges.length + 1).fill(0);
        this.n = 0;
        this.max = 0;
        this.sum = 0;
        this.since = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    }

    /** Record one sample. Negative (early) is clamped to 0 — early is never a problem. */
    add(ms) {
        const v = ms > 0 ? ms : 0;
        this.n++;
        this.sum += v;
        if (v > this.max) this.max = v;
        let i = 0;
        while (i < this.edges.length && v > this.edges[i]) i++;
        this.counts[i]++;
    }

    get mean() { return this.n ? this.sum / this.n : 0; }

    /** How many samples were at least `ms` late — the count that decides if audio lost. */
    over(ms) {
        let total = 0;
        for (let i = 0; i < this.counts.length; i++) {
            const lo = i === 0 ? 0 : this.edges[i - 1];
            if (lo >= ms) total += this.counts[i];
        }
        return total;
    }

    /**
     * Approximate percentile, reported as the bucket's upper edge — so a p95 of 32
     * means "95% of ticks were 32ms late or better", never "exactly 32".
     * The open-ended top bucket reports the observed max instead of Infinity.
     */
    pct(p) {
        if (!this.n) return 0;
        const want = this.n * p;
        let seen = 0;
        for (let i = 0; i < this.counts.length; i++) {
            seen += this.counts[i];
            if (seen >= want) return i < this.edges.length ? this.edges[i] : this.max;
        }
        return this.max;
    }

    /** Seconds covered, for rates. */
    get windowS() {
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        return Math.max(0.001, (now - this.since) / 1000);
    }

    /** A compact histogram line: "0-1:812 1-2:40 …", zero buckets dropped. */
    histogram() {
        const out = [];
        for (let i = 0; i < this.counts.length; i++) {
            if (!this.counts[i]) continue;
            const lo = i === 0 ? 0 : this.edges[i - 1];
            const hi = i < this.edges.length ? this.edges[i] : '+';
            out.push(`${lo}-${hi}:${this.counts[i]}`);
        }
        return out.join(' ');
    }
}

// ── Long tasks ───────────────────────────────────────────────────────────────
// A "long task" is the browser's own name for >50ms of uninterrupted main-thread
// work. It is the direct cause of a late tick, and unlike the tick histogram it says
// WHEN it happened, so an eval spike and a render spike can be told apart.

let _lt = null;          // the observer, once started
const _long = { n: 0, max: 0, total: 0, last: 0, since: 0 };

/** Start watching. Safe to call twice; a no-op where longtask is unsupported (Safari). */
export function startLongTasks() {
    if (_lt || typeof PerformanceObserver === 'undefined') return false;
    // The entry type is not in every browser, and an unsupported type THROWS on
    // observe() rather than being ignored — so this has to be guarded.
    try {
        _lt = new PerformanceObserver((list) => {
            for (const e of list.getEntries()) {
                _long.n++;
                _long.total += e.duration;
                _long.last = e.duration;
                if (e.duration > _long.max) _long.max = e.duration;
            }
        });
        _lt.observe({ entryTypes: ['longtask'] });
        _long.since = performance.now();
        return true;
    } catch (_) { _lt = null; return false; }
}

export function longTasks() {
    return { ...(_long), supported: !!_lt,
             windowS: Math.max(0.001, (performance.now() - _long.since) / 1000) };
}

export function resetLongTasks() {
    _long.n = 0; _long.max = 0; _long.total = 0; _long.last = 0;
    _long.since = (typeof performance !== 'undefined' ? performance.now() : Date.now());
}
