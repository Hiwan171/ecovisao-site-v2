"use client";

import { gsap } from "gsap";
import { useEffect, useRef } from "react";
import { useReducedMotion } from "../hero/use-reduced-motion";
import { useFinePointer } from "./use-fine-pointer";

type MagneticOptions = {
  /** How far the element travels relative to the pointer's offset from its centre. */
  strength?: number;
  /** How much it grows while the pointer is inside it. */
  scale?: number;
};

/**
 * A button that leans toward the pointer and lets go with a small bounce —
 * the "this feels expensive" detail, kept as subtle as the rest of the
 * site's motion. Off entirely without a real mouse or with reduced motion,
 * leaving the element's own CSS `:hover` as the only effect.
 */
export function useMagnetic<T extends HTMLElement>({ strength = 0.35, scale = 1.04 }: MagneticOptions = {}) {
  const ref = useRef<T | null>(null);
  const finePointer = useFinePointer();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || !finePointer || reducedMotion) return;

    const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });

    const onMove = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      xTo((event.clientX - (box.left + box.width / 2)) * strength);
      yTo((event.clientY - (box.top + box.height / 2)) * strength);
      gsap.to(el, { scale, duration: 0.3, ease: "power3.out" });
    };
    const onLeave = () => {
      gsap.to(el, { x: 0, y: 0, scale: 1, duration: 0.7, ease: "elastic.out(1, 0.4)" });
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      gsap.set(el, { x: 0, y: 0, scale: 1 });
    };
  }, [finePointer, reducedMotion, strength, scale]);

  return ref;
}
