// ===== AUDIO ENGINE =====
window.LyricSync = window.LyricSync || {};

window.LyricSync.Audio = (() => {
  let audioContext = null;
  let audioBuffer = null;
  let audioElement = null;
  let fileInfo = null;
  let onTimeUpdate = null;
  let onEnded = null;
  let onWaveformReady = null;
  let animFrameId = null;
  let loadToken = 0;


  function init() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  async function loadFile(fileData) {
    if (!audioContext) init();
    const token = ++loadToken;

    fileInfo = {
      name: fileData.name,
      path: fileData.path,
      size: fileData.size,
    };
    audioBuffer = null;

    // Kill old element
    if (audioElement) {
      audioElement.pause();
      audioElement.removeAttribute('src');
      audioElement.load();
    }

    // Build a file:// URL (webSecurity: false lets this work)
    const fileUrl = 'file:///' + fileData.path.replace(/\\/g, '/');
    logEvent('INFO', 'audio.loadFile start', { name: fileData.name, path: fileData.path, size: fileData.size });

    audioElement = new Audio();
    audioElement.src = fileUrl;
    audioElement.preload = 'auto';

    // Wait for metadata
    await new Promise((resolve, reject) => {
      const onMeta = () => { cleanup(); resolve(); };
      const onErr = (e) => { cleanup(); reject(e); };
      const cleanup = () => {
        audioElement.removeEventListener('loadedmetadata', onMeta);
        audioElement.removeEventListener('error', onErr);
      };
      audioElement.addEventListener('loadedmetadata', onMeta);
      audioElement.addEventListener('error', onErr);
      // Safety timeout
      setTimeout(() => { cleanup(); resolve(); }, 5000);
    });

    fileInfo.duration = audioElement.duration || 0;
    logEvent('INFO', 'audio metadata ready', { duration: fileInfo.duration, token });

    audioElement.addEventListener('ended', () => {
      cancelAnimationFrame(animFrameId);
      if (onEnded) onEnded();
    });

    // Decode waveform in background so the UI can continue immediately.
    (async () => {
      try {

        if (token !== loadToken) returun;

        audioBuffer = decoded;
        fileInfo.sampleRate = audioBuffer.sampleRate;
        fileInfo.channels = audioBuffer.numberOfChannels;

        console.warn('Waveform decode failed (playback still works):', e);
      }
    })();

    return { fileInfo, audioBuffer };
  }

  function play(startTime) {
    if (!audioElement) return;
    if (audioContext?.state === 'suspended') audioContext.resume();
    if (startTime !== undefined) audioElement.currentTime = startTime;
    audioElement.play().catch(e => console.warn('play():', e));
    _startTimeLoop();
  }

  function pause() {
    if (!audioElement) return;
    audioElement.pause();
    cancelAnimationFrame(animFrameId);
  }

  function stop() {
    if (!audioElement) return;
    audioElement.pause();
    audioElement.currentTime = 0;
    cancelAnimationFrame(animFrameId);
  }

  function seek(t) {
    if (!audioElement) return;
    audioElement.currentTime = Math.max(0, Math.min(t, getDuration()));
  }

  function setRate(r) { if (audioElement) audioElement.playbackRate = r; }
  function getRate() { return audioElement ? audioElement.playbackRate : 1; }
  function getCurrentTime() { return audioElement ? audioElement.currentTime : 0; }
  function getDuration() { return fileInfo?.duration || 0; }
  function isPlaying() { return audioElement ? !audioElement.paused : false; }
  function getFileInfo() { return fileInfo; }
  function getAudioBuffer() { return audioBuffer; }
  function setOnTimeUpdate(fn) { onTimeUpdate = fn; }
  function setOnEnded(fn) { onEnded = fn; }
  function setOnWaveformReady(fn) { onWaveformReady = fn; }

  function _startTimeLoop() {
    cancelAnimationFrame(animFrameId);
    (function loop() {
      if (audioElement && !audioElement.paused) {
        if (onTimeUpdate) onTimeUpdate(audioElement.currentTime);
        animFrameId = requestAnimationFrame(loop);
      }
    })();
  }

  function getWaveformPeaks(numBars = 150) {
    if (!audioBuffer) {
      // Fake waveform if decode failed
      return Array.from({ length: numBars }, () => Math.random() * 0.4 + 0.1);
    }
    const data = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(data.length / numBars);
    const peaks = [];
    for (let i = 0; i < numBars; i++) {
      let max = 0;
      for (let j = 0; j < blockSize; j++) {
        const idx = i * blockSize + j;
        if (idx < data.length) {
          const val = Math.abs(data[idx]);
          if (val > max) max = val;
        }
      }
      peaks.push(max);
    }
    const peakMax = Math.max(...peaks) || 1;
    return peaks.map(p => p / peakMax);
  }

  return {
    init, loadFile, play, pause, stop, seek,
    setRate, getRate, getCurrentTime, getDuration,
    isPlaying, getFileInfo, getAudioBuffer, getWaveformPeaks,
    setOnTimeUpdate, setOnEnded, setOnWaveformReady,
  };
})();
