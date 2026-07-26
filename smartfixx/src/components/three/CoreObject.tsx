import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { coreFragmentShader, coreVertexShader } from "./shaders";

type CoreObjectProps = {
  pointer: THREE.Vector2;
  detail: number;
};

/**
 * The morphing centrepiece: a displaced icosahedron wrapped in a counter-rotating
 * wireframe shell and two tilted orbital rings.
 */
export function CoreObject({ pointer, detail }: CoreObjectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const ringsRef = useRef<THREE.Group>(null);
  const smoothedPointer = useRef(new THREE.Vector2());

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmplitude: { value: 0.29 },
      uFrequency: { value: 0.95 },
      uPulse: { value: 0 },
      uPointer: { value: new THREE.Vector2() },
    }),
    [],
  );

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const step = Math.min(delta, 1 / 30);

    smoothedPointer.current.lerp(pointer, 1 - Math.pow(0.002, step));

    uniforms.uTime.value = t;
    uniforms.uPointer.value.copy(smoothedPointer.current);
    // Slow breathing, with a sharper accent every ~9s so the body feels alive.
    uniforms.uPulse.value =
      0.5 + 0.5 * Math.sin(t * 0.45) + 0.35 * Math.pow(Math.max(0, Math.sin(t * 0.35)), 12);

    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.12 + smoothedPointer.current.x * 0.35;
      groupRef.current.rotation.x = Math.sin(t * 0.18) * 0.1 - smoothedPointer.current.y * 0.22;
    }
    if (shellRef.current) {
      shellRef.current.rotation.y = -t * 0.2;
      shellRef.current.rotation.z = t * 0.08;
    }
    if (ringsRef.current) {
      ringsRef.current.rotation.z = t * 0.16;
      ringsRef.current.rotation.x = Math.PI * 0.28 + Math.sin(t * 0.24) * 0.12;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <icosahedronGeometry args={[1.32, detail]} />
        <shaderMaterial
          vertexShader={coreVertexShader}
          fragmentShader={coreFragmentShader}
          uniforms={uniforms}
        />
      </mesh>

      {/* Wireframe shell */}
      <mesh ref={shellRef} scale={1.5}>
        <icosahedronGeometry args={[1.32, 3]} />
        <meshBasicMaterial
          color="#4FF0D4"
          wireframe
          transparent
          opacity={0.045}
          depthWrite={false}
        />
      </mesh>

      {/* Orbital rings */}
      <group ref={ringsRef}>
        <mesh>
          <torusGeometry args={[1.98, 0.0035, 8, 220]} />
          <meshBasicMaterial color="#8B5CFF" transparent opacity={0.42} depthWrite={false} />
        </mesh>
        <mesh rotation={[Math.PI * 0.42, 0.4, 0]} scale={1.14}>
          <torusGeometry args={[1.98, 0.0028, 8, 220]} />
          <meshBasicMaterial color="#4FF0D4" transparent opacity={0.28} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}
