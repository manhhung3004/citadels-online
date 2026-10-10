// Unit test luật chơi: node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, GameError } = require('../server/game');

const makeGame = (n = 4, opts) =>
  new Game(Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` })), opts);

const card = (id, key, cost, color) => ({ id: 1000 + id, key, name: key, cost, color });

// Bỏ qua giai đoạn chọn: gán nhân vật rồi bắt đầu gọi từ nhân vật đầu tiên
function startTurns(g, owners) {
  g.players.forEach((p) => { p.chars = []; });
  g.charOwner = {};
  for (const [rank, pi] of Object.entries(owners)) {
    g.charOwner[rank] = pi;
    g.players[pi].chars.push(Number(rank));
  }
  g.phase = 'turns';
  g.currentRank = 0;
  g.nextCharacter();
}

test('chọn nhân vật 4 người: 2 lá lật ngửa, không bao giờ có Vua', () => {
  for (let i = 0; i < 200; i++) {
    const g = makeGame(4);
    assert.equal(g.draft.faceUp.length, 2);
    assert.ok(!g.draft.faceUp.includes(4));
  }
});

test('viewFor không lộ bài trên tay và nhân vật chưa lộ diện của người khác', () => {
  const g = makeGame(4);
  const actor = g.currentActor();
  g.pick(actor, g.draftOptions()[0]);
  const other = g.players.findIndex((_, i) => i !== actor);
  const v = g.viewFor(g.players[other].id);
  assert.equal(v.players[actor].chars.length, 0);
  assert.ok(v.players.every((p) => p.hand === undefined));
  assert.equal(v.hand, g.players[other].hand);
});

test('hành động sai lượt bị từ chối bằng GameError', () => {
  const g = makeGame(4);
  const wrong = (g.currentActor() + 1) % 4;
  assert.throws(() => g.act(wrong, { type: 'pick', rank: g.draftOptions()[0] }), GameError);
});

test('không được xây trước khi lấy vàng hoặc rút bài', () => {
  const g = makeGame(4);
  startTurns(g, { 6: 0 });
  const p = g.players[0];
  p.hand = [card(1, 'tavern', 1, 'green')];
  assert.throws(() => g.act(0, { type: 'build', cardId: 1001 }), /Phải lấy vàng/);
  g.act(0, { type: 'takeGold' });
  g.act(0, { type: 'build', cardId: 1001 });
  assert.equal(p.city.length, 1);
});

test('Kẻ trộm lấy toàn bộ vàng khi nhân vật bị nhắm lộ diện', () => {
  const g = makeGame(4);
  startTurns(g, { 2: 0, 6: 1 });
  g.players[1].gold = 5;
  g.act(0, { type: 'ability', target: 6 });
  g.act(0, { type: 'takeGold' });
  const thiefGold = g.players[0].gold;
  g.act(0, { type: 'endTurn' });
  assert.equal(g.turn.rank, 6);
  assert.equal(g.players[0].gold, thiefGold + 5);
  assert.equal(g.players[1].gold, 1); // +1 của Thương gia sau khi bị trộm
});

test('Lãnh chúa không phá được công trình của Giám mục', () => {
  const g = makeGame(4);
  startTurns(g, { 5: 1, 8: 0 });
  g.players[1].city = [card(2, 'temple', 1, 'blue')];
  g.act(1, { type: 'takeGold' });
  g.act(1, { type: 'endTurn' });
  assert.equal(g.turn.rank, 8);
  assert.equal(g.destroyCost(0, 1, g.players[1].city[0]), null);
  assert.throws(() => g.act(0, { type: 'ability', target: 1, cardId: 1002 }), /Không thể phá/);
});

test('history ghi tóm tắt lượt; chủ nhân vật bị ám sát chỉ lộ khi hết vòng', () => {
  const g = makeGame(4);
  startTurns(g, { 1: 0, 4: 1, 6: 2 });
  g.act(0, { type: 'ability', target: 4 });
  g.act(0, { type: 'takeGold' });
  g.act(0, { type: 'endTurn' });
  assert.deepEqual(g.history[0].events, ['Ám sát Vua', 'Lấy 2 vàng']);
  const killed = g.viewFor('p3').history.find((h) => h.rank === 4);
  assert.equal(killed.status, 'killed');
  assert.equal(killed.pi, null);
  assert.equal(g.turn.rank, 6);
  g.act(2, { type: 'takeGold' });
  g.act(2, { type: 'endTurn' }); // hết vòng
  assert.equal(g.lastRound.history.find((h) => h.rank === 4).pi, 1);
});

test('không bao giờ lộ nhân vật chưa được gọi của người khác (quét toàn bộ ván, 2–7 người)', () => {
  const { botAction } = require('../server/bot');
  for (let n = 2; n <= 7; n++) {
    for (let k = 0; k < 15; k++) {
      const g = makeGame(n);
      while (g.phase !== 'ended') {
        for (let v = 0; v < n; v++) {
          const view = g.viewFor(`p${v}`);
          view.players.forEach((p, i) => {
            if (i === view.me) return;
            for (const r of p.chars) assert.ok(g.revealed[r], `lộ nhân vật ${r} (n=${n}, ${g.phase})`);
          });
          for (const h of view.history) {
            if (h.pi !== null && h.pi !== view.me) assert.ok(g.revealed[h.rank], `history lộ chủ nhân vật ${h.rank}`);
          }
          if (view.draft && view.draft.options) assert.equal(g.currentActor(), view.me);
          if (view.turn && view.turn.drawn) assert.equal(view.turn.pi, view.me);
        }
        const pi = g.currentActor();
        g.act(pi, botAction(g, pi));
      }
    }
  }
});

test('tính điểm: +3 đủ 5 màu, +4 hoàn thành đầu tiên, Cổng Rồng tính 8', () => {
  const g = makeGame(4, { target: 5 });
  g.players[0].city = [
    card(1, 'manor', 3, 'yellow'), card(2, 'temple', 1, 'blue'), card(3, 'tavern', 1, 'green'),
    card(4, 'prison', 2, 'red'), card(5, 'dragongate', 6, 'purple'),
  ];
  g.firstComplete = 0;
  const s = g.scoreOf(0);
  assert.equal(s.base, 3 + 1 + 1 + 2 + 6);
  assert.equal(s.colorBonus, 3);
  assert.equal(s.completeBonus, 4);
  assert.equal(s.extra, 2); // Cổng Rồng +2
  assert.equal(s.total, 13 + 3 + 4 + 2);
});

// ---------- Luật bản 2016 ----------
const uni = (id, key, cost, extra = {}) => ({ ...card(id, key, cost, 'purple'), ...extra });

test('2016: mặc định hoàn thành thành phố ở 7 công trình; chồng bài có 14 công trình tím', () => {
  const g = makeGame(4);
  assert.equal(g.target, 7);
  assert.equal(g.deck.length + g.players.reduce((s, p) => s + p.hand.length, 0), 54 + 14);
  assert.equal(new Set(g.uniqueKeys).size, 14);
});

test('2016: Kho bí mật không xây được nhưng +3 điểm nếu còn trên tay', () => {
  const g = makeGame(4);
  startTurns(g, { 6: 0 });
  const p = g.players[0];
  p.gold = 10;
  p.hand = [uni(1, 'secretvault', 0, { noBuild: true })];
  g.act(0, { type: 'takeGold' });
  assert.throws(() => g.act(0, { type: 'build', cardId: 1001 }), /Không thể xây/);
  assert.equal(g.scoreOf(0).extra, 3);
});

test('2016: Chuồng ngựa không tính vào giới hạn xây; Mỏ đá cho xây trùng; Xưởng giảm giá công trình tím', () => {
  const g = makeGame(4);
  startTurns(g, { 6: 0 });
  const p = g.players[0];
  p.gold = 30;
  p.city = [card(1, 'tavern', 1, 'green'), uni(2, 'quarry', 5), uni(3, 'factory', 5)];
  p.hand = [card(4, 'tavern', 1, 'green'), uni(5, 'stables', 2), uni(6, 'library', 6)];
  g.act(0, { type: 'takeGold' });
  g.act(0, { type: 'build', cardId: 1004 }); // trùng tên nhưng có Mỏ đá
  const gold = p.gold;
  g.act(0, { type: 'build', cardId: 1005 }); // Chuồng ngựa: vẫn xây được dù đã hết lượt xây
  assert.equal(p.gold, gold - 1); // Xưởng: 2 → 1
  assert.throws(() => g.act(0, { type: 'build', cardId: 1006 }), /chỉ được xây 1/);
});

test('2016: Đài kỷ niệm tính là 2 công trình khi xét hoàn thành', () => {
  const g = makeGame(4);
  startTurns(g, { 6: 0 });
  const p = g.players[0];
  p.gold = 10;
  p.city = [1, 2, 3, 4].map((k) => card(10 + k, 'k' + k, 1, 'green'));
  p.hand = [uni(1, 'monument', 4)];
  g.act(0, { type: 'takeGold' });
  g.act(0, { type: 'build', cardId: 1001 });
  assert.equal(g.citySize(p), 6);
  p.city.push(card(20, 'k5', 1, 'red'));
  assert.equal(g.citySize(p), 7);
});

test('2016: điểm thưởng cuối game của công trình tím', () => {
  const g = makeGame(4);
  const p = g.players[0];
  g.crown = 0;
  p.gold = 4;
  p.hand = [card(1, 'x', 1, 'red'), card(2, 'y', 1, 'red')];
  p.city = [uni(3, 'imperialtreasury', 5), uni(4, 'maproom', 5), uni(5, 'statue', 3), uni(6, 'wishingwell', 5), uni(7, 'basilica', 4)];
  const names = Object.fromEntries(g.scoreOf(0).extras.map((e) => [e.name, e.pts]));
  assert.equal(names['Kho bạc hoàng gia'], 4);
  assert.equal(names['Phòng bản đồ'], 2);
  assert.equal(names['Tượng đài'], 5);
  assert.equal(names['Giếng ước'], 5);
  assert.equal(names['Đại giáo đường'], 4); // giá lẻ: 5, 5, 3, 5
});

test('2016: Mỏ vàng +1 khi lấy vàng; Phòng thí nghiệm +2; Nhà tế bần & Công viên cuối lượt', () => {
  const g = makeGame(4);
  startTurns(g, { 6: 0, 7: 1 });
  const p = g.players[0];
  p.city = [uni(1, 'goldmine', 6), uni(2, 'laboratory', 5), uni(3, 'poorhouse', 4), uni(4, 'park', 6)];
  p.gold = 0;
  p.hand = [card(5, 'x', 9, 'red')];
  g.act(0, { type: 'takeGold' });
  assert.equal(p.gold, 3); // lấy vàng: 2 + 1 nhờ Mỏ vàng
  g.act(0, { type: 'laboratory', cardId: 1005 });
  assert.equal(p.gold, 5); // Phòng thí nghiệm +2
  p.gold = 0;
  g.act(0, { type: 'endTurn' });
  assert.equal(p.gold, 1); // Nhà tế bần
  assert.equal(p.hand.length, 2); // Công viên
});
