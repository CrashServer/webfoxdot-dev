// The four HTML helpers the documentation is written in. Their own file because
// every part of the docs uses them and nothing else should have to import a
// 470KB module to get them.

// ── Helpers ────────────────────────────────────────────────────────────────────

export function h(tag, cls, html) {
    return `<${tag}${cls ? ` class="${cls}"` : ''}>${html}</${tag}>`;
}
export function section(title, body, id) {
    return `<div class="docs-section"${id ? ` id="ex-${id}"` : ''}>
        <div class="docs-section-title">${title}</div>
        ${body}
    </div>`;
}
export function code(text) {
    return h('pre', 'docs-code', text.replace(/</g,'&lt;').replace(/>/g,'&gt;'));
}
export function note(text) { return h('div', 'docs-note', text); }
export function step(n, text) {
    return `<div class="docs-step"><span class="docs-step-n">${n}</span><span>${text}</span></div>`;
}

