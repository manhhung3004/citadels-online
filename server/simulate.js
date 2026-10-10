// Chạy nhiều ván toàn bot để kiểm tra engine: node server/simulate.js
// Mỗi ván dùng bộ nhân vật ngẫu nhiên (27 nhân vật bản 2016, số 9 tùy chọn) và 2–8 người.
const { Game } = require('./game');
const { botAction } = require('./bot');
const { CHARACTERS, castProblem, randomCast } = require('./cards');

let games = 0;
const used = new Set();
for (let n = 2; n <= 8; n++) {
  for (let k = 0; k < 200; k++) {
    const players = Array.from({ length: n }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, isBot: true }));
    const chars = k < 20 && n <= 7 ? undefined : randomCast(n); // vài ván đầu dùng bộ cơ bản
    (chars || []).forEach((c) => used.add(c));
    const g = new Game(players, { target: k % 2 ? 7 : 8, chars });
    const total = () => g.deck.length + g.players.reduce((s, p) => s + p.hand.length + p.city.length, 0)
      + (g.turn && g.turn.drawn ? g.turn.drawn.length : 0);
    const gold = () => g.players.reduce((s, p) => s + p.gold, 0) + g.taxPool;
    const cardCount = total();
    let steps = 0;
    while (g.phase !== 'ended') {
      const pi = g.currentActor();
      const a = botAction(g, pi);
      if (!a) throw new Error(`Bot không có hành động (n=${n}, phase=${g.phase}, key=${g.turn && g.turn.key})`);
      const before = gold();
      const logFrom = g.logSeq;
      try {
        g.act(pi, a);
      } catch (e) {
        throw new Error(`Bot hành động sai (${g.turn && g.turn.key}, ${JSON.stringify(a)}): ${e.message}`);
      }
      for (let i = 0; i < n; i++) g.viewFor(`b${i}`);
      if (total() !== cardCount) throw new Error(`Mất bài: ${total()} != ${cardCount} sau ${a.type}`);
      if (g.players.some((p) => p.gold < 0)) throw new Error(`Vàng âm sau ${JSON.stringify(a)}`);
      if (gold() < before - 7 && !['build', 'ability', 'smithy'].includes(a.type)) {
        const lines = g.log.filter((e) => e.id > logFrom).map((e) => '  ' + e.text).join('\n');
        throw new Error(`Vàng biến mất sau ${a.type}: ${before} → ${gold()} (n=${n}, ${JSON.stringify(g.cast)})\n${lines}`);
      }
      if (++steps > 20000) throw new Error(`Game không kết thúc (n=${n})`);
    }
    if (!g.results || g.results.length !== n) throw new Error('Thiếu kết quả');
    games++;
  }
}
const missing = Object.keys(CHARACTERS).filter((k) => !used.has(k));
if (missing.length) throw new Error(`Chưa mô phỏng nhân vật: ${missing.join(', ')}`);
console.log(`OK: ${games} ván mô phỏng (2–8 người, đủ 27 nhân vật) hoàn tất không lỗi.`);
