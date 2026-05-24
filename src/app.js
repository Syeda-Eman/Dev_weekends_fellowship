/**
 * FOCUS — Pomodoro Timer
 * app.js — all logic: timer, history, settings, audio, UI state
 */

(() => {
  'use strict';

  /* ── Constants ─────────────────────────── */
  const CIRCUMFERENCE = 2 * Math.PI * 148; // ring radius = 148
  const STORAGE_KEY   = 'focus_pomodoro_v2';
  const TODAY_KEY     = 'focus_pomodoro_date';
  const OVERLAY_DURATION_MS = 2000;

  /* ── State ──────────────────────────────── */
  let focusMins  = 25;
  let breakMins  = 5;
  let phase      = 'focus';   // 'focus' | 'break'
  let status     = 'idle';    // 'idle' | 'running' | 'paused'
  let totalSecs  = focusMins * 60;
  let remainSecs = totalSecs;
  let tickerId   = null;

  /* ── DOM refs ───────────────────────────── */
  const $  = id => document.getElementById(id);
  const el = {
    app:             $('app'),
    statusDot:       $('statusDot'),
    sessionLabel:    $('sessionLabel'),
    ringWrap:        $('ringWrap'),
    ringProgress:    $('ringProgress'),
    ringPulse:       $('ringPulse'),
    timerDisplay:    $('timerDisplay'),
    timerPhase:      $('timerPhase'),
    btnStart:        $('btnStart'),
    btnStartLabel:   $('btnStartLabel'),
    btnReset:        $('btnReset'),
    btnSettings:     $('btnSettings'),
    settingsPanel:   $('settingsPanel'),
    focusInput:      $('focusInput'),
    breakInput:      $('breakInput'),
    btnApply:        $('btnApply'),
    completionFlash: $('completionFlash'),
    doneOverlay:     $('doneOverlay'),
    doneTitle:       $('doneTitle'),
    doneSub:         $('doneSub'),
    historyList:     $('historyList'),
    historyCount:    $('historyCount'),
    historyEmpty:    $('historyEmpty'),
  };

  /* ── Audio ──────────────────────────────── */
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function playDone(isBreakEnd = false) {
    try {
      const ctx = getAudioCtx();
      const now = ctx.currentTime;

      // Three-note chime: 880 → 1108 → 1318 (A5, C#6, E6)
      const freqs = isBreakEnd
        ? [659, 523, 392]   // break end: descending (E5, C5, G4) — softer prompt
        : [880, 1108, 1318]; // focus end: ascending major chord

      freqs.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.15);

        const t0 = now + i * 0.15;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(0.22, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.65);

        osc.start(t0);
        osc.stop(t0 + 0.7);
      });
    } catch (e) {
      // Audio not available — silent fallback
    }
  }

  function playTick() {
    try {
      const ctx = getAudioCtx();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.value = 1200;
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch (e) { /* silent */ }
  }

  /* ── Timer ring SVG ticks ───────────────── */
  function buildTickMarks() {
    const g   = el.ringWrap.querySelector('#tickMarks');
    const cx  = 170, cy = 170, r = 148;
    const num = 60;
    for (let i = 0; i < num; i++) {
      const angle = (i / num) * 2 * Math.PI - Math.PI / 2;
      const isMajor = i % 5 === 0;
      const inner   = isMajor ? r - 10 : r - 5;
      const outer   = r;
      const x1 = cx + inner * Math.cos(angle);
      const y1 = cy + inner * Math.sin(angle);
      const x2 = cx + outer * Math.cos(angle);
      const y2 = cy + outer * Math.sin(angle);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1.toFixed(2));
      line.setAttribute('y1', y1.toFixed(2));
      line.setAttribute('x2', x2.toFixed(2));
      line.setAttribute('y2', y2.toFixed(2));
      line.setAttribute('stroke-width', isMajor ? '2' : '1');
      g.appendChild(line);
    }
  }

  /* ── Format ─────────────────────────────── */
  function fmt(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function fmtTime12(date) {
    let h = date.getHours(), m = date.getMinutes();
    const ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return `${h}:${m.toString().padStart(2, '0')}${ampm}`;
  }

  /* ── Ring progress ──────────────────────── */
  function setRingProgress(fraction) {
    // fraction 1 = full ring, 0 = empty
    const offset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, fraction)));
    el.ringProgress.style.strokeDashoffset = offset.toFixed(2);
  }

  /* ── UI state update ────────────────────── */
  function applyPhaseClass(element, focusCls, breakCls, pausedCls) {
    element.classList.remove('focus', 'break', 'paused', 'focus-phase', 'break-phase', 'paused-phase',
      'running', 'break-running', focusCls, breakCls, pausedCls);
    if (status === 'paused') {
      element.classList.add(pausedCls || 'paused');
    } else if (phase === 'break') {
      element.classList.add(breakCls || 'break');
    } else {
      if (status === 'running') element.classList.add(focusCls || 'focus');
    }
  }

  function updateUI() {
    // display
    el.timerDisplay.textContent = fmt(remainSecs);

    // ring
    const fraction = remainSecs / totalSecs;
    setRingProgress(fraction);

    // ring color
    el.ringProgress.classList.remove('break-phase', 'paused-phase');
    if (status === 'paused') {
      el.ringProgress.classList.add('paused-phase');
    } else if (phase === 'break') {
      el.ringProgress.classList.add('break-phase');
    }

    // timer display color
    el.timerDisplay.classList.remove('break-phase', 'paused-phase');
    if (status === 'paused') el.timerDisplay.classList.add('paused-phase');
    else if (phase === 'break') el.timerDisplay.classList.add('break-phase');

    // phase label
    el.timerPhase.classList.remove('focus', 'break', 'paused');
    if (status === 'paused')       el.timerPhase.classList.add('paused');
    else if (phase === 'break')    el.timerPhase.classList.add('break');
    else if (status === 'running') el.timerPhase.classList.add('focus');

    const phaseText = status === 'paused'
      ? 'PAUSED'
      : phase === 'break' ? 'BREAK' : 'FOCUS';
    el.timerPhase.textContent = phaseText;

    // session label
    el.sessionLabel.className = 'session-label';
    el.sessionLabel.textContent = status === 'idle'
      ? 'READY'
      : status === 'paused'
        ? 'PAUSED'
        : phase === 'break' ? 'ON BREAK' : 'FOCUSING';

    if (status === 'running' && phase === 'focus') el.sessionLabel.classList.add('focus');
    else if (status === 'running' && phase === 'break') el.sessionLabel.classList.add('break');
    else if (status === 'paused') el.sessionLabel.classList.add('paused');

    // status dot
    el.statusDot.className = 'logo-dot';
    if (status === 'running' && phase === 'focus') el.statusDot.classList.add('running');
    else if (status === 'running' && phase === 'break') el.statusDot.classList.add('break-running');
    else if (status === 'paused') el.statusDot.classList.add('paused');

    // ring wrap ambient
    el.ringWrap.className = 'ring-wrap';
    if (status === 'running' && phase === 'focus') el.ringWrap.classList.add('state-focus');
    else if (status === 'running' && phase === 'break') el.ringWrap.classList.add('state-break');
    else if (status === 'paused') el.ringWrap.classList.add('state-paused');
    else el.ringWrap.classList.add('state-idle');

    // start button
    const isRunning = status === 'running';
    el.btnStart.querySelector('.btn-icon-play').style.display  = isRunning ? 'none' : 'inline';
    el.btnStart.querySelector('.btn-icon-pause').style.display = isRunning ? 'inline' : 'none';
    el.btnStartLabel.textContent = isRunning ? 'PAUSE' : (status === 'paused' ? 'RESUME' : 'START');
    el.btnStart.setAttribute('aria-label', isRunning ? 'Pause timer' : (status === 'paused' ? 'Resume timer' : 'Start timer'));

    el.btnStart.classList.remove('break-mode');
    if (phase === 'break') el.btnStart.classList.add('break-mode');

    // document title
    document.title = status === 'idle'
      ? 'FOCUS — Pomodoro'
      : `${fmt(remainSecs)} · ${phaseText} — FOCUS`;
  }

  /* ── Timer logic ────────────────────────── */
  function tick() {
    if (remainSecs <= 0) {
      onCycleEnd();
      return;
    }
    remainSecs--;
    updateUI();
  }

  function startTimer() {
    if (tickerId) return;
    tickerId = setInterval(tick, 1000);
    status = 'running';
    updateUI();
  }

  function pauseTimer() {
    clearInterval(tickerId);
    tickerId = null;
    status = 'paused';
    updateUI();
  }

  function resetTimer() {
    clearInterval(tickerId);
    tickerId = null;
    phase      = 'focus';
    status     = 'idle';
    totalSecs  = focusMins * 60;
    remainSecs = totalSecs;
    updateUI();
  }

  function onCycleEnd() {
    clearInterval(tickerId);
    tickerId = null;

    if (phase === 'focus') {
      // Record the completed focus session
      recordSession(focusMins * 60);
      playDone(false);
      showCompletionFlash(false);
      showDoneOverlay('FOCUS COMPLETE', 'BREAK STARTING NOW');

      setTimeout(() => {
        hideDoneOverlay();
        // transition to break
        phase      = 'break';
        status     = 'running';
        totalSecs  = breakMins * 60;
        remainSecs = totalSecs;
        updateUI();
        tickerId   = setInterval(tick, 1000);
      }, OVERLAY_DURATION_MS);

    } else {
      // break ended
      playDone(true);
      showCompletionFlash(true);
      showDoneOverlay('BREAK OVER', 'READY FOR NEXT SESSION');

      setTimeout(() => {
        hideDoneOverlay();
        phase      = 'focus';
        status     = 'idle';
        totalSecs  = focusMins * 60;
        remainSecs = totalSecs;
        updateUI();
      }, OVERLAY_DURATION_MS);
    }

    pulsateRing();
    updateUI();
  }

  /* ── Completion visual ──────────────────── */
  function showCompletionFlash(isBreak) {
    el.completionFlash.classList.remove('fire', 'break-flash');
    if (isBreak) el.completionFlash.classList.add('break-flash');
    // force reflow
    void el.completionFlash.offsetWidth;
    el.completionFlash.classList.add('fire');
  }

  function pulsateRing() {
    el.ringPulse.classList.remove('fire');
    void el.ringPulse.offsetWidth;
    el.ringPulse.classList.add('fire');
  }

  function showDoneOverlay(title, sub) {
    el.doneTitle.textContent  = title;
    el.doneSub.textContent    = sub;
    el.doneOverlay.hidden = false;
    el.doneOverlay.removeAttribute('hidden');
  }

  function hideDoneOverlay() {
    el.doneOverlay.hidden = true;
  }

  /* ── History (localStorage) ─────────────── */
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  function loadHistory() {
    const storedDate = localStorage.getItem(TODAY_KEY);
    if (storedDate !== todayStr()) {
      // New day — clear
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(TODAY_KEY, todayStr());
      return [];
    }
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { return []; }
  }

  function saveHistory(history) {
    localStorage.setItem(TODAY_KEY, todayStr());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }

  function recordSession(durationSecs) {
    const history = loadHistory();
    history.unshift({
      duration: durationSecs,
      time: Date.now(),
    });
    saveHistory(history);
    renderHistory(history);
  }

  function renderHistory(history) {
    if (!history) history = loadHistory();

    const count = history.length;
    el.historyCount.textContent = `${count} session${count !== 1 ? 's' : ''}`;

    if (count === 0) {
      el.historyEmpty.style.display = '';
      // Clear any existing items except empty message
      Array.from(el.historyList.querySelectorAll('.history-item')).forEach(n => n.remove());
      return;
    }

    el.historyEmpty.style.display = 'none';
    // Clear and re-render
    Array.from(el.historyList.querySelectorAll('.history-item')).forEach(n => n.remove());

    history.forEach(entry => {
      const li   = document.createElement('li');
      li.className = 'history-item';
      li.setAttribute('role', 'listitem');

      const duration = fmt(entry.duration);
      const timeStr  = fmtTime12(new Date(entry.time));

      li.innerHTML = `
        <span class="check" aria-hidden="true">✓</span>
        <span class="duration">${duration}</span>
        <span class="type">focus</span>
        <span class="time" aria-label="at ${timeStr}">${timeStr}</span>
      `;
      li.setAttribute('aria-label', `Completed ${duration} focus session at ${timeStr}`);
      el.historyList.appendChild(li);
    });
  }

  /* ── Settings ───────────────────────────── */
  function openSettings() {
    const isOpen = !el.settingsPanel.hidden;
    el.settingsPanel.hidden = isOpen;
    el.btnSettings.setAttribute('aria-expanded', String(!isOpen));
    if (!isOpen) {
      el.focusInput.focus();
    }
  }

  function applySettings() {
    const f = parseInt(el.focusInput.value, 10);
    const b = parseInt(el.breakInput.value, 10);
    if (!f || !b || f < 1 || b < 1 || f > 99 || b > 99) return;
    focusMins = f;
    breakMins = b;
    el.settingsPanel.hidden = true;
    el.btnSettings.setAttribute('aria-expanded', 'false');
    if (status !== 'running') {
      resetTimer();
    }
  }

  /* ── Steppers ───────────────────────────── */
  document.querySelectorAll('.stepper').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      const delta  = parseInt(btn.dataset.delta, 10);
      const cur    = parseInt(target.value, 10) || 1;
      const next   = Math.max(1, Math.min(99, cur + delta));
      target.value = next;
    });
  });

  /* ── Button handlers ────────────────────── */
  el.btnStart.addEventListener('click', () => {
    if (status === 'running') pauseTimer();
    else startTimer();
  });

  el.btnReset.addEventListener('click', resetTimer);
  el.btnSettings.addEventListener('click', openSettings);
  el.btnApply.addEventListener('click', applySettings);

  // Close settings if clicking outside
  document.addEventListener('click', e => {
    if (!el.settingsPanel.hidden &&
        !el.settingsPanel.contains(e.target) &&
        !el.btnSettings.contains(e.target)) {
      el.settingsPanel.hidden = true;
      el.btnSettings.setAttribute('aria-expanded', 'false');
    }
  });

  // Keyboard: Space = start/pause, R = reset
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
    if (e.code === 'Space') { e.preventDefault(); el.btnStart.click(); }
    if (e.code === 'KeyR')  { resetTimer(); }
  });

  // Click overlay to dismiss early
  el.doneOverlay.addEventListener('click', () => {
    if (!el.doneOverlay.hidden) hideDoneOverlay();
  });

  // Escape closes settings
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !el.settingsPanel.hidden) {
      el.settingsPanel.hidden = true;
      el.btnSettings.setAttribute('aria-expanded', 'false');
      el.btnSettings.focus();
    }
  });

  /* ── Settings input validation ──────────── */
  [el.focusInput, el.breakInput].forEach(inp => {
    inp.addEventListener('change', () => {
      let v = parseInt(inp.value, 10);
      if (isNaN(v) || v < 1) v = 1;
      if (v > 99) v = 99;
      inp.value = v;
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') applySettings();
    });
  });

  /* ── Init ───────────────────────────────── */
  function init() {
    buildTickMarks();
    el.ringProgress.style.strokeDasharray = CIRCUMFERENCE;
    el.ringProgress.style.strokeDashoffset = '0';
    el.ringPulse.style.strokeDasharray = CIRCUMFERENCE;
    el.ringPulse.style.strokeDashoffset = '0';
    resetTimer();
    renderHistory();
  }

  init();

})();
// audio: chime chord implementation
// audio: chime chord implementation
