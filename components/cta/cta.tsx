"use client";

import Image from "next/image";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { CONTACT, INTERESTS, mailtoFor, whatsappUrl } from "../contact";
import "./cta.css";

type CtaProps = {
  staticMode: boolean;
  /** True once the paper before it has given way enough for this to be the one on top. */
  open: boolean;
};

const RINGS = 9;
/** The dial opens on the answer for whoever does not know yet: the diagnosis. */
const DEFAULT_CHOICE = INTERESTS.length - 1;

/**
 * Section 08, and the only place to get in touch. The paper of the stories gives way in
 * rings from the node at the middle of its own (proof-engine.ts), and what it uncovers
 * is that node and those rings going on over the dark. Around the node sits a dial of
 * four answers to "what are you looking for?"; choosing one draws a thread to it and
 * writes the button and the e-mail for that answer. There is no form: the visitor's own
 * e-mail is the form. cta-engine.ts moves all of it.
 *
 * The sentence under the title is page 12 of the institutional document.
 */
export function Cta({ staticMode, open }: CtaProps) {
  const [choice, setChoice] = useState(DEFAULT_CHOICE);
  const [pulse, setPulse] = useState(0);
  const [copied, setCopied] = useState(false);
  const pills = useRef<(HTMLButtonElement | null)[]>([]);
  const copiedTimer = useRef<number | null>(null);

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
    try {
      await navigator.clipboard.writeText(CONTACT.email);
    } catch {
      // No clipboard (an insecure page, an old browser): select the address for the visitor.
      const node = document.querySelector("[data-ct-email]");
      if (node) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
    setCopied(true);
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), 2200);
  }

  return (
    <section
      id="contato"
      className={`cta${staticMode ? " cta--static" : ""}`}
      data-ct="root"
      data-choice={choice}
      aria-labelledby="cta-title"
    >
      <div className="cta__bg" aria-hidden="true" />

      <svg className="cta__rings" aria-hidden="true">
        {Array.from({ length: RINGS }, (_, i) => (
          <circle key={i} className="cta__ring" data-ct="ring" />
        ))}
        <circle className="cta__dial-ring" data-ct="dial-ring" />
        <circle className="cta__dial-ticks" data-ct="dial-ticks" />
        <line className="cta__thread" data-ct="thread" />
        <circle className="cta__halo" data-ct="halo" />
        <circle className="cta__node" data-ct="node" />
        {/* Born again from the node each time an answer is chosen. */}
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
          <a href="#visao">Nossa visão</a>
          <a className="header-cta" href={mailtoFor(interest)}>
            Fale com a Ecovisão
            <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>

      <div className="cta__copy">
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
      </div>

      {/* The dial: what are you looking for? Its place is decorative, its controls are real. */}
      <div
        className="cta__dial"
        data-ct="dial"
        role="radiogroup"
        aria-label="O que você procura?"
        onKeyDown={onKeyDown}
      >
        {INTERESTS.map((item, k) => (
          <button
            key={item.id}
            ref={(element) => {
              pills.current[k] = element;
            }}
            type="button"
            role="radio"
            aria-checked={k === choice}
            tabIndex={k === choice ? 0 : -1}
            className="cta-pill"
            data-ct="pill"
            data-on={k === choice}
            onClick={() => choose(k)}
          >
            <i aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="cta__reach" data-ct="reach">
        <a className="button button--primary" href={mailtoFor(interest)} aria-live="polite">
          <span>{interest.ask}</span>
          <i aria-hidden="true">↗</i>
        </a>

        <div className="cta__links">
          <button type="button" className="cta-copy" onClick={copy}>
            <span data-ct-email>{CONTACT.email}</span>
            <b aria-live="polite">{copied ? "Copiado ✓" : "Copiar"}</b>
          </button>

          <a className="cta-link" href={CONTACT.instagramUrl} target="_blank" rel="noreferrer">
            @{CONTACT.instagram}
            <span aria-hidden="true">↗</span>
          </a>

          {chat ? (
            <a className="cta-link" href={chat} target="_blank" rel="noreferrer">
              WhatsApp
              <span aria-hidden="true">↗</span>
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
