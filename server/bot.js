// Bot đơn giản: trả về 1 hành động hợp lệ cho người chơi pi, hoặc null.
const { CHARACTERS } = require('./cards');

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffled = (arr) => arr.slice().sort(() => Math.random() - 0.5);
const COLORS = ['yellow', 'blue', 'green', 'red', 'purple'];

function pickCharacter(g, p, options) {
  const count = (color) => p.city.filter((c) => c.color === color).length;
  const score = (r) => {
    const key = g.cast[r];
    const info = CHARACTERS[key];
    let s = Math.random() * 3;
    if (info.color) s += count(info.color) * 1.5 + (r === 4 || r === 6 || r === 8 ? 1 : 0);
    if (r === 7) s += p.gold >= 4 && p.hand.length >= 2 ? 3 : 0;
    if (key === 'navigator') s -= 2;
    if (r === 3) s += p.hand.length === 0 ? 4 : 0;
    if (r === 1 || r === 2) s += 1.5;
    if (key === 'alchemist') s += p.gold >= 3 ? 2 : 0;
    return s;
  };
  return options.slice().sort((a, b) => score(b) - score(a))[0];
}

// Kỹ năng chủ động cho nhân vật đang chơi (hoặc null)
function abilityAction(g, pi, t) {
  const p = g.players[pi];
  const mine = new Set(p.chars);
  const faceUp = g.draft ? g.draft.faceUp : [];
  const others = g.players.map((_, i) => i).filter((i) => i !== pi);
  const enemyRanks = (key) => g.rankTargets(key).filter((r) => !mine.has(r) && !faceUp.includes(r));
  switch (t.key) {
    case 'assassin': {
      const opts = enemyRanks('assassin');
      return opts.length ? { type: 'ability', target: rand(opts) } : null;
    }
    case 'witch': {
      if (!t.actionTaken) return null;
      const opts = enemyRanks('witch');
      return opts.length ? { type: 'ability', target: rand(opts) } : null;
    }
    case 'thief': {
      const opts = enemyRanks('thief');
      return opts.length ? { type: 'ability', target: rand(opts) } : null;
    }
    case 'magistrate': {
      let opts = enemyRanks('magistrate');
      if (opts.length < 3) opts = g.rankTargets('magistrate');
      const ranks = shuffled(opts).slice(0, 3);
      return ranks.length === 3 ? { type: 'ability', targets: ranks, signed: rand(ranks) } : null;
    }
    case 'blackmailer': {
      let opts = enemyRanks('blackmailer');
      if (opts.length < 2) opts = g.rankTargets('blackmailer');
      const ranks = shuffled(opts).slice(0, 2);
      return ranks.length === 2 ? { type: 'ability', targets: ranks, flower: rand(ranks) } : null;
    }
    case 'spy': {
      const ti = others.sort((a, b) => g.players[b].hand.length - g.players[a].hand.length)[0];
      return { type: 'ability', target: ti, color: rand(COLORS) };
    }
    case 'magician': {
      const richest = others.map((i) => ({ i, n: g.players[i].hand.length })).sort((a, b) => b.n - a.n)[0];
      if (richest && richest.n > p.hand.length + 1) return { type: 'ability', mode: 'swap', target: richest.i };
      const dup = p.hand.filter((c) => g.has(p, c.key));
      if (dup.length) return { type: 'ability', mode: 'redraw', cardIds: dup.map((c) => c.id) };
      return null;
    }
    case 'wizard': {
      const ti = others.filter((i) => g.players[i].hand.length).sort((a, b) => g.players[b].hand.length - g.players[a].hand.length)[0];
      return ti === undefined ? null : { type: 'ability', target: ti };
    }
    case 'seer':
      return others.some((i) => g.players[i].hand.length) ? { type: 'ability' } : null;
    case 'emperor': {
      const opts = g.emperorTargets(pi);
      return opts.length ? { type: 'ability', target: rand(opts) } : null;
    }
    case 'abbot':
      return g.abbotTargets(pi).length ? { type: 'ability' } : null;
    case 'navigator':
      return t.actionTaken ? { type: 'ability', mode: p.hand.length < 2 ? 'cards' : 'gold' } : null;
    case 'scholar':
      return g.deck.length ? { type: 'ability' } : null;
    case 'warlord': {
      if (!t.actionTaken) return null;
      let best = null;
      g.players.forEach((o, ti) => {
        if (ti === pi) return;
        for (const c of o.city) {
          const cost = g.destroyCost(pi, ti, c);
          if (cost === null || cost > p.gold - 2) continue;
          const val = o.city.length * 2 + c.cost - cost * 2;
          if (!best || val > best.val) best = { val, target: ti, cardId: c.id };
        }
      });
      return best && Math.random() < 0.7 ? { type: 'ability', target: best.target, cardId: best.cardId } : null;
    }
    case 'marshal': {
      if (!t.actionTaken) return null;
      let best = null;
      g.players.forEach((o, ti) => o.city.forEach((c) => {
        const cost = g.seizeCost(pi, ti, c);
        if (cost !== null && cost <= p.gold - 1 && (!best || c.cost > best.v)) best = { v: c.cost, target: ti, cardId: c.id };
      }));
      return best && Math.random() < 0.8 ? { type: 'ability', target: best.target, cardId: best.cardId } : null;
    }
    case 'diplomat': {
      if (!t.actionTaken) return null;
      let best = null;
      g.players.forEach((o, ti) => o.city.forEach((c) => p.city.forEach((m) => {
        const cost = g.swapCost(pi, ti, c, m);
        if (cost === null || cost > p.gold) return;
        const gain = g.value(c) - g.value(m);
        if (gain >= 2 && (!best || gain > best.gain)) best = { gain, target: ti, cardId: c.id, myCardId: m.id };
      })));
      return best && Math.random() < 0.7 ? { type: 'ability', target: best.target, cardId: best.cardId, myCardId: best.myCardId } : null;
    }
    case 'artist': {
      if (!t.actionTaken || p.gold < 3) return null;
      const c = p.city.filter((x) => !x.beauty).sort((a, b) => b.cost - a.cost)[0];
      return c ? { type: 'ability', cardId: c.id } : null;
    }
    default:
      return null;
  }
}

function botAction(g, pi) {
  const p = g.players[pi];
  if (g.phase === 'draft') {
    if (g.draft.steps[g.draft.idx].p !== pi) return null;
    const opts = g.draftOptions();
    if (g.draft.awaitingDiscard) return { type: 'pick', rank: rand(opts) };
    return { type: 'pick', rank: pickCharacter(g, p, opts) };
  }
  if (g.phase !== 'turns' || !g.turn || g.turn.pi !== pi) return null;
  const t = g.turn;

  if (t.drawn) {
    const best = t.drawn.filter((c) => !g.has(p, c.key)).sort((a, b) => b.cost - a.cost)[0] || t.drawn[0];
    return { type: 'keepCard', cardId: best.id };
  }
  // Thầy phép: lấy lá đắt nhất; xây ngay nếu được
  if (t.peek) {
    const hand = g.players[t.peek.target].hand;
    const best = hand.slice().sort((a, b) => b.cost - a.cost)[0];
    return { type: 'wizardTake', cardId: best.id, build: !g.buildBlock(p, best) };
  }
  // Nhà tiên tri: trả lá rẻ nhất
  if (t.seerGive && t.seerGive.length) {
    const c = p.hand.slice().sort((a, b) => a.cost - b.cost)[0];
    return { type: 'give', cardId: c.id };
  }

  if (!t.actionTaken) {
    // Kỹ năng nên dùng trước khi nhận tài nguyên (không áp dụng khi bị yểm bùa / đe dọa)
    if (!t.bewitched && !t.threat && !t.abilityUsed && ['assassin', 'thief', 'magistrate', 'blackmailer', 'magician', 'spy'].includes(t.key)) {
      const a = abilityAction(g, pi, t);
      if (a) return a;
    }
    const affordableSoon = p.hand.filter((c) => !c.noBuild && (!g.has(p, c.key) || g.has(p, 'quarry')));
    return affordableSoon.length === 0 ? { type: 'drawCards' } : { type: 'takeGold' };
  }
  // Thư đe dọa: trả nếu số vàng mất ít, ngược lại đánh cược
  if (t.threat) return { type: 'threat', pay: Math.floor(p.gold / 2) <= 2 || Math.random() < 0.5 };

  if (!t.abilityUsed) {
    const a = abilityAction(g, pi, t);
    if (a) return a;
  }
  if (!t.incomeTaken) return { type: 'income' };

  if (g.has(p, 'smithy') && !t.smithyUsed && p.gold >= 6 && p.hand.length < 2) return { type: 'smithy' };
  if (g.has(p, 'laboratory') && !t.labUsed) {
    const dup = p.hand.find((c) => g.has(p, c.key) && c.key !== 'secretvault');
    if (dup) return { type: 'laboratory', cardId: dup.id };
  }

  // Dùng đúng quy tắc xây của engine (giới hạn lượt, Hồng y, Lái buôn, Mỏ đá...)
  const c = p.hand.filter((x) => !g.buildInfo(pi, x).why).sort((a, b) => b.cost - a.cost)[0];
  if (c) return { type: 'build', cardId: c.id };
  return { type: 'endTurn' };
}

module.exports = { botAction };
