const { WebSocketServer, WebSocket } = require('ws');
const { setupWSConnection }          = require('y-websocket/bin/utils');
const http                           = require('http');
const fs                             = require('fs');
const path                           = require('path');

const CFG  = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8')).collab;
const HOST = CFG.host;
const PORT = CFG.port;

// slug → Set<ws>
const rooms = new Map();
// Solo presence sockets — clients NOT in a session (no ?session=) that still
// register so the server can see solo usage. See js/collab/presence.js.
const solo  = new Set();

// One-line snapshot of who's connected: total app instances, the live sessions
// with per-room counts, and how many people are using it solo.
function logStatus() {
    const sess = [...rooms.entries()]
        .filter(([, r]) => r.size > 0)
        .map(([slug, r]) => `${slug}(${r.size})`);
    const sessionClients = sess.length ? [...rooms.values()].reduce((n, r) => n + r.size, 0) : 0;
    const instances = sessionClients + solo.size;
    console.log(`[status] instances: ${instances} · sessions: ${sess.length ? sess.join(', ') : '—'} · solo: ${solo.size}`);
}

function getRoom(slug) {
    if (!rooms.has(slug)) rooms.set(slug, new Set());
    return rooms.get(slug);
}

function removeFromRoom(slug, ws) {
    const room = rooms.get(slug);
    if (!room) return;
    room.delete(ws);
    if (room.size === 0) rooms.delete(slug);
}

function broadcast(slug, sender, message) {
    const room = rooms.get(slug);
    if (!room) return;
    for (const client of room) {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
}

// Extract room slug from request URL.
// Supports /<slug> and /?session=<slug>
function slugFromReq(req) {
    const url = new URL(req.url, 'ws://localhost');
    const pathSlug = url.pathname.replace(/^\//, '').trim();
    if (pathSlug) return pathSlug;
    return url.searchParams.get('session') || 'default';
}

const server = http.createServer();
const wss    = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
    const url  = new URL(req.url, 'ws://localhost');
    const slug = slugFromReq(req);
    const isApp = url.searchParams.get('app') === '1';
    const isSolo = url.searchParams.get('solo') === '1';

    // ── Solo presence — a player using the app without a session. No relay,
    // just presence so the server can count solo usage. Responds to ping.
    if (isApp && isSolo) {
        solo.add(ws);
        console.log(`[+solo] (${solo.size})`); logStatus();
        ws.on('message', (data) => {
            const str = Buffer.isBuffer(data) ? data.toString() : data;
            let msg; try { msg = JSON.parse(str); } catch { return; }
            if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong', t1: msg.t1, t2: Date.now() }));
        });
        ws.on('close', () => { solo.delete(ws); console.log(`[-solo] (${solo.size})`); logStatus(); });
        ws.on('error', () => { solo.delete(ws); });
        return;
    }

    // ── Yjs CRDT channel ──────────────────────────────────────────────────
    // y-websocket owns this socket entirely. No app handler here, so JSON
    // frames never reach the Yjs decoder.
    if (!isApp) {
        setupWSConnection(ws, req, { docName: slug });
        console.log(`[+yjs] ${slug}`);
        ws.on('close', () => console.log(`[-yjs] ${slug}`));
        return;
    }

    // ── App channel — eval relay + clock sync (JSON only) ─────────────────
    const room = getRoom(slug);
    room.add(ws);
    console.log(`[+app] ${slug} (${room.size} clients)`); logStatus();

    ws.on('message', (data) => {
        const str = Buffer.isBuffer(data) ? data.toString() : data;
        let msg;
        try { msg = JSON.parse(str); } catch { return; }

        switch (msg.type) {
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong', t1: msg.t1, t2: Date.now() }));
                break;
            case 'eval':
            case 'beat_sync':
            default:
                broadcast(slug, ws, str);
        }
    });

    ws.on('close', () => {
        removeFromRoom(slug, ws);
        console.log(`[-app] ${slug} (${(rooms.get(slug) || new Set()).size} clients)`); logStatus();
    });

    ws.on('error', (err) => console.error(`[!] ${slug}:`, err.message));
});

server.listen(PORT, HOST, () => {
    console.log(`WebFoxDot collab server → ws://${HOST}:${PORT}`);
});
