export type SectionType = 'verse' | 'pre-chorus' | 'chorus' | 'bridge' | 'outro' | 'intro';

export interface VoiceMemoData {
  id: string;
  blob: string; // base64 data URL
  duration: number;
  createdAt: number;
}

export interface Section {
  id: string;
  type: SectionType;
  label: string; // e.g. "Verse 1", "Chorus"
  chords: string; // e.g. "Am - G - F - C"
  lyrics: string;
  memo: VoiceMemoData | null;
}

export interface Song {
  id: string;
  title: string;
  key: string;
  bpm: number;
  timeSignature: '4/4' | '3/4' | '6/8';
  sections: Section[];
  updatedAt: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const SECTION_COLORS: Record<SectionType, string> = {
  intro: 'bg-slate-100 border-slate-300',
  verse: 'bg-blue-50 border-blue-200',
  'pre-chorus': 'bg-amber-50 border-amber-200',
  chorus: 'bg-purple-50 border-purple-300',
  bridge: 'bg-rose-50 border-rose-200',
  outro: 'bg-slate-100 border-slate-300',
};

export const SECTION_BADGE: Record<SectionType, string> = {
  intro: 'bg-slate-200 text-slate-700',
  verse: 'bg-blue-100 text-blue-700',
  'pre-chorus': 'bg-amber-100 text-amber-700',
  chorus: 'bg-purple-100 text-purple-700',
  bridge: 'bg-rose-100 text-rose-700',
  outro: 'bg-slate-200 text-slate-700',
};

export const KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
  'Am', 'A#m', 'Bbm', 'Bm', 'Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Abm'];
