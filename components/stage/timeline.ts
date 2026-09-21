/**
 * The pinned sequence that starts on the hero: one stage, one pin, one scroll
 * progress, cut into seven beats. Each beat's engine only ever sees its own
 * 0..1, so it can be tuned (or replaced) without knowing what surrounds it.
 *
 *  1. manifesto   the wipe out of the tree, then Eco → alinhamento → Visão
 *  2. iris        the cream closes around the figure's centre and becomes a lens
 *  3. method      the lens diagnoses a business, then untangles it
 *  4. open        the lens opens to fill the screen and names the next chapter
 *  5. solutions   that chapter's title slides away and the services run past
 *                 sideways, one scroll driving one horizontal track
 *  6. rise        the forest rises over the paper as contoured terrain
 *  7. yuri        the founder: portrait, credentials, then his own words
 *
 * The first four and the last two are fixed lengths. The fifth is as long as the
 * track is wide, so it is measured (see `createBeats`): a phone and a wide monitor
 * need very different amounts of scroll to carry the same cards past the eye.
 */

/** Length of each fixed beat before the track, in viewport heights of scroll. */
export const SCREENS = { manifesto: 3.4, iris: 0.6, method: 3.4, open: 1 } as const;

/** And after it. The rise starts with a short hold, so the closing panel can be read. */
export const AFTER = { rise: 1.1, yuri: 2.8 } as const;

/** Used until the track has been measured. */
export const DEFAULT_SOLUTIONS_SCREENS = 3;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export type SplitProgress = {
  manifesto: number;
  iris: number;
  method: number;
  open: number;
  solutions: number;
  rise: number;
  yuri: number;
};

export type Beats = {
  /** Total length of the pin, in viewport heights. */
  total: number;
  split: (progress: number) => SplitProgress;
  /** Sequence progress at which the manifesto is at `local` (0..1) of its own beat. */
  manifestoAt: (local: number) => number;
};

export function createBeats(solutionsScreens: number = DEFAULT_SOLUTIONS_SCREENS): Beats {
  const stops: number[] = [];
  let running = 0;
  [
    SCREENS.manifesto,
    SCREENS.iris,
    SCREENS.method,
    SCREENS.open,
    solutionsScreens,
    AFTER.rise,
    AFTER.yuri,
  ].forEach((length) => stops.push((running += length)));

  const total = running;
  const [manifestoEnd, irisEnd, methodEnd, openEnd, solutionsEnd, riseEnd] = stops.map(
    (stop) => stop / total,
  );

  const within = (progress: number, from: number, to: number) =>
    clamp01((progress - from) / (to - from));

  return {
    total,
    split: (progress) => ({
      manifesto: within(progress, 0, manifestoEnd),
      iris: within(progress, manifestoEnd, irisEnd),
      method: within(progress, irisEnd, methodEnd),
      open: within(progress, methodEnd, openEnd),
      solutions: within(progress, openEnd, solutionsEnd),
      rise: within(progress, solutionsEnd, riseEnd),
      yuri: within(progress, riseEnd, 1),
    }),
    manifestoAt: (local) => local * manifestoEnd,
  };
}
