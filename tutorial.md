# Editing the guided tour

The beginner tutorial ("tour") is an **in-editor** walkthrough: pressing **tour**
(top-left) or evaluating `start_guided_tour()` loads Lesson 1 into the code editor;
the learner runs the `▶` example lines and evaluates `next()` to advance
(`back()` to go back).

All of it lives in one file:

```
js/ui/tour.js
```

You don't touch anything else to add/remove/edit lessons.

---

## How it's structured

Two things at the top of `tour.js`:

```js
const TOTAL = 26;            // ← must equal the number of lessons
...
const LESSONS = [
    lesson(1, 'Welcome — how this tour works', `…body…`),
    lesson(2, 'Your first player',             `…body…`),
    …
    lesson(26, 'You’re ready ✨',              `…body…`),
];
```

Each entry is built by the `lesson(n, title, body)` helper:

- **`n`** — the lesson number shown in the header (`🎓 TOUR · n / 26 · …`). Keep them
  sequential, `1 … TOTAL`.
- **`title`** — a short title (goes in the header).
- **`body`** — a **template literal** (backticks) that becomes the editor content for
  that lesson. Write it as crashDot code: `#` comment lines to explain, and real
  runnable lines for the examples. Mark runnable lines with a leading `▶` **in a
  comment** so the learner knows what to run, e.g.:

```js
lesson(3, 'Change it while it plays',
`# Put the cursor on a number below and press Alt+Up/Down, then Ctrl+Enter.
#
# ▶ Nudge a number here, re-run, repeat:
p1 >> pluck([0, 2, 4, 7])`),
```

`lesson()` automatically appends the footer — the divider and the
`next()` line — so **don't write `next()` yourself**. On the **last** lesson
(`n === TOTAL`) it omits `next()` and shows a "you've finished" note instead.

### What the body should contain

- **Comments** (`#`) for everything you want to say.
- **Runnable example lines** — plain crashDot code. These are typed straight into the
  editor, so they must be **valid** (see "Test it" below).
- The learner's cursor lands on the **first runnable line** automatically (so
  Ctrl+Enter works immediately). If a lesson is pure text with no example, the cursor
  lands on the appended `next()`.
- Keep lessons short — one idea each.

---

## Add a lesson

1. Write a new `lesson(n, 'Title', \`…body…\`)` and insert it in `LESSONS` **at the
   position you want it** (usually just before the final "You’re ready" wrap-up).
2. **Renumber**: every lesson after it must have its `n` bumped by one (the wrap-up
   too), so they stay `1 … TOTAL`.
3. **Bump `TOTAL`** by one.

> Tip: because you have to renumber the tail anyway, adding near the end is easiest.

## Delete a lesson

1. Remove its `lesson(…)` entry from `LESSONS`.
2. **Renumber** every lesson after it down by one.
3. **Decrement `TOTAL`** by one.

## Modify a lesson

Just edit its `title` or `body` string in place. No renumbering, no `TOTAL` change.
Change ordering by moving the entry and renumbering (as in add/delete).

---

## Test it

The example lines are real code that gets typed into the editor, so a typo makes a
lesson error when the learner runs it. Two quick checks:

- **Run the tour**: press **tour**, walk to your lesson, run each `▶` line. (Boot
  audio first for anything that makes sound; `loadpack(...)` for sample/`play()`
  lines.)
- **Transpile-check** without the browser (catches syntax errors in the examples):

```bash
node --input-type=module -e '
import { transpile, applyRenames } from "./js/editor/transpiler.js";
const line = `p1 >> pluck(P[0,2,4,7].palindrome(), dur=1/2)`;   // ← your example
new Function("return 0, (" + applyRenames(transpile(line)) + ")");
console.log("ok");'
```

Lines that are intentionally incomplete (e.g. the autocomplete lesson's bare
`p1 >>`) will fail this check — that's fine, they're stubs the learner completes.

---

## How it's wired (for reference)

- **`js/ui/tour.js`** exports `initTour(editor)` → `{ start, next, back }`.
- **`index.html`** creates the tour after the editor (`_tour = initTour(editor)`),
  wires the **tour** button to `_tour.start()`, and puts these functions in the eval
  scope so lessons/learners can drive it:
  - `start_guided_tour()` → `_tour.start()` (also sits in the default buffer)
  - `next()` → `_tour.next()` · `back()` → `_tour.back()`
  - `tour()` → logs the full lesson menu · `tour(n)` → `_tour.go(n)` jumps to lesson n
- `initTour(editor)` returns `{ start, next, back, list, go }`. `list()` gives
  `[{ n, title }]` (used by `tour()` to print the menu); `go(n)` jumps to a lesson.
  Each `LESSONS` entry is now `{ n, title, text }` — so if you add/remove a lesson,
  the menu and jumping stay correct automatically (just keep `n`/`TOTAL` right).

Pressing tour / `start_guided_tour()` **replaces** the editor buffer with Lesson 1
(the running sound keeps playing; **Ctrl+Z** restores the previous buffer if pressed
by accident).
