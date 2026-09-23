"use client";

import Image from "next/image";
import { Fragment } from "react";
import { useMagnetic } from "../cursor/use-magnetic";
import { SectionMenu } from "../nav/section-menu";
import { ECHO_RINGS, SATELLITES, SYSTEM } from "./manifesto-engine";
import "./manifesto.css";

type ManifestoProps = {
  staticMode: boolean;
  /** True once the wipe has covered the hero: the header below it takes over. */
  covered: boolean;
  /** True once section 03 has taken the screen and this one is no longer reachable. */
  handoff: boolean;
};

/** `key` marks the three words that stand for the three orbits, in order. */
const STATEMENT: { text: string; key?: number }[] = [
  { text: "Negócios" },
  { text: "crescem" },
  { text: "quando" },
  { text: "pessoas,", key: 0 },
  { text: "processos", key: 1 },
  { text: "e" },
  { text: "objetivos", key: 2 },
  { text: "trabalham" },
  { text: "como" },
  { text: "partes" },
  { text: "de" },
  { text: "um" },
  { text: "mesmo" },
  { text: "sistema." },
];

const STEPS = ["Eco", "Alinhamento", "Visão"];

/**
 * Presentation only. The pin, the scroll loop and both engines live in
 * StageSequence, because this section and the next one share one scroll.
 */
export function Manifesto({ staticMode, covered, handoff }: ManifestoProps) {
  const headerCtaRef = useMagnetic<HTMLAnchorElement>();
  return (
    <>
      {/* The leading edge of the wipe. It lives outside the clipped layer so the
          ring is drawn across the boundary instead of being cut in half by it. */}
      <svg className="manifesto-front" data-m="front-svg" aria-hidden="true" preserveAspectRatio="none">
        <circle data-m="front" r="0" />
      </svg>

      <section
        id="visao"
        className={`manifesto${staticMode ? " manifesto--static" : ""}`}
        data-m="layer"
        aria-labelledby="manifesto-title"
      >
        <div className="manifesto__frame" data-m="frame">
          {/* The hero's header, inverted: same place, same size, so the wave turns
              it from cream-on-forest to ink-on-cream as it passes. */}
          <header className="site-header site-header--ink" inert={!covered || handoff}>
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
                ref={headerCtaRef}
                data-cursor="hover"
              >
                Fale com a Ecovisão
                <span aria-hidden="true">↗</span>
              </a>
            </nav>
          </header>

          <svg className="manifesto__figure" data-m="figure" aria-hidden="true" preserveAspectRatio="none">
            {ECHO_RINGS.map((frac, i) => (
              <circle
                key={`echo-${frac}`}
                className="m-ring m-ring--echo"
                data-m="ring"
                data-frac={frac}
                data-ticks={i === 0 ? 96 : undefined}
              />
            ))}
            {SYSTEM.map((orbit, i) => (
              <circle
                key={orbit.label}
                className="m-ring m-ring--system"
                data-m="ring"
                data-frac={orbit.frac}
                data-ticks={i === SYSTEM.length - 1 ? 72 : undefined}
              />
            ))}

            {SATELLITES.map((satellite) => (
              <g key={`${satellite.ring}-${satellite.angle}`} data-m="sat">
                <line className="m-sat__spoke" />
                <circle className="m-sat__dot" r="0" />
              </g>
            ))}

            <circle className="m-pulse" data-m="pulse" r="10" />
            <circle className="m-pulse m-pulse--late" data-m="pulse" r="10" />

            <line className="m-axis" data-m="axis" />
            <circle className="m-axis__cap" data-m="axis-cap" r="0" />
            <text className="m-integrated" data-m="integrated">
              VISÃO INTEGRADA
            </text>

            {SYSTEM.map((orbit) => (
              <g key={orbit.label} data-m="node">
                <circle className="m-node__halo" r="11" />
                <circle className="m-node__dot" r="0" />
                <text className="m-node__label">{orbit.label}</text>
              </g>
            ))}

            <circle className="m-center" data-m="center" r="0" />
          </svg>

          <div className="manifesto__copy">
            <p className="manifesto__eyebrow">
              <span aria-hidden="true" />
              02 <b>—</b> Nossa visão
            </p>

            <h2 id="manifesto-title" className="sr-only">
              Eco de ecossistema. Visão de análise ampla e estratégica.
            </h2>

            <div className="manifesto__slides">
              <div className="manifesto__slide" data-slide="eco" aria-hidden="true">
                <span className="m-mask">
                  <span className="manifesto__giant">Eco</span>
                </span>
                <span className="m-mask">
                  <span className="manifesto__sub">de ecossistema.</span>
                </span>
              </div>

              <p className="manifesto__slide manifesto__statement" data-m="statement">
                {STATEMENT.map((word, i) => (
                  <Fragment key={word.text}>
                    <span
                      className={`m-word${word.key === undefined ? "" : " m-word--key"}`}
                      data-m="word"
                      data-key={word.key}
                    >
                      {word.text}
                    </span>
                    {i < STATEMENT.length - 1 ? " " : null}
                  </Fragment>
                ))}
              </p>

              <div className="manifesto__slide" data-slide="vision" aria-hidden="true">
                <span className="m-mask">
                  <span className="manifesto__giant">Visão</span>
                </span>
                <span className="m-mask">
                  <span className="manifesto__sub">de análise ampla</span>
                </span>
                <span className="m-mask">
                  <span className="manifesto__sub">e estratégica.</span>
                </span>
              </div>
            </div>
          </div>

          <div className="manifesto__foot" aria-hidden="true">
            <ol className="manifesto__steps">
              {STEPS.map((step, i) => (
                <li key={step} className="manifesto__step" data-m="step" data-active="false">
                  <i />
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="manifesto__rule" aria-hidden="true">
            <i data-m="rule" />
          </div>
        </div>
      </section>
    </>
  );
}
