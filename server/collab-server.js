const { WebSocketServer, WebSocket } = require('ws');
const { setupWSConnection }          = require('y-websocket/bin/utils');
const http                           = require('http');
const fs                             = require('fs');
const path                           = require('path');

const CFG  = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8')).collab;
// Bind host: config.collab.host by default (0.0.0.0 for real deployments), but
// COLLAB_HOST overrides it — e.g. COLLAB_HOST=127.0.0.1 npm start for local dev
// or sandboxes that only allow binding loopback.
const HOST = process.env.COLLAB_HOST || CFG.host;
const PORT = process.env.COLLAB_PORT || CFG.port;

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

// ── Live monitor (SSE stream + /monitor dashboard) ──────────────────────────
const sseClients  = new Set();       // Set<http.ServerResponse>
const recentEvals = [];              // ring buffer of the latest evals (newest last)
const RECENT_MAX  = 120;
const roomMeta    = new Map();       // slug → { createdAt, evals, lastEval }
let   totalEvals  = 0;
let   monBaseline = process.cpuUsage();   // CPU baseline for the fast monitor tick
let   monAt       = Date.now();
let   liveCpuPct  = 0;

function roomMetaFor(slug) {
    if (!roomMeta.has(slug)) roomMeta.set(slug, { createdAt: Date.now(), evals: 0, lastEval: null });
    return roomMeta.get(slug);
}
function sseBroadcast(event, data) {
    if (sseClients.size === 0) return;
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) { try { res.write(frame); } catch { /* client gone */ } }
}
// Record an eval — from a session relay OR a solo report — and push it live.
function recordEval(slug, msg) {
    const rec = {
        slug,
        solo:   slug === '~solo',
        author: String(msg.author || '?').slice(0, 40),
        color:  typeof msg.color === 'string' ? msg.color.slice(0, 24) : '#8b949e',
        code:   String(msg.code || '').slice(0, 800),
        t:      Date.now(),
    };
    recentEvals.push(rec);
    if (recentEvals.length > RECENT_MAX) recentEvals.shift();
    totalEvals++;
    if (!rec.solo) { const m = roomMetaFor(slug); m.evals++; m.lastEval = rec; }
    sseBroadcast('eval', rec);
}
function sessionsDetail() {
    return [...rooms.entries()].filter(([, r]) => r.size > 0).map(([slug, r]) => {
        const m = roomMeta.get(slug) || {};
        return { slug, clients: r.size, ageMs: m.createdAt ? Date.now() - m.createdAt : 0, evals: m.evals || 0, lastEval: m.lastEval || null };
    });
}
// Everything the dashboard needs in one object (live CPU from the monitor tick).
function monitorState() {
    const m = metricsObject();
    m.cpuPercent = +liveCpuPct.toFixed(1);
    return { ...m, sessionsDetail: sessionsDetail(), totalEvals };
}
// Push the full state to dashboards (on connect, presence changes, and each tick).
function pushState() { sseBroadcast('state', monitorState()); }

function getRoom(slug) {
    if (!rooms.has(slug)) rooms.set(slug, new Set());
    return rooms.get(slug);
}

function removeFromRoom(slug, ws) {
    const room = rooms.get(slug);
    if (!room) return;
    room.delete(ws);
    if (room.size === 0) { rooms.delete(slug); roomMeta.delete(slug); }
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

// ── Dashboard page (served at /monitor) ─────────────────────────────────────
// Self-contained: no external assets. All live data arrives over the SSE stream.
// User-supplied strings (eval code, author, slug) are rendered via textContent.
const MONITOR_HTML = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>crashDot · live monitor</title>
<style>
  :root{--bg:#0d1117;--bg2:#161b22;--bg3:#21262d;--fg:#c9d1d9;--dim:#8b949e;--grn:#3fb950;--yel:#d29922;--red:#f85149;--bord:#30363d}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  header{display:flex;align-items:center;gap:12px;padding:10px 16px;background:var(--bg2);border-bottom:1px solid var(--bord);position:sticky;top:0;z-index:5}
  header h1{font-size:15px;margin:0;font-weight:600}
  header h1 span{color:var(--grn)}
  .dot{width:9px;height:9px;border-radius:50%;background:var(--red);flex:none}
  .dot.on{background:var(--grn);box-shadow:0 0 6px var(--grn)}
  .muted{color:var(--dim)}
  main{padding:16px;max-width:1200px;margin:0 auto}
  h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin:22px 0 10px;font-weight:600}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
  .card{background:var(--bg2);border:1px solid var(--bord);border-radius:8px;padding:10px 12px}
  .card .k{color:var(--dim);font-size:11px}
  .card .v{font-size:20px;font-weight:600;margin-top:2px}
  .card .v small{font-size:12px;color:var(--dim);font-weight:400}
  .sessions{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
  .sess{background:var(--bg2);border:1px solid var(--bord);border-radius:8px;padding:10px 12px}
  .sess .top{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
  .sess .slug{font-weight:600;color:var(--grn);word-break:break-all}
  .sess.solo .slug{color:var(--yel)}
  .sess .badge{background:var(--bg3);border-radius:10px;padding:1px 8px;font-size:11px;flex:none}
  .sess .meta{color:var(--dim);font-size:11px;margin-top:4px}
  .sess .last{margin-top:6px;padding:6px 8px;background:var(--bg);border-radius:6px;font-size:11px;white-space:pre-wrap;word-break:break-word;max-height:52px;overflow:hidden;color:#a5d6ff}
  .empty{color:var(--dim);padding:8px 2px}
  #feed{display:flex;flex-direction:column;gap:4px}
  .ev{display:grid;grid-template-columns:62px 92px 1fr;gap:8px;align-items:baseline;background:var(--bg2);border:1px solid var(--bord);border-radius:6px;padding:5px 9px}
  .ev.new{animation:flash 1.1s ease-out}
  @keyframes flash{from{background:#1f3d2a;border-color:var(--grn)}to{background:var(--bg2);border-color:var(--bord)}}
  .ev .t{color:var(--dim);font-size:11px}
  .ev .who{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ev .who b{font-weight:600}
  .ev .tag{color:var(--dim);font-size:10px}
  .ev .code{white-space:pre-wrap;word-break:break-word;color:#a5d6ff}
</style></head><body>
<header>
  <h1>crash<span>Dot</span> · live monitor</h1>
  <span id="conn" class="dot"></span><span id="connlabel" class="muted">connecting…</span>
  <span style="flex:1"></span>
  <span class="muted" id="uptime">—</span>
</header>
<main>
  <h2>Server</h2>
  <div class="cards" id="res"></div>
  <h2>Sessions &amp; solo</h2>
  <div class="sessions" id="sessions"></div>
  <h2>Live evaluations <span class="muted" id="evtotal"></span></h2>
  <div id="feed"></div>
</main>
<script>
(function(){
  const $=s=>document.querySelector(s);
  const card=(k,v,sub)=>{const d=document.createElement('div');d.className='card';
    const kk=document.createElement('div');kk.className='k';kk.textContent=k;
    const vv=document.createElement('div');vv.className='v';vv.textContent=v;
    if(sub){const s=document.createElement('small');s.textContent=' '+sub;vv.appendChild(s)}
    d.append(kk,vv);return d};
  const fmtBytes=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';
  const fmtAge=ms=>{const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60);
    return h?h+'h'+String(m).padStart(2,'0')+'m':m?m+'m'+String(s%60).padStart(2,'0')+'s':s+'s'};
  const fmtTime=t=>new Date(t).toLocaleTimeString('en-GB');
  function renderRes(m){const r=$('#res');r.textContent='';
    r.append(
      card('CPU',(m.cpuPercent??0)+'%'),
      card('RSS',(m.memory?.rssMB??0)+' MB'),
      card('Heap',(m.memory?.heapUsedMB??0),'/'+(m.memory?.heapTotalMB??0)+' MB'),
      card('Instances',m.instances??0,'peak '+(m.peakInstances??0)),
      card('Solo',m.solo??0),
      card('Sessions',(m.sessionsDetail?.length??0)),
      card('Yjs',m.yjsConnections??0),
      card('msg/min',m.rates?.messagesPerMin??0),
      card('relayed',fmtBytes(m.rates?.bytesPerSec??0)+'/s'),
      card('evals',m.totalEvals??0)
    );
    $('#uptime').textContent='up '+(m.uptimeHuman||'—');}
  function renderSessions(m){const el=$('#sessions');el.textContent='';
    const list=m.sessionsDetail||[];
    if(!list.length && !(m.solo>0)){const e=document.createElement('div');e.className='empty';e.textContent='no active sessions or solo players';el.append(e);return}
    list.forEach(s=>{
      const d=document.createElement('div');d.className='sess';
      const top=document.createElement('div');top.className='top';
      const slug=document.createElement('span');slug.className='slug';slug.textContent=s.slug;
      const b=document.createElement('span');b.className='badge';b.textContent=s.clients+(s.clients===1?' peer':' peers');
      top.append(slug,b);
      const meta=document.createElement('div');meta.className='meta';meta.textContent='age '+fmtAge(s.ageMs)+' · '+s.evals+' evals';
      d.append(top,meta);
      if(s.lastEval){const l=document.createElement('div');l.className='last';l.textContent=s.lastEval.author+': '+s.lastEval.code;d.append(l)}
      el.append(d);
    });
    if(m.solo>0){const d=document.createElement('div');d.className='sess solo';
      const top=document.createElement('div');top.className='top';
      const slug=document.createElement('span');slug.className='slug';slug.textContent='solo';
      const b=document.createElement('span');b.className='badge';b.textContent=m.solo+(m.solo===1?' player':' players');
      top.append(slug,b);const meta=document.createElement('div');meta.className='meta';meta.textContent='players with no session';
      d.append(top,meta);el.append(d)}}
  function addEval(rec,isNew){const feed=$('#feed');
    const row=document.createElement('div');row.className='ev'+(isNew?' new':'');
    const t=document.createElement('div');t.className='t';t.textContent=fmtTime(rec.t);
    const who=document.createElement('div');who.className='who';
    const tag=document.createElement('div');tag.className='tag';tag.textContent=rec.solo?'solo':rec.slug;
    const nm=document.createElement('b');nm.textContent=rec.author;nm.style.color=rec.color||'#c9d1d9';
    who.append(tag,document.createElement('br'),nm);
    const code=document.createElement('div');code.className='code';code.textContent=rec.code;
    row.append(t,who,code);
    feed.prepend(row);
    while(feed.children.length>150)feed.lastChild.remove();}
  function setConn(on){$('#conn').classList.toggle('on',on);$('#connlabel').textContent=on?'live':'reconnecting…'}
  let es;
  function connect(){
    es=new EventSource('/monitor/stream');
    es.addEventListener('init',e=>{const d=JSON.parse(e.data);setConn(true);
      renderRes(d.state);renderSessions(d.state);$('#evtotal').textContent='('+(d.state.totalEvals||0)+' total)';
      $('#feed').textContent='';(d.recentEvals||[]).forEach(r=>addEval(r,false));});
    es.addEventListener('state',e=>{const m=JSON.parse(e.data);setConn(true);
      renderRes(m);renderSessions(m);$('#evtotal').textContent='('+(m.totalEvals||0)+' total)';});
    es.addEventListener('eval',e=>addEval(JSON.parse(e.data),true));
    es.onerror=()=>{setConn(false)};
  }
  connect();
})();
</script></body></html>`;

const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const monitoring = ['/metrics', '/status', '/monitor', '/monitor/stream'].includes(url.pathname);

    if (req.method === 'GET' && monitoring) {
        if (!METRICS_PUBLIC && !isLocal(req)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('forbidden (monitoring is localhost-only; set collab.metricsPublic in config.json)\n');
            return;
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (url.pathname === '/monitor') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(MONITOR_HTML);
        } else if (url.pathname === '/monitor/stream') {
            // Server-Sent Events — one-way live push to the dashboard.
            res.writeHead(200, {
                'Content-Type':  'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection':    'keep-alive',
            });
            res.write('retry: 3000\n\n');
            res.write(`event: init\ndata: ${JSON.stringify({ state: monitorState(), recentEvals })}\n\n`);
            sseClients.add(res);
            req.on('close', () => sseClients.delete(res));
        } else if (url.pathname === '/metrics') {
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
        console.log(`[+solo] (${solo.size})`); logStatus(); pushState();
        ws.on('message', (data) => {
            const str = Buffer.isBuffer(data) ? data.toString() : data;
            stats.bytesIn += Buffer.byteLength(str);
            let msg; try { msg = JSON.parse(str); } catch { return; }
            if (msg.type === 'ping') { stats.msgs.ping++; ws.send(JSON.stringify({ type: 'pong', t1: msg.t1, t2: Date.now() })); }
            else if (msg.type === 'eval') { stats.msgs.eval++; recordEval('~solo', msg); }   // solo player's eval (not relayed)
        });
        ws.on('close', () => { solo.delete(ws); console.log(`[-solo] (${solo.size})`); logStatus(); pushState(); });
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
    console.log(`[+app] ${slug} (${room.size} clients)`); logStatus(); pushState();

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
            case 'eval':      stats.msgs.eval++;      stats.bytesOut += Buffer.byteLength(str) * broadcast(slug, ws, str); recordEval(slug, msg); break;
            case 'beat_sync': stats.msgs.beat_sync++; stats.bytesOut += Buffer.byteLength(str) * broadcast(slug, ws, str); break;
            default:          stats.msgs.other++;     stats.bytesOut += Buffer.byteLength(str) * broadcast(slug, ws, str);
        }
    });

    ws.on('close', () => {
        removeFromRoom(slug, ws);
        console.log(`[-app] ${slug} (${(rooms.get(slug) || new Set()).size} clients)`); logStatus(); pushState();
    });

    ws.on('error', (err) => console.error(`[!] ${slug}:`, err.message));
});

setInterval(snapshot, METRICS_INTERVAL_MS);

// Fast monitor tick — refresh live CPU% and push state to open dashboards (also
// keeps the SSE connections alive). Cheap when nobody's watching.
setInterval(() => {
    const now = Date.now(), wall = now - monAt;
    const c = process.cpuUsage(monBaseline);
    if (wall > 0) liveCpuPct = ((c.user + c.system) / 1000 / wall) * 100;
    monBaseline = process.cpuUsage(); monAt = now;
    if (sseClients.size) pushState();
}, 2000);

server.listen(PORT, HOST, () => {
    console.log(`WebFoxDot collab server → ws://${HOST}:${PORT}`);
    console.log(`  monitor: http://127.0.0.1:${PORT}/monitor  (live dashboard)`);
    console.log(`  metrics: http://127.0.0.1:${PORT}/metrics · /status · snapshot every ${METRICS_INTERVAL_MS / 1000}s${METRICS_PUBLIC ? ' · PUBLIC' : ' · localhost-only'}`);
});
