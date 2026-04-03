import { useState, useRef, useEffect } from 'react';
import type { VoiceMemoData } from '../types';

interface Props {
  memo: VoiceMemoData | null;
  onSave: (memo: VoiceMemoData) => void;
  onDelete: () => void;
}

type RecordState = 'idle' | 'recording' | 'playing';

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VoiceMemo({ memo, onSave, onDelete }: Props) {
  const [state, setState] = useState<RecordState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          onSave({
            id: crypto.randomUUID(),
            blob: reader.result as string,
            duration: elapsed,
            createdAt: Date.now(),
          });
        };
        reader.readAsDataURL(blob);
      };

      mr.start();
      startTimeRef.current = Date.now();
      setState('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);
    } catch {
      setError('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setState('idle');
  };

  const playMemo = () => {
    if (!memo) return;
    audioRef.current = new Audio(memo.blob);
    audioRef.current.play();
    setState('playing');
    audioRef.current.onended = () => setState('idle');
  };

  const stopPlaying = () => {
    audioRef.current?.pause();
    setState('idle');
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      {/* Record / Stop recording */}
      {state === 'idle' && !memo && (
        <button
          onClick={startRecording}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-gray-300 hover:border-rose-400 hover:text-rose-600 transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
          Record memo
        </button>
      )}

      {state === 'recording' && (
        <button
          onClick={stopRecording}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-rose-100 border border-rose-400 text-rose-700 animate-pulse"
        >
          <span className="w-2 h-2 rounded-full bg-rose-600 inline-block" />
          {formatDuration(elapsed)} — Stop
        </button>
      )}

      {/* Playback controls */}
      {memo && state === 'idle' && (
        <>
          <button
            onClick={playMemo}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-gray-300 hover:border-accent hover:text-accent transition-colors"
          >
            ▶ {formatDuration(memo.duration)}
          </button>
          <button
            onClick={startRecording}
            className="text-xs text-muted hover:text-ink"
            title="Re-record"
          >
            ↺ Re-record
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-muted hover:text-rose-500"
            title="Delete memo"
          >
            ✕
          </button>
        </>
      )}

      {memo && state === 'playing' && (
        <button
          onClick={stopPlaying}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-accent-light border border-accent text-accent"
        >
          ■ Stop
        </button>
      )}

      {error && <span className="text-xs text-rose-500">{error}</span>}
    </div>
  );
}
