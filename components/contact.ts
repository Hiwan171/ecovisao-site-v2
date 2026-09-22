/**
 * How to reach Ecovisão, as the institutional document gives it (page 13): an e-mail and
 * an Instagram profile. There is no phone or WhatsApp number in it, so there is none
 * here: fill `whatsapp` (digits only, with country code, e.g. "5531999999999") and the
 * buttons that use it appear on their own.
 *
 * The QR code on that page points to a third-party address, not to a contact, so it is
 * not carried over.
 */
export const CONTACT = {
  email: "yuri.elias@ecovisaoconsultoria.com.br",
  instagram: "ecovisaoconsultoria",
  instagramUrl: "https://www.instagram.com/ecovisaoconsultoria/",
  whatsapp: null as string | null,
} as const;

export const mailto = (subject: string, body?: string) =>
  `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}${
    body ? `&body=${encodeURIComponent(body)}` : ""
  }`;

export const whatsappUrl = (text: string) =>
  CONTACT.whatsapp ? `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}` : null;

/**
 * What a visitor can say they are looking for. The first three are the three pillars of
 * the services page; the last is the document's own answer for whoever does not know yet:
 * a diagnosis of the company. The order is the order around the dial (top, right, bottom,
 * left).
 */
export const INTERESTS = [
  { id: "pgrss", label: "PGRSS e regularização", ask: "Falar sobre PGRSS" },
  { id: "gestao", label: "Gestão e estratégia", ask: "Falar sobre gestão" },
  { id: "pessoas", label: "Pessoas e desenvolvimento", ask: "Falar sobre pessoas" },
  { id: "diagnostico", label: "Ainda não sei", ask: "Agendar um diagnóstico" },
] as const;

/** The e-mail that opens for the chosen interest: written for the visitor, who sends it. */
export const mailtoFor = (interest: (typeof INTERESTS)[number]) =>
  mailto(
    "Quero agendar um diagnóstico",
    `Olá, Ecovisão!\n\nTenho interesse em: ${interest.label}.\n\nMeu nome é `,
  );
