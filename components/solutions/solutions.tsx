import type { CSSProperties } from "react";
import "./solutions.css";

/**
 * The four service groups on page 7 of the institutional document, in the
 * document's own wording. Nothing here is grouped or paraphrased by us: each card
 * is one heading of that page with what sits under it. (`short` is only the first
 * word, for the rail.)
 */
const GROUPS = [
  {
    id: "pgrs",
    short: "PGRS",
    title: ["Planos de Gerenciamento de Resíduos", "Sólidos (PGRS)"],
    lead: "Consultoria e elaboração de planos de gerenciamento de resíduos em diversas áreas, incluindo serviços de saúde (PGRSS).",
    items: [],
    // Page 8 calls it "Nosso Diferencial no Setor de Saúde".
    tag: "PGRSS · Nosso diferencial no setor de saúde",
  },
  {
    id: "planejamento",
    short: "Planejamento",
    title: ["Planejamento", "Estratégico"],
    lead: "Orientação para traçar um direcionamento claro e objetivo.",
    items: ["RX Empresarial: diagnóstico prático com soluções internas de baixo custo.", "Ferramentas de gestão."],
    tag: null,
  },
  {
    id: "consultoria",
    short: "Consultoria",
    title: ["Consultoria", "Especializada"],
    lead: null,
    items: [
      "Análise de processos internos com foco em diminuição de custos e aumento de lucro.",
      "Análise e qualificação de fornecedores estratégicos (Custos).",
      "Licenciamentos.",
      "Modelagem e posicionamento de marca.",
      "Estratégias de marketing digital.",
    ],
    tag: null,
  },
  {
    id: "treinamentos",
    short: "Treinamentos",
    title: ["Treinamentos e", "Desenvolvimento"],
    lead: "Elaboração de treinamentos e cursos personalizados para aprimorar resultados ou para fortalecer conceitos importantes para a organização.",
    items: ["Planos de desenvolvimento individual para ajustar comportamentos e alinhar metas."],
    tag: null,
  },
] as const;

const TOTAL = GROUPS.length;

const two = (n: number) => String(n).padStart(2, "0");
const around = (index: number, count: number, radius: number, cx = 120, cy = 65) => {
  const angle = ((-90 + (360 / count) * index) * Math.PI) / 180;
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)] as const;
};
const f = (n: number) => n.toFixed(1);

/**
 * One small drawing per group, built from the site's own vocabulary (rings, nodes,
 * links, the orange node). Each is drawn twice: a faint copy that is always there,
 * so a card is never empty, and a live copy that draws itself when the card ignites.
 */
type Shape =
  | { kind: "stroke"; d: string; i: number }
  | { kind: "ring"; cx: number; cy: number; r: number; i: number }
  | {
      kind: "node";
      cx: number;
      cy: number;
      r: number;
      i: number;
      key?: boolean;
      /** Where the node starts before it settles: the untangling, in miniature. */
      from?: readonly [number, number];
    };

const SPOKES = 5;
/** Where each of the five areas starts, as an offset from its place on the ring. */
const SCATTER: readonly (readonly [number, number])[] = [
  [-26, 14],
  [30, -18],
  [-14, -30],
  [22, 26],
  [-32, -8],
];
const FIGURES: Record<string, Shape[]> = {
  // A plan, checked: rings closing on a tick.
  pgrs: [
    { kind: "ring", cx: 120, cy: 65, r: 52, i: 0 },
    { kind: "ring", cx: 120, cy: 65, r: 36, i: 1 },
    { kind: "stroke", d: "M98 66 L114 82 L146 48", i: 2 },
    { kind: "stroke", d: "M120 8 V20 M232 65 H220 M120 122 V110 M8 65 H20", i: 3 },
    { kind: "node", cx: 146, cy: 48, r: 4.5, i: 4, key: true },
  ],
  // A clear direction: a line through waypoints to a target.
  planejamento: [
    { kind: "stroke", d: "M22 100 C62 100 66 46 108 52 S170 96 206 38", i: 0 },
    { kind: "ring", cx: 206, cy: 38, r: 14, i: 2 },
    { kind: "ring", cx: 206, cy: 38, r: 24, i: 3 },
    { kind: "node", cx: 22, cy: 100, r: 4, i: 0 },
    { kind: "node", cx: 108, cy: 52, r: 4.5, i: 1 },
    { kind: "node", cx: 206, cy: 38, r: 6, i: 2, key: true },
  ],
  // Section 03's map, in miniature: the business in the middle, five areas around it
  // that fly in from where they were and settle onto the ring.
  consultoria: [
    { kind: "ring", cx: 120, cy: 65, r: 46, i: 0 },
    ...Array.from({ length: SPOKES }, (_, k): Shape => {
      const [x, y] = around(k, SPOKES, 46);
      return { kind: "stroke", d: `M120 65 L${f(x)} ${f(y)}`, i: k };
    }),
    ...Array.from({ length: SPOKES }, (_, k): Shape => {
      const [x, y] = around(k, SPOKES, 46);
      return { kind: "node", cx: x, cy: y, r: 4.2, i: k, from: SCATTER[k] };
    }),
    { kind: "node", cx: 120, cy: 65, r: 5.5, i: 5, key: true },
  ],
  // Growth: nodes climbing a curve, each a little larger than the last.
  treinamentos: [
    { kind: "stroke", d: "M20 112 H220", i: 0 },
    { kind: "stroke", d: "M24 100 C70 100 92 80 120 64 S178 32 214 22", i: 1 },
    { kind: "ring", cx: 214, cy: 22, r: 17, i: 3 },
    { kind: "node", cx: 24, cy: 100, r: 3.2, i: 1 },
    { kind: "node", cx: 120, cy: 64, r: 5, i: 2 },
    { kind: "node", cx: 214, cy: 22, r: 8, i: 3, key: true },
  ],
};

function Figure({ id }: { id: string }) {
  const shapes = FIGURES[id];

  const still = shapes.map((shape, k) =>
    shape.kind === "stroke" ? (
      <path key={k} d={shape.d} />
    ) : shape.kind === "ring" ? (
      <circle key={k} cx={shape.cx} cy={shape.cy} r={shape.r} />
    ) : (
      <circle key={k} className="sl-fig__dot" cx={f(shape.cx)} cy={f(shape.cy)} r={shape.r} />
    ),
  );

  const live = shapes.map((shape, k) => {
    const delay = { "--i": shape.i } as CSSProperties;
    if (shape.kind === "stroke") {
      return <path key={k} className="d" pathLength="1" d={shape.d} style={delay} />;
    }
    if (shape.kind === "ring") {
      return <circle key={k} className="d" pathLength="1" cx={shape.cx} cy={shape.cy} r={shape.r} style={delay} />;
    }

    const style = {
      ...delay,
      ...(shape.from ? { "--dx": `${shape.from[0]}px`, "--dy": `${shape.from[1]}px` } : {}),
    } as CSSProperties;
    return (
      <g key={k} className={`n${shape.key ? " k" : ""}`} style={style}>
        {shape.key ? <circle className="halo" cx={f(shape.cx)} cy={f(shape.cy)} r={shape.r * 2.6} /> : null}
        <circle cx={f(shape.cx)} cy={f(shape.cy)} r={shape.r} />
      </g>
    );
  });

  return (
    <svg className="sl-fig" viewBox="0 0 240 130" aria-hidden="true">
      <g className="sl-ghost">{still}</g>
      <g className="sl-live">{live}</g>
    </svg>
  );
}

/**
 * Section 04, "Soluções". It lives inside the lens of section 03: when the lens has
 * opened to fill the screen, this is what is written on the paper. The chapter's
 * title is the first panel of a horizontal track; scrolling slides it away and the
 * four service groups run past, each stopping in the middle of the screen long
 * enough to be read. The engine (solutions-engine.ts) is the only thing that moves
 * any of it.
 */
export function SolutionsTrack({ staticMode }: { staticMode: boolean }) {
  return (
    <section
      id="solucoes"
      className={`sl${staticMode ? " sl--static" : ""}`}
      data-sl="root"
      aria-labelledby="sl-title"
    >
      <div className="sl__track" data-sl="track">
        <div className="sl-intro" data-sl="intro">
          <div className="sl-intro__copy">
            <p className="sl-eyebrow" data-sl="intro-line">
              <span aria-hidden="true" />
              04 <b>—</b> Soluções
            </p>
            <h2 id="sl-title" className="m3-title m3-title--ink" data-sl="intro-title">
              <span>Soluções</span>
            </h2>
            <p className="sl-intro__lead" data-sl="intro-line">
              Temos serviços prontos, mas o nosso diferencial é o diagnóstico da sua empresa e uma
              solução personalizada para você.
            </p>
          </div>

          <p className="sl-hint" data-sl="hint" aria-hidden="true">
            <span>Role para percorrer</span>
            <i />
          </p>
        </div>

        <ol className="sl-cards">
          {GROUPS.map((group, g) => (
            <li key={group.id} className="sl-card" data-sl="card" data-focus="false">
              <span className="sl-card__idx">
                {two(g + 1)}
                <i>/{two(TOTAL)}</i>
              </span>

              <Figure id={group.id} />

              <div className="sl-card__body">
                <h3 className="sl-card__title">
                  {group.title[0]}
                  <em>{group.title[1]}</em>
                </h3>

                {group.lead ? <p className="sl-card__lead">{group.lead}</p> : null}

                {group.items.length > 0 ? (
                  <ul className="sl-card__items">
                    {group.items.map((item, k) => (
                      <li key={item} style={{ "--i": k } as CSSProperties}>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {group.tag ? (
                  <p className="sl-card__tag">
                    <span aria-hidden="true" />
                    {group.tag}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        <div className="sl-end" data-sl="end">
          <p className="sl-end__line" data-sl="end-line">
            Uma solução personalizada <em>para você.</em>
          </p>
          <a
            className="sl-end__cta"
            data-sl="end-line"
            href="mailto:yuri.elias@ecovisaoconsultoria.com.br"
          >
            Fale com a Ecovisão
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>

      {/* The rail: which of the four you are in. */}
      <div className="sl-foot" data-sl="foot" aria-hidden="true">
        {GROUPS.map((group, g) => (
          <span
            key={group.id}
            className="sl-foot__label"
            data-sl="label"
            data-active="false"
            style={{ left: `${(g / TOTAL) * 100}%` }}
          >
            <b>{two(g + 1)}</b>
            <span className="sl-foot__name">{group.short}</span>
          </span>
        ))}

        <div className="sl-foot__line">
          <i className="sl-foot__fill" data-sl="fill" />
          {GROUPS.map((group, g) => (
            <i
              key={group.id}
              className="sl-foot__tick"
              data-sl="tick"
              data-on="false"
              data-focus="false"
              style={{ left: `${((g + 0.5) / TOTAL) * 100}%` }}
            />
          ))}
          <b className="sl-foot__node" data-sl="node" />
        </div>
      </div>
    </section>
  );
}
