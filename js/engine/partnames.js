// partnames.js — names for the parts of a composition.
//
// A skeleton arrangement wants sections before it wants music, and naming sixteen of
// them by hand is the friction: you end up with part1..part16, which tells you nothing
// when you are looking for the one with the breakdown in it. A word does tell you
// something, even an arbitrary one — "you are in kestrel now" is a place, "you are in
// part 11" is a number.
//
// So: evocative, concrete, one word, and easy to say out loud, because in a room with
// other people you will be saying them. Grouped only so the lists stay readable and so
// a composition can be asked for one flavour — compo_base(8, 4, 'birds') reads as a
// set, compo_base(8, 4) reads as a set of unrelated things, and both are useful.
//
// Every one is a valid #@ section name: lowercase, no spaces, nothing the parser has
// to be careful about.

export const PART_WORDS = {
    cities: ['lisbon', 'tangier', 'osaka', 'tallinn', 'valparaiso', 'gdansk', 'palermo', 'bergen',
             'kyoto', 'oran', 'trieste', 'dakar', 'reykjavik', 'odessa', 'lviv', 'porto',
             'genova', 'sofia', 'durban', 'macau', 'antwerp', 'tbilisi', 'sapporo', 'cadiz'],
    birds:  ['kestrel', 'godwit', 'shrike', 'nightjar', 'curlew', 'bittern', 'redstart', 'fulmar',
             'corncrake', 'wheatear', 'dunlin', 'merlin', 'siskin', 'brambling', 'petrel', 'kittiwake'],
    beasts: ['marten', 'lynx', 'otter', 'jackal', 'ibex', 'tapir', 'caracal', 'serval',
             'fossa', 'dhole', 'okapi', 'saiga', 'markhor', 'kudu', 'coati', 'wolverine'],
    weather:['squall', 'haar', 'monsoon', 'sirocco', 'whiteout', 'hailstone', 'downdraft', 'thaw',
             'blizzard', 'zephyr', 'mistral', 'chinook', 'graupel', 'petrichor', 'gale', 'drizzle'],
    stones: ['basalt', 'gypsum', 'obsidian', 'flint', 'shale', 'quartzite', 'pumice', 'gneiss',
             'anthracite', 'malachite', 'jasper', 'slate', 'chalk', 'granite', 'olivine', 'sandstone'],
    water:  ['fathom', 'estuary', 'riptide', 'shoal', 'brackish', 'undertow', 'lagoon', 'meltwater',
             'tidepool', 'delta', 'fjord', 'cataract', 'millpond', 'spillway', 'eddy', 'bayou'],
    machine:['flywheel', 'ballast', 'rotor', 'solenoid', 'gantry', 'caliper', 'turbine', 'armature',
             'crankcase', 'driveshaft', 'pinion', 'magneto', 'bellows', 'capstan', 'ratchet', 'dynamo'],
};

export const PART_FAMILIES = Object.keys(PART_WORDS);

/**
 * `count` distinct names, drawn with a supplied random function.
 *
 * DISTINCT matters more than it looks: #@goto resolves to the FIRST section with a
 * name, so two parts called the same thing is a set that jumps somewhere you did not
 * mean. Sampled without replacement, and if you ask for more than the pool holds the
 * extras are numbered rather than repeated.
 *
 * @param {number} count
 * @param {string|null} family  one of PART_FAMILIES, or null to mix them all
 * @param {() => number} rnd    a [0,1) source — pass the seeded one and a set reproduces
 */
export function partNames(count, family = null, rnd = Math.random) {
    const pool = family && PART_WORDS[family]
        ? [...PART_WORDS[family]]
        : PART_FAMILIES.flatMap(k => PART_WORDS[k]);
    // Fisher-Yates over a copy, so the draw is uniform and never repeats.
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const out = [];
    for (let i = 0; i < count; i++) {
        const w = pool[i % pool.length];
        out.push(i < pool.length ? w : `${w}${Math.floor(i / pool.length) + 1}`);
    }
    return out;
}

/**
 * The skeleton itself: `count` sections of `beats` each, a blank line under every one
 * to write into.
 *
 *   #@lisbon(16)
 *
 *   #@kestrel(16)
 *
 * No #@end: an arrangement that stops itself is a decision about the set, and this is
 * the part before any decisions have been made.
 */
export function compoBase(count = 8, beats = 16, family = null, rnd = Math.random) {
    return partNames(count, family, rnd).map(n => `#@${n}(${beats})\n`).join('\n');
}
