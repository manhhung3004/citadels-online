/* Thoại theo phòng: WebRTC nối trực tiếp từng cặp người chơi (mesh), Socket.IO chỉ làm kênh bắt tay.
   Người vào sau gửi offer tới từng người đang trong thoại → không bao giờ 2 bên cùng gửi offer. */
(function () {
  const V = {
    supported: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.RTCPeerConnection),
    on: false, muted: false, deaf: false, busy: false,
    speaking: new Set(), // id đang nói (gồm cả mình)
    silenced: new Set(), // người bị mình tắt tiếng riêng (chỉ ở máy mình)
    onChange: null, // (kind) => void — 'speak' | 'peers' | 'state'
  };
  let socket = null;
  let myId = null;
  let stream = null;
  let ctx = null;
  let ice = null;
  let meterTimer = null;
  const peers = new Map(); // id -> { pc, audio, meter, init, retries, queue }
  const chains = new Map(); // id -> Promise: xử lý tín hiệu tuần tự từng người
  const meters = new Map(); // id -> { an, buf, last }
  const retryCount = new Map(); // id -> số lần đã thử nối lại

  const changed = (kind) => V.onChange && V.onChange(kind);
  const audioBox = () => {
    let b = document.getElementById('voice-audio');
    if (!b) { b = document.createElement('div'); b.id = 'voice-audio'; b.hidden = true; document.body.appendChild(b); }
    return b;
  };

  async function loadIce() {
    if (ice) return ice;
    try { ice = await (await fetch('/ice.json')).json(); } catch (_) { ice = [{ urls: 'stun:stun.l.google.com:19302' }]; }
    return ice;
  }

  // Đo âm lượng để sáng viền người đang nói
  function addMeter(id, s) {
    if (!ctx || meters.has(id)) return;
    try {
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(an);
      meters.set(id, { an, buf: new Uint8Array(an.fftSize), last: 0 });
    } catch (_) { /* trình duyệt không hỗ trợ đo — bỏ qua hiệu ứng */ }
  }
  function tickMeters() {
    const now = Date.now();
    const next = new Set();
    for (const [id, m] of meters) {
      if (id === myId && V.muted) continue;
      if (id !== myId && (V.deaf || V.silenced.has(id))) continue;
      m.an.getByteTimeDomainData(m.buf);
      let sum = 0;
      for (const v of m.buf) sum += (v - 128) * (v - 128);
      if (Math.sqrt(sum / m.buf.length) / 128 > 0.035) m.last = now;
      if (now - m.last < 350) next.add(id); // giữ thêm chút cho khỏi nhấp nháy
    }
    if (next.size !== V.speaking.size || [...next].some((id) => !V.speaking.has(id))) {
      V.speaking = next;
      changed('speak');
    }
  }

  function closePeer(id) {
    const p = peers.get(id);
    if (!p) return;
    peers.delete(id);
    try { p.pc.close(); } catch (_) {}
    if (p.audio) p.audio.remove();
    meters.delete(id);
    V.speaking.delete(id);
    changed('peers');
  }

  function makePeer(id, init) {
    closePeer(id);
    const pc = new RTCPeerConnection({ iceServers: ice });
    const p = { pc, audio: null, init, retries: retryCount.get(id) || 0, queue: [] };
    peers.set(id, p);
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.onicecandidate = (e) => { if (e.candidate) socket.emit('voice:signal', { to: id, data: { candidate: e.candidate } }); };
    pc.ontrack = (e) => {
      if (p.audio) return;
      const a = document.createElement('audio');
      a.autoplay = true;
      a.setAttribute('playsinline', '');
      a.srcObject = e.streams[0];
      a.muted = V.deaf || V.silenced.has(id);
      audioBox().appendChild(a);
      a.play().catch(() => {});
      p.audio = a;
      addMeter(id, e.streams[0]);
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      // Rớt hẳn: bên gửi offer thử nối lại tối đa 2 lần
      if (st === 'failed' && p.init && p.retries < 2 && peers.get(id) === p) {
        retryCount.set(id, p.retries + 1);
        setTimeout(() => { if (V.on && peers.get(id) === p) call(id); }, 1000);
      }
      if (st === 'connected') retryCount.delete(id);
      changed('peers');
    };
    return p;
  }

  async function call(id) {
    const p = makePeer(id, true);
    const offer = await p.pc.createOffer();
    await p.pc.setLocalDescription(offer);
    socket.emit('voice:signal', { to: id, data: { sdp: p.pc.localDescription } });
  }

  async function flush(p) {
    for (const c of p.queue.splice(0)) await p.pc.addIceCandidate(c).catch(() => {});
  }

  async function onSignal(from, data) {
    if (!V.on || !stream) return;
    if (data.sdp && data.sdp.type === 'offer') {
      const p = makePeer(from, false); // offer mới luôn thay kết nối cũ (người kia vừa vào lại)
      await p.pc.setRemoteDescription(data.sdp);
      await flush(p);
      const ans = await p.pc.createAnswer();
      await p.pc.setLocalDescription(ans);
      socket.emit('voice:signal', { to: from, data: { sdp: p.pc.localDescription } });
    } else if (data.sdp && data.sdp.type === 'answer') {
      const p = peers.get(from);
      if (!p || p.pc.signalingState !== 'have-local-offer') return;
      await p.pc.setRemoteDescription(data.sdp);
      await flush(p);
    } else if (data.candidate) {
      const p = peers.get(from);
      if (!p) return;
      if (p.pc.remoteDescription) await p.pc.addIceCandidate(data.candidate).catch(() => {});
      else p.queue.push(data.candidate);
    }
  }

  V.init = (sock, getId) => {
    socket = sock;
    Object.defineProperty(V, 'myId', { get: getId });
    socket.on('voice:peers', (ids) => { if (V.on) ids.forEach((id) => call(id).catch((e) => console.warn('voice', e))); });
    socket.on('voice:signal', ({ from, data }) => {
      const prev = chains.get(from) || Promise.resolve();
      chains.set(from, prev.then(() => onSignal(from, data)).catch((e) => console.warn('voice', e)));
    });
  };

  // Bật thoại. Ném lỗi có .code: 'unsupported' | 'insecure' | 'denied' | 'nomic'
  V.join = async () => {
    if (V.on || V.busy) return;
    if (!window.isSecureContext) throw Object.assign(new Error('insecure'), { code: 'insecure' });
    if (!V.supported) throw Object.assign(new Error('unsupported'), { code: 'unsupported' });
    V.busy = true;
    changed('state');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      V.busy = false;
      changed('state');
      throw Object.assign(e, { code: e.name === 'NotFoundError' ? 'nomic' : 'denied' });
    }
    await loadIce();
    myId = V.myId;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); ctx.resume(); } catch (_) { ctx = null; }
    addMeter(myId, stream);
    meterTimer = setInterval(tickMeters, 120);
    V.on = true;
    V.busy = false;
    V.muted = false;
    socket.emit('voice:join');
    changed('state');
  };

  V.leave = (notify = true) => {
    if (!V.on) return;
    for (const id of [...peers.keys()]) closePeer(id);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    clearInterval(meterTimer);
    meters.clear();
    if (ctx) ctx.close().catch(() => {});
    ctx = null;
    V.on = false;
    V.speaking = new Set();
    if (notify && socket.connected) socket.emit('voice:leave');
    changed('state');
  };

  // Kết nối socket mới (mạng chập chờn / server khởi động lại): vào lại thoại, giữ trạng thái tắt mic
  V.rejoin = () => {
    if (!V.on) return;
    for (const id of [...peers.keys()]) closePeer(id);
    socket.emit('voice:join');
    if (V.muted) socket.emit('voice:mute', true);
  };

  V.setMuted = (b) => {
    if (!V.on) return;
    V.muted = !!b;
    stream.getAudioTracks().forEach((t) => { t.enabled = !V.muted; });
    socket.emit('voice:mute', V.muted);
    changed('state');
  };

  V.setDeaf = (b) => {
    V.deaf = !!b;
    for (const [id, p] of peers) if (p.audio) p.audio.muted = V.deaf || V.silenced.has(id);
    changed('state');
  };

  V.toggleSilence = (id) => {
    V.silenced.has(id) ? V.silenced.delete(id) : V.silenced.add(id);
    const p = peers.get(id);
    if (p && p.audio) p.audio.muted = V.deaf || V.silenced.has(id);
    changed('state');
  };

  // 'connected' | 'connecting' | 'failed' | null — để hiện trạng thái nối với từng người
  V.peerState = (id) => {
    const p = peers.get(id);
    if (!p) return null;
    const st = p.pc.connectionState;
    return st === 'connected' ? 'connected' : st === 'failed' || st === 'closed' ? 'failed' : 'connecting';
  };

  // Đồng bộ với danh sách thành viên: đóng kết nối tới người đã rời thoại / rời phòng
  V.sync = (members) => {
    if (!V.on) return;
    if (!members) return V.leave(false); // bị mời ra / đã rời phòng
    const inVoice = new Set(members.filter((m) => m.voice).map((m) => m.id));
    for (const id of [...peers.keys()]) if (!inVoice.has(id)) closePeer(id);
  };

  window.Voice = V;
})();
