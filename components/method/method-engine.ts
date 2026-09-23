import type { CrownPosition } from "../hero/hero-scene";
import { type FigureGeometry, measureFigure } from "../stage/figure-geometry";

/**
 * Section 03, "A Lente": a lens diagnoses a tangled business map, then the map is
 * untangled into something ordered. Like section 02 it is one function of scroll
 * progress, so any frame can be reproduced exactly and scrolling back plays it
 * backwards.
 *
 * It receives two progresses: `iris` (0..1), the cream closing around the figure's
 * centre and becoming the lens, and `method` (0..1), everything after. Copy is
 * limited to phrases the institutional document already uses.
 */

type Range = readonly [number, number];

/** Progress of each beat inside `method`. Everything below reads from here. */
const T = {
  lensGrow: [0.4, 0.5],
  order: [0.5, 0.66],
  result: [0.66, 0.72],
  resultLabel: [0.7, 0.74],
  ghost: [0.7, 0.76],
  innovate: [0.84, 0.91],
  innovLink: [0.9, 0.94],
  innovLabel: [0.92, 0.96],
  pills: [0.56, 0.7],
} as const satisfies Record<string, Range>;

/**
 * Progress of each beat inside `open`. What is written on the paper afterwards
 * (the chapter's title and the track) belongs to solutions-engine.ts.
 */
const OPEN = {
  spread: [0, 0.55],
  rimOut: [0.35, 0.6],
  mapOut: [0.08, 0.45],
} as const satisfies Record<string, Range>;

/** When each act's text arrives and leaves. The last one stays. */
const ACTS = [
  { into: [0.02, 0.09], out: [0.36, 0.42] },
  { into: [0.43, 0.5], out: [0.76, 0.82] },
  { into: [0.83, 0.9], out: null },
] as const satisfies readonly { into: Range; out: Range | null }[];

/**
 * The company being diagnosed. `tangle` is where each node sits before the
 * work (angle in degrees, radius as a fraction of the map radius); its ordered
 * position is its `slot` on an even ring of eight. The three `pain` nodes are the
 * "pontos de melhoria" the lens finds, taken from the areas the document lists
 * under the RX Empresarial: processos, fornecedores and custos.
 */
export const NODES = [
  { label: "PESSOAS", pain: false, tangle: { angle: -75, radius: 0.95 } },
  { label: "PROCESSOS", pain: true, tangle: { angle: -20, radius: 1.18 } },
  { label: "CUSTOS", pain: true, tangle: { angle: 62, radius: 1.06 } },
  { label: "MARCA", pain: false, tangle: { angle: 112, radius: 0.72 } },
  { label: "FORNECEDORES", pain: true, tangle: { angle: 152, radius: 1.2 } },
  { label: "MARKETING", pain: false, tangle: { angle: 198, radius: 0.98 } },
  { label: "LICENCIAMENTO", pain: false, tangle: { angle: 238, radius: 0.74 } },
] as const;

/** The eighth slot is left open until innovation arrives in act three. */
export const INNOVATION_LABEL = "INOVAÇÃO";
const SLOT_COUNT = 8;
const INNOVATION_SLOT = 7;

/**
 * Which slot of the ring each node settles into. A label sits outside its node,
 * so the two slots at 3 and 9 o'clock push it sideways, where the lens is
 * narrowest. The longest names go top and bottom (where a label just centres above
 * or below its node) and the short ones on the sides.
 */
const SLOT_OF = [6, 1, 2, 3, 4, 5, 0] as const;

/** Nodes that get tangled with each other, and how hard each connection curls. */
export const CROSS_LINKS = [
  [0, 2],
  [1, 5],
  [3, 6],
  [4, 0],
  [2, 6],
] as const;

const LINK_CURL = [0.35, -0.42, 0.3, -0.3, 0.45, -0.38, 0.28] as const;

/** Where the lens stops while diagnosing. `node` -1 is the map's centre. */
const SCAN = [
  { at: 0.06, node: -1 },
  { at: 0.12, node: 1 },
  { at: 0.17, node: 1 },
  { at: 0.22, node: 2 },
  { at: 0.26, node: 2 },
  { at: 0.31, node: 4 },
  { at: 0.35, node: 4 },
  { at: 0.4, node: -1 },
] as const;

/** The four things the document says a tailored solution can bring. */
export const PILLS = [
  "Organização interna",
  "Qualificação da equipe",
  "Regularização",
  "Aumento de lucros",
] as const;

const RESULT_ANGLE = 22.5;

/** Space kept clear at the top (the header and its breathing room) and the bottom (steps and rule). */
const SAFE_TOP = 100;
const SAFE_BOTTOM = 84;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const seg = (p: number, [from, to]: Range) => clamp01((p - from) / (to - from));
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t * t;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Slide masks on the titles are translated by this much while hidden. */
const HIDDEN = 112;

type Point = { x: number; y: number };

type Geometry = FigureGeometry & {
  /**
   * Where the map (and so the lens) is centred. The iris is born on the crown like
   * the wipe was, but on a phone the finished lens has to clear the steps at the
   * bottom, so it settles higher up and the iris drifts there as it closes.
   */
  mx: number;
  my: number;
  /** Radius of the map's ring of slots. */
  mapRadius: number;
  /** The lens while scanning, and once it has swollen to hold the whole map. */
  scanRadius: number;
  fullRadius: number;
};

type NodeParts = {
  group: SVGGElement;
  halo: SVGGElement;
  haloCircle: SVGCircleElement;
  dot: SVGCircleElement;
  label: SVGTextElement;
  tag: SVGTextElement | null;
  half: number;
  tagHalf: number;
};

type MapParts = {
  svg: SVGSVGElement;
  ring: SVGCircleElement;
  crosses: SVGPathElement[];
  links: SVGPathElement[];
  innovLink: SVGPathElement;
  ghost: SVGCircleElement;
  resultLine: SVGLineElement;
  resultCap: SVGCircleElement;
  resultLabel: SVGTextElement;
  nodes: NodeParts[];
  center: SVGCircleElement;
  centerHalo: SVGCircleElement;
  centerLabel: SVGTextElement;
};

export type MethodEngine = {
  setCrown: (crown: CrownPosition) => void;
  measure: () => void;
  /** `under` is true once something opaque has covered the lens for good (the next section). */
  render: (iris: number, method: number, open: number, under?: boolean) => void;
  paintStatic: () => void;
  destroy: () => void;
};

export function createMethodEngine(
  stage: HTMLElement,
  { onActive, onOpen }: { onActive: (active: boolean) => void; onOpen: (opened: boolean) => void },
): MethodEngine {
  const one = <E extends Element>(selector: string, root: ParentNode = stage) =>
    root.querySelector(selector) as E;
  const all = <E extends Element>(selector: string, root: ParentNode = stage) =>
    Array.from(root.querySelectorAll(selector)) as E[];

  const dark = one<HTMLElement>('[data-mt="dark"]');
  const lens = one<HTMLElement>('[data-mt="lens"]');
  const rimSvg = one<SVGSVGElement>('[data-mt="rim-svg"]');
  const rim = one<SVGCircleElement>('[data-mt="rim"]');
  const ticks = one<SVGCircleElement>('[data-mt="ticks"]');
  const eyebrow = one<HTMLElement>('[data-mt="eyebrow"]');
  const foot = one<HTMLElement>('[data-mt="foot"]');
  const rule = one<HTMLElement>('[data-mt="rule"]');
  const steps = all<HTMLElement>('[data-mt="step"]');
  const slides = all<HTMLElement>('[data-mt="slide"]');
  const slidesBox = one<HTMLElement>('[data-mt="slides"]');
  const pills = all<HTMLElement>('[data-mt="pill"]');

  // What the previous section leaves behind; the iris dissolves it.
  const manifestoLayer = one<HTMLElement>('[data-m="layer"]');
  const manifestoFrame = one<HTMLElement>('[data-m="frame"]');

  const collect = (svg: SVGSVGElement): MapParts => ({
    svg,
    ring: one<SVGCircleElement>('[data-mt="ring"]', svg),
    crosses: all<SVGPathElement>('[data-mt="cross"]', svg),
    links: all<SVGPathElement>('[data-mt="link"]', svg),
    innovLink: one<SVGPathElement>('[data-mt="innov-link"]', svg),
    ghost: one<SVGCircleElement>('[data-mt="ghost"]', svg),
    resultLine: one<SVGLineElement>('[data-mt="result"]', svg),
    resultCap: one<SVGCircleElement>('[data-mt="result-cap"]', svg),
    resultLabel: one<SVGTextElement>('[data-mt="result-label"]', svg),
    nodes: all<SVGGElement>('[data-mt="node"]', svg).map((group) => ({
      group,
      halo: one<SVGGElement>('[data-mt="halo"]', group),
      haloCircle: one<SVGCircleElement>('[data-mt="halo"] circle', group),
      dot: one<SVGCircleElement>(".mp-dot", group),
      label: one<SVGTextElement>(".mp-label", group),
      tag: group.querySelector<SVGTextElement>(".mp-tag"),
      half: 40,
      tagHalf: 56,
    })),
    center: one<SVGCircleElement>('[data-mt="center"]', svg),
    centerHalo: one<SVGCircleElement>('[data-mt="center-halo"]', svg),
    centerLabel: one<SVGTextElement>('[data-mt="center-label"]', svg),
  });

  const [rawMap, lensMap] = all<SVGSVGElement>('[data-mt="map"]').map(collect);
  const maps = [rawMap, lensMap];

  // Same idea as the manifesto: remember what was written and skip repeats.
  const written = new WeakMap<Element, Map<string, string>>();
  const write = (element: Element, name: string, value: string, asStyle = false) => {
    let seen = written.get(element);
    if (!seen) written.set(element, (seen = new Map()));
    if (seen.get(name) === value) return;

    seen.set(name, value);
    if (asStyle) (element as HTMLElement).style.setProperty(name, value);
    else element.setAttribute(name, value);
  };
  const num = (value: number) => value.toFixed(1);

  let crown: CrownPosition = { x: 0.74, y: 0.46 };
  let staticMode = false;
  let active = false;
  let irisClipped = false;
  let opened = false;
  let geo = measureGeometry();

  function measureGeometry(): Geometry {
    // Static layouts centre the map in the lens's own box; otherwise the frame
    // is the dark layer, which is bottom-aligned exactly like the manifesto's.
    const box = staticMode ? lensMap.svg : dark;
    const base = measureFigure(stage, box, crown, staticMode, 0.46);
    const { mobile } = base;

    if (staticMode) {
      const { unit } = base;
      return {
        ...base,
        mx: base.cx,
        my: base.cy,
        mapRadius: unit * 0.3,
        scanRadius: unit * 0.26,
        fullRadius: Math.min(base.width, base.height) / 2,
      };
    }

    // The lens and the map live in a safe band: below the header, above the steps
    // and the rule, and on a phone below the copy too. Sizing them from the frame's
    // height alone let a short window (a laptop with its toolbars up is ~600px)
    // push the lens up over the navigation. The band's half-height caps the unit,
    // so the whole map shrinks with the lens and its labels still fit.
    const fullFactor = mobile ? 0.5 : 0.52;
    const copyBottom = mobile
      ? slidesBox.getBoundingClientRect().bottom - dark.getBoundingClientRect().top
      : 0;
    const bandTop = Math.max(SAFE_TOP, copyBottom + 14);
    const bandBottom = base.height - SAFE_BOTTOM;
    const unit = Math.min(base.unit, Math.max(70, (bandBottom - bandTop) / 2) / fullFactor);
    const fullRadius = unit * fullFactor;

    return {
      ...base,
      unit,
      mx: mobile ? base.width / 2 : base.cx,
      // As close to the crown as the band allows; the iris drifts the rest of the way.
      my: Math.min(Math.max(base.cy, bandTop + fullRadius), bandBottom - fullRadius),
      mapRadius: unit * (mobile ? 0.26 : 0.3),
      scanRadius: unit * (mobile ? 0.3 : 0.26),
      fullRadius,
    };
  }

  function measure() {
    geo = measureGeometry();

    // Labels are a fixed size, so on a small lens (a short phone) they would
    // crowd each other. Let them shrink with the lens, but not below legibility.
    const labelScale = Math.min(1, Math.max(0.78, geo.fullRadius / 230)).toFixed(3);
    maps.forEach(({ svg }) => {
      svg.setAttribute("viewBox", `0 0 ${geo.width} ${geo.height}`);
      svg.style.setProperty("--ls", labelScale);
    });
    rimSvg.setAttribute("viewBox", `0 0 ${geo.width} ${geo.height}`);
    dark.style.setProperty("--mx", `${num(geo.mx)}px`);
    dark.style.setProperty("--my", `${num(geo.my)}px`);

    // Label widths are needed to seat them beside a node. Fonts may still be
    // loading on the first call; the caller measures again once they are in.
    rawMap.nodes.forEach((node, i) => {
      const half = node.label.getComputedTextLength() / 2 || node.half;
      const tagHalf = (node.tag?.getComputedTextLength() ?? 0) / 2 || node.tagHalf;
      [rawMap, lensMap].forEach((map) => {
        map.nodes[i].half = half;
        map.nodes[i].tagHalf = tagHalf;
      });
    });
  }

  const slotAngle = (slot: number) => -90 + (360 / SLOT_COUNT) * slot;
  const polar = (angle: number, radius: number): Point => ({
    x: geo.mx + radius * Math.cos(radians(angle)),
    y: geo.my + radius * Math.sin(radians(angle)),
  });

  const orderedPoint = (slot: number) => polar(slotAngle(slot), geo.mapRadius);
  const tangledPoint = (i: number) =>
    polar(NODES[i].tangle.angle, geo.mapRadius * NODES[i].tangle.radius);

  /** A soft S-curve from `from` to `to`; `curl` bends it, `slack` says how much is left. */
  const curve = (from: Point, to: Point, curl: number, slack: number) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const bend = curl * length * slack * 1.3;

    const c1x = from.x + dx * 0.3 + nx * bend;
    const c1y = from.y + dy * 0.3 + ny * bend;
    const c2x = from.x + dx * 0.7 - nx * bend;
    const c2y = from.y + dy * 0.7 - ny * bend;

    return `M${num(from.x)} ${num(from.y)}C${num(c1x)} ${num(c1y)} ${num(c2x)} ${num(c2y)} ${num(to.x)} ${num(to.y)}`;
  };

  const lensCenter = (q: number): Point => {
    const centre = { x: geo.mx, y: geo.my };
    const at = (node: number) => (node < 0 ? centre : tangledPoint(node));

    if (q <= SCAN[0].at) return centre;
    for (let i = 1; i < SCAN.length; i++) {
      if (q > SCAN[i].at) continue;

      const from = at(SCAN[i - 1].node);
      const to = at(SCAN[i].node);
      const t = easeInOut(seg(q, [SCAN[i - 1].at, SCAN[i].at]));
      return { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) };
    }
    return centre;
  };

  function paintMap(map: MapParts, state: MapState) {
    const { mx: cx, my: cy, mapRadius, width } = geo;
    const isLens = map === lensMap;
    const centre = { x: cx, y: cy };

    // The perimeter appears only once everything has found its place.
    write(map.ring, "cx", num(cx));
    write(map.ring, "cy", num(cy));
    write(map.ring, "r", num(mapRadius));
    write(map.ring, "opacity", state.ringOpacity.toFixed(3), true);

    map.crosses.forEach((path, k) => {
      const [a, b] = CROSS_LINKS[k];
      const pa = state.points[a];
      const pb = state.points[b];
      // Pull each end towards the middle so the connection swings across it.
      const ca = { x: lerp(pa.x, cx, 0.85), y: lerp(pa.y, cy, 0.85) };
      const cb = { x: lerp(pb.x, cx, 0.85), y: lerp(pb.y, cy, 0.85) };
      const side = k % 2 === 0 ? 1 : -1;
      const nx = -(pb.y - pa.y);
      const ny = pb.x - pa.x;
      const norm = Math.hypot(nx, ny) || 1;
      const swing = 0.32 * side * Math.hypot(pb.x - pa.x, pb.y - pa.y);

      const d = `M${num(pa.x)} ${num(pa.y)}C${num(ca.x + (nx / norm) * swing)} ${num(ca.y + (ny / norm) * swing)} ${num(cb.x - (nx / norm) * swing)} ${num(cb.y - (ny / norm) * swing)} ${num(pb.x)} ${num(pb.y)}`;
      write(path, "d", d);
      write(path, "opacity", state.crossOpacity.toFixed(3), true);
    });

    map.links.forEach((path, i) => {
      write(path, "d", curve(centre, state.points[i], LINK_CURL[i], state.slack));
    });

    write(map.innovLink, "d", curve(centre, state.points[INNOVATION_SLOT], 0, 0));
    write(map.innovLink, "opacity", state.innovLink.toFixed(3), true);
    // Drawn from the centre outwards by growing a dash.
    write(map.innovLink, "stroke-dasharray", `${num(mapRadius)} ${num(mapRadius)}`, true);
    write(map.innovLink, "stroke-dashoffset", num(mapRadius * (1 - state.innovLink)), true);

    const slotHome = orderedPoint(INNOVATION_SLOT);
    write(map.ghost, "cx", num(slotHome.x));
    write(map.ghost, "cy", num(slotHome.y));
    write(map.ghost, "opacity", state.ghost.toFixed(3), true);

    map.nodes.forEach((node, i) => {
      const point = state.points[i];
      const isInnovation = i === INNOVATION_SLOT;
      const pain = isLens ? state.pain[i] : 0;
      const grow = isInnovation ? smooth(state.innovate) : 1;

      write(node.dot, "cx", num(point.x));
      write(node.dot, "cy", num(point.y));
      write(node.dot, "r", num(5 * grow + (pain > 0.5 ? 1.2 : 0)));
      write(node.halo, "opacity", pain.toFixed(3), true);
      write(node.group, "data-pain", pain > 0.5 ? "true" : "false");
      write(node.haloCircle, "cx", num(point.x));
      write(node.haloCircle, "cy", num(point.y));

      // Seat the label just outside its node, on the side facing away from the
      // centre. Using the label's own half-width keeps the placement continuous
      // as the node moves, so it never flips sides.
      const dx = point.x - cx;
      const dy = point.y - cy;
      const norm = Math.hypot(dx, dy) || 1;
      const ux = dx / norm;
      const uy = dy / norm;
      // A label that would run off the screen, or (once the lens holds the whole
      // map) off the lens, slides back in, and drops clear of its node so it never
      // sits on top of the dot. While the lens is a small scanner, labels are left
      // to cross its edge: that is the lens revealing them.
      const lensReach = (y: number) => Math.sqrt(Math.max(0, (geo.fullRadius - 10) ** 2 - (y - cy) ** 2));
      const fit = (x: number, half: number, y: number) => {
        const screen = Math.min(Math.max(x, 8 + half), width - 8 - half);
        if (state.lensFull <= 0) return screen;

        const reach = lensReach(y);
        const low = cx - reach + half;
        const high = cx + reach - half;
        const inside = low > high ? cx : Math.min(Math.max(screen, low), high);
        return lerp(screen, inside, state.lensFull);
      };
      const rawLabelX = point.x + ux * (node.half + 13);
      const rawLabelY = point.y + uy * 15 + 3.6;
      const labelX = fit(rawLabelX, node.half, rawLabelY);
      const pushed = Math.abs(labelX - rawLabelX) > 0.5 ? (uy < 0 ? -11 : 11) : 0;
      const labelY = rawLabelY + pushed;

      write(node.label, "x", num(labelX));
      write(node.label, "y", num(labelY));
      write(node.label, "--k", (isInnovation ? state.innovLabel : 1).toFixed(3), true);

      if (node.tag) {
        const tagY = labelY + 12 * Math.tanh(uy * 4);
        write(node.tag, "x", num(fit(point.x + ux * (node.tagHalf * 0.5 + 13), node.tagHalf, tagY)));
        write(node.tag, "y", num(tagY));
        write(node.tag, "--k", pain.toFixed(3), true);
      }
    });

    write(map.center, "cx", num(cx));
    write(map.center, "cy", num(cy));
    write(map.center, "r", num(7));
    write(map.centerHalo, "cx", num(cx));
    write(map.centerHalo, "cy", num(cy));
    write(map.centerLabel, "x", num(cx));
    write(map.centerLabel, "y", num(cy + 27));

    // The result leaves through the gap between two slots.
    const angle = radians(RESULT_ANGLE);
    const reach = (mapRadius + geo.unit * 0.09) * state.result;
    const tipX = cx + reach * Math.cos(angle);
    const tipY = cy + reach * Math.sin(angle);
    write(map.resultLine, "x1", num(cx));
    write(map.resultLine, "y1", num(cy));
    write(map.resultLine, "x2", num(tipX));
    write(map.resultLine, "y2", num(tipY));
    write(map.resultLine, "opacity", state.result > 0 ? "1" : "0", true);
    write(map.resultCap, "cx", num(tipX));
    write(map.resultCap, "cy", num(tipY));
    write(map.resultCap, "r", num(3.6 * smooth(state.result)));
    write(map.resultLabel, "x", num(tipX - 10));
    write(map.resultLabel, "y", num(tipY - 17));
    write(map.resultLabel, "opacity", state.resultLabel.toFixed(3), true);
  }

  type MapState = {
    points: Point[];
    slack: number;
    crossOpacity: number;
    ringOpacity: number;
    pain: number[];
    ghost: number;
    innovate: number;
    innovLink: number;
    innovLabel: number;
    result: number;
    resultLabel: number;
    /** 0 while the lens is a small scanner, 1 once it holds the whole map. */
    lensFull: number;
  };

  function mapState(q: number): MapState {
    const o = easeInOut(seg(q, T.order));
    const innovate = seg(q, T.innovate);

    const points: Point[] = NODES.map((_, i) => {
      const tangled = tangledPoint(i);
      const ordered = orderedPoint(SLOT_OF[i]);
      return { x: lerp(tangled.x, ordered.x, o), y: lerp(tangled.y, ordered.y, o) };
    });

    // Innovation drifts in from just outside the ring to the slot left open for it.
    const home = orderedPoint(INNOVATION_SLOT);
    const away = polar(slotAngle(INNOVATION_SLOT), geo.mapRadius * 1.55);
    const arrive = easeOut(innovate);
    points.push({ x: lerp(away.x, home.x, arrive), y: lerp(away.y, home.y, arrive) });

    // A pain point stays lit until the untangling reaches it, then it goes quiet.
    let rank = 0;
    const pain = NODES.map((node) => {
      if (!node.pain) return 0;
      const resolved = smooth(seg(o, [0.15 + rank * 0.2, 0.6 + rank * 0.2]));
      rank += 1;
      return 1 - resolved;
    });
    pain.push(0);

    return {
      points,
      slack: 1 - o,
      crossOpacity: 1 - smooth(seg(o, [0, 0.55])),
      ringOpacity: smooth(seg(o, [0.55, 1])),
      pain,
      ghost: smooth(seg(q, T.ghost)) * (1 - smooth(seg(q, [0.86, 0.91]))),
      innovate,
      innovLink: easeInOut(seg(q, T.innovLink)),
      innovLabel: seg(q, T.innovLabel),
      result: easeInOut(seg(q, T.result)),
      resultLabel: seg(q, T.resultLabel),
      lensFull: easeInOut(seg(q, T.lensGrow)),
    };
  }

  function render(irisProgress: number, method: number, open: number, under = false) {
    const j = irisProgress;
    const q = method;

    // 1. The iris. The cream section is not scrolled away: it closes, shrinking
    //    onto the lens's position while the dark section, waiting underneath,
    //    is uncovered from the edges inwards. It is a plain circle clip on the
    //    manifesto's own layer, the same cheap kind of clip the wipe used.
    const irisEase = easeInOut(j);
    const irisRadius = lerp(geo.maxRadius, geo.scanRadius, irisEase);
    const irisX = lerp(geo.cx, geo.mx, irisEase);
    const irisY = lerp(geo.cy, geo.my, irisEase);
    const irisOn = j > 0;
    // Once the lens fills the screen (the spread ends at 0.55) the dark layer is
    // fully covered. Hiding it stops its pulsing halos repainting under the paper
    // for the whole track.
    dark.style.visibility = irisOn && open < 0.6 ? "visible" : "hidden";

    // The manifesto engine leaves its clip alone once the wipe is done, so this is
    // the only writer while the iris is on.
    if (irisOn) {
      const stageY = irisY + (geo.stageHeight - geo.height);
      manifestoLayer.style.clipPath = `circle(${num(irisRadius)}px at ${num(irisX)}px ${num(stageY)}px)`;
      irisClipped = true;
    } else if (irisClipped) {
      // Back before the iris: hand the clip back rather than assuming the wipe is
      // long done and hard-setting "none" — manifesto.render() already wrote the
      // right value for wherever `progress` actually is this frame (it runs first
      // in the same pass), which is not always "wipe finished": a jump can land
      // back inside the wipe itself, not just at its edge.
      irisClipped = false;
    }

    // What the cream was showing dissolves before the dark reaches it, so the
    // lens is born on plain paper rather than on top of section 02's drawing.
    write(manifestoFrame, "opacity", j > 0 ? (1 - smooth(seg(j, [0.3, 0.75]))).toFixed(3) : "", true);
    manifestoLayer.style.visibility = j >= 1 ? "hidden" : "";
    // Its idle pulses are CSS animations on SVG; inside a layer that is now being
    // clipped and faded they force the whole screen to repaint every frame. They
    // are barely visible by then, so they stop as the iris starts.
    manifestoLayer.classList.toggle("is-closing", j > 0.1);

    // 2. The lens: a cream disc that finds the map, scans it, then swells to hold
    //    all of it.
    const lensOn = j >= 0.72;
    // Once the next section covers it the lens has nothing left to show, so it stops
    // costing anything (the whole solutions track lives inside it).
    lens.style.visibility = lensOn && !under ? "visible" : "hidden";
    write(lens, "opacity", smooth(seg(j, [0.72, 1])).toFixed(3), true);

    // 2b. The opening. Once the map is done the lens keeps growing, past its own
    //     frame, until it is the whole screen. The orange rim goes with it and
    //     fades as it leaves, so the paper just takes over.
    const spread = easeInOut(seg(open, OPEN.spread));
    const lensRadius = lerp(
      lerp(geo.scanRadius, geo.fullRadius, easeInOut(seg(q, T.lensGrow))),
      geo.maxRadius,
      spread,
    );
    const centre = lensCenter(q);
    write(
      lens,
      "clip-path",
      spread >= 1
        ? "none"
        : `circle(${num(lensRadius)}px at ${num(centre.x)}px ${num(centre.y)}px)`,
      true,
    );

    // The orange front of the wipe becomes the lens's rim.
    const rimX = j < 1 ? irisX : centre.x;
    const rimY = j < 1 ? irisY : centre.y;
    const rimR = j < 1 ? irisRadius : lensRadius;
    write(rim, "cx", num(rimX));
    write(rim, "cy", num(rimY));
    write(rim, "r", num(rimR));
    write(rim, "opacity", irisOn ? (1 - smooth(seg(open, OPEN.rimOut))).toFixed(3) : "0", true);
    write(ticks, "cx", num(rimX));
    write(ticks, "cy", num(rimY));
    write(ticks, "r", num(rimR + 7));
    write(ticks, "stroke-dasharray", `1 ${num((2 * Math.PI * (rimR + 7)) / 90 - 1)}`, true);
    write(ticks, "opacity", (smooth(seg(j, [0.8, 1])) * (1 - smooth(seg(open, OPEN.rimOut)))).toFixed(3), true);

    // The map inside the lens has said what it had to; it dissolves as the paper spreads.
    write(lensMap.svg, "opacity", (1 - smooth(seg(open, OPEN.mapOut))).toFixed(3), true);

    // 3. The map, drawn twice: dim outside the lens, diagnosed inside it.
    write(rawMap.svg, "opacity", smooth(seg(j, [0.5, 1])).toFixed(3), true);
    const state = mapState(q);
    maps.forEach((map) => paintMap(map, state));

    // 4. Words. Each act's title slides in and out through its mask; the lines
    //    under it follow a beat later.
    slides.forEach((slide, a) => {
      const { into, out } = ACTS[a];
      const arriving = easeOut(seg(q, into));
      const leaving = out ? easeIn(seg(q, out)) : 0;

      const title = slide.querySelector<HTMLElement>(".m3-title > span");
      if (title) {
        write(title, "transform", `translateY(${((1 - arriving) * HIDDEN - leaving * HIDDEN).toFixed(2)}%)`, true);
      }

      slide.querySelectorAll<HTMLElement>("[data-mt-line]").forEach((line, k) => {
        const delay = 0.02 + k * 0.025;
        const lineIn = easeOut(seg(q, [into[0] + delay, into[1] + delay]));
        const lineOut = out ? easeInOut(seg(q, [out[0] - 0.01, out[1] - 0.01])) : 0;
        write(line, "opacity", (lineIn * (1 - lineOut)).toFixed(3), true);
        write(line, "transform", `translateY(${((1 - lineIn) * 18 - lineOut * 18).toFixed(2)}px)`, true);
      });
    });

    pills.forEach((pill, i) => {
      const start = T.pills[0] + (i / pills.length) * (T.pills[1] - T.pills[0] - 0.05);
      const shown = easeOut(seg(q, [start, start + 0.05]));
      const gone = ACTS[1].out ? easeInOut(seg(q, [ACTS[1].out[0] - 0.01, ACTS[1].out[1] - 0.01])) : 0;
      write(pill, "opacity", (shown * (1 - gone)).toFixed(3), true);
      write(pill, "transform", `translateY(${((1 - shown) * 12 - gone * 12).toFixed(2)}px)`, true);
    });

    // 5. Chrome.
    write(eyebrow, "opacity", seg(j, [0.6, 1]).toFixed(3), true);
    write(foot, "opacity", seg(j, [0.7, 1]).toFixed(3), true);
    const step = q < T.lensGrow[0] ? 0 : q < ACTS[2].into[0] - 0.02 ? 1 : 2;
    steps.forEach((element, i) => write(element, "data-active", String(i === step)));
    write(rule, "transform", `scaleX(${q.toFixed(4)})`, true);

    const isActive = j >= 0.5;
    if (isActive !== active) {
      active = isActive;
      onActive(active);
    }

    // The paper's own (ink) header takes over once it covers the dark one.
    const isOpen = open >= 0.45;
    if (isOpen !== opened) {
      opened = isOpen;
      onOpen(opened);
    }
  }

  function paintStatic() {
    staticMode = true;
    measure();

    // The finished picture: everything ordered, innovation in place, result drawn.
    const state = mapState(1);
    maps.forEach((map) => paintMap(map, { ...state, pain: state.pain.map(() => 0) }));
    write(lensMap.svg, "opacity", "1", true);
  }

  measure();

  return {
    setCrown(next) {
      crown = next;
      measure();
    },
    measure,
    render,
    paintStatic,
    destroy() {
      // Leave no inline state behind, so a switch to the static layout starts clean.
      [dark, lens, rim, ticks, eyebrow, foot, rule, manifestoLayer, manifestoFrame, ...slides, ...pills].forEach(
        (element) => element.removeAttribute("style"),
      );
      slides.forEach((slide) => {
        slide.querySelectorAll("[style]").forEach((element) => element.removeAttribute("style"));
      });
      rawMap.svg.removeAttribute("style");
      dark.style.removeProperty("--mx");
      manifestoLayer.classList.remove("is-closing");
    },
  };
}
