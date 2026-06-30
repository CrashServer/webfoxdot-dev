// drummer — auto-drummer for play() players, ported from FoxDot/CrashServer.
//
//   b1 >> play("x").drummer()      ← b1 becomes a self-evolving rock drummer
//
// Picks a random rock groove + a random fill, alternates groove→fill within each
// loop, and re-randomises every `durloop` beats. Patterns are FoxDot multi-layer
// play strings: each top-level <…> is an INDEPENDENT looping layer (kick / snare /
// hi-hat / tom) that overlaps the others. crashDot's parser instead reads <…> as
// cycle-alternation, so expandLayers() first merges the layers into one step list
// (simultaneous hits grouped, layers looped to their LCM) before handing the
// result to the player as a normal parsed pattern.

import { parsePattern } from './sampler.js';

// ── Groove + fill libraries (verbatim from CrashServer drumRockPattern.py) ─────
// Grouped by category: drummer() picks a random category, then a random pattern
// inside it (so small categories weight their patterns higher — as in FoxDot).

export const ROCK_PATTERNS = [
    [ // 1 — one-bar basics
        "<k...kk..><..u...u.><->",
        "<k..kk...><..u...u.><->",
        "<k...kk.[.k]><..u[.u][.u].u.><->",
        "<k.><.u><->",
        "<k...><.u><-.-.-.-.->",
        "<k..k.k..><..u.u...><-.-:.-:.-:.-:->",
        "<k...k...><...u..u.><-.-.-.-.->",
    ],
    [ // 2 — two-bar rock grooves
        "<k..kk..kk..kkk.k><..u[.u]..u...u[.u]..u.><->",
        "<kk.kk..k.k.k.k.k><..u[.u]..u.><->",
        "<kk.kk..k.k.k.[.k].k><[.u].u[.u]..u[.u][.u].u.[.u].u.><->",
        "<kk.[.k].[.k]..[.k]..[.k].[.k].k><..u...u[.u]..u.[.u].u.><->",
        "<k[kk].[kk].[kk][.k].[.k]..[kk][.k]k[.k][.k]><..u.[.u].u...u...u.><->",
        "<[.k]k.[kk][.k][.k].[kk].k[.k][.k].[kk][.k][.k]><..u...u...u.u.uu><->",
    ],
    [ // 3 — four-to-the-floor
        "<k.><..u[.u]..u.><->",
        "<k.><[.u].u[.u].uu.><->",
        "<k.><..u.[.u].uu><->",
        "<k.><.uu.[.u].uu><->",
        "<k.><..u...u[.u]><-><...:.:..>",
        "<k.><[.u].u[.u]..u[.u]><-><...:.:..>",
        "<k.><[.u].u[.u][.u].u[.u]><-><.:...:..>",
        "<k.><[.u].u[.u][.u].[uu][.u]><-><.:...:.:>",
    ],
    [ // 4 — rockin' the ands
        "<k.k.k.k.><..u...u.><.=>",
        "<k.k.k.kk><..u[.u]..u.><.=>",
        "<k[.k]...k.k><..u[.u]..u.><.=>",
        "<k.[.k]..k[.k].><..u...u.><.=>",
        "<k[.k].kkk[.k].><[.u].u...u[.u]><.=>",
        "<k[.k]..k[.k].k><[.u].u[.u][.u].u[.u]><.=>",
        "<[.k][.k].kk[.k].[.k]><..u.[.u].uu><.=>",
        "<[.k][.k][.k].kk[.k]k><..u[.u][.u].u.><.=>",
        "<k[kk]..k..><..u...u.><-.-.-.-.->",
    ],
    [ // 5 — ride & tom
        "<k[.k].k[.k]..k><[.u].u[.u]..u[.u]><-------->",
        "<k[.k].k[.k]..k><..u[.u]..u.><[.t]..[.t]...[.t]><->",
        "<k[.k].k[.k]..k><..u...u.><[.t]..[.t]...[.t]><->",
        "<k[.k].k[.k]..k><..u...u.><[.t]..[.t]...[.t]><-~>",
        "<k[.k].k[.k]..k><..u...u.><[.t]..[.t].M.[.t]><-~>",
        "<k[.k].k[.k]..k><..u...u.><[Mt]..[Mt].M.[.t]><-~>",
        "<k..k.k..><..u...u.><-.-.-.-.-><t...m...>",
    ],
    [ // 6 — non-standard open hats
        "<k..k.k..><..u...u.><:..:.:..><->",
        "<.k..k..k><..u...u.><:..:.:..><->",
        "<kk..kk.k><..u...u.><.:..:..:><->",
        "<k[.k]...k.[.k]><..u...u.><.:..:..:><->",
        "<[.k]....k.[.k]><..u...u.><..:.:..:><->",
        "<[.k][.k]..k[.k].k><..u...u.><..:.:..:><->",
        "<k...[.k]..[.k]><..u[.u]..u.><::...::.><->",
        "<[.k]..[kk][.k]k.k><..u...u.><::...::.><->",
    ],
    [ // 7 — basic
        "<k...k...><..u...u.><->",
        "<k....k..><..u...u.><->",
        "<k......k><..u...u.><->",
        "<kk......><..u...u.><->",
        "<k..k....><..u...u.><->",
        "<kk..k...><..u...u.><->",
        "<k..kk...><..u...u.><->",
        "<k...kk..><..u...u.><->",
        "<k....k.k><..u...u.><->",
        "<k..k.k..><..u...u.><->",
    ],
    [ // 8 — basic 2
        "<k...kk.k><..u.><->",
        "<kk..kk..><..u.><->",
        "<k..kkk..><..u.><->",
        "<kk...k.k><..u.><->",
        "<kk.k.k..><..u.><->",
        "<kk.k...k><..u.><->",
        "<k..k.k.k><..u.><->",
        "<k.k.k.k.><..u.><->",
        "<kkk..k..><..u.><->",
        "<kkk....k><..u.><->",
    ],
    [ // 9 — famous rock
        "<(k.kk).(.k.k) ... k.k ..(k.k.).><....u.......u.(...u)(...u)><(=---)---.-------.--->",
        "<k..k...kk..k....><....u....u..u...><=.-.-.-.-.-.-.:.>",
        "<k.. ... k(...k).(...k).(...k)..><... u.. ... u.(...u).><-.-.-.-.-.-.-.-.>",
        "<kk.k...(kkk.)..kk.(...k)..><....u..(...u).(...u)..u.(...u).><-.>",
        "<k.. (...k).k ... (.k).(k.).><..(...u)(...u)... u.. ... ><-.. -.. -.. (-:).. >",
        "<k.k..k.k.><..u...u.><-.-.-.-.->",
        "<k..k.k..><..u.u...><-.-.-.-.->",
    ],
    [ // 10 — post-rock complexes
        "<k..k.k..k...k..><..u...u..u...u.><-.-=.-.-=.-.-><t...m...T.>",
        "<k...k..k.k...k.><..u.u...u..u...><-.-=.-.-=.-.->",
        "<k..k.k..><..u...u.><-.-.-.-.-><t...m..>",
        "<k...k...k...k...><..u...u...u...><t.m.t.m.><-.-.-.-.->",
        "<k..k.k..><..u.u...><-.-.-=.-.-=-><...T...M...>",
        "<k...k...k...k...><..u...u...u...><-.-.-.-.-.-.-=-><t.m.T.M.>",
        "<k...k...k...k...><.u.u.u.u.u.u.u.u><t...m...T...M...><-.-.-.-.->",
        "<k.....k.....k...><..u.....u.....><t...T...m...M...><~---~--->",
    ],
];

export const ROCK_FILLS = [
    [ // 1 — punchy short fills
        "<kk.kkk..><..u...u.><:------.><.......[{tm}{MT}]>",
        "<k..k.k..><..u...u[uu]><:------.><.......{tm}>",
        "<kk.kkk[.k].><[.u].u[.u]..u.><:------.><.......[mM]>",
        "<k[kk].kkk.[.k]><[.u].u[.u][.u].[uu].><:------[.=]><.......t>",
        "<k.[.k][.k]....><..u.[.u][uu]..><:----...><......[{MT}{MT}][{tm}{tm}]>",
        "<k..k[.k]k[.k].><..u.u[.u]u[uu]><:----[.-]-.><.......[tt]>",
    ],
    [ // 2 — unique crash placements
        "<...k[.k]..[.k]><[MM][MM][mm][.m]t[tt][uu][u.]><...=[.=]..[.:]>",
        "<.[.k]...k[.k].><[uu]u[MM][MM][mm][.m]t[tt]><.[.:]...=[.=].>",
        "<k.[.k].[.k].[.k].><.[uu]u[MM]M[mm]m[tt]><:.[.:].[.:].[.=].>",
        "<.k.k.[.k].[.k]><[uu].[MM].[mm]m[tt]t><.:.=.[.=].[.=]>",
    ],
    [ // 3 — linear skeleton fills
        "<k[.k]...k...[.k][.k][.k]..[.k][.k]><..u...u.[uu].u.[uu][.u]u.><:-------.-.-.-.->",
        "<k[.k]...k.kk[.k][.k].k[.k][.k].><..u...u.[.u].u[.u][.u].u[.u]><:-------.-.-.-.->",
        "<k[.k].[.k].k.[.k][.k][.k][.k].[.k][.k][.k].><..u...u.u.u.u.u.><:-------.-.[--].-.[--]>",
        "<k[.k]...k.[kk].k[.k]..k[.k].><..u.[.r].u...u...u[.u]><:-------[--][.-].-[--][.-].->",
        "<k[.k]...[.k].[kk].[.k].k.[.k].k><..u[.r][.r].u.u.[.u].u.[.u].><:-------[.-]--[.-][.-]--[.-]>",
        "<k[.k].k.[.k].kk[.k].[.k]k[.k].[.k]><[.r]ru[.r][.r].u[.r].u[.u]..u[.u].><:-------[.-].--[.-].-->",
    ],
    [ // 4 — basic I
        "<k.><[ur][ru][rr][ur]><->",
        "<k.[kk].k[kk][.k]k><....[.T].[TT].><----...[.:]>",
        "<k.[kk].[.k]kkk><..u(.{u[uu].})><-----[.-].:>",
        "<[.k].[kk].k.[.k][.k]><..{u.}{.u[uu]}><.....[MM]..><.....[tt]..><----[.:].[.:][.:]>",
    ],
    [ // 5 — basic II
        "<.[k.][.k].[k.][.k]..><[ur][.u][r.][ur][.u][r.][ur][ur]><[--]>",
        "<k.><[ur][ru][rr][ur][ru][rr][ur][ur]><[--]>",
        "<.[.k].[.k].[.k]..><[ur][r.][ur][r.][ur][r.][ur][ur]><[--]>",
        "<.[kk].[kk].[kk].k><[ur][..][ur][..][ur][..]uk><[--]>",
        "<.[.k][k.][..][kk][..][.k][k.]><[ur][r.][.u][rr][..][ur][r.][.r]><[--]>",
    ],
];

// ── Layer expansion ───────────────────────────────────────────────────────────

function gcd(a, b) { while (b) { [a, b] = [b, a % b]; } return a; }
function lcm(a, b) { return a && b ? (a / gcd(a, b)) * b : (a || b); }

// Split "<L1><L2><L3>" into its top-level layer strings. Inner content uses only
// ()[]{} (never < >), so a simple ><-split is safe.
function splitLayers(str) {
    const s = str.trim();
    if (!s.startsWith('<') || !s.endsWith('>')) return [s];
    return s.slice(1, -1).split('><');
}

// FoxDot multi-layer play string → a single crashDot parsed-pattern (array of
// step tokens). Each layer is parsed on its own, then looped to the combined LCM
// length and merged: simultaneous hits at a step become a 'sim' group.
//
// cap bounds the materialised length: co-prime layer lengths can push the true LCM
// into the hundreds of steps, but a drummer re-randomises every durloop beats (~32
// steps) long before that loops, so capping just trims a tail that never plays.
export function expandLayers(str, cap = 64) {
    const layers = splitLayers(str).map(parsePattern).filter(t => t.length);
    if (!layers.length) return [{ rest: true }];
    const len = Math.min(cap, layers.reduce((a, t) => lcm(a, t.length), 1));
    const out = [];
    for (let i = 0; i < len; i++) {
        const hits = [];
        for (const layer of layers) {
            const tok = layer[i % layer.length];
            if (tok && !tok.rest) hits.push(tok);
        }
        if (hits.length === 0)      out.push({ rest: true });
        else if (hits.length === 1) out.push(hits[0]);
        else                        out.push({ type: 'sim', children: hits, _idx: 0 });
    }
    return out;
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Random groove / fill as an expanded, ready-to-play step array.
export function randomGroove() { return expandLayers(pick(pick(ROCK_PATTERNS))); }
export function randomFill()   { return expandLayers(pick(pick(ROCK_FILLS))); }
