#!/usr/bin/env python3
# Static dev server. Host/port come from config.json (static.*).
import http.server, os, json

ROOT = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(ROOT, 'config.json')) as f:
    CFG = json.load(f)['static']

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()
    def log_message(self, fmt, *args):
        pass

os.chdir(ROOT)
host, port = CFG['host'], CFG['port']
print(f"WebFoxDot static server → http://{host}:{port}")
http.server.HTTPServer((host, port), NoCacheHandler).serve_forever()
