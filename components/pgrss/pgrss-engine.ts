/**
 * Section 05, "PGRSS". Like the sections before it, one function of scroll progress,
 * so any frame can be reproduced exactly and scrolling back plays it backwards. It
 * receives two progresses:
 *
 *  - `columns` (0..1): four green columns climb through the paper of section 04,
 *    staggered, each with an orange edge. They are the four lanes of what follows,
 *    so the transition is the section's own first drawing. The first stretch is a
 *    hold, so the closing panel of the section before can still be read and used.
 *  - `story` (0..1): the specialty. Mixed waste gathers in a funnel; a line
 *    sorts it into four groups; three promises are read against the flow; the four
 *    paths bend into one and end on a seal.
 *
 * The particles are drawn by pgrss-field.ts; this file only says how sorted, how
 * converged and how visible they are, and moves the words around them.
 */

import { type Field, LANES, createField } from "./pgrss-field";

type Range = readonly [number, number];

/** Where the columns wait before they start to climb, inside `columns`. */
const HOLD = 0.3;
/** Each column's start inside the climb, and how much of it one column takes. */
const COLUMN_START = [0.2, 0, 0.3, 0.1] as const;
const COLUMN_SPAN = 0.7;

/** Progress of each beat inside `story`. */
const T = {
  eyebrow: [0.02, 0.1],
  word: [0, 0.14],
  actOneIn: [0.03, 0.12],
  actOneOut: [0.17, 0.24],
  gate: [0.08, 0.2],
  sort: [0.14, 0.36],
  lanes: [0.24, 0.36],
  actTwoIn: [0.24, 0.32],
  actTwoOut: [0.5, 0.56],
  dim: [0.5, 0.58],
  pledgesOut: [0.84, 0.9],
  converge: [0.8, 0.94],
  actFour: [0.88, 0.95],
  seal: [0.9, 1],
  check: [0.94, 1],
} as const satisfies Record<string, Range>;

/** When each of the three promises arrives, and how long it takes to. */
const PLEDGE_AT = [0.56, 0.66, 0.76] as const;
const PLEDGE_SPAN = 0.06;
const ACT_FOUR_STEP = 0.03;

const HIDDEN = 112;
/** The seal's diameter is capped by these; the streams end at its centre. */
const SEAL_MAX = 240;
const SEAL_PAD = 22;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const seg = (p: number, [from, to]: Range) => clamp01((p - from) / (to - from));
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type PgrssEngine = {
  measure: () => void;
  render: (columns: number, story: number, now: number) => void;
  paintStatic: () => void;
  destroy: () => void;
};

const nothing: PgrssEngine = { measure() {}, render() {}, paintStatic() {}, destroy() {} };

export function createPgrssEngine(
  stage: HTMLElement,
  { onOpen }: { onOpen: (open: boolean) => void },
): PgrssEngine {
  const root = stage.querySelector<HTMLElement>('[data-pg="root"]');
  const capsWrap = stage.querySelector<HTMLElement>('[data-pg="caps"]');
  if (!root || !capsWrap) return nothing;

  const one = <E extends Element>(selector: string) => root.querySelector(selector) as E;
  const all = <E extends Element>(selector: string, from: ParentNode = root) =>
    Array.from(from.querySelectorAll(selector)) as E[];

  const field = one<HTMLElement>('[data-pg="field"]');
  const canvas = one<HTMLCanvasElement>('[data-pg="canvas"]');
  const gate = one<HTMLElement>('[data-pg="gate"]');
  const gateLabel = one<HTMLElement>('[data-pg="gate-label"]');
  const lanes = all<HTMLElement>('[data-pg="lane"]');
  const seal = one<HTMLElement>('[data-pg="seal"]');
  const sealRing = one<SVGCircleElement>('[data-pg="seal-ring"]');
  const sealText = one<SVGGElement>('[data-pg="seal-text"]');
  const sealCheck = one<SVGPathElement>('[data-pg="seal-check"]');
  const sealNode = one<SVGCircleElement>('[data-pg="seal-node"]');

  const word = one<HTMLElement>('[data-pg="word"]');
  const letters = all<HTMLElement>('[data-pg="letter"]');
  const eyebrow = one<HTMLElement>('[data-pg="eyebrow"]');
  const actOne = one<HTMLElement>('[data-pg="act1"]');
  const actTwo = one<HTMLElement>('[data-pg="act2"]');
  const pledges = one<HTMLElement>('[data-pg="pledges"]');
  const pledgeItems = all<HTMLElement>('[data-pg="pledge"]');
  const actFour = one<HTMLElement>('[data-pg="act4"]');
  const actFourLines = all<HTMLElement>('[data-pg="act4-line"]');
  const caps = all<HTMLElement>('[data-pg="cap"]', capsWrap);

  const particles: Field = createField(canvas);

  const written = new WeakMap<Element, Map<string, string>>();
  const write = (element: Element, name: string, value: string, asAttribute = false) => {
    let seen = written.get(element);
    if (!seen) written.set(element, (seen = new Map()));
    if (seen.get(name) === value) return;

    seen.set(name, value);
    if (asAttribute) element.setAttribute(name, value);
    else (element as HTMLElement).style.setProperty(name, value);
  };

  let width = 1;
  let height = 1;
  let gateY = 1;
  let binY = 1;
  /** On a phone the three promises take turns in one place instead of standing side by side. */
  let stacked = false;
  let opened = false;
  let closingInert = false;

  function measure() {
    const box = root!.getBoundingClientRect();
    width = box.width || 1;
    height = box.height || 1;

    const fieldBox = field.getBoundingClientRect();
    const fieldWidth = fieldBox.width || 1;
    const fieldHeight = fieldBox.height || 1;

    const style = getComputedStyle(field);
    const fraction = parseFloat(style.getPropertyValue("--pg-gate")) || 0.44;
    stacked = style.getPropertyValue("--pg-stack").trim() === "1";

    // The seal is centred where the streams end, so the streams are what point at it.
    const sealSize = Math.min(SEAL_MAX, fieldHeight * 0.26, fieldWidth * 0.5);
    gateY = fieldHeight * fraction;
    binY = fieldHeight - sealSize / 2 - SEAL_PAD;
    field.style.setProperty("--pg-seal", `${sealSize.toFixed(1)}px`);
    field.style.setProperty("--pg-bin", `${binY.toFixed(1)}px`);

    particles.resize(fieldWidth, fieldHeight);
  }

  // The pointer nudges the waste it touches: something to play with, never something to wait for.
  const onMove = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    const box = canvas.getBoundingClientRect();
    particles.pointer(event.clientX - box.left, event.clientY - box.top);
  };
  const onLeave = () => particles.release();
  root.addEventListener("pointermove", onMove, { passive: true });
  root.addEventListener("pointerleave", onLeave);

  const polygon = (tops: readonly number[]) => {
    const points = [`0px ${height}px`];
    tops.forEach((top, k) => {
      const left = (width * k) / LANES;
      const right = (width * (k + 1)) / LANES;
      points.push(`${left.toFixed(1)}px ${top.toFixed(1)}px`, `${right.toFixed(1)}px ${top.toFixed(1)}px`);
    });
    points.push(`${width}px ${height}px`);
    return `polygon(${points.join(",")})`;
  };

  function render(columns: number, story: number, now: number) {
    // 1. The columns climb through the paper.
    const held = seg(columns, [HOLD, 1]);
    const visible = held > 0;
    write(root!, "visibility", visible ? "visible" : "hidden");

    if (held >= 1) {
      write(root!, "clip-path", "none");
    } else if (visible) {
      const tops = COLUMN_START.map((start) =>
        lerp(height + 6, -6, easeInOut(seg(held, [start, start + COLUMN_SPAN]))),
      );
      write(root!, "clip-path", polygon(tops));

      caps.forEach((cap, k) => {
        const climb = seg(held, [COLUMN_START[k], COLUMN_START[k] + COLUMN_SPAN]);
        write(cap, "transform", `translate3d(0,${tops[k].toFixed(1)}px,0)`);
        write(cap, "opacity", (smooth(clamp01(climb * 10)) * (1 - smooth(seg(climb, [0.9, 1])))).toFixed(3));
      });
    } else {
      write(root!, "clip-path", "inset(100% 0 0 0)");
    }

    // The caps run over the paper while the columns are in motion, and leave with them.
    write(capsWrap!, "visibility", visible && held < 1 ? "visible" : "hidden");

    // The columns have covered the paper: the header inverts along their edge, so it
    // is the cream one that can be reached from here on.
    const isOpen = held >= 0.75;
    if (isOpen !== opened) {
      opened = isOpen;
      onOpen(opened);
    }

    if (!visible) return;

    // 2. The story. It sits in place from the start, waiting under the columns.
    const p = story;
    const time = now / 1000;
    const sorted = smooth(seg(p, T.sort));
    const converge = smooth(seg(p, T.converge));
    const dimmed = smooth(seg(p, T.dim));

    // The giant word rises out of its masks, then falls back and drifts, so the
    // waste is what is in front.
    letters.forEach((letter, i) => {
      const shown = easeOut(seg(p, [T.word[0] + i * 0.012, T.word[1] + i * 0.012]));
      write(letter, "transform", `translateY(${((1 - shown) * HIDDEN).toFixed(2)}%)`);
    });
    // It steps back twice: once for the sorting, and almost out for the promises,
    // which need the whole width of the top to be read.
    const recede =
      smooth(seg(p, [T.actOneOut[0], 0.3])) * 0.5 + smooth(seg(p, T.dim)) * 0.36 + smooth(seg(p, [0.86, 0.94])) * 0.1;
    write(word, "opacity", (1 - recede).toFixed(3));
    write(word, "transform", `translate3d(${(-p * width * 0.05).toFixed(1)}px,0,0)`);

    write(eyebrow, "opacity", easeOut(seg(p, T.eyebrow)).toFixed(3));

    // Act one hands over to act two: what it is, then what it does.
    const oneIn = easeOut(seg(p, T.actOneIn));
    const oneOut = smooth(seg(p, T.actOneOut));
    write(actOne, "opacity", (oneIn * (1 - oneOut)).toFixed(3));
    write(actOne, "transform", `translateY(${((1 - oneIn) * 18 - oneOut * 22).toFixed(2)}px)`);

    const twoIn = easeOut(seg(p, T.actTwoIn));
    const twoOut = smooth(seg(p, T.actTwoOut));
    write(actTwo, "opacity", (twoIn * (1 - twoOut)).toFixed(3));
    write(actTwo, "transform", `translateY(${((1 - twoIn) * 18 - twoOut * 22).toFixed(2)}px)`);

    // The line that sorts, and the lanes it sorts into.
    const gateIn = smooth(seg(p, T.gate));
    // The sorting is done once the paths bend into one: the line has nothing left to sort.
    write(gate, "opacity", (gateIn * (1 - converge)).toFixed(3));
    write(gate, "--pg-sweep", `${(((time * 0.16) % 1) * width).toFixed(1)}px`);
    write(gate, "data-hot", String(sorted > 0.02), true);
    write(gateLabel, "opacity", (gateIn * (1 - smooth(seg(p, [0.4, 0.5])))).toFixed(3));

    lanes.forEach((lane, k) => {
      const shown = smooth(seg(p, [T.lanes[0] + k * 0.02, T.lanes[1] + k * 0.02]));
      write(lane, "opacity", (shown * (1 - converge)).toFixed(3));
    });

    // The three promises, read while the flow goes on behind them.
    const alive = 1 - smooth(seg(p, T.pledgesOut));
    write(pledges, "opacity", alive.toFixed(3));
    pledgeItems.forEach((item, k) => {
      const at = PLEDGE_AT[k];
      const shown = easeOut(seg(p, [at, at + PLEDGE_SPAN]));
      const next = PLEDGE_AT[k + 1];
      const gone = stacked && next !== undefined ? smooth(seg(p, [next - 0.03, next])) : 0;

      write(item, "opacity", (shown * (1 - gone)).toFixed(3));
      write(item, "transform", `translateY(${((1 - shown) * 20 - gone * 16).toFixed(2)}px)`);
    });

    // The closing lines, and the seal the four paths end on.
    actFourLines.forEach((line, k) => {
      const shown = easeOut(seg(p, [T.actFour[0] + k * ACT_FOUR_STEP, T.actFour[1] + k * ACT_FOUR_STEP]));
      write(line, "opacity", shown.toFixed(3));
      write(line, "transform", `translateY(${((1 - shown) * 22).toFixed(2)}px)`);
    });

    // The link can only be reached once it is on screen.
    const unreachable = seg(p, T.actFour) < 0.55;
    if (unreachable !== closingInert) {
      closingInert = unreachable;
      actFour.inert = unreachable;
    }

    const sealIn = easeOut(seg(p, T.seal));
    write(seal, "opacity", sealIn.toFixed(3));
    write(seal, "transform", `translate3d(-50%,-50%,0) scale(${lerp(0.82, 1, sealIn).toFixed(4)})`);
    write(sealRing, "stroke-dashoffset", (1 - easeInOut(seg(p, T.seal))).toFixed(4));
    write(sealCheck, "stroke-dashoffset", (1 - easeInOut(seg(p, T.check))).toFixed(4));
    write(sealNode, "opacity", smooth(seg(p, [0.98, 1])).toFixed(3));
    write(sealText, "transform", `rotate(${(time * 5).toFixed(2)}deg)`);

    particles.draw({
      time,
      sorted,
      converge,
      cloud: 1 - 0.7 * dimmed,
      gate: gateY,
      bin: binY,
    });
  }

  function paintStatic() {
    // Plain CSS lays the section out as a column; the field shows the finished
    // picture, once: sorted, and not yet converged.
    measure();
    actFour.inert = false;
    particles.draw({ time: 2.4, sorted: 1, converge: 0, cloud: 1, gate: gateY, bin: binY });
  }

  measure();

  return {
    measure,
    render,
    paintStatic,
    destroy() {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      particles.destroy();

      const touched: Element[] = [
        root,
        capsWrap,
        field,
        gate,
        gateLabel,
        seal,
        sealRing,
        sealText,
        sealCheck,
        sealNode,
        word,
        eyebrow,
        actOne,
        actTwo,
        pledges,
        ...letters,
        ...lanes,
        ...pledgeItems,
        ...actFourLines,
        ...caps,
      ];
      touched.forEach((element) => element.removeAttribute("style"));
      gate.removeAttribute("data-hot");
      actFour.inert = false;
      closingInert = false;
      opened = false;
    },
  };
}
