/**
 * Section 08, the way to begin. Like the sections before it, one function of scroll
 * progress. It receives two progresses:
 *
 *  - `doors` (0..1): the paper of the stories gives way in rings from the node at the
 *    middle of its own (that is proof-engine.ts's work) — the same trunk section 07
 *    reads client logos on, ring by ring. This section is the wood just inside that
 *    edge: a few closed rings already grown, and the newest one still being drawn —
 *    open, not closed, because it is not finished. It breaks past the others, past
 *    the words, and reaches down to the button: decoration with somewhere to go.
 *  - `story` (0..1): the rest: the sentence, the four answers, and the ways to reach
 *    us. The answers are not on the ring — the ring is one year, one client, not a
 *    category of enquiry, and asking a visitor to click a point on someone else's
 *    growth ring never meant anything. They sit in the same reading order the words
 *    do, a plain choice among plain choices.
 */

import { RINGS } from "../proof/clients";

type Range = readonly [number, number];

/** When each line of the title rises, inside `doors`: the last band has left its place by then. */
const LINE_AT: readonly Range[] = [
  [0.74, 0.92],
  [0.8, 0.96],
  [0.86, 1],
];

const HIDDEN = 112;
/** Sampling density along the new ring's open arc, and the path that leaves it. */
const ARC_POINTS = 40;
const TAIL_POINTS = 16;
/** The new ring runs from here, up and over the top, to here — the gap left at the
 * bottom (centred straight down) is where it breaks open into the path to the button. */
const ARC_START_DEG = 206;
const ARC_END_DEG = -26;
/** The grown rings already inside it: closed loops, smaller, fainter with age. Three
 * of them, spaced as proof-engine.ts's own `RING_AT` spaces the rings the client logos
 * ride on — the same trunk, read a moment later, with the brands gone from it. */
const ECHO_SCALE = [0.42 * 0.82, 0.72 * 0.82, 0.82] as const;
const ECHO_POINTS = 48;

const TAU = Math.PI * 2;
const toRad = (deg: number) => (deg / 180) * Math.PI;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const seg = (p: number, [from, to]: Range) => clamp01((p - from) / (to - from));
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export type CtaEngine = {
  measure: () => void;
  render: (doors: number, story: number, now: number) => void;
  paintStatic: () => void;
  destroy: () => void;
};

const nothing: CtaEngine = { measure() {}, render() {}, paintStatic() {}, destroy() {} };

export function createCtaEngine(
  stage: HTMLElement,
  { onOpen }: { onOpen: (open: boolean) => void },
): CtaEngine {
  const root = stage.querySelector<HTMLElement>('[data-ct="root"]');
  if (!root) return nothing;

  const one = <E extends Element>(selector: string) => root.querySelector(selector) as E;
  const all = <E extends Element>(selector: string) =>
    Array.from(root.querySelectorAll(selector)) as E[];

  const sceneGroup = one<SVGGElement>('[data-ct="scene"]');
  const seedGroup = one<SVGGElement>('[data-ct="seed"]');
  const echoGroup = one<SVGGElement>('[data-ct="rings"]');
  const traces = all<SVGCircleElement>('[data-ct="trace"]').map((el) => ({
    el,
    ring: Number(el.dataset.ring),
    slot: Number(el.dataset.slot),
  }));
  const echoes = all<SVGPathElement>('[data-ct="ring-echo"]');
  const path = one<SVGPathElement>('[data-ct="path"]');
  const halo = one<SVGCircleElement>('[data-ct="halo"]');
  const mark = one<SVGImageElement>('[data-ct="mark"]');
  const eyebrow = one<HTMLElement>('[data-ct="eyebrow"]');
  const lines = all<HTMLElement>('[data-ct="line"]');
  const fades = all<HTMLElement>('[data-ct="fade"]');
  const dial = one<HTMLElement>('[data-ct="dial"]');
  const pills = all<HTMLElement>('[data-ct="pill"]');
  const reach = one<HTMLElement>('[data-ct="reach"]');
  const go = one<HTMLElement>('[data-ct="go"]');

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
  /** The seed every ring is centred on. */
  let cx = 0;
  let cy = 0;
  /** The new ring's own radii; the grown ones inside it scale off these. */
  let rx = 160;
  let ry = 120;
  let reachPx = 1;
  /** On a phone — or a tablet held upright — the ring has no room beside the words
   * and settles under them instead; the answers are always in the column's own
   * reading order regardless, CSS alone lays them out. */
  let stacked = false;
  /** The node section 07's rings closed onto, and the paper then opened from, in this
   * section's own frame. Everything here is born there and grows out of it, so the two
   * chapters read as one scene rather than a cut. */
  let originX = 0;
  let originY = 0;
  /** How much larger the node was over there, so it can settle back rather than pop. */
  let originMark = 1;
  /** How many brands rode each ring, and the rotation section 07 leaves that ring at. */
  let traceCount: readonly number[] = [];
  let traceTurn: readonly number[] = [];
  let opened = false;
  let dialInert = false;
  let reachInert = false;

  /**
   * A point on the ring at `t` (0 at the break near the path, 1 at the other side of
   * it, running up and over the top). A little hand-drawn irregularity, the same idea
   * yuri-engine.ts's terrain and the old horizon used, keeps it from reading as a
   * perfect CAD ellipse — real growth rings are never quite round either.
   */
  const ringPoint = (t: number, rxs: number, rys: number): readonly [number, number] => {
    const a = toRad(ARC_START_DEG) + (toRad(ARC_END_DEG) - toRad(ARC_START_DEG)) * t;
    const wobble = 1 + Math.sin(a * 3.1 + 1.7) * 0.018 + Math.sin(a * 7 - 0.6) * 0.008;
    return [cx + rxs * wobble * Math.cos(a), cy - rys * wobble * Math.sin(a)];
  };

  function measure() {
    if (root!.classList.contains("cta--static")) return;

    const box = root!.getBoundingClientRect();
    width = box.width || 1;
    height = box.height || 1;
    stacked = getComputedStyle(root!).getPropertyValue("--ct-stack").trim() === "1";

    const reachRect = reach.getBoundingClientRect();
    const contentBottom = reachRect.bottom - box.top;

    if (stacked) {
      // Everything that is read or clicked is in one column here, laid out by CSS. The
      // ring is decoration, and what is left for it is whatever the column does not
      // use — measured off the last thing in it, never guessed at a fraction of the
      // height, which is how it ended up sitting on the words before.
      const bandTop = contentBottom + 26;
      const bandBottom = height - 26;
      cx = width * 0.5;
      cy = Math.max(bandTop, (bandTop + bandBottom) / 2);
      ry = Math.max(18, Math.min(92, (bandBottom - bandTop) / 2));
      rx = Math.min(width * 0.36, 230);
    } else {
      // The column of words owns the left of the screen and the ring owns the rest, so
      // the only thing to work out is where that "rest" begins. Measured, not guessed:
      // the real right edge of the text (never the width of the flex box it sits in,
      // which runs well past its shortest lines). The title's own lines are block-level
      // so a mask can clip them, which makes their rect the whole column — a range
      // around the text node gets the real edge instead.
      const textRight =
        Math.max(
          0,
          ...fades.map((element) => element.getBoundingClientRect().right),
          reachRect.right,
          ...lines.map((element) => {
            const range = document.createRange();
            range.selectNodeContents(element);
            return range.getBoundingClientRect().right;
          }),
        ) - box.left;
      const headerClear = 118;
      const footClear = 54;

      // Nothing sits under the ring any more, so it gets the whole height of its own
      // half of the screen rather than whatever was left over above a button.
      cy = height * 0.52;
      ry = Math.max(70, Math.min(height * 0.3, cy - headerClear, height - footClear - cy));

      // The ring is pure atmosphere now — nothing is read or clicked on it — so it
      // only has to fit the band between the column of words and the screen's edge,
      // not reserve room for an answer's label hanging off its side.
      const bandLeft = textRight + 40;
      const bandRight = width - 20;
      const band = Math.max(160, bandRight - bandLeft);
      rx = Math.min(width * 0.26, 340, ry / 0.66, band / 2);
      cx = (bandLeft + bandRight) / 2;
      // Wider than tall where there is width for it; where there is not, at most as
      // tall as it is wide, so it never goes back to being an upright oval.
      ry = Math.min(ry, rx);
    }

    // The grown rings: closed loops, centred on the same seed, smaller and fainter the
    // further back they sit — the years already inside the trunk.
    echoes.forEach((echo, k) => {
      const scale = ECHO_SCALE[k] ?? 0.5;
      const points: string[] = [];
      for (let i = 0; i <= ECHO_POINTS; i++) {
        const a = (i / ECHO_POINTS) * TAU;
        // Whole harmonics only: a loop has to come back to where it started, and a
        // wobble at 2.4 turns leaves a visible kink where the two ends meet.
        const wobble = 1 + Math.sin(a * 3 + k) * 0.02 + Math.sin(a * 5 - k) * 0.01;
        const x = cx + rx * scale * wobble * Math.cos(a);
        const y = cy + ry * scale * wobble * Math.sin(a);
        points.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
      }
      echo.setAttribute("d", `M${points.join(" L")}Z`);
    });

    // The new ring, still open, and — on a wide enough window — the path it breaks
    // into: it comes off the ring's free end and runs down to the button's own edge,
    // so the two read as one line and the line arrives somewhere. Stacked, the answers
    // are in the column's reading order already and the ring has nothing to reach for.
    const arcStart = ringPoint(0, rx, ry);
    const points: string[] = [];
    if (!stacked) {
      const goRect = go.getBoundingClientRect();
      const buttonPoint: readonly [number, number] = [
        goRect.right - box.left + 10,
        goRect.top - box.top + goRect.height / 2,
      ];
      const control: readonly [number, number] = [
        (buttonPoint[0] + arcStart[0]) / 2 + (arcStart[0] - buttonPoint[0]) * 0.2,
        Math.min(buttonPoint[1], arcStart[1]) - 46,
      ];
      for (let i = 0; i <= TAIL_POINTS; i++) {
        const t = i / TAIL_POINTS;
        const mt = 1 - t;
        const x = mt * mt * buttonPoint[0] + 2 * mt * t * control[0] + t * t * arcStart[0];
        const y = mt * mt * buttonPoint[1] + 2 * mt * t * control[1] + t * t * arcStart[1];
        points.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
      }
    } else {
      points.push(`${arcStart[0].toFixed(1)} ${arcStart[1].toFixed(1)}`);
    }
    for (let i = 1; i <= ARC_POINTS; i++) {
      const [x, y] = ringPoint(i / ARC_POINTS, rx, ry);
      points.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    path.setAttribute("d", `M${points.join(" L")}`);

    const markSize = stacked ? 32 : 46;

    // Where section 07's own rings are centred, in this section's frame. It publishes
    // that point as `--pf-cx`/`--pf-cy` on its root, which is the one number both
    // chapters have to agree on for the handover to read as one continuous scene; the
    // two sections are separate layers, so it is converted through their rects rather
    // than assumed to share an origin. Failing that, the ring simply grows in place.
    originX = cx;
    originY = cy;
    originMark = 1;
    const proof = stage.querySelector<HTMLElement>('[data-pf="root"]');
    if (proof) {
      const proofBox = proof.getBoundingClientRect();
      const style = getComputedStyle(proof);
      const pfx = parseFloat(style.getPropertyValue("--pf-cx"));
      const pfy = parseFloat(style.getPropertyValue("--pf-cy"));
      if (Number.isFinite(pfx) && Number.isFinite(pfy)) {
        originX = proofBox.left + pfx - box.left;
        originY = proofBox.top + pfy - box.top;
      }
      // Its node is pulled half again as wide as it is drawing the brands in, and the
      // one here has to arrive at that size to be read as the same node.
      const hub = proof.querySelector<HTMLElement>('[data-pf="hub"]');
      if (hub?.offsetWidth) originMark = (hub.offsetWidth * 1.5) / markSize;
    }

    // Each ring comes to rest turned by a fixed amount over there — the outer one by
    // however far three testimonials have turned it — and the marks left here stand
    // where the brands stood, so they have to agree on it.
    traceCount = RINGS.map((ring) => ring.length);
    traceTurn = [200, -45, (stacked ? 270 : 180) - 240];

    root!.style.setProperty("--ct-cx", `${cx.toFixed(1)}px`);
    root!.style.setProperty("--ct-cy", `${cy.toFixed(1)}px`);

    reachPx = Math.max(
      Math.hypot(cx, cy),
      Math.hypot(width - cx, cy),
      Math.hypot(cx, height - cy),
      Math.hypot(width - cx, height - cy),
    );
    root!.style.setProperty("--ct-reach", `${reachPx.toFixed(0)}`);

    mark.setAttribute("x", (cx - markSize / 2).toFixed(1));
    mark.setAttribute("y", (cy - markSize / 2).toFixed(1));
    mark.setAttribute("width", markSize.toFixed(0));
    mark.setAttribute("height", markSize.toFixed(0));
    halo.setAttribute("cx", cx.toFixed(1));
    halo.setAttribute("cy", cy.toFixed(1));
  }

  function render(doors: number, story: number, now: number) {
    const time = now / 1000;

    const visible = doors > 0;
    write(root!, "visibility", visible ? "visible" : "hidden");

    const isOpen = doors >= 0.85;
    if (isOpen !== opened) {
      opened = isOpen;
      onOpen(opened);
    }

    if (!visible) return;

    // 1. Section 07's paper opens in rings from its node, and out of that same node
    //    this scene grows: the whole thing starts collapsed on it and widens into its
    //    own place over exactly the window the opening takes (proof-engine.ts's burst
    //    runs from 0.32 to the end). The strokes do not scale with it, so it reads as
    //    a ring widening rather than a picture being zoomed into.
    const settle = smooth(seg(doors, [0.32, 0.78]));
    const grow = 0.05 + 0.95 * settle;
    const holdX = originX + (cx - originX) * settle;
    const holdY = originY + (cy - originY) * settle;
    write(
      sceneGroup,
      "transform",
      `translate(${(holdX - grow * cx).toFixed(2)}px, ${(holdY - grow * cy).toFixed(2)}px) scale(${grow.toFixed(4)})`,
    );

    // 2. The node does not grow with the rest: it is the one the brands closed onto and
    //    it was never gone, so it only travels to its place and settles back from the
    //    size section 07 had pulled it to.
    const seedGrow = originMark + (1 - originMark) * settle;
    write(
      seedGroup,
      "transform",
      `translate(${(holdX - seedGrow * cx).toFixed(2)}px, ${(holdY - seedGrow * cy).toFixed(2)}px) scale(${seedGrow.toFixed(4)})`,
    );

    // 3. The three grown rings arrive with that widening, faintest first; only once
    //    they are where they belong does the new one start writing itself over them.
    const appear = smooth(seg(doors, [0.28, 0.38]));
    echoes.forEach((echo, k) => {
      const delay = k * 0.05;
      const shown = smooth(seg(doors, [0.32 + delay, 0.6 + delay]));
      write(echo, "opacity", (shown * (0.16 + k * 0.1)).toFixed(3));
    });

    // 4. And riding out with them, one mark per brand, continuing the turn each was
    //    drawn in on (proof-engine.ts swirls them 2.6 radians on the way down) and
    //    unwinding it to the slot it stood in. Then they let go: the rings are the
    //    same rings, and the stories that were on them are told.
    const held = 1 - settle;
    const traceIn = smooth(seg(doors, [0.34, 0.5]));
    const traceOut = 1 - smooth(seg(doors, [0.66, 0.88]));
    traces.forEach(({ el, ring, slot }) => {
      const count = traceCount[ring] || 1;
      const rest = toRad((slot * 360) / count + (traceTurn[ring] ?? 0));
      const a = rest + held * 2.6;
      const scale = ECHO_SCALE[ring] ?? 0.5;
      const wob = 1 + Math.sin(a * 3 + ring) * 0.02 + Math.sin(a * 5 - ring) * 0.01;
      write(el, "cx", (cx + rx * scale * wob * Math.cos(a)).toFixed(1), true);
      write(el, "cy", (cy + ry * scale * wob * Math.sin(a)).toFixed(1), true);
      write(el, "opacity", (traceIn * traceOut).toFixed(3));
    });

    const draw = smooth(seg(doors, [0.52, 0.94]));
    write(path, "stroke-dashoffset", (1 - draw).toFixed(3));
    write(path, "opacity", draw > 0.001 ? "1" : "0");
    // A ground that breathes: a slow sideways sway on the grown rings only, cheap
    // because it only moves what measure() already drew. The new ring and the answers
    // on it stay put — they are what the visitor actually points at.
    write(echoGroup, "transform", `translate3d(${(Math.sin(time * 0.11) * 4).toFixed(2)}px,0,0)`);

    const breath = 0.5 + 0.5 * Math.sin(time * 2.2);
    write(halo, "r", (22 + 9 * breath).toFixed(2), true);
    write(halo, "opacity", (appear * (0.32 - 0.14 * breath)).toFixed(3));
    write(mark, "opacity", appear.toFixed(3));
    write(mark, "transform", `scale(${(1 + 0.05 * breath).toFixed(3)})`);

    // 5. The title rises as the last band of the paper passes it.
    lines.forEach((line, k) => {
      const shown = easeOut(seg(doors, LINE_AT[k]));
      write(line, "transform", `translateY(${((1 - shown) * HIDDEN).toFixed(2)}%)`);
    });
    write(eyebrow, "opacity", easeOut(seg(doors, [0.7, 0.92])).toFixed(3));

    // 6. The sentence and the creed, then the answers in the same reading order, then
    //    the ways to reach us. The ring keeps growing behind all of it, but nothing
    //    here is placed on it any more — a plain choice among plain choices, not a
    //    point on someone else's ring.
    fades.forEach((element, k) => {
      const shown = easeOut(seg(story, [0.02 + k * 0.08, 0.22 + k * 0.08]));
      write(element, "opacity", shown.toFixed(3));
      write(element, "transform", `translateY(${((1 - shown) * 18).toFixed(2)}px)`);
    });

    const dialIn = smooth(seg(story, [0.06, 0.34]));

    pills.forEach((pill, k) => {
      const shown = easeOut(seg(story, [0.1 + k * 0.05, 0.3 + k * 0.05]));
      write(pill, "opacity", shown.toFixed(3));
      write(pill, "transform", `translateY(${((1 - shown) * 14).toFixed(2)}px)`);
    });

    write(reach, "opacity", easeOut(seg(story, [0.3, 0.55])).toFixed(3));
    write(reach, "transform", `translateY(${((1 - easeOut(seg(story, [0.3, 0.55]))) * 18).toFixed(2)}px)`);

    // The controls can only be reached once they are on screen.
    const dialUnreachable = dialIn < 0.5;
    if (dialUnreachable !== dialInert) {
      dialInert = dialUnreachable;
      dial.inert = dialUnreachable;
    }
    const reachUnreachable = seg(story, [0.3, 0.55]) < 0.5;
    if (reachUnreachable !== reachInert) {
      reachInert = reachUnreachable;
      reach.inert = reachUnreachable;
    }
  }

  function paintStatic() {
    dial.inert = false;
    reach.inert = false;
  }

  measure();

  return {
    measure,
    render,
    paintStatic,
    destroy() {
      const touched: Element[] = [
        root,
        halo,
        mark,
        path,
        eyebrow,
        reach,
        sceneGroup,
        seedGroup,
        echoGroup,
        ...echoes,
        ...traces.map(({ el }) => el),
        ...lines,
        ...fades,
        ...pills,
      ];
      touched.forEach((element) => element.removeAttribute("style"));
      echoes.forEach((echo) => echo.removeAttribute("d"));
      path.removeAttribute("d");
      ["cx", "cy"].forEach((name) => halo.removeAttribute(name));
      ["x", "y", "width", "height"].forEach((name) => mark.removeAttribute(name));
      traces.forEach(({ el }) => ["cx", "cy"].forEach((name) => el.removeAttribute(name)));
      dial.inert = false;
      reach.inert = false;
      dialInert = false;
      reachInert = false;
      opened = false;
    },
  };
}
