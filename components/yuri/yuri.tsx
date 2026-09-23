import Image from "next/image";
import { useMagnetic } from "../cursor/use-magnetic";
import { SectionMenu } from "../nav/section-menu";
import "./yuri.css";

type YuriProps = {
  staticMode: boolean;
  /** True once the terrain has covered enough of the screen for this to be the one on top. */
  open: boolean;
  /** True once the section after this one has grown over it: nothing here can be reached. */
  covered: boolean;
};

/**
 * Everything here is page 3 of the institutional document, in Yuri's own words.
 * Nothing is added: the credentials are the ones that page lists, the quote is his
 * mission, and the photograph is the one that page carries.
 */
const MISSION =
  "Minha missão é ser o parceiro que os empresários precisam para transformar desafios em oportunidades e seus negócios em histórias de sucesso.";

/** Indices of the words that carry the sentence: set in the site's serif italic. */
const EMPHASIS = new Set([5, 12, 13, 14, 19, 20, 21]);

const WORDS = MISSION.split(" ");

/** Ring and tick dial around the disc, in the site's own vocabulary (the lens's rim). */
const TICKS = 96;
const TICK_RADIUS = 53.4;
const TICK_GAP = (2 * Math.PI * TICK_RADIUS) / TICKS;

/** The waves of the brand's documents, as faint contour lines along the bottom. */
function Contours() {
  const lines = 9;
  return (
    <svg className="yuri__contours" viewBox="0 0 1440 420" preserveAspectRatio="none" aria-hidden="true">
      {Array.from({ length: lines }, (_, k) => {
        const base = 60 + k * 40;
        const points = Array.from({ length: 25 }, (_, i) => {
          const x = i * 60;
          const y = base + Math.sin(i * 0.55 + k * 0.5) * 18 + Math.sin(i * 1.3 - k) * 6;
          return `${x} ${y.toFixed(1)}`;
        });
        return <path key={k} d={`M${points.join(" L")}`} />;
      })}
    </svg>
  );
}

/**
 * Section 06, "Quem sou eu?". It rises over the green of section 05 as terrain with
 * contour lines ahead of it (the waves of the brand's documents), then holds the
 * screen: the founder's portrait blooms out of a disc with the lens's tick dial,
 * his credentials light one by one along a rail, and his mission is read out word
 * by word as the scroll goes. yuri-engine.ts moves all of it.
 */
export function Yuri({ staticMode, open, covered }: YuriProps) {
  const headerCtaRef = useMagnetic<HTMLAnchorElement>();
  return (
    <>
      <section
        id="yuri"
        className={`yuri${staticMode ? " yuri--static" : ""}`}
        data-y="root"
        aria-labelledby="yuri-title"
      >
        <div className="yuri__bg" aria-hidden="true">
          <Contours />
        </div>

        {/* The header again, cream on forest: it inverts along the terrain's edge. */}
        <header className="site-header yuri__header" inert={!open || covered}>
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

        <div className="yuri__stage">
          <div className="yuri__disc" data-y="disc" aria-hidden="true">
            <svg className="yuri__dial" viewBox="0 0 100 100">
              <circle
                className="yuri__ticks"
                data-y="ticks"
                cx="50"
                cy="50"
                r={TICK_RADIUS}
                strokeDasharray={`0.16 ${(TICK_GAP - 0.16).toFixed(3)}`}
              />
              <circle className="yuri__ring" data-y="ring" cx="50" cy="50" r="50.6" pathLength="1" />
            </svg>
          </div>

          <div className="yuri__portrait" data-y="portrait">
            <Image
              src="/images/yuri-elias.webp"
              alt="Yuri Elias, fundador da Ecovisão"
              width={1200}
              height={1801}
              sizes="(max-width: 767px) 60vw, 34vw"
              priority={false}
              loading="eager"
              fetchPriority="low"
            />
          </div>
        </div>

        <div className="yuri__copy">
          <p className="yuri__eyebrow" data-y="eyebrow">
            <span aria-hidden="true" />
            06 <b>—</b> Quem <em>sou eu?</em>
          </p>

          <div className="yuri__acts">
            <div className="yuri__act" data-y="act1">
              <h2 id="yuri-title" className="yuri__name">
                <span className="y-mask">
                  <span data-y="name-line">Yuri</span>
                </span>
                <span className="y-mask">
                  <span data-y="name-line">
                    <em>Elias</em>
                  </span>
                </span>
              </h2>

              <p className="yuri__role" data-y="fade">
                Biólogo e gestor empresarial. Fundador da Ecovisão.
              </p>

              <ol className="yuri__creds" data-y="creds">
                <li data-y="cred">
                  <b>
                    <i data-y="count">10</i>
                    <sup>+</sup>
                  </b>
                  <span>anos de experiência em consultorias empresariais</span>
                </li>
                <li data-y="cred">
                  <b>MBA</b>
                  <span>em Gestão Empresarial pela FGV</span>
                </li>
                <li data-y="cred">
                  <b>Empretec</b>
                  <span>do SEBRAE</span>
                </li>
              </ol>
            </div>

            <div className="yuri__act yuri__act--quote" data-y="act2">
              <blockquote className="yuri__quote">
                {WORDS.map((word, i) => (
                  <span key={i}>
                    <span className={`y-word${EMPHASIS.has(i) ? " y-word--hl" : ""}`} data-y="word">
                      {word}
                    </span>{" "}
                  </span>
                ))}
              </blockquote>
              <p className="yuri__by" data-y="by">
                Yuri Elias, fundador da Ecovisão
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contour lines that run ahead of the terrain's edge, over the paper. */}
      <div className="yuri-lines" data-y="lines" aria-hidden="true">
        <svg data-y="lines-svg" preserveAspectRatio="none">
          <path className="yuri-lines__edge" data-y="line" />
          <path data-y="line" />
          <path data-y="line" />
          <path data-y="line" />
          <path data-y="line" />
        </svg>
      </div>
    </>
  );
}
