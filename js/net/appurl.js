// URLs that keep you where you are.
//
// The query string carries two different KINDS of thing, and they were being treated
// as one. `session` says which room you are in — that belongs to the jam, and it is
// what a link you hand someone else is about. `ui` and `diag` say how THIS machine is
// running the app — they belong to you, and nobody you share a link with wants them.
//
// Every in-app navigation was built as `location.pathname + '?session=' + slug`, which
// threw away the second kind along with the first. So anyone running the desktop UI
// from ?ui=desktop (rather than from the persisted toggle) landed back in the classic
// layout the moment they pressed "go live" or joined a jam from the galaxy — the app
// changed shape under them because they started a session.
//
// Two builders, because there really are two questions:
//   navUrl()  — where I am going. Keeps my setup, changes the room.
//   roomLink() — what I hand someone else. The room, and nothing of mine.

// Three spellings of the same key: the boot path accepts ?session=, the short ?s=,
// and a bare ?=NAME so a mistyped share link still joins. Setting one has to clear
// the other two, or the room you just left would win on the next read.
const SESSION_KEYS = ['session', 's', ''];

/**
 * A URL to navigate THIS tab to. Every current parameter survives except the session,
 * which is replaced by `slug` (or dropped, if it is null).
 */
export function navUrl(slug, search = location.search, pathname = location.pathname) {
    const q = new URLSearchParams(search);
    for (const k of SESSION_KEYS) q.delete(k);
    if (slug) q.set('session', slug);
    const s = q.toString();
    return pathname + (s ? '?' + s : '');
}

/**
 * An absolute link to a room, for the clipboard. Deliberately carries nothing but the
 * session: `ui` and `diag` describe the sender's machine, and forcing a layout on
 * whoever opens the link is not sharing, it is reaching across the table.
 */
export function roomLink(slug, origin = location.origin, pathname = location.pathname) {
    return origin + pathname + '?session=' + encodeURIComponent(slug);
}

/**
 * Is this page served from the loopback interface? Then the URL in the address bar
 * names THIS machine and nothing else: handing it to someone resolves, on their
 * computer, to their own localhost — a different server, a different collab relay and
 * therefore a different room that happens to have the same name. Both sides connect,
 * both look healthy, and neither sees the other's peers, chat or code.
 *
 * `serve.py` binds 127.0.0.1 by default, so this is the normal state, not an edge case.
 * `serve-lan.py` is the one that serves an address other machines can reach (over TLS,
 * because the WASM engine needs SharedArrayBuffer and that needs a secure context).
 */
export function isLoopbackOrigin(host = location.hostname) {
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
        || /^127\./.test(host);
}
