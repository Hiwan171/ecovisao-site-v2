"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useMagnetic } from "../cursor/use-magnetic";
import { SECTION_LINKS } from "./section-links";
import "./section-menu.css";

/**
 * The one way to reach any section without scrolling the whole pin to get there.
 * Sits where "Nossa visão" used to sit in every header (there are eight, one per
 * section, swapped in and out as the paper changes colour) and opens the same
 * list the footer ends on, so a returning visitor — or anyone who just wants the
 * PGRSS page or the e-mail — has a way in from wherever they already are.
 */
export function SectionMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useMagnetic<HTMLButtonElement>({ strength: 0.25 });
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={`sm${open ? " sm--open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="sm__trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Seções"
        onClick={() => setOpen((value) => !value)}
        ref={triggerRef}
        data-cursor="hover"
      >
        <span>Seções</span>
        <i aria-hidden="true" />
        <b aria-hidden="true">
          <em />
          <em />
          <em />
          <em />
        </b>
      </button>

      <nav id={panelId} className="sm__panel" aria-label="Seções do site" hidden={!open}>
        <ul>
          {SECTION_LINKS.map((link, index) => (
            <li key={link.label}>
              <a href={link.href} data-goto={link.goto} data-cursor="hover" onClick={() => setOpen(false)}>
                <i aria-hidden="true">{String(index + 1).padStart(2, "0")}</i>
                <span>{link.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
