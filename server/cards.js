// Nhân vật và công trình (Citadels bản 2016)

// 27 nhân vật bản 2016: mỗi số 1–8 có 3 lựa chọn, số 9 (tùy chọn) có 3 lựa chọn. Mỗi ván dùng 1 nhân vật cho mỗi số.
// color: màu công trình nhân vật thu thuế; income: thu bằng 'gold' | 'card' | 'choose' (chọn vàng hoặc bài)
// nameEn / descEn: bản tiếng Anh (tên chính thức bản 2016)
const CHARACTERS = {
  assassin: { rank: 1, name: 'Sát thủ', nameEn: 'Assassin', desc: 'Chọn 1 nhân vật để ám sát. Nhân vật đó mất lượt trong vòng này.',
    descEn: 'Choose 1 character to murder. That character loses their turn this round.' },
  witch: { rank: 1, name: 'Phù thủy', nameEn: 'Witch', desc: 'Sau khi nhận tài nguyên, yểm bùa 1 nhân vật rồi kết thúc lượt (không được xây). Khi nhân vật đó lộ diện, chủ của nó chỉ được nhận tài nguyên; sau đó bạn chơi tiếp lượt đó thay họ với toàn bộ kỹ năng của nhân vật.',
    descEn: 'After gathering resources, bewitch 1 character and end your turn (you cannot build). When that character is revealed, its owner only gathers resources; then you play the rest of that turn in their place, with all of the character\'s abilities.' },
  magistrate: { rank: 1, name: 'Thẩm phán', nameEn: 'Magistrate', desc: 'Đặt 3 lệnh bắt úp lên 3 nhân vật, chỉ 1 lệnh có chữ ký. Nhân vật bị lệnh có chữ ký: công trình đầu tiên họ xây bị bạn tịch thu về thành phố mình (họ được hoàn lại vàng).',
    descEn: 'Place 3 face-down warrants on 3 characters; only 1 is signed. The character with the signed warrant: the first district they build is confiscated into your city (they get their gold back).' },
  thief: { rank: 2, name: 'Kẻ trộm', nameEn: 'Thief', desc: 'Chọn 1 nhân vật (trừ số 1, nhân vật bị ám sát / bị yểm bùa). Khi nhân vật đó lộ diện, bạn lấy toàn bộ vàng của họ.',
    descEn: 'Choose 1 character (not rank 1, nor the murdered / bewitched character). When that character is revealed, you take all of their gold.' },
  spy: { rank: 2, name: 'Gián điệp', nameEn: 'Spy', desc: 'Chọn 1 người chơi và 1 màu công trình, xem bài trên tay họ. Mỗi lá đúng màu: lấy 1 vàng của họ (nếu còn) và rút 1 lá từ chồng bài.',
    descEn: 'Choose 1 player and 1 district color, then look at their hand. For each card of that color: take 1 of their gold (if any) and draw 1 card from the deck.' },
  blackmailer: { rank: 2, name: 'Kẻ tống tiền', nameEn: 'Blackmailer', desc: 'Đặt 2 thư đe dọa úp lên 2 nhân vật, chỉ 1 thư là thật. Người bị đe dọa, sau khi nhận tài nguyên, chọn: đưa bạn một nửa số vàng (làm tròn xuống), hoặc từ chối — nếu thư là thật, bạn lấy toàn bộ vàng của họ.',
    descEn: 'Place 2 face-down threats on 2 characters; only 1 is real. After gathering resources, the threatened player chooses: give you half their gold (rounded down), or refuse — if the threat is real, you take all of their gold.' },
  magician: { rank: 3, name: 'Pháp sư', nameEn: 'Magician', desc: 'Đổi toàn bộ bài trên tay với 1 người chơi, HOẶC bỏ bao nhiêu lá tùy ý và rút lại bấy nhiêu lá.',
    descEn: 'Exchange your whole hand with 1 player, OR discard any number of cards and draw that many.' },
  wizard: { rank: 3, name: 'Thầy phép', nameEn: 'Wizard', desc: 'Xem bài trên tay 1 người chơi và lấy 1 lá: giữ trên tay, hoặc xây ngay (trả giá; không tính giới hạn xây, được xây trùng tên).',
    descEn: 'Look at 1 player\'s hand and take 1 card: keep it, or build it right away (pay its cost; it does not count toward your build limit, duplicates allowed).' },
  seer: { rank: 3, name: 'Nhà tiên tri', nameEn: 'Seer', desc: 'Lấy ngẫu nhiên 1 lá từ tay mỗi người chơi khác, rồi trả cho mỗi người đó 1 lá tùy chọn. Được xây tối đa 2 công trình trong lượt.',
    descEn: 'Take 1 random card from each other player\'s hand, then give each of them 1 card of your choice. You may build up to 2 districts this turn.' },
  king: { rank: 4, name: 'Vua', nameEn: 'King', color: 'yellow', income: 'gold', desc: 'Nhận vương miện (chọn nhân vật đầu tiên vòng sau, kể cả khi bị ám sát). +1 vàng cho mỗi công trình Quý tộc.',
    descEn: 'Take the crown (choose a character first next round, even if murdered). +1 gold for each Noble district.' },
  emperor: { rank: 4, name: 'Hoàng đế', nameEn: 'Emperor', color: 'yellow', income: 'gold', desc: '+1 vàng cho mỗi công trình Quý tộc. Bắt buộc trao vương miện cho 1 người khác (không phải người đang giữ); người đó đưa bạn 1 vàng (hoặc 1 lá bài nếu hết vàng). Không dùng khi chơi 2 người.',
    descEn: '+1 gold for each Noble district. You must give the crown to another player (not its current holder); they give you 1 gold (or 1 card if they have no gold). Not used in 2-player games.' },
  patrician: { rank: 4, name: 'Nguyên lão', nameEn: 'Patrician', color: 'yellow', income: 'card', desc: 'Nhận vương miện (kể cả khi bị ám sát / yểm bùa). +1 lá bài cho mỗi công trình Quý tộc.',
    descEn: 'Take the crown (even if murdered / bewitched). +1 card for each Noble district.' },
  bishop: { rank: 5, name: 'Giám mục', nameEn: 'Bishop', color: 'blue', income: 'gold', desc: 'Nhân vật số 8 không thể tác động lên công trình của bạn (trừ khi bạn bị ám sát). +1 vàng cho mỗi công trình Tôn giáo.',
    descEn: 'The rank 8 character cannot affect your districts (unless you are murdered). +1 gold for each Religious district.' },
  abbot: { rank: 5, name: 'Tu viện trưởng', nameEn: 'Abbot', color: 'blue', income: 'choose', desc: 'Mỗi công trình Tôn giáo: +1 vàng hoặc +1 lá bài (tùy chọn). Kỹ năng: người giàu nhất phải đưa bạn 1 vàng.',
    descEn: 'Each Religious district: +1 gold or +1 card (your choice). Ability: the richest player must give you 1 gold.' },
  cardinal: { rank: 5, name: 'Hồng y', nameEn: 'Cardinal', color: 'blue', income: 'card', desc: '+1 lá bài cho mỗi công trình Tôn giáo. Khi thiếu vàng để xây, lấy số vàng còn thiếu từ người khác và đưa họ 1 lá bài cho mỗi vàng.',
    descEn: '+1 card for each Religious district. If you lack gold to build, take the missing gold from another player and give them 1 card per gold.' },
  merchant: { rank: 6, name: 'Thương gia', nameEn: 'Merchant', color: 'green', income: 'gold', desc: 'Nhận thêm 1 vàng. +1 vàng cho mỗi công trình Thương mại.',
    descEn: 'Gain 1 extra gold. +1 gold for each Trade district.' },
  alchemist: { rank: 6, name: 'Nhà giả kim', nameEn: 'Alchemist', desc: 'Cuối lượt, nhận lại toàn bộ vàng bạn đã trả để xây công trình trong lượt.',
    descEn: 'At the end of your turn, get back all the gold you paid to build districts this turn.' },
  trader: { rank: 6, name: 'Lái buôn', nameEn: 'Trader', color: 'green', income: 'gold', desc: '+1 vàng cho mỗi công trình Thương mại. Xây công trình Thương mại không tính vào giới hạn xây trong lượt.',
    descEn: '+1 gold for each Trade district. Building Trade districts does not count toward your build limit this turn.' },
  architect: { rank: 7, name: 'Kiến trúc sư', nameEn: 'Architect', desc: 'Rút thêm 2 lá bài. Được xây tối đa 3 công trình trong lượt.',
    descEn: 'Draw 2 extra cards. You may build up to 3 districts this turn.' },
  navigator: { rank: 7, name: 'Nhà hàng hải', nameEn: 'Navigator', desc: 'Nhận thêm 4 vàng hoặc 4 lá bài. Không được xây công trình nào trong lượt.',
    descEn: 'Gain 4 extra gold or 4 cards. You cannot build any districts this turn.' },
  scholar: { rank: 7, name: 'Học giả', nameEn: 'Scholar', desc: 'Rút 7 lá, giữ 1, xáo 6 lá còn lại vào chồng bài. Được xây tối đa 2 công trình trong lượt.',
    descEn: 'Draw 7 cards, keep 1 and shuffle the other 6 back into the deck. You may build up to 2 districts this turn.' },
  warlord: { rank: 8, name: 'Lãnh chúa', nameEn: 'Warlord', color: 'red', income: 'gold', desc: '+1 vàng cho mỗi công trình Quân sự. Phá 1 công trình bằng cách trả (giá − 1) vàng (không phá được thành phố đã hoàn thành).',
    descEn: '+1 gold for each Military district. Destroy 1 district by paying (its cost − 1) gold (not in a completed city).' },
  diplomat: { rank: 8, name: 'Nhà ngoại giao', nameEn: 'Diplomat', color: 'red', income: 'gold', desc: '+1 vàng cho mỗi công trình Quân sự. Đổi 1 công trình của bạn lấy 1 công trình của người khác; nếu công trình lấy về đắt hơn, trả phần chênh lệch cho họ.',
    descEn: '+1 gold for each Military district. Exchange 1 of your districts for 1 of another player\'s; if theirs costs more, pay them the difference.' },
  marshal: { rank: 8, name: 'Thống chế', nameEn: 'Marshal', color: 'red', income: 'gold', desc: '+1 vàng cho mỗi công trình Quân sự. Lấy 1 công trình giá ≤ 3 của người khác về thành phố mình, trả cho họ đúng giá công trình.',
    descEn: '+1 gold for each Military district. Take 1 district costing ≤ 3 from another player into your city, paying them its cost.' },
  queen: { rank: 9, name: 'Hoàng hậu', nameEn: 'Queen', desc: 'Nếu bạn ngồi cạnh người cầm nhân vật số 4: +3 vàng. Chỉ dùng khi có từ 5 người chơi.',
    descEn: 'If you sit next to the player with the rank 4 character: +3 gold. Only used with 5 or more players.' },
  artist: { rank: 9, name: 'Nghệ sĩ', nameEn: 'Artist', desc: 'Trang trí tối đa 2 công trình của bạn: trả 1 vàng cho mỗi công trình, công trình đó được +1 giá trị (tính điểm, phá, đổi). Mỗi công trình chỉ trang trí 1 lần.',
    descEn: 'Beautify up to 2 of your districts: pay 1 gold each, and that district gains +1 value (for scoring, destroying, exchanging). Each district can be beautified only once.' },
  taxcollector: { rank: 9, name: 'Người thu thuế', nameEn: 'Tax Collector', desc: 'Mỗi khi ai đó xây công trình, họ phải nộp 1 vàng (nếu còn) vào kho thuế. Khi lộ diện, bạn lấy toàn bộ vàng trong kho thuế.',
    descEn: 'Whenever someone builds a district, they must pay 1 gold (if they have any) into the tax pool. When revealed, you take all the gold in the tax pool.' },
};
for (const [key, c] of Object.entries(CHARACTERS)) c.key = key;
// Bộ nhân vật cơ bản (mặc định)
const BASE_CAST = ['assassin', 'thief', 'magician', 'king', 'bishop', 'merchant', 'architect', 'warlord'];

// Kiểm tra bộ nhân vật cho n người; trả về { vi, en } (thông báo lỗi) hoặc null
function castProblem(keys, n) {
  const byRank = {};
  for (const k of keys || []) {
    const c = CHARACTERS[k];
    if (!c) return { vi: `Nhân vật không hợp lệ: ${k}`, en: `Invalid character: ${k}` };
    if (byRank[c.rank]) return { vi: `Mỗi số chỉ được chọn 1 nhân vật (số ${c.rank})`, en: `Only 1 character per rank (rank ${c.rank})` };
    byRank[c.rank] = k;
  }
  for (let r = 1; r <= 8; r++) if (!byRank[r]) return { vi: `Thiếu nhân vật số ${r}`, en: `Missing a rank ${r} character` };
  const nine = !!byRank[9];
  if (n > (nine ? 8 : 7)) {
    return nine ? { vi: 'Tối đa 8 người chơi', en: 'At most 8 players' }
      : { vi: 'Chơi 8 người cần thêm nhân vật số 9', en: 'An 8-player game needs a rank 9 character' };
  }
  if (nine && n < 4) return { vi: 'Nhân vật số 9 chỉ dùng khi có từ 4 người chơi', en: 'Rank 9 characters need at least 4 players' };
  if (byRank[9] === 'queen' && n < 5) return { vi: 'Hoàng hậu chỉ dùng khi có từ 5 người chơi', en: 'The Queen needs at least 5 players' };
  if (byRank[4] === 'emperor' && n < 3) return { vi: 'Hoàng đế không dùng khi chơi 2 người', en: 'The Emperor is not used in 2-player games' };
  return null;
}

// [key, tên, tên tiếng Anh, giá, màu, số lượng]
const DISTRICTS = [
  ['manor', 'Trang viên', 'Manor', 3, 'yellow', 5],
  ['castle', 'Lâu đài', 'Castle', 4, 'yellow', 4],
  ['palace', 'Cung điện', 'Palace', 5, 'yellow', 3],
  ['temple', 'Đền thờ', 'Temple', 1, 'blue', 3],
  ['church', 'Nhà thờ', 'Church', 2, 'blue', 3],
  ['monastery', 'Tu viện', 'Monastery', 3, 'blue', 3],
  ['cathedral', 'Thánh đường', 'Cathedral', 5, 'blue', 2],
  ['tavern', 'Quán rượu', 'Tavern', 1, 'green', 5],
  ['market', 'Khu chợ', 'Market', 2, 'green', 4],
  ['tradingpost', 'Trạm giao thương', 'Trading Post', 2, 'green', 3],
  ['docks', 'Bến tàu', 'Docks', 3, 'green', 3],
  ['harbor', 'Hải cảng', 'Harbor', 4, 'green', 3],
  ['townhall', 'Tòa thị chính', 'Town Hall', 5, 'green', 2],
  ['watchtower', 'Tháp canh', 'Watchtower', 1, 'red', 3],
  ['prison', 'Nhà ngục', 'Prison', 2, 'red', 3],
  ['battlefield', 'Doanh trại', 'Barracks', 3, 'red', 3],
  ['fortress', 'Pháo đài', 'Fortress', 5, 'red', 2],
];

// Công trình đặc biệt (tím) bản 2016: mỗi loại 1 lá, mỗi ván rút ngẫu nhiên UNIQUE_PER_GAME loại.
// (Chưa cài: Hang trộm, Giàn giáo, Kho vũ khí, Nghĩa trang, Bảo tàng, Nhà hát — cần thao tác đặc biệt.)
// Mô tả không nêu tên nhân vật (bộ nhân vật bí mật) — dùng "nhân vật số N".
// [key, tên, tên tiếng Anh, giá, mô tả, mô tả tiếng Anh]
const UNIQUES = [
  ['haunted', 'Khu phố ma', 'Haunted Quarter', 2, 'Khi tính điểm cuối game, được coi là màu bất kỳ bạn chọn.',
    'For end-game scoring, counts as any one color of your choice.'],
  ['stables', 'Chuồng ngựa', 'Stables', 2, 'Xây Chuồng ngựa không tính vào giới hạn số công trình được xây trong lượt.',
    'Building the Stables does not count toward your build limit for the turn.'],
  ['keep', 'Thành lũy', 'Keep', 3, 'Nhân vật số 8 không thể phá, lấy hay đổi công trình này.',
    'The rank 8 character cannot destroy, take or exchange this district.'],
  ['statue', 'Tượng đài', 'Statue', 3, 'Cuối game, nếu bạn đang giữ vương miện: +5 điểm.',
    'At game end, if you hold the crown: +5 points.'],
  ['observatory', 'Đài thiên văn', 'Observatory', 4, 'Khi rút bài, rút 3 lá thay vì 2.',
    'When drawing cards, draw 3 instead of 2.'],
  ['basilica', 'Đại giáo đường', 'Basilica', 4, 'Cuối game: +1 điểm cho mỗi công trình có giá lẻ trong thành phố.',
    'At game end: +1 point for each district with an odd cost in your city.'],
  ['monument', 'Đài kỷ niệm', 'Monument', 4, 'Chỉ xây được khi thành phố có ít hơn 5 công trình. Được tính là 2 công trình khi xét hoàn thành thành phố.',
    'Can only be built if your city has fewer than 5 districts. Counts as 2 districts toward completing your city.'],
  ['poorhouse', 'Nhà tế bần', 'Poor House', 4, 'Cuối lượt của bạn, nếu không còn vàng: +1 vàng.',
    'At the end of your turn, if you have no gold: +1 gold.'],
  ['laboratory', 'Phòng thí nghiệm', 'Laboratory', 5, 'Mỗi lượt 1 lần: bỏ 1 lá bài trên tay để nhận 2 vàng.',
    'Once per turn: discard 1 card from your hand to gain 2 gold.'],
  ['smithy', 'Lò rèn', 'Smithy', 5, 'Mỗi lượt 1 lần: trả 2 vàng để rút 3 lá bài.',
    'Once per turn: pay 2 gold to draw 3 cards.'],
  ['imperialtreasury', 'Kho bạc hoàng gia', 'Imperial Treasury', 5, 'Cuối game: +1 điểm cho mỗi vàng bạn còn.',
    'At game end: +1 point for each gold you have.'],
  ['maproom', 'Phòng bản đồ', 'Map Room', 5, 'Cuối game: +1 điểm cho mỗi lá bài còn trên tay.',
    'At game end: +1 point for each card in your hand.'],
  ['wishingwell', 'Giếng ước', 'Wishing Well', 5, 'Cuối game: +1 điểm cho mỗi công trình đặc biệt (tím) trong thành phố, kể cả Giếng ước.',
    'At game end: +1 point for each unique (purple) district in your city, including the Wishing Well.'],
  ['ivorytower', 'Tháp ngà', 'Ivory Tower', 5, 'Cuối game: +5 điểm nếu đây là công trình đặc biệt (tím) duy nhất trong thành phố.',
    'At game end: +5 points if this is the only unique (purple) district in your city.'],
  ['capitol', 'Điện Capitol', 'Capitol', 5, 'Cuối game: +3 điểm nếu có ít nhất 3 công trình cùng màu.',
    'At game end: +3 points if you have at least 3 districts of the same color.'],
  ['quarry', 'Mỏ đá', 'Quarry', 5, 'Bạn được xây công trình trùng tên với công trình đã có.',
    'You may build districts identical to ones already in your city.'],
  ['factory', 'Xưởng thủ công', 'Factory', 5, 'Xây các công trình đặc biệt (tím) khác rẻ hơn 1 vàng.',
    'Other unique (purple) districts cost you 1 less gold to build.'],
  ['library', 'Thư viện', 'Library', 6, 'Khi rút bài, được giữ tất cả các lá đã rút.',
    'When drawing cards, keep all the cards you drew.'],
  ['magicschool', 'Trường phép thuật', 'School of Magic', 6, 'Được tính là màu bất kỳ khi thu thuế.',
    'Counts as any color when collecting income.'],
  ['dragongate', 'Cổng Rồng', 'Dragon Gate', 6, 'Cuối game: +2 điểm (tổng cộng tính 8 điểm).',
    'At game end: +2 points (worth 8 points in total).'],
  ['greatwall', 'Tường thành lớn', 'Great Wall', 6, 'Nhân vật số 8 tác động lên (phá, lấy, đổi) các công trình khác của bạn phải trả thêm 1 vàng.',
    'The rank 8 character must pay 1 more gold to affect (destroy, take, exchange) your other districts.'],
  ['goldmine', 'Mỏ vàng', 'Gold Mine', 6, 'Khi chọn lấy vàng: nhận thêm 1 vàng.',
    'When you take gold: gain 1 extra gold.'],
  ['park', 'Công viên', 'Park', 6, 'Cuối lượt của bạn, nếu không còn lá bài nào trên tay: rút 2 lá.',
    'At the end of your turn, if you have no cards in hand: draw 2 cards.'],
  ['secretvault', 'Kho bí mật', 'Secret Vault', 0, 'Không thể xây. Cuối game, nếu lá này còn trên tay bạn: +3 điểm.',
    'Cannot be built. At game end, if this card is still in your hand: +3 points.'],
];
const UNIQUE_PER_GAME = 14;

const shuffleArr = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Chồng bài cho 1 ván: 54 lá thường + 14 công trình tím ngẫu nhiên (hoặc danh sách chỉ định, dùng khi test)
function buildDeck(uniqueKeys) {
  const keys = uniqueKeys || shuffleArr(UNIQUES.map((u) => u[0])).slice(0, UNIQUE_PER_GAME);
  const deck = [];
  let id = 1;
  for (const [key, name, nameEn, cost, color, count] of DISTRICTS) {
    for (let i = 0; i < count; i++) deck.push({ id: id++, key, name, nameEn, cost, color, desc: null, descEn: null });
  }
  for (const [key, name, nameEn, cost, desc, descEn] of UNIQUES) {
    if (keys.includes(key)) deck.push({ id: id++, key, name, nameEn, cost, color: 'purple', desc, descEn, ...(key === 'secretvault' ? { noBuild: true } : {}) });
  }
  return deck;
}

// Dữ liệu công trình & nhân vật cho trang luật chơi ở client (/cards.json, trang xem trước)
function cardsData() {
  return {
    base: DISTRICTS.map(([key, name, nameEn, cost, color, count]) => ({ key, name, nameEn, cost, color, count })),
    uniques: UNIQUES.map(([key, name, nameEn, cost, desc, descEn]) => ({ key, name, nameEn, cost, color: 'purple', desc, descEn, noBuild: key === 'secretvault' })),
    uniquePerGame: UNIQUE_PER_GAME,
    characters: Object.values(CHARACTERS).map(({ key, rank, name, nameEn, desc, descEn, color }) => ({ key, rank, name, nameEn, desc, descEn, color: color || null })),
    baseCast: BASE_CAST,
  };
}

// Bộ nhân vật ngẫu nhiên hợp lệ cho n người: mỗi số 1–8 rút 1 trong 3; số 9 có thể có hoặc không (bắt buộc khi 8 người)
function randomCast(n) {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  for (let tries = 0; tries < 200; tries++) {
    const keys = [];
    for (let r = 1; r <= 9; r++) {
      const opts = Object.keys(CHARACTERS).filter((k) => CHARACTERS[k].rank === r);
      if (r === 9 && n < 8 && Math.random() < 0.5) continue;
      keys.push(pick(opts));
    }
    if (!castProblem(keys, n)) return keys;
  }
  return BASE_CAST.slice();
}

module.exports = { CHARACTERS, BASE_CAST, castProblem, randomCast, DISTRICTS, UNIQUES, UNIQUE_PER_GAME, buildDeck, cardsData };
