// Buffer ids ran out. Every loadpack() took a fresh block even for a pack already
// loaded, and every sample() take another id, so a set whose loadpack line was run a
// few times walked past the engine's last buffer and every load after that failed.
import * as SM from '../../js/engine/sampler.js';

export default async function ({ test, eq, ok }) {
    const loaded = [];
    const sc = { loadSample: async (id) => { loaded.push(id); } };
    let fetches = 0;
    const pack = { K: 'k.wav', S: ['s0.wav', 's1.wav'] };
    globalThis.fetch = async (url) => {
        fetches++;
        if (String(url).endsWith('.json')) {
            if (String(url).includes('manifest')) throw new Error('no manifest in node');
            return { ok: true, json: async () => pack };
        }
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
    };
    await SM.loadSamples(sc);                          // sets the engine; no manifest here

    const n1 = await SM.loadPackFromURL('https://x.org/pack.json');
    const after1 = SM.userBufStats().next, ids1 = [SM.charToBufId('K'), SM.charToBufId('S', 0), SM.charToBufId('S', 1)];
    fetches = 0; loaded.length = 0;
    const n2 = await SM.loadPackFromURL('https://x.org/pack.json');

    test('bufids: a pack loaded twice is fetched once', () => {
        eq(n1, 2); eq(n2, 2);
        eq(fetches, 1, 'only the pack JSON itself');       // no sample files the second time
        eq(loaded.length, 0);
    });
    test('bufids: … and keeps its ids — no new block', () => {
        eq(SM.userBufStats().next, after1);
        eq([SM.charToBufId('K'), SM.charToBufId('S', 0), SM.charToBufId('S', 1)], ids1);
    });
    test('bufids: a freed take id is handed out again', () => {
        const a = SM.allocUserBufId();
        SM.releaseBufId(a);
        eq(SM.allocUserBufId(), a);
    });
    test('bufids: releasing twice does not hand the id out twice', () => {
        const a = SM.allocUserBufId();
        SM.releaseBufId(a); SM.releaseBufId(a);
        const x = SM.allocUserBufId(), y = SM.allocUserBufId();
        ok(x === a && y !== a, `${x} ${y}`);
    });
}
