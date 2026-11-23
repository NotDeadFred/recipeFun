"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface CookTimer {
  id: string;
  label: string;
  totalSeconds: number;
  /** Wall-clock end time while running; keeps timers accurate if the tab sleeps. */
  endsAt: number | null;
  /** Seconds left when paused. */
  remaining: number;
  done: boolean;
}

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.3);
    });
  } catch {
    /* audio not available */
  }
  navigator.vibrate?.([300, 150, 300]);
}

export function timerRemaining(t: CookTimer, now: number): number {
  return t.endsAt ? Math.max(0, Math.ceil((t.endsAt - now) / 1000)) : t.remaining;
}

export function useTimers(onFinished?: (timer: CookTimer) => void) {
  const [timers, setTimers] = useState<CookTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const finishedRef = useRef(onFinished);
  const timersRef = useRef(timers);
  useLayoutEffect(() => {
    finishedRef.current = onFinished;
    timersRef.current = timers;
  });

  // Tick while any timer runs; detect finished timers on each tick.
  const anyRunning = timers.some((t) => t.endsAt && !t.done);
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      const finished = timersRef.current.filter((t) => t.endsAt && !t.done && t.endsAt <= tick);
      if (finished.length === 0) return;
      const ids = new Set(finished.map((t) => t.id));
      timersRef.current = timersRef.current.map((t) => (ids.has(t.id) ? { ...t, done: true } : t));
      setTimers((all) => all.map((t) => (ids.has(t.id) ? { ...t, done: true, endsAt: null, remaining: 0 } : t)));
      finished.forEach((t) => {
        beep();
        finishedRef.current?.(t);
      });
    }, 250);
    return () => clearInterval(id);
  }, [anyRunning]);

  const start = useCallback((id: string, label: string, seconds: number) => {
    setNow(Date.now());
    setTimers((all) => {
      const existing = all.find((t) => t.id === id);
      const remaining = existing && !existing.done && existing.remaining > 0 ? existing.remaining : seconds;
      const timer: CookTimer = { id, label, totalSeconds: seconds, remaining, endsAt: Date.now() + remaining * 1000, done: false };
      return existing ? all.map((t) => (t.id === id ? timer : t)) : [...all, timer];
    });
  }, []);

  const pause = useCallback((id: string) => {
    setTimers((all) =>
      all.map((t) => (t.id === id && t.endsAt ? { ...t, remaining: timerRemaining(t, Date.now()), endsAt: null } : t)),
    );
  }, []);

  const dismiss = useCallback((id: string) => setTimers((all) => all.filter((t) => t.id !== id)), []);

  return { timers, now, start, pause, dismiss };
}
