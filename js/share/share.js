// Self-contained composition sharing — the whole buffer is compressed straight
// into the URL hash (#c=…), so a link needs NO server and never expires. Uses the
// native CompressionStream (deflate-raw) when available; base64url either way.
// A 1-char prefix records the encoding:  'z' = deflated · 'u' = raw utf-8 (fallback).
//
// Note: a hash link stays comfortable for short compositions; a big #@ track makes
// a long URL that some chat apps truncate (a server short-link would fix that — TODO).

function _b64urlEncode(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function _b64urlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}
async function _pipe(Ctor, bytes) {
    const s = new Ctor('deflate-raw');
    const w = s.writable.getWriter(); w.write(bytes); w.close();
    return new Uint8Array(await new Response(s.readable).arrayBuffer());
}

// Compress `text` → a URL-safe token (with a 1-char encoding flag).
export async function encodeShare(text) {
    const raw = new TextEncoder().encode(text);
    if (typeof CompressionStream === 'function') {
        try { return 'z' + _b64urlEncode(await _pipe(CompressionStream, raw)); } catch (_) { /* fall through */ }
    }
    return 'u' + _b64urlEncode(raw);
}

// Token (from encodeShare) → the original text. Returns null on empty/garbage.
export async function decodeShare(str) {
    if (!str) return null;
    try {
        const flag = str[0], body = _b64urlDecode(str.slice(1));
        if (flag === 'z') {
            if (typeof DecompressionStream !== 'function') throw new Error('DecompressionStream unsupported');
            return new TextDecoder().decode(await _pipe(DecompressionStream, body));
        }
        if (flag === 'u') return new TextDecoder().decode(body);
        return new TextDecoder().decode(_b64urlDecode(str));   // lenient: no known prefix → raw
    } catch (_) { return null; }
}

// Build the full shareable URL for an encoded token (hash-based, server-free).
export function shareUrl(token) {
    return location.origin + location.pathname + '#c=' + token;
}
