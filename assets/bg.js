/* ============================================================
   bg.js — Three.js floating-code background
   A field of ~80-110 semi-transparent glyphs & short strings
   drifting in 3D space. Desktop mouse parallax (near objects
   move more), scroll dolly-zoom (fly through the field), plus
   a per-object idle float + slow self-rotation.

   Self-contained: builds its own canvas, shares nothing with
   the page. If the Three.js CDN fails (THREE undefined) or
   WebGL is unavailable, it no-ops silently — the hero is
   never affected.
   ============================================================ */
(function () {
  'use strict';

  // --- graceful fallback: CDN failed to load ---
  if (typeof THREE === 'undefined') return;

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouch = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window);
  var isSmall = Math.min(window.innerWidth, window.innerHeight) < 700;

  var DARK   = ['#3a3a3a', '#4a4a4a', '#2a2a2a', '#555555']; // dark silver watermark tones
  var RARE   = '#6b7280';                                    // occasional faint blue-grey
  var GLYPHS  = ['0', '1', '2', '3', '<', '>', '/', '{', '}', 'AI', 'LLM', '01', 'π'];
  var COUNT   = isSmall ? 80 : 110;
  function pickColor() { return Math.random() < 0.08 ? RARE : DARK[(Math.random() * DARK.length) | 0]; }

  var START_Z = 80;   // camera start depth
  var FLY     = 180;  // how far the scroll dollies the camera forward
  var PARALLAX = 6;   // world-unit camera shift at full mouse deflection

  // ---- canvas (sits behind page content: pointer-transparent, z-index 0) ----
  var canvas = document.createElement('canvas');
  canvas.id = 'bg-canvas';
  var cs = canvas.style;
  cs.position = 'fixed'; cs.top = '0'; cs.left = '0';
  cs.width = '100%'; cs.height = '100%';
  cs.zIndex = '0'; cs.pointerEvents = 'none';
  document.body.insertBefore(canvas, document.body.firstChild);

  // ---- renderer / scene / camera ----
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  } catch (e) {
    canvas.parentNode && canvas.parentNode.removeChild(canvas); // no WebGL → bail cleanly
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.75 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, START_Z);

  // ---- glyph → texture (cached by text+color) ----
  var texCache = {};
  function glyphTexture(text, color) {
    var key = text + '|' + color;
    if (texCache[key]) return texCache[key];

    var pad = 28, fontPx = 100;
    var font = '600 ' + fontPx + "px 'IBM Plex Sans', ui-monospace, 'SFMono-Regular', Menlo, monospace";
    var c = document.createElement('canvas');
    var cx = c.getContext('2d');

    cx.font = font;
    var w = Math.ceil(cx.measureText(text).width) + pad * 2;
    var h = fontPx + pad * 2;
    c.width = w; c.height = h;

    cx.font = font;
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillStyle = color;       // flat watermark, no glow
    cx.fillText(text, w / 2, h / 2);

    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    var rec = { tex: tex, aspect: w / h };
    texCache[key] = rec;
    return rec;
  }

  // ---- interaction state ----
  var TAU = Math.PI * 2;
  function rand(a, b) { return a + Math.random() * (b - a); }

  var mx = 0, my = 0;        // normalized mouse target (-1..1)
  var camX = 0, camY = 0;    // smoothed parallax offset
  var scrollProg = 0;        // 0..1 down the page
  var items = [];

  function readScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    scrollProg = max > 0 ? Math.min(Math.max(window.pageYOffset / max, 0), 1) : 0;
  }

  function applyCamera() {
    // perspective makes near (larger) objects shift more — natural parallax.
    camX += (mx * PARALLAX - camX) * 0.05;
    camY += (my * PARALLAX - camY) * 0.05;
    camera.position.x = camX;
    camera.position.y = camY;
    camera.position.z = START_Z - scrollProg * FLY;
  }

  function renderStatic() {
    applyCamera();
    renderer.render(scene, camera);
  }

  // ---- build the field, then start ----
  function build() {
    for (var i = 0; i < COUNT; i++) {
      var text = GLYPHS[(Math.random() * GLYPHS.length) | 0];
      var color = pickColor();
      var g = glyphTexture(text, color);

      var mat = new THREE.SpriteMaterial({
        map: g.tex,
        transparent: true,
        opacity: rand(0.05, 0.12),
        depthWrite: false           // depthTest stays on → correct near-over-far sort
      });
      var sp = new THREE.Sprite(mat);

      var baseH = rand(3.5, 9);
      sp.scale.set(baseH * g.aspect, baseH, 1);

      var by = rand(-45, 45);
      sp.position.set(rand(-70, 70), by, rand(-200, 30));
      scene.add(sp);

      items.push({
        sp: sp,
        by: by,
        amp: rand(1.2, 4),          // idle float amplitude
        spd: rand(0.15, 0.5),       // idle float speed
        phase: rand(0, TAU),
        rot: rand(-0.12, 0.12)      // self-rotation (rad/sec) — very slow
      });
    }

    if (reduced) {
      // honor reduced-motion: no auto float/spin/parallax.
      // still respond to user-initiated scroll.
      renderStatic();
      window.addEventListener('scroll', renderStatic, { passive: true });
      return;
    }

    var clock = (typeof THREE.Clock === 'function') ? new THREE.Clock() : null;
    var t = 0;
    (function loop() {
      requestAnimationFrame(loop);
      var dt = clock ? clock.getDelta() : 0.016;
      t += dt;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        it.sp.position.y = it.by + Math.sin(t * it.spd + it.phase) * it.amp;
        it.sp.material.rotation += it.rot * dt;
      }
      applyCamera();
      renderer.render(scene, camera);
    })();
  }

  // ---- listeners ----
  readScroll();
  window.addEventListener('scroll', readScroll, { passive: true });

  if (!isTouch && !reduced) {
    window.addEventListener('mousemove', function (e) {
      mx = (e.clientX / window.innerWidth) * 2 - 1;
      my = -((e.clientY / window.innerHeight) * 2 - 1);
    }, { passive: true });
  }

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    readScroll();
    if (reduced) renderStatic();
  });

  // wait for the brand font so glyph textures bake in IBM Plex Sans (falls back gracefully)
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(build);
  } else {
    build();
  }
})();
