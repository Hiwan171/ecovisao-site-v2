/**
 * Section 04, "Soluções": the paper the lens opened onto carries a horizontal
 * track. Its first panel is the chapter's own title; scrolling slides that away
 * and the four service groups run past, each pausing in the middle of the screen
 * long enough to be read. Like the sections before it, everything here is a
 * function of scroll progress (`open` for the lens spreading, `solutions` for the
 * track), so any frame can be reproduced exactly and scrolling back plays it
 * backwards.
 *
 * What it does with that one number:
 *  - the track is translated by the travelled distance, eased so that it slows to a
 *    near stop as each card reaches the middle (see `place`);
 *  - each card is judged by where it sits on screen: it rises in from the right,
 *    swells and lights up as it crosses the middle, and dims after;
 *  - the rail at the bottom reads the same position off the cards.
 */

type Range = readonly [number, number];

/** Pixels the track moves per pixel scrolled, before the pauses are applied. */
const SPEED = 1;
const MIN_SCREENS = 2.8;
const MAX_SCREENS = 8;

/** When the chapter's words arrive, inside the lens's opening (the `open` beat). */
const INTRO: Range = [0.5, 0.75];
const RAIL_IN: Range = [0.62, 0.86];

/** The card whose centre is nearest this fraction of the width is the lit one. */
const FOCUS_AT = 0.5;
/** How much of each card-to-card leg is spent easing: 0 is a steady glide, 1 a hard stop. */
const DWELL = 0.78;

const HIDDEN = 112;
const CARD_RADIUS = 22;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const seg = (p: number, [from, to]: Range) => clamp01((p - from) / (to - from));
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type SolutionsEngine = {
  /** Reads sizes and positions. Cheap; call it on refresh. */
  measure: () => void;
  /** Viewport heights of scroll that carry the track across at a steady pace. */
  screens: () => number;
  render: (open: number, progress: number) => void;
  paintStatic: () => void;
  destroy: () => void;
};

const nothing: SolutionsEngine = {
  measure() {},
  screens: () => 3,
  render() {},
  paintStatic() {},
  destroy() {},
};

export function createSolutionsEngine(stage: HTMLElement): SolutionsEngine {
  const root = stage.querySelector<HTMLElement>('[data-sl="root"]');
  if (!root) return nothing;

  const one = <E extends Element>(selector: string) => root.querySelector(selector) as E;
  const all = <E extends Element>(selector: string, from: ParentNode = root) =>
    Array.from(from.querySelectorAll(selector)) as E[];

  const track = one<HTMLElement>('[data-sl="track"]');
  const intro = one<HTMLElement>('[data-sl="intro"]');
  const introTitle = one<HTMLElement>('[data-sl="intro-title"] > span');
  const introLines = all<HTMLElement>('[data-sl="intro-line"]', intro);
  const hint = one<HTMLElement>('[data-sl="hint"]');

  const cards = all<HTMLElement>('[data-sl="card"]').map((el) => ({ el, centre: 0, width: 1 }));

  const foot = one<HTMLElement>('[data-sl="foot"]');
  const fill = one<HTMLElement>('[data-sl="fill"]');
  const node = one<HTMLElement>('[data-sl="node"]');
  const ticks = all<HTMLElement>('[data-sl="tick"]');
  const labels = all<HTMLElement>('[data-sl="label"]');

  const end = one<HTMLElement>('[data-sl="end"]');
  const endLines = all<HTMLElement>('[data-sl="end-line"]', end);

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
  let travel = 0;
  let railWidth = 1;
  let endLeft = 0;
  let endInert = false;
  /** Distances at which each card is centred, from 0 to the end of the track. */
  let stops: number[] = [0, 0];

  /** Distance from `element`'s left edge to `ancestor`'s, unaffected by transforms. */
  const leftIn = (element: HTMLElement, ancestor: HTMLElement) => {
    let x = 0;
    let current: HTMLElement | null = element;
    while (current && current !== ancestor) {
      x += current.offsetLeft;
      current = current.offsetParent as HTMLElement | null;
    }
    return x;
  };

  function measure() {
    width = root!.clientWidth || 1;
    cards.forEach((card) => {
      card.width = card.el.offsetWidth || 1;
      card.centre = leftIn(card.el, track) + card.width / 2;
    });
    endLeft = leftIn(end, track);
    railWidth = foot.querySelector<HTMLElement>(".sl-foot__line")?.clientWidth || 1;

    // The track ends when the closing panel's right edge meets the screen's.
    travel = Math.max(0, endLeft + end.offsetWidth - width);

    // How far the track must have moved for each card to sit in the middle.
    const centred = cards.map((card) => Math.min(travel, Math.max(0, card.centre - width * FOCUS_AT)));
    stops = [0];
    [...centred, travel].forEach((distance) => {
      if (distance > stops[stops.length - 1] + 1) stops.push(distance);
    });
    if (stops.length < 2) stops = [0, Math.max(1, travel)];
  }

  function screens() {
    measure();
    const height = Math.max(320, window.innerHeight);
    return Math.min(MAX_SCREENS, Math.max(MIN_SCREENS, travel / SPEED / height));
  }

  /**
   * Turns steady scrolling into a track that lingers: between one card being centred
   * and the next, the leg is eased at both ends, so each card settles for a while
   * (long enough to read its text) and then hands over. Monotonic and continuous, so
   * scrolling back retraces it exactly.
   */
  function place(distance: number) {
    let k = 0;
    while (k < stops.length - 2 && distance > stops[k + 1]) k++;

    const from = stops[k];
    const to = stops[k + 1];
    const s = clamp01((distance - from) / (to - from || 1));

    // The first leg only slows on arrival: easing its start too made the first few
    // wheel notches after the title barely move the track, which feels stuck.
    const eased = k === 0 ? easeOut(s) : easeInOut(s);
    return from + lerp(s, eased, DWELL) * (to - from);
  }

  function render(open: number, progress: number) {
    const x = -place(travel * progress);
    const focusX = width * FOCUS_AT;

    write(track, "transform", `translate3d(${x.toFixed(1)}px,0,0)`);

    // 1. The chapter's words, set on the paper the lens has just opened.
    const named = easeOut(seg(open, INTRO));
    write(introTitle, "transform", `translateY(${((1 - named) * HIDDEN).toFixed(2)}%)`);

    // Then they leave with the track, but slower than it, so the first card arrives
    // over them rather than past them.
    const away = -x / width;
    const introGone = smooth(seg(away, [0.16, 0.56]));
    write(intro, "opacity", (1 - introGone).toFixed(3));
    write(intro, "transform", `translate3d(${(-x * 0.42).toFixed(1)}px,0,0)`);

    introLines.forEach((line, k) => {
      const shown = easeOut(seg(open, [INTRO[0] + 0.05 + k * 0.05, INTRO[1] + 0.05 + k * 0.05]));
      write(line, "opacity", shown.toFixed(3));
      write(line, "transform", `translateY(${((1 - shown) * 16).toFixed(2)}px)`);
    });
    write(hint, "opacity", (easeOut(seg(open, [0.72, 0.95])) * (1 - seg(away, [0.02, 0.1]))).toFixed(3));

    // 2. Each card is judged by where it is.
    let nearest = -1;
    let nearestDistance = Infinity;

    cards.forEach((card, i) => {
      const centre = card.centre + x;
      const left = centre - card.width / 2;
      const distance = Math.abs(centre - focusX);

      const enter = easeOut(clamp01((width * 0.9 - left) / (width * 0.3)));
      const focus = smooth(1 - clamp01(distance / (card.width * 1.15)));
      const alpha = enter * lerp(0.7, 1, focus) * named;
      const scale = lerp(0.95, 1, focus);

      write(card.el, "opacity", alpha.toFixed(3));
      write(card.el, "transform", `translate3d(0,${((1 - enter) * 40).toFixed(1)}px,0) scale(${scale.toFixed(3)})`);
      write(
        card.el,
        "clip-path",
        enter >= 0.999 ? "none" : `inset(${((1 - enter) * 100).toFixed(1)}% 0 0 0 round ${CARD_RADIUS}px)`,
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = i;
      }
    });

    const lit = nearest >= 0 && nearestDistance < cards[nearest].width * 0.72 ? nearest : -1;
    cards.forEach((card, i) => write(card.el, "data-focus", String(i === lit), true));

    // 3. The rail reads the same position: a fractional card index, so the fill and
    //    the node glide between cards instead of jumping from one to the next.
    const count = cards.length;
    const at = (i: number) => cards[i].centre + x;
    let index: number;
    if (count === 1) {
      index = (focusX - at(0)) / cards[0].width;
    } else if (focusX <= at(0)) {
      index = (focusX - at(0)) / (at(1) - at(0));
    } else if (focusX >= at(count - 1)) {
      index = count - 1 + (focusX - at(count - 1)) / (at(count - 1) - at(count - 2));
    } else {
      let i = 0;
      while (focusX >= at(i + 1)) i++;
      index = i + (focusX - at(i)) / (at(i + 1) - at(i));
    }
    const position = clamp01((index + 0.5) / count);

    write(foot, "opacity", smooth(seg(open, RAIL_IN)).toFixed(3));
    write(fill, "transform", `scaleX(${position.toFixed(4)})`);
    write(node, "transform", `translate3d(${(position * railWidth).toFixed(1)}px,0,0)`);
    ticks.forEach((tick, i) => {
      write(tick, "data-on", String(i + 0.5 <= position * count + 0.001), true);
      write(tick, "data-focus", String(i === lit), true);
    });
    const front = index < -0.4 ? -1 : Math.min(count - 1, Math.max(0, Math.round(index)));
    labels.forEach((label, i) => write(label, "data-active", String(i === front), true));

    // 4. The closing panel arrives by position. Its link can only be reached once it
    //    is on screen, so a keyboard user is never sent off-frame.
    const arrivedEnd = clamp01((width * 0.96 - (endLeft + x)) / (width * 0.5));
    endLines.forEach((line, k) => {
      const shown = easeOut(seg(arrivedEnd, [0.1 + k * 0.22, 0.7 + k * 0.22]));
      write(line, "opacity", shown.toFixed(3));
      write(line, "transform", `translate3d(0,${((1 - shown) * 26).toFixed(1)}px,0)`);
    });

    const unreachable = arrivedEnd < 0.55;
    if (unreachable !== endInert) {
      endInert = unreachable;
      end.inert = unreachable;
    }
  }

  function paintStatic() {
    // The static layout is plain CSS: a column with the cards in a grid.
    end.inert = false;
  }

  measure();

  return {
    measure,
    screens,
    render,
    paintStatic,
    destroy() {
      const touched: Element[] = [
        track,
        intro,
        introTitle,
        hint,
        foot,
        fill,
        node,
        end,
        ...introLines,
        ...endLines,
        ...cards.map((card) => card.el),
      ];
      // Not the ticks: they only get data attributes, and their `style` is where React
      // put their position.
      touched.forEach((element) => element.removeAttribute("style"));

      cards.forEach((card) => card.el.setAttribute("data-focus", "false"));
      ticks.forEach((tick) => {
        tick.setAttribute("data-on", "false");
        tick.setAttribute("data-focus", "false");
      });
      labels.forEach((label) => label.setAttribute("data-active", "false"));
      end.inert = false;
      endInert = false;
    },
  };
}
