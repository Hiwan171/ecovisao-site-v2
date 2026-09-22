/**
 * Page 10 of the institutional document ("Clientes e Parceiros") and page 11 (the three
 * feedbacks), as data. The document does not say which of the thirteen brands are
 * clients and which are partners, so nothing here does either.
 *
 * Each logo has two files in /public/images/clients: `<slug>.webp`, the logo on its own
 * ground as the document shows it, and `<slug>-mono.webp`, the shape alone (white on
 * transparent) for tinting.
 */

export const CLIENT_NAMES: Record<string, string> = {
  brandao: "Contabilidade Brandão",
  "belvedere-plaza": "Belvedere Plaza",
  "pet-shop-floresta": "Pet Shop Floresta",
  "defense-ti": "Defense TI",
  senda: "Senda Consultoria",
  "fernanda-rodrigues": "Dra. Fernanda Rodrigues",
  inovar: "Inovar Ambiental",
  "luciana-goncalves": "LG Odontologia",
  falcons: "Falcons Company",
  labvida: "LabVida",
  "vet-mais": "Veterinária Vet Mais",
  taruma: "Tarumã Soluções Ambientais",
  "euzebia-reguete": "Euzébia Reguete",
};

/**
 * The thirteen marks on three rings, inner to outer. The outer ring holds the three
 * brands that gave feedback, a third of a turn apart (slots 0, 2 and 4), so turning
 * that ring by a third brings each of them to the front in turn.
 */
export const RINGS: readonly (readonly string[])[] = [
  ["brandao", "belvedere-plaza", "pet-shop-floresta"],
  ["defense-ti", "senda", "fernanda-rodrigues", "inovar"],
  ["luciana-goncalves", "falcons", "labvida", "vet-mais", "taruma", "euzebia-reguete"],
];

/** Words between asterisks are the ones the sentence turns on. */
export const VOICES = [
  {
    slug: "luciana-goncalves",
    name: "Dra. Luciana Gonçalves",
    org: "Consultório LG Odontologia",
    place: "BH/MG",
    paragraphs: [
      "Me senti *amparada* durante todo o processo de execução do PGRSS, e além disso, tive também *segurança* em relação ao meu ambiente de trabalho diante das normas da Vigilância Sanitária a serem seguidas.",
    ],
  },
  {
    slug: "labvida",
    name: "Matheus Souza Ferreira",
    org: "LabVida – Laboratório de Análises Clínicas",
    place: "Ervália/MG",
    paragraphs: [
      "Eu me senti muito bem. Recebi uma *atenção* desde o primeiro contato até depois que todos os problemas do laboratório já tinham sido resolvidos.",
      "Com direito a atendimento por vídeo e vários conselhos para o melhor andamento da nossa empresa.",
    ],
  },
  {
    slug: "taruma",
    name: "Felipe Bahia",
    org: "Tarumã Soluções Ambientais",
    place: "BH/MG",
    paragraphs: [
      "Corpo técnico qualificado para o entendimento das demandas e rápida resolução com cumprimento de prazos.",
      "Resolveu tudo o que precisávamos com *agilidade*, *preço justo* e entregaram o serviço na *data prevista*.",
    ],
  },
] as const;
