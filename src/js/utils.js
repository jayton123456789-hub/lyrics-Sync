// ===== UTILITY FUNCTIONS =====
window.LyricSync = window.LyricSync || {};

window.LyricSync.Utils = {
  // Format seconds to SRT time: 00:00:01,200
  toSRT(seconds) {
    if (seconds == null || isNaN(seconds)) return '00:00:00,000';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
  },

  // Format seconds to VTT time: 00:00:01.200
  toVTT(seconds) {
    return this.toSRT(seconds).replace(',', '.');
  },

  // Format seconds to display: 0:01.2
  toDisplay(seconds) {
    if (seconds == null || isNaN(seconds)) return '0:00.0';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const tenths = Math.floor((seconds % 1) * 10);
    return `${m}:${String(s).padStart(2,'0')}.${tenths}`;
  },

  // Format seconds to mm:ss
  toMMSS(seconds) {
    if (seconds == null || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2,'0')}`;
  },

  // Format file size
  formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  },

  // Create element helper
  el(tag, attrs = {}, children = []) {
    const elem = document.createElement(tag);
    for (const [key, val] of Object.entries(attrs)) {
      if (key === 'className') elem.className = val;
      else if (key === 'innerHTML') elem.innerHTML = val;
      else if (key === 'textContent') elem.textContent = val;
      else if (key.startsWith('on')) elem.addEventListener(key.slice(2).toLowerCase(), val);
      else if (key === 'style' && typeof val === 'object') {
        Object.assign(elem.style, val);
      } else {
        elem.setAttribute(key, val);
      }
    }
    for (const child of (Array.isArray(children) ? children : [children])) {
      if (typeof child === 'string') elem.appendChild(document.createTextNode(child));
      else if (child) elem.appendChild(child);
    }
    return elem;
  },
};
