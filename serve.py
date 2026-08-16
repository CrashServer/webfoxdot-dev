#!/usr/bin/env python3
# Static dev server. Host/port come from config.json (static.*).
# Also serves the VJ Workshop under /workshop/ from the stars repo,
# so both apps share the same origin and BroadcastChannel works natively.
import http.server, os, json

ROOT     = os.path.dirname(os.path.abspath(__file__))
WORKSHOP = '/run/media/svdk/storage/DRIVE/500_Apps/stars/workshop'

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
            return os.path.normpath(WORKSHOP + rel)
        # Everything else → webfoxDot root
        return super().translate_path(path)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
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
