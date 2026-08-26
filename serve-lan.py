#!/usr/bin/env python3
"""
Workshop server — serve crashDot to other machines on the local network.

    python3 serve-lan.py

Attendees open the printed https://<your-ip>:8765 URL, click through the
"Not private" cert warning once (Advanced → Proceed), then boot as usual.

Why HTTPS: the WASM audio engine needs SharedArrayBuffer, which browsers only
expose in a *secure context*. http://localhost counts as secure; a plain
http://<LAN-IP> does NOT — so a LAN server has to speak TLS. The cert is
self-signed (generated on first run into .cert/, gitignored), hence the
one-time warning on each attendee's browser.
"""
import argparse, http.server, ipaddress, json, os, socket, socketserver, ssl, subprocess, sys

ROOT     = os.path.dirname(os.path.abspath(__file__))
CERT_DIR = os.path.join(ROOT, '.cert')
CERT     = os.path.join(CERT_DIR, 'server.crt')
KEY      = os.path.join(CERT_DIR, 'server.key')
# Optional: VJ Workshop mounted at /workshop/ (same origin → BroadcastChannel works)
WORKSHOP = '/run/media/svdk/storage/DRIVE/500_Apps/stars/workshop'

with open(os.path.join(ROOT, 'config.json')) as f:
    CFG = json.load(f)['static']


# ── LAN address discovery ────────────────────────────────────────────────────
SKIP_IFACES = ('lo', 'wg', 'tun', 'tap', 'docker', 'br-', 'veth', 'virbr', 'zt')

def lan_ips():
    """Real LAN addresses, VPN / container / loopback interfaces excluded."""
    found = []
    try:
        out = subprocess.run(['ip', '-4', '-o', 'addr', 'show', 'scope', 'global'],
                             capture_output=True, text=True, timeout=5).stdout
        for line in out.splitlines():
            parts = line.split()
            iface, addr = parts[1], parts[3].split('/')[0]
            if not iface.startswith(SKIP_IFACES):
                found.append(addr)
    except Exception:
        pass
    if not found:                       # macOS / Windows / no `ip` command
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(('8.8.8.8', 80))  # no packet sent, just picks the route
            found.append(s.getsockname()[0])
            s.close()
        except Exception:
            pass
    return found


# ── self-signed certificate ──────────────────────────────────────────────────
def make_cert(ips):
    os.makedirs(CERT_DIR, exist_ok=True)
    names = ['localhost'] + ips + ['127.0.0.1']
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        import datetime

        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'crashDot workshop')])
        san = []
        for n in names:
            try:
                san.append(x509.IPAddress(ipaddress.ip_address(n)))
            except ValueError:
                san.append(x509.DNSName(n))
        now = datetime.datetime.now(datetime.timezone.utc)
        cert = (x509.CertificateBuilder()
                .subject_name(subject).issuer_name(subject)
                .public_key(key.public_key())
                .serial_number(x509.random_serial_number())
                .not_valid_before(now - datetime.timedelta(days=1))
                .not_valid_after(now + datetime.timedelta(days=825))
                .add_extension(x509.SubjectAlternativeName(san), critical=False)
                .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
                .sign(key, hashes.SHA256()))
        with open(KEY, 'wb') as f:
            f.write(key.private_bytes(serialization.Encoding.PEM,
                                      serialization.PrivateFormat.TraditionalOpenSSL,
                                      serialization.NoEncryption()))
        with open(CERT, 'wb') as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
        os.chmod(KEY, 0o600)
        return
    except ImportError:
        pass

    # fallback: openssl CLI
    san = ','.join(('IP:' + n) if n[0].isdigit() else ('DNS:' + n) for n in names)
    cmd = ['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '825',
           '-keyout', KEY, '-out', CERT, '-subj', '/CN=crashDot workshop',
           '-addext', 'subjectAltName=' + san]
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        os.chmod(KEY, 0o600)
    except Exception as e:
        sys.exit(f"Could not generate a certificate ({e}).\n"
                 f"Install python 'cryptography' or 'openssl', or run with --http (localhost only).")


# ── server ───────────────────────────────────────────────────────────────────
class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.wasm': 'application/wasm',
                      '.mjs': 'text/javascript',
                      '.scsyndef': 'application/octet-stream'}

    def translate_path(self, path):
        path = path.split('?', 1)[0].split('#', 1)[0]
        if (path == '/workshop' or path.startswith('/workshop/')) and os.path.isdir(WORKSHOP):
            rel = path[len('/workshop'):]
            if not rel or rel == '/':
                rel = '/index.html'
            return os.path.normpath(WORKSHOP + rel)
        return super().translate_path(path)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    ap = argparse.ArgumentParser(description='Serve crashDot over the local network (HTTPS).')
    ap.add_argument('--port', type=int, default=CFG['port'], help=f"port (default {CFG['port']})")
    ap.add_argument('--http', action='store_true',
                    help='plain HTTP on 127.0.0.1 only — audio will NOT boot from other machines')
    ap.add_argument('--regen-cert', action='store_true', help='force a new certificate')
    args = ap.parse_args()

    os.chdir(ROOT)
    ips = lan_ips()

    if args.http:
        srv = Server(('127.0.0.1', args.port), Handler)
        urls = [f'http://127.0.0.1:{args.port}']
    else:
        if args.regen_cert or not (os.path.exists(CERT) and os.path.exists(KEY)):
            print('Generating a self-signed certificate…')
            make_cert(ips)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(CERT, KEY)
        srv = Server(('0.0.0.0', args.port), Handler)
        srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
        urls = [f'https://{ip}:{args.port}' for ip in ips] + [f'https://localhost:{args.port}']

    print()
    print('  crashDot workshop server')
    print('  ' + '─' * 44)
    for u in urls:
        print(f'  {u}')
        if os.path.isdir(WORKSHOP):
            print(f'  {u}/workshop/')
    if not args.http:
        print()
        print('  First visit on each machine shows a certificate warning:')
        print('    Chrome  → Advanced → Proceed to … (unsafe)')
        print('    Firefox → Advanced → Accept the Risk and Continue')
        print('  Then click boot. Same Wi-Fi, and the firewall must allow the port.')
    print()
    print('  Ctrl+C to stop.')
    print()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print('\n  stopped.')


if __name__ == '__main__':
    main()
