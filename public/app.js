/* Citadels Online — client */
const socket = io();

// Bộ nhân vật cơ bản (trang chủ, trước khi có ván). Khi đang chơi, CHARS lấy theo bộ nhân vật của ván (g.cast).
const BASE_CHARS = {
  1: { key: 'assassin', name: 'Sát thủ', nameEn: 'Assassin', icon: 'assassin', desc: 'Ám sát 1 nhân vật, nhân vật đó mất lượt.', descEn: 'Kill 1 character; they lose their turn.' },
  2: { key: 'thief', name: 'Kẻ trộm', nameEn: 'Thief', icon: 'thief', desc: 'Trộm toàn bộ vàng của 1 nhân vật khi họ lộ diện.', descEn: 'Steal all gold of 1 character when they are revealed.' },
  3: { key: 'magician', name: 'Pháp sư', nameEn: 'Magician', icon: 'magician', desc: 'Đổi bài với 1 người, hoặc bỏ bài và rút lại.', descEn: 'Swap hands with a player, or discard cards and redraw.' },
  4: { key: 'king', name: 'Vua', nameEn: 'King', icon: 'king', color: 'yellow', desc: 'Nhận vương miện. +1 vàng mỗi công trình Quý tộc.', descEn: 'Take the crown. +1 gold per Noble district.' },
  5: { key: 'bishop', name: 'Giám mục', nameEn: 'Bishop', icon: 'bishop', color: 'blue', desc: 'Miễn bị Lãnh chúa phá. +1 vàng mỗi công trình Tôn giáo.', descEn: 'Immune to the Warlord. +1 gold per Religious district.' },
  6: { key: 'merchant', name: 'Thương gia', nameEn: 'Merchant', icon: 'merchant', color: 'green', desc: '+1 vàng. +1 vàng mỗi công trình Thương mại.', descEn: '+1 gold. +1 gold per Trade district.' },
  7: { key: 'architect', name: 'Kiến trúc sư', nameEn: 'Architect', icon: 'architect', desc: '+2 lá bài. Được xây tối đa 3 công trình.', descEn: '+2 cards. Build up to 3 districts.' },
  8: { key: 'warlord', name: 'Lãnh chúa', nameEn: 'Warlord', icon: 'warlord', color: 'red', desc: '+1 vàng mỗi công trình Quân sự. Phá 1 công trình (giá − 1).', descEn: '+1 gold per Military district. Destroy 1 district (cost − 1).' },
};
let CHARS = BASE_CHARS;
// Bộ nhân vật bí mật: số bạn chưa biết là ai → server gửi null, hiển thị "Số N · ?"
const castToChars = (cast) => Object.fromEntries(Object.entries(cast).map(([r, c]) => [r, c ? { ...c, icon: c.key }
  : { key: null, unknown: true, name: `Số ${r} · ?`, nameEn: `Rank ${r} · ?`, icon: 'unknown',
    desc: 'Bộ nhân vật bí mật — bạn chưa biết số này là nhân vật nào (sẽ biết khi được gọi hoặc bị nêu tên).',
    descEn: 'Secret character set — you do not know which character this rank is yet (revealed when called or named).' }]));
const COLOR_NAME = { yellow: ['Quý tộc', 'Noble'], blue: ['Tôn giáo', 'Religious'], green: ['Thương mại', 'Trade'], red: ['Quân sự', 'Military'], purple: ['Đặc biệt', 'Unique'] };
const SPEEDS = { slow: ['Chậm', 'Slow'], normal: ['Vừa', 'Normal'], fast: ['Nhanh', 'Fast'] };

// Mỗi tab trình duyệt là 1 người chơi (sessionStorage) — giữ nguyên khi tải lại trang
let myId = sessionStorage.getItem('citadels-id');
if (!myId) {
  myId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessionStorage.setItem('citadels-id', myId);
}

let S = { you: null, room: null, game: null };
const ui = {
  mode: null, selected: new Set(), turnKey: null, connected: false,
  announceKey: null, prevGold: {}, prevCity: null, deltas: {}, logLen: 0,
  logOpen: {}, logFilter: 'key', rulesOpen: false,
  pick: {}, // lựa chọn nhiều bước của kỹ năng (Thẩm phán, Kẻ tống tiền, Gián điệp, Nhà ngoại giao, Thầy phép)
  show3d: (() => { try { return localStorage.getItem('citadels-3d') !== 'off'; } catch (_) { return true; } })(),
  lang: (() => { try { return localStorage.getItem('citadels-lang') === 'en' ? 'en' : 'vi'; } catch (_) { return 'vi'; } })(),
};
document.documentElement.lang = ui.lang;

// ---------- Ngôn ngữ (vi mặc định / en) ----------
const tx = (vi, en) => (ui.lang === 'en' ? en : vi);
// Dữ liệu từ server có bản tiếng Anh ở trường *En; thiếu thì dùng tiếng Việt
const cName = (c) => (ui.lang === 'en' && c.nameEn) || c.name;
const cDesc = (c) => (ui.lang === 'en' && c.descEn) || c.desc;
const chName = (r) => cName(CHARS[r]);
const chDesc = (r) => cDesc(CHARS[r]);
const colorName = (c) => (COLOR_NAME[c] ? tx(...COLOR_NAME[c]) : '');
const speeds = () => Object.fromEntries(Object.entries(SPEEDS).map(([k, v]) => [k, tx(...v)]));
const logText = (e) => (ui.lang === 'en' && e.en) || e.text;
const histEvents = (h) => (ui.lang === 'en' && h.eventsEn ? h.events.map((e, i) => h.eventsEn[i] || e) : h.events);
// Lý do không xây được (server gửi tiếng Việt)
const WHY_EN = { 'Không thể xây': 'Cannot be built', 'Đã có': 'Already built', 'Chỉ xây khi < 5 công trình': 'Only when < 5 districts',
  'Nhận tài nguyên trước': 'Gather resources first', 'Hết lượt xây': 'No builds left', 'Nhà hàng hải không được xây': 'Navigator cannot build' };
function whyText(w) {
  if (ui.lang !== 'en') return w;
  const m = /^Thiếu (\d+) vàng$/.exec(w);
  return m ? `Need ${m[1]} more gold` : WHY_EN[w] || w;
}
// Tên điểm thưởng công trình tím: tra theo tên tiếng Việt trong /cards.json
function extraName(e) {
  if (ui.lang !== 'en') return e.name;
  if (e.nameEn) return e.nameEn;
  const u = DISTRICT_DATA && DISTRICT_DATA.uniques.find((x) => x.name === e.name);
  return (u && u.nameEn) || e.name;
}
function setLang(lang) {
  ui.lang = lang;
  try { localStorage.setItem('citadels-lang', lang); } catch (_) {}
  document.documentElement.lang = lang;
  setTitle();
  render();
  renderModal();
}
const langBtn = (cls = 'small') => `<button class="${cls} lang-btn" data-act="lang" title="${tx('Switch to English', 'Chuyển sang tiếng Việt')}">🌐 ${tx('EN', 'VI')}</button>`;
function setTitle() {
  const g = S.game;
  document.title = g && g.phase !== 'ended' && g.actor === g.me ? tx('🔔 Đến lượt bạn! — Citadels', '🔔 Your turn! — Citadels') : 'Citadels Online';
}

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const send = (type, extra = {}) => socket.emit('action', { type, ...extra });
const getName = () => localStorage.getItem('citadels-name') || '';

const icon = (name, cls = '', style = '') => `<svg class="ic ${cls}" ${style ? `style="${style}"` : ''} viewBox="0 0 512 512" aria-hidden="true">${(window.ICONS || {})[name] || ''}</svg>`;

function hue(str) {
  let h = 0;
  for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

// ---------- Minh họa lá bài phong cách Citadels 2016 ----------
// Tự dựng bằng SVG (không dùng tranh gốc): bầu trời theo giờ trong ngày của từng màu, đồi & thành phố xa,
// công trình ở giữa tô gradient + viền sáng. Hình dáng đồi/tháp sinh ngẫu nhiên cố định theo key nên mỗi lá một cảnh.
const SCENE = {
  yellow: { sky: ['#f6d58a', '#e0873a'], sun: '#fff4c8', far: '#b4683e', near: '#5e321b', bld: ['#ffe6a0', '#9a5a14'] }, // hoàng hôn vàng
  blue: { sky: ['#1d2a55', '#7c9bd3'], sun: '#eef3ff', far: '#3a4d86', near: '#151d3b', bld: ['#e2ecff', '#3b5597'], stars: 1 }, // chạng vạng
  green: { sky: ['#a9d8bd', '#f3e6b0'], sun: '#fffbe2', far: '#6b955d', near: '#2c5130', bld: ['#f2ffd6', '#3b7a3a'] }, // buổi sáng
  red: { sky: ['#3a0f0d', '#d4552f'], sun: '#ffb46f', far: '#5c1c16', near: '#240b09', bld: ['#ffd2b2', '#8a2416'], smoke: 1 }, // chiều khói lửa
  purple: { sky: ['#140c2a', '#6c41a3'], sun: '#f4e8ff', far: '#38235e', near: '#170e2b', bld: ['#f3e2ff', '#6a3aa8'], stars: 1 }, // đêm phép thuật
};
let sceneDefs = false;
function ensureSceneDefs() {
  if (sceneDefs) return;
  sceneDefs = true;
  const grads = Object.entries(SCENE).map(([c, s]) => `
    <linearGradient id="sky-${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.sky[0]}"/><stop offset="1" stop-color="${s.sky[1]}"/></linearGradient>
    <linearGradient id="bld-${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.bld[0]}"/><stop offset=".55" stop-color="${s.bld[1]}"/><stop offset="1" stop-color="${s.near}"/></linearGradient>`).join('');
  // Không dùng display:none — gradient trong svg ẩn kiểu đó không được Chrome/Firefox áp dụng
  document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${grads}
    <radialGradient id="sc-glow"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".25" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="sc-vig" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
    <linearGradient id="ch-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d8"/><stop offset=".6" stop-color="#f0c66a"/><stop offset="1" stop-color="#a8701e"/></linearGradient>
  </defs></svg>`);
}
function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// ---------- Hình nền trang chủ / phòng chờ: thành phố trung cổ về đêm (tự vẽ SVG, không dùng tranh gốc) ----------
// Dựng 1 lần, đặt ngoài #app nên không bị vẽ lại (sao / đèn không giật khi phòng chờ cập nhật)
function skylineLayer(r, { ground, hMin, hMax, scale, fill, lit = 0, W, H }) {
  let x = -30;
  let d = '';
  let win = '';
  while (x < W + 30) {
    const w = (38 + r() * 72) * scale;
    const h = hMin + r() * (hMax - hMin);
    const top = ground - h;
    const k = r();
    d += `M${x.toFixed(0)},${H}V${top.toFixed(0)}`;
    if (k < 0.32) { // tường thành có lỗ châu mai
      const n = Math.max(3, Math.round(w / (11 * scale)) | 1);
      const st = w / n;
      for (let i = 0; i < n; i++) {
        const x0 = x + i * st; const x1 = x0 + st; const up = top - 7 * scale;
        d += i % 2 ? `L${x1.toFixed(1)},${top.toFixed(0)}` : `L${x0.toFixed(1)},${up.toFixed(0)}L${x1.toFixed(1)},${up.toFixed(0)}L${x1.toFixed(1)},${top.toFixed(0)}`;
      }
    } else if (k < 0.58) { // tháp mái nhọn, có cờ
      const tip = top - w * (0.9 + r() * 0.5);
      d += `L${(x - 4 * scale).toFixed(0)},${top.toFixed(0)}L${(x + w / 2).toFixed(0)},${tip.toFixed(0)}L${(x + w + 4 * scale).toFixed(0)},${top.toFixed(0)}L${(x + w).toFixed(0)},${top.toFixed(0)}`;
      if (r() < 0.5) d += `M${(x + w / 2).toFixed(0)},${tip.toFixed(0)}v${(-14 * scale).toFixed(0)}l${(12 * scale).toFixed(0)},${(4 * scale).toFixed(0)}l${(-12 * scale).toFixed(0)},${(4 * scale).toFixed(0)}z`;
    } else if (k < 0.72) { // mái vòm
      d += `A${(w / 2).toFixed(0)},${(w * 0.42).toFixed(0)} 0 0 1 ${(x + w).toFixed(0)},${top.toFixed(0)}`;
      d += `M${(x + w / 2 - 1.5 * scale).toFixed(0)},${(top - w * 0.42 + 2).toFixed(0)}v${(-16 * scale).toFixed(0)}h${(3 * scale).toFixed(1)}v${(16 * scale).toFixed(0)}z`;
    } else if (k < 0.86) { // tháp chuông nhà thờ
      d += `L${(x + w * 0.38).toFixed(0)},${top.toFixed(0)}L${(x + w * 0.5).toFixed(0)},${(top - h * 0.9).toFixed(0)}L${(x + w * 0.62).toFixed(0)},${top.toFixed(0)}L${(x + w).toFixed(0)},${top.toFixed(0)}`;
    } else { // nhà mái dốc
      d += `L${(x + w / 2).toFixed(0)},${(top - w * 0.38).toFixed(0)}L${(x + w).toFixed(0)},${top.toFixed(0)}`;
    }
    d += `V${H}Z`;
    // Cửa sổ thắp đèn
    if (lit) {
      const n = Math.floor(r() * 4 * lit);
      for (let i = 0; i < n; i++) {
        const wx = x + 6 * scale + r() * Math.max(1, w - 14 * scale);
        const wy = top + 12 * scale + r() * Math.max(1, h - 30 * scale);
        if (r() < 0.25) r(); // giữ nguyên chuỗi số ngẫu nhiên (bố cục thành phố không đổi)
        win += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="${(4 * scale).toFixed(1)}" height="${(6 * scale).toFixed(1)}" rx="1"/>`;
      }
    }
    x += w + r() * 14 * scale;
  }
  return `<path d="${d}" fill="${fill}"/>${win ? `<g class="wins">${win}</g>` : ''}`;
}

function ensureBackdrop() {
  if (document.getElementById('scene-bg')) return;
  const W = 1600, H = 900;
  const r = rng(2016);
  const stars = Array.from({ length: 170 }, () => {
    const x = r() * W, y = r() * H * 0.62, rad = 0.3 + r() * r() * 1.6;
    if (r() < 0.22) r(); // giữ nguyên chuỗi số ngẫu nhiên (bố cục thành phố không đổi)
    return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rad.toFixed(2)}"/>`;
  }).join('');
  const el = document.createElement('div');
  el.id = 'scene-bg';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice">
    <defs>
      <linearGradient id="bg-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070a14"/><stop offset=".55" stop-color="#111a33"/><stop offset=".82" stop-color="#22305a"/><stop offset="1" stop-color="#3a3550"/></linearGradient>
      <radialGradient id="bg-moon" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6dc"/><stop offset=".55" stop-color="#ffe7a8"/><stop offset="1" stop-color="#e8b54f"/></radialGradient>
      <radialGradient id="bg-halo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe2a0" stop-opacity=".35"/><stop offset="1" stop-color="#ffe2a0" stop-opacity="0"/></radialGradient>
      <radialGradient id="bg-glow" cx=".5" cy="1" r=".7"><stop offset="0" stop-color="#e8964f" stop-opacity=".32"/><stop offset="1" stop-color="#e8964f" stop-opacity="0"/></radialGradient>
      <linearGradient id="bg-mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fa3d6" stop-opacity="0"/><stop offset="1" stop-color="#8fa3d6" stop-opacity=".16"/></linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg-sky)"/>
    <g class="stars" fill="#f3ead2">${stars}</g>
    <circle cx="1290" cy="170" r="150" fill="url(#bg-halo)"/>
    <circle cx="1290" cy="170" r="44" fill="url(#bg-moon)"/>
    <circle cx="1276" cy="160" r="8" fill="#e8c77a" opacity=".35"/><circle cx="1302" cy="186" r="5" fill="#e8c77a" opacity=".3"/>
    <ellipse cx="${W / 2}" cy="${H}" rx="${W * 0.7}" ry="330" fill="url(#bg-glow)"/>
    ${skylineLayer(r, { ground: 640, hMin: 50, hMax: 190, scale: 0.7, fill: '#1c2a4c', lit: 0.4, W, H })}
    <rect y="520" width="${W}" height="${H - 520}" fill="url(#bg-mist)"/>
    ${skylineLayer(r, { ground: 720, hMin: 60, hMax: 220, scale: 0.95, fill: '#111a31', lit: 0.9, W, H })}
    <rect y="700" width="${W}" height="${H - 700}" fill="#111a31"/>
    ${skylineLayer(r, { ground: 810, hMin: 40, hMax: 160, scale: 1.25, fill: '#070b16', lit: 1.4, W, H })}
    <rect y="790" width="${W}" height="${H - 790}" fill="#070b16"/>
  </svg>${twinkles()}`;
  document.body.prepend(el);
}

// Vài ngôi sao lấp lánh: phần tử HTML riêng chỉ đổi opacity (GPU làm) — SVG nền giữ tĩnh, không phải vẽ lại
function twinkles() {
  const r = rng(77);
  return `<div class="twinkle">${Array.from({ length: 14 }, () => `<i style="left:${(r() * 100).toFixed(1)}%;top:${(2 + r() * 38).toFixed(1)}%;animation-delay:${(r() * 3.6).toFixed(1)}s;transform:scale(${(0.6 + r() * 0.7).toFixed(2)})"></i>`).join('')}</div>`;
}

function hillPath(r, base, amp, w = 140, h = 104) {
  const f1 = 0.03 + r() * 0.04; const f2 = 0.08 + r() * 0.06; const p1 = r() * 6; const p2 = r() * 6;
  let d = `M0 ${h}`;
  for (let x = 0; x <= w; x += 7) d += ` L${x} ${(base - amp * Math.sin(x * f1 + p1) - amp * 0.35 * Math.sin(x * f2 + p2)).toFixed(1)}`;
  return `${d} L${w} ${h}Z`;
}
const sceneCache = {};
function sceneSvg(key, color) {
  const id = `${key}|${color}`;
  if (sceneCache[id]) return sceneCache[id];
  ensureSceneDefs();
  const s = SCENE[color] || SCENE.purple;
  let seed = 7;
  for (const ch of String(key)) seed = Math.imul(seed ^ ch.charCodeAt(0), 2654435761);
  const r = rng(seed);
  const sunX = r() < 0.5 ? 18 + r() * 24 : 98 + r() * 24;
  const sunY = 18 + r() * 14;
  let extra = '';
  if (s.stars) for (let i = 0; i < 14; i++) extra += `<circle cx="${(r() * 140).toFixed(1)}" cy="${(r() * 48).toFixed(1)}" r="${(0.4 + r() * 0.8).toFixed(2)}" fill="#fff" opacity="${(0.4 + r() * 0.6).toFixed(2)}"/>`;
  if (s.smoke) for (let i = 0; i < 3; i++) extra += `<ellipse cx="${(20 + r() * 100).toFixed(1)}" cy="${(30 + r() * 20).toFixed(1)}" rx="${(18 + r() * 16).toFixed(1)}" ry="5" fill="#000" opacity=".22"/>`;
  // Thành phố xa: tháp & mái nhọn
  let towers = '';
  for (let x = -4; x < 140;) {
    const w = 5 + r() * 7; const hh = 7 + r() * 16; const y = 74 - hh;
    towers += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}"/>`;
    if (r() < 0.55) towers += `<path d="M${(x - 1).toFixed(1)} ${y.toFixed(1)} L${(x + w / 2).toFixed(1)} ${(y - 5 - r() * 7).toFixed(1)} L${(x + w + 1).toFixed(1)} ${y.toFixed(1)}Z"/>`;
    x += w + 1 + r() * 6;
  }
  const art = ((window.ICONS || {})[key] || '').replace(/currentColor/g, `url(#bld-${color})`);
  const rim = ((window.ICONS || {})[key] || '').replace(/currentColor/g, s.sun);
  const out = `<svg class="scene" viewBox="0 0 140 104" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="140" height="104" fill="url(#sky-${color})"/>${extra}
    <circle cx="${sunX.toFixed(1)}" cy="${sunY.toFixed(1)}" r="26" fill="url(#sc-glow)" opacity=".8"/>
    <circle cx="${sunX.toFixed(1)}" cy="${sunY.toFixed(1)}" r="7" fill="${s.sun}"/>
    <path d="${hillPath(r, 70, 6)}" fill="${s.far}" opacity=".75"/>
    <g fill="${s.far}" opacity=".9">${towers}</g>
    <path d="${hillPath(r, 86, 5)}" fill="${s.near}"/>
    <ellipse cx="70" cy="93" rx="40" ry="6" fill="#000" opacity=".35"/>
    <svg x="29" y="11" width="82" height="82" viewBox="0 0 512 512" opacity=".55">${rim}</svg>
    <svg x="31" y="13" width="82" height="82" viewBox="0 0 512 512">${art}</svg>
    <rect width="140" height="104" fill="url(#sc-vig)"/>
  </svg>`;
  return (sceneCache[id] = out);
}

function avatar(name, { isBot = false, online = null, id = name, voiceAct = false } = {}) {
  const inner = isBot ? icon('robot') : esc(String(name).trim().charAt(0).toUpperCase() || '?');
  const dot = online === null ? '' : `<span class="on-dot ${online ? '' : 'off'}"></span>`;
  const speak = window.Voice && Voice.speaking.has(id) ? 'speaking' : '';
  return `<span class="avatar ${speak}" data-voice="${esc(id)}" style="--h:${hue(id)}">${inner}${dot}${voiceBadge(id, voiceAct)}</span>`;
}

// ---------- Thoại (WebRTC, xem voice.js) ----------
// Icon nét vẽ (SVG) — emoji micro hiển thị không đều giữa các máy
const VSVG = {
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  micOff: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/><path class="x" d="M4 4l16 16"/>',
  head: '<path d="M4 16v-4a8 8 0 0 1 16 0v4"/><rect x="3" y="14" width="4.5" height="7" rx="1.5"/><rect x="16.5" y="14" width="4.5" height="7" rx="1.5"/>',
  headOff: '<path d="M4 16v-4a8 8 0 0 1 16 0v4"/><rect x="3" y="14" width="4.5" height="7" rx="1.5"/><rect x="16.5" y="14" width="4.5" height="7" rx="1.5"/><path class="x" d="M4 4l16 16"/>',
  spkOff: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path class="x" d="M16 9.5l5 5M21 9.5l-5 5"/>',
  hang: '<path d="M3 14.5c5-4.6 13-4.6 18 0l-2.3 2.7-3.6-1.5v-2.5a12 12 0 0 0-6.2 0v2.5l-3.6 1.5z"/>',
};
const vIcon = (k) => `<svg class="vi" viewBox="0 0 24 24" aria-hidden="true">${VSVG[k]}</svg>`;
const voiceOf = (id) => { const m = S.room && S.room.members.find((x) => x.id === id); return m ? m.voice : null; };
// Trạng thái huy hiệu micro trên avatar: đang tắt mic / bị mình tắt tiếng / đang nối / không nối được
function voiceBadgeCls(id) {
  const v = voiceOf(id);
  const V = window.Voice;
  const cls = ['v-badge'];
  if (v === 'muted') cls.push('muted');
  if (V && V.silenced.has(id)) cls.push('silenced');
  if (V && V.on && id !== S.you) {
    const st = V.peerState(id);
    if (st === 'failed') cls.push('fail');
    else if (st !== 'connected') cls.push('wait');
  }
  return cls.join(' ');
}
function voiceBadgeTip(id) {
  const V = window.Voice;
  if (id === S.you) return V && V.muted ? tx('Micro của bạn đang tắt — bấm để bật', 'Your mic is off — click to unmute') : tx('Bạn đang trong thoại — bấm để tắt micro', 'You are in voice — click to mute');
  const st = V && V.on ? V.peerState(id) : 'connected';
  if (st === 'failed') return tx('Không nối được âm thanh với người này (mạng chặn kết nối trực tiếp)', 'Could not connect audio with this player (network blocks direct connections)');
  if (st !== 'connected') return tx('Đang nối âm thanh…', 'Connecting audio…');
  const muted = voiceOf(id) === 'muted' ? tx('Đang tắt micro. ', 'Mic is off. ') : '';
  return muted + (V && V.silenced.has(id) ? tx('Bạn đã tắt tiếng người này — bấm để nghe lại', 'You muted this player — click to hear them again') : tx('Đang trong thoại — bấm để tắt tiếng riêng người này', 'In voice — click to mute this player for you'));
}
function voiceBadge(id, clickable) {
  const v = voiceOf(id);
  if (!v) return '';
  const ic = vIcon(v === 'muted' ? 'micOff' : window.Voice && Voice.silenced.has(id) ? 'spkOff' : 'mic');
  return `<span class="${voiceBadgeCls(id)}" ${clickable ? `data-act="voicePeer" data-id="${esc(id)}"` : ''} title="${esc(voiceBadgeTip(id))}">${ic}</span>`;
}
// Cập nhật nhẹ (không vẽ lại cả trang): viền người đang nói + trạng thái kết nối
function updateVoiceDom() {
  document.querySelectorAll('[data-voice]').forEach((el) => {
    const id = el.dataset.voice;
    el.classList.toggle('speaking', !!window.Voice && Voice.speaking.has(id));
    const b = el.querySelector('.v-badge');
    if (b) { b.className = voiceBadgeCls(id); b.title = voiceBadgeTip(id); }
  });
}

function voiceCtl() {
  const V = window.Voice;
  if (!V || !S.room) return '';
  const n = S.room.members.filter((m) => m.voice).length;
  const cnt = n ? `<span class="v-count" title="${tx('Số người đang trong thoại', 'People in voice')}">${n}</span>` : '';
  if (!V.on) {
    return `<button class="small voice-btn" data-act="voiceJoin" ${V.busy ? 'disabled' : ''} title="${tx('Vào kênh thoại của phòng (cần micro)', 'Join the room voice chat (needs a microphone)')}">${vIcon('mic')} <span class="tb-l">${V.busy ? tx('Đang bật…', 'Starting…') : tx('Thoại', 'Voice')}</span>${cnt}</button>`;
  }
  return `<span class="voice-ctl">
    <button class="small v-mic ${V.muted ? 'off' : ''}" data-act="voiceMute" title="${V.muted ? tx('Bật micro (M)', 'Unmute (M)') : tx('Tắt micro (M)', 'Mute (M)')}">${vIcon(V.muted ? 'micOff' : 'mic')}</button>
    <button class="small v-deaf ${V.deaf ? 'off' : ''}" data-act="voiceDeaf" title="${V.deaf ? tx('Bật loa', 'Undeafen') : tx('Tắt loa — không nghe người khác', 'Deafen — stop hearing others')}">${vIcon(V.deaf ? 'headOff' : 'head')}</button>
    <button class="small v-leave" data-act="voiceLeave" title="${tx('Rời thoại', 'Leave voice')}">${vIcon('hang')} <span class="tb-l">${tx('Rời thoại', 'Leave')}</span>${cnt}</button>
  </span>`;
}

const VOICE_ERR = {
  insecure: ['Thoại cần kết nối HTTPS (hoặc localhost). Hãy mở game bằng link https.', 'Voice needs HTTPS (or localhost). Open the game via an https link.'],
  unsupported: ['Trình duyệt này không hỗ trợ thoại.', 'This browser does not support voice chat.'],
  denied: ['Chưa được cấp quyền micro — bấm biểu tượng ổ khóa trên thanh địa chỉ để cho phép.', 'Microphone permission denied — allow it from the lock icon in the address bar.'],
  nomic: ['Không tìm thấy micro.', 'No microphone found.'],
};
async function voiceJoin() {
  try { await Voice.join(); toast(tx('Đã vào thoại — bấm M để tắt/bật micro', 'Joined voice — press M to mute/unmute'), 'info'); } catch (e) {
    console.warn(e);
    toast(tx(...(VOICE_ERR[e.code] || VOICE_ERR.denied)));
  }
}

function toast(msg, kind = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `show ${kind}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.className = ''), 2600);
}

// ---------- Nhận trạng thái ----------
socket.on('connect', () => { ui.connected = true; socket.emit('hello', { id: myId }); if (window.Voice) Voice.rejoin(); });
if (window.Voice) {
  Voice.init(socket, () => S.you || myId);
  Voice.onChange = (kind) => (kind === 'state' ? render() : updateVoiceDom());
}
socket.on('disconnect', () => { ui.connected = false; toast(tx('Mất kết nối, đang thử lại...', 'Disconnected, reconnecting...')); render(); });
// Lỗi từ server: chuỗi (cũ) hoặc { vi, en }
socket.on('errorMsg', (m) => toast(typeof m === 'string' ? m : tx(m.vi, m.en || m.vi)));
socket.on('state', (s) => {
  S = s;
  if (window.Voice) Voice.sync(s.room ? s.room.members : null);
  const g = s.game;
  CHARS = g && g.cast ? castToChars(g.cast) : BASE_CHARS;
  // Lượt mới (hoặc Phù thủy tiếp quản): xóa mọi lựa chọn dang dở
  const key = g ? `${g.round}-${g.phase}-${g.currentRank}-${g.turn ? g.turn.pi : ''}` : null;
  if (key !== ui.turnKey) { ui.turnKey = key; ui.mode = null; ui.selected.clear(); ui.turnPopupHidden = false; ui.abilityPopup = false; ui.pick = {}; }
  // Kỹ năng đã dùng xong → thoát chế độ chọn ô công trình
  if (g && g.turn && g.turn.abilityUsed && ['warlord', 'marshal', 'diplomat', 'artist'].includes(ui.mode)) { ui.mode = null; ui.pick.dip = null; }
  // Mỗi lần tới lượt chọn nhân vật mới: bảng chọn tự bật lại
  const pickKey = g && g.draft && g.draft.options ? `${g.round}-${g.draft.idx}-${g.draft.awaitingDiscard}` : null;
  if (pickKey !== ui.pickKey) { ui.pickKey = pickKey; ui.pickerHidden = false; }
  setTitle();
  if (g) { trackChanges(g); announce(g); sfxFor(g); markFreshLog(g); } else { ui.prevGold = {}; ui.prevCity = null; ui.lastLogId = null; }
  sfxChat(s.room);
  render();
  if (g) flyCoins(g);
});

// ---------- Âm thanh (public/sfx.js) ----------
const sfx = (name, delay) => window.Sfx && Sfx.play(name, delay);
// Sự kiện mới trong nhật ký → 1–2 tiếng theo mức quan trọng; vàng của mình đổi → tiếng xu
function sfxFor(g) {
  if (ui.lastLogId == null) return; // vừa tải trang: im lặng
  const tones = new Set(g.log.filter((e) => e.id > ui.lastLogId).map((e) => e.tone));
  const d = 0.12; // chờ tiếng thông báo (vòng mới / lộ diện) phát trước
  if (tones.has('finish') && g.phase !== 'ended') sfx('finish', d);
  else if (tones.has('attack')) sfx('attack', d);
  else if (tones.has('build')) sfx('build', d);
  else if (tones.has('crown')) sfx('crown', d);
  const mine = g.players[g.me] && ui.deltas[g.players[g.me].id];
  if (mine > 0) sfx('coin', 0.05); else if (mine < 0) sfx('coinLoss', 0.05);
}
// Tin nhắn mới của người khác
function sfxChat(room) {
  const chat = room ? room.chat : [];
  const lastAt = chat.length ? chat[chat.length - 1].at : 0;
  const prev = ui.sfxChatAt;
  ui.sfxChatAt = lastAt;
  if (prev == null || lastAt <= prev) return;
  const me = room.members.find((m) => m.id === S.you);
  if (chat.some((m) => m.at > prev && (!me || m.name !== me.name))) sfx('chat');
}

// Dòng nhật ký mới (id lớn hơn lần nhận trước) sẽ sáng lên vài giây; lần tải trang đầu không đánh dấu
function markFreshLog(g) {
  const maxId = g.log.length ? g.log[g.log.length - 1].id : 0;
  ui.freshFrom = ui.lastLogId == null ? maxId : ui.lastLogId;
  ui.lastLogId = maxId;
}

// Phân loại việc vừa làm để tô màu: tấn công / xây / nhận thêm
function noteTone(text) {
  if (/Ám sát|trộm|Phá |Đổi bài|Bị /.test(text)) return 'n-attack';
  if (/^Xây|Hoàn thành/.test(text)) return 'n-build';
  if (/\+|vương miện/.test(text)) return 'n-gain';
  return '';
}

// ---------- Đồng xu bay khi vàng thay đổi ----------
function coinTrip(from, to, i, fade) {
  const c = document.createElement('div');
  c.className = 'coin-fly';
  document.body.appendChild(c);
  const mid = { x: (from.x + to.x) / 2 + (Math.random() - 0.5) * 80, y: Math.min(from.y, to.y) - 60 - Math.random() * 40 };
  const anim = c.animate([
    { transform: `translate(${from.x}px, ${from.y}px) scale(.6)`, opacity: 0 },
    { transform: `translate(${from.x}px, ${from.y}px) scale(1)`, opacity: 1, offset: 0.1 },
    { transform: `translate(${mid.x}px, ${mid.y}px) scale(1.15) rotateY(360deg)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${to.x}px, ${to.y}px) scale(.8) rotateY(720deg)`, opacity: fade ? 0 : 1 },
  ], { duration: 900 + i * 60, delay: i * 90, easing: 'cubic-bezier(.4,.1,.3,1)', fill: 'both' });
  anim.onfinish = () => c.remove();
}

function flyCoins(g) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const center = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + 14, y: r.top + r.height / 2 - 9 }; };
  const chips = {};
  // Chỉ nhắm tới ô vàng đang hiển thị (ô thông tin có thể bị ẩn theo kích thước màn hình)
  document.querySelectorAll('[data-gold]').forEach((el) => { if (el.offsetParent) chips[el.dataset.gold] = el; });
  const bankEl = document.querySelector('.topbar .title');
  if (!bankEl) return;
  const bank = center(bankEl);
  const deltas = Object.entries(ui.deltas).filter(([id]) => chips[id]);
  const gains = deltas.filter(([, d]) => d > 0);
  const losses = deltas.filter(([, d]) => d < 0);
  // Bị trộm: đúng 1 người mất, 1 người được cùng số vàng → xu bay thẳng từ người này sang người kia
  if (gains.length === 1 && losses.length === 1 && gains[0][1] === -losses[0][1]) {
    const n = Math.min(gains[0][1], 8);
    for (let i = 0; i < n; i++) coinTrip(center(chips[losses[0][0]]), center(chips[gains[0][0]]), i, false);
    return;
  }
  for (const [id, d] of gains) for (let i = 0; i < Math.min(d, 6); i++) coinTrip(bank, center(chips[id]), i, false);
  for (const [id, d] of losses) for (let i = 0; i < Math.min(-d, 6); i++) coinTrip(center(chips[id]), bank, i, true);
}

// ---------- Rê chuột lên lá bài: nhô lên + nghiêng theo chuột, không giật ----------
// Lá nhô lên/phóng to bằng transform nên vùng trỏ thật di chuyển theo. Dùng :hover sẽ chập chờn ở mép lá
// (lá nhô → chuột ra ngoài → lá hạ → lại trỏ trúng...). Thay bằng lớp .hov do JS quản lý, tính theo vị trí GỐC của lá:
// - quạt bài: chia vùng theo chiều ngang của từng lá (offsetLeft — không bị transform ảnh hưởng);
// - lá khác: giữ lá đang trỏ khi chuột còn trong vị trí gốc hoặc vị trí đang nhô của nó.
// Mỗi lần vẽ lại toàn bộ DOM, lá đang trỏ được gắn lại .hov ngay (không chạy lại hiệu ứng nhô lên).
const HOV_SEL = '.dcard, .ccard, .choice';
const LANDSCAPE_PHONE = matchMedia('(max-height: 500px) and (orientation: landscape)');
const hov = { el: null, key: null, base: null, x: -1, y: -1, raf: 0 };
const inRect = (r, x, y) => r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

function fanHit(fan, x) {
  const cards = [...fan.querySelectorAll('.dcard')];
  if (!cards.length) return null;
  // .fan là gốc offset (position: relative); s = tỉ lệ thu nhỏ của quạt (điện thoại xoay ngang)
  const r = fan.getBoundingClientRect();
  const s = fan.offsetWidth ? r.width / fan.offsetWidth : 1;
  for (let k = cards.length - 1; k >= 0; k--) {
    const left = r.left + (fan.clientLeft + cards[k].offsetLeft) * s;
    if (x >= left && x <= left + cards[k].offsetWidth * s) return cards[k];
  }
  return null;
}

function setHov(el) {
  if (hov.el === el) return;
  if (hov.el) hov.el.classList.remove('hov');
  hov.el = el;
  hov.key = el ? el.dataset.k : null;
  hov.base = el ? el.getBoundingClientRect() : null;
  if (el) el.classList.add('hov');
}

function updateHov() {
  hov.raf = 0;
  const { x, y } = hov;
  const under = document.elementFromPoint(x, y);
  // Trong quạt bài (kể cả phần lá đang nhô lên và khoảng trống lá vừa rời): chọn lá theo cột ngang
  const fan = under && under.closest('.hand-tray .fan');
  let el = fan ? fanHit(fan, x) : null;
  if (!fan) {
    el = under && under.closest(HOV_SEL);
    const cur = hov.el && hov.el.isConnected && !hov.el.closest('.fan') ? hov.el : null;
    if (!el && cur && (inRect(hov.base, x, y) || inRect(cur.getBoundingClientRect(), x, y))) el = cur;
  }
  setHov(el);
  if (!el || !hov.base) return;
  // Độ nghiêng tính theo vị trí gốc (cố định) → không có vòng lặp nghiêng ↔ đo lại
  const b = hov.base;
  const px = Math.max(0, Math.min(1, (x - b.left) / b.width));
  const py = Math.max(0, Math.min(1, (y - b.top) / b.height));
  el.style.setProperty('--ry', `${((px - 0.5) * 14).toFixed(1)}deg`);
  el.style.setProperty('--rx', `${((0.5 - py) * 10).toFixed(1)}deg`);
  el.style.setProperty('--mx', `${(px * 100).toFixed(0)}%`);
  el.style.setProperty('--my', `${(py * 100).toFixed(0)}%`);
}

document.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  hov.x = e.clientX; hov.y = e.clientY;
  if (!hov.raf) hov.raf = requestAnimationFrame(updateHov);
}, { passive: true });
document.addEventListener('pointerleave', () => { hov.x = hov.y = -1; setHov(null); });
// Màn cảm ứng không có rê chuột: chạm lá trong quạt bài lần 1 = nâng lên phóng to để đọc, chạm lần 2 = thực hiện
// (tránh lỡ tay xây khi các lá chồng sát nhau). Chạm ra ngoài quạt = hạ bài xuống.
let lastPointer = 'mouse';
document.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; }, { capture: true, passive: true });
document.addEventListener('click', (e) => {
  if (lastPointer === 'mouse') return;
  const fan = e.target.closest && e.target.closest('.hand-tray .fan');
  if (!fan) { if (hov.el && hov.el.closest('.fan')) { hov.x = hov.y = -1; setHov(null); } return; }
  const card = e.target.closest('.dcard') || fanHit(fan, e.clientX);
  if (!card || hov.el === card) return; // lá đang phóng to → để click đi tiếp (xây / chọn)
  e.stopImmediatePropagation();
  e.preventDefault();
  hov.x = e.clientX; hov.y = e.clientY;
  setHov(card);
}, true);
// Cuộn trang: vị trí gốc đã đổi → đo lại
window.addEventListener('scroll', () => { if (hov.el) { const el = hov.el; setHov(null); if (hov.x >= 0) updateHov(); else el.classList.remove('hov'); } }, { passive: true, capture: true });

// Gọi sau mỗi lần vẽ lại: gắn lại trạng thái trỏ cho lá tương ứng mà không chạy lại transition
function restoreHov() {
  if (!hov.key || hov.x < 0) { hov.el = null; return; }
  const el = [...document.querySelectorAll(HOV_SEL)].find((n) => n.dataset.k === hov.key);
  const old = hov.el;
  hov.el = null;
  if (!el) { hov.key = null; return; }
  el.classList.add('hov', 'snap');
  if (old) for (const v of ['--rx', '--ry', '--mx', '--my']) el.style.setProperty(v, old.style.getPropertyValue(v));
  hov.el = el;
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('snap')));
  // Vị trí gốc đo khi chưa có transform nhô lên
  el.classList.remove('hov');
  hov.base = el.getBoundingClientRect();
  el.classList.add('hov');
  updateHov();
}

// Hiệu ứng xuất hiện (fade/trượt vào) chỉ chạy lần đầu phần tử hiện ra, không chạy lại mỗi lần vẽ lại
const ENTER_SEL = '.picker-bg, .turn-dock, .chat-pop, .ts-last, .feed li, .chat-badge';
const enterKey = (el) => `${el.className.split(' ')[0]}|${el.matches('.ts-last, .feed li, .chat-badge') ? el.textContent : ''}`;

// Ghi nhận thay đổi vàng & công trình mới để tạo hiệu ứng
function trackChanges(g) {
  ui.deltas = {};
  const city = new Set();
  for (const p of g.players) {
    const prev = ui.prevGold[p.id];
    if (prev !== undefined && prev !== p.gold) ui.deltas[p.id] = p.gold - prev;
    ui.prevGold[p.id] = p.gold;
    p.city.forEach((c) => city.add(c.id));
  }
  ui.newTiles = ui.prevCity ? new Set([...city].filter((id) => !ui.prevCity.has(id))) : new Set();
  ui.prevCity = city;
}

// Thông báo lớn giữa màn hình khi sang vòng mới / nhân vật lộ diện
function announce(g) {
  let key = null;
  let html = '';
  if (g.phase === 'draft') {
    key = `d${g.round}`;
    html = `<div class="announce">${icon('scroll', '', 'width:56px;height:56px;color:var(--gold)')}<div class="big">${tx('Vòng', 'Round')} ${g.round}</div><div class="who">${tx('Chọn nhân vật', 'Choose characters')}</div></div>`;
  } else if (g.phase === 'turns' && g.turn) {
    key = `t${g.round}-${g.turn.rank}`;
    const p = g.players[g.turn.pi];
    const r = g.turn.rank;
    // Lá nhân vật lật 3D: mặt sau "?" → mặt trước huy hiệu
    html = `<div class="announce ch-${r}"><div class="flipcard"><div class="fc-face fc-back">?</div><div class="fc-face fc-front">${medal(r, 'lg')}</div></div><div class="big">${chName(r)}</div>
      <div class="who">${g.turn.pi === g.me ? tx('⭐ Đến lượt bạn!', '⭐ Your turn!') : `${tx('là', 'is')} <b>${esc(p.name)}</b>`}</div></div>`;
  } else if (g.phase === 'ended') {
    key = `end${g.round}`;
    html = `<div class="announce">${icon('trophy', '', 'width:64px;height:64px;color:var(--gold)')}
      <div class="big">${esc(g.results[0].name)}</div><div class="who">${tx(`chiến thắng với ${g.results[0].total} điểm!`, `wins with ${g.results[0].total} points!`)}</div></div>`;
  }
  if (!key || key === ui.announceKey) return;
  const first = ui.announceKey === null;
  ui.announceKey = key;
  if (first) return; // không phát lại khi vừa tải trang
  sfx(g.phase === 'draft' ? 'round' : g.phase === 'ended' ? 'finish' : g.turn.pi === g.me ? 'turn' : 'reveal');
  $('#overlay').innerHTML = html;
  clearTimeout(announce.timer);
  announce.timer = setTimeout(() => { $('#overlay').innerHTML = ''; }, 2300);
}

// ---------- Thành phần HTML ----------
function medal(r, size = '') {
  return `<span class="medal ch-${r} ${size}" title="${esc(chName(r))}">${icon(CHARS[r].icon)}<span class="num">${r}</span></span>`;
}

// Giá kiểu bản 2016: chồng đồng xu ở góc trên trái, đồng trên cùng ghi số
function coinStack(c) {
  if (c.noBuild) return '<div class="cost"><i class="cc top">✕</i></div>';
  const n = Math.min(c.cost, 6);
  return `<div class="cost">${Array.from({ length: n }, (_, k) => `<i class="cc ${k ? '' : 'top'}">${k ? '' : c.cost}</i>`).join('')}</div>`;
}

function cardHtml(c, { cls = '', act = '', tag = '', tagOff = false, style = '' } = {}) {
  return `<div class="dcard c-${c.color} ${cls}" data-k="${c.id}" ${style ? `style="${style}"` : ''} ${act ? `data-act="${act}" data-id="${c.id}"` : ''} title="${esc(cDesc(c) || colorName(c.color))}">
    <div class="art">${sceneSvg(c.key, c.color)}</div>
    ${coinStack(c)}
    <div class="banner"><span class="nm">${esc(cName(c))}</span></div>
    <div class="plate"><div class="ty"><i class="gem"></i>${colorName(c.color)}</div>
    ${c.desc ? `<div class="ds">${esc(cDesc(c))}</div>` : ''}</div>
    ${tag ? `<div class="tag ${tagOff ? 'off' : ''}">${tag}</div>` : ''}
  </div>`;
}


// Ô công trình thu nhỏ trong bảng người chơi (tên & giá xem khi rê chuột)
// mark: ô đang là mục tiêu kỹ năng { act, target, cost, badge, label } (phá / lấy / đổi / trang trí)
function tileHtml(c, mark) {
  const cls = [`mt c-${c.color}`];
  if (mark) cls.push('target');
  if (c.beauty) cls.push('beauty');
  if (ui.newTiles && ui.newTiles.has(c.id)) cls.push('new');
  const value = c.cost + (c.beauty || 0);
  const attrs = mark ? `data-act="${mark.act}" data-target="${mark.target}" data-id="${c.id}"` : '';
  const tip = `${cName(c)} · ${value} ${tx('vàng', 'gold')}${c.beauty ? tx(' (đã trang trí +1)', ' (adorned +1)') : ''}${c.desc ? ' — ' + cDesc(c) : ''}${mark ? ` · ${mark.label}` : ''}`;
  return `<span class="${cls.join(' ')}" ${attrs} title="${esc(tip)}">${icon(c.key)}<span class="mt-c">${value}</span>${mark ? `<span class="mt-d">${mark.badge}</span>` : ''}</span>`;
}

// Các ô công trình là mục tiêu của chế độ kỹ năng hiện tại (Lãnh chúa / Thống chế / Nhà ngoại giao / Nghệ sĩ)
function skillMarks(g) {
  const out = [];
  if (ui.mode === 'warlord') for (const d of g.destroyable || []) out.push({ ...d, act: 'destroy', badge: `⚔${d.cost}`, label: tx(`Bấm để phá: ${d.cost} vàng`, `Click to destroy: ${d.cost} gold`) });
  if (ui.mode === 'marshal') for (const d of g.seizable || []) out.push({ ...d, act: 'seize', badge: `⚑${d.cost}`, label: tx(`Bấm để lấy về: trả ${d.cost} vàng`, `Click to seize: pay ${d.cost} gold`) });
  if (ui.mode === 'diplomat') for (const d of g.swappable || []) out.push({ ...d, act: 'dipPick', badge: '⇄', label: tx(`Bấm để đổi (chênh lệch từ ${d.cost} vàng)`, `Click to exchange (difference from ${d.cost} gold)`) });
  if (ui.mode === 'artist') {
    for (const c of g.players[g.me].city) if (!c.beauty) out.push({ target: g.me, cardId: c.id, cost: 1, act: 'beautify', badge: '✨', label: tx('Bấm để trang trí: 1 vàng, +1 giá trị', 'Click to adorn: 1 gold, +1 value') });
  }
  return out;
}

// Lá nhân vật kiểu bản 2016: chân dung trong khung vòm, số thứ tự lớn góc trái, ngọc màu (nếu có) góc phải
function charCard(r, act = '', { off = false, desc = '', style = '' } = {}) {
  const c = CHARS[r];
  ensureSceneDefs();
  const art = ((window.ICONS || {})[c.icon] || '').replace(/currentColor/g, 'url(#ch-gold)');
  return `<div class="ccard ch-${r} ${off ? 'off' : act ? 'clickable' : ''}" data-k="r${r}" ${style ? `style="${style}"` : ''} ${act && !off ? `data-act="${act}" data-rank="${r}"` : ''}>
    <div class="c-art"><svg class="c-por" viewBox="0 0 512 512" aria-hidden="true">${art}</svg></div>
    <span class="c-rank">${r}</span>${c.color ? `<i class="c-gem c-${c.color}"></i>` : ''}
    <div class="banner"><span class="cn">${cName(c)}</span></div><div class="cd">${desc || cDesc(c)}</div></div>`;
}

const waitDots = '<span class="dots"><span></span><span></span><span></span></span>';

// ---------- Render ----------
function render() {
  // Nhạc nền: phát ở mọi màn (sau lần chạm đầu tiên); đang trong thoại thì nhỏ lại
  if (window.Sfx) Sfx.music(true, !!(window.Voice && Voice.on));
  const active = document.activeElement;
  const keep = active && active.id ? { id: active.id, val: active.value, pos: active.selectionStart } : null;
  // Nhật ký: có sự kiện mới → luôn cuộn tới dòng mới nhất; không có → giữ nguyên chỗ đang xem
  const logEl = $('.log');
  const logTop = logEl ? logEl.scrollTop : 0;
  const g0 = S.game;
  const logMax = g0 && g0.log.length ? g0.log[g0.log.length - 1].id : null;
  const logNew = logMax !== ui.logSeenId;
  const shown = new Set([...document.querySelectorAll(`#app :is(${ENTER_SEL})`)].map(enterKey));

  ensureBackdrop();
  document.body.classList.toggle('scenic', !S.game); // hình nền chỉ ở trang chủ & phòng chờ
  if (!S.room) $('#app').innerHTML = renderHome();
  else if (!S.game) $('#app').innerHTML = renderLobby();
  else $('#app').innerHTML = renderGame();

  if (keep) {
    const el = document.getElementById(keep.id);
    if (el) { el.value = keep.val; el.focus(); try { el.setSelectionRange(keep.pos, keep.pos); } catch (_) {} }
  }
  const newLog = $('.log');
  if (newLog) {
    newLog.scrollTop = logTop;
    // Cuộn tức thì (cuộn mượt sẽ bị lần vẽ lại kế tiếp cắt ngang); dòng mới đã có hiệu ứng sáng lên
    if (logNew || !logEl) { newLog.scrollTop = newLog.scrollHeight; ui.logSeenId = logMax; }
  }
  const cl = $('.chatlog');
  if (cl) cl.scrollTop = cl.scrollHeight;
  document.querySelectorAll(`#app :is(${ENTER_SEL})`).forEach((el) => { if (shown.has(enterKey(el))) el.style.animation = 'none'; });
  placeTray();
  watchStage();
  equalCards();
  restoreHov();
  sync3d();
}

// Khay bài thu gọn khi bàn 3D ra khỏi tầm nhìn (cuộn xuống xem thành phố): chỉ còn viên "Bài trên tay",
// tránh quạt bài lơ lửng giữa khoảng trống. Tới lượt mình (có thanh điều khiển) thì khay luôn mở.
// Tiêu chí: phía sau vùng khay bài (đáy màn hình) có phải là bàn 3D không — quạt bài nằm "trên mặt bàn".
function watchStage() {
  document.body.classList.toggle('tray-dock', !!$('.hand-tray.has-dock'));
  updateTray();
}
function updateTray() {
  const st = S.game && $('.stage:not(.off)'); // tắt 3D: không có bàn → khay luôn mở như cũ
  let onTable = true;
  if (st) {
    const r = st.getBoundingClientRect();
    const zone = window.innerHeight - 120; // mép trên vùng quạt bài
    onTable = r.top < zone && r.bottom > zone;
  }
  const min = !!S.game && !onTable && !$('.hand-tray.has-dock');
  if (!min) ui.trayOpen = false; // về lại bàn / tới lượt: bỏ trạng thái "mở tạm" → lần sau cuộn đi lại tự thu gọn
  // Đang thu gọn mà bấm viên "Bài trên tay" → mở tạm tại chỗ (tray-peek), không cuộn trang
  document.body.classList.toggle('tray-min', min && !ui.trayOpen);
  document.body.classList.toggle('tray-peek', min && !!ui.trayOpen);
}
const setTrayOpen = (v) => { ui.trayOpen = v; updateTray(); };
// Đang mở tạm: chạm ra ngoài khay / Esc → thu lại
document.addEventListener('click', (e) => { if (ui.trayOpen && !e.target.closest('.hand-tray')) setTrayOpen(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.trayOpen) setTrayOpen(false); });
let trayRaf = 0;
const trayLater = () => { if (!trayRaf) trayRaf = requestAnimationFrame(() => { trayRaf = 0; updateTray(); }); };
window.addEventListener('scroll', trayLater, { passive: true });
window.addEventListener('resize', trayLater);

// Lá nhân vật trong bảng chọn cao bằng nhau (mô tả dài ngắn khác nhau, có thể xuống 2 hàng)
function equalCards() {
  const cards = [...document.querySelectorAll('.picker .chars > .ccard')];
  if (!cards.length) return;
  cards.forEach((c) => { c.style.minHeight = ''; });
  const h = Math.max(...cards.map((c) => c.offsetHeight));
  cards.forEach((c) => { c.style.minHeight = `${h}px`; });
}

// Màn rộng: khay bài (cố định đáy màn hình) khớp đúng bề ngang cột chính để không che cột phải.
// Bố cục trang được căn giữa (tối đa 1600px) nên phải đo thật, không dùng khoảng cách cố định.
function placeTray() {
  const tray = $('.hand-tray');
  const main = $('.main');
  if (!tray || !main) return;
  if (window.innerWidth >= 1021) {
    const r = main.getBoundingClientRect();
    tray.style.left = `${r.left}px`;
    tray.style.width = `${r.width}px`;
    tray.style.right = 'auto';
  } else {
    tray.style.left = tray.style.width = tray.style.right = '';
  }
}

// Thành phố 3D: canvas được giữ nguyên, chỉ chuyển vào ô giữ chỗ sau mỗi lần vẽ lại
function sync3d() {
  const slot = $('#board-slot');
  if (!slot || !window.City3D || !S.game) return;
  City3D.mount(slot);
  const g = S.game;
  const marks = skillMarks(g);
  City3D.update(g, {
    lang: ui.lang,
    label: (p, i) => `<div class="c3-n">${p.hasCrown ? `<span class="c3-crown">${icon('king')}</span>` : ''}<b>${esc(p.name)}</b>${i === g.me ? `<em>${tx('bạn', 'you')}</em>` : ''}</div>
      <div class="c3-s"><span title="${tx('Vàng', 'Gold')}">${icon('gold')}${p.gold}</span><span>${icon('cards')}${p.handCount}</span><span>${icon('city')}${p.citySize ?? p.city.length}/${g.target}</span></div>
      ${p.chars.length ? `<div class="c3-ch">${p.chars.map((c) => medal(c, 'xs')).join('')}</div>` : ''}`,
    destroyable: marks,
    onDestroy: (target, cardId) => {
      const m = marks.find((x) => x.cardId === cardId);
      if (m) skillTile(m.act, target, cardId);
    },
  });
}

// Bấm vào công trình mục tiêu (ô nhỏ hoặc nhà 3D)
function skillTile(act, target, cardId) {
  if (act === 'dipPick') { ui.pick.dip = { target, cardId }; return render(); }
  if (act !== 'beautify') ui.mode = null;
  return send('ability', { target, cardId });
}
window.addEventListener('city3d-ready', () => render());

// Sân khấu: bàn 3D chiếm phần lớn cột chính; dải hành động & nút điều khiển nổi bên trên
function renderStage(g) {
  const supported = !window.City3D || window.City3D.supported;
  const live = g.phase !== 'ended';
  const on = supported && ui.show3d;
  const action = `<div class="action ${live ? 'slim' : ''} ${on && live ? 'stage-action' : ''}">${renderAction()}</div>`;
  if (!supported) return action;
  const tools = `<div class="stage-tools">
    ${on ? `<button class="small tool3d" data-act="reset3d" title="${tx('Góc nhìn ban đầu · kéo để xoay, cuộn chuột để phóng to', 'Reset view · drag to rotate, scroll to zoom')}" aria-label="${tx('Góc nhìn ban đầu', 'Reset view')}">↺</button>` : ''}
    <button class="small tool3d" data-act="toggle3d" title="${on ? tx('Tắt bàn 3D', 'Turn the 3D table off') : tx('Bật bàn 3D', 'Turn the 3D table on')}">${on ? '3D ✕' : '3D'}</button></div>`;
  const modeHint = MODE_HINT[ui.mode] && TILE_MODE[g.turn && g.turn.key] === ui.mode ? `<div class="stage-hint">${tx(...MODE_HINT[ui.mode])}</div>` : '';
  if (!on) return `${action}<div class="stage off">${tools}</div>`;
  return `${live ? '' : action}<div class="stage">${live ? action : ''}${tools}${modeHint}<div id="board-slot"></div></div>`;
}

const credit = () => `<div class="credit">Icon: <a href="https://game-icons.net" target="_blank" rel="noopener">game-icons.net</a> (CC BY 3.0) · Citadels © Bruno Faidutti
  <div class="made-by">Made by <b>hungnm</b></div></div>`;

function renderHome() {
  const code = new URLSearchParams(location.search).get('room') || '';
  return `<div class="home-lang">${sfxBtn()}${langBtn()}</div><div class="home">
    <div class="hero">
      <div class="logo">${icon('logo')}</div>
      <h1>Citadels</h1>
      <p class="sub">${tx('Chọn nhân vật bí mật, xây dựng thành phố huy hoàng nhất. Luật bản 2016 với 27 nhân vật. Chơi online 2–8 người, có bot chơi cùng.',
    'Pick secret characters and build the most magnificent city. 2016 edition rules with 27 characters. Play online with 2–8 players, bots included.')}</p>
      <div class="roster">${[1, 2, 3, 4, 5, 6, 7, 8].map((r) => medal(r)).join('')}</div>
    </div>
    <div>
      <div class="box form">
        <label for="name">${tx('Tên của bạn', 'Your name')}</label>
        <input id="name" maxlength="20" placeholder="${tx('Nhập tên...', 'Enter your name...')}" value="${esc(getName())}">
        <button class="primary big" data-act="create">${icon('logo')} ${tx('Tạo phòng mới', 'Create a room')}</button>
        <div class="or">${tx('hoặc vào phòng có sẵn', 'or join an existing room')}</div>
        <div class="row"><input id="code" maxlength="4" placeholder="${tx('Mã phòng', 'Room code')}" value="${esc(code)}" style="flex:1;text-transform:uppercase;letter-spacing:.15em">
        <button data-act="join">${tx('Vào phòng', 'Join')}</button></div>
      </div>
      ${rulesHtml()}
    </div>
  </div>${credit()}`;
}

function rulesHtml() {
  const items = ui.lang === 'en' ? [
    'Each round, starting with the 👑 holder, every player secretly picks 1 character (2–3 players: 2 characters each).',
    'Characters are called in order 1 → 8 (or 9). On your turn: <b>take 2 gold</b> or <b>draw 2 cards, keep 1</b>, then you may <b>build 1 district</b>.',
    'Each character has a unique ability. Each rank has 3 characters for the host to choose from (2016 edition); ranks 4, 5, 6, 8 usually collect taxes by district color.',
    'You cannot build 2 districts with the same name.',
    'When someone builds 7 districts (2016 rules), the game ends at the end of that round.',
    'Score = total district cost, +3 for all 5 colors, +4 for the first to complete, +2 for others who complete.',
  ] : [
    'Mỗi vòng, bắt đầu từ người giữ 👑, mỗi người bí mật chọn 1 nhân vật (2–3 người: mỗi người 2 nhân vật).',
    'Nhân vật được gọi theo thứ tự 1 → 8 (hoặc 9). Đến lượt: <b>lấy 2 vàng</b> hoặc <b>rút 2 lá giữ 1</b>, sau đó được <b>xây 1 công trình</b>.',
    'Mỗi nhân vật có 1 kỹ năng riêng. Mỗi số có 3 nhân vật để chủ phòng chọn bộ chơi (bản 2016); nhân vật số 4, 5, 6, 8 thường thu thuế theo màu công trình.',
    'Không được xây 2 công trình trùng tên.',
    'Khi có người xây đủ 7 công trình (luật 2016), game kết thúc cuối vòng đó.',
    'Điểm = tổng giá công trình, +3 nếu đủ 5 màu, +4 người hoàn thành đầu tiên, +2 người hoàn thành sau.',
  ];
  return `<div class="rules box"><button class="primary" data-act="rules" style="width:100%">📜 ${tx('Xem luật đầy đủ & mẹo chơi', 'Full rules & tips')}</button>
    <details><summary>${tx('Tóm tắt nhanh', 'Quick summary')}</summary><ul>
    ${items.map((s) => `<li>${s}</li>`).join('\n    ')}
  </ul></details></div>`;
}

// Trò chuyện khi đang chơi: nút trên thanh trên cùng (kèm số tin chưa đọc), bấm mới mở khung chat
function chatButton() {
  const chat = S.room.chat;
  const lastAt = chat.length ? chat[chat.length - 1].at : 0;
  if (ui.chatSeenAt == null) ui.chatSeenAt = lastAt; // tin cũ trước khi vào trang không tính là chưa đọc
  if (ui.chatOpen) ui.chatSeenAt = lastAt;
  const unread = chat.filter((m) => m.at > ui.chatSeenAt).length;
  return `<button class="small chat-btn ${ui.chatOpen ? 'on' : ''}" data-act="chatToggle" title="${tx('Trò chuyện', 'Chat')}">💬 <span class="tb-l">${tx('Trò chuyện', 'Chat')}</span>${unread ? `<span class="chat-badge">${unread}</span>` : ''}</button>`;
}

function renderChatPop() {
  if (!ui.chatOpen) return '';
  const head = `<div class="section-title">${tx('Trò chuyện', 'Chat')}</div>`;
  return `<div class="chat-pop">${chatHtml().replace(head,
    `<div class="chat-pop-head">${head}<button class="small ghost" data-act="chatToggle" title="${tx('Đóng', 'Close')}">✕</button></div>`)}</div>`;
}

function chatHtml() {
  const chat = S.room.chat.map((m) => `<div><b>${esc(m.name)}:</b> ${esc(m.text)}</div>`).join('');
  return `<div class="panel chat"><div class="section-title">${tx('Trò chuyện', 'Chat')}</div>
    <div class="chatlog">${chat || `<span class="muted">${tx('Chưa có tin nhắn', 'No messages yet')}</span>`}</div>
    <form data-form="chat"><input id="chatInput" maxlength="200" placeholder="${tx('Nhắn tin...', 'Type a message...')}" autocomplete="off"><button>${tx('Gửi', 'Send')}</button></form></div>`;
}

function seg(name, options, value, enabled) {
  return `<div class="seg">${Object.entries(options).map(([v, label]) =>
    `<button class="${String(v) === String(value) ? 'on' : ''}" ${enabled ? `data-act="opt" data-opt="${name}" data-val="${v}"` : 'disabled'}>${label}</button>`).join('')}</div>`;
}

// ---------- Chọn bộ nhân vật (phòng chờ) ----------
const charData = () => (DISTRICT_DATA && DISTRICT_DATA.characters) || null;
const charByKey = (k) => (charData() || []).find((c) => c.key === k);

// Giống castProblem ở server — chỉ để báo trước cho người chơi
function castIssue(keys, n) {
  const ranks = keys.map((k) => (charByKey(k) || {}).rank);
  const nine = ranks.includes(9);
  if (n > (nine ? 8 : 7)) return nine ? tx('Tối đa 8 người chơi', 'At most 8 players') : tx('Chơi 8 người cần thêm nhân vật số 9', '8 players need a rank 9 character');
  if (nine && n < 4) return tx('Nhân vật số 9 chỉ dùng khi có từ 4 người chơi', 'Rank 9 characters need at least 4 players');
  if (keys.includes('queen') && n < 5) return tx('Hoàng hậu chỉ dùng khi có từ 5 người chơi', 'The Queen needs at least 5 players');
  if (keys.includes('emperor') && n < 3) return tx('Hoàng đế không dùng khi chơi 2 người', 'The Emperor cannot be used with 2 players');
  return null;
}

function renderCastPicker(r, host) {
  const data = charData();
  if (!data) return `<div class="muted">${tx('Đang tải danh sách nhân vật…', 'Loading characters…')}</div>`;
  const random = r.options.castMode !== 'custom';
  const mode = `<div class="row" style="margin-bottom:10px">${seg('castMode', { random: tx('🎲 Ngẫu nhiên mỗi ván', '🎲 Random each game'), custom: tx('✋ Tự chọn', '✋ Custom') }, random ? 'random' : 'custom', host)}
    <span class="muted" style="font-size:12.5px">${random
    ? tx('Mỗi lần bắt đầu ván, mỗi số được rút ngẫu nhiên 1 trong 3 nhân vật (số 9 có thể có hoặc không; luôn có khi đủ 8 người).',
      'At the start of each game, each rank gets 1 of its 3 characters at random (rank 9 may or may not be used; always used with 8 players).')
    : tx('Bấm để chọn nhân vật cho từng số.', 'Click to choose a character for each rank.')}</span></div>`;
  // Ngẫu nhiên: giữ bí mật hoàn toàn — không liệt kê nhân vật nào, chỉ biết khi vào chơi
  if (random) {
    return `${mode}<div class="cast-secret">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<span class="cs-card"><b>${n}</b>?</span>`).join('')}
      <div class="muted">🔒 ${tx('Bộ nhân vật được giữ bí mật — chỉ lộ ra khi chọn nhân vật trong ván.', 'The character set is kept secret — revealed only while picking characters in game.')}</div></div>`;
  }
  const chosen = new Set(r.options.chars || DISTRICT_DATA.baseCast);
  const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((rank) => {
    const opts = data.filter((c) => c.rank === rank);
    const btn = (c) => `<button class="cast-opt ch-${rank} ${chosen.has(c.key) ? 'on' : ''}" ${host ? `data-act="castPick" data-key="${c.key}" data-rank="${rank}"` : 'disabled'} title="${esc(cDesc(c))}">
      ${icon(c.key)}<span>${esc(cName(c))}</span></button>`;
    const none = rank === 9 ? `<button class="cast-opt none ${opts.some((c) => chosen.has(c.key)) ? '' : 'on'}" ${host ? 'data-act="castPick" data-key="" data-rank="9"' : 'disabled'}>${tx('Không dùng', 'None')}</button>` : '';
    return `<div class="cast-row"><span class="cast-n">${rank}</span><div class="cast-opts">${opts.map(btn).join('')}${none}</div></div>`;
  }).join('');
  return `${mode}<div class="cast">${rows}</div>
    ${host ? `<div class="row" style="margin-top:8px"><button class="small" data-act="castPreset" data-val="base">${tx('Bộ cơ bản', 'Base set')}</button><button class="small" data-act="castPreset" data-val="random">🎲 ${tx('Rút thử 1 bộ', 'Draw a random set')}</button><span class="muted" style="font-size:12.5px">${tx('Rê chuột vào tên để xem kỹ năng · tab Nhân vật trong Luật chơi có mô tả đầy đủ', 'Hover a name to see its ability · the Characters tab in the Rules has full descriptions')}</span></div>` : ''}`;
}

// Thanh trên cùng dùng chung cho phòng chờ & màn chơi: luật chơi, thoại, chat, ngôn ngữ, rời phòng luôn cùng chỗ, cùng kiểu
// Nút nhạc nền 🎵 và hiệu ứng âm thanh 🔊 (bật/tắt riêng, lưu trên trình duyệt)
const sfxBtn = () => window.Sfx ? `<button class="small sfx-btn ${Sfx.musicOn ? '' : 'off'}" data-act="music" title="${Sfx.musicOn ? tx('Tắt nhạc nền', 'Music off') : tx('Bật nhạc nền', 'Music on')}" aria-pressed="${Sfx.musicOn}">🎵</button>
  <button class="small sfx-btn ${Sfx.muted ? 'off' : ''}" data-act="sfx" title="${Sfx.muted ? tx('Bật hiệu ứng âm thanh', 'Sound effects on') : tx('Tắt hiệu ứng âm thanh', 'Sound effects off')}" aria-pressed="${!Sfx.muted}">${Sfx.muted ? '🔇' : '🔊'}</button>` : '';

function renderTopbar() {
  const g = S.game;
  const r = S.room;
  const host = r.hostId === S.you;
  const stats = g ? `
    <span class="stat" title="${tx('Vòng', 'Round')}">${icon('scroll')} <span class="tb-l">${tx('Vòng', 'Round')}</span> <b>${g.round}</b></span>
    <span class="stat" title="${tx('Chồng bài', 'Deck')}">${icon('cards')} <span class="tb-l">${tx('Chồng bài', 'Deck')}</span> <b>${g.deckCount}</b></span>
    <span class="stat tb-goal" title="${tx('Mục tiêu', 'Goal')}">${icon('city')} <span class="tb-l">${tx('Mục tiêu', 'Goal')}</span> <b>${g.target}</b> <span class="tb-l">${tx('công trình', 'districts')}</span></span>
    ${g.taxPool !== null && g.taxPool !== undefined ? `<span class="stat" title="${tx('Kho thuế — Người thu thuế lấy hết khi lộ diện', 'Tax pool — the Tax Collector takes it all when revealed')}">${icon('taxcollector')} <span class="tb-l">${tx('Kho thuế', 'Tax pool')}</span> <b>${g.taxPool}</b></span>` : ''}`
    : `<span class="stat" title="${tx('Người chơi', 'Players')}">👥 <b>${r.members.length}</b></span>`;
  // Rời phòng: bấm 2 lần (lần 1 chuyển đỏ, 3 giây tự trở lại) — giống nhau ở phòng chờ & trong ván
  const live = g && g.phase !== 'ended';
  const leaveTip = live ? tx('Rời phòng — bot sẽ chơi thay bạn', 'Leave the room — a bot will play for you') : tx('Rời phòng', 'Leave the room');
  const leave = ui.leaveArmed
    ? `<button class="small danger tb-leave armed" data-act="leave" title="${leaveTip}">⚠️ ${tx('Bấm lần nữa để rời', 'Tap again to leave')}</button>`
    : `<button class="small danger tb-leave" data-act="leave" title="${leaveTip}">🚪 <span class="tb-l">${tx('Rời phòng', 'Leave')}</span></button>`;
  return `<div class="topbar">
    <span class="title">${icon('logo')} Citadels</span>
    <span class="stat tb-room">${tx('Phòng', 'Room')} <b>${r.code}</b></span>
    ${stats}
    <span class="spacer"></span>
    <button class="small" data-act="rules" title="${tx('Luật chơi & mẹo', 'Rules & tips')}">📜 <span class="tb-l">${tx('Luật chơi & mẹo', 'Rules & tips')}</span></button>
    ${voiceCtl()}
    ${chatButton()}
    ${sfxBtn()}
    ${langBtn()}
    ${host && live ? `<span class="stat tb-bot"><span class="tb-l">Bot</span> ${seg('botSpeed', speeds(), r.options.botSpeed || 'normal', true)}</span>` : ''}
    ${ui.connected ? '' : `<span class="stat" style="color:var(--danger)" title="${tx('Mất kết nối', 'Disconnected')}">● <span class="tb-l">${tx('Mất kết nối', 'Disconnected')}</span></span>`}
    ${leave}
  </div>`;
}

function renderLobby() {
  const r = S.room;
  const host = r.hostId === S.you;
  const custom = r.options.castMode === 'custom';
  const maxP = !custom || (r.options.chars || []).some((k) => (charByKey(k) || {}).rank === 9) ? 8 : 7;
  const issue = custom && charData() ? castIssue(r.options.chars || [], r.members.length) : null;
  const link = `${location.origin}${location.pathname}?room=${r.code}`;
  const seats = r.members.map((m) => `<div class="seat">
      ${avatar(m.name, { isBot: m.isBot, online: m.online, id: m.id, voiceAct: true })}
      <div class="grow"><div class="nm">${esc(m.name)}</div>
        <div class="muted" style="font-size:12px">${m.id === r.hostId ? tx('Chủ phòng', 'Host') : m.isBot ? 'Bot' : tx('Người chơi', 'Player')}${m.id === S.you ? tx(' · Bạn', ' · You') : ''}</div></div>
      ${host && m.id !== S.you ? `<button class="small ghost danger" data-act="kick" data-id="${m.id}" title="${tx('Mời ra', 'Kick')}">✕</button>` : ''}
    </div>`).join('');
  const empty = Array.from({ length: Math.max(0, Math.min(2, maxP - r.members.length)) }, () =>
    `<div class="seat empty">${host ? `<button class="small ghost" data-act="addBot">+ ${tx('Thêm bot', 'Add bot')}</button>` : tx('Ghế trống', 'Empty seat')}</div>`).join('');
  return `${renderTopbar()}<div class="lobby">
    <div class="box">
      <div class="row" style="justify-content:space-between;align-items:flex-end">
        <div><div class="muted" style="font-size:13px;margin-bottom:6px">${tx('Mã phòng — gửi cho bạn bè', 'Room code — share with friends')}</div><div class="code">${r.code}</div></div>
        <button data-act="copy" data-link="${esc(link)}">📋 ${tx('Sao chép link mời', 'Copy invite link')}</button>
      </div>
      <div class="section-title" style="margin-top:22px">${tx('Người chơi', 'Players')} ${r.members.length}/${maxP}</div>
      <div class="seats">${seats}${empty}</div>
      <div class="section-title">${tx('Tùy chọn', 'Options')}${host ? '' : ` <span class="hint">· ${tx('chủ phòng thiết lập', 'set by the host')}</span>`}</div>
      <div class="opts">
        <span class="lbl">${tx('Kết thúc khi xây đủ', 'Game ends at')}</span>${seg('target', { 7: tx('7 công trình (chuẩn 2016)', '7 districts (2016 standard)'), 8: tx('8 công trình (ván dài)', '8 districts (long game)') }, r.options.target, host)}
        <span class="lbl">${tx('Tốc độ bot', 'Bot speed')}</span>${seg('botSpeed', speeds(), r.options.botSpeed || 'normal', host)}
      </div>
      <div class="section-title">${tx('Bộ nhân vật', 'Character set')} <span class="hint">· ${tx('mỗi số 1 nhân vật; số 9 tùy chọn (cần từ 4 người, bắt buộc khi chơi 8 người)', '1 character per rank; rank 9 optional (needs 4+ players, required with 8 players)')}</span></div>
      ${renderCastPicker(r, host)}
      ${issue ? `<div class="cast-warn">⚠️ ${issue}</div>` : ''}
      <div class="row lobby-actions">
        ${host ? `<div class="row"><button data-act="addBot" ${r.members.length >= maxP ? 'disabled' : ''}>${icon('robot')} ${tx('Thêm bot', 'Add bot')}</button>
          <button class="primary big" data-act="start" ${r.members.length < 2 || issue ? 'disabled' : ''}>${tx('Bắt đầu chơi ▶', 'Start game ▶')}</button></div>`
        : `<span class="muted">${waitDots} ${tx('Đang chờ chủ phòng bắt đầu', 'Waiting for the host to start')}</span>`}
      </div>
    </div>
  </div>${credit()}${renderChatPop()}`;
}

function renderGame() {
  const g = S.game;
  const r = S.room;
  return `
  ${renderTopbar()}
  <div class="layout">
    <div class="main">
      ${renderRoundBar()}
      ${g.phase !== 'ended' ? `<div class="main-hud">${renderMeHud(g)}</div>` : ''}
      ${renderStage(g)}
      <div class="players-panel"><div class="section-title">${tx('Thành phố', 'Cities')}</div>
        <div class="players">${g.players.map((p, i) => renderPlayer(p, i)).join('')}</div></div>
    </div>
    <div class="side">
      <div class="panel"><div class="log-head"><div class="section-title">${tx('Nhật ký', 'Log')}</div>
        <div class="seg">${[['all', tx('Tất cả', 'All')], ['key', tx('Quan trọng', 'Key events')]].map(([v, l]) =>
          `<button class="${ui.logFilter === v ? 'on' : ''}" data-act="logFilter" data-val="${v}">${l}</button>`).join('')}</div></div>
        ${renderLog()}</div>
      ${renderLastRound()}
      ${renderMeHud(g)}
    </div>
  </div>${credit()}${g.phase !== 'ended' ? renderHand() : ''}${renderChatPop()}${renderPicker()}${renderTurnPopup()}`;
}

// ---------- Nhật ký: nhóm theo vòng → theo lượt nhân vật, tô màu theo loại sự kiện ----------
const TONE_ICON = { attack: 'crossed', gain: 'gold', build: 'build', crown: 'king', finish: 'trophy' };
const fmt = (text) => esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

function groupLog(log) {
  const rounds = [];
  for (const e of log) {
    let R = rounds[rounds.length - 1];
    if (!R || R.round !== e.round) rounds.push(R = { round: e.round, head: null, pre: [], turns: [], post: [], n: {} });
    R.n[e.tone] = (R.n[e.tone] || 0) + 1;
    if (e.tone === 'round') R.head = e;
    else if (e.tone === 'reveal') R.turns.push({ rank: e.rank, pi: e.pi, items: [], id: e.id });
    else if (e.rank) R.turns.push({ rank: e.rank, skip: e }); // nhân vật không ai chọn / bị ám sát
    else if (e.scope === 'round') R.post.push(e);
    else (R.turns.length && !R.turns[R.turns.length - 1].skip ? R.turns[R.turns.length - 1].items : R.pre).push(e);
  }
  return rounds;
}

const isFresh = (e) => ui.freshFrom != null && e.id > ui.freshFrom;

function logLine(e) {
  const ic = TONE_ICON[e.tone];
  return `<div class="lg-line t-${e.tone} ${e.color ? 'c-' + e.color : ''} ${isFresh(e) ? 'fresh' : ''}">
    <span class="lg-ic">${ic ? icon(ic) : '•'}</span><span>${fmt(logText(e))}</span></div>`;
}

function renderLog() {
  const g = S.game;
  const keyOnly = ui.logFilter === 'key';
  const show = (e) => !keyOnly || !['info', 'muted'].includes(e.tone);
  const rounds = groupLog(g.log);
  const html = rounds.map((R, idx) => {
    const last = idx === rounds.length - 1;
    const open = ui.logOpen[R.round] ?? last;
    const sum = [
      R.n.build ? `<span class="s-build">${icon('build')} ${R.n.build} ${tx('xây', 'built')}</span>` : '',
      R.n.attack ? `<span class="s-attack">${icon('crossed')} ${R.n.attack} ${tx('tấn công', 'attacks')}</span>` : '',
      R.n.finish ? `<span class="s-finish">${icon('trophy')} ${tx('hoàn thành', 'completed')}</span>` : '',
    ].join('');
    const turns = R.turns.map((T) => {
      if (T.skip) {
        if (keyOnly && T.skip.tone === 'muted') return '';
        return `<div class="lg-turn skip t-${T.skip.tone} ${isFresh(T.skip) ? 'fresh' : ''}">${medal(T.rank, 'sm')}<span>${fmt(logText(T.skip))}</span></div>`;
      }
      const items = T.items.filter(show).map(logLine).join('');
      const p = g.players[T.pi];
      const cur = last && g.turn && g.turn.rank === T.rank;
      return `<div class="lg-turn ${cur ? 'cur' : ''} ${isFresh(T) ? 'fresh-head' : ''}">
        <div class="lg-th">${medal(T.rank, 'sm')}<b>${chName(T.rank)}</b><span class="muted">· ${esc(p ? p.name : '?')}${T.pi === g.me ? tx(' (bạn)', ' (you)') : ''}</span></div>
        ${items}</div>`;
    }).join('');
    return `<details class="lg-round" data-round="${R.round}" ${open ? 'open' : ''}>
      <summary><span class="lg-r">${tx('Vòng', 'Round')} ${R.round}</span><span class="lg-sum">${sum}</span></summary>
      ${R.head ? `<div class="lg-head">${icon('king')} <span>${fmt(logText(R.head))}</span></div>` : ''}
      ${R.pre.filter(show).map(logLine).join('')}${turns}${R.post.filter(show).map(logLine).join('')}
    </details>`;
  }).join('');
  return `<div class="log">${html}</div>`;
}

// Thanh tiến trình vòng: giai đoạn hiện tại + ai đang làm gì
function renderRoundBar() {
  const g = S.game;
  if (g.phase === 'ended') return '';
  const draft = g.phase === 'draft';
  const help = draft
    ? tx('Mỗi người lần lượt chọn bí mật 1 nhân vật. Không ai biết ai cầm nhân vật nào cho tới khi nhân vật đó được gọi.',
      'Each player in turn secretly picks 1 character. Nobody knows who holds which character until it is called.')
    : tx('Nhân vật số nhỏ chơi trước. Đến số nào, người cầm nhân vật đó lộ diện và chơi lượt của mình. Chạm vào huy hiệu để xem chi tiết.',
      'Lower ranks play first. When a rank is called, its holder reveals themselves and plays their turn. Tap a medal for details.');
  const head = `<div class="rb-head">
    <span class="rb-round">${tx('Vòng', 'Round')} ${g.round}</span>
    <span class="ph ${draft ? 'on' : 'done'}"><b>${draft ? '1' : '✔'}</b>${tx('Chọn', 'Pick')}</span>
    <span class="ph-arrow">›</span>
    <span class="ph ${draft ? '' : 'on'}"><b>2</b>${tx('Gọi', 'Call')} 1→${g.maxRank || 8}</span>
    <span class="rb-help" tabindex="0" title="${esc(help)}" aria-label="${esc(help)}">?</span>
  </div>`;
  return `<div class="roundbar">${head}${draft ? renderPickOrder() : renderCallOrder()}</div>`;
}

function renderPickOrder() {
  const g = S.game;
  const d = g.draft;
  const multi = d.order.length > g.players.length; // 2–3 người: mỗi người chọn 2 lần
  const seen = {};
  return `<div class="pick-order">${d.order.map((pi, k) => {
    const p = g.players[pi];
    seen[pi] = (seen[pi] || 0) + 1;
    const st = k < d.idx ? 'done' : k === d.idx ? 'cur' : 'wait';
    const label = st === 'done' ? tx('✔ Đã chọn', '✔ Picked')
      : st === 'cur' ? (d.awaitingDiscard ? tx('Đang úp bỏ 1 lá…', 'Discarding 1 card…') : tx('Đang chọn…', 'Picking…')) : tx('Chờ lượt', 'Waiting');
    const ico = st === 'done' ? '✔' : st === 'cur' ? (d.awaitingDiscard ? '🂠' : '✋') : '⏳';
    return `${k ? '<span class="po-arrow">›</span>' : ''}<div class="po ${st}" title="${esc(label)}">
      ${avatar(p.name, { isBot: p.isBot, id: p.id })}
      <span class="nm">${esc(p.name)}${pi === g.me ? tx(' (bạn)', ' (you)') : ''}${multi ? ` <span class="muted">×${seen[pi]}</span>` : ''}</span>
      <span class="po-st">${ico}</span></div>`;
  }).join('')}</div>`;
}

// Trạng thái từng nhân vật 1→8 trong vòng (dùng cho thanh tiến trình và tóm tắt vòng trước)
function charStatus(g, r, history, live) {
  const h = history.find((x) => x.rank === r);
  if (g.faceUp && g.faceUp.includes(r) && live) return { st: 'out', who: '', text: tx('Bị loại đầu vòng', 'Removed this round') };
  if (h) {
    const who = h.pi !== null ? g.players[h.pi].name : '';
    if (h.status === 'none') return { st: 'none', who: '', text: tx('Không ai chọn', 'Not picked') };
    if (h.status === 'killed') return { st: 'killed', who, text: tx('💀 Bị ám sát, mất lượt', '💀 Assassinated, turn lost') };
    const cur = live && g.turn && g.turn.rank === r;
    return { st: cur ? 'cur' : 'done', who, events: histEvents(h) };
  }
  return { st: 'wait', who: '', text: tx('Chưa tới lượt', 'Not yet called') };
}

// Dấu hiệu công khai đang nhắm vào nhân vật r (ám sát, trộm, yểm bùa, lệnh bắt, thư đe dọa)
function charMarks(g, r) {
  const m = [];
  if (g.killed === r) m.push(['dead', tx('💀 Bị ám sát', '💀 Assassinated')]);
  if (g.robbed === r) m.push(['rob', tx('🦹 Bị nhắm trộm', '🦹 Targeted by Thief')]);
  if (g.bewitched === r) m.push(['witch', tx('🧙 Bị yểm bùa', '🧙 Bewitched')]);
  if (g.warrants && g.warrants.ranks.includes(r)) m.push(['warrant', g.warrants.signed === r ? tx('📜 Lệnh bắt THẬT', '📜 SIGNED warrant') : tx('📜 Lệnh bắt', '📜 Warrant'), g.warrants.signed === r]);
  if (g.threats && g.threats.ranks.includes(r)) m.push(['threat', g.threats.real === r ? tx('✉️ Thư đe dọa THẬT', '✉️ REAL threat') : tx('✉️ Thư đe dọa', '✉️ Threat'), g.threats.real === r]);
  return m;
}

const TOK_ICON = { done: '✓', cur: '▶', killed: '💀', out: '✕', none: '–', wait: '' };
// Chi tiết 1 nhân vật trong vòng (tooltip & bảng bật ra khi chạm)
function tokDetail(g, r) {
  const s = charStatus(g, r, g.history, true);
  const marks = s.st === 'wait' || s.st === 'cur' ? charMarks(g, r) : [];
  return { s, marks, events: s.events || [] };
}
function renderCallOrder() {
  const g = S.game;
  const max = g.maxRank || 8;
  if (ui.tokInfo > max) ui.tokInfo = null;
  let html = `<div class="rail" style="--n:${max}">`;
  for (let r = 1; r <= max; r++) {
    const { s, marks, events } = tokDetail(g, r);
    const tip = [`${chName(r)} — ${chDesc(r)}`, s.who && `👤 ${s.who}`, s.text, ...marks.map((m) => m[1]), ...events.map((e) => `• ${e}`)].filter(Boolean).join('\n');
    const mk = marks.map(([k, t, real]) => `<span class="tok-mk mk-${k} ${real ? 'real' : ''}">${t.split(' ')[0]}</span>`).join('');
    const name = CHARS[r] && CHARS[r].unknown ? '?' : chName(r);
    html += `<button class="tok st-${s.st} ch-${r} ${ui.tokInfo === r ? 'open' : ''}" data-act="tokInfo" data-rank="${r}" title="${esc(tip)}" aria-label="${esc(tip)}">
      <i class="tok-st">${TOK_ICON[s.st]}</i>${mk ? `<span class="tok-mks">${mk}</span>` : ''}
      ${medal(r)}<span class="tok-name">${esc(name)}</span>
      <span class="tok-who">${s.st === 'cur' ? waitDots : esc(s.who || '')}</span></button>`;
  }
  html += '</div>';
  if (ui.tokInfo) {
    const r = ui.tokInfo;
    const { s, marks, events } = tokDetail(g, r);
    const lines = [...marks.map((m) => m[1]), ...(events.length ? events : [s.text || (s.st === 'cur' ? '…' : tx('Không làm gì thêm', 'Nothing else'))])];
    html += `<div class="tok-pop ch-${r}">${medal(r, 'sm')}<div class="tp-body"><b>${chName(r)}</b>${s.who ? ` <span class="muted">· ${esc(s.who)}</span>` : ''}
      <div class="tp-desc">${chDesc(r)}</div>${lines.map((l) => `<div class="tp-ev">${esc(l)}</div>`).join('')}</div>
      <button class="small ghost" data-act="tokInfo" data-rank="${r}" aria-label="${tx('Đóng', 'Close')}">✕</button></div>`;
  }
  return html;
}

function renderLastRound() {
  const g = S.game;
  const lr = g.lastRound;
  if (!lr || (g.phase !== 'draft' && g.phase !== 'ended')) return '';
  const rows = lr.history.filter((h) => h.status !== 'none').map((h) => {
    const who = h.pi !== null ? esc(g.players[h.pi].name) : '?';
    const what = h.status === 'killed' ? tx('💀 bị ám sát, mất lượt', '💀 assassinated, turn lost') : h.events.length ? esc(histEvents(h).join(' · ')) : tx('không làm gì thêm', 'nothing else');
    return `<div class="lr-row">${medal(h.rank, 'sm')}<div><b>${who}</b> <span class="muted">— ${chName(h.rank)}</span><div class="lr-ev">${what}</div></div></div>`;
  }).join('');
  // Thu gọn mặc định & ghi rõ "đã kết thúc" để không bị nhầm là nhân vật của vòng hiện tại
  return `<details class="panel lastround" ${ui.lastRoundOpen ? 'open' : ''} data-toggle="lastRound">
    <summary class="section-title">${tx(`Xem lại vòng ${lr.round}`, `Review round ${lr.round}`)} <span class="hint">· ${tx('đã kết thúc', 'finished')}</span></summary>
    <div class="lr-note">${tx(`Đây là nhân vật của <b>vòng ${lr.round}</b> (vòng trước), không phải vòng hiện tại.`, `These are the characters of <b>round ${lr.round}</b> (previous round), not the current one.`)}</div>
    <div class="lr">${rows}</div></details>`;
}

function renderPlayer(p, i) {
  const g = S.game;
  const member = S.room.members.find((m) => m.id === p.id);
  const online = p.isBot ? true : !member || member.online;
  const destroyMap = {};
  for (const d of skillMarks(g)) if (d.target === i) destroyMap[d.cardId] = d;
  const size = p.citySize ?? p.city.length; // Đài kỷ niệm tính là 2
  const done = size >= g.target;
  const d = ui.deltas[p.id];
  const active = g.actor === i && g.phase !== 'ended';
  const doing = !active ? '' : g.phase === 'draft' ? tx('Đang chọn nhân vật', 'Picking a character') : `${tx('Đang chơi', 'Playing')} · ${chName(g.turn.rank)}`;
  const pct = Math.min(100, Math.round((size / g.target) * 100));
  // 1 hàng gọn: [avatar] [tên + nhân vật] [vàng · bài · công trình] [thành phố thu nhỏ]
  return `<div class="prow ${i === g.me ? 'me' : ''} ${active ? 'active' : ''}">
    ${avatar(p.name, { isBot: p.isBot, online, id: p.id, voiceAct: true })}
    <div class="pr-who">
      <div class="pr-name">${p.hasCrown ? `<span class="crown" title="${tx('Giữ vương miện', 'Holds the crown')}">${icon('king')}</span>` : ''}<span class="nm">${esc(p.name)}</span>${i === g.me ? `<span class="you">${tx('bạn', 'you')}</span>` : ''}</div>
      <div class="pr-sub">${doing ? `<span class="now">▶ ${doing}</span>` : p.chars.map((c) => `<span class="pr-char">${medal(c, 'sm')}${chName(c)}</span>`).join('') || '<span class="muted">—</span>'}</div>
    </div>
    <div class="pr-stats">
      <span class="st" title="${tx('Vàng', 'Gold')}" data-gold="${p.id}">${icon('gold')}<b>${p.gold}</b>${d ? `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</span>` : ''}</span>
      <span class="st" title="${tx('Số lá bài trên tay', 'Cards in hand')}">${icon('cards')}<b>${p.handCount}</b></span>
      <span class="st city-st ${done ? 'done' : ''}" title="${tx('Công trình', 'Districts')} ${size}/${g.target}">${icon('city')}<b>${size}</b><small>/${g.target}</small>${i === g.firstComplete ? ' 🏁' : ''}<i style="width:${pct}%"></i></span>
    </div>
    <div class="pr-city">${p.city.length ? p.city.map((c) => tileHtml(c, destroyMap[c.id])).join('') : `<span class="empty">${tx('Chưa xây', 'Nothing built')}</span>`}</div>
  </div>`;
}

// Ô thông tin của mình: nhân vật, vàng, bài, công trình, màu đã có, trạng thái lượt
function renderMeHud(g) {
  const me = g.players[g.me];
  const t = g.turn;
  const colors = new Set(me.city.map((c) => c.color));
  const size = me.citySize ?? me.city.length;
  const pct = Math.min(100, Math.round((size / g.target) * 100));
  const d = ui.deltas[me.id];

  const chars = me.chars.length ? me.chars.map((r) => {
    // Chỉ cảnh báo khi nhân vật chưa chơi xong
    const warn = r >= g.currentRank ? charMarks(g, r).map(([, t]) => `<span class="hud-warn" title="${esc(t)}">${t.split(' ')[0]}</span>`).join('') : '';
    return `<div class="hud-char ch-${r}" title="${esc(chDesc(r))}">${medal(r)}<div class="hc-name">${chName(r)}</div>${warn}</div>`;
  }).join('') : `<div class="hud-char none" title="${g.phase === 'draft' ? tx('Đang trong giai đoạn chọn nhân vật', 'Characters are being picked') : ''}"><span class="medal none">?</span></div>`;

  let status = '';
  // Trạng thái ngắn (icon + số); câu đầy đủ trong tooltip
  let tip = '';
  if (g.phase === 'draft') {
    if (g.actor === g.me) { status = tx('⭐ Chọn nhân vật', '⭐ Pick'); tip = tx('Đến lượt bạn chọn nhân vật', 'Your turn to pick a character'); }
  } else if (t && t.pi === g.me) { status = tx('⭐ Lượt bạn', '⭐ Your turn'); tip = tx('Đến lượt bạn!', 'Your turn!'); }
  else if (g.phase === 'turns') {
    const next = me.chars.filter((r) => r > g.currentRank && r !== g.killed).sort((a, b) => a - b)[0];
    if (t && t.bewitched && g.players[t.pi] && me.chars.includes(t.rank)) { status = '🧙'; tip = tx('Nhân vật của bạn đang bị Phù thủy điều khiển', 'Your character is controlled by the Witch'); }
    else if (next) { status = `⏳ ${next - g.currentRank}`; tip = tx(`Lượt bạn: số ${next} · đang gọi số ${g.currentRank} (còn ${next - g.currentRank})`, `Your turn: rank ${next} · now calling ${g.currentRank} (${next - g.currentRank} to go)`); }
    else if (me.chars.length) { status = '✔'; tip = tx('Bạn đã chơi xong vòng này', 'You are done this round'); }
  }

  return `<div class="me-hud ${t && t.pi === g.me ? 'my-turn' : ''}">
    <div class="hud-top">${avatar(me.name, { id: me.id })}<b class="hud-name">${me.hasCrown ? `<span class="crown">${icon('king')}</span>` : ''}${esc(me.name)}</b>
      ${status ? `<span class="hud-status" title="${esc(tip)}">${status}</span>` : ''}</div>
    ${chars}
    <div class="hud-stats">
      <div class="hs" data-gold="${me.id}" title="${tx('Vàng', 'Gold')}">${icon('gold')}<b>${me.gold}</b>${d ? `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</span>` : ''}</div>
      <div class="hs" title="${tx('Bài trên tay', 'Cards in hand')}">${icon('cards')}<b>${g.hand.length}</b></div>
      <div class="hs" title="${tx('Công trình', 'Districts')}">${icon('city')}<b>${size}<small>/${g.target}</small></b></div>
    </div>
    <div class="hud-progress"><i style="width:${pct}%"></i></div>
    <div class="hud-colors" title="${tx('Có đủ 5 màu công trình: +3 điểm', 'All 5 district colors: +3 points')}">${['yellow', 'blue', 'green', 'red', 'purple'].map((c) =>
      `<span class="hcol c-${c} ${colors.has(c) ? 'on' : ''}" title="${colorName(c)}${colors.has(c) ? ' ✔' : tx(' — chưa có', ' — missing')}"></span>`).join('')}
      <span class="muted">${colors.size}/5${colors.size === 5 ? ' · +3 ✔' : ''}</span></div>
  </div>`;
}

// Bảng chọn nhân vật dạng cửa sổ, chỉ hiện khi tới lượt mình chọn
function renderPicker() {
  const g = S.game;
  const d = g.draft;
  if (g.phase !== 'draft' || !d || !d.options || ui.pickerHidden) return '';
  const mine = g.players[g.me].chars;
  const sub = d.awaitingDiscard ? tx('Lá này sẽ bị úp bỏ, không ai dùng được trong vòng này', 'This card is discarded face down — nobody can use it this round')
    : mine.length ? `${tx('Bạn đã có', 'You already have')}: ${mine.map((r) => chName(r)).join(', ')}` : tx('Nhân vật quyết định thứ tự chơi và kỹ năng của bạn trong vòng này', 'Your character sets your turn order and ability this round');
  // Hiệu ứng chia bài chỉ chạy lần đầu bảng hiện ra, không chạy lại mỗi lần vẽ lại
  const deal = ui.dealtKey !== ui.pickKey;
  ui.dealtKey = ui.pickKey;
  return `<div class="picker-bg"><div class="picker">
    <div class="picker-head"><div class="muted">${tx('Vòng', 'Round')} ${g.round}</div>
      <h2>${d.awaitingDiscard ? tx('Chọn 1 nhân vật để úp bỏ', 'Choose 1 character to discard') : tx('⭐ Chọn nhân vật của bạn', '⭐ Choose your character')}</h2><div class="sub">${sub}</div></div>
    <div class="chars ${deal ? 'deal' : ''}">${d.options.map((r, k) => charCard(r, 'pick', { style: `--i:${k}` })).join('')}</div>
    <div class="picker-foot">
      <span class="muted">${d.faceUp.length ? `${tx('Bị loại khỏi vòng này', 'Out this round')}: <b>${d.faceUp.map((r) => chName(r)).join(', ')}</b>` : tx('🔒 Người khác không biết bạn chọn gì', '🔒 Nobody else knows what you pick')}</span>
      <button class="small ghost" data-act="pickerHide">👁 ${tx('Xem bàn chơi', 'View the table')}</button></div>
  </div></div>`;
}

function renderHand() {
  const g = S.game;
  if (g.me < 0) return '';
  const me = g.players[g.me];
  const t = g.turn;
  const myTurn = g.phase === 'turns' && t && t.pi === g.me && !t.choosing;
  const canBuild = myTurn && t.actionTaken && t.builds < t.maxBuilds;
  const owned = new Set(me.city.map((c) => c.key));
  let hint = '';
  if (ui.mode === 'redraw') hint = tx('Chọn các lá muốn bỏ để rút lại', 'Select the cards to discard and redraw');
  else if (ui.mode === 'lab') hint = tx('Chọn 1 lá để bỏ (nhận 2 vàng)', 'Choose 1 card to discard (gain 2 gold)');
  else if (canBuild) hint = tx(`Bấm vào lá bài để xây · đã xây ${t.builds}/${t.maxBuilds}`, `Click a card to build · built ${t.builds}/${t.maxBuilds}`);
  else if (myTurn && !t.actionTaken) hint = tx('Lấy vàng hoặc rút bài trước khi xây', 'Take gold or draw cards before building');

  // Xòe bài hình quạt: các lá chồng lên nhau, nghiêng dần ra hai bên
  const n = g.hand.length;
  const cw = window.innerWidth < 600 ? 120 : 140;
  // Màn rộng: khay bài chỉ nằm trên cột chính (chừa cột phải 414px), và chừa chỗ cho thanh điều khiển lượt
  const wide = window.innerWidth >= 1021;
  const dock = renderDock(g);
  const mainEl = $('.main');
  const trayW = wide ? (mainEl ? mainEl.getBoundingClientRect().width : window.innerWidth - 414) : window.innerWidth;
  const zf = LANDSCAPE_PHONE.matches ? 0.68 : 1; // khớp với CSS (.fan scale) khi điện thoại xoay ngang
  const dockW = dock ? (wide ? 330 : zf < 1 ? 236 : 0) : 0; // thanh điều khiển nằm cạnh quạt bài
  const maxW = Math.min(trayW - dockW - 40, 1000) / zf;
  const ov = n > 1 ? Math.max(-(cw - 34), Math.min(-22, Math.floor((maxW - cw * n) / (n - 1)))) : 0;
  const mid = (n - 1) / 2;
  const step = Math.min(5, 40 / Math.max(n, 1));
  const cards = g.hand.map((c, k) => {
    const style = `--rot:${((k - mid) * step).toFixed(2)}deg;--arc:${Math.round((k - mid) ** 2 * 3)}px;--ov:${k ? ov : 0}px`;
    if (ui.mode === 'redraw') return cardHtml(c, { style, cls: `clickable ${ui.selected.has(c.id) ? 'selected' : ''}`, act: 'toggle', tag: ui.selected.has(c.id) ? tx('Bỏ lá này', 'Discard') : tx('Chọn để bỏ', 'Select to discard') });
    if (ui.mode === 'lab') return cardHtml(c, { style, cls: 'clickable', act: 'lab', tag: tx('Bỏ → +2 vàng', 'Discard → +2 gold') });
    // Server tính sẵn giá thực tế & lý do không xây được (Xưởng, Mỏ đá, Chuồng ngựa, Kho bí mật...)
    const info = myTurn && t.actionTaken && g.costs && g.costs[c.id];
    if (info) {
      if (info.why) return cardHtml(c, { style, cls: 'dim', tag: whyText(info.why), tagOff: true });
      return cardHtml(c, { style, cls: 'clickable playable', act: 'build', tag: tx(`Xây (${info.cost} vàng)`, `Build (${info.cost} gold)`) });
    }
    return cardHtml(c, { style });
  }).join('');
  // Màn hẹp: ô thông tin nằm trong khay bài (cột phải bị đẩy xuống cuối trang)
  return `<div class="hand-tray ${dock ? 'has-dock' : ''}">${dock}
    <div class="tray-hint" data-act="trayPeek" title="${tx('Bấm để xem / thu gọn bài trên tay', 'Tap to show / hide your hand')}">${icon('cards')} ${tx('Bài trên tay', 'Cards in hand')}: <b>${n}</b>${hint ? ` · ${hint}` : ''}</div>
    <div class="fan">${cards || `<span class="tray-empty">${tx('Không có lá nào', 'No cards')}</span>`}</div></div>`;
}

// ---------- Lượt của mình: cửa sổ lựa chọn (giống bảng chọn nhân vật) + thanh điều khiển góc dưới phải ----------
// Tên kỹ năng chủ động theo nhân vật (nhân vật không có trong danh sách: chỉ có hiệu ứng tự động)
const SKILL = {
  assassin: ['Ám sát', 'Murder'], witch: ['Yểm bùa', 'Bewitch'], magistrate: ['Đặt lệnh bắt', 'Place warrants'], thief: ['Trộm vàng', 'Rob'],
  spy: ['Do thám', 'Spy'], blackmailer: ['Gửi thư đe dọa', 'Threaten'], magician: ['Phép thuật', 'Magic'], wizard: ['Lấy bài', 'Take a card'],
  seer: ['Tiên tri', 'Foresee'], emperor: ['Trao vương miện', 'Give the crown'], abbot: ['Đòi 1 vàng', 'Collect 1 gold'],
  navigator: ['Nhận 4 vàng / 4 lá', 'Gain 4 gold / 4 cards'], scholar: ['Rút 7 giữ 1', 'Draw 7 keep 1'],
  warlord: ['Phá công trình', 'Destroy'], marshal: ['Lấy công trình', 'Seize'], diplomat: ['Đổi công trình', 'Exchange'], artist: ['Trang trí', 'Beautify'],
};
const skillName = (k) => (SKILL[k] ? tx(...SKILL[k]) : '');
// Kỹ năng chọn mục tiêu bằng cách bấm ô công trình (bảng người chơi / bàn 3D)
const TILE_MODE = { warlord: 'warlord', marshal: 'marshal', diplomat: 'diplomat', artist: 'artist' };
const MODE_HINT = {
  warlord: ['Bấm công trình nhấp nháy đỏ (bàn 3D hoặc thẻ người chơi) để phá', 'Click a flashing red district (3D table or player panel) to destroy it'],
  marshal: ['Bấm công trình nhấp nháy (giá ≤ 3) để lấy về thành phố của bạn', 'Click a flashing district (cost ≤ 3) to seize it into your city'],
  diplomat: ['Bấm công trình của người khác muốn lấy, rồi chọn công trình của bạn để đổi', 'Click a district you want, then choose one of yours to exchange'],
  artist: ['Bấm công trình của bạn để trang trí (1 vàng, +1 giá trị; tối đa 2)', 'Click one of your districts to beautify it (1 gold, +1 value; up to 2)'],
};
const modeHint = (m) => (MODE_HINT[m] ? tx(...MODE_HINT[m]) : '');
const COLOR_HEX = { yellow: 'var(--yellow)', blue: 'var(--blue)', green: 'var(--green)', red: 'var(--red)', purple: 'var(--purple)' };

function turnPopupMode(g) {
  const t = g.turn;
  if (g.phase !== 'turns' || !t || t.pi !== g.me) return null;
  if (t.choosing) return 'keep';
  if (t.peek && t.peek.cards) return 'peek';
  if (t.seerGive && t.seerGive.length) return 'give';
  if (t.threat && t.actionTaken) return 'threat';
  if (ui.pick.dip && ui.mode === 'diplomat') return 'diplomat';
  if (ui.abilityPopup && !t.abilityUsed) return 'ability';
  if (!t.actionTaken && !ui.turnPopupHidden) return 'resource';
  return null;
}

function choiceCard({ act, art, title, desc, hint = '', off = false, cls = '' }) {
  return `<div class="choice ${cls} ${off ? 'off' : ''}" data-k="${esc(act.type + (act.attrs || ''))}" ${off ? '' : `data-act="${act.type}"`} ${act.attrs || ''}>
    <div class="ch-art">${art}</div><div class="ch-t">${title}</div><div class="ch-d">${desc}</div>${hint ? `<div class="ch-hint">${hint}</div>` : ''}</div>`;
}

const playerChoice = (p, i, act, title, desc, extra = {}) => choiceCard({ act: { type: act, attrs: `data-target="${i}"` },
  art: avatar(p.name, { isBot: p.isBot, id: p.id }), title, desc, ...extra });

// Nội dung cửa sổ kỹ năng theo nhân vật: { title, body, foot? }
function abilityPopup(g, t) {
  const faceUp = g.faceUp || [];
  const targets = (g.targets && g.targets.ranks) || [];
  const others = g.players.map((p, i) => [p, i]).filter(([, i]) => i !== g.me);
  const rankCards = (act, pickedTag) => targets.map((r, k) => {
    const out = faceUp.includes(r);
    const picked = ui.pick.ranks && ui.pick.ranks.includes(r);
    return charCard(r, act, { off: out, style: `--i:${k}`, desc: out ? tx('Bị loại đầu vòng — không ai cầm', 'Out this round — nobody holds it') : picked ? pickedTag : '' })
      .replace('class="ccard', `class="ccard ${picked ? 'picked' : ''}`);
  }).join('');
  switch (t.key) {
    case 'assassin': return { title: tx('🗡️ Chọn nhân vật để ám sát', '🗡️ Choose a character to murder'), body: rankCards('target') };
    case 'witch': return { title: tx('🧙 Chọn nhân vật để yểm bùa', '🧙 Choose a character to bewitch'), body: rankCards('target'), sub: tx('Sau khi yểm bùa, lượt của bạn kết thúc ngay. Khi nhân vật đó được gọi, bạn sẽ chơi tiếp lượt của họ.', 'Your turn ends right after bewitching. When that character is called, you play the rest of their turn.') };
    case 'thief': return { title: tx('🦹 Chọn nhân vật để trộm vàng', '🦹 Choose a character to rob'), body: rankCards('target') };
    case 'magistrate':
    case 'blackmailer': {
      const need = t.key === 'magistrate' ? 3 : 2;
      const picked = ui.pick.ranks || [];
      const label = t.key === 'magistrate' ? tx('lệnh có chữ ký', 'the signed warrant') : tx('thư thật', 'the real threat');
      const ready = picked.length === need;
      const sign = ready ? `<div class="pick-sign"><b>${tx('Chọn', 'Choose')} ${label}:</b> ${picked.map((r) => `<button class="primary small" data-act="signRank" data-rank="${r}">${medal(r, 'sm')} ${chName(r)}</button>`).join('')}</div>` : '';
      return {
        title: t.key === 'magistrate' ? tx(`📜 Chọn 3 nhân vật để đặt lệnh bắt (${picked.length}/3)`, `📜 Choose 3 characters for warrants (${picked.length}/3)`) : tx(`✉️ Chọn 2 nhân vật để gửi thư đe dọa (${picked.length}/2)`, `✉️ Choose 2 characters to threaten (${picked.length}/2)`),
        sub: t.key === 'magistrate' ? tx('Mọi người thấy 3 lệnh bắt, nhưng chỉ bạn biết lệnh nào có chữ ký.', 'Everyone sees 3 warrants, but only you know which one is signed.') : tx('Mọi người thấy 2 thư, nhưng chỉ bạn biết thư nào là thật.', 'Everyone sees 2 threats, but only you know which one is real.'),
        body: rankCards('selRank', tx('✔ Đã chọn', '✔ Selected')), extra: sign,
      };
    }
    case 'spy': {
      if (ui.pick.spy === undefined) {
        return { title: tx('🕵️ Chọn người chơi để do thám', '🕵️ Choose a player to spy on'), body: others.map(([p, i]) => playerChoice(p, i, 'spyTarget', esc(p.name), tx(`Có <b>${p.handCount}</b> lá trên tay`, `<b>${p.handCount}</b> cards in hand`))).join('') };
      }
      const p = g.players[ui.pick.spy];
      return { title: tx(`🕵️ Đoán màu bài trên tay ${esc(p.name)}`, `🕵️ Name a color in ${esc(p.name)}'s hand`), sub: tx('Mỗi lá đúng màu: lấy 1 vàng của họ và rút 1 lá.', 'For each matching card: take 1 of their gold and draw 1 card.'),
        body: Object.keys(COLOR_NAME).map((c) => choiceCard({ act: { type: 'spyColor', attrs: `data-color="${c}"` }, cls: `c-${c} color-choice`,
          art: `<span class="color-dot" style="background:${COLOR_HEX[c]}"></span>`, title: colorName(c), desc: '' })).join('') };
    }
    case 'magician':
      return { title: tx('🔮 Phép thuật — chọn 1', '🔮 Magic — choose 1'), body: others.map(([p, i]) => playerChoice(p, i, 'swap', tx(`Đổi bài với ${esc(p.name)}`, `Swap hands with ${esc(p.name)}`), tx(`Họ có <b>${p.handCount}</b> lá · bạn có ${g.hand.length} lá`, `They have <b>${p.handCount}</b> · you have ${g.hand.length}`))).join('')
        + choiceCard({ act: { type: 'mode', attrs: 'data-mode="redraw"' }, off: !g.hand.length, art: icon('cards'), title: tx('Bỏ bài & rút lại', 'Discard & redraw'), desc: tx('Chọn lá trên tay để đổi với chồng bài', 'Pick cards in hand to exchange with the deck') }) };
    case 'wizard':
      return { title: tx('🪄 Xem bài của ai?', '🪄 Whose hand do you look at?'), sub: tx('Bạn sẽ thấy toàn bộ bài trên tay họ và lấy 1 lá.', 'You see their whole hand and take 1 card.'),
        body: others.map(([p, i]) => playerChoice(p, i, 'abilityTarget', esc(p.name), tx(`Có <b>${p.handCount}</b> lá trên tay`, `<b>${p.handCount}</b> cards in hand`), { off: !p.handCount })).join('') };
    case 'seer': {
      const n = others.filter(([p]) => p.handCount).length;
      return { title: tx('🔮 Tiên tri', '🔮 Foresee'), body: choiceCard({ act: { type: 'abilityGo' }, off: !n, art: icon('seer'), title: tx(`Lấy bài của ${n} người`, `Take from ${n} player(s)`),
        desc: tx('Lấy ngẫu nhiên 1 lá của mỗi người, sau đó trả lại mỗi người 1 lá tùy chọn', 'Take 1 random card from each player, then give each of them 1 card of your choice') }) };
    }
    case 'emperor':
      return { title: tx('👑 Trao vương miện cho ai?', '👑 Who gets the crown?'), sub: tx('Người nhận đưa bạn 1 vàng (hoặc 1 lá bài nếu hết vàng).', 'They give you 1 gold (or 1 card if they have no gold).'),
        body: (g.targets.emperor || []).map((i) => playerChoice(g.players[i], i, 'abilityTarget', esc(g.players[i].name), tx(`${g.players[i].gold} vàng · ${g.players[i].handCount} lá`, `${g.players[i].gold} gold · ${g.players[i].handCount} cards`))).join('') };
    case 'abbot':
      return { title: tx('⛪ Người giàu nhất đưa bạn 1 vàng', '⛪ The richest player gives you 1 gold'), body: (g.targets.abbot || []).map((i) => playerChoice(g.players[i], i, 'abilityTarget', esc(g.players[i].name), tx(`Đang có <b>${g.players[i].gold}</b> vàng`, `Has <b>${g.players[i].gold}</b> gold`))).join('') };
    case 'navigator':
      return { title: tx('⚓ Nhà hàng hải — nhận thêm', '⚓ Navigator — gain extra'), sub: tx('Lượt này bạn không được xây công trình nào.', 'You cannot build any district this turn.'),
        body: choiceCard({ act: { type: 'navMode', attrs: 'data-mode="gold"' }, cls: 'gold', art: icon('gold'), title: tx('+4 vàng', '+4 gold'), desc: '' })
          + choiceCard({ act: { type: 'navMode', attrs: 'data-mode="cards"' }, cls: 'draw', art: icon('drawcards'), title: tx('+4 lá bài', '+4 cards'), desc: '' }) };
    case 'scholar':
      return { title: tx('📖 Học giả', '📖 Scholar'), body: choiceCard({ act: { type: 'abilityGo' }, cls: 'draw', off: !g.deckCount, art: icon('scholar'), title: tx('Rút 7 lá, giữ 1', 'Draw 7, keep 1'), desc: tx('6 lá còn lại được xáo vào chồng bài', 'The other 6 are shuffled back into the deck') }) };
    default: return { title: '', body: '' };
  }
}

function renderTurnPopup() {
  const g = S.game;
  const mode = turnPopupMode(g);
  if (!mode) return '';
  const t = g.turn;
  const me = g.players[g.me];
  const owned = new Set(me.city.map((c) => c.key));
  // Hiệu ứng chia lá chỉ chạy lần đầu mỗi cửa sổ
  const key = `${ui.turnKey}-${mode}`;
  const deal = ui.dealtTurnKey !== key;
  ui.dealtTurnKey = key;
  let title = '';
  let sub = '';
  let body = '';
  let extra = '';
  let foot = '';

  if (mode === 'resource') {
    const has = (k) => me.city.some((c) => c.key === k);
    const nDraw = has('observatory') ? 3 : 2;
    const nKeep = has('library') ? nDraw : 1; // Thư viện: giữ tất cả
    const nGold = has('goldmine') ? 3 : 2; // Mỏ vàng: +1
    const buildable = g.hand.filter((c) => !c.noBuild && (!owned.has(c.key) || owned.has('quarry')));
    const affordNow = buildable.some((c) => c.cost <= me.gold + nGold);
    const tip = t.bewitched ? '' : !buildable.length ? 'draw' : affordNow ? 'gold' : '';
    title = tx('Bước 1 — Nhận tài nguyên', 'Step 1 — Gather resources');
    if (t.bewitched) sub = tx('🧙 Bạn bị yểm bùa: chỉ được nhận tài nguyên, sau đó Phù thủy chơi tiếp lượt này.', '🧙 You are bewitched: you only gather resources, then the Witch plays the rest of this turn.');
    else if (t.threat) sub = tx('✉️ Bạn nhận thư đe dọa — sau khi nhận tài nguyên phải chọn trả tiền hay từ chối.', '✉️ You received a threat — after gathering resources you must pay or refuse.');
    body = choiceCard({ act: { type: 'takeGold' }, cls: 'gold', art: icon('gold'), title: tx(`Lấy ${nGold} vàng`, `Take ${nGold} gold`),
      desc: `${tx('Vàng', 'Gold')}: ${me.gold} → <b>${me.gold + nGold}</b>`, hint: tip === 'gold' ? tx('💡 Nên chọn: đủ tiền xây lá trên tay', '💡 Suggested: enough to build a card in hand') : '' })
      + choiceCard({ act: { type: 'drawCards' }, cls: 'draw', off: !g.deckCount, art: icon('drawcards'), title: tx('Rút bài', 'Draw cards'),
        desc: tx(`Rút ${nDraw} lá, giữ <b>${nKeep}</b>`, `Draw ${nDraw}, keep <b>${nKeep}</b>`), hint: tip === 'draw' ? tx('💡 Nên chọn: không còn lá nào để xây', '💡 Suggested: nothing left to build') : '' });
    foot = `<span class="muted">${SKILL[t.key] && !t.bewitched ? tx(`Kỹ năng (${skillName(t.key)}) dùng ở thanh góc dưới phải.`, `Use your ability (${skillName(t.key)}) from the bottom-right panel.`) : ''}</span>
      <button class="small ghost" data-act="turnPopupHide">👁 ${tx('Xem bàn chơi', 'View the table')}</button>`;
  } else if (mode === 'keep') {
    title = tx(`Chọn ${t.keepLeft} lá để giữ`, `Choose ${t.keepLeft} card(s) to keep`);
    body = t.drawn.map((c, k) => cardHtml(c, { style: `--i:${k}`, cls: 'clickable', act: 'keep',
      tag: owned.has(c.key) ? tx('Đã có trong thành phố', 'Already in your city') : tx('Giữ lá này', 'Keep this') })).join('');
    foot = `<span class="muted">${t.key === 'scholar' ? tx('Các lá còn lại được xáo vào chồng bài.', 'The rest are shuffled back into the deck.') : tx('Các lá còn lại đặt xuống đáy chồng bài.', 'The rest go to the bottom of the deck.')}</span>`;
  } else if (mode === 'peek') {
    const o = g.players[t.peek.target];
    const build = !!ui.pick.wizBuild;
    title = tx(`🪄 Bài trên tay ${esc(o.name)} — lấy 1 lá`, `🪄 ${esc(o.name)}'s hand — take 1 card`);
    extra = `<div class="pick-sign">${seg('wizBuild', { 0: tx('Lấy về tay', 'Take into hand'), 1: tx('Xây ngay', 'Build now') }, build ? 1 : 0, true).replace(/data-act="opt" data-opt="wizBuild"/g, 'data-act="wizMode"')}</div>`;
    body = t.peek.cards.map((c, k) => {
      const cost = c.cost - (c.color === 'purple' && c.key !== 'factory' && owned.has('factory') ? 1 : 0);
      const can = !c.noBuild && me.gold >= cost;
      return cardHtml(c, { style: `--i:${k}`, cls: build && !can ? 'dim' : 'clickable', act: build && !can ? '' : 'wizTake',
        tag: build ? (can ? tx(`Xây ngay (${cost} vàng)`, `Build now (${cost} gold)`) : tx('Không đủ vàng', 'Not enough gold')) : tx('Lấy lá này', 'Take this'), tagOff: build && !can });
    }).join('');
    foot = `<span class="muted">${tx('Xây ngay không tính vào giới hạn xây và được xây trùng tên.', 'Building now does not count toward your build limit and may duplicate a district.')}</span>`;
  } else if (mode === 'give') {
    const o = g.players[t.seerGive[0]];
    title = tx(`🔮 Chọn 1 lá trả cho ${esc(o.name)}`, `🔮 Choose 1 card to give to ${esc(o.name)}`);
    sub = t.seerGive.length > 1 ? tx(`Còn phải trả cho ${t.seerGive.length} người`, `${t.seerGive.length} players still to give back`) : '';
    body = g.hand.map((c, k) => cardHtml(c, { style: `--i:${k}`, cls: 'clickable', act: 'give', tag: tx(`Trả cho ${esc(o.name)}`, `Give to ${esc(o.name)}`) })).join('');
  } else if (mode === 'threat') {
    const half = Math.floor(me.gold / 2);
    title = tx('✉️ Bạn nhận thư đe dọa!', '✉️ You received a threat!');
    sub = tx('Chỉ 1 trong 2 thư là thật. Trả tiền thì an toàn; từ chối mà thư là thật thì mất toàn bộ vàng.', 'Only 1 of the 2 threats is real. Paying is safe; refusing a real threat costs all your gold.');
    body = choiceCard({ act: { type: 'threat', attrs: 'data-pay="1"' }, cls: 'gold', art: icon('gold'), title: tx(`Trả ${half} vàng`, `Pay ${half} gold`), desc: tx(`Một nửa số vàng của bạn (${me.gold})`, `Half of your gold (${me.gold})`) })
      + choiceCard({ act: { type: 'threat', attrs: 'data-pay="0"' }, cls: 'draw', art: icon('blackmailer'), title: tx('Từ chối', 'Refuse'), desc: tx(`Thư thật: mất <b>${me.gold}</b> vàng · thư giả: không mất gì`, `Real: lose <b>${me.gold}</b> gold · fake: lose nothing`) });
  } else if (mode === 'diplomat') {
    const sw = (g.swappable || []).find((x) => x.target === ui.pick.dip.target && x.cardId === ui.pick.dip.cardId);
    const o = g.players[ui.pick.dip.target];
    const theirs = o.city.find((c) => c.id === ui.pick.dip.cardId);
    title = tx(`🤝 Đổi lấy ${theirs ? esc(cName(theirs)) : '?'} của ${esc(o.name)}`, `🤝 Exchange for ${esc(o.name)}'s ${theirs ? esc(cName(theirs)) : '?'}`);
    sub = tx('Chọn công trình của bạn để đưa cho họ', 'Choose one of your districts to give them');
    body = (sw ? sw.mine : []).map((m, k) => {
      const c = me.city.find((x) => x.id === m.cardId);
      return cardHtml(c, { style: `--i:${k}`, cls: m.cost <= me.gold ? 'clickable' : 'dim', act: m.cost <= me.gold ? 'dipSwap' : '',
        tag: m.cost ? tx(`Trả thêm ${m.cost} vàng`, `Pay ${m.cost} gold extra`) : tx('Đổi ngang', 'Even swap'), tagOff: m.cost > me.gold });
    }).join('');
    foot = `<span></span><button class="small ghost" data-act="dipCancel">${tx('Chọn công trình khác', 'Pick another district')}</button>`;
  } else {
    const a = abilityPopup(g, t);
    title = a.title; sub = a.sub || ''; body = a.body; extra = a.extra || '';
    foot = `<span></span><button class="small ghost" data-act="abilityClose">${tx('Để sau', 'Later')}</button>`;
  }

  return `<div class="picker-bg"><div class="picker turn-pop">
    <div class="picker-head tp-head ch-${t.rank}">${medal(t.rank, 'lg')}<div>
      <div class="muted">⭐ ${tx('Lượt của bạn', 'Your turn')} — ${chName(t.rank)}${t.witched ? tx(' (Phù thủy tiếp quản)', ' (Witch takeover)') : ''}</div><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div></div>
    ${extra}
    <div class="chars choices ${deal ? 'deal' : ''}">${body}</div>
    ${foot ? `<div class="picker-foot">${foot}</div>` : ''}</div></div>`;
}

// Thanh điều khiển lượt của mình (góc dưới phải, cạnh quạt bài)
function renderDock(g) {
  const t = g.turn;
  if (g.phase !== 'turns' || !t || t.pi !== g.me || t.choosing) return '';
  const me = g.players[g.me];
  const has = (k) => me.city.some((c) => c.key === k);
  const step = (done, cur, label) => `<span class="dk-step ${done ? 'done' : ''} ${cur ? 'cur' : ''}">${done ? '✔' : '•'} ${label}</span>`;
  const btns = [];
  const skill = skillName(t.key);
  const info = CHARS[t.rank];

  if (!t.actionTaken) btns.push(`<button class="primary" data-act="turnPopupShow">🪙 ${tx('Nhận tài nguyên', 'Gather resources')}</button>`);
  if (ui.mode === 'redraw') {
    btns.push(`<button class="primary" data-act="confirmRedraw" ${ui.selected.size ? '' : 'disabled'}>${tx(`Đổi ${ui.selected.size} lá`, `Redraw ${ui.selected.size}`)}</button>`, `<button data-act="cancelMode">${tx('Hủy', 'Cancel')}</button>`);
  } else if (TILE_MODE[t.key] && ui.mode === TILE_MODE[t.key]) {
    btns.push(`<button data-act="cancelMode">${t.key === 'artist' && t.beauty ? tx('Xong', 'Done') : tx('Hủy', 'Cancel')}</button>`);
  } else if (ui.mode === 'lab') {
    btns.push(`<button data-act="cancelMode">${tx('Hủy', 'Cancel')}</button>`);
  } else if (!t.abilityUsed && skill && !t.bewitched) {
    const marks = { warlord: g.destroyable, marshal: g.seizable, diplomat: g.swappable }[t.key];
    let off = '';
    if (marks && !marks.length) off = tx('Không có mục tiêu hợp lệ', 'No valid target');
    if (t.key === 'artist' && (me.gold < 1 || !me.city.some((c) => !c.beauty))) off = tx('Cần 1 vàng và công trình chưa trang trí', 'Needs 1 gold and an undecorated district');
    if (t.key === 'witch' && !t.actionTaken) off = tx('Nhận tài nguyên trước', 'Gather resources first');
    if (t.key === 'abbot' && !(g.targets.abbot || []).length) off = tx('Bạn đang là người giàu nhất', 'You are the richest player');
    if (t.threat) off = tx('Xử lý thư đe dọa trước', 'Resolve the threat first');
    btns.push(TILE_MODE[t.key]
      ? `<button data-act="mode" data-mode="${TILE_MODE[t.key]}" ${off ? `disabled title="${off}"` : ''}>${icon(t.key)} ${skill}${t.key === 'artist' ? ` ${t.beauty}/2` : ''}</button>`
      : `<button data-act="abilityOpen" ${off ? `disabled title="${off}"` : ''}>${medal(t.rank, 'sm')} ${skill}</button>`);
  }
  if (!t.incomeTaken && !t.threat) {
    const n = me.city.filter((c) => c.color === info.color || c.key === 'magicschool').length;
    if (info.income === 'choose') {
      btns.push(`<button data-act="income" data-gold="${n}">${icon('gold')} ${tx(`Thu +${n} vàng`, `Collect +${n} gold`)}</button>`, `<button data-act="income" data-gold="0">${icon('cards')} ${tx(`Thu +${n} lá`, `Collect +${n} cards`)}</button>`);
    } else btns.push(`<button data-act="income">${icon(info.income === 'card' ? 'cards' : 'gold')} ${tx('Thu thuế', 'Collect taxes')} +${n}${info.income === 'card' ? tx(' lá', ' cards') : ''}</button>`);
  }
  if (has('laboratory') && !t.labUsed && !ui.mode) btns.push(`<button data-act="mode" data-mode="lab" ${g.hand.length ? '' : 'disabled'} title="${tx('Bỏ 1 lá → +2 vàng', 'Discard 1 card → +2 gold')}">${icon('laboratory')} ${tx('Thí nghiệm', 'Laboratory')}</button>`);
  if (has('smithy') && !t.smithyUsed) btns.push(`<button data-act="smithy" ${me.gold >= 2 ? '' : 'disabled'} title="${tx('Trả 2 vàng → rút 3 lá', 'Pay 2 gold → draw 3 cards')}">${icon('smithy')} ${tx('Lò rèn', 'Smithy')}</button>`);

  let hintText = modeHint(ui.mode) || (ui.mode === 'redraw' ? tx('Bấm các lá trên tay muốn bỏ', 'Click the cards in hand to discard') : ui.mode === 'lab' ? tx('Bấm 1 lá trên tay để bỏ lấy 2 vàng', 'Click 1 card in hand to discard for 2 gold') : '');
  if (t.key === 'emperor' && !t.abilityUsed) hintText = hintText || tx('👑 Phải trao vương miện trước khi kết thúc lượt', '👑 You must give away the crown before ending your turn');
  if (t.key === 'navigator') hintText = hintText || tx('⚓ Nhà hàng hải không được xây trong lượt này', '⚓ The Navigator cannot build this turn');
  // Gián điệp: bài vừa xem được của người bị do thám (chỉ mình thấy)
  const spied = t.spied ? `<div class="dk-spy">🕵️ ${tx('Bài của', 'Hand of')} <b>${esc(g.players[t.spied.target].name)}</b>: ${t.spied.cards.length
    ? t.spied.cards.map((c) => `<span class="spy-c c-${c.color}" title="${esc(cName(c))}">${icon(c.key)}</span>`).join('') : `<i>${tx('không có lá nào', 'no cards')}</i>`}</div>` : '';
  return `<div class="turn-dock">
    <div class="dk-head">${medal(t.rank, 'sm')}<b>${tx('Lượt của bạn', 'Your turn')} · ${cName(info)}</b></div>
    <div class="dk-steps">${step(t.actionTaken, !t.actionTaken, tx('Tài nguyên', 'Resources'))}${skill ? step(t.abilityUsed, false, skill) : ''}${t.maxBuilds ? step(t.builds >= t.maxBuilds, t.actionTaken && t.builds < t.maxBuilds, `${tx('Xây', 'Build')} ${t.builds}/${t.maxBuilds}`) : ''}</div>
    ${hintText ? `<div class="dk-hint">${hintText}</div>` : ''}${spied}
    ${btns.length ? `<div class="dk-btns">${btns.join('')}</div>` : ''}
    <button class="primary big dk-end" data-act="endTurn" ${t.actionTaken && !t.threat ? '' : 'disabled'}>${tx('Kết thúc lượt', 'End turn')} ➜</button>
  </div>`;
}

function stageHead(title, sub = '', r = null) {
  return `<div class="stage-head ${r ? 'ch-' + r : ''}">${r ? medal(r, 'lg') : ''}<div><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div></div>`;
}

function renderAction() {
  const g = S.game;
  const host = S.room.hostId === S.you;

  if (g.phase === 'ended') {
    const top = g.results.slice(0, 3);
    const order = [top[1], top[0], top[2]].filter(Boolean);
    const podium = order.map((r) => {
      const place = g.results.indexOf(r) + 1;
      const p = g.players[r.pi];
      return `<div class="pl p${place}">${avatar(r.name, { isBot: p.isBot, id: p.id })}<div class="nm">${esc(r.name)}</div><div class="pts">${r.total} ${tx('điểm', 'pts')}</div><div class="bar">${place}</div></div>`;
    }).join('');
    const rows = g.results.map((r, i) => `<tr class="${i === 0 ? 'win' : ''}">
      <td>${i + 1}</td><td>${esc(r.name)}</td><td>${r.base}</td><td>${r.colorBonus ? '+' + r.colorBonus : '—'}</td>
      <td>${r.completeBonus ? '+' + r.completeBonus : '—'}</td>
      <td title="${esc((r.extras || []).map((e) => `${extraName(e)} +${e.pts}`).join(', '))}">${r.extra ? `+${r.extra}<div class="ex">${(r.extras || []).map((e) => `${esc(extraName(e))} +${e.pts}`).join('<br>')}</div>` : '—'}</td>
      <td><b>${r.total}</b></td></tr>`).join('');
    return `${stageHead(tx(`🏆 ${esc(g.results[0].name)} chiến thắng!`, `🏆 ${esc(g.results[0].name)} wins!`), tx(`Game kết thúc sau ${g.round} vòng`, `Game over after ${g.round} rounds`))}
      <div class="podium">${podium}</div>
      <table class="results"><tr><th>#</th><th>${tx('Người chơi', 'Player')}</th><th>${tx('Công trình', 'Districts')}</th><th>${tx('Đủ 5 màu', '5 colors')}</th><th>${tx('Hoàn thành', 'Completed')}</th><th>${tx('Công trình tím', 'Unique bonus')}</th><th>${tx('Tổng', 'Total')}</th></tr>${rows}</table>
      <div class="row" style="margin-top:16px;justify-content:flex-end">${host ? `<button class="primary big" data-act="backToLobby">${tx('Chơi ván mới ▶', 'New game ▶')}</button>` : `<span class="muted">${tx('Chờ chủ phòng bắt đầu ván mới...', 'Waiting for the host to start a new game...')}</span>`}</div>`;
  }

  const actorName = g.actor !== null ? esc(g.players[g.actor].name) : '';

  if (g.phase === 'draft') {
    const d = g.draft;
    const faceUp = d.faceUp.length ? `<div class="group"><div class="label">${tx('Bị loại khỏi vòng này', 'Out this round')}:</div><div class="row">${d.faceUp.map((r) => `${medal(r, 'sm')} <span style="margin-right:10px">${chName(r)}</span>`).join('')}</div></div>` : '';
    // Tới lượt mình: bảng chọn bật lên giữa màn hình (renderPicker); ở đây chỉ còn 1 dòng ngắn
    if (d.options) {
      return `<div class="waiting compact"><span class="pulse-dot"></span><b>${tx('⭐ Đến lượt bạn chọn nhân vật', '⭐ Your turn to pick a character')}</b>
        ${ui.pickerHidden ? `<button class="primary" data-act="pickerShow">${tx('Mở bảng chọn nhân vật', 'Open character picker')}</button>` : ''}</div>`;
    }
    const a = g.players[g.actor];
    return `<div class="waiting compact">${avatar(a.name, { isBot: a.isBot, id: a.id })}
      <span>${tx(`Đang chờ <b>${actorName}</b> chọn nhân vật`, `Waiting for <b>${actorName}</b> to pick a character`)} ${waitDots}</span>
      ${d.faceUp.length ? `<span class="muted fu">${tx('Bị loại', 'Out')}: ${d.faceUp.map((r) => chName(r)).join(', ')}</span>` : ''}</div>`;
  }

  const t = g.turn;
  if (!t) return `<div class="waiting">${waitDots} ${tx('Đang xử lý...', 'Working...')}</div>`;
  if (t.pi !== g.me) {
    const h = g.history[g.history.length - 1];
    const events = h && h.rank === t.rank ? h.events : [];
    // Lượt người khác: chỉ 1 dải trạng thái mỏng; chi tiết từng việc xem ở Nhật ký
    const last = events[events.length - 1]; // tiếng Việt: dùng để phân loại màu (noteTone)
    const lastShow = last && histEvents(h)[events.length - 1];
    const who = t.witched ? `<b>${actorName}</b> <span class="muted">${tx('(Phù thủy) đang chơi thay', '(Witch) is playing')}</span>` : `<b>${actorName}</b> <span class="muted">${tx('đang chơi', 'is playing')}</span>`;
    return `<div class="turn-strip" title="${esc(chDesc(t.rank))}">${medal(t.rank, 'sm')}
      <span>${who} <b class="ts-char">${chName(t.rank)}</b>${t.bewitched ? ` <span class="muted">· ${tx('🧙 bị yểm bùa, chỉ nhận tài nguyên', '🧙 bewitched, gathers resources only')}</span>` : ''}</span>
      ${last ? `<span class="ts-last ${noteTone(last)}">✔ ${esc(lastShow)}</span>` : ''}
      <span class="ts-wait">${waitDots}</span></div>`;
  }

  // ----- Lượt của mình -----
  // Ở đây chỉ còn 1 dải ngắn: lựa chọn chính bật thành cửa sổ (renderTurnPopup),
  // nút điều khiển nằm ở thanh góc dưới phải cạnh quạt bài (renderDock)
  const stepText = t.choosing ? tx('Chọn lá bài muốn giữ', 'Choose the card to keep')
    : !t.actionTaken ? (t.bewitched ? tx('🧙 Bị yểm bùa: chỉ nhận tài nguyên', '🧙 Bewitched: gather resources only') : tx('Bước 1: nhận tài nguyên (lấy vàng hoặc rút bài)', 'Step 1: gather resources (take gold or draw cards)'))
      : t.threat ? tx('✉️ Xử lý thư đe dọa', '✉️ Resolve the threat')
      : !t.maxBuilds ? tx('Lượt này không được xây — dùng kỹ năng rồi kết thúc lượt', 'No building this turn — use your ability, then end the turn')
      : t.builds < t.maxBuilds ? tx(`Bước 3: bấm lá bài ở đáy màn hình để xây (${t.builds}/${t.maxBuilds})`, `Step 3: click a card at the bottom to build (${t.builds}/${t.maxBuilds})`)
        : tx('✔ Đã xây xong — bấm Kết thúc lượt', '✔ Done building — click End turn');
  return `<div class="turn-strip mine">${medal(t.rank, 'sm')}
    <b class="ts-char">⭐ ${tx('Lượt của bạn', 'Your turn')} — ${chName(t.rank)}</b>
    <span class="ts-last n-build">${stepText}</span>
    ${!t.actionTaken && !t.choosing && ui.turnPopupHidden ? `<button class="primary small" data-act="turnPopupShow">${tx('Nhận tài nguyên', 'Gather resources')}</button>` : ''}</div>`;
}

// ---------- Cửa sổ luật chơi & mẹo ----------
let DISTRICT_DATA = null;
fetch('/cards.json').then((r) => r.json()).then((d) => { DISTRICT_DATA = d; if (ui.rulesOpen) renderModal(); if (S.room && !S.game) render(); }).catch(() => {});

// Mẹo cho từng nhân vật (luật đầy đủ lấy từ mô tả của server: /cards.json → characters)
const CHAR_TIPS = {
  assassin: 'Nhắm vào nhân vật mà người dẫn đầu nhiều khả năng đang cầm: Kiến trúc sư khi họ nhiều vàng và bài, Thương gia khi họ nhiều công trình xanh lá. Ai bị ám sát chỉ lộ ra khi hết vòng.',
  witch: 'Nhận tài nguyên trước rồi mới yểm bùa. Hãy yểm nhân vật có kỹ năng mạnh với thành phố của BẠN (ví dụ nhân vật thu thuế màu bạn có nhiều) — bạn dùng kỹ năng đó bằng vàng và thành phố của mình.',
  magistrate: 'Đặt lệnh có chữ ký vào nhân vật hay xây công trình đắt (Kiến trúc sư, Thương gia). 2 lệnh còn lại để đánh lạc hướng. Chỉ tịch thu được công trình đầu tiên họ xây trong lượt.',
  thief: 'Nhắm vào người đang giữ nhiều vàng. Thương gia và Vua hay có sẵn vàng. Không trộm được số 1, nhân vật bị ám sát hoặc bị yểm bùa.',
  spy: 'Chọn người nhiều bài và đoán màu phổ biến nhất — mỗi lá trúng = 1 vàng của họ + 1 lá cho bạn. Bạn cũng thấy toàn bộ bài của họ.',
  blackmailer: 'Đặt thư thật vào người giàu. Người bị đe dọa phải đoán: trả nửa số vàng cho chắc, hay liều từ chối.',
  magician: 'Hết bài thì đổi với người nhiều bài nhất. Bài trùng với công trình đã xây hoặc quá đắt thì bỏ đi rút lại.',
  wizard: 'Xem bài người nhiều bài nhất và lấy lá đắt / hợp màu nhất. "Xây ngay" không tốn lượt xây nên vẫn xây thêm được 1 công trình nữa.',
  seer: 'Mạnh khi bạn ít bài: lấy của mỗi người 1 lá rồi trả lại những lá xấu nhất. Được xây 2 công trình trong lượt.',
  king: 'Rất mạnh khi bạn muốn giữ quyền chọn trước, ví dụ để chắc chắn lấy được Giám mục hay Kiến trúc sư vòng sau.',
  emperor: 'Trao vương miện cho người ít có lợi nhất khi chọn trước, đồng thời lấy của họ 1 vàng.',
  patrician: 'Như Vua nhưng thu thuế bằng bài — hợp khi bạn đang thiếu bài để xây.',
  bishop: 'Lấy Giám mục khi bạn sắp hoàn thành thành phố, để không bị nhân vật số 8 phá / lấy mất công trình.',
  abbot: 'Thu thuế linh hoạt vàng hoặc bài. Khi người khác giàu hơn bạn, đòi thêm 1 vàng của người giàu nhất.',
  cardinal: 'Thiếu vàng vẫn xây được công trình đắt bằng cách lấy vàng của người khác và trả bằng lá bài thừa.',
  merchant: 'Nguồn vàng ổn định nhất. Hợp với thành phố nhiều xanh lá, nhưng hay bị Kẻ trộm nhắm tới.',
  alchemist: 'Xây công trình đắt nhất có thể — cuối lượt được hoàn lại toàn bộ vàng đã xây. Vẫn cần đủ vàng lúc xây.',
  trader: 'Xây bao nhiêu công trình Thương mại cũng được trong 1 lượt (vẫn cần đủ vàng).',
  architect: 'Lấy khi bạn có nhiều vàng và nhiều bài để xây liền 2–3 công trình. Đây là cách nhanh nhất để về đích.',
  navigator: 'Không xây được trong lượt, nhưng +4 vàng / +4 lá giúp chuẩn bị cho vòng sau. Hợp khi trên tay toàn lá quá đắt.',
  scholar: 'Rút 7 giữ 1 để tìm đúng lá mình cần (ví dụ màu còn thiếu); được xây 2 công trình.',
  warlord: 'Công trình giá 1 thì phá miễn phí. Hãy phá người dẫn đầu, nhất là khi họ chỉ còn 1–2 công trình nữa là về đích. Không phá được thành phố đã hoàn thành.',
  diplomat: 'Đổi công trình rẻ của bạn lấy công trình đắt của người dẫn đầu (trả phần chênh lệch), hoặc lấy màu còn thiếu để đủ 5 màu.',
  marshal: 'Lấy công trình giá ≤ 3 có màu bạn còn thiếu; tiền trả cho chủ cũ nên tránh lấy của người đang dẫn đầu.',
  queen: 'Chỉ có lợi khi ngồi cạnh người cầm số 4 — đoán xem hàng xóm có hay lấy nhân vật số 4 không.',
  artist: 'Mỗi vàng trang trí = +1 điểm cuối game. Dùng khi dư vàng mà không còn gì để xây.',
  taxcollector: 'Kho thuế tích lũy qua các vòng nếu không ai lấy Người thu thuế — để ý số trên thanh trên cùng.',
};

const CHAR_TIPS_EN = {
  assassin: 'Target the character the leader is most likely holding: the Architect when they have lots of gold and cards, the Merchant when they have many green districts. Who was murdered is only revealed at the end of the round.',
  witch: 'Gather resources first, then bewitch. Pick a character whose ability is strong with YOUR city (e.g. a tax collector of a color you have many of) — you use it with your own gold and city.',
  magistrate: 'Put the signed warrant on characters likely to build something expensive (Architect, Merchant). The other 2 warrants are bluffs. Only the first district built that turn can be confiscated.',
  thief: 'Target whoever is holding lots of gold. The Merchant and King often have gold ready. You cannot rob rank 1, the murdered or the bewitched character.',
  spy: 'Pick a player with many cards and name the most likely color — each match = 1 of their gold + 1 card for you. You also see their whole hand.',
  blackmailer: 'Put the real threat on a rich player. They must guess: pay half their gold to be safe, or risk refusing.',
  magician: 'Out of cards? Swap with the player holding the most. Duplicates of districts you built or cards that are too expensive can be discarded and redrawn.',
  wizard: 'Look at the biggest hand and take the most expensive / best-colored card. "Build now" does not use up your build, so you can still build another district.',
  seer: 'Strong when you have few cards: take 1 card from everyone, then give back your worst ones. You may build 2 districts.',
  king: 'Very strong when you want to pick first next round, e.g. to be sure of the Bishop or Architect.',
  emperor: 'Give the crown to whoever benefits least from picking first, and take 1 gold from them.',
  patrician: 'Like the King, but collects taxes as cards — good when you are short of cards to build.',
  bishop: 'Take the Bishop when you are close to completing your city, so the rank 8 character cannot destroy or take your districts.',
  abbot: 'Flexible income in gold or cards. When someone is richer than you, collect 1 extra gold from the richest player.',
  cardinal: 'Build expensive districts even when short on gold by taking gold from another player and paying with spare cards.',
  merchant: 'The steadiest source of gold. Great with many green districts, but a favourite target of the Thief.',
  alchemist: 'Build the most expensive district you can — you get all the gold back at the end of the turn. You still need the gold when building.',
  trader: 'Build as many Trade districts as you like in one turn (you still need the gold).',
  architect: 'Take it when you have lots of gold and cards to build 2–3 districts in a row. The fastest way to finish.',
  navigator: 'You cannot build this turn, but +4 gold / +4 cards sets up the next round. Good when your hand is full of expensive cards.',
  scholar: 'Draw 7 keep 1 to find exactly the card you need (e.g. a missing color); you may build 2 districts.',
  warlord: 'Districts costing 1 are destroyed for free. Hit the leader, especially when they are 1–2 districts from finishing. Completed cities cannot be attacked.',
  diplomat: 'Swap a cheap district of yours for an expensive one of the leader (paying the difference), or grab a missing color for the 5-color bonus.',
  marshal: 'Seize a district costing ≤ 3 in a color you are missing; the gold goes to the old owner, so avoid paying the leader.',
  queen: 'Only pays off when you sit next to the rank 4 holder — guess whether your neighbours like to take rank 4.',
  artist: 'Each gold spent = +1 point at game end. Use it when you have spare gold and nothing to build.',
  taxcollector: 'The tax pool keeps growing across rounds if nobody takes the Tax Collector — watch the number in the top bar.',
};
const GENERAL_TIPS_EN = [
  ['Gold or cards?', 'If you have a district you can build, take gold. If you are out of cards or they are too expensive, draw.'],
  ['Pick by your city', 'With many districts of one color, take the character that taxes that color: rank 4/yellow, rank 5/blue, rank 6/green, rank 8/red.'],
  ['5 colors = +3 points', 'Try to have at least one district of each color, purple included. The Haunted Quarter can stand in for a missing color.'],
  ["Don't hoard gold", 'A big pile of gold is bait for the Thief. Spend it, or take the Thief or Assassin yourself.'],
  ['Guess who holds what', 'When you pick, the characters missing from the deck were taken by earlier players (or are face down). Combine that with each player\'s situation.'],
  ['Watch the leader', 'When someone is about to finish, the Assassin and Warlord should target them. About to finish yourself? Take the Bishop to be safe.'],
  ['Unique districts', 'Each game uses 14 random purple districts — see the Districts tab. End-game scorers (Imperial Treasury, Map Room, Wishing Well...) are strong if they fit your plan; helpers (Library, Gold Mine, Factory...) should be built early.'],
  ['Finish first', 'The first player to complete their city gets +4 points, later finishers +2. The final round is still played out, so use it to build more.'],
];
const charTip = (k) => tx(CHAR_TIPS[k] || '', CHAR_TIPS_EN[k] || CHAR_TIPS[k] || '');

const GENERAL_TIPS = [
  ['Vàng hay bài?', 'Trên tay có công trình xây được thì lấy vàng. Hết bài hoặc bài quá đắt thì rút bài.'],
  ['Chọn nhân vật theo thành phố', 'Nhiều công trình cùng màu thì lấy nhân vật thu thuế màu đó: số 4/vàng, số 5/xanh dương, số 6/xanh lá, số 8/đỏ.'],
  ['Đủ 5 màu = +3 điểm', 'Cố có ít nhất 1 công trình mỗi màu, kể cả tím. Thành phố ma có thể thay cho màu còn thiếu.'],
  ['Đừng ôm vàng', 'Giữ nhiều vàng là mồi ngon cho Kẻ trộm. Tiêu bớt, hoặc tự cầm Kẻ trộm hay Sát thủ.'],
  ['Đoán xem ai cầm gì', 'Khi đến lượt chọn, những nhân vật đã biến mất khỏi chồng là do người chọn trước lấy (hoặc đang bị úp). Kết hợp với tình hình từng người để đoán.'],
  ['Theo dõi người dẫn đầu', 'Ai sắp đủ công trình thì Sát thủ và Lãnh chúa nên nhắm vào họ. Bạn sắp về đích thì chọn Giám mục cho an toàn.'],
  ['Công trình tím', 'Mỗi ván có 14 loại công trình tím ngẫu nhiên — xem tab Công trình. Loại tính điểm cuối game (Kho bạc, Phòng bản đồ, Giếng ước...) rất mạnh nếu hợp lối chơi; loại hỗ trợ (Thư viện, Mỏ vàng, Xưởng...) nên xây sớm.'],
  ['Về đích trước', 'Người hoàn thành thành phố đầu tiên được +4 điểm, người hoàn thành sau +2. Vòng cuối vẫn chơi hết, nên tận dụng để xây thêm.'],
];

function renderModal() {
  const el = $('#modal');
  if (!ui.rulesOpen) { el.innerHTML = ''; return; }
  const tab = ui.rulesTab || 'rules';
  const tabs = [['rules', tx('Luật chơi', 'Rules')], ['chars', tx('Nhân vật', 'Characters')], ['districts', tx('Công trình', 'Districts')], ['tips', tx('Mẹo chơi', 'Tips')]];
  let body = '';
  if (tab === 'rules') {
    body = tx(`
      <h3>🎯 Mục tiêu</h3>
      <p>Xây thành phố có <b>nhiều điểm nhất</b>. Game kết thúc ở cuối vòng mà có người xây đủ <b>7 công trình</b> (luật Citadels 2016; phòng có thể chọn 8 cho ván dài).</p>
      <h3>🎭 Bộ nhân vật (bản 2016)</h3>
      <p>Có 27 nhân vật: mỗi số 1–8 có 3 lựa chọn, thêm số 9 tùy chọn. Mặc định mỗi ván rút ngẫu nhiên 1 nhân vật cho mỗi số (giữ bí mật), hoặc chủ phòng tự chọn ở phòng chờ. Nhân vật số 9 cần từ 4 người và <b>bắt buộc khi chơi 8 người</b>.</p>
      <h3>🃏 Chuẩn bị</h3>
      <p>Mỗi người có 2 vàng và 4 lá công trình. Một người ngẫu nhiên giữ 👑 vương miện. Chồng bài gồm 54 công trình thường và <b>14 công trình đặc biệt (tím)</b> rút ngẫu nhiên từ kho cho mỗi ván.</p>
      <h3>🔁 Mỗi vòng gồm 2 giai đoạn</h3>
      <p><b>Giai đoạn 1 — Chọn nhân vật.</b> Bắt đầu từ người giữ vương miện, mỗi người <b>bí mật</b> chọn 1 nhân vật. Mỗi vòng luôn có 1 nhân vật bị úp bỏ không ai thấy, và tùy số người sẽ có thêm nhân vật bị lật ngửa loại ra:</p>
      <table class="rt"><tr><th>Số người</th><th>Lật ngửa (8 nhân vật)</th><th>Lật ngửa (9 nhân vật)</th><th>Ghi chú</th></tr>
        <tr><td>2</td><td>0</td><td>—</td><td>Mỗi người 2 nhân vật; sau khi chọn còn phải úp bỏ 1 lá</td></tr>
        <tr><td>3</td><td>0</td><td>—</td><td>Mỗi người 2 nhân vật</td></tr>
        <tr><td>4</td><td>2</td><td>3</td><td>Nhân vật số 4 không bao giờ bị lật ngửa</td></tr>
        <tr><td>5</td><td>1</td><td>2</td><td></td></tr>
        <tr><td>6</td><td>0</td><td>1</td><td></td></tr>
        <tr><td>7</td><td>0</td><td>0</td><td>Người chọn cuối (chỉ còn 1 lá) được lấy cả lá úp ban đầu</td></tr>
        <tr><td>8</td><td>—</td><td>0</td><td>Chỉ chơi được với nhân vật số 9</td></tr></table>
      <p><b>Giai đoạn 2 — Gọi nhân vật 1 → 8 (hoặc 9).</b> Đến số nào, người cầm nhân vật đó lộ diện và chơi lượt của mình. Nhân vật không ai chọn hoặc bị ám sát thì bỏ qua.</p>
      <h3>⭐ Lượt của bạn</h3>
      <ol>
        <li><b>Nhận tài nguyên (bắt buộc):</b> lấy 2 vàng, <i>hoặc</i> rút 2 lá và giữ 1.</li>
        <li><b>Kỹ năng nhân vật (tùy chọn):</b> dùng 1 lần, lúc nào cũng được trong lượt. Thu thuế sẽ tự động nếu bạn quên.</li>
        <li><b>Xây công trình:</b> tối đa 1 (Kiến trúc sư: 3; Nhà tiên tri, Học giả: 2; Nhà hàng hải: 0), trả vàng bằng giá. Không được xây 2 công trình trùng tên.</li>
        <li><b>Kết thúc lượt.</b></li>
      </ol>
      <h3>🏆 Tính điểm</h3>
      <ul>
        <li>Tổng giá các công trình trong thành phố.</li>
        <li>Điểm thưởng của một số công trình tím (Cổng Rồng, Kho bạc hoàng gia, Giếng ước, Kho bí mật...).</li>
        <li><b>+3</b> nếu có đủ 5 màu: vàng, xanh dương, xanh lá, đỏ, tím.</li>
        <li><b>+4</b> cho người hoàn thành thành phố đầu tiên, <b>+2</b> cho người hoàn thành sau đó.</li>
        <li>Bằng điểm: ai cầm nhân vật số lớn nhất ở vòng cuối thắng.</li>
      </ul>`, `
      <h3>🎯 Goal</h3>
      <p>Build the city worth <b>the most points</b>. The game ends at the end of the round in which someone builds <b>7 districts</b> (Citadels 2016 rules; the room can choose 8 for a longer game).</p>
      <h3>🎭 Character set (2016 edition)</h3>
      <p>There are 27 characters: 3 choices for each rank 1–8, plus an optional rank 9. By default each game draws 1 random character per rank (kept secret), or the host can pick them in the lobby. Rank 9 needs at least 4 players and is <b>required for 8 players</b>.</p>
      <h3>🃏 Setup</h3>
      <p>Each player starts with 2 gold and 4 district cards. A random player holds the 👑 crown. The deck has 54 regular districts plus <b>14 unique (purple) districts</b> drawn at random for each game.</p>
      <h3>🔁 Each round has 2 phases</h3>
      <p><b>Phase 1 — Pick characters.</b> Starting with the crown holder, each player <b>secretly</b> picks 1 character. Every round 1 character is discarded face down, and depending on player count more are discarded face up:</p>
      <table class="rt"><tr><th>Players</th><th>Face up (8 characters)</th><th>Face up (9 characters)</th><th>Notes</th></tr>
        <tr><td>2</td><td>0</td><td>—</td><td>2 characters each; after picking you also discard 1 face down</td></tr>
        <tr><td>3</td><td>0</td><td>—</td><td>2 characters each</td></tr>
        <tr><td>4</td><td>2</td><td>3</td><td>Rank 4 is never discarded face up</td></tr>
        <tr><td>5</td><td>1</td><td>2</td><td></td></tr>
        <tr><td>6</td><td>0</td><td>1</td><td></td></tr>
        <tr><td>7</td><td>0</td><td>0</td><td>The last picker (with only 1 card left) may also take the face-down card</td></tr>
        <tr><td>8</td><td>—</td><td>0</td><td>Only with a rank 9 character</td></tr></table>
      <p><b>Phase 2 — Call characters 1 → 8 (or 9).</b> When a rank is called, its holder reveals and plays a turn. Characters nobody picked, or that were murdered, are skipped.</p>
      <h3>⭐ Your turn</h3>
      <ol>
        <li><b>Gather resources (required):</b> take 2 gold, <i>or</i> draw 2 cards and keep 1.</li>
        <li><b>Character ability (optional):</b> once, at any time during your turn. Taxes are collected automatically if you forget.</li>
        <li><b>Build:</b> up to 1 district (Architect: 3; Seer, Scholar: 2; Navigator: 0), paying its cost. You cannot build two identical districts.</li>
        <li><b>End your turn.</b></li>
      </ol>
      <h3>🏆 Scoring</h3>
      <ul>
        <li>Total cost of the districts in your city.</li>
        <li>Bonus points from some unique districts (Dragon Gate, Imperial Treasury, Wishing Well, Secret Vault...).</li>
        <li><b>+3</b> for having all 5 colors: yellow, blue, green, red, purple.</li>
        <li><b>+4</b> for the first player to complete their city, <b>+2</b> for players who complete it later.</li>
        <li>Ties: the player holding the highest-ranked character in the last round wins.</li>
      </ul>`);
  } else if (tab === 'chars') {
    // 27 nhân vật theo số; đánh dấu nhân vật có trong ván / bộ đã chọn ở phòng chờ
    const data = charData() || Object.entries(BASE_CHARS).map(([r, c]) => ({ ...c, rank: Number(r) }));
    // Phòng chờ ở chế độ ngẫu nhiên: không đánh dấu gì (bộ nhân vật còn bí mật)
    const inUse = new Set(S.game ? Object.values(S.game.cast).filter(Boolean).map((c) => c.key)
      : (S.room && S.room.options.castMode === 'custom' && S.room.options.chars) || []);
    body = tx(`<p class="muted">Mỗi số có 3 nhân vật; mỗi ván dùng 1 nhân vật cho mỗi số (số 9 tùy chọn). Nhãn <b style="color:var(--gold-hi)">Trong ván này</b> = nhân vật đang dùng.</p>`,
      `<p class="muted">Each rank has 3 characters; each game uses 1 per rank (rank 9 optional). The <b style="color:var(--gold-hi)">In this game</b> tag marks the characters in use.</p>`)
      + [1, 2, 3, 4, 5, 6, 7, 8, 9].map((r) => `<h3 class="rc-rank">${tx('Số', 'Rank')} ${r}</h3>` + data.filter((c) => c.rank === r).map((c) => `<div class="rc ${inUse.size && !inUse.has(c.key) ? 'out' : ''}">
        <span class="medal ch-${r} lg">${icon(c.key)}<span class="num">${r}</span></span><div>
        <h3>${esc(cName(c))}${inUse.has(c.key) ? `<span class="in-game">${tx('Trong ván này', 'In this game')}</span>` : ''}</h3><p>${esc(cDesc(c))}</p>
        ${CHAR_TIPS[c.key] ? `<p class="tip">💡 ${charTip(c.key)}</p>` : ''}</div></div>`).join('')).join('');
  } else if (tab === 'districts') {
    const d = DISTRICT_DATA || { base: [], uniques: [], uniquePerGame: 14 };
    const colors = ['yellow', 'blue', 'green', 'red'];
    const inGame = new Set((S.game && S.game.uniqueKeys) || []);
    // Công trình tím có trong ván hiện tại xếp lên trước
    const uniques = [...d.uniques].sort((a, b) => (inGame.has(b.key) - inGame.has(a.key)) || a.cost - b.cost);
    body = `<p>${tx('Có 5 màu công trình. Nhân vật thu thuế nhận +1 vàng cho mỗi công trình cùng màu với mình.', 'There are 5 district colors. Tax-collecting characters gain +1 per district of their color.')}</p>
      <div class="rd-grid">${colors.map((c) => `<div class="rd c-${c}"><div class="rd-h"><span class="dot"></span>${colorName(c)}</div>
        ${d.base.filter((x) => x.color === c).map((x) => `<div class="rd-row"><span>${icon(x.key)} ${esc(cName(x))}</span><span class="muted">${x.cost} ${tx('vàng', 'gold')} · ×${x.count}</span></div>`).join('')}</div>`).join('')}</div>
      <h3 style="margin-top:18px">${tx(`Công trình Đặc biệt (tím) — kho ${d.uniques.length} loại, mỗi ván rút ngẫu nhiên ${d.uniquePerGame}`, `Unique (purple) districts — ${d.uniques.length} kinds, ${d.uniquePerGame} drawn at random each game`)}</h3>
      ${inGame.size ? `<p class="muted">${tx('Các lá có nhãn <b style="color:var(--gold-hi)">Có trong ván này</b> đang nằm trong chồng bài của ván hiện tại.', 'Cards tagged <b style="color:var(--gold-hi)">In this game</b> are in the current deck.')}</p>` : ''}
      <div class="rp">${uniques.map((x) => `<div class="rp-row c-purple ${inGame.size && !inGame.has(x.key) ? 'out' : ''}">
        <span class="sq">${icon(x.key)}</span><div><b>${esc(cName(x))}</b> <span class="muted">· ${x.noBuild ? tx('không xây được', 'cannot be built') : `${x.cost} ${tx('vàng', 'gold')}`}</span>
        ${inGame.has(x.key) ? `<span class="in-game">${tx('Có trong ván này', 'In this game')}</span>` : ''}<div>${esc(cDesc(x) || '')}</div></div></div>`).join('')}</div>
      ${d.base.length ? '' : `<p class="muted">${tx('Đang tải dữ liệu...', 'Loading...')}</p>`}`;
  } else {
    body = `<div class="tips">${(ui.lang === 'en' ? GENERAL_TIPS_EN : GENERAL_TIPS).map(([h, t]) => `<div class="tipc"><b>💡 ${h}</b><p>${t}</p></div>`).join('')}</div>
      <h3 style="margin-top:18px">${tx('Mẹo theo nhân vật', 'Tips by character')}</h3>
      ${Object.entries(CHARS).filter(([, c]) => !c.unknown).map(([r, c]) => `<div class="rc sm">${medal(r, 'sm')}<p><b>${cName(c)}:</b> ${charTip(c.key)}</p></div>`).join('')}`;
  }
  el.innerHTML = `<div class="modal-bg" data-act="closeRules"><div class="modal" role="dialog" aria-label="${tx('Luật chơi', 'Rules')}">
    <div class="modal-head"><h2>📜 ${tx('Luật chơi Citadels', 'Citadels rules')}</h2><button class="small ghost" data-act="closeRules" title="${tx('Đóng (Esc)', 'Close (Esc)')}">✕</button></div>
    <div class="modal-tabs">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="rulesTab" data-tab="${k}">${l}</button>`).join('')}</div>
    <div class="modal-body">${body}</div></div></div>`;
}

// ---------- Sự kiện ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const act = el.dataset.act;
  const id = el.dataset.id;
  if (act !== 'sfx') sfx('tick');
  switch (act) {
    case 'sfx': Sfx.toggle(); return render();
    case 'music': Sfx.toggleMusic(); return render();
    case 'create': {
      const name = $('#name').value.trim();
      if (!name) return toast(tx('Hãy nhập tên của bạn', 'Please enter your name'));
      localStorage.setItem('citadels-name', name);
      return socket.emit('create', { name });
    }
    case 'join': {
      const name = $('#name').value.trim();
      const code = $('#code').value.trim().toUpperCase();
      if (!name) return toast(tx('Hãy nhập tên của bạn', 'Please enter your name'));
      if (!code) return toast(tx('Hãy nhập mã phòng', 'Please enter the room code'));
      localStorage.setItem('citadels-name', name);
      return socket.emit('join', { code, name });
    }
    case 'copy':
      navigator.clipboard?.writeText(el.dataset.link).then(() => toast(tx('Đã sao chép link mời!', 'Invite link copied!'), 'info'), () => toast(el.dataset.link, 'info'));
      return;
    case 'opt': return socket.emit('setOption', { [el.dataset.opt]: el.dataset.val });
    case 'addBot': return socket.emit('addBot');
    case 'kick': return socket.emit('kick', { id });
    case 'start': return socket.emit('start');
    case 'leave':
      // Lần bấm đầu chỉ "lên cò" (nút chuyển đỏ), 3 giây không bấm lại thì thôi — phòng chờ & trong ván như nhau
      if (!ui.leaveArmed) {
        ui.leaveArmed = true;
        clearTimeout(ui.leaveTimer);
        ui.leaveTimer = setTimeout(() => { ui.leaveArmed = false; render(); }, 3000);
        return render();
      }
      ui.leaveArmed = false;
      clearTimeout(ui.leaveTimer);
      history.replaceState(null, '', location.pathname);
      return socket.emit('leave');
    case 'backToLobby': return socket.emit('backToLobby');
    case 'pick': return send('pick', { rank: Number(el.dataset.rank) });
    case 'takeGold': return send('takeGold');
    case 'drawCards': return send('drawCards');
    case 'keep': return send('keepCard', { cardId: Number(id) });
    case 'build': return send('build', { cardId: Number(id) });
    case 'income': return send('income', el.dataset.gold !== undefined ? { gold: Number(el.dataset.gold) } : {});
    case 'endTurn': ui.mode = null; return send('endTurn');
    case 'smithy': return send('smithy');
    case 'target': ui.abilityPopup = false; return send('ability', { target: Number(el.dataset.rank) });
    case 'swap': ui.abilityPopup = false; return send('ability', { mode: 'swap', target: Number(el.dataset.target) });
    case 'destroy': case 'seize': case 'dipPick': case 'beautify':
      return skillTile(act, Number(el.dataset.target), Number(id));
    case 'dipSwap': {
      const d = ui.pick.dip;
      ui.pick.dip = null; ui.mode = null;
      return send('ability', { target: d.target, cardId: d.cardId, myCardId: Number(id) });
    }
    case 'dipCancel': ui.pick.dip = null; return render();
    case 'selRank': {
      const need = S.game.turn.key === 'magistrate' ? 3 : 2;
      const r = Number(el.dataset.rank);
      const cur = ui.pick.ranks || [];
      ui.pick.ranks = cur.includes(r) ? cur.filter((x) => x !== r) : cur.length < need ? [...cur, r] : cur;
      return render();
    }
    case 'signRank': {
      const r = Number(el.dataset.rank);
      const targets = ui.pick.ranks;
      ui.pick.ranks = null; ui.abilityPopup = false;
      return send('ability', S.game.turn.key === 'magistrate' ? { targets, signed: r } : { targets, flower: r });
    }
    case 'spyTarget': ui.pick.spy = Number(el.dataset.target); return render();
    case 'spyColor': {
      const target = ui.pick.spy;
      ui.pick.spy = undefined; ui.abilityPopup = false;
      return send('ability', { target, color: el.dataset.color });
    }
    case 'abilityTarget': ui.abilityPopup = false; return send('ability', { target: Number(el.dataset.target) });
    case 'abilityGo': ui.abilityPopup = false; return send('ability');
    case 'navMode': ui.abilityPopup = false; return send('ability', { mode: el.dataset.mode });
    case 'wizMode': ui.pick.wizBuild = el.dataset.val === '1'; return render();
    case 'wizTake': return send('wizardTake', { cardId: Number(id), build: !!ui.pick.wizBuild });
    case 'give': return send('give', { cardId: Number(id) });
    case 'threat': return send('threat', { pay: el.dataset.pay === '1' });
    case 'castPick': {
      const rank = Number(el.dataset.rank);
      const keys = (S.room.options.chars || []).filter((k) => (charByKey(k) || {}).rank !== rank);
      if (el.dataset.key) keys.push(el.dataset.key);
      return socket.emit('setOption', { chars: keys });
    }
    case 'castPreset': {
      const data = charData();
      if (!data) return;
      if (el.dataset.val === 'base') return socket.emit('setOption', { chars: DISTRICT_DATA.baseCast });
      // Ngẫu nhiên mỗi số 1 nhân vật (số 9 có thể không dùng), bỏ qua bộ không hợp lệ với số người hiện tại
      const n = S.room.members.length;
      let keys = DISTRICT_DATA.baseCast;
      for (let tries = 0; tries < 100; tries++) {
        const k = [];
        for (let r = 1; r <= 9; r++) {
          const opts = data.filter((c) => c.rank === r).map((c) => c.key);
          if (r === 9) opts.push(null);
          const pickKey = opts[Math.floor(Math.random() * opts.length)];
          if (pickKey) k.push(pickKey);
        }
        if (!castIssue(k, n)) { keys = k; break; }
      }
      return socket.emit('setOption', { chars: keys });
    }
    case 'lab':
      ui.mode = null;
      return send('laboratory', { cardId: Number(id) });
    case 'mode': ui.mode = el.dataset.mode; ui.abilityPopup = false; ui.selected.clear(); ui.pick.dip = null; return render();
    case 'cancelMode': ui.mode = null; ui.selected.clear(); ui.pick.dip = null; return render();
    case 'logFilter': ui.logFilter = el.dataset.val; return render();
    case 'turnPopupHide': ui.turnPopupHidden = true; return render();
    case 'turnPopupShow': ui.turnPopupHidden = false; return render();
    case 'abilityOpen': ui.abilityPopup = true; return render();
    case 'abilityClose': ui.abilityPopup = false; return render();
    case 'pickerHide': ui.pickerHidden = true; return render();
    case 'pickerShow': ui.pickerHidden = false; return render();
    case 'chatToggle':
      ui.chatOpen = !ui.chatOpen;
      render();
      if (ui.chatOpen) { const i = $('#chatInput'); if (i) i.focus(); }
      return;
    case 'lang': return setLang(ui.lang === 'en' ? 'vi' : 'en');
    case 'trayPeek': // khay thu gọn: bấm viên "Bài trên tay" → mở bài ra tại chỗ; bấm lần nữa → thu lại
      if (document.body.classList.contains('tray-min')) setTrayOpen(true);
      else if (ui.trayOpen) setTrayOpen(false);
      return;
    case 'tokInfo': { const r = Number(el.dataset.rank); ui.tokInfo = ui.tokInfo === r ? null : r; return render(); }
    case 'voiceJoin': return voiceJoin();
    case 'voiceMute': return Voice.setMuted(!Voice.muted);
    case 'voiceDeaf': return Voice.setDeaf(!Voice.deaf);
    case 'voiceLeave': return Voice.leave();
    case 'voicePeer':
      if (id === S.you) return Voice.on && Voice.setMuted(!Voice.muted);
      return Voice.toggleSilence(id);
    case 'reset3d': if (window.City3D) City3D.resetCamera(); return render();
    case 'toggle3d':
      ui.show3d = !ui.show3d;
      try { localStorage.setItem('citadels-3d', ui.show3d ? 'on' : 'off'); } catch (_) {}
      return render();
    case 'rules': ui.rulesOpen = true; ui.rulesTab = el.dataset.tab || ui.rulesTab || 'rules'; return renderModal();
    case 'rulesTab': ui.rulesTab = el.dataset.tab; return renderModal();
    case 'closeRules':
      if (el.classList.contains('modal-bg') && e.target !== el) return; // bấm bên trong hộp thoại thì không đóng
      ui.rulesOpen = false; return renderModal();
    case 'toggle': {
      const n = Number(id);
      ui.selected.has(n) ? ui.selected.delete(n) : ui.selected.add(n);
      return render();
    }
    case 'confirmRedraw': {
      const cardIds = [...ui.selected];
      ui.mode = null; ui.selected.clear();
      return send('ability', { mode: 'redraw', cardIds });
    }
  }
});

// Nhớ trạng thái mở/đóng của panel "Xem lại vòng trước" qua các lần vẽ lại
// Nhớ việc người dùng tự mở/đóng các khối <details> qua các lần vẽ lại
document.addEventListener('click', (e) => {
  const sum = e.target.closest('summary');
  const det = sum && sum.parentElement;
  if (!det) return;
  const willOpen = !det.open;
  if (det.dataset.toggle === 'lastRound') ui.lastRoundOpen = willOpen;
  if (det.dataset.round) ui.logOpen[det.dataset.round] = willOpen;
});

document.addEventListener('keydown', (e) => {
  if ((e.key === 'm' || e.key === 'M') && window.Voice && Voice.on && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) Voice.setMuted(!Voice.muted);
  if (e.key === 'Escape' && ui.rulesOpen) { ui.rulesOpen = false; renderModal(); }
  else if (e.key === 'Escape' && ui.chatOpen) { ui.chatOpen = false; render(); }
});

// Quạt bài phụ thuộc chiều rộng màn hình → vẽ lại khi đổi kích thước
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => S.game && render(), 150); });
window.addEventListener('orientationchange', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => S.game && render(), 300); });

document.addEventListener('submit', (e) => {
  if (e.target.dataset.form !== 'chat') return;
  e.preventDefault();
  const input = $('#chatInput');
  if (input.value.trim()) socket.emit('chat', input.value);
  input.value = '';
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'code') document.querySelector('[data-act="join"]').click();
  if (e.key === 'Enter' && e.target.id === 'name' && !$('#code').value.trim()) document.querySelector('[data-act="create"]').click();
});

render();
