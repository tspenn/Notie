import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { createAudioMediaRecorder } from '@/lib/audioRecorder';
import { transcribeAudioBlob } from '@/lib/assemblyAiTranscribe';
import { polishDictation } from '@/lib/dictationPostProcess';
import { micLock } from '@/lib/micLock';

type MicOwner = 'notebook-voice' | 'dashboard-voice';

/**
 * Short-clip WorkZone-style dictation: record → stop → one transcript append.
 * Second tap finishes (transcribes). cancel() discards without transcribing.
 */
export function useInlineDictation(opts: {
  owner: MicOwner;
  onTranscript: (text: string) => void;
  enabled?: boolean;
}) {
  const { owner, onTranscript, enabled = true } = opts;
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('');
  const skipTranscribeRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const finalizeUi = useCallback(() => {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      // ignore
    }
    streamRef.current = null;
    mediaRecorderRef.current = null;
    mediaChunksRef.current = [];
    micLock.release(owner);
    setListening(false);
    setStatus('');
  }, [owner]);

  /** Cancel: discard clip, do not transcribe. */
  const cancel = useCallback(() => {
    skipTranscribeRef.current = true;
    try {
      mediaRecorderRef.current?.stop();
    } catch {
      // ignore
    }
    finalizeUi();
  }, [finalizeUi]);

  /** Second Voice tap: stop recorder and let onstop transcribe. */
  const finish = useCallback(() => {
    skipTranscribeRef.current = false;
    try {
      mediaRecorderRef.current?.stop();
    } catch {
      // ignore
    }
  }, []);

  const start = useCallback(() => {
    if (!enabled) return;
    if (listening) {
      finish();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Voice input unavailable', {
        description: 'This device cannot record audio for dictation.',
      });
      return;
    }

    skipTranscribeRef.current = false;
    setListening(true);
    setStatus('Listening… press Stop when done');

    micLock.acquire(owner, () => {
      skipTranscribeRef.current = true;
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        // ignore
      }
      finalizeUi();
    });

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        streamRef.current = stream;
        try {
          mediaChunksRef.current = [];
          const rec = createAudioMediaRecorder(stream);
          mediaRecorderRef.current = rec;
          rec.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) mediaChunksRef.current.push(e.data);
          };
          rec.onstop = async () => {
            try {
              stream.getTracks().forEach((t) => t.stop());
            } catch {
              // ignore
            }
            streamRef.current = null;
            const skip = skipTranscribeRef.current;
            skipTranscribeRef.current = false;
            if (skip) {
              finalizeUi();
              return;
            }
            const blob = new Blob(mediaChunksRef.current, {
              type: rec.mimeType || 'audio/webm',
            });
            if (blob.size < 400) {
              toast.error('Recording too short', {
                description: 'Hold a moment longer, then tap Stop to finish.',
              });
              finalizeUi();
              return;
            }
            setStatus('Transcribing…');
            const result = await transcribeAudioBlob(blob);
            if (result.ok) {
              const cleaned = polishDictation(result.text);
              if (cleaned) onTranscriptRef.current(cleaned);
              else {
                toast.error('Dictation failed', {
                  description: 'No speech detected. Try again a bit louder or longer.',
                });
              }
            }
            finalizeUi();
          };
          rec.start(250);
        } catch (e) {
          console.warn('MediaRecorder failed:', e);
          micLock.release(owner);
          setListening(false);
          setStatus('');
          toast.error('Voice input unavailable', {
            description: 'Your browser cannot record audio for dictation.',
          });
        }
      })
      .catch(() => {
        micLock.release(owner);
        setListening(false);
        setStatus('');
        toast.error('Microphone access denied');
      });
  }, [enabled, listening, finish, owner, finalizeUi]);

  useEffect(() => {
    return () => {
      skipTranscribeRef.current = true;
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        // ignore
      }
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      micLock.release(owner);
    };
  }, [owner]);

  return {
    listening,
    status,
    startOrFinish: start,
    cancel,
  };
}
