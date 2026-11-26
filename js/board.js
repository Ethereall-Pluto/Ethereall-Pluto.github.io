/* Interactive 3D model of the fan control board (ФКІСІТ 171.005.026).
   Components and their values come from the project BOM; placement is illustrative.
   Units are millimetres, y = 0 is the top surface of the PCB. Requires Three.js r128 (global build). */
(function () {
  'use strict';

  var holder = document.getElementById('board3d');
  var canvas = document.getElementById('board-canvas');
  var tip = document.getElementById('board-tip');
  if (!holder || !canvas) return;
  function off() { holder.classList.add('off'); }
  if (!window.THREE) { off(); return; }

  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); }
  catch (e) { off(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(30, 1.6, 1, 400);

  /* ---------- Lighting: a small studio for reflections, one key light for shadows ---------- */
  function studio() {
    var env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.BoxGeometry(60, 40, 60),
      new THREE.MeshBasicMaterial({ color: 0x34383c, side: THREE.BackSide })));
    function panel(w, h, x, y, z, rx, ry, power) {
      var m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
      m.color.setScalar(power);
      var p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      p.position.set(x, y, z); p.rotation.set(rx, ry, 0);
      env.add(p);
    }
    panel(32, 32, 0, 19.5, 0, Math.PI / 2, 0, 2.2);
    panel(22, 14, -29.5, 4, 0, 0, Math.PI / 2, 1.8);
    panel(22, 14, 29.5, 6, 0, 0, -Math.PI / 2, 0.9);
    panel(26, 10, 0, 3, -29.5, 0, 0, 1.3);
    var pmrem = new THREE.PMREMGenerator(renderer);
    var tex = pmrem.fromScene(env, 0.03).texture;
    pmrem.dispose();
    return tex;
  }
  scene.environment = studio();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3a33, 0.15));
  var key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(-18, 30, 16);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -34; key.shadow.camera.right = 34;
  key.shadow.camera.top = 34; key.shadow.camera.bottom = -34;
  key.shadow.camera.near = 5; key.shadow.camera.far = 90;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 3;
  scene.add(key);

  /* ---------- Materials ---------- */
  function col(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
  function std(hex, rough, metal, extra) {
    var o = { color: col(hex), roughness: rough, metalness: metal || 0 };
    for (var k in extra) o[k] = extra[k];
    return new THREE.MeshStandardMaterial(o);
  }
  var M = {
    tin: std(0xd9dcda, 0.28, 1),
    brass: std(0xd1a545, 0.3, 1),
    epoxy: std(0x161718, 0.55),
    nylon: std(0xe4decd, 0.55),
    blue: std(0x1c5fc4, 0.35),
    ceramic: std(0xe9e6df, 0.6),
    capTan: std(0xb08d62, 0.6),
    coat: std(0x101112, 0.5),
    band: std(0xc9cccb, 0.5),
    dark: std(0x2a2c2e, 0.6),
    glass: std(0xc2562b, 0.12, 0, { transparent: true, opacity: 0.88 }),
    lens: std(0xff5a4a, 0.2, 0, { emissive: col(0xff2a1a), emissiveIntensity: 1.2, transparent: true, opacity: 0.92 }),
    boardSide: std(0x9c8f4e, 0.8),
    boardBottom: std(0x0b4a35, 0.6)
  };

  /* ---------- Geometry helpers ---------- */
  function roundedRect(w, d, r) {
    var s = new THREE.Shape(), x = -w / 2, y = -d / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  // Box with softened edges, sitting on y = 0 and growing upwards
  function softBox(w, h, d, b) {
    b = Math.min(b, w / 2 - 0.004, h / 2 - 0.004, d / 2 - 0.004);
    var geo = new THREE.ExtrudeGeometry(roundedRect(w - 2 * b, d - 2 * b, b * 0.5), {
      depth: h - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 3
    });
    geo.translate(0, 0, b);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }
  function shade(mesh) { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }
  function part(parent, w, h, d, material, x, y, z, bevel) {
    var mesh = shade(new THREE.Mesh(softBox(w, h, d, bevel == null ? 0.06 : bevel), material));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function cyl(parent, r, len, material, x, y, z, alongX) {
    var mesh = shade(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 28), material));
    if (alongX) mesh.rotation.z = Math.PI / 2;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  // Text printed on a part: laser marking or a paper label
  function marking(parent, text, w, h, color, x, y, z, upright) {
    var c = document.createElement('canvas');
    c.width = 256; c.height = Math.max(32, Math.round(256 * h / w));
    var ctx = c.getContext('2d');
    ctx.fillStyle = color;
    ctx.font = '600 ' + Math.round(c.height * 0.78) + 'px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, c.width / 2, c.height / 2 + c.height * 0.04, c.width * 0.96);
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    if (!upright) mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    parent.add(mesh);
  }

  /* ---------- Board and component registry ---------- */
  var pivot = new THREE.Group();     // everything that turns with the board
  scene.add(pivot);
  var board = new THREE.Group();
  pivot.add(board);
  var comps = [];                    // component groups, used for hover and the assembly animation

  function component(ref, about, x, z, rot) {
    var pads = new THREE.Group();    // pads stay on the board while the part drops in
    pads.position.set(x, 0, z); pads.rotation.y = rot || 0;
    board.add(pads);
    var g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = rot || 0;
    g.userData = { ref: ref, about: about, pads: pads };   // about = [English, Ukrainian]
    board.add(g);
    comps.push(g);
    return g;
  }
  function pad(g, x, z, w, d) {
    var mesh = new THREE.Mesh(softBox(w, 0.04, d, 0.012), M.tin);
    mesh.receiveShadow = true;
    mesh.position.set(x, 0.004, z);
    g.userData.pads.add(mesh);
  }
  // Gull-wing lead leaving the body at zEdge towards dir (+1 / -1), with its pad
  function gull(g, x, zEdge, dir, w, topY, reach) {
    part(g, w, 0.13, reach * 0.45, M.tin, x, topY, zEdge + dir * reach * 0.225, 0.03);
    part(g, w, topY + 0.13, 0.13, M.tin, x, 0.03, zEdge + dir * reach * 0.45, 0.03);
    part(g, w, 0.13, reach * 0.55, M.tin, x, 0.03, zEdge + dir * reach * 0.725, 0.03);
    pad(g, x, zEdge + dir * reach * 0.72, w + 0.14, reach * 0.8);
  }

  /* ---------- Component builders ---------- */
  function xh(ref, about, pins, x, z, rot) {          // JST XH shrouded header, 2.5 mm pitch
    var g = component(ref, about, x, z, rot);
    var L = (pins - 1) * 2.5 + 4.9, D = 5.75, H = 7, t = 0.7;
    part(g, L - 0.1, 1.1, D - 0.1, M.nylon, 0, 0, 0);
    part(g, t, H, D, M.nylon, -(L - t) / 2, 0, 0, 0.1);
    part(g, t, H, D, M.nylon, (L - t) / 2, 0, 0, 0.1);
    part(g, L - 2 * t + 0.04, H, t, M.nylon, 0, 0, -(D - t) / 2, 0.1);
    part(g, L - 2 * t + 0.04, 3.6, t, M.nylon, 0, 0, (D - t) / 2, 0.1);
    for (var i = 0; i < pins; i++) part(g, 0.64, 5.0, 0.64, M.tin, (i - (pins - 1) / 2) * 2.5, 1.0, 0, 0.08);
    return g;
  }
  function trimmer(ref, about, x, z, rot) {            // 3296W multi-turn trimmer
    var g = component(ref, about, x, z, rot);
    part(g, 9.53, 9.6, 4.83, M.blue, 0, 0.25, 0, 0.3);
    cyl(g, 1.15, 0.5, M.brass, -3.3, 10.1, 0);
    part(g, 2.1, 0.1, 0.36, M.dark, -3.3, 10.3, 0, 0.02);
    marking(g, '3296W 202', 6.4, 1.5, '#e8eefc', 0.6, 5.6, 2.43, true);
    return g;
  }
  function msop8(ref, about, x, z, rot) {
    var g = component(ref, about, x, z, rot);
    part(g, 3, 0.85, 3, M.epoxy, 0, 0.12, 0, 0.09);
    for (var i = 0; i < 4; i++) {
      gull(g, -0.975 + i * 0.65, 1.5, 1, 0.3, 0.45, 0.95);
      gull(g, -0.975 + i * 0.65, -1.5, -1, 0.3, 0.45, 0.95);
    }
    cyl(g, 0.2, 0.02, M.dark, -1.05, 0.975, 1.05);
    marking(g, 'LM358', 2.2, 0.75, '#a9adb0', 0.15, 0.98, -0.15);
    return g;
  }
  function sot23(ref, about, x, z, rot) {
    var g = component(ref, about, x, z, rot);
    part(g, 2.9, 1.0, 1.3, M.epoxy, 0, 0.1, 0, 0.09);
    gull(g, -0.95, 0.65, 1, 0.4, 0.4, 0.55);
    gull(g, 0.95, 0.65, 1, 0.4, 0.4, 0.55);
    gull(g, 0, -0.65, -1, 0.4, 0.4, 0.55);
    return g;
  }
  function sma(ref, about, x, z, rot) {                // 1N4007 in SMA, marked M7
    var g = component(ref, about, x, z, rot);
    part(g, 4.3, 2.2, 2.6, M.epoxy, 0, 0.1, 0, 0.14);
    part(g, 0.55, 2.22, 2.64, M.band, -1.45, 0.1, 0, 0.14);
    [-1, 1].forEach(function (s) {
      part(g, 0.45, 1.25, 1.5, M.tin, s * 2.3, 0.02, 0, 0.05);
      pad(g, s * 2.35, 0, 1.1, 1.9);
    });
    marking(g, 'M7', 1.6, 0.85, '#a9adb0', 0.6, 2.31, 0);
    return g;
  }
  function minimelf(ref, about, x, z, rot) {           // TZMC4V7 zener, SOD-80C glass body
    var g = component(ref, about, x, z, rot);
    cyl(g, 0.72, 2.6, M.glass, 0, 0.78, 0, true);
    cyl(g, 0.735, 0.32, M.coat, -0.85, 0.78, 0, true);
    [-1, 1].forEach(function (s) {
      cyl(g, 0.78, 0.5, M.tin, s * 1.5, 0.78, 0, true);
      pad(g, s * 1.5, 0, 0.9, 1.7);
    });
    return g;
  }
  function chip0805(ref, about, x, z, rot, kind, code) {
    var g = component(ref, about, x, z, rot);
    if (kind === 'led') {
      part(g, 2.0, 0.35, 1.25, M.ceramic, 0, 0.02, 0, 0.05);
      part(g, 1.25, 0.5, 1.1, M.lens, 0, 0.3, 0, 0.14);
      var glow = new THREE.PointLight(0xff3a2a, 0.9, 9, 2);
      glow.position.set(0, 1.6, 0);
      g.add(glow);
      g.userData.glow = glow;
    } else {
      part(g, 2.0, 0.5, 1.25, kind === 'cap' ? M.capTan : M.ceramic, 0, 0.02, 0, 0.05);
      if (kind === 'res') {
        part(g, 1.22, 0.05, 1.17, M.coat, 0, 0.5, 0, 0.02);
        marking(g, code, 1.0, 0.5, '#dfe2e0', 0, 0.565, 0);
      }
    }
    [-1, 1].forEach(function (s) {
      part(g, 0.42, kind === 'led' ? 0.4 : 0.57, 1.3, M.tin, s * 0.8, 0, 0, 0.05);
      pad(g, s * 0.95, 0, 0.9, kind === 'led' ? 1.25 : 1.4);
    });
    return g;
  }

  /* ---------- Layout ---------- */
  var HALF = Math.PI / 2;
  xh('X1', ['JST XH, power input 5–12 V', 'JST XH, вхід живлення 5–12 В'], 2, -12.1, 0, -HALF);
  xh('X2', ['JST XH, NTC temperature sensor', 'JST XH, датчик температури (NTC)'], 3, 12.1, 0, HALF);
  xh('X3', ['JST XH, fan output', 'JST XH, вихід на вентилятор'], 2, -5.3, -3.3, Math.PI);
  trimmer('R2', ['2 kΩ trimmer, sets the switch-on temperature', 'підстроювальний 2 кОм, задає температуру вмикання'], 4.2, -3.6, 0);
  msop8('DA1', ['LM358, comparator', 'LM358, компаратор'], 0.5, 2.9, 0);
  sot23('VT1', ['SI2302 MOSFET, fan switch', 'MOSFET SI2302, ключ вентилятора'], 7.6, 3.4, 0);
  sma('VD1', ['1N4007, flyback diode', '1N4007, захисний діод'], 6.0, 0.3, 0);
  minimelf('VD2', ['4.7 V zener, gate protection', 'стабілітрон 4,7 В, захист затвора'], 4.15, 2.9, 0);
  var ledPart = chip0805('VD3', ['red LED, fan-on indicator', 'червоний світлодіод, індикація роботи вентилятора'], 7.7, 5.55, 0, 'led');
  chip0805('R5', ['10 kΩ, reference divider', '10 кОм, опорний дільник'], -7.2, 1.2, 0, 'res', '1002');
  chip0805('R4', ['470 Ω, LED resistor', '470 Ом, резистор світлодіода'], -7.2, 3.2, 0, 'res', '471');
  chip0805('C2', ['10 µF, supply filter', '10 мкФ, фільтр живлення'], -7.2, 5.2, 0, 'cap');
  chip0805('R1', ['10 kΩ, NTC divider', '10 кОм, дільник NTC'], -3.4, 1.2, 0, 'res', '1002');
  chip0805('R3', ['470 Ω, gate resistor', '470 Ом, резистор затвора'], -3.4, 3.2, 0, 'res', '471');
  chip0805('C1', ['100 nF, decoupling', '100 нФ, розв’язка живлення'], -3.4, 5.2, 0, 'cap');
  chip0805('C3', ['10 µF, supply filter', '10 мкФ, фільтр живлення'], 3.5, 5.3, 0, 'cap');

  /* ---------- PCB: FR4 body and a drawn top side (solder mask, traces, silkscreen) ---------- */
  var BW = 30, BD = 12.5, BT = 1.6;
  function boardTexture() {
    var S = 64, c = document.createElement('canvas');
    c.width = BW * S; c.height = BD * S;
    var ctx = c.getContext('2d');
    function X(x) { return (x + BW / 2) * S; }
    function Y(z) { return (z + BD / 2) * S; }
    ctx.fillStyle = '#0d5a40';
    ctx.fillRect(0, 0, c.width, c.height);

    // Copper under the mask shows as a lighter green
    ctx.strokeStyle = '#167553'; ctx.lineWidth = 0.32 * S; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    [
      [[-9.5, 1.2], [-8.15, 1.2]], [[-9.5, 3.2], [-8.15, 3.2]],
      [[-8.15, 5.2], [-8.9, 5.2], [-8.9, 3.2]],
      [[-2.45, 1.2], [-1.5, 1.2], [-1.5, 0.15], [-0.475, 0.15], [-0.475, 0.6]],
      [[-2.45, 3.2], [-1.6, 3.2], [-1.6, 5.85], [-0.475, 5.85], [-0.475, 5.2]],
      [[-2.45, 5.2], [-1.6, 5.2]],
      [[1.475, 5.2], [1.475, 5.95], [2.55, 5.95], [2.55, 5.3]],
      [[5.65, 3.5], [5.65, 4.45], [6.65, 4.45]],
      [[8.55, 4.45], [9.5, 4.45]],
      [[8.4, 0.3], [9.5, 0.3]],
      [[8.65, 5.55], [9.6, 5.55], [9.6, 4.8]]
    ].forEach(function (line) {
      ctx.beginPath();
      line.forEach(function (p, i) { if (i) ctx.lineTo(X(p[0]), Y(p[1])); else ctx.moveTo(X(p[0]), Y(p[1])); });
      ctx.stroke();
    });
    [[-8.9, 4.2], [-1.6, 4.5], [5.65, 4.0]].forEach(function (v) {
      ctx.fillStyle = '#c9cdc9'; ctx.beginPath(); ctx.arc(X(v[0]), Y(v[1]), 0.34 * S, 0, 7); ctx.fill();
      ctx.fillStyle = '#083526'; ctx.beginPath(); ctx.arc(X(v[0]), Y(v[1]), 0.15 * S, 0, 7); ctx.fill();
    });

    // Silkscreen: reference designators and the document number
    ctx.fillStyle = '#eef1ee';
    ctx.font = '600 ' + Math.round(0.56 * S) + 'px "IBM Plex Mono", "DejaVu Sans Mono", Consolas, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [
      ['X1', -12.1, -4.3], ['X2', 12.1, 5.6], ['X3', -5.3, 0.1], ['R2', -1.08, -3.6],
      ['DA1', 0.5, -0.05], ['VD1', 2.6, 0.3], ['VT1', 7.6, 1.9], ['VD2', 4.15, 4.15],
      ['C3', 5.0, 5.3], ['VD3', 6.05, 5.55],
      ['R5', -5.3, 0.87], ['R1', -5.3, 1.53], ['R4', -5.3, 2.87], ['R3', -5.3, 3.53],
      ['C2', -5.3, 4.87], ['C1', -5.3, 5.53],
      ['ФКІСІТ', -12.1, 4.6], ['171.005.026', -12.1, 5.4]
    ].forEach(function (t) { ctx.fillText(t[0], X(t[1]), Y(t[2])); });

    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.repeat.set(1 / BW, 1 / BD); tex.offset.set(0.5, 0.5);   // shape coordinates are in mm
    return tex;
  }
  (function buildBoard() {
    var outline = roundedRect(BW, BD, 0.8);
    var body = new THREE.ExtrudeGeometry(outline, { depth: BT, bevelEnabled: false, curveSegments: 6 });
    body.rotateX(-Math.PI / 2);
    body.translate(0, -BT, 0);
    board.add(shade(new THREE.Mesh(body, [M.boardBottom, M.boardSide])));
    var top = new THREE.ShapeGeometry(outline, 6);
    top.rotateX(-Math.PI / 2);
    var face = new THREE.Mesh(top, new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.38, metalness: 0 }));
    face.position.y = 0.002;
    face.receiveShadow = true;
    board.add(face);
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: 0.13 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -BT - 0.02;
    floor.receiveShadow = true;
    pivot.add(floor);
  })();

  /* ---------- Motion ---------- */
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var yaw = -0.55, pitch = 0, spin = 0, dragging = false, hovering = false, moved = 0, lastX = 0, lastY = 0;
  var visible = true, running = false, lastT = 0, assembleFrom = null;

  // Parts are placed left to right, like a pick-and-place pass
  comps.slice().sort(function (a, b) { return a.position.x - b.position.x; })
    .forEach(function (g, i) { g.userData.delay = 0.25 + i * 0.07; });

  function draw(now) {
    var t = now / 1000, dt = Math.min(0.05, t - lastT || 0);
    lastT = t;
    if (!still) {
      if (assembleFrom === null) assembleFrom = t;
      comps.forEach(function (g) {
        var p = Math.max(0, Math.min(1, (t - assembleFrom - g.userData.delay) / 0.55));
        g.visible = p > 0;
        g.position.y = Math.pow(1 - p, 3) * 16;
      });
      if (!dragging) {
        if (!hovering) yaw += 0.2 * dt;
        yaw += spin * dt;
        spin *= Math.pow(0.04, dt);
      }
      var pulse = 0.75 + 0.45 * Math.sin(t * 2.6);
      M.lens.emissiveIntensity = 1.3 * pulse;
      ledPart.userData.glow.intensity = 0.9 * pulse;
    }
    pivot.rotation.y = yaw;
    pivot.rotation.x = pitch;
    renderer.render(scene, camera);
  }
  function loop(now) {
    if (!visible || still || document.hidden) { running = false; return; }
    draw(now);
    requestAnimationFrame(loop);
  }
  function start() { if (!running && !still) { running = true; requestAnimationFrame(loop); } }
  function redraw() { if (still || !running) draw(performance.now()); }

  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Pull the camera back until a sphere around the board fits both ways
    var r = 15, v = THREE.MathUtils.degToRad(camera.fov) / 2, hz = Math.atan(Math.tan(v) * camera.aspect);
    var dist = Math.max(r / Math.sin(v), r / Math.sin(hz)), tilt = THREE.MathUtils.degToRad(34);
    camera.position.set(0, 3 + Math.sin(tilt) * dist, Math.cos(tilt) * dist);
    camera.lookAt(0, 3, 0);
    camera.updateProjectionMatrix();
    redraw();
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);
  resize();

  /* ---------- Pointer: drag to rotate, point at a part to read what it is ---------- */
  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function identify(e) {
    var box = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - box.left) / box.width) * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    var hit = ray.intersectObjects(comps, true)[0], node = hit && hit.object;
    while (node && !(node.userData && node.userData.ref)) node = node.parent;
    hovering = !!node;
    if (!node || !tip) { if (tip) tip.hidden = true; return; }
    tip.textContent = node.userData.ref + ' · ' + node.userData.about[document.documentElement.lang === 'uk' ? 1 : 0];
    tip.hidden = false;
    var hb = holder.getBoundingClientRect();
    var left = Math.min(Math.max(4, e.clientX - hb.left + 14), hb.width - tip.offsetWidth - 4);
    tip.style.left = left + 'px';
    tip.style.top = Math.max(0, e.clientY - hb.top - 34) + 'px';
  }
  canvas.addEventListener('pointerdown', function (e) {
    dragging = true; moved = 0; spin = 0; lastX = e.clientX; lastY = e.clientY;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!dragging) { identify(e); return; }
    var dx = e.clientX - lastX, dy = e.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    yaw += dx * 0.01;
    spin = dx * 0.6;
    pitch = Math.max(-0.2, Math.min(0.75, pitch + dy * 0.006));
    lastX = e.clientX; lastY = e.clientY;
    if (tip) tip.hidden = true;
    redraw();
  });
  canvas.addEventListener('pointerup', function (e) { dragging = false; if (moved < 6) identify(e); });
  canvas.addEventListener('pointercancel', function () { dragging = false; });
  canvas.addEventListener('pointerleave', function () { hovering = false; if (tip) tip.hidden = true; });

  /* Stop rendering while the board is off screen or the tab is hidden */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) start(); }).observe(canvas);
  }
  document.addEventListener('visibilitychange', start);
  start();
})();
