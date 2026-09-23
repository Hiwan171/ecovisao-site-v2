"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useMagnetic } from "../cursor/use-magnetic";
import { SectionMenu } from "../nav/section-menu";
import { CROSS_LINKS, INNOVATION_LABEL, NODES, PILLS } from "./method-engine";
import "./method.css";

type MethodProps = {
  staticMode: boolean;
  /** True once the iris has closed enough for this section to be the one on screen. */
  active: boolean;
  /** True once the lens has opened far enough to have covered the dark header. */
  opened: boolean;
  /** What is written on the paper once the lens has opened: the next section. */
  track: ReactNode;
  /** True once the section after this one has come up over it: nothing here can be reached. */
  covered: boolean;
};

const STEPS = ["Diagnóstico", "Sob medida", "Inovação"];

const MAP_NODES = [
  ...NODES.map(({ label, pain }) => ({ label, pain })),
  { label: INNOVATION_LABEL, pain: false },
];

/**
 * The company, drawn twice from the same numbers. Outside the lens it is dim and
 * unlabelled-by-comparison, as an unexamined business is; inside it, on paper, the
 * same map is legible and its pain points show. Which is which is only CSS.
 */
function MapLayer({ variant }: { variant: "raw" | "lens" }) {
  return (
    <svg className={`mp mp--${variant}`} data-mt="map" aria-hidden="true" preserveAspectRatio="none">
      <circle className="mp-ring" data-mt="ring" />

      {CROSS_LINKS.map(([a, b]) => (
        <path key={`${a}-${b}`} className="mp-cross" data-mt="cross" />
      ))}
      {NODES.map(({ label }) => (
        <path key={label} className="mp-link" data-mt="link" />
      ))}
      <path className="mp-link mp-link--innov" data-mt="innov-link" />
      <circle className="mp-ghost" data-mt="ghost" r="7" />

      <line className="mp-result" data-mt="result" />
      <circle className="mp-result-cap" data-mt="result-cap" r="0" />
      <text className="mp-result-label" data-mt="result-label">
        RESULTADOS
      </text>

      {MAP_NODES.map(({ label, pain }, i) => (
        <g key={label} data-mt="node" data-innov={i === NODES.length ? "true" : undefined}>
          <g className="mp-halo" data-mt="halo">
            <circle r="13" />
          </g>
          <circle className="mp-dot" r="0" />
          <text className="mp-label">{label}</text>
          {pain ? <text className="mp-tag">PONTO DE MELHORIA</text> : null}
        </g>
      ))}

      <circle className="mp-center-halo" data-mt="center-halo" r="10" />
      <circle className="mp-center" data-mt="center" r="0" />
      <text className="mp-label mp-label--center" data-mt="center-label">
        SEU NEGÓCIO
      </text>
    </svg>
  );
}

export function Method({ staticMode, active, opened, track, covered }: MethodProps) {
  const darkHeaderCtaRef = useMagnetic<HTMLAnchorElement>();
  const lensHeaderCtaRef = useMagnetic<HTMLAnchorElement>();
  return (
    <>
      <section
        id="abordagem"
        className={`method${staticMode ? " method--static" : ""}`}
        data-mt="dark"
        aria-labelledby="method-title"
      >
        {/* The hero's own header, cream on forest. The iris hands it back as the
            dark passes over the ink one from the section before. */}
        <header className="site-header" inert={!active || opened}>
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
              ref={darkHeaderCtaRef}
              data-cursor="hover"
            >
              Fale com a Ecovisão
              <span aria-hidden="true">↗</span>
            </a>
          </nav>
        </header>

        <MapLayer variant="raw" />

        <div className="method__copy">
          <p className="method__eyebrow" data-mt="eyebrow">
            <span aria-hidden="true" />
            03 <b>—</b> Nossa abordagem
          </p>

          <h2 id="method-title" className="sr-only">
            Nossa abordagem: diagnóstico, solução sob medida e inovação.
          </h2>

          <div className="method__slides" data-mt="slides">
            <div className="method__slide" data-mt="slide">
              <h3 className="m3-title">
                <span>Diagnóstico</span>
              </h3>
              <p className="method__lead" data-mt-line>
                Identificamos os pontos de melhoria e as dores da sua empresa.
              </p>
              <p className="method__note" data-mt-line>
                Analisamos como as partes se conectam e influenciam os resultados.
              </p>
            </div>

            <div className="method__slide" data-mt="slide">
              <h3 className="m3-title">
                <span>Sob medida</span>
              </h3>
              <p className="method__lead" data-mt-line>
                Uma solução personalizada para você.
              </p>
              <p className="method__note" data-mt-line>
                Com processos otimizados e organizados, os resultados tornam-se uma consequência
                natural.
              </p>
              <ul className="method__pills">
                {PILLS.map((pill) => (
                  <li key={pill} className="method__pill" data-mt="pill">
                    <i aria-hidden="true" />
                    {pill}
                  </li>
                ))}
              </ul>
            </div>

            <div className="method__slide" data-mt="slide">
              <h3 className="m3-title">
                <span>Inovação</span>
              </h3>
              <p className="method__lead" data-mt-line>
                Sugerimos sempre novidades: tecnologias que cabem no negócio com baixo custo ou
                mesmo custo zero.
              </p>
            </div>
          </div>
        </div>

        <div className="method__foot" data-mt="foot" aria-hidden="true">
          <ol className="method__steps">
            {STEPS.map((step, i) => (
              <li key={step} className="method__step" data-mt="step" data-active="false">
                <i />
                <span>{String(i + 1).padStart(2, "0")}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="method__rule" aria-hidden="true">
          <i data-mt="rule" />
        </div>
      </section>

      {/* The lens: paper, clipped to a circle, holding the same map in ink. When it
          opens to fill the screen it also carries the header, inverted to ink, and
          the next section written on it. */}
      <div
        className={`method-lens${staticMode ? " method-lens--static" : ""}`}
        data-mt="lens"
        inert={covered}
      >
        <MapLayer variant="lens" />

        <header className="site-header site-header--ink method-lens__header" inert={!opened}>
          <a className="brand" href="#top" aria-label="Ecovisão — início">
            <Image
              src="/brand/ecovisao-logo-on-light.svg"
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
              ref={lensHeaderCtaRef}
              data-cursor="hover"
            >
              Fale com a Ecovisão
              <span aria-hidden="true">↗</span>
            </a>
          </nav>
        </header>

        {staticMode ? null : track}
      </div>

      {/* Reduced motion has no lens to open, so the next section follows it in the flow. */}
      {staticMode ? track : null}

      {/* The lens's rim. The orange front of the wipe was the same ring. */}
      <svg
        className={`method-rim${staticMode ? " method-rim--static" : ""}`}
        data-mt="rim-svg"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <circle data-mt="ticks" className="method-rim__ticks" r="0" />
        <circle data-mt="rim" className="method-rim__ring" r="0" />
      </svg>
    </>
  );
}
