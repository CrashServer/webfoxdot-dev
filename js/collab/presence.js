// Solo presence — when the app runs WITHOUT a session (no ?session=), register a
// lightweight WebSocket with the collab server so it can count solo usage in its
// [status] log. Fire-and-forget: it sends nothing but a keepalive ping, fails
// silently if the collab server isn't reachable, and stops retrying if it can't
// connect (so a dev box without the collab server doesn't loop).

async function collabWsBase() {
    // https (deployed behind a proxy): same-origin /ws path. http (local/LAN):
    // the collab port from config.json. Mirrors js/collab/collab.js.
    if (window.location.protocol === 'https:') {
        const basePath = window.location.pathname.replace(/\/?[^/]*$/, '');
        return `wss://${window.location.host}${basePath}/ws`;
    }
    let port = 4444;
    try { port = (await (await fetch('./config.json')).json()).collab?.port ?? port; } catch { /* default */ }
    return `ws://${window.location.hostname}:${port}`;
}

export async function initSoloPresence() {
    const base = await collabWsBase();
    let ws = null, ping = null, closed = false, fails = 0;

    const retry = () => { if (!closed && fails < 4) setTimeout(connect, 8000); };
    function connect() {
        let opened = false;
        try { ws = new WebSocket(`${base}/~solo?app=1&solo=1`); }
        catch { fails++; return retry(); }
        ws.onopen  = () => { opened = true; fails = 0; ping = setInterval(() => {
            try { ws.send(JSON.stringify({ type: 'ping', t1: Date.now() })); } catch (_) {}
        }, 25000); };
        ws.onclose = () => { clearInterval(ping); if (!opened) fails++; retry(); };
        ws.onerror = () => { try { ws.close(); } catch (_) {} };
    }
    connect();

    // Leave promptly on unload so the server's solo count drops right away.
    window.addEventListener('beforeunload', () => { closed = true; try { ws?.close(); } catch (_) {} });
}
