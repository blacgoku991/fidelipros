/**
 * GLSL for the hero "core" — a noise-displaced icosahedron shaded with an
 * iridescent fresnel ramp. Normals are re-derived from the displaced surface so
 * the rim light tracks the actual silhouette instead of the base sphere.
 */

/* Ashima / Stefan Gustavson simplex noise, 3D. */
const SIMPLEX_3D = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

export const coreVertexShader = /* glsl */ `
uniform float uTime;
uniform float uAmplitude;
uniform float uFrequency;
uniform float uPulse;
uniform vec2  uPointer;

varying vec3  vNormal;
varying vec3  vViewDir;
varying float vDisplacement;

${SIMPLEX_3D}

/* Layered noise -> total displacement along the surface normal. */
float fieldAt(vec3 p) {
  float slow = snoise(p * uFrequency + vec3(0.0, 0.0, uTime * 0.22));
  float fast = snoise(p * uFrequency * 2.05 + vec3(uTime * 0.16, uTime * 0.09, 0.0));
  float detail = snoise(p * uFrequency * 4.2 - vec3(0.0, uTime * 0.3, 0.0));
  /* Detail stays low: too much high-frequency noise turns the rebuilt normals
     to mush and the fresnel then lights the whole body instead of the rim. */
  return slow * 0.70 + fast * 0.25 + detail * 0.05;
}

vec3 displace(vec3 p) {
  return p + normalize(p) * fieldAt(p) * uAmplitude * (1.0 + uPulse * 0.35);
}

void main() {
  vec3 base = position;
  vDisplacement = fieldAt(base);

  vec3 displaced = displace(base);

  /* Rebuild the normal from two tangent neighbours on the displaced surface. */
  vec3 n = normalize(normal);
  vec3 helper = abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = normalize(cross(n, helper));
  vec3 bitangent = normalize(cross(n, tangent));

  float eps = 0.045;
  vec3 pA = displace(base + tangent * eps);
  vec3 pB = displace(base + bitangent * eps);
  vec3 rebuilt = normalize(cross(pA - displaced, pB - displaced));
  rebuilt *= sign(dot(rebuilt, n));

  /* Pointer nudges the whole body a touch, weighted toward the silhouette. */
  displaced.xy += uPointer * 0.09;

  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);

  vNormal = normalize(normalMatrix * rebuilt);
  vViewDir = normalize(-mvPosition.xyz);

  gl_Position = projectionMatrix * mvPosition;
}
`;

export const coreFragmentShader = /* glsl */ `
uniform float uTime;
uniform float uPulse;

varying vec3  vNormal;
varying vec3  vViewDir;
varying float vDisplacement;

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vViewDir);

  float facing = clamp(dot(n, v), 0.0, 1.0);
  float fresnel = pow(1.0 - facing, 3.6);

  float band = clamp(vDisplacement * 0.5 + 0.5, 0.0, 1.0);

  vec3 deep   = vec3(0.005, 0.008, 0.020);
  vec3 mint   = vec3(0.196, 0.886, 0.792);
  vec3 violet = vec3(0.400, 0.235, 0.870);
  vec3 coral  = vec3(1.000, 0.361, 0.541);

  /* Values are linear here — the sRGB conversion below lifts them hard, so the
     body is kept very low and all the energy goes into the rim and the seams. */
  vec3 color = mix(deep, violet * 0.11, smoothstep(0.02, 0.68, band));
  color = mix(color, mint * 0.13, smoothstep(0.66, 1.0, band) * 0.85);

  /* Thin iridescent seams where the noise field crosses zero. */
  float seam = smoothstep(0.035, 0.0, abs(vDisplacement));
  color += seam * mix(mint, coral, 0.3) * 0.30;

  /* Rim — the main read of the silhouette. */
  color += fresnel * mix(mint, violet, 0.35) * 0.85;
  color += pow(fresnel, 7.0) * vec3(0.75, 0.92, 1.0) * (0.3 + uPulse * 0.25);

  /* Slow sheen sweeping across the body. */
  float sheen = 0.5 + 0.5 * sin(vDisplacement * 7.0 + uTime * 0.7);
  color += sheen * fresnel * 0.08;

  gl_FragColor = vec4(color, 1.0);

  #include <colorspace_fragment>
}
`;

export const particleVertexShader = /* glsl */ `
uniform float uTime;
uniform float uSize;
uniform vec2  uPointer;

attribute float aScale;
attribute float aSpeed;
attribute vec3  aTint;

varying vec3  vTint;
varying float vFade;

void main() {
  vec3 p = position;

  /* Each point drifts on its own slow orbit around Y. */
  float angle = uTime * aSpeed * 0.14;
  float c = cos(angle);
  float s = sin(angle);
  p = vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
  p.y += sin(uTime * 0.55 * aSpeed + p.x * 1.7) * 0.06;

  p.xy += uPointer * 0.16;

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);

  gl_Position = projectionMatrix * mvPosition;
  /* Capped so points passing near the camera stay specks, not blobs. */
  gl_PointSize = min(uSize * aScale * (26.0 / -mvPosition.z), 4.5);

  vTint = aTint;
  /* Dim points that drift far behind the core, and those that come too close. */
  vFade = smoothstep(-11.0, -3.0, mvPosition.z) * smoothstep(-0.6, -2.6, mvPosition.z);
}
`;

export const particleFragmentShader = /* glsl */ `
varying vec3  vTint;
varying float vFade;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float alpha = smoothstep(0.5, 0.02, d);
  alpha *= alpha;
  if (alpha < 0.01) discard;

  gl_FragColor = vec4(vTint, alpha * vFade * 0.5);

  #include <colorspace_fragment>
}
`;
