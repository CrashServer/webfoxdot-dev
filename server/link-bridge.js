// Ableton Link → WebSocket bridge.
//
// Browsers can't speak Link (it's a LAN UDP protocol), so this tiny Node peer
// joins the Link session — syncing with Ableton Live (or any Link app/gear) on
// the network — and relays {bpm, beat, phase, peers, playing} to the browser
// over WebSocket. The browser disciplines its own clock to follow (see
// js/sync/link.js + Clock.syncTo).
//
// Run alongside the static + collab servers:  node server/link-bridge.js
//
// Requires the `abletonlink` native addon (cd server && npm install).

const { WebSocketServer, WebSocket } = require('ws');
const fs   = require('fs');
const path = require('path');

let AbletonLink;
try {
    AbletonLink = require('abletonlink');
} catch (e) {
    console.error('[link] `abletonlink` not installed. Run:  cd server && npm install');
    process.exit(1);
}

const CFG = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8')).link; }
    catch { return null; }
})() || { host: '0.0.0.0', port: 4445 };

const QUANTUM = 4;   // beats per bar — phase is reported within this window

const link = new AbletonLink();
link.setQuantum(QUANTUM);
link.enablePlayStateSync();   // follow Ableton's transport start/stop
link.enable();

const wss     = new WebSocketServer({ host: CFG.host, port: CFG.port });
const clients = new Set();

function snapshot() {
    return JSON.stringify({
        type:    'link',
        bpm:     link.bpm,
        beat:    link.beat,
        phase:   link.phase,
        quantum: QUANTUM,
        peers:   link.numPeers,
        playing: link.isPlaying,
    });
}

wss.on('connection', (ws) => {
    clients.add(ws);
    ws.send(snapshot());                       // immediate state on connect
    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => clients.delete(ws));
});

// startUpdate keeps the getters live and fires at 60fps; we relay at ~20Hz —
// the browser interpolates phase with its own clock between messages.
let frame = 0;
link.startUpdate(60, () => {
    if (frame++ % 3 !== 0) return;
    const msg = snapshot();
    for (const ws of clients) if (ws.readyState === WebSocket.OPEN) ws.send(msg);
});

link.onNumPeersChanged((n) => console.log(`[link] peers: ${n}`));
link.onTempoChanged((bpm) => console.log(`[link] tempo: ${bpm.toFixed(2)} bpm`));

console.log(`WebFoxDot Link bridge → ws://${CFG.host}:${CFG.port}  (quantum ${QUANTUM})`);
console.log('[link] waiting for Link peers (Ableton Live: enable Link in its toolbar)…');
