// Engine luật chơi Citadels (bản 2016) — toàn bộ logic chạy ở server.
const { CHARACTERS, BASE_CAST, castProblem, buildDeck } = require('./cards');

const COLORS = ['yellow', 'blue', 'green', 'red', 'purple'];
const COLOR_NAME = { yellow: 'Quý tộc', blue: 'Tôn giáo', green: 'Thương mại', red: 'Quân sự', purple: 'Đặc biệt' };
const COLOR_NAME_EN = { yellow: 'Noble', blue: 'Religious', green: 'Trade', red: 'Military', purple: 'Unique' };
// Lý do không xây được (buildInfo / placeBlock) → tiếng Anh
const WHY_EN = {
  'Không thể xây': 'Cannot be built', 'Đã có': 'Already in your city', 'Chỉ xây khi < 5 công trình': 'Only with < 5 districts',
  'Nhà hàng hải không được xây': 'The Navigator cannot build', 'Nhận tài nguyên trước': 'Gather resources first', 'Hết lượt xây': 'No builds left',
};
const whyEn = (why) => WHY_EN[why] || why.replace(/^Thiếu (\d+) vàng$/, 'Need $1 more gold');
// Tên tiếng Anh của lá bài (lá tạo tay trong test có thể thiếu nameEn)
const cardEn = (card) => card.nameEn || card.name;
// Giới hạn số công trình được xây trong lượt (mặc định 1)
const MAX_BUILDS = { architect: 3, seer: 2, scholar: 2, navigator: 0 };

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// message: tiếng Việt; en: tiếng Anh
class GameError extends Error {
  constructor(msg, en) { super(msg); this.en = en || msg; }
}
// Thông báo lỗi cố định → tiếng Anh (fail(vi) tự tra bảng; câu có biến thì truyền en riêng)
const FAIL_EN = {
  'Phải lấy vàng hoặc rút bài trước khi xây': 'Take gold or draw cards before building',
  'Lá bài không có trên tay': 'That card is not in your hand',
  'Không thể xây 2 công trình giống nhau': 'You cannot build two identical districts',
  'Không đủ vàng': 'Not enough gold',
  'Bạn đã thu thuế rồi': 'You already collected taxes',
  'Bạn đã dùng kỹ năng rồi': 'You already used your ability',
  'Người chơi không hợp lệ': 'Invalid player',
  'Mục tiêu không hợp lệ': 'Invalid target',
  'Phù thủy phải nhận tài nguyên trước khi yểm bùa': 'The Witch must gather resources before bewitching',
  'Chọn đúng 3 nhân vật và 1 lệnh có chữ ký': 'Choose exactly 3 characters and 1 signed warrant',
  'Màu không hợp lệ': 'Invalid color',
  'Chọn đúng 2 nhân vật và 1 thư thật': 'Choose exactly 2 characters and 1 real threat',
  'Chọn ít nhất 1 lá để đổi': 'Choose at least 1 card to discard',
  'Kỹ năng không hợp lệ': 'Invalid ability',
  'Người này không có lá bài nào': 'That player has no cards',
  'Không ai có bài trên tay': 'Nobody has any cards',
  'Không thể trao vương miện cho người này': 'You cannot give the crown to that player',
  'Bạn đang là người giàu nhất': 'You are already the richest player',
  'Chọn vàng hoặc bài': 'Choose gold or cards',
  'Chồng bài đã hết': 'The deck is empty',
  'Công trình không hợp lệ': 'Invalid district',
  'Không thể phá công trình này': 'This district cannot be destroyed',
  'Không thể lấy công trình này': 'This district cannot be seized',
  'Không thể đổi 2 công trình này': 'These two districts cannot be exchanged',
  'Công trình này đã được trang trí': 'This district is already beautified',
  'Nhân vật này không có kỹ năng chủ động': 'This character has no active ability',
  'Không có bài để lấy': 'No card to take',
  'Lá bài không hợp lệ': 'Invalid card',
  'Không cần trả bài': 'No cards to give back',
  'Bạn không có Phòng thí nghiệm': 'You do not have a Laboratory',
  'Đã dùng trong lượt này': 'Already used this turn',
  'Bạn không có Lò rèn': 'You do not have a Smithy',
  'Phải lấy vàng hoặc rút bài trước khi kết thúc lượt': 'Take gold or draw cards before ending your turn',
  'Hoàng đế phải trao vương miện trước khi kết thúc lượt': 'The Emperor must give away the crown before ending the turn',
  'Game đã kết thúc': 'The game is over',
  'Hành động không hợp lệ': 'Invalid action',
};
const fail = (vi, en) => { throw new GameError(vi, en || FAIL_EN[vi] || vi); };

class Game {
  // players: [{ id, name, isBot }]
  // opts: { target, chars: [key nhân vật, mỗi số 1 nhân vật; số 9 tùy chọn], uniques }
  constructor(players, opts = {}) {
    if (players.length < 2) fail('Cần ít nhất 2 người chơi', 'At least 2 players are needed');
    const keys = opts.chars || BASE_CAST;
    const bad = castProblem(keys, players.length);
    if (bad) fail(bad.vi, bad.en);
    this.cast = {}; // số → key nhân vật dùng trong ván
    for (const k of keys) this.cast[CHARACTERS[k].rank] = k;
    this.maxRank = this.cast[9] ? 9 : 8;
    this.target = opts.target || 7; // bản 2016: hoàn thành thành phố khi đủ 7 công trình
    this.players = shuffle(players.map((p) => ({
      id: p.id, name: p.name, isBot: !!p.isBot,
      gold: 2, hand: [], city: [], chars: [],
    })));
    this.deck = shuffle(buildDeck(opts.uniques));
    // Các công trình tím có trong ván này (công khai, hiện ở trang luật chơi)
    this.uniqueKeys = this.deck.filter((c) => c.color === 'purple').map((c) => c.key);
    for (const p of this.players) p.hand = this.draw(4);
    this.crown = Math.floor(Math.random() * this.players.length);
    this.round = 0;
    this.log = [];
    this.logSeq = 0;
    this.firstComplete = null;
    this.results = null;
    this.taxPool = 0; // kho thuế của Người thu thuế (giữ qua các vòng)
    // Bộ nhân vật bí mật (chế độ ngẫu nhiên): mỗi người chỉ biết tên nhân vật đã thấy khi chọn,
    // hoặc đã được nêu tên công khai (lật ngửa, được gọi, bị nhắm...). Xem charName / markSeen / viewFor.
    this.secret = !!opts.secretCast;
    this.publicRanks = new Set();
    this.seen = this.players.map(() => new Set());
    this.startRound();
    // Bộ tự chọn: báo cả bộ nhân vật; bộ ngẫu nhiên giữ bí mật
    if (!this.secret) {
      this.addLog(`Bộ nhân vật ván này: **${this.ranks().map((r) => `${r}. ${this.charName(r)}`).join(' · ')}**`,
        `Characters this game: **${this.ranks().map((r) => `${r}. ${this.charNameEn(r)}`).join(' · ')}**`, 'info');
    }
  }

  // ---------- tiện ích ----------
  // tone: round | reveal | info | gain | build | attack | crown | finish | muted
  // **...** trong text = phần cần nhấn mạnh (số tiền, đối tượng bị ảnh hưởng)
  // vi → text, en → en (cùng vị trí **...**)
  addLog(vi, en, tone = 'info', extra = {}) {
    this.log.push({ id: ++this.logSeq, round: this.round, tone, text: vi, en, ...extra });
    if (this.log.length > 400) this.log.shift();
  }

  draw(n) {
    const out = [];
    for (let i = 0; i < n && this.deck.length; i++) out.push(this.deck.pop());
    return out;
  }

  toBottom(cards) { this.deck.unshift(...cards); }

  has(p, key) { return p.city.some((c) => c.key === key); }

  key(r) { return this.cast[r]; }
  // Tên nhân vật dùng trong nhật ký / tóm tắt công khai → từ đây mọi người đều biết số r là ai
  charName(r) { this.publicRanks.add(r); return CHARACTERS[this.cast[r]].name; }
  charNameEn(r) { this.publicRanks.add(r); return CHARACTERS[this.cast[r]].nameEn; }

  // Người đang chọn nhân vật thấy các lá trong bảng chọn của mình
  markSeen() {
    if (this.phase !== 'draft') return;
    const pi = this.draft.steps[this.draft.idx].p;
    for (const r of this.draftOptions()) this.seen[pi].add(r);
  }
  ranks() { return Array.from({ length: this.maxRank }, (_, i) => i + 1); }

  // Giá trị công trình (Nghệ sĩ trang trí: +1)
  value(c) { return c.cost + (c.beauty || 0); }

  // Số công trình tính khi xét hoàn thành thành phố (Đài kỷ niệm tính là 2)
  citySize(p) { return p.city.length + (this.has(p, 'monument') ? 1 : 0); }
  complete(p) { return this.citySize(p) >= this.target; }

  // Giá xây thực tế (Xưởng thủ công: công trình tím khác rẻ hơn 1)
  buildCost(p, card) {
    const discount = card.color === 'purple' && card.key !== 'factory' && this.has(p, 'factory') ? 1 : 0;
    return Math.max(0, card.cost - discount);
  }

  // Lý do lá này không được đặt vào thành phố (bỏ qua vàng & giới hạn lượt), hoặc null
  placeBlock(p, card) {
    if (card.noBuild) return 'Không thể xây';
    const t = this.turn;
    const wizard = t && this.players[t.pi] === p && t.key === 'wizard'; // Thầy phép: được xây trùng tên
    if (this.has(p, card.key) && !this.has(p, 'quarry') && !wizard) return 'Đã có';
    if (card.key === 'monument' && p.city.length >= 5) return 'Chỉ xây khi < 5 công trình';
    return null;
  }

  // Lý do không xây được lá này (bỏ qua giới hạn lượt), hoặc null nếu được
  buildBlock(p, card) {
    const b = this.placeBlock(p, card);
    if (b) return b;
    const cost = this.buildCost(p, card);
    if (p.gold < cost) return `Thiếu ${cost - p.gold} vàng`;
    return null;
  }

  // Hồng y thiếu vàng: người có thể cho mượn (giàu nhất, đủ vàng) — mỗi vàng đổi 1 lá bài trên tay
  cardinalSource(pi, card, short) {
    const p = this.players[pi];
    if (p.hand.filter((c) => c !== card).length < short) return null;
    let best = null;
    this.players.forEach((o, i) => {
      if (i !== pi && o.gold >= short && (best === null || o.gold > this.players[best].gold)) best = i;
    });
    return best;
  }

  // Thông tin xây lá bài trong lượt hiện tại: { cost, why, free, borrow }
  buildInfo(pi, card) {
    const p = this.players[pi];
    const t = this.turn;
    const mine = t && t.pi === pi;
    const res = { cost: this.buildCost(p, card), why: null, free: false, borrow: null };
    if (mine && t.key === 'navigator') { res.why = 'Nhà hàng hải không được xây'; return res; }
    if (mine) res.free = card.key === 'stables' || (t.key === 'trader' && card.color === 'green');
    if (mine && !t.actionTaken) { res.why = 'Nhận tài nguyên trước'; return res; }
    const block = this.placeBlock(p, card);
    if (block) { res.why = block; return res; }
    if (p.gold < res.cost) {
      const short = res.cost - p.gold;
      const src = mine && t.key === 'cardinal' ? this.cardinalSource(pi, card, short) : null;
      if (src === null) { res.why = `Thiếu ${short} vàng`; return res; }
      res.borrow = { from: src, n: short };
    }
    if (mine && !res.free && t.builds >= t.maxBuilds) res.why = 'Hết lượt xây';
    return res;
  }

  indexOf(playerId) { return this.players.findIndex((p) => p.id === playerId); }

  // Người đang phải hành động (index) hoặc null
  currentActor() {
    if (this.phase === 'draft') return this.draft.steps[this.draft.idx].p;
    if (this.phase === 'turns' && this.turn) return this.turn.pi;
    return null;
  }

  // ---------- chọn nhân vật ----------
  startRound() {
    this.round++;
    this.phase = 'draft';
    this.killed = null;
    this.robbed = null;
    this.robberPi = null; // người đã dùng kỹ năng trộm (Kẻ trộm, hoặc Phù thủy chơi thay Kẻ trộm)
    this.bewitched = null; // số nhân vật bị Phù thủy yểm bùa
    this.witchPi = null;
    this.warrants = null; // Thẩm phán: { ranks, signed, by }
    this.threats = null; // Kẻ tống tiền: { [rank]: true nếu là thư thật }
    this.blackmailerPi = null;
    this.queenLater = null; // Hoàng hậu nhận 3 vàng cuối vòng (khi số 4 bị ám sát)
    this.turn = null;
    this.currentRank = 0;
    this.charOwner = {};
    this.revealed = {};
    // Diễn biến từng nhân vật trong vòng: { rank, pi, status: 'played'|'none'|'killed', events: [] }
    this.history = [];
    for (const p of this.players) p.chars = [];

    const n = this.players.length;
    const pool = shuffle(this.ranks());
    const faceDown = pool.pop();
    // Số lá lật ngửa bị loại theo số người (bản 2016)
    const faceUpCount = (this.maxRank === 9 ? { 4: 3, 5: 2, 6: 1 } : { 4: 2, 5: 1 })[n] || 0;
    const faceUp = [];
    while (faceUp.length < faceUpCount) {
      const i = pool.findIndex((r) => r !== 4); // nhân vật số 4 không bao giờ bị lật ngửa
      faceUp.push(pool.splice(i, 1)[0]);
    }

    const c = this.crown;
    const steps = [];
    if (n === 2) {
      steps.push({ p: c }, { p: (c + 1) % 2, discard: true }, { p: c, discard: true }, { p: (c + 1) % 2, discard: true });
    } else if (n === 3) {
      for (let k = 0; k < 6; k++) steps.push({ p: (c + k) % 3 });
    } else {
      for (let k = 0; k < n; k++) steps.push({ p: (c + k) % n });
    }
    this.draft = { pool, faceDown, faceUp, steps, idx: 0, awaitingDiscard: false };

    this.addLog(`**${this.players[c].name}** giữ vương miện, chọn nhân vật trước`,
      `**${this.players[c].name}** holds the crown and picks first`, 'round');
    if (faceUp.length) {
      this.addLog(`Bị loại khỏi vòng này: **${faceUp.map((r) => this.charName(r)).join(', ')}**`,
        `Out this round: **${faceUp.map((r) => this.charNameEn(r)).join(', ')}**`, 'muted');
    }
    this.markSeen();
  }

  draftOptions() {
    const d = this.draft;
    if (d.awaitingDiscard) return [...d.pool];
    const opts = [...d.pool];
    // 7–8 người: người chọn cuối chỉ còn 1 lá → được chọn thêm lá úp ban đầu
    if (d.idx === d.steps.length - 1 && d.pool.length === 1 && d.faceDown) opts.push(d.faceDown);
    return opts.sort((a, b) => a - b);
  }

  pick(pi, rank) {
    const d = this.draft;
    const step = d.steps[d.idx];
    if (step.p !== pi) fail('Chưa đến lượt bạn chọn nhân vật', 'It is not your turn to pick a character');
    rank = Number(rank);
    if (!this.draftOptions().includes(rank)) fail('Nhân vật không hợp lệ', 'Invalid character');

    if (d.awaitingDiscard) {
      d.pool.splice(d.pool.indexOf(rank), 1);
      d.awaitingDiscard = false;
      return this.advanceDraft();
    }

    if (d.pool.includes(rank)) d.pool.splice(d.pool.indexOf(rank), 1);
    else d.faceDown = null;
    this.charOwner[rank] = pi;
    this.players[pi].chars.push(rank);
    if (step.discard && d.pool.length) { d.awaitingDiscard = true; return; }
    this.advanceDraft();
  }

  advanceDraft() {
    const d = this.draft;
    d.idx++;
    if (d.idx >= d.steps.length) {
      this.phase = 'turns';
      this.currentRank = 0;
      this.addLog(`Chọn xong — bắt đầu gọi nhân vật 1 → ${this.maxRank}`, `Picks done — calling characters 1 → ${this.maxRank}`, 'muted');
      this.nextCharacter();
    }
  }

  // ---------- lượt chơi ----------
  nextCharacter() {
    this.turn = null;
    while (true) {
      this.currentRank++;
      if (this.currentRank > this.maxRank) return this.endRound();
      const r = this.currentRank;
      const owner = this.charOwner[r];
      if (owner === undefined) {
        this.history.push({ rank: r, pi: null, status: 'none', events: [], eventsEn: [] });
        this.addLog(`${this.charName(r)}: không ai chọn`, `${this.charNameEn(r)}: nobody picked it`, 'muted', { rank: r });
        if (this.bewitched === r) this.addLog('Bùa của Phù thủy **không có tác dụng**', 'The Witch\'s spell **has no effect**', 'muted', { rank: r });
        continue;
      }
      if (this.killed === r) {
        this.history.push({ rank: r, pi: null, status: 'killed', events: [], eventsEn: [] });
        this.addLog(`${this.charName(r)}: **bị ám sát — mất lượt**`, `${this.charNameEn(r)}: **murdered — loses the turn**`, 'attack', { rank: r });
        continue;
      }
      this.beginTurn(r, owner);
      return;
    }
  }

  // Ghi 1 việc vào tóm tắt lượt hiện tại (hiển thị trên thanh tiến trình vòng)
  note(vi, en) {
    const h = this.history[this.history.length - 1];
    if (h && h.status === 'played') { h.events.push(vi); h.eventsEn.push(en); }
  }

  newTurn(r, pi, extra = {}) {
    const key = this.cast[r];
    return {
      rank: r, key, pi, actionTaken: false, drawn: null, keepLeft: 0, shuffleRest: false,
      abilityUsed: false, incomeTaken: !CHARACTERS[key].income,
      builds: 0, maxBuilds: MAX_BUILDS[key] ?? 1, placed: 0, spent: 0, beauty: 0,
      labUsed: false, smithyUsed: false,
      bewitched: false, witched: false, threat: false, peek: null, seerGive: null, spied: null,
      ...extra,
    };
  }

  beginTurn(r, pi) {
    const p = this.players[pi];
    const key = this.cast[r];
    this.revealed[r] = true;
    this.history.push({ rank: r, pi, status: 'played', events: [], eventsEn: [] });
    this.addLog(`${this.charName(r)} lộ diện: ${p.name}`, `${this.charNameEn(r)} revealed: ${p.name}`, 'reveal', { rank: r, pi });

    // Vàng về tay người đã dùng kỹ năng trộm; không bao giờ tự trộm của chính mình (2–3 người / Phù thủy)
    if (this.robbed === r && this.robberPi !== null && this.robberPi !== pi) {
      const thief = this.players[this.robberPi];
      thief.gold += p.gold;
      this.addLog(`**${thief.name}** (Kẻ trộm) lấy **${p.gold} vàng** của **${p.name}**`,
        `**${thief.name}** (Thief) takes **${p.gold} gold** from **${p.name}**`, 'attack');
      this.note(`Bị trộm ${p.gold} vàng`, `Robbed of ${p.gold} gold`);
      p.gold = 0;
    }
    // Vua / Nguyên lão: người cầm nhận vương miện (kể cả khi bị yểm bùa)
    if (key === 'king' || key === 'patrician') {
      this.crown = pi;
      this.addLog(`**${p.name}** nhận vương miện — sẽ chọn nhân vật trước ở vòng sau`,
        `**${p.name}** takes the crown — picks first next round`, 'crown');
      this.note('Nhận vương miện', 'Took the crown');
    }
    if (this.bewitched === r && this.witchPi !== null) {
      this.turn = this.newTurn(r, pi, { bewitched: true, incomeTaken: true, abilityUsed: true, maxBuilds: 0 });
      this.addLog(`**${p.name}** bị yểm bùa — chỉ được nhận tài nguyên, sau đó Phù thủy chơi tiếp lượt này`,
        `**${p.name}** is bewitched — may only gather resources, then the Witch plays the rest of this turn`, 'attack');
      this.note('Bị yểm bùa', 'Bewitched');
      return;
    }
    this.turn = this.newTurn(r, pi, { threat: !!this.threats && r in this.threats && this.blackmailerPi !== pi });
    if (this.turn.threat) {
      this.addLog(`**${p.name}** nhận thư đe dọa — phải xử lý sau khi nhận tài nguyên`,
        `**${p.name}** received a threat — must deal with it after gathering resources`, 'attack');
    }
    this.startPassives(this.turn);
  }

  // Hiệu ứng tự động khi bắt đầu lượt của nhân vật (áp cho người đang chơi lượt, kể cả Phù thủy)
  startPassives(t) {
    const p = this.players[t.pi];
    if (t.key === 'merchant') {
      p.gold += 1;
      this.addLog(`${p.name} nhận thưởng **+1 vàng**`, `${p.name} gets a bonus **+1 gold**`, 'gain');
      this.note('+1 vàng thưởng', '+1 bonus gold');
    }
    if (t.key === 'architect') {
      const cards = this.draw(2);
      p.hand.push(...cards);
      this.addLog(`${p.name} nhận thưởng **+${cards.length} lá bài**`, `${p.name} gets a bonus **+${cards.length} cards**`, 'gain');
      this.note(`+${cards.length} lá thưởng`, `+${cards.length} bonus cards`);
    }
    if (t.key === 'taxcollector') {
      const n = this.taxPool;
      this.taxPool = 0;
      p.gold += n;
      this.addLog(`${p.name} (Người thu thuế) lấy **${n} vàng** trong kho thuế`,
        `${p.name} (Tax Collector) takes **${n} gold** from the tax pool`, n ? 'gain' : 'info');
      if (n) this.note(`Thu ${n} vàng thuế`, `Collected ${n} tax gold`);
    }
    if (t.key === 'queen') {
      const o4 = this.charOwner[4];
      const n = this.players.length;
      const near = o4 !== undefined && o4 !== t.pi && (o4 === (t.pi + 1) % n || o4 === (t.pi + n - 1) % n);
      if (near && this.killed === 4) {
        this.queenLater = t.pi; // chỉ biết khi lộ ra ai bị ám sát (cuối vòng)
      } else if (near) {
        p.gold += 3;
        this.addLog(`${p.name} ngồi cạnh **${this.charName(4)}** — Hoàng hậu **+3 vàng**`,
          `${p.name} sits next to the **${this.charNameEn(4)}** — Queen **+3 gold**`, 'gain');
        this.note('+3 vàng (cạnh số 4)', '+3 gold (next to rank 4)');
      } else this.addLog(`${p.name} không ngồi cạnh ${this.charName(4)}`, `${p.name} does not sit next to the ${this.charNameEn(4)}`, 'muted');
    }
  }

  requireTurn(pi, kind = 'main') {
    if (this.phase !== 'turns' || !this.turn) fail('Không phải giai đoạn chơi', 'Not the playing phase');
    const t = this.turn;
    if (t.pi !== pi) fail('Chưa đến lượt bạn', 'It is not your turn');
    if (t.drawn) fail('Hãy chọn lá bài muốn giữ trước', 'Choose the card to keep first');
    if (t.peek) fail('Hãy chọn 1 lá từ tay người chơi đó trước', 'Take 1 card from that player\'s hand first');
    if (t.seerGive && t.seerGive.length) fail('Hãy trả bài cho các người chơi trước', 'Give cards back to the players first');
    if (kind === 'resource') return t;
    if (t.bewitched) fail('Bạn bị yểm bùa: chỉ được nhận tài nguyên', 'You are bewitched: you may only gather resources');
    if (t.threat) {
      if (t.actionTaken) fail('Hãy xử lý thư đe dọa trước', 'Deal with the threat first');
      fail('Nhận tài nguyên rồi xử lý thư đe dọa trước', 'Gather resources, then deal with the threat first');
    }
    return t;
  }

  takeGold(pi) {
    const t = this.requireTurn(pi, 'resource');
    if (t.actionTaken) fail('Bạn đã thực hiện hành động rồi', 'You have already taken your action');
    const p = this.players[pi];
    const n = this.has(p, 'goldmine') ? 3 : 2; // Mỏ vàng: +1
    p.gold += n;
    t.actionTaken = true;
    this.addLog(`${p.name} lấy **+${n} vàng**${n > 2 ? ' (có Mỏ vàng)' : ''}`, `${p.name} takes **+${n} gold**${n > 2 ? ' (Gold Mine)' : ''}`);
    this.note(`Lấy ${n} vàng`, `Took ${n} gold`);
    this.afterResources();
  }

  drawCards(pi) {
    const t = this.requireTurn(pi, 'resource');
    if (t.actionTaken) fail('Bạn đã thực hiện hành động rồi', 'You have already taken your action');
    const p = this.players[pi];
    const n = this.has(p, 'observatory') ? 3 : 2;
    const keep = this.has(p, 'library') ? n : 1; // Thư viện: giữ tất cả
    const cards = this.draw(n);
    t.actionTaken = true;
    const kept = Math.min(keep, cards.length);
    this.addLog(`${p.name} rút ${cards.length} lá, giữ **${kept} lá**`, `${p.name} draws ${cards.length} cards, keeps **${kept}**`);
    this.note(`Rút ${cards.length} lá, giữ ${kept}`, `Drew ${cards.length} cards, kept ${kept}`);
    if (cards.length <= keep) { p.hand.push(...cards); return this.afterResources(); }
    t.drawn = cards;
    t.keepLeft = keep;
  }

  keepCard(pi, cardId) {
    const t = this.turn;
    if (this.phase !== 'turns' || !t || t.pi !== pi || !t.drawn) fail('Không có bài để chọn', 'No cards to choose from');
    const i = t.drawn.findIndex((c) => c.id === cardId);
    if (i < 0) fail('Lá bài không hợp lệ', 'Invalid card');
    this.players[pi].hand.push(t.drawn.splice(i, 1)[0]);
    t.keepLeft--;
    if (t.keepLeft <= 0 || !t.drawn.length) {
      if (t.shuffleRest) { this.deck.push(...t.drawn); shuffle(this.deck); } // Học giả: xáo lại vào chồng bài
      else this.toBottom(t.drawn);
      t.drawn = null;
      t.shuffleRest = false;
      this.afterResources();
    }
  }

  // Nhận tài nguyên xong: người bị yểm bùa nhường lượt cho Phù thủy
  afterResources() {
    const t = this.turn;
    if (!t || t.drawn || !t.bewitched) return;
    const witch = this.players[this.witchPi];
    this.addLog(`**${witch.name}** (Phù thủy) tiếp quản lượt của **${this.charName(t.rank)}**`,
      `**${witch.name}** (Witch) takes over the **${this.charNameEn(t.rank)}**'s turn`, 'attack', { rank: t.rank });
    this.note(`Phù thủy ${witch.name} tiếp quản`, `Witch ${witch.name} took over`);
    this.turn = this.newTurn(t.rank, this.witchPi, { actionTaken: true, witched: true });
    this.startPassives(this.turn);
  }

  // Kẻ tống tiền: người bị đe dọa trả nửa số vàng, hoặc từ chối (thư thật → mất hết vàng)
  resolveThreat(pi, pay) {
    const t = this.turn;
    if (this.phase !== 'turns' || !t || t.pi !== pi || !t.threat) fail('Không có thư đe dọa', 'There is no threat');
    if (!t.actionTaken || t.drawn) fail('Nhận tài nguyên trước', 'Gather resources first');
    const p = this.players[pi];
    const b = this.players[this.blackmailerPi];
    const real = this.threats[t.rank];
    delete this.threats[t.rank];
    t.threat = false;
    if (pay) {
      const amt = Math.floor(p.gold / 2);
      p.gold -= amt;
      b.gold += amt;
      this.addLog(`${p.name} trả **${amt} vàng** cho **${b.name}** (Kẻ tống tiền) để gỡ thư đe dọa`,
        `${p.name} pays **${amt} gold** to **${b.name}** (Blackmailer) to remove the threat`, 'attack');
      this.note(`Trả ${amt} vàng tống tiền`, `Paid ${amt} gold blackmail`);
    } else if (real) {
      const amt = p.gold;
      p.gold = 0;
      b.gold += amt;
      this.addLog(`${p.name} từ chối — thư đe dọa là **THẬT**: **${b.name}** lấy **${amt} vàng**`,
        `${p.name} refuses — the threat is **REAL**: **${b.name}** takes **${amt} gold**`, 'attack');
      this.note(`Từ chối, thư thật: mất ${amt} vàng`, `Refused, real threat: lost ${amt} gold`);
    } else {
      this.addLog(`${p.name} từ chối — thư đe dọa là **giả**, không mất gì`,
        `${p.name} refuses — the threat is **fake**, nothing lost`, 'info');
      this.note('Từ chối, thư giả', 'Refused, fake threat');
    }
  }

  build(pi, cardId) {
    const t = this.requireTurn(pi);
    if (!t.actionTaken) fail('Phải lấy vàng hoặc rút bài trước khi xây');
    const p = this.players[pi];
    const i = p.hand.findIndex((c) => c.id === cardId);
    if (i < 0) fail('Lá bài không có trên tay');
    const card = p.hand[i];
    const info = this.buildInfo(pi, card);
    if (info.why === 'Hết lượt xây') fail(`Bạn chỉ được xây ${t.maxBuilds} công trình mỗi lượt`, `You can only build ${t.maxBuilds} district(s) per turn`);
    if (info.why === 'Đã có') fail('Không thể xây 2 công trình giống nhau');
    if (info.why) fail(info.why.startsWith('Thiếu') ? 'Không đủ vàng' : `${card.name}: ${info.why}`, info.why.startsWith('Thiếu') ? 'Not enough gold' : `${cardEn(card)}: ${whyEn(info.why)}`);
    p.hand.splice(i, 1);
    if (info.borrow) {
      // Hồng y: lấy vàng còn thiếu, trả bằng các lá rẻ nhất trên tay
      const o = this.players[info.borrow.from];
      const n = info.borrow.n;
      o.gold -= n;
      p.gold += n;
      const give = p.hand.slice().sort((a, b) => a.cost - b.cost).slice(0, n);
      p.hand = p.hand.filter((c) => !give.includes(c));
      o.hand.push(...give);
      this.addLog(`${p.name} (Hồng y) lấy **${n} vàng** của **${o.name}**, đưa lại ${n} lá bài`,
        `${p.name} (Cardinal) takes **${n} gold** from **${o.name}**, giving back ${n} card(s)`, 'attack');
      this.note(`Lấy ${n} vàng của ${o.name}`, `Took ${n} gold from ${o.name}`);
    }
    p.gold -= info.cost;
    t.spent += info.cost;
    if (!info.free) t.builds++;
    this.placeDistrict(pi, card, info.cost);
  }

  // Đặt công trình vào thành phố + Thẩm phán tịch thu, thuế, hoàn thành thành phố
  placeDistrict(pi, card, paid) {
    const t = this.turn;
    const p = this.players[pi];
    let owner = pi;
    card.builtRound = this.round;
    const size = this.citySize(p) + 1 + (card.key === 'monument' ? 1 : 0);
    this.addLog(`${p.name} xây **${card.name}** (−${paid} vàng) · thành phố ${size}/${this.target}`,
      `${p.name} builds **${cardEn(card)}** (−${paid} gold) · city ${size}/${this.target}`, 'build', { color: card.color });
    this.note(`Xây ${card.name}`, `Built ${cardEn(card)}`);
    const w = this.warrants;
    if (w && w.signed === t.rank && w.by !== pi && t.placed === 0 && !this.has(this.players[w.by], card.key)) {
      const mag = this.players[w.by];
      p.gold += paid;
      t.spent -= paid;
      owner = w.by;
      this.warrants = null;
      this.addLog(`Lệnh bắt có chữ ký! **${mag.name}** (Thẩm phán) tịch thu **${card.name}** — ${p.name} được hoàn **${paid} vàng**`,
        `Signed warrant! **${mag.name}** (Magistrate) confiscates **${cardEn(card)}** — ${p.name} gets **${paid} gold** back`, 'attack');
      this.note(`Bị tịch thu ${card.name}`, `${cardEn(card)} confiscated`);
    }
    t.placed++;
    const o = this.players[owner];
    o.city.push(card);
    // Thuế: người sở hữu công trình mới nộp 1 vàng (trừ Người thu thuế đã lộ diện)
    if (this.cast[9] === 'taxcollector' && o.gold > 0 && !(this.revealed[9] && this.charOwner[9] === owner)) {
      o.gold--;
      this.taxPool++;
      this.addLog(`${o.name} nộp **1 vàng** thuế (kho thuế: ${this.taxPool})`, `${o.name} pays **1 gold** tax (tax pool: ${this.taxPool})`, 'muted');
    }
    this.checkComplete(owner);
  }

  checkComplete(pi) {
    const p = this.players[pi];
    if (this.complete(p) && this.firstComplete === null) {
      this.firstComplete = pi;
      this.addLog(`**${p.name}** hoàn thành thành phố đầu tiên! Game kết thúc cuối vòng này`,
        `**${p.name}** is the first to complete their city! The game ends after this round`, 'finish');
      this.note('🏁 Hoàn thành thành phố', '🏁 City completed');
    }
  }

  income(pi, a = {}) {
    const t = this.requireTurn(pi);
    if (t.incomeTaken) fail('Bạn đã thu thuế rồi');
    const p = this.players[pi];
    const info = CHARACTERS[t.key];
    const n = p.city.filter((c) => c.color === info.color || c.key === 'magicschool').length;
    // Tu viện trưởng chọn chia vàng / bài; Nguyên lão, Hồng y thu bằng bài
    const gold = info.income === 'gold' ? n : info.income === 'card' ? 0
      : Math.max(0, Math.min(n, a.gold === undefined ? n : Number(a.gold) || 0));
    const cards = this.draw(n - gold);
    p.gold += gold;
    p.hand.push(...cards);
    t.incomeTaken = true;
    const parts = [gold ? `+${gold} vàng` : '', cards.length ? `+${cards.length} lá bài` : ''].filter(Boolean).join(', ');
    const partsEn = [gold ? `+${gold} gold` : '', cards.length ? `+${cards.length} card(s)` : ''].filter(Boolean).join(', ');
    this.addLog(`${p.name} thu thuế **${parts || '+0'}**`, `${p.name} collects taxes **${partsEn || '+0'}**`, n ? 'gain' : 'info');
    if (parts) this.note(`Thu thuế ${parts}`, `Taxes ${partsEn}`);
  }

  // ---------- kỹ năng nhân vật ----------
  protectedFrom8(ti) { return this.cast[5] === 'bishop' && this.charOwner[5] === ti && this.killed !== 5; }
  wallExtra(o, card) { return card.key !== 'greatwall' && this.has(o, 'greatwall') ? 1 : 0; }

  // Lãnh chúa: giá phá hoặc null nếu không được phá
  destroyCost(pi, ti, card) {
    const o = this.players[ti];
    if (this.complete(o)) return null; // thành phố đã hoàn thành
    if (card.key === 'keep') return null;
    if (ti !== pi && this.protectedFrom8(ti)) return null;
    return Math.max(0, this.value(card) - 1 + this.wallExtra(o, card));
  }

  // Thống chế: giá lấy công trình (≤ 3) hoặc null
  seizeCost(pi, ti, card) {
    const o = this.players[ti];
    if (ti === pi || this.complete(o) || card.key === 'keep' || this.protectedFrom8(ti)) return null;
    if (this.value(card) > 3 || this.has(this.players[pi], card.key)) return null;
    return this.value(card) + this.wallExtra(o, card);
  }

  // Nhà ngoại giao: tiền chênh lệch khi đổi mine (của mình) lấy theirs, hoặc null
  swapCost(pi, ti, theirs, mine) {
    const p = this.players[pi];
    const o = this.players[ti];
    if (ti === pi || this.complete(o) || this.protectedFrom8(ti)) return null;
    if (theirs.key === 'keep' || mine.key === 'keep') return null;
    if (p.city.some((c) => c !== mine && c.key === theirs.key)) return null;
    if (o.city.some((c) => c !== theirs && c.key === mine.key)) return null;
    return Math.max(0, this.value(theirs) + this.wallExtra(o, theirs) - this.value(mine));
  }

  emperorTargets(pi) { return this.players.map((_, i) => i).filter((i) => i !== pi && i !== this.crown); }

  // Tu viện trưởng: những người giàu nhất (phải đưa 1 vàng) — rỗng nếu bạn đang giàu nhất
  abbotTargets(pi) {
    const max = Math.max(...this.players.map((o) => o.gold));
    if (this.players[pi].gold >= max) return [];
    return this.players.map((o, i) => i).filter((i) => i !== pi && this.players[i].gold === max);
  }

  // Số nhân vật được nhắm tới (Sát thủ, Phù thủy, Kẻ trộm, Thẩm phán, Kẻ tống tiền)
  rankTargets(key) {
    const all = this.ranks().filter((r) => r >= 2);
    if (key === 'thief' || key === 'blackmailer') return all.filter((r) => r >= 3 && r !== this.killed && r !== this.bewitched);
    return all;
  }

  ability(pi, a) {
    const t = this.requireTurn(pi);
    if (t.abilityUsed) fail('Bạn đã dùng kỹ năng rồi');
    const p = this.players[pi];
    const rankArg = (x) => Number(x);
    const player = (x) => {
      const i = Number(x);
      if (!Number.isInteger(i) || i === pi || !this.players[i]) fail('Người chơi không hợp lệ');
      return i;
    };
    switch (t.key) {
      case 'assassin': {
        const target = rankArg(a.target);
        if (!this.rankTargets('assassin').includes(target)) fail('Mục tiêu không hợp lệ');
        this.killed = target;
        this.addLog(`Sát thủ ám sát **${this.charName(target)}** — nhân vật này sẽ mất lượt`, `The Assassin murders the **${this.charNameEn(target)}** — that character loses their turn`, 'attack');
        this.note(`Ám sát ${this.charName(target)}`, `Murdered the ${this.charNameEn(target)}`);
        break;
      }
      case 'witch': {
        if (!t.actionTaken) fail('Phù thủy phải nhận tài nguyên trước khi yểm bùa');
        const target = rankArg(a.target);
        if (!this.rankTargets('witch').includes(target)) fail('Mục tiêu không hợp lệ');
        this.bewitched = target;
        this.witchPi = pi;
        this.addLog(`Phù thủy yểm bùa **${this.charName(target)}** — sẽ chơi thay lượt của nhân vật này`, `The Witch bewitches the **${this.charNameEn(target)}** — she will play that character's turn`, 'attack');
        this.note(`Yểm bùa ${this.charName(target)}`, `Bewitched the ${this.charNameEn(target)}`);
        t.abilityUsed = true;
        return this.closeTurn(); // Phù thủy kết thúc lượt ngay, không được xây
      }
      case 'magistrate': {
        const ranks = [...new Set((a.targets || []).map(Number))];
        const signed = Number(a.signed);
        const ok = this.rankTargets('magistrate');
        if (ranks.length !== 3 || !ranks.every((r) => ok.includes(r)) || !ranks.includes(signed)) fail('Chọn đúng 3 nhân vật và 1 lệnh có chữ ký');
        this.warrants = { ranks: ranks.sort((x, y) => x - y), signed, by: pi };
        this.addLog(`Thẩm phán đặt lệnh bắt lên **${ranks.map((r) => this.charName(r)).join(', ')}** (chỉ 1 lệnh có chữ ký)`,
          `The Magistrate places warrants on **${ranks.map((r) => this.charNameEn(r)).join(', ')}** (only 1 is signed)`, 'attack');
        this.note('Đặt 3 lệnh bắt', 'Placed 3 warrants');
        break;
      }
      case 'thief': {
        const target = rankArg(a.target);
        if (!this.rankTargets('thief').includes(target)) fail('Mục tiêu không hợp lệ');
        this.robbed = target;
        this.robberPi = pi;
        this.addLog(`Kẻ trộm nhắm vào **${this.charName(target)}** — sẽ lấy hết vàng khi nhân vật này lộ diện`, `The Thief targets the **${this.charNameEn(target)}** — will take all their gold when revealed`, 'attack');
        this.note(`Nhắm trộm ${this.charName(target)}`, `Robbing the ${this.charNameEn(target)}`);
        break;
      }
      case 'spy': {
        const ti = player(a.target);
        if (!COLORS.includes(a.color)) fail('Màu không hợp lệ');
        const o = this.players[ti];
        const n = o.hand.filter((c) => c.color === a.color).length;
        const gold = Math.min(n, o.gold);
        o.gold -= gold;
        p.gold += gold;
        const cards = this.draw(n);
        p.hand.push(...cards);
        t.spied = { target: ti, color: a.color, cards: o.hand.map((c) => ({ ...c })) };
        this.addLog(`Gián điệp xem bài của **${o.name}**, đoán màu ${COLOR_NAME[a.color]}: **${n} lá** → lấy **${gold} vàng**, rút ${cards.length} lá`,
          `The Spy looks at **${o.name}**'s hand, naming ${COLOR_NAME_EN[a.color]}: **${n} card(s)** → takes **${gold} gold**, draws ${cards.length}`, n ? 'attack' : 'info');
        this.note(`Do thám ${o.name}: ${n} lá ${COLOR_NAME[a.color]}`, `Spied on ${o.name}: ${n} ${COLOR_NAME_EN[a.color]}`);
        break;
      }
      case 'blackmailer': {
        const ranks = [...new Set((a.targets || []).map(Number))];
        const flower = Number(a.flower);
        const ok = this.rankTargets('blackmailer');
        if (ranks.length !== 2 || !ranks.every((r) => ok.includes(r)) || !ranks.includes(flower)) fail('Chọn đúng 2 nhân vật và 1 thư thật');
        this.threats = { [ranks[0]]: ranks[0] === flower, [ranks[1]]: ranks[1] === flower };
        this.blackmailerPi = pi;
        this.addLog(`Kẻ tống tiền gửi thư đe dọa tới **${ranks.map((r) => this.charName(r)).join(' và ')}** (chỉ 1 thư là thật)`,
          `The Blackmailer threatens the **${ranks.map((r) => this.charNameEn(r)).join(' and ')}** (only 1 threat is real)`, 'attack');
        this.note('Gửi 2 thư đe dọa', 'Sent 2 threats');
        break;
      }
      case 'magician': {
        if (a.mode === 'swap') {
          const o = this.players[player(a.target)];
          [p.hand, o.hand] = [o.hand, p.hand];
          this.addLog(`${p.name} đổi toàn bộ bài với **${o.name}**`, `${p.name} exchanges hands with **${o.name}**`, 'attack');
          this.note(`Đổi bài với ${o.name}`, `Swapped hands with ${o.name}`);
        } else if (a.mode === 'redraw') {
          const ids = new Set((a.cardIds || []).map(Number));
          const out = p.hand.filter((c) => ids.has(c.id));
          if (!out.length) fail('Chọn ít nhất 1 lá để đổi');
          p.hand = p.hand.filter((c) => !ids.has(c.id));
          this.toBottom(out);
          p.hand.push(...this.draw(out.length));
          this.addLog(`${p.name} bỏ ${out.length} lá, rút lại **${out.length} lá** từ chồng bài`, `${p.name} discards ${out.length} card(s) and draws **${out.length}** new ones`);
          this.note(`Đổi ${out.length} lá với chồng bài`, `Redrew ${out.length} card(s)`);
        } else fail('Kỹ năng không hợp lệ');
        break;
      }
      case 'wizard': {
        const ti = player(a.target);
        const o = this.players[ti];
        if (!o.hand.length) fail('Người này không có lá bài nào');
        t.peek = { target: ti };
        this.addLog(`Thầy phép xem bài trên tay **${o.name}** và lấy 1 lá`, `The Wizard looks at **${o.name}**'s hand and takes 1 card`, 'attack');
        break;
      }
      case 'seer': {
        const from = this.players.map((_, i) => i).filter((i) => i !== pi && this.players[i].hand.length);
        if (!from.length) fail('Không ai có bài trên tay');
        for (const i of from) {
          const o = this.players[i];
          p.hand.push(o.hand.splice(Math.floor(Math.random() * o.hand.length), 1)[0]);
        }
        t.seerGive = from;
        this.addLog(`Nhà tiên tri lấy ngẫu nhiên 1 lá của **${from.map((i) => this.players[i].name).join(', ')}** — sẽ trả lại mỗi người 1 lá`,
          `The Seer takes a random card from **${from.map((i) => this.players[i].name).join(', ')}** — and will give each one card back`, 'attack');
        this.note(`Lấy bài của ${from.length} người`, `Took cards from ${from.length} player(s)`);
        break;
      }
      case 'emperor': {
        const ti = player(a.target);
        if (!this.emperorTargets(pi).includes(ti)) fail('Không thể trao vương miện cho người này');
        this.giveCrown(pi, ti, true);
        break;
      }
      case 'abbot': {
        const list = this.abbotTargets(pi);
        if (!list.length) fail('Bạn đang là người giàu nhất');
        const ti = list.includes(Number(a.target)) ? Number(a.target) : list[0];
        const o = this.players[ti];
        o.gold -= 1;
        p.gold += 1;
        this.addLog(`**${o.name}** (giàu nhất) đưa Tu viện trưởng **1 vàng**`, `**${o.name}** (richest) gives the Abbot **1 gold**`, 'attack');
        this.note(`Nhận 1 vàng của ${o.name}`, `Got 1 gold from ${o.name}`);
        break;
      }
      case 'navigator': {
        if (a.mode === 'gold') { p.gold += 4; this.addLog(`${p.name} (Nhà hàng hải) nhận **+4 vàng**`, `${p.name} (Navigator) gains **+4 gold**`, 'gain'); this.note('+4 vàng', '+4 gold'); }
        else if (a.mode === 'cards') {
          const cards = this.draw(4);
          p.hand.push(...cards);
          this.addLog(`${p.name} (Nhà hàng hải) nhận **+${cards.length} lá bài**`, `${p.name} (Navigator) gains **+${cards.length} cards**`, 'gain');
          this.note(`+${cards.length} lá bài`, `+${cards.length} cards`);
        } else fail('Chọn vàng hoặc bài');
        break;
      }
      case 'scholar': {
        const cards = this.draw(7);
        if (!cards.length) fail('Chồng bài đã hết');
        this.addLog(`${p.name} (Học giả) rút **${cards.length} lá**, giữ 1, xáo phần còn lại vào chồng bài`, `${p.name} (Scholar) draws **${cards.length} cards**, keeps 1 and shuffles the rest back`, 'gain');
        this.note(`Rút ${cards.length} lá, giữ 1`, `Drew ${cards.length}, kept 1`);
        if (cards.length === 1) p.hand.push(...cards);
        else { t.drawn = cards; t.keepLeft = 1; t.shuffleRest = true; }
        break;
      }
      case 'warlord': {
        const ti = Number(a.target);
        const o = this.players[ti];
        if (!o) fail('Người chơi không hợp lệ');
        const card = o.city.find((c) => c.id === Number(a.cardId));
        if (!card) fail('Công trình không hợp lệ');
        const cost = this.destroyCost(pi, ti, card);
        if (cost === null) fail('Không thể phá công trình này');
        if (p.gold < cost) fail('Không đủ vàng');
        p.gold -= cost;
        o.city.splice(o.city.indexOf(card), 1);
        delete card.builtRound;
        delete card.beauty;
        this.addLog(`${p.name} phá **${card.name}** của **${o.name}** (−${cost} vàng) · ${o.name} còn ${this.citySize(o)}/${this.target}`,
          `${p.name} destroys **${o.name}**'s **${cardEn(card)}** (−${cost} gold) · ${o.name} now has ${this.citySize(o)}/${this.target}`, 'attack');
        this.note(`Phá ${card.name} của ${o.name}`, `Destroyed ${o.name}'s ${cardEn(card)}`);
        this.toBottom([card]);
        break;
      }
      case 'marshal': {
        const ti = player(a.target);
        const o = this.players[ti];
        const card = o.city.find((c) => c.id === Number(a.cardId));
        if (!card) fail('Công trình không hợp lệ');
        const cost = this.seizeCost(pi, ti, card);
        if (cost === null) fail('Không thể lấy công trình này');
        if (p.gold < cost) fail('Không đủ vàng');
        p.gold -= cost;
        o.gold += cost;
        o.city.splice(o.city.indexOf(card), 1);
        p.city.push(card);
        this.addLog(`${p.name} (Thống chế) lấy **${card.name}** của **${o.name}**, trả ${cost} vàng`, `${p.name} (Marshal) seizes **${o.name}**'s **${cardEn(card)}**, paying ${cost} gold`, 'attack');
        this.note(`Lấy ${card.name} của ${o.name}`, `Seized ${o.name}'s ${cardEn(card)}`);
        this.checkComplete(pi);
        break;
      }
      case 'diplomat': {
        const ti = player(a.target);
        const o = this.players[ti];
        const theirs = o.city.find((c) => c.id === Number(a.cardId));
        const mine = p.city.find((c) => c.id === Number(a.myCardId));
        if (!theirs || !mine) fail('Công trình không hợp lệ');
        const cost = this.swapCost(pi, ti, theirs, mine);
        if (cost === null) fail('Không thể đổi 2 công trình này');
        if (p.gold < cost) fail('Không đủ vàng');
        p.gold -= cost;
        o.gold += cost;
        p.city.splice(p.city.indexOf(mine), 1, theirs);
        o.city.splice(o.city.indexOf(theirs), 1, mine);
        this.addLog(`${p.name} (Nhà ngoại giao) đổi **${mine.name}** lấy **${theirs.name}** của **${o.name}**${cost ? `, trả ${cost} vàng chênh lệch` : ''}`,
          `${p.name} (Diplomat) exchanges **${cardEn(mine)}** for **${o.name}**'s **${cardEn(theirs)}**${cost ? `, paying ${cost} gold difference` : ''}`, 'attack');
        this.note(`Đổi ${mine.name} ↔ ${theirs.name}`, `Swapped ${cardEn(mine)} ↔ ${cardEn(theirs)}`);
        this.checkComplete(pi);
        break;
      }
      case 'artist': {
        const card = p.city.find((c) => c.id === Number(a.cardId));
        if (!card) fail('Công trình không hợp lệ');
        if (card.beauty) fail('Công trình này đã được trang trí');
        if (p.gold < 1) fail('Không đủ vàng');
        p.gold -= 1;
        card.beauty = 1;
        t.beauty++;
        this.addLog(`${p.name} (Nghệ sĩ) trang trí **${card.name}** — giá trị +1`, `${p.name} (Artist) beautifies **${cardEn(card)}** — value +1`, 'gain');
        this.note(`Trang trí ${card.name}`, `Beautified ${cardEn(card)}`);
        if (t.beauty >= 2) t.abilityUsed = true; // tối đa 2 công trình mỗi lượt
        return;
      }
      default:
        fail('Nhân vật này không có kỹ năng chủ động');
    }
    t.abilityUsed = true;
  }

  // Hoàng đế trao vương miện; người nhận đưa 1 vàng (hoặc 1 lá bài) nếu được nhận tài nguyên
  giveCrown(pi, ti, withTribute) {
    const p = this.players[pi];
    const o = this.players[ti];
    this.crown = ti;
    let got = '';
    let gotEn = '';
    if (withTribute && o.gold > 0) { o.gold--; p.gold++; got = ', nhận **1 vàng**'; gotEn = ', receiving **1 gold**'; }
    else if (withTribute && o.hand.length) { p.hand.push(o.hand.splice(Math.floor(Math.random() * o.hand.length), 1)[0]); got = ', nhận **1 lá bài**'; gotEn = ', receiving **1 card**'; }
    this.addLog(`Hoàng đế **${p.name}** trao vương miện cho **${o.name}**${got}`, `Emperor **${p.name}** gives the crown to **${o.name}**${gotEn}`, 'crown');
    this.note(`Trao vương miện cho ${o.name}`, `Gave the crown to ${o.name}`);
  }

  // Thầy phép lấy 1 lá đã xem: giữ trên tay hoặc xây ngay
  wizardTake(pi, cardId, buildNow) {
    const t = this.turn;
    if (this.phase !== 'turns' || !t || t.pi !== pi || !t.peek) fail('Không có bài để lấy');
    const p = this.players[pi];
    const o = this.players[t.peek.target];
    const i = o.hand.findIndex((c) => c.id === cardId);
    if (i < 0) fail('Lá bài không hợp lệ');
    const card = o.hand[i];
    if (buildNow) {
      const block = this.buildBlock(p, card);
      if (block) fail(block.startsWith('Thiếu') ? 'Không đủ vàng' : `${card.name}: ${block}`, block.startsWith('Thiếu') ? 'Not enough gold' : `${cardEn(card)}: ${whyEn(block)}`);
    }
    o.hand.splice(i, 1);
    t.peek = null;
    if (buildNow) {
      const cost = this.buildCost(p, card);
      p.gold -= cost;
      t.spent += cost;
      this.addLog(`Thầy phép lấy 1 lá của **${o.name}** và xây ngay`, `The Wizard takes a card from **${o.name}** and builds it at once`, 'attack');
      this.placeDistrict(pi, card, cost); // không tính giới hạn xây
    } else {
      p.hand.push(card);
      this.addLog(`Thầy phép lấy **1 lá** của **${o.name}** về tay`, `The Wizard takes **1 card** from **${o.name}** into hand`, 'attack');
      this.note(`Lấy 1 lá của ${o.name}`, `Took 1 card from ${o.name}`);
    }
  }

  // Nhà tiên tri trả 1 lá cho người kế tiếp trong danh sách
  seerGive(pi, cardId) {
    const t = this.turn;
    if (this.phase !== 'turns' || !t || t.pi !== pi || !t.seerGive || !t.seerGive.length) fail('Không cần trả bài');
    const p = this.players[pi];
    const i = p.hand.findIndex((c) => c.id === cardId);
    if (i < 0) fail('Lá bài không hợp lệ');
    const o = this.players[t.seerGive.shift()];
    o.hand.push(p.hand.splice(i, 1)[0]);
    this.addLog(`Nhà tiên tri trả 1 lá cho **${o.name}**`, `The Seer gives 1 card back to **${o.name}**`, 'muted');
    if (!t.seerGive.length) t.seerGive = null;
  }

  laboratory(pi, cardId) {
    const t = this.requireTurn(pi);
    const p = this.players[pi];
    if (!this.has(p, 'laboratory')) fail('Bạn không có Phòng thí nghiệm');
    if (t.labUsed) fail('Đã dùng trong lượt này');
    const i = p.hand.findIndex((c) => c.id === cardId);
    if (i < 0) fail('Lá bài không hợp lệ');
    this.toBottom(p.hand.splice(i, 1));
    p.gold += 2;
    t.labUsed = true;
    this.addLog(`${p.name} dùng Phòng thí nghiệm: bỏ 1 lá, **+2 vàng**`, `${p.name} uses the Laboratory: discards 1 card, **+2 gold**`, 'gain');
    this.note('Phòng thí nghiệm +2 vàng', 'Laboratory +2 gold');
  }

  smithy(pi) {
    const t = this.requireTurn(pi);
    const p = this.players[pi];
    if (!this.has(p, 'smithy')) fail('Bạn không có Lò rèn');
    if (t.smithyUsed) fail('Đã dùng trong lượt này');
    if (p.gold < 2) fail('Không đủ vàng');
    p.gold -= 2;
    p.hand.push(...this.draw(3));
    t.smithyUsed = true;
    this.addLog(`${p.name} dùng Lò rèn: −2 vàng, **+3 lá bài**`, `${p.name} uses the Smithy: −2 gold, **+3 cards**`, 'gain');
    this.note('Lò rèn: 2 vàng → 3 lá', 'Smithy: 2 gold → 3 cards');
  }

  endTurn(pi) {
    const t = this.requireTurn(pi);
    if (!t.actionTaken) fail('Phải lấy vàng hoặc rút bài trước khi kết thúc lượt');
    if (t.key === 'emperor' && !t.abilityUsed && this.emperorTargets(pi).length) fail('Hoàng đế phải trao vương miện trước khi kết thúc lượt');
    if (!t.incomeTaken) this.income(pi); // tự động thu thuế nếu quên
    this.closeTurn();
  }

  // Hết giờ (người chơi chờ quá lâu — server gọi theo room.options.turnTime):
  // - đang chọn nhân vật: chọn / bỏ ngẫu nhiên 1 lá (không thể "bỏ lượt" ở bước này)
  // - đang trong lượt: mất lượt — không nhận tài nguyên, không thu theo màu, không xây; việc dở dang
  //   xử lý mặc định để không mất bài / kẹt ván. Trả về false nếu người này không phải người đang phải hành động.
  timeout(pi) {
    if (this.phase === 'ended' || this.currentActor() !== pi) return false;
    const p = this.players[pi];
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    if (this.phase === 'draft') {
      const discard = this.draft.awaitingDiscard;
      this.addLog(discard ? `⏳ **${p.name}** hết giờ — bỏ ngẫu nhiên 1 nhân vật` : `⏳ **${p.name}** hết giờ — chọn ngẫu nhiên 1 nhân vật`,
        discard ? `⏳ **${p.name}** ran out of time — a random character is discarded` : `⏳ **${p.name}** ran out of time — a random character is picked`, 'timeout');
      this.pick(pi, pick(this.draftOptions()));
      this.markSeen();
      return true;
    }
    const t = this.turn;
    this.addLog(`⏳ **${p.name}** hết giờ — mất lượt`, `⏳ **${p.name}** ran out of time — turn lost`, 'timeout');
    this.note('Hết giờ — mất lượt', 'Out of time — turn lost');
    // Bài vừa rút đang chờ chọn: giữ các lá đầu (không mất bài)
    while (t.drawn) this.keepCard(pi, t.drawn[0].id);
    if (this.turn !== t) return true; // bị yểm bùa: Phù thủy đã tiếp quản
    // Bị yểm bùa mà chưa nhận tài nguyên: bỏ qua, Phù thủy tiếp quản phần còn lại của lượt
    if (t.bewitched) { t.actionTaken = true; this.afterResources(); return true; }
    t.peek = null; // Thầy phép đang xem bài: không lấy lá nào
    // Nhà tiên tri: trả đủ bài cho từng người (lá ngẫu nhiên)
    while (t.seerGive && t.seerGive.length) {
      if (!p.hand.length) { t.seerGive = null; break; }
      this.seerGive(pi, pick(p.hand).id);
    }
    // Thư đe dọa chưa xử lý: coi như từ chối (thư thật → mất vàng)
    if (t.threat) { t.actionTaken = true; this.resolveThreat(pi, false); }
    // Hoàng đế bắt buộc trao vương miện: trao ngẫu nhiên, không nhận cống
    if (t.key === 'emperor' && !t.abilityUsed) {
      const to = this.emperorTargets(pi);
      if (to.length) { this.giveCrown(pi, pick(to), false); t.abilityUsed = true; }
    }
    this.closeTurn();
    return true;
  }

  // Hiệu ứng cuối lượt rồi gọi nhân vật tiếp theo
  closeTurn() {
    const t = this.turn;
    const p = this.players[t.pi];
    if (t.key === 'alchemist' && t.spent > 0) {
      p.gold += t.spent;
      this.addLog(`${p.name} (Nhà giả kim) nhận lại **${t.spent} vàng** đã xây`, `${p.name} (Alchemist) gets back **${t.spent} gold** spent on building`, 'gain');
      this.note(`Hoàn ${t.spent} vàng`, `Refunded ${t.spent} gold`);
    }
    if (this.has(p, 'poorhouse') && p.gold === 0) {
      p.gold += 1;
      this.addLog(`${p.name} hết vàng — Nhà tế bần cho **+1 vàng**`, `${p.name} has no gold — Poor House gives **+1 gold**`, 'gain');
      this.note('Nhà tế bần +1 vàng', 'Poor House +1 gold');
    }
    if (this.has(p, 'park') && p.hand.length === 0) {
      const cards = this.draw(2);
      p.hand.push(...cards);
      if (cards.length) {
        this.addLog(`${p.name} hết bài — Công viên cho **+${cards.length} lá bài**`, `${p.name} has no cards — Park gives **+${cards.length} cards**`, 'gain');
        this.note(`Công viên +${cards.length} lá`, `Park +${cards.length} cards`);
      }
    }
    this.nextCharacter();
  }

  endRound() {
    this.turn = null;
    if (this.killed && this.charOwner[this.killed] !== undefined) {
      const owner = this.charOwner[this.killed];
      const key = this.cast[this.killed];
      this.revealed[this.killed] = true;
      this.addLog(`Hết vòng — ${this.charName(this.killed)} bị ám sát là **${this.players[owner].name}**`,
        `End of round — the murdered ${this.charNameEn(this.killed)} was **${this.players[owner].name}**`, 'attack', { scope: 'round' });
      if (key === 'king' || key === 'patrician') {
        this.crown = owner;
        this.addLog(`**${this.players[owner].name}** vẫn nhận vương miện dù bị ám sát`, `**${this.players[owner].name}** still takes the crown despite being murdered`, 'crown', { scope: 'round' });
      }
      if (key === 'emperor') {
        // Hoàng đế bị ám sát: vẫn trao vương miện (tự động cho người kế bên), không nhận gì
        const n = this.players.length;
        let ti = (owner + 1) % n;
        while (ti === owner || ti === this.crown) ti = (ti + 1) % n;
        this.giveCrown(owner, ti, false);
      }
      const h = this.history.find((x) => x.rank === this.killed);
      if (h) h.pi = owner;
    }
    if (this.queenLater !== null) {
      const q = this.players[this.queenLater];
      q.gold += 3;
      this.addLog(`${q.name} (Hoàng hậu) ngồi cạnh ${this.charName(4)} bị ám sát — **+3 vàng**`, `${q.name} (Queen) sat next to the murdered ${this.charNameEn(4)} — **+3 gold**`, 'gain', { scope: 'round' });
    }
    // Giữ lại diễn biến vòng vừa xong để người chơi xem lại trong lúc chọn nhân vật vòng mới
    this.lastRound = { round: this.round, history: this.history };
    if (this.firstComplete !== null) return this.endGame();
    this.startRound();
  }

  // ---------- tính điểm ----------
  scoreOf(pi) {
    const p = this.players[pi];
    const has = (k) => this.has(p, k);
    let base = 0;
    for (const c of p.city) base += this.value(c);
    // Khu phố ma: được coi là màu bất kỳ (bản 2016 không còn điều kiện "vòng cuối")
    const haunted = p.city.find((c) => c.key === 'haunted');
    const colors = new Set(p.city.filter((c) => c !== haunted).map((c) => c.color));
    if (haunted) colors.add(colors.size === 4 ? COLORS.find((x) => !colors.has(x)) : 'purple');
    const colorBonus = colors.size === 5 ? 3 : 0;
    const completeBonus = pi === this.firstComplete ? 4 : this.complete(p) ? 2 : 0;

    // Điểm thưởng từ công trình tím (bản 2016)
    const extras = [];
    const add = (name, nameEn, pts) => { if (pts) extras.push({ name, nameEn, pts }); };
    const uniqueCount = p.city.filter((c) => c.color === 'purple').length;
    if (has('dragongate')) add('Cổng Rồng', 'Dragon Gate', 2);
    if (has('imperialtreasury')) add('Kho bạc hoàng gia', 'Imperial Treasury', p.gold);
    if (has('maproom')) add('Phòng bản đồ', 'Map Room', p.hand.length);
    if (has('statue') && this.crown === pi) add('Tượng đài', 'Statue', 5);
    if (has('wishingwell')) add('Giếng ước', 'Wishing Well', uniqueCount);
    if (has('ivorytower') && uniqueCount === 1) add('Tháp ngà', 'Ivory Tower', 5);
    if (has('basilica')) add('Đại giáo đường', 'Basilica', p.city.filter((c) => c.cost % 2 === 1).length);
    if (has('capitol')) {
      const byColor = {};
      for (const c of p.city) if (c !== haunted) byColor[c.color] = (byColor[c.color] || 0) + 1;
      if (Math.max(0, ...Object.values(byColor)) + (haunted ? 1 : 0) >= 3) add('Điện Capitol', 'Capitol', 3);
    }
    if (p.hand.some((c) => c.key === 'secretvault')) add('Kho bí mật', 'Secret Vault', 3);
    const extra = extras.reduce((s, e) => s + e.pts, 0);
    return { base, colorBonus, completeBonus, extra, extras, total: base + colorBonus + completeBonus + extra };
  }

  endGame() {
    this.phase = 'ended';
    const res = this.players.map((p, pi) => ({
      pi, name: p.name, ...this.scoreOf(pi), gold: p.gold,
      topRank: Math.max(0, ...p.chars.filter((r) => r !== this.killed)),
    }));
    res.sort((a, b) => b.total - a.total || b.topRank - a.topRank);
    this.results = res;
    this.addLog(`Game kết thúc! **${res[0].name}** chiến thắng với **${res[0].total} điểm**`, `Game over! **${res[0].name}** wins with **${res[0].total} points**`, 'finish', { scope: 'round' });
  }

  // ---------- điểm vào duy nhất cho mọi hành động ----------
  act(pi, a) {
    if (this.phase === 'ended') fail('Game đã kết thúc');
    switch (a.type) {
      case 'pick': { this.pick(pi, a.rank); return this.markSeen(); }
      case 'takeGold': return this.takeGold(pi);
      case 'drawCards': return this.drawCards(pi);
      case 'keepCard': return this.keepCard(pi, Number(a.cardId));
      case 'build': return this.build(pi, Number(a.cardId));
      case 'income': return this.income(pi, a);
      case 'ability': return this.ability(pi, a);
      case 'threat': return this.resolveThreat(pi, !!a.pay);
      case 'wizardTake': return this.wizardTake(pi, Number(a.cardId), !!a.build);
      case 'give': return this.seerGive(pi, Number(a.cardId));
      case 'laboratory': return this.laboratory(pi, Number(a.cardId));
      case 'smithy': return this.smithy(pi);
      case 'endTurn': return this.endTurn(pi);
      default: fail('Hành động không hợp lệ');
    }
  }

  // ---------- trạng thái gửi cho từng người (ẩn thông tin bí mật) ----------
  viewFor(playerId) {
    const me = this.indexOf(playerId);
    const ended = this.phase === 'ended';
    const players = this.players.map((p, i) => ({
      id: p.id, name: p.name, isBot: p.isBot, gold: p.gold,
      handCount: p.hand.length,
      citySize: this.citySize(p),
      city: p.city,
      chars: p.chars.filter((r) => i === me || ended || this.revealed[r]),
      hasCrown: i === this.crown,
    }));
    // Bộ nhân vật: số chưa biết (bộ bí mật) gửi null → client hiện "Số N · ?"
    const knows = (r) => !this.secret || ended || this.publicRanks.has(r) || (me >= 0 && this.seen[me].has(r));
    const cast = {};
    for (const [r, k] of Object.entries(this.cast)) {
      const c = CHARACTERS[k];
      cast[r] = knows(Number(r)) ? { key: k, name: c.name, nameEn: c.nameEn, desc: c.desc, descEn: c.descEn, color: c.color || null, income: c.income || null } : null;
    }
    const view = {
      phase: this.phase, round: this.round, target: this.target,
      me, players, deckCount: this.deck.length,
      hand: me >= 0 ? this.players[me].hand : [],
      cast, maxRank: this.maxRank,
      currentRank: this.currentRank,
      killed: this.killed, robbed: this.robbed, bewitched: this.bewitched,
      // Lệnh bắt / thư đe dọa: ai bị nhắm là công khai, lá thật chỉ người đặt biết
      warrants: this.warrants && { ranks: this.warrants.ranks, signed: ended || this.warrants.by === me ? this.warrants.signed : null },
      threats: this.threats && {
        ranks: Object.keys(this.threats).map(Number),
        real: ended || this.blackmailerPi === me ? Number(Object.keys(this.threats).find((r) => this.threats[r])) || null : null,
      },
      taxPool: this.cast[9] === 'taxcollector' ? this.taxPool : null,
      firstComplete: this.firstComplete,
      uniqueKeys: this.uniqueKeys,
      log: this.log.slice(-250),
      results: this.results,
      actor: this.currentActor(),
      // Diễn biến công khai: nhân vật bị ám sát chỉ lộ chủ khi hết vòng (pi = null)
      history: this.history,
      lastRound: this.lastRound || null,
      faceUp: this.draft ? this.draft.faceUp : [],
    };
    if (this.phase === 'draft') {
      const d = this.draft;
      const isMe = d.steps[d.idx].p === me;
      view.draft = {
        faceUp: d.faceUp,
        awaitingDiscard: d.awaitingDiscard,
        options: isMe ? this.draftOptions() : null,
        remaining: d.pool.length,
        order: d.steps.map((s) => s.p), // thứ tự lượt chọn (2–3 người: mỗi người xuất hiện 2 lần)
        idx: d.idx,
      };
    }
    if (this.turn) {
      const t = this.turn;
      const mine = t.pi === me;
      view.turn = {
        rank: t.rank, key: t.key, pi: t.pi, actionTaken: t.actionTaken, abilityUsed: t.abilityUsed,
        incomeTaken: t.incomeTaken, builds: t.builds, maxBuilds: t.maxBuilds,
        labUsed: t.labUsed, smithyUsed: t.smithyUsed,
        drawn: mine ? t.drawn : null, keepLeft: t.keepLeft,
        choosing: !!t.drawn,
        bewitched: t.bewitched, witched: t.witched, threat: t.threat, beauty: t.beauty,
        seerGive: t.seerGive,
        // Bài trên tay người bị xem: chỉ người đang chơi thấy
        peek: mine && t.peek ? { target: t.peek.target, cards: this.players[t.peek.target].hand } : t.peek ? { target: t.peek.target } : null,
        spied: mine ? t.spied : null,
      };
      if (mine) {
        const p = this.players[me];
        // Giá xây thực tế & lý do không xây được cho từng lá trên tay (client chỉ hiển thị)
        view.costs = {};
        for (const c of p.hand) {
          const info = this.buildInfo(me, c);
          view.costs[c.id] = { cost: info.cost, why: info.why, borrow: info.borrow };
        }
        // Các mục tiêu hợp lệ cho kỹ năng (client chỉ hiển thị)
        view.targets = {
          ranks: this.rankTargets(t.key),
          emperor: t.key === 'emperor' ? this.emperorTargets(me) : [],
          abbot: t.key === 'abbot' ? this.abbotTargets(me) : [],
        };
        const list = (fn) => {
          const out = [];
          this.players.forEach((o, ti) => o.city.forEach((c) => {
            const cost = fn(ti, c);
            if (cost !== null) out.push({ target: ti, cardId: c.id, cost });
          }));
          return out;
        };
        if (t.key === 'warlord') view.destroyable = list((ti, c) => this.destroyCost(me, ti, c));
        if (t.key === 'marshal') view.seizable = list((ti, c) => this.seizeCost(me, ti, c));
        if (t.key === 'diplomat') {
          // Mỗi công trình của người khác: các công trình của mình đổi được + tiền chênh lệch
          view.swappable = [];
          this.players.forEach((o, ti) => o.city.forEach((c) => {
            const mineOpts = p.city.map((m) => ({ cardId: m.id, cost: this.swapCost(me, ti, c, m) })).filter((x) => x.cost !== null);
            if (mineOpts.length) view.swappable.push({ target: ti, cardId: c.id, mine: mineOpts, cost: Math.min(...mineOpts.map((x) => x.cost)) });
          }));
        }
      }
    }
    return view;
  }
}

module.exports = { Game, GameError, CHARACTERS, COLORS };
