/* Blind Timer Relay (盲计时接力) — Vortexa mini game. No dependencies. */
(() => {
  'use strict';

  // ---------------------------------------------------------------- config
  const KEYS = {
    settings: 'vx-blind:settings:v1',
    game: 'vx-blind:game:v1',
    stats: 'vx-blind:stats:v1',
  };
  const LIMITS = { targetMin: 1, targetMax: 3600, tolMin: 0, tolMax: 600, players: 20, nameLen: 24 };
  const GUARD = { dial: 350, screen: 600 }; // ms: ignore accidental double taps
  const PHASES = ['ready', 'running', 'handover', 'reveal'];

  const I18N = {
    zh: {
      docTitle: '盲计时接力 · Vortexa',
      title: '盲计时接力',
      subtitle: '看不见时间，全凭感觉。大家轮流按下开始和停止，让总时间停在目标附近。',
      target: '目标时间',
      tolerance: '容差范围',
      sec: '秒',
      players: '玩家',
      addPlayer: '+ 添加',
      remove: '删除',
      playerN: (n) => `玩家 ${n}`,
      autoReveal: '最后一位停止后自动揭晓',
      autoRevealHint: '关闭后可多轮循环，由任何人决定何时揭晓',
      sound: '音效',
      soundHint: '按键和揭晓音效，不会暴露时间',
      howTo: '玩法说明',
      rules: [
        '主持人设定目标时间和容差范围。',
        '轮到你时按「开始」，在心里默数，觉得差不多就按「停止」，然后把手机交给下一位。',
        '计时接着上一位继续累加，交接手机时暂停。屏幕全程不显示时间。',
        '揭晓时，总时间与目标相差在容差范围内，全组挑战成功。',
      ],
      startGame: '开始游戏',
      stats: (p, w) => `已玩 ${p} 局 · 成功 ${w} 局`,
      goal: (t, tol) => `目标 ${t}s · ±${tol}s`,
      legOf: (i, n) => `第 ${i} / ${n} 棒`,
      leg: (i) => `第 ${i} 棒`,
      start: '开始',
      stop: '停止',
      hintReady: '按下开始，在心里默数',
      hintRunning: '计时中… 觉得够了就按停止',
      quit: '退出本局',
      quitConfirm: '确定放弃本局吗？',
      done: (name) => `${name} 完成了`,
      passTo: '请把手机交给',
      ready: '我准备好了',
      revealNow: '结束并揭晓',
      revealEarly: '提前揭晓',
      total: '总时间',
      tapSkip: '点击屏幕跳过动画',
      win: '挑战成功！',
      perfect: '完美命中！',
      lose: '挑战失败',
      over: (d) => `比目标多 ${d} 秒`,
      under: (d) => `比目标少 ${d} 秒`,
      exact: '与目标分毫不差',
      quipPerfect: '你们是共用一个大脑吧？',
      quipClose: '默契满分，几乎零误差！',
      quipWin: '稳稳落在范围内，感觉不错！',
      quipNear: '就差一点点，再来一局！',
      quipFar: '大家的时钟好像不太同步…',
      segments: '每棒用时',
      fastest: '最短',
      slowest: '最长',
      again: '再来一局',
      settings: '修改设置',
    },
    en: {
      docTitle: 'Blind Timer Relay · Vortexa',
      title: 'Blind Timer Relay',
      subtitle: 'No clock, just instinct. Take turns pressing start and stop, and land the total time on target.',
      target: 'Target time',
      tolerance: 'Tolerance',
      sec: 's',
      players: 'Players',
      addPlayer: '+ Add',
      remove: 'Remove',
      playerN: (n) => `Player ${n}`,
      autoReveal: 'Auto-reveal after last player',
      autoRevealHint: 'Turn off to loop through players and reveal any time',
      sound: 'Sound',
      soundHint: 'Button and result sounds, never reveals time',
      howTo: 'How to play',
      rules: [
        'The host sets the target time and tolerance.',
        'On your turn, press Start, count in your head, press Stop, then pass the phone on.',
        'The timer keeps adding up across players and pauses during the hand-over. No time is ever shown.',
        'At the reveal, if the total is within tolerance of the target, the whole group wins.',
      ],
      startGame: 'Start game',
      stats: (p, w) => `${p} played · ${w} won`,
      goal: (t, tol) => `Target ${t}s · ±${tol}s`,
      legOf: (i, n) => `Turn ${i} / ${n}`,
      leg: (i) => `Turn ${i}`,
      start: 'START',
      stop: 'STOP',
      hintReady: 'Press start and count in your head',
      hintRunning: 'Timing… press stop when it feels right',
      quit: 'Quit game',
      quitConfirm: 'Quit this game?',
      done: (name) => `${name} is done`,
      passTo: 'Pass the phone to',
      ready: "I'm ready",
      revealNow: 'Finish & reveal',
      revealEarly: 'Reveal now',
      total: 'Total time',
      tapSkip: 'Tap to skip',
      win: 'You win!',
      perfect: 'Perfect hit!',
      lose: 'You lose',
      over: (d) => `${d}s over target`,
      under: (d) => `${d}s under target`,
      exact: 'Exactly on target',
      quipPerfect: 'Are you all sharing one brain?',
      quipClose: 'Near-perfect teamwork!',
      quipWin: 'Safely inside the zone. Nice!',
      quipNear: 'So close! One more round?',
      quipFar: "Everyone's clock seems a bit off…",
      segments: 'Time per turn',
      fastest: 'Shortest',
      slowest: 'Longest',
      again: 'Play again',
      settings: 'Settings',
    },
  };

  // ---------------------------------------------------------------- helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const round1 = (v) => Math.round(v * 10) / 10;
  const toNum = (v, fallback) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  };
  const fmtSec = (v) => String(round1(v)); // 30 -> "30", 2.5 -> "2.5"
  const fmtCs = (cs) => (cs / 100).toFixed(2); // centiseconds -> "12.34"

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* private mode: ignore */ }
    },
    del(key) {
      try { localStorage.removeItem(key); } catch (_) { /* ignore */ }
    },
  };

  function t(key, ...args) {
    const dict = I18N[settings.lang] || I18N.zh;
    const v = key in dict ? dict[key] : I18N.zh[key];
    return typeof v === 'function' ? v(...args) : v;
  }

  // ---------------------------------------------------------------- state
  function sanitizeSettings(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    const players = Array.isArray(s.players)
      ? s.players.slice(0, LIMITS.players).map((p) => String(p == null ? '' : p).slice(0, LIMITS.nameLen))
      : ['', '', '', ''];
    if (!players.length) players.push('');
    return {
      target: round1(clamp(toNum(s.target, 30), LIMITS.targetMin, LIMITS.targetMax)),
      tolerance: round1(clamp(toNum(s.tolerance, 3), LIMITS.tolMin, LIMITS.tolMax)),
      players,
      autoReveal: s.autoReveal !== false,
      sound: s.sound !== false,
      lang: s.lang === 'en' ? 'en' : 'zh',
    };
  }

  function sanitizeStats(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    const int = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
    return { played: int(s.played), won: int(s.won) };
  }

  let startPerf = 0; // performance.now() at the start of the running leg (not persisted)

  function loadGame() {
    const g = store.get(KEYS.game, null);
    if (!g || typeof g !== 'object' || !PHASES.includes(g.phase)) return null;
    if (!Array.isArray(g.players) || !g.players.length || !Array.isArray(g.segs)) return null;
    if (!Number.isFinite(g.target) || !Number.isFinite(g.tol)) return null;
    const segsOk = g.segs.every((s) => s && Number.isInteger(s.cs) && s.cs >= 0
      && Number.isInteger(s.p) && s.p >= 0 && s.p < g.players.length);
    if (!segsOk) return null;
    if ((g.phase === 'handover' || g.phase === 'reveal') && !g.segs.length) return null;
    if (g.phase === 'running') {
      // Page was reloaded mid-leg: resume from wall clock so no time is lost.
      const elapsed = clamp(Date.now() - toNum(g.startWall, Date.now()), 0, 864e5);
      startPerf = performance.now() - elapsed;
    }
    return g;
  }

  let settings = sanitizeSettings(store.get(KEYS.settings, null));
  let stats = sanitizeStats(store.get(KEYS.stats, null));
  let game = loadGame();

  const saveSettings = () => store.set(KEYS.settings, settings);
  const saveGame = () => { if (game) store.set(KEYS.game, game); };
  const totalCs = () => game.segs.reduce((sum, s) => sum + s.cs, 0);

  function judge(total, target, tol) {
    // Integer centiseconds: no float edge cases (33.00 vs 30 ±3 => win).
    const diffCs = total - Math.round(target * 100);
    return { diffCs, win: Math.abs(diffCs) <= Math.round(tol * 100) };
  }

  // ---------------------------------------------------------------- device fx
  const sfx = (() => {
    let ctx = null;
    function ensure() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(freq, dur, type = 'sine', when = 0, vol = 0.14) {
      if (!settings.sound) return;
      try {
        const c = ensure();
        if (!c) return;
        const t0 = c.currentTime + when;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain).connect(c.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
      } catch (_) { /* audio unavailable */ }
    }
    return {
      unlock() { try { ensure(); } catch (_) { /* ignore */ } }, // call inside a click (iOS)
      start() { tone(660, 0.12); tone(990, 0.14, 'sine', 0.06); },
      stop() { tone(520, 0.16, 'triangle'); },
      win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', i * 0.11)); },
      lose() { [392, 330, 247].forEach((f, i) => tone(f, 0.32, 'sawtooth', i * 0.17, 0.06)); },
    };
  })();

  const buzz = (pattern) => { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (_) { /* ignore */ } };

  const wake = {
    lock: null,
    async on() {
      if (this.lock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        this.lock = lock;
        lock.addEventListener('release', () => { if (this.lock === lock) this.lock = null; });
      } catch (_) { /* not allowed: ignore */ }
    },
    async off() {
      const lock = this.lock;
      this.lock = null;
      try { if (lock) await lock.release(); } catch (_) { /* ignore */ }
    },
  };

  // Irregular spin while timing, so nobody can count rotations as seconds.
  const spin = (() => {
    const node = $('#spinner');
    let raf = 0;
    let angle = 0;
    let speed = 0;
    let targetSpeed = 0;
    let scale = 1;
    let targetScale = 1;
    let nextAt = 0;
    let last = 0;
    function frame(now) {
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      if (now >= nextAt) {
        targetSpeed = 110 + Math.random() * 520; // deg/s
        targetScale = 0.97 + Math.random() * 0.07;
        nextAt = now + 250 + Math.random() * 1100;
      }
      const k = Math.min(1, dt * 4);
      speed += (targetSpeed - speed) * k;
      scale += (targetScale - scale) * k;
      angle = (angle + speed * dt) % 360;
      node.style.transform = `rotate(${angle.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      raf = requestAnimationFrame(frame);
    }
    return {
      start() {
        if (raf) return;
        last = performance.now();
        nextAt = 0;
        speed = 200;
        raf = requestAnimationFrame(frame);
      },
      stop() {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        node.style.transform = '';
      },
    };
  })();

  const confetti = (() => {
    const canvas = $('#confetti');
    const ctx = canvas.getContext('2d');
    const colors = ['#8b5cf6', '#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#ffffff'];
    let raf = 0;
    function clear() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    function burst() {
      clear();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = window.innerWidth;
      const H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const parts = Array.from({ length: 160 }, (_, i) => ({
        x: W / 2 + (Math.random() - 0.5) * W * 0.3,
        y: H * 0.3,
        vx: (Math.random() - 0.5) * 15,
        vy: -4 - Math.random() * 14,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        r: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.4,
        c: colors[i % colors.length],
      }));
      const DURATION = 3500;
      const t0 = performance.now();
      let prev = t0;
      const frame = (now) => {
        const f = clamp((now - prev) / 16.67, 0, 3); // frame-rate independent
        prev = now;
        const age = now - t0;
        ctx.clearRect(0, 0, W, H);
        ctx.globalAlpha = clamp(1 - age / DURATION, 0, 1);
        for (const p of parts) {
          p.vy += 0.35 * f;
          p.vx *= Math.pow(0.99, f);
          p.x += p.vx * f;
          p.y += p.vy * f;
          p.r += p.vr * f;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.r);
          ctx.fillStyle = p.c;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r)));
          ctx.restore();
        }
        if (age < DURATION) raf = requestAnimationFrame(frame);
        else clear();
      };
      raf = requestAnimationFrame(frame);
    }
    return { burst, clear };
  })();

  // ---------------------------------------------------------------- screens
  const screens = {
    setup: $('#screen-setup'),
    game: $('#screen-game'),
    handover: $('#screen-handover'),
    reveal: $('#screen-reveal'),
  };
  let current = null;
  let armedAt = 0; // screen buttons ignored until this time
  let dialArmedAt = 0; // dial ignored until this time
  const armed = () => performance.now() >= armedAt;

  function show(name, opts = {}) {
    current = name;
    for (const [key, node] of Object.entries(screens)) node.classList.toggle('active', key === name);
    const now = performance.now();
    armedAt = now + GUARD.screen;
    dialArmedAt = now + 300;
    if (name !== 'reveal') stopReveal();
    if (name !== 'game') spin.stop();
    if (name === 'setup' || name === 'reveal') wake.off();
    else wake.on();
    render[name](opts);
    window.scrollTo(0, 0);
  }

  function applyI18n() {
    document.documentElement.lang = settings.lang === 'zh' ? 'zh-CN' : 'en';
    document.title = t('docTitle');
    $$('[data-i18n]').forEach((node) => { node.textContent = t(node.dataset.i18n); });
    $('#rules-list').replaceChildren(...t('rules').map((r) => el('li', null, r)));
    $$('.quit').forEach((b) => b.setAttribute('aria-label', t('quit')));
  }

  // ---- setup
  const playerList = $('#player-list');

  function renderPlayers() {
    const n = settings.players.length;
    playerList.replaceChildren(...settings.players.map((name, i) => {
      const li = el('li', 'player');
      const input = el('input', 'p-input');
      input.type = 'text';
      input.maxLength = LIMITS.nameLen;
      input.value = name;
      input.placeholder = t('playerN', i + 1);
      input.autocomplete = 'off';
      input.enterKeyHint = i < n - 1 ? 'next' : 'done';
      input.dataset.i = String(i);
      input.setAttribute('aria-label', t('playerN', i + 1));
      const rm = el('button', 'p-remove', '×');
      rm.type = 'button';
      rm.dataset.i = String(i);
      rm.disabled = n <= 1;
      rm.setAttribute('aria-label', `${t('remove')} ${t('playerN', i + 1)}`);
      li.append(el('span', 'p-badge', String(i + 1)), input, rm);
      return li;
    }));
    $('#player-count').textContent = String(n);
    $('#btn-add').disabled = n >= LIMITS.players;
  }

  function syncNumbers() {
    $('#in-target').value = fmtSec(settings.target);
    $('#in-tol').value = fmtSec(settings.tolerance);
  }

  function renderSetup() {
    syncNumbers();
    $('#in-auto').checked = settings.autoReveal;
    $('#in-sound').checked = settings.sound;
    $('#btn-lang').textContent = settings.lang === 'zh' ? 'EN' : '中文';
    renderPlayers();
    $('#stats').textContent = stats.played ? t('stats', stats.played, stats.won) : '';
  }

  // ---- game
  function renderGoal() {
    const text = t('goal', fmtSec(game.target), fmtSec(game.tol));
    $$('.goal').forEach((node) => { node.textContent = text; });
  }

  function renderGame() {
    const n = game.players.length;
    const done = game.segs.length;
    renderGoal();
    $('#turn-label').textContent = game.auto ? t('legOf', done + 1, n) : t('leg', done + 1);
    $('#turn-name').textContent = game.players[done % n];
    const dots = $('#dots');
    dots.replaceChildren();
    if (game.auto) {
      for (let k = 0; k < n; k++) {
        dots.append(el('span', `dot${k < done ? ' done' : k === done ? ' now' : ''}`));
      }
    }
    const running = game.phase === 'running';
    const dial = $('#dial');
    dial.classList.toggle('running', running);
    dial.classList.toggle('idle', !running);
    const label = running ? t('stop') : t('start');
    $('#dial-label').textContent = label;
    dial.setAttribute('aria-label', label);
    $('#hint').textContent = running ? t('hintRunning') : t('hintReady');
    if (running) spin.start();
    else spin.stop();
  }

  // ---- handover
  function renderHandover() {
    const n = game.players.length;
    const last = game.segs[game.segs.length - 1];
    renderGoal();
    $('#done-text').textContent = t('done', game.players[last.p]);
    $('#next-name').textContent = game.players[game.segs.length % n];
    $('#btn-reveal').textContent = game.auto ? t('revealEarly') : t('revealNow');
  }

  // ---- reveal
  const rv = {
    screen: screens.reveal,
    time: $('#rv-time'),
    marker: $('#rv-marker'),
    zone: $('#rv-zone'),
    tline: $('#rv-tline'),
    labels: $('#rv-labels'),
    segs: $('#rv-segs'),
    raf: 0,
    skip: false,
    done: false,
    lo: 0,
    hi: 1,
  };
  const scalePos = (cs) => clamp((cs - rv.lo) / (rv.hi - rv.lo), 0, 1) * 100;

  function setRevealTime(cs) {
    rv.time.textContent = fmtCs(cs);
    rv.marker.style.left = `${scalePos(cs)}%`;
  }

  function layoutScale() {
    const T = Math.round(game.target * 100);
    const tol = Math.round(game.tol * 100);
    const span = Math.max(tol * 2.5, T * 0.25, 100);
    rv.lo = T - span;
    rv.hi = T + span;
    const a = scalePos(T - tol);
    const b = scalePos(T + tol);
    rv.zone.style.left = `${a}%`;
    rv.zone.style.width = `${b - a}%`;
    rv.tline.style.left = `${scalePos(T)}%`;
    rv.labels.replaceChildren();
    const add = (cs, text, cls) => {
      const s = el('span', cls, text);
      s.style.left = `${scalePos(cs)}%`;
      rv.labels.append(s);
    };
    if (tol > 0 && b - a >= 26) {
      add(T - tol, `${fmtSec((T - tol) / 100)}s`);
      add(T, `${fmtSec(T / 100)}s`, 't');
      add(T + tol, `${fmtSec((T + tol) / 100)}s`);
    } else {
      add(T, tol > 0 ? `${fmtSec(T / 100)}s ±${fmtSec(tol / 100)}` : `${fmtSec(T / 100)}s`, 't');
    }
  }

  function fillResult(diffCs, win) {
    const ad = Math.abs(diffCs);
    const tolCs = Math.round(game.tol * 100);
    $('#rv-badge').textContent = win ? (ad === 0 ? t('perfect') : t('win')) : t('lose');
    $('#rv-diff').textContent = ad === 0 ? t('exact') : diffCs > 0 ? t('over', fmtCs(ad)) : t('under', fmtCs(ad));
    let quip;
    if (win) quip = ad === 0 ? t('quipPerfect') : ad <= 20 ? t('quipClose') : t('quipWin');
    else quip = ad - tolCs <= 100 ? t('quipNear') : t('quipFar');
    $('#rv-quip').textContent = quip;
  }

  function fillSegments() {
    const list = game.segs;
    let minI = -1;
    let maxI = -1;
    if (list.length >= 2) {
      minI = 0;
      maxI = 0;
      list.forEach((s, i) => {
        if (s.cs < list[minI].cs) minI = i;
        if (s.cs > list[maxI].cs) maxI = i;
      });
      if (list[minI].cs === list[maxI].cs) { minI = -1; maxI = -1; }
    }
    let cum = 0;
    rv.segs.replaceChildren(...list.map((s, i) => {
      cum += s.cs;
      const li = el('li', 'seg');
      const name = el('div', 'seg-name');
      name.append(el('span', null, game.players[s.p]));
      if (i === minI) name.append(el('em', 'tag fast', t('fastest')));
      if (i === maxI) name.append(el('em', 'tag slow', t('slowest')));
      const time = el('div', 'seg-time', `+${fmtCs(s.cs)}s`);
      time.append(el('small', null, `Σ ${fmtCs(cum)}s`));
      li.append(el('span', 'p-badge', String(i + 1)), name, time);
      return li;
    }));
  }

  function stopReveal() {
    if (rv.raf) cancelAnimationFrame(rv.raf);
    rv.raf = 0;
    confetti.clear();
  }

  function renderReveal(opts = {}) {
    const total = totalCs();
    const { diffCs, win } = judge(total, game.target, game.tol);
    stopReveal();
    rv.screen.classList.remove('revealed', 'win', 'lose');
    rv.done = false;
    rv.skip = false;
    layoutScale();
    fillResult(diffCs, win);
    fillSegments();

    const finish = (withFx) => {
      setRevealTime(total);
      rv.screen.classList.add('revealed', win ? 'win' : 'lose');
      rv.done = true;
      armedAt = Math.max(armedAt, performance.now() + 400);
      if (!withFx) return;
      if (win) { sfx.win(); confetti.burst(); buzz([40, 60, 40]); }
      else { sfx.lose(); buzz(160); }
    };

    if (!opts.animate) { finish(false); return; }
    setRevealTime(0);
    const duration = clamp(1600 + total * 0.25, 1600, 3200);
    const t0 = performance.now();
    const step = (now) => {
      const p = rv.skip ? 1 : clamp((now - t0) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - p, 4); // slows down near the end for suspense
      setRevealTime(Math.round(total * eased));
      if (p < 1) rv.raf = requestAnimationFrame(step);
      else { rv.raf = 0; finish(true); }
    };
    rv.raf = requestAnimationFrame(step);
  }

  const render = { setup: renderSetup, game: renderGame, handover: renderHandover, reveal: renderReveal };

  // ---------------------------------------------------------------- actions
  function commitNumber(input, key, lo, hi) {
    settings[key] = round1(clamp(toNum(input.value, settings[key]), lo, hi));
    input.value = fmtSec(settings[key]);
    saveSettings();
  }

  function startGame() {
    game = {
      phase: 'ready',
      segs: [],
      startWall: 0,
      target: settings.target,
      tol: settings.tolerance,
      players: settings.players.map((p, i) => p.trim() || t('playerN', i + 1)),
      auto: settings.autoReveal,
      counted: false,
    };
    saveGame();
    sfx.unlock();
    show('game');
  }

  function clearGame() {
    game = null;
    store.del(KEYS.game);
    spin.stop();
  }

  function dialAction() {
    if (!game || current !== 'game') return;
    const now = performance.now();
    if (now < dialArmedAt) return;
    dialArmedAt = now + GUARD.dial;
    const dial = $('#dial');
    dial.classList.remove('pulse');
    void dial.offsetWidth; // restart press animation
    dial.classList.add('pulse');
    if (game.phase === 'ready') startLeg(now);
    else if (game.phase === 'running') stopLeg(now);
  }

  function startLeg(now) {
    startPerf = now;
    game.startWall = Date.now();
    game.phase = 'running';
    saveGame();
    sfx.start();
    buzz(12);
    renderGame();
  }

  function stopLeg(now) {
    const ms = Math.max(0, now - startPerf);
    game.segs.push({ p: game.segs.length % game.players.length, cs: Math.round(ms / 10) });
    game.startWall = 0;
    game.phase = 'handover';
    spin.stop();
    sfx.stop();
    buzz(25);
    if (game.auto && game.segs.length >= game.players.length) {
      reveal();
    } else {
      saveGame();
      show('handover');
    }
  }

  function reveal() {
    game.phase = 'reveal';
    game.startWall = 0;
    if (!game.counted) {
      game.counted = true;
      stats.played += 1;
      if (judge(totalCs(), game.target, game.tol).win) stats.won += 1;
      store.set(KEYS.stats, stats);
    }
    saveGame();
    show('reveal', { animate: true });
  }

  // ---------------------------------------------------------------- events
  // setup
  $('#btn-lang').addEventListener('click', () => {
    settings.lang = settings.lang === 'zh' ? 'en' : 'zh';
    saveSettings();
    applyI18n();
    renderSetup();
  });

  $$('.step').forEach((btn) => btn.addEventListener('click', () => {
    const delta = parseFloat(btn.dataset.delta);
    if (btn.dataset.field === 'target') {
      settings.target = round1(clamp(settings.target + delta, LIMITS.targetMin, LIMITS.targetMax));
    } else {
      settings.tolerance = round1(clamp(settings.tolerance + delta, LIMITS.tolMin, LIMITS.tolMax));
    }
    saveSettings();
    syncNumbers();
  }));

  const inTarget = $('#in-target');
  const inTol = $('#in-tol');
  const commitTarget = () => commitNumber(inTarget, 'target', LIMITS.targetMin, LIMITS.targetMax);
  const commitTol = () => commitNumber(inTol, 'tolerance', LIMITS.tolMin, LIMITS.tolMax);
  inTarget.addEventListener('change', commitTarget);
  inTol.addEventListener('change', commitTol);
  [inTarget, inTol].forEach((input) => {
    input.addEventListener('focus', () => { try { input.select(); } catch (_) { /* ignore */ } });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
  });

  playerList.addEventListener('input', (e) => {
    const input = e.target;
    if (!input.classList.contains('p-input')) return;
    const i = Number(input.dataset.i);
    if (i >= 0 && i < settings.players.length) {
      settings.players[i] = input.value.slice(0, LIMITS.nameLen);
      saveSettings();
    }
  });
  playerList.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.classList.contains('p-input')) return;
    e.preventDefault();
    const inputs = $$('.p-input', playerList);
    const next = inputs[inputs.indexOf(e.target) + 1];
    if (next) next.focus();
    else e.target.blur();
  });
  playerList.addEventListener('click', (e) => {
    const btn = e.target.closest('.p-remove');
    if (!btn || settings.players.length <= 1) return;
    settings.players.splice(Number(btn.dataset.i), 1);
    saveSettings();
    renderPlayers();
  });
  $('#btn-add').addEventListener('click', () => {
    if (settings.players.length >= LIMITS.players) return;
    settings.players.push('');
    saveSettings();
    renderPlayers();
  });

  $('#in-auto').addEventListener('change', (e) => { settings.autoReveal = e.target.checked; saveSettings(); });
  $('#in-sound').addEventListener('change', (e) => { settings.sound = e.target.checked; saveSettings(); });

  $('#btn-start').addEventListener('click', () => {
    commitTarget();
    commitTol();
    startGame();
  });

  // game: pointerdown for the most accurate timing (no click delay)
  const dialBtn = $('#dial');
  dialBtn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !e.isPrimary) return;
    e.preventDefault();
    dialAction();
  });
  dialBtn.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('keydown', (e) => {
    if (current !== 'game' || e.repeat) return;
    if (e.target instanceof HTMLButtonElement && e.target !== dialBtn) return;
    if (e.code === 'Space' || e.key === 'Enter') {
      e.preventDefault();
      dialAction();
    }
  });
  document.addEventListener('touchstart', () => {}, { passive: true }); // enables :active on iOS

  $$('.quit').forEach((btn) => btn.addEventListener('click', () => {
    if (!game) return;
    if (window.confirm(t('quitConfirm'))) {
      clearGame();
      show('setup');
    }
  }));

  // handover
  $('#btn-ready').addEventListener('click', () => {
    if (!armed() || !game || game.phase !== 'handover') return;
    game.phase = 'ready';
    saveGame();
    sfx.unlock();
    show('game');
  });
  $('#btn-reveal').addEventListener('click', () => {
    if (!armed() || !game || game.phase !== 'handover') return;
    sfx.unlock();
    reveal();
  });

  // reveal
  rv.screen.addEventListener('pointerdown', () => { if (!rv.done) rv.skip = true; });
  $('#btn-again').addEventListener('click', () => {
    if (!armed() || !rv.done) return;
    startGame();
  });
  $('#btn-settings').addEventListener('click', () => {
    if (!armed() || !rv.done) return;
    clearGame();
    show('setup');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (current === 'game' || current === 'handover')) wake.on();
  });

  // ---------------------------------------------------------------- boot
  applyI18n();
  if (game) {
    const screen = game.phase === 'reveal' ? 'reveal' : game.phase === 'handover' ? 'handover' : 'game';
    show(screen, { animate: false });
  } else {
    show('setup');
  }

  // Small hook for automated tests.
  window.__vx = { judge, state: () => ({ screen: current, game, settings, stats }) };
})();
