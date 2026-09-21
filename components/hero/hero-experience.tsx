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
  const reducedMotion = useReducedMotion();
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneUnavailable, setSceneUnavailable] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [heroActive, setHeroActive] = useState(true);
  const [crown, setCrown] = useState(DEFAULT_CROWN);
  // True once the cream wipe has swallowed the whole hero. Nothing underneath
  // can be seen, so the scene stops rendering and the hero stops being focusable.
  const [covered, setCovered] = useState(false);
  const crownRef = useRef(DEFAULT_CROWN);
  const textDelay = useRef(0);

  const handleSceneReady = useCallback(() => {
    setSceneReady(true);
    setSceneUnavailable(false);
  }, []);
  const handleSceneUnavailable = useCallback(() => {
    setSceneReady(true);
    setSceneUnavailable(true);
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
        reducedMotion={reducedMotion}
        getCrown={getCrown}
        onComplete={handleIntroComplete}
      />

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
            {!reducedMotion && (
              <SceneErrorBoundary onError={handleSceneUnavailable}>
                <HeroScene
                  active={heroActive && !covered}
                  onReady={handleSceneReady}
                  onUnavailable={handleSceneUnavailable}
                  onFraming={setCrown}
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
              <a href="#visao">Nossa visão</a>
              <a className="header-cta" href="mailto:yuri.elias@ecovisaoconsultoria.com.br">
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
                <a className="button button--primary" href="mailto:yuri.elias@ecovisaoconsultoria.com.br?subject=Quero%20agendar%20um%20diagn%C3%B3stico">
                  <span>Agendar um diagnóstico</span>
                  <i aria-hidden="true">↗</i>
                </a>
                <a className="button button--text" href="#visao">
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
        />
      </div>
    </div>
  );
}
