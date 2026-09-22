import Image from "next/image";
import { GROUPS } from "./pgrss-field";
import "./pgrss.css";

type PgrssProps = {
  staticMode: boolean;
  /** True once the columns have covered enough of the screen for this to be the one on top. */
  open: boolean;
  /** True once the section after this one has come up over it: nothing here can be reached. */
  covered: boolean;
};

/**
 * The three promises are page 8 of the institutional document, word for word. The
 * closing lines are pages 8 and 9. The one thing added is the four groups the waste is
 * sorted into (Resolução RDC 222/2018, ANVISA; group C, radioactive, is not part of the work): they are what a PGRSS is written
 * around, and what turns the drawing into something a clinic can recognise.
 */
const PLEDGES = [
  {
    title: "Conformidade legal",
    text: "Respeitando todas as normas vigentes para liberação de alvarás.",
  },
  {
    title: "Sustentabilidade e eficiência",
    text: "Soluções personalizadas para tornar a gestão de resíduos segura, sustentável e eficiente.",
  },
  {
    title: "Agilidade e precisão",
    text: "Processos rápidos e assertivos, minimizando impactos no dia a dia do cliente.",
  },
] as const;

const WORD = ["P", "G", "R", "S", "S"] as const;

const SEAL_TEXT = "ALVARÁ SANITÁRIO · APOIO TÉCNICO PARA OBTENÇÃO E MANUTENÇÃO · ";
const SEAL_TICKS = 72;
const SEAL_TICK_RADIUS = 93;
const SEAL_TICK_GAP = (2 * Math.PI * SEAL_TICK_RADIUS) / SEAL_TICKS;

/**
 * Section 05, "PGRSS". The paper of section 04 is cut by four green columns that
 * climb through it, staggered, with an orange edge each: they are the four lanes of
 * what follows. On them the specialty plays out as one drawing: waste, mixed, falls
 * through a line of segregation and is sorted into the four groups; three promises
 * are read against the flow; the four paths then bend into one, and end on a seal.
 * pgrss-engine.ts moves all of it, pgrss-field.ts draws the particles.
 */
export function Pgrss({ staticMode, open, covered }: PgrssProps) {
  return (
    <>
      <section
        id="pgrss"
        className={`pgrss${staticMode ? " pgrss--static" : ""}`}
        data-pg="root"
        aria-labelledby="pgrss-title"
      >
        <div className="pgrss__bg" aria-hidden="true" />

        {/* The header again, cream on green: it inverts along the columns' edge. */}
        <header className="site-header pgrss__header" inert={!open || covered}>
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

        {/* The drawing: four lanes, the line that sorts, the particles, the seal. */}
        <div className="pgrss__field" data-pg="field" aria-hidden="true">
          <div className="pgrss__lanes">
            {GROUPS.map((group) => (
              <div key={group.code} className="pgrss__lane" data-pg="lane">
                <span className="pgrss__group" data-pg="group">
                  <i className={`pgrss__mark pgrss__mark--${group.shape}`} style={{ color: group.color }} />
                  <b>{group.code}</b>
                  <span>{group.name}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="pgrss__gate" data-pg="gate">
            <span data-pg="gate-label">Segregação</span>
          </div>

          <canvas className="pgrss__canvas" data-pg="canvas" />

          <div className="pgrss__seal" data-pg="seal">
            <svg viewBox="0 0 200 200">
              <circle
                className="pgrss__seal-ticks"
                cx="100"
                cy="100"
                r={SEAL_TICK_RADIUS}
                strokeDasharray={`0.3 ${(SEAL_TICK_GAP - 0.3).toFixed(3)}`}
              />
              <circle className="pgrss__seal-ring" data-pg="seal-ring" cx="100" cy="100" r="98" pathLength="1" />
              <g data-pg="seal-text">
                <path
                  id="pgrss-seal-path"
                  d="M100 100 m-72 0 a72 72 0 1 1 144 0 a72 72 0 1 1 -144 0"
                  fill="none"
                />
                <text>
                  <textPath href="#pgrss-seal-path" textLength="446" lengthAdjust="spacing">
                    {SEAL_TEXT}
                  </textPath>
                </text>
              </g>
              <path
                className="pgrss__seal-check"
                data-pg="seal-check"
                d="M70 102 L92 124 L133 77"
                pathLength="1"
              />
              <circle className="pgrss__seal-node" data-pg="seal-node" cx="133" cy="77" r="5.5" />
            </svg>
          </div>
        </div>

        {/* The giant word sits behind the falling waste. Its letters are masked and rise. */}
        <h2 id="pgrss-title" className="pgrss__word" data-pg="word">
          <span className="sr-only">PGRSS: especialistas em planos de gerenciamento de resíduos dos serviços de saúde</span>
          <span aria-hidden="true" className="pgrss__word-letters">
            {WORD.map((letter, i) => (
              <span key={i} className="pg-mask">
                <span data-pg="letter">{letter}</span>
              </span>
            ))}
          </span>
        </h2>

        <div className="pgrss__copy">
          <p className="pgrss__eyebrow" data-pg="eyebrow">
            <span aria-hidden="true" />
            05 <b>—</b> Nosso <em>diferencial</em>
          </p>

          <div className="pgrss__acts" data-pg="acts">
            <div className="pgrss__act pgrss__act--one" data-pg="act1">
              <p className="pgrss__lead">
                Somos especialistas em consultoria e elaboração de Planos de Gerenciamento de Resíduos
                dos Serviços de Saúde.
              </p>
            </div>

            <div className="pgrss__act pgrss__act--two" data-pg="act2">
              <p className="pgrss__title">
                Da mistura <em>à ordem.</em>
              </p>
              <p className="pgrss__sub">
                Quatro grupos de resíduos, quatro caminhos. É o plano de gerenciamento que desenha cada um deles.
              </p>
            </div>

            <ol className="pgrss__pledges" data-pg="pledges">
              {PLEDGES.map((pledge, i) => (
                <li key={pledge.title} data-pg="pledge">
                  <b>0{i + 1}</b>
                  <h3>{pledge.title}</h3>
                  <p>{pledge.text}</p>
                </li>
              ))}
            </ol>

            <div className="pgrss__act pgrss__act--four" data-pg="act4">
              <p className="pgrss__for" data-pg="act4-line">
                Atendemos clínicas, hospitais, laboratórios e outros estabelecimentos da saúde.
              </p>
              <p className="pgrss__close" data-pg="act4-line">
                Transformar o gerenciamento de resíduos em uma <em>vantagem estratégica.</em>
              </p>
              <div className="pgrss__cta-row" data-pg="act4-line">
                <a
                  className="button button--primary pgrss__cta"
                  href="mailto:yuri.elias@ecovisaoconsultoria.com.br?subject=Quero%20falar%20sobre%20PGRSS"
                >
                  <span>Falar sobre PGRSS</span>
                  <i aria-hidden="true">↗</i>
                </a>
                <p className="pgrss__note">
                  Apoio técnico para a obtenção e a manutenção do Alvará Sanitário.
                </p>
              </div>
            </div>
          </div>

          <p className="sr-only">
            Os resíduos de serviços de saúde são segregados em quatro grupos:{" "}
            {GROUPS.map((group) => `${group.code}, ${group.name.toLowerCase()}`).join("; ")}.
          </p>
        </div>
      </section>

      {/* The orange edge of each column, over the paper, while it climbs. */}
      <div className="pgrss-caps" data-pg="caps" aria-hidden="true">
        {GROUPS.map((group) => (
          <i key={group.code} data-pg="cap" />
        ))}
      </div>
    </>
  );
}
