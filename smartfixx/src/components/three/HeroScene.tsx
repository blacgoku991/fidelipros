import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import * as THREE from "three";
import { CoreObject } from "./CoreObject";
import { ParticleField } from "./ParticleField";
import { useIsMobile, useLowPower, usePrefersReducedMotion } from "@/hooks/useEnvironment";

/** Dollies the camera back and drifts it sideways as the hero scrolls away. */
function CameraRig({ pointer }: { pointer: THREE.Vector2 }) {
  const { camera, size } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 5.4));

  useFrame((_, delta) => {
    const step = Math.min(delta, 1 / 30);
    const progress = Math.min(1, window.scrollY / Math.max(1, window.innerHeight));

    // The FOV is vertical, so a portrait viewport crops the scene horizontally.
    // Pull the camera back proportionally to keep the framing stable.
    const aspect = size.width / Math.max(1, size.height);
    const portraitPullback = aspect < 1 ? 1 / aspect : 1;

    target.current.set(
      pointer.x * 0.42,
      pointer.y * 0.28 + progress * 0.9,
      (5.4 + progress * 2.6) * portraitPullback,
    );

    camera.position.lerp(target.current, 1 - Math.pow(0.008, step));
    camera.lookAt(0, 0, 0);
  });

  return null;
}

export function HeroScene() {
  const pointer = useMemo(() => new THREE.Vector2(), []);
  const lowPower = useLowPower();
  const reduced = usePrefersReducedMotion();
  const isMobile = useIsMobile();

  // Fade against viewport height, not document height — the page is long and a
  // percentage of total scroll would keep the canvas alive for several sections.
  const [foldHeight, setFoldHeight] = useState(() =>
    typeof window === "undefined" ? 900 : window.innerHeight,
  );
  useEffect(() => {
    const onResize = () => setFoldHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, foldHeight * 0.55, foldHeight * 0.95], [1, 0.7, 0]);

  // Stop rendering entirely once the canvas is invisible.
  const [inFold, setInFold] = useState(true);
  useMotionValueEvent(scrollY, "change", (latest) => {
    const visible = latest < foldHeight;
    setInFold((current) => (current === visible ? current : visible));
  });

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      pointer.set(
        (event.clientX / window.innerWidth) * 2 - 1,
        -((event.clientY / window.innerHeight) * 2 - 1),
      );
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [pointer]);

  const particleCount = lowPower ? 1400 : 4200;
  const coreDetail = lowPower ? 14 : 32;

  // Desktop keeps the left half clear for the headline; narrow screens centre it.
  const corePosition: [number, number, number] = isMobile ? [0.3, 0.7, -1.2] : [1.95, 0.12, -0.4];
  const coreScale = isMobile ? 0.78 : 0.74;

  return (
    <motion.div
      style={{ opacity }}
      className="pointer-events-none fixed inset-0 -z-10"
      aria-hidden="true"
    >
      <Canvas
        dpr={lowPower ? [1, 1.25] : [1, 1.85]}
        gl={{ antialias: !lowPower, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 5.4], fov: 42, near: 0.1, far: 60 }}
        frameloop={reduced || !inFold ? "demand" : "always"}
      >
        <Suspense fallback={null}>
          <CameraRig pointer={pointer} />

          <group position={corePosition} scale={coreScale}>
            <CoreObject pointer={pointer} detail={coreDetail} />
          </group>
          <ParticleField count={particleCount} pointer={pointer} />

          {!lowPower && (
            <EffectComposer multisampling={0} enableNormalPass={false}>
              <Bloom
                intensity={0.62}
                luminanceThreshold={0.42}
                luminanceSmoothing={0.3}
                mipmapBlur
                radius={0.62}
              />
              <Vignette offset={0.24} darkness={0.78} />
            </EffectComposer>
          )}
        </Suspense>
      </Canvas>
    </motion.div>
  );
}
