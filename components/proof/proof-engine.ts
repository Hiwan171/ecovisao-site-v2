/**
 * Section 07, "Histórias de sucesso". Like the sections before it, one function of
 * scroll progress, so any frame can be reproduced exactly and scrolling back plays it
 * backwards. It receives two progresses:
 *
 *  - `bloom` (0..1): cream grows out of the founder's last words ("histórias de
 *    sucesso") as a stain with a living edge, and growth rings ripple behind that
 *    edge, inside and out. The first stretch is a hold, so his words can be read.
 *  - `story` (0..1): the stories. Thirteen brands sit on three rings, like the
 *    section of a trunk. The outer ring is a dial: it turns a third of a turn per
 *    voice to bring that voice's brand to the front, in line with the words, and
 *    a thread runs from the brand to them.
 *  - `doors` (0..1): once the stories are told, every brand is drawn into the node
 *    at the rings' centre, and from that node the paper gives way in rings: dark
 *    and paper in bands, going out to the corners, to whatever waits behind it (the
 *    closing section, which carries the same node and rings on the dark).
 *
 * Words are from pages 10 and 11 of the institutional document.
 */

import { RINGS, VOICES } from "./clients";

type Range = readonly [number, number];

/** Where the stain waits before it starts to grow, inside `bloom`. */
const HOLD = 0.16;
const POINTS = 96;

/** Where each voice's stretch of the story begins, and where the last one ends. */
const BOUNDS = [0.22, 0.46, 0.69, 1] as const;
/** The middle of each voice's stretch: where the arrows and dots send the scroll. */
export const VOICE_AT = BOUNDS.slice(0, 3).map((from, k) => (from + BOUNDS[k + 1]) / 2) as readonly number[];

/** Radii of the three rings, as fractions of the outer one, inner to outer. */
const RING_AT = [0.42, 0.72, 1] as const;
const HIDDEN = 112;
/** Where the paper starts to give way, inside `doors`: the brands are drawn in first. */
const BURST_AT = 0.32;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const seg = (p: number, [from, to]: Range) => clamp01((p - from) / (to - from));
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Three waves of different length, so an edge never looks like one sine. Integer turns: it closes. */
const wobble = (theta: number, phase: number) =>
  0.55 * Math.sin(3 * theta + phase) +
  0.3 * Math.sin(5 * theta - 1.3 * phase + 1.7) +
  0.15 * Math.sin(9 * theta + 0.7 * phase + 0.4);

export type ProofEngine = {
  measure: () => void;
  render: (bloom: number, story: number, doors: number, now: number) => void;
  paintStatic: () => void;
  destroy: () => void;
};

const nothing: ProofEngine = { measure() {}, render() {}, paintStatic() {}, destroy() {} };

export function createProofEngine(
  stage: HTMLElement,
  { onOpen }: { onOpen: (open: boolean) => void },
): ProofEngine {
  const root = stage.querySelector<HTMLElement>('[data-pf="root"]');
  const edge = stage.querySelector<SVGSVGElement>('[data-pf="edge"]');
  if (!root || !edge) return nothing;

  const one = <E extends Element>(selector: string) => root.querySelector(selector) as E;
  const all = <E extends Element>(selector: string, from: ParentNode = root) =>
    Array.from(from.querySelectorAll(selector)) as E[];

  const edgePaths = Array.from(edge.querySelectorAll<SVGPathElement>("path"));
  const bursts = Array.from(edge.querySelectorAll<SVGCircleElement>('[data-pf="burst"]'));
  const ringsSvg = one<SVGSVGElement>(".pf-rings");
  const rings = all<SVGGElement>('[data-pf="ring"]');
  const ringLines = all<SVGPathElement>('[data-pf="ring-line"]');
  const dial = one<SVGSVGElement>('[data-pf="dial"]');
  const thread = one<SVGLineElement>('[data-pf="thread"]');
  const hub = one<HTMLElement>('[data-pf="hub"]');
  const chips = all<HTMLElement>('[data-pf="chip"]').map((el) => ({
    el,
    ring: Number(el.dataset.ring),
    slot: Number(el.dataset.slot),
    slug: el.dataset.slug ?? "",
  }));

  const eyebrow = one<HTMLElement>('[data-pf="eyebrow"]');
  const titleWords = all<HTMLElement>('[data-pf="title-word"]');
  const lead = one<HTMLElement>('[data-pf="lead"]');
  const voicesBox = one<HTMLElement>('[data-pf="voices"]');
  const voices = all<HTMLElement>('[data-pf="voice"]');
  const nav = one<HTMLElement>('[data-pf="nav"]');
  const counter = one<HTMLElement>('[data-pf="counter"]');
  const dots = all<HTMLElement>('[data-pf="dot"]');

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
  let originX = 0;
  let originY = 0;
  let reach = 1;
  let centreX = 0;
  let centreY = 0;
  let outer = 1;
  let spot = 180;
  let dialLeft = 0;
  let dialTop = 0;
  let hubLeft = 0;
  let hubTop = 0;
  /** How far the node at the rings' centre is from the farthest corner. */
  let hubReach = 1;
  let opened = false;
  let index = -1;

  /** Where the last of the founder's words sits: the stain starts there. */
  function findOrigin(box: DOMRect) {
    const words = stage.querySelectorAll<HTMLElement>('[data-y="word"]');
    const last = words[words.length - 1];
    if (!last) return [box.width * 0.72, box.height * 0.56] as const;

    const at = last.getBoundingClientRect();
    return [at.left + at.width / 2 - box.left, at.top + at.height / 2 - box.top] as const;
  }

  function measure() {
    // Without the pinned scene the brands are a grid and the voices a column: plain CSS.
    if (root!.classList.contains("proof--static")) return;

    const box = root!.getBoundingClientRect();
    width = box.width || 1;
    height = box.height || 1;

    [originX, originY] = findOrigin(box);
    const farthest = Math.max(
      Math.hypot(originX, originY),
      Math.hypot(width - originX, originY),
      Math.hypot(originX, height - originY),
      Math.hypot(width - originX, height - originY),
    );
    // Room for the wobble at its widest.
    reach = farthest * 1.22 + 12;

    // The rings: a full turn of the trunk on wide screens, its top half on phones.
    // Either way the client record runs along the very bottom edge, under them —
    // room for it has to come off the ring's own radius, or a short window (a
    // laptop, not a monitor) lets the two touch.
    const stacked = getComputedStyle(root!).getPropertyValue("--pf-stack").trim() === "1";
    if (stacked) {
      const footClear = 56;
      centreX = width * 0.5;
      centreY = height * 0.755;
      outer = Math.min(height * 0.19, width / 2 - 26, height - footClear - centreY);
      spot = 270;
    } else {
      const footClear = 84;
      centreX = width * 0.72;
      // Low enough that the top brands clear the header, high enough that the bottom ones
      // clear the edge, on the short windows of a laptop as much as on a tall monitor.
      centreY = height * 0.565;
      // A brand's own radius is about an eighth of the ring's: keep the last one on screen.
      outer = Math.min(height * 0.35, (width - centreX - 10) / 1.125, height - footClear - centreY);
      spot = 180;
    }
    root!.style.setProperty("--pf-cx", `${centreX.toFixed(1)}px`);
    root!.style.setProperty("--pf-cy", `${centreY.toFixed(1)}px`);
    hubReach = Math.max(
      Math.hypot(centreX, centreY),
      Math.hypot(width - centreX, centreY),
      Math.hypot(centreX, height - centreY),
      Math.hypot(width - centreX, height - centreY),
    );

    const chipBase = Math.min(96, Math.max(40, outer * 0.245));
    chips.forEach((chip) => {
      const size = chipBase * (0.8 + 0.1 * chip.ring);
      chip.el.style.width = chip.el.style.height = `${size.toFixed(1)}px`;
    });

    const hubSize = Math.max(34, outer * RING_AT[0] * 0.42);
    hub.style.width = hub.style.height = `${hubSize.toFixed(1)}px`;
    hubLeft = centreX - hubSize / 2;
    hubTop = centreY - hubSize / 2;
    hub.style.transform = `translate3d(${hubLeft.toFixed(1)}px,${hubTop.toFixed(1)}px,0)`;

    // The rings are drawn once, wobbling a little like growth rings, and never redrawn.
    rings.forEach((_, j) => {
      const r = outer * RING_AT[j];
      const points: string[] = [];
      for (let i = 0; i < POINTS; i++) {
        const theta = (i / POINTS) * Math.PI * 2;
        const rr = r * (1 + 0.011 * wobble(theta, j * 2.1));
        points.push(`${(centreX + rr * Math.cos(theta)).toFixed(1)} ${(centreY + rr * Math.sin(theta)).toFixed(1)}`);
      }
      ringLines[j].setAttribute("d", `M${points.join(" L")} Z`);
    });

    // The dial sits just outside the outer ring; its circle is 95 of the 200 units of its box.
    const dialSize = outer * 1.09 * (200 / 190) * 2;
    dial.style.width = dial.style.height = `${dialSize.toFixed(1)}px`;
    dialLeft = centreX - dialSize / 2;
    dialTop = centreY - dialSize / 2;

    // The thread from the front-most brand to the words: they are what it is about.
    const chipRadius = (chipBase * 1.1) / 2;
    const at = rad(spot);
    const frontX = centreX + outer * Math.cos(at);
    const frontY = centreY + outer * Math.sin(at);
    const words = voicesBox.getBoundingClientRect();
    if (stacked) {
      thread.setAttribute("x1", frontX.toFixed(1));
      thread.setAttribute("y1", (frontY - chipRadius - 3).toFixed(1));
      thread.setAttribute("x2", frontX.toFixed(1));
      thread.setAttribute("y2", Math.min(frontY - chipRadius - 14, words.bottom - box.top + 8).toFixed(1));
    } else {
      thread.setAttribute("x1", (frontX - chipRadius - 3).toFixed(1));
      thread.setAttribute("y1", frontY.toFixed(1));
      thread.setAttribute("x2", Math.min(frontX - chipRadius - 14, words.right - box.left + 12).toFixed(1));
      thread.setAttribute("y2", frontY.toFixed(1));
    }
  }

  /** A closed curve as the stain's edge, or one of its rings. */
  function blob(radius: number, amp: number, phase: number) {
    const points: [number, number][] = [];
    for (let i = 0; i < POINTS; i++) {
      const theta = (i / POINTS) * Math.PI * 2;
      const r = radius * (1 + amp * wobble(theta, phase));
      points.push([originX + r * Math.cos(theta), originY + r * Math.sin(theta)]);
    }
    return points;
  }

  const asPath = (points: [number, number][]) =>
    `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")} Z`;
  const asClip = (points: [number, number][]) =>
    `polygon(${points.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(",")})`;

  /**
   * The paper gives way in rings. Five circles grow from the node; with the even-odd
   * rule they cut the paper into bands, dark and paper in turn, and each grows a
   * little behind the one outside it, so the bands are drawn out thin as they go. When
   * every circle is past the corners the paper is gone.
   */
  function burst(doors: number) {
    const t = seg(doors, [BURST_AT, 1]);
    const lag = 0.07;
    const radii = bursts.map((_, i) => {
      const local = clamp01((t - (bursts.length - 1 - i) * lag) / (1 - (bursts.length - 1) * lag));
      return hubReach * 1.06 * easeInOut(local);
    });

    let cut = `M0 0H${width}V${height}H0Z`;
    radii.forEach((r, i) => {
      if (r >= 0.5) {
        cut += `M${(centreX - r).toFixed(1)} ${centreY.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0Z`;
      }

      const ring = bursts[i];
      ring.setAttribute("cx", centreX.toFixed(1));
      ring.setAttribute("cy", centreY.toFixed(1));
      ring.setAttribute("r", r.toFixed(1));
      // The outermost is the orange front; the ones behind it are its wake.
      const fade = 1 - smooth(seg(t, [0.85, 1]));
      write(ring, "opacity", (r >= 0.5 ? (i === bursts.length - 1 ? 1 : 0.7) * fade : 0).toFixed(3));
    });

    return `path(evenodd, "${cut}")`;
  }

  function render(bloom: number, story: number, doors: number, now: number) {
    // 1. The stain grows out of the words.
    const grown = seg(bloom, [HOLD, 1]);
    const visible = grown > 0 && doors < 1;
    write(root!, "visibility", visible ? "visible" : "hidden");
    write(edge!, "visibility", visible && (grown < 1 || doors > 0) ? "visible" : "hidden");

    // `reach` is calibrated to the farthest corner, but the origin sits near the
    // words, off to one side: a radius that is still a modest fraction of `reach`
    // already reaches every closer edge, so the raw (smoothstep) curve read as the
    // screen flooding almost at once. Cubed, the radius stays legibly small for
    // longer and only nears full screen cover as `grown` approaches 1.
    const eased = grown * grown * grown;

    if (grown >= 1) {
      // The stain is over: its rings are not drawn any more, but the doors' edges may be.
      edgePaths.forEach((path) => write(path, "opacity", "0"));
      if (doors > BURST_AT * 0.3) {
        write(root!, "clip-path", doors > BURST_AT ? burst(doors) : "none");
      } else {
        write(root!, "clip-path", "none");
      }
      if (doors <= BURST_AT) bursts.forEach((ring) => write(ring, "opacity", "0"));
    } else if (visible) {
      const radius = reach * eased;
      const amp = 0.17 * (1 - 0.72 * eased);
      const phase = eased * 5 + now * 0.0006;

      const shape = blob(radius, amp, phase);
      write(root!, "clip-path", asClip(shape));

      // The edge, one ring just outside it (over the dark), and three growth rings inside.
      const fade = 1 - smooth(seg(eased, [0.7, 1]));
      const layout: [number, number, number, number][] = [
        [1, 1, 1, 0],
        [1.05, 0.9, 0.55 * fade, 0.6],
        [0.82, 0.85, 0.34 * fade, 1.1],
        [0.64, 0.8, 0.26 * fade, 1.7],
        [0.46, 0.75, 0.2 * fade, 2.3],
      ];
      layout.forEach(([scale, ampScale, opacity, shift], k) => {
        const path = edgePaths[k];
        if (!path) return;
        path.setAttribute("d", asPath(k === 0 ? shape : blob(radius * scale, amp * ampScale, phase + shift)));
        write(path, "opacity", opacity.toFixed(3));
      });
    }

    // The stain has covered the header: from here on it is the ink one that can be reached.
    const isOpen = eased >= 0.8;
    if (isOpen !== opened) {
      opened = isOpen;
      onOpen(opened);
    }

    if (!visible) {
      // A voice's own `visibility: visible` (below) overrides an ancestor's
      // `hidden`, which is exactly the point while this section is on screen.
      // Skipping the rest of this function when it is not must not leave one
      // sitting at whatever it was last told — that is how a jump that lands
      // outside this section's range, rather than scrolling into it, could
      // still show one of its voices.
      voices.forEach((voice) => write(voice, "visibility", "hidden"));
      return;
    }

    // 2. The stories. They sit in place from the start, waiting under the stain.
    const p = story;

    // Once the stories are told they let go: the words fade, and every brand is drawn
    // into the node, turning as it goes, before the paper gives way.
    const out = 1 - smooth(seg(doors, [0, 0.28]));
    const pull = smooth(seg(doors, [0.02, BURST_AT + 0.08]));
    write(root!, "--pf-out", out.toFixed(3));
    write(ringsSvg, "opacity", (1 - pull).toFixed(3));

    write(eyebrow, "opacity", easeOut(seg(p, [0.02, 0.08])).toFixed(3));
    titleWords.forEach((word, i) => {
      const shown = easeOut(seg(p, [i * 0.03, 0.1 + i * 0.03]));
      write(word, "transform", `translateY(${((1 - shown) * HIDDEN).toFixed(2)}%)`);
    });

    const leadIn = easeOut(seg(p, [0.06, 0.16]));
    const leadOut = smooth(seg(p, [0.19, 0.25]));
    write(lead, "opacity", (leadIn * (1 - leadOut)).toFixed(3));
    write(lead, "transform", `translateY(${((1 - leadIn) * 16 - leadOut * 18).toFixed(2)}px)`);

    // The rings draw themselves, inner to outer, and the brands settle onto them.
    const settle = easeOut(seg(p, [0.02, 0.26]));
    rings.forEach((_, j) => {
      const draw = easeInOut(seg(p, [0.02 + j * 0.05, 0.16 + j * 0.05]));
      write(ringLines[j], "stroke-dashoffset", (1 - draw).toFixed(4));
    });
    write(dial, "opacity", (0.7 * smooth(seg(p, [0.1, 0.24])) * (1 - pull)).toFixed(3));

    const hubIn = easeOut(seg(p, [0, 0.1]));
    write(hub, "opacity", (hubIn * (1 - smooth(seg(doors, [BURST_AT, BURST_AT + 0.16])))).toFixed(3));
    // Its scale lives in the same transform as its place: a separate `scale` would be
    // applied after the translation and carry the node away from the centre.
    write(hub, "transform", `translate3d(${hubLeft.toFixed(1)}px,${hubTop.toFixed(1)}px,0) scale(${(1 + 0.5 * pull).toFixed(3)})`);

    // The outer ring turns a third of a turn per voice: slot 0, 2 and 4 come to the front.
    const front = (k: number) => spot - 120 * k;
    const turn =
      front(0) +
      (front(1) - front(0)) * easeInOut(seg(p, [BOUNDS[1] - 0.06, BOUNDS[1] + 0.03])) +
      (front(2) - front(1)) * easeInOut(seg(p, [BOUNDS[2] - 0.06, BOUNDS[2] + 0.03])) +
      150 * (1 - settle);
    const angles = [95 + p * 105 + 140 * (1 - settle), 30 - p * 75 - 100 * (1 - settle), turn];

    write(
      dial,
      "transform",
      `translate3d(${dialLeft.toFixed(1)}px,${dialTop.toFixed(1)}px,0) rotate(${(-angles[2] * 0.5).toFixed(2)}deg)`,
    );

    const current = p < BOUNDS[1] ? 0 : p < BOUNDS[2] ? 1 : 2;
    const inVoices = p >= BOUNDS[0] + 0.02;

    chips.forEach((chip) => {
      const count = RINGS[chip.ring].length;
      const angle = rad((chip.slot * 360) / count + angles[chip.ring]);
      const r = outer * RING_AT[chip.ring];
      const size = parseFloat(chip.el.style.width) || 60;
      // Drawn in: the radius shrinks to nothing while the angle runs on.
      const drawn = Math.pow(1 - pull, 1.25);
      const swirl = angle + pull * 2.6;
      const x = centreX + r * drawn * Math.cos(swirl) - size / 2;
      const y = centreY + r * drawn * Math.sin(swirl) - size / 2;

      // Inner rings first, each brand a beat after the last.
      const at = 0.06 + chip.ring * 0.04 + chip.slot * 0.012;
      const shown = easeOut(seg(p, [at, at + 0.1]));
      const gone = 1 - smooth(seg(doors, [BURST_AT + 0.02, BURST_AT + 0.14]));
      write(chip.el, "opacity", (shown * gone).toFixed(3));
      write(
        chip.el,
        "transform",
        `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${(lerp(0.55, 1, shown) * (1 - 0.7 * pull)).toFixed(3)})`,
      );
      write(chip.el, "data-lit", String(inVoices && chip.slug === VOICES[current].slug), true);
    });

    // The voices take turns; the thread, the counter and the dots follow.
    let visibleVoice = 0;
    voices.forEach((voice, k) => {
      const shown = easeOut(seg(p, [BOUNDS[k] + 0.02, BOUNDS[k] + 0.07]));
      const gone = k < voices.length - 1 ? smooth(seg(p, [BOUNDS[k + 1] - 0.06, BOUNDS[k + 1] - 0.01])) : 0;
      const alpha = shown * (1 - gone);
      visibleVoice = Math.max(visibleVoice, alpha);

      write(voice, "opacity", alpha.toFixed(3));
      write(voice, "transform", `translateY(${((1 - shown) * 22 - gone * 18).toFixed(2)}px)`);
      write(voice, "visibility", alpha > 0.01 ? "visible" : "hidden");
      write(voice, "--pf-line", easeOut(seg(p, [BOUNDS[k] + 0.04, BOUNDS[k] + 0.12])).toFixed(3));
    });

    write(thread, "opacity", (visibleVoice * out).toFixed(3));
    write(thread, "stroke-dashoffset", (1 - easeOut(seg(p, [BOUNDS[0] + 0.02, BOUNDS[0] + 0.1]))).toFixed(4));
    write(nav, "opacity", (smooth(seg(p, [BOUNDS[0], BOUNDS[0] + 0.05])) * out).toFixed(3));
    nav.inert = out < 0.5;

    if (current !== index) {
      index = current;
      counter.textContent = `0${current + 1}`;
      root!.setAttribute("data-index", String(current));
      dots.forEach((dot, k) => dot.setAttribute("data-on", String(k === current)));
    }
  }

  function paintStatic() {
    // Plain CSS: the brands in a grid, the voices in a column.
    counter.textContent = "01";
  }

  measure();

  return {
    measure,
    render,
    paintStatic,
    destroy() {
      const touched: Element[] = [
        root,
        edge,
        dial,
        thread,
        hub,
        eyebrow,
        lead,
        nav,
        ...edgePaths,
        ...bursts,
        ...rings,
        ...ringLines,
        ...titleWords,
        ...voices,
        ...chips.map((chip) => chip.el),
      ];
      touched.forEach((element) => element.removeAttribute("style"));
      chips.forEach((chip) => chip.el.setAttribute("data-lit", "false"));
      dots.forEach((dot, k) => dot.setAttribute("data-on", String(k === 0)));
      thread.removeAttribute("x1");
      root.removeAttribute("data-index");
      counter.textContent = "01";
      opened = false;
      index = -1;
    },
  };
}
