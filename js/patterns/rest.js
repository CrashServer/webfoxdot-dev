// Rest sentinel — a degree equal to REST fires no note (true silence). Kept in its
// own leaf module so both the pattern layer (sequences.js) and the engine (player.js)
// can share the exact same symbol without a heavy circular import. Emitted by the
// transpiler for `_` / `rest` in a list, and by chord builders for absent voices.
export const REST = Symbol('rest');
