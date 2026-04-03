// @ts-ignore — midi-writer-js doesn't ship great types
import MidiWriter from 'midi-writer-js';
import type { Song } from '../types';

// Maps chord root names to MIDI note numbers (middle octave, C4 = 60)
const NOTE_MAP: Record<string, number> = {
  C: 60, 'C#': 61, Db: 61, D: 62, 'D#': 63, Eb: 63,
  E: 64, F: 65, 'F#': 66, Gb: 66, G: 67, 'G#': 68,
  Ab: 68, A: 69, 'A#': 70, Bb: 70, B: 71,
};

// Simple block chord voicings: root + 3rd + 5th (± 7th for 7 chords)
function chordToMidiNotes(chord: string): number[] {
  const trimmed = chord.trim();
  if (!trimmed) return [];

  // Parse root: up to 2 chars (e.g. C#, Bb)
  let root = '';
  let rest = '';
  if (trimmed.length > 1 && (trimmed[1] === '#' || trimmed[1] === 'b')) {
    root = trimmed.slice(0, 2);
    rest = trimmed.slice(2);
  } else {
    root = trimmed[0];
    rest = trimmed.slice(1);
  }

  const rootNote = NOTE_MAP[root];
  if (rootNote === undefined) return [];

  const isMinor = rest.startsWith('m') && !rest.startsWith('maj');
  const isSeventh = rest.includes('7');
  const isMajSeventh = rest.includes('maj7');

  const third = isMinor ? rootNote + 3 : rootNote + 4;
  const fifth = rootNote + 7;
  const notes = [rootNote, third, fifth];

  if (isMajSeventh) notes.push(rootNote + 11);
  else if (isSeventh) notes.push(isMinor ? rootNote + 10 : rootNote + 10);

  // Add octave below root for fullness
  notes.unshift(rootNote - 12);

  return notes;
}

// Parse a chord string like "Am - G - F - C" or "Am G F C" into individual chords
function parseChordString(chordsStr: string): string[] {
  return chordsStr
    .split(/[\s\-|/]+/)
    .map(c => c.trim())
    .filter(c => c.length > 0);
}

export function exportSongMidi(song: Song): void {
  const tracks: unknown[] = [];

  for (const section of song.sections) {
    if (!section.chords.trim()) continue;

    const track = new MidiWriter.Track();
    track.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: 0 })); // Acoustic Grand Piano

    // Tempo
    track.setTempo(song.bpm || 120);

    // Section name as track name
    track.addEvent(
      new MidiWriter.NoteEvent({
        pitch: [],
        duration: '1',
        startTick: 0,
      })
    );

    const chords = parseChordString(section.chords);

    for (const chord of chords) {
      const notes = chordToMidiNotes(chord);
      if (notes.length === 0) continue;

      track.addEvent(
        new MidiWriter.NoteEvent({
          pitch: notes,
          duration: '1', // whole note per chord
          velocity: 80,
        })
      );
    }

    tracks.push(track);
  }

  if (tracks.length === 0) {
    alert('No chord progressions to export. Add chords to at least one section first.');
    return;
  }

  const writer = new MidiWriter.Writer(tracks);
  const dataUri = writer.dataUri();

  // Trigger download
  const a = document.createElement('a');
  a.href = dataUri;
  a.download = `${song.title.replace(/[^a-z0-9]/gi, '_') || 'song'}.mid`;
  a.click();
}
