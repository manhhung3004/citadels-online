// Thành phố 3D (Three.js): mỗi người chơi là 1 khu đất quanh bàn tròn,
// mỗi công trình là 1 tòa nhà low-poly dựng bằng code (không cần file mô hình).
// API: window.City3D = { supported, mount(slotEl), update(view, opts) }
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (_) { return false; }
}

// ---------- Vật liệu & hình khối dùng chung ----------
const ROOF = { yellow: 0xd9a520, blue: 0x3a72c8, green: 0x2f8f50, red: 0xb83a2a, purple: 0x7d4bc4 };
const matCache = new Map();
function mat(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, flatShading: true, ...extra }));
  }
  return matCache.get(key);
}
const M = {
  stone: () => mat(0xd9ccb0), stoneDk: () => mat(0x8d8a86), wood: () => mat(0x8a5a32), woodDk: () => mat(0x5a3a22),
  white: () => mat(0xf2ead8), dark: () => mat(0x2b2622), gold: () => mat(0xe8b54f, { metalness: 0.6, roughness: 0.35 }),
  water: () => mat(0x2f6f9a, { roughness: 0.3, metalness: 0.1 }), grass: () => mat(0x5d8a3e),
  glow: (c) => mat(c, { emissive: c, emissiveIntensity: 1.4 }),
};

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: (seg) => new THREE.CylinderGeometry(0.5, 0.5, 1, seg),
  cone: (seg) => new THREE.ConeGeometry(0.5, 1, seg),
  dome: new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  sphere: new THREE.SphereGeometry(0.5, 14, 10),
};
G.box.translate(0, 0.5, 0);
const cylCache = {}; const coneCache = {};
const cylGeo = (seg = 12, taper = 1) => {
  const k = seg + ':' + taper;
  if (!cylCache[k]) { cylCache[k] = new THREE.CylinderGeometry(0.5 * taper, 0.5, 1, seg); cylCache[k].translate(0, 0.5, 0); }
  return cylCache[k];
};
const coneGeo = (seg = 12) => {
  if (!coneCache[seg]) { coneCache[seg] = new THREE.ConeGeometry(0.5, 1, seg); coneCache[seg].translate(0, 0.5, 0); }
  return coneCache[seg];
};
// Mái hai mái: lăng trụ tam giác, sống mái chạy theo trục z
const gableShape = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)]);
G.gable = new THREE.ExtrudeGeometry(gableShape, { depth: 1, bevelEnabled: false });
G.gable.translate(0, 0, -0.5);

function mesh(geo, m, sx, sy, sz, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.scale.set(sx, sy, sz);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}
const box = (g, m, w, h, d, x = 0, y = 0, z = 0) => g.add(mesh(G.box, m, w, h, d, x, y, z));
const cyl = (g, m, r, h, x = 0, y = 0, z = 0, seg = 12, taper = 1) => g.add(mesh(cylGeo(seg, taper), m, r * 2, h, r * 2, x, y, z));
const cone = (g, m, r, h, x = 0, y = 0, z = 0, seg = 12) => g.add(mesh(coneGeo(seg), m, r * 2, h, r * 2, x, y, z));
const pyramid = (g, m, w, h, x = 0, y = 0, z = 0) => { const o = mesh(coneGeo(4), m, w * 1.42, h, w * 1.42, x, y, z); o.rotation.y = Math.PI / 4; g.add(o); };
const gable = (g, m, w, h, d, x = 0, y = 0, z = 0, rotY = 0) => { const o = mesh(G.gable, m, w, h, d, x, y, z); o.rotation.y = rotY; g.add(o); };
const dome = (g, m, r, x = 0, y = 0, z = 0) => g.add(mesh(G.dome, m, r * 2, r * 2, r * 2, x, y, z));
const ball = (g, m, r, x = 0, y = 0, z = 0) => { const o = mesh(G.sphere, m, r * 2, r * 2, r * 2, x, y, z); g.add(o); return o; };
// Răng cưa trên đỉnh tường/tháp
function crenels(g, m, w, d, y, step = 0.22) {
  for (let x = -w / 2 + step / 2; x <= w / 2; x += step * 2) { box(g, m, step, 0.14, step, x, y, d / 2 - step / 2); box(g, m, step, 0.14, step, x, y, -d / 2 + step / 2); }
  for (let z = -d / 2 + step * 1.5; z <= d / 2 - step; z += step * 2) { box(g, m, step, 0.14, step, w / 2 - step / 2, y, z); box(g, m, step, 0.14, step, -w / 2 + step / 2, y, z); }
}
function ringCrenels(g, m, r, y, n = 8) {
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; box(g, m, 0.14, 0.16, 0.14, Math.sin(a) * r, y, Math.cos(a) * r); }
}
const windows = (g, n, w, y, z) => { for (let i = 0; i < n; i++) box(g, M.glow(0xffc46b), 0.1, 0.16, 0.02, -w / 2 + (w / (n + 1)) * (i + 1), y, z); };

// ---------- Mẫu tòa nhà theo từng loại công trình ----------
const BUILD = {
  manor(g, r) { box(g, M.stone(), 1.2, 0.8, 1); gable(g, r, 1.3, 0.6, 1.15, 0, 0.8); box(g, M.stoneDk(), 0.16, 0.5, 0.16, 0.35, 0.9, -0.2); windows(g, 3, 1.2, 0.4, 0.51); },
  castle(g, r) {
    box(g, M.stone(), 1.1, 1.1, 1.1); crenels(g, M.stone(), 1.1, 1.1, 1.1);
    for (const [x, z] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) { cyl(g, M.stone(), 0.22, 1.55, x, 0, z, 10); cone(g, r, 0.3, 0.55, x, 1.55, z, 10); }
    box(g, M.woodDk(), 0.3, 0.45, 0.04, 0, 0, 0.56);
  },
  palace(g, r) {
    box(g, M.white(), 1.5, 0.8, 1.1); dome(g, r, 0.5, 0, 0.8); cyl(g, M.gold(), 0.04, 0.35, 0, 1.28);
    for (const x of [-0.75, 0.75]) { cyl(g, M.white(), 0.17, 1.35, x, 0, 0.3, 10); cone(g, r, 0.22, 0.45, x, 1.35, 0.3, 10); }
    windows(g, 4, 1.5, 0.4, 0.56);
  },
  temple(g, r) {
    box(g, M.white(), 1.45, 0.15, 1.15);
    for (const x of [-0.55, -0.18, 0.18, 0.55]) for (const z of [-0.42, 0.42]) cyl(g, M.white(), 0.07, 0.72, x, 0.15, z, 8);
    box(g, M.white(), 1.45, 0.1, 1.15, 0, 0.87); gable(g, r, 1.45, 0.35, 1.15, 0, 0.97, 0, Math.PI / 2);
  },
  church(g, r) {
    box(g, M.stone(), 0.8, 0.85, 1.3, 0, 0, -0.15); gable(g, r, 0.9, 0.5, 1.35, 0, 0.85, -0.15);
    box(g, M.stone(), 0.42, 1.45, 0.42, 0, 0, 0.6); pyramid(g, r, 0.46, 0.75, 0, 1.45, 0.6);
    box(g, M.gold(), 0.04, 0.25, 0.04, 0, 2.2, 0.6); box(g, M.gold(), 0.16, 0.04, 0.04, 0, 2.33, 0.6);
  },
  monastery(g, r) {
    box(g, M.stone(), 1.4, 0.7, 0.55, 0, 0, -0.4); gable(g, r, 1.5, 0.4, 0.65, 0, 0.7, -0.4, Math.PI / 2);
    box(g, M.stone(), 0.55, 0.7, 1.0, -0.42, 0, 0.15); gable(g, r, 0.65, 0.4, 1.05, -0.42, 0.7, 0.15);
    cyl(g, M.stone(), 0.2, 1.3, 0.45, 0, 0.35, 10); cone(g, r, 0.26, 0.5, 0.45, 1.3, 0.35, 10);
  },
  cathedral(g, r) {
    box(g, M.stone(), 0.9, 1.15, 1.45, 0, 0, -0.1); gable(g, r, 1.0, 0.6, 1.5, 0, 1.15, -0.1);
    for (const x of [-0.36, 0.36]) { box(g, M.stone(), 0.36, 2.0, 0.36, x, 0, 0.62); pyramid(g, r, 0.4, 0.85, x, 2.0, 0.62); }
    ball(g, M.glow(0x9fd0ff), 0.14, 0, 0.75, 0.66);
  },
  tavern(g, r) {
    box(g, M.wood(), 1.0, 0.75, 0.9); gable(g, r, 1.1, 0.55, 1.0, 0, 0.75, 0, Math.PI / 2);
    box(g, M.woodDk(), 0.04, 0.04, 0.35, 0.52, 0.65, 0.3); box(g, M.gold(), 0.03, 0.25, 0.3, 0.55, 0.35, 0.42);
    cyl(g, M.woodDk(), 0.13, 0.3, -0.62, 0, 0.35, 10); windows(g, 2, 1.0, 0.35, 0.46);
  },
  market(g, r) {
    for (const [x, z] of [[-0.5, 0.3], [0.5, 0.3], [0, -0.45]]) {
      box(g, M.wood(), 0.55, 0.3, 0.45, x, 0, z);
      for (const dx of [-0.25, 0.25]) box(g, M.woodDk(), 0.05, 0.65, 0.05, x + dx, 0, z + 0.2);
      const roof = mesh(G.box, r, 0.66, 0.05, 0.6, x, 0.65, z); roof.rotation.x = 0.25; g.add(roof);
      ball(g, mat(0xd4552f), 0.07, x - 0.1, 0.36, z); ball(g, mat(0x9bc24a), 0.07, x + 0.1, 0.36, z);
    }
  },
  tradingpost(g, r) {
    box(g, M.wood(), 1.0, 0.7, 0.8, -0.15, 0, -0.15); pyramid(g, r, 1.0, 0.5, -0.15, 0.7, -0.15);
    box(g, M.woodDk(), 0.3, 0.3, 0.3, 0.55, 0, 0.5); box(g, M.wood(), 0.26, 0.26, 0.26, 0.5, 0.3, 0.5); box(g, M.woodDk(), 0.28, 0.28, 0.28, 0.15, 0, 0.6);
  },
  docks(g, r) {
    box(g, M.water(), 1.7, 0.04, 1.6);
    box(g, M.wood(), 1.5, 0.1, 0.5, 0, 0.15, 0.15);
    for (const x of [-0.65, 0, 0.65]) cyl(g, M.woodDk(), 0.05, 0.3, x, 0, 0.42, 6);
    cyl(g, M.woodDk(), 0.06, 1.2, -0.55, 0.25, -0.05, 6); box(g, M.woodDk(), 0.8, 0.06, 0.06, -0.2, 1.4, -0.05);
    const hull = mesh(G.box, r, 0.9, 0.22, 0.32, 0.25, 0.02, -0.5); g.add(hull); box(g, M.white(), 0.03, 0.6, 0.35, 0.25, 0.24, -0.5);
  },
  harbor(g, r) {
    box(g, M.water(), 1.6, 0.04, 1.6); cyl(g, M.stoneDk(), 0.5, 0.25, 0, 0, 0, 10);
    cyl(g, M.white(), 0.3, 1.7, 0, 0.25, 0, 12, 0.75); cyl(g, r, 0.31, 0.22, 0, 0.8, 0, 12, 0.95);
    cyl(g, M.glow(0xffe08a), 0.2, 0.3, 0, 1.95, 0, 10); cone(g, r, 0.28, 0.35, 0, 2.25, 0, 10);
  },
  townhall(g, r) {
    box(g, M.stone(), 1.35, 0.9, 1.0, 0, 0, -0.1); gable(g, r, 1.45, 0.5, 1.1, 0, 0.9, -0.1, Math.PI / 2);
    box(g, M.stone(), 0.42, 1.9, 0.42, 0, 0, 0.45); pyramid(g, r, 0.46, 0.55, 0, 1.9, 0.45);
    const clock = mesh(cylGeo(16), M.white(), 0.26, 0.04, 0.26, 0, 1.55, 0.67); clock.rotation.x = Math.PI / 2; g.add(clock);
    windows(g, 3, 1.35, 0.45, 0.41);
  },
  watchtower(g, r) {
    for (const [x, z] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) cyl(g, M.woodDk(), 0.05, 1.6, x, 0, z, 6);
    box(g, M.wood(), 0.75, 0.35, 0.75, 0, 1.6); cone(g, r, 0.55, 0.6, 0, 1.95, 0, 4);
  },
  prison(g, r) {
    box(g, M.stoneDk(), 1.2, 0.95, 1.0); crenels(g, M.stoneDk(), 1.2, 1.0, 0.95);
    for (const x of [-0.35, 0, 0.35]) { box(g, M.dark(), 0.18, 0.22, 0.02, x, 0.5, 0.51); for (const dx of [-0.05, 0, 0.05]) box(g, M.stoneDk(), 0.015, 0.22, 0.03, x + dx, 0.5, 0.52); }
    box(g, r, 0.3, 0.05, 1.02, 0, 0.95);
  },
  battlefield(g, r) {
    cone(g, r, 0.42, 0.7, -0.4, 0, 0.1, 6); cone(g, M.white(), 0.38, 0.6, 0.45, 0, -0.3, 6);
    cyl(g, M.woodDk(), 0.03, 1.5, 0.35, 0, 0.45, 6); box(g, r, 0.45, 0.28, 0.02, 0.58, 1.18, 0.45);
    for (const a of [-0.5, 0.5]) { const sp = mesh(cylGeo(5), M.stoneDk(), 0.04, 1.0, 0.04, -0.1, 0, 0.6); sp.rotation.z = a; g.add(sp); }
  },
  fortress(g, r) {
    for (const [w, d, x, z] of [[1.6, 0.16, 0, 0.72], [1.6, 0.16, 0, -0.72], [0.16, 1.6, 0.72, 0], [0.16, 1.6, -0.72, 0]]) box(g, M.stoneDk(), w, 0.6, d, x, 0, z);
    for (const [x, z] of [[-0.72, -0.72], [0.72, -0.72], [-0.72, 0.72], [0.72, 0.72]]) { cyl(g, M.stoneDk(), 0.2, 0.95, x, 0, z, 8); ringCrenels(g, M.stoneDk(), 0.17, 0.95, 6); g.children.slice(-6).forEach((c) => { c.position.x += x; c.position.z += z; }); }
    box(g, M.stone(), 0.6, 1.25, 0.6); crenels(g, M.stone(), 0.6, 0.6, 1.25, 0.15); box(g, r, 0.04, 0.3, 0.2, 0, 1.4, 0);
  },
  haunted(g, r) {
    const h = new THREE.Group(); h.rotation.z = 0.08; g.add(h);
    box(h, mat(0x4a4458), 1.0, 1.0, 0.9); gable(h, mat(0x3a2b55), 1.15, 0.65, 1.0, 0, 1.0);
    for (const x of [-0.25, 0.25]) box(h, M.glow(0x7dffb0), 0.14, 0.18, 0.02, x, 0.55, 0.46);
    ball(g, mat(0xe8f5ff, { transparent: true, opacity: 0.55, emissive: 0xbfe8ff, emissiveIntensity: 0.6 }), 0.16, 0.55, 1.4, 0.3).userData.bob = 1;
  },
  keep(g, r) {
    cyl(g, M.stone(), 0.62, 1.6, 0, 0, 0, 10); ringCrenels(g, M.stone(), 0.55, 1.6, 10);
    box(g, M.woodDk(), 0.3, 0.45, 0.04, 0, 0, 0.62); cyl(g, M.woodDk(), 0.02, 0.6, 0, 1.6, 0, 5); box(g, r, 0.3, 0.2, 0.02, 0.15, 2.0, 0);
  },
  laboratory(g, r) {
    cyl(g, M.stone(), 0.55, 0.8, 0, 0, 0, 12); dome(g, mat(0x7dffb0, { transparent: true, opacity: 0.7, emissive: 0x3fbf7f, emissiveIntensity: 0.8 }), 0.5, 0, 0.8);
    cyl(g, M.stoneDk(), 0.1, 0.8, 0.4, 0.5, -0.2, 8); ball(g, M.glow(0x7dffb0), 0.12, 0.4, 1.4, -0.2).userData.bob = 1;
    box(g, r, 1.12, 0.08, 0.08, 0, 0.55, 0);
  },
  smithy(g, r) {
    box(g, M.stone(), 1.0, 0.7, 0.9); gable(g, r, 1.1, 0.5, 1.0, 0, 0.7, 0, Math.PI / 2);
    box(g, M.stoneDk(), 0.25, 1.5, 0.25, 0.32, 0, -0.25); box(g, M.glow(0xff7a2a), 0.4, 0.25, 0.02, -0.15, 0.08, 0.46);
    box(g, M.dark(), 0.28, 0.14, 0.12, -0.4, 0, 0.62); box(g, M.dark(), 0.12, 0.1, 0.1, -0.4, 0.14, 0.62);
  },
  observatory(g, r) {
    cyl(g, M.white(), 0.55, 1.0, 0, 0, 0, 14); dome(g, r, 0.55, 0, 1.0); box(g, M.dark(), 0.14, 0.4, 0.4, 0, 1.12, 0.3);
    const t = mesh(cylGeo(8), M.gold(), 0.1, 0.7, 0.1, 0, 1.25, 0.35); t.rotation.x = 0.7; g.add(t);
  },
  graveyard(g, r) {
    box(g, mat(0x3c4a32), 1.6, 0.04, 1.5);
    for (const x of [-0.5, 0, 0.5]) for (const z of [-0.3, 0.3]) { box(g, M.stoneDk(), 0.2, 0.35, 0.06, x, 0, z); box(g, M.stoneDk(), 0.06, 0.06, 0.06, x, 0.35, z); }
    for (let x = -0.75; x <= 0.75; x += 0.25) cyl(g, M.dark(), 0.025, 0.3, x, 0, 0.72, 5);
    cyl(g, M.woodDk(), 0.06, 0.9, -0.6, 0, -0.6, 5); ball(g, r, 0.18, 0.55, 0.2, -0.62);
  },
  library(g, r) {
    box(g, M.stone(), 1.4, 0.9, 0.95, 0, 0, -0.1); gable(g, r, 1.5, 0.45, 1.05, 0, 0.9, -0.1, Math.PI / 2);
    for (const x of [-0.5, -0.17, 0.17, 0.5]) cyl(g, M.white(), 0.06, 0.85, x, 0, 0.45, 8);
    box(g, M.white(), 1.4, 0.08, 0.2, 0, 0.85, 0.45);
  },
  magicschool(g, r) {
    cyl(g, mat(0x6b5a8a), 0.36, 1.9, 0, 0, 0, 10, 0.85); cone(g, r, 0.42, 0.8, 0, 1.9, 0, 10);
    box(g, mat(0x6b5a8a), 0.9, 0.6, 0.6, -0.4, 0, 0.3); gable(g, r, 1.0, 0.35, 0.7, -0.4, 0.6, 0.3, Math.PI / 2);
    ball(g, M.glow(0xc58bff), 0.15, 0, 3.0, 0).userData.bob = 1;
  },
  university(g, r) {
    box(g, M.white(), 1.5, 0.85, 1.05); dome(g, r, 0.45, 0, 0.85); cyl(g, M.white(), 0.12, 0.25, 0, 1.28, 0, 8); cone(g, M.gold(), 0.14, 0.2, 0, 1.53, 0, 8);
    for (const x of [-0.55, -0.2, 0.2, 0.55]) cyl(g, M.white(), 0.06, 0.8, x, 0, 0.6, 8);
  },
  dragongate(g, r) {
    for (const x of [-0.6, 0.6]) { box(g, M.stoneDk(), 0.36, 1.45, 0.36, x, 0); cone(g, r, 0.22, 0.4, x, 1.45, 0, 4); ball(g, M.glow(0xff5a3a), 0.06, x, 1.2, 0.19); }
    box(g, M.stoneDk(), 1.6, 0.3, 0.36, 0, 1.15); box(g, M.gold(), 0.5, 0.2, 0.05, 0, 1.2, 0.2);
    for (const s of [-1, 1]) { const horn = mesh(coneGeo(6), r, 0.12, 0.45, 0.12, s * 0.3, 1.45, 0); horn.rotation.z = -s * 0.5; g.add(horn); }
  },
  // ----- công trình tím bản 2016 -----
  stables(g, r) {
    box(g, M.wood(), 1.4, 0.6, 0.7, 0, 0, -0.3); gable(g, r, 1.5, 0.4, 0.8, 0, 0.6, -0.3, Math.PI / 2);
    for (let x = -0.7; x <= 0.7; x += 0.35) cyl(g, M.woodDk(), 0.03, 0.35, x, 0, 0.6, 5);
    box(g, M.woodDk(), 1.45, 0.04, 0.04, 0, 0.28, 0.6);
    const horse = mesh(G.box, mat(0x6b4426), 0.5, 0.22, 0.18, 0.1, 0.25, 0.25); g.add(horse); box(g, mat(0x6b4426), 0.14, 0.26, 0.14, 0.38, 0.35, 0.25);
  },
  statue(g, r) {
    box(g, M.stoneDk(), 0.8, 0.35, 0.8); box(g, M.stone(), 0.55, 0.25, 0.55, 0, 0.35);
    cyl(g, M.white(), 0.16, 0.85, 0, 0.6, 0, 8, 0.7); ball(g, M.white(), 0.15, 0, 1.55); box(g, r, 0.5, 0.06, 0.2, 0, 1.15, 0.05);
  },
  basilica(g, r) {
    box(g, M.white(), 1.0, 0.8, 1.4, 0, 0, -0.05); dome(g, r, 0.42, 0, 0.8, -0.05);
    for (const x of [-0.38, -0.13, 0.13, 0.38]) cyl(g, M.white(), 0.05, 0.75, x, 0, 0.7, 8);
    gable(g, r, 1.05, 0.3, 0.3, 0, 0.75, 0.7, Math.PI / 2);
  },
  monument(g, r) {
    box(g, M.stoneDk(), 0.9, 0.2, 0.9); box(g, M.stone(), 0.6, 0.2, 0.6, 0, 0.2);
    cyl(g, M.white(), 0.2, 2.1, 0, 0.4, 0, 4, 0.55); pyramid(g, r, 0.22, 0.3, 0, 2.5);
  },
  poorhouse(g, r) {
    const h = new THREE.Group(); h.rotation.y = 0.15; g.add(h);
    box(h, M.woodDk(), 0.8, 0.55, 0.7, -0.25, 0, 0); gable(h, mat(0x7a6a4a), 0.9, 0.35, 0.8, -0.25, 0.55, 0);
    box(h, M.wood(), 0.55, 0.45, 0.55, 0.45, 0, 0.3); pyramid(h, mat(0x7a6a4a), 0.6, 0.3, 0.45, 0.45, 0.3);
    box(g, r, 0.2, 0.15, 0.02, -0.25, 0.25, 0.36);
  },
  imperialtreasury(g, r) {
    box(g, M.white(), 1.3, 0.8, 1.0); for (const x of [-0.45, -0.15, 0.15, 0.45]) cyl(g, M.white(), 0.06, 0.8, x, 0, 0.55, 8);
    gable(g, M.gold(), 1.35, 0.4, 1.05, 0, 0.8, 0, Math.PI / 2); box(g, M.gold(), 0.35, 0.22, 0.22, 0, 0, 0.75); ball(g, M.gold(), 0.07, 0.25, 0.05, 0.8);
  },
  maproom(g, r) {
    box(g, M.stone(), 1.1, 0.8, 0.9); pyramid(g, r, 1.1, 0.55, 0, 0.8);
    cyl(g, M.gold(), 0.18, 0.3, 0, 1.35, 0, 10); ball(g, mat(0x3c78d0), 0.16, 0, 1.75); windows(g, 3, 1.1, 0.4, 0.46);
  },
  wishingwell(g, r) {
    cyl(g, M.stone(), 0.45, 0.4, 0, 0, 0, 12); cyl(g, M.water(), 0.38, 0.05, 0, 0.38, 0, 12);
    for (const x of [-0.42, 0.42]) box(g, M.woodDk(), 0.07, 0.95, 0.07, x, 0.3);
    gable(g, r, 1.05, 0.35, 0.6, 0, 1.25, 0, Math.PI / 2); box(g, M.wood(), 0.15, 0.15, 0.15, 0, 0.85);
  },
  ivorytower(g, r) {
    cyl(g, M.white(), 0.4, 2.3, 0, 0, 0, 12, 0.7); cyl(g, M.gold(), 0.32, 0.12, 0, 2.3, 0, 12); cone(g, r, 0.32, 0.7, 0, 2.42, 0, 12);
    for (const y of [0.6, 1.2, 1.8]) box(g, M.glow(0xffe4a8), 0.1, 0.18, 0.02, 0, y, 0.36 - y * 0.05);
  },
  capitol(g, r) {
    box(g, M.white(), 1.6, 0.75, 1.1); for (const x of [-0.6, -0.3, 0, 0.3, 0.6]) cyl(g, M.white(), 0.05, 0.7, x, 0, 0.62, 8);
    cyl(g, M.white(), 0.38, 0.35, 0, 0.75, 0, 14); dome(g, r, 0.38, 0, 1.1); cyl(g, M.gold(), 0.04, 0.3, 0, 1.45);
  },
  quarry(g, r) {
    box(g, mat(0x8a8072), 1.6, 0.06, 1.5);
    for (const [x, y, z, s] of [[-0.4, 0, -0.3, 0.45], [0.1, 0, -0.35, 0.4], [-0.15, 0.4, -0.3, 0.35], [0.45, 0, 0.2, 0.3], [-0.5, 0, 0.35, 0.3]]) box(g, M.stone(), s, s * 0.8, s, x, y, z);
    cyl(g, M.woodDk(), 0.05, 1.3, 0.55, 0, -0.45, 6); const arm = mesh(G.box, M.woodDk(), 0.9, 0.05, 0.05, 0.2, 1.25, -0.45); arm.rotation.z = -0.25; g.add(arm);
    box(g, r, 0.12, 0.12, 0.12, -0.15, 0.95, -0.45);
  },
  factory(g, r) {
    box(g, M.stone(), 1.4, 0.8, 0.9); for (const x of [-0.45, 0, 0.45]) gable(g, r, 0.45, 0.3, 0.92, x, 0.8);
    for (const x of [-0.5, 0.45]) cyl(g, M.stoneDk(), 0.1, 1.0, x, 0.8, -0.3, 8);
    box(g, M.glow(0xff7a2a), 0.5, 0.2, 0.02, 0, 0.15, 0.46);
  },
  goldmine(g, r) {
    cone(g, mat(0x7a6a58), 0.85, 1.0, 0, 0, -0.15, 7);
    box(g, M.dark(), 0.4, 0.4, 0.1, 0, 0, 0.55); box(g, M.woodDk(), 0.5, 0.06, 0.12, 0, 0.42, 0.58);
    for (const [x, z] of [[-0.35, 0.65], [0.38, 0.6], [0.2, 0.75]]) ball(g, M.gold(), 0.1, x, 0.02, z);
    box(g, M.woodDk(), 0.35, 0.18, 0.22, -0.55, 0.05, 0.45);
  },
  park(g, r) {
    box(g, M.grass(), 1.6, 0.05, 1.5);
    for (const [x, z, s] of [[-0.45, -0.35, 1], [0.45, -0.25, 0.85], [-0.1, 0.4, 0.7]]) {
      cyl(g, M.woodDk(), 0.06 * s, 0.45 * s, x, 0.05, z, 6); cone(g, mat(0x2f7a3a), 0.35 * s, 0.75 * s, x, 0.4 * s, z, 7);
    }
    box(g, M.wood(), 0.5, 0.05, 0.16, 0.45, 0.2, 0.45); box(g, r, 0.18, 0.04, 0.18, 0.1, 0.06, -0.05);
  },
  greatwall(g, r) {
    box(g, M.stone(), 1.75, 0.85, 0.4); crenels(g, M.stone(), 1.75, 0.4, 0.85, 0.18);
    for (const x of [-0.8, 0.8]) { box(g, M.stone(), 0.5, 1.25, 0.55, x, 0); pyramid(g, r, 0.55, 0.45, x, 1.25); }
  },
};

function buildDistrict(card) {
  const g = new THREE.Group();
  (BUILD[card.key] || BUILD.manor)(g, mat(ROOF[card.color] || 0x888888));
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// Vương miện vàng lơ lửng trên khu đất người giữ vương miện
function makeCrown() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 0.3, 16, 1, true), M.gold());
  ring.material.side = THREE.DoubleSide;
  g.add(ring);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const spike = new THREE.Mesh(coneGeo(4), M.gold());
    spike.scale.set(0.18, 0.35, 0.18); spike.position.set(Math.sin(a) * 0.42, 0.13, Math.cos(a) * 0.42); g.add(spike);
    const gem = new THREE.Mesh(G.sphere, M.glow(i % 2 ? 0xff4a5a : 0x4ab0ff));
    gem.scale.setScalar(0.09); gem.position.set(Math.sin(a) * 0.45, 0, Math.cos(a) * 0.45); g.add(gem);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------- Cảnh 3D ----------
const isEn = () => document.documentElement.lang === 'en';
const SLOT = 1.95; // khoảng cách giữa các ô công trình
const PLOT_W = SLOT * 4 + 0.4;
const PLOT_D = SLOT * 2 + 0.4;

class CityScene {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'city3d';
    // Chất lượng thích ứng: điện thoại / màn cảm ứng bắt đầu thấp hơn; máy yếu tự hạ sau khi đo FPS
    this.lowEnd = matchMedia('(pointer: coarse)').matches || window.innerWidth < 700;
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.lowEnd, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.lowEnd ? 1.25 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.el.appendChild(this.renderer.domElement);
    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'city3d-labels';
    this.el.appendChild(this.labels.domElement);
    this.tip = document.createElement('div');
    this.tip.className = 'city3d-tip';
    this.el.appendChild(this.tip);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1120);
    this.scene.fog = new THREE.Fog(0x0c1120, 30, 70);
    this.camera = new THREE.PerspectiveCamera(38, 2, 0.1, 200);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2.25;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 45;
    this.controls.enablePan = false;

    this.scene.add(new THREE.HemisphereLight(0xfff1dc, 0x2a2030, 0.75));
    const sun = new THREE.DirectionalLight(0xffe2b0, 1.6);
    sun.position.set(10, 18, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.lowEnd ? 1024 : 2048, this.lowEnd ? 1024 : 2048);
    sun.shadow.bias = -0.0005;
    this.sun = sun;
    this.scene.add(sun, sun.target);

    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.plots = new Map(); // playerId -> { group, ground, label, buildings: Map(cardId -> obj) }
    this.layoutKey = null;
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.opts = {};
    this.effects = [];

    this.crown = makeCrown();
    this.scene.add(this.crown);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerleave', () => { this.hover(null); });
    // Phóng to bằng cuộn chuột, tự xử lý thay OrbitControls: mức phóng tỉ lệ với độ cuộn thật
    // (chuột cuộn mượt / touchpad gửi rất nhiều sự kiện nhỏ — mỗi sự kiện 1 nấc cố định sẽ phóng vọt mất bàn)
    this.controls.enableZoom = false;
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      const step = Math.max(-120, Math.min(120, px)); // 1 nấc chuột thường ≈ 100px → ~11%
      const c = this.controls;
      const off = this.camera.position.clone().sub(c.target);
      const len = Math.min(c.maxDistance, Math.max(c.minDistance, off.length() * Math.exp(step * 0.0011)));
      this.camera.position.copy(c.target).add(off.setLength(len));
      c.update();
    }, { passive: false });
    canvas.addEventListener('pointerdown', (e) => { this.downAt = [e.clientX, e.clientY]; });
    canvas.addEventListener('pointerup', (e) => this.onClick(e));
    // Vẽ 60 khung/giây khi có chuyển động (xoay camera, nhà mọc, bụi); đứng yên thì 30 khung/giây
    this.busyUntil = 0;
    this.frame = 0;
    this.controls.addEventListener('change', () => this.kick(400));
    canvas.addEventListener('pointerdown', () => this.kick(1500));
    this.fps = { last: 0, time: 0, n: 0, done: false };
    this.kick(4000); // vẽ liên tục vài giây đầu để đo FPS
    new ResizeObserver(() => { this.resize(); this.kick(300); }).observe(this.el);
    this.visible = true;
    new IntersectionObserver(([en]) => { this.visible = en.isIntersecting; }).observe(this.el);
    this.loop();
  }

  kick(ms) { this.busyUntil = Math.max(this.busyUntil, performance.now() + ms); }

  // Đo FPS vài giây đầu khi đang vẽ liên tục; máy yếu → hạ độ phân giải & bóng đổ
  measure(now) {
    const f = this.fps;
    if (f.done) return;
    if (f.last && now - f.last < 250) { f.time += now - f.last; f.n++; }
    f.last = now;
    if (f.time < 3000) return;
    f.done = true;
    if ((f.n * 1000) / f.time < 40) {
      this.renderer.setPixelRatio(1);
      this.sun.shadow.mapSize.set(1024, 1024);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
      this.resize();
    }
  }

  resize() {
    const w = this.el.clientWidth || 600;
    const h = this.el.clientHeight || 420;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Dựng lại bàn & khu đất khi số người chơi / vị trí của mình thay đổi
  layout(view) {
    const n = view.players.length;
    const me = Math.max(0, view.me);
    const key = view.players.map((p) => p.id).join(',') + '|' + me;
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    // Nhãn CSS2D là phần tử DOM riêng: xóa cảnh 3D không tự xóa chúng → phải gỡ tay, nếu không sẽ bị nhân đôi
    for (const plot of this.plots.values()) plot.labelEl.remove();
    this.world.clear();
    this.plots.clear();
    this.crownTarget = null;

    const R = n <= 2 ? 6.5 : Math.max(7.5, (n * (PLOT_W + 1.6)) / (Math.PI * 2));
    this.R = R;
    const tableR = R + PLOT_D / 2 + 2.2;
    const table = new THREE.Mesh(new THREE.CylinderGeometry(tableR, tableR + 0.4, 0.8, 72), mat(0x4a321e));
    table.position.y = -0.8; table.receiveShadow = true; this.world.add(table);
    const felt = new THREE.Mesh(new THREE.CylinderGeometry(tableR - 0.6, tableR - 0.6, 0.05, 72), mat(0x223a2c, { roughness: 1 }));
    felt.position.y = -0.02; felt.receiveShadow = true; this.world.add(felt);
    // Hoa văn la bàn ở giữa bàn
    const rose = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.6, 48), M.gold());
    rose.rotation.x = -Math.PI / 2; rose.position.y = 0.02; this.world.add(rose);
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Mesh(coneGeo(4), M.gold());
      s.scale.set(0.3, 1.3, 0.05); s.rotation.x = -Math.PI / 2; s.rotation.z = (i / 8) * Math.PI * 2; s.position.y = 0.03;
      s.position.x = Math.sin(s.rotation.z) * -0.1; this.world.add(s);
    }

    view.players.forEach((p, i) => {
      const a = ((i - me) / n) * Math.PI * 2;
      const group = new THREE.Group();
      group.position.set(Math.sin(a) * R, 0, Math.cos(a) * R);
      group.rotation.y = a;
      const border = new THREE.Mesh(G.box, mat(0x8a7656));
      border.scale.set(PLOT_W + 0.3, 0.22, PLOT_D + 0.3); border.position.y = -0.1; border.receiveShadow = true; group.add(border);
      const ground = new THREE.Mesh(G.box, mat(0x56803a).clone());
      ground.scale.set(PLOT_W, 0.24, PLOT_D); ground.position.y = -0.1; ground.receiveShadow = true; group.add(ground);
      const road = new THREE.Mesh(G.box, mat(0xb9a57e));
      road.scale.set(PLOT_W - 0.3, 0.02, 0.32); road.position.y = 0.14; road.receiveShadow = true; group.add(road);
      // Ô móng cho 8 công trình
      for (let k = 0; k < 8; k++) {
        const pad = new THREE.Mesh(G.box, mat(0x6b8f4a));
        const { x, z } = this.slotPos(k);
        pad.scale.set(1.75, 0.03, 1.6); pad.position.set(x, 0.14, z); pad.receiveShadow = true; group.add(pad);
      }
      const labelEl = document.createElement('div');
      labelEl.className = 'c3-label';
      const label = new CSS2DObject(labelEl);
      label.position.set(0, 0.3, -PLOT_D / 2 - 0.8); // bảng tên đặt trên bàn, trước khu đất, hướng vào giữa
      group.add(label);
      this.world.add(group);
      this.plots.set(p.id, { group, ground, label, labelEl, buildings: new Map(), index: i, angle: a });
    });

    // Camera đứng phía sau thành phố của mình, nhìn vào giữa bàn
    const dist = R + 10.5;
    this.camera.position.set(0, R * 0.6 + 8, dist);
    this.controls.target.set(0, 0, R * 0.42);
    // Giới hạn phóng to theo góc nhìn ban đầu: gần nhất ~ 0.65, xa nhất ~ 1.6 lần → luôn thấy bàn
    const d0 = this.camera.position.distanceTo(this.controls.target);
    this.controls.minDistance = d0 * 0.65;
    this.controls.maxDistance = d0 * 1.6;
    this.scene.fog.near = d0 * 1.6;
    this.scene.fog.far = d0 * 1.6 + tableR * 3;
    this.controls.update();
    const s = this.sun.shadow.camera;
    s.left = -tableR; s.right = tableR; s.top = tableR; s.bottom = -tableR; s.far = 60;
    s.updateProjectionMatrix();
    this.firstFill = true;
  }

  slotPos(k) {
    const col = k % 4;
    const row = Math.floor(k / 4);
    return { x: (col - 1.5) * SLOT, z: row === 0 ? SLOT / 2 : -SLOT / 2 };
  }

  update(view, opts = {}) {
    this.opts = opts;
    this.kick(1600); // nhà mọc / lún, vương miện bay
    this.layout(view);
    const destroyable = new Map((opts.destroyable || []).map((d) => [d.cardId, d]));
    view.players.forEach((p, i) => {
      const plot = this.plots.get(p.id);
      if (!plot) return;
      const ids = new Set(p.city.map((c) => c.id));
      for (const [id, obj] of plot.buildings) {
        if (!ids.has(id) && !obj.userData.removing) { obj.userData.removing = true; this.dust(obj, 0x6b5a4a); }
      }
      p.city.forEach((c, k) => {
        let obj = plot.buildings.get(c.id);
        if (!obj) {
          obj = buildDistrict(c);
          obj.userData = { card: c, pi: i, grow: this.firstFill ? 1 : 0, flash: 0 };
          if (this.firstFill) obj.scale.setScalar(1); else { obj.scale.set(1, 0.001, 1); this.dust(obj, 0xd9c49b, plot, k); }
          plot.group.add(obj);
          plot.buildings.set(c.id, obj);
        }
        const { x, z } = this.slotPos(k);
        obj.userData.target = new THREE.Vector3(x, 0.15, z);
        if (this.firstFill || !obj.userData.placed) { obj.position.copy(obj.userData.target); obj.userData.placed = true; }
        obj.userData.destroy = destroyable.get(c.id) || null;
      });
      const active = view.actor === i && view.phase !== 'ended';
      plot.active = active;
      plot.labelEl.className = `c3-label ${active ? 'active' : ''} ${i === view.me ? 'me' : ''}`;
      const html = opts.label ? opts.label(p, i) : `${p.hasCrown ? '👑 ' : ''}<b>${esc(p.name)}</b>${i === view.me ? (isEn() ? ' (you)' : ' (bạn)') : ''}
        <span>🪙 ${p.gold} · 🏠 ${p.citySize ?? p.city.length}/${view.target}</span>`;
      if (plot.labelHtml !== html) { plot.labelEl.innerHTML = html; plot.labelHtml = html; }
      if (p.hasCrown) this.crownTarget = plot;
    });
    this.firstFill = false;
  }

  // Bụi bay khi xây / phá công trình
  dust(obj, color, plot, k) {
    const parent = plot ? plot.group : obj.parent;
    if (!parent) return;
    const pos = plot ? (() => { const s = this.slotPos(k); return new THREE.Vector3(s.x, 0.2, s.z); })() : obj.position.clone();
    for (let i = 0; i < 14; i++) {
      const p = new THREE.Mesh(G.box, mat(color, { transparent: true, opacity: 0.9 }).clone());
      p.scale.setScalar(0.12 + Math.random() * 0.1);
      p.position.copy(pos);
      const a = Math.random() * Math.PI * 2;
      p.userData.vel = new THREE.Vector3(Math.cos(a) * (1 + Math.random()), 1.5 + Math.random() * 1.5, Math.sin(a) * (1 + Math.random()));
      p.userData.life = 1;
      parent.add(p);
      this.effects.push(p);
    }
  }

  pick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.world.children, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !(o.userData && o.userData.card)) o = o.parent;
      if (o) return o;
    }
    return null;
  }

  onMove(e) {
    const o = this.pick(e);
    this.hover(o, e);
  }

  hover(o, e) {
    this.hovered = o;
    if (!o) { this.tip.style.opacity = 0; this.renderer.domElement.style.cursor = ''; return; }
    const c = o.userData.card;
    const d = o.userData.destroy;
    // Ngôn ngữ theo <html lang> do app.js đặt
    const en = isEn();
    const name = (en && c.nameEn) || c.name;
    const desc = (en && c.descEn) || c.desc;
    const gold = en ? 'gold' : 'vàng';
    this.tip.innerHTML = `<b>${esc(name)}</b> · ${c.cost + (c.beauty || 0)} ${gold}${desc ? `<div>${esc(desc)}</div>` : ''}${d ? `<div class="d">${esc(d.label || (en ? `⚔️ Click to destroy: ${d.cost} gold` : `⚔️ Bấm để phá: ${d.cost} vàng`))}</div>` : ''}`;
    const rect = this.el.getBoundingClientRect();
    this.tip.style.left = `${e.clientX - rect.left + 14}px`;
    this.tip.style.top = `${e.clientY - rect.top + 14}px`;
    this.tip.style.opacity = 1;
    this.renderer.domElement.style.cursor = d ? 'crosshair' : 'help';
  }

  onClick(e) {
    if (!this.downAt || Math.hypot(e.clientX - this.downAt[0], e.clientY - this.downAt[1]) > 5) return; // đang xoay camera
    const o = this.pick(e);
    const d = o && o.userData.destroy;
    if (d && this.opts.onDestroy) this.opts.onDestroy(d.target, d.cardId);
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    if (!this.visible || document.hidden || !this.el.isConnected) { this.fps.last = 0; return; }
    const now = performance.now();
    const busy = now < this.busyUntil || this.effects.length > 0;
    if (!busy && (++this.frame & 1)) return; // đứng yên: bỏ 1/2 khung
    if (busy) this.measure(now); else this.fps.last = 0;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    this.controls.update();

    for (const plot of this.plots.values()) {
      // Khu đất của người đang chơi phát sáng nhẹ
      const g = plot.ground.material;
      g.emissive.setHex(0xe8b54f);
      g.emissiveIntensity = plot.active ? 0.12 + Math.sin(t * 3) * 0.06 : 0;
      for (const [id, obj] of plot.buildings) {
        const u = obj.userData;
        if (u.removing) {
          obj.scale.y -= dt * 1.6;
          obj.position.y -= dt * 0.6;
          if (obj.scale.y <= 0.02) { plot.group.remove(obj); plot.buildings.delete(id); }
          continue;
        }
        if (u.grow < 1) {
          u.grow = Math.min(1, u.grow + dt * 1.3);
          const k = u.grow; // easeOutBack
          obj.scale.y = Math.max(0.001, 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2));
        }
        if (u.target) obj.position.lerp(u.target, Math.min(1, dt * 6));
        // Công trình có thể bị phá: nhấp nháy đỏ
        const flash = u.destroy ? 0.35 + Math.sin(t * 6) * 0.25 : 0;
        if (u.flash !== flash) {
          obj.traverse((m) => {
            if (!m.isMesh) return;
            if (!m.userData.ownMat) { m.material = m.material.clone(); m.userData.ownMat = true; m.userData.baseEmissive = m.material.emissive.getHex(); m.userData.baseEI = m.material.emissiveIntensity; }
            if (u.destroy) { m.material.emissive.setHex(0xff2a1a); m.material.emissiveIntensity = flash; }
            else { m.material.emissive.setHex(m.userData.baseEmissive); m.material.emissiveIntensity = m.userData.baseEI; }
          });
          u.flash = flash;
        }
        obj.traverse((m) => { if (m.userData.bob) m.position.y += Math.sin(t * 2 + id) * 0.004; });
      }
    }

    for (let i = this.effects.length - 1; i >= 0; i--) {
      const p = this.effects[i];
      p.userData.life -= dt * 1.2;
      p.userData.vel.y -= dt * 6;
      p.position.addScaledVector(p.userData.vel, dt);
      p.material.opacity = Math.max(0, p.userData.life);
      if (p.userData.life <= 0) { p.parent && p.parent.remove(p); this.effects.splice(i, 1); }
    }

    if (this.crownTarget) {
      const wp = new THREE.Vector3(0, 3.0 + Math.sin(t * 2) * 0.15, -PLOT_D / 2 + 0.2);
      this.crownTarget.group.localToWorld(wp);
      this.crown.position.lerp(wp, Math.min(1, dt * 3));
      this.crown.rotation.y += dt * 0.8;
      this.crown.visible = true;
    } else this.crown.visible = false;

    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }
}

let instance = null;
window.City3D = {
  supported: webglOK(),
  // Gắn canvas 3D vào ô giữ chỗ (giữ nguyên context WebGL qua các lần vẽ lại giao diện)
  mount(slot) {
    if (!this.supported || !slot) return;
    if (!instance) instance = new CityScene();
    if (instance.el.parentElement !== slot) slot.appendChild(instance.el);
  },
  update(view, opts) { if (instance) instance.update(view, opts); },
  resetCamera() { if (instance) { instance.layoutKey = null; } },
  _scene: () => instance, // dùng cho trang xem trước / gỡ lỗi
};
window.dispatchEvent(new Event('city3d-ready'));
