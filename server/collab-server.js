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
    console.log(`[+app] ${slug} (${room.size} clients)`);

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
        console.log(`[-app] ${slug} (${(rooms.get(slug) || new Set()).size} clients)`);
    });

    ws.on('error', (err) => console.error(`[!] ${slug}:`, err.message));
});

server.listen(PORT, HOST, () => {
    console.log(`WebFoxDot collab server → ws://${HOST}:${PORT}`);
});
