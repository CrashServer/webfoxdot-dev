#!/usr/bin/env python3
# Static dev server. Host/port come from config.json (static.*).
# Also serves the VJ Workshop under /workshop/ from the stars repo,
# so both apps share the same origin and BroadcastChannel works natively.
import http.server, os, json
import urllib.parse

ROOT     = os.path.dirname(os.path.abspath(__file__))
WORKSHOP = '/run/media/svdk/storage/DRIVE/500_Apps/stars/workshop'

# ── /workshop/ path resolution ───────────────────────────────────────────────
# normpath RESOLVES '..' rather than rejecting it, so joining a request path
# straight onto WORKSHOP served any file on the machine — '/workshop/../../..'
# walks straight out. The stdlib's own translate_path() strips '..' components
# for exactly this reason, and mounting /workshop/ bypassed it. Confine the
# resolved path to the mount, and unquote first so a name with %20 in it still
# resolves (the stdlib does that too; this branch used to skip it).
WORKSHOP_REAL = os.path.realpath(WORKSHOP)

def workshop_path(rel):
    """Absolute path for `rel` under WORKSHOP, or None if it escapes the mount."""
    rel = urllib.parse.unquote(rel, errors='surrogatepass')
    full = os.path.realpath(os.path.join(WORKSHOP_REAL, rel.lstrip('/')))
    if full == WORKSHOP_REAL or full.startswith(WORKSHOP_REAL + os.sep):
        return full
    return None

with open(os.path.join(ROOT, 'config.json')) as f:
    CFG = json.load(f)['static']

class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Strip query string
        path = path.split('?', 1)[0].split('#', 1)[0]
        # Route /workshop/ → stars/workshop/
        if path == '/workshop' or path.startswith('/workshop/'):
            rel = path[len('/workshop'):]
            if not rel or rel == '/':
                rel = '/index.html'
            full = workshop_path(rel)
            # Outside the mount — a 404, not a file. (Nothing is at this path.)
            return full if full is not None else os.path.join(ROOT, '.no-such-file')
        # Everything else → webfoxDot root
        return super().translate_path(path)

    # Blanket no-store is right for the code you are editing — index.html, js/, css/
    # should never come from cache while live-coding the app itself. It is wrong for
    # the BUILT assets: the 141 compiled synthdefs (~620K), the WASM engine and the
    # sample bank change only when a build script runs, and no-store forbids the
    # browser from keeping them AT ALL — not even from revalidating — so every
    # refresh re-downloads the lot before a note can sound.
    #
    # Those get a short max-age with must-revalidate instead: the browser keeps the
    # bytes and asks "still current?", which this server answers with a 304 and no
    # body. Rebuild a synthdef and the mtime changes, so the next ask returns the new
    # one. Nothing goes stale, nothing re-downloads.
    CACHEABLE = ('/synthdefs/', '/samples/', '/lib/')

    def _cache_header(self):
        path = self.path.split('?', 1)[0]
        if any(seg in path for seg in self.CACHEABLE):
            return 'public, max-age=60, must-revalidate'
        return 'no-store, no-cache, must-revalidate'

    def end_headers(self):
        self.send_header('Cache-Control', self._cache_header())
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass

os.chdir(ROOT)
host, port = CFG['host'], CFG['port']
print(f"WebFoxDot  → http://{host}:{port}")
print(f"Workshop   → http://{host}:{port}/workshop/")
http.server.HTTPServer((host, port), Handler).serve_forever()
