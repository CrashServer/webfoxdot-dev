// workshop-bridge.js — sends visual state and workshop commands from webfoxDot
// to the VJ Workshop via BroadcastChannel (same browser/machine, primary)
// with WebSocket fallback for cross-machine setups.
//
// Usage:
//   import { workshopSend, workshopRecv, initWorkshopWS } from '../net/workshop-bridge.js';
//   workshopSend({ t:'workshop', cmd:'layer', ch:0, layer:'mandelbulb', params:{power:0.4} });
//   workshopRecv(msg => { if (msg.t === 'ws_state') ... });
//   initWorkshopWS('ws://192.168.1.10:8766/foxdot');   // cross-machine only

const BC_NAME   = 'crashdot-workshop';
const _cbs      = [];
let   _bc       = null;
let   _ws       = null;
let   _wsUrl    = null;

function bc() {
    if (!_bc) {
        _bc = new BroadcastChannel(BC_NAME);
        _bc.addEventListener('message', ev => { for (const fn of _cbs) try { fn(ev.data); } catch {} });
    }
    return _bc;
}

export function workshopSend(msg) {
    bc().postMessage(msg);
    if (_ws && _ws.readyState === WebSocket.OPEN) _ws.send(JSON.stringify(msg));
}

export function workshopRecv(fn) {
    bc();   // ensure BC is open so incoming messages (ws_state feedback) arrive
    _cbs.push(fn);
    return () => { const i = _cbs.indexOf(fn); if (i !== -1) _cbs.splice(i, 1); };
}

export function initWorkshopWS(url) {
    if (_wsUrl === url && _ws) return;
    _wsUrl = url;
    _connectWS();
}

function _connectWS() {
    if (!_wsUrl) return;
    if (_ws) { try { _ws.close(); } catch {} }
    try { _ws = new WebSocket(_wsUrl); } catch { _ws = null; setTimeout(_connectWS, 3000); return; }
    _ws.onerror = () => {};
    _ws.onclose = () => { _ws = null; setTimeout(_connectWS, 3000); };
    _ws.onmessage = ev => { try { const m = JSON.parse(ev.data); for (const fn of _cbs) try { fn(m); } catch {} } catch {} };
}
