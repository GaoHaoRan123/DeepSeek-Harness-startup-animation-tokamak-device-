/* ---------------------------------------------------------------------------
 * dsh-boot-intro — browser half (classic script, no build tooling required).
 *
 * Contract (mirrors the working in-tree plugins, e.g. dsh-pet):
 *   window.__ModuleLoader__.load({ id, factory })
 *   factory(require) -> { apply(ctx), inject, name }
 *   apply(ctx) registers a component into the `shell.overlay` slot.
 *
 * This fragment is concatenated AFTER the TokamakBoot renderer by build.mjs,
 * so `window.TokamakBoot` is already defined when this runs.
 * ------------------------------------------------------------------------- */

/* Play at most once per app launch. sessionStorage survives an HMR reload of
 * this bundle but not a new window, which is exactly the desired cadence. */
var DSH_BOOT_INTRO_KEY = 'dsh-boot-intro:played';

function dshBootIntroPeek() {
  try { return !window.sessionStorage.getItem(DSH_BOOT_INTRO_KEY); }
  catch (error) { return true; }
}
function dshBootIntroCommit() {
  try { window.sessionStorage.setItem(DSH_BOOT_INTRO_KEY, '1'); } catch (error) { /* private mode */ }
}

function makeFactory() {
  return function (require) {
    var module = { exports: {} };
    var react = require('react');
    var useEffect = react.useEffect;
    var useRef = react.useRef;
    var useState = react.useState;
    var h = require('react/jsx-runtime').jsx;

    var name = 'boot-intro';
    var inject = ['slots'];

    // Tracks whether this page load already consumed the intro, so a remount
    // of the shell cannot replay it.
    var consumed = false;

    function BootOverlay() {
      var canvasRef = useRef(null);
      // Decide visibility on first render so a non-playing session never
      // flashes a black overlay.
      var initial = useState(function () {
        if (consumed) return false;
        return dshBootIntroPeek();
      });
      var active = initial[0];
      var setActive = initial[1];
      var fading = useState(false);
      var fade = fading[0];
      var setFade = fading[1];
      var gone = useState(false);
      var done = gone[0];
      var setDone = gone[1];

      useEffect(function () {
        if (!active) return undefined;
        var canvas = canvasRef.current;
        if (!canvas || !window.TokamakBoot) { setDone(true); return undefined; }

        // Only now is the intro really being shown: burn the once-per-launch flag.
        consumed = true;
        dshBootIntroCommit();
        setActive(true);

        var boot = null;
        // While true this plugin owns the Enter key. It MUST go false the
        // instant the intro stops: the harness uses Enter to send a message,
        // and a capture-phase handler that keeps calling preventDefault would
        // silently break typing in the app.
        var playing = false;
        var timers = [];
        var hardStop = 0;

        // The renderer can survive a bad frame on its own, but if it ever fails
        // to report completion we still unmount: an opaque overlay must never
        // outlive its welcome, or the app is unusable.
        var HARD_STOP_MS = 20000;

        function detach() {
          window.removeEventListener('keydown', onKey, true);
        }
        function clearTimers() {
          timers.forEach(function (id) { window.clearTimeout(id); });
          timers = [];
          if (hardStop) { window.clearTimeout(hardStop); hardStop = 0; }
        }
        // Persisted so the failure can be read back after a restart; the
        // renderer's own error state is unreachable once the overlay is gone.
        function reportError(info) {
          try {
            window.localStorage.setItem('dsh-boot-intro:lastError', JSON.stringify({
              at: (info && info.at) || 0,
              message: (info && info.message) || String(info),
              stack: (info && info.stack) || '',
              when: Date.now()
            }));
          } catch (error) { /* storage unavailable */ }
          try { console.error('[dsh-boot-intro] frame failed: ' + ((info && info.message) || info)); }
          catch (error) { /* no console */ }
        }
        function finish() {
          playing = false;
          detach();
          clearTimers();
          try { if (boot) boot.destroy(); } catch (error) { /* already torn down */ }
          setDone(true);
        }
        // Note: this component renders null when finished but stays *mounted*,
        // so its effect cleanup never runs. Never rely on the cleanup to
        // release the key -- detach() is called from every terminal path, and
        // the `playing` guard means we can never swallow a key we do not use.
        function onKey(event) {
          if (!playing) return;
          if (event.key !== 'Enter' && event.keyCode !== 13) return;
          event.preventDefault();
          event.stopPropagation();
          playing = false;              // consume this press only
          detach();
          try { boot.skip(); } catch (error) { finish(); }
        }

        try {
          boot = window.TokamakBoot.mount(canvas, {
            onError: reportError,
            onDone: function () {
              // Sequence over: hand Enter back to the app immediately, hold the
              // final wordmark briefly, then fade out to the app.
              playing = false;
              detach();
              timers.push(window.setTimeout(function () { setFade(true); }, 380));
              timers.push(window.setTimeout(finish, 880));
            }
          });
        } catch (error) {
          // A failure here must never wedge the app: drop the overlay.
          console.warn('[dsh-boot-intro] animation failed to start: ' + error);
          reportError(error);
          setDone(true);
          return undefined;
        }

        hardStop = window.setTimeout(function () {
          try { if (boot) boot.skip(); } catch (error) { /* ignore */ }
          finish();
        }, HARD_STOP_MS);

        // Requirement: Enter interrupts the sequence at any point.
        playing = true;
        window.addEventListener('keydown', onKey, true);

        return function () {
          playing = false;
          detach();
          clearTimers();
          try { if (boot) boot.destroy(); } catch (error) { /* already torn down */ }
        };
      }, []);

      if (!active || done) return null;

      // NB: react/jsx-runtime's jsx(type, props, key) takes no children
      // argument -- the third parameter is `key`. Children must be supplied
      // through props.children.
      return h('div', {
        // No click-to-skip: the spec is Enter-only, and a stray click at
        // startup must not dismiss the intro.
        style: {
          position: 'fixed',
          inset: '0',
          zIndex: 2147483000,
          background: '#000205',
          opacity: fade ? 0 : 1,
          transition: 'opacity 460ms ease',
          // Opt into pointer events: the intro is modal, the app behind it
          // must not receive clicks while it plays.
          pointerEvents: 'auto'
        },
        children: h('canvas', {
          ref: canvasRef,
          style: { display: 'block', width: '100%', height: '100%' }
        })
      });
    }

    function apply(ctx) {
      ctx.effect(function () {
        return ctx.slots.inject('shell.overlay', function* () {
          yield ctx.slots.register(
            { name: 'shell.overlay', id: 'boot-intro', order: 1e9 },
            function () { return h(BootOverlay, {}); }
          );
        });
      }, 'dsh-boot-intro: overlay');
    }

    module.exports = { apply: apply, inject: inject, name: name };
    return module.exports;
  };
}

window.__ModuleLoader__.load({
  id: 'dsh-boot-intro',
  factory: makeFactory()
});