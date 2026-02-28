// ===== LYRICS PARSER =====
window.LyricSync = window.LyricSync || {};

window.LyricSync.LyricsParser = {
  parse(text) {
    if (!text || !text.trim()) return null;

    const rawBlocks = text.split(/\n\s*\n/); // Double newline = block break
    const blocks = [];
    const flatWords = [];
    let wordId = 0;

    rawBlocks.forEach((blockText, blockIndex) => {
      const lines = blockText.split('\n').filter(l => l.trim());
      if (lines.length === 0) return;

      const block = {
        blockIndex,
        lines: [],
      };

      lines.forEach((lineText, lineIndex) => {
        const rawWords = lineText.trim().split(/\s+/).filter(w => w);
        const line = {
          lineIndex,
          blockIndex,
          words: [],
        };

        rawWords.forEach(wordText => {
          const word = {
            id: wordId++,
            text: wordText,
            lineIndex,
            blockIndex,
            startTime: null,
            endTime: null,
          };
          line.words.push(word);
          flatWords.push(word);
        });

        block.lines.push(line);
      });

      blocks.push(block);
    });

    return {
      blocks,
      flatWords,
      totalWords: flatWords.length,
      totalLines: blocks.reduce((sum, b) => sum + b.lines.length, 0),
      totalBlocks: blocks.length,
    };
  },

  // Get the line that a word belongs to
  getLineForWord(parsed, wordId) {
    for (const block of parsed.blocks) {
      for (const line of block.lines) {
        for (const word of line.words) {
          if (word.id === wordId) return line;
        }
      }
    }
    return null;
  },

  // Get all words in a given line
  getWordsInLine(parsed, blockIndex, lineIndex) {
    const block = parsed.blocks[blockIndex];
    if (!block) return [];
    const line = block.lines[lineIndex];
    if (!line) return [];
    return line.words;
  },

  // Build lines as flat array for preview
  getFlatLines(parsed) {
    const lines = [];
    for (const block of parsed.blocks) {
      for (const line of block.lines) {
        lines.push({
          blockIndex: line.blockIndex,
          lineIndex: line.lineIndex,
          words: line.words,
          text: line.words.map(w => w.text).join(' '),
          startTime: line.words[0]?.startTime,
          endTime: line.words[line.words.length - 1]?.endTime,
        });
      }
    }
    return lines;
  },
};
