import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { particleFragmentShader, particleVertexShader } from "./shaders";

const TINTS = [
  new THREE.Color("#4FF0D4"),
  new THREE.Color("#8B5CFF"),
  new THREE.Color("#FF5C8A"),
  new THREE.Color("#DCE6FF"),
];

/** Dust shell orbiting the core, tinted with the brand ramp. */
export function ParticleField({ count, pointer }: { count: number; pointer: THREE.Vector2 }) {
  const smoothedPointer = useRef(new THREE.Vector2());

  const { geometry, uniforms } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const speeds = new Float32Array(count);
    const tints = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
      // Spherical shell with a soft radial spread, flattened slightly on Y.
      const radius = 3.2 + Math.pow(Math.random(), 1.7) * 5.6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi) * 0.62;
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      scales[i] = 0.35 + Math.random() * 1.5;
      speeds[i] = 0.35 + Math.random() * 1.4;

      const tint = TINTS[Math.floor(Math.random() * TINTS.length)];
      tints[i * 3] = tint.r;
      tints[i * 3 + 1] = tint.g;
      tints[i * 3 + 2] = tint.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
    geo.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute("aTint", new THREE.BufferAttribute(tints, 3));

    return {
      geometry: geo,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 1.5 },
        uPointer: { value: new THREE.Vector2() },
      },
    };
  }, [count]);

  useFrame((state, delta) => {
    const step = Math.min(delta, 1 / 30);
    smoothedPointer.current.lerp(pointer, 1 - Math.pow(0.01, step));
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uPointer.value.copy(smoothedPointer.current);
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        vertexShader={particleVertexShader}
        fragmentShader={particleFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
