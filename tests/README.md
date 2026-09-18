# tests

No framework and no install — crashDot has no build step, and a suite that needs
`npm i` is a suite that stops being run.

    node tests/run.mjs            everything that runs in node
    node tests/run.mjs rng        just the files matching "rng"

    ./serve.py &                  browser checks need the app served
    node tests/browser.mjs        and chromium

`tests/run.mjs` covers the pure logic: the transpiler, the source scanner, the
seeded RNG, the synth param builder, the FX bundle. `tests/browser.mjs` covers
what node genuinely cannot — a shader that has to compile on a real GL context,
a panel that has to track a pointer, the three entry points booting clean. It
always launches muted, in a throwaway profile, and shuts the browser down after.

Every check here is one this codebase actually needed. Most were written as
throwaway scripts while chasing a specific bug; the comment above each says which,
because a test whose reason is forgotten is a test nobody dares delete or change.

## Adding one

`tests/unit/<name>.test.mjs`, default-exporting a function that takes
`{ test, eq, ok, near }`:

```js
import { thing } from '../../js/somewhere.js';
export default function ({ test, eq }) {
    test('thing: says what it does', () => eq(thing(2), 4));
}
```

Avoid importing `js/visuals/vlang.js` or `js/visuals/bridge.js` from a node test —
they start timers at module load and the process will not exit. Test the leaf they
depend on instead, or put the check in the browser suite.
