// ascii_gen("word", style) — a word drawn large, for the log.
//
// One 5×5 font, several looks. Keeping a single glyph set and varying only how a
// filled cell is DRAWN means a new style is one entry in FILLS rather than another
// forty glyphs to draw and keep in step; "wide" is the one exception, and it is
// derived from the same data rather than stored separately.
//
// There is no "outline" style, and it is worth saying why: hollowing a glyph needs
// cells whose four neighbours are ALL filled, and at 5×5 almost every stroke is one
// cell thick, so an outline of this font is the font. It would have been a style that
// silently did nothing.
//
// 5×5 is the smallest grid on which every letter and digit stays unambiguous — 3
// rows cannot separate B from 8, or S from 5.

const F = {
    A: ['.###.', '#...#', '#####', '#...#', '#...#'],
    B: ['####.', '#...#', '####.', '#...#', '####.'],
    C: ['.####', '#....', '#....', '#....', '.####'],
    D: ['####.', '#...#', '#...#', '#...#', '####.'],
    E: ['#####', '#....', '####.', '#....', '#####'],
    F: ['#####', '#....', '####.', '#....', '#....'],
    G: ['.####', '#....', '#..##', '#...#', '.###.'],
    H: ['#...#', '#...#', '#####', '#...#', '#...#'],
    I: ['#####', '..#..', '..#..', '..#..', '#####'],
    J: ['....#', '....#', '....#', '#...#', '.###.'],
    K: ['#...#', '#..#.', '###..', '#..#.', '#...#'],
    L: ['#....', '#....', '#....', '#....', '#####'],
    M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
    N: ['#...#', '##..#', '#.#.#', '#..##', '#...#'],
    O: ['.###.', '#...#', '#...#', '#...#', '.###.'],
    P: ['####.', '#...#', '####.', '#....', '#....'],
    Q: ['.###.', '#...#', '#...#', '#..#.', '.##.#'],
    R: ['####.', '#...#', '####.', '#..#.', '#...#'],
    S: ['.####', '#....', '.###.', '....#', '####.'],
    T: ['#####', '..#..', '..#..', '..#..', '..#..'],
    U: ['#...#', '#...#', '#...#', '#...#', '.###.'],
    V: ['#...#', '#...#', '#...#', '.#.#.', '..#..'],
    W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
    X: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
    Y: ['#...#', '.#.#.', '..#..', '..#..', '..#..'],
    Z: ['#####', '...#.', '..#..', '.#...', '#####'],
    0: ['.###.', '#..##', '#.#.#', '##..#', '.###.'],
    1: ['..#..', '.##..', '..#..', '..#..', '.###.'],
    2: ['.###.', '#...#', '..##.', '.#...', '#####'],
    3: ['####.', '....#', '.###.', '....#', '####.'],
    4: ['#..#.', '#..#.', '#####', '...#.', '...#.'],
    5: ['#####', '#....', '####.', '....#', '####.'],
    6: ['.###.', '#....', '####.', '#...#', '.###.'],
    7: ['#####', '....#', '...#.', '..#..', '..#..'],
    8: ['.###.', '#...#', '.###.', '#...#', '.###.'],
    9: ['.###.', '#...#', '.####', '....#', '.###.'],
    ' ': ['.....', '.....', '.....', '.....', '.....'],
    '!': ['..#..', '..#..', '..#..', '.....', '..#..'],
    '?': ['.###.', '#...#', '..##.', '.....', '..#..'],
    '.': ['.....', '.....', '.....', '.....', '..#..'],
    ',': ['.....', '.....', '.....', '..#..', '.#...'],
    '-': ['.....', '.....', '#####', '.....', '.....'],
    '+': ['.....', '..#..', '.###.', '..#..', '.....'],
    '=': ['.....', '#####', '.....', '#####', '.....'],
    ':': ['.....', '..#..', '.....', '..#..', '.....'],
    "'": ['..#..', '..#..', '.....', '.....', '.....'],
    '/': ['....#', '...#.', '..#..', '.#...', '#....'],
    '*': ['#.#.#', '.###.', '#####', '.###.', '#.#.#'],
    '<': ['...#.', '..#..', '.#...', '..#..', '...#.'],
    '>': ['.#...', '..#..', '...#.', '..#..', '.#...'],
};

// A style is just the character a filled cell is drawn with.
const FILLS = {
    block:  '█',
    shade:  '▓',
    light:  '░',
    hash:   '#',
    dot:    '●',
    star:   '*',
    plus:   '+',
    slash:  '/',
    dash:   '=',
    wave:   '~',
};
export const ASCII_STYLES = [...Object.keys(FILLS), 'wide'];

const HEIGHT = 5;
const UNKNOWN = ['#####', '#...#', '#.#.#', '#...#', '#####'];   // a box, for anything unmapped

// Double every cell horizontally. A 5×5 grid is nearly square per character but a
// terminal cell is about half as wide as it is tall, so doubling is what actually
// makes the letters look square — and it reads as a heavier, wider face.
function widen(rows) {
    return rows.map(r => [...r].map(c => c + c).join(''));
}

/**
 * Draw `word` big. Returns an array of lines (5 of them), ready to log one per row.
 * Unknown characters become a box rather than vanishing, so a typo is visible
 * instead of silently shortening the word.
 */
export function asciiWord(word, style = 'block') {
    const key = String(style || 'block').toLowerCase();
    const wide = key === 'wide';
    const fill = FILLS[key] || FILLS.block;
    const chars = [...String(word ?? '').toUpperCase()];
    if (!chars.length) return [];
    const out = new Array(HEIGHT).fill('');
    for (const ch of chars) {
        let g = F[ch] || UNKNOWN;
        if (wide) g = widen(g);
        for (let y = 0; y < HEIGHT; y++) {
            out[y] += g[y].replace(/#/g, fill).replace(/\./g, ' ') + ' ';
        }
    }
    return out.map(l => l.replace(/\s+$/, ''));
}
