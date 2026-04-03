import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
const PORT = 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Stream a co-writing response from Claude
app.post('/api/cowrite', async (req, res) => {
  const { messages, songContext } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const systemPrompt = `You are an expert songwriting collaborator specializing in pop and singer-songwriter music.
You help write lyrics, suggest chord progressions, develop song structure, and provide creative direction.

Current song context:
- Title: ${songContext?.title || 'Untitled'}
- Key: ${songContext?.key || 'Not set'}
- BPM: ${songContext?.bpm || 'Not set'}
- Sections: ${songContext?.sections?.map(s => `${s.type} (chords: ${s.chords || 'none'}, lyrics: "${s.lyrics?.slice(0, 60) || 'empty'}...")`).join(', ') || 'None yet'}

Guidelines:
- Keep suggestions grounded in the song's current key and feel
- For chord suggestions, use common pop/singer-songwriter progressions
- When suggesting lyrics, match the syllable stress and rhyme scheme already established
- Be concise and creative — give options, not lectures
- If asked for chord progressions, format them clearly like: Am - G - F - C`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Claude API error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
