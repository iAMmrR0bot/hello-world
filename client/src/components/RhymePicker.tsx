import { useEffect, useState, useRef } from 'react';
import { fetchRhymes, type RhymeWord } from '../utils/rhymes';

interface Props {
  word: string;
  position: { x: number; y: number };
  onSelect: (word: string) => void;
  onClose: () => void;
}

export default function RhymePicker({ word, position, onSelect, onClose }: Props) {
  const [rhymes, setRhymes] = useState<RhymeWord[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetchRhymes(word).then(results => {
      setRhymes(results);
      setLoading(false);
    });
  }, [word]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const style: React.CSSProperties = {
    position: 'fixed',
    top: position.y + 8,
    left: Math.min(position.x, window.innerWidth - 220),
    zIndex: 50,
  };

  return (
    <div ref={ref} style={style} className="w-52 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
      <div className="px-3 py-2 bg-accent text-white text-xs font-semibold flex items-center justify-between">
        <span>Rhymes for "{word}"</span>
        <button onClick={onClose} className="hover:opacity-70">✕</button>
      </div>
      <div className="max-h-52 overflow-y-auto">
        {loading && (
          <div className="px-3 py-4 text-sm text-muted text-center">Loading…</div>
        )}
        {!loading && rhymes.length === 0 && (
          <div className="px-3 py-4 text-sm text-muted text-center">No rhymes found</div>
        )}
        {!loading && rhymes.map((r) => (
          <button
            key={r.word}
            onClick={() => onSelect(r.word)}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent-light flex items-center justify-between group"
          >
            <span className="font-medium text-ink">{r.word}</span>
            {r.numSyllables && (
              <span className="text-xs text-muted group-hover:text-accent">
                {r.numSyllables}syl
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
