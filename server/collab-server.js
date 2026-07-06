const { WebSocketServer, WebSocket } = require('ws');
const { setupWSConnection }          = require('y-websocket/bin/utils');
const http                           = require('http');
const fs                             = require('fs');
const path                           = require('path');

const CFG  = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8')).collab;
const HOST = CFG.host;
const PORT = CFG.port;

// Seconds between periodic metrics snapshots (config.collab.metricsInterval, default 30).
const METRICS_INTERVAL_MS = (CFG.metricsInterval || 30) * 1000;
// By default /metrics + /status only answer localhost (the collab port is public
// on 0.0.0.0 and the payload lists live session slugs). Set collab.metricsPublic
// = true in config.json to expose them to anyone.
const METRICS_PUBLIC = CFG.metricsPublic === true;

// slug → Set<ws>
const rooms = new Map();
// Solo presence sockets — clients NOT in a session (no ?session=) that still
// register so the server can see solo usage. See js/collab/presence.js.
const solo  = new Set();

// ── Monitoring state ──────────────────────────────────────────────────────
const startedAt = Date.now();
let   lastCpu   = process.cpuUsage();   // baseline for the next snapshot's CPU%
let   yjsCount  = 0;                     // live Yjs (CRDT) sockets

const stats = {
    // cumulative message counts by type (app channel)
    msgs:  { eval: 0, beat_sync: 0, ping: 0, other: 0 },
    bytesIn:  0,                          // received on app + solo channels
    bytesOut: 0,                          // relayed out to peers
    conns: { app: 0, solo: 0, yjs: 0 },   // lifetime connection totals
    peakInstances: 0,
};
// last-snapshot baselines + cached derived values (for the on-demand endpoints)
let   snapAt   = Date.now();
let   snapMsgs = 0;
let   snapBytes = 0;
const latest   = { cpuPct: 0, msgsPerMin: 0, bytesPerSec: 0 };

const msgsTotal = () => stats.msgs.eval + stats.msgs.beat_sync + stats.msgs.ping + stats.msgs.other;

function instanceCount() {
    let sessionClients = 0;
    for (const r of rooms.values()) sessionClients += r.size;
    return sessionClients + solo.size;
}

function trackPeak() {
    const n = instanceCount();
    if (n > stats.peakInstances) stats.peakInstances = n;
}

// ── Formatting helpers ──────────────────────────────────────────────────────
function fmtDur(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h) return `${h}h${String(m).padStart(2, '0')}m`;
    if (m) return `${m}m${String(sec).padStart(2, '0')}s`;
    return `${sec}s`;
}
function fmtBytes(n) {
    if (n < 1024)               return `${n} B`;
    if (n < 1024 * 1024)        return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
function fmtNum(n) {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

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

// Full periodic metrics snapshot: process cost + throughput since the last tick.
function snapshot() {
    const now    = Date.now();
    const wallMs = now - snapAt;
    const cpu    = process.cpuUsage(lastCpu);                       // µs since last snapshot
    latest.cpuPct = wallMs > 0 ? ((cpu.user + cpu.system) / 1000 / wallMs) * 100 : 0;
    lastCpu = process.cpuUsage();

    const mt          = msgsTotal();
    latest.msgsPerMin  = wallMs > 0 ? (mt - snapMsgs) / (wallMs / 60000) : 0;
    latest.bytesPerSec = wallMs > 0 ? (stats.bytesOut - snapBytes) / (wallMs / 1000) : 0;
    snapAt = now; snapMsgs = mt; snapBytes = stats.bytesOut;

    const mem  = process.memoryUsage();
    const sess = [...rooms.entries()].filter(([, r]) => r.size > 0).map(([slug, r]) => `${slug}(${r.size})`);

    console.log(
        `[metrics] up ${fmtDur(now - startedAt)} · cpu ${latest.cpuPct.toFixed(1)}% · rss ${fmtBytes(mem.rss)}\n` +
        `          instances ${instanceCount()} (peak ${stats.peakInstances}) · sessions ${sess.length} · solo ${solo.size} · yjs ${yjsCount}\n` +
        `          msgs ${fmtNum(Math.round(latest.msgsPerMin))}/min (eval ${stats.msgs.eval}, sync ${stats.msgs.beat_sync}, ping ${stats.msgs.ping}) · ${fmtBytes(latest.bytesPerSec)}/s relayed\n` +
        `          rooms: ${sess.length ? sess.join(' ') : '—'}`
    );
}

// Machine-readable metrics (for /metrics + a scraper/dashboard).
function metricsObject() {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    return {
        uptimeMs:      Date.now() - startedAt,
        uptimeHuman:   fmtDur(Date.now() - startedAt),
        cpuPercent:    +latest.cpuPct.toFixed(1),        // load over the last snapshot window
        cpuUserMs:     Math.round(cpu.user / 1000),
        cpuSystemMs:   Math.round(cpu.system / 1000),
        memory: {
            rssMB:       +(mem.rss / 1048576).toFixed(1),
            heapUsedMB:  +(mem.heapUsed / 1048576).toFixed(1),
            heapTotalMB: +(mem.heapTotal / 1048576).toFixed(1),
        },
        instances:     instanceCount(),
        peakInstances: stats.peakInstances,
        sessions:      [...rooms.entries()].filter(([, r]) => r.size > 0).map(([slug, r]) => ({ slug, clients: r.size })),
        solo:          solo.size,
        yjsConnections: yjsCount,
        rates: {
            messagesPerMin: Math.round(latest.msgsPerMin),
            bytesPerSec:    Math.round(latest.bytesPerSec),
        },
        totals: {
            connections: { ...stats.conns },
            messages:    { ...stats.msgs, total: msgsTotal() },
            bytesIn:     stats.bytesIn,
            bytesOut:    stats.bytesOut,
        },
    };
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

// Relay a message to every other open client in the room; returns recipient count.
function broadcast(slug, sender, message) {
    const room = rooms.get(slug);
    if (!room) return 0;
    let n = 0;
    for (const client of room) {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(message);
            n++;
        }
    }
    return n;
}

// Extract room slug from request URL.
// Supports /<slug> and /?session=<slug>
function slugFromReq(req) {
    const url = new URL(req.url, 'ws://localhost');
    const pathSlug = url.pathname.replace(/^\//, '').trim();
    if (pathSlug) return pathSlug;
    return url.searchParams.get('session') || 'default';
}

// ── HTTP: monitoring endpoints (WS upgrades bypass this handler) ────────────
function isLocal(req) {
    const a = req.socket.remoteAddress || '';
    return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const monitoring = url.pathname === '/metrics' || url.pathname === '/status';

    if (req.method === 'GET' && monitoring) {
        if (!METRICS_PUBLIC && !isLocal(req)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('forbidden (metrics are localhost-only; set collab.metricsPublic in config.json)\n');
            return;
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (url.pathname === '/metrics') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(metricsObject(), null, 2));
        } else {
            const m = metricsObject();
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(
                `WebFoxDot collab — up ${m.uptimeHuman}\n` +
                `cpu ${m.cpuPercent}% · rss ${m.memory.rssMB}MB · heap ${m.memory.heapUsedMB}/${m.memory.heapTotalMB}MB\n` +
                `instances ${m.instances} (peak ${m.peakInstances}) · solo ${m.solo} · yjs ${m.yjsConnections}\n` +
                `rates ${m.rates.messagesPerMin} msg/min · ${fmtBytes(m.rates.bytesPerSec)}/s relayed\n` +
                `sessions: ${m.sessions.length ? m.sessions.map(s => `${s.slug}(${s.clients})`).join(' ') : '—'}\n` +
                `totals: ${m.totals.messages.total} msgs · ${fmtBytes(m.totals.bytesIn)} in · ${fmtBytes(m.totals.bytesOut)} out · conns app ${m.totals.connections.app}/solo ${m.totals.connections.solo}/yjs ${m.totals.connections.yjs}\n`
            );
        }
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
    const url  = new URL(req.url, 'ws://localhost');
    const slug = slugFromReq(req);
    const isApp = url.searchParams.get('app') === '1';
    const isSolo = url.searchParams.get('solo') === '1';

    // ── Solo presence — a player using the app without a session. No relay,
    // just presence so the server can count solo usage. Responds to ping.
    if (isApp && isSolo) {
        solo.add(ws);
        stats.conns.solo++; trackPeak();
        console.log(`[+solo] (${solo.size})`); logStatus();
        ws.on('message', (data) => {
            const str = Buffer.isBuffer(data) ? data.toString() : data;
            stats.bytesIn += Buffer.byteLength(str);
            let msg; try { msg = JSON.parse(str); } catch { return; }
            if (msg.type === 'ping') { stats.msgs.ping++; ws.send(JSON.stringify({ type: 'pong', t1: msg.t1, t2: Date.now() })); }
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
        yjsCount++; stats.conns.yjs++;
        console.log(`[+yjs] ${slug}`);
        ws.on('close', () => { yjsCount--; console.log(`[-yjs] ${slug}`); });
        return;
    }

    // ── App channel — eval relay + clock sync (JSON only) ─────────────────
    const room = getRoom(slug);
    room.add(ws);
    stats.conns.app++; trackPeak();
    console.log(`[+app] ${slug} (${room.size} clients)`); logStatus();

    ws.on('message', (data) => {
        const str = Buffer.isBuffer(data) ? data.toString() : data;
        stats.bytesIn += Buffer.byteLength(str);
        let msg;
        try { msg = JSON.parse(str); } catch { return; }

        switch (msg.type) {
            case 'ping':
                stats.msgs.ping++;
                ws.send(JSON.stringify({ type: 'pong', t1: msg.t1, t2: Date.now() }));
                break;
            case 'eval':      stats.msgs.eval++;      stats.bytesOut += Buffer.byteLength(str) * broadcast(slug, ws, str); break;
            case 'beat_sync': stats.msgs.beat_sync++; stats.bytesOut += Buffer.byteLength(str) * broadcast(slug, ws, str); break;
            default:          stats.msgs.other++;     stats.bytesOut += Buffer.byteLength(str) * broadcast(slug, ws, str);
        }
    });

    ws.on('close', () => {
        removeFromRoom(slug, ws);
        console.log(`[-app] ${slug} (${(rooms.get(slug) || new Set()).size} clients)`); logStatus();
    });

    ws.on('error', (err) => console.error(`[!] ${slug}:`, err.message));
});

setInterval(snapshot, METRICS_INTERVAL_MS);

server.listen(PORT, HOST, () => {
    console.log(`WebFoxDot collab server → ws://${HOST}:${PORT}`);
    console.log(`  metrics: http://127.0.0.1:${PORT}/metrics · http://127.0.0.1:${PORT}/status · snapshot every ${METRICS_INTERVAL_MS / 1000}s${METRICS_PUBLIC ? ' · PUBLIC' : ' · localhost-only'}`);
});
