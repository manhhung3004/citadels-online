// Tải icon từ game-icons.net (CC BY 3.0) qua Iconify và ghi ra public/icons.js
// Chạy lại khi cần thêm icon: node scripts/fetch-icons.js
const fs = require('fs');
const path = require('path');

const ICONS = {
  // nhân vật
  assassin: 'hooded-assassin', thief: 'robber', magician: 'wizard-face', king: 'crown',
  bishop: 'pope-crown', merchant: 'money-stack', architect: 'hammer-nails', warlord: 'warlord-helmet',
  // nhân vật thay thế bản 2016 + số 9
  witch: 'witch-face', magistrate: 'gavel', spy: 'spy', blackmailer: 'envelope', wizard: 'wizard-staff',
  seer: 'crystal-ball', emperor: 'imperial-crown', patrician: 'roman-toga', abbot: 'monk-face', cardinal: 'holy-symbol',
  alchemist: 'fizzing-flask', trader: 'cash', navigator: 'ship-wheel', scholar: 'open-book', diplomat: 'shaking-hands',
  marshal: 'knight-banner', queen: 'queen-crown', artist: 'palette', taxcollector: 'receive-money',
  // công trình
  manor: 'house', castle: 'castle', palace: 'indian-palace',
  temple: 'greek-temple', church: 'church', monastery: 'byzantin-temple', cathedral: 'saint-basil-cathedral',
  tavern: 'tavern-sign', market: 'shop', tradingpost: 'trade', docks: 'anchor', harbor: 'lighthouse', townhall: 'clock-tower',
  watchtower: 'watchtower', prison: 'prisoner', battlefield: 'crossed-swords', fortress: 'locked-fortress',
  haunted: 'spooky-house', keep: 'stone-tower', laboratory: 'bubbling-flask', smithy: 'anvil',
  observatory: 'observatory', graveyard: 'graveyard', library: 'bookshelf', magicschool: 'spell-book',
  university: 'graduate-cap', dragongate: 'dragon-head', greatwall: 'defensive-wall',
  // công trình tím bản 2016
  stables: 'stable', statue: 'stone-bust', basilica: 'ionic-column', monument: 'obelisk', poorhouse: 'hut',
  imperialtreasury: 'open-treasure-chest', maproom: 'treasure-map', wishingwell: 'well', ivorytower: 'white-tower',
  capitol: 'ancient-columns', quarry: 'stone-pile', factory: 'factory', goldmine: 'gold-mine', park: 'fruit-tree',
  secretvault: 'locked-chest',
  // giao diện
  gold: 'two-coins', cards: 'card-random', drawcards: 'card-pickup', city: 'village', skull: 'death-skull',
  robbed: 'robber-hand', logo: 'elven-castle', hourglass: 'hourglass', trophy: 'laurel-crown', scroll: 'scroll-unfurled',
  robot: 'robot-golem', unknown: 'uncertainty', chat: 'chat-bubble', build: 'stone-tower', crossed: 'crossed-swords',
};

(async () => {
  const names = [...new Set(Object.values(ICONS))];
  const res = await fetch(`https://api.iconify.design/game-icons.json?icons=${names.join(',')}`);
  const data = await res.json();
  const out = {};
  for (const [key, name] of Object.entries(ICONS)) {
    const icon = data.icons[name];
    if (!icon) { console.error('Thiếu icon:', name); process.exitCode = 1; continue; }
    out[key] = icon.body;
  }
  const file = path.join(__dirname, '..', 'public', 'icons.js');
  fs.writeFileSync(file, `// Icons by game-icons.net (Lorc, Delapouite & contributors) — CC BY 3.0\nwindow.ICONS = ${JSON.stringify(out)};\n`);
  console.log(`Đã ghi ${Object.keys(out).length} icon vào ${file}`);
})();
