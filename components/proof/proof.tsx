import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { useMagnetic } from "../cursor/use-magnetic";
import { SectionMenu } from "../nav/section-menu";
import { CLIENT_NAMES, RINGS, VOICES } from "./clients";
import "./proof.css";

type ProofProps = {
  staticMode: boolean;
  /** True once the stain has covered enough of the screen for this to be the one on top. */
  open: boolean;
  /** True once the paper has parted far enough for the section behind it to be the one on top. */
  covered: boolean;
};

const TITLE = ["Histórias", "de", "sucesso."] as const;

/** `*word*` marks the words a sentence turns on. */
function marked(text: string): ReactNode[] {
  return text.split("*").map((part, i) => (i % 2 ? <em key={i}>{part}</em> : part));
}

/**
 * Section 07. It grows out of the founder's last words: cream spreads from "histórias
 * de sucesso" with growth rings behind its edge (proof-engine.ts), and what it uncovers
 * is those stories. Thirteen brands sit on three rings, like the section of a trunk;
 * the outer ring turns a third of a turn per voice to bring that voice's brand to the
 * front, in line with the words it said. Every word is from pages 10 and 11 of the
 * institutional document.
 */
export function Proof({ staticMode, open, covered }: ProofProps) {
  const headerCtaRef = useMagnetic<HTMLAnchorElement>();
  return (
    <>
      <section
        id="prova"
        className={`proof${staticMode ? " proof--static" : ""}`}
        data-pf="root"
        data-index="0"
        aria-labelledby="proof-title"
      >
        {/* The header again, in ink: the paper is what it is written on. */}
        <header className="site-header site-header--ink proof__header" inert={!open || covered}>
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

        {/* The rings and the brands on them. Decorative: the names are listed below. */}
        <svg className="pf-rings" aria-hidden="true">
          {RINGS.map((_, j) => (
            <g key={j} data-pf="ring">
              <path className="pf-ring" data-pf="ring-line" pathLength="1" />
            </g>
          ))}
          <line className="pf-thread" data-pf="thread" pathLength="1" />
        </svg>

        {/* The dial of ticks is a layer of its own: turning it is free, redrawing the rings is not. */}
        <svg className="pf-dial" data-pf="dial" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="95" />
        </svg>

        <div className="pf-hub" data-pf="hub" aria-hidden="true">
          <i />
          <Image src="/brand/ecovisao-mark.svg" alt="" width={64} height={64} unoptimized />
        </div>

        <div className="pf-chips" aria-hidden="true">
          {RINGS.flatMap((ring, j) =>
            ring.map((slug, slot) => (
              <div
                key={slug}
                className="pf-chip"
                data-pf="chip"
                data-ring={j}
                data-slot={slot}
                data-slug={slug}
                data-lit="false"
              >
                <span className="pf-chip__disc">
                  <span
                    className="pf-chip__mono"
                    style={{ "--logo": `url(/images/clients/${slug}-mono.webp)` } as CSSProperties}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="pf-chip__color"
                    src={`/images/clients/${slug}.webp`}
                    alt=""
                    width={520}
                    height={520}
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <span className="pf-chip__name">{CLIENT_NAMES[slug]}</span>
              </div>
            )),
          )}
        </div>

        <div className="proof__copy">
          <p className="proof__eyebrow" data-pf="eyebrow">
            <span aria-hidden="true" />
            07 <b>—</b> Clientes e resultados
          </p>

          <h2 id="proof-title" className="proof__title">
            <span className="sr-only">Clientes e parceiros: histórias de sucesso</span>
            <span aria-hidden="true" className="proof__title-words">
              {TITLE.map((word, i) => (
                <span key={word} className="pf-mask">
                  <span data-pf="title-word">{i === 2 ? <em>{word}</em> : word}</span>
                </span>
              ))}
            </span>
          </h2>

          <p className="proof__lead" data-pf="lead">
            Histórias de sucesso construídas com empresas que confiam em nossas soluções e parceiros
            estratégicos que fortalecem nossa capacidade de resolver desafios específicos.
          </p>
        </div>

        <div className="pf-voices" data-pf="voices">
          {VOICES.map((voice) => (
            <figure key={voice.slug} className="pf-voice" data-pf="voice">
              <blockquote>
                {voice.paragraphs.map((text) => (
                  <p key={text}>{marked(text)}</p>
                ))}
              </blockquote>
              <figcaption>
                <b>{voice.name}</b>
                <span>
                  {voice.org} ({voice.place})
                </span>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="pf-nav" data-pf="nav">
          <p className="pf-nav__count" aria-live="polite">
            <b data-pf="counter">01</b>
            <span aria-hidden="true"> / 0{VOICES.length}</span>
            <span className="sr-only"> de {VOICES.length} depoimentos</span>
          </p>
          <div className="pf-nav__dots">
            {VOICES.map((voice, k) => (
              <button
                key={voice.slug}
                type="button"
                className="pf-nav__dot"
                data-pf="dot"
                data-on={k === 0}
                data-pf-seek={k}
                aria-label={`Depoimento de ${voice.name}`}
              />
            ))}
          </div>
          <div className="pf-nav__arrows">
            <button type="button" data-pf-seek="prev" aria-label="Depoimento anterior">
              <span aria-hidden="true">←</span>
            </button>
            <button type="button" data-pf-seek="next" aria-label="Próximo depoimento">
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>

        {/* The same thirteen brands as the chips on the rings, but as a plain, always-
            legible row: the rings are ornament, this is the record. Fixes what the
            rings can't do on a phone, where a name next to a chip has no room. A
            single-row marquee needs only the height of one line regardless of how
            many clients there are — the duplicated second set is what makes the
            loop seamless, and it is `aria-hidden` so the list is announced once. */}
        <div className="pf-trust" data-pf="trust">
          <div className="pf-trust__track">
            {[0, 1].map((copy) => (
              <div className="pf-trust__set" key={copy} aria-hidden={copy === 1 ? "true" : undefined}>
                {RINGS.flat().map((slug) => (
                  <span key={slug} className="pf-trust__item">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/images/clients/${slug}.webp`}
                      alt=""
                      width={36}
                      height={36}
                      loading="lazy"
                      decoding="async"
                    />
                    <b>{CLIENT_NAMES[slug]}</b>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The stain's edge, and the growth rings that ripple behind it. */}
      <svg className="proof-edge" data-pf="edge" aria-hidden="true">
        <path className="proof-edge__line" />
        <path className="proof-edge__halo" />
        <path className="proof-edge__ring" />
        <path className="proof-edge__ring" />
        <path className="proof-edge__ring" />
        {/* The rings the paper gives way in; the outermost is the orange front. */}
        {Array.from({ length: 5 }, (_, i) => (
          <circle key={i} className="proof-edge__burst" data-pf="burst" />
        ))}
      </svg>
    </>
  );
}
