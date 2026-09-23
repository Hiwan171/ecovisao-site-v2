"use client";

import Image from "next/image";
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { CONTACT, INTERESTS, mailtoFor, whatsappUrl } from "../contact";
import { useMagnetic } from "../cursor/use-magnetic";
import { SectionMenu } from "../nav/section-menu";
import { RINGS } from "../proof/clients";
import "./cta.css";

type CtaProps = {
  staticMode: boolean;
  /** True once the paper before it has given way enough for this to be the one on top. */
  open: boolean;
};

/** The grown rings already inside the new one — see ECHO_SCALE in the engine. */
const RING_ECHOES = 3;
/** The dial opens on the answer for whoever does not know yet: the diagnosis. */
const DEFAULT_CHOICE = INTERESTS.length - 1;

/** The two icons beside the copy button: a mark, not the platform's own logo. */
function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5.5" />
      <circle cx="12" cy="12" r="4.15" />
      <circle cx="17.15" cy="6.85" r="0.35" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** One glyph per pillar of the dial, in the same thin stroke as the icons above. */
const DIAL_ICONS: Record<string, (props: { className?: string }) => ReactNode> = {
  pgrss: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M12 3.3 5.2 6v5.4c0 4.7 3 7.7 6.8 9.4 3.8-1.7 6.8-4.7 6.8-9.4V6L12 3.3Z" />
      <path d="M9 12.1l2.1 2.1L15.3 10" />
    </svg>
  ),
  gestao: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4 16.5 9.2 11l3.4 3.4L20 7" />
      <path d="M14.6 7h5.4v5.4" />
    </svg>
  ),
  pessoas: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="12" cy="8.2" r="3" />
      <path d="M5 20c0-4 3-6.6 7-6.6s7 2.6 7 6.6" />
    </svg>
  ),
  diagnostico: (props) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="10.3" cy="10.3" r="6" />
      <path d="M14.8 14.8 20 20" />
    </svg>
  ),
};

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M12 3.25a8.75 8.75 0 0 0-7.55 13.2L3.25 20.75l4.42-1.16A8.75 8.75 0 1 0 12 3.25Z" />
      <path
        d="M8.7 8.35c.2-.44.37-.45.63-.46h.44c.16 0 .34.02.5.36.2.44.65 1.55.71 1.66.06.12.1.26.02.42-.08.16-.13.26-.26.4-.13.14-.27.3-.38.41-.13.13-.27.26-.11.53.15.28.68 1.13 1.48 1.83.99.87 1.79 1.14 2.06 1.27.28.13.44.11.6-.07.17-.18.71-.82.9-1.11.19-.28.37-.23.63-.14.26.1 1.63.77 1.91.91.28.14.46.2.53.33.07.13.07.72-.17 1.42-.24.7-1.4 1.28-1.94 1.36-.5.08-1.13.11-3.64-.76-3.04-1.06-4.99-4.15-5.14-4.35-.15-.19-1.23-1.63-1.23-3.11 0-1.48.78-2.2 1.05-2.5Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

/**
 * Section 08, and the only place to get in touch. The paper of the stories gives way in
 * rings from the node at the middle of its own (proof-engine.ts), and what it uncovers
 * is that node and those rings going on over the dark — one still open, still being
 * drawn, the visitor's own. That ring is the atmosphere the words sit in front of, not
 * something to act on: what is read or clicked lives in the column, in one plain order —
 * a dial of four answers to "what are you looking for?", then the button and the e-mail
 * that answer writes. There is no form: the visitor's own e-mail is the form.
 * cta-engine.ts moves the ring; nothing here is placed on it.
 *
 * The sentence under the title is page 12 of the institutional document.
 */
export function Cta({ staticMode, open }: CtaProps) {
  const [choice, setChoice] = useState(DEFAULT_CHOICE);
  const [pulse, setPulse] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "selected">("idle");
  const pills = useRef<(HTMLButtonElement | null)[]>([]);
  const copiedTimer = useRef<number | null>(null);
  const headerCtaRef = useMagnetic<HTMLAnchorElement>();
  const primaryCtaRef = useMagnetic<HTMLAnchorElement>();

  const interest = INTERESTS[choice];
  const chat = whatsappUrl(`Olá! ${interest.ask}.`);

  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    };
  }, []);

  function choose(next: number) {
    if (next === choice) return;
    setChoice(next);
    setPulse((count) => count + 1);
  }

  /** A radio group: the arrows move through the answers, and the tab key leaves it. */
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = ["ArrowRight", "ArrowDown"].includes(event.key)
      ? 1
      : ["ArrowLeft", "ArrowUp"].includes(event.key)
        ? -1
        : 0;
    if (!step) return;

    event.preventDefault();
    const next = (choice + step + INTERESTS.length) % INTERESTS.length;
    choose(next);
    pills.current[next]?.focus();
  }

  async function copy() {
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);

    try {
      await navigator.clipboard.writeText(CONTACT.email);
      setCopyState("copied");
    } catch {
      // No clipboard (an insecure page, an old browser): select the address so the
      // visitor can still copy it themselves — that is not the same as having
      // copied it, so the label says so.
      const node = document.querySelector("[data-ct-email]");
      if (node) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      setCopyState("selected");
    }
    copiedTimer.current = window.setTimeout(() => setCopyState("idle"), 2200);
  }

  return (
    <section
      id="contato"
      className={`cta${staticMode ? " cta--static" : ""}`}
      data-ct="root"
      aria-labelledby="cta-title"
    >
      <div className="cta__bg" aria-hidden="true" />

      <svg className="cta__scene" aria-hidden="true">
        {/* The whole scene grows out of the node section 07's rings closed onto, at the
            point the paper opened from — see the settle transform in cta-engine.ts. */}
        <g data-ct="scene">
          {/* The trunk section 07 reads client logos on, one ring per year: this is the
              wood just inside its edge. The same three rings, at the same spacing, with
              the brands gone from them; behind them all, the seed they converged on. */}
          <g data-ct="rings">
            {Array.from({ length: RING_ECHOES }, (_, i) => (
              <path key={i} className="cta__ring-echo" data-ct="ring-echo" data-ct-i={i} />
            ))}
          </g>
          {/* One per brand section 07 drew into the node, in its own slot on its own
              ring. They ride back out of the node the way they went in and settle where
              they stood, then let go: the rings are the same rings, and what was on
              them is finished. */}
          {RINGS.flatMap((ring, j) =>
            ring.map((slug, slot) => (
              <circle
                key={slug}
                className="cta__trace"
                data-ct="trace"
                data-ring={j}
                data-slot={slot}
                r="2.6"
              />
            )),
          )}
          {/* The newest ring: still open, still being drawn, breaking past the other
              three and down into a path — the only one that goes anywhere. */}
          <path className="cta__path" data-ct="path" pathLength="1" />
        </g>

        {/* The node itself is not born here: it is the one section 07's brands closed
            onto, and it never leaves. It only travels to its resting place and settles
            back to its own size, which is why it sits outside the group above. */}
        <g data-ct="seed">
          <circle className="cta__halo" data-ct="halo" />
          <image className="cta__mark" data-ct="mark" href="/brand/ecovisao-mark.svg" />
        </g>
        {/* Born again from the seed each time an answer is chosen. */}
        {pulse > 0 ? <circle key={pulse} className="cta__pulse" r="1" /> : null}
      </svg>

      {/* The header once more, cream on forest. */}
      <header className="site-header cta__header" inert={!open}>
        <a className="brand" href="#top" aria-label="Ecovisão — início">
          <Image
            src="/brand/ecovisao-logo-on-dark.svg"
            alt="Ecovisão Consultoria"
            width={154}
            height={58}
            unoptimized
          />
        </a>

        <div className="site-header__descriptor" aria-label="Áreas de atuação">
          <span>Gestão</span>
          <i />
          <span>Estratégia</span>
          <i />
          <span>PGRSS</span>
        </div>

        <nav className="site-header__nav" aria-label="Navegação principal">
          <SectionMenu />
          <a className="header-cta" href={mailtoFor(interest)} ref={headerCtaRef} data-cursor="hover">
            Fale com a Ecovisão
            <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>

      <div className="cta__copy" data-ct="copy">
        <p className="cta__eyebrow" data-ct="eyebrow">
          <span aria-hidden="true" />
          08 <b>—</b> Contato
        </p>

        <h2 id="cta-title" className="cta__title">
          <span className="ct-mask">
            <span data-ct="line">A próxima história</span>
          </span>
          <span className="ct-mask">
            <span data-ct="line">
              de <em>sucesso</em> pode
            </span>
          </span>
          <span className="ct-mask">
            <span data-ct="line">
              ser a <em>sua.</em>
            </span>
          </span>
        </h2>

        <p className="cta__lead" data-ct="fade">
          A Ecovisão é o parceiro que você precisa para crescer, otimizar processos e fortalecer seu negócio.
        </p>

        <p className="cta__creed" data-ct="fade">
          Raiz no diagnóstico. Estrutura na gestão. Crescimento como resultado.
        </p>

        {/* The four answers, in the column's own reading order — between the words and
            the button, the same place at every width. The ring behind them is one
            client's growth, not a category of enquiry; asking a visitor to find their
            answer on someone else's ring never meant anything, so nothing here is
            placed on it any more. */}
        <div
          className="cta__dial"
          data-ct="dial"
          role="radiogroup"
          aria-label="O que você procura?"
          onKeyDown={onKeyDown}
        >
          {INTERESTS.map((item, k) => {
            const Icon = DIAL_ICONS[item.id];
            return (
              <button
                key={item.id}
                ref={(element) => {
                  pills.current[k] = element;
                }}
                type="button"
                role="radio"
                aria-checked={k === choice}
                aria-label={item.label}
                tabIndex={k === choice ? 0 : -1}
                className="cta-mark"
                data-ct="pill"
                data-on={k === choice}
                data-cursor="hover"
                onClick={() => choose(k)}
              >
                {Icon ? <Icon className="cta-mark__icon" /> : null}
                <span>{item.short}</span>
              </button>
            );
          })}
        </div>

        {/* One button, then one quiet line. Everything else that used to sit down here
            is on the ring now, where there is room for it. */}
        <div className="cta__reach" data-ct="reach">
          <a
            className="button button--primary"
            data-ct="go"
            href={mailtoFor(interest)}
            aria-live="polite"
            ref={primaryCtaRef}
            data-cursor="hover"
          >
            <span>{interest.ask}</span>
            <i aria-hidden="true">↗</i>
          </a>

          <div className="cta__links">
            <button type="button" className="cta-copy" onClick={copy} data-cursor="hover">
              <span data-ct-email>{CONTACT.email}</span>
              <b aria-live="polite">
                {copyState === "copied" ? "copiado" : copyState === "selected" ? "selecionado" : "copiar"}
              </b>
            </button>

            <a
              className="cta-icon"
              href={CONTACT.instagramUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Instagram da Ecovisão, @${CONTACT.instagram}`}
              title={`@${CONTACT.instagram}`}
              data-cursor="hover"
            >
              <InstagramIcon />
            </a>

            {chat ? (
              <a
                className="cta-icon"
                href={chat}
                target="_blank"
                rel="noreferrer"
                aria-label="Falar com a Ecovisão no WhatsApp"
                title="WhatsApp"
                data-cursor="hover"
              >
                <WhatsAppIcon />
              </a>
            ) : null}
          </div>
        </div>
      </div>

    </section>
  );
}
