import { toast } from 'sonner';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  return btoa(binary);
}

export type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'limit' | 'too_long' | 'error' };

/**
 * Transcribe a recorded clip via shared Supabase `assemblyai-transcribe`.
 * Toasts for quota / size / failures.
 */
export async function transcribeAudioBlob(audioBlob: Blob): Promise<TranscribeResult> {
  if (!isSupabaseConfigured) {
    toast.error('Dictation unavailable', {
      description: 'Cloud connection is not configured on this device.',
    });
    return { ok: false, reason: 'error' };
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) throw new Error('No auth session');

    const audio_base64 = await blobToBase64(audioBlob);
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assemblyai-transcribe`;

    for (let attempt = 0; attempt < 4; attempt++) {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio_base64,
          mime_type: audioBlob.type || undefined,
          language_code: (navigator.language || 'en').toLowerCase().startsWith('en')
            ? 'en'
            : undefined,
        }),
      });

      if (resp.status === 202) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      if (resp.status === 429) {
        const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
        const used = data.minutesUsed as number | undefined;
        const included = data.minutesIncluded as number | undefined;
        const detail =
          typeof used === 'number' && typeof included === 'number'
            ? `You've used ${used}/${included} dictation minutes for this billing period.`
            : String(
                data.message ||
                  'You have reached your dictation minutes limit for this billing period.',
              );
        toast.error('Dictation limit reached', { description: detail });
        return { ok: false, reason: 'limit' };
      }
      if (resp.status === 413) {
        const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
        toast.error('Dictation too long', {
          description: String(data.message || 'Please record a shorter clip for now.'),
        });
        return { ok: false, reason: 'too_long' };
      }
      if (!resp.ok) {
        const raw = await resp.text().catch(() => '');
        let msg = '';
        try {
          const data = raw ? JSON.parse(raw) : {};
          msg = String(
            (data as { message?: string; error?: string }).message ||
              (data as { error?: string }).error ||
              '',
          );
        } catch {
          msg = raw;
        }
        if (msg) toast.error('Dictation unavailable', { description: String(msg) });
        else {
          toast.error('Dictation failed', {
            description: 'Could not transcribe audio. Please try again.',
          });
        }
        return { ok: false, reason: 'error' };
      }
      const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
      return { ok: true, text: String(data.text || '').trim() };
    }
  } catch (e) {
    console.warn('Dictation transcription failed:', e);
    toast.error('Dictation failed', {
      description: 'Could not transcribe audio. Please try again.',
    });
  }
  return { ok: false, reason: 'error' };
}
