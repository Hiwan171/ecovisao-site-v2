/**
 * Section 08, the way to begin. Like the sections before it, one function of scroll
 * progress. It receives two progresses:
 *
 *  - `doors` (0..1): the paper of the stories gives way in rings from the node at the
 *    middle of its own (that is proof-engine.ts's work). Behind it, this section shows
 *    that node and those rings going on over the dark; its title rises as the last of
 *    the bands passes it.
 *  - `story` (0..1): the rest: the sentence, the dial of answers arriving around the
 *    node, and the ways to reach us.
 *
 * The rings are an endless ripple: each is born at the node, grows to the corners of the
 * screen and fades. Scrolling pushes them outwards; time keeps them breathing. The dial
 * is the one place where the visitor's own choice moves anything: the thread runs from
 * the node to the answer chosen, and eases to the next one when the choice changes.
 */

type Range = readonly [number, number];

/** When each line of the title rises, inside `doors`: the last band has left its place by then. */
const LINE_AT: readonly Range[] = [
  [0.74, 0.92],
  [0.8, 0.96],
  [0.86, 1],
];

const HIDDEN = 112;
/** Top, right, bottom, left: the order of the answers, in degrees clockwise from the right. */
const DIAL_ANGLES = [-90, 0, 90, 180] as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const seg = (p: number, [from, to]: Range) => clamp01((p - from) / (to - from));
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const rad = (deg: number) => (deg * Math.PI) / 180;

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

  const rings = all<SVGCircleElement>('[data-ct="ring"]');
  const dialRing = one<SVGCircleElement>('[data-ct="dial-ring"]');
  const dialTicks = one<SVGCircleElement>('[data-ct="dial-ticks"]');
  const thread = one<SVGLineElement>('[data-ct="thread"]');
  const halo = one<SVGCircleElement>('[data-ct="halo"]');
  const node = one<SVGCircleElement>('[data-ct="node"]');
  const eyebrow = one<HTMLElement>('[data-ct="eyebrow"]');
  const lines = all<HTMLElement>('[data-ct="line"]');
  const fades = all<HTMLElement>('[data-ct="fade"]');
  const dial = one<HTMLElement>('[data-ct="dial"]');
  const pills = all<HTMLElement>('[data-ct="pill"]');
  const reach = one<HTMLElement>('[data-ct="reach"]');

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
  let centreX = 0;
  let centreY = 0;
  let reachPx = 1;
  /** On a phone the answers sit in a grid under the words instead of around the node. */
  let stacked = false;
  let dialRadius = 0;
  let pillAt: readonly (readonly [number, number])[] = [];
  /** Where the thread's free end is now, easing towards the answer chosen. */
  let endX = 0;
  let endY = 0;
  let lastTime = 0;
  let opened = false;
  let dialInert = false;
  let reachInert = false;

  function measure() {
    if (root!.classList.contains("cta--static")) return;

    const box = root!.getBoundingClientRect();
    width = box.width || 1;
    height = box.height || 1;
    stacked = getComputedStyle(root!).getPropertyValue("--ct-stack").trim() === "1";

    // The rings are centred where the paper's were: the paper gave way from that point.
    const proof = stage.querySelector<HTMLElement>('[data-pf="root"]');
    const style = proof ? getComputedStyle(proof) : null;
    centreX = parseFloat(style?.getPropertyValue("--pf-cx") ?? "") || width * 0.72;
    centreY = parseFloat(style?.getPropertyValue("--pf-cy") ?? "") || height * 0.575;

    reachPx = Math.max(
      Math.hypot(centreX, centreY),
      Math.hypot(width - centreX, centreY),
      Math.hypot(centreX, height - centreY),
      Math.hypot(width - centreX, height - centreY),
    );

    root!.style.setProperty("--ct-cx", `${centreX.toFixed(1)}px`);
    root!.style.setProperty("--ct-cy", `${centreY.toFixed(1)}px`);
    root!.style.setProperty("--ct-reach", `${reachPx.toFixed(0)}`);
    [...rings, dialRing, dialTicks, halo, node].forEach((circle) => {
      circle.setAttribute("cx", centreX.toFixed(1));
      circle.setAttribute("cy", centreY.toFixed(1));
    });

    // The dial's ring, and the four answers on it (on a phone, only the ring's ticks).
    dialRadius = stacked
      ? Math.min(width * 0.26, height * 0.14)
      : Math.max(90, Math.min(height * 0.3, width - centreX - 136));
    dialRing.setAttribute("r", dialRadius.toFixed(1));
    dialTicks.setAttribute("r", (dialRadius + 11).toFixed(1));

    pillAt = DIAL_ANGLES.map((angle) => [
      centreX + dialRadius * Math.cos(rad(angle)),
      centreY + dialRadius * Math.sin(rad(angle)),
    ]);

    // The thread starts at the node and goes to the answer chosen.
    thread.setAttribute("x1", centreX.toFixed(1));
    thread.setAttribute("y1", centreY.toFixed(1));
    const [tx, ty] = pillAt[Number(root!.dataset.choice ?? 0)] ?? [centreX, centreY];
    endX = tx;
    endY = ty;
  }

  function render(doors: number, story: number, now: number) {
    const time = now / 1000;
    const dt = Math.min(0.05, Math.max(0.001, time - lastTime || 0.016));
    lastTime = time;

    const visible = doors > 0;
    write(root!, "visibility", visible ? "visible" : "hidden");

    const isOpen = doors >= 0.85;
    if (isOpen !== opened) {
      opened = isOpen;
      onOpen(opened);
    }

    if (!visible) return;

    // 1. The rings, and the node they come out of.
    const appear = smooth(seg(doors, [0.3, 0.6]));
    const drift = story * 0.6 + doors * 0.3 + time * 0.02;

    rings.forEach((ring, i) => {
      const t = (i / rings.length + drift) % 1;
      // Slow near the node, quick at the edge: ripples do not grow evenly.
      write(ring, "r", (reachPx * Math.pow(t, 1.35)).toFixed(1), true);
      write(ring, "opacity", (0.5 * Math.pow(1 - t, 1.5) * appear).toFixed(3));
    });

    const breath = 0.5 + 0.5 * Math.sin(time * 2.2);
    write(node, "r", (6 * appear).toFixed(2), true);
    write(halo, "r", (16 + 9 * breath).toFixed(2), true);
    write(halo, "opacity", (appear * (0.32 - 0.14 * breath)).toFixed(3));

    // 2. The title rises as the last band of the paper passes it.
    lines.forEach((line, k) => {
      const shown = easeOut(seg(doors, LINE_AT[k]));
      write(line, "transform", `translateY(${((1 - shown) * HIDDEN).toFixed(2)}%)`);
    });
    write(eyebrow, "opacity", easeOut(seg(doors, [0.7, 0.92])).toFixed(3));

    // 3. The sentence and the creed, then the dial around the node, then the ways to reach us.
    fades.forEach((element, k) => {
      const shown = easeOut(seg(story, [0.02 + k * 0.08, 0.22 + k * 0.08]));
      write(element, "opacity", shown.toFixed(3));
      write(element, "transform", `translateY(${((1 - shown) * 18).toFixed(2)}px)`);
    });

    const dialIn = smooth(seg(story, [0.06, 0.34]));
    write(dialRing, "opacity", (0.34 * dialIn).toFixed(3));
    write(dialTicks, "opacity", (0.7 * dialIn).toFixed(3));

    pills.forEach((pill, k) => {
      const shown = easeOut(seg(story, [0.1 + k * 0.05, 0.3 + k * 0.05]));
      write(pill, "opacity", shown.toFixed(3));
      const lift = (1 - shown) * 14;

      if (stacked) {
        write(pill, "transform", `translateY(${lift.toFixed(2)}px)`);
      } else {
        const [x, y] = pillAt[k] ?? [centreX, centreY];
        write(
          pill,
          "transform",
          `translate3d(${x.toFixed(1)}px,${(y + lift).toFixed(1)}px,0) translate(-50%,-50%) scale(${(0.86 + 0.14 * shown).toFixed(3)})`,
        );
      }
    });

    // The thread eases to whichever answer is chosen: a frame-rate independent glide.
    const choice = Number(root!.dataset.choice ?? 0);
    const [goalX, goalY] = stacked ? [centreX, centreY] : (pillAt[choice] ?? [centreX, centreY]);
    const follow = 1 - Math.exp(-dt * 9);
    endX += (goalX - endX) * follow;
    endY += (goalY - endY) * follow;
    write(thread, "x2", endX.toFixed(1), true);
    write(thread, "y2", endY.toFixed(1), true);
    write(thread, "opacity", (stacked ? 0 : dialIn * 0.9).toFixed(3));

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
        node,
        thread,
        dialRing,
        dialTicks,
        eyebrow,
        reach,
        ...rings,
        ...lines,
        ...fades,
        ...pills,
      ];
      touched.forEach((element) => element.removeAttribute("style"));
      [...rings, dialRing, dialTicks, halo, node].forEach((circle) => {
        circle.removeAttribute("r");
        circle.removeAttribute("cx");
        circle.removeAttribute("cy");
      });
      ["x1", "y1", "x2", "y2"].forEach((name) => thread.removeAttribute(name));
      dial.inert = false;
      reach.inert = false;
      dialInert = false;
      reachInert = false;
      opened = false;
    },
  };
}
