// Regenerate graphify-out/graph-3d.html from graphify-out/graph.json.
// Usage: node scripts/make-brain3d.mjs [repo-root]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(process.argv[2] || resolve(here, '..'));
const OUT = resolve(root, 'graphify-out/graph-3d.html');
const g = JSON.parse(readFileSync(resolve(root, 'graphify-out/graph.json'), 'utf8'));

const byId = new Map(g.nodes.map(n => [n.id, n]));
const deg = new Map(g.nodes.map(n => [n.id, 0]));
const pair = new Map();
for (const l of (g.links || [])) {
  if (l.source === l.target) continue;
  deg.set(l.source, (deg.get(l.source) || 0) + 1);
  deg.set(l.target, (deg.get(l.target) || 0) + 1);
  const k = [l.source, l.target].sort().join('::');
  if (!pair.has(k)) pair.set(k, []);
  pair.get(k).push(l);
}
const maxDeg = Math.max(1, ...deg.values());

const nodes = g.nodes.map(n => ({
  id: n.id, label: n.label, file: n.source_file, loc: n.source_location || '',
  kind: n._callable ? 'symbol' : 'file', cls: !!n._callable_class,
  com: n.community, comName: n.community_name || ('Community ' + n.community),
  deg: deg.get(n.id) || 0,
  size: +(0.9 + 4.2 * Math.pow((deg.get(n.id) || 0) / maxDeg, 0.55)).toFixed(3),
}));
const edges = [...pair.entries()].map(([k, ls]) => {
  const [a, b] = k.split('::');
  return {
    s: a, t: b,
    rel: [...new Set(ls.map(l => l.relation))],
    ctx: [...new Set(ls.map(l => l.context).filter(Boolean))],
    conf: ls.some(l => l.confidence === 'EXTRACTED') ? 'EXTRACTED' : (ls[0].confidence || 'INFERRED'),
    n: ls.length,
  };
});
const files = [...new Set(g.nodes.map(n => n.source_file))].sort();
const comNames = [...new Set(g.nodes.map(n => n.community))].sort((a, b) => a - b).map(c => {
  const m = g.nodes.filter(n => n.community === c);
  return { id: c, name: m[0].community_name || ('Community ' + c), count: m.length };
});
const DATA = JSON.stringify({ nodes, edges, files, comNames, maxDeg });

const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>notdore — Second Brain 3D</title>
<style>
  :root{ --bg:#0b0d17; --panel:rgba(18,21,36,.88); --border:#2a2f4a; --text:#e8ecf8;
    --muted:#8b93b8; --accent:#7c9cff; --good:#4ade80; --warn:#fbbf24; }
  *{box-sizing:border-box}
  html,body{margin:0;height:100%;overflow:hidden;background:var(--bg);color:var(--text);
    font:13px/1.45 "Segoe UI",system-ui,-apple-system,sans-serif}
  #c{position:fixed;inset:0;display:block;cursor:grab}
  .panel{position:fixed;background:var(--panel);border:1px solid var(--border);border-radius:12px;
    backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 10px 40px rgba(0,0,0,.5)}
  #left{top:16px;left:16px;width:290px;max-height:calc(100% - 32px);display:flex;flex-direction:column;overflow:hidden;z-index:5;
    background:linear-gradient(180deg, rgba(18,21,36,.92), rgba(18,21,36,.78));
    border-radius:14px}
  #left header{padding:12px 14px;border-bottom:1px solid var(--border)}
  #left h1{margin:0 0 2px;font-size:14px}
  #left .sub{color:var(--muted);font-size:11.5px}
  .scroll{overflow-y:auto;padding:10px 12px;flex:1}
  .scroll::-webkit-scrollbar{width:8px}.scroll::-webkit-scrollbar-thumb{background:#2c3352;border-radius:4px}
  label.f{display:block;margin:10px 0 4px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px}
  input[type=text]{width:100%;padding:7px 9px;border-radius:8px;border:1px solid var(--border);
    background:#0f1220;color:var(--text);outline:none;font:inherit}
  input[type=text]:focus{border-color:var(--accent)}
  .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  button{background:#161a2e;border:1px solid var(--border);color:var(--text);border-radius:8px;
    padding:6px 10px;cursor:pointer;font:inherit;font-size:12px}
  button:hover{border-color:var(--accent);color:#fff}
  button.on{background:var(--accent);border-color:var(--accent);color:#0b0d17;font-weight:600}
  .chips{display:flex;flex-wrap:wrap;gap:5px;max-height:180px;overflow-y:auto;padding-right:2px}
  .chip{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:20px;
    border:1px solid var(--border);background:#12162a;font-size:11.5px;cursor:pointer;user-select:none}
  .chip .dot{width:7px;height:7px;border-radius:50%;flex:none}
  .chip.off{opacity:.3}
  .stat{display:flex;justify-content:space-between;padding:2px 0;color:var(--muted);font-size:11.5px}
  .stat b{color:var(--text);font-weight:600}
  #hud{left:16px;bottom:16px;padding:8px 12px;font-size:11.5px;color:var(--muted);display:flex;gap:14px;flex-wrap:wrap;z-index:5}
  #hud b{color:var(--text)}
  #tip{position:fixed;pointer-events:none;padding:6px 9px;border-radius:8px;font-size:11.5px;
    background:rgba(10,12,22,.95);border:1px solid var(--border);display:none;z-index:20;max-width:280px}
  #tip .t{font-weight:600;margin-bottom:2px}#tip .m{color:var(--muted)}
  #info{top:16px;right:16px;width:350px;max-height:calc(100% - 32px);display:none;flex-direction:column;overflow:hidden;z-index:5}
  #info.open{display:flex}
  #info header{padding:12px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
  #info h2{margin:0;font-size:14px;word-break:break-word}
  #info .x{background:none;border:none;color:var(--muted);font-size:18px;line-height:1;padding:2px 4px;cursor:pointer}
  #info .x:hover{color:#fff}
  #info .body{overflow-y:auto;padding:12px 14px}
  #info .kv{display:flex;gap:8px;margin:3px 0;font-size:12px}
  #info .kv span:first-child{color:var(--muted);min-width:78px;flex:none}
  #info .kv span:last-child{word-break:break-word}
  #info .badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;
    border:1px solid var(--border);background:#12162a;margin:2px 4px 2px 0}
  #info .badge.EX{color:var(--good);border-color:#1f4d33}
  #info .badge.INF{color:var(--warn);border-color:#4d3d1f}
  #info ul{margin:4px 0 4px 16px;padding:0}
  #info li{margin:4px 0;font-size:12px}
  #info .path{color:var(--accent);cursor:pointer}
  #info .path:hover{text-decoration:underline}
  #info .rel{color:#c9d2f0}
  #loading{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
    background:var(--bg);z-index:50;flex-direction:column;gap:14px}
  .spin{width:38px;height:38px;border:3px solid #232a48;border-top-color:var(--accent);border-radius:50%;animation:sp 1s linear infinite}
  @keyframes sp{to{transform:rotate(360deg)}}
  #err{position:fixed;inset:auto 20px 20px 20px;display:none;padding:12px 14px;background:#3a1020;
    border:1px solid #6b1f3a;border-radius:10px;z-index:60;font-size:12.5px;max-height:40%;overflow:auto}
  @media (max-width:760px){#left{width:240px}#info{width:290px}}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="loading"><div class="spin"></div><div>Đang dựng graph…</div></div>
<div id="err"></div>

<div class="panel" id="left">
  <header>
    <h1>notdore — Second Brain 3D</h1>
    <div class="sub" id="subtitle">…</div>
  </header>
  <div class="scroll">
    <label class="f">Tìm kiếm</label>
    <input type="text" id="q" placeholder="tên hàm, file, community…">
    <div class="row" style="margin-top:8px">
      <button id="fit">Vừa khung</button>
      <button id="orbit" class="on">Tự xoay</button>
      <button id="labels" class="on">Nhãn</button>
    </div>
    <label class="f">Hiển thị</label>
    <div class="row">
      <button id="mode-all" class="on">Tất cả</button>
      <button id="mode-symbol">Chỉ symbol</button>
      <button id="mode-file">Chỉ file</button>
    </div>
    <label class="f">Độ tin cậy</label>
    <div class="row">
      <button class="conf on" data-c="ALL">ALL</button>
      <button class="conf" data-c="EXTRACTED">EXTRACTED</button>
      <button class="conf" data-c="INFERRED">INFERRED</button>
    </div>
    <label class="f">Community</label>
    <div class="chips" id="chips"></div>
    <label class="f">File nguồn</label>
    <div class="chips" id="filechips"></div>
    <label class="f">Thống kê</label>
    <div id="stats"></div>
  </div>
</div>

<div class="panel" id="hud">
  <span>Kéo: xoay 360°</span><span>Cuộn: zoom</span><span>Phải: pan</span>
  <span>Click: chi tiết</span><span><b id="hudNodes">0</b> node · <b id="hudEdges">0</b> edge</span>
</div>

<div id="tip"></div>

<div class="panel" id="info">
  <header><h2 id="infoTitle"></h2><button class="x" id="infoClose">×</button></header>
  <div class="body" id="infoBody"></div>
</div>

<script>
window.DATA = ${DATA};
</script>
<script src="./three.min.js"></script>
<script src="./OrbitControls.umd.js"></script>
<script>
(function () {
  var errEl = document.getElementById('err');
  function fail(msg, extra) {
    errEl.style.display = 'block';
    errEl.innerHTML = msg + (extra ? '<pre style="white-space:pre-wrap;font-size:11px;margin:6px 0 0">' +
      String(extra).slice(0, 1200) + '</pre>' : '');
    document.getElementById('loading').style.display = 'none';
  }
  if (typeof THREE === 'undefined') { fail('<b>Không tải được three.js.</b> Cần internet lần đầu mở file.'); return; }
  if (!THREE.OrbitControls) { fail('<b>Thiếu OrbitControls.</b>'); return; }

  try {
    var DATA = window.DATA;
    var PALETTE = ['#5eead4','#f87171','#4ade80','#fb923c','#60a5fa','#c084fc','#facc15',
      '#a3e635','#38bdf8','#f472b6','#fdba74','#94a3b8','#2dd4bf','#e879f9','#fca5a5',
      '#86efac','#fcd34d','#7dd3fc','#f9a8d4','#d8b4fe','#bef264','#67e8f9','#fda4af','#c7d2fe','#fdba74'];
    var comColor = function (c) { return PALETTE[((c % PALETTE.length) + PALETTE.length) % PALETTE.length]; };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g,
      function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

    var byId = new Map(DATA.nodes.map(function (n) { return [n.id, n]; }));
    var maxDeg = DATA.maxDeg;
    var adjList = new Map(DATA.nodes.map(function (n) { return [n.id, []]; }));
    DATA.edges.forEach(function (e) { adjList.get(e.s).push(e.t); adjList.get(e.t).push(e.s); });

    var renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0d17);
    scene.fog = new THREE.FogExp2(0x0b0d17, 0.0021);
    var camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.5, 5000);
    camera.position.set(0, 120, 260);
    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.06;
    controls.autoRotate = true; controls.autoRotateSpeed = 0.5;
    controls.minDistance = 4; controls.maxDistance = 2000;
    controls.addEventListener('start', function () {
      // dragging means the user took over; stop spinning so the view stays put
      if (controls.autoRotate) { controls.autoRotate = false;
        document.getElementById('orbit').classList.remove('on'); }
    });
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    var key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(80, 140, 90); scene.add(key);
    var fill = new THREE.DirectionalLight(0x88aaff, 0.35); fill.position.set(-120, -60, -80); scene.add(fill);

    function resize() {
      camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', resize); resize();

    var comIds = Array.from(new Set(DATA.nodes.map(function (n) { return n.com; }))).sort(function (a, b) { return a - b; });
    var COMS = Math.max(1, comIds.length);
    var pos = new Map();
    comIds.forEach(function (c, i) {
      var ang = (i / COMS) * Math.PI * 2;
      var members = DATA.nodes.filter(function (n) { return n.com === c; });
      var R = 72 + 8 * Math.sqrt(members.length);
      members.forEach(function (n, j) {
        var a2 = ang + (j / Math.max(1, members.length)) * 0.8;
        pos.set(n.id, new THREE.Vector3(
          Math.cos(a2) * R + (Math.random() - .5) * 10,
          (Math.random() - .5) * 22,
          Math.sin(a2) * R + (Math.random() - .5) * 10));
      });
    });
    var ids = DATA.nodes.map(function (n) { return n.id; });
    var want = 13;
    for (var it = 0; it < 150; it++) {
      var k = 1 - it / 150;
      var disp = new Map(ids.map(function (id) { return [id, new THREE.Vector3()]; }));
      // same-community cohesion: keeps clusters readable, prevents the graph
      // from drifting into a sparse blob where everything is a hairball.
      comIds.forEach(function (c) {
        var members = DATA.nodes.filter(function (n) { return n.com === c; });
        var ctr = new THREE.Vector3();
        members.forEach(function (n) { ctr.add(pos.get(n.id)); });
        ctr.divideScalar(Math.max(1, members.length));
        members.forEach(function (n) {
          var d = new THREE.Vector3().subVectors(pos.get(n.id), ctr);
          d.multiplyScalar(0.012);
          disp.get(n.id).sub(d);
        });
      });
      for (var i = 0; i < ids.length; i++) {
        for (var j = i + 1; j < ids.length; j++) {
          var a = pos.get(ids[i]), b = pos.get(ids[j]);
          var d = new THREE.Vector3().subVectors(a, b);
          var dist = Math.max(1e-3, d.length());
          if (dist > 120) continue;
          d.divideScalar(dist * dist);
          disp.get(ids[i]).add(d); disp.get(ids[j]).sub(d);
        }
      }
      DATA.edges.forEach(function (e) {
        var a = pos.get(e.s), b = pos.get(e.t);
        var d = new THREE.Vector3().subVectors(a, b);
        var dist = Math.max(1e-3, d.length());
        d.normalize().multiplyScalar((dist - want) * 0.01);
        disp.get(e.s).sub(d); disp.get(e.t).add(d);
      });
      ids.forEach(function (id) {
        var d = disp.get(id); d.clampLength(0, 4 * k + 0.3);
        pos.get(id).add(d);
      });
    }
    var centroids = new Map(comIds.map(function (c) {
      var vs = DATA.nodes.filter(function (n) { return n.com === c; }).map(function (n) { return pos.get(n.id); });
      var v = new THREE.Vector3(); vs.forEach(function (x) { v.add(x); });
      v.divideScalar(Math.max(1, vs.length)); return [c, v];
    }));
    DATA.nodes.forEach(function (n) {
      var t = Math.pow(n.deg / maxDeg, 1.6);
      pos.get(n.id).lerp(centroids.get(n.com), 0.2 + 0.7 * t);
    });

    var group = new THREE.Group(); scene.add(group);
    var sphereGeo = new THREE.SphereGeometry(1, 18, 14);
    var pickList = [];
    var debug = { pos: pos, ids: ids, maxDeg: maxDeg, comIds: comIds, centroids: centroids,
      camera: camera, controls: controls, THREE: THREE };
    window.__dbg = debug;
    window.__labels = null;
    DATA.nodes.forEach(function (n) {
      var col = new THREE.Color(n.kind === 'file' ? '#f2f5ff' : comColor(n.com));
      var mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.32, metalness: 0.12,
        emissive: col, emissiveIntensity: n.kind === 'file' ? 0.25 : 0.12 });
      var m = new THREE.Mesh(sphereGeo, mat);
      m.position.copy(pos.get(n.id)); m.scale.setScalar(n.size);
      m.userData = { id: n.id }; m.renderOrder = 2;
      group.add(m); pickList.push(m); n._mesh = m;
    });
    var lineGroup = new THREE.Group(); group.add(lineGroup);
    var edgeIndex = new Map();
    DATA.edges.forEach(function (e) {
      var g = new THREE.BufferGeometry().setFromPoints([pos.get(e.s), pos.get(e.t)]);
      var isInf = e.conf !== 'EXTRACTED';
      var mat = new THREE.LineBasicMaterial({ color: isInf ? 0xfbbf24 : 0x6f7fb8,
        transparent: true, opacity: isInf ? 0.34 : 0.13,
        blending: THREE.AdditiveBlending, depthWrite: false });
      var l = new THREE.Line(g, mat); lineGroup.add(l);
      edgeIndex.set(e.s + '::' + e.t, { mesh: l, edge: e });
    });
    var haloGroup = new THREE.Group(); group.add(haloGroup);
    // Nhãn community nổi trên mỗi cụm — "bộ não" chỉ đọc được khi biết từng cụm là gì.
    // fog:false là bắt buộc: FogExp2 ở khoảng cách fit (~870) làm sprite mờ gần như hết.
    function makeTextSprite(text, color, scale) {
      var fs = 46, pad = 16;
      var c = document.createElement('canvas');
      var cx0 = c.getContext('2d');
      cx0.font = '600 ' + fs + 'px "Segoe UI", system-ui, sans-serif';
      c.width = Math.ceil(cx0.measureText(text).width) + pad * 2;
      c.height = fs + pad * 2;
      var x = c.getContext('2d');
      x.fillStyle = 'rgba(10,13,24,0.82)';
      var rr = 16; x.beginPath();
      x.moveTo(rr, 0); x.arcTo(c.width, 0, c.width, c.height, rr);
      x.arcTo(c.width, c.height, 0, c.height, rr);
      x.arcTo(0, c.height, 0, 0, rr); x.arcTo(0, 0, c.width, 0, rr);
      x.closePath(); x.fill();
      x.font = '600 ' + fs + 'px "Segoe UI", system-ui, sans-serif';
      x.fillStyle = color || '#e8ecf8'; x.textBaseline = 'middle';
      x.fillText(text, pad, c.height / 2 + 2);
      var tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
      var sc = scale || 0.055;
      sp.scale.set(c.width * sc, c.height * sc, 1);
      sp.renderOrder = 10;
      return sp;
    }
    comIds.forEach(function (c) {
      var ctr = centroids.get(c); var r = 0;
      DATA.nodes.filter(function (n) { return n.com === c; })
        .forEach(function (n) { r = Math.max(r, pos.get(n.id).distanceTo(ctr)); });
      r = Math.max(18, r + 12);
      var pts = [];
      for (var i = 0; i < 90; i++) {
        var t = (i / 90) * Math.PI * 2;
        pts.push(new THREE.Vector3(ctr.x + Math.cos(t) * r, ctr.y, ctr.z + Math.sin(t) * r));
      }
      var ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: new THREE.Color(comColor(c)), transparent: true, opacity: 0.15, depthWrite: false }));
      haloGroup.add(ring);
      var dot = new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 10),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(comColor(c)), transparent: true, opacity: 0.9 }));
      dot.position.set(ctr.x, ctr.y + r * 0.6, ctr.z); haloGroup.add(dot);
      var cn = DATA.comNames.filter(function (x) { return x.id === c; })[0];
      var cl = makeTextSprite((cn ? cn.name : ('Community ' + c)) + '  ·  ' +
        DATA.nodes.filter(function (n) { return n.com === c; }).length, comColor(c), 0.15);
      cl.position.set(ctr.x, ctr.y + r * 0.6 + 8, ctr.z);
      haloGroup.add(cl);
    });

    var labelGroup = new THREE.Group(); group.add(labelGroup);
    var labelSprites = new Map();
    DATA.nodes.forEach(function (n) {
      var c = document.createElement('canvas'); var ctx = c.getContext('2d');
      var fs = 44, pad = 14;
      ctx.font = '600 ' + fs + 'px "Segoe UI", system-ui, sans-serif';
      c.width = Math.ceil(ctx.measureText(n.label).width) + pad * 2; c.height = fs + pad * 2;
      var x = c.getContext('2d');
      x.fillStyle = 'rgba(10,13,24,0.72)';
      var r = 16; x.beginPath();
      x.moveTo(r, 0); x.arcTo(c.width, 0, c.width, c.height, r); x.arcTo(c.width, c.height, 0, c.height, r);
      x.arcTo(0, c.height, 0, 0, r); x.arcTo(0, 0, c.width, 0, r); x.closePath(); x.fill();
      x.font = '600 ' + fs + 'px "Segoe UI", system-ui, sans-serif';
      x.fillStyle = n.kind === 'file' ? '#ffffff' : '#e8ecf8'; x.textBaseline = 'middle';
      x.fillText(n.label, pad, c.height / 2 + 2);
      var tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
      var sc = 0.075; sp.scale.set(c.width * sc, c.height * sc, 1);
      sp.position.copy(pos.get(n.id)); sp.position.y += n.size + 1.6;
      sp.renderOrder = 10; sp.visible = false; sp.userData = { id: n.id };
      labelGroup.add(sp); labelSprites.set(n.id, sp);
    });
    window.__labels = labelSprites;

    var ray = new THREE.Raycaster(); var mouse = new THREE.Vector2();
    var tip = document.getElementById('tip'); var hovered = null, selected = null;
    function pick(ev) {
      var r = renderer.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(mouse, camera);
      var hits = ray.intersectObjects(pickList, false);
      return hits.length ? hits[0].object : null;
    }
    var downAt = 0, downX = 0, downY = 0;
    renderer.domElement.addEventListener('pointermove', function (ev) {
      var m = pick(ev);
      if (m !== hovered) {
        hovered = m;
        if (m) {
          var n = byId.get(m.userData.id);
          tip.innerHTML = '<div class="t">' + esc(n.label) + '</div>' +
            '<div class="m">' + esc(n.file) + ' · ' + esc(n.loc) + '</div>' +
            '<div class="m">' + esc(n.comName) + ' · ' + n.deg + ' liên kết</div>';
          tip.style.display = 'block';
        } else tip.style.display = 'none';
      }
      if (m) { tip.style.left = (ev.clientX + 14) + 'px'; tip.style.top = (ev.clientY + 12) + 'px'; }
      renderer.domElement.style.cursor = m ? 'pointer' : 'grab';
    });
    renderer.domElement.addEventListener('pointerdown', function (ev) { downAt = Date.now(); downX = ev.clientX; downY = ev.clientY; });
    renderer.domElement.addEventListener('pointerup', function (ev) {
      if (Date.now() - downAt < 350 && Math.hypot(ev.clientX - downX, ev.clientY - downY) < 5) {
        var m = pick(ev); if (m) select(m.userData.id); else clearSelect();
      }
    });

    function refreshLabels() {
      var camDist = camera.position.distanceTo(controls.target);
      // graph spans ~355 units; at the fit distance (~250) name everything with
      // degree >= 8 plus every file node. Zooming in names all 367.
      var zoomT = Math.max(0, Math.min(1, (280 - camDist) / 220));
      var threshold = Math.ceil((1 - zoomT) * 8);
      var showAll = document.getElementById('labels').classList.contains('on');
      DATA.nodes.forEach(function (n) {
        var sp = labelSprites.get(n.id); var vis = false;
        if (showAll) vis = n.id === selected || n.deg >= threshold || n.kind === 'file';
        if (selected && (n.id === selected || adjList.get(selected).indexOf(n.id) >= 0)) vis = true;
        sp.visible = vis;
        sp.material.opacity = (n.id === selected) ? 1 : (0.6 + 0.4 * Math.min(1, n.deg / 12));
      });
    }

    var info = document.getElementById('info');
    function select(id) {
      selected = id; var n = byId.get(id);
      var rels = [];
      DATA.edges.forEach(function (e) {
        if (e.s === id) rels.push({ other: e.t, e: e }); else if (e.t === id) rels.push({ other: e.s, e: e });
      });
      rels.sort(function (a, b) { return b.e.n - a.e.n; });
      var byCom = new Map();
      rels.forEach(function (r) { var o = byId.get(r.other); byCom.set(o.comName, (byCom.get(o.comName) || 0) + 1); });
      var badges = Array.from(byCom.entries()).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5)
        .map(function (kv) { return '<span class="badge">' + esc(kv[0]) + ' ×' + kv[1] + '</span>'; }).join('');
      document.getElementById('infoTitle').textContent = n.label;
      var h = '';
      h += '<div class="kv"><span>File</span><span>' + esc(n.file) + '</span></div>';
      h += '<div class="kv"><span>Vị trí</span><span>' + esc(n.loc || '—') + '</span></div>';
      h += '<div class="kv"><span>Loại</span><span>' + (n.kind === 'file' ? 'file/module' : (n.cls ? 'class' : 'symbol')) + '</span></div>';
      h += '<div class="kv"><span>Community</span><span>' + esc(n.comName) + '</span></div>';
      h += '<div class="kv"><span>Bậc</span><span>' + n.deg + ' / ' + maxDeg + '</span></div>';
      h += '<div class="kv"><span>EXTRACTED</span><span>' + rels.filter(function (r) { return r.e.conf === 'EXTRACTED'; }).length + ' edge</span></div>';
      h += '<div class="kv"><span>INFERRED</span><span>' + rels.filter(function (r) { return r.e.conf !== 'EXTRACTED'; }).length + ' edge</span></div>';
      h += '<div style="margin-top:6px">' + badges + '</div>';
      h += '<label class="f" style="margin-top:12px">Liên kết (' + rels.length + ')</label>';
      if (!rels.length) h += '<div class="kv"><span></span><span style="color:var(--muted)">Cô lập.</span></div>';
      else {
        h += '<ul>';
        rels.slice(0, 80).forEach(function (r) {
          var o = byId.get(r.other);
          h += '<li><span class="path" data-id="' + esc(o.id) + '">' + esc(o.label) + '</span>' +
            ' <span style="color:var(--muted)">' + esc(o.file) + ' ' + esc(o.loc) + '</span><br>' +
            '<span class="rel">' + esc(r.e.rel.join(', ')) + '</span>' +
            (r.e.ctx.length ? ' <span style="color:var(--muted)">· ' + esc(r.e.ctx.join(', ')) + '</span>' : '') +
            ' <span class="badge ' + (r.e.conf === 'EXTRACTED' ? 'EX' : 'INF') + '">' + esc(r.e.conf) + '</span></li>';
        });
        if (rels.length > 80) h += '<li style="color:var(--muted)">… +' + (rels.length - 80) + ' nữa</li>';
        h += '</ul>';
      }
      document.getElementById('infoBody').innerHTML = h;
      info.classList.add('open');
      var nb = new Set(adjList.get(id));
      DATA.nodes.forEach(function (m) {
        var on = m.id === id || nb.has(m.id);
        m._mesh.material.emissiveIntensity = on ? 0.85 : 0.10;
        m._mesh.material.transparent = true; m._mesh.material.opacity = on ? 1 : 0.18;
      });
      edgeIndex.forEach(function (o) {
        var on = o.edge.s === id || o.edge.t === id;
        o.mesh.material.opacity = on ? 0.85 : 0.05;
      });
      refreshLabels();
    }
    function clearSelect() {
      selected = null; info.classList.remove('open');
      DATA.nodes.forEach(function (m) {
        m._mesh.material.emissiveIntensity = m.kind === 'file' ? 0.25 : 0.12;
        m._mesh.material.transparent = false; m._mesh.material.opacity = 1;
      });
      edgeIndex.forEach(function (o) { o.mesh.material.opacity = o.edge.conf === 'EXTRACTED' ? 0.13 : 0.34; });
      refreshLabels();
    }
    document.getElementById('infoClose').onclick = clearSelect;
    document.getElementById('infoBody').addEventListener('click', function (ev) {
      var t = ev.target.closest ? ev.target.closest('[data-id]') : null;
      if (t) select(t.getAttribute('data-id'));
    });

    var state = { q: '', coms: new Set(comIds), files: new Set(DATA.files), mode: 'ALL', conf: 'ALL' };
    var chipsEl = document.getElementById('chips');
    DATA.comNames.forEach(function (c) {
      var el = document.createElement('span'); el.className = 'chip';
      el.innerHTML = '<span class="dot" style="background:' + comColor(c.id) + '"></span>' +
        esc(c.name) + ' <span style="color:var(--muted)">' + c.count + '</span>';
      el.onclick = function () { if (state.coms.has(c.id)) state.coms.delete(c.id); else state.coms.add(c.id); el.classList.toggle('off'); apply(); };
      chipsEl.appendChild(el);
    });
    var fileEl = document.getElementById('filechips');
    DATA.files.forEach(function (f) {
      var el = document.createElement('span'); el.className = 'chip'; el.textContent = f;
      el.onclick = function () { if (state.files.has(f)) state.files.delete(f); else state.files.add(f); el.classList.toggle('off'); apply(); };
      fileEl.appendChild(el);
    });
    document.getElementById('q').oninput = function (ev) { state.q = ev.target.value.trim().toLowerCase(); apply(); };

    function apply() {
      var q = state.q, sn = 0, se = 0;
      DATA.nodes.forEach(function (n) {
        var ok = state.coms.has(n.com) && state.files.has(n.file);
        if (state.mode === 'symbol') ok = ok && n.kind !== 'file';
        if (state.mode === 'file') ok = ok && n.kind === 'file';
        if (q) ok = ok && (n.label.toLowerCase().indexOf(q) >= 0 ||
          (n.file || '').toLowerCase().indexOf(q) >= 0 ||
          (n.comName || '').toLowerCase().indexOf(q) >= 0);
        n._mesh.visible = ok; if (ok) sn++;
      });
      edgeIndex.forEach(function (o) {
        var a = byId.get(o.edge.s), b = byId.get(o.edge.t);
        var vis = a._mesh.visible && b._mesh.visible && (state.conf === 'ALL' || o.edge.conf === state.conf);
        o.mesh.visible = vis; if (vis) se++;
      });
      document.getElementById('hudNodes').textContent = sn;
      document.getElementById('hudEdges').textContent = se;
      document.getElementById('subtitle').textContent = sn + ' / ' + DATA.nodes.length + ' node · ' + se + ' / ' + DATA.edges.length + ' edge';
      refreshLabels();
    }
    function setMode(m) {
      state.mode = m;
      ['all', 'symbol', 'file'].forEach(function (k) { document.getElementById('mode-' + k).classList.toggle('on', k === m); });
      apply();
    }
    document.getElementById('mode-all').onclick = function () { setMode('ALL'); };
    document.getElementById('mode-symbol').onclick = function () { setMode('symbol'); };
    document.getElementById('mode-file').onclick = function () { setMode('file'); };
    Array.prototype.forEach.call(document.querySelectorAll('.conf'), function (b) {
      b.onclick = function () {
        state.conf = b.getAttribute('data-c');
        Array.prototype.forEach.call(document.querySelectorAll('.conf'), function (x) { x.classList.toggle('on', x === b); });
        apply();
      };
    });
    document.getElementById('labels').onclick = function (ev) { ev.target.classList.toggle('on'); refreshLabels(); };
    document.getElementById('orbit').onclick = function (ev) {
      controls.autoRotate = !controls.autoRotate; ev.target.classList.toggle('on', controls.autoRotate);
    };
    document.getElementById('fit').onclick = function () {
      var box = new THREE.Box3().setFromObject(group);
      var c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
      var r = Math.max(s.x, s.y, s.z) * 0.5;
      var halfV = Math.tan((camera.fov * Math.PI / 180) / 2);
      var halfH = halfV * camera.aspect;
      // sphere bound: projected radius of a sphere radius r is r/sin(halfAngle)
      var d = (r / Math.sin(Math.min(halfV, halfH))) * 1.02;
      var dir = new THREE.Vector3().subVectors(camera.position, controls.target);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0.3, 1);
      dir.normalize().multiplyScalar(d); dir.y = Math.max(dir.y, r * 0.18);
      camera.position.copy(c).add(dir); controls.target.copy(c); controls.update();
      if (window.__dbg) window.__dbg.fits = { r: +r.toFixed(1), d: +d.toFixed(1) };
    };
    controls.addEventListener('change', refreshLabels);

    document.getElementById('stats').innerHTML = [
      ['Node', DATA.nodes.length], ['Edge', DATA.edges.length], ['Community', DATA.comNames.length],
      ['File', DATA.files.length],
      ['EXTRACTED', DATA.edges.filter(function (e) { return e.conf === 'EXTRACTED'; }).length],
      ['INFERRED', DATA.edges.filter(function (e) { return e.conf !== 'EXTRACTED'; }).length],
      ['Bậc cao nhất', DATA.maxDeg],
    ].map(function (kv) { return '<div class="stat"><span>' + kv[0] + '</span><b>' + kv[1] + '</b></div>'; }).join('');

    apply();
    document.getElementById('fit').click();
    document.getElementById('loading').style.display = 'none';
    (function tick() {
      requestAnimationFrame(tick);
      haloGroup.rotation.y += 0.0006;
      controls.update();
      renderer.render(scene, camera);
    })();
  } catch (e) {
    fail('<b>Lỗi khởi tạo:</b> ' + (e && e.message ? e.message : e), e && e.stack);
  }
})();
</script>
</body>
</html>
`;

writeFileSync(OUT, html);
console.log('wrote', OUT, (html.length / 1024).toFixed(0) + 'KB');
