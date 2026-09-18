// Minimal CDP driver: open pages in one headless Chromium, eval in each.
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
export async function connect(port) {
  const info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const waiting = new Map(); const events = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) { const { res, rej } = waiting.get(m.id); waiting.delete(m.id);
      return m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
    if (m.method === 'Runtime.consoleAPICalled' && ['error','warning'].includes(m.params.type))
      events.push({ s: m.sessionId, kind: m.params.type, text: m.params.args.map(a => a.description ?? JSON.stringify(a.value)).join(' ') });
    if (m.method === 'Runtime.exceptionThrown')
      events.push({ s: m.sessionId, kind: 'exception', text: m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text });
  };
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const n = ++id; waiting.set(n, { res, rej });
    ws.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  async function page(url) {
    // Open blank, turn the cache OFF, and only then navigate — editing modules
    // between runs and reading a cached copy is how you 'verify' a fix that never
    // loaded. (Reloading after navigation instead races the pending evaluate:
    // "Promise was collected".)
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Runtime.enable', {}, sessionId);
    await send('Network.enable', {}, sessionId);
    await send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId);
    await send('Page.enable', {}, sessionId);
    await send('Page.navigate', { url }, sessionId);
    return {
      problems: () => events.filter(e => e.s === sessionId),
      async evaluate(expr) {
        const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
        return r.result.value;
      },
      async shot(path, clip) {
        const r = await send('Page.captureScreenshot', clip ? { format:'png', clip:{...clip, scale:1} } : { format:'png' }, sessionId);
        const { writeFile } = await import('node:fs/promises');
        await writeFile(path, Buffer.from(r.data, 'base64')); return path;
      },
    };
  }
  return { page, close: () => ws.close() };
}
