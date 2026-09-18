#!/usr/bin/env node
// A stand-in for webTroop, to develop and test the bridge against.
//
//   node tools/mock-webtroop.cjs
//
// Speaks the three interfaces js/net/webtroop.js reads — the Yjs room on 4444, the
// telemetry socket on 20000, the log socket on 1234 — and nothing else. It exists so
// the bridge can be built and tested without starting FoxDot and SuperCollider, which
// on a real rig means making sound in a room where people may be playing.
//
// Borrows ws / yjs / y-websocket from server/, the same way collab-server.js does.

const { WebSocketServer } = require('../server/node_modules/ws');
const Y = require('../server/node_modules/yjs');
const { setupWSConnection, docs } = require('../server/node_modules/y-websocket/bin/utils.cjs');

const ROOM = 'webtroop';

// ── the shared document, on 4444 ─────────────────────────────────────────────
const yws = new WebSocketServer({ port: 4444 });
yws.on('connection', (conn, req) => setupWSConnection(conn, req, { docName: ROOM }));
console.log('yjs       ws://127.0.0.1:4444   room "' + ROOM + '"');

// Type into it the way a player would. setupWSConnection owns the doc and does the
// broadcasting; we just edit the one it is holding.
const LINES = [
    'Clock.bpm = 132',
    'p1 >> pluck([0, 2, 4, 7], dur=1/2)',
    'b1 >> play("x-o-", sample=2)',
    'd1 >> bass([0, 0, 3], dur=1, lpf=800)',
];
let n = 0;
setInterval(() => {
    const doc = docs.get(ROOM);
    if (!doc) return;                       // nobody has joined yet, so there is no doc
    const t = doc.getText(ROOM);
    t.insert(t.length, LINES[n++ % LINES.length] + '\n');
}, 2000);

// A second "player", so awareness and the PRETEXT window have something in them.
setInterval(() => {
    const doc = docs.get(ROOM);
    if (!doc) return;
    const line = LINES[n % LINES.length];
    doc.awareness?.setLocalState({
        user: { name: 'mock-player', color: '#e85' },
        otherInstantCode: {
            user: 'mock-player', code: line, position: line.length, line: (n % 20) + 1,
            windowLines: LINES.slice(0, 3), windowStartLine: 1, windowEndLine: 3,
        },
    });
}, 1200);

// ── telemetry, on 20000 ──────────────────────────────────────────────────────
const tel = new WebSocketServer({ port: 20000 });
console.log('telemetry ws://127.0.0.1:20000  bpm · cpu · beat · scale · root · players');
let beat = 0;
setInterval(() => {
    const send = (o) => { for (const c of tel.clients) if (c.readyState === 1) c.send(JSON.stringify(o)); };
    send({ type: 'bpm', bpm: 132 });
    send({ type: 'cpu', cpu: Math.round(18 + Math.random() * 22) });
    send({ type: 'beat', beat: (beat = (beat + 1) % 4) });
    send({ type: 'scale', scale: 'minor' });
    send({ type: 'root', root: 'C' });
    send({ type: 'players', players: ['p1', 'b1', 'd1'] });
    send({ type: 'serverState', serverState: 'running' });
}, 500);

// ── logs, on 1234 ────────────────────────────────────────────────────────────
const logs = new WebSocketServer({ port: 1234 });
console.log('logs      ws://127.0.0.1:1234');
setInterval(() => {
    for (const c of logs.clients) if (c.readyState === 1)
        c.send(JSON.stringify({ type: 'log', log: 'svdk: p1 >> pluck([0,2,4])' }));
}, 3000);

console.log('\nmock webTroop up — ^C to stop');
