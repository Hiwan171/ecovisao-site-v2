import type { Metadata, Viewport } from "next";
import { Inter_Tight, Source_Serif_4 } from "next/font/google";
import { CONTACT } from "@/components/contact";
import { CustomCursor } from "@/components/cursor/custom-cursor";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const interTight = Inter_Tight({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const TITLE = "Ecovisão | Consultoria empresarial e PGRSS";
const DESCRIPTION =
  "Consultoria empresarial e soluções em PGRSS para conectar pessoas, processos e estratégia. Seu negócio é um ecossistema: nós enxergamos o todo.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Ecovisão Consultoria",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Ecovisão Consultoria",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#071a10",
};

/** What a search engine can be told about the company without guessing: only what the document states. */
const organization = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "Ecovisão Consultoria",
  url: SITE_URL,
  email: CONTACT.email,
  description: DESCRIPTION,
  sameAs: [CONTACT.instagramUrl],
  founder: { "@type": "Person", name: "Yuri Elias", jobTitle: "Biólogo e gestor empresarial" },
  knowsAbout: ["Consultoria empresarial", "PGRSS", "PGRS", "Planejamento estratégico", "Treinamento e desenvolvimento"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${interTight.variable} ${sourceSerif.variable}`}
      suppressHydrationWarning
    >
      <body>
        {children}
        <CustomCursor />
        <script
          type="application/ld+json"
          // Serialised data only, with `<` escaped so nothing in it can close the tag.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organization).replace(/</g, "\u003c") }}
        />
      </body>
    </html>
  );
}
