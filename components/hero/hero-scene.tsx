"use client";

import { useGLTF, useProgress } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

/** Where the crown sits in the canvas, as fractions of its width and height. */
export type CrownPosition = { x: number; y: number };

type HeroSceneProps = {
  active: boolean;
  onReady: () => void;
  onUnavailable: () => void;
  onFraming: (crown: CrownPosition) => void;
  /** How much of what the scene needs has arrived, 0..100. The loader shows it. */
  onProgress: (progress: number) => void;
};

const TREE_PATH = "/models/ecovisao-tree.glb";

const CAMERA_DISTANCE = 7.2;
const CAMERA_FOV = 31;
const CAMERA_Y = 0.2;

/** Fixed yaw, so the crown is a little off-axis instead of dead flat. */
const TREE_YAW = -0.07;

const HALF_FOV_TANGENT = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV) / 2);

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
 * Where the visual mass of the crown sits, used to hand its screen position to
 * whatever wants to grow out of it. Three quarters of the way up the tree, and a
 * little in front of the trunk's axis because the near leaves carry the weight.
 */
const CROWN_HEIGHT_FRACTION = 0.75;
const CROWN_DEPTH = 0.5;

/**
 * Framing per breakpoint. `height` is the tree's world height, `headroom` the
 * gap left above the crown, and the offsets bound how far right the tree parks:
 * as far as the viewport allows, in the space beside the copy.
 */
const DESKTOP_FRAME = {
  height: 4.15,
  headroom: 0.62,
  edgeMargin: 0.18,
  minOffsetX: 0.5,
  maxOffsetX: 1.85,
};

// A phone has no room beside the copy, so the tree sits under it instead.
const MOBILE_FRAME = {
  height: 3.1,
  headroom: 2.04,
  edgeMargin: 0.05,
  minOffsetX: -0.06,
  maxOffsetX: 0.5,
};

// The GLB ships with its palette baked into baseColorFactor, which renders as a
// generic nursery green. Re-grading the four materials keeps the tree inside the
// brand range. Roughness stays low enough for the lights to leave specular
// highlights on the leaves — fully matte reads as flat, not as a 3D object.
const MATERIAL_GRADE: Record<
  string,
  {
    color: string;
    roughness: number;
    sheen?: string;
    emissive?: string;
    emissiveIntensity?: number;
  }
> = {
  "Bark — Forest Umber": { color: "#3b2513", roughness: 0.8 },
  "Leaves — Deep Forest": { color: "#0e3d20", roughness: 0.62, sheen: "#5fae55" },
  "Leaves — Ecovisao": { color: "#1f6b3a", roughness: 0.58, sheen: "#7cc45a" },
  "Leaves — New Growth": {
    color: "#5aa63f",
    roughness: 0.54,
    sheen: "#b5ec6d",
    emissive: "#7ecf43",
    emissiveIntensity: 0.05,
  },
};

/**
 * Wind, done in the vertex shader so 170k leaf vertices cost nothing on the CPU.
 * The model is a single mesh with an identity transform, so `position` is in the
 * model's own units: the trunk starts at y = 0 and the crown spans y ≈ 2.5–5.
 *
 * Two layers. A slow gust bends the whole crown, weighted by height so the trunk
 * stays put; it is a smooth function of position, so bark and the leaves on it
 * move together and nothing detaches. On top, a faster flutter whose phase is
 * hashed from position, so neighbouring leaves are never in step.
 */
const WIND_GLSL = /* glsl */ `
  float crown = smoothstep(2.3, 5.0, position.y);
  crown *= crown;

  float gust = sin(uTime * 0.9 + position.x * 1.1 + position.z * 0.8) * 0.6
             + sin(uTime * 0.55 + position.z * 1.7 - position.y * 0.7) * 0.4;
  transformed.x += gust * 0.07 * crown;
  transformed.z += sin(uTime * 0.7 + position.x * 0.9) * 0.035 * crown;
  transformed.y -= abs(gust) * 0.012 * crown;

  vec3 flutter = vec3(
    sin(uTime * 2.6 + dot(position, vec3(5.1, 4.3, 4.7))),
    sin(uTime * 3.1 + dot(position, vec3(3.7, 6.3, 3.9))),
    sin(uTime * 2.2 + dot(position, vec3(4.3, 3.1, 6.7)))
  );
  transformed += flutter * uFlutter * (0.35 + 0.65 * crown);
`;

/**
 * Volume for the canopy. The leaves are flat cards with no baked occlusion, so a
 * lit crown reads as one even lime. Darken what would sit in shade — leaves deep
 * inside the crown and underneath it — and let the outer, upper ones keep the
 * full colour. Uses the rest position, so the shading stays put as leaves move.
 */
const SHADE_GLSL = /* glsl */ `
  float inner = smoothstep(0.2, 1.05, length(vRest - vec3(0.0, 3.75, 0.0)) / 1.75);
  float low = smoothstep(2.5, 4.7, vRest.y);
  diffuseColor.rgb *= mix(1.0, mix(0.36, 1.08, inner) * mix(0.72, 1.06, low), uShade);
`;

/** `flutter` is the leaf jitter amplitude; `shade` is 1 for leaves, 0 for bark. */
function applyTreeShader(material: THREE.Material, flutter: number, shade: number) {
  material.onBeforeCompile = (shader) => {
    // A getter, so three re-reads the clock on every draw and nothing has to push
    // the time in from JS each frame.
    shader.uniforms.uTime = {
      get value() {
        return performance.now() / 1000;
      },
    };
    shader.uniforms.uFlutter = { value: flutter };
    shader.uniforms.uShade = { value: shade };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uTime;\nuniform float uFlutter;\nvarying vec3 vRest;",
      )
      .replace("#include <begin_vertex>", `#include <begin_vertex>\nvRest = position;\n${WIND_GLSL}`);

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uShade;\nvarying vec3 vRest;",
      )
      .replace("#include <color_fragment>", `#include <color_fragment>\n${SHADE_GLSL}`);
  };
  // Every material shares one patched program; the amounts are uniforms.
  material.customProgramCacheKey = () => "ecovisao-tree";
}

function Tree({ onReady, onFraming }: Pick<HeroSceneProps, "onReady" | "onFraming">) {
  const source = useGLTF(TREE_PATH, "/draco/");
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
          if (grade.sheen && material instanceof THREE.MeshPhysicalMaterial) {
            material.sheen = 0.4;
            material.sheenColor.set(grade.sheen);
            material.sheenRoughness = 0.45;
          }
        } else {
          material.roughness = Math.max(material.roughness, 0.85);
        }

        material.metalness = 0;
        const isLeaf = material.name.startsWith("Leaves");
        applyTreeShader(material, isLeaf ? 0.017 : 0, isLeaf ? 1 : 0);
        material.needsUpdate = true;
      });
    });

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
    const frame = isMobile ? MOBILE_FRAME : DESKTOP_FRAME;
    const halfHeight = viewHalfHeightAt(CROWN_DEPTH);
    const crownY = offsetY + CROWN_HEIGHT_FRACTION * frame.height;

    onFraming({
      x: 0.5 + offsetX / (2 * halfHeight * aspect),
      y: 0.5 - (crownY - CAMERA_Y) / (2 * halfHeight),
    });
  }, [aspect, isMobile, offsetX, offsetY, onFraming]);

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

  return (
    <group position={[offsetX, offsetY, 0]} rotation={[0, TREE_YAW, 0]}>
      <primitive object={tree} />
    </group>
  );
}

/**
 * Renders continuously while the hero is on screen, because the leaves never
 * stop moving, and stops entirely once it scrolls away. The pixel ratio is
 * capped lower on phones, where fill rate is the constraint.
 */
function RenderPolicy({ active }: Pick<HeroSceneProps, "active">) {
  const width = useThree((state) => state.size.width);
  const setFrameloop = useThree((state) => state.setFrameloop);
  const setDpr = useThree((state) => state.setDpr);

  useEffect(() => {
    setFrameloop(active ? "always" : "never");
  }, [active, setFrameloop]);

  useEffect(() => {
    setDpr(Math.min(window.devicePixelRatio, width < 768 ? 1.5 : 2));
  }, [setDpr, width]);

  return null;
}

/**
 * Reports the loading progress of the scene's assets. It lives here, and not in the
 * loader, so that three and drei stay out of the page's first script: the loader is on
 * screen long before either is needed.
 */
function Progress({ onProgress }: Pick<HeroSceneProps, "onProgress">) {
  const { progress } = useProgress();

  useEffect(() => {
    onProgress(progress);
  }, [progress, onProgress]);

  return null;
}

export function HeroScene({ active, onReady, onUnavailable, onFraming, onProgress }: HeroSceneProps) {
  return (
    <Canvas
      className="hero-scene"
      aria-hidden="true"
      // An explicit rotation stops R3F from aiming the camera at the origin,
      // which would tilt it down; every framing constant here assumes it level.
      camera={{
        position: [0, CAMERA_Y, CAMERA_DISTANCE],
        rotation: [0, 0, 0],
        fov: CAMERA_FOV,
        near: 0.1,
        far: 100,
      }}
      dpr={[1, 2]}
      frameloop="always"
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        // Neutral keeps the leaf greens saturated; ACES pulls them towards grey.
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1.05;
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
      <Progress onProgress={onProgress} />
      <RenderPolicy active={active} />
      <Tree onReady={onReady} onFraming={onFraming} />
    </Canvas>
  );
}

useGLTF.preload(TREE_PATH, "/draco/");
