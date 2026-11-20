/*
 * Blind Timer Relay — Vortexa party mini game
 * Plain vanilla JavaScript, no external dependencies.
 *
 * Screen flow:
 *   setup → game → handover → game … → reveal
 *
 * Game phases (game.phase):
 *   ready     waiting for the current player to press Start
 *   running   timer is running
 *   handover  leg finished, waiting for the phone to be passed on
 *   reveal    result has been revealed
 *
 * Time unit: all times are stored internally as integer centiseconds (cs) to avoid float errors.
 */
(() => {
  'use strict';

  // ================================================================ constants
  // localStorage keys (versioned so a future data format never reads stale data)
  const KEYS = {
    settings: 'vx-blind:settings:v1', // host settings
    game: 'vx-blind:game:v1', // game in progress (restored after a page reload)
    stats: 'vx-blind:stats:v1', // stats: games played, games won
  };
  // Input limits
  const LIMITS = { targetMin: 1, targetMax: 3600, tolMin: 0, tolMax: 600, players: 20, nameLen: 24 };
  // Anti-mistap guards (ms): dial = minimum gap between two dial presses; screen = button delay after a screen change
  const GUARD = { dial: 350, screen: 600 };
  // All valid game phases
  const PHASES = ['ready', 'running', 'handover', 'reveal'];

  // ================================================================ UI text
  // zh = Simplified Chinese, en = English. Values are strings, arrays, or functions that take arguments.
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

  // ================================================================ helpers
  const $ = (sel, root = document) => root.querySelector(sel); // find one element
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel)); // find all elements (as an array)
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v)); // limit a value to lo..hi
  const round1 = (v) => Math.round(v * 10) / 10; // round to 1 decimal place
  // Parse input as a number; return fallback when invalid (also accepts a comma decimal separator)
  const toNum = (v, fallback) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  };
  const fmtSec = (v) => String(round1(v)); // seconds display: 30 -> "30", 2.5 -> "2.5"
  const fmtCs = (cs) => (cs / 100).toFixed(2); // centiseconds -> "12.34"

  // Create an element. Text goes in via textContent, so player names are never parsed as HTML (no XSS)
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  // localStorage wrapper: never throws in private mode or when storage is blocked
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

  // Get UI text in the current language. t('goal', 30, 3) calls the function with those arguments
  function t(key, ...args) {
    const dict = I18N[settings.lang] || I18N.zh;
    const v = key in dict ? dict[key] : I18N.zh[key];
    return typeof v === 'function' ? v(...args) : v;
  }

  // ================================================================ state
  // Clean loaded settings: any missing or invalid field falls back to its default
  function sanitizeSettings(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    const players = Array.isArray(s.players)
      ? s.players.slice(0, LIMITS.players).map((p) => String(p == null ? '' : p).slice(0, LIMITS.nameLen))
      : ['', '', '', '']; // default 4 players (empty name = shown as "Player 1, 2…")
    if (!players.length) players.push('');
    return {
      target: round1(clamp(toNum(s.target, 30), LIMITS.targetMin, LIMITS.targetMax)), // target seconds, default 30
      tolerance: round1(clamp(toNum(s.tolerance, 3), LIMITS.tolMin, LIMITS.tolMax)), // tolerance seconds, default ±3
      players,
      autoReveal: s.autoReveal !== false, // auto-reveal after the last player, default on
      sound: s.sound !== false, // sound, default on
      lang: s.lang === 'en' ? 'en' : 'zh', // UI language, default Chinese
    };
  }

  // Clean loaded stats: only accept non-negative integers
  function sanitizeStats(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    const int = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
    return { played: int(s.played), won: int(s.won) };
  }

  // performance.now() when the current leg started. Kept in memory only, never written to localStorage
  let startPerf = 0;

  // Load the game in progress from localStorage and validate every field; corrupt data = no game
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
      // Page was reloaded mid-leg: use the wall clock (Date.now) to recover elapsed time, so none is lost
      const elapsed = clamp(Date.now() - toNum(g.startWall, Date.now()), 0, 864e5);
      startPerf = performance.now() - elapsed;
    }
    return g;
  }

  let settings = sanitizeSettings(store.get(KEYS.settings, null)); // host settings
  let stats = sanitizeStats(store.get(KEYS.stats, null)); // stats
  // Current game (null when there is none). Shape:
  //   phase     game phase
  //   segs      finished legs: [{ p: player index, cs: duration in centiseconds }]
  //   startWall Date.now() when the current leg started (used to recover after a reload)
  //   target    target seconds; tol = tolerance seconds
  //   players   player names (locked at game start; editing settings mid-game has no effect)
  //   auto      auto-reveal after the last player
  //   counted   whether this game has been added to stats (prevents double counting after a reload)
  let game = loadGame();

  const saveSettings = () => store.set(KEYS.settings, settings);
  const saveGame = () => { if (game) store.set(KEYS.game, game); };
  const totalCs = () => game.segs.reduce((sum, s) => sum + s.cs, 0); // total time of all legs

  // Win check. Everything is compared as integer centiseconds to avoid float errors
  // e.g. target 30, tolerance 3: total 33.00 -> diff 300 <= 300 -> win; 33.01 -> diff 301 -> lose
  function judge(total, target, tol) {
    const diffCs = total - Math.round(target * 100);
    return { diffCs, win: Math.abs(diffCs) <= Math.round(tol * 100) };
  }

  // ================================================================ sound, vibration, wake lock
  // Sound effects: synthesized live with the Web Audio API, no audio files needed
  const sfx = (() => {
    let ctx = null;
    // Create or resume the audio context
    function ensure() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    // Play one tone: frequency freq (Hz), length dur (s), waveform type, delay when (s), volume vol
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
        // Volume envelope: fast fade-in, exponential fade-out, no clicks
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain).connect(c.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
      } catch (_) { /* audio not supported: ignore */ }
    }
    return {
      // iOS only allows audio to start from a user click, so call this inside button click handlers
      unlock() { try { ensure(); } catch (_) { /* ignore */ } },
      start() { tone(660, 0.12); tone(990, 0.14, 'sine', 0.06); }, // start: two rising beeps
      stop() { tone(520, 0.16, 'triangle'); }, // stop: one beep
      win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', i * 0.11)); }, // win: rising arpeggio
      lose() { [392, 330, 247].forEach((f, i) => tone(f, 0.32, 'sawtooth', i * 0.17, 0.06)); }, // lose: three falling tones
    };
  })();

  // Phone vibration (Android only; iOS ignores it)
  const buzz = (pattern) => { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (_) { /* ignore */ } };

  // Keep the screen on (Wake Lock API) so the phone does not sleep mid-game
  const wake = {
    lock: null,
    async on() {
      if (this.lock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        this.lock = lock;
        // The system releases the lock when the page goes to the background; forget it and re-request on return
        lock.addEventListener('release', () => { if (this.lock === lock) this.lock = null; });
      } catch (_) { /* not allowed: ignore */ }
    },
    async off() {
      const lock = this.lock;
      this.lock = null;
      try { if (lock) await lock.release(); } catch (_) { /* ignore */ }
    },
  };

  // Ring animation while timing: speed and size change randomly, so nobody can count rotations as seconds
  const spin = (() => {
    const node = $('#spinner');
    let raf = 0; // requestAnimationFrame id (0 = not spinning)
    let angle = 0; // current angle
    let speed = 0; // current speed (deg/s)
    let targetSpeed = 0; // speed we are easing towards
    let scale = 1; // current scale
    let targetScale = 1; // scale we are easing towards
    let nextAt = 0; // time of the next random speed change
    let last = 0; // time of the previous frame
    function frame(now) {
      const dt = clamp((now - last) / 1000, 0, 0.05); // seconds since last frame (capped so it does not jump after returning from background)
      last = now;
      if (now >= nextAt) {
        // Pick a new random target speed and size every 0.25–1.35 s
        targetSpeed = 110 + Math.random() * 520;
        targetScale = 0.97 + Math.random() * 0.07;
        nextAt = now + 250 + Math.random() * 1100;
      }
      // Ease smoothly towards the targets, no sudden jumps
      const k = Math.min(1, dt * 4);
      speed += (targetSpeed - speed) * k;
      scale += (targetScale - scale) * k;
      angle = (angle + speed * dt) % 360;
      node.style.transform = `rotate(${angle.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      raf = requestAnimationFrame(frame);
    }
    return {
      start() {
        if (raf) return; // already spinning
        last = performance.now();
        nextAt = 0;
        speed = 200;
        raf = requestAnimationFrame(frame);
      },
      stop() {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        node.style.transform = ''; // hand back to the slow, steady CSS spin
      },
    };
  })();

  // Confetti on a win (drawn on a canvas, no external library)
  const confetti = (() => {
    const canvas = $('#confetti');
    const ctx = canvas.getContext('2d');
    const colors = ['#8b5cf6', '#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#ffffff'];
    let raf = 0;
    // Stop the animation and clear the canvas
    function clear() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    // Fire one burst of confetti
    function burst() {
      clear();
      // Size the canvas for the screen pixel density (max 2x) so it stays sharp on high-DPI screens
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = window.innerWidth;
      const H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // 160 pieces, launched outwards from the upper middle of the screen
      const parts = Array.from({ length: 160 }, (_, i) => ({
        x: W / 2 + (Math.random() - 0.5) * W * 0.3, // position
        y: H * 0.3,
        vx: (Math.random() - 0.5) * 15, // velocity
        vy: -4 - Math.random() * 14,
        w: 6 + Math.random() * 6, // size
        h: 8 + Math.random() * 8,
        r: Math.random() * Math.PI * 2, // rotation
        vr: (Math.random() - 0.5) * 0.4, // rotation speed
        c: colors[i % colors.length], // colour
      }));
      const DURATION = 3500; // total animation length (ms)
      const t0 = performance.now();
      let prev = t0;
      const frame = (now) => {
        // f = frame multiplier relative to 60fps, so speed is the same on 60Hz and 120Hz screens
        const f = clamp((now - prev) / 16.67, 0, 3);
        prev = now;
        const age = now - t0;
        ctx.clearRect(0, 0, W, H);
        ctx.globalAlpha = clamp(1 - age / DURATION, 0, 1); // fade out over time
        for (const p of parts) {
          p.vy += 0.35 * f; // gravity
          p.vx *= Math.pow(0.99, f); // air drag
          p.x += p.vx * f;
          p.y += p.vy * f;
          p.r += p.vr * f;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.r);
          ctx.fillStyle = p.c;
          // Height changes with angle so pieces look like flipping paper
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

  // ================================================================ screens
  const screens = {
    setup: $('#screen-setup'), // settings screen
    game: $('#screen-game'), // timer screen
    handover: $('#screen-handover'), // pass-the-phone screen
    reveal: $('#screen-reveal'), // result screen
  };
  let current = null; // name of the screen on display
  let armedAt = 0; // screen buttons ignore taps until this time (anti-mistap)
  let dialArmedAt = 0; // the dial ignores taps until this time (anti double tap)
  const armed = () => performance.now() >= armedAt;

  // Switch to a screen and re-render its content
  function show(name, opts = {}) {
    current = name;
    for (const [key, node] of Object.entries(screens)) node.classList.toggle('active', key === name);
    const now = performance.now();
    armedAt = now + GUARD.screen;
    dialArmedAt = now + 300;
    if (name !== 'reveal') stopReveal(); // leaving reveal: stop count-up and confetti
    if (name !== 'game') spin.stop(); // leaving game: stop the ring animation
    // Setup and reveal do not need the screen kept on; game screens do
    if (name === 'setup' || name === 'reveal') wake.off();
    else wake.on();
    render[name](opts);
    window.scrollTo(0, 0);
  }

  // Apply the current language: update every element with a data-i18n attribute
  function applyI18n() {
    document.documentElement.lang = settings.lang === 'zh' ? 'zh-CN' : 'en';
    document.title = t('docTitle');
    $$('[data-i18n]').forEach((node) => { node.textContent = t(node.dataset.i18n); });
    $('#rules-list').replaceChildren(...t('rules').map((r) => el('li', null, r)));
    $$('.quit').forEach((b) => b.setAttribute('aria-label', t('quit')));
  }

  // ---------------------------------------------------------------- setup screen
  const playerList = $('#player-list');

  // Render the player list: each row = number + name input + remove button
  function renderPlayers() {
    const n = settings.players.length;
    playerList.replaceChildren(...settings.players.map((name, i) => {
      const li = el('li', 'player');
      const input = el('input', 'p-input');
      input.type = 'text';
      input.maxLength = LIMITS.nameLen;
      input.value = name;
      input.placeholder = t('playerN', i + 1); // shown as "Player N" when no name is entered
      input.autocomplete = 'off';
      input.enterKeyHint = i < n - 1 ? 'next' : 'done'; // mobile keyboard Enter key shows "next" / "done"
      input.dataset.i = String(i);
      input.setAttribute('aria-label', t('playerN', i + 1));
      const rm = el('button', 'p-remove', '×');
      rm.type = 'button';
      rm.dataset.i = String(i);
      rm.disabled = n <= 1; // keep at least 1 player
      rm.setAttribute('aria-label', `${t('remove')} ${t('playerN', i + 1)}`);
      li.append(el('span', 'p-badge', String(i + 1)), input, rm);
      return li;
    }));
    $('#player-count').textContent = String(n);
    $('#btn-add').disabled = n >= LIMITS.players; // no more players once the limit is reached
  }

  // Sync target and tolerance into their inputs
  function syncNumbers() {
    $('#in-target').value = fmtSec(settings.target);
    $('#in-tol').value = fmtSec(settings.tolerance);
  }

  // Render the whole setup screen
  function renderSetup() {
    syncNumbers();
    $('#in-auto').checked = settings.autoReveal;
    $('#in-sound').checked = settings.sound;
    $('#btn-lang').textContent = settings.lang === 'zh' ? 'EN' : '中文'; // button shows the language to switch to
    renderPlayers();
    $('#stats').textContent = stats.played ? t('stats', stats.played, stats.won) : '';
  }

  // ---------------------------------------------------------------- game screen
  // "Target 30s · ±3s" pill at the top (on both game and handover screens)
  function renderGoal() {
    const text = t('goal', fmtSec(game.target), fmtSec(game.tol));
    $$('.goal').forEach((node) => { node.textContent = text; });
  }

  function renderGame() {
    const n = game.players.length;
    const done = game.segs.length; // legs finished so far
    renderGoal();
    // Auto-reveal mode shows "Turn 2 / 4"; loop mode shows only "Turn 5"
    $('#turn-label').textContent = game.auto ? t('legOf', done + 1, n) : t('leg', done + 1);
    $('#turn-name').textContent = game.players[done % n]; // players take turns: modulo picks who is up
    // Progress dots: done = filled, current = glowing ring (auto-reveal mode only)
    const dots = $('#dots');
    dots.replaceChildren();
    if (game.auto) {
      for (let k = 0; k < n; k++) {
        dots.append(el('span', `dot${k < done ? ' done' : k === done ? ' now' : ''}`));
      }
    }
    // Dial shows Start or Stop
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

  // ---------------------------------------------------------------- handover screen
  function renderHandover() {
    const n = game.players.length;
    const last = game.segs[game.segs.length - 1]; // the leg just finished
    renderGoal();
    $('#done-text').textContent = t('done', game.players[last.p]);
    $('#next-name').textContent = game.players[game.segs.length % n]; // next player
    $('#btn-reveal').textContent = game.auto ? t('revealEarly') : t('revealNow');
  }

  // ---------------------------------------------------------------- reveal screen
  // Reveal screen elements and animation state
  const rv = {
    screen: screens.reveal,
    time: $('#rv-time'), // big number
    marker: $('#rv-marker'), // dot on the scale bar
    zone: $('#rv-zone'), // green win zone on the scale bar
    tline: $('#rv-tline'), // target line
    labels: $('#rv-labels'), // numbers under the scale bar
    segs: $('#rv-segs'), // per-turn time list
    raf: 0, // count-up animation id
    skip: false, // player tapped to skip the animation
    done: false, // animation finished (buttons only work after this)
    lo: 0, // left end of the scale (cs)
    hi: 1, // right end of the scale (cs)
  };
  // Map a time to a position on the scale (0–100%); values outside the range stick to the ends
  const scalePos = (cs) => clamp((cs - rv.lo) / (rv.hi - rv.lo), 0, 1) * 100;

  // Update the big number and the scale dot position
  function setRevealTime(cs) {
    rv.time.textContent = fmtCs(cs);
    rv.marker.style.left = `${scalePos(cs)}%`;
  }

  // Lay out the scale bar: centred on the target, extending span to each side
  function layoutScale() {
    const T = Math.round(game.target * 100);
    const tol = Math.round(game.tol * 100);
    // span = largest of: 2.5x tolerance, 25% of target, 1 second
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
      // Zone is wide enough: show three labels "27s 30s 33s"
      add(T - tol, `${fmtSec((T - tol) / 100)}s`);
      add(T, `${fmtSec(T / 100)}s`, 't');
      add(T + tol, `${fmtSec((T + tol) / 100)}s`);
    } else {
      // Zone too narrow, labels would overlap: show one centred label "30s ±0.5"
      add(T, tol > 0 ? `${fmtSec(T / 100)}s ±${fmtSec(tol / 100)}` : `${fmtSec(T / 100)}s`, 't');
    }
  }

  // Fill in the result badge, difference and comment
  function fillResult(diffCs, win) {
    const ad = Math.abs(diffCs);
    const tolCs = Math.round(game.tol * 100);
    $('#rv-badge').textContent = win ? (ad === 0 ? t('perfect') : t('win')) : t('lose');
    $('#rv-diff').textContent = ad === 0 ? t('exact') : diffCs > 0 ? t('over', fmtCs(ad)) : t('under', fmtCs(ad));
    // Comment: on a win, how close (within 0.2 s = spot on); on a loss, how far (within 1 s past tolerance = so close)
    let quip;
    if (win) quip = ad === 0 ? t('quipPerfect') : ad <= 20 ? t('quipClose') : t('quipWin');
    else quip = ad - tolCs <= 100 ? t('quipNear') : t('quipFar');
    $('#rv-quip').textContent = quip;
  }

  // Fill in the per-turn time list and tag the shortest and longest turns
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
      if (list[minI].cs === list[maxI].cs) { minI = -1; maxI = -1; } // all equal: no tags
    }
    let cum = 0; // running total
    rv.segs.replaceChildren(...list.map((s, i) => {
      cum += s.cs;
      const li = el('li', 'seg');
      const name = el('div', 'seg-name');
      name.append(el('span', null, game.players[s.p]));
      if (i === minI) name.append(el('em', 'tag fast', t('fastest')));
      if (i === maxI) name.append(el('em', 'tag slow', t('slowest')));
      const time = el('div', 'seg-time', `+${fmtCs(s.cs)}s`); // this turn's time
      time.append(el('small', null, `Σ ${fmtCs(cum)}s`)); // running total up to this turn
      li.append(el('span', 'p-badge', String(i + 1)), name, time);
      return li;
    }));
  }

  // Stop all reveal screen animations
  function stopReveal() {
    if (rv.raf) cancelAnimationFrame(rv.raf);
    rv.raf = 0;
    confetti.clear();
  }

  // Render the reveal screen. opts.animate = true plays the count-up; false shows the result at once (e.g. after a reload)
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

    // Animation finished: show result and buttons; withFx = play sound, confetti and vibration
    const finish = (withFx) => {
      setRevealTime(total);
      rv.screen.classList.add('revealed', win ? 'win' : 'lose');
      rv.done = true;
      armedAt = Math.max(armedAt, performance.now() + 400); // buttons work 0.4 s after they appear
      if (!withFx) return;
      if (win) { sfx.win(); confetti.burst(); buzz([40, 60, 40]); }
      else { sfx.lose(); buzz(160); }
    };

    if (!opts.animate) { finish(false); return; }
    setRevealTime(0);
    // Animation lasts 1.6–3.2 s; longer totals get a longer animation
    const duration = clamp(1600 + total * 0.25, 1600, 3200);
    const t0 = performance.now();
    const step = (now) => {
      const p = rv.skip ? 1 : clamp((now - t0) / duration, 0, 1); // progress 0–1
      const eased = 1 - Math.pow(1 - p, 4); // easing: slows down near the end for suspense
      setRevealTime(Math.round(total * eased));
      if (p < 1) rv.raf = requestAnimationFrame(step);
      else { rv.raf = 0; finish(true); }
    };
    rv.raf = requestAnimationFrame(step);
  }

  // Screen name -> render function
  const render = { setup: renderSetup, game: renderGame, handover: renderHandover, reveal: renderReveal };

  // ================================================================ actions
  // Commit a number input: invalid input restores the old value, out-of-range input is clamped
  function commitNumber(input, key, lo, hi) {
    settings[key] = round1(clamp(toNum(input.value, settings[key]), lo, hi));
    input.value = fmtSec(settings[key]);
    saveSettings();
  }

  // Start a new game: copy the current settings into the game (editing settings mid-game has no effect)
  function startGame() {
    game = {
      phase: 'ready',
      segs: [],
      startWall: 0,
      target: settings.target,
      tol: settings.tolerance,
      players: settings.players.map((p, i) => p.trim() || t('playerN', i + 1)), // empty names become "Player N"
      auto: settings.autoReveal,
      counted: false,
    };
    saveGame();
    sfx.unlock();
    show('game');
  }

  // End and delete the current game
  function clearGame() {
    game = null;
    store.del(KEYS.game);
    spin.stop();
  }

  // Dial pressed: ready -> start timing; running -> stop
  function dialAction() {
    if (!game || current !== 'game') return;
    const now = performance.now();
    if (now < dialArmedAt) return; // anti double tap: ignore presses within 350 ms of the last one
    dialArmedAt = now + GUARD.dial;
    // Replay the press animation (remove class, force reflow, add it back)
    const dial = $('#dial');
    dial.classList.remove('pulse');
    void dial.offsetWidth;
    dial.classList.add('pulse');
    if (game.phase === 'ready') startLeg(now);
    else if (game.phase === 'running') stopLeg(now);
  }

  // Start a leg: record the start time
  function startLeg(now) {
    startPerf = now; // precise timing (performance.now is not affected by system clock changes)
    game.startWall = Date.now(); // used to recover after a reload
    game.phase = 'running';
    saveGame();
    sfx.start();
    buzz(12);
    renderGame();
  }

  // Stop a leg: compute and record its duration
  function stopLeg(now) {
    const ms = Math.max(0, now - startPerf);
    game.segs.push({ p: game.segs.length % game.players.length, cs: Math.round(ms / 10) });
    game.startWall = 0;
    game.phase = 'handover';
    spin.stop();
    sfx.stop();
    buzz(25);
    if (game.auto && game.segs.length >= game.players.length) {
      reveal(); // auto-reveal mode: last player is done, reveal now
    } else {
      saveGame();
      show('handover');
    }
  }

  // Reveal the result and add it to stats (once per game)
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

  // ================================================================ events
  // ---------------------------------------------------------------- setup screen
  // Switch language
  $('#btn-lang').addEventListener('click', () => {
    settings.lang = settings.lang === 'zh' ? 'en' : 'zh';
    saveSettings();
    applyI18n();
    renderSetup();
  });

  // − / + buttons: target steps by ±1 s, tolerance by ±0.5 s
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

  // Typing a number: committed on change (leaving the input), not while typing
  const inTarget = $('#in-target');
  const inTol = $('#in-tol');
  const commitTarget = () => commitNumber(inTarget, 'target', LIMITS.targetMin, LIMITS.targetMax);
  const commitTol = () => commitNumber(inTol, 'tolerance', LIMITS.tolMin, LIMITS.tolMax);
  inTarget.addEventListener('change', commitTarget);
  inTol.addEventListener('change', commitTol);
  [inTarget, inTol].forEach((input) => {
    input.addEventListener('focus', () => { try { input.select(); } catch (_) { /* ignore */ } }); // select all on focus for quick editing
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); }); // Enter confirms
  });

  // Edit player names (event delegation: one listener on the list also covers newly added inputs)
  playerList.addEventListener('input', (e) => {
    const input = e.target;
    if (!input.classList.contains('p-input')) return;
    const i = Number(input.dataset.i);
    if (i >= 0 && i < settings.players.length) {
      settings.players[i] = input.value.slice(0, LIMITS.nameLen);
      saveSettings();
    }
  });
  // Enter in a name input: jump to the next one; on the last one, close the keyboard
  playerList.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.classList.contains('p-input')) return;
    e.preventDefault();
    const inputs = $$('.p-input', playerList);
    const next = inputs[inputs.indexOf(e.target) + 1];
    if (next) next.focus();
    else e.target.blur();
  });
  // Remove a player
  playerList.addEventListener('click', (e) => {
    const btn = e.target.closest('.p-remove');
    if (!btn || settings.players.length <= 1) return;
    settings.players.splice(Number(btn.dataset.i), 1);
    saveSettings();
    renderPlayers();
  });
  // Add a player
  $('#btn-add').addEventListener('click', () => {
    if (settings.players.length >= LIMITS.players) return;
    settings.players.push('');
    saveSettings();
    renderPlayers();
  });

  // Toggles: auto-reveal, sound
  $('#in-auto').addEventListener('change', (e) => { settings.autoReveal = e.target.checked; saveSettings(); });
  $('#in-sound').addEventListener('change', (e) => { settings.sound = e.target.checked; saveSettings(); });

  // Start game (commit any number still being typed first)
  $('#btn-start').addEventListener('click', () => {
    commitTarget();
    commitTol();
    startGame();
  });

  // ---------------------------------------------------------------- game screen
  // The dial uses pointerdown (fires on first touch), ~100 ms faster than click, so timing is more accurate
  const dialBtn = $('#dial');
  dialBtn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !e.isPrimary) return; // primary button / first finger only
    e.preventDefault();
    dialAction();
  });
  dialBtn.addEventListener('contextmenu', (e) => e.preventDefault()); // block the long-press menu
  // On desktop, Space or Enter also works the dial
  document.addEventListener('keydown', (e) => {
    if (current !== 'game' || e.repeat) return;
    if (e.target instanceof HTMLButtonElement && e.target !== dialBtn) return; // do not hijack other focused buttons (e.g. quit)
    if (e.code === 'Space' || e.key === 'Enter') {
      e.preventDefault();
      dialAction();
    }
  });
  document.addEventListener('touchstart', () => {}, { passive: true }); // enables the :active press style on iOS

  // Quit the game (with confirmation)
  $$('.quit').forEach((btn) => btn.addEventListener('click', () => {
    if (!game) return;
    if (window.confirm(t('quitConfirm'))) {
      clearGame();
      show('setup');
    }
  }));

  // ---------------------------------------------------------------- handover screen
  // "I'm ready": next player's turn
  $('#btn-ready').addEventListener('click', () => {
    if (!armed() || !game || game.phase !== 'handover') return;
    game.phase = 'ready';
    saveGame();
    sfx.unlock();
    show('game');
  });
  // "Finish & reveal" / "Reveal now"
  $('#btn-reveal').addEventListener('click', () => {
    if (!armed() || !game || game.phase !== 'handover') return;
    sfx.unlock();
    reveal();
  });

  // ---------------------------------------------------------------- reveal screen
  // Tap anywhere during the animation to skip it
  rv.screen.addEventListener('pointerdown', () => { if (!rv.done) rv.skip = true; });
  // Play again (same settings)
  $('#btn-again').addEventListener('click', () => {
    if (!armed() || !rv.done) return;
    startGame();
  });
  // Back to setup
  $('#btn-settings').addEventListener('click', () => {
    if (!armed() || !rv.done) return;
    clearGame();
    show('setup');
  });

  // Re-request the wake lock when returning from the background
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (current === 'game' || current === 'handover')) wake.on();
  });

  // ================================================================ boot
  applyI18n();
  if (game) {
    // Unfinished game found (e.g. page was reloaded): go back to the matching screen
    const screen = game.phase === 'reveal' ? 'reveal' : game.phase === 'handover' ? 'handover' : 'game';
    show(screen, { animate: false });
  } else {
    show('setup');
  }

  // Hook for automated tests (does not affect the game)
  window.__vx = { judge, state: () => ({ screen: current, game, settings, stats }) };
})();
