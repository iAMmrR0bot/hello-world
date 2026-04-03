import { useState, useCallback, useRef } from 'react';
import RhymePicker from './RhymePicker';

interface Props {
  value: string;
  onChange: (val: string) => void;
  sectionId: string;
}

interface RhymeTarget {
  word: string;
  position: { x: number; y: number };
  selectionStart: number;
  selectionEnd: number;
}

export default function LyricEditor({ value, onChange, sectionId }: Props) {
  const [rhymeTarget, setRhymeTarget] = useState<RhymeTarget | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleDoubleClick = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.slice(start, end).trim();

    if (selected && /^[a-zA-Z']+$/.test(selected)) {
      const rect = ta.getBoundingClientRect();
      setRhymeTarget({
        word: selected,
        position: { x: rect.left + 20, y: rect.top + 20 },
        selectionStart: start,
        selectionEnd: end,
      });
    }
  }, []);

  const handleRhymeSelect = useCallback(
    (newWord: string) => {
      if (!rhymeTarget || !textareaRef.current) return;
      const { selectionStart, selectionEnd } = rhymeTarget;
      const before = value.slice(0, selectionStart);
      const after = value.slice(selectionEnd);
      // Preserve casing style of original word
      const original = value.slice(selectionStart, selectionEnd);
      const replacement =
        original[0] === original[0].toUpperCase()
          ? newWord[0].toUpperCase() + newWord.slice(1)
          : newWord;
      onChange(before + replacement + after);
      setRhymeTarget(null);
    },
    [rhymeTarget, value, onChange]
  );

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        id={`lyrics-${sectionId}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        onDoubleClick={handleDoubleClick}
        placeholder="Write lyrics here…&#10;Double-click a word to find rhymes"
        rows={6}
        className="w-full resize-none rounded-lg border border-gray-200 bg-paper p-3 text-sm leading-7 text-ink placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent font-mono"
      />
      <div className="mt-1 text-xs text-muted">
        Double-click any word → rhyme suggestions
      </div>
      {rhymeTarget && (
        <RhymePicker
          word={rhymeTarget.word}
          position={rhymeTarget.position}
          onSelect={handleRhymeSelect}
          onClose={() => setRhymeTarget(null)}
        />
      )}
    </div>
  );
}
