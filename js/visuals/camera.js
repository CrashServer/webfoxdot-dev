// camera.js — the shared webcam feed.
//
// The webcam and media layers have always read `extra.cam` and `extra.media`, and the
// deck has always passed null for both, so they drew nothing and nothing ever asked
// for permission. This is the missing half.
//
// One stream for the whole app, not one per layer: a browser will happily hand out
// several, and then the camera light is on twice and two layers show the same face a
// frame apart. The element is a plain hidden <video>, because that is what the layers
// want to hand to drawImage.
//
// Nothing here throws at the caller. A refused camera, a machine without one, or a
// page served over plain http (getUserMedia needs a secure context, which localhost
// counts as) all end as a state you can read and a message worth showing.

let el = null;
let stream = null;
let state = 'off';        // off · asking · on · denied · missing · insecure · unsupported
let detail = '';

export function cameraState() { return { state, detail, live: state === 'on' }; }

/** The <video> for the layers, or null when there is nothing to show. */
export function cameraEl() { return state === 'on' ? el : null; }

/**
 * Ask for the camera. Safe to call repeatedly — a second call while one is in flight
 * or already granted does nothing.
 * @returns {Promise<boolean>} whether there is a picture at the end of it
 */
export async function startCamera({ width = 1280, height = 720, deviceId = null } = {}) {
    if (state === 'on') return true;
    if (state === 'asking') return false;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        // The API is missing on http:// as well as in old browsers, and the difference
        // matters to whoever is reading the message.
        const secure = typeof window !== 'undefined' && window.isSecureContext;
        state = secure ? 'unsupported' : 'insecure';
        detail = secure ? 'this browser has no getUserMedia'
                        : 'the camera needs https (or localhost) — this page is not a secure context';
        return false;
    }

    state = 'asking'; detail = '';
    try {
        const video = deviceId ? { deviceId: { exact: deviceId } }
                               : { width: { ideal: width }, height: { ideal: height } };
        stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    } catch (e) {
        const name = e?.name || '';
        state = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied'
              : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'missing'
              : 'unsupported';
        detail = name === 'NotAllowedError' ? 'permission was refused'
               : name === 'NotFoundError' ? 'no camera on this machine'
               : (e?.message || String(e));
        stream = null;
        return false;
    }

    if (!el) {
        el = document.createElement('video');
        el.muted = true;            // a muted video is allowed to autoplay
        el.playsInline = true;
        el.autoplay = true;
        // Never in the layout: the picture is drawn by the layers, not shown directly.
        el.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px';
        document.body.appendChild(el);
    }
    el.srcObject = stream;
    try { await el.play(); } catch (_) { /* autoplay of a muted stream rarely fails; the draw guard covers it */ }

    // The stream ending (the user revoking it, or unplugging the camera) is not an
    // error anywhere — it just stops producing frames — so it has to be watched for.
    for (const track of stream.getVideoTracks()) {
        track.addEventListener('ended', () => { if (state === 'on') { state = 'off'; detail = 'the camera stopped'; } });
    }

    state = 'on';
    detail = `${el.videoWidth || width}×${el.videoHeight || height}`;
    return true;
}

export function stopCamera() {
    if (stream) { for (const t of stream.getTracks()) { try { t.stop(); } catch (_) {} } }
    stream = null;
    if (el) { try { el.srcObject = null; } catch (_) {} }
    state = 'off'; detail = '';
}

/** The cameras this machine has, once permission exists to know their names. */
export async function cameraList() {
    try {
        const all = await navigator.mediaDevices.enumerateDevices();
        return all.filter(d => d.kind === 'videoinput')
                  .map((d, i) => ({ id: d.deviceId, label: d.label || `camera ${i + 1}` }));
    } catch (_) { return []; }
}
