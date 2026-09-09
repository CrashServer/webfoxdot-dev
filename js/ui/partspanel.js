// Parts panel — the examples library as a clickable index, for assembling a set
// out of other people's material without typing attack() by hand.
//
// Two columns: every block on the left, its #@ parts on the right. Clicking a part
// writes a SECTION and the attack() line that fills it —
//
//     #@stab(16)
//     attack("dresdensunlight", "stab", 1)
//
// — and not the borrowed code itself. That is the difference between a clipboard and
// a composition tool: click four parts and you have a four-section arrangement you
// can read, reorder and set beat counts on, with the material still living in the
// tracks it came from until you run it.
//
// Same floating, draggable, non-modal shape as the mixer and the rules panel, so it
// can sit open while you keep coding.

import { draggable } from './dragpanel.js';

let _modal = null, _open = false;
let _ctx = { list: () => [], partsOf: () => [], insert: () => {} };
let _sel = null;      // the block whose parts are showing
let _play = false;    // ▶ armed → the new section is run as well as written
let _filter = '';

/** ctx: { list(), partsOf(id), insert(id, part, play) } — supplied by index.html. */
export function initPartsPanel(ctx) { _ctx = { ..._ctx, ...ctx }; }

export function isPartsOpen() { return _open; }
export function openParts()  { if (!_modal) build(); _open = true; _modal.classList.remove('hidden'); render(); }
export function closeParts() { _open = false; if (_modal) _modal.classList.add('hidden'); }
export function toggleParts() { _open ? closeParts() : openParts(); }

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function build() {
    _modal = document.createElement('div');
    _modal.id = 'parts-modal';
    _modal.className = 'hidden';
    _modal.innerHTML = `
        <div class="parts-head">
            <span class="parts-title">parts</span>
            <input class="parts-search" type="text" placeholder="filter…" spellcheck="false">
            <button class="parts-play" title="when armed, the section is RUN as soon as it is written — otherwise it just lands in your buffer">▶ play</button>
            <div class="parts-drag"></div>
            <button class="parts-close" title="close">×</button>
        </div>
        <div class="parts-body">
            <div class="parts-col parts-blocks"></div>
            <div class="parts-col parts-parts"></div>
        </div>
        <div class="parts-foot"></div>`;
    document.body.appendChild(_modal);
    _modal.querySelector('.parts-close').onclick = () => closeParts();
    _modal.querySelector('.parts-play').onclick = () => { _play = !_play; render(); };
    const search = _modal.querySelector('.parts-search');
    search.oninput = () => { _filter = search.value.trim().toLowerCase(); render(true); };
    draggable(_modal.querySelector('.parts-head'), _modal, 'button, input');
}

export function renderPartsPanel() { if (_open) render(); }

function render(keepFocus) {
    const blocksEl = _modal.querySelector('.parts-blocks');
    const partsEl  = _modal.querySelector('.parts-parts');
    const footEl   = _modal.querySelector('.parts-foot');
    _modal.querySelector('.parts-play').classList.toggle('on', _play);

    const items = _ctx.list();
    const hit = (e) => !_filter
        || e.id.toLowerCase().includes(_filter)
        || (e.title || '').toLowerCase().includes(_filter)
        || _ctx.partsOf(e.id).some(p => p.toLowerCase().includes(_filter));
    const shown = items.filter(hit);

    // Left: the blocks, grouped by the same categories the Examples page uses.
    let html = '', cat = null;
    for (const e of shown) {
        if (e.cat !== cat) { cat = e.cat; html += `<div class="parts-cat">${esc(cat)}</div>`; }
        const n = _ctx.partsOf(e.id).length;
        html += `<button class="parts-block${e.id === _sel ? ' on' : ''}" data-id="${esc(e.id)}"
                    title="${esc(e.title || e.id)}">${esc(e.id)}<span class="parts-n">${n || '—'}</span></button>`;
    }
    blocksEl.innerHTML = html || '<div class="parts-empty">nothing matches</div>';
    blocksEl.querySelectorAll('.parts-block').forEach(b => {
        b.onclick = () => { _sel = b.dataset.id; render(true); };
    });

    // Right: the selected block's parts. A block with none can still be taken whole.
    if (!_sel) {
        partsEl.innerHTML = '<div class="parts-empty">pick a block on the left</div>';
    } else {
        const parts = _ctx.partsOf(_sel);
        let p = `<button class="parts-part parts-whole" data-part="">whole set</button>`;
        for (const name of parts) {
            if (_filter && !name.toLowerCase().includes(_filter) && !_sel.toLowerCase().includes(_filter)) continue;
            p += `<button class="parts-part" data-part="${esc(name)}">${esc(name)}</button>`;
        }
        partsEl.innerHTML = p;
        partsEl.querySelectorAll('.parts-part').forEach(b => {
            b.onclick = () => {
                _ctx.insert(_sel, b.dataset.part || undefined, _play);
                render(true);
            };
        });
    }

    footEl.textContent = _sel
        ? (_play ? `click a part → #@section + attack(), and run it` : `click a part → #@section + attack() — arm ▶ to run it too`)
        : `${shown.length} of ${items.length} blocks`;

    if (keepFocus) {
        const s = _modal.querySelector('.parts-search');
        if (s && document.activeElement !== s) { /* leave focus where the user put it */ }
    }
}

