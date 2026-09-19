// The workspace block a set file carries: the pads, and every setting.
//
// The property that matters is that the set text survives a round trip untouched.
// A set is the piece of work; the workspace is packaging around it, and packaging
// that eats a line of music, or that piles up a little more of itself on every
// save, is worse than no packaging at all.
import { encodeWorkspace, decodeWorkspace, restoreWorkspace } from '../../js/ui/workspace.js';

const SET = '# a set\nClock.bpm = 120\nd1 >> play("x-o-")\n';
const state = (over = {}) => ({
    v: 1, app: 'crashDot', saved: '2026-09-19T00:00:00.000Z',
    pads: [{ name: 'set', main: true, text: SET }, { name: 'sketch', main: false, text: 'p1 >> pluck([0,4])' }],
    storage: { theme: 'synthwave', 'wfd-seed': '4242', 'wfd-uiscale': '1.3' },
    ...over,
});
const write = (text, st) => text.replace(/\s+$/, '') + encodeWorkspace(st);

export default function ({ test, eq, ok }) {
    test('workspace: the set text comes back unchanged', () => {
        const { text } = decodeWorkspace(write(SET, state()));
        eq(text.trim(), SET.trim());
    });

    test('workspace: the state comes back whole', () => {
        const { st } = { st: decodeWorkspace(write(SET, state())).state };
        eq(st.pads.length, 2);
        eq(st.pads[1].text, 'p1 >> pluck([0,4])');
        eq(st.storage.theme, 'synthwave');
        eq(st.storage['wfd-seed'], '4242');
    });

    test('workspace: repeated save/open does not stack headers', () => {
        // The regression that shipped: the header was matched only with a trailing
        // newline, which the last line does not have once the state line is cut, so
        // every cycle left another copy of the header in the buffer.
        let text = SET;
        for (let i = 0; i < 5; i++) text = decodeWorkspace(write(text, state())).text;
        eq((text.match(/crashDot workspace/g) || []).length, 0);
        eq(text.trim(), SET.trim());
    });

    test('workspace: a file with no block is left exactly alone', () => {
        const { text, state: st } = decodeWorkspace(SET);
        eq(text, SET);
        eq(st, null);
    });

    test('workspace: an unreadable block is removed, not shown', () => {
        // Half-written JSON should not put a wall of it in the editor.
        const { text, state: st } = decodeWorkspace(SET.replace(/\s+$/, '') + '\n#:crashdot:{"v":1,"pads":\n');
        eq(st, null);
        ok(!text.includes('#:crashdot:'), 'the unreadable line is still in the buffer');
        eq(text.trim(), SET.trim());
    });

    test('workspace: a # line in the SET is not mistaken for the block', () => {
        const withComments = '# ── intro ──\n# a comment that looks structural\nd1 >> play("x")\n';
        const { text } = decodeWorkspace(write(withComments, state()));
        eq(text.trim(), withComments.trim());
    });

    test('workspace: restore writes the settings and skips the dangerous ones', () => {
        const store = new Map([['wfd-tab-id', 'mine']]);
        const prev = globalThis.localStorage;
        globalThis.localStorage = {
            get length() { return store.size; },
            key: (i) => [...store.keys()][i] ?? null,
            getItem: (k) => (store.has(k) ? store.get(k) : null),
            setItem: (k, v) => store.set(k, String(v)),
        };
        try {
            const calls = [];
            const r = restoreWorkspace(state({ storage: { theme: 'paper', 'wfd-tab-id': 'THEIRS', 'wfd-seed': '7' } }), {
                setMain: (t) => calls.push('setMain'),
                closePads: () => calls.push('closePads'),
                newPad: (n) => calls.push('newPad:' + n),
                applyTheme: (t) => calls.push('theme:' + t),
                applyLayoutNow: () => false,
            });
            eq(store.get('wfd-seed'), '7');
            // The identity of this browser tab is not somebody else's to hand over.
            eq(store.get('wfd-tab-id'), 'mine');
            eq(r.pads, 1);
            ok(calls.includes('theme:paper'), 'theme was not applied live');
            ok(calls.indexOf('closePads') < calls.indexOf('newPad:sketch'), 'pads added before the strip was cleared');
        } finally { globalThis.localStorage = prev; }
    });
}
