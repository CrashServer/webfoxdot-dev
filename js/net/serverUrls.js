// Single source of truth for reaching the collab + link servers. The derivation —
// https ⇒ a same-origin proxied path · http ⇒ the port from config.json — lived
// copy-pasted in collab.js, presence.js, galaxy.js and link.js (the last with NO
// https branch, so Link broke on https). One place now, one cached config fetch.

let _cfg = null;
export async function getConfig() {
    if (_cfg) return _cfg;
    try { _cfg = await (await fetch('./config.json')).json(); } catch { _cfg = {}; }
    return _cfg;
}

const basePath = () => location.pathname.replace(/\/?[^/]*$/, '');
const sameOriginWs = (path) => `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${basePath()}${path}`;

// WebSocket base for the collab server (Yjs docs + app-channel eval relay).
export async function collabWsBase() {
    if (location.protocol === 'https:') return sameOriginWs('/ws');
    const port = (await getConfig()).collab?.port ?? 4444;
    return `ws://${location.hostname}:${port}`;
}

// HTTP base for the collab server (/sessions, /metrics, …).
export async function collabHttpBase() {
    if (location.protocol === 'https:') return `${location.origin}${basePath()}/ws`;
    const port = (await getConfig()).collab?.port ?? 4444;
    return `http://${location.hostname}:${port}`;
}

// WebSocket base for the Ableton-Link bridge. Under https it now uses a same-origin
// wss path (was ws:// only → blocked as mixed content on an https page).
export async function linkWsBase() {
    if (location.protocol === 'https:') return sameOriginWs('/link');
    const port = (await getConfig()).link?.port ?? 4445;
    return `ws://${location.hostname}:${port}`;
}
