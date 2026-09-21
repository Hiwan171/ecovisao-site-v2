import type { CrownPosition } from "../hero/hero-scene";
import { type FigureGeometry, measureFigure } from "../stage/figure-geometry";

/**
 * The whole section is one function of scroll progress. `render(p)` reads nothing
 * but `p` and the clock, so any frame can be reproduced exactly, and scrolling
 * backwards plays it backwards for free. The one exception is the three orbiting
 * nodes, which chase their target with a speed limit (see NODE_MAX_SPEED) so a
 * fast scroll cannot whip them around.
 *
 * Copy is deliberately limited to what the site already says: the Eco / Visão
 * split, the pessoas–processos–estratégia trio and "visão integrada" from the
 * loader.
 */

type Range = readonly [number, number];

/** Progress at which each beat happens. Everything below reads from here. */
const T = {
  wipe: [0, 0.16],
  ecoIn: [0.17, 0.25],
  ecoOut: [0.38, 0.45],
  nodesIn: [0.2, 0.33],
  rotate: [0.38, 0.66],
  statementIn: [0.43, 0.49],
  words: [0.48, 0.67],
  axis: [0.64, 0.7],
  integrated: [0.68, 0.72],
  statementOut: [0.72, 0.77],
  visionIn: [0.75, 0.83],
  zoom: [0.74, 0.92],
  satellites: [0.8, 0.94],
} as const satisfies Record<string, Range>;

/** Progress the "Nossa visão" links scroll to: the Eco headline fully in. */
export const ANCHOR_PROGRESS = 0.27;

/**
 * The three orbits. `offset` is how far each node starts from the shared axis
 * (degrees) and `arrive` is when it lands on it. While idle a node sways around
 * its start by `amp` degrees every `period` seconds. The sway has to be bounded:
 * it used to be a steady drift, which piled up degrees for as long as the page
 * stayed open and then had to be unwound in a few hundred pixels of scroll.
 * Different amplitudes and periods are what make it read as a mechanism.
 */
export const SYSTEM = [
  { label: "PESSOAS", frac: 0.2, offset: -70, amp: 22, period: 9, phase: 0, arrive: 0.58 },
  { label: "PROCESSOS", frac: 0.33, offset: 95, amp: 18, period: 12, phase: 130, arrive: 0.62 },
  { label: "ESTRATÉGIA", frac: 0.46, offset: 120, amp: 14, period: 16, phase: 250, arrive: 0.66 },
] as const;

/** Fainter rings past the system: the ripple the wipe leaves behind. */
export const ECHO_RINGS = [0.6, 0.76, 0.93] as const;

/** Other systems, seen once the view pulls back. `ring` indexes ECHO_RINGS. */
export const SATELLITES = [
  { ring: 0, angle: 5 },
  { ring: 1, angle: 62 },
  { ring: 2, angle: 122 },
  { ring: 0, angle: 182 },
  { ring: 1, angle: 236 },
  { ring: 2, angle: 276 },
] as const;

/** Slide masks on the headlines are translated by this much while hidden. */
const HIDDEN = 112;

/**
 * Nodes do not jump to where the scroll says they should be; they chase it. This
 * is how fast they settle (per second), and the fastest they may ever move, in
 * degrees per second. The cap is what keeps a hard fling from shuffling them:
 * however quickly the page is scrolled, an orbit never turns faster than this.
 */
const NODE_FOLLOW = 3;
const NODE_MAX_SPEED = 55;

/** After this long without a frame the engine was idle, so nodes snap instead of chasing. */
const IDLE_GAP_MS = 500;

/** How far the view pulls back at the end. Phones pull back less so the labels stay apart. */
const ZOOM_OUT = { desktop: 0.62, mobile: 0.74 } as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const seg = (p: number, [from, to]: Range) => clamp01((p - from) / (to - from));
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t * t;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const radians = (degrees: number) => (degrees * Math.PI) / 180;

type Geometry = FigureGeometry & {
  /** Angle of the shared axis, degrees. */
  axisAngle: number;
};

type FigureState = {
  wipeRadius: number;
  zoom: number;
  appear: number[];
  arrive: number[];
  lit: number[];
  axis: number;
  integrated: number;
  satellites: number[];
  time: number;
  /** Seconds since the last frame, and whether to skip the chase entirely. */
  dt: number;
  immediate: boolean;
};

export type ManifestoEngine = {
  setCrown: (crown: CrownPosition) => void;
  measure: () => void;
  /** Returns true once nothing is left to animate, so the caller may stop its loop. */
  render: (progress: number, now: number, immediate?: boolean) => boolean;
  paintStatic: () => void;
  destroy: () => void;
};

type NodeParts = {
  group: SVGGElement;
  halo: SVGCircleElement;
  dot: SVGCircleElement;
  label: SVGTextElement;
  /** Half the label's rendered width, measured once fonts are in. */
  half: number;
};

type SatelliteParts = { spoke: SVGLineElement; dot: SVGCircleElement };

export function createManifestoEngine(
  stage: HTMLElement,
  { onCover }: { onCover: (covered: boolean) => void },
): ManifestoEngine {
  const one = <E extends Element>(selector: string) => stage.querySelector(selector) as E;
  const all = <E extends Element>(selector: string) =>
    Array.from(stage.querySelectorAll(selector)) as E[];

  const layer = one<HTMLElement>('[data-m="layer"]');
  const figure = one<SVGSVGElement>('[data-m="figure"]');
  const frontSvg = one<SVGSVGElement>('[data-m="front-svg"]');
  const front = one<SVGCircleElement>('[data-m="front"]');
  const center = one<SVGCircleElement>('[data-m="center"]');
  const pulses = all<SVGCircleElement>('[data-m="pulse"]');
  const axisLine = one<SVGLineElement>('[data-m="axis"]');
  const axisCap = one<SVGCircleElement>('[data-m="axis-cap"]');
  const integratedLabel = one<SVGTextElement>('[data-m="integrated"]');
  const statement = one<HTMLElement>('[data-m="statement"]');
  const rule = one<HTMLElement>('[data-m="rule"]');
  const steps = all<HTMLElement>('[data-m="step"]');
  const ecoLines = all<HTMLElement>('[data-slide="eco"] .m-mask > span');
  const visionLines = all<HTMLElement>('[data-slide="vision"] .m-mask > span');
  const words = all<HTMLElement>('[data-m="word"]');

  const rings = all<SVGCircleElement>('[data-m="ring"]').map((element) => ({
    element,
    frac: Number(element.dataset.frac),
    ticks: Number(element.dataset.ticks ?? 0),
  }));

  const nodes: NodeParts[] = all<SVGGElement>('[data-m="node"]').map((group) => ({
    group,
    halo: group.querySelector(".m-node__halo") as SVGCircleElement,
    dot: group.querySelector(".m-node__dot") as SVGCircleElement,
    label: group.querySelector("text") as SVGTextElement,
    half: 40,
  }));

  const satellites: SatelliteParts[] = all<SVGGElement>('[data-m="sat"]').map((group) => ({
    spoke: group.querySelector("line") as SVGLineElement,
    dot: group.querySelector("circle") as SVGCircleElement,
  }));

  // A word is "key" when it stands for one of the three orbits, so its light
  // can drive that node's halo. The order in the sentence is the order of SYSTEM.
  const keyWords = words.map((word) => (word.dataset.key === undefined ? -1 : Number(word.dataset.key)));

  // Writing an attribute is cheap; writing the same one sixty times a second for
  // fifty elements is not. Remember what was last written and skip repeats.
  const written = new WeakMap<Element, Map<string, string>>();
  const write = (element: Element, name: string, value: string, asStyle = false) => {
    let seen = written.get(element);
    if (!seen) written.set(element, (seen = new Map()));
    if (seen.get(name) === value) return;

    seen.set(name, value);
    if (asStyle) (element as HTMLElement).style.setProperty(name, value);
    else element.setAttribute(name, value);
  };
  const num = (value: number) => value.toFixed(2);

  let crown: CrownPosition = { x: 0.74, y: 0.46 };
  let covered = false;
  let staticMode = false;
  let lastNow = 0;
  const nodeAngles: number[] = SYSTEM.map(() => Number.NaN);
  let geo = measureGeometry();

  function measureGeometry(): Geometry {
    const base = measureFigure(stage, figure, crown, staticMode, SYSTEM[2].frac);
    return { ...base, axisAngle: base.mobile ? 325 : 60 };
  }

  function measure() {
    geo = measureGeometry();
    figure.setAttribute("viewBox", `0 0 ${geo.width} ${geo.height}`);
    frontSvg.setAttribute("viewBox", `0 0 ${geo.stageWidth} ${geo.stageHeight}`);
    frontSvg.style.opacity = staticMode ? "0" : "";
    write(front, "cx", num(geo.originX));
    write(front, "cy", num(geo.originY));

    // The idle pulses grow until they just clear the outer orbit.
    figure.style.setProperty("--pulse-scale", num((geo.unit * SYSTEM[2].frac * 1.06) / 10));

    nodes.forEach((node) => {
      node.half = node.label.getComputedTextLength() / 2 || node.half;
    });
  }

  /** Returns false while any node is still on its way or swaying, i.e. still animating. */
  function paintFigure(state: FigureState): boolean {
    const { cx, cy, unit, mobile } = geo;
    const zoom = state.zoom;
    let settled = true;

    rings.forEach(({ element, frac, ticks }) => {
      const radius = frac * unit;
      const scaled = radius * zoom;
      // The wipe front sweeps outwards; a ring fades in as the front passes it.
      const reveal = smooth(clamp01((state.wipeRadius - radius) / (0.12 * unit)));

      write(element, "cx", num(cx));
      write(element, "cy", num(cy));
      write(element, "r", num(scaled));
      write(element, "opacity", reveal.toFixed(3), true);
      if (ticks) {
        write(element, "stroke-dasharray", `1 ${num((2 * Math.PI * scaled) / ticks - 1)}`, true);
      }
    });

    const seed = smooth(clamp01(state.wipeRadius / (0.04 * unit)));
    write(center, "cx", num(cx));
    write(center, "cy", num(cy));
    write(center, "r", num(6.5 * seed));
    pulses.forEach((pulse) => {
      write(pulse, "cx", num(cx));
      write(pulse, "cy", num(cy));
    });

    nodes.forEach((node, i) => {
      const spec = SYSTEM[i];
      const remaining = 1 - state.arrive[i];
      const sway = spec.amp * Math.sin((2 * Math.PI * state.time) / spec.period + radians(spec.phase));
      const target = geo.axisAngle + (spec.offset + sway) * remaining;

      if (state.immediate || Number.isNaN(nodeAngles[i])) nodeAngles[i] = target;
      else {
        const gap = target - nodeAngles[i];
        const ease = gap * (1 - Math.exp(-state.dt * NODE_FOLLOW));
        const limit = NODE_MAX_SPEED * state.dt;
        nodeAngles[i] += Math.abs(gap) < 0.05 ? gap : Math.max(-limit, Math.min(limit, ease));
      }
      // A visible node that has not landed is still swaying; one that has landed
      // only counts as moving until it has caught its target.
      if (Math.abs(target - nodeAngles[i]) >= 0.05 || (remaining > 0 && state.appear[i] > 0)) {
        settled = false;
      }
      const angle = nodeAngles[i];
      const radius = spec.frac * unit * zoom;
      const x = cx + radius * Math.cos(radians(angle));
      const y = cy + radius * Math.sin(radians(angle));
      const appear = smooth(state.appear[i]);
      const lit = state.lit[i];

      write(node.dot, "cx", num(x));
      write(node.dot, "cy", num(y));
      write(node.dot, "r", num(5 * appear + 1.6 * lit));
      write(node.halo, "cx", num(x));
      write(node.halo, "cy", num(y));
      write(node.halo, "r", num(11 + 4 * lit));
      write(node.halo, "opacity", (lit * 0.9).toFixed(3), true);
      write(node.group, "data-lit", lit > 0.5 ? "true" : "false");

      // Labels sit up and to the right of their node. On a phone the figure is
      // centred, so they lean towards the middle of the frame instead, easing
      // through centred-above as a node crosses it, which keeps them on screen.
      const half = node.half;
      const lean = mobile ? clamp01((x - geo.width / 2) / (geo.width * 0.22) / 2 + 0.5) : 0;
      const labelX = x + 14 - lean * (2 * half + 28);
      write(node.label, "x", num(labelX));
      write(node.label, "y", num(y - 13));
      write(node.label, "opacity", appear.toFixed(3), true);
    });

    const axisAngle = radians(geo.axisAngle);
    const reach = SYSTEM[2].frac * unit * zoom + 44;
    const tipX = cx + reach * Math.cos(axisAngle) * state.axis;
    const tipY = cy + reach * Math.sin(axisAngle) * state.axis;
    write(axisLine, "x1", num(cx));
    write(axisLine, "y1", num(cy));
    write(axisLine, "x2", num(tipX));
    write(axisLine, "y2", num(tipY));
    write(axisLine, "opacity", state.axis > 0 ? "1" : "0", true);
    write(axisCap, "cx", num(tipX));
    write(axisCap, "cy", num(tipY));
    write(axisCap, "r", num(3.6 * smooth(state.axis)));

    const labelOnLeft = tipX + 12 + 118 > geo.width - 12;
    write(integratedLabel, "x", num(labelOnLeft ? tipX - 12 : tipX + 12));
    write(integratedLabel, "y", num(tipY - 10));
    write(integratedLabel, "text-anchor", labelOnLeft ? "end" : "start");
    write(integratedLabel, "opacity", state.integrated.toFixed(3), true);

    satellites.forEach((satellite, i) => {
      const spec = SATELLITES[i];
      const grown = easeOut(state.satellites[i]);
      const angle = radians(spec.angle);
      const from = SYSTEM[2].frac * unit * zoom;
      const to = ECHO_RINGS[spec.ring] * unit * zoom;
      const x1 = cx + from * Math.cos(angle);
      const y1 = cy + from * Math.sin(angle);
      const x2 = cx + (from + (to - from) * grown) * Math.cos(angle);
      const y2 = cy + (from + (to - from) * grown) * Math.sin(angle);

      write(satellite.spoke, "x1", num(x1));
      write(satellite.spoke, "y1", num(y1));
      write(satellite.spoke, "x2", num(x2));
      write(satellite.spoke, "y2", num(y2));
      write(satellite.spoke, "opacity", grown.toFixed(3), true);
      write(satellite.dot, "cx", num(x2));
      write(satellite.dot, "cy", num(y2));
      write(satellite.dot, "r", num(3.5 * grown));
    });

    figure.classList.toggle("is-aligned", state.axis >= 1);
    return settled;
  }

  function render(progress: number, now: number, immediate = false): boolean {
    const p = progress;
    const idle = lastNow === 0 || now - lastNow > IDLE_GAP_MS;
    const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;

    // 1. The wipe: a circle grows out of the crown and is the first ripple.
    const wipe = easeInOut(seg(p, T.wipe));
    const wipeRadius = wipe * geo.maxRadius;
    // Written only when it changes: once the wipe is done this stays "none", and
    // the next section's iris takes the clip over without this fighting it.
    write(
      layer,
      "clip-path",
      wipe >= 1
        ? "none"
        : `circle(${wipeRadius.toFixed(1)}px at ${geo.originX.toFixed(1)}px ${geo.originY.toFixed(1)}px)`,
      true,
    );
    write(front, "r", num(wipeRadius));
    write(front, "opacity", (wipe <= 0 ? 0 : 1 - smooth(seg(wipe, [0.55, 1]))).toFixed(3), true);

    const isCovered = wipe >= 1;
    if (isCovered !== covered) {
      covered = isCovered;
      onCover(covered);
    }

    // 2. Headlines: masked lines slide up into place and out the top.
    const slide = (spans: HTMLElement[], into: Range, out: Range | null) => {
      spans.forEach((span, i) => {
        const gap = i * 0.018;
        const arriving = easeOut(seg(p, [into[0] + gap, into[1] + gap]));
        const leaving = out ? easeIn(seg(p, [out[0] + gap * 0.6, out[1] + gap * 0.6])) : 0;
        write(span, "transform", `translateY(${((1 - arriving) * HIDDEN - leaving * HIDDEN).toFixed(2)}%)`, true);
      });
    };
    slide(ecoLines, T.ecoIn, T.ecoOut);
    slide(visionLines, T.visionIn, null);

    // 3. The statement fades in, then lights word by word as the orbits align.
    const stIn = easeOut(seg(p, T.statementIn));
    const stOut = easeInOut(seg(p, T.statementOut));
    write(statement, "opacity", (stIn * (1 - stOut)).toFixed(3), true);
    write(statement, "transform", `translateY(${((1 - stIn) * 28 - stOut * 28).toFixed(2)}px)`, true);

    const litByKey = [0, 0, 0];
    const span = T.words[1] - T.words[0];
    words.forEach((word, i) => {
      const start = T.words[0] + (i / words.length) * (span - 0.03);
      const lit = seg(p, [start, start + 0.03]);
      write(word, "opacity", (0.14 + 0.86 * lit).toFixed(3), true);
      if (keyWords[i] >= 0) litByKey[keyWords[i]] = lit;
    });

    // 4. The figure. Node appearance staggers; arrival is per-orbit.
    const arrive = SYSTEM.map((spec) => easeInOut(seg(p, [T.rotate[0], spec.arrive])));
    const appear = SYSTEM.map((_, i) => seg(p, [T.nodesIn[0] + i * 0.035, T.nodesIn[0] + 0.1 + i * 0.035]));
    const axis = easeInOut(seg(p, T.axis));
    const settled = paintFigure({
      wipeRadius,
      zoom: 1 - (1 - (geo.mobile ? ZOOM_OUT.mobile : ZOOM_OUT.desktop)) * easeInOut(seg(p, T.zoom)),
      appear,
      arrive,
      lit: litByKey,
      axis,
      integrated: seg(p, T.integrated),
      satellites: SATELLITES.map((_, i) => seg(p, [T.satellites[0] + i * 0.02, T.satellites[0] + 0.12 + i * 0.02])),
      time: now / 1000,
      dt,
      immediate: immediate || idle,
    });

    // 5. Chrome: which beat we are on, and how far through.
    const step = p < 0.16 ? -1 : p < 0.42 ? 0 : p < 0.73 ? 1 : 2;
    steps.forEach((element, i) => write(element, "data-active", String(i === step)));
    write(rule, "transform", `scaleX(${clamp01((p - 0.16) / 0.84).toFixed(4)})`, true);

    return settled;
  }

  function paintStatic() {
    staticMode = true;
    measure();

    // Reduced motion and no-scroll layouts show the finished picture: everything
    // revealed, the orbits aligned and the view pulled back.
    paintFigure({
      wipeRadius: Infinity,
      zoom: 0.8,
      appear: [1, 1, 1],
      arrive: [1, 1, 1],
      lit: [1, 1, 1],
      axis: 1,
      integrated: 1,
      satellites: SATELLITES.map(() => 1),
      time: 0,
      dt: 0,
      immediate: true,
    });
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
      [layer, statement, rule, ...ecoLines, ...visionLines, ...words].forEach((element) =>
        element.removeAttribute("style"),
      );
      figure.removeAttribute("style");
      figure.classList.remove("is-aligned");
      frontSvg.removeAttribute("style");
    },
  };
}
