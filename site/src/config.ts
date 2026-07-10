// ── Central config ──────────────────────────────────────────────────────────
// Point APP_URL at wherever crashDot is deployed; every launch/jam/galaxy link and
// the live-galaxy feed derive from it. These are PLACEHOLDERS — swap the domain.

export const APP_URL = 'https://crashdot.crashserver.fr';   // ← the live app (placeholder)
export const REPO    = 'https://github.com/CrashServer/webfoxdot-dev';
export const VERSION = 'β01';

// Access links.
export const SOLO_URL = APP_URL;                            // open · boot · play, solo
export const GALAXY_URL = APP_URL;                          // open, then hit 🌌 galaxy
// Multiplayer: a fresh room per visitor is minted client-side (see Play.astro) as
// APP_URL/?session=<random>; this is the fallback if JS is off.
export const JAM_URL = APP_URL;

// The collab server's PUBLIC live-sessions feed — drives the realtime galaxy widget.
// (Same-origin /ws/sessions on the deploy; sent with Access-Control-Allow-Origin: *.)
export const SESSIONS_FEED = `${APP_URL}/ws/sessions`;
