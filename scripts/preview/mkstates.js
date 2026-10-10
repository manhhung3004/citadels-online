// Sinh các trạng thái game mẫu (chạy engine thật + bot) để xem trước giao diện.
// Ghi ra scripts/preview/states.js (không commit). Được gọi tự động bởi server.js.
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..', '..');
const out = path.join(__dirname, 'states.js');
const { Game } = require(path.join(root, 'server/game'));
const { botAction } = require(path.join(root, 'server/bot'));
const { buildDeck, UNIQUES, BASE_CAST, cardsData } = require(path.join(root, 'server/cards'));
// Bộ nhân vật thay thế (bản 2016) dùng cho các trạng thái mẫu nhân vật mới
const ALT = ['magistrate', 'blackmailer', 'wizard', 'emperor', 'abbot', 'alchemist', 'scholar', 'diplomat', 'artist'];

const names = ['Hùng', 'Bot Arthur', 'Bot Merlin', 'Mai', 'Bot Elena'];
const players = names.map((n, i) => ({ id: 'p' + i, name: n, isBot: n.startsWith('Bot') }));
const room = (g, chars = BASE_CAST) => ({
  code: 'K7QX', hostId: 'p0', options: { target: 8, botSpeed: 'normal', chars }, started: !!g,
  chat: [{ name: 'Mai', text: 'Ai lấy Vua thế 😅', at: 1 }, { name: 'Hùng', text: 'Lãnh chúa đang nhắm bạn đấy', at: 2 }],
  members: players.map((p) => ({ ...p, online: p.id !== 'p3' })),
});

// Cho bot chơi tới khi gặp trạng thái thỏa điều kiện
function run(stop, opts) {
  for (let tries = 0; tries < 5000; tries++) {
    const g = new Game(players, opts);
    let steps = 0;
    while (g.phase !== 'ended' && steps++ < 5000) {
      if (stop(g)) return g;
      const pi = g.currentActor();
      g.act(pi, botAction(g, pi));
    }
  }
  throw new Error('không tìm thấy trạng thái');
}

const me = (g) => g.indexOf('p0');
const turnState = run((g) => g.round >= 4 && g.phase === 'turns' && g.turn && g.turn.pi === me(g)
  && g.turn.actionTaken && g.turn.rank === 8 && g.players[me(g)].hand.length >= 3 && g.players[me(g)].city.length >= 3);
const draftState = run((g) => g.round >= 3 && g.phase === 'draft' && g.currentActor() === me(g) && !g.draft.awaitingDiscard);
const waitState = run((g) => g.round >= 5 && g.phase === 'turns' && g.turn && g.turn.pi !== me(g) && g.killed && g.robbed);
// Đầu lượt của mình (Sát thủ, chưa nhận tài nguyên, chưa dùng kỹ năng)
const startState = run((g) => g.round >= 3 && g.phase === 'turns' && g.turn && g.turn.pi === me(g)
  && g.turn.rank === 1 && !g.turn.actionTaken && !g.turn.abilityUsed);
// Đang chọn lá bài muốn giữ sau khi rút
let keepState = null;
while (!keepState) {
  const g = run((x) => x.round >= 2 && x.phase === 'turns' && x.turn && x.turn.pi === me(x) && !x.turn.actionTaken && x.deck.length > 3);
  g.act(me(g), { type: 'drawCards' });
  if (g.turn.drawn) keepState = g;
}
// Bộ nhân vật 2016 thay thế: lượt người khác khi đang có lệnh bắt + thư đe dọa trên bàn
const altWait = run((g) => g.round >= 2 && g.phase === 'turns' && g.turn && g.turn.pi !== me(g) && g.warrants && g.threats && g.currentRank >= 4, { chars: ALT });
// Mình nhận thư đe dọa (đã nhận tài nguyên)
let threatState = null;
while (!threatState) {
  const g = run((x) => x.phase === 'turns' && x.turn && x.turn.pi === me(x) && x.turn.threat && !x.turn.actionTaken, { chars: ALT });
  g.act(me(g), { type: 'takeGold' });
  if (g.turn.threat) threatState = g;
}
// Thầy phép đang xem bài người khác
let peekState = null;
while (!peekState) {
  const g = run((x) => x.phase === 'turns' && x.turn && x.turn.pi === me(x) && x.turn.key === 'wizard' && !x.turn.abilityUsed && !x.turn.threat, { chars: ALT });
  const ti = g.players.findIndex((o, i) => i !== me(g) && o.hand.length >= 2);
  if (ti < 0) continue;
  g.act(me(g), { type: 'ability', target: ti });
  peekState = g;
}
// Bộ nhân vật bí mật (ngẫu nhiên mỗi ván): đang gọi số 3, các số sau chưa biết
const secretState = run((g) => g.phase === 'turns' && g.currentRank === 3 && g.turn && g.turn.pi !== me(g), { chars: ALT, secretCast: true });
const endState = new Game(players);
while (endState.phase !== 'ended') { const pi = endState.currentActor(); endState.act(pi, botAction(endState, pi)); }

// Mọi loại công trình (thường + toàn bộ kho tím, trừ Kho bí mật) để trưng bày
const kinds = buildDeck(UNIQUES.map((u) => u[0])).filter((c, i, a) => !c.noBuild && a.findIndex((x) => x.key === c.key) === i);
// Tay bài toàn lá tím (mô tả dài nhất) để kiểm tra chữ trên lá
const purpleView = turnState.viewFor('p0');
purpleView.hand = kinds.filter((c) => c.color === 'purple' || c.key === 'tradingpost');
// Trưng bày đủ 28 loại công trình trong thành phố 3D
const galleryView = turnState.viewFor('p0');
galleryView.players.forEach((p, i) => { p.city = kinds.slice(i * 8, i * 8 + 8); });

const S = (game, started = 1) => ({ you: 'p0', room: room(started), game });
fs.writeFileSync(out, 'window.STATES = ' + JSON.stringify({
  turn: S(turnState.viewFor('p0')),
  myturn: S(startState.viewFor('p0')),
  keep: S(keepState.viewFor('p0')),
  draft: S(draftState.viewFor('p0')),
  wait: S(waitState.viewFor('p0')),
  end: S(endState.viewFor('p0')),
  purple: S(purpleView),
  gallery: S(galleryView),
  lobby: S(null, 0),
  lobby2: { you: 'p0', room: room(0, ALT), game: null },
  secret: { you: 'p0', room: room(1, ALT), game: secretState.viewFor('p0') },
  alt: { you: 'p0', room: room(1, ALT), game: altWait.viewFor('p0') },
  threat: { you: 'p0', room: room(1, ALT), game: threatState.viewFor('p0') },
  peek: { you: 'p0', room: room(1, ALT), game: peekState.viewFor('p0') },
}) + ';\nwindow.CARDS = ' + JSON.stringify(cardsData()) + ';\n');
console.log('Đã sinh trạng thái mẫu →', out);
