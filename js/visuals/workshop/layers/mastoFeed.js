// ── Masto Feed ────────────────────────────────────────────────────────────
// Real posts off a public Mastodon hashtag timeline, scrolling as cards. The
// channel `message` sets the tag — "art", or "instance/tag" to point somewhere
// other than mastodon.social. No auth: public timelines are open endpoints.
//
// Refetches on a timer, keeps the last good batch on failure, and says so on
// screen rather than going blank.

const feeds = new Map();          // "instance/tag" -> {posts, at, error}
const REFRESH_MS = 90_000;

function stripHtml(s) {
    return String(s || "")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<\/p>/gi, " ")
        .replace(/<[^>]+>/g, "")
        .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " }[m] || " "))
        .replace(/\s+/g, " ")
        .trim();
}

function feed(instance, tag) {
    const key = `${instance}/${tag}`;
    const cur = feeds.get(key);
    if (cur && Date.now() - cur.at < REFRESH_MS) return cur;
    const entry = cur ?? { posts: [], at: 0, error: "" };
    entry.at = Date.now();
    feeds.set(key, entry);
    fetch(`https://${instance}/api/v1/timelines/tag/${encodeURIComponent(tag)}?limit=20`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))
        .then((j) => {
            const posts = (Array.isArray(j) ? j : []).map((s) => ({
                who: "@" + (s.account?.acct ?? "?"),
                text: stripHtml(s.content),
            })).filter((x) => x.text);
            if (posts.length) { entry.posts = posts; entry.error = ""; }
            else entry.error = "no posts for #" + tag;
        })
        .catch((e) => { entry.error = `#${tag}: ${e.message}`; });
    return entry;
}

export const mastoFeedParams = () => ({
    speed:     { base: 26,  min: -200, max: 200, mod: { source: "" } },
    columns:   { base: 1,   min: 1,    max: 4, step: 1, mod: { source: "" } },
    fontScale: { base: 0.026, min: 0.008, max: 0.09, mod: { source: "" } },
    hue:       { base: 265, min: 0,   max: 360, mod: { source: "" } },
    cardAlpha: { base: 0.55,min: 0,   max: 1,   mod: { source: "" } },
    maxChars:  { base: 180, min: 20,  max: 500, step: 1, mod: { source: "" } },
    showWho:   { base: 1,   min: 0,   max: 1, step: 1, mod: { source: "" } },
    glow:      { base: 0.3, min: 0,   max: 1,   mod: { source: "" } },
});

function wrap(ctx, text, maxW) {
    const words = text.split(" "), lines = [];
    let line = "";
    for (const word of words) {
        const test = line ? line + " " + word : word;
        if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
        else line = test;
    }
    if (line) lines.push(line);
    return lines;
}

export function drawMastoFeed(ctx, w, h, p, t, extra) {
    ctx.clearRect(0, 0, w, h);
    const raw = String(extra?.message ?? "").trim() || "art";
    const [instance, tag] = raw.includes("/") ? [raw.split("/")[0], raw.split("/").slice(1).join("/")] : ["mastodon.social", raw];
    const f = feed(instance, tag.replace(/^#/, ""));

    const hue = p.hue ?? 265;
    const fs = Math.max(7, h * (p.fontScale ?? 0.026));
    ctx.save();
    ctx.font = `${fs}px system-ui, sans-serif`;
    ctx.textBaseline = "top";

    if (!f.posts.length) {
        ctx.fillStyle = `hsl(${hue} 60% 65%)`;
        ctx.textAlign = "center";
        ctx.fillText(f.error || `loading #${tag}…`, w / 2, h / 2);
        ctx.restore();
        return;
    }

    const cols = Math.max(1, Math.round(p.columns ?? 1));
    const colW = w / cols, pad = fs * 0.7, maxW = colW - pad * 3;
    const maxChars = Math.round(p.maxChars ?? 180);
    if ((p.glow ?? 0.3) > 0.01) { ctx.shadowBlur = (p.glow ?? 0.3) * 12; ctx.shadowColor = `hsl(${hue} 90% 60%)`; }

    for (let c = 0; c < cols; c++) {
        // each column starts at a different post so they don't march in lockstep
        let y = h - ((t * (p.speed ?? 26) + (c * h) / cols) % (h * 2));
        let i = (c * 3) % f.posts.length, guard = 0;
        while (y < h && guard++ < 40) {
            const post = f.posts[i % f.posts.length]; i++;
            const body = post.text.length > maxChars ? post.text.slice(0, maxChars) + "…" : post.text;
            const lines = wrap(ctx, body, maxW);
            const showWho = (p.showWho ?? 1) > 0.5;
            const cardH = pad * 2 + (lines.length + (showWho ? 1 : 0)) * fs * 1.25;
            if (y + cardH > 0) {
                ctx.textAlign = "left";
                ctx.globalAlpha = p.cardAlpha ?? 0.55;
                ctx.fillStyle = "#0b0b12";
                ctx.fillRect(c * colW + pad * 0.5, y, colW - pad, cardH);
                ctx.fillStyle = `hsl(${hue} 85% 55%)`;
                ctx.fillRect(c * colW + pad * 0.5, y, Math.max(1, fs * 0.16), cardH);
                ctx.globalAlpha = 1;
                let ty = y + pad;
                if (showWho) {
                    ctx.fillStyle = `hsl(${hue} 80% 70%)`;
                    ctx.fillText(post.who, c * colW + pad * 1.5, ty);
                    ty += fs * 1.25;
                }
                ctx.fillStyle = "#dfe2ea";
                for (const l of lines) { ctx.fillText(l, c * colW + pad * 1.5, ty); ty += fs * 1.25; }
            }
            y += cardH + pad;
        }
    }
    ctx.restore();
}
