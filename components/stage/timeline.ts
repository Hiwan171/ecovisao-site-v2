/**
 * The pinned sequence that starts on the hero: one stage, one pin, one scroll
 * progress, cut into thirteen beats. Each beat's engine only ever sees its own
 * 0..1, so it can be tuned (or replaced) without knowing what surrounds it.
 *
 *  1. manifesto   the wipe out of the tree, then Eco → alinhamento → Visão
 *  2. iris        the cream closes around the figure's centre and becomes a lens
 *  3. method      the lens diagnoses a business, then untangles it
 *  4. open        the lens opens to fill the screen and names the next chapter
 *  5. solutions   that chapter's title slides away and the services run past
 *                 sideways, one scroll driving one horizontal track
 *  6. columns     four green columns climb through the paper, staggered: the four
 *                 lanes of the specialty that follows
 *  7. pgrss       the specialty: mixed waste is sorted into four groups, the paths
 *                 converge on one seal
 *  8. rise        the forest rises over it as contoured terrain
 *  9. yuri        the founder: portrait, credentials, then his own words
 * 10. bloom       cream grows out of his last words, as a stain with growth rings
 *                 behind its edge
 * 11. proof       the stories: thirteen brands on three rings, the outer one turning
 *                 to bring each voice to the front
 * 12. doors       every brand is drawn into the node at the rings' centre, and from
 *                 it the paper gives way in rings, to the same node and rings on the dark
 * 13. cta         the only place to get in touch: a dial of answers around the node
 *
 * The first four and the last eight are fixed lengths. The fifth is as long as the
 * track is wide, so it is measured (see `createBeats`): a phone and a wide monitor
 * need very different amounts of scroll to carry the same cards past the eye.
 */

/** Length of each fixed beat before the track, in viewport heights of scroll. */
export const SCREENS = { manifesto: 3.4, iris: 0.6, method: 3.4, open: 1 } as const;

/**
 * And after it. Both climbs start with a short hold, so the closing panel of the
 * section they cover can be read.
 */
export const AFTER = { columns: 1.1, pgrss: 3.7, rise: 1.1, yuri: 2.8, bloom: 1.5, proof: 3.7, doors: 1.6, cta: 1.8 } as const;

/** Used until the track has been measured. */
export const DEFAULT_SOLUTIONS_SCREENS = 3;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export type SplitProgress = {
  manifesto: number;
  iris: number;
  method: number;
  open: number;
  solutions: number;
  columns: number;
  pgrss: number;
  rise: number;
  yuri: number;
  bloom: number;
  proof: number;
  doors: number;
  cta: number;
};

/** Where the page's links can send the scroll: a moment at which that section is on screen. */
export type Anchor = "abordagem" | "solucoes" | "pgrss" | "quem-sou" | "prova" | "contato";

export type Beats = {
  /** Total length of the pin, in viewport heights. */
  total: number;
  split: (progress: number) => SplitProgress;
  /** Sequence progress at which the manifesto is at `local` (0..1) of its own beat. */
  manifestoAt: (local: number) => number;
  /** Sequence progress at which the proof is at `local` (0..1) of its own beat. */
  proofAt: (local: number) => number;
  anchor: (name: Anchor) => number;
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
    AFTER.columns,
    AFTER.pgrss,
    AFTER.rise,
    AFTER.yuri,
    AFTER.bloom,
    AFTER.proof,
    AFTER.doors,
    AFTER.cta,
  ].forEach((length) => stops.push((running += length)));

  const total = running;
  const [
    manifestoEnd,
    irisEnd,
    methodEnd,
    openEnd,
    solutionsEnd,
    columnsEnd,
    pgrssEnd,
    riseEnd,
    yuriEnd,
    bloomEnd,
    proofEnd,
    doorsEnd,
  ] = stops.map((stop) => stop / total);

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
      columns: within(progress, solutionsEnd, columnsEnd),
      pgrss: within(progress, columnsEnd, pgrssEnd),
      rise: within(progress, pgrssEnd, riseEnd),
      yuri: within(progress, riseEnd, yuriEnd),
      bloom: within(progress, yuriEnd, bloomEnd),
      proof: within(progress, bloomEnd, proofEnd),
      doors: within(progress, proofEnd, doorsEnd),
      cta: within(progress, doorsEnd, 1),
    }),
    manifestoAt: (local) => local * manifestoEnd,
    proofAt: (local) => bloomEnd + local * (proofEnd - bloomEnd),
    anchor: (name) => {
      const into = (from: number, to: number, local: number) => from + (to - from) * local;
      switch (name) {
        case "abordagem":
          return into(irisEnd, methodEnd, 0.04);
        case "solucoes":
          return into(methodEnd, openEnd, 0.9);
        case "pgrss":
          return into(columnsEnd, pgrssEnd, 0.02);
        case "quem-sou":
          return into(riseEnd, yuriEnd, 0.2);
        case "prova":
          return into(bloomEnd, proofEnd, 0.06);
        case "contato":
          return into(doorsEnd, 1, 0.5);
      }
    },
  };
}
