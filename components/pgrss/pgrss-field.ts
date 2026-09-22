/**
 * The particle field of the PGRSS section: waste in motion. A few hundred points fall
 * gather in a funnel, cross a line (the segregation) and are sorted into four lanes, one
 * per group of health-service waste; later the lanes bend towards a single point.
 *
 * Like every engine on this page, where a particle is at any instant is a pure
 * function of the parameters it is handed (`sorted`, `converge`, ...) and the clock,
 * so scrolling back plays it backwards. The one thing that is stateful is the
 * pointer's push, and it only ever nudges a particle around the place the function
 * puts it.
 *
 * Everything is batched into one path per group and drawn with additive blending:
 * a few hundred particles cost a handful of fill calls per frame, not a few hundred.
 */

export const LANES = 4;

type Shape = "dot" | "diamond" | "square" | "triangle";

/**
 * The groups of Resolução RDC 222/2018 (ANVISA) that Ecovisão works with, in the
 * brand's own colours. The letters are the resolution's: group C (radioactive) is not
 * part of the work, so it is not drawn.
 */
export const GROUPS: readonly { code: string; name: string; color: string; shape: Shape }[] = [
  { code: "A", name: "Biológico", color: "#7ecf43", shape: "dot" },
  { code: "B", name: "Químico", color: "#ffa013", shape: "diamond" },
  { code: "D", name: "Comum", color: "#b8eda3", shape: "square" },
  { code: "E", name: "Perfurocortante", color: "#ffd27a", shape: "triangle" },
];

export type FieldFrame = {
  /** Seconds. Only the drift and the falling use it. */
  time: number;
  /** 0 = everything mixed, 1 = every particle in its lane. */
  sorted: number;
  /** 0 = the lanes, 1 = one stream. */
  converge: number;
  /** 0..1: how visible the unsorted cloud is. */
  cloud: number;
  /** Y of the segregation line and of where the streams end, in CSS px. */
  gate: number;
  bin: number;
};

export type Field = {
  resize: (width: number, height: number) => void;
  draw: (frame: FieldFrame) => void;
  /** CSS px relative to the canvas, or null when the pointer has left. */
  pointer: (x: number, y: number) => void;
  release: () => void;
  destroy: () => void;
};

const TAU = Math.PI * 2;
/** Falls per second: a particle takes a little over ten seconds to cross the screen. */
const RATE = 0.088;
const PUSH_RADIUS = 96;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A small seeded generator: the layout has to be the same on every visit and every render. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createField(canvas: HTMLCanvasElement): Field {
  const context = canvas.getContext("2d");
  if (!context) {
    return { resize() {}, draw() {}, pointer() {}, release() {}, destroy() {} };
  }
  const ctx: CanvasRenderingContext2D = context;

  let width = 1;
  let height = 1;
  let ratio = 1;
  let count = 0;

  // One entry per particle. Typed arrays: no allocation, and no garbage, per frame.
  let lane = new Uint8Array(0);
  let phase = new Float32Array(0);
  let speed = new Float32Array(0);
  let spreadX = new Float32Array(0);
  let laneX = new Float32Array(0);
  let size = new Float32Array(0);
  let sway = new Float32Array(0);
  // 1 for the few that are already in view at the top; the rest only show near the funnel.
  let early = new Uint8Array(0);
  // The pointer's push: an offset that springs back.
  let ox = new Float32Array(0);
  let oy = new Float32Array(0);
  let vx = new Float32Array(0);
  let vy = new Float32Array(0);

  let pointerX = -1e4;
  let pointerY = -1e4;
  let lastTime = 0;

  function populate(next: number) {
    if (next === count) return;
    count = next;

    const random = seeded(0x5eed);
    lane = new Uint8Array(count);
    phase = new Float32Array(count);
    speed = new Float32Array(count);
    spreadX = new Float32Array(count);
    laneX = new Float32Array(count);
    size = new Float32Array(count);
    sway = new Float32Array(count);
    early = new Uint8Array(count);
    ox = new Float32Array(count);
    oy = new Float32Array(count);
    vx = new Float32Array(count);
    vy = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Lanes are handed out in turn, so every lane holds the same share at any height.
      lane[i] = i % LANES;
      phase[i] = random();
      speed[i] = 0.78 + random() * 0.5;
      spreadX[i] = random() + random() - 1;
      laneX[i] = random() - 0.5;
      size[i] = 1.5 + random() * 1.9;
      sway[i] = random() * TAU;
      early[i] = random() < 0.1 ? 1 : 0;
    }
  }

  function resize(nextWidth: number, nextHeight: number) {
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    ratio = Math.min(2, window.devicePixelRatio || 1);

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Density follows the area, so a phone is not asked to draw a desktop's worth.
    populate(Math.round(Math.min(900, Math.max(320, (width * height) / 1500))));
  }

  function draw(frame: FieldFrame) {
    const { time, sorted, converge, cloud, gate, bin } = frame;
    const dt = Math.min(0.05, Math.max(0.001, time - lastTime || 0.016));
    lastTime = time;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";

    const top = -14;
    const span = Math.max(1, bin - top);
    const gateAt = clamp01((gate - top) / span);
    const laneWidth = width / LANES;
    // The cloud is wide and sits right of centre, under the giant word.
    const cloudCentre = width * (width < 720 ? 0.5 : lerp(0.64, 0.5, sorted));
    const cloudWidth = width * (width < 720 ? 0.86 : 0.5);
    const centre = width * 0.5;
    const pushing = pointerX > -1e3;

    // One path per group, plus the neutral one.
    const paths = GROUPS.map(() => new Path2D());
    const tails = GROUPS.map(() => new Path2D());
    const neutralBatch = new Path2D();

    for (let i = 0; i < count; i++) {
      const u = (phase[i] + time * RATE * speed[i]) % 1;
      const y = top + span * u;

      const beforeGate = clamp01(u / gateAt);
      const funnel = smooth(beforeGate);
      const mixedX =
        cloudCentre + spreadX[i] * cloudWidth * lerp(1, 0.46, funnel) + Math.sin(time * 0.5 + sway[i]) * width * 0.012;

      const s = sorted * smooth(clamp01((u - gateAt) / 0.14));
      const bend = converge * smooth(clamp01((u - gateAt) / Math.max(0.05, 1 - gateAt)));
      const laneCentre = (lane[i] + 0.5) * laneWidth + laneX[i] * laneWidth * 0.46;
      const target = lerp(laneCentre, centre + laneX[i] * width * 0.04, bend);

      let x = lerp(mixedX, target, s);
      let yy = y;

      // The pointer pushes what it touches; the offset springs back on its own.
      if (pushing) {
        const dx = x + ox[i] - pointerX;
        const dy = yy + oy[i] - pointerY;
        const d = Math.hypot(dx, dy);
        if (d < PUSH_RADIUS && d > 0.01) {
          const force = (1 - d / PUSH_RADIUS) * 900 * dt;
          vx[i] += (dx / d) * force;
          vy[i] += (dy / d) * force;
        }
      }
      vx[i] += -ox[i] * 26 * dt;
      vy[i] += -oy[i] * 26 * dt;
      const damping = Math.exp(-dt * 7);
      vx[i] *= damping;
      vy[i] *= damping;
      ox[i] += vx[i] * dt;
      oy[i] += vy[i] * dt;
      x += ox[i];
      yy += oy[i];

      // Small at the top and at the end, so nothing pops in or out.
      const fade = smooth(clamp01(u / 0.14)) * (1 - smooth(clamp01((u - 0.92) / 0.08)));
      const r = size[i] * fade;
      if (r < 0.15) continue;

      // The top stays quiet, so the words have room: only a few points drift in there,
      // and the rest gather as the funnel narrows towards the line.
      const unsorted = 1 - s;
      const gathered = smooth(clamp01((beforeGate - 0.5) / 0.5));
      const presence = early[i] ? 1 : gathered;
      if (unsorted > 0.02 && presence > 0.02) {
        const rn = r * 0.8 * unsorted * presence;
        neutralBatch.moveTo(x + rn, yy);
        neutralBatch.arc(x, yy, rn, 0, TAU);
      }

      if (s > 0.02) {
        const group = GROUPS[lane[i]];
        const rc = r * (0.6 + 0.8 * s) * smooth(s);
        addToPath(paths[lane[i]], group.shape, x, yy, rc);
        if (s > 0.5) {
          const tail = 6 + r * 4 + (1 - beforeGate) * 8;
          tails[lane[i]].moveTo(x, yy - tail);
          tails[lane[i]].lineTo(x, yy);
        }
      }
    }

    ctx.globalAlpha = 0.36 * cloud;
    ctx.fillStyle = "#f4e4c8";
    ctx.fill(neutralBatch);

    GROUPS.forEach((group, k) => {
      ctx.globalAlpha = 0.26 * smooth(sorted);
      ctx.strokeStyle = group.color;
      ctx.lineWidth = 1;
      ctx.stroke(tails[k]);

      ctx.globalAlpha = 0.95;
      ctx.fillStyle = group.color;
      ctx.fill(paths[k]);
    });

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  return {
    resize,
    draw,
    pointer(x, y) {
      pointerX = x;
      pointerY = y;
    },
    release() {
      pointerX = -1e4;
      pointerY = -1e4;
    },
    destroy() {
      canvas.width = canvas.height = 0;
      canvas.style.width = canvas.style.height = "";
    },
  };
}

/** One mark per group: colour alone would not tell the four apart for everyone. */
function addToPath(path: Path2D, shape: Shape, x: number, y: number, r: number) {
  switch (shape) {
    case "dot":
      path.moveTo(x + r, y);
      path.arc(x, y, r, 0, TAU);
      break;
    case "diamond":
      path.moveTo(x, y - r * 1.35);
      path.lineTo(x + r * 1.05, y);
      path.lineTo(x, y + r * 1.35);
      path.lineTo(x - r * 1.05, y);
      path.closePath();
      break;
    case "square":
      path.rect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8);
      break;
    case "triangle":
      path.moveTo(x, y - r * 1.3);
      path.lineTo(x + r * 1.15, y + r * 0.9);
      path.lineTo(x - r * 1.15, y + r * 0.9);
      path.closePath();
      break;
  }
}
