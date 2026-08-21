// Modular-synth patch graph — the data model. Pure data + pure functions, no
// DOM, no UGens — js/ui/modular.js manipulates it, js/modular/codegen.js reads
// it. Kept dependency-free so both sides (and a headless test) can import it
// without pulling in the editor or the synth engine.
//
//   node  = { id, type, x, y, params: { name: value } }
//   edge  = { from: { node: id, port: 'out' }, to: { node: id, port: 'in' } }
//
// Ports are named per block (see blocks.js) — 'out'/'in' above are examples,
// a Filter node has inputs 'in'/'cutoff'/'rq', etc.

let _nextId = 1;
export function resetIdCounter(n = 1) { _nextId = n; }   // for deterministic tests/loads

export function makeGraph() {
    return { nodes: [], edges: [] };
}

export function addNode(graph, type, x = 0, y = 0, params = {}) {
    const id = 'n' + (_nextId++);
    graph.nodes.push({ id, type, x, y, params: { ...params } });
    return id;
}

export function removeNode(graph, id) {
    graph.nodes = graph.nodes.filter(n => n.id !== id);
    graph.edges = graph.edges.filter(e => e.from.node !== id && e.to.node !== id);
}

// One input port accepts at most one wire — connecting a second replaces the first
// (matches "plugging a new cable into a jack that's already patched").
export function connect(graph, fromNode, fromPort, toNode, toPort) {
    graph.edges = graph.edges.filter(e => !(e.to.node === toNode && e.to.port === toPort));
    graph.edges.push({ from: { node: fromNode, port: fromPort }, to: { node: toNode, port: toPort } });
}

export function disconnect(graph, toNode, toPort) {
    graph.edges = graph.edges.filter(e => !(e.to.node === toNode && e.to.port === toPort));
}

export function edgeInto(graph, nodeId, port) {
    return graph.edges.find(e => e.to.node === nodeId && e.to.port === port) || null;
}

export function edgesFrom(graph, nodeId, port) {
    return graph.edges.filter(e => e.from.node === nodeId && e.from.port === port);
}

// Kahn's algorithm. Returns { order: [nodeId...] } or { error, cycle: [nodeId...] }.
export function topoSort(graph) {
    const indeg = new Map(graph.nodes.map(n => [n.id, 0]));
    for (const e of graph.edges) indeg.set(e.to.node, (indeg.get(e.to.node) || 0) + 1);

    const queue = graph.nodes.filter(n => indeg.get(n.id) === 0).map(n => n.id);
    const order = [];
    const indegWork = new Map(indeg);

    while (queue.length) {
        const id = queue.shift();
        order.push(id);
        for (const e of graph.edges) {
            if (e.from.node !== id) continue;
            const d = indegWork.get(e.to.node) - 1;
            indegWork.set(e.to.node, d);
            if (d === 0) queue.push(e.to.node);
        }
    }

    if (order.length !== graph.nodes.length) {
        const cycle = graph.nodes.map(n => n.id).filter(id => !order.includes(id));
        return { error: 'cycle', cycle };
    }
    return { order };
}

export function toJSON(graph) { return JSON.stringify(graph); }
export function fromJSON(text) {
    const g = JSON.parse(text);
    // Keep the id counter ahead of anything loaded, so new nodes never collide.
    const maxN = g.nodes.reduce((m, n) => {
        const n2 = parseInt(String(n.id).replace(/^n/, ''), 10);
        return Number.isFinite(n2) ? Math.max(m, n2) : m;
    }, 0);
    resetIdCounter(maxN + 1);
    return g;
}
