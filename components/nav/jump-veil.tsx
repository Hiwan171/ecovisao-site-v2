import type { RefObject } from "react";
import "./jump-veil.css";

/**
 * The disc jump-veil.ts paints. Lives outside `.stage` (like the progress bar)
 * so it stays fixed over the whole page, pinned section or not.
 */
export function JumpVeil({ rootRef }: { rootRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div className="jv" data-jv="root" ref={rootRef} aria-hidden="true">
      <svg className="jv__svg">
        <path data-jv="fill" fillRule="evenodd" />
        <circle className="jv__ring" data-jv="ring" />
        <circle className="jv__ring" data-jv="ring" />
        <circle className="jv__seed" data-jv="seed" />
      </svg>
    </div>
  );
}
