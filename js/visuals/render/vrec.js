// ── Recording the visuals ────────────────────────────────────────────────────
//
// crashDot could already record three of the four things a set is made of — the
// audio, the code, and the MIDI — and not the picture. This is the fourth, ported
// from the workshop's export.js: MediaRecorder on the render canvas's own
// captureStream, so nothing is re-rendered and nothing leaves the machine.
//
// It records the SURFACE, which is the same canvas the SCREEN panel shows and the
// output windows copy from — so what lands in the file is what you were looking at,
// warps and projector mapping excepted (those describe a room, not the piece).
//
// WHY IT RECORDS A MIRROR RATHER THAN THE GL CANVAS DIRECTLY.
// captureStream() on a WebGL canvas is not dependable: measured here, a 2D canvas
// drawn in a loop yields a real WebM (10 KB for 1.5s) while the same loop on a WebGL2
// canvas yields 110 bytes — a header and no frames — with preserveDrawingBuffer both
// true and false. So this keeps a plain 2D mirror, copies each rendered frame into it
// with drawImage, and records THAT. It is the same copy the panel backdrops already
// make, from inside the render callback where the GL canvas can actually be read, and
// it costs one blit per frame while recording and nothing at all when not.
//
// What lands in the file is therefore exactly the composited picture, warps and
// projector mapping excepted — those describe a room, not the piece.

const CODECS = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

export function bestMime() {
    if (typeof MediaRecorder === 'undefined') return '';
    for (const m of CODECS) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (_) {} }
    return '';
}

export function createVideoRecorder() {
    let rec = null, chunks = [], started = 0;
    let mirror = null, mctx = null, W = 0, H = 0;

    function start(canvas, { fps = 30 } = {}) {
        if (rec && rec.state === 'recording') return false;
        if (typeof MediaRecorder === 'undefined' || !canvas?.width) return false;
        W = canvas.width; H = canvas.height;
        if (!mirror) {
            mirror = document.createElement('canvas');
            // IN the document, or captureStream barely fires. Measured: the same 2D
            // canvas drawn in the same loop yields 4.4 KB attached and 0.7 KB detached
            // — the browser only samples a canvas that is part of a rendered document.
            // Off-screen is fine; invisible is not the same thing as detached.
            mirror.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none';
            mirror.setAttribute('aria-hidden', 'true');
            document.body.appendChild(mirror);
            mctx = mirror.getContext('2d');
        }
        mirror.width = W; mirror.height = H;
        // Seed the mirror so the stream has a frame before the first capture() lands.
        try { mctx.drawImage(canvas, 0, 0); } catch (_) {}
        chunks = [];
        const mime = bestMime();
        try {
            rec = new MediaRecorder(mirror.captureStream(fps), mime ? { mimeType: mime } : {});
        } catch (e) { rec = null; return false; }
        rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.start();
        started = Date.now();
        return true;
    }

    /**
     * Copy one rendered frame in. MUST be called from the renderer's frame callback —
     * a WebGL canvas created with preserveDrawingBuffer:false reads black anywhere else.
     */
    function capture(canvas) {
        if (!rec || rec.state !== 'recording' || !canvas?.width) return;
        if (canvas.width !== W || canvas.height !== H) {
            // The surface resized mid-take. Keep the recording going at its original
            // size — MediaRecorder cannot change dimensions mid-stream — and letterbox.
            mctx.fillStyle = '#000'; mctx.fillRect(0, 0, W, H);
            const k = Math.min(W / canvas.width, H / canvas.height);
            const w = canvas.width * k, h = canvas.height * k;
            mctx.drawImage(canvas, (W - w) / 2, (H - h) / 2, w, h);
            return;
        }
        mctx.drawImage(canvas, 0, 0);
    }

    function stop() {
        return new Promise((resolve) => {
            if (!rec || rec.state !== 'recording') return resolve(null);
            rec.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                const secs = (Date.now() - started) / 1000;
                rec = null; chunks = [];
                resolve({ blob, seconds: secs, width: W, height: H });
            };
            rec.stop();
        });
    }

    return {
        start, stop, capture,
        get recording() { return !!rec && rec.state === 'recording'; },
        get seconds() { return rec ? (Date.now() - started) / 1000 : 0; },
    };
}

export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    a.click();
    // Revoking immediately can cancel the download in some browsers; a tick is enough.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
}
