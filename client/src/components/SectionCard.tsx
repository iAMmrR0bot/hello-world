import { useState } from 'react';
import type { Section, SectionType } from '../types';
import { SECTION_COLORS, SECTION_BADGE } from '../types';
import LyricEditor from './LyricEditor';
import VoiceMemo from './VoiceMemo';

interface Props {
  section: Section;
  index: number;
  total: number;
  onChange: (updated: Section) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const SECTION_TYPES: SectionType[] = ['intro', 'verse', 'pre-chorus', 'chorus', 'bridge', 'outro'];

export default function SectionCard({ section, index, total, onChange, onDelete, onMoveUp, onMoveDown }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const update = (patch: Partial<Section>) => onChange({ ...section, ...patch });

  return (
    <div className={`rounded-xl border-2 ${SECTION_COLORS[section.type]} shadow-sm transition-all`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        {/* Drag handle / move buttons */}
        <div className="flex flex-col gap-0.5">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="text-gray-400 hover:text-ink disabled:opacity-20 leading-none text-xs"
          >▲</button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="text-gray-400 hover:text-ink disabled:opacity-20 leading-none text-xs"
          >▼</button>
        </div>

        {/* Section type badge */}
        <select
          value={section.type}
          onChange={e => update({ type: e.target.value as SectionType })}
          className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer ${SECTION_BADGE[section.type]} focus:outline-none focus:ring-1 focus:ring-accent`}
        >
          {SECTION_TYPES.map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>

        {/* Label */}
        <input
          value={section.label}
          onChange={e => update({ label: e.target.value })}
          className="flex-1 bg-transparent text-sm font-medium text-ink focus:outline-none focus:underline min-w-0"
          placeholder="Label (e.g. Verse 1)"
        />

        <button onClick={() => setCollapsed(c => !c)} className="text-muted hover:text-ink text-xs px-1">
          {collapsed ? '▼ Show' : '▲ Hide'}
        </button>
        <button onClick={onDelete} className="text-muted hover:text-rose-500 text-xs px-1" title="Delete section">
          ✕
        </button>
      </div>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          {/* Chord progression */}
          <div>
            <label className="block text-xs font-semibold text-chord uppercase tracking-wide mb-1">
              Chord Progression
            </label>
            <input
              value={section.chords}
              onChange={e => update({ chords: e.target.value })}
              placeholder="e.g. Am - G - F - C"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-mono text-chord placeholder:text-gray-400 focus:border-chord focus:outline-none focus:ring-1 focus:ring-chord"
            />
          </div>

          {/* Lyrics */}
          <div>
            <label className="block text-xs font-semibold text-ink uppercase tracking-wide mb-1">
              Lyrics
            </label>
            <LyricEditor
              value={section.lyrics}
              onChange={lyrics => update({ lyrics })}
              sectionId={section.id}
            />
          </div>

          {/* Voice memo */}
          <div>
            <label className="block text-xs font-semibold text-ink uppercase tracking-wide mb-1">
              Voice Memo
            </label>
            <VoiceMemo
              memo={section.memo}
              onSave={memo => update({ memo })}
              onDelete={() => update({ memo: null })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
