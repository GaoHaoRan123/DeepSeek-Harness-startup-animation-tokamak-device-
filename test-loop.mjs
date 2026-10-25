/**
 * Drives the TokamakBoot animation loop to completion under a synthetic clock,
 * using stubbed window/document/canvas. The browser's headless rAF is throttled
 * and --dump-dom is unavailable in this environment, so this is the reliable way
 * to exercise the *live* frame loop (not just frozen frames) and surface any
 * exception with a real stack trace.
 *
 * Run: node dsh-boot-animation/test-loop.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'tokamak-boot.js'), 'utf8');

const ops = { count: 0 };
// Failure injection: while > 0, the next canvas op throws, simulating a real
// canvas API error in the middle of the sequence.
let failArmed = 0;

// Canvas stubs that enforce the parts of the 2D spec that actually throw, so a
// NaN/invalid argument surfaces here instead of only in a real browser.
function badColor(value) {
  if (typeof value !== 'string') return false;
  return /NaN|undefined|Infinity/.test(value);
}
function finite(...xs) {
  return xs.every(x => typeof x === 'number' && Number.isFinite(x));
}
function validateColor(value, where) {
  if (badColor(value)) {
    throw new Error(`invalid color assigned to ${where}: "${value}"`);
  }
}
function makeCtx() {
  const store = {};
  const makeGradient = (label, coords) => {
    // spec: non-finite coordinates -> NotSupportedError
    if (!finite(...coords)) {
      throw new Error(`${label} received non-finite coordinates: ${coords.join(',')}`);
    }
    return {
      addColorStop(offset, color) {
        // spec: offset outside [0,1] or non-finite -> IndexSizeError
        if (!finite(offset) || offset < 0 || offset > 1) {
          throw new Error(`${label}.addColorStop offset out of range: ${offset}`);
        }
        if (badColor(color)) throw new Error(`${label}.addColorStop bad color: "${color}"`);
      }
    };
  };
  const target = {
    createLinearGradient(...c) { return makeGradient('createLinearGradient', c); },
    createRadialGradient(...c) { return makeGradient('createRadialGradient', c); },
    createPattern: () => ({}),
    measureText: () => ({ width: 120 }),
    arc(x, y, r, sa, ea) {
      // spec: negative radius -> IndexSizeError
      if (!finite(r) || r < 0) throw new Error(`arc called with invalid radius: ${r}`);
      if (!finite(x, y, sa, ea)) throw new Error('arc called with non-finite coordinates');
      ops.count++;
    },
    drawImage(image, ...rest) {
      if (image && typeof image === 'object' && 'width' in image) {
        if (!image.width || !image.height) {
          throw new Error('drawImage source has zero width or height');
        }
      }
      if (!finite(...rest)) throw new Error(`drawImage called with non-finite arguments: ${rest.join(',')}`);
      ops.count++;
    },
    setTransform(...c) {
      if (failArmed > 0) { failArmed--; throw new Error('injected draw failure'); }
      if (!finite(...c)) throw new Error('setTransform non-finite');
    },
    globalAlpha() {}
  };
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      if (k in store) return store[k];
      return () => { ops.count++; };
    },
    set(t, k, v) {
      if (k === 'fillStyle' || k === 'strokeStyle') validateColor(v, k);
      if (k === 'globalAlpha' && typeof v === 'number' && !Number.isFinite(v)) {
        throw new Error('globalAlpha set to non-finite value');
      }
      store[k] = v;
      return true;
    }
  });
}
function makeCanvas() {
  return {
    width: 1600, height: 900,
    clientWidth: 1600, clientHeight: 900,
    getContext: () => makeCtx()
  };
}

// Synthetic rAF: queue callbacks and run them with a fixed 60 fps clock.
const queue = [];
let clock = 0;
let onDoneFired = false;
const errors = [];

const fakeWindow = {
  devicePixelRatio: 1,
  sessionStorage: { getItem: () => null, setItem: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {},
  requestAnimationFrame(cb) { queue.push(cb); return queue.length; },
  cancelAnimationFrame: () => {},
  setTimeout: () => 0
};
fakeWindow.window = fakeWindow;

const sandbox = {
  window: fakeWindow,
  document: { createElement: t => (t === 'canvas' ? makeCanvas() : { style: {} }) },
  console,
  Math, Date,
  requestAnimationFrame: fakeWindow.requestAnimationFrame,
  cancelAnimationFrame: fakeWindow.cancelAnimationFrame,
  setTimeout: fakeWindow.setTimeout
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'tokamak-boot.js' });

const boot = fakeWindow.TokamakBoot.mount(makeCanvas(), {
  onDone: () => { onDoneFired = true; }
});

let frames = 0;
try {
  while (queue.length && frames < 5000) {
    const cb = queue.shift();
    clock += 16.7;
    cb(clock);
    frames++;
  }
} catch (error) {
  errors.push(error);
}

console.log('live loop test');
console.log('--------------------------------');
console.log(`  frames driven        ${frames}`);
console.log(`  animation time       ${boot.time.toFixed(3)} s (duration ${fakeWindow.TokamakBoot.DURATION})`);
console.log(`  onDone fired         ${onDoneFired}`);
console.log(`  canvas ops issued    ${ops.count}`);
console.log(`  loop drained queue   ${queue.length === 0}`);
if (errors.length) {
  console.log(`  EXCEPTION            ${errors[0] && errors[0].message}`);
  console.log(String(errors[0] && errors[0].stack).split('\n').slice(0, 8).map(l => '    ' + l.trim()).join('\n'));
}

let failed = 0;
function ok(label, cond) {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) failed++;
}
ok('loop ran many frames', frames > 500);
ok('reached the end of the sequence', boot.time >= fakeWindow.TokamakBoot.DURATION);
ok('onDone fired exactly once', onDoneFired);
ok('loop stopped after finishing (queue empty)', queue.length === 0);
ok('no exception during the live loop', errors.length === 0);
ok('drawing operations were issued', ops.count > 1000);

/* ------- resilience: a throwing frame must not strand the overlay --------- */
// Before this was fixed, a single exception inside the frame killed the
// requestAnimationFrame chain and left an opaque overlay covering the whole app.
function drive(armAt, armCount, stepMs) {
  queue.length = 0;
  clock = 0;
  failArmed = 0;
  let done = false;
  const b = fakeWindow.TokamakBoot.mount(makeCanvas(), { onDone: () => { done = true; } });
  let n = 0, escaped = null;
  try {
    while (queue.length && n < 5000) {
      const cb = queue.shift();
      clock += (stepMs || 16.7);
      if (armAt !== null && n === armAt) failArmed = armCount;
      cb(clock);
      n++;
    }
  } catch (error) { escaped = error; }
  return { boot: b, done, frames: n, escaped };
}

const one = drive(200, 1);
ok('a throwing frame does not kill the loop', one.escaped === null,
  one.escaped && String(one.escaped));
ok('  ...the sequence still completes', one.boot.time >= fakeWindow.TokamakBoot.DURATION,
  `t=${one.boot.time.toFixed(3)}`);
ok('  ...onDone still fires', one.done === true);
ok('  ...the failure is recorded', !!one.boot.error && /injected/.test(one.boot.error.message),
  one.boot.error && one.boot.error.message);
ok('  ...with the time it happened', !!one.boot.error && typeof one.boot.error.at === 'number');

const many = drive(200, 40);
ok('persistent failures bail out instead of hanging forever', many.done === true);
ok('  ...after a bounded number of attempts', many.boot.errorCount >= 30,
  `errorCount=${many.boot.errorCount}`);

/* ---- the exact float boundary that actually broke in the app --------------- */
// With dt = 1/64 s every fusion event's age lands on exactly 0.375 s at its 24th
// frame, so u === 0.30 *exactly* (0.375/1.25 is bit-identical to the literal
// 0.30). That is the case where the old code built the helical path only for
// `u > 0.30`, took the renderer's else branch, and dereferenced alphaPath[-1] --
// the real "Cannot read properties of undefined (reading 'x')" crash.
// A fixed 1/60 step never lands on the boundary, which is why it was missed.
const boundary = drive(null, 0, 15.625);
ok('exact u === 0.30 boundary does not throw',
  boundary.escaped === null && !boundary.boot.error,
  boundary.escaped ? String(boundary.escaped)
    : (boundary.boot.error && boundary.boot.error.message));
ok('  ...the sequence still completes', boundary.boot.time >= fakeWindow.TokamakBoot.DURATION,
  `t=${boundary.boot.time.toFixed(3)}`);
ok('  ...onDone still fires', boundary.done === true);

console.log('--------------------------------');
console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
if (failed) process.exitCode = 1;