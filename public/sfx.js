// Hiệu ứng âm thanh (window.Sfx): tổng hợp bằng Web Audio, không cần file âm thanh.
// Trình duyệt (nhất là iOS) chỉ cho phát tiếng sau lần chạm/bấm đầu tiên → mở khóa ở pointerdown/keydown.
(() => {
  const KEY = 'citadels.sfx';
  const MKEY = 'citadels.music';
  let ctx = null;
  let master = null;
  let sfxIn = null; // đường vào của hiệu ứng (lọc + vang)
  let muted = false;
  let musicOff = false;
  try { muted = localStorage.getItem(KEY) === 'off'; musicOff = localStorage.getItem(MKEY) === 'off'; } catch {}
  const last = {}; // chống phát dồn cùng 1 tiếng
  let lastError = null; // lỗi tổng hợp tiếng gần nhất (để kiểm tra)

  function ac() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    // Nén nhẹ để nhiều tiếng chồng nhau không bị rè
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    // Đường hiệu ứng: lọc bớt dải cao chói + 1 chút vang chung để tiếng tròn, hòa với nhạc nền
    sfxIn = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 6500;
    lp.Q.value = 0.5;
    sfxIn.connect(lp).connect(master);
    const send = ctx.createGain();
    send.gain.value = 0.22;
    const verb = ctx.createConvolver();
    verb.buffer = impulse(1.6, 4);
    sfxIn.connect(send).connect(verb).connect(master);
    // Trạng thái chuyển sang "running" chậm hơn lần chạm (bất đồng bộ) → kiểm tra lại nhạc lúc đó
    ctx.onstatechange = musicCheck;
    return ctx;
  }
  // Đáp ứng xung cho vang: tiếng ồn tắt dần, 2 kênh
  function impulse(sec, curve) {
    const len = Math.floor(ctx.sampleRate * sec);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, curve);
    }
    return ir;
  }
  function unlock() {
    const c = ac();
    if (!c) return;
    if (c.state === 'suspended') c.resume().then(musicCheck, () => {});
    else musicCheck();
    // iOS: phát 1 mẫu im lặng trong lúc chạm để mở khóa hẳn loa
    if (!unlock.done) {
      unlock.done = true;
      const b = c.createBufferSource();
      b.buffer = c.createBuffer(1, 1, 22050);
      b.connect(c.destination);
      b.start(0);
    }
  }
  ['pointerdown', 'keydown', 'touchend'].forEach((ev) => document.addEventListener(ev, unlock, { capture: true, passive: true }));

  // Đường bao mềm: lên tuyến tính (không "tách"), tắt dần tự nhiên theo hàm mũ
  function env(g, t, vol, attack, dur) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setTargetAtTime(0, t + attack, dur / 5);
    return t + attack + dur + 0.1; // lúc dừng dao động
  }
  // 1 nốt: sóng sin / tam giác, có thể trượt cao độ
  function voice(m, t, { type = 'sine', vol = 0.1, attack = 0.01, dur = 0.4, to = null, lowpass = 0 } = {}) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(midi(m), t);
    if (to != null) o.frequency.exponentialRampToValueAtTime(midi(to), t + dur * 0.6);
    const end = env(g, t, vol, attack, dur);
    let node = o;
    if (lowpass) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass; node = o.connect(f); }
    node.connect(g).connect(sfxIn);
    o.start(t);
    o.stop(end);
  }
  // Chuông FM: sóng mang sin + sóng điều chế tắt nhanh hơn → tiếng chuông / đàn phiến trong, ấm
  function bell(m, t, { vol = 0.1, dur = 0.9, ratio = 3.5, index = 1.6, attack = 0.004 } = {}) {
    const f = midi(m);
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const mg = ctx.createGain();
    const g = ctx.createGain();
    car.frequency.value = f;
    mod.frequency.value = f * ratio;
    mg.gain.setValueAtTime(f * index, t);
    mg.gain.setTargetAtTime(0, t, dur / 8);
    mod.connect(mg).connect(car.frequency);
    const end = env(g, t, vol, attack, dur);
    car.connect(g).connect(sfxIn);
    car.start(t); mod.start(t);
    car.stop(end); mod.stop(end);
  }
  // Tiếng gió / lật bài: tiếng ồn (dùng chung 1 bộ đệm) qua bộ lọc quét, lên từ từ
  let noiseBuf = null;
  function whoosh(t, { from = 1800, to = 600, dur = 0.25, vol = 0.1, q = 0.8, attack = 0.03 } = {}) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(f).connect(g).connect(sfxIn);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }
  // Tiếng gõ gỗ trầm (búa, trống)
  function knock(t, { f = 150, vol = 0.22, dur = 0.16 } = {}) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.55, t + dur);
    const end = env(g, t, vol, 0.003, dur);
    o.connect(g).connect(sfxIn);
    o.start(t);
    o.stop(end);
    whoosh(t, { from: 900, to: 500, dur: 0.05, vol: vol * 0.25, q: 1.2, attack: 0.002 });
  }

  // Mọi tiếng theo giọng Rê (D) — cùng giọng với nhạc nền. Số = nốt MIDI (74 = Rê 5, 78 = Fa# 5, 81 = La 5, 86 = Rê 6)
  const SOUNDS = {
    // Đến lượt bạn: chuông rải hợp âm Rê trưởng đi lên, nốt cuối ngân
    turn: (t) => { [74, 78, 81].forEach((m, i) => bell(m, t + i * 0.11, { vol: 0.11, dur: 0.9 })); bell(86, t + 0.33, { vol: 0.13, dur: 1.8 }); },
    // Nhân vật người khác lộ diện: lật bài nhẹ + 1 nốt gỗ
    reveal: (t) => { whoosh(t, { from: 2200, to: 700, dur: 0.2, vol: 0.09 }); bell(69, t + 0.06, { vol: 0.06, dur: 0.5, ratio: 2, index: 0.8 }); },
    // Vòng mới: tù và ấm (Rê–La–Rê) + trống da
    round: (t) => {
      knock(t, { f: 110, vol: 0.2, dur: 0.3 });
      voice(62, t, { type: 'triangle', vol: 0.09, attack: 0.15, dur: 1.3, lowpass: 1400 });
      voice(69, t + 0.08, { vol: 0.06, attack: 0.2, dur: 1.2 });
      voice(74, t + 0.3, { vol: 0.05, attack: 0.2, dur: 1.2 });
    },
    // Nhận vàng: 2 tiếng "ting" trong
    coin: (t) => { bell(93, t, { vol: 0.06, dur: 0.35, ratio: 2, index: 1.2 }); bell(98, t + 0.07, { vol: 0.055, dur: 0.6, ratio: 2, index: 1.2 }); },
    // Mất vàng: 2 tiếng đi xuống
    coinLoss: (t) => { bell(86, t, { vol: 0.055, dur: 0.3, ratio: 2, index: 1 }); bell(81, t + 0.09, { vol: 0.05, dur: 0.5, ratio: 2, index: 1 }); },
    // Xây công trình: 2 nhát gõ gỗ + chuông nhỏ xác nhận
    build: (t) => { knock(t); knock(t + 0.17, { f: 165 }); bell(74, t + 0.34, { vol: 0.05, dur: 0.7, ratio: 3, index: 1 }); bell(81, t + 0.34, { vol: 0.04, dur: 0.9, ratio: 3, index: 1 }); },
    // Tấn công (ám sát / trộm / phá): tiếng vút + nốt trầm đi xuống
    attack: (t) => { whoosh(t, { from: 2600, to: 400, dur: 0.3, vol: 0.12, q: 0.7, attack: 0.04 }); voice(50, t + 0.06, { type: 'triangle', vol: 0.11, attack: 0.02, dur: 0.5, to: 45, lowpass: 900 }); },
    // Trao vương miện: chuông rải sáng
    crown: (t) => { [74, 78, 81].forEach((m, i) => bell(m, t + i * 0.08, { vol: 0.08, dur: 0.8 })); voice(86, t + 0.24, { type: 'triangle', vol: 0.05, attack: 0.05, dur: 0.8 }); },
    // Đủ công trình / kết thúc ván: rải hợp âm + hợp âm ngân + chuông
    finish: (t) => {
      [74, 78, 81, 86].forEach((m, i) => voice(m, t + i * 0.12, { type: 'triangle', vol: 0.08, attack: 0.01, dur: 0.5 }));
      [74, 78, 81].forEach((m) => voice(m, t + 0.48, { vol: 0.05, attack: 0.2, dur: 1.8 }));
      bell(86, t + 0.48, { vol: 0.09, dur: 2.2 });
    },
    // Tin nhắn mới: 2 bong bóng "bóp"
    chat: (t) => { voice(78, t, { vol: 0.07, attack: 0.008, dur: 0.15, to: 83 }); voice(83, t + 0.09, { vol: 0.06, attack: 0.008, dur: 0.25, to: 86 }); },
    // Bấm nút: tiếng gõ gỗ rất nhẹ
    tick: (t) => { voice(81, t, { vol: 0.03, attack: 0.002, dur: 0.05, to: 74 }); },
  };
  // Tiếng quan trọng: nhạc nền nhỏ đi một chút rồi trở lại
  const DUCK = new Set(['turn', 'finish', 'round', 'crown', 'attack']);

  // ---------- Nhạc nền: nhạc trung cổ tự sáng tác bằng Web Audio, không lặp y hệt ----------
  // D thứ, ~76 nhịp/phút. Mỗi ô nhịp 8 phách móc đơn: pad hợp âm + bass + đàn hạc rải + đàn lute giai điệu ngẫu nhiên + trống da.
  // Bộ lập lịch đặt nốt trước ~0.4s (setInterval 120ms); ẩn tab / tắt nhạc → dừng hẳn (không tốn CPU).
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const EIGHTH = 60 / 76 / 2;
  // [bass, hợp âm (3 nốt), nốt thuộc hợp âm cho giai điệu]
  const PROG = [
    [50, [62, 65, 69]], [48, [60, 64, 67]], [46, [58, 62, 65]], [45, [57, 61, 64]],
    [50, [62, 65, 69]], [43, [55, 58, 62]], [48, [60, 64, 67]], [50, [62, 65, 69]],
    [46, [58, 62, 65]], [48, [60, 64, 67]], [50, [62, 65, 69]], [45, [57, 61, 64]],
  ];
  const SCALE = [74, 76, 77, 79, 81, 82, 84, 86, 88]; // D5..E6 (D thứ tự nhiên)
  const mus = { bus: null, out: null, timer: 0, step: 0, next: 0, mel: 2, want: false, playing: false, duck: false };

  function musicBus() {
    if (mus.bus) return;
    mus.out = ctx.createGain();
    mus.out.gain.value = 0.0001;
    mus.out.connect(master);
    mus.bus = ctx.createGain();
    mus.bus.connect(mus.out);
    // Vang nhẹ 2.4s
    const verb = ctx.createConvolver();
    verb.buffer = impulse(2.4, 3);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    mus.bus.connect(verb).connect(wet).connect(mus.out);
  }
  // Đàn gảy (lute / hạc): sóng răng cưa / tam giác + bộ lọc đóng dần
  function pluck(m, t, { vol = 0.12, dur = 1.1, type = 'sawtooth', bright = 2600 } = {}) {
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = midi(m);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(bright, t);
    f.frequency.exponentialRampToValueAtTime(380, t + dur * 0.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(mus.bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function pad(notes, t, dur) {
    for (const m of notes) {
      const o = ctx.createOscillator();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = midi(m - 12);
      o.detune.value = (Math.random() - 0.5) * 8;
      f.type = 'lowpass';
      f.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.035, t + 0.8);
      g.gain.setValueAtTime(0.035, t + dur - 0.2);
      g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.9);
      o.connect(f).connect(g).connect(mus.bus);
      o.start(t);
      o.stop(t + dur + 1);
    }
  }
  function bass(m, t) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = midi(m - 12) * 2; // đủ cao để loa điện thoại vẫn nghe
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + EIGHTH * 3.5);
    o.connect(g).connect(mus.bus);
    o.start(t);
    o.stop(t + EIGHTH * 4);
  }
  function drum(t, vol) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(65, t + 0.18);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(mus.bus);
    o.start(t);
    o.stop(t + 0.35);
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  // Nốt giai điệu gần nhất thuộc hợp âm (cho phách mạnh)
  function snapToChord(idx, chord) {
    const pcs = chord.map((m) => m % 12);
    for (let d = 0; d < SCALE.length; d++) {
      for (const k of [idx - d, idx + d]) if (k >= 0 && k < SCALE.length && pcs.includes(SCALE[k] % 12)) return k;
    }
    return idx;
  }
  function schedule(step, t) {
    const bar = Math.floor(step / 8) % PROG.length;
    const beat = step % 8;
    const [b, chord] = PROG[bar];
    const sparse = bar % 4 === 3; // ô thứ 4 mỗi câu: giai điệu thưa, để "thở"
    if (beat === 0) { pad(chord, t, EIGHTH * 8); bass(b, t); drum(t, 0.16); }
    if (beat === 4) bass(b + 7 > 52 ? b - 5 : b + 7, t);
    if (beat === 3 || beat === 6) drum(t, 0.07);
    // Đàn hạc rải hợp âm: gốc - 5 - 3 - 5 …
    const arp = [chord[0], chord[2], chord[1], chord[2]][beat % 4];
    pluck(arp, t, { vol: 0.045, dur: 0.9, type: 'triangle', bright: 1800 });
    // Lute: phách mạnh hay có nốt, phách lẻ thỉnh thoảng
    const p = beat % 2 === 0 ? (sparse ? 0.35 : 0.7) : (sparse ? 0.08 : 0.3);
    if (Math.random() < p) {
      mus.mel = Math.max(0, Math.min(SCALE.length - 1, mus.mel + pick([-2, -1, -1, 0, 1, 1, 2])));
      if (beat % 2 === 0) mus.mel = snapToChord(mus.mel, chord);
      let m = SCALE[mus.mel];
      if (chord.some((c) => c % 12 === 1) && m % 12 === 0) m += 1; // hợp âm A trưởng: Đô → Đô thăng
      const long = beat === 6 || Math.random() < 0.2;
      pluck(m, t, { vol: 0.07, dur: long ? 1.6 : 0.8 });
    }
  }
  function tick() {
    while (mus.next < ctx.currentTime + 0.4) {
      schedule(mus.step, mus.next);
      mus.step++;
      mus.next += EIGHTH * (mus.step % 2 ? 1.04 : 0.96); // hơi "nhún" cho tự nhiên
    }
  }
  const level = () => (mus.duck ? 0.3 : 0.75); // đang trong thoại → nhạc nhỏ lại
  function musicStart() {
    musicBus();
    mus.playing = true;
    mus.next = ctx.currentTime + 0.1;
    mus.out.gain.cancelScheduledValues(ctx.currentTime);
    mus.out.gain.setTargetAtTime(level(), ctx.currentTime, 0.8);
    clearInterval(mus.timer);
    mus.timer = setInterval(tick, 120);
    tick();
  }
  function musicStop() {
    mus.playing = false;
    clearInterval(mus.timer);
    if (mus.out) mus.out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
  }
  // Có nên đang phát không: bật nhạc + trang yêu cầu (đang ở phòng) + tab đang hiện + đã mở khóa âm thanh
  function musicCheck() {
    const should = mus.want && !musicOff && !document.hidden && ctx && ctx.state === 'running';
    if (should && !mus.playing) musicStart();
    else if (!should && mus.playing) musicStop();
  }
  document.addEventListener('visibilitychange', musicCheck);

  function play(name, delay = 0) {
    if (muted || !SOUNDS[name]) return;
    const c = ac();
    if (!c || c.state !== 'running') return;
    const now = performance.now();
    if (now - (last[name] || 0) < 90) return;
    last[name] = now;
    const t = c.currentTime + 0.01 + delay;
    try { SOUNDS[name](t); } catch (e) { lastError = name + ": " + e.message; }
    if (DUCK.has(name) && mus.playing) {
      const g = mus.out.gain;
      if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t); else g.cancelScheduledValues(t);
      g.setTargetAtTime(level() * 0.45, t, 0.06);
      g.setTargetAtTime(level(), t + 1.1, 0.5);
    }
  }

  window.Sfx = {
    play,
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem(KEY, muted ? 'off' : 'on'); } catch {}
      if (!muted) { unlock(); setTimeout(() => play('tick'), 30); }
      return muted;
    },
    // Nhạc nền
    get musicOn() { return !musicOff; },
    get musicPlaying() { return mus.playing; },
    get lastError() { return lastError; },
    toggleMusic() {
      musicOff = !musicOff;
      try { localStorage.setItem(MKEY, musicOff ? 'off' : 'on'); } catch {}
      unlock();
      musicCheck();
      return !musicOff;
    },
    // app.js gọi mỗi lần nhận trạng thái: want = đang ở phòng chờ / trong ván; duck = đang trong thoại
    music(want, duck) {
      mus.want = !!want;
      if (duck !== mus.duck) {
        mus.duck = !!duck;
        if (mus.playing) mus.out.gain.setTargetAtTime(level(), ctx.currentTime, 0.5);
      }
      musicCheck();
    },
  };
})();
