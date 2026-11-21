'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  suffix?: string;
  durationMs?: number;
  className?: string;
}

export function AnimatedNumber({
  value,
  suffix = '',
  durationMs = 420,
  className = '',
}: Props) {
  const [display, setDisplay] = useState<number>(value);
  const prevRef = useRef<number>(value);

  useEffect(() => {
    const startVal = prevRef.current === value ? 0 : prevRef.current;
    prevRef.current = value;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced || durationMs <= 0) {
      setDisplay(value);
      return;
    }

    let frameId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(startVal + (value - startVal) * eased);
      setDisplay(next);
      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [value, durationMs]);

  return (
    <span className={`tabular-nums-data ${className}`}>
      {display}
      {suffix}
    </span>
  );
}
