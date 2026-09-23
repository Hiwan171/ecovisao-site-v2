"use client";

import Image from "next/image";
import { gsap } from "gsap";
import { useCallback, useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };

type LoadingScreenProps = {
  sceneReady: boolean;
  /** How much of the scene's assets have arrived, 0..100 (0 until the scene starts loading). */
  assetProgress: number;
  reducedMotion: boolean;
  /** Where the tree's crown is on screen, if the scene has said. */
  getCrown: () => Point | null;
  /**
   * Called when the hero should start revealing. On the way out that is the moment
   * the ring opens, so the hero comes up inside the ring instead of after it.
   */
  onComplete: (reason: "auto" | "skip") => void;
};

/**
 * The way out, in seconds from when it starts:
 *  - the orange node the three lines converged into leaves along the "Visão
 *    integrada" line and travels to the tree's crown, drawing a trail;
 *  - where it lands a ring is born, with the dial of ticks the lens of section 03
 *    wears, and grows until the forest has opened onto the hero.
 * It is the same gesture the rest of the site makes from the crown (the wipe, the
 * iris, the lens), so the loader hands over to the hero in the site's own language.
 */
const EXIT = {
  travel: { at: 0.08, for: 0.7 },
  open: { at: 0.68, for: 1.05 },
  trailFade: { at: 0.72, for: 0.4 },
} as const;

/** Small on purpose: the "100" and the node's pulse should be seen before it leaves. */
const EXIT_DELAY_MS = 190;
const SKIP_FADE_MS = 320;
/** The absolute longest the arrival ever holds the screen, scene or no scene.
 * On a slow connection this stops being a safety net and becomes the common
 * case — there is a static poster of the tree waiting under the scene for
 * exactly that reason, so cutting the wait short here never leaves a gap. */
const FALLBACK_MS = 2400;

/** Set once the full journey has played, so a reload or a return later in the same
 * tab gets straight to the content instead of the whole arrival again. */
const INTRO_SEEN_KEY = "ecovisao:intro-seen";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clamp01 = (value: number) => clamp(value, 0, 1);
const smooth = (t: number) => t * t * (3 - 2 * t);
const seg = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));

export function LoadingScreen({
  sceneReady,
  assetProgress,
  reducedMotion,
  getCrown,
  onComplete,
}: LoadingScreenProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [visible, setVisible] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<SVGSVGElement>(null);
  const exitRef = useRef<gsap.core.Timeline | null>(null);
  const startedAt = useRef(0);
  const completedRef = useRef(false);
  const fallbackTimerRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);

  const phase = displayProgress >= 91 ? 3 : displayProgress >= 67 ? 2 : displayProgress >= 34 ? 1 : 0;

  /** Skipping wants the content now: no journey, just a quick fade. */
  const quickExit = useCallback(() => {
    const loader = loaderRef.current;
    setExiting(true);
    onComplete("skip");

    if (loader) {
      loader.style.transition = `opacity ${SKIP_FADE_MS}ms ease`;
      loader.style.opacity = "0";
    }
    timersRef.current.push(window.setTimeout(() => setVisible(false), SKIP_FADE_MS + 40));
  }, [onComplete]);

  const playExit = useCallback(() => {
    const loader = loaderRef.current;
    const veil = veilRef.current;
    if (!loader || !veil) {
      setExiting(true);
      onComplete("auto");
      setVisible(false);
      return;
    }

    const box = loader.getBoundingClientRect();
    const W = box.width;
    const H = box.height;

    // The node the lines converged into is where the journey starts.
    const nodeBox = loader.querySelector(".loader__node")?.getBoundingClientRect();
    const from: Point = nodeBox
      ? { x: nodeBox.left + nodeBox.width / 2 - box.left, y: nodeBox.top + nodeBox.height / 2 - box.top }
      : { x: W / 2, y: H / 2 };
    const seedRadius = nodeBox ? nodeBox.width / 2 : 5;

    const crown = getCrown();
    const to: Point = crown
      ? { x: clamp(crown.x - box.left, W * 0.08, W * 0.92), y: clamp(crown.y - box.top, H * 0.12, H * 0.88) }
      : { x: W * 0.74, y: H * 0.46 };
    const maxRadius =
      Math.max(
        Math.hypot(to.x, to.y),
        Math.hypot(W - to.x, to.y),
        Math.hypot(to.x, H - to.y),
        Math.hypot(W - to.x, H - to.y),
      ) + 8;

    const find = <E extends Element>(selector: string) => veil.querySelector(selector) as E;
    const base = find<SVGPathElement>(".loader__veil-base");
    const trail = find<SVGPathElement>(".loader__trail");
    const gradient = find<SVGLinearGradientElement>("#loader-trail");
    const rim = find<SVGCircleElement>(".loader__rim");
    const ticks = find<SVGCircleElement>(".loader__ticks");
    const halo = find<SVGCircleElement>(".loader__seed-halo");
    const seed = find<SVGCircleElement>(".loader__seed");

    // The path leaves along the line that reads "Visão integrada" (horizontally) and
    // lands on the crown; on a tall, narrow screen it runs vertically instead.
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy) * 0.8;
    const c1: Point = horizontal ? { x: from.x + dx * 0.55, y: from.y } : { x: from.x, y: from.y + dy * 0.55 };
    const c2: Point = horizontal ? { x: to.x - dx * 0.45, y: to.y } : { x: to.x, y: to.y - dy * 0.45 };
    const curve = `M${from.x.toFixed(1)} ${from.y.toFixed(1)} C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;

    // Shown first: an element that is not rendered cannot be measured.
    veil.style.display = "block";
    veil.setAttribute("viewBox", `0 0 ${W} ${H}`);
    trail.setAttribute("d", curve);
    gradient.setAttribute("x1", from.x.toFixed(1));
    gradient.setAttribute("y1", from.y.toFixed(1));
    gradient.setAttribute("x2", to.x.toFixed(1));
    gradient.setAttribute("y2", to.y.toFixed(1));
    const length = trail.getTotalLength();
    trail.style.strokeDasharray = `${length}`;
    trail.style.strokeDashoffset = `${length}`;

    const place = (point: Point, r: number) => {
      [seed, halo].forEach((circle) => {
        circle.setAttribute("cx", point.x.toFixed(1));
        circle.setAttribute("cy", point.y.toFixed(1));
      });
      seed.setAttribute("r", r.toFixed(1));
      halo.setAttribute("r", (r * 2.8).toFixed(1));
    };
    place(from, seedRadius);

    const hole = (r: number) =>
      `M0 0H${W}V${H}H0Z` +
      (r > 0.5 ? `M${(to.x - r).toFixed(1)} ${to.y.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0Z` : "");

    // From this frame on the veil is the loader's ground. It is the same colour as
    // the loader's own background, so nothing changes on screen; the difference is
    // that the veil can have a hole in it.
    base.setAttribute("d", hole(0));
    loader.style.background = "transparent";
    setExiting(true);

    const state = { travel: 0, open: 0 };

    const paintTravel = () => {
      const u = state.travel;
      const point = trail.getPointAtLength(u * length);
      place(point, seedRadius + u * 3);
      trail.style.strokeDashoffset = `${length * (1 - u)}`;
    };

    const paintOpen = () => {
      const r = state.open * maxRadius;
      const grown = state.open;
      base.setAttribute("d", hole(r));

      rim.setAttribute("cx", to.x.toFixed(1));
      rim.setAttribute("cy", to.y.toFixed(1));
      rim.setAttribute("r", r.toFixed(1));
      ticks.setAttribute("cx", to.x.toFixed(1));
      ticks.setAttribute("cy", to.y.toFixed(1));
      ticks.setAttribute("r", (r + 7).toFixed(1));
      ticks.style.strokeDasharray = `1 ${Math.max(1, (2 * Math.PI * (r + 7)) / 90 - 1).toFixed(2)}`;

      // The ring is there from its birth, and leaves as the forest finishes opening.
      const ring = smooth(seg(grown, 0, 0.03)) * (1 - smooth(seg(grown, 0.45, 0.92)));
      rim.style.opacity = ring.toFixed(3);
      ticks.style.opacity = (ring * 0.9).toFixed(3);

      // The node has done its job once the ring has room around it.
      const fade = 1 - smooth(seg(grown, 0.02, 0.16));
      seed.style.opacity = fade.toFixed(3);
      halo.style.opacity = fade.toFixed(3);
    };

    const timeline = gsap.timeline({
      onComplete: () => setVisible(false),
    });
    exitRef.current = timeline;

    timeline
      .to(state, { travel: 1, duration: EXIT.travel.for, ease: "power2.inOut", onUpdate: paintTravel }, EXIT.travel.at)
      .to(trail, { opacity: 0, duration: EXIT.trailFade.for, ease: "power1.out" }, EXIT.trailFade.at)
      .call(() => onComplete("auto"), [], EXIT.open.at)
      .to(state, { open: 1, duration: EXIT.open.for, ease: "power2.inOut", onUpdate: paintOpen }, EXIT.open.at);
  }, [getCrown, onComplete]);

  const finishIntro = useCallback(
    (exitDelay = EXIT_DELAY_MS, reason: "auto" | "skip" = "auto") => {
      if (completedRef.current) return;

      completedRef.current = true;
      setDisplayProgress(100);
      try {
        sessionStorage.setItem(INTRO_SEEN_KEY, "1");
      } catch {
        // Private mode or a locked-down browser: nothing to remember, plays again next time.
      }

      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
      }

      if (reason === "skip") {
        quickExit();
        return;
      }

      timersRef.current.push(window.setTimeout(playExit, exitDelay));
    },
    [playExit, quickExit],
  );

  useEffect(() => {
    startedAt.current = performance.now();

    // Only a reduced-motion preference skips it outright; a return visit this same
    // tab gets the quick fade instead of the full journey played once already.
    if (reducedMotion) {
      const skipTimer = window.setTimeout(() => {
        setVisible(false);
        onComplete("auto");
      }, 0);

      return () => window.clearTimeout(skipTimer);
    }

    let seenAlready = false;
    try {
      seenAlready = sessionStorage.getItem(INTRO_SEEN_KEY) === "1";
    } catch {
      // No storage to read: treat it as a first visit.
    }
    if (seenAlready) {
      // Deferred a tick: called straight from mount, dev's double-invoke of effects
      // would fire this, then run this same effect's cleanup before the fade's own
      // timer gets a turn — clearing it before it ever runs. A macrotask lands
      // after that dance has settled either way, in dev or in production.
      const skipTimer = window.setTimeout(() => finishIntro(0, "skip"), 0);
      return () => window.clearTimeout(skipTimer);
    }

    fallbackTimerRef.current = window.setTimeout(() => finishIntro(), FALLBACK_MS);

    return () => {
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
      }
    };
  }, [finishIntro, onComplete, reducedMotion]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(window.clearTimeout);
      exitRef.current?.kill();
    };
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
    const fallbackReached = elapsed >= FALLBACK_MS;

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
      ref={loaderRef}
      className={`loader${exiting ? " loader--exiting" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-busy={!exiting}
      aria-label="Carregando a experiência Ecovisão"
    >
      {/* The loader's ground is drawn twice over its life: a soft glow while it waits,
          and, once it leaves, a veil that can have a ring-shaped hole in it. */}
      <svg ref={veilRef} className="loader__veil" aria-hidden="true" preserveAspectRatio="none">
        <defs>
          <linearGradient id="loader-trail" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#b8eda3" stopOpacity="0" />
            <stop offset="0.65" stopColor="#b8eda3" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffa013" stopOpacity="1" />
          </linearGradient>
        </defs>
        <path className="loader__veil-base" fillRule="evenodd" />
        <path className="loader__trail" />
        <circle className="loader__ticks" />
        <circle className="loader__rim" />
        <circle className="loader__seed-halo" />
        <circle className="loader__seed" />
      </svg>
      <div className="loader__glow" aria-hidden="true" />

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
          fetchPriority="high"
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
