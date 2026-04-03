export interface RhymeWord {
  word: string;
  score: number;
  numSyllables: number;
}

// Fetch perfect rhymes + near-rhymes from Datamuse API
export async function fetchRhymes(word: string): Promise<RhymeWord[]> {
  const clean = word.replace(/[^a-zA-Z']/g, '').toLowerCase();
  if (!clean) return [];

  const [perfectRes, nearRes] = await Promise.all([
    fetch(`https://api.datamuse.com/words?rel_rhy=${encodeURIComponent(clean)}&md=s&max=16`),
    fetch(`https://api.datamuse.com/words?rel_nry=${encodeURIComponent(clean)}&md=s&max=8`),
  ]);

  const [perfect, near]: [RhymeWord[], RhymeWord[]] = await Promise.all([
    perfectRes.ok ? perfectRes.json() : [],
    nearRes.ok ? nearRes.json() : [],
  ]);

  // Deduplicate: perfect rhymes first, then near-rhymes not already present
  const seen = new Set(perfect.map(w => w.word));
  const combined = [
    ...perfect,
    ...near.filter(w => !seen.has(w.word)),
  ];

  return combined.slice(0, 20);
}
