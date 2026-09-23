import type { Anchor } from "../stage/timeline";

/**
 * Every jump point in the pinned sequence, in scroll order. `goto` is the beat's
 * anchor name (see timeline.ts); its absence on the first entry is not an
 * omission — "Nossa visão" has its own handler in stage-sequence.tsx, tuned to
 * land past the manifesto's reveal rather than at the top of its beat.
 */
export const SECTION_LINKS: readonly { label: string; href: string; goto?: Anchor }[] = [
  { label: "Nossa visão", href: "#visao" },
  { label: "Abordagem", href: "#abordagem", goto: "abordagem" },
  { label: "Soluções", href: "#solucoes", goto: "solucoes" },
  { label: "PGRSS", href: "#pgrss", goto: "pgrss" },
  { label: "Quem sou eu", href: "#yuri", goto: "quem-sou" },
  { label: "Clientes e parceiros", href: "#prova", goto: "prova" },
  { label: "Contato", href: "#contato", goto: "contato" },
] as const;
