import { useState, useCallback } from 'react';
import type { Song, Section, SectionType } from './types';
import { KEYS } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import SectionCard from './components/SectionCard';
import AISidebar from './components/AISidebar';
import { exportSongMidi } from './utils/midiExport';

const DEFAULT_SONG: Song = {
  id: crypto.randomUUID(),
  title: 'Untitled Song',
  key: 'C',
  bpm: 120,
  timeSignature: '4/4',
  sections: [],
  updatedAt: Date.now(),
};

const SECTION_TYPE_DEFAULTS: Record<SectionType, string> = {
  intro: 'Intro',
  verse: 'Verse 1',
  'pre-chorus': 'Pre-Chorus',
  chorus: 'Chorus',
  bridge: 'Bridge',
  outro: 'Outro',
};

function countSectionType(sections: Section[], type: SectionType): number {
  return sections.filter(s => s.type === type).length;
}

function makeSection(type: SectionType, sections: Section[]): Section {
  const count = countSectionType(sections, type);
  const baseName = SECTION_TYPE_DEFAULTS[type];
  const label = count === 0 ? baseName : `${baseName.replace(/\s*\d+$/, '')} ${count + 1}`;
  return {
    id: crypto.randomUUID(),
    type,
    label,
    chords: '',
    lyrics: '',
    memo: null,
  };
}

export default function App() {
  const [song, setSong] = useLocalStorage<Song>('songwriter-song', DEFAULT_SONG);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const updateSong = useCallback((patch: Partial<Song>) => {
    setSong(prev => ({ ...prev, ...patch, updatedAt: Date.now() }));
  }, [setSong]);

  const updateSection = useCallback((index: number, updated: Section) => {
    setSong(prev => {
      const sections = [...prev.sections];
      sections[index] = updated;
      return { ...prev, sections, updatedAt: Date.now() };
    });
  }, [setSong]);

  const addSection = useCallback((type: SectionType) => {
    setSong(prev => {
      const section = makeSection(type, prev.sections);
      return { ...prev, sections: [...prev.sections, section], updatedAt: Date.now() };
    });
    setAddMenuOpen(false);
  }, [setSong]);

  const deleteSection = useCallback((index: number) => {
    setSong(prev => {
      const sections = prev.sections.filter((_, i) => i !== index);
      return { ...prev, sections, updatedAt: Date.now() };
    });
  }, [setSong]);

  const moveSection = useCallback((index: number, direction: 'up' | 'down') => {
    setSong(prev => {
      const sections = [...prev.sections];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= sections.length) return prev;
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...prev, sections, updatedAt: Date.now() };
    });
  }, [setSong]);

  const newSong = () => {
    if (!confirm('Start a new song? Current song is saved in your browser.')) return;
    setSong({ ...DEFAULT_SONG, id: crypto.randomUUID(), title: 'Untitled Song', sections: [] });
  };

  const SECTION_TYPES: SectionType[] = ['intro', 'verse', 'pre-chorus', 'chorus', 'bridge', 'outro'];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-ink text-white px-6 py-3 flex items-center gap-4 shadow-md">
        <span className="text-xl font-bold tracking-tight">🎵 Songwriter</span>

        <input
          value={song.title}
          onChange={e => updateSong({ title: e.target.value })}
          className="flex-1 max-w-xs bg-white/10 rounded-lg px-3 py-1.5 text-sm font-medium text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
          placeholder="Song title"
        />

        <div className="flex items-center gap-3 ml-auto text-sm">
          {/* Key */}
          <label className="flex items-center gap-1.5 text-white/70">
            Key
            <select
              value={song.key}
              onChange={e => updateSong({ key: e.target.value })}
              className="bg-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-white/30"
            >
              {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>

          {/* BPM */}
          <label className="flex items-center gap-1.5 text-white/70">
            BPM
            <input
              type="number"
              value={song.bpm}
              min={40}
              max={240}
              onChange={e => updateSong({ bpm: parseInt(e.target.value) || 120 })}
              className="w-16 bg-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-white/30"
            />
          </label>

          {/* Time Sig */}
          <label className="flex items-center gap-1.5 text-white/70">
            <select
              value={song.timeSignature}
              onChange={e => updateSong({ timeSignature: e.target.value as Song['timeSignature'] })}
              className="bg-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-white/30"
            >
              <option value="4/4">4/4</option>
              <option value="3/4">3/4</option>
              <option value="6/8">6/8</option>
            </select>
          </label>

          <div className="w-px h-5 bg-white/20" />

          {/* Export MIDI */}
          <button
            onClick={() => exportSongMidi(song)}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          >
            ↓ MIDI
          </button>

          {/* New song */}
          <button
            onClick={newSong}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          >
            + New Song
          </button>

          {/* Toggle sidebar */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="flex items-center gap-1.5 bg-accent hover:bg-purple-700 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          >
            ✨ AI {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Song editor */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-2xl mx-auto space-y-4">
            {song.sections.length === 0 && (
              <div className="text-center py-16 text-muted">
                <div className="text-4xl mb-3">🎼</div>
                <p className="text-sm">No sections yet. Add one below to start writing.</p>
              </div>
            )}

            {song.sections.map((section, i) => (
              <SectionCard
                key={section.id}
                section={section}
                index={i}
                total={song.sections.length}
                onChange={updated => updateSection(i, updated)}
                onDelete={() => deleteSection(i)}
                onMoveUp={() => moveSection(i, 'up')}
                onMoveDown={() => moveSection(i, 'down')}
              />
            ))}

            {/* Add section */}
            <div className="relative">
              <button
                onClick={() => setAddMenuOpen(o => !o)}
                className="w-full rounded-xl border-2 border-dashed border-gray-300 py-3 text-sm text-muted hover:border-accent hover:text-accent transition-colors flex items-center justify-center gap-2"
              >
                <span className="text-lg">+</span> Add Section
              </button>

              {addMenuOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 z-20 flex gap-1 p-2 flex-wrap justify-center">
                  {SECTION_TYPES.map(type => (
                    <button
                      key={type}
                      onClick={() => addSection(type)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 hover:bg-accent-light hover:text-accent transition-colors capitalize"
                    >
                      {type}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Song stats */}
            {song.sections.length > 0 && (
              <div className="text-xs text-muted text-center pt-2">
                {song.sections.length} section{song.sections.length !== 1 ? 's' : ''} ·{' '}
                {song.sections.filter(s => s.lyrics.trim()).length} with lyrics ·{' '}
                {song.sections.filter(s => s.chords.trim()).length} with chords ·{' '}
                {song.sections.filter(s => s.memo).length} with voice memos
                <span className="ml-2 text-gray-300">|</span>
                <span className="ml-2">Auto-saved to browser</span>
              </div>
            )}
          </div>
        </main>

        {/* AI Sidebar */}
        {sidebarOpen && (
          <aside className="w-80 flex-shrink-0 border-l border-gray-200 p-4 overflow-hidden flex flex-col">
            <div className="flex-1 min-h-0">
              <AISidebar song={song} />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
