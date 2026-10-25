/*!
 * dsh-boot-intro — generated browser bundle. DO NOT EDIT.
 * Source: dsh-boot-animation/tokamak-boot.js + plugin/lib/plugin-body.js
 * Rebuild: node dsh-boot-animation/build.mjs
 */
;(() => {
/* ============================================================================
 * DSH // TOKAMAK IGNITION SEQUENCE
 * ----------------------------------------------------------------------------
 * A physically-grounded, sci-fi startup animation for DeepSeek Harness.
 *
 * Theme: magnetic-confinement fusion (tokamak) control-room HUD.
 *
 * Physics that drives the visuals (all values ITER-like and real):
 *   - Toroidal field ramp            B_T   0 -> 5.30 T
 *   - Plasma current ramp            I_p   0 -> 15.02 MA
 *   - Electron / ion temperature     T_e   0.02 -> 20.1 keV
 *   - Electron density               n_e   0 -> 10.2 x 10^19 m^-3
 *   - Energy confinement time        tau_E 0 -> 3.72 s
 *   - D-T fusion   D + T -> 4He(3.52 MeV) + n(14.06 MeV),  sigma_peak ~ 4.9 b @ 64 keV
 *   - Lawson triple product          n*T*tau_E >= 3e21 keV*s/m^3  (ignition)
 *   - Fusion gain                    Q = P_fus / P_aux,  ITER target Q = 10
 *
 * The two fusion products are rendered with their real transport difference,
 * which is the visual centrepiece:
 *   4He(2+) is CHARGED  -> stays on the helical field lines, spirals inward,
 *                          deposits 3.52 MeV as alpha self-heating.
 *   n(0)    is NEUTRAL  -> ignores the magnetic field entirely, flies out in a
 *                          straight line and is captured by the blanket.
 *
 * Public API (attached to window.TokamakBoot):
 *   const boot = TokamakBoot.mount(canvas, { onDone, autoplay, freeze, loop })
 *   boot.skip()      // jump straight to the end (bound to Enter by the shell)
 *   boot.destroy()   // stop the loop and release listeners
 *
 * Deterministic frame mode: pass { freeze: <seconds> } to render one exact
 * frame with no animation loop (used for automated screenshot verification).
 * ========================================================================== */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------- design */
  const DW = 1600, DH = 900;          // fixed logical design resolution
  const DURATION = 9.2;               // seconds

  // Typography: Times New Roman for every non-CJK glyph, 宋体 (SimSun) for
  // Chinese. One stack achieves both, because the browser resolves fonts per
  // character: Times New Roman carries no CJK glyphs, so hanzi fall through to
  // SimSun automatically. Mixed strings such as "辅助加热 · 中性束注入" therefore
  // get Times New Roman for the Latin and punctuation and SimSun for the hanzi.
  const SERIF = "'Times New Roman',Times,'SimSun','宋体',NSimSun,serif";
  // Both former families now resolve to the same stack: the brief is that all
  // non-Chinese text is Times New Roman, so the old mono/sans split is gone.
  const MONO = SERIF;
  const SANS = SERIF;

  const C = {
    bg0: '#03101f', bg1: '#061a2e', bg2: '#082238',
    cyan: '#5fe3ff', cyan2: '#b6f5ff', cyanDim: '#2c93b8',
    blue: '#2f86ff', violet: '#a98cff',
    gold: '#ffc266', amber: '#ffa53d', red: '#ff5c6b',
    white: '#f2fbff', green: '#5cffb8', slate: '#7d9db5'
  };

  /* ------------------------------------------------------------------ math */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  function inv(a, b, t) { return b === a ? 0 : clamp((t - a) / (b - a), 0, 1); }
  const smooth = u => u * u * (3 - 2 * u);
  const easeOut = u => 1 - (1 - u) * (1 - u);
  const easeIn = u => u * u;
  function seg(t, a, b, ease) { const u = inv(a, b, t); return ease ? ease(u) : u; }
  function lcg(seed) { let x = seed >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }

  /* ------------------------------------------------------------- timeline */
  const PH = [
    [0.00, 'COLD START', '冷启动 · 系统自检'],
    [1.00, 'EVACUATION / TF RAMP', '抽真空 · 纵场线圈升流'],
    [2.40, 'BREAKDOWN / CURRENT RAMP', '等离子体击穿 · 电流爬升'],
    [3.00, 'AUXILIARY HEATING', '辅助加热 · 中性束注入'],
    [4.00, 'FUSION ONSET', '聚变反应起始'],
    [5.20, 'MHD TRANSIENT', '磁流体不稳定性'],
    [5.72, 'STABILIZED BURN', '反馈抑制 · 稳定燃烧'],
    [6.20, 'IGNITION', '自持点火'],
    [7.40, 'SYNCHRONIZATION', '同步完成']
  ];
  function phaseAt(t) { let i = 0; for (let k = 0; k < PH.length; k++) if (t >= PH[k][0]) i = k; return i; }

  /* -------------------------------------------------------- plasma state */
  function derive(t) {
    const saw = (t > 5.20 && t < 5.72) ? (t * 9.5) % 1 : 0;      // sawtooth relaxation
    const teDip = (t > 5.20 && t < 5.72) ? 1 - 0.16 * saw : 1;

    const vacuum = lerp(1.0e5, 8.7e-9, smooth(seg(t, 0.90, 2.20)));
    const bt = 5.30 * smooth(seg(t, 1.00, 2.40));
    const ip = 15.02 * smooth(seg(t, 2.45, 4.20));
    const te = lerp(0.02, 20.1, smooth(seg(t, 3.00, 5.40))) * teDip;
    const ti = lerp(0.02, 18.4, smooth(seg(t, 3.10, 5.60))) * teDip;
    const ne = lerp(0.0, 10.2, smooth(seg(t, 1.05, 2.30)));
    const tau = lerp(0.0, 3.72, smooth(seg(t, 4.00, 6.40)));
    const paux = lerp(50, 50, 0) * smooth(seg(t, 2.90, 3.40)) * (1 - 0.30 * smooth(seg(t, 6.40, 7.40)));
    const pfus = 500 * smooth(seg(t, 4.30, 6.80));
    const q = paux > 1 ? pfus / paux : 0;
    const triple = (ne * te * tau) / 100;                        // x 10^21 keV*s/m^3
    const alphaFrac = 0.82 * smooth(seg(t, 5.40, 6.90));
    return { vacuum, bt, ip, te, ti, ne, tau, paux, pfus, q, triple, alphaFrac, saw };
  }

  /* ----------------------------------------------------------- 3D helper */
  // Torus world coords: major radius 1.0, z is the vertical torus axis.
  function project(p, cam, S, cx, cy) {
    const cyw = Math.cos(cam.yaw), syw = Math.sin(cam.yaw);
    const x1 = p.x * cyw - p.y * syw;
    const y1 = p.x * syw + p.y * cyw;
    const z1 = p.z;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const y2 = y1 * cp - z1 * sp;
    const z2 = y1 * sp + z1 * cp;
    const d = 4.6;
    const k = d / (d + z2);
    return { x: cx + x1 * S * k, y: cy + y2 * S * k, s: k, z: z2 };
  }
  const torusPt = (R, r, phi, psi) => ({
    x: (R + r * Math.cos(psi)) * Math.cos(phi),
    y: (R + r * Math.cos(psi)) * Math.sin(phi),
    z: r * Math.sin(psi)
  });

  // Allocation-free projection for the hot ring loops.
  // These loops used to build a fresh array plus one point object per vertex on
  // every frame (18x35 + 2x91 + 15x73 + 61 ~= 1900 objects and 40 arrays per
  // frame, ~110k objects/s at 60 fps). That steady garbage produced periodic
  // minor-GC hitches, which is what "small stutters" actually were.
  const _sp = { x: 0, y: 0, s: 1, z: 0 };
  function projXYZ(x, y, z, cam, S, cx, cy) {
    const cyw = Math.cos(cam.yaw), syw = Math.sin(cam.yaw);
    const x1 = x * cyw - y * syw;
    const y1 = x * syw + y * cyw;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const y2 = y1 * cp - z * sp;
    const z2 = y1 * sp + z * cp;
    const k = 4.6 / (4.6 + z2);
    _sp.x = cx + x1 * S * k;
    _sp.y = cy + y2 * S * k;
    _sp.s = k;
    _sp.z = z2;
    return _sp;
  }
  // Toroidal ring: phi sweeps, psi fixed. Same maths as torusPt(R,r,a,psi).
  function torusRing(g, n, R, r, psi, cam, S, cx, cy) {
    const RR = R + r * Math.cos(psi), zz = r * Math.sin(psi);
    for (let k = 0; k <= n; k++) {
      const a = (k / n) * Math.PI * 2;
      const p = projXYZ(RR * Math.cos(a), RR * Math.sin(a), zz, cam, S, cx, cy);
      if (k) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y);
    }
  }
  // Poloidal ring: psi sweeps, phi fixed. Same maths as torusPt(R,r,phi,a).
  function poloidalRing(g, n, R, r, phi, cam, S, cx, cy) {
    const cf = Math.cos(phi), sf = Math.sin(phi);
    for (let k = 0; k <= n; k++) {
      const a = (k / n) * Math.PI * 2;
      const rr = R + r * Math.cos(a);
      const p = projXYZ(rr * cf, rr * sf, r * Math.sin(a), cam, S, cx, cy);
      if (k) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y);
    }
  }

  /* --------------------------------------------------- cached glow sprites */
  function glow(size, rgb) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    const r = size / 2;
    const grd = g.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0.00, 'rgba(' + rgb + ',1)');
    grd.addColorStop(0.22, 'rgba(' + rgb + ',0.62)');
    grd.addColorStop(0.55, 'rgba(' + rgb + ',0.16)');
    grd.addColorStop(1.00, 'rgba(' + rgb + ',0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    return cv;
  }
  function scanlinePattern(ctx) {
    const cv = document.createElement('canvas');
    cv.width = 4; cv.height = 4;
    const g = cv.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.30)';
    g.fillRect(0, 0, 4, 2);
    return ctx.createPattern(cv, 'repeat');
  }

  /* ------------------------------------------------------------ boot log */
  const LOG = [
    [0.10, 'dsh.core            online', 0],
    [0.34, 'cryostat            4.20 K       nominal', 2],
    [0.62, 'vacuum.vessel       8.7e-9 Pa    sealed', 2],
    [0.92, 'dt.gas              D:T 50:50    injected', 0],
    [1.26, 'tf.coils            18/18        B_T=5.30 T', 2],
    [1.70, 'pf.coils            shape lock   q=3.10', 2],
    [2.10, 'breakdown           12.4 V/m     ionized', 0],
    [2.52, 'ohmic.ramp          I_p=15.02 MA', 0],
    [3.02, 'nbi.injectors       33 MW H0', 0],
    [3.38, 'ecrh / icrh         17 MW RF', 0],
    [3.86, 'te.reached          20.1 keV', 2],
    [4.24, 'dt.fusion           sigma=4.9 b @ 64 keV', 0],
    [4.58, 'alpha.heating       3.52 MeV  confined', 1],
    [4.92, 'neutron.flux        14.06 MeV -> blanket', 1],
    [5.24, 'mhd.sawtooth        m/n=3/2     WARNING', 3],
    [5.72, 'feedback.stabilize  island suppressed', 2],
    [6.20, 'q.factor            Q=10.4      burning', 1],
    [6.70, 'alpha.fraction      82% self-heating', 1],
    [7.10, 'lawson              n*T*tau > 3e21  IGNITED', 1],
    [7.48, 'harness.sync        initializing', 0]
  ];

  /* ------------------------------------------------------------ renderer */
  function mount(canvas, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d', { alpha: false });
    const glowCyan = glow(64, '95,227,255');
    const glowGold = glow(64, '255,182,77');
    const glowWhite = glow(64, '235,246,255');
    const glowViolet = glow(64, '143,107,255');
    const scan = scanlinePattern(ctx);

    let t = opts.freeze != null ? opts.freeze : 0;
    // Optional time multiplier; only used for fast previews and tests.
    const speed = typeof opts.speed === 'number' && opts.speed > 0 ? opts.speed : 1;
    // Rebrandable ending. The defaults name the harness this animation was
    // originally written for; forks are expected to override them, since that
    // product name is a trademark of its owner.
    const title = typeof opts.title === 'string' && opts.title.trim()
      ? opts.title.trim() : 'DEEPSEEK HARNESS';
    const subtitle = typeof opts.subtitle === 'string' && opts.subtitle.trim()
      ? opts.subtitle.trim() : '聚变点火序列完成   ·   IGNITION SEQUENCE COMPLETE';
    let running = true, finished = false, raf = 0, last = 0, t0 = 0, watchdog = 0;
    // If the frame loop is starved (startup CPU contention, slow compositing),
    // the intro must still finish instead of dragging on. Past this much real
    // time beyond the nominal duration, remaining frames are dropped.
    const MAX_OVERRUN = 2.0;
    // A frame that throws must never kill the loop: that strands an opaque
    // overlay on top of the whole app with no way out.
    let errorCount = 0, lastError = null, errorReported = false;
    function recordError(error) {
      errorCount++;
      const message = (error && error.message) ? error.message : String(error);
      lastError = {
        message: message,
        stack: (error && error.stack) || '',
        at: Number(t.toFixed(3))
      };
      if (!errorReported) {
        errorReported = true;
        try { if (typeof opts.onError === 'function') opts.onError(lastError); } catch (e) { /* never throw from the reporter */ }
        try { console.error('[tokamak-boot] frame failed at t=' + t.toFixed(3) + ': ' + message); } catch (e) { /* no console */ }
      }
    }
    let dpr = 1, scale = 1, offX = 0, offY = 0;
    const rnd = lcg(0x5eed1234);
    const events = [];
    let lastSpawnT = 0;

    // Half-resolution scratch buffer for the additive bloom pass.
    const bloomCv = document.createElement('canvas');
    const bloomCtx = bloomCv.getContext('2d');
    function bloomPass(strength) {
      const bw = 300, bh = 170;
      // Defensive: drawImage throws on a zero-sized source, and this pass runs
      // on every frame over the whole canvas.
      if (!(canvas.width > 0) || !(canvas.height > 0)) return;
      if (!(strength > 0)) return;
      // NB: rebuilding this readback only on alternate frames was measured at a
      // 0.3 ms saving (15.0 -> 14.7 ms/frame), so it is not worth the one-frame
      // lag on the glow. Keep it every frame.
      if (bloomCv.width !== bw || bloomCv.height !== bh) { bloomCv.width = bw; bloomCv.height = bh; }
      bloomCtx.setTransform(1, 0, 0, 1, 0, 0);
      bloomCtx.clearRect(0, 0, bw, bh);
      bloomCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, bw, bh);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = strength;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(bloomCv, 0, 0, bw, bh, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    function resize() {
      dpr = Math.min(global.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || DW, h = canvas.clientHeight || DH;
      // Pixel budget. Every stage of a frame is a full-canvas pass (background
      // blit, bloom readback, additive glow, scanlines), so cost scales with the
      // device pixel count. The artwork is authored at 1600x900, so rendering
      // beyond that is supersampling a glow-heavy design: it buys almost no
      // visible sharpness while multiplying every pass. On a 150%-scaled
      // 2560x1440 display this cap cut the frame cost by ~20% on top of the
      // background cache.
      const MAX_PIXELS = 1.45e6;                 // ~= 1600x900, the design size
      const fit = Math.sqrt(MAX_PIXELS / Math.max(1, w * h));
      if (dpr > fit) dpr = Math.max(0.8, fit);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      scale = Math.min(w / DW, h / DH);
      offX = (w - DW * scale) / 2;
      offY = (h - DH * scale) / 2;
    }

    /* ---- fusion events: the physics centrepiece ------------------------ */
    function spawn(life) {
      const phi = rnd() * Math.PI * 2;
      const psi = rnd() * Math.PI * 2;
      const r = 0.24 + rnd() * 0.07;
      // gyro-orbits of the two reactants, spiralling toward each other
      events.push({
        phi: phi, psi: psi, r: r, age: 0, life: life || 1.25,
        g1: rnd() * Math.PI * 2, g2: rnd() * Math.PI * 2,
        seed: rnd(),
        alphaPath: [], hit: null
      });
    }
    // The alpha particle's confined helical path, built once per event.
    // Shared by stepEvents and the renderer so the two can never disagree about
    // whether it exists. They did once: the build used `u > 0.30` while the
    // renderer's branch was `u < 0.30` / else, so at exactly u === 0.30 the path
    // was never built yet the product branch ran, and alphaPath[-1] was
    // undefined -> "Cannot read properties of undefined (reading 'x')".
    function ensureAlphaPath(e) {
      if (e.alphaPath.length) return;
      const q = 3.1;
      for (let k = 0; k <= 26; k++) {
        const s = k / 26;
        const rr = e.r * (1 - 0.78 * s);              // spirals inward -> core heating
        const pp = e.phi + s * 1.5;
        const ps = e.psi + s * 1.5 / q * Math.PI * 2;
        e.alphaPath.push(torusPt(1.0, rr, pp, ps));
      }
    }

    function stepEvents(dt, tp) {
      // spawn rate tracks fusion power
      const st = derive(tp);
      const rate = st.pfus / 500 * 17;                    // events / second
      lastSpawnT += dt * rate;
      while (lastSpawnT >= 1) { lastSpawnT -= 1; spawn(); }
      for (let i = events.length - 1; i >= 0; i--) {
        const e = events[i];
        e.age += dt;
        const u = e.age / e.life;
        // Same threshold as the renderer's branch, and >= so the boundary case
        // is covered too.
        if (u >= 0.30) ensureAlphaPath(e);
        if (u >= 1) events.splice(i, 1);
      }
    }

    function drawTokamak(tp, st, layout) {
      const cam = { yaw: 0.60 + tp * 0.135, pitch: 1.19 };
      const S = layout.S, cx = layout.cx, cy = layout.cy;
      const collapse = seg(tp, 7.35, 7.95, easeIn);
      const bloom = seg(tp, 7.88, 8.60, easeOut);
      const form = smooth(seg(tp, 2.60, 4.20));
      const heat = smooth(seg(tp, 3.20, 5.60));
      const instab = (tp > 5.20 && tp < 5.72) ? (1 - st.saw) : 1;

      let bright = (0.10 + 0.90 * heat) * instab;
      // after the collapse the plasma must clear out, so the wordmark lands
      // on a dark stage instead of a saturated white blob
      bright *= (1 - 0.97 * bloom);
      const radiusScale = (1 - 0.93 * collapse) * (1 - 0.14 * (st.saw || 0));
      const jump = (tp > 5.20 && tp < 5.72) ? 1 - 0.10 * st.saw : 1;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      /* --- toroidal field coils: 18 D-approximated rings --------------- */
      const N = 18;
      for (let c = 0; c < N; c++) {
        const th = (c / N) * Math.PI * 2;
        const power = smooth(seg(tp, 0.55 + c * 0.030, 1.10 + c * 0.030));
        if (power <= 0.01) continue;
        const pts = [];
        for (let k = 0; k <= 34; k++) {
          const a = (k / 34) * Math.PI * 2;
          const rc = 0.60;
          pts.push(project({
            x: (1.0 + rc * Math.cos(a)) * Math.cos(th),
            y: (1.0 + rc * Math.cos(a)) * Math.sin(th),
            z: rc * Math.sin(a)
          }, cam, S, cx, cy));
        }
        const grd = ctx.createLinearGradient(cx - S, cy, cx + S, cy);
        const alpha = 0.22 + 0.66 * power;
        grd.addColorStop(0, 'rgba(47,134,255,' + (alpha * 0.5) + ')');
        grd.addColorStop(1, 'rgba(95,227,255,' + alpha + ')');
        ctx.strokeStyle = grd;
        ctx.lineWidth = 1.1 + 0.5 * power;
        ctx.beginPath();
        for (let k = 0; k < pts.length; k++) k ? ctx.lineTo(pts[k].x, pts[k].y) : ctx.moveTo(pts[k].x, pts[k].y);
        ctx.stroke();
      }

      /* --- vacuum vessel wall + blanket panels ------------------------- */
      const wallA = 0.16 + 0.24 * smooth(seg(tp, 1.40, 2.40));
      ctx.strokeStyle = 'rgba(93,127,150,' + wallA + ')';
      ctx.lineWidth = 1;
      for (let w = 0; w < 2; w++) {
        const rw = w === 0 ? 0.46 : 0.485;
        ctx.beginPath();
        torusRing(ctx, 90, 1.0, rw, 0, cam, S, cx, cy);
        ctx.stroke();
      }

      /* --- nested flux surfaces (the plasma body) ---------------------- */
      const surfaces = 15;
      for (let s = 0; s < surfaces; s++) {
        const f = 0.055 + (s / (surfaces - 1)) * 0.245;
        const r = f * radiusScale * (0.55 + 0.45 * form);
        if (r < 0.012) continue;
        const edge = 1 - s / surfaces;
        ctx.strokeStyle = 'rgba(95,227,255,' + (0.07 + 0.34 * bright * edge * jump) + ')';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        torusRing(ctx, 72, 1.0, r, 0, cam, S, cx, cy);
        ctx.stroke();
      }

      /* --- poloidal cross-section plane (faint) ------------------------ */
      ctx.strokeStyle = 'rgba(95,227,255,' + (0.11 * bright) + ')';
      ctx.beginPath();
      poloidalRing(ctx, 60, 1.0, 0.30 * radiusScale, 0, cam, S, cx, cy);
      ctx.stroke();

      /* --- helical field lines with travelling highlights -------------- */
      const q = 3.1;
      const lines = 22;
      for (let i = 0; i < lines; i++) {
        const psi0 = (i / lines) * Math.PI * 2;
        const pts = [];
        const steps = 150;
        for (let k = 0; k <= steps; k++) {
          const s = k / steps;
          const phi = s * Math.PI * 2;
          const psi = psi0 + phi / q;
          const r = 0.285 * radiusScale * (0.55 + 0.45 * form);
          pts.push(project(torusPt(1.0, r, phi, psi), cam, S, cx, cy));
        }
        ctx.strokeStyle = 'rgba(157,241,255,' + (0.26 * bright) + ')';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        for (let k = 0; k < pts.length; k++) k ? ctx.lineTo(pts[k].x, pts[k].y) : ctx.moveTo(pts[k].x, pts[k].y);
        ctx.stroke();

        // travelling bright knot: shows the field direction / current flow
        const head = ((tp * 0.30 + i * 0.045) % 1);
        const hi = Math.floor(head * steps);
        const hp = pts[hi];
        if (hp && bright > 0.15) {
          ctx.globalAlpha = 0.55 * bright;
          const sz = 10 * hp.s;
          ctx.drawImage(glowCyan, hp.x - sz / 2, hp.y - sz / 2, sz, sz);
          ctx.globalAlpha = 1;
        }
      }

      /* --- volumetric plasma glow -------------------------------------- */
      const blobs = 46;
      for (let i = 0; i < blobs; i++) {
        const phi = (i / blobs) * Math.PI * 2;
        const rr = 0.20 * radiusScale * (0.55 + 0.45 * form);
        const p = project(torusPt(1.0, rr, phi, 0), cam, S, cx, cy);
        const sz = (78 + 46 * (1 - i % 3)) * p.s * (0.35 + 0.65 * radiusScale);
        ctx.globalAlpha = clamp(0.30 * bright * p.s, 0, 1);
        ctx.drawImage(heat > 0.45 ? glowCyan : glowViolet, p.x - sz / 2, p.y - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;

      /* --- core + instability warning ---------------------------------- */
      const core = project({ x: 0, y: 0, z: 0 }, cam, S, cx, cy);
      const cs = (150 + 190 * bright) * (1 - collapse) + 520 * collapse;
      ctx.globalAlpha = clamp((0.45 + 0.75 * bright) * (1 - bloom * 0.97), 0, 1);
      ctx.drawImage(glowCyan, core.x - cs / 2, core.y - cs / 2, cs, cs);
      ctx.globalAlpha = 1;
      if (tp > 5.20 && tp < 5.72) {
        ctx.globalAlpha = 0.25 + 0.5 * st.saw;
        ctx.drawImage(glowGold, core.x - cs * 0.6, core.y - cs * 0.6, cs * 1.2, cs * 1.2);
        ctx.globalAlpha = 1;
      }

      /* --- fusion products --------------------------------------------- */
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        const u = e.age / e.life;
        const cp0 = torusPt(1.0, e.r, e.phi, e.psi);
        const pc = project(cp0, cam, S, cx, cy);

        if (u < 0.30) {
          // two reactants gyrating together
          const v = u / 0.30;
          const sep = (1 - v) * 0.075;
          const a1 = e.g1 + e.age * 26, a2 = e.g2 + e.age * 26;
          const p1 = project(torusPt(1.0, e.r + sep * Math.cos(a1), e.phi + sep * Math.sin(a1) * 0.5, e.psi), cam, S, cx, cy);
          const p2 = project(torusPt(1.0, e.r + sep * Math.cos(a2), e.phi + sep * Math.sin(a2) * 0.5, e.psi + Math.PI), cam, S, cx, cy);
          ctx.globalAlpha = 0.85;
          ctx.drawImage(glowCyan, p1.x - 9, p1.y - 9, 18, 18);
          ctx.drawImage(glowViolet, p2.x - 9, p2.y - 9, 18, 18);
          ctx.globalAlpha = 1;
        } else {
          // flash at the moment of fusion
          if (u < 0.42) {
            const f = 1 - (u - 0.30) / 0.12;
            const fs = 130 * (0.4 + f) * pc.s;
            ctx.globalAlpha = clamp(f, 0, 1);
            ctx.drawImage(glowWhite, pc.x - fs / 2, pc.y - fs / 2, fs, fs);
            ctx.globalAlpha = 1;
          }
          // alpha particle: confined, retraces a helical path inward
          ensureAlphaPath(e);                       // never dereference an unborn path
          const au = inv(0.30, 1.0, u);
          const ai = clamp(Math.floor(au * (e.alphaPath.length - 1)), 0, e.alphaPath.length - 1);
          const ap = project(e.alphaPath[ai], cam, S, cx, cy);
          ctx.strokeStyle = 'rgba(255,182,77,' + (0.60 * (1 - au)) + ')';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          for (let k = 0; k <= ai; k++) {
            const pp = project(e.alphaPath[k], cam, S, cx, cy);
            k ? ctx.lineTo(pp.x, pp.y) : ctx.moveTo(pp.x, pp.y);
          }
          ctx.stroke();
          ctx.globalAlpha = 0.9 * (1 - au * 0.5);
          ctx.drawImage(glowGold, ap.x - 12, ap.y - 12, 24, 24);
          ctx.globalAlpha = 1;

          // neutron: neutral, unmagnetised -> straight line out to the wall
          const nu = clamp((u - 0.30) / 0.55, 0, 1);
          const dir = { x: Math.cos(e.phi) * 0.83, y: Math.sin(e.phi) * 0.83, z: 0.56 * (e.seed - 0.5) * 2 };
          const L = 0.62 * nu;
          const np = { x: cp0.x + dir.x * L, y: cp0.y + dir.y * L, z: cp0.z + dir.z * L };
          const pp = project(np, cam, S, cx, cy);
          ctx.strokeStyle = 'rgba(234,246,255,' + (0.85 * (1 - nu * 0.75)) + ')';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(pc.x, pc.y);
          ctx.lineTo(pp.x, pp.y);
          ctx.stroke();
          ctx.globalAlpha = 0.9 * (1 - nu * 0.7);
          ctx.drawImage(glowWhite, pp.x - 8, pp.y - 8, 16, 16);
          ctx.globalAlpha = 1;
          // blanket capture ping
          if (nu > 0.92) {
            const ping = (nu - 0.92) / 0.08;
            ctx.strokeStyle = 'rgba(95,227,255,' + (0.5 * (1 - ping)) + ')';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(pp.x, pp.y, 3 + ping * 12, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      /* --- finale flash: a short ignition flash, not a persistent glow --- */
      if (bloom > 0 && bloom < 0.55) {
        const f = bloom / 0.55;                       // 0 -> 1 across the flash
        const bs = 150 + 950 * f;
        ctx.globalAlpha = clamp(0.80 * Math.pow(1 - f, 1.8), 0, 1);
        ctx.drawImage(glowWhite, core.x - bs / 2, core.y - bs / 2, bs, bs);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    /* ---------------------------------------------------------- HUD bits */
    function bar(x, y, w, h, v, col, dim) {
      ctx.fillStyle = 'rgba(95,227,255,0.10)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w * clamp(v, 0, 1), h);
      if (dim) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x + w * dim, y - 2, 1, h + 4); }
    }
    function txt(s, x, y, col, size, font, align) {
      ctx.fillStyle = col;
      ctx.font = (size || 13) + 'px ' + (font || MONO);
      ctx.textAlign = align || 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(s, x, y);
    }

    function drawFrame(tp) {
      const draw = smooth(seg(tp, 0.05, 0.75));
      const fade = 1 - 0.72 * smooth(seg(tp, 7.60, 8.40));
      ctx.save();
      ctx.globalAlpha = draw * fade;

      // corner brackets
      const m = 26, L = 46;
      ctx.strokeStyle = 'rgba(95,227,255,0.55)';
      ctx.lineWidth = 1.4;
      const corners = [[m, m, 1, 1], [DW - m, m, -1, 1], [m, DH - m, 1, -1], [DW - m, DH - m, -1, -1]];
      for (const c of corners) {
        ctx.beginPath();
        ctx.moveTo(c[0] + c[2] * L, c[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(c[0], c[1] + c[3] * L);
        ctx.stroke();
      }
      // header
      ctx.strokeStyle = 'rgba(95,227,255,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(m + L + 10, m); ctx.lineTo(DW - m - L - 10, m); ctx.stroke();
      txt('DSH-1  TOKAMAK  //  FUSION IGNITION SEQUENCE', m + L + 22, m + 5, C.cyan, 13);
      txt('T+' + tp.toFixed(3) + ' s', DW - m - L - 22, m + 5, C.cyan2, 13, MONO, 'right');

      // footer
      ctx.beginPath(); ctx.moveTo(m + L + 10, DH - m); ctx.lineTo(DW - m - L - 10, DH - m); ctx.stroke();
      txt('MAGNETIC CONFINEMENT  ·  D-T CYCLE  ·  ALPHA SELF-HEATING', m + L + 22, DH - m - 6, 'rgba(95,227,255,0.65)', 11.5);
      txt('CONF: ITER-LIKE', DW - m - L - 22, DH - m - 6, 'rgba(95,227,255,0.65)', 11.5, MONO, 'right');
      ctx.restore();
    }

    function drawTelemetry(tp, st) {
      const x = 40, y0 = 100, w = 286;
      ctx.save();
      txt('PLASMA TELEMETRY', x, y0 - 12, 'rgba(95,227,255,0.85)', 12.5);
      ctx.strokeStyle = 'rgba(95,227,255,0.30)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y0 - 5); ctx.lineTo(x + w, y0 - 5); ctx.stroke();

      const rows = [
        ['B_T', st.bt.toFixed(2) + ' T', st.bt / 6.0],
        ['I_p', st.ip.toFixed(2) + ' MA', st.ip / 16],
        ['T_e', st.te.toFixed(1) + ' keV', st.te / 25],
        ['T_i', st.ti.toFixed(1) + ' keV', st.ti / 25],
        ['n_e', st.ne.toFixed(1) + ' e19 m-3', st.ne / 12],
        ['tau_E', st.tau.toFixed(2) + ' s', st.tau / 4.5],
        ['P_aux', st.paux.toFixed(0) + ' MW', st.paux / 60],
        ['P_fus', st.pfus.toFixed(0) + ' MW', st.pfus / 600],
        ['Q', st.q.toFixed(1), st.q / 15]
      ];
      let y = y0 + 14;
      for (const r of rows) {
        txt(r[0], x, y, 'rgba(157,241,255,0.72)', 12);
        txt(r[1], x + w, y, C.cyan2, 12, MONO, 'right');
        bar(x, y + 4, w, 3, r[2], 'rgba(95,227,255,0.75)');
        y += 30;
      }
      // vacuum line
      txt('p_vessel', x, y + 2, 'rgba(157,241,255,0.72)', 12);
      txt(st.vacuum.toExponential(1).replace('e', 'e') + ' Pa', x + w, y + 2, C.cyan2, 12, MONO, 'right');
      y += 30;

      // Lawson triple product with ignition threshold
      const ty = y + 14;
      txt('LAWSON  n·T·tau_E', x, ty, 'rgba(95,227,255,0.85)', 12.5);
      txt(st.triple.toFixed(2) + ' e21', x + w, ty, C.cyan2, 12, MONO, 'right');
      bar(x, ty + 6, w, 9, st.triple / 9, st.triple >= 3 ? 'rgba(84,255,176,0.85)' : 'rgba(95,227,255,0.75)', 3 / 9);
      const lit = st.triple >= 3;
      txt(lit ? 'IGNITION THRESHOLD EXCEEDED' : 'threshold 3.0 e21',
        x, ty + 30, lit ? C.green : 'rgba(93,127,150,0.95)', 11);

      // alpha heating fraction
      const ay = ty + 52;
      txt('alpha self-heating', x, ay, 'rgba(157,241,255,0.72)', 12);
      txt((st.alphaFrac * 100).toFixed(0) + '%', x + w, ay, C.gold, 12, MONO, 'right');
      bar(x, ay + 4, w, 5, st.alphaFrac, 'rgba(255,182,77,0.85)');

      // reaction equation
      const ey = ay + 34;
      txt('D + T  ->  4He (3.52 MeV) + n (14.06 MeV)', x, ey, 'rgba(95,227,255,0.85)', 12);
      txt('sigma_peak 4.9 b @ 64 keV', x, ey + 18, 'rgba(93,127,150,0.95)', 11);
      ctx.restore();
    }

    function drawLog(tp) {
      const x = DW - 40 - 300, w = 300, y0 = 100;
      ctx.save();
      txt('SUBSYSTEM LOG', x, y0 - 12, 'rgba(95,227,255,0.85)', 12.5);
      ctx.strokeStyle = 'rgba(95,227,255,0.30)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y0 - 5); ctx.lineTo(x + w, y0 - 5); ctx.stroke();

      let y = y0 + 14;
      const cols = ['rgba(157,241,255,0.80)', 'rgba(255,182,77,0.92)', 'rgba(84,255,176,0.85)', 'rgba(255,154,46,1)'];
      for (const l of LOG) {
        if (tp < l[0]) break;
        const age = tp - l[0];
        const a = clamp(age / 0.22, 0, 1) * (1 - 0.72 * smooth(seg(tp, 7.60, 8.40)));
        ctx.globalAlpha = a;
        if (l[2] === 3) {
          // WARNING line: amber flash + heavier weight
          ctx.fillStyle = 'rgba(255,154,46,' + (0.10 + 0.12 * (0.5 + 0.5 * Math.sin(tp * 22))) + ')';
          ctx.fillRect(x - 4, y - 11, w + 8, 16);
        }
        txt('[' + l[0].toFixed(3) + '] ' + l[1], x, y, cols[l[2]], 11.5);
        ctx.globalAlpha = 1;
        y += 20;
        if (y > DH - 130) break;
      }
      ctx.restore();
    }

    function drawCrossSection(tp, st) {
      const bx = 40, by = 612, bw = 286, bh = 250;
      ctx.save();
      ctx.globalAlpha = 1 - 0.72 * smooth(seg(tp, 7.60, 8.40));
      txt('POLOIDAL CROSS-SECTION', bx, by - 8, 'rgba(95,227,255,0.85)', 12);
      ctx.strokeStyle = 'rgba(95,227,255,0.22)'; ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, bh);

      const cx = bx + bw / 2, cy = by + bh / 2 + 6;
      const a = 42, k = 1.75, d = 0.42;
      const R0 = 0; // centred
      const form = smooth(seg(tp, 2.60, 4.20));

      // separatrix
      ctx.strokeStyle = 'rgba(95,227,255,0.55)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i <= 96; i++) {
        const th = (i / 96) * Math.PI * 2;
        const X = cx + (R0 + a * Math.cos(th + d * Math.sin(th)));
        const Y = cy - a * k * Math.sin(th);
        i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      }
      ctx.stroke();

      // nested flux surfaces
      for (let s = 1; s <= 9; s++) {
        const f = s / 10 * form;
        ctx.strokeStyle = 'rgba(95,227,255,' + (0.06 + 0.30 * f) + ')';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let i = 0; i <= 96; i++) {
          const th = (i / 96) * Math.PI * 2;
          const X = cx + (R0 + a * f * Math.cos(th + d * Math.sin(th) * f));
          const Y = cy - a * k * f * Math.sin(th);
          i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
        }
        ctx.stroke();
      }
      // magnetic axis
      ctx.fillStyle = 'rgba(234,246,255,0.8)';
      ctx.fillRect(cx - 1, cy - 1, 2, 2);
      // X-point marker
      ctx.strokeStyle = 'rgba(255,182,77,0.9)'; ctx.lineWidth = 1.2;
      const xx = cx, xy = cy + a * k + 7;
      ctx.beginPath();
      ctx.moveTo(xx - 5, xy - 5); ctx.lineTo(xx + 5, xy + 5);
      ctx.moveTo(xx + 5, xy - 5); ctx.lineTo(xx - 5, xy + 5);
      ctx.stroke();
      txt('X-point', xx + 10, xy + 4, 'rgba(255,182,77,0.75)', 10);

      // TF coil markers around the section
      ctx.strokeStyle = 'rgba(47,134,255,0.75)'; ctx.lineWidth = 1.4;
      const R = 62;
      for (let i = 0; i < 12; i++) {
        const th = (i / 12) * Math.PI * 2;
        const X = cx + R * Math.cos(th) * 1.55, Y = cy + R * Math.sin(th) * 1.16;
        ctx.beginPath(); ctx.arc(X, Y, 3.2, 0, Math.PI * 2); ctx.stroke();
      }
      // plasma current direction
      const rot = tp * 2.2;
      ctx.strokeStyle = 'rgba(95,227,255,0.9)'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, 16, rot, rot + Math.PI * 1.2);
      ctx.stroke();
      const ah = rot + Math.PI * 1.2;
      const hx = cx + 16 * Math.cos(ah), hy = cy + 16 * Math.sin(ah);
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx - 6 * Math.cos(ah - 0.5), hy - 6 * Math.sin(ah - 0.5));
      ctx.stroke();
      txt('I_p', cx + 22, cy - 20, 'rgba(95,227,255,0.8)', 10.5);
      ctx.restore();
    }

    function drawBottom(tp, st) {
      const idx = phaseAt(tp);
      const cx = DW / 2;
      ctx.save();
      ctx.globalAlpha = 1 - 0.80 * smooth(seg(tp, 7.60, 8.30));

      const banner = PH[idx][1] + '   ·   ' + PH[idx][2];
      ctx.textAlign = 'center';
      ctx.font = '17px ' + MONO;
      const bw = ctx.measureText(banner).width;
      ctx.fillStyle = 'rgba(95,227,255,0.07)';
      ctx.fillRect(cx - bw / 2 - 18, 622, bw + 36, 30);
      ctx.strokeStyle = 'rgba(95,227,255,0.45)'; ctx.lineWidth = 1;
      ctx.strokeRect(cx - bw / 2 - 18, 622, bw + 36, 30);
      txt(banner, cx, 643, C.cyan2, 17, MONO, 'center');

      // progress rail
      const pw = 620, px = cx - pw / 2, py = 682;
      ctx.fillStyle = 'rgba(95,227,255,0.12)';
      ctx.fillRect(px, py, pw, 3);
      ctx.fillStyle = C.cyan;
      ctx.fillRect(px, py, pw * clamp(tp / DURATION, 0, 1), 3);
      for (let i = 0; i < PH.length; i++) {
        const fx = px + pw * (PH[i][0] / DURATION);
        const on = tp >= PH[i][0];
        ctx.fillStyle = on ? C.cyan : 'rgba(95,227,255,0.30)';
        ctx.fillRect(fx, py - 5, 1.5, 13);
      }
      // product legend
      txt('4He2+  confined -> alpha heating', cx - 160, py + 30, 'rgba(255,182,77,0.85)', 11.5, MONO, 'center');
      txt('n0  unmagnetised -> blanket', cx + 160, py + 30, 'rgba(234,246,255,0.75)', 11.5, MONO, 'center');
      ctx.restore();
    }

    function drawFinale(tp) {
      const appear = smooth(seg(tp, 7.95, 8.55));
      const hint = smooth(seg(tp, 8.70, DURATION));
      if (appear <= 0) return;
      const cx = DW / 2, cy = 420;
      ctx.save();
      // energy sweep reveals the wordmark
      const sweep = seg(tp, 7.88, 8.50, easeOut);
      const w = 900 * sweep;
      ctx.beginPath();
      ctx.rect(cx - w / 2, cy - 70, w, 150);
      ctx.clip();

      ctx.textAlign = 'center';
      ctx.font = '600 62px ' + SANS;
      ctx.fillStyle = C.white;
      ctx.globalAlpha = appear;
      ctx.fillText(title, cx, cy + 12);

      ctx.font = '17px ' + MONO;
      ctx.fillStyle = C.cyan;
      ctx.globalAlpha = appear * 0.95;
      ctx.fillText(subtitle, cx, cy + 52);
      ctx.restore();

      // expanding sweep line
      if (sweep < 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const lx = cx + 450 * sweep, ly = cy - 40;
        ctx.globalAlpha = (1 - sweep) * 0.9;
        ctx.drawImage(glowCyan, lx - 40, ly - 40, 80, 80);
        ctx.restore();
      }
      if (hint > 0 && !finished) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.globalAlpha = hint * (0.45 + 0.35 * Math.sin(tp * 4));
        txt('PRESS  ENTER', cx, cy + 112, C.cyan2, 13, MONO, 'center');
        ctx.restore();
      }
    }

    /* -------------------------------------------------------- background */
    // The background never reads tp -- it is completely static. It used to
    // rebuild two gradients, 32 paths and two full-canvas fills on every frame,
    // which measured at ~42% of the frame budget. Render it once into a layer
    // sized to the backing store and blit that instead.
    let bgCv = null, bgCtx = null, bgW = 0, bgH = 0;

    function paintBackground(g) {
      const grad = g.createLinearGradient(0, 0, 0, DH);
      grad.addColorStop(0, C.bg1);
      grad.addColorStop(0.55, C.bg0);
      grad.addColorStop(1, C.bg1);
      g.fillStyle = grad;
      g.fillRect(0, 0, DW, DH);

      // faint polar grid
      const cx = DW / 2, cy = 430;
      g.save();
      g.globalAlpha = 0.55;
      g.strokeStyle = 'rgba(95,227,255,0.075)';
      g.lineWidth = 1;
      for (let r = 90; r < 700; r += 90) {
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      }
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(a) * 700, cy + Math.sin(a) * 700);
        g.stroke();
      }
      g.restore();

      // vignette
      const v = g.createRadialGradient(cx, cy, 200, cx, cy, 920);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.46)');
      g.fillStyle = v;
      g.fillRect(0, 0, DW, DH);
    }

    function buildBackgroundLayer() {
      const w = canvas.width, h = canvas.height;
      if (!(w > 0) || !(h > 0)) return;
      if (!bgCv) { bgCv = document.createElement('canvas'); bgCtx = bgCv.getContext('2d'); }
      if (bgW !== w || bgH !== h) { bgCv.width = w; bgCv.height = h; bgW = w; bgH = h; }
      bgCtx.setTransform(1, 0, 0, 1, 0, 0);
      bgCtx.clearRect(0, 0, w, h);
      // Same mapping as the main frame, so the layer lines up exactly.
      bgCtx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, dpr * offY);
      paintBackground(bgCtx);
    }

    function background(tp) {
      if (!bgCv || bgW !== canvas.width || bgH !== canvas.height) buildBackgroundLayer();
      if (!bgCv) { paintBackground(ctx); return; }   // fallback: no offscreen support
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(bgCv, 0, 0);
      ctx.restore();
    }

    /* ------------------------------------------------------------ frame */
    function render(tp) {
      const st = derive(tp);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000205';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, dpr * offY);

      background(tp);
      drawTokamak(tp, st, { S: 252, cx: DW / 2, cy: 420 });
      // bloom the plasma before the HUD is drawn, so interface text stays crisp
      bloomPass(tp > 7.3 ? 0.42 * (1 - 0.75 * smooth(seg(tp, 7.88, 8.60))) : 0.42);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, dpr * offY);
      drawFrame(tp);
      drawTelemetry(tp, st);
      drawLog(tp);
      drawCrossSection(tp, st);
      drawBottom(tp, st);
      drawFinale(tp);

      // scanlines + vignette overlay in design space
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = scan;
      ctx.fillRect(0, 0, DW, DH);
      ctx.restore();
    }

    /* ------------------------------------------------------------- loop */
    function frame(now) {
      if (!running) return;
      try {
        if (!last) last = now;
        if (!t0) t0 = now;
        let dt = (now - last) / 1000;
        last = now;
        // Bound the physics step: a long stall must not spawn a burst of
        // particles or teleport them across the frame.
        dt = Math.min(Math.max(dt, 0), 1 / 10);
        t += dt * speed;
        // Ceiling on real time, so a slow machine drops frames rather than
        // stretching the sequence.
        if ((now - t0) / 1000 > DURATION / speed + MAX_OVERRUN) t = DURATION;
        stepEvents(dt, t);
        render(t);
      } catch (error) {
        // Keep the loop alive: record it, step past the offending instant so we
        // are not retrying the identical frame forever, and bail out entirely if
        // it keeps failing.
        recordError(error);
        t = Math.min(DURATION, t + 0.05);
        if (errorCount >= 30) { finish(); return; }
      }
      if (t >= DURATION) {
        if (opts.loop && !finished) {
          t = 0; events.length = 0; lastSpawnT = 0;
        } else {
          if (!finished) finish();
          // The final frame stays on the canvas; stop the loop rather than
          // re-rendering a static image forever.
          return;
        }
      }
      if (running) raf = requestAnimationFrame(frame);
    }

    function finish() {
      if (finished) return;
      finished = true;
      if (watchdog) { try { global.clearTimeout(watchdog); } catch (e) { /* no timer */ } watchdog = 0; }
      if (typeof opts.onDone === 'function') opts.onDone();
    }
    function skip() {
      if (finished) return;
      try {
        // fast-forward the simulation so the end state is coherent
        let st = t;
        while (st < DURATION) { const d = 1 / 60; stepEvents(d, st); st += d; }
        t = DURATION;
        render(t);
      } catch (error) {
        // Skipping must always release the overlay, even if the final frame
        // cannot be drawn.
        recordError(error);
      }
      finish();
    }

    resize();
    const onResize = () => { resize(); if (opts.freeze != null) render(t); };
    global.addEventListener('resize', onResize);

    if (opts.freeze != null) {
      // deterministic single frame: simulate up to the requested time
      let st = 0;
      const d = 1 / 60;
      while (st < opts.freeze) { stepEvents(d, st); st += d; }
      events.length = 0; lastSpawnT = 0;
      st = 0;
      while (st < opts.freeze) { stepEvents(d, st); st += d; }
      t = opts.freeze;
      render(t);
    } else if (opts.autoplay !== false) {
      raf = requestAnimationFrame(frame);
      // Hard safety net, independent of requestAnimationFrame: even if the frame
      // loop dies completely, the intro must never outlive its welcome and leave
      // an opaque overlay covering the app.
      watchdog = global.setTimeout(function () {
        if (finished) return;
        try { render(Math.min(t, DURATION)); } catch (error) { recordError(error); }
        finish();
      }, (DURATION / speed + 6) * 1000);
    } else {
      render(0);
    }

    return {
      skip: skip,
      destroy: function () {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        if (watchdog) { try { global.clearTimeout(watchdog); } catch (e) { /* no timer */ } watchdog = 0; }
        global.removeEventListener('resize', onResize);
      },
      renderAt: function (s) {
        events.length = 0; lastSpawnT = 0;
        let st = 0; const d = 1 / 60;
        while (st < s) { stepEvents(d, st); st += d; }
        t = s; render(t);
      },
      get time() { return t; },
      get error() { return lastError; },
      get errorCount() { return errorCount; }
    };
  }

  global.TokamakBoot = { mount: mount, DURATION: DURATION };
})(window);
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
})();
