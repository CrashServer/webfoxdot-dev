// What each workshop layer costs to draw, ranked — and which of them the frame
// budget structurally cannot hide.
//
//   node tools/bench-layers.mjs [--port 9432] [--url http://127.0.0.1:8765/index.html]
//
// Needs a Chromium with --remote-debugging-port and the dev server running.
//
// Why it reads the deck's own EMA rather than timing render() from outside: the
// budget throttles an expensive layer to every Nth frame, so timing from outside
// averages in the frames it deliberately skipped and reports a number several times
// too low. The deck already measures each layer's real draw, which is the honest one.
//
// Why it matters: the throttle is capped at MAX_SKIP (every 6th frame), on purpose —
// past that the picture is visibly choppy. So any layer costing more than
// budget x cap has a floor it cannot be pushed below, and will block the thread for
// its full draw time every 6th frame however the budget is set. Those are the layers
// that have to move off the main thread; everything under it is already handled.
import { connect, sleep } from '../tests/browser/cdp.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', 9432));
const URL  = arg('--url', 'http://127.0.0.1:8765/index.html');
const W = 960, H = 540, FRAMES = 24;

const b = await connect(PORT);
const p = await b.page(URL + (URL.includes('?') ? '&' : '?') + 'cb=' + Math.random());
const ev = (x) => p.evaluate(x);
for (let i = 0; i < 30; i++) { if (await ev(`!!document.querySelector('.CodeMirror')`) === true) break; await sleep(1000); }
await sleep(1200);

const rows = JSON.parse(await ev(`(async () => {
  const { createWorkshopDeck } = await import('/js/visuals/render/wsdeck.js');
  const { WORKSHOP_NAMES } = await import('/js/visuals/workshop/catalog.js');
  const AUD = { bass:.5, mid:.4, treble:.3, level:.5, spectrum: new Float32Array(32).fill(.4) };
  const out = [];
  for (const name of WORKSHOP_NAMES) {
    const deck = createWorkshopDeck();
    const layers = [{ name: 'bench', scene: name, ch: 0, params: {}, fx: {} }];
    let err = null;
    try { for (let f = 0; f < ${FRAMES}; f++) deck.render(layers, ${W}, ${H}, 1 + f * 0.05, AUD); }
    catch (e) { err = String(e && e.message || e).slice(0, 50); }
    let cost = null, worst = null, every = 1;
    try {
      const s = (deck.stats() || [])[0];
      if (s) { cost = s.cost == null ? null : +s.cost.toFixed(2);
               worst = s.worst == null ? null : +s.worst.toFixed(2); every = s.every || 1; }
    } catch (_) {}
    try { deck.dispose(); } catch (_) {}
    out.push({ name, cost, worst, every, err });
    await new Promise(r => setTimeout(r, 0));   // let the page breathe between layers
  }
  return JSON.stringify(out);
})()`));
await p.close(); b.close();

const ok = rows.filter(r => r.cost != null && !r.err).sort((a, b2) => b2.cost - a.cost);
const BUDGET = 4, CAP = 6, CEIL = BUDGET * CAP;
console.log(`${ok.length} layers at ${W}x${H}, ${FRAMES} frames each\n`);
console.log('  ms/draw    worst  every   layer');
for (const r of ok.slice(0, 25))
  console.log(`  ${String(r.cost).padStart(7)}  ${String(r.worst ?? '').padStart(7)}  ${String(r.every).padStart(5)}   ${r.name}`);
const over = ok.filter(r => r.cost > CEIL);
console.log(`\nover ${CEIL}ms (budget ${BUDGET} x cap ${CAP}) — the throttle cannot hide these: ${over.length}`);
for (const r of over) console.log(`  ${String(r.cost).padStart(7)}ms  ->  ${(r.cost / CAP).toFixed(1)}ms a frame even when throttled   ${r.name}`);
const bad = rows.filter(r => r.err);
if (bad.length) console.log(`\nthrew: ${bad.map(r => r.name).join(', ')}`);
