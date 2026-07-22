import { useEffect, useRef } from 'react';

import { localDb } from '@/lib/localDb';

/**
 * Canvas-style engagement timer: ~1 minute credit per 30s of intentional activity
 * while the Notebook is open. Credits live stub progress (Library bar can grow)
 * and the open entry's writingMinutes (finalized on Save Entry).
 */
export function useActivityTimer(opts: {
  enabled: boolean;
  notebookId: string | null;
  onCredit?: (minutes: number) => void;
}) {
  const engagedAt = useRef(0);
  const accruedSeconds = useRef(0);

  useEffect(() => {
    if (!opts.enabled || !opts.notebookId) return;

    const mark = () => {
      engagedAt.current = Date.now();
    };
    mark();

    const onPointer = () => mark();
    const onKey = () => mark();
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);

    const tick = window.setInterval(() => {
      const idleMs = Date.now() - engagedAt.current;
      if (idleMs > 3 * 60 * 1000) return;
      accruedSeconds.current += 1;
      if (accruedSeconds.current >= 30) {
        const minutes = Math.floor(accruedSeconds.current / 30);
        accruedSeconds.current -= minutes * 30;
        if (opts.notebookId) {
          localDb.creditLiveMinutes(opts.notebookId, minutes);
          opts.onCredit?.(minutes);
        }
      }
    }, 1000);

    return () => {
      window.clearInterval(tick);
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [opts.enabled, opts.notebookId, opts.onCredit]);
}
