#!/usr/bin/env node
// tests/run.mjs — the whole suite, or one file.
//
//   node tests/run.mjs              everything
//   node tests/run.mjs rng          just the files whose name contains "rng"
//
// No dependencies and no framework: this codebase has no build step and no
// package.json, and a test runner that needs an install is a test runner nobody
// runs. Every check here is one this session actually needed — they were written
// as throwaway scripts in /tmp, which is where they all were when /tmp was cleared.
//
// Browser-only checks (a shader that has to compile, a panel that has to drag) are
// NOT here: they need a real page. They live in tests/browser/ and are run by
// tests/browser.mjs, which is separate because it needs chromium.

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2] || '';

let pass = 0, fail = 0;
const failures = [];

export function test(name, fn) {
    try { fn(); pass++; }
    catch (e) { fail++; failures.push([name, e.message]); }
}
export function eq(a, b, msg = '') {
    const A = JSON.stringify(a), B = JSON.stringify(b);
    if (A !== B) throw new Error(`${msg}\n      got      ${A}\n      expected ${B}`);
}
export function ok(v, msg = 'expected truthy') { if (!v) throw new Error(msg); }
export function near(a, b, tol = 1e-9, msg = '') {
    if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg} ${a} is not within ${tol} of ${b}`);
}

const files = readdirSync(join(here, 'unit')).filter(f => f.endsWith('.test.mjs') && f.includes(filter)).sort();
for (const f of files) {
    const before = pass + fail;
    process.stdout.write(`  ${f.replace('.test.mjs', '').padEnd(22)}`);
    const mod = await import(join(here, 'unit', f));
    if (typeof mod.default === 'function') await mod.default({ test, eq, ok, near });
    const ran = pass + fail - before;
    const bad = failures.filter(x => x[0].startsWith(f.replace('.test.mjs', '')));
    console.log(`${ran} checks`);
}
console.log('');
for (const [n, m] of failures) console.log(`  FAIL  ${n}\n        ${m}`);
console.log(`  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
