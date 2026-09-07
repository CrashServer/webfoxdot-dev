// collab.js
// Multiplayer collaboration layer — connects to collab server,
// syncs editor text via Yjs, broadcasts eval events, syncs clock.

import { collabWsBase } from '../net/serverUrls.js';

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
 * @param {function} [onPerfState]   - Called (key, value) for shared performance state:
 *                                     on every peer change AND once per key at join.
 * @param {function} [onConnection]  - Called (up, isRejoin) as the eval/action relay
 *                                     drops and comes back.
 * @param {function} [onPerms]       - Called whenever the room's permission rules
 *                                     change, and once the doc has synced.
 *                                     (solo / unsolo / soloDrop / section / cancel)
 * @returns {object} collab API: { broadcastEval, broadcastAction, getClockOffset, destroy }
 */
export async function initCollab(sessionSlug, clock, editor, onEvalReceived, onAction, onPeers, onChat, seedText, onListing, onPerfState, onConnection, onPerms) {
    // ── Load vendored Yjs bundle (single shared instance, no CDN) ──────────
    // Rebuild the bundle with: cd server && npm run build-yjs
    const { Y, WebsocketProvider, CodemirrorBinding } = await import('../../lib/yjs/yjs-bundle.js');

    // https ⇒ same-origin /ws (proxied) · http ⇒ the config.json collab port.
    const wsBase = await collabWsBase();

    const ydoc     = new Y.Doc();
    const provider = new WebsocketProvider(wsBase, sessionSlug, ydoc);
    const ytext    = ydoc.getText('code');
    // Room settings shared across all peers (persists in the doc, survives reloads).
    // `listed` (default true) controls galaxy visibility — see setListed/reportListing.
    const ymeta    = ydoc.getMap('meta');
    const isListed = () => ymeta.get('listed') !== false;
    // Scoped per-user undo: a Y.UndoManager so Ctrl-Z reverts only YOUR edits, not a
    // collaborator's (y-codemirror wires CM undo/redo to it when passed).
    const undoManager = new Y.UndoManager(ytext);
    // y-codemirror installs an undo/redo keymap it does NOT remove on destroy(), so
    // note whichever maps a binding adds — pauseSync/resumeSync would otherwise stack
    // a fresh copy of it on every tab switch.
    function makeBinding() {
        const before = new Set(editor.state.keyMaps || []);
        const b = new CodemirrorBinding(ytext, editor, provider.awareness, { yUndoManager: undoManager });
        b._addedKeyMaps = (editor.state.keyMaps || []).filter(m => !before.has(m));
        return b;
    }
    let binding = makeBinding();

    // ── Suspend / resume text sync (editor tabs — see js/ui/tabs.js) ──────────
    // The binding follows ONE CodeMirror document: its type observer writes remote
    // edits into the doc it was built on, whether or not that doc is the one on
    // screen. So when you switch to a scratch buffer the binding is torn down, and
    // rebuilt when you come back — rebuilding re-reads the shared text, so you
    // return to the room's current state rather than to a stale snapshot. The Yjs
    // doc itself never stops receiving; only the editor stops mirroring it.
    function pauseSync() {
        if (!binding) return;
        for (const m of binding._addedKeyMaps || []) { try { editor.removeKeyMap(m); } catch (_) {} }
        binding.destroy();
        binding = null;
    }
    function resumeSync() { if (!binding) binding = makeBinding(); }

    // Seed a BRAND-NEW room with the creator's composition. Once the server has
    // synced, if the shared doc is still empty (nobody's typed), insert the seed —
    // so "go live" carries your current buffer into the session instead of a blank.
    if (seedText) {
        let seeded = false;
        // Insert the seed only while the shared doc is still empty (a fresh room). We
        // try on several signals so timing quirks can't drop it: the sync event, an
        // already-synced check, and a settle-timer fallback if no sync signal arrives.
        const seedIfEmpty = () => {
            if (!seeded && ytext.length === 0) { seeded = true; ytext.insert(0, seedText); }
        };
        provider.on('sync',   seedIfEmpty);
        provider.on('synced', seedIfEmpty);
        if (provider.synced) seedIfEmpty();
        setTimeout(seedIfEmpty, 1800);
    }

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
    const _onBeforeUnload = () => { try { provider.awareness.setLocalState(null); } catch (_) {} };
    window.addEventListener('beforeunload', _onBeforeUnload);

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
    //
    // RECONNECTING. This used to be a single `new WebSocket(...)` with no close
    // handler, and every send guarded by a bare `readyState !== OPEN → return`. The
    // Yjs provider reconnects on its own, so after any blip — wifi, a sleeping laptop,
    // a server restart — the session went on LOOKING connected (text still syncing,
    // cursors still moving, peers still listed) while evals, beat sync and every
    // action silently reached nobody, in both directions, with no way to notice.
    const WS_URL = `${wsBase}/${sessionSlug}?app=1`;
    const RECONNECT_MIN = 500, RECONNECT_MAX = 15000;
    let ws = null;
    let _wsBackoff = RECONNECT_MIN;
    let _wsTimer = null;
    let _destroyed = false;
    let _wasConnected = false;
    let _everConnected = false;   // distinguishes the first connect from a RE-connect

    function wsConnect() {
        if (_destroyed) return;
        ws = new WebSocket(WS_URL);
        ws.addEventListener('open', onWsOpen);
        ws.addEventListener('message', onWsMessage);
        ws.addEventListener('close', onWsDown);
        // An error is always followed by close, so let close drive the retry.
        ws.addEventListener('error', () => { try { ws.close(); } catch (_) {} });
    }

    function onWsDown() {
        if (_destroyed) return;
        if (_wasConnected) { _wasConnected = false; onConnection?.(false); }
        clearTimeout(_wsTimer);
        // Exponential backoff with jitter, so a server restart doesn't get a
        // thundering herd of every peer in every room retrying on the same tick.
        const wait = Math.min(RECONNECT_MAX, _wsBackoff) * (0.7 + Math.random() * 0.6);
        _wsBackoff = Math.min(RECONNECT_MAX, _wsBackoff * 2);
        _wsTimer = setTimeout(wsConnect, wait);
    }

    /** True while the eval/action relay is actually up. */
    function isConnected() { return !!ws && ws.readyState === WebSocket.OPEN; }

    // Sends are dropped, never queued: replaying a backlog of evals on reconnect
    // would fire changes at the room minutes after they were meant, which is worse
    // than not sending them. The caller is told instead (see onConnection).
    function wsSend(obj) {
        if (!isConnected()) return false;
        ws.send(JSON.stringify(obj));
        return true;
    }

    let clockOffset = 0; // ms offset from server time
    let beatMaster  = false;
    let beatSyncInterval = null;

    // ── Clock sync (NTP-style single round-trip) ──────────────────────────
    function syncClock() { wsSend({ type: 'ping', t1: Date.now() }); }

    let lastRtt = 0;
    function handlePong({ t1, t2 }) {
        const now    = Date.now();
        const rtt    = now - t1;
        lastRtt      = rtt;
        const offset = t2 - (t1 + rtt / 2); // our clock is offset ms behind server
        clockOffset  = offset;
    }

    // ── Beat master election via Yjs awareness ────────────────────────────
    function electBeatMaster() {
        if (beatMaster) return;
        const aw = provider.awareness;
        const entries = [...aw.getStates().entries()];   // [clientID, state]
        // Compare on the STABLE user.id (default names like "user42" collide, so two
        // people could each think the other was themselves and both self-elect).
        const otherMasters = entries.filter(([, s]) => s.beatMaster === true && s.user?.id !== user.id);
        if (otherMasters.length > 0) return;
        // Deterministic tie-break: only the lowest clientID present elects itself, so
        // simultaneous joins can't both become master.
        const lowest = Math.min(...entries.map(([id]) => id));
        if (aw.clientID !== lowest) return;
        beatMaster = true;
        aw.setLocalStateField('beatMaster', true);
        startBeatSync();
    }

    function startBeatSync() {
        if (beatSyncInterval) return;
        // Broadcast clock state roughly every 8 beats
        beatSyncInterval = setInterval(() => {
            wsSend({
                type:     'beat_sync',
                bpm:      clock.bpm,
                beat:     clock.now(),
                wallTime: Date.now(),
            });
        }, Math.round((60_000 / (clock.bpm || 120)) * 8));
    }

    function handleBeatSync({ bpm, beat, wallTime }) {
        if (beatMaster) return; // masters ignore incoming sync
        // Tempo repair. The shared 'bpm' state key is what actually carries a knob turn
        // around the room (and gives a late joiner the right tempo); this is the safety
        // net for a follower whose doc hasn't caught up — it converges on the master's
        // tempo instead of quietly playing the set at the wrong speed. Skipped while
        // _bpmVar is set:
        // assigning a sampled NUMBER over a tempo automation (Clock.bpm = linvar(…))
        // would freeze it, and that var rides the eval broadcast anyway.
        if (bpm && !clock._bpmVar && Math.abs(bpm - clock.bpm) > 0.01) clock.bpm = bpm;
        const drift = Math.abs(Date.now() - wallTime - clockOffset);
        if (drift > 5) {
            // Followers realign when drift exceeds 5 ms. Compensate for the one-way
            // master→follower latency with half the last measured RTT (the raw
            // Date.now()-wallTime baked the full network delay into the offset).
            clockOffset = Date.now() - wallTime - lastRtt / 2;
        }
    }

    // ── Incoming message handler ──────────────────────────────────────────
    function onWsMessage(event) {
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
    }

    function onWsOpen() {
        _wsBackoff = RECONNECT_MIN;              // a clean connect resets the backoff
        const rejoin = _wasConnected === false && _everConnected;
        _wasConnected = true; _everConnected = true;
        onConnection?.(true, rejoin);
        syncClock();
        reportListing();                          // the server forgot us while we were gone
        // Elect beat master once awareness has settled
        setTimeout(electBeatMaster, 500);
    }

    // ── Galaxy listing (listed / unlisted) — a shared room setting ────────────
    // Stored in the Yjs doc so every peer agrees and it survives reloads; each client
    // reports the SYNCED value to the collab server, which filters unlisted rooms out
    // of the public /sessions feed. We only report once the doc has synced, so a fresh
    // joiner can't momentarily re-list a private room with the default `true`.
    // ── Shared performance state — the mix, tempo, key, macros, modular synths ──
    // Lives in the Yjs doc rather than riding fire-and-forget 'action' messages, so it
    // survives and REPLAYS for a peer who joins mid-set: they'd otherwise get the text
    // of the composition with everyone's default mix. Flat string keys ('bpm',
    // 'level:d1', 'synth:mypatch') keep per-track state independently mergeable.
    const yperf = ydoc.getMap('perf');
    function setPerf(key, value) { yperf.set(key, value); }

    // ── Room rules — who controls what (js/collab/permissions.js) ───────────────
    // A SEPARATE map from perf: these are the room's constitution, not part of the
    // performance, and keeping them apart means a future "reset the mix" can clear
    // perf without dissolving the permissions with it.
    const yperms = ydoc.getMap('perms');
    function setPerm(key, value) { yperms.set(key, value); }
    function getPerm(key) { return yperms.get(key); }
    function permEntries() { return [...yperms.entries()]; }
    // Unlike perf, this fires for LOCAL writes too: the host toggling a capability has
    // to see their own switch move, and re-reading a map is free (no audio, no compile).
    yperms.observe(() => onPerms?.());
    // REMOTE changes only. Yjs fires this for our own writes too, and while re-applying
    // an absolute value is harmless in itself, the local echo would make every modular
    // Define recompile and re-upload the synth it just defined — on every debounced
    // keystroke in live mode. We already applied our own change before sharing it.
    yperf.observe((ev, tr) => {
        if (tr.local) return;
        ev.changes.keys.forEach((_chg, key) => onPerfState?.(key, yperf.get(key)));
    });
    // The join snapshot: replay everything already in the map once the doc has synced.
    // Guarded, because 'sync' and 'synced' both fire and a second pass would redefine
    // every shared modular synth for nothing.
    let _perfReplayed = false;
    function replayPerf() {
        if (_perfReplayed) return;
        _perfReplayed = true;
        yperf.forEach((v, k) => onPerfState?.(k, v));
        onPerms?.();                       // the room's rules are in place from here on
    }

    let _docSynced = provider.synced || false;
    function reportListing() {
        if (_docSynced) wsSend({ type: 'listing', listed: isListed() });
    }
    function setListed(v) { ymeta.set('listed', !!v); }   // syncs → observer reports + notifies UI
    const _onSynced = () => { _docSynced = true; reportListing(); onListing?.(isListed()); replayPerf(); };
    provider.on('sync', _onSynced);
    provider.on('synced', _onSynced);
    ymeta.observe(() => { reportListing(); onListing?.(isListed()); });

    // Open the relay. Deliberately down here, after reportListing and the state
    // observers exist: the socket's open handler touches them, and while the handshake
    // is async anyway, starting it last keeps that from being a subtlety to remember.
    wsConnect();

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
    const _onPeersChange = () => onPeers?.(getPeers());
    provider.awareness.on('change', _onPeersChange);
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
        // authorId: added by the sender itself (it owns the identity), so a peer whose
        // eval FAILS can report the failure back to the one person who needs to know.
        // Names are user-chosen and collide; the id is stable.
        return wsSend({ type: 'eval', code, lines, author, color, authorId: user.id, beatTime });
    }

    /**
     * Broadcast a non-eval action to all peers (solo, composition state, …).
     * @param {string} action  - Action name ('solo' | 'unsolo' | 'soloDrop' | 'section' | 'cancel')
     * @param {object} data    - Action payload (merged into the message)
     */
    function broadcastAction(action, data = {}) {
        // fromId lets the RECEIVER check the sender against the room's rules, rather
        // than trusting that they checked themselves before sending.
        return wsSend({ type: 'action', action, fromId: user.id, ...data });
    }

    /** Current clock offset vs. server (milliseconds). */
    function getClockOffset() {
        return clockOffset;
    }

    /** Tear down all connections and intervals. */
    function destroy() {
        _destroyed = true;              // stop the reconnect loop before closing
        clearTimeout(_wsTimer);
        clearInterval(beatSyncInterval);
        window.removeEventListener('beforeunload', _onBeforeUnload);
        try { provider.awareness.off('change', electBeatMaster); } catch (_) {}
        try { provider.awareness.off('change', _onPeersChange); } catch (_) {}
        try { provider.off('sync', _onSynced); provider.off('synced', _onSynced); } catch (_) {}
        try { ws && ws.close(); } catch (_) {}
        pauseSync();
        provider.destroy();
        ydoc.destroy();
    }

    return { broadcastEval, broadcastAction, setPerf, setPerm, getPerm, permEntries, setUser, getPeers, sendChat, getClockOffset, isConnected, myId: () => user.id, isListed, setListed, pauseSync, resumeSync, destroy };
}
