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
import { LoadingScreen } from "./loading-screen";
import { useReducedMotion } from "./use-reduced-motion";

const HeroScene = dynamic(
  () => import("./hero-scene").then((module) => module.HeroScene),
  { ssr: false },
);

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

/**
 * The identity's waves, re-drawn so every line leaves the point where the tree
 * meets the ground and fans out across the page. They are stroke-drawn from that
 * origin outwards while the camera climbs, so the roots do not merely disappear
 * — they carry on as the 2D mark.
 */
function TopographicLines() {
  return (
    <svg className="topography" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">
      <path className="topography__lead" d="M1296 762 C1060 742 940 792 700 772 C520 757 380 800 -60 782" />
      <path className="topography__lead" d="M1288 768 C1080 786 900 848 690 830 C500 814 350 856 -60 842" />
      <path d="M1282 756 C1070 700 930 730 720 704 C560 684 400 724 -60 696" />
      <path d="M1274 752 C1080 656 920 668 730 632 C570 602 410 640 -60 606" />
      <path d="M1268 748 C1090 648 950 640 760 600 C600 562 440 592 -60 556" />
      <path className="topography__arc" d="M980 -110 C1120 70 1030 180 1180 272 C1350 376 1470 256 1690 372" />
    </svg>
  );
}

export function HeroExperience() {
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneUnavailable, setSceneUnavailable] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [heroActive, setHeroActive] = useState(true);

  const handleSceneReady = useCallback(() => {
    setSceneReady(true);
    setSceneUnavailable(false);
  }, []);
  const handleSceneUnavailable = useCallback(() => {
    setSceneReady(true);
    setSceneUnavailable(true);
  }, []);
  const handleIntroComplete = useCallback((reason: "auto" | "skip") => {
    setIntroComplete(true);

    if (reason === "skip") {
      window.requestAnimationFrame(() => heroRef.current?.focus({ preventScroll: true }));
    }
  }, []);

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

      timeline
        // Quick, so the tree is fully present while the camera still sits at the
        // root pose rather than arriving halfway up the climb.
        .to(".hero-tree", { opacity: 1, scale: 1, duration: 0.62, ease: "power2.out" }, 0)
        .to(".hero-title__line > span", {
          y: 0,
          duration: 0.92,
          stagger: 0.075,
          ease: "power4.out",
        }, 0.08)
        .to("[data-reveal]", {
          opacity: 1,
          y: 0,
          duration: 0.72,
          stagger: 0.065,
        }, 0.34)
        // Paced against the 2.6s camera rise: the lines finish arriving just as
        // the camera settles and the roots leave the frame.
        .to(".topography path", {
          strokeDashoffset: 0,
          duration: 1.95,
          stagger: 0.13,
          ease: "power2.inOut",
        }, 0.7)
        .set(".hero-tree, .hero-title__line > span", { willChange: "auto" }, 1.9);
    }, rootRef);

    return () => context.revert();
  }, [introComplete, reducedMotion]);

  return (
    <div ref={rootRef} className={`experience${introComplete ? " experience--ready" : ""}`}>
      <LoadingScreen
        sceneReady={sceneReady}
        reducedMotion={reducedMotion}
        onComplete={handleIntroComplete}
      />

      <section
        id="top"
        ref={heroRef}
        className="hero"
        aria-labelledby="hero-title"
        aria-hidden={!introComplete}
        inert={!introComplete}
        tabIndex={-1}
      >
        <TopographicLines />
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
                active={heroActive}
                reducedMotion={reducedMotion}
                revealed={introComplete}
                onReady={handleSceneReady}
                onUnavailable={handleSceneUnavailable}
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

      <section
        id="visao"
        className="vision-teaser"
        aria-labelledby="vision-title"
        aria-hidden={!introComplete}
        inert={!introComplete}
      >
        <div className="vision-teaser__index">
          <span>02</span>
          <span>Nossa visão</span>
        </div>
        <h2 id="vision-title">
          <span>Eco</span> de ecossistema.<br />
          <span>Visão</span> de análise ampla<br />
          e estratégica.
        </h2>
        <p>
          Negócios crescem quando pessoas, processos e objetivos trabalham como partes de
          um mesmo sistema.
        </p>
        <div className="vision-teaser__orb" aria-hidden="true" />
      </section>
    </div>
  );
}
