import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import { localDb } from '@/lib/localDb';

/**
 * Port of Friday Canvas project/src/hooks/useActivityTimer.ts + WorkZone flush.
 *
 * Credit rate (WorkZone): every INVESTMENT_TIMER_CREDIT_SECONDS (30) of engaged
 * accrued seconds → 1 investment credit (same unit Canvas stores as
 * investment_minutes_today). Idle after 2 minutes; engagement window 3 minutes.
 */

const DEFAULT_IDLE_TIMEOUT_MS = 2 * 60 * 1000;
const TICK_INTERVAL_MS = 10_000;
const INVESTMENT_TIMER_CREDIT_SECONDS = 30;
const INVESTMENT_ENGAGEMENT_WINDOW_MS = 3 * 60 * 1000;

export interface ActivityTimerControls {
  accruedSeconds: number;
  isIdle: boolean;
  resetTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  recordActivity: () => void;
}

function useCanvasActivityTimer(
  active: boolean,
  opts?: {
    idleTimeoutMs?: number;
    activityRootRef?: RefObject<HTMLElement | null>;
    pauseWhenHidden?: boolean;
    allowWhenHidden?: () => boolean;
    startPaused?: boolean;
    resumeOnVisible?: boolean;
  },
): ActivityTimerControls {
  const [accruedSeconds, setAccruedSeconds] = useState(0);
  const [isIdle, setIsIdle] = useState(false);

  const accruedRef = useRef(0);
  const isIdleRef = useRef(false);
  const isPausedRef = useRef(false);
  const lastActivityRef = useRef<number>(Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleTimeoutMs = Math.max(30_000, opts?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS);
  const activityRootRef = opts?.activityRootRef;
  const resumeOnVisible = opts?.resumeOnVisible ?? true;

  const stopTimers = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (idleCheckRef.current) {
      clearInterval(idleCheckRef.current);
      idleCheckRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    accruedRef.current = 0;
    setAccruedSeconds(0);
  }, []);

  const pauseTimer = useCallback(() => {
    isPausedRef.current = true;
  }, []);

  const resumeTimer = useCallback(() => {
    isPausedRef.current = false;
    lastActivityRef.current = Date.now();
    if (isIdleRef.current) {
      isIdleRef.current = false;
      setIsIdle(false);
    }
  }, []);

  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (isIdleRef.current) {
      isIdleRef.current = false;
      setIsIdle(false);
    }
  }, []);

  const isInsideActivityRoot = useCallback(
    (target: EventTarget | null) => {
      const root = activityRootRef?.current;
      if (!root) return true;
      if (!(target instanceof Node)) return false;
      return root.contains(target);
    },
    [activityRootRef],
  );

  useEffect(() => {
    if (!active) {
      stopTimers();
      return;
    }

    lastActivityRef.current = Date.now();
    isPausedRef.current = opts?.startPaused ?? false;
    isIdleRef.current = false;
    setIsIdle(false);

    tickRef.current = setInterval(() => {
      if (!isPausedRef.current && !isIdleRef.current) {
        accruedRef.current += TICK_INTERVAL_MS / 1000;
        setAccruedSeconds(accruedRef.current);
      }
    }, TICK_INTERVAL_MS);

    idleCheckRef.current = setInterval(() => {
      const sinceActivity = Date.now() - lastActivityRef.current;
      if (!isPausedRef.current && sinceActivity >= idleTimeoutMs && !isIdleRef.current) {
        isIdleRef.current = true;
        setIsIdle(true);
      }
    }, 15_000);

    return stopTimers;
  }, [active, stopTimers, idleTimeoutMs, opts?.startPaused]);

  useEffect(() => {
    if (!active) return;

    const onActivity = (event: Event) => {
      if (!isInsideActivityRoot(event.target)) return;
      recordActivity();
    };

    const events = ['mousedown', 'keydown', 'keypress', 'touchstart', 'click', 'input', 'scroll'];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true, capture: true }));
    return () =>
      events.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
  }, [active, recordActivity, isInsideActivityRoot]);

  useEffect(() => {
    if (!active || !opts?.pauseWhenHidden) return;

    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        const allow = opts.allowWhenHidden?.() ?? false;
        if (!allow) pauseTimer();
      } else if (resumeOnVisible) {
        resumeTimer();
      }
    };

    document.addEventListener('visibilitychange', onVis);
    onVis();
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [active, opts?.pauseWhenHidden, opts?.allowWhenHidden, pauseTimer, resumeTimer, resumeOnVisible]);

  return { accruedSeconds, isIdle, resetTimer, pauseTimer, resumeTimer, recordActivity };
}

/**
 * Notebook wrapper: Canvas timer + WorkZone flush (30s → 1 credit).
 */
export function useActivityTimer(opts: {
  enabled: boolean;
  notebookId: string | null;
  activityRootRef?: RefObject<HTMLElement | null>;
  onCredit?: (minutes: number) => void;
}) {
  const hasEngagedRef = useRef(false);
  const lastEngagementAtRef = useRef(0);
  const flushedSecondsRef = useRef(0);
  const onCreditRef = useRef(opts.onCredit);
  onCreditRef.current = opts.onCredit;

  const { accruedSeconds, isIdle, pauseTimer, resumeTimer, recordActivity, resetTimer } =
    useCanvasActivityTimer(opts.enabled && Boolean(opts.notebookId), {
      activityRootRef: opts.activityRootRef,
      pauseWhenHidden: true,
      startPaused: true,
      idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
    });

  const recordInvestmentEngagement = useCallback(() => {
    hasEngagedRef.current = true;
    lastEngagementAtRef.current = Date.now();
    recordActivity();
    resumeTimer();
  }, [recordActivity, resumeTimer]);

  // WorkZone: pause unless engaged within 3 minutes and not idle.
  useEffect(() => {
    if (!opts.enabled || !opts.notebookId) return;
    const id = window.setInterval(() => {
      if (!hasEngagedRef.current) {
        pauseTimer();
        return;
      }
      const since = Date.now() - lastEngagementAtRef.current;
      if (since > INVESTMENT_ENGAGEMENT_WINDOW_MS || isIdle) {
        pauseTimer();
      } else {
        resumeTimer();
      }
    }, 5_000);
    return () => window.clearInterval(id);
  }, [opts.enabled, opts.notebookId, isIdle, pauseTimer, resumeTimer]);

  // Capture engagement inside the notebook root (or window if none).
  useEffect(() => {
    if (!opts.enabled || !opts.notebookId) return;
    const root = opts.activityRootRef?.current ?? window;
    const onEngage = () => recordInvestmentEngagement();
    const events = ['mousedown', 'keydown', 'touchstart', 'input'];
    events.forEach((e) => root.addEventListener(e, onEngage, { passive: true, capture: true }));
    return () =>
      events.forEach((e) => root.removeEventListener(e, onEngage, { capture: true } as EventListenerOptions));
  }, [opts.enabled, opts.notebookId, opts.activityRootRef, recordInvestmentEngagement]);

  // WorkZone flushMinutesToDb: floor(newSeconds / 30) credits.
  useEffect(() => {
    if (!opts.enabled || !opts.notebookId) return;
    const newSeconds = accruedSeconds - flushedSecondsRef.current;
    if (newSeconds < INVESTMENT_TIMER_CREDIT_SECONDS) return;
    const newCredits = Math.floor(newSeconds / INVESTMENT_TIMER_CREDIT_SECONDS);
    if (newCredits <= 0) return;
    flushedSecondsRef.current += newCredits * INVESTMENT_TIMER_CREDIT_SECONDS;
    localDb.creditLiveMinutes(opts.notebookId, newCredits);
    onCreditRef.current?.(newCredits);
  }, [accruedSeconds, opts.enabled, opts.notebookId]);

  useEffect(() => {
    if (!opts.enabled) {
      flushedSecondsRef.current = 0;
      hasEngagedRef.current = false;
      resetTimer();
    }
  }, [opts.enabled, resetTimer]);
}
