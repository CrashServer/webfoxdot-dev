// safehtml.js — for the few places that build HTML out of other people's data.
//
// In a room, a peer's name, colour, chat, cursor and code arrive from THEIR client,
// and a modified client can send anything. Most panels use textContent and are safe;
// the ones that build rows with innerHTML need these two. Both exist because the
// earlier local copies each missed something: one escaper had no quote (so a value
// inside style="…" could close the attribute and add an onerror), and colours went
// into style attributes with no check at all. A colour like
//     red"><img src=x onerror=…>
// ran script in every browser in the room, whatever the room rules said.

/** Escape text for an HTML body OR a quoted attribute value. */
export function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// A colour we are willing to put in a style attribute: #rgb / #rrggbb / #rrggbbaa,
// rgb()/rgba()/hsl()/hsla() with numbers only, or a bare colour keyword. Anything
// else — including a valid colour with more CSS after it, which could fetch a URL
// from every viewer's browser — becomes the fallback.
const COLOR_RE = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\(\s*[\d.%\s,/+-]+\)|[a-z]{3,20})$/i;

/** A peer-supplied colour, if it is only a colour; otherwise the fallback. */
export function safeColor(c, fallback = '#888') {
    const s = String(c ?? '').trim();
    return COLOR_RE.test(s) ? s : fallback;
}
