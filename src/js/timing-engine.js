// ===== TIMING ENGINE =====
window.LyricSync = window.LyricSync || {};

window.LyricSync.TimingEngine = (() => {
  let parsed = null;
  let currentIndex = 0;
  let isActive = false;
  let isPaused = false;
  let isHolding = false;
  let holdStartTime = null;
  let playbackSpeed = 1.0;
  let onWordTimed = null;   // callback(wordIndex, word)
  let onComplete = null;     // callback()
  let onHoldUpdate = null;   // callback(holdDuration)
  let holdAnimFrame = null;

  function init(parsedLyrics) {
    parsed = parsedLyrics;
    currentIndex = 0;
    isActive = false;
    isPaused = false;
    isHolding = false;
    // Reset all times
    parsed.flatWords.forEach(w => {
      w.startTime = null;
      w.endTime = null;
    });
  }

  function start(speed) {
    playbackSpeed = speed || 1.0;
    isActive = true;
    isPaused = false;
    currentIndex = 0;
  }

  function resume() {
    isPaused = false;
    isActive = true;
  }

  function pauseEngine() {
    isPaused = true;
  }

  function setSpeed(speed) {
    playbackSpeed = speed;
  }

  // Called on keydown (down arrow)
  function tapDown(rawTime) {
    if (!isActive || isPaused || !parsed) return;
    if (currentIndex >= parsed.flatWords.length) return;

    // Normalize time to real speed
    // rawTime is the actual audio currentTime which is already in real time
    // since we're using audio.currentTime, no normalization needed
    const realTime = rawTime;

    const word = parsed.flatWords[currentIndex];
    word.startTime = realTime;

    // Set endTime on previous word if it doesn't have one
    if (currentIndex > 0) {
      const prev = parsed.flatWords[currentIndex - 1];
      if (prev.endTime === null) {
        prev.endTime = realTime;
      }
    }

    isHolding = true;
    holdStartTime = realTime;
    _startHoldAnim();
  }

  // Called on keyup (down arrow released)
  function tapUp(rawTime) {
    if (!isHolding) return;

    const realTime = rawTime;
    const word = parsed.flatWords[currentIndex];

    // For held words, set endTime to when key was released
    // Only if the hold was significant (> 150ms equivalent)
    const holdDuration = realTime - holdStartTime;
    if (holdDuration > 0.15) {
      word.endTime = realTime;
    }

    isHolding = false;
    holdStartTime = null;
    _stopHoldAnim();

    // Advance to next word
    currentIndex++;

    if (onWordTimed) onWordTimed(currentIndex - 1, word);

    // Check if done
    if (currentIndex >= parsed.flatWords.length) {
      // Set endTime on last word if not set
      if (word.endTime === null) {
        word.endTime = realTime + 0.3; // Default small gap
      }
      isActive = false;
      if (onComplete) onComplete();
    }
  }

  // Undo last word
  function undo() {
    if (currentIndex <= 0) return;
    currentIndex--;
    const word = parsed.flatWords[currentIndex];
    word.startTime = null;
    word.endTime = null;
    isActive = true;
    return currentIndex;
  }

  function _startHoldAnim() {
    _stopHoldAnim();
    function loop() {
      if (isHolding && onHoldUpdate) {
        const now = LyricSync.Audio.getCurrentTime();
        const dur = now - holdStartTime;
        onHoldUpdate(dur);
      }
      if (isHolding) holdAnimFrame = requestAnimationFrame(loop);
    }
    holdAnimFrame = requestAnimationFrame(loop);
  }

  function _stopHoldAnim() {
    cancelAnimationFrame(holdAnimFrame);
    if (onHoldUpdate) onHoldUpdate(0);
  }

  function getCurrentWord() {
    if (!parsed || currentIndex >= parsed.flatWords.length) return null;
    return parsed.flatWords[currentIndex];
  }

  function getCurrentIndex() { return currentIndex; }
  function getIsActive() { return isActive; }
  function getIsPaused() { return isPaused; }
  function getIsHolding() { return isHolding; }
  function getParsed() { return parsed; }

  function setOnWordTimed(fn) { onWordTimed = fn; }
  function setOnComplete(fn) { onComplete = fn; }
  function setOnHoldUpdate(fn) { onHoldUpdate = fn; }

  // Reset timing from a specific index
  function resetFrom(index) {
    currentIndex = index;
    for (let i = index; i < parsed.flatWords.length; i++) {
      parsed.flatWords[i].startTime = null;
      parsed.flatWords[i].endTime = null;
    }
    isActive = true;
    isPaused = false;
  }

  return {
    init, start, resume, pauseEngine, setSpeed,
    tapDown, tapUp, undo, resetFrom,
    getCurrentWord, getCurrentIndex, getIsActive, getIsPaused, getIsHolding, getParsed,
    setOnWordTimed, setOnComplete, setOnHoldUpdate,
  };
})();
