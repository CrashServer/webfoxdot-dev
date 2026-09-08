// ── A code buffer, as a texture ──────────────────────────────────────────────
//
// Renders an editor buffer's text onto a canvas so an output surface can map it —
// your code, projected onto a wall, beside the visuals it is making.
//
// This is deliberately NOT the codeFull layer. That one is a performance: it
// accumulates evals, flashes, scrolls, and shows the code that RAN. This shows the
// buffer as it is RIGHT NOW, the thing you are typing into, which is what you want on
// a second surface while you work — and what an audience reads.
//
// Colouring is the editor's own vocabulary, done with regexes rather than by borrowing
// CodeMirror's tokenizer: this has to run against a plain string on a canvas, and the
// five categories that carry the meaning of a FoxDot line (comment · string · number ·
// the >> arrow · the player name before it) are worth exactly five regexes.
//
// Redraw is gated on the text and the size actually changing. A buffer is static
// between keystrokes, and this can be feeding a 1920×1080 surface every frame.

const RULES = [
    [/#.*$/,                       'comment'],
    [/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/, 'string'],
    [/\b\d+(?:\.\d+)?\b/,          'number'],
    [/>>/,                         'arrow'],
    [/\b[A-Za-z_]\w*(?=\s*\()/,    'call'],
];
const COLOUR = { comment: '#4a5a52', string: '#d9a05b', number: '#7fd1c0',
                 arrow: '#63b982', call: '#8fb8ff', plain: '#c9d3cc' };

/** Split one line into [{text, kind}] — first rule that matches at each position wins. */
function tokens(line) {
    const out = [];
    let i = 0;
    while (i < line.length) {
        let best = null;
        for (const [re, kind] of RULES) {
            const m = line.slice(i).match(re);
            if (m && m.index === 0) { best = { text: m[0], kind }; break; }
        }
        if (best) { out.push(best); i += best.text.length; continue; }
        // Not a token start: take one character and coalesce runs of plain text so a
        // line is a handful of fillText calls, not one per character.
        const last = out[out.length - 1];
        if (last && last.kind === 'plain') last.text += line[i];
        else out.push({ text: line[i], kind: 'plain' });
        i++;
    }
    return out;
}

export function createCodeCanvas() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let lastText = null, lastW = 0, lastH = 0;

    function draw(text, w, h, opts = {}) {
        text = String(text ?? '');
        if (text === lastText && w === lastW && h === lastH) return canvas;
        lastText = text; lastW = w; lastH = h;
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }

        const lines = text.split('\n');
        // Fit to the LONGEST line and the line COUNT, so the whole buffer is legible on
        // the surface whatever shape it is — a projector quad is rarely 16:9.
        const cols = Math.max(24, ...lines.map((l) => l.length));
        const rows = Math.max(8, lines.length);
        const size = Math.max(6, Math.min(h / rows * 0.82, w / cols * 1.62));
        const lh = size * 1.35;
        const pad = Math.round(size * 0.7);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = opts.bg || '#05080a';
        ctx.fillRect(0, 0, w, h);
        ctx.font = `${size}px 'Courier New', monospace`;
        ctx.textBaseline = 'top';

        let y = pad;
        for (const line of lines) {
            if (y > h) break;
            let x = pad;
            for (const tk of tokens(line)) {
                ctx.fillStyle = COLOUR[tk.kind] || COLOUR.plain;
                ctx.fillText(tk.text, x, y);
                x += ctx.measureText(tk.text).width;
            }
            y += lh;
        }
        return canvas;
    }

    return { canvas, draw };
}
