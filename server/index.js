// Server: Express phục vụ client + Socket.IO quản lý phòng chơi.
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { Game, GameError } = require('./game');
const { botAction } = require('./bot');
const { CHARACTERS, BASE_CAST, castProblem, randomCast, cardsData } = require('./cards');

const PORT = process.env.PORT || 3000;
// Thời gian bot "suy nghĩ" (ms) theo tốc độ phòng; BOT_DELAY ghi đè (dùng khi test)
const BOT_SPEEDS = { slow: 2600, normal: 1700, fast: 900 };
const BOT_DELAY = Number(process.env.BOT_DELAY) || 0;
// Mỗi lượt / mỗi lần chọn nhân vật của người thật có 90 giây; hết giờ → mất lượt (chọn ngẫu nhiên khi đang chọn nhân vật).
// TURN_TIME (giây) ghi đè khi test
const TURN_TIME = (Number(process.env.TURN_TIME) || 90) * 1000;
const BOT_NAMES = ['Bot Arthur', 'Bot Merlin', 'Bot Elena', 'Bot Robin', 'Bot Isabel', 'Bot Edmund', 'Bot Grace', 'Bot Percival'];
// Số người tối đa: 8 khi có nhân vật số 9, ngược lại 7
// (chế độ ngẫu nhiên: 8 — bộ rút ra sẽ có số 9 khi đủ 8 người)
const maxPlayers = (room) => (room.options.castMode !== 'custom' || room.options.chars.some((k) => CHARACTERS[k].rank === 9) ? 8 : 7);

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));
// Three.js cho chế độ thành phố 3D (tự phục vụ, không phụ thuộc CDN)
app.use('/vendor/three', express.static(path.join(__dirname, '..', 'node_modules', 'three')));
// Dữ liệu công trình cho trang luật chơi ở client
app.get('/cards.json', (req, res) => res.json(cardsData()));
// Máy chủ ICE cho thoại (WebRTC): STUN công khai; TURN tùy chọn qua biến môi trường (không ghi khóa vào code)
app.get('/ice.json', (req, res) => {
  const ice = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (process.env.TURN_URLS) {
    ice.push({ urls: process.env.TURN_URLS.split(',').map((u) => u.trim()).filter(Boolean),
      username: process.env.TURN_USERNAME || '', credential: process.env.TURN_CREDENTIAL || '' });
  }
  res.json(ice);
});
const server = http.createServer(app);
// Gói từ client tối đa 64KB (mặc định 1MB). Nén WebSocket bật qua WS_COMPRESS=1 (bớt băng thông nhưng tốn CPU — máy chủ yếu thì để tắt)
const io = new Server(server, { maxHttpBufferSize: 64 * 1024, perMessageDeflate: process.env.WS_COMPRESS === '1' ? { threshold: 2048 } : false });

// Không để 1 lỗi bất ngờ làm sập cả server (mọi phòng đang chơi sẽ mất): ghi log rồi chạy tiếp
process.on('uncaughtException', (e) => console.error('Lỗi chưa bắt:', e));
process.on('unhandledRejection', (e) => console.error('Promise lỗi chưa bắt:', e));

const rooms = new Map(); // code -> room
const playerRoom = new Map(); // playerId -> code

function newCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  while (rooms.has(code));
  return code;
}

const cleanName = (s) => String(s || '').trim().slice(0, 20) || 'Người chơi';
// Avatar: 1 trong các icon nhân vật (client vẽ từ icons.js); '' = chữ cái đầu tên
const AVATARS = new Set(['assassin', 'thief', 'magician', 'king', 'bishop', 'merchant', 'architect', 'warlord', 'witch', 'magistrate', 'spy', 'blackmailer', 'wizard', 'seer', 'emperor', 'abbot', 'alchemist', 'navigator', 'scholar', 'diplomat', 'marshal', 'artist', 'queen', 'taxcollector']);
const cleanAvatar = (a) => (AVATARS.has(a) ? a : '');

function broadcast(room) {
  syncTimer(room);
  const pub = {
    code: room.code,
    hostId: room.hostId,
    options: room.options,
    chat: room.chat.slice(-50),
    members: room.members.map((m) => ({ id: m.id, name: m.name, isBot: m.isBot, online: m.isBot || !!m.socketId, voice: m.voice || null, avatar: m.avatar || '' })),
    started: !!room.game,
    turnTime: TURN_TIME,
    deadlineIn: room.deadlineAt ? Math.max(0, room.deadlineAt - Date.now()) : null,
  };
  for (const m of room.members) {
    if (!m.socketId) continue;
    io.to(m.socketId).emit('state', { you: m.id, room: pub, game: room.game ? room.game.viewFor(m.id) : null });
  }
}

function botDelay(room, g) {
  if (BOT_DELAY) return BOT_DELAY;
  const base = BOT_SPEEDS[room.options.botSpeed] || BOT_SPEEDS.normal;
  const t = g.turn;
  // Nhân vật vừa lộ diện: chờ lâu hơn để mọi người kịp xem thông báo
  if (g.phase === 'turns' && t && !t.actionTaken && !t.abilityUsed) return base * 1.6;
  return base * (0.8 + Math.random() * 0.4);
}

function scheduleBots(room) {
  clearTimeout(room.botTimer);
  const g = room.game;
  if (!g || g.phase === 'ended') return;
  const pi = g.currentActor();
  if (pi === null || !g.players[pi].isBot) return;
  room.botTimer = setTimeout(() => {
    if (room.game !== g) return;
    try {
      const a = botAction(g, pi);
      if (a) g.act(pi, a);
    } catch (e) {
      console.error('Bot lỗi:', e);
      try { g.act(pi, { type: 'endTurn' }); } catch (_) { /* bỏ qua */ }
    }
    try { broadcast(room); } catch (e) { console.error('Gửi trạng thái lỗi:', e); }
    scheduleBots(room);
  }, botDelay(room, g));
}

// ---- Hết giờ: mỗi bước của người thật (1 lần chọn / bỏ nhân vật, 1 lượt chơi) có TURN_TIME ----
// Đồng hồ chỉ đặt lại khi người phải hành động / bước thay đổi (khóa stepKey), không đặt lại mỗi lần gửi trạng thái.
function stepKey(g) {
  if (g.phase === 'draft') return `d${g.round}-${g.draft.idx}-${g.draft.awaitingDiscard}`;
  return `t${g.round}-${g.currentRank}-${g.turn ? g.turn.pi : ''}`;
}
function syncTimer(room) {
  const g = room.game;
  const pi = g && g.phase !== 'ended' ? g.currentActor() : null;
  if (pi === null || g.players[pi].isBot) { stopTimer(room); return; }
  const key = stepKey(g);
  if (room.timerKey === key) return;
  clearTimeout(room.turnTimer);
  room.timerKey = key;
  room.deadlineAt = Date.now() + TURN_TIME;
  room.turnTimer = setTimeout(() => {
    if (room.game !== g || room.timerKey !== key) return;
    try { g.timeout(pi); broadcast(room); } catch (e) { console.error('Hết giờ lỗi:', e); }
    scheduleBots(room);
  }, TURN_TIME);
}
function stopTimer(room) {
  clearTimeout(room.turnTimer);
  room.timerKey = null;
  room.deadlineAt = null;
}

const IDLE_ROOM_MS = 10 * 60 * 1000;
function deleteRoom(room) {
  clearTimeout(room.botTimer);
  stopTimer(room);
  for (const m of room.members) if (playerRoom.get(m.id) === room.code) playerRoom.delete(m.id);
  rooms.delete(room.code);
}
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.members.some((m) => !m.isBot && m.socketId)) { room.idleSince = null; continue; }
    room.idleSince = room.idleSince || now;
    if (now - room.idleSince > IDLE_ROOM_MS) deleteRoom(room);
  }
}, 60 * 1000).unref();

function removeMember(room, id) {
  room.members = room.members.filter((m) => m.id !== id);
  playerRoom.delete(id);
  if (!room.members.some((m) => !m.isBot)) { deleteRoom(room); return; }
  if (room.hostId === id) room.hostId = room.members.find((m) => !m.isBot).id;
}

// Người chơi rời giữa ván -> bot điều khiển thay
function botify(room, id) {
  const gp = room.game.players.find((p) => p.id === id);
  if (gp) { gp.isBot = true; room.game.addLog(`${gp.name} rời phòng — **bot chơi thay**`, `${gp.name} left the room — **a bot plays for them**`, 'muted'); }
  const m = room.members.find((x) => x.id === id);
  if (m) { m.isBot = true; m.socketId = null; m.voice = null; m.name = gp ? gp.name : m.name; }
  playerRoom.delete(id);
  if (room.hostId === id) {
    const h = room.members.find((x) => !x.isBot);
    if (h) room.hostId = h.id;
  }
  if (!room.members.some((x) => !x.isBot)) { deleteRoom(room); return; }
  scheduleBots(room);
}

io.on('connection', (socket) => {
  let pid = null;
  // Giới hạn tần suất mỗi kết nối: tối đa `max` sự kiện loại `kind` trong `ms`
  const hits = {};
  const limited = (kind, max, ms) => {
    const now = Date.now();
    const h = (hits[kind] = (hits[kind] || []).filter((t) => now - t < ms));
    if (h.length >= max) return true;
    h.push(now);
    return false;
  };
  const LIMITS = { chat: [5, 5000], action: [20, 2000], 'voice:signal': [200, 5000] };
  const on = (ev, fn) => socket.on(ev, (arg) => {
    const lim = LIMITS[ev] || [30, 5000];
    if (limited(ev, lim[0], lim[1])) return;
    try { fn(arg && typeof arg === 'object' ? arg : (typeof arg === 'string' || typeof arg === 'boolean' ? arg : {})); }
    catch (e) { console.error(`Lỗi xử lý "${ev}":`, e); }
  });
  const getRoom = () => rooms.get(playerRoom.get(pid));
  // Thông báo lỗi song ngữ: client chọn theo ngôn ngữ đang dùng
  const err = (vi, en) => socket.emit('errorMsg', { vi, en: en || vi });
  const me = (room) => room.members.find((m) => m.id === pid);

  on('hello', ({ id }) => {
    pid = String(id || '').slice(0, 64) || socket.id;
    const room = getRoom();
    if (room && me(room)) {
      me(room).socketId = socket.id;
      me(room).voice = null; // kết nối mới → client tự vào lại thoại nếu đang bật
      broadcast(room);
    } else socket.emit('state', { you: pid, room: null, game: null });
  });

  on('create', ({ name, avatar }) => {
    if (!pid || getRoom()) return;
    const code = newCode();
    const room = { code, hostId: pid, options: { target: 7, botSpeed: 'normal', castMode: 'random', chars: BASE_CAST.slice() }, chat: [], game: null,
      members: [{ id: pid, name: cleanName(name), isBot: false, socketId: socket.id, avatar: cleanAvatar(avatar) }] };
    rooms.set(code, room);
    playerRoom.set(pid, code);
    broadcast(room);
  });

  on('join', ({ code, name, avatar }) => {
    if (!pid) return;
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room) return err('Không tìm thấy phòng', 'Room not found');
    if (getRoom() && getRoom() !== room) return err('Bạn đang ở phòng khác', 'You are already in another room');
    if (!me(room)) {
      if (room.game) return err('Phòng đã bắt đầu chơi', 'This room has already started');
      if (room.members.length >= maxPlayers(room)) return err(`Phòng đã đủ ${maxPlayers(room)} người`, `The room is full (${maxPlayers(room)} players)`);
      room.members.push({ id: pid, name: cleanName(name), isBot: false, socketId: socket.id, avatar: cleanAvatar(avatar) });
      playerRoom.set(pid, room.code);
    } else me(room).socketId = socket.id;
    broadcast(room);
  });

  on('addBot', () => {
    const room = getRoom();
    if (!room || room.hostId !== pid || room.game) return;
    if (room.members.length >= maxPlayers(room)) return err(`Phòng đã đủ ${maxPlayers(room)} người`, `The room is full (${maxPlayers(room)} players)`);
    const used = new Set(room.members.map((m) => m.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) || `Bot ${room.members.length}`;
    room.members.push({ id: `bot-${Math.random().toString(36).slice(2, 9)}`, name, isBot: true, socketId: null });
    broadcast(room);
  });

  on('kick', ({ id }) => {
    const room = getRoom();
    if (!room || room.hostId !== pid || id === pid) return;
    const target = room.members.find((m) => m.id === id);
    if (!target) return;
    if (room.game) {
      if (target.isBot) return;
      const sid = target.socketId;
      botify(room, id);
      if (sid) io.to(sid).emit('state', { you: id, room: null, game: null });
    } else {
      if (target.socketId) io.to(target.socketId).emit('state', { you: id, room: null, game: null });
      removeMember(room, id);
    }
    if (rooms.has(room.code)) broadcast(room);
  });

  on('setOption', ({ target, botSpeed, chars, castMode }) => {
    const room = getRoom();
    if (!room || room.hostId !== pid) return;
    // Mục tiêu & bộ nhân vật chỉ đổi được ở phòng chờ; tốc độ bot đổi được cả khi đang chơi
    if (!room.game && [7, 8].includes(Number(target))) room.options.target = Number(target);
    if (!room.game && ['random', 'custom', 'jungle'].includes(castMode)) {
      if (castMode === 'custom' && room.members.length > 7 && !room.options.chars.some((k) => CHARACTERS[k].rank === 9)) {
        room.options.chars = randomCast(room.members.length); // 8 người: bộ tự chọn phải có số 9
      }
      room.options.castMode = castMode;
    }
    if (!room.game && Array.isArray(chars)) {
      room.options.castMode = 'custom';
      const keys = chars.map(String).filter((k) => CHARACTERS[k]);
      const ranks = keys.map((k) => CHARACTERS[k].rank);
      const valid = keys.length === new Set(ranks).size && [1, 2, 3, 4, 5, 6, 7, 8].every((r) => ranks.includes(r));
      if (!valid) return err('Bộ nhân vật không hợp lệ', 'Invalid character set');
      if (!keys.some((k) => CHARACTERS[k].rank === 9) && room.members.length > 7) return err('Phòng đang có 8 người — cần giữ nhân vật số 9', 'The room has 8 players — a rank 9 character is required');
      room.options.chars = keys.sort((a, b) => CHARACTERS[a].rank - CHARACTERS[b].rank);
    }
    if (BOT_SPEEDS[botSpeed]) room.options.botSpeed = botSpeed;
    broadcast(room);
  });

  on('start', () => {
    const room = getRoom();
    if (!room || room.hostId !== pid || room.game) return;
    if (room.members.length < 2) return err('Cần ít nhất 2 người chơi (có thể thêm bot)', 'At least 2 players are needed (you can add bots)');
    // Ngẫu nhiên mỗi ván: rút lại bộ nhân vật mỗi lần bắt đầu (kể cả "Chơi ván mới")
    const chars = room.options.castMode === 'custom' ? room.options.chars : randomCast(room.members.length);
    const bad = castProblem(chars, room.members.length);
    if (bad) return err(bad.vi, bad.en);
    room.game = new Game(room.members, { ...room.options, chars, secretCast: room.options.castMode !== 'custom', reshuffle: room.options.castMode === 'jungle' });
    broadcast(room);
    scheduleBots(room);
  });

  on('action', (a) => {
    const room = getRoom();
    if (!room || !room.game || !a) return;
    const g = room.game;
    const pi = g.indexOf(pid);
    if (pi < 0) return;
    try {
      g.act(pi, a);
    } catch (e) {
      if (e instanceof GameError) return err(e.message, e.en);
      console.error(e);
      return err('Lỗi máy chủ', 'Server error');
    }
    broadcast(room);
    scheduleBots(room);
  });

  // Đổi avatar trong phòng (phòng chờ hoặc đang chơi)
  on('setAvatar', ({ avatar }) => {
    const room = getRoom();
    const m = room && me(room);
    if (!m || m.isBot) return;
    m.avatar = cleanAvatar(avatar);
    broadcast(room);
  });

  on('chat', (text) => {
    const room = getRoom();
    const m = room && me(room);
    const t = String(text || '').trim().slice(0, 200);
    if (!m || !t) return;
    room.chat.push({ name: m.name, text: t, at: Date.now() });
    if (room.chat.length > 100) room.chat.shift();
    broadcast(room);
  });

  // ---- Thoại: server chỉ chuyển tiếp tín hiệu WebRTC giữa người cùng phòng, âm thanh đi thẳng giữa các trình duyệt ----
  // voice: null (không tham gia) | 'on' | 'muted'. Người mới vào gửi offer tới từng người đang trong thoại.
  on('voice:join', () => {
    const room = getRoom();
    const m = room && me(room);
    if (!m || m.isBot || m.socketId !== socket.id) return;
    m.voice = 'on';
    socket.emit('voice:peers', room.members.filter((x) => x !== m && x.voice && x.socketId).map((x) => x.id));
    broadcast(room);
  });

  on('voice:mute', (muted) => {
    const room = getRoom();
    const m = room && me(room);
    if (!m || !m.voice) return;
    m.voice = muted ? 'muted' : 'on';
    broadcast(room);
  });

  on('voice:leave', () => {
    const room = getRoom();
    const m = room && me(room);
    if (!m || !m.voice) return;
    m.voice = null;
    broadcast(room);
  });

  // data: { sdp } hoặc { candidate } — chỉ chuyển cho người cùng phòng, cả hai đang trong thoại
  on('voice:signal', ({ to, data } = {}) => {
    const room = getRoom();
    const m = room && me(room);
    const target = room && room.members.find((x) => x.id === to);
    if (!m || !m.voice || !target || !target.voice || !target.socketId || !data) return;
    if (JSON.stringify(data).length > 20000) return;
    io.to(target.socketId).emit('voice:signal', { from: pid, data });
  });

  on('backToLobby', () => {
    const room = getRoom();
    if (!room || room.hostId !== pid || !room.game || room.game.phase !== 'ended') return;
    clearTimeout(room.botTimer);
    room.game = null;
    stopTimer(room);
    broadcast(room);
  });

  on('leave', () => {
    const room = getRoom();
    if (!room) return;
    if (me(room)) me(room).voice = null;
    if (room.game && room.game.phase !== 'ended') botify(room, pid);
    else removeMember(room, pid);
    socket.emit('state', { you: pid, room: null, game: null });
    if (rooms.has(room.code)) broadcast(room);
  });

  socket.on('disconnect', () => {
    const room = getRoom();
    const m = room && me(room);
    if (m && m.socketId === socket.id) {
      m.socketId = null;
      m.voice = null;
      broadcast(room);
    }
  });
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Cổng ${PORT} đang bị chiếm. Tắt tiến trình cũ (pkill -f "node server/index.js") hoặc chạy cổng khác: PORT=3001 npm start`);
    process.exit(1);
  }
  throw e;
});

server.listen(PORT,() => console.log(`Citadels server chạy tại http://localhost:${PORT}`));
