import * as THREE from "three";

/**
 * The GLB is a canopy and a bole — it has no roots at all, and the model's
 * geometry simply stops at y = 0. This builds them.
 *
 * Roots matter here because the concept rests on them: the tree is the
 * ecosystem, and the opening camera pose looks straight at the base. Without
 * roots the first frame of the site is a stick that ends in mid-air.
 *
 * Everything is generated in the model's own units (before the framing scale is
 * applied) and is fully deterministic — a seeded generator, never Math.random —
 * so a poster captured from the scene matches the scene on the next capture.
 */

type RootPlan = {
  /** Direction the root leaves the trunk, in radians around Y. */
  angle: number;
  /** How far it reaches, in model units. */
  reach: number;
  /** How far it sinks below the base. */
  drop: number;
  /** Radius where it meets the bole. */
  radius: number;
  /** How far up the bole the root emerges. Kept small and independent of
   *  `drop`, or the flare climbs the trunk and reads as a stilt root. */
  lift: number;
  /** Sideways wander, so no two roots read as the same arc mirrored. */
  sway: number;
};

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

/**
 * Locates the bole where it meets the ground by averaging the lowest vertices,
 * and measures how thick it is there. Guessing these instead would leave the
 * roots visibly detached from the trunk.
 */
export function measureTreeBase(root: THREE.Object3D) {
  const bounds = new THREE.Box3().setFromObject(root);
  const cutoff = bounds.min.y + (bounds.max.y - bounds.min.y) * 0.012;

  const vertex = new THREE.Vector3();
  let count = 0;
  let sumX = 0;
  let sumZ = 0;

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const position = child.geometry.getAttribute("position");
    if (!position) return;

    for (let i = 0; i < position.count; i += 1) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld);
      if (vertex.y > cutoff) continue;
      sumX += vertex.x;
      sumZ += vertex.z;
      count += 1;
    }
  });

  const center = count
    ? new THREE.Vector3(sumX / count, bounds.min.y, sumZ / count)
    : new THREE.Vector3(0, bounds.min.y, 0);

  // Second pass for the thickness: the widest low vertex around that centre.
  let radius = 0;
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const position = child.geometry.getAttribute("position");
    if (!position) return;

    for (let i = 0; i < position.count; i += 1) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld);
      if (vertex.y > cutoff) continue;
      radius = Math.max(radius, Math.hypot(vertex.x - center.x, vertex.z - center.z));
    }
  });

  return { center, radius: Math.max(radius, 0.02), height: bounds.max.y - bounds.min.y };
}

function planRoots(baseRadius: number, height: number): RootPlan[] {
  const random = seededRandom(20260825);
  const plans: RootPlan[] = [];

  // Three primaries. The concept reads them as people, process and strategy, so
  // they are the ones that carry weight and reach; the rest is undergrowth.
  // Biased towards ±X: the camera looks down -Z, so roots running across the
  // frame read at full length while ones aimed at the lens just foreshorten.
  // Few and well separated. A dense fan merges into one skirt at this distance;
  // distinct arcs keep each root reading as a line, which is what the section
  // that follows turns them into.
  const primaryAngles = [0.15, 2.94, 4.4];
  primaryAngles.forEach((angle, index) => {
    plans.push({
      angle: angle + (random() - 0.5) * 0.16,
      // Wide spread in length, or three equal arcs read as a symmetrical anchor.
      reach: height * (0.28 + index * 0.06 + random() * 0.09),
      // Staggered depth so the three never lie in one plane.
      drop: height * (0.017 + index * 0.005 + random() * 0.005),
      radius: baseRadius * (0.72 + random() * 0.14),
      lift: baseRadius * (1.3 + random() * 0.5),
      sway: 0.5 + random() * 0.45,
    });
  });

  const secondaryAngles = [1.15, 2.05, 3.75, 5.5];
  secondaryAngles.forEach((angle, index) => {
    plans.push({
      angle: angle + (random() - 0.5) * 0.3,
      reach: height * (0.14 + random() * 0.11),
      drop: height * (0.011 + random() * 0.009),
      radius: baseRadius * (0.3 + random() * 0.16),
      lift: baseRadius * (0.7 + random() * 0.5),
      sway: (index % 2 ? -1 : 1) * (0.4 + random() * 0.5),
    });
  });

  return plans;
}

function rootCurve(base: THREE.Vector3, plan: RootPlan) {
  const dirX = Math.cos(plan.angle);
  const dirZ = Math.sin(plan.angle);
  // Perpendicular, for the lateral wander that keeps the arcs from looking stamped.
  const sideX = -dirZ * plan.sway;
  const sideZ = dirX * plan.sway;

  const at = (along: number, lift: number, side: number) =>
    new THREE.Vector3(
      base.x + dirX * plan.reach * along + sideX * side,
      base.y + lift,
      base.z + dirZ * plan.reach * along + sideZ * side,
    );

  return new THREE.CatmullRomCurve3(
    [
      // Starts just inside the bole so the join is hidden, never far enough up
      // it to read as a collar around the trunk.
      at(0, plan.lift, 0),
      at(0.12, plan.lift * 0.25, 0.1),
      // Dips, levels off, then hooks down at the tip — the S in plan view and
      // the dive in section are what stop these reading as straight spikes.
      at(0.38, -plan.drop * 0.55, 0.62),
      at(0.66, -plan.drop * 0.72, 0.42),
      at(0.87, -plan.drop * 1.02, 0.86),
      at(1, -plan.drop * 1.5, 1),
    ],
    false,
    "catmullrom",
    0.55,
  );
}

/**
 * Thick at the flare, whip-thin at the tip. The extra term near t = 0 is the
 * buttress: real roots swell where they leave the bole instead of starting at
 * trunk width and only shrinking.
 */
function radiusAlong(t: number, startRadius: number) {
  // Holds its thickness through the first half, then falls away — a sharper
  // early taper is what makes a root look like a thorn.
  const taper = Math.pow(1 - t, 1.4) * 0.96 + 0.04;
  const buttress = 1 + 0.42 * Math.exp(-Math.pow(t / 0.12, 2));
  return startRadius * taper * buttress;
}

export function buildRootGeometry(base: THREE.Vector3, baseRadius: number, height: number) {
  const plans = planRoots(baseRadius, height);
  const segments = 22;
  const radial = 6;

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const offset = new THREE.Vector3();

  plans.forEach((plan) => {
    const curve = rootCurve(base, plan);
    const frames = curve.computeFrenetFrames(segments, false);
    const vertexStart = positions.length / 3;

    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      curve.getPointAt(t, point);
      const radius = radiusAlong(t, plan.radius);

      for (let j = 0; j <= radial; j += 1) {
        const angle = (j / radial) * Math.PI * 2;
        normal
          .copy(frames.normals[i])
          .multiplyScalar(Math.cos(angle))
          .add(offset.copy(frames.binormals[i]).multiplyScalar(Math.sin(angle)))
          .normalize();

        positions.push(
          point.x + normal.x * radius,
          point.y + normal.y * radius,
          point.z + normal.z * radius,
        );
        normals.push(normal.x, normal.y, normal.z);
      }
    }

    const ring = radial + 1;
    for (let i = 0; i < segments; i += 1) {
      for (let j = 0; j < radial; j += 1) {
        const a = vertexStart + i * ring + j;
        const b = a + ring;
        // Wound so the face normal is +n (outward). With the tangent-first
        // order the cross product lands on -n and every tube renders inside-out,
        // which reads as flat webbing rather than volume.
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  return geometry;
}
