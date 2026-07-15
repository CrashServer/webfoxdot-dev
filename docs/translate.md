# Multilingual support (i18n) — design notes

Goal: full **French** support (then other languages), where **translations are pure
data** — a translator edits one file and never touches code, and there is **no
duplication of logic**.

## The architecture

### 1. A tiny i18n core — `js/i18n/`
- `t('nav.boot')` → the string for the active language, **falling back to English**
  if a key is missing (a half-finished translation must never break the app).
- Language state in `localStorage` (`lang`); default = French if the browser locale is
  French, else English. A **language switcher** in Settings, next to the theme.
- `translateDOM()` runs once on load: it walks every element with a `data-i18n` /
  `data-i18n-title` attribute and fills its text / tooltip from the catalog — so the
  HTML markup stays **single**, just tagged.
- A dev helper (e.g. `i18nMissing()`) logs any key still showing English, so gaps in a
  translation are visible.

### 2. Catalogs = plain data files
- `js/i18n/en.js` — the **master reference** (all keys, English values).
- `js/i18n/fr.js` — the same keys, French values.
- Grouped by area: `nav.*`, `panel.*`, `log.*`, `docs.*`, …
- A translator **copies `en.js`, translates the values, keys stay**. That's the whole
  "easy to adjust, not a copy of code" answer: code references keys, French lives in
  one file. Missing keys auto-fall-back to English.

### 3. Long-form content — per-language content files
The 34-lesson tour, the docs, and the examples are too big to key sentence-by-sentence,
so each gets a **per-language content file that shares the rendering code**:
- e.g. the tour loads `tour.fr.js` when the language is French, `tour.en.js` otherwise,
  falling back per-lesson.
- Same idea for docs / examples.
This is translated **data**, not duplicated **logic**.

> One codebase · French in swappable data files · English as the safety net.

## Where the strings live today (to be extracted)
- `index.html` — button labels, tooltips (`title=`), panel headers, `<option>`s, and
  many `log(...)` messages. → `data-i18n` on the markup; `t('log.*')` for dynamic ones.
- `js/ui/tour.js` — the 34 lessons. → `tour.fr.js` (Phase 2).
- `js/ui/docs.js` — docs, examples, changelog (thousands of words). → per-language
  content (Phase 3).
- The default starting buffer (`INITIAL_CODE`) — Phase 1.

## Phasing
1. **Core + full UI** — the i18n core + language switcher + translate the whole
   interface (every button, tooltip, panel label, dropdown, log message) + the default
   buffer. After this the app *is* French; docs/tour fall back to English.
2. **The tour** — a full French `tour.fr.js`, the highest-value content for beginners.
3. **Docs / examples / changelog** — English fallback until each section is translated.

## Status
- **Shipped**: `js/i18n/lang.js` (the shared `getLang()`/`setLang()` state; **English is
  the default** — no locale auto-detect, so a French browser still starts in English) +
  a **five-language guided tour**: English, French, German, Spanish, Japanese. The tour
  lessons are data (`EN[]` · `FR[]` · `DE[]` · `ES[]` · `JA[]` in `js/ui/tour.js`);
  `lessons()` picks by language, per-lesson falling back to English. Example CODE stays
  English (the tool's language); only the `#` prose is translated.
- **Language switch (for now)**: no UI dropdown yet — evaluate `language("fr")` /
  `language("de")` / `language("es")` / `language("ja")` / `language("en")` in the editor.
  It sets `lang` and live-re-renders the current lesson (`_tour.refresh()`). Lesson 1 of
  every language lists the **other four** as runnable `language(...)` lines, each with its
  how-to-evaluate hint written in that target language. A Settings dropdown +
  `translateDOM()` come with Phase 1 (the rest of the UI).
- **To add a language**: add its code to `LANGS` in `js/i18n/lang.js`, a `LABEL.<code>`
  entry + a `<CODE>[]` lesson array in `js/ui/tour.js`, wire it into `lessons()`'s map and
  the `language()` resolver in `index.html`. Everything else falls back to English.

## Notes / decisions still open
- **Key style**: semantic keys (`nav.boot`) grouped by area — cleaner for devs and
  handles same-word-different-context. `fr.js` starts as a copy of `en.js` so the
  translator sees the English value while replacing it.
- crashDot code strings (synth/param/pattern names) stay English — they're the
  language of the tool, like keywords; only human-facing prose is translated.
