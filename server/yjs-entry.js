// Bundle entry — re-exports everything the collab client needs.
// Built with esbuild into ../lib/yjs/yjs-bundle.js (single file, one shared
// yjs instance — no CDN, no multiple-instances problem).
//
// Rebuild with:  npm run build-yjs   (from server/)
export * as Y from 'yjs';
export { WebsocketProvider } from 'y-websocket';
export { CodemirrorBinding } from 'y-codemirror';
