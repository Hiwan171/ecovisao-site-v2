"use client";

import { gsap } from "gsap";
import { useEffect, useState } from "react";
import { useReducedMotion } from "../hero/use-reduced-motion";
import "./custom-cursor.css";
import { useFinePointer } from "./use-fine-pointer";

/**
 * A dot and a trailing ring, in the site's own vocabulary — the ring is the
 * same growth-ring mark PGRSS, Prova social and Contato draw everywhere
 * else, not a generic pointer replacement. Structurally absent (no DOM, no
 * listeners) rather than merely hidden on touch or with reduced motion, and
 * mounted a tick late — same idiom as the hero's own deferred scene mount —
 * so it never competes with first paint.
 */
export function CustomCursor() {
  const finePointer = useFinePointer();
  const reducedMotion = useReducedMotion();
  const active = finePointer && !reducedMotion;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!active) return;

    const ric = window.requestIdleCallback ?? ((cb: IdleRequestCallback) => window.setTimeout(cb, 1));
    const cic = window.cancelIdleCallback ?? window.clearTimeout;
    const id = ric(() => setMounted(true));
    return () => cic(id);
  }, [active]);

  useEffect(() => {
    if (!active || !mounted) return;

    const dot = document.querySelector<HTMLElement>("[data-cursor-dot]");
    const ring = document.querySelector<HTMLElement>("[data-cursor-ring]");
    if (!dot || !ring) return;

    document.documentElement.classList.add("cursor-active");

    // Centred on the pointer: a static -50%/-50% baseline that the x/y
    // tweens below compose with, rather than each frame overwriting it.
    gsap.set([dot, ring], { xPercent: -50, yPercent: -50 });

    const dotX = gsap.quickTo(dot, "x", { duration: 0.15, ease: "power3" });
    const dotY = gsap.quickTo(dot, "y", { duration: 0.15, ease: "power3" });
    const ringX = gsap.quickTo(ring, "x", { duration: 0.5, ease: "power3" });
    const ringY = gsap.quickTo(ring, "y", { duration: 0.5, ease: "power3" });

    const onMove = (event: PointerEvent) => {
      dotX(event.clientX);
      dotY(event.clientY);
      ringX(event.clientX);
      ringY(event.clientY);
    };

    // Delegated, so any current or future `[data-cursor]` element works with
    // no extra wiring — every section here mounts once and stays mounted.
    const onOver = (event: PointerEvent) => {
      if ((event.target as Element | null)?.closest("[data-cursor]")) {
        gsap.to(ring, { scale: 2.2, duration: 0.3, ease: "power2.out" });
      }
    };
    const onOut = (event: PointerEvent) => {
      const left = (event.target as Element | null)?.closest("[data-cursor]");
      if (left && !left.contains(event.relatedTarget as Node | null)) {
        gsap.to(ring, { scale: 1, duration: 0.3, ease: "power2.out" });
      }
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);

    return () => {
      document.documentElement.classList.remove("cursor-active");
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
    };
  }, [active, mounted]);

  if (!active || !mounted) return null;

  return (
    <div className="cursor" aria-hidden="true">
      <div className="cursor__ring" data-cursor-ring />
      <div className="cursor__dot" data-cursor-dot />
    </div>
  );
}
