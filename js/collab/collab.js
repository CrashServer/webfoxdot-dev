// collab.js
// Multiplayer collaboration layer — connects to collab server,
// syncs editor text via Yjs, broadcasts eval events, syncs clock.

function randomColor() {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 60%)`;
}

/**
 * Initialize multiplayer collaboration for a session.
 *
 * @param {string}   sessionSlug     - Room identifier (e.g. 'jam42')
 * @param {object}   clock           - Clock object with .bpm and .now() → beat number
 * @param {object}   editor          - CodeMirror editor instance
 * @param {function} onEvalReceived  - Called with parsed eval message from peers
 * @param {function} [onAction]      - Called with parsed action message from peers
 *                                     (solo / unsolo / soloDrop / section / cancel)
 * @returns {object} collab API: { broadcastEval, broadcastAction, getClockOffset, destroy }
 */
export async function initCollab(sessionSlug, clock, editor, onEvalReceived, onAction, onPeers, onChat) {
    // ── Load vendored Yjs bundle (single shared instance, no CDN) ──────────
    // Rebuild the bundle with: cd server && npm run build-yjs
    const { Y, WebsocketProvider, CodemirrorBinding } = await import('../../lib/yjs/yjs-bundle.js');

    // ── Resolve collab WebSocket base ──────────────────────────────────────
    // https (deployed behind a proxy): derive a same-origin /ws path.
    // http (local / LAN dev): connect directly to the collab port from config.json.
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsBase;
    if (window.location.protocol === 'https:') {
        const basePath = window.location.pathname.replace(/\/?[^/]*$/, '');
        wsBase = `${wsProto}//${window.location.host}${basePath}/ws`;
    } else {
        let collabPort = 4444;
        try {
            const cfg = await (await fetch('./config.json')).json();
            collabPort = cfg.collab?.port ?? collabPort;
        } catch { /* fall back to default port */ }
        wsBase = `ws://${window.location.hostname}:${collabPort}`;
    }

    const ydoc     = new Y.Doc();
    const provider = new WebsocketProvider(wsBase, sessionSlug, ydoc);
    const ytext    = ydoc.getText('code');
    // Scoped per-user undo: a Y.UndoManager so Ctrl-Z reverts only YOUR edits, not a
    // collaborator's (y-codemirror wires CM undo/redo to it when passed).
    const undoManager = new Y.UndoManager(ytext);
    const binding  = new CodemirrorBinding(ytext, editor, provider.awareness, { yUndoManager: undoManager });

    // User identity — persisted across reloads. A stable `id` (separate from the
    // per-connection Yjs clientID) survives refreshes, so peers de-dupe on it and
    // a reload doesn't spawn a ghost copy of you.
    const user = JSON.parse(localStorage.getItem('wfd-user') || 'null')
        || { name: 'user' + Math.floor(Math.random() * 99), color: randomColor() };
    if (!user.id) user.id = 'u' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem('wfd-user', JSON.stringify(user));
    provider.awareness.setLocalStateField('user', user);

    // Clear our awareness on unload so the ghost vanishes immediately (not after
    // the ~30s awareness timeout).
    window.addEventListener('beforeunload', () => { try { provider.awareness.setLocalState(null); } catch (_) {} });

    // Update identity live — peers see the new name/colour on your cursor at once.
    function setUser(u) {
        if (!u.id) u.id = user.id;
        localStorage.setItem('wfd-user', JSON.stringify(u));
        provider.awareness.setLocalStateField('user', u);
    }

    // ── Persistent session chat (lives in the Yjs doc → history survives joins/reloads)
    const ychat = ydoc.getArray('chat');
    function sendChat(msg) { ychat.push([msg]); }
    // Fires for the synced backlog on connect AND for every new message after.
    ychat.observe(event => {
        event.changes.added.forEach(item => item.content.getContent().forEach(m => onChat?.(m)));
    });

    // ── App-message WebSocket (eval relay + clock sync) ───────────────────
    // Distinct ?app=1 path so the server keeps this OFF the Yjs channel —
    // otherwise JSON frames reach the Yjs decoder ("Unexpected end of array").
    const ws = new WebSocket(`${wsBase}/${sessionSlug}?app=1`);

    let clockOffset = 0; // ms offset from server time
    let beatMaster  = false;
    let beatSyncInterval = null;

    // ── Clock sync (NTP-style single round-trip) ──────────────────────────
    function syncClock() {
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: 'ping', t1: Date.now() }));
    }

    function handlePong({ t1, t2 }) {
        const now    = Date.now();
        const rtt    = now - t1;
        const offset = t2 - (t1 + rtt / 2); // our clock is offset ms behind server
        clockOffset  = offset;
    }

    // ── Beat master election via Yjs awareness ────────────────────────────
    function electBeatMaster() {
        const states = Array.from(provider.awareness.getStates().values());
        const otherMasters = states.filter(
            (s) => s.beatMaster === true && s.user?.name !== user.name
        );
        if (otherMasters.length === 0 && !beatMaster) {
            beatMaster = true;
            provider.awareness.setLocalStateField('beatMaster', true);
            startBeatSync();
        }
    }

    function startBeatSync() {
        if (beatSyncInterval) return;
        // Broadcast clock state roughly every 8 beats
        beatSyncInterval = setInterval(() => {
            if (ws.readyState !== WebSocket.OPEN) return;
            ws.send(JSON.stringify({
                type:     'beat_sync',
                bpm:      clock.bpm,
                beat:     clock.now(),
                wallTime: Date.now(),
            }));
        }, Math.round((60_000 / (clock.bpm || 120)) * 8));
    }

    function handleBeatSync({ bpm, beat, wallTime }) {
        if (beatMaster) return; // masters ignore incoming sync
        const drift = Math.abs(Date.now() - wallTime - clockOffset);
        if (drift > 5) {
            // Followers adjust their internal offset when drift exceeds 5 ms.
            // The caller is responsible for applying clockOffset to scheduling.
            clockOffset = Date.now() - wallTime;
        }
    }

    // ── Incoming message handler ──────────────────────────────────────────
    ws.addEventListener('message', (event) => {
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch {
            return;
        }

        switch (msg.type) {
            case 'pong':
                handlePong(msg);
                break;
            case 'eval':
                onEvalReceived(msg);
                break;
            case 'action':
                onAction?.(msg);
                break;
            case 'beat_sync':
                handleBeatSync(msg);
                break;
        }
    });

    ws.addEventListener('open', () => {
        syncClock();
        // Elect beat master once awareness has settled
        setTimeout(electBeatMaster, 500);
    });

    // Re-elect if someone leaves
    provider.awareness.on('change', electBeatMaster);

    // Connected-peer list, keyed by the stable Yjs client id so a rename updates
    // the same entry instead of looking like a new user. isSelf marks you.
    function getPeers() {
        const out = [];
        provider.awareness.getStates().forEach((state, clientId) => {
            if (!state.user) return;
            // Key on the stable user id so a refresh (new clientID, same id) doesn't
            // double you up; fall back to clientID for older clients without an id.
            out.push({
                id:     state.user.id || ('c' + clientId),
                name:   state.user.name,
                color:  state.user.color,
                isSelf: (state.user.id && state.user.id === user.id) || clientId === provider.awareness.clientID,
            });
        });
        return out;
    }
    provider.awareness.on('change', () => onPeers?.(getPeers()));
    setTimeout(() => onPeers?.(getPeers()), 300);

    // ── Public API ────────────────────────────────────────────────────────

    /**
     * Broadcast an eval event to all peers in the room.
     * @param {string} code      - Evaluated code block
     * @param {Array}  lines     - [startLine, endLine]
     * @param {string} author    - Display name
     * @param {string} color     - CSS color string
     * @param {number} beatTime  - Beat timestamp of evaluation
     */
    function broadcastEval(code, lines, author, color, beatTime) {
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: 'eval', code, lines, author, color, beatTime }));
    }

    /**
     * Broadcast a non-eval action to all peers (solo, composition state, …).
     * @param {string} action  - Action name ('solo' | 'unsolo' | 'soloDrop' | 'section' | 'cancel')
     * @param {object} data    - Action payload (merged into the message)
     */
    function broadcastAction(action, data = {}) {
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: 'action', action, ...data }));
    }

    /** Current clock offset vs. server (milliseconds). */
    function getClockOffset() {
        return clockOffset;
    }

    /** Tear down all connections and intervals. */
    function destroy() {
        clearInterval(beatSyncInterval);
        ws.close();
        binding.destroy();
        provider.destroy();
        ydoc.destroy();
    }

    return { broadcastEval, broadcastAction, setUser, getPeers, sendChat, getClockOffset, destroy };
}
