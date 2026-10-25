/**
 * Integration test for the dsh-boot-intro browser bundle.
 *
 * It cannot run the real DSH shell, so it faithfully stubs the three things the
 * bundle talks to:
 *   - window.__ModuleLoader__   (DSH's client module registry)
 *   - require('react') etc.     (the platform-provided static modules)
 *   - a 2D canvas context       (to prove the renderer actually draws)
 *
 * It then asserts the full path: loader contract -> factory -> apply(ctx) ->
 * shell.overlay registration -> component render -> canvas mount -> a frame
 * drawn -> Enter skips. This is the pre-restart verification for the plugin.
 *
 * Run: node dsh-boot-animation/plugin/test-integration.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'lib', 'client.js'), 'utf8');

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? '  -- ' + detail : ''}`);
  }
}

/* ---------------------------------------------------------------- canvas */
const drawOps = { count: 0 };
function makeCtx() {
  const store = {};
  const gradient = { addColorStop() {} };
  const target = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => ({}),
    measureText: () => ({ width: 120 }),
    save() { drawOps.count++; },
    restore() { drawOps.count++; },
    fillRect() { drawOps.count++; },
    fillText() { drawOps.count++; },
    stroke() { drawOps.count++; },
    drawImage() { drawOps.count++; },
    clearRect() { drawOps.count++; },
    clip() { drawOps.count++; }
  };
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      if (k in store) return store[k];
      return () => { drawOps.count++; };
    },
    set(t, k, v) { store[k] = v; return true; }
  });
}
function makeCanvas() {
  const canvas = {
    width: 300, height: 150,
    clientWidth: 1600, clientHeight: 900,
    getContext: () => makeCtx()
  };
  return canvas;
}

/* ----------------------------------------------------------------- window */
const listeners = {};
let rafCallback = null;
const timeouts = [];
const sessionStore = {};
const localStore = {};

const fakeWindow = {
  devicePixelRatio: 1,
  sessionStorage: {
    getItem: k => (k in sessionStore ? sessionStore[k] : null),
    setItem: (k, v) => { sessionStore[k] = String(v); }
  },
  // Persisted (unlike sessionStorage), so a recorded failure survives a restart.
  localStorage: {
    getItem: k => (k in localStore ? localStore[k] : null),
    setItem: (k, v) => { localStore[k] = String(v); }
  },
  addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
  removeEventListener: (type, fn) => {
    if (listeners[type]) listeners[type] = listeners[type].filter(f => f !== fn);
  },
  requestAnimationFrame: fn => { rafCallback = fn; return 1; },
  cancelAnimationFrame: () => {},
  setTimeout: (fn, ms) => {
    timeouts.push({ fn, ms, cancelled: false });
    return timeouts.length;
  },
  clearTimeout: id => { const t = timeouts[id - 1]; if (t) t.cancelled = true; },
  TokamakBoot: undefined
};
fakeWindow.window = fakeWindow;

// Runs the timers the plugin scheduled, in delay order, skipping cancelled ones.
function runPendingTimers() {
  const pending = timeouts.filter(t => !t.cancelled).sort((a, b) => a.ms - b.ms);
  pending.forEach(t => { t.fn(); });
}

const fakeDocument = {
  createElement: tag => (tag === 'canvas' ? makeCanvas() : { style: {}, appendChild() {} })
};

/* ------------------------------------------------------- module loader */
let loaded = null;
fakeWindow.__ModuleLoader__ = {
  load: spec => { loaded = spec; }
};

/* ------------------------------------------------------------- React stub */
// Hooks are recorded per render, then effects are flushed after refs are
// committed, mirroring the real render -> commit -> effect order.
let hookCells = [];
let hookIndex = 0;
let pendingEffects = [];

function resetHooks() { hookCells = []; hookIndex = 0; pendingEffects = []; }

const jsxRuntime = {
  jsx(type, props) { return { type, props: props || {}, children: (props && props.children) || null }; },
  jsxs(type, props) { return jsxRuntime.jsx(type, props); }
};
const reactStub = {
  useState(init) {
    const i = hookIndex++;
    if (!(i in hookCells)) hookCells[i] = typeof init === 'function' ? init() : init;
    return [hookCells[i], v => { hookCells[i] = v; }];
  },
  useRef(init) {
    const i = hookIndex++;
    if (!(i in hookCells)) hookCells[i] = { current: init };
    return hookCells[i];
  },
  useEffect(fn, deps) {
    pendingEffects.push(fn);
  },
  useCallback(fn) { return fn; },
  useMemo(fn) { return fn(); }
};

const requireStub = id => {
  if (id === 'react') return reactStub;
  if (id === 'react/jsx-runtime') return jsxRuntime;
  throw new Error('unexpected require: ' + id);
};

/* ------------------------------------------------------------ run bundle */
console.log('dsh-boot-intro integration test');
console.log('--------------------------------');
const sandbox = {
  window: fakeWindow,
  document: fakeDocument,
  console,
  Math,
  Date,
  URLSearchParams,
  requestAnimationFrame: fakeWindow.requestAnimationFrame,
  cancelAnimationFrame: fakeWindow.cancelAnimationFrame,
  setTimeout: fakeWindow.setTimeout,
  clearTimeout: fakeWindow.clearTimeout
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'client.js' });

check('bundle registers with __ModuleLoader__', loaded !== null);
check('loader id is dsh-boot-intro', loaded && loaded.id === 'dsh-boot-intro',
  loaded && `got ${loaded.id}`);
check('factory is a function', loaded && typeof loaded.factory === 'function');
check('renderer exposed window.TokamakBoot',
  typeof fakeWindow.TokamakBoot === 'object' && typeof fakeWindow.TokamakBoot.mount === 'function');

/* ------------------------------------------------------ plugin contract */
const plugin = loaded.factory(requireStub);
check('factory returns apply/inject/name', plugin && typeof plugin.apply === 'function'
  && Array.isArray(plugin.inject) && typeof plugin.name === 'string');
check("inject includes 'slots'", plugin.inject.includes('slots'),
  `got ${JSON.stringify(plugin.inject)}`);

/* --------------------------------------------------- slot registration */
const registered = [];
let effectLabel = null;
const ctx = {
  effect(fn, label) { effectLabel = label; return fn(); },
  slots: {
    inject(seat, gen) {
      check(`slots.inject targets shell.overlay`, seat === 'shell.overlay', `got ${seat}`);
      const it = gen();
      let r = it.next();
      while (!r.done) r = it.next();
    },
    register(options, component) {
      registered.push({ options, component });
      return () => {};
    },
    get() { return undefined; }
  }
};

plugin.apply(ctx);
check('ctx.effect used with a label', typeof effectLabel === 'string', `got ${effectLabel}`);
check('registered exactly one overlay entry', registered.length === 1,
  `got ${registered.length}`);
if (registered.length === 1) {
  const { options, component } = registered[0];
  check("register name is 'shell.overlay'", options.name === 'shell.overlay');
  check("register id is 'boot-intro'", options.id === 'boot-intro');
  check('register order is high (paints above other overlays)',
    typeof options.order === 'number' && options.order >= 1000, `got ${options.order}`);
  check('register passes a component function', typeof component === 'function');
}

/* --------------------------------------------- render + commit + effects */
// The slot component is a wrapper returning h(BootOverlay), so rendering it
// yields another function component. Expand function components the way React
// would, giving each its own hook cells and collecting the effects it queues.
const allEffects = [];
function renderComponent(fn, props) {
  resetHooks();
  const out = fn(props || {});
  allEffects.push(...pendingEffects);
  pendingEffects = [];
  return out;
}

const componentFn = registered.length ? registered[0].component : null;
let tree = null;
if (componentFn) {
  tree = renderComponent(componentFn);
  let guard = 0;
  while (tree && typeof tree.type === 'function' && guard++ < 6) {
    tree = renderComponent(tree.type, tree.props);
  }
}

check('component renders an element on first paint', tree !== null && typeof tree === 'object');
check('root element is a div', tree && tree.type === 'div', tree && `got ${String(tree.type)}`);
check('root is a fixed full-screen overlay',
  tree && tree.props.style && tree.props.style.position === 'fixed'
  && tree.props.style.inset === '0');
check('root captures pointer events (modal splash)',
  tree && tree.props.style && tree.props.style.pointerEvents === 'auto');

// commit refs: give the canvas ref a real fake canvas node
const canvasChild = tree && tree.props.children;
check('a canvas is rendered', canvasChild && canvasChild.type === 'canvas',
  canvasChild && `got ${String(canvasChild.type)}`);
if (canvasChild && canvasChild.props.ref) canvasChild.props.ref.current = makeCanvas();

// Intercept mount so the natural-completion path (onDone) can be driven later.
const realMount = fakeWindow.TokamakBoot.mount;
let mountOpts = null;
fakeWindow.TokamakBoot.mount = function (canvas, opts) {
  mountOpts = opts || null;
  return realMount(canvas, opts);
};

// flush effects now that refs are committed
allEffects.forEach(fn => fn());

check('sessionStorage flag burned once the intro plays',
  sessionStore['dsh-boot-intro:played'] === '1',
  `got ${JSON.stringify(sessionStore)}`);
check('keydown listener installed for Enter-to-skip',
  Array.isArray(listeners.keydown) && listeners.keydown.length === 1);

/* -------------------------------------------------------- draw one frame */
check('a frame was scheduled via requestAnimationFrame', typeof rafCallback === 'function');
if (typeof rafCallback === 'function') {
  const before = drawOps.count;
  rafCallback(1000);
  check('renderer issued drawing operations', drawOps.count > before,
    `ops ${before} -> ${drawOps.count}`);
}

/* ------------------------------------------------------------ skip path */
let enterListener = null;
if (Array.isArray(listeners.keydown) && listeners.keydown.length) {
  const listener = listeners.keydown[0];
  enterListener = listener;
  let threw = null;
  try {
    listener({ key: 'Enter', keyCode: 13, preventDefault() {}, stopPropagation() {} });
  } catch (error) { threw = error; }
  check('Enter skips without throwing', threw === null, threw && String(threw));
  check('fade-out timers scheduled after skip', timeouts.length >= 1,
    `timeouts=${timeouts.length}`);
  check('Enter released as soon as the intro is skipped',
    listeners.keydown.length === 0, `still ${listeners.keydown.length} listener(s)`);
}

/* ------------------------------------------------- Enter must never leak */
// The bug this guards: when the intro ends the component returns null but is
// still *mounted*, so its effect cleanup never runs. A capture-phase keydown
// listener left behind keeps calling preventDefault on every Enter, which
// silently breaks sending a message in the app.
if (enterListener) {
  let swallowed = false;
  try {
    enterListener({
      key: 'Enter', keyCode: 13,
      preventDefault() { swallowed = true; }, stopPropagation() {}
    });
  } catch (error) { /* must not throw either */ }
  check('a stale listener cannot swallow Enter once finished', swallowed === false);
}

/* ------------------------------------------- natural completion releases it */
// Fresh factory instance => fresh `consumed` closure; clear the once-per-launch
// flag so the second scenario actually plays.
let naturalOk = false;
let naturalDetail = '';
try {
  sessionStore['dsh-boot-intro:played'] = undefined;
  delete sessionStore['dsh-boot-intro:played'];
  listeners.keydown = [];
  timeouts.length = 0;
  mountOpts = null;

  const plugin2 = loaded.factory(requireStub);
  const registered2 = [];
  plugin2.apply({
    effect(fn) { return fn(); },
    slots: {
      inject(seat, gen) { const it = gen(); let r = it.next(); while (!r.done) r = it.next(); },
      register(options, component) { registered2.push({ options, component }); return () => {}; },
      get() { return undefined; }
    }
  });

  const allEffects2 = [];
  function render2(fn, props) {
    resetHooks();
    const out = fn(props || {});
    allEffects2.push(...pendingEffects);
    pendingEffects = [];
    return out;
  }
  let tree2 = render2(registered2[0].component);
  let guard2 = 0;
  while (tree2 && typeof tree2.type === 'function' && guard2++ < 6) {
    tree2 = render2(tree2.type, tree2.props);
  }
  const canvas2 = tree2 && tree2.props.children;
  if (canvas2 && canvas2.props.ref) canvas2.props.ref.current = makeCanvas();
  allEffects2.forEach(fn => fn());

  const installedBefore = (listeners.keydown || []).length;
  // Natural completion, not a keypress.
  if (mountOpts && typeof mountOpts.onDone === 'function') mountOpts.onDone();
  const installedAfter = (listeners.keydown || []).length;

  naturalOk = installedBefore === 1 && installedAfter === 0;
  naturalDetail = `before=${installedBefore} after=${installedAfter}`;

  // and the hold/fade timers must still run to unmount the overlay
  runPendingTimers();
} catch (error) {
  naturalOk = false;
  naturalDetail = String(error && error.message);
}
check('natural completion also releases Enter immediately', naturalOk, naturalDetail);

/* --------------------------------------------- failure is recorded for reading */
// The renderer's own error state is unreachable once the overlay unmounts, so
// the plugin mirrors it into localStorage, which survives a restart and can be
// read back from disk to diagnose the real cause.
check('no error written on a clean run',
  localStore['dsh-boot-intro:lastError'] === undefined,
  `got ${localStore['dsh-boot-intro:lastError']}`);

/* ------------------------------------------------- capture failure paths */
console.log('--------------------------------');
if (failures === 0) {
  console.log('ALL CHECKS PASSED');
} else {
  console.log(`${failures} CHECK(S) FAILED`);
  process.exitCode = 1;
}