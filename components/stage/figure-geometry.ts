import type { CrownPosition } from "../hero/hero-scene";

/**
 * Geometry shared by every section that grows out of the tree's crown. The wipe,
 * the rings, the iris and the lens all hang off the same centre and the same unit,
 * which is what makes them read as one gesture instead of separate effects.
 */
export type FigureGeometry = {
  /** Stage (the pinned box, hero-sized) and figure (bottom-aligned frame) sizes. */
  stageWidth: number;
  stageHeight: number;
  width: number;
  height: number;
  /** The crown, in stage pixels. This is where the wipe is born. */
  originX: number;
  originY: number;
  /** The same point in frame pixels; the figure is centred here. */
  cx: number;
  cy: number;
  /** Unit that orbit and map radii are fractions of. */
  unit: number;
  /** Distance from the crown to the farthest stage corner. */
  maxRadius: number;
  mobile: boolean;
};

/**
 * `outer` is the largest orbit of the first figure, as a fraction of the unit.
 * On desktop its label has to fit beside its node, which bounds the unit; phones
 * put labels inward and can use the width.
 */
export function measureFigure(
  stage: HTMLElement,
  frame: Element,
  crown: CrownPosition,
  staticMode: boolean,
  outer: number,
): FigureGeometry {
  const stageWidth = stage.clientWidth;
  const stageHeight = stage.clientHeight;
  const bounds = frame.getBoundingClientRect();
  const width = bounds.width || stageWidth;
  const height = bounds.height || stageHeight;
  const mobile = width < 768;

  // The frame is bottom-aligned inside a stage that can be taller than the
  // viewport, so the crown's stage position needs shifting into frame space.
  const originX = crown.x * stageWidth;
  const originY = crown.y * stageHeight;
  const cx = staticMode ? width / 2 : originX;
  const cy = staticMode ? height / 2 : originY - (stageHeight - height);

  const fitRight = (width - cx - 112) / outer;
  const unit = staticMode
    ? Math.min(width, height) * 0.9
    : mobile
      ? Math.min(width * 0.95, (Math.min(cx, width - cx) - 14) / outer)
      : Math.min(width * 0.5, height, fitRight);

  const maxRadius =
    Math.max(
      Math.hypot(originX, originY),
      Math.hypot(stageWidth - originX, originY),
      Math.hypot(originX, stageHeight - originY),
      Math.hypot(stageWidth - originX, stageHeight - originY),
    ) + 8;

  return {
    stageWidth,
    stageHeight,
    width,
    height,
    originX,
    originY,
    cx,
    cy,
    unit: Math.max(unit, 120),
    maxRadius,
    mobile,
  };
}
