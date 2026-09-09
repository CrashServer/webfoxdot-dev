// Who you are in a room, and why that is two different questions.
//
// NAME, COLOUR and STATION are yours: they belong to the person, they should follow
// you into every room and every tab, and they live in localStorage.
//
// The ID is not the same thing. It answers "which connection is this", and it is what
// peers de-duplicate on, what `isSelf` tests, and what a role or a track claim attaches
// to. It used to live in localStorage beside the name — which meant two tabs of the
// same browser presented as ONE peer: the list showed a single row saying your own
// name, `isSelf` was true for both, and there was no way to tell "nobody has joined"
// from "someone joined and the app is collapsing us together". That is exactly how
// everybody tests a jam, so it is exactly the case that has to read truthfully.
//
// It lives in sessionStorage now: one per TAB, kept across reloads of that tab (so
// refreshing still does not spawn a ghost of you — the reason the id was stable in the
// first place) and different in a tab you open fresh.
//
// Caveat worth knowing: Chrome COPIES sessionStorage into a duplicated tab, so
// "Duplicate tab" produces two tabs sharing an id and the old collapse comes back.
// Opening the link in a new tab, a new window or another browser does not.
const NAME_KEY = 'wfd-user';
const ID_KEY   = 'wfd-tab-id';

const randomColor = () => `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`;
const mintId = () => 'u' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** This tab's connection id. Minted once, then stable for the life of the tab. */
export function tabId() {
    try {
        let id = sessionStorage.getItem(ID_KEY);
        if (!id) { id = mintId(); sessionStorage.setItem(ID_KEY, id); }
        return id;
    } catch (_) { return mintId(); }        // private mode with storage off: still unique
}

/** `{ id, name, color, station }` — the id from this tab, the rest from this browser. */
export function loadUser() {
    let u = null;
    try { u = JSON.parse(localStorage.getItem(NAME_KEY) || 'null'); } catch (_) {}
    if (!u || !u.name) u = { name: 'user' + Math.floor(Math.random() * 99), color: randomColor() };
    u.id = tabId();
    saveUser(u);
    return u;
}

/** Persist the parts that are yours. The id is deliberately not among them. */
export function saveUser(u) {
    const { id, ...rest } = u || {};
    try { localStorage.setItem(NAME_KEY, JSON.stringify(rest)); } catch (_) {}
}
