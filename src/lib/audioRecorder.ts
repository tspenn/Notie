/**
 * Pick a MediaRecorder mime type that works across Chrome / Edge / Safari / mobile.
 */
export function pickAudioMimeTypeForMediaRecorder(): string | undefined {
  const MR = typeof MediaRecorder !== 'undefined' ? MediaRecorder : null;
  if (!MR || typeof MR.isTypeSupported !== 'function') return undefined;
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/mp4;codecs=mp4a.40.2',
  ];
  for (const t of types) {
    if (MR.isTypeSupported(t)) return t;
  }
  return undefined;
}

export function createAudioMediaRecorder(stream: MediaStream): MediaRecorder {
  const mimeType = pickAudioMimeTypeForMediaRecorder();
  if (mimeType) {
    try {
      return new MediaRecorder(stream, { mimeType });
    } catch {
      // fall through
    }
  }
  return new MediaRecorder(stream);
}
