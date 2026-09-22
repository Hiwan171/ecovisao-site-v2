/**
 * Section 06, "Quem sou eu?". Like the sections before it, one function of scroll
 * progress, so any frame can be reproduced exactly and scrolling back plays it
 * backwards. It receives two progresses:
 *
 *  - `rise` (0..1): the forest comes up over the green of section 05 as terrain, a
 *    wavy edge climbing the screen with contour lines running ahead of it (the
 *    waves of the brand's documents). The first stretch is a hold, so the closing
 *    panel of the section before can still be read and used.
 *  - `story` (0..1): the founder. The portrait blooms out of its disc, the
 *    credentials light one by one along a rail, then they give way to his mission,
 *    which is read out word by word.
 *
 * Every word on screen is from page 3 of the institutional document.
 */

type Range = readonly [number, number];

/** Where the terrain waits before it starts to climb, inside `rise`. */
const HOLD = 0.3;
/** How far above the edge the outermost contour line runs, in px. */
const LEAD = 120;
/** Offsets of the contour lines above the edge; the first is the edge itself. */
const LINES = [0, 16, 40, 74, 118] as const;

/** Progress of each beat inside `story`. */
const T = {
  bloom: [0, 0.16],
  portrait: [0.03, 0.28],
  eyebrow: [0.05, 0.14],
  name: [0.1, 0.26],
  role: [0.22, 0.32],
  rail: [0.26, 0.52],
  count: [0.28, 0.44],
  actOneOut: [0.58, 0.68],
  actTwoIn: [0.66, 0.74],
  quote: [0.7, 0.95],
} as const satisfies Record<string, Range>;

/** How far the terrain's shape slides sideways over the climb, as a fraction of the width. */
const DRIFT = 0.55;
const CREDENTIAL_STEP = 0.1;
const HIDDEN = 112;
const WAVE_POINTS = 48;
const STRIP_POINTS = 96;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const seg = (p: number, [from, to]: Range) => clamp01((p - from) / (to - from));
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type YuriEngine = {
  measure: () => void;
  render: (rise: number, story: number) => void;
  paintStatic: () => void;
  destroy: () => void;
};

export function createYuriEngine(
  stage: HTMLElement,
  { onOpen }: { onOpen: (open: boolean) => void },
): YuriEngine {
  const root = stage.querySelector<HTMLElement>('[data-y="root"]');
  const linesWrap = stage.querySelector<HTMLElement>('[data-y="lines"]');
  const linesSvg = stage.querySelector<SVGSVGElement>('[data-y="lines-svg"]');
  if (!root || !linesWrap || !linesSvg) {
    return { measure() {}, render() {}, paintStatic() {}, destroy() {} };
  }

  const one = <E extends Element>(selector: string) => root.querySelector(selector) as E;
  const all = <E extends Element>(selector: string) =>
    Array.from(root.querySelectorAll(selector)) as E[];

  const disc = one<HTMLElement>('[data-y="disc"]');
  const ring = one<SVGCircleElement>('[data-y="ring"]');
  const ticks = one<SVGCircleElement>('[data-y="ticks"]');
  const portrait = one<HTMLElement>('[data-y="portrait"]');
  const eyebrow = one<HTMLElement>('[data-y="eyebrow"]');
  const nameLines = all<HTMLElement>('[data-y="name-line"]');
  const role = one<HTMLElement>('[data-y="fade"]');
  const creds = all<HTMLElement>('[data-y="cred"]');
  const credsList = one<HTMLElement>('[data-y="creds"]');
  const count = one<HTMLElement>('[data-y="count"]');
  const actOne = one<HTMLElement>('[data-y="act1"]');
  const actTwo = one<HTMLElement>('[data-y="act2"]');
  const words = all<HTMLElement>('[data-y="word"]');
  const by = one<HTMLElement>('[data-y="by"]');
  const lines = Array.from(linesSvg.querySelectorAll<SVGPathElement>('[data-y="line"]'));

  const written = new WeakMap<Element, Map<string, string>>();
  const write = (element: Element, name: string, value: string) => {
    let seen = written.get(element);
    if (!seen) written.set(element, (seen = new Map()));
    if (seen.get(name) === value) return;

    seen.set(name, value);
    (element as HTMLElement).style.setProperty(name, value);
  };

  let width = 1;
  let height = 1;
  let portraitWidth = 1;
  let portraitHeight = 1;
  let opened = false;
  let shownCount = -1;

  /** How tall the waves are, and how far the terrain's shape slides sideways as it climbs. */
  let tall = 24;

  /**
   * The terrain's surface: two waves of different length, so the edge never looks
   * like a single sine. `lift` raises a contour line above the edge; the higher ones
   * swell a little more, so they fan out from the edge rather than run as copies of
   * it, and never cross (contours do not). It is a function of `u`, the position
   * along a fixed shape: sliding the shape sideways (see `shift`) is what makes the
   * waves seem to roll, and it lets the lines be drawn once and only moved.
   */
  const wave = (u: number, lift = 0) => {
    const swell = tall * (1 + lift * 0.0025);
    const turn = (u / width) * Math.PI * 2;
    return -lift + swell * (Math.sin(turn * 1.15) + 0.42 * Math.sin(turn * 2.9 + 1.3));
  };

  function measure() {
    const box = root!.getBoundingClientRect();
    width = box.width || 1;
    height = box.height || 1;
    portraitWidth = portrait.offsetWidth || 1;
    portraitHeight = portrait.offsetHeight || 1;
    tall = Math.min(64, Math.max(22, height * 0.055));

    // The contour lines are drawn once, on a strip wider than the screen by as much as
    // the shape will slide. Drawing them again every frame is what cost the frames;
    // moving them is a transform, which the compositor does for free.
    const stripWidth = width * (1 + DRIFT);
    linesSvg!.setAttribute("viewBox", `0 0 ${stripWidth} ${height}`);
    linesSvg!.style.width = `${stripWidth}px`;
    linesSvg!.style.height = `${height}px`;
    lines.forEach((path, k) => {
      const points: string[] = [];
      for (let i = 0; i <= STRIP_POINTS; i++) {
        const x = (stripWidth * i) / STRIP_POINTS;
        points.push(`${x.toFixed(1)} ${wave(x, LINES[k] ?? 0).toFixed(1)}`);
      }
      path.setAttribute("d", `M${points.join(" L")}`);
      path.style.opacity = (k === 0 ? 1 : 0.62 - k * 0.11).toFixed(3);
    });
  }

  const polygon = (span: number, drop: number, base: number, shift: number) => {
    const points: string[] = [];
    for (let i = 0; i <= WAVE_POINTS; i++) {
      const x = (span * i) / WAVE_POINTS;
      points.push(`${x.toFixed(1)}px ${(base + wave(x + shift)).toFixed(1)}px`);
    }
    return `polygon(${points.join(",")},${span}px ${drop}px,0px ${drop}px)`;
  };

  function render(rise: number, story: number) {
    // 1. The terrain climbs over the paper.
    const held = seg(rise, [HOLD, 1]);
    const climb = easeInOut(held);
    const reach = tall * 1.5;
    const start = height + reach + 8;
    const finish = -reach - LEAD - 8;
    const base = lerp(start, finish, climb);
    const shift = climb * DRIFT * width;

    const visible = held > 0;
    write(root!, "visibility", visible ? "visible" : "hidden");
    write(
      root!,
      "clip-path",
      held >= 1 ? "none" : visible ? polygon(width, height, base, shift) : "inset(100% 0 0 0)",
    );

    // Contour lines run ahead of the edge over the paper, and leave with it.
    const showLines = visible && held < 1;
    write(linesWrap!, "visibility", showLines ? "visible" : "hidden");
    if (showLines) {
      write(linesSvg!, "transform", `translate3d(${(-shift).toFixed(1)}px,${base.toFixed(1)}px,0)`);
    }

    // The terrain has covered the paper: the header inverts along its edge, so it
    // is the cream one that can be reached from here on.
    const isOpen = held >= 0.75;
    if (isOpen !== opened) {
      opened = isOpen;
      onOpen(opened);
    }

    // 2. The story. It sits in place from the start, waiting under the terrain.
    const y = story;

    const bloom = easeOut(seg(y, T.bloom));
    write(disc, "transform", `scale(${lerp(0.55, 1, bloom).toFixed(4)})`);
    write(disc, "opacity", bloom.toFixed(3));
    write(ring, "stroke-dashoffset", (1 - easeInOut(seg(y, [T.bloom[0], T.bloom[1] + 0.1]))).toFixed(4));
    write(ticks, "opacity", smooth(seg(y, [0.06, 0.2])).toFixed(3));
    write(ticks, "transform", `rotate(${(y * 36).toFixed(2)}deg)`);

    // The portrait comes up through a wavy edge of its own, then settles.
    const rising = easeInOut(seg(y, T.portrait));
    write(
      portrait,
      "clip-path",
      rising >= 1
        ? "none"
        : polygon(
            portraitWidth,
            portraitHeight,
            lerp(portraitHeight + tall * 1.6, -tall * 1.6, rising),
            rising * portraitWidth * 1.4,
          ),
    );
    write(portrait, "transform", `scale(${lerp(1, 1.035, y).toFixed(4)})`);

    write(eyebrow, "opacity", easeOut(seg(y, T.eyebrow)).toFixed(3));

    nameLines.forEach((line, k) => {
      const shown = easeOut(seg(y, [T.name[0] + k * 0.05, T.name[1] + k * 0.05]));
      write(line, "transform", `translateY(${((1 - shown) * HIDDEN).toFixed(2)}%)`);
    });
    const roleShown = easeOut(seg(y, T.role));
    write(role, "opacity", roleShown.toFixed(3));
    write(role, "transform", `translateY(${((1 - roleShown) * 14).toFixed(2)}px)`);

    // The credentials light one after another along the rail.
    write(credsList, "--rail", easeInOut(seg(y, T.rail)).toFixed(4));
    creds.forEach((item, k) => {
      const shown = easeOut(seg(y, [T.rail[0] + k * CREDENTIAL_STEP, T.rail[0] + k * CREDENTIAL_STEP + 0.09]));
      write(item, "opacity", shown.toFixed(3));
      write(item, "transform", `translateY(${((1 - shown) * 18).toFixed(2)}px)`);
      write(item, "--on", shown >= 0.5 ? "1" : "0");
    });
    const years = Math.round(10 * easeOut(seg(y, T.count)));
    if (years !== shownCount) {
      shownCount = years;
      count.textContent = String(years);
    }

    // Act one gives way to his words.
    const first = 1 - smooth(seg(y, T.actOneOut));
    write(actOne, "opacity", first.toFixed(3));
    write(actOne, "transform", `translateY(${((1 - first) * -26).toFixed(2)}px)`);

    const second = smooth(seg(y, T.actTwoIn));
    write(actTwo, "opacity", second.toFixed(3));
    write(actTwo, "transform", `translateY(${((1 - second) * 26).toFixed(2)}px)`);

    // The mission is lit word by word, tied to the scroll: stop and it stops mid-sentence.
    const span = T.quote[1] - T.quote[0];
    words.forEach((word, i) => {
      const at = T.quote[0] + (i / words.length) * span * 0.86;
      write(word, "opacity", lerp(0.2, 1, smooth(seg(y, [at, at + span * 0.14]))).toFixed(3));
    });
    write(by, "opacity", smooth(seg(y, [0.93, 1])).toFixed(3));
  }

  function paintStatic() {
    // Plain CSS: everything on, in a column. The counter shows its final value.
    count.textContent = "10";
  }

  measure();

  return {
    measure,
    render,
    paintStatic,
    destroy() {
      const touched: Element[] = [
        root,
        linesWrap,
        linesSvg,
        disc,
        ring,
        ticks,
        portrait,
        eyebrow,
        ...nameLines,
        role,
        credsList,
        ...creds,
        actOne,
        actTwo,
        ...words,
        by,
        ...lines,
      ];
      touched.forEach((element) => element.removeAttribute("style"));
      count.textContent = "10";
      shownCount = -1;
      opened = false;
    },
  };
}
