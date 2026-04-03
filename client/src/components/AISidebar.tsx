import { useState, useRef, useEffect } from 'react';
import type { ChatMessage, Song } from '../types';

interface Props {
  song: Song;
}

export default function AISidebar({ song }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hey! I'm your co-writer. Tell me what you're working on — I can suggest lyrics, next lines, chord progressions, song structure, or anything else. What do you need?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setStreaming(true);

    // Add empty assistant message to stream into
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('http://localhost:3001/api/cowrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          songContext: {
            title: song.title,
            key: song.key,
            bpm: song.bpm,
            sections: song.sections.map(s => ({
              type: s.type,
              label: s.label,
              chords: s.chords,
              lyrics: s.lyrics,
            })),
          },
        }),
      });

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break;

          try {
            const { text, error } = JSON.parse(payload);
            if (error) throw new Error(error);
            if (text) {
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = {
                  role: 'assistant',
                  content: next[next.length - 1].content + text,
                };
                return next;
              });
            }
          } catch {
            // malformed chunk — skip
          }
        }
      }
    } catch (err) {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content: `Sorry, something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}. Make sure the server is running with a valid ANTHROPIC_API_KEY.`,
        };
        return next;
      });
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <span className="text-lg">✨</span>
        <span className="font-semibold text-sm text-ink">AI Co-writer</span>
        <span className="ml-auto text-xs text-muted">claude-opus-4-6</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-accent text-white rounded-br-sm'
                  : 'bg-gray-100 text-ink rounded-bl-sm'
              }`}
            >
              {msg.content}
              {i === messages.length - 1 && streaming && msg.role === 'assistant' && (
                <span className="inline-block w-1 h-3 ml-0.5 bg-gray-400 animate-pulse align-middle" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-3 flex gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
          rows={2}
          disabled={streaming}
          className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          className="self-end px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-40 transition-colors"
        >
          {streaming ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
