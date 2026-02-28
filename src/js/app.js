// ===== MAIN APP =====
window.LyricSync = window.LyricSync || {};

const App = (() => {
  const { Utils, Audio, LyricsParser, TimingEngine, Exporter } = window.LyricSync;
  const el = Utils.el;

  let currentScreen = 0;
  let parsed = null;
  let selectedSpeed = 0.75;
  let selectedExportFormat = 'per-word-srt';

  const screens = ['Import', 'Lyrics', 'Timing', 'Preview', 'Export'];
  const completedScreens = new Set();

  function logEvent(level, message, meta = null) {
    if (!window.api?.appendLog) return;
    window.api.appendLog({ level, message, meta }).catch(() => {});
  }

  // ===== INIT =====
  function init() {
    if (window.api?.getLogPath) {
      window.api.getLogPath().then((logPath) => {
        logEvent('INFO', 'renderer init', { logPath });
      }).catch(() => {});
    }
    window.addEventListener('error', (ev) => {
      logEvent('ERROR', 'renderer window error', { message: ev.message, filename: ev.filename, lineno: ev.lineno });
    });
    window.addEventListener('unhandledrejection', (ev) => {
      logEvent('ERROR', 'renderer unhandled rejection', { reason: String(ev.reason) });
    });

    renderTitlebar();
    renderHeader();
    renderContent();
    goToScreen(0);
  }

  // ===== TITLEBAR =====
  function renderTitlebar() {
    const titlebar = document.getElementById('titlebar');
    titlebar.innerHTML = '';
    titlebar.appendChild(el('div', { className: 'titlebar-title', innerHTML: 'LYRIC<span>SYNC</span>' }));
    const controls = el('div', { className: 'titlebar-controls' });
    controls.appendChild(el('button', { className: 'titlebar-btn', textContent: '─', onClick: () => window.api.minimize() }));
    controls.appendChild(el('button', { className: 'titlebar-btn', textContent: '□', onClick: () => window.api.maximize() }));
    controls.appendChild(el('button', { className: 'titlebar-btn close', textContent: '✕', onClick: () => window.api.close() }));
    titlebar.appendChild(controls);
  }

  // ===== HEADER =====
  function renderHeader() {
    const header = document.getElementById('header');
    header.innerHTML = '';

    const brand = el('div', { className: 'header-brand' });
    brand.appendChild(el('div', { className: 'header-logo', textContent: 'L' }));
    const text = el('div', { className: 'header-text' });
    text.appendChild(el('h1', { innerHTML: 'LYRIC<span>SYNC</span>' }));
    text.appendChild(el('p', { textContent: 'PER-WORD SRT GENERATOR' }));
    brand.appendChild(text);
    header.appendChild(brand);

    const nav = el('div', { className: 'screen-nav' });
    screens.forEach((name, i) => {
      const isCompleted = completedScreens.has(i);
      const isActive = i === currentScreen;
      let cls = 'nav-btn';
      if (isActive) cls += ' active';
      if (isCompleted) cls += ' completed';

      const stepContent = isCompleted ? '✓' : String(i + 1);
      const btn = el('button', { className: cls, onClick: () => goToScreen(i) }, [
        el('span', { className: 'nav-step', textContent: stepContent }),
        document.createTextNode(' ' + name),
      ]);
      nav.appendChild(btn);
    });
    header.appendChild(nav);
  }

  // ===== SCREEN NAVIGATION =====
  function goToScreen(index) {
    currentScreen = index;
    renderHeader();
    renderContent();
  }

  function renderContent() {
    const content = document.getElementById('content');
    content.innerHTML = '';
    content.scrollTop = 0;

    const screenDiv = el('div', { className: 'screen' });
    switch (currentScreen) {
      case 0: renderImportScreen(screenDiv); break;
      case 1: renderLyricsScreen(screenDiv); break;
      case 2: renderTimingScreen(screenDiv); break;
      case 3: renderPreviewScreen(screenDiv); break;
      case 4: renderExportScreen(screenDiv); break;
    }
    content.appendChild(screenDiv);
  }

  // ===========================================================
  // SCREEN 1: IMPORT
  // ===========================================================
  function renderImportScreen(container) {
    const title = el('div', { className: 'screen-title' });
    title.appendChild(el('h2', { innerHTML: 'Import Your <span class="gradient">Track</span>' }));
    title.appendChild(el('p', { textContent: 'Drop an audio file or click to browse — MP3, WAV, FLAC, OGG' }));
    container.appendChild(title);

    // Drop zone
    const dropzone = el('div', { className: 'dropzone', id: 'dropzone' });
    const dzIcon = el('div', { className: 'dropzone-icon', textContent: '🎵' });
    dropzone.appendChild(dzIcon);
    dropzone.appendChild(el('h3', { textContent: 'Drag & drop your audio file' }));
    dropzone.appendChild(el('p', { textContent: 'or click to browse files' }));

    dropzone.addEventListener('click', handleFileOpen);
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) handleDroppedFile(file);
    });

    container.appendChild(dropzone);

    // File info card (shown after loading)
    const fileCard = el('div', { className: 'card', id: 'file-card', style: { marginTop: '24px', display: 'none' } });
    container.appendChild(fileCard);

    // Continue button
    const btnWrap = el('div', { className: 'center mt-32' });
    const continueBtn = el('button', {
      className: 'btn btn-primary btn-lg',
      textContent: 'Continue to Lyrics →',
      id: 'import-continue',
      style: { display: 'none' },
      onClick: () => { completedScreens.add(0); goToScreen(1); },
    });
    btnWrap.appendChild(continueBtn);
    container.appendChild(btnWrap);

    // If audio is already loaded, show the info
    if (Audio.getFileInfo()) {
      showFileLoaded();
    }
  }

  async function handleFileOpen() {
    try {
      const fileData = await window.api.openAudioFile();
      if (!fileData) return;
      logEvent('INFO', 'handleFileOpen selected', { name: fileData.name, size: fileData.size, path: fileData.path });
      await Audio.loadFile(fileData);
      showFileLoaded();
      logEvent('INFO', 'handleDroppedFile loaded', { name: fileData.name });
    } catch (e) {
      logEvent('ERROR', 'handleFileOpen failed', { error: String(e) });
      console.error('Audio load failed:', e);
      alert('Could not load that audio file. Please try another format or file.');
    }
  }

  async function handleDroppedFile(file) {
    // Electron gives a .path property on dropped files
    const fileData = {
      name: file.name,
      path: file.path || file.name,
      size: file.size,
    };
    try {
      logEvent('INFO', 'handleDroppedFile selected', { name: fileData.name, size: fileData.size, path: fileData.path });
      await Audio.loadFile(fileData);
      showFileLoaded();
      logEvent('INFO', 'handleFileOpen loaded', { name: fileData.name });
    } catch (e) {
      logEvent('ERROR', 'handleDroppedFile failed', { error: String(e), name: fileData.name });
      console.error('Drop load failed:', e);
    }
  }

  function showFileLoaded() {
    const info = Audio.getFileInfo();
    if (!info) return;

    const card = document.getElementById('file-card');
    if (!card) return;
    card.style.display = 'block';
    card.innerHTML = '';

    // File info row
    const row = el('div', { className: 'file-info' });
    const left = el('div', { className: 'file-info-left' });
    left.appendChild(el('div', { className: 'file-icon', textContent: '♪' }));
    const details = el('div');
    details.appendChild(el('div', { className: 'file-name', textContent: info.name }));
    const meta = [
      Utils.toMMSS(info.duration),
      info.sampleRate ? (info.sampleRate / 1000).toFixed(1) + 'kHz' : '',
      Utils.formatSize(info.size),
    ].filter(Boolean).join(' · ');
    details.appendChild(el('div', { className: 'file-meta', textContent: meta }));
    left.appendChild(details);
    row.appendChild(left);
    row.appendChild(el('div', { className: 'file-badge', textContent: '✓ Loaded' }));
    card.appendChild(row);

    // Waveform
    const waveWrap = el('div', { className: 'waveform-container', id: 'waveform-import' });
    const canvas = el('canvas', { id: 'waveform-canvas' });
    const playhead = el('div', { className: 'waveform-playhead', id: 'waveform-playhead' });
    waveWrap.appendChild(canvas);
    waveWrap.appendChild(playhead);
    waveWrap.addEventListener('click', (e) => {
      const rect = waveWrap.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      Audio.seek(pct * Audio.getDuration());
    });
    card.appendChild(waveWrap);

    // Time display
    const timeRow = el('div', { className: 'waveform-time' });
    timeRow.appendChild(el('span', { textContent: '0:00' }));
    timeRow.appendChild(el('span', { id: 'import-time', textContent: `0:00 / ${Utils.toMMSS(info.duration)}` }));
    timeRow.appendChild(el('span', { textContent: Utils.toMMSS(info.duration) }));
    card.appendChild(timeRow);

    // Playback controls
    const playbar = el('div', { className: 'playback-bar' });
    const playBtn = el('button', { className: 'play-btn', id: 'import-play-btn', textContent: '▶' });
    playBtn.addEventListener('click', () => {
      if (Audio.isPlaying()) {
        Audio.pause();
        playBtn.textContent = '▶';
      } else {
        Audio.play();
        playBtn.textContent = '⏸';
      }
    });
    playbar.appendChild(playBtn);
    const timeLabel = el('span', { className: 'playback-time', id: 'import-time-label', textContent: `0:00 / ${Utils.toMMSS(info.duration)}` });
    playbar.appendChild(timeLabel);
    const progressWrap = el('div', { className: 'playback-progress' });
    const progressFill = el('div', { className: 'playback-progress-fill', id: 'import-progress' });
    progressWrap.appendChild(progressFill);
    progressWrap.addEventListener('click', (e) => {
      const rect = progressWrap.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      Audio.seek(pct * Audio.getDuration());
    });
    playbar.appendChild(progressWrap);
    card.appendChild(playbar);

    // Draw waveform
    requestAnimationFrame(() => drawWaveform('waveform-canvas'));
    Audio.setOnWaveformReady(() => {
      requestAnimationFrame(() => drawWaveform('waveform-canvas'));
    });

    // Time update handler for import screen
    Audio.setOnTimeUpdate((time) => {
      const dur = Audio.getDuration();
      const pct = dur > 0 ? (time / dur) * 100 : 0;
      const progress = document.getElementById('import-progress');
      if (progress) progress.style.width = pct + '%';
      const label = document.getElementById('import-time-label');
      if (label) label.textContent = `${Utils.toMMSS(time)} / ${Utils.toMMSS(dur)}`;
      const ph = document.getElementById('waveform-playhead');
      if (ph) ph.style.left = pct + '%';
    });

    Audio.setOnEnded(() => {
      const btn = document.getElementById('import-play-btn');
      if (btn) btn.textContent = '▶';
    });

    // Show continue button
    const continueBtn = document.getElementById('import-continue');
    if (continueBtn) continueBtn.style.display = 'inline-flex';

    // Hide dropzone
    const dz = document.getElementById('dropzone');
    if (dz) dz.style.display = 'none';
  }

  function drawWaveform(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    const ctx = canvas.getContext('2d');
    const peaks = Audio.getWaveformPeaks(Math.floor(canvas.width / 5));

    const barWidth = 3;
    const gap = 2;
    const centerY = canvas.height / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    peaks.forEach((peak, i) => {
      const x = i * (barWidth + gap);
      const h = Math.max(2, peak * canvas.height * 0.85);

      const grad = ctx.createLinearGradient(0, centerY - h / 2, 0, centerY + h / 2);
      grad.addColorStop(0, '#785aff');
      grad.addColorStop(1, '#a855f7');

      ctx.fillStyle = grad;
      ctx.fillRect(x, centerY - h / 2, barWidth, h);
    });
  }

  // ===========================================================
  // SCREEN 2: LYRICS
  // ===========================================================
  function renderLyricsScreen(container) {
    const title = el('div', { className: 'screen-title' });
    title.appendChild(el('h2', { innerHTML: 'Paste Your <span class="gradient">Lyrics</span>' }));
    title.appendChild(el('p', { textContent: 'Each line preserved · Double newline = section break · Per-word timing applied' }));
    container.appendChild(title);

    const card = el('div', { className: 'card' });

    // Stats
    const stats = el('div', { className: 'lyrics-stats', id: 'lyrics-stats' });
    stats.innerHTML = `
      <div class="lyrics-stat"><span class="label">Words: </span><span class="value" id="stat-words">0</span></div>
      <div class="lyrics-stat"><span class="label">Lines: </span><span class="value" id="stat-lines">0</span></div>
      <div class="lyrics-stat"><span class="label">Blocks: </span><span class="value" id="stat-blocks">0</span></div>
    `;
    card.appendChild(stats);

    // Textarea
    const textarea = el('textarea', {
      className: 'lyrics-textarea',
      id: 'lyrics-input',
      placeholder: 'Paste or type lyrics here...\n\nEach line will be preserved.\nDouble newlines create block breaks.\n\nBlock 2 starts here...',
    });
    // Restore previous text if exists
    if (parsed) {
      let text = '';
      parsed.blocks.forEach((block, bi) => {
        if (bi > 0) text += '\n\n';
        block.lines.forEach((line, li) => {
          if (li > 0) text += '\n';
          text += line.words.map(w => w.text).join(' ');
        });
      });
      textarea.value = text;
    }
    textarea.addEventListener('input', updateLyricsStats);
    card.appendChild(textarea);

    // Footer
    const footer = el('div', { className: 'lyrics-footer' });
    footer.appendChild(el('div', { className: 'lyrics-tip', textContent: '💡 Each word gets its own timestamp in the SRT' }));
    const startBtn = el('button', {
      className: 'btn btn-primary',
      textContent: 'Start Timing →',
      onClick: () => {
        const text = document.getElementById('lyrics-input').value;
        parsed = LyricsParser.parse(text);
        if (!parsed || parsed.totalWords === 0) {
          alert('Please enter some lyrics first!');
          return;
        }
        completedScreens.add(1);
        goToScreen(2);
      },
    });
    footer.appendChild(startBtn);
    card.appendChild(footer);
    container.appendChild(card);

    // Trigger initial stats
    requestAnimationFrame(updateLyricsStats);
  }

  function updateLyricsStats() {
    const text = document.getElementById('lyrics-input')?.value || '';
    const temp = LyricsParser.parse(text);
    document.getElementById('stat-words').textContent = temp ? temp.totalWords : 0;
    document.getElementById('stat-lines').textContent = temp ? temp.totalLines : 0;
    document.getElementById('stat-blocks').textContent = temp ? temp.totalBlocks : 0;
  }

  // ===========================================================
  // SCREEN 3: TIMING
  // ===========================================================
  let timingStarted = false;
  let timingComplete = false;

  function renderTimingScreen(container) {
    if (!parsed) {
      container.appendChild(el('p', { textContent: 'Please load audio and enter lyrics first.', style: { color: 'var(--text-dim)', textAlign: 'center', marginTop: '60px' } }));
      return;
    }
    if (!Audio.getFileInfo()) {
      container.appendChild(el('p', { textContent: 'Please load an audio file first.', style: { color: 'var(--text-dim)', textAlign: 'center', marginTop: '60px' } }));
      container.appendChild(el('div', { className: 'center mt-16' }, [
        el('button', { className: 'btn btn-primary', textContent: '← Go to Import', onClick: () => goToScreen(0) })
      ]));
      return;
    }

    timingStarted = false;
    timingComplete = false;

    // Initialize timing engine
    TimingEngine.init(parsed);

    // Header with speed controls
    const header = el('div', { className: 'timing-header' });
    const headerLeft = el('div', { className: 'timing-header-left' });
    headerLeft.appendChild(el('h2', { textContent: 'Timing Editor' }));
    headerLeft.appendChild(el('p', { id: 'timing-progress-label', textContent: `Word 1 of ${parsed.totalWords} · Block 1` }));
    header.appendChild(headerLeft);

    const speedWrap = el('div', { className: 'speed-controls' });
    speedWrap.appendChild(el('span', { className: 'speed-label', textContent: 'SPEED' }));
    [0.5, 0.75, 1.0, 1.25].forEach(spd => {
      const btn = el('button', {
        className: `speed-btn ${spd === selectedSpeed ? 'active' : ''}`,
        textContent: spd + '×',
        onClick: () => {
          selectedSpeed = spd;
          Audio.setRate(spd);
          document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        },
      });
      speedWrap.appendChild(btn);
    });
    header.appendChild(speedWrap);
    container.appendChild(header);

    // Main timing display
    const display = el('div', { className: 'timing-display', id: 'timing-display' });
    display.appendChild(el('div', { className: 'timing-glow' }));

    // Completed words
    display.appendChild(el('div', { className: 'timing-section-label', textContent: 'COMPLETED' }));
    display.appendChild(el('div', { className: 'timing-completed', id: 'timing-completed' }));

    // Current word
    display.appendChild(el('div', { className: 'timing-current-word', id: 'timing-current', textContent: parsed.flatWords[0]?.text || '' }));

    // Hold bar
    const holdBar = el('div', { className: 'hold-bar' });
    holdBar.appendChild(el('div', { className: 'hold-bar-fill', id: 'hold-bar-fill' }));
    display.appendChild(holdBar);

    // Coming up
    display.appendChild(el('div', { className: 'timing-section-label', textContent: 'COMING UP' }));
    const upcoming = el('div', { className: 'timing-upcoming', id: 'timing-upcoming' });
    const upcomingWords = parsed.flatWords.slice(1, 6);
    upcoming.innerHTML = upcomingWords.map(w => `<span>${w.text}</span>`).join(' · ');
    display.appendChild(upcoming);

    // Start button (shown initially)
    const startBtn = el('button', {
      className: 'timing-start-btn',
      id: 'timing-start-btn',
      textContent: '▶ START TIMING',
      onClick: startTiming,
    });
    display.appendChild(startBtn);

    container.appendChild(display);

    // Key hints
    const hints = el('div', { className: 'key-hints', id: 'key-hints' });
    hints.innerHTML = `
      <div class="key-hint"><span class="key-badge">↓</span><span>Tap for each word</span></div>
      <div class="key-hint"><span class="key-badge">HOLD ↓</span><span>Hold for sustained words</span></div>
      <div class="key-hint"><span class="key-badge">BACKSPACE</span><span>Undo last word</span></div>
      <div class="key-hint"><span class="key-badge">ESC</span><span>Pause</span></div>
    `;
    container.appendChild(hints);

    // Word timeline chips
    const timeline = el('div', { className: 'word-timeline', id: 'word-timeline' });
    parsed.flatWords.forEach((word, i) => {
      const chip = el('div', {
        className: `word-chip ${i === 0 ? 'active' : 'pending'}`,
        id: `chip-${word.id}`,
        textContent: word.text,
      });
      timeline.appendChild(chip);
    });
    container.appendChild(timeline);

    // Bottom buttons
    const btnRow = el('div', { className: 'center mt-24', style: { display: 'flex', justifyContent: 'center', gap: '14px' } });
    btnRow.appendChild(el('button', {
      className: 'btn btn-ghost',
      textContent: '↺ Restart',
      onClick: () => {
        Audio.stop();
        timingStarted = false;
        timingComplete = false;
        renderContent();
      },
    }));
    btnRow.appendChild(el('button', {
      className: 'btn btn-primary',
      id: 'timing-preview-btn',
      textContent: 'Preview Results →',
      style: { display: 'none' },
      onClick: () => { completedScreens.add(2); goToScreen(3); },
    }));
    container.appendChild(btnRow);

    // Setup callbacks
    TimingEngine.setOnWordTimed((index, word) => {
      updateTimingUI();
    });

    TimingEngine.setOnComplete(() => {
      timingComplete = true;
      Audio.pause();
      const previewBtn = document.getElementById('timing-preview-btn');
      if (previewBtn) previewBtn.style.display = 'inline-flex';
      const currentEl = document.getElementById('timing-current');
      if (currentEl) {
        currentEl.textContent = '✓ Done!';
        currentEl.style.color = '#00e5a0';
      }
      const upcoming = document.getElementById('timing-upcoming');
      if (upcoming) upcoming.textContent = '';
    });

    TimingEngine.setOnHoldUpdate((dur) => {
      const fill = document.getElementById('hold-bar-fill');
      if (fill) {
        const pct = Math.min(100, dur * 200); // visual scaling
        fill.style.width = pct + '%';
      }
    });

    // Keyboard handler
    _setupTimingKeyboard();
  }

  function _setupTimingKeyboard() {
    // Remove old handler if exists
    if (window._timingKeyDown) {
      document.removeEventListener('keydown', window._timingKeyDown);
      document.removeEventListener('keyup', window._timingKeyUp);
    }

    window._timingKeyDown = (e) => {
      if (currentScreen !== 2) return;
      if (!timingStarted) return;

      if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        if (e.repeat) return; // Ignore key repeat
        TimingEngine.tapDown(Audio.getCurrentTime());
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        handleTimingPause();
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        const newIndex = TimingEngine.undo();
        if (newIndex !== undefined) updateTimingUI();
      }
    };

    window._timingKeyUp = (e) => {
      if (currentScreen !== 2) return;
      if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        TimingEngine.tapUp(Audio.getCurrentTime());
      }
    };

    document.addEventListener('keydown', window._timingKeyDown);
    document.addEventListener('keyup', window._timingKeyUp);
  }

  function startTiming() {
    // Countdown 3-2-1
    const overlay = el('div', { className: 'countdown-overlay', id: 'countdown-overlay' });
    document.body.appendChild(overlay);

    let count = 3;
    const numEl = el('div', { className: 'countdown-number', textContent: count });
    const textEl = el('div', { className: 'countdown-text', textContent: 'Get ready...' });
    overlay.appendChild(numEl);
    overlay.appendChild(textEl);

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        numEl.textContent = count;
        numEl.style.animation = 'none';
        numEl.offsetHeight; // trigger reflow
        numEl.style.animation = 'wordPop 0.4s ease-out';
      } else {
        clearInterval(interval);
        overlay.remove();
        // Start!
        timingStarted = true;
        Audio.setRate(selectedSpeed);
        Audio.play(0);
        TimingEngine.start(selectedSpeed);
        // Hide start button
        const btn = document.getElementById('timing-start-btn');
        if (btn) btn.style.display = 'none';
      }
    }, 800);
  }

  function handleTimingPause() {
    if (TimingEngine.getIsPaused()) return;
    Audio.pause();
    TimingEngine.pauseEngine();

    const display = document.getElementById('timing-display');
    if (!display) return;

    const overlay = el('div', { className: 'paused-overlay', id: 'paused-overlay' });
    overlay.appendChild(el('h3', { textContent: '⏸ Paused' }));
    overlay.appendChild(el('p', { textContent: 'Resume timing or restart from the beginning' }));
    const actions = el('div', { className: 'paused-actions' });
    actions.appendChild(el('button', {
      className: 'btn btn-ghost',
      textContent: '↺ Restart',
      onClick: () => {
        overlay.remove();
        Audio.stop();
        timingStarted = false;
        renderContent();
      },
    }));
    actions.appendChild(el('button', {
      className: 'btn btn-primary',
      textContent: '▶ Resume',
      onClick: () => {
        overlay.remove();
        TimingEngine.resume();
        Audio.play();
      },
    }));
    overlay.appendChild(actions);
    display.appendChild(overlay);
  }

  function updateTimingUI() {
    const idx = TimingEngine.getCurrentIndex();
    const words = parsed.flatWords;

    // Update progress label
    const label = document.getElementById('timing-progress-label');
    if (label && idx < words.length) {
      const word = words[idx];
      label.textContent = `Word ${idx + 1} of ${words.length} · Block ${word.blockIndex + 1}`;
    }

    // Update completed words
    const completedEl = document.getElementById('timing-completed');
    if (completedEl) {
      completedEl.innerHTML = '';
      const start = Math.max(0, idx - 8);
      for (let i = start; i < idx; i++) {
        completedEl.appendChild(el('span', { textContent: words[i].text }));
      }
    }

    // Update current word
    const currentEl = document.getElementById('timing-current');
    if (currentEl && idx < words.length) {
      currentEl.textContent = words[idx].text;
      currentEl.style.animation = 'none';
      currentEl.offsetHeight;
      currentEl.style.animation = 'wordPop 0.25s ease-out';
    }

    // Update upcoming
    const upcomingEl = document.getElementById('timing-upcoming');
    if (upcomingEl) {
      const upWords = words.slice(idx + 1, idx + 6);
      upcomingEl.innerHTML = upWords.map(w => `<span>${w.text}</span>`).join(' · ');
    }

    // Update chips
    words.forEach((w, i) => {
      const chip = document.getElementById(`chip-${w.id}`);
      if (!chip) return;
      chip.className = 'word-chip';
      if (i < idx) {
        chip.className += ' done';
        const timeStr = w.startTime != null ? Utils.toDisplay(w.startTime).slice(-4) : '';
        if (timeStr && !chip.querySelector('.chip-time')) {
          chip.appendChild(el('span', { className: 'chip-time', textContent: timeStr }));
        }
      } else if (i === idx) {
        chip.className += ' active';
      } else {
        chip.className += ' pending';
      }
    });

    // Auto-scroll the timeline
    const activeChip = document.getElementById(`chip-${words[idx]?.id}`);
    if (activeChip) {
      activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  // ===========================================================
  // SCREEN 4: PREVIEW
  // ===========================================================
  let previewPlaying = false;
  let previewAnimId = null;

  function renderPreviewScreen(container) {
    if (!parsed || !parsed.flatWords[0]?.startTime) {
      container.appendChild(el('p', { textContent: 'Please complete timing first.', style: { color: 'var(--text-dim)', textAlign: 'center', marginTop: '60px' } }));
      return;
    }

    const title = el('div', { className: 'screen-title' });
    title.appendChild(el('h2', { innerHTML: 'Preview <span class="gradient">Sync</span>' }));
    title.appendChild(el('p', { textContent: 'Watch your lyrics play back in real-time to check timing alignment' }));
    container.appendChild(title);

    // Player
    const player = el('div', { className: 'preview-player' });

    // Stage
    const stage = el('div', { className: 'preview-stage', id: 'preview-stage' });
    stage.appendChild(el('div', { className: 'preview-line current', id: 'preview-current-line' }));
    stage.appendChild(el('div', { className: 'preview-line next', id: 'preview-next-line' }));
    const progress = el('div', { className: 'preview-progress' });
    progress.appendChild(el('div', { className: 'preview-progress-fill', id: 'preview-progress-fill' }));
    stage.appendChild(progress);
    player.appendChild(stage);

    // Controls
    const controls = el('div', { className: 'preview-controls' });
    controls.appendChild(el('span', { className: 'playback-time', id: 'preview-time', textContent: `0:00 / ${Utils.toMMSS(Audio.getDuration())}` }));

    const centerControls = el('div', { className: 'preview-controls-center' });
    centerControls.appendChild(el('button', { className: 'preview-skip-btn', textContent: '⏮', onClick: () => { Audio.seek(0); } }));
    const playBtn = el('button', {
      className: 'preview-play-btn',
      id: 'preview-play-btn',
      textContent: '▶',
      onClick: togglePreview,
    });
    centerControls.appendChild(playBtn);
    centerControls.appendChild(el('button', { className: 'preview-skip-btn', textContent: '⏭', onClick: () => { Audio.seek(Audio.getDuration() - 1); } }));
    controls.appendChild(centerControls);
    controls.appendChild(el('span', { style: { fontSize: '12px', color: 'var(--text-dim)', minWidth: '60px', textAlign: 'right' }, textContent: '1.0×' }));
    player.appendChild(controls);
    container.appendChild(player);

    // Timeline visualization
    const tlVis = el('div', { className: 'timeline-vis' });
    tlVis.appendChild(el('div', { className: 'timeline-vis-label', textContent: 'TIMELINE — PER WORD' }));
    const bars = el('div', { className: 'timeline-bars', id: 'preview-timeline-bars' });
    const maxDur = Math.max(...parsed.flatWords.filter(w => w.endTime).map(w => w.endTime - w.startTime), 0.1);
    parsed.flatWords.forEach((w, i) => {
      if (!w.startTime) return;
      const dur = (w.endTime || w.startTime + 0.3) - w.startTime;
      const h = Math.max(6, (dur / maxDur) * 44);
      const group = el('div', { className: 'timeline-bar-group' });
      group.appendChild(el('div', { className: 'timeline-bar-label', textContent: w.text }));
      group.appendChild(el('div', {
        className: 'timeline-bar future',
        id: `tbar-${w.id}`,
        style: { height: h + 'px' },
      }));
      bars.appendChild(group);
    });
    tlVis.appendChild(bars);
    container.appendChild(tlVis);

    // Action buttons
    const btnRow = el('div', { className: 'center mt-24', style: { display: 'flex', justifyContent: 'center', gap: '14px' } });
    btnRow.appendChild(el('button', {
      className: 'btn btn-ghost',
      textContent: '← Re-time',
      onClick: () => { stopPreview(); goToScreen(2); },
    }));
    btnRow.appendChild(el('button', {
      className: 'btn btn-success',
      textContent: '✓ Looks Good — Export →',
      onClick: () => { stopPreview(); completedScreens.add(3); goToScreen(4); },
    }));
    container.appendChild(btnRow);
  }

  function togglePreview() {
    if (previewPlaying) {
      stopPreview();
    } else {
      startPreview();
    }
  }

  function startPreview() {
    previewPlaying = true;
    const btn = document.getElementById('preview-play-btn');
    if (btn) btn.textContent = '⏸';

    Audio.setRate(1.0);
    Audio.play();

    Audio.setOnTimeUpdate((time) => {
      updatePreviewDisplay(time);
    });

    Audio.setOnEnded(() => {
      stopPreview();
    });
  }

  function stopPreview() {
    previewPlaying = false;
    Audio.pause();
    const btn = document.getElementById('preview-play-btn');
    if (btn) btn.textContent = '▶';
  }

  function updatePreviewDisplay(time) {
    const dur = Audio.getDuration();

    // Progress bar
    const progressFill = document.getElementById('preview-progress-fill');
    if (progressFill) progressFill.style.width = (time / dur * 100) + '%';

    // Time label
    const timeEl = document.getElementById('preview-time');
    if (timeEl) timeEl.textContent = `${Utils.toMMSS(time)} / ${Utils.toMMSS(dur)}`;

    // Find current line and word
    const lines = LyricsParser.getFlatLines(parsed);
    let currentLineIdx = -1;
    let currentWordIdx = -1;

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const lineStart = line.words[0]?.startTime;
      const lineEnd = line.words[line.words.length - 1]?.endTime;
      if (lineStart != null && lineEnd != null && time >= lineStart && time <= lineEnd + 0.1) {
        currentLineIdx = li;
        for (let wi = 0; wi < line.words.length; wi++) {
          const w = line.words[wi];
          if (w.startTime != null && time >= w.startTime && time < (w.endTime || w.startTime + 0.5)) {
            currentWordIdx = wi;
          }
        }
        break;
      }
      // Check if we're between lines
      if (lineStart != null && time < lineStart) {
        currentLineIdx = li;
        currentWordIdx = -1;
        break;
      }
    }

    // Update current line display
    const currentLineEl = document.getElementById('preview-current-line');
    const nextLineEl = document.getElementById('preview-next-line');

    if (currentLineIdx >= 0 && currentLineIdx < lines.length) {
      const line = lines[currentLineIdx];
      if (currentLineEl) {
        currentLineEl.innerHTML = '';
        line.words.forEach((w, wi) => {
          let cls = 'preview-word ';
          if (w.startTime != null && time >= w.startTime) {
            if (w.endTime != null && time > w.endTime) cls += 'past';
            else cls += 'current';
          } else {
            cls += 'future';
          }
          currentLineEl.appendChild(el('span', { className: cls, textContent: w.text }));
        });
      }

      // Next line
      if (nextLineEl) {
        if (currentLineIdx + 1 < lines.length) {
          nextLineEl.textContent = lines[currentLineIdx + 1].text;
        } else {
          nextLineEl.textContent = '';
        }
      }
    }

    // Update timeline bars
    parsed.flatWords.forEach(w => {
      const bar = document.getElementById(`tbar-${w.id}`);
      if (!bar) return;
      if (w.startTime != null && time >= w.startTime) {
        if (w.endTime != null && time > w.endTime) {
          bar.className = 'timeline-bar past';
        } else {
          bar.className = 'timeline-bar current';
        }
      } else {
        bar.className = 'timeline-bar future';
      }
    });
  }

  // ===========================================================
  // SCREEN 5: EXPORT
  // ===========================================================
  function renderExportScreen(container) {
    if (!parsed) {
      container.appendChild(el('p', { textContent: 'No timing data to export.', style: { color: 'var(--text-dim)', textAlign: 'center', marginTop: '60px' } }));
      return;
    }

    const title = el('div', { className: 'screen-title' });
    title.appendChild(el('h2', { innerHTML: 'Export <span class="gradient">SRT</span>' }));
    title.appendChild(el('p', { textContent: 'Choose your format and download' }));
    container.appendChild(title);

    // Main export cards
    const grid = el('div', { className: 'export-grid' });

    // Per-word SRT
    const perWordSample = parsed.flatWords.slice(0, 3).map((w, i) => {
      if (!w.startTime || !w.endTime) return '';
      return `${i + 1}\n${Utils.toSRT(w.startTime)} --> ${Utils.toSRT(w.endTime)}\n${w.text}`;
    }).join('\n\n');

    const card1 = el('div', {
      className: `export-card ${selectedExportFormat === 'per-word-srt' ? 'selected' : ''}`,
      onClick: () => { selectedExportFormat = 'per-word-srt'; renderContent(); },
    });
    card1.appendChild(el('div', { className: 'export-card-icon', textContent: 'W' }));
    card1.appendChild(el('h3', { textContent: 'Per-Word SRT' }));
    card1.appendChild(el('p', { textContent: 'Each word gets its own subtitle entry. Perfect for karaoke-style lyric videos with word-by-word highlights.' }));
    card1.appendChild(el('div', { className: 'export-preview-code', textContent: perWordSample || '(no data)' }));
    grid.appendChild(card1);

    // Per-line SRT
    const lines = LyricsParser.getFlatLines(parsed);
    const perLineSample = lines.slice(0, 2).map((line, i) => {
      const first = line.words[0];
      const last = line.words[line.words.length - 1];
      if (!first?.startTime || !last?.endTime) return '';
      return `${i + 1}\n${Utils.toSRT(first.startTime)} --> ${Utils.toSRT(last.endTime)}\n${line.text}`;
    }).join('\n\n');

    const card2 = el('div', {
      className: `export-card ${selectedExportFormat === 'per-line-srt' ? 'selected' : ''}`,
      onClick: () => { selectedExportFormat = 'per-line-srt'; renderContent(); },
    });
    card2.appendChild(el('div', { className: 'export-card-icon', textContent: 'L' }));
    card2.appendChild(el('h3', { textContent: 'Per-Line SRT' }));
    card2.appendChild(el('p', { textContent: 'Groups words by line. Standard subtitle format — start of first word to end of last word per line.' }));
    card2.appendChild(el('div', { className: 'export-preview-code', textContent: perLineSample || '(no data)' }));
    grid.appendChild(card2);

    container.appendChild(grid);

    // Extra formats
    const extras = el('div', { className: 'extra-formats' });
    ['ass', 'vtt', 'json'].forEach(fmt => {
      const label = fmt === 'ass' ? 'ASS (Aegisub)' : fmt === 'vtt' ? 'VTT (WebVTT)' : 'JSON (Raw Data)';
      extras.appendChild(el('button', {
        className: `extra-format-btn ${selectedExportFormat === fmt ? 'selected' : ''}`,
        textContent: label,
        onClick: () => { selectedExportFormat = fmt; renderContent(); },
      }));
    });
    container.appendChild(extras);

    // Download button
    const btnWrap = el('div', { className: 'center' });
    btnWrap.appendChild(el('button', {
      className: 'btn btn-success btn-lg',
      textContent: '⬇ Download',
      onClick: handleExport,
    }));
    container.appendChild(btnWrap);
  }

  async function handleExport() {
    let content = '';
    let defaultName = 'lyrics';
    let filters = [];
    const audioName = Audio.getFileInfo()?.name?.replace(/\.[^.]+$/, '') || 'lyrics';

    switch (selectedExportFormat) {
      case 'per-word-srt':
        content = Exporter.toPerWordSRT(parsed);
        defaultName = `${audioName}_per-word.srt`;
        filters = [{ name: 'SRT Subtitle', extensions: ['srt'] }];
        break;
      case 'per-line-srt':
        content = Exporter.toPerLineSRT(parsed);
        defaultName = `${audioName}_per-line.srt`;
        filters = [{ name: 'SRT Subtitle', extensions: ['srt'] }];
        break;
      case 'ass':
        content = Exporter.toASS(parsed);
        defaultName = `${audioName}.ass`;
        filters = [{ name: 'ASS Subtitle', extensions: ['ass'] }];
        break;
      case 'vtt':
        content = Exporter.toVTT(parsed, selectedExportFormat === 'per-word-srt');
        defaultName = `${audioName}.vtt`;
        filters = [{ name: 'WebVTT', extensions: ['vtt'] }];
        break;
      case 'json':
        content = Exporter.toJSON(parsed);
        defaultName = `${audioName}_timing.json`;
        filters = [{ name: 'JSON', extensions: ['json'] }];
        break;
    }

    const result = await window.api.saveFile({ content, defaultName, filters });
    if (result) {
      // Quick success flash
      alert(`Saved to: ${result}`);
    }
  }

  // ===== START =====
  document.addEventListener('DOMContentLoaded', init);

  return { goToScreen };
})();
