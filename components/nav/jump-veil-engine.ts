import { gsap } from "gsap";

/**
 * The site's own gesture for travelling a long way at once — the same one the
 * loader closes with (loading-screen.tsx's `playExit`): a seed at the point of
 * departure grows into a disc that swallows the screen, growth rings trailing
 * its edge, and once what is underneath has been swapped for the destination,
 * the same disc opens back into a hole and lets it be seen. Used for a jump
 * between sections far enough apart that scrubbing the scroll position between
 * them would otherwise flash every beat in between.
 */

type Point = { x: number; y: number };

const CLOSE_DURATION = 0.56;
const HOLD = 0.16;
const OPEN_DURATION = 0.64;
const RINGS_TRAIL = 0.85;

export type JumpVeil = {
  /** Closes over the screen from `origin`; `onCovered` fires the instant it has,
   *  which is the visitor's cue to actually move the scroll position. */
  play: (origin: Point, onCovered: () => void) => void;
  destroy: () => void;
};

const nothing: JumpVeil = { play: (_origin, onCovered) => onCovered(), destroy() {} };

export function createJumpVeil(root: HTMLElement): JumpVeil {
  const fill = root.querySelector<SVGPathElement>('[data-jv="fill"]');
  const seed = root.querySelector<SVGCircleElement>('[data-jv="seed"]');
  const rings = Array.from(root.querySelectorAll<SVGCircleElement>('[data-jv="ring"]'));
  if (!fill || !seed) return nothing;

  let timeline: gsap.core.Timeline | null = null;

  /** A filled disc, or nothing at all while it has no radius yet. */
  const disc = (ox: number, oy: number, r: number) =>
    r <= 0.5
      ? "M0 0Z"
      : `M${(ox - r).toFixed(1)} ${oy.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0Z`;

  /** The viewport, minus a disc-shaped hole: the same rect the disc grows away from. */
  const hole = (ox: number, oy: number, r: number, w: number, h: number) =>
    `M0 0H${w}V${h}H0Z${disc(ox, oy, r)}`;

  const play = (origin: Point, onCovered: () => void) => {
    timeline?.kill();

    const w = window.innerWidth;
    const h = window.innerHeight;
    // How far the disc must reach to clear the farthest corner from where it was born.
    const reach =
      Math.max(
        Math.hypot(origin.x, origin.y),
        Math.hypot(w - origin.x, origin.y),
        Math.hypot(origin.x, h - origin.y),
        Math.hypot(w - origin.x, h - origin.y),
      ) + 28;

    root.setAttribute("data-active", "true");
    seed.setAttribute("cx", origin.x.toFixed(1));
    seed.setAttribute("cy", origin.y.toFixed(1));
    seed.setAttribute("r", "5");
    seed.style.opacity = "1";
    rings.forEach((ring) => {
      ring.setAttribute("cx", origin.x.toFixed(1));
      ring.setAttribute("cy", origin.y.toFixed(1));
      ring.style.opacity = "0";
    });

    const close = { r: 0 };
    const open = { r: 0 };

    timeline = gsap.timeline({
      onComplete: () => {
        fill.setAttribute("d", "M0 0Z");
        root.removeAttribute("data-active");
        timeline = null;
      },
    });

    timeline
      .to(
        close,
        {
          r: reach,
          duration: CLOSE_DURATION,
          ease: "power3.inOut",
          onUpdate: () => {
            const p = close.r / reach;
            fill.setAttribute("d", disc(origin.x, origin.y, close.r));
            seed.setAttribute("r", (5 + p * 14).toFixed(1));
            seed.style.opacity = String(Math.max(0, 1 - p * 2.4));
            rings.forEach((ring, i) => {
              const local = Math.max(0, Math.min(1, p / RINGS_TRAIL - i * 0.26));
              ring.setAttribute("r", (close.r * (0.72 - i * 0.16)).toFixed(1));
              ring.style.opacity = String(0.4 * local * (1 - local * 0.7));
            });
          },
        },
        0,
      )
      .call(onCovered, [], CLOSE_DURATION)
      .set(rings, { opacity: 0 }, CLOSE_DURATION + HOLD * 0.5)
      .to(
        open,
        {
          r: reach,
          duration: OPEN_DURATION,
          ease: "power3.inOut",
          onUpdate: () => fill.setAttribute("d", hole(origin.x, origin.y, open.r, w, h)),
        },
        CLOSE_DURATION + HOLD,
      );
  };

  return {
    play,
    destroy() {
      timeline?.kill();
      timeline = null;
    },
  };
}
