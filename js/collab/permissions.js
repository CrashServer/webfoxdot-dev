// Who controls what — an OPTIONAL, capability-based permission model for a room.
//
// Off by default, and while it is off every function here answers "yes": a jam behaves
// exactly as it did before anyone thought about permissions. It exists for the workshop
// case, where one person is teaching and fifteen are not, and where the shared mixer,
// tempo and PANIC that make a jam fun make a classroom unrunnable.
//
// ── Capabilities, not roles ───────────────────────────────────────────────────
// A role is just a NAME for a set of capabilities, and the set is editable live. So
// "listener" does not have to mean "can do nothing" — a listener who runs the PA can
// hold the mixer while holding nothing else, which is the default below. Adding a role
// is adding a row; adding a capability is adding a column and one gate at the point it
// is spent.
//
// ── This is etiquette, not security ───────────────────────────────────────────
// The relay forwards without validating and the shared document is a CRDT, so a
// modified client can ignore all of this. That is the right trade for a workshop (the
// threat model is a bored fifteen-year-old with the stock app, not an attacker) but it
// is worth being exact about. Two things make it hold up better than a pure send-side
// check would:
//
//   • Gates run on RECEIVE as well as on send. Your machine honours the room's rules no
//     matter what arrives, so one patched client cannot reach into everyone else.
//   • Identity is the stable user.id, not the display name, which anyone can retype.
//
// Real enforcement means the server assigning identity at connect and refusing frames
// itself. That is reachable for evals and actions — plain JSON it already parses — and
// a much bigger job for the document.

export const CAPS = [
    ['code',      'run code',   'evaluate lines into the room'],
    ['mixer',     'mixer',      'mute · solo · volume · stop a track'],
    ['transport', 'transport',  'tempo · key · section jumps · stop-all · PANIC'],
    ['macros',    'macros',     'perform-mode XY sweep and the momentary FX'],
    ['claim',     'claim',      'take ownership of a track by playing it'],
    ['visuals',   'visuals',    'layer knobs · opacity · blend · per-layer FX'],
];
export const CAP_KEYS = CAPS.map(c => c[0]);

// Roles ship as a starting point, not a fixed hierarchy — every cell is editable by the
// host at runtime. "listener" holding the mixer is the default on purpose: the person
// running the PA usually wants exactly that and nothing else.
export const ROLES = ['host', 'player', 'listener'];
const DEFAULT_CAPS = {
    host:     { code: 1, mixer: 1, transport: 1, macros: 1, claim: 1, visuals: 1 },
    player:   { code: 1, mixer: 1, transport: 0, macros: 1, claim: 1, visuals: 1 },
    listener: { code: 0, mixer: 1, transport: 0, macros: 0, claim: 0, visuals: 0 },
};
const DEFAULT_ROLE = 'player';

// ── Storage ───────────────────────────────────────────────────────────────────
// Backed by a Yjs map in the room document, so the rules converge, survive a reload
// and replay for whoever joins next. index.html installs the accessors.
let _get   = () => undefined;
let _set   = () => {};
let _myId  = () => '';

export function initPermissions({ get, set, myId } = {}) {
    if (get) _get = get;
    if (set) _set = set;
    if (myId) _myId = myId;
}

// ── Reading ───────────────────────────────────────────────────────────────────

/** Master switch. While false everything is permitted and claims are ignored. */
export function isEnabled() { return _get('on') === true; }

/** The room creator's user id (set once, by whoever opened the room). */
export function hostId() { return _get('host') || ''; }
export function isHost(uid = _myId()) { return !!uid && uid === hostId(); }

export function roleOf(uid = _myId()) {
    if (isHost(uid)) return 'host';                 // the creator's role is not editable
    return _get('role:' + uid) || DEFAULT_ROLE;
}
export function myRole() { return roleOf(_myId()); }

/** Is `cap` granted to `role`? Falls back to the shipped default for that cell. */
export function roleCan(role, cap) {
    const v = _get(`cap:${role}:${cap}`);
    if (v === true || v === false) return v;
    return !!(DEFAULT_CAPS[role] || {})[cap];
}

/** The only question the rest of the app asks. Permissive while disabled. */
export function can(cap, uid = _myId()) {
    if (!isEnabled()) return true;
    return roleCan(roleOf(uid), cap);
}

// ── Track claims ──────────────────────────────────────────────────────────────
// A track belongs to whoever first played it. Claims are advisory in the same way the
// rest of this is, but they are checked on BOTH sides: I will not send an eval for your
// track, and I will not apply one that arrives for mine.

export function ownerOf(track) { return _get('claim:' + track) || ''; }

/** May `uid` play/stop/edit this track? Unowned tracks are free. */
export function canPlay(track, uid = _myId()) {
    if (!isEnabled()) return true;
    const owner = ownerOf(track);
    if (!owner || owner === uid) return true;
    return isHost(uid);                              // the host can always take over
}

/** Take an unowned track. No-op if claims are off, or it is already someone's. */
export function claimTrack(track, uid = _myId()) {
    if (!isEnabled() || !can('claim', uid)) return false;
    if (ownerOf(track)) return false;
    _set('claim:' + track, uid);
    return true;
}

export function releaseTrack(track) {
    const owner = ownerOf(track);
    if (!owner) return false;
    if (owner !== _myId() && !isHost()) return false;   // yours, or you are the host
    _set('claim:' + track, '');
    return true;
}

/** Every current claim, as { track: userId }. */
export function claims() {
    const out = {};
    for (const [k, v] of entries()) if (k.startsWith('claim:') && v) out[k.slice(6)] = v;
    return out;
}

// ── Writing (host only, except the one-time host claim) ───────────────────────

/** Claim the room for `uid` if nobody holds it yet — the creator, on a fresh room. */
export function claimHostIfVacant(uid = _myId()) {
    if (hostId()) return false;
    _set('host', uid);
    return true;
}

export function setEnabled(on) {
    if (hostId() && !isHost()) return false;
    _set('on', !!on);
    return true;
}

export function setRole(uid, role) {
    if (!isHost()) return false;
    if (!ROLES.includes(role) || uid === hostId()) return false;
    _set('role:' + uid, role);
    return true;
}

export function setRoleCap(role, cap, on) {
    if (!isHost()) return false;
    if (!CAP_KEYS.includes(cap) || !ROLES.includes(role)) return false;
    _set(`cap:${role}:${cap}`, !!on);
    return true;
}

// The map's own key/value pairs, for claims() and the settings UI. Installed alongside
// the accessors so this module never imports Yjs.
let _entries = () => [];
export function initEntries(fn) { _entries = fn; }
function entries() { return _entries() || []; }

// ── Which capability does a given message spend? ──────────────────────────────
// One table, so a new action or state key is a one-line decision rather than a gate
// buried at the call site. Anything unlisted is ungated.

// evalError is deliberately absent: it is a diagnostic reply telling an author that
// their line failed on someone else's machine. A listener who may not run code still
// needs to be able to say "yours broke here" — gating it would defeat the point.
const ACTION_CAP = {
    stopLine:  'code',
    mixStop:   'mixer',
    panelStop: 'mixer',
    perfFX:    'macros',
    stopAll:   'transport',
    section:   'transport',
    cancel:    'transport',
    solo:      'mixer',
    unsolo:    'mixer',
    soloDrop:  'mixer',
};
export function capForAction(action) { return ACTION_CAP[action] || null; }

export function capForStateKey(key) {
    if (key === 'bpm' || key === 'scale' || key === 'root') return 'transport';
    if (key === 'xy') return 'macros';
    if (key.startsWith('level:') || key.startsWith('mute:') || key.startsWith('solo:')) return 'mixer';
    if (key.startsWith('synth:')) return 'code';
    // Layer knobs, per-layer FX and channel. Separate from 'code' because turning a
    // knob and rewriting the room's set are different amounts of trust: a VJ who is
    // not allowed to retype the music should still be able to open the strobe.
    if (key.startsWith('vl:') || key.startsWith('vfx:') || key.startsWith('vch:')) return 'visuals';
    return null;                                     // perms:* and anything new: ungated
}

/** The track a line defines, or '' — used to route an eval through canPlay(). */
export function trackInLine(line) {
    const m = String(line).match(/^\s*~?\s*([a-zA-Z_]\w*)\s*>>/);
    return m ? m[1] : '';
}
