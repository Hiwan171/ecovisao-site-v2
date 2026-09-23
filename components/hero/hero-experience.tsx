"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { gsap } from "gsap";
import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useMagnetic } from "../cursor/use-magnetic";
import { JumpVeil } from "../nav/jump-veil";
import { SectionMenu } from "../nav/section-menu";
import { StageSequence } from "../stage/stage-sequence";
import type { CrownPosition } from "./hero-scene";
import { LoadingScreen } from "./loading-screen";
import { useReducedMotion } from "./use-reduced-motion";

const HeroScene = dynamic(
  () => import("./hero-scene").then((module) => module.HeroScene),
  { ssr: false },
);

/** Where the crown sits until the scene reports the real thing. */
const DEFAULT_CROWN: CrownPosition = { x: 0.74, y: 0.46 };

/** How long the hero's words wait after the loader's ring opens, in seconds. */
const TEXT_DELAY = 0.4;

/**
 * A lost WebGL context (GPU driver hiccup, memory pressure, too many contexts
 * open) is usually transient, not a real absence of WebGL support. Losing it
 * once used to be treated as final — the poster stayed up for the rest of the
 * visit. This many fresh tries, each a brand new canvas and context rather than
 * an attempt to resurrect the dead one, before actually giving up.
 */
const MAX_SCENE_RETRIES = 3;
const SCENE_RETRY_DELAY_MS = 500;

class SceneErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function HeroExperience() {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [sceneReady, setSceneReady] = useState(false);
  const [assetProgress, setAssetProgress] = useState(0);
  const [sceneUnavailable, setSceneUnavailable] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [heroActive, setHeroActive] = useState(true);
  const [crown, setCrown] = useState(DEFAULT_CROWN);
  // The tree's own poster paints instantly; the WebGL scene behind it is the
  // heaviest script on the page (Three.js + drei), and mounting it in the same
  // tick as everything else has it competing with the loader's own first paint
  // for the main thread. One idle turn is enough to let that paint land first —
  // the loader's minimum hold (see loading-screen.tsx) hides the rest anyway.
  const [mountScene, setMountScene] = useState(false);
  // True once the cream wipe has swallowed the whole hero. Nothing underneath
  // can be seen, so the scene stops rendering and the hero stops being focusable.
  const [covered, setCovered] = useState(false);
  const crownRef = useRef(DEFAULT_CROWN);
  const textDelay = useRef(0);
  const sceneRetries = useRef(0);
  const sceneRetryTimer = useRef<number | null>(null);
  const [sceneKey, setSceneKey] = useState(0);
  const headerCtaRef = useMagnetic<HTMLAnchorElement>();
  const primaryCtaRef = useMagnetic<HTMLAnchorElement>();

  const handleSceneReady = useCallback(() => {
    // A working frame is the sign the scene is actually healthy again — including
    // after a retry — so whatever budget was spent on getting here is refunded.
    sceneRetries.current = 0;
    setSceneReady(true);
    setSceneUnavailable(false);
  }, []);
  const handleSceneUnavailable = useCallback(() => {
    if (sceneRetries.current < MAX_SCENE_RETRIES) {
      sceneRetries.current += 1;
      // A new canvas gets a new context outright, rather than waiting on
      // whether the browser ever fires `webglcontextrestored` for the old one.
      sceneRetryTimer.current = window.setTimeout(() => {
        setSceneKey((key) => key + 1);
      }, SCENE_RETRY_DELAY_MS);
      return;
    }

    setSceneReady(true);
    setSceneUnavailable(true);
  }, []);

  useEffect(() => {
    return () => {
      if (sceneRetryTimer.current !== null) window.clearTimeout(sceneRetryTimer.current);
    };
  }, []);

  useEffect(() => {
    const ric = window.requestIdleCallback ?? ((cb: IdleRequestCallback) => window.setTimeout(cb, 1));
    const cic = window.cancelIdleCallback ?? window.clearTimeout;
    const id = ric(() => setMountScene(true));
    return () => cic(id);
  }, []);
  const handleIntroComplete = useCallback((reason: "auto" | "skip") => {
    // On the way out of the loader the hero starts revealing as the ring opens, so
    // its words wait a beat for the ring to reach them.
    textDelay.current = reason === "skip" ? 0 : TEXT_DELAY;
    setIntroComplete(true);

    if (reason === "skip") {
      window.requestAnimationFrame(() => heroRef.current?.focus({ preventScroll: true }));
    }
  }, []);

  /** Where the tree's crown is on screen: the loader's node lands there. */
  const getCrown = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;

    const bounds = stage.getBoundingClientRect();
    return {
      x: bounds.left + crownRef.current.x * bounds.width,
      y: bounds.top + crownRef.current.y * bounds.height,
    };
  }, []);

  useEffect(() => {
    crownRef.current = crown;
  }, [crown]);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const observer = new IntersectionObserver(
      ([entry]) => setHeroActive(entry.isIntersecting),
      { threshold: 0.02 },
    );

    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!introComplete || !rootRef.current) return;

    if (reducedMotion) {
      gsap.set("[data-reveal]", { opacity: 1, y: 0 });
      gsap.set(".hero-title__line > span", { transform: "translateY(0)" });
      return;
    }

    const context = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
      const wait = textDelay.current;

      timeline
        // A plain fade: the tree itself never moves.
        .to(".hero-tree", { opacity: 1, duration: 0.62, ease: "power2.out" }, 0)
        .to(".hero-title__line > span", {
          y: 0,
          duration: 0.92,
          stagger: 0.075,
          ease: "power4.out",
        }, 0.08 + wait)
        .to("[data-reveal]", {
          opacity: 1,
          y: 0,
          duration: 0.72,
          stagger: 0.065,
        }, 0.34 + wait)
        .set(".hero-tree, .hero-title__line > span", { willChange: "auto" }, 1.9 + wait);
    }, rootRef);

    return () => context.revert();
  }, [introComplete, reducedMotion]);

  return (
    <div ref={rootRef} className={`experience${introComplete ? " experience--ready" : ""}`}>
      <LoadingScreen
        sceneReady={sceneReady}
        assetProgress={assetProgress}
        reducedMotion={reducedMotion}
        getCrown={getCrown}
        onComplete={handleIntroComplete}
      />

      {/* How far through the whole pinned journey the visitor is. Outside `.stage`
          on purpose: that div is pinned and must stay in the flow, while this stays
          fixed to the viewport for the entire scroll. */}
      {!reducedMotion && (
        <>
          <div
            className={`scroll-progress${introComplete ? " scroll-progress--visible" : ""}`}
            aria-hidden="true"
          >
            <div className="scroll-progress__fill" ref={progressRef} />
          </div>
          <JumpVeil rootRef={veilRef} />
        </>
      )}

      <div className="stage" ref={stageRef}>
        <section
          id="top"
          ref={heroRef}
          className="hero"
          aria-labelledby="hero-title"
          aria-hidden={!introComplete}
          inert={!introComplete || covered}
          tabIndex={-1}
        >
          <div className="hero__ambient" aria-hidden="true" />

          <div
            className={`hero-tree${sceneReady && !sceneUnavailable && !reducedMotion ? " hero-tree--loaded" : ""}${sceneUnavailable ? " hero-tree--fallback" : ""}`}
            aria-hidden="true"
          >
            {/* Both posters are frames captured from this very scene, one per
                breakpoint framing. <picture> keeps the unused one off the wire. */}
            <picture className="hero-tree__poster">
              <source media="(max-width: 767px)" srcSet="/images/tree-poster-mobile.webp" />
              <img src="/images/tree-poster.webp" alt="" fetchPriority="high" decoding="async" />
            </picture>
            {!reducedMotion && mountScene && (
              <SceneErrorBoundary key={sceneKey} onError={handleSceneUnavailable}>
                <HeroScene
                  active={heroActive && !covered}
                  onReady={handleSceneReady}
                  onUnavailable={handleSceneUnavailable}
                  onFraming={setCrown}
                  onProgress={setAssetProgress}
                />
              </SceneErrorBoundary>
            )}
            <div className="hero-tree__veil" />
          </div>

          <div className="hero__atmosphere" aria-hidden="true" />

          <header className="site-header" data-reveal>
            <a className="brand" href="#top" aria-label="Ecovisão — início">
              <Image
                src="/brand/ecovisao-logo-on-dark.svg"
                alt="Ecovisão Consultoria"
                width={154}
                height={58}
                unoptimized
              />
            </a>

            <div className="site-header__descriptor" aria-label="Áreas de atuação">
              <span>Gestão</span>
              <i />
              <span>Estratégia</span>
              <i />
              <span>PGRSS</span>
            </div>

            <nav className="site-header__nav" aria-label="Navegação principal">
              <SectionMenu />
              <a
                className="header-cta"
                href="mailto:yuri.elias@ecovisaoconsultoria.com.br"
                ref={headerCtaRef}
                data-cursor="hover"
              >
                Fale com a Ecovisão
                <span aria-hidden="true">↗</span>
              </a>
            </nav>
          </header>

          <div className="hero__content">
            <p className="hero__eyebrow" data-reveal>
              <span aria-hidden="true" />
              Consultoria empresarial <b>·</b> Especialistas em PGRSS
            </p>

            <h1 id="hero-title" className="hero-title">
              <span className="hero-title__line"><span>Seu negócio é</span></span>
              <span className="hero-title__line"><span>um <em>ecossistema.</em></span></span>
              <span className="hero-title__line"><span>Nós enxergamos</span></span>
              <span className="hero-title__line"><span>o todo.</span></span>
            </h1>

            <div className="hero__lower">
              <p className="hero__summary" data-reveal>
                Conectamos pessoas, processos e estratégia para transformar complexidade em
                crescimento responsável.
              </p>

              <div className="hero__actions" data-reveal>
                <a
                  className="button button--primary"
                  href="mailto:yuri.elias@ecovisaoconsultoria.com.br?subject=Quero%20agendar%20um%20diagn%C3%B3stico"
                  ref={primaryCtaRef}
                  data-cursor="hover"
                >
                  <span>Solicitar um diagnóstico</span>
                  <i aria-hidden="true">↗</i>
                </a>
                <a className="button button--text" href="#visao" data-cursor="hover">
                  Conheça nossa abordagem
                  <span aria-hidden="true">↓</span>
                </a>
              </div>
            </div>
          </div>

          <div className="hero__side-note" data-reveal aria-hidden="true">
            <span>01</span>
            <i />
            <span>Visão completa</span>
          </div>

          <a className="hero__scroll" href="#visao" data-reveal>
            <span className="hero__scroll-line" aria-hidden="true"><i /></span>
            Continue para explorar
          </a>
        </section>

        <StageSequence
          stageRef={stageRef}
          ready={introComplete}
          staticMode={reducedMotion}
          covered={covered}
          crown={crown}
          onCover={setCovered}
          progressRef={progressRef}
          veilRef={veilRef}
        />
      </div>
    </div>
  );
}
