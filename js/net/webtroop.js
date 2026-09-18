// webtroop.js — watch a webTroop session from crashDot, without touching it.
//
// webTroop (github/CrashServer, /home/svdk/live/webTroop) is the rig the troop plays
// concerts on: a shared FoxDot buffer, a SuperCollider server, and a panel of
// telemetry. crashDot is a different instrument entirely, and the point here is NOT
// to merge them — it is to let one see the other, so the code the room is playing can
// be on screen, in the visuals, next to your own.
//
// ── READ ONLY, and deliberately so ───────────────────────────────────────────
// This never writes to the shared document, never sets an awareness field, and never
// sends a message on any of the sockets. webTroop is not modified and does not know
// we are here beyond one more socket on its list. A bug in this file must not be able
// to stop a concert — which is why every handler is wrapped and why the Yjs document
// is built with no editor binding at all.
//
// ── Three sockets, because webTroop has three ────────────────────────────────
//   :4444   Yjs, room "webtroop", text "webtroop"     the shared code
//           awareness field "otherInstantCode"        the PRETEXT windows
//   :20000  JSON {type}                               bpm · cpu · beat · scale · root
//                                                     players · serverState · chrono
//   :1234   JSON                                      the log feed (optional)
//
// The PRETEXT part is the interesting one. In pretext mode every player publishes a
// window of lines around their cursor on every keystroke, not on every eval — so what
// arrives is the room typing, live, with the context around it. That is exactly the
// feed crashDot's code layers (livecode, codefull, codeconspiracy) already render, so
// a troop rehearsal can BE the visual.

const DEFAULT = { yPort: 4444, telemetryPort: 20000, logPort: 1234, room: 'webtroop' };

/**
 * @param {object} opts  host (required) · yPort · telemetryPort · logPort · room
 * @param {object} on    onCode(text) · onStat(key, value) · onPeers(peers) ·
 *                       onPretext({user, line, windowLines, …}) · onLog(line) ·
 *                       onStatus({code, telemetry, logs})
 * @returns {{ close: () => void, state: () => object }}
 */
export async function watchTroop(opts = {}, on = {}) {
    const cfg = { ...DEFAULT, ...opts };
    if (!cfg.host) throw new Error('watchTroop: a host is required — watchTroop({ host: "192.168.1.38" })');

    const { Y, WebsocketProvider } = await import('../../lib/yjs/yjs-bundle.js');
    const say = (fn, ...a) => { try { fn?.(...a); } catch (_) {} };

    const state = { host: cfg.host, code: '', stats: {}, peers: [], connected: { code: false, telemetry: false, logs: false } };
    const status = () => say(on.onStatus, { ...state.connected });

    // ── the shared document ──────────────────────────────────────────────────
    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(`ws://${cfg.host}:${cfg.yPort}`, cfg.room, ydoc);
    const ytext = ydoc.getText(cfg.room);
    const pushCode = () => { state.code = ytext.toString(); say(on.onCode, state.code); };
    ytext.observe(pushCode);
    // 'sync' AND 'status', because which one this provider build emits is not
    // something to assume — collab.js listens for both for the same reason. And the
    // document arriving at all is itself proof of a connection, so an observation
    // marks it connected too: reporting "not connected" while showing their code is
    // worse than reporting nothing.
    const markUp = () => { if (!state.connected.code) { state.connected.code = true; status(); } };
    provider.on('sync', () => { markUp(); pushCode(); });
    provider.on('synced', () => { markUp(); pushCode(); });
    provider.on('status', (e) => {
        const up = e?.status === 'connected';
        if (up) { markUp(); pushCode(); }
        else if (state.connected.code) { state.connected.code = false; status(); }
    });
    ytext.observe(markUp);

    // ── who is in the room, and what they are typing right now ───────────────
    const readAwareness = () => {
        const out = [];
        for (const [id, st] of provider.awareness.getStates()) {
            if (id === provider.awareness.clientID) continue;   // we are not a player here
            const u = st?.user || {};
            const inst = st?.otherInstantCode || null;
            out.push({ id, name: u.name || 'anon', color: u.color || null,
                       line: inst?.line ?? null, code: inst?.code ?? '',
                       window: inst?.windowLines || null, windowStart: inst?.windowStartLine ?? null });
            if (inst) say(on.onPretext, { user: inst.user || u.name || 'anon', ...inst });
        }
        state.peers = out;
        say(on.onPeers, out);
    };
    provider.awareness.on('change', readAwareness);

    // ── telemetry ────────────────────────────────────────────────────────────
    // Its own socket with its own life: the concert rig may be half up — FoxDot
    // running while SuperCollider is not, or the other way round — and one feed being
    // down is not a reason to show none of the others.
    const sock = (port, onJson) => {
        let ws = null, timer = null, closed = false;
        const open = () => {
            if (closed) return;
            try { ws = new WebSocket(`ws://${cfg.host}:${port}`); } catch (_) { return retry(); }
            ws.onopen = () => { if (port === cfg.telemetryPort) state.connected.telemetry = true;
                                else state.connected.logs = true; status(); };
            ws.onmessage = (e) => { try { onJson(JSON.parse(e.data)); } catch (_) {} };
            ws.onclose = () => { if (port === cfg.telemetryPort) state.connected.telemetry = false;
                                 else state.connected.logs = false; status(); retry(); };
            ws.onerror = () => { try { ws.close(); } catch (_) {} };
        };
        const retry = () => { if (!closed) timer = setTimeout(open, 2500); };
        open();
        return () => { closed = true; clearTimeout(timer); try { ws?.close(); } catch (_) {} };
    };

    const closeTelemetry = sock(cfg.telemetryPort, (d) => {
        if (!d || !d.type) return;
        // Pass the value through under its own name — webTroop's vocabulary is bpm,
        // cpu, beat, scale, root, players, serverState, chrono, sceneName, masterFx,
        // and renaming any of it here would only make the two harder to compare.
        const v = d[d.type] !== undefined ? d[d.type] : d;
        state.stats[d.type] = v;
        say(on.onStat, d.type, v);
    });
    const closeLogs = on.onLog ? sock(cfg.logPort, (d) => {
        if (d && (d.type === 'log' || d.log)) say(on.onLog, d.log || d.message || '');
    }) : () => {};

    return {
        // A SNAPSHOT, not a view. `connected` was handed out by reference, so a caller
        // that read the state and then closed the watcher saw its own copy change
        // under it — provider.destroy() emits a disconnect, the handler flips the
        // flag, and the "before" reading has silently become the "after" one.
        state: () => ({ ...state, connected: { ...state.connected },
                        stats: { ...state.stats }, peers: state.peers.map(p => ({ ...p })) }),
        close() {
            try { ytext.unobserve(pushCode); } catch (_) {}
            try { ytext.unobserve(markUp); } catch (_) {}
            try { provider.awareness.off('change', readAwareness); } catch (_) {}
            try { provider.destroy(); } catch (_) {}
            try { ydoc.destroy(); } catch (_) {}
            closeTelemetry(); closeLogs();
            state.connected = { code: false, telemetry: false, logs: false };
            status();
        },
    };
}
