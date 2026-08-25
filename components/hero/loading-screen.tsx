"use client";

import Image from "next/image";
import { useProgress } from "@react-three/drei";
import { useCallback, useEffect, useRef, useState } from "react";

type LoadingScreenProps = {
  sceneReady: boolean;
  reducedMotion: boolean;
  onComplete: (reason: "auto" | "skip") => void;
};

/** Must match the .loader clip-path transition in globals.css. */
const EXIT_WIPE_MS = 820;

/**
 * How long after the wipe starts the hero begins revealing. Small on purpose:
 * the content should be uncovering *underneath* the wipe, so the two motions
 * read as one gesture instead of two beats with a dead pause between them.
 */
const REVEAL_LEAD_MS = 240;

export function LoadingScreen({
  sceneReady,
  reducedMotion,
  onComplete,
}: LoadingScreenProps) {
  const { progress: assetProgress } = useProgress();
  const [displayProgress, setDisplayProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [visible, setVisible] = useState(true);
  const startedAt = useRef(0);
  const completedRef = useRef(false);
  const fallbackTimerRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);

  const phase = displayProgress >= 91 ? 3 : displayProgress >= 67 ? 2 : displayProgress >= 34 ? 1 : 0;

  const finishIntro = useCallback(
    (exitDelay = 190, reason: "auto" | "skip" = "auto") => {
      if (completedRef.current) return;

      completedRef.current = true;
      setDisplayProgress(100);

      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
      }

      timersRef.current.push(
        window.setTimeout(() => setExiting(true), exitDelay),
        window.setTimeout(() => onComplete(reason), exitDelay + REVEAL_LEAD_MS),
        window.setTimeout(() => setVisible(false), exitDelay + EXIT_WIPE_MS + 60),
      );
    },
    [onComplete],
  );

  useEffect(() => {
    startedAt.current = performance.now();

    // The intro plays on every load. Only a reduced-motion preference skips it.
    if (reducedMotion) {
      const skipTimer = window.setTimeout(() => {
        setVisible(false);
        onComplete("auto");
      }, 0);

      return () => window.clearTimeout(skipTimer);
    }

    fallbackTimerRef.current = window.setTimeout(() => finishIntro(), 4500);

    return () => {
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
      }
    };
  }, [finishIntro, onComplete, reducedMotion]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(window.clearTimeout);
  }, []);

  useEffect(() => {
    if (!visible || completedRef.current) return;

    const interval = window.setInterval(() => {
      setDisplayProgress((current) => {
        if (completedRef.current) return 100;

        const elapsed = performance.now() - startedAt.current;
        const timeDriven = Math.min(88, elapsed / 22);
        const loadDriven = Math.min(90, assetProgress * 0.9);
        const target = sceneReady ? 100 : Math.max(timeDriven, loadDriven);
        const next = current + Math.max(0.2, (target - current) * 0.11);
        return Math.max(current, Math.min(target, next));
      });
    }, 32);

    return () => window.clearInterval(interval);
  }, [assetProgress, sceneReady, visible]);

  useEffect(() => {
    if (!visible || completedRef.current) return;

    const elapsed = performance.now() - startedAt.current;
    const minimumTimeReached = elapsed >= 1100;
    const readyToLeave = sceneReady && displayProgress >= 99 && minimumTimeReached;
    const fallbackReached = elapsed >= 4500;

    if (!readyToLeave && !fallbackReached) return;

    finishIntro();
  }, [displayProgress, finishIntro, sceneReady, visible]);

  useEffect(() => {
    if (!visible) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  function skipIntro() {
    finishIntro(0, "skip");
  }

  if (!visible) return null;

  const roundedProgress = Math.min(100, Math.round(displayProgress));

  return (
    <div
      className={`loader${exiting ? " loader--exiting" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-busy={!exiting}
      aria-label="Carregando a experiência Ecovisão"
    >
      <button className="loader__skip" type="button" onClick={skipIntro}>
        Ir para o conteúdo
        <span aria-hidden="true">↗</span>
      </button>

      <div className="loader__center">
        <Image
          className="loader__logo"
          src="/brand/ecovisao-logo-on-dark.svg"
          alt="Ecovisão Consultoria"
          width={180}
          height={68}
          loading="eager"
          unoptimized
        />

        <div className={`loader__diagram loader__diagram--phase-${phase}`} aria-hidden="true">
          <svg viewBox="0 0 300 90" role="presentation">
            <path className="loader__path loader__path--people" d="M96 15 C128 15 126 45 156 45" />
            <path className="loader__path loader__path--process" d="M96 45 H156" />
            <path className="loader__path loader__path--strategy" d="M96 75 C128 75 126 45 156 45" />
            <path className="loader__path loader__path--out" d="M156 45 H196" />
            <circle className="loader__node" cx="156" cy="45" r="5" />
          </svg>
          <span className="loader__label loader__label--people">Pessoas</span>
          <span className="loader__label loader__label--process">Processos</span>
          <span className="loader__label loader__label--strategy">Estratégia</span>
          <span className="loader__integrated">Visão integrada</span>
        </div>
      </div>

      <div
        className="loader__rule"
        aria-hidden="true"
        style={{ "--loader-progress": `${roundedProgress}%` } as React.CSSProperties}
      >
        <i />
      </div>

      <div className="loader__footer">
        <span>Conectando o ecossistema</span>
        <div
          className="loader__progress"
          role="progressbar"
          aria-label="Progresso de carregamento"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={roundedProgress}
        >
          <span className="loader__progress-number">
            {String(roundedProgress).padStart(2, "0")}
          </span>
          <span className="loader__progress-symbol">%</span>
        </div>
      </div>
    </div>
  );
}
