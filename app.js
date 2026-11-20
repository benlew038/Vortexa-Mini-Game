/*
 * 盲計時接力（Blind Timer Relay）— Vortexa 派對小遊戲
 * 純原生 JavaScript，沒有任何外部依賴。
 *
 * 畫面流程：
 *   設定頁 (setup) → 計時頁 (game) → 交接頁 (handover) → 計時頁 … → 揭曉頁 (reveal)
 *
 * 遊戲階段 game.phase：
 *   ready     等待當前玩家按「開始」
 *   running   正在計時
 *   handover  這一棒結束，等待把手機交給下一位
 *   reveal    已經揭曉結果
 *
 * 時間單位：內部一律用「百分之一秒」(cs, centisecond) 的整數保存，避免浮點誤差。
 */
(() => {
  'use strict';

  // ================================================================ 設定常數
  // localStorage 的儲存鍵名（加上版本號，以後改資料格式時不會讀到舊資料）
  const KEYS = {
    settings: 'vx-blind:settings:v1', // 主持人的設定
    game: 'vx-blind:game:v1', // 進行中的遊戲（刷新頁面後可恢復）
    stats: 'vx-blind:stats:v1', // 戰績：已玩局數、成功局數
  };
  // 各項輸入的上下限
  const LIMITS = { targetMin: 1, targetMax: 3600, tolMin: 0, tolMax: 600, players: 20, nameLen: 24 };
  // 防誤觸時間（毫秒）：dial = 計時按鈕兩次按下的最短間隔；screen = 換頁後按鈕延遲生效的時間
  const GUARD = { dial: 350, screen: 600 };
  // 所有合法的遊戲階段
  const PHASES = ['ready', 'running', 'handover', 'reveal'];

  // ================================================================ 多語言文字
  // zh = 簡體中文，en = 英文。值可以是字串、陣列，或接收參數的函式。
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

  // ================================================================ 小工具函式
  const $ = (sel, root = document) => root.querySelector(sel); // 找一個元素
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel)); // 找全部元素（回傳陣列）
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v)); // 把數值限制在 lo ~ hi 之間
  const round1 = (v) => Math.round(v * 10) / 10; // 四捨五入到小數點後 1 位
  // 把輸入轉成數字；無效時回傳 fallback（也接受歐洲寫法的逗號小數點）
  const toNum = (v, fallback) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  };
  const fmtSec = (v) => String(round1(v)); // 秒數顯示：30 → "30"，2.5 → "2.5"
  const fmtCs = (cs) => (cs / 100).toFixed(2); // 百分之一秒 → "12.34"

  // 建立一個 HTML 元素。用 textContent 填文字，玩家名字不會被當成 HTML 執行（防 XSS）
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  // localStorage 讀寫包裝：無痕模式或儲存空間被禁用時不會報錯
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
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* 無痕模式：忽略 */ }
    },
    del(key) {
      try { localStorage.removeItem(key); } catch (_) { /* 忽略 */ }
    },
  };

  // 取得目前語言的文字。t('goal', 30, 3) 會呼叫對應的函式並代入參數
  function t(key, ...args) {
    const dict = I18N[settings.lang] || I18N.zh;
    const v = key in dict ? dict[key] : I18N.zh[key];
    return typeof v === 'function' ? v(...args) : v;
  }

  // ================================================================ 遊戲狀態
  // 清理讀取到的設定：任何欄位缺失或不合法，就換成預設值
  function sanitizeSettings(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    const players = Array.isArray(s.players)
      ? s.players.slice(0, LIMITS.players).map((p) => String(p == null ? '' : p).slice(0, LIMITS.nameLen))
      : ['', '', '', '']; // 預設 4 位玩家（名字留空 = 顯示「玩家 1、2…」）
    if (!players.length) players.push('');
    return {
      target: round1(clamp(toNum(s.target, 30), LIMITS.targetMin, LIMITS.targetMax)), // 目標秒數，預設 30
      tolerance: round1(clamp(toNum(s.tolerance, 3), LIMITS.tolMin, LIMITS.tolMax)), // 容差秒數，預設 ±3
      players,
      autoReveal: s.autoReveal !== false, // 最後一位停止後自動揭曉，預設開
      sound: s.sound !== false, // 音效，預設開
      lang: s.lang === 'en' ? 'en' : 'zh', // 介面語言，預設中文
    };
  }

  // 清理戰績資料：只接受 0 或正整數
  function sanitizeStats(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    const int = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
    return { played: int(s.played), won: int(s.won) };
  }

  // 當前這一棒按「開始」時的 performance.now()。只存在記憶體中，不寫入 localStorage
  let startPerf = 0;

  // 從 localStorage 讀取進行中的遊戲，逐項檢查格式；資料損壞就當作沒有遊戲
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
      // 計時中途刷新了頁面：用牆上時鐘 (Date.now) 算出已經過的時間，接著計，不會丟失
      const elapsed = clamp(Date.now() - toNum(g.startWall, Date.now()), 0, 864e5);
      startPerf = performance.now() - elapsed;
    }
    return g;
  }

  let settings = sanitizeSettings(store.get(KEYS.settings, null)); // 主持人設定
  let stats = sanitizeStats(store.get(KEYS.stats, null)); // 戰績
  // 當前遊戲（沒有遊戲時為 null）。結構：
  //   phase     遊戲階段
  //   segs      已完成的每一棒：[{ p: 玩家索引, cs: 用時（百分之一秒） }]
  //   startWall 當前這一棒開始時的 Date.now()（用於刷新後恢復）
  //   target    目標秒數；tol 容差秒數
  //   players   玩家名字（開局時鎖定，中途改設定不影響本局）
  //   auto      是否最後一位停止後自動揭曉
  //   counted   本局是否已計入戰績（防止刷新後重複計算）
  let game = loadGame();

  const saveSettings = () => store.set(KEYS.settings, settings);
  const saveGame = () => { if (game) store.set(KEYS.game, game); };
  const totalCs = () => game.segs.reduce((sum, s) => sum + s.cs, 0); // 所有棒的總用時

  // 勝負判定。全部換成整數（百分之一秒）比較，避免浮點誤差
  // 例：目標 30、容差 3，總時間 33.00 → 差 300 ≤ 300 → 贏；33.01 → 差 301 → 輸
  function judge(total, target, tol) {
    const diffCs = total - Math.round(target * 100);
    return { diffCs, win: Math.abs(diffCs) <= Math.round(tol * 100) };
  }

  // ================================================================ 音效、震動、螢幕常亮
  // 音效：用 Web Audio API 即時合成，不需要音效檔
  const sfx = (() => {
    let ctx = null;
    // 建立或喚醒音訊環境
    function ensure() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    // 播放一個音：頻率 freq (Hz)、長度 dur (秒)、波形 type、延遲 when (秒)、音量 vol
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
        // 音量包絡：快速淡入，再指數淡出，避免爆音
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain).connect(c.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
      } catch (_) { /* 瀏覽器不支援音訊：忽略 */ }
    }
    return {
      // iOS 規定音訊必須在使用者點擊時啟用，所以在「開始遊戲」等按鈕的 click 裡呼叫
      unlock() { try { ensure(); } catch (_) { /* 忽略 */ } },
      start() { tone(660, 0.12); tone(990, 0.14, 'sine', 0.06); }, // 開始：上揚兩聲
      stop() { tone(520, 0.16, 'triangle'); }, // 停止：一聲
      win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', i * 0.11)); }, // 成功：上行琶音
      lose() { [392, 330, 247].forEach((f, i) => tone(f, 0.32, 'sawtooth', i * 0.17, 0.06)); }, // 失敗：下行三聲
    };
  })();

  // 手機震動（只有 Android 支援，iOS 會自動忽略）
  const buzz = (pattern) => { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (_) { /* 忽略 */ } };

  // 螢幕常亮（Wake Lock API）：遊戲中防止手機自動熄屏
  const wake = {
    lock: null,
    async on() {
      if (this.lock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        this.lock = lock;
        // 切到後台時系統會自動釋放，這裡同步清掉紀錄，回到前台時再重新申請
        lock.addEventListener('release', () => { if (this.lock === lock) this.lock = null; });
      } catch (_) { /* 瀏覽器不允許：忽略 */ }
    },
    async off() {
      const lock = this.lock;
      this.lock = null;
      try { if (lock) await lock.release(); } catch (_) { /* 忽略 */ }
    },
  };

  // 計時中的外環旋轉動畫：速度和大小隨機變化，玩家無法靠「數圈數」來估算秒數
  const spin = (() => {
    const node = $('#spinner');
    let raf = 0; // requestAnimationFrame 的編號（0 = 沒在轉）
    let angle = 0; // 目前角度
    let speed = 0; // 目前轉速（度/秒）
    let targetSpeed = 0; // 正在逐漸接近的目標轉速
    let scale = 1; // 目前縮放
    let targetScale = 1; // 目標縮放
    let nextAt = 0; // 下次隨機換速度的時間
    let last = 0; // 上一幀的時間
    function frame(now) {
      const dt = clamp((now - last) / 1000, 0, 0.05); // 距離上一幀的秒數（上限 0.05，防止切回前台時暴衝）
      last = now;
      if (now >= nextAt) {
        // 每 0.25 ~ 1.35 秒隨機換一次目標轉速和大小
        targetSpeed = 110 + Math.random() * 520;
        targetScale = 0.97 + Math.random() * 0.07;
        nextAt = now + 250 + Math.random() * 1100;
      }
      // 平滑過渡到目標值，避免突然跳動
      const k = Math.min(1, dt * 4);
      speed += (targetSpeed - speed) * k;
      scale += (targetScale - scale) * k;
      angle = (angle + speed * dt) % 360;
      node.style.transform = `rotate(${angle.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      raf = requestAnimationFrame(frame);
    }
    return {
      start() {
        if (raf) return; // 已經在轉就不重複啟動
        last = performance.now();
        nextAt = 0;
        speed = 200;
        raf = requestAnimationFrame(frame);
      },
      stop() {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        node.style.transform = ''; // 交還給 CSS 的慢速勻速旋轉
      },
    };
  })();

  // 成功時的彩帶動畫（用 canvas 自己畫，不用外部函式庫）
  const confetti = (() => {
    const canvas = $('#confetti');
    const ctx = canvas.getContext('2d');
    const colors = ['#8b5cf6', '#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#ffffff'];
    let raf = 0;
    // 停止動畫並清空畫布
    function clear() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    // 噴出一次彩帶
    function burst() {
      clear();
      // 依螢幕像素密度設定畫布大小（最高 2 倍），高解析度螢幕上不會模糊
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = window.innerWidth;
      const H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // 160 片彩紙：從畫面中上方向四周噴出
      const parts = Array.from({ length: 160 }, (_, i) => ({
        x: W / 2 + (Math.random() - 0.5) * W * 0.3, // 位置
        y: H * 0.3,
        vx: (Math.random() - 0.5) * 15, // 速度
        vy: -4 - Math.random() * 14,
        w: 6 + Math.random() * 6, // 大小
        h: 8 + Math.random() * 8,
        r: Math.random() * Math.PI * 2, // 旋轉角度
        vr: (Math.random() - 0.5) * 0.4, // 旋轉速度
        c: colors[i % colors.length], // 顏色
      }));
      const DURATION = 3500; // 動畫總長（毫秒）
      const t0 = performance.now();
      let prev = t0;
      const frame = (now) => {
        // f = 相對 60fps 的幀倍數，讓 60Hz / 120Hz 螢幕上的速度一致
        const f = clamp((now - prev) / 16.67, 0, 3);
        prev = now;
        const age = now - t0;
        ctx.clearRect(0, 0, W, H);
        ctx.globalAlpha = clamp(1 - age / DURATION, 0, 1); // 逐漸淡出
        for (const p of parts) {
          p.vy += 0.35 * f; // 重力
          p.vx *= Math.pow(0.99, f); // 空氣阻力
          p.x += p.vx * f;
          p.y += p.vy * f;
          p.r += p.vr * f;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.r);
          ctx.fillStyle = p.c;
          // 高度隨角度變化，看起來像紙片在翻轉
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

  // ================================================================ 畫面切換
  const screens = {
    setup: $('#screen-setup'), // 設定頁
    game: $('#screen-game'), // 計時頁
    handover: $('#screen-handover'), // 交接頁
    reveal: $('#screen-reveal'), // 揭曉頁
  };
  let current = null; // 目前顯示的畫面名稱
  let armedAt = 0; // 在這個時間之前，畫面上的按鈕不接受點擊（防誤觸）
  let dialArmedAt = 0; // 在這個時間之前，計時按鈕不接受點擊（防連點）
  const armed = () => performance.now() >= armedAt;

  // 切換到指定畫面，並重新繪製該畫面的內容
  function show(name, opts = {}) {
    current = name;
    for (const [key, node] of Object.entries(screens)) node.classList.toggle('active', key === name);
    const now = performance.now();
    armedAt = now + GUARD.screen;
    dialArmedAt = now + 300;
    if (name !== 'reveal') stopReveal(); // 離開揭曉頁：停掉數字動畫和彩帶
    if (name !== 'game') spin.stop(); // 離開計時頁：停掉旋轉動畫
    // 設定頁、揭曉頁不需要常亮；遊戲中保持常亮
    if (name === 'setup' || name === 'reveal') wake.off();
    else wake.on();
    render[name](opts);
    window.scrollTo(0, 0);
  }

  // 套用目前語言：更新所有帶 data-i18n 屬性的元素文字
  function applyI18n() {
    document.documentElement.lang = settings.lang === 'zh' ? 'zh-CN' : 'en';
    document.title = t('docTitle');
    $$('[data-i18n]').forEach((node) => { node.textContent = t(node.dataset.i18n); });
    $('#rules-list').replaceChildren(...t('rules').map((r) => el('li', null, r)));
    $$('.quit').forEach((b) => b.setAttribute('aria-label', t('quit')));
  }

  // ---------------------------------------------------------------- 設定頁
  const playerList = $('#player-list');

  // 繪製玩家名單：每行 = 編號 + 名字輸入框 + 刪除按鈕
  function renderPlayers() {
    const n = settings.players.length;
    playerList.replaceChildren(...settings.players.map((name, i) => {
      const li = el('li', 'player');
      const input = el('input', 'p-input');
      input.type = 'text';
      input.maxLength = LIMITS.nameLen;
      input.value = name;
      input.placeholder = t('playerN', i + 1); // 沒填名字時顯示「玩家 N」
      input.autocomplete = 'off';
      input.enterKeyHint = i < n - 1 ? 'next' : 'done'; // 手機鍵盤的 Enter 鍵顯示「下一個 / 完成」
      input.dataset.i = String(i);
      input.setAttribute('aria-label', t('playerN', i + 1));
      const rm = el('button', 'p-remove', '×');
      rm.type = 'button';
      rm.dataset.i = String(i);
      rm.disabled = n <= 1; // 至少保留 1 位玩家
      rm.setAttribute('aria-label', `${t('remove')} ${t('playerN', i + 1)}`);
      li.append(el('span', 'p-badge', String(i + 1)), input, rm);
      return li;
    }));
    $('#player-count').textContent = String(n);
    $('#btn-add').disabled = n >= LIMITS.players; // 達到人數上限就不能再加
  }

  // 把目標時間、容差同步到輸入框
  function syncNumbers() {
    $('#in-target').value = fmtSec(settings.target);
    $('#in-tol').value = fmtSec(settings.tolerance);
  }

  // 繪製整個設定頁
  function renderSetup() {
    syncNumbers();
    $('#in-auto').checked = settings.autoReveal;
    $('#in-sound').checked = settings.sound;
    $('#btn-lang').textContent = settings.lang === 'zh' ? 'EN' : '中文'; // 按鈕顯示「要切換去」的語言
    renderPlayers();
    $('#stats').textContent = stats.played ? t('stats', stats.played, stats.won) : '';
  }

  // ---------------------------------------------------------------- 計時頁
  // 頂部的「目標 30s · ±3s」標籤（計時頁和交接頁都有）
  function renderGoal() {
    const text = t('goal', fmtSec(game.target), fmtSec(game.tol));
    $$('.goal').forEach((node) => { node.textContent = text; });
  }

  function renderGame() {
    const n = game.players.length;
    const done = game.segs.length; // 已完成幾棒
    renderGoal();
    // 自動揭曉模式顯示「第 2 / 4 棒」；循環模式只顯示「第 5 棒」
    $('#turn-label').textContent = game.auto ? t('legOf', done + 1, n) : t('leg', done + 1);
    $('#turn-name').textContent = game.players[done % n]; // 輪流：用取餘數決定輪到誰
    // 進度點：已完成 = 實心，當前 = 發光空心（只在自動揭曉模式顯示）
    const dots = $('#dots');
    dots.replaceChildren();
    if (game.auto) {
      for (let k = 0; k < n; k++) {
        dots.append(el('span', `dot${k < done ? ' done' : k === done ? ' now' : ''}`));
      }
    }
    // 計時按鈕：顯示「開始」或「停止」
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

  // ---------------------------------------------------------------- 交接頁
  function renderHandover() {
    const n = game.players.length;
    const last = game.segs[game.segs.length - 1]; // 剛完成的這一棒
    renderGoal();
    $('#done-text').textContent = t('done', game.players[last.p]);
    $('#next-name').textContent = game.players[game.segs.length % n]; // 下一位
    $('#btn-reveal').textContent = game.auto ? t('revealEarly') : t('revealNow');
  }

  // ---------------------------------------------------------------- 揭曉頁
  // 揭曉頁用到的元素和動畫狀態
  const rv = {
    screen: screens.reveal,
    time: $('#rv-time'), // 大數字
    marker: $('#rv-marker'), // 刻度條上的圓點
    zone: $('#rv-zone'), // 刻度條上的綠色成功區間
    tline: $('#rv-tline'), // 目標線
    labels: $('#rv-labels'), // 刻度條下方的數字
    segs: $('#rv-segs'), // 每棒用時列表
    raf: 0, // 數字滾動動畫的編號
    skip: false, // 玩家點了「跳過動畫」
    done: false, // 動畫是否已結束（結束後按鈕才可按）
    lo: 0, // 刻度條左端（百分之一秒）
    hi: 1, // 刻度條右端（百分之一秒）
  };
  // 把時間換算成刻度條上的位置（0 ~ 100%），超出範圍就停在兩端
  const scalePos = (cs) => clamp((cs - rv.lo) / (rv.hi - rv.lo), 0, 1) * 100;

  // 更新大數字和刻度條圓點的位置
  function setRevealTime(cs) {
    rv.time.textContent = fmtCs(cs);
    rv.marker.style.left = `${scalePos(cs)}%`;
  }

  // 排版刻度條：以目標為中心，左右各延伸 span
  function layoutScale() {
    const T = Math.round(game.target * 100);
    const tol = Math.round(game.tol * 100);
    // span 取以下最大值：容差的 2.5 倍、目標的 25%、1 秒
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
      // 綠色區間夠寬：顯示三個數字「27s 30s 33s」
      add(T - tol, `${fmtSec((T - tol) / 100)}s`);
      add(T, `${fmtSec(T / 100)}s`, 't');
      add(T + tol, `${fmtSec((T + tol) / 100)}s`);
    } else {
      // 區間太窄，三個數字會重疊：只在中間顯示「30s ±0.5」
      add(T, tol > 0 ? `${fmtSec(T / 100)}s ±${fmtSec(tol / 100)}` : `${fmtSec(T / 100)}s`, 't');
    }
  }

  // 填入勝負結果、差距、評語
  function fillResult(diffCs, win) {
    const ad = Math.abs(diffCs);
    const tolCs = Math.round(game.tol * 100);
    $('#rv-badge').textContent = win ? (ad === 0 ? t('perfect') : t('win')) : t('lose');
    $('#rv-diff').textContent = ad === 0 ? t('exact') : diffCs > 0 ? t('over', fmtCs(ad)) : t('under', fmtCs(ad));
    // 評語：贏了看有多準（0.2 秒內 = 神準）；輸了看差多少（超出容差 1 秒內 = 差一點）
    let quip;
    if (win) quip = ad === 0 ? t('quipPerfect') : ad <= 20 ? t('quipClose') : t('quipWin');
    else quip = ad - tolCs <= 100 ? t('quipNear') : t('quipFar');
    $('#rv-quip').textContent = quip;
  }

  // 填入每棒用時列表，並標出最短和最長的一棒
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
      if (list[minI].cs === list[maxI].cs) { minI = -1; maxI = -1; } // 全部一樣長就不標
    }
    let cum = 0; // 累計時間
    rv.segs.replaceChildren(...list.map((s, i) => {
      cum += s.cs;
      const li = el('li', 'seg');
      const name = el('div', 'seg-name');
      name.append(el('span', null, game.players[s.p]));
      if (i === minI) name.append(el('em', 'tag fast', t('fastest')));
      if (i === maxI) name.append(el('em', 'tag slow', t('slowest')));
      const time = el('div', 'seg-time', `+${fmtCs(s.cs)}s`); // 這一棒用時
      time.append(el('small', null, `Σ ${fmtCs(cum)}s`)); // 累計到這一棒的總時間
      li.append(el('span', 'p-badge', String(i + 1)), name, time);
      return li;
    }));
  }

  // 停止揭曉頁的所有動畫
  function stopReveal() {
    if (rv.raf) cancelAnimationFrame(rv.raf);
    rv.raf = 0;
    confetti.clear();
  }

  // 繪製揭曉頁。opts.animate = true 時播放數字滾動動畫；false 時直接顯示結果（例如刷新頁面後恢復）
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

    // 動畫結束：顯示結果、按鈕；withFx = 是否播放音效、彩帶、震動
    const finish = (withFx) => {
      setRevealTime(total);
      rv.screen.classList.add('revealed', win ? 'win' : 'lose');
      rv.done = true;
      armedAt = Math.max(armedAt, performance.now() + 400); // 按鈕出現後再等 0.4 秒才可按
      if (!withFx) return;
      if (win) { sfx.win(); confetti.burst(); buzz([40, 60, 40]); }
      else { sfx.lose(); buzz(160); }
    };

    if (!opts.animate) { finish(false); return; }
    setRevealTime(0);
    // 動畫長度 1.6 ~ 3.2 秒，總時間越長動畫越長
    const duration = clamp(1600 + total * 0.25, 1600, 3200);
    const t0 = performance.now();
    const step = (now) => {
      const p = rv.skip ? 1 : clamp((now - t0) / duration, 0, 1); // 進度 0 ~ 1
      const eased = 1 - Math.pow(1 - p, 4); // 緩動：越接近結尾越慢，製造緊張感
      setRevealTime(Math.round(total * eased));
      if (p < 1) rv.raf = requestAnimationFrame(step);
      else { rv.raf = 0; finish(true); }
    };
    rv.raf = requestAnimationFrame(step);
  }

  // 畫面名稱 → 對應的繪製函式
  const render = { setup: renderSetup, game: renderGame, handover: renderHandover, reveal: renderReveal };

  // ================================================================ 遊戲動作
  // 確認輸入框的數字：不合法就恢復原值，超出範圍就限制到上下限
  function commitNumber(input, key, lo, hi) {
    settings[key] = round1(clamp(toNum(input.value, settings[key]), lo, hi));
    input.value = fmtSec(settings[key]);
    saveSettings();
  }

  // 開新的一局：把目前設定複製一份到遊戲中（中途改設定不影響本局）
  function startGame() {
    game = {
      phase: 'ready',
      segs: [],
      startWall: 0,
      target: settings.target,
      tol: settings.tolerance,
      players: settings.players.map((p, i) => p.trim() || t('playerN', i + 1)), // 空名字換成「玩家 N」
      auto: settings.autoReveal,
      counted: false,
    };
    saveGame();
    sfx.unlock();
    show('game');
  }

  // 結束並刪除目前的遊戲
  function clearGame() {
    game = null;
    store.del(KEYS.game);
    spin.stop();
  }

  // 按下計時按鈕：準備中 → 開始計時；計時中 → 停止
  function dialAction() {
    if (!game || current !== 'game') return;
    const now = performance.now();
    if (now < dialArmedAt) return; // 防連點：距離上次按下不到 350ms 就忽略
    dialArmedAt = now + GUARD.dial;
    // 重新播放按下的縮放動畫（先移除 class，強制重排，再加回去）
    const dial = $('#dial');
    dial.classList.remove('pulse');
    void dial.offsetWidth;
    dial.classList.add('pulse');
    if (game.phase === 'ready') startLeg(now);
    else if (game.phase === 'running') stopLeg(now);
  }

  // 開始一棒：記下開始時間
  function startLeg(now) {
    startPerf = now; // 精準計時用（performance.now 不受修改系統時間影響）
    game.startWall = Date.now(); // 刷新頁面後恢復用
    game.phase = 'running';
    saveGame();
    sfx.start();
    buzz(12);
    renderGame();
  }

  // 停止一棒：算出用時並記錄
  function stopLeg(now) {
    const ms = Math.max(0, now - startPerf);
    game.segs.push({ p: game.segs.length % game.players.length, cs: Math.round(ms / 10) });
    game.startWall = 0;
    game.phase = 'handover';
    spin.stop();
    sfx.stop();
    buzz(25);
    if (game.auto && game.segs.length >= game.players.length) {
      reveal(); // 自動揭曉模式：最後一位已完成，直接揭曉
    } else {
      saveGame();
      show('handover');
    }
  }

  // 揭曉結果，並計入戰績（每局只計一次）
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

  // ================================================================ 事件綁定
  // ---------------------------------------------------------------- 設定頁
  // 切換語言
  $('#btn-lang').addEventListener('click', () => {
    settings.lang = settings.lang === 'zh' ? 'en' : 'zh';
    saveSettings();
    applyI18n();
    renderSetup();
  });

  // 「−」「+」按鈕：目標每次 ±1 秒，容差每次 ±0.5 秒
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

  // 直接在輸入框輸入數字：離開輸入框（change）時才確認，打字途中不打擾
  const inTarget = $('#in-target');
  const inTol = $('#in-tol');
  const commitTarget = () => commitNumber(inTarget, 'target', LIMITS.targetMin, LIMITS.targetMax);
  const commitTol = () => commitNumber(inTol, 'tolerance', LIMITS.tolMin, LIMITS.tolMax);
  inTarget.addEventListener('change', commitTarget);
  inTol.addEventListener('change', commitTol);
  [inTarget, inTol].forEach((input) => {
    input.addEventListener('focus', () => { try { input.select(); } catch (_) { /* 忽略 */ } }); // 點進去自動全選，方便直接改
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); }); // 按 Enter 確認
  });

  // 修改玩家名字（用事件委派：只在名單上綁一次，新增的輸入框也會生效）
  playerList.addEventListener('input', (e) => {
    const input = e.target;
    if (!input.classList.contains('p-input')) return;
    const i = Number(input.dataset.i);
    if (i >= 0 && i < settings.players.length) {
      settings.players[i] = input.value.slice(0, LIMITS.nameLen);
      saveSettings();
    }
  });
  // 在名字輸入框按 Enter：跳到下一位；最後一位就收起鍵盤
  playerList.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.classList.contains('p-input')) return;
    e.preventDefault();
    const inputs = $$('.p-input', playerList);
    const next = inputs[inputs.indexOf(e.target) + 1];
    if (next) next.focus();
    else e.target.blur();
  });
  // 刪除玩家
  playerList.addEventListener('click', (e) => {
    const btn = e.target.closest('.p-remove');
    if (!btn || settings.players.length <= 1) return;
    settings.players.splice(Number(btn.dataset.i), 1);
    saveSettings();
    renderPlayers();
  });
  // 新增玩家
  $('#btn-add').addEventListener('click', () => {
    if (settings.players.length >= LIMITS.players) return;
    settings.players.push('');
    saveSettings();
    renderPlayers();
  });

  // 開關：自動揭曉、音效
  $('#in-auto').addEventListener('change', (e) => { settings.autoReveal = e.target.checked; saveSettings(); });
  $('#in-sound').addEventListener('change', (e) => { settings.sound = e.target.checked; saveSettings(); });

  // 開始遊戲（先確認輸入框裡還沒確認的數字）
  $('#btn-start').addEventListener('click', () => {
    commitTarget();
    commitTol();
    startGame();
  });

  // ---------------------------------------------------------------- 計時頁
  // 計時按鈕用 pointerdown（手指一碰到就觸發），比 click 少約 100ms 延遲，計時更準
  const dialBtn = $('#dial');
  dialBtn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !e.isPrimary) return; // 只接受主要按鍵 / 第一根手指
    e.preventDefault();
    dialAction();
  });
  dialBtn.addEventListener('contextmenu', (e) => e.preventDefault()); // 防止長按跳出選單
  // 電腦上可以用空白鍵或 Enter 操作計時按鈕
  document.addEventListener('keydown', (e) => {
    if (current !== 'game' || e.repeat) return;
    if (e.target instanceof HTMLButtonElement && e.target !== dialBtn) return; // 焦點在其他按鈕（如退出）時不攔截
    if (e.code === 'Space' || e.key === 'Enter') {
      e.preventDefault();
      dialAction();
    }
  });
  document.addEventListener('touchstart', () => {}, { passive: true }); // 讓 iOS 的 :active 按下效果生效

  // 退出本局（需要確認）
  $$('.quit').forEach((btn) => btn.addEventListener('click', () => {
    if (!game) return;
    if (window.confirm(t('quitConfirm'))) {
      clearGame();
      show('setup');
    }
  }));

  // ---------------------------------------------------------------- 交接頁
  // 「我準備好了」：輪到下一位
  $('#btn-ready').addEventListener('click', () => {
    if (!armed() || !game || game.phase !== 'handover') return;
    game.phase = 'ready';
    saveGame();
    sfx.unlock();
    show('game');
  });
  // 「結束並揭曉 / 提前揭曉」
  $('#btn-reveal').addEventListener('click', () => {
    if (!armed() || !game || game.phase !== 'handover') return;
    sfx.unlock();
    reveal();
  });

  // ---------------------------------------------------------------- 揭曉頁
  // 動畫播放中點任何地方 = 跳過動畫
  rv.screen.addEventListener('pointerdown', () => { if (!rv.done) rv.skip = true; });
  // 再來一局（沿用相同設定）
  $('#btn-again').addEventListener('click', () => {
    if (!armed() || !rv.done) return;
    startGame();
  });
  // 回到設定頁
  $('#btn-settings').addEventListener('click', () => {
    if (!armed() || !rv.done) return;
    clearGame();
    show('setup');
  });

  // 從後台切回來時，重新申請螢幕常亮
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (current === 'game' || current === 'handover')) wake.on();
  });

  // ================================================================ 啟動
  applyI18n();
  if (game) {
    // 有未完成的遊戲（例如刷新了頁面）：回到對應的畫面
    const screen = game.phase === 'reveal' ? 'reveal' : game.phase === 'handover' ? 'handover' : 'game';
    show(screen, { animate: false });
  } else {
    show('setup');
  }

  // 給自動化測試用的介面（不影響遊戲）
  window.__vx = { judge, state: () => ({ screen: current, game, settings, stats }) };
})();
