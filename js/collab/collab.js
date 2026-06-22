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
 * @returns {object} collab API: { broadcastEval, getClockOffset, destroy }
 */
export async function initCollab(sessionSlug, clock, editor, onEvalReceived) {
    // ── Load vendored Yjs bundle (single shared instance, no CDN) ──────────
    // Rebuild the bundle with: cd server && npm run build-yjs
    const { Y, WebsocketProvider, CodemirrorBinding } = await import('../../lib/yjs/yjs-bundle.js');

    // ── Yjs document + WebSocket provider ─────────────────────────────────
    const ydoc     = new Y.Doc();
    const provider = new WebsocketProvider(`ws://localhost:4444`, sessionSlug, ydoc);
    const ytext    = ydoc.getText('code');
    const binding  = new CodemirrorBinding(ytext, editor, provider.awareness);

    // User identity — persisted across reloads
    const user = JSON.parse(localStorage.getItem('wfd-user') || 'null')
        || { name: 'user' + Math.floor(Math.random() * 99), color: randomColor() };
    localStorage.setItem('wfd-user', JSON.stringify(user));
    provider.awareness.setLocalStateField('user', user);

    // ── App-message WebSocket (eval relay + clock sync) ───────────────────
    const ws = new WebSocket(`ws://localhost:4444/${sessionSlug}`);

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

    return { broadcastEval, getClockOffset, destroy };
}
