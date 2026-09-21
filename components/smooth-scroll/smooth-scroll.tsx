"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import {
  type ReactNode,
  type RefObject,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import { useReducedMotion } from "../hero/use-reduced-motion";

/**
 * Smooth scrolling for the whole page. Lenis keeps the native scroll (scrollbar,
 * keyboard, find-in-page and assistive tech all still work) and only eases the
 * position towards where the wheel sent it. It is driven from GSAP's ticker so
 * ScrollTrigger, and therefore every pinned section, reads the same eased
 * position on the same frame instead of a frame behind it.
 */

/** Seconds a wheel notch takes to settle, and how far one notch travels. */
const WHEEL_DURATION = 1.4;
const WHEEL_MULTIPLIER = 0.85;

/** Seconds a scroll triggered by a link (rather than the wheel) takes. */
const LINK_DURATION = 1.7;

const SmoothScrollContext = createContext<RefObject<Lenis | null> | null>(null);

export function SmoothScroll({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    // Reduced motion keeps the browser's own scrolling, untouched.
    if (reducedMotion) return;

    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      autoRaf: false,
      duration: WHEEL_DURATION,
      wheelMultiplier: WHEEL_MULTIPLIER,
      // The loader locks the page by hiding the body's overflow. Left alone,
      // Lenis would still turn the wheel into a programmatic scroll, and those
      // ignore overflow: hidden.
      prevent: () => document.body.style.overflow === "hidden",
    });
    lenisRef.current = lenis;

    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    // Lenis wants real time, not GSAP's smoothed clock, or long frames make the
    // glide stutter.
    gsap.ticker.lagSmoothing(0);

    // Brand links point at the top of the page; without native smooth scrolling
    // they would jump.
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest('a[href="#top"]');
      if (!link) return;

      event.preventDefault();
      lenis.scrollTo(0, { duration: LINK_DURATION });
    };
    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [reducedMotion]);

  return <SmoothScrollContext value={lenisRef}>{children}</SmoothScrollContext>;
}

/** Scrolls to a pixel position, eased, falling back to the browser's own. */
export function useScrollTo() {
  const lenisRef = useContext(SmoothScrollContext);

  return useCallback(
    (top: number) => {
      const lenis = lenisRef?.current;

      if (lenis) lenis.scrollTo(top, { duration: LINK_DURATION });
      else window.scrollTo({ top, behavior: "smooth" });
    },
    [lenisRef],
  );
}
