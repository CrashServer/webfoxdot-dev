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
// Ports are arguments now, because on a machine that RUNS webTroop the real thing
// already holds 4444/20000/1234 and the mock could not start at all:
//   node tools/mock-webtroop.cjs 4455 20001 1235
const P_Y   = Number(process.argv[2]) || 4444;
const P_TEL = Number(process.argv[3]) || 20000;
const P_LOG = Number(process.argv[4]) || 1234;

// ── the shared document, on 4444 ─────────────────────────────────────────────
const yws = new WebSocketServer({ port: P_Y });
yws.on('connection', (conn, req) => setupWSConnection(conn, req, { docName: ROOM }));
console.log('yjs       ws://127.0.0.1:' + P_Y + '   room "' + ROOM + '"');

// A real CLIENT, not the server poking its own document.
//
// It used to edit the doc through the server's own handle and set awareness on the
// server's Doc. The text reached crashDot, but the AWARENESS did not: y-websocket
// broadcasts a client's awareness when it changes and the server's own only when
// somebody connects. So a watcher saw one PRETEXT window at connect and never
// another, the buffer feed won every time, and the mock quietly could not exercise
// the one path it was built to exercise. Connecting to itself the way a player does
// is the only version of this that tells the truth.
const { WebsocketProvider } = require('../server/node_modules/y-websocket');

const LINES = [
    'Clock.bpm = 132',
    'p1 >> pluck([0, 2, 4, 7], dur=1/2)',
    'b1 >> play("x-o-", sample=2)',
    'd1 >> bass([0, 0, 3], dur=1, lpf=800)',
];
const cdoc = new Y.Doc();
const provider = new WebsocketProvider('ws://127.0.0.1:' + P_Y, ROOM, cdoc, { WebSocketPolyfill: WebSocket });
provider.awareness.setLocalStateField('user', { name: 'mock-player', color: '#e85' });
const ctext = cdoc.getText(ROOM);
let n = 0;

// Typing: a line into the shared buffer every couple of seconds.
setInterval(() => { ctext.insert(ctext.length, LINES[n++ % LINES.length] + '\n'); }, 2000);

// PRETEXT: a window that MOVES, around a cursor somewhere in the real buffer,
// republished on its own beat the way a keystroke would.
setInterval(() => {
    const all = ctext.toString().split('\n').filter(Boolean);
    if (!all.length) return;
    const cur = n % all.length;
    const start = Math.max(0, cur - 2);
    const win = all.slice(start, start + 5);
    provider.awareness.setLocalStateField('otherInstantCode', {
        user: 'mock-player', code: all[cur], position: all[cur].length, line: cur + 1,
        windowLines: win, windowStartLine: start + 1, windowEndLine: start + win.length,
    });
}, 1200);

// ── telemetry, on 20000 ──────────────────────────────────────────────────────
const tel = new WebSocketServer({ port: P_TEL });
console.log('telemetry ws://127.0.0.1:' + P_TEL + '  bpm · cpu · beat · scale · root · players');
// The shapes below are the ones a REAL rig sends, read off one rather than guessed.
// They are not the obvious ones, and the difference matters: beat is an absolute
// FRACTIONAL count and not a position in the bar, so a mock that cycles 0..3 would
// have let a clock lock that cannot work pass its test. root is the string "0", not
// a note name. serverState is a boolean JSON has flattened to 0/1. players is an
// array of JSON STRINGS, each one an encoded object.
const BPM = 120;
const t0 = Date.now();
setInterval(() => {
    const send = (o) => { for (const c of tel.clients) if (c.readyState === 1) c.send(JSON.stringify(o)); };
    const secs = (Date.now() - t0) / 1000;
    send({ type: 'bpm', bpm: BPM });
    send({ type: 'cpu', cpu: Math.round(18 + Math.random() * 22) });
    send({ type: 'beat', beat: secs * (BPM / 60) });          // absolute, fractional
    send({ type: 'scale', scale: 'major' });
    send({ type: 'root', root: '0' });                        // a semitone, as a string
    send({ type: 'chrono', chrono: secs });
    send({ type: 'masterFx', masterFx: {} });
    send({ type: 'players', players: ['p1', 'b1', 'd1'].map((p, i) =>
        JSON.stringify({ player: p, name: ['pluck', 'play', 'bass'][i], duration: '00:12', solo: false })) });
    send({ type: 'serverState', serverState: 1 });
}, 100);                                                       // their FoxDot sends beat 10x/s

// ── logs, on 1234 ────────────────────────────────────────────────────────────
const logs = new WebSocketServer({ port: P_LOG });
console.log('logs      ws://127.0.0.1:' + P_LOG);
setInterval(() => {
    for (const c of logs.clients) if (c.readyState === 1)
        c.send(JSON.stringify({ type: 'log', log: 'svdk: p1 >> pluck([0,2,4])' }));
}, 3000);

console.log('\nmock webTroop up — ^C to stop');
