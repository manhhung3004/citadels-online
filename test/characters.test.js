// Unit test 27 nhân vật bản 2016 + nhân vật số 9 + chơi 8 người: node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const { Game } = require('../server/game');
const { castProblem, BASE_CAST, CHARACTERS } = require('../server/cards');

const card = (id, key, cost, color) => ({ id: 1000 + id, key, name: key, cost, color });
// Thay nhân vật theo số trong bộ cơ bản: cast({ 1: 'witch', 9: 'queen' })
const cast = (repl = {}) => {
  const keys = BASE_CAST.slice();
  for (const [r, k] of Object.entries(repl)) {
    if (Number(r) === 9) keys.push(k);
    else keys[Number(r) - 1] = k;
  }
  return keys;
};
const makeGame = (n, repl) => {
  const g = new Game(Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` })), { chars: cast(repl) });
  g.players.forEach((p) => { p.hand = []; p.city = []; p.gold = 0; });
  return g;
};
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

test('bộ nhân vật: số 9 bắt buộc khi 8 người, Hoàng hậu cần 5 người, Hoàng đế không chơi 2 người', () => {
  assert.equal(castProblem(BASE_CAST, 7), null);
  assert.match(castProblem(BASE_CAST, 8).vi, /số 9/);
  assert.equal(castProblem(cast({ 9: 'artist' }), 8), null);
  assert.match(castProblem(cast({ 9: 'artist' }), 3).vi, /từ 4 người/);
  assert.match(castProblem(cast({ 9: 'queen' }), 4).vi, /Hoàng hậu/);
  assert.match(castProblem(cast({ 4: 'emperor' }), 2).vi, /Hoàng đế/);
  assert.match(castProblem(['assassin', 'witch', ...BASE_CAST.slice(1)], 4).vi, /Mỗi số/);
  assert.throws(() => makeGame(8), /số 9/);
});

test('9 nhân vật: số lá lật ngửa theo số người; 8 người — người chọn cuối được lấy lá úp', () => {
  for (const [n, up] of [[4, 3], [5, 2], [6, 1], [7, 0], [8, 0]]) {
    const g = makeGame(n, { 9: 'artist' });
    assert.equal(g.draft.faceUp.length, up, `n=${n}`);
    assert.ok(!g.draft.faceUp.includes(4));
  }
  const g = makeGame(8, { 9: 'taxcollector' });
  for (let k = 0; k < 7; k++) g.pick(g.currentActor(), g.draftOptions()[0]);
  assert.equal(g.draftOptions().length, 2);
  assert.ok(g.draftOptions().includes(g.draft.faceDown));
});

test('Phù thủy: yểm bùa → chủ nhân vật chỉ nhận tài nguyên, Phù thủy chơi tiếp với kỹ năng của nhân vật', () => {
  const g = makeGame(4, { 1: 'witch' });
  startTurns(g, { 1: 0, 6: 1 });
  assert.throws(() => g.act(0, { type: 'ability', target: 6 }), /nhận tài nguyên/);
  g.act(0, { type: 'takeGold' });
  g.act(0, { type: 'ability', target: 6 }); // kết thúc lượt Phù thủy ngay
  assert.equal(g.turn.rank, 6);
  assert.equal(g.turn.pi, 1);
  assert.throws(() => g.act(1, { type: 'income' }), /yểm bùa/);
  g.act(1, { type: 'takeGold' });
  assert.equal(g.players[1].gold, 2); // Thương gia bị yểm bùa: không nhận +1
  assert.equal(g.turn.pi, 0); // Phù thủy tiếp quản
  assert.equal(g.players[0].gold, 3); // 2 vàng + 1 vàng thưởng Thương gia
  g.players[0].hand = [card(1, 'market', 2, 'green')];
  g.act(0, { type: 'build', cardId: 1001 });
  assert.equal(g.players[0].city.length, 1);
});

test('Phù thủy chơi thay Kẻ trộm: vàng trộm về tay Phù thủy, chủ lá Kẻ trộm không tự trộm của mình', () => {
  const g = makeGame(3, { 1: 'witch' });
  startTurns(g, { 1: 0, 2: 1, 5: 1 });
  g.act(0, { type: 'takeGold' });
  g.act(0, { type: 'ability', target: 2 }); // yểm bùa Kẻ trộm
  g.act(1, { type: 'takeGold' }); // chủ Kẻ trộm chỉ nhận tài nguyên → Phù thủy tiếp quản
  assert.equal(g.turn.pi, 0);
  g.act(0, { type: 'ability', target: 5 }); // Phù thủy trộm Giám mục (cũng của người 1)
  g.act(0, { type: 'endTurn' });
  assert.equal(g.turn.rank, 5);
  assert.equal(g.players[1].gold, 0);
  assert.equal(g.players[0].gold, 4); // 2 vàng của mình + 2 vàng trộm được
});

test('Thẩm phán: tịch thu công trình đầu tiên của nhân vật bị lệnh có chữ ký, hoàn lại vàng', () => {
  const g = makeGame(4, { 1: 'magistrate' });
  startTurns(g, { 1: 0, 7: 1 });
  g.act(0, { type: 'ability', targets: [3, 5, 7], signed: 7 });
  g.act(0, { type: 'takeGold' });
  g.act(0, { type: 'endTurn' });
  const v = g.viewFor(g.players[1].id);
  assert.equal(v.warrants.signed, null); // người khác không biết lệnh nào thật
  assert.deepEqual(v.warrants.ranks, [3, 5, 7]);
  const p = g.players[1];
  p.gold = 10;
  p.hand.push(card(1, 'castle', 4, 'yellow'), card(2, 'tavern', 1, 'green'));
  g.act(1, { type: 'takeGold' });
  g.act(1, { type: 'build', cardId: 1001 });
  assert.equal(p.city.length, 0);
  assert.equal(g.players[0].city[0].key, 'castle');
  assert.equal(p.gold, 12); // được hoàn 4 vàng
  g.act(1, { type: 'build', cardId: 1002 }); // công trình thứ 2 không bị tịch thu
  assert.equal(p.city.length, 1);
});

test('Kẻ tống tiền: trả nửa số vàng / từ chối thư thật mất hết / từ chối thư giả không mất gì', () => {
  for (const [pay, flower, expectGold, expectB] of [[true, 4, 4, 4], [false, 4, 0, 8], [false, 5, 8, 0]]) {
    const g = makeGame(4, { 2: 'blackmailer' });
    startTurns(g, { 2: 0, 4: 1 });
    g.act(0, { type: 'ability', targets: [4, 5], flower });
    g.act(0, { type: 'takeGold' });
    g.players[0].gold = 0;
    g.act(0, { type: 'endTurn' });
    assert.equal(g.turn.pi, 1);
    assert.ok(g.turn.threat);
    assert.equal(g.viewFor(g.players[1].id).threats.real, null);
    g.players[1].gold = 6;
    assert.throws(() => g.act(1, { type: 'income' }), /tài nguyên/);
    g.act(1, { type: 'takeGold' });
    assert.throws(() => g.act(1, { type: 'endTurn' }), /thư đe dọa/);
    g.act(1, { type: 'threat', pay });
    assert.equal(g.players[1].gold, expectGold);
    assert.equal(g.players[0].gold, expectB);
  }
});

test('Gián điệp: mỗi lá đúng màu lấy 1 vàng và rút 1 lá; chỉ Gián điệp thấy bài', () => {
  const g = makeGame(4, { 2: 'spy' });
  startTurns(g, { 2: 0 });
  g.players[1].hand = [card(1, 'temple', 1, 'blue'), card(2, 'church', 2, 'blue'), card(3, 'manor', 3, 'yellow')];
  g.players[1].gold = 1;
  g.act(0, { type: 'ability', target: 1, color: 'blue' });
  assert.equal(g.players[0].gold, 1);
  assert.equal(g.players[1].gold, 0);
  assert.equal(g.players[0].hand.length, 2);
  assert.equal(g.viewFor(g.players[0].id).turn.spied.cards.length, 3);
  assert.equal(g.viewFor(g.players[1].id).turn.spied, null);
});

test('Thầy phép: lấy 1 lá từ tay người khác và xây ngay (không tính giới hạn, được trùng tên)', () => {
  const g = makeGame(4, { 3: 'wizard' });
  startTurns(g, { 3: 0 });
  const p = g.players[0];
  p.gold = 10;
  p.city = [card(9, 'tavern', 1, 'green')];
  g.players[1].hand = [card(1, 'tavern', 1, 'green')];
  p.hand = [card(2, 'market', 2, 'green')];
  g.act(0, { type: 'takeGold' });
  g.act(0, { type: 'ability', target: 1 });
  assert.equal(g.viewFor(g.players[0].id).turn.peek.cards.length, 1);
  assert.equal(g.viewFor(g.players[2].id).turn.peek.cards, undefined);
  g.act(0, { type: 'wizardTake', cardId: 1001, build: true });
  assert.equal(p.city.length, 2);
  g.act(0, { type: 'build', cardId: 1002 }); // vẫn còn 1 lượt xây
  assert.equal(p.city.length, 3);
});

test('Nhà tiên tri: lấy mỗi người 1 lá rồi trả lại mỗi người 1 lá; xây tối đa 2', () => {
  const g = makeGame(3, { 3: 'seer' });
  startTurns(g, { 3: 0 });
  g.players[1].hand = [card(1, 'temple', 1, 'blue')];
  g.players[2].hand = [card(2, 'manor', 3, 'yellow')];
  g.act(0, { type: 'ability' });
  assert.equal(g.players[0].hand.length, 2);
  assert.throws(() => g.act(0, { type: 'takeGold' }), /trả bài/);
  g.act(0, { type: 'give', cardId: 1002 });
  g.act(0, { type: 'give', cardId: 1001 });
  assert.equal(g.players[1].hand.length + g.players[2].hand.length, 2);
  assert.equal(g.turn.maxBuilds, 2);
});

test('Hoàng đế: bắt buộc trao vương miện, người nhận đưa 1 vàng', () => {
  const g = makeGame(4, { 4: 'emperor' });
  g.crown = 2;
  startTurns(g, { 4: 0 });
  g.act(0, { type: 'takeGold' });
  assert.throws(() => g.act(0, { type: 'endTurn' }), /vương miện/);
  assert.throws(() => g.act(0, { type: 'ability', target: 2 }), /Không thể/); // đang giữ vương miện
  g.players[1].gold = 3;
  g.act(0, { type: 'ability', target: 1 });
  assert.equal(g.crown, 1);
  assert.equal(g.players[1].gold, 2);
  assert.equal(g.players[0].gold, 3);
  g.act(0, { type: 'endTurn' });
});

test('Nguyên lão nhận vương miện và thu thuế bằng bài; Tu viện trưởng chọn vàng/bài + người giàu nhất đưa 1 vàng', () => {
  const g = makeGame(4, { 4: 'patrician', 5: 'abbot' });
  startTurns(g, { 4: 0, 5: 1 });
  assert.equal(g.crown, 0);
  g.players[0].city = [card(1, 'manor', 3, 'yellow'), card(2, 'castle', 4, 'yellow')];
  g.act(0, { type: 'takeGold' });
  g.act(0, { type: 'income' });
  assert.equal(g.players[0].hand.length, 2);
  g.act(0, { type: 'endTurn' });
  const a = g.players[1];
  a.city = [card(3, 'temple', 1, 'blue'), card(4, 'church', 2, 'blue')];
  g.players[2].gold = 9;
  g.act(1, { type: 'takeGold' });
  g.act(1, { type: 'income', gold: 1 });
  assert.equal(a.gold, 3);
  assert.equal(a.hand.length, 1);
  g.act(1, { type: 'ability' });
  assert.equal(a.gold, 4);
  assert.equal(g.players[2].gold, 8);
});

test('Hồng y: thiếu vàng thì lấy của người khác, trả bằng lá bài', () => {
  const g = makeGame(4, { 5: 'cardinal' });
  startTurns(g, { 5: 0 });
  const p = g.players[0];
  p.hand = [card(1, 'palace', 5, 'yellow'), card(2, 'temple', 1, 'blue'), card(3, 'tavern', 1, 'green')];
  g.players[2].gold = 6;
  g.act(0, { type: 'takeGold' }); // 2 vàng, thiếu 3
  assert.match(g.viewFor(g.players[0].id).costs[1001].why, /Thiếu 3/); // chỉ có 2 lá để trả 3 vàng
  assert.throws(() => g.act(0, { type: 'build', cardId: 1001 }), /Không đủ vàng/);
  p.hand.push(card(4, 'market', 2, 'green'));
  assert.equal(g.viewFor(g.players[0].id).costs[1001].why, null);
  g.act(0, { type: 'build', cardId: 1001 });
  assert.equal(p.gold, 0);
  assert.equal(g.players[2].gold, 3);
  assert.equal(g.players[2].hand.length, 3);
});

test('Nhà giả kim được hoàn vàng xây; Lái buôn xây công trình xanh lá không giới hạn', () => {
  const g = makeGame(4, { 6: 'alchemist' });
  startTurns(g, { 6: 0 });
  g.players[0].hand = [card(1, 'palace', 5, 'yellow')];
  g.players[0].gold = 3;
  g.act(0, { type: 'takeGold' });
  g.act(0, { type: 'build', cardId: 1001 });
  assert.equal(g.players[0].gold, 0);
  g.act(0, { type: 'endTurn' });
  assert.equal(g.players[0].gold, 5);

  const h = makeGame(4, { 6: 'trader' });
  startTurns(h, { 6: 0 });
  h.players[0].hand = [card(1, 'tavern', 1, 'green'), card(2, 'market', 2, 'green'), card(3, 'manor', 3, 'yellow'), card(4, 'temple', 1, 'blue')];
  h.players[0].gold = 10;
  h.act(0, { type: 'takeGold' });
  for (const id of [1001, 1002, 1003]) h.act(0, { type: 'build', cardId: id });
  assert.throws(() => h.act(0, { type: 'build', cardId: 1004 }), /chỉ được xây 1/);
});

test('Nhà hàng hải không được xây; Học giả rút 7 giữ 1, xáo phần còn lại vào chồng bài', () => {
  const g = makeGame(4, { 7: 'navigator' });
  startTurns(g, { 7: 0 });
  g.players[0].hand = [card(1, 'tavern', 1, 'green')];
  g.act(0, { type: 'takeGold' });
  g.act(0, { type: 'ability', mode: 'gold' });
  assert.equal(g.players[0].gold, 6);
  assert.throws(() => g.act(0, { type: 'build', cardId: 1001 }), /Nhà hàng hải/);

  const h = makeGame(4, { 7: 'scholar' });
  startTurns(h, { 7: 0 });
  const deck = h.deck.length;
  h.act(0, { type: 'ability' });
  assert.equal(h.turn.drawn.length, 7);
  h.act(0, { type: 'keepCard', cardId: h.turn.drawn[0].id });
  assert.equal(h.players[0].hand.length, 1);
  assert.equal(h.deck.length, deck - 1);
  assert.equal(h.turn.maxBuilds, 2);
});

test('Thống chế lấy công trình ≤ 3 và trả tiền; Nhà ngoại giao đổi công trình, trả chênh lệch; Giám mục được bảo vệ', () => {
  const g = makeGame(4, { 8: 'marshal' });
  startTurns(g, { 8: 0 });
  g.players[0].gold = 3;
  g.players[1].city = [card(1, 'manor', 3, 'yellow'), card(2, 'castle', 4, 'yellow')];
  assert.equal(g.seizeCost(0, 1, g.players[1].city[1]), null);
  g.act(0, { type: 'takeGold' });
  g.act(0, { type: 'ability', target: 1, cardId: 1001 });
  assert.equal(g.players[0].city[0].key, 'manor');
  assert.equal(g.players[1].gold, 3);

  const h = makeGame(4, { 8: 'diplomat' });
  startTurns(h, { 5: 2, 8: 0 });
  h.act(2, { type: 'takeGold' });
  h.act(2, { type: 'endTurn' });
  h.players[0].city = [card(1, 'tavern', 1, 'green')];
  h.players[1].city = [card(2, 'palace', 5, 'yellow')];
  h.players[2].city = [card(3, 'cathedral', 5, 'blue')];
  h.players[0].gold = 4;
  assert.equal(h.swapCost(0, 2, h.players[2].city[0], h.players[0].city[0]), null); // Giám mục
  h.act(0, { type: 'takeGold' });
  h.act(0, { type: 'ability', target: 1, cardId: 1002, myCardId: 1001 });
  assert.equal(h.players[0].city[0].key, 'palace');
  assert.equal(h.players[1].city[0].key, 'tavern');
  assert.equal(h.players[0].gold, 2);
  assert.equal(h.players[1].gold, 4);
});

test('Hoàng hậu +3 vàng khi ngồi cạnh số 4; Nghệ sĩ trang trí +1 điểm; Người thu thuế lấy kho thuế', () => {
  const g = makeGame(5, { 9: 'queen' });
  startTurns(g, { 4: 1, 9: 2 });
  g.act(1, { type: 'takeGold' });
  g.act(1, { type: 'endTurn' });
  assert.equal(g.players[2].gold, 3);

  const h = makeGame(5, { 9: 'artist' });
  startTurns(h, { 9: 0 });
  h.players[0].city = [card(1, 'palace', 5, 'yellow')];
  h.act(0, { type: 'takeGold' });
  h.act(0, { type: 'ability', cardId: 1001 });
  assert.throws(() => h.act(0, { type: 'ability', cardId: 1001 }), /đã được trang trí/);
  assert.equal(h.scoreOf(0).base, 6);

  const k = makeGame(5, { 9: 'taxcollector' });
  startTurns(k, { 6: 0, 9: 1 });
  k.players[0].hand = [card(1, 'tavern', 1, 'green')];
  k.act(0, { type: 'takeGold' });
  k.act(0, { type: 'build', cardId: 1001 });
  assert.equal(k.taxPool, 1);
  assert.equal(k.players[0].gold, 1); // 2 + 1 thưởng − 1 xây − 1 thuế
  k.act(0, { type: 'endTurn' });
  assert.equal(k.players[1].gold, 1);
  assert.equal(k.taxPool, 0);
});

test('bộ nhân vật ngẫu nhiên luôn hợp lệ với số người; 8 người luôn có số 9', () => {
  const { randomCast } = require('../server/cards');
  for (let n = 2; n <= 8; n++) {
    for (let i = 0; i < 100; i++) {
      const keys = randomCast(n);
      assert.equal(castProblem(keys, n), null, `n=${n}: ${keys}`);
      if (n === 8) assert.equal(keys.length, 9);
    }
  }
});

test('bộ nhân vật bí mật: không bao giờ lộ tên nhân vật mà người xem chưa thấy / chưa được nêu tên', () => {
  const { botAction } = require('../server/bot');
  const { CHARACTERS, randomCast } = require('../server/cards');
  for (let k = 0; k < 40; k++) {
    const n = 4 + (k % 5);
    const jungle = k % 2 === 1; // Luật rừng NNHP: bộ nhân vật đổi mỗi vòng
    const g = new Game(Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` })), { chars: randomCast(n), secretCast: true, reshuffle: jungle });
    // Đầu ván: người chưa tới lượt chọn chỉ biết các lá lật ngửa
    const waiting = g.players.findIndex((_, i) => i !== g.currentActor());
    const v0 = g.viewFor(g.players[waiting].id);
    assert.ok(Object.values(v0.cast).filter(Boolean).length <= g.draft.faceUp.length);
    let steps = 0;
    while (g.phase !== 'ended' && steps++ < 3000) {
      for (const p of g.players) {
        const v = g.viewFor(p.id);
        // Luật rừng: tên nhân vật của các vòng trước (nhật ký cũ, xem lại vòng trước) là thông tin hợp lệ, không nói gì về vòng này
        const json = JSON.stringify(jungle ? { ...v, cast: null, lastRound: null, log: v.log.filter((e) => e.round === g.round) } : { ...v, cast: null });
        for (const [r, c] of Object.entries(v.cast)) {
          if (c) continue;
          // không lộ cả tên tiếng Việt lẫn tiếng Anh
          for (const name of [CHARACTERS[g.cast[r]].name, CHARACTERS[g.cast[r]].nameEn]) {
            assert.ok(!json.includes(name), `lộ "${name}" (số ${r}) cho ${p.name}`);
          }
        }
      }
      const pi = g.currentActor();
      g.act(pi, botAction(g, pi));
    }
    assert.ok(Object.values(g.viewFor('p0').cast).every(Boolean)); // hết ván: lộ toàn bộ
  }
});

test('song ngữ: mọi dòng nhật ký có bản tiếng Anh, tóm tắt lượt có đủ bản tiếng Anh, lỗi luật có .en', () => {
  const { botAction } = require('../server/bot');
  const { randomCast } = require('../server/cards');
  for (let k = 0; k < 30; k++) {
    const n = 2 + (k % 7);
    const g = new Game(Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` })), { chars: randomCast(n) });
    let steps = 0;
    while (g.phase !== 'ended' && steps++ < 3000) {
      const pi = g.currentActor();
      g.act(pi, botAction(g, pi));
      for (const e of g.log) assert.ok(typeof e.en === 'string' && e.en && !/^(round|reveal|info|gain|build|attack|crown|finish|muted)$/.test(e.en), `thiếu tiếng Anh: ${e.text}`);
      for (const h of g.history) assert.equal(h.eventsEn.length, h.events.length, `tóm tắt thiếu tiếng Anh: ${h.events}`);
    }
  }
  const g = makeGame(4);
  try { g.act(0, { type: 'nope' }); assert.fail('phải báo lỗi'); } catch (e) { assert.equal(e.en, 'Invalid action'); }
});

// ---------- Hết giờ (server gọi g.timeout(pi) sau 90 giây) ----------
test('hết giờ khi chọn nhân vật: chọn ngẫu nhiên 1 lá hợp lệ; người khác gọi thì không có tác dụng', () => {
  const g = makeGame(4);
  const pi = g.currentActor();
  const opts = g.draftOptions();
  assert.equal(g.timeout((pi + 1) % 4), false);
  assert.equal(g.timeout(pi), true);
  assert.equal(g.players[pi].chars.length, 1);
  assert.ok(opts.includes(g.players[pi].chars[0]));
  assert.notEqual(g.currentActor(), pi);
  assert.match(g.log.at(-1).text, /hết giờ/);
});

test('hết giờ trong lượt: mất lượt — không nhận tài nguyên, không thu theo màu, sang nhân vật tiếp theo', () => {
  const g = makeGame(4);
  startTurns(g, { 6: 0, 7: 1 });
  g.players[0].city = [card(1, 'market', 2, 'green')];
  assert.equal(g.timeout(0), true);
  assert.equal(g.players[0].gold, 1); // chỉ +1 thưởng Thương gia (tự động đầu lượt), không +2 vàng, không thu màu xanh lá
  assert.equal(g.turn.rank, 7);
  assert.equal(g.turn.pi, 1);
});

test('hết giờ khi đang chọn lá vừa rút: tự giữ lá, không mất bài', () => {
  const g = makeGame(4);
  startTurns(g, { 5: 0 });
  const total = () => g.deck.length + g.players.reduce((s, p) => s + p.hand.length, 0) + (g.turn && g.turn.drawn ? g.turn.drawn.length : 0);
  const before = total();
  g.act(0, { type: 'drawCards' });
  assert.ok(g.turn.drawn);
  g.timeout(0);
  assert.equal(g.players[0].hand.length, 1);
  assert.equal(total(), before);
});

test('hết giờ: Hoàng đế vẫn trao vương miện (ngẫu nhiên, không nhận cống); Nhà tiên tri trả đủ bài', () => {
  const g = makeGame(4, { 4: 'emperor' });
  startTurns(g, { 4: 0 });
  const targets = g.emperorTargets(0);
  g.players.forEach((p) => { p.gold = 3; });
  g.timeout(0);
  assert.ok(targets.includes(g.crown));
  assert.equal(g.players[0].gold, 3);

  const s = makeGame(4, { 3: 'seer' });
  startTurns(s, { 3: 0 });
  s.players.forEach((p, i) => { p.hand = i ? [card(10 + i, 'tavern', 1, 'green'), card(20 + i, 'market', 2, 'green')] : []; });
  s.act(0, { type: 'takeGold' });
  s.act(0, { type: 'ability' });
  assert.equal(s.players[0].hand.length, 3);
  s.timeout(0);
  assert.deepEqual(s.players.map((p) => p.hand.length), [0, 2, 2, 2]);
});

test('hết giờ khi bị yểm bùa: chủ lá không nhận gì, Phù thủy tiếp quản lượt', () => {
  const g = makeGame(4, { 1: 'witch' });
  startTurns(g, { 1: 0, 6: 1 });
  g.act(0, { type: 'takeGold' });
  g.act(0, { type: 'ability', target: 6 });
  assert.equal(g.turn.pi, 1);
  g.timeout(1);
  assert.equal(g.players[1].gold, 0);
  assert.equal(g.turn.pi, 0); // Phù thủy chơi tiếp, được thưởng Thương gia
  assert.equal(g.turn.rank, 6);
});

test('Luật rừng NNHP: mỗi vòng rút lại bộ nhân vật — luôn hợp lệ, có đổi qua các vòng, kiến thức vòng trước bị xóa', () => {
  const { botAction } = require('../server/bot');
  const { randomCast } = require('../server/cards');
  const players = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: true }));
  const g = new Game(players, { chars: randomCast(5), secretCast: true, reshuffle: true, target: 99 });
  const casts = new Set();
  let round = g.round;
  for (let steps = 0; g.round < 8 && steps < 5000; steps++) {
    if (g.round !== round) {
      round = g.round;
      assert.equal(castProblem(Object.values(g.cast), 5), null);
      assert.equal(g.publicRanks.size, 0); // đầu vòng mới: chưa số nào công khai (lá bị loại cũng giấu tên — Luật rừng giấu kỹ)
      assert.match(g.log.find((e) => e.round === round && /Luật rừng/.test(e.text)).text, /rút lại/);
    }
    casts.add(JSON.stringify(g.cast));
    const pi = g.currentActor();
    g.act(pi, botAction(g, pi));
  }
  assert.ok(g.round >= 8);
  assert.ok(casts.size > 1, 'bộ nhân vật phải đổi ít nhất 1 lần sau 7 vòng');
});

test('Luật rừng NNHP giấu kỹ: chỉ biết số đã lộ diện + nhân vật của mình; lá đã thấy khi chọn & lá bị loại đầu vòng là "?"; nhật ký không nêu tên số chưa lộ diện', () => {
  const { botAction } = require('../server/bot');
  const { randomCast } = require('../server/cards');
  for (let k = 0; k < 20; k++) {
    const n = 4 + (k % 4);
    const g = new Game(Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: true })), { chars: randomCast(n), secretCast: true, reshuffle: true });
    // Đầu vòng: lá bị loại lật ngửa vẫn là "?" với người không cầm
    for (const r of g.draft.faceUp) for (const p of g.players) assert.equal(g.viewFor(p.id).cast[r], null, `lá bị loại số ${r} lộ tên`);
    let steps = 0;
    while (g.phase !== 'ended' && steps++ < 4000) {
      const pi = g.currentActor();
      if (g.phase === 'draft') {
        const opts = g.draftOptions();
        const v = g.viewFor(g.players[pi].id);
        for (const r of opts) assert.ok(v.cast[r], 'đang chọn phải thấy các lá');
        g.act(pi, botAction(g, pi));
        // Chọn xong: lá đã thấy mà không lấy quay về "?" (trừ số đã lộ diện / của mình)
        const after = g.viewFor(g.players[pi].id);
        for (const r of opts) if (!g.players[pi].chars.includes(r) && !g.revealed[r] && g.phase === 'draft') assert.equal(after.cast[r], null, `lá số ${r} đã thấy khi chọn vẫn lộ tên`);
        continue;
      }
      for (const p of g.players) {
        const v = g.viewFor(p.id);
        const meI = g.indexOf(p.id);
        for (const [r, c] of Object.entries(v.cast)) {
          const R = Number(r);
          assert.equal(!!c, !!g.revealed[R] || g.players[meI].chars.includes(R), `số ${R}: biết=${!!c}, lộ diện=${!!g.revealed[R]}`);
          if (c) continue;
          // Nhật ký vòng này không nêu tên nhân vật chưa lộ diện
          const text = v.log.filter((e) => e.round === g.round).map((e) => e.text + ' ' + e.en).join(' ');
          for (const name of [CHARACTERS[g.cast[R]].name, CHARACTERS[g.cast[R]].nameEn]) {
            // tên có thể trùng với số đã lộ diện khác (không trùng vì mỗi số 1 nhân vật) — chỉ kiểm tra tên của số chưa lộ
            assert.ok(!text.includes(name), `nhật ký lộ "${name}" (số ${R})`);
          }
        }
      }
      g.act(pi, botAction(g, pi));
    }
    assert.ok(Object.values(g.viewFor('p0').cast).every(Boolean)); // hết ván: lộ toàn bộ
  }
});
