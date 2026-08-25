"use client";

import { useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { buildRootGeometry, measureTreeBase } from "./tree-roots";

type HeroSceneProps = {
  active: boolean;
  reducedMotion: boolean;
  /** True once the loader has handed off, which is what starts the camera rise. */
  revealed: boolean;
  onReady: () => void;
  onUnavailable: () => void;
};

type TreeProps = Pick<HeroSceneProps, "reducedMotion" | "onReady">;

const TREE_PATH = "/models/ecovisao-tree.glb";

const CAMERA_DISTANCE = 7.2;
const CAMERA_FOV = 31;
const CAMERA_Y = 0.2;

const HALF_FOV_TANGENT = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV) / 2);

/**
 * Three camera poses drive the whole shot.
 *
 * `ENTRANCE` sits low and close, framing the bole: the first thing the page
 * shows is the root end. It rises to `REST` — the pose every framing constant
 * below is measured against — over ENTRANCE_MS. Scrolling then carries it on to
 * `SCROLLED`, where the crown fills the frame. Root, structure, growth.
 */
const CAMERA_REST = { y: CAMERA_Y, z: CAMERA_DISTANCE };
const ENTRANCE_MS = 2600;

/**
 * Beat held at the low pose before the climb starts. Without it the camera is
 * already rising while the tree is still fading in, and the roots — the whole
 * point of starting down there — are gone before they are legible.
 */
const ENTRANCE_HOLD_MS = 850;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Half of the world-space height the camera sees `depth` units in front of the
 * z = 0 plane. Framing is derived from this instead of hard-coded per
 * breakpoint, and measuring at the canopy's near face is what stops the widest
 * leaves — the ones perspective pushes outwards — from being sliced by the edge.
 */
function viewHalfHeightAt(depth: number) {
  return HALF_FOV_TANGENT * (CAMERA_DISTANCE - depth);
}

/**
 * Framing per breakpoint. `height` is the tree's world height, `headroom` the
 * gap left above the crown, and the offsets bound how far right the tree parks.
 */
const DESKTOP_FRAME = {
  height: 4.15,
  headroom: 0.62,
  edgeMargin: 0.18,
  minOffsetX: 0.5,
  maxOffsetX: 1.85,
  entrance: { y: -1.85, z: 6.5 },
  scrolled: { y: 1.05, z: 5.2 },
};

// A phone frames the tree much lower, so it needs a shallower entrance: the
// desktop one would swing the canopy straight up behind the headline.
const MOBILE_FRAME = {
  height: 3.1,
  headroom: 2.04,
  edgeMargin: 0.05,
  minOffsetX: -0.06,
  maxOffsetX: 0.5,
  entrance: { y: -0.6, z: 7 },
  scrolled: { y: 0.72, z: 6.05 },
};

// The GLB ships with its palette baked into baseColorFactor, which renders as a
// generic nursery green. Re-grading the four materials keeps the tree inside the
// brand range and matte enough to read as a sculpture rather than a stock asset.
const MATERIAL_GRADE: Record<
  string,
  { color: string; roughness: number; emissive?: string; emissiveIntensity?: number }
> = {
  "Bark — Forest Umber": { color: "#33200f", roughness: 0.97 },
  "Leaves — Deep Forest": { color: "#0a2d18", roughness: 1 },
  "Leaves — Ecovisao": { color: "#19542e", roughness: 0.99 },
  "Leaves — New Growth": {
    color: "#4d8a3a",
    roughness: 0.97,
    emissive: "#7ecf43",
    emissiveIntensity: 0.04,
  },
};

function Tree({ reducedMotion, onReady }: TreeProps) {
  const source = useGLTF(TREE_PATH, "/draco/");
  const groupRef = useRef<THREE.Group>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const size = useThree((state) => state.size);
  const isMobile = size.width < 768;
  const aspect = size.width / Math.max(size.height, 1);

  const { tree, treeHalfWidth, treeHalfDepth } = useMemo(() => {
    const clone = source.scene.clone(true);
    const bounds = new THREE.Box3().setFromObject(clone);
    const dimensions = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const targetHeight = isMobile ? MOBILE_FRAME.height : DESKTOP_FRAME.height;
    const scale = targetHeight / Math.max(dimensions.y, 0.001);

    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.frustumCulled = true;

      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return;

        const grade = MATERIAL_GRADE[material.name];
        if (grade) {
          material.color.set(grade.color);
          material.roughness = grade.roughness;
          if (grade.emissive) {
            material.emissive.set(grade.emissive);
            material.emissiveIntensity = grade.emissiveIntensity ?? 0.05;
          }
        } else {
          material.roughness = Math.max(material.roughness, 0.85);
        }

        material.metalness = 0;
        material.needsUpdate = true;
      });
    });

    // Roots are generated in the model's own units and parented to the clone, so
    // they inherit the framing transform and never influence the bounds the
    // framing was measured from. Phones never see the base, so they never pay
    // for the geometry.
    if (!isMobile) {
      const { center: baseCenter, radius: baseRadius, height } = measureTreeBase(clone);
      // Almost silhouette on purpose. Lit like the bole, the near-horizontal
      // faces catch the green sky term and read as a skirt; kept this dark, only
      // the lime rim survives — a bright line along each root.
      const roots = new THREE.Mesh(
        buildRootGeometry(baseCenter, baseRadius, height),
        new THREE.MeshStandardMaterial({
          color: "#241607",
          roughness: 1,
          metalness: 0,
        }),
      );
      roots.name = "Ecovisao_Roots";
      clone.add(roots);
    }

    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);

    return {
      tree: clone,
      treeHalfWidth: (dimensions.x * scale) / 2,
      treeHalfDepth: (dimensions.z * scale) / 2,
    };
  }, [isMobile, source.scene]);

  // Keep the crown inside the frame at every aspect ratio: park the tree as far
  // right as the viewport allows, then fall back to centre-right on narrow ones.
  const { offsetX, offsetY } = useMemo(() => {
    const frame = isMobile ? MOBILE_FRAME : DESKTOP_FRAME;
    const viewHalfWidth = viewHalfHeightAt(treeHalfDepth) * aspect;
    const maxOffset = viewHalfWidth - treeHalfWidth - frame.edgeMargin;

    return {
      offsetX: THREE.MathUtils.clamp(maxOffset, frame.minOffsetX, frame.maxOffsetX),
      // Anchor the crown below the header; the bare bole runs off the bottom of
      // the frame and the veil dissolves it into the page.
      offsetY:
        viewHalfHeightAt(treeHalfDepth) + CAMERA_Y - frame.height - frame.headroom,
    };
  }, [aspect, isMobile, treeHalfDepth, treeHalfWidth]);

  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(onReady);
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [tree, onReady]);

  useEffect(() => {
    if (reducedMotion || isMobile) return;

    const updatePointer = (event: PointerEvent) => {
      pointerRef.current.x = (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
      pointerRef.current.y = -(event.clientY / Math.max(window.innerHeight, 1)) * 2 + 1;
    };

    window.addEventListener("pointermove", updatePointer, { passive: true });
    return () => window.removeEventListener("pointermove", updatePointer);
  }, [isMobile, reducedMotion]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    // Scroll is the camera's job now; the tree only answers the pointer and sways.
    const targetX = reducedMotion || isMobile ? 0 : pointerRef.current.y * 0.03;
    const targetY = reducedMotion || isMobile ? -0.07 : pointerRef.current.x * 0.042 - 0.07;
    const damping = 1 - Math.exp(-delta * 2.8);

    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, targetX, damping);
    group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, targetY, damping);
    group.position.y = THREE.MathUtils.lerp(group.position.y, offsetY, damping);
    group.position.x = THREE.MathUtils.lerp(group.position.x, offsetX, damping);

    if (!reducedMotion && !isMobile) {
      // Two slow frequencies so the sway never lands on an obvious loop.
      const t = state.clock.elapsedTime;
      group.rotation.z = Math.sin(t * 0.34) * 0.0055 + Math.sin(t * 0.71 + 1.3) * 0.0022;
    }
  });

  return (
    <group ref={groupRef} position={[offsetX, offsetY, 0]} rotation={[0, -0.07, 0]}>
      <primitive object={tree} />
    </group>
  );
}

/**
 * Owns every camera move: the timed rise out of ENTRANCE after the loader hands
 * off, and the scroll-linked climb into the canopy. Scroll is read, never
 * hijacked — the page keeps its own scrolling.
 */
function CameraRig({
  active,
  revealed,
  reducedMotion,
}: Pick<HeroSceneProps, "active" | "revealed" | "reducedMotion">) {
  const invalidate = useThree((state) => state.invalidate);
  const width = useThree((state) => state.size.width);
  const frame = width < 768 ? MOBILE_FRAME : DESKTOP_FRAME;
  const revealedAt = useRef<number | null>(null);
  const scrollRef = useRef(0);

  useEffect(() => {
    if (revealed && revealedAt.current === null) {
      revealedAt.current = performance.now();
      invalidate();
    }
  }, [invalidate, revealed]);

  useEffect(() => {
    const readScroll = () => {
      scrollRef.current = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1);
    };

    readScroll();
    window.addEventListener("scroll", readScroll, { passive: true });
    return () => window.removeEventListener("scroll", readScroll);
  }, []);

  useFrame((state, delta) => {
    if (!active) return;

    const { camera } = state;

    const startedAt = revealedAt.current;
    const entrance =
      reducedMotion || startedAt === null
        ? Number(reducedMotion)
        : easeInOutCubic(
            THREE.MathUtils.clamp(
              (performance.now() - startedAt - ENTRANCE_HOLD_MS) / ENTRANCE_MS,
              0,
              1,
            ),
          );

    const scroll = reducedMotion ? 0 : scrollRef.current;

    const baseY = THREE.MathUtils.lerp(frame.entrance.y, CAMERA_REST.y, entrance);
    const baseZ = THREE.MathUtils.lerp(frame.entrance.z, CAMERA_REST.z, entrance);
    const targetY = THREE.MathUtils.lerp(baseY, frame.scrolled.y, scroll);
    const targetZ = THREE.MathUtils.lerp(baseZ, frame.scrolled.z, scroll);

    const damping = 1 - Math.exp(-delta * 5.2);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, damping);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, damping);

    // R3F aims the camera at the origin when it is created. Born low, it would
    // keep that upward tilt for the whole move and every framing constant here
    // assumes a level camera, so this is a pure crane: translate, never pitch.
    camera.rotation.set(0, 0, 0);

    // In demand mode nothing else asks for the next frame, so drive the rise
    // until both the entrance and the damping have actually settled.
    const settled =
      entrance >= 1 &&
      Math.abs(camera.position.y - targetY) < 0.001 &&
      Math.abs(camera.position.z - targetZ) < 0.001;
    if (!settled) state.invalidate();
  });

  return null;
}

function RenderPolicy({ active, reducedMotion }: Pick<HeroSceneProps, "active" | "reducedMotion">) {
  const width = useThree((state) => state.size.width);
  const invalidate = useThree((state) => state.invalidate);
  const setFrameloop = useThree((state) => state.setFrameloop);
  const useDemand = reducedMotion || width < 768;

  useEffect(() => {
    setFrameloop(active ? (useDemand ? "demand" : "always") : "never");
    if (active) invalidate();
  }, [active, invalidate, setFrameloop, useDemand]);

  useEffect(() => {
    if (!active || !useDemand) return;

    const renderNextFrame = () => invalidate();
    window.addEventListener("scroll", renderNextFrame, { passive: true });
    return () => window.removeEventListener("scroll", renderNextFrame);
  }, [active, invalidate, useDemand]);

  return null;
}

export function HeroScene({
  active,
  reducedMotion,
  revealed,
  onReady,
  onUnavailable,
}: HeroSceneProps) {
  return (
    <Canvas
      className="hero-scene"
      aria-hidden="true"
      camera={{
        position: [0, DESKTOP_FRAME.entrance.y, DESKTOP_FRAME.entrance.z],
        fov: CAMERA_FOV,
        near: 0.1,
        far: 100,
      }}
      dpr={[1, 1.5]}
      frameloop="always"
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.04;
        gl.outputColorSpace = THREE.SRGBColorSpace;

        gl.domElement.addEventListener(
          "webglcontextlost",
          (event) => {
            event.preventDefault();
            onUnavailable();
          },
          { once: true },
        );
      }}
    >
      {/* Kept low so the key light — not the ambient — models the canopy. */}
      <hemisphereLight args={["#c6dcb4", "#06180d", 0.62]} />
      <ambientLight intensity={0.22} color="#8fb69a" />
      {/* Warm key from the headline side, high enough to shadow the underside. */}
      <directionalLight color="#ffeaca" intensity={4.2} position={[-4.5, 7.5, 4]} />
      {/* Lime rim from behind-right carves the silhouette out of the background. */}
      <directionalLight color="#8fdc4d" intensity={3.4} position={[6, 2.4, -5.5]} />
      {/* Cool bounce so the shaded half reads forest green instead of black. */}
      <directionalLight color="#2f6b45" intensity={0.9} position={[-3, -2.5, 2]} />
      <pointLight color="#ffa013" intensity={0.5} position={[1.2, -1.6, 2.8]} distance={8} />
      <RenderPolicy active={active} reducedMotion={reducedMotion} />
      <CameraRig active={active} revealed={revealed} reducedMotion={reducedMotion} />
      <Tree reducedMotion={reducedMotion} onReady={onReady} />
    </Canvas>
  );
}

useGLTF.preload(TREE_PATH, "/draco/");
