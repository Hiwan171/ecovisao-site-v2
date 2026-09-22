"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type RefObject, useEffect, useRef, useState } from "react";
import type { CrownPosition } from "../hero/hero-scene";
import { Cta } from "../cta/cta";
import { createCtaEngine } from "../cta/cta-engine";
import { Manifesto } from "../manifesto/manifesto";
import {
  ANCHOR_PROGRESS,
  type ManifestoEngine,
  createManifestoEngine,
} from "../manifesto/manifesto-engine";
import { Method } from "../method/method";
import { type MethodEngine, createMethodEngine } from "../method/method-engine";
import { Pgrss } from "../pgrss/pgrss";
import { createPgrssEngine } from "../pgrss/pgrss-engine";
import { Proof } from "../proof/proof";
import { VOICE_AT, createProofEngine } from "../proof/proof-engine";
import { useScrollTo } from "../smooth-scroll/smooth-scroll";
import { SolutionsTrack } from "../solutions/solutions";
import { createSolutionsEngine } from "../solutions/solutions-engine";
import { Yuri } from "../yuri/yuri";
import { createYuriEngine } from "../yuri/yuri-engine";
import { type Anchor, type Beats, createBeats } from "./timeline";

type StageSequenceProps = {
  /** The pinned box that holds the hero and everything that grows out of it. */
  stageRef: RefObject<HTMLDivElement | null>;
  ready: boolean;
  staticMode: boolean;
  covered: boolean;
  crown: CrownPosition;
  onCover: (covered: boolean) => void;
};

/**
 * Owns the one pin and the one scroll loop that drive the manifesto, the iris,
 * the method, the solutions track, the PGRSS specialty, the founder and the stories
 * of the people who trusted them and the closing. Each section is an engine that only ever sees its own 0..1
 * (see timeline.ts); this component is the only place that knows they share a
 * scroll, which is what lets a beat be retuned or a new one slotted in.
 */
export function StageSequence({
  stageRef,
  ready,
  staticMode,
  covered,
  crown,
  onCover,
}: StageSequenceProps) {
  const [methodActive, setMethodActive] = useState(false);
  const [opened, setOpened] = useState(false);
  const [pgrssOpen, setPgrssOpen] = useState(false);
  const [yuriOpen, setYuriOpen] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);
  const [ctaOpen, setCtaOpen] = useState(false);
  const manifestoRef = useRef<ManifestoEngine | null>(null);
  const methodRef = useRef<MethodEngine | null>(null);
  const crownRef = useRef(crown);
  const scrollTo = useScrollTo();

  useEffect(() => {
    crownRef.current = crown;
    manifestoRef.current?.setCrown(crown);
    methodRef.current?.setCrown(crown);
  }, [crown]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!ready || !stage) return;

    const manifesto = createManifestoEngine(stage, { onCover });
    const method = createMethodEngine(stage, { onActive: setMethodActive, onOpen: setOpened });
    const solutions = createSolutionsEngine(stage);
    const pgrss = createPgrssEngine(stage, { onOpen: setPgrssOpen });
    const yuri = createYuriEngine(stage, { onOpen: setYuriOpen });
    const proof = createProofEngine(stage, { onOpen: setProofOpen });
    const cta = createCtaEngine(stage, { onOpen: setCtaOpen });
    manifestoRef.current = manifesto;
    methodRef.current = method;
    manifesto.setCrown(crownRef.current);
    method.setCrown(crownRef.current);

    const release = () => {
      manifesto.destroy();
      method.destroy();
      solutions.destroy();
      pgrss.destroy();
      yuri.destroy();
      proof.destroy();
      cta.destroy();
      manifestoRef.current = null;
      methodRef.current = null;
    };

    // Reduced motion: the finished picture in normal flow, nothing pinned.
    if (staticMode) {
      const paint = () => {
        manifesto.paintStatic();
        method.paintStatic();
        solutions.paintStatic();
        pgrss.paintStatic();
        yuri.paintStatic();
        proof.paintStatic();
        cta.paintStatic();
      };
      paint();
      const observer = new ResizeObserver(paint);
      observer.observe(stage);

      // Labels are seated by their measured width, which is wrong until the fonts
      // are in, so paint again once they are.
      let cancelled = false;
      document.fonts?.ready.then(() => {
        if (!cancelled) paint();
      });

      return () => {
        cancelled = true;
        observer.disconnect();
        release();
      };
    }

    gsap.registerPlugin(ScrollTrigger);

    // The stage is hundreds of pixels tall and carries a lot of endless CSS
    // animation (pulses on the maps, the hero's scroll cue). Once it has scrolled
    // out of view none of that can be seen, but it still cost a style and layout
    // pass every frame, which made the sections after it crawl. Pause it all.
    const visibility = new IntersectionObserver(([entry]) => {
      stage.classList.toggle("stage--offscreen", !entry.isIntersecting);
    });
    visibility.observe(stage);

    // The last beat is as long as the track is wide, so the beats are re-cut from
    // the measured track every time the pin's length is worked out.
    let beats: Beats = createBeats();

    const renderAll = (progress: number, now: number, immediate: boolean) => {
      const parts = beats.split(progress);
      const settled = manifesto.render(parts.manifesto, now, immediate);
      method.render(parts.iris, parts.method, parts.open, parts.rise >= 1);
      solutions.render(parts.open, parts.solutions);
      pgrss.render(parts.columns, parts.pgrss, now);
      yuri.render(parts.rise, parts.yuri);
      proof.render(parts.bloom, parts.proof, parts.doors, now);
      cta.render(parts.doors, parts.cta, now);
      return settled;
    };

    // Scroll sets a target; the picture eases towards it. That damping is what
    // makes a wheel notch feel like a glide, and it is frame-rate independent.
    let target = 0;
    let shown = 0;
    let last = 0;
    let frame = 0;
    let running = false;
    let inside = false;

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      shown =
        Math.abs(target - shown) < 0.0002 ? target : shown + (target - shown) * (1 - Math.exp(-dt * 12));
      const settled = renderAll(shown, now, false);

      // Inside the pin the orbits keep swaying, so the loop keeps going. Outside
      // it, run only until the picture has caught up with where the scroll is.
      if (inside || !settled || shown !== target) frame = window.requestAnimationFrame(tick);
      else running = false;
    };
    const start = () => {
      if (running) return;
      running = true;
      last = performance.now();
      frame = window.requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      window.cancelAnimationFrame(frame);
    };
    const snap = (progress: number) => {
      target = shown = progress;
      renderAll(shown, performance.now(), true);
    };

    const trigger = ScrollTrigger.create({
      trigger: stage,
      // A hero taller than the viewport is pinned by its bottom edge instead, so
      // every section always lands on the visible part of it.
      start: () => (stage.offsetHeight > window.innerHeight + 1 ? "bottom bottom" : "top top"),
      end: () => {
        beats = createBeats(solutions.screens());
        return `+=${Math.round(window.innerHeight * beats.total)}`;
      },
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        target = self.progress;
      },
      onToggle: (self) => {
        inside = self.isActive;

        // Leaving the pin means being fully before it or fully past it. Read the
        // side from the scroll position: `progress` can still hold the last
        // in-range value at this point, which left a sliver of wipe on screen.
        // Ease to that end rather than snapping, so nothing jumps on the way out.
        if (!inside) target = self.scroll() >= self.end ? 1 : 0;
        start();
      },
      onRefresh: (self) => {
        manifesto.measure();
        method.measure();
        solutions.measure();
        pgrss.measure();
        yuri.measure();
        proof.measure();
        cta.measure();
        snap(self.progress);
      },
    });
    snap(trigger.progress);

    // ScrollTrigger only reports while the scroll is inside the pin, and says nothing
    // when it jumps from before the pin to past it (the End key, dragging the
    // scrollbar). The pin now ends where the page does, so that jump left the stage
    // on its first frame. Reading the position directly covers every way of arriving.
    const follow = () => {
      const span = trigger.end - trigger.start;
      target = span > 0 ? Math.min(1, Math.max(0, (window.scrollY - trigger.start) / span)) : 0;
      start();
    };
    window.addEventListener("scroll", follow, { passive: true });

    // "Nossa visão" links: the sections live inside a pin, so a plain hash would
    // land before the reveal. Send them to where the Eco headline is fully in.
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest('a[href="#visao"]');
      if (!link) return;

      event.preventDefault();
      scrollTo(trigger.start + (trigger.end - trigger.start) * beats.manifestoAt(ANCHOR_PROGRESS));
    };
    document.addEventListener("click", onClick);

    // The arrows and dots of the stories: each voice sits at a known point of the
    // scroll, so choosing one is scrolling there.
    const onSeek = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest<HTMLElement>("[data-pf-seek]");
      if (!button) return;

      const current = Number(stage.querySelector('[data-pf="root"]')?.getAttribute("data-index") ?? 0);
      const wanted = button.dataset.pfSeek;
      const voice =
        wanted === "next" ? current + 1 : wanted === "prev" ? current - 1 : Number(wanted);
      const at = VOICE_AT[Math.min(VOICE_AT.length - 1, Math.max(0, voice))];

      scrollTo(trigger.start + (trigger.end - trigger.start) * beats.proofAt(at));
    };
    document.addEventListener("click", onSeek);

    // The footer's links: the sections live inside the pin, so a
    // plain hash would land before their reveal. Each name is a moment of the scroll.
    const onGoto = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLElement>("[data-goto]");
      if (!link) return;

      event.preventDefault();
      const name = link.dataset.goto;
      scrollTo(trigger.start + (trigger.end - trigger.start) * beats.anchor(name as Anchor));
    };
    document.addEventListener("click", onGoto);

    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) ScrollTrigger.refresh();
    });

    return () => {
      cancelled = true;
      document.removeEventListener("click", onClick);
      document.removeEventListener("click", onSeek);
      document.removeEventListener("click", onGoto);
      window.removeEventListener("scroll", follow);
      visibility.disconnect();
      stage.classList.remove("stage--offscreen");
      stop();
      trigger.kill(true);
      release();
    };
  }, [ready, staticMode, stageRef, onCover, scrollTo]);

  return (
    <>
      <Manifesto staticMode={staticMode} covered={covered} handoff={methodActive} />
      <Method
        staticMode={staticMode}
        active={methodActive}
        opened={opened}
        track={<SolutionsTrack staticMode={staticMode} />}
        covered={pgrssOpen}
      />
      <Pgrss staticMode={staticMode} open={pgrssOpen} covered={yuriOpen} />
      <Yuri staticMode={staticMode} open={yuriOpen} covered={proofOpen} />
      <Proof staticMode={staticMode} open={proofOpen} covered={ctaOpen} />
      <Cta staticMode={staticMode} open={ctaOpen} />
    </>
  );
}
