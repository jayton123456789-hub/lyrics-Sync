// ===== EXPORTER =====
window.LyricSync = window.LyricSync || {};

window.LyricSync.Exporter = {
  // Per-word SRT: each word is its own entry
  toPerWordSRT(parsed) {
    const { toSRT } = LyricSync.Utils;
    let output = '';
    let index = 1;

    for (const word of parsed.flatWords) {
      if (word.startTime == null || word.endTime == null) continue;
      output += `${index}\n`;
      output += `${toSRT(word.startTime)} --> ${toSRT(word.endTime)}\n`;
      output += `${word.text}\n\n`;
      index++;
    }
    return output.trim();
  },

  // Per-line SRT: each line is one entry
  toPerLineSRT(parsed) {
    const { toSRT } = LyricSync.Utils;
    const lines = LyricSync.LyricsParser.getFlatLines(parsed);
    let output = '';
    let index = 1;

    for (const line of lines) {
      const firstWord = line.words[0];
      const lastWord = line.words[line.words.length - 1];
      if (firstWord.startTime == null || lastWord.endTime == null) continue;

      output += `${index}\n`;
      output += `${toSRT(firstWord.startTime)} --> ${toSRT(lastWord.endTime)}\n`;
      output += `${line.text}\n\n`;
      index++;
    }
    return output.trim();
  },

  // WebVTT format
  toVTT(parsed, perWord = true) {
    const { toVTT } = LyricSync.Utils;
    let output = 'WEBVTT\n\n';

    if (perWord) {
      for (const word of parsed.flatWords) {
        if (word.startTime == null || word.endTime == null) continue;
        output += `${toVTT(word.startTime)} --> ${toVTT(word.endTime)}\n`;
        output += `${word.text}\n\n`;
      }
    } else {
      const lines = LyricSync.LyricsParser.getFlatLines(parsed);
      for (const line of lines) {
        const firstWord = line.words[0];
        const lastWord = line.words[line.words.length - 1];
        if (firstWord.startTime == null || lastWord.endTime == null) continue;
        output += `${toVTT(firstWord.startTime)} --> ${toVTT(lastWord.endTime)}\n`;
        output += `${line.text}\n\n`;
      }
    }
    return output.trim();
  },

  // ASS format with karaoke tags
  toASS(parsed) {
    const lines = LyricSync.LyricsParser.getFlatLines(parsed);
    let events = '';

    for (const line of lines) {
      const firstWord = line.words[0];
      const lastWord = line.words[line.words.length - 1];
      if (firstWord.startTime == null || lastWord.endTime == null) continue;

      const start = this._toASSTime(firstWord.startTime);
      const end = this._toASSTime(lastWord.endTime);

      // Build karaoke tags: {\k<duration>}word
      let dialogueText = '';
      for (let i = 0; i < line.words.length; i++) {
        const w = line.words[i];
        if (w.startTime == null || w.endTime == null) continue;
        const dur = Math.round((w.endTime - w.startTime) * 100); // centiseconds
        dialogueText += `{\\k${dur}}${w.text} `;
      }

      events += `Dialogue: 0,${start},${end},Default,,0,0,0,,${dialogueText.trim()}\n`;
    }

    return `[Script Info]
Title: LyricSync Export
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,60,&H00FFFFFF,&H00785AFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,0,2,10,10,50,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events}`;
  },

  // JSON export with full data
  toJSON(parsed) {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      generator: 'LyricSync',
      totalWords: parsed.totalWords,
      totalLines: parsed.totalLines,
      totalBlocks: parsed.totalBlocks,
      words: parsed.flatWords.map(w => ({
        id: w.id,
        text: w.text,
        startTime: w.startTime,
        endTime: w.endTime,
        blockIndex: w.blockIndex,
        lineIndex: w.lineIndex,
      })),
      lines: LyricSync.LyricsParser.getFlatLines(parsed).map(l => ({
        text: l.text,
        startTime: l.words[0]?.startTime,
        endTime: l.words[l.words.length - 1]?.endTime,
        blockIndex: l.blockIndex,
        lineIndex: l.lineIndex,
        words: l.words.map(w => ({
          text: w.text,
          startTime: w.startTime,
          endTime: w.endTime,
        })),
      })),
    }, null, 2);
  },

  _toASSTime(seconds) {
    if (seconds == null) return '0:00:00.00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const cs = Math.round((seconds % 1) * 100);
    return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  },
};
