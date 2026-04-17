"use client";

/* eslint-disable react/no-unknown-property */

import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import styles from "./Dither.module.css";

const vertexShader = `
precision mediump float;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/*
 * Single-pass fragment shader: wave noise + bayer dithering combined.
 * Eliminates the expensive EffectComposer / postprocessing pipeline.
 */
const fragmentShader = `
precision mediump float;
uniform vec2 resolution;
uniform float time;
uniform float waveSpeed;
uniform float waveFrequency;
uniform float waveAmplitude;
uniform vec3 waveColor;
uniform vec2 mousePos;
uniform int enableMouseInteraction;
uniform float mouseRadius;
uniform float colorNum;
uniform float pixelSize;

vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0,0.0,1.0,1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0,0.0,1.0,1.0);
  Pi = mod289(Pi);
  vec4 ix = Pi.xzxz, iy = Pi.yyww;
  vec4 fx = Pf.xzxz, fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1.0/41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x), g10 = vec2(gx.y, gy.y);
  vec2 g01 = vec2(gx.z, gy.z), g11 = vec2(gx.w, gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11)));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
}

float fbm(vec2 p) {
  float value = 0.0, amp = 1.0, freq = waveFrequency;
  for (int i = 0; i < 3; i++) {
    value += amp * abs(cnoise(p));
    p *= freq;
    amp *= waveAmplitude;
  }
  return value;
}

float pattern(vec2 p) {
  return fbm(p + fbm(p - time * waveSpeed));
}

/* 4×4 Bayer matrix — cheaper than 8×8, visually close enough */
float bayer4(vec2 coord) {
  vec2 c = mod(coord, 4.0);
  int idx = int(c.y) * 4 + int(c.x);
  float m[16];
  m[0]  = 0.0/16.0;  m[1]  = 8.0/16.0;  m[2]  = 2.0/16.0;  m[3]  = 10.0/16.0;
  m[4]  = 12.0/16.0; m[5]  = 4.0/16.0;  m[6]  = 14.0/16.0; m[7]  = 6.0/16.0;
  m[8]  = 3.0/16.0;  m[9]  = 11.0/16.0; m[10] = 1.0/16.0;  m[11] = 9.0/16.0;
  m[12] = 15.0/16.0; m[13] = 7.0/16.0;  m[14] = 13.0/16.0; m[15] = 5.0/16.0;
  /* Unrolled lookup — avoids dynamic indexing cost */
  for (int i = 0; i < 16; i++) {
    if (i == idx) return m[i];
  }
  return 0.0;
}

void main() {
  /* Snap to pixel grid */
  vec2 pixCoord = floor(gl_FragCoord.xy / pixelSize) * pixelSize;
  vec2 uv = pixCoord / resolution - 0.5;
  uv.x *= resolution.x / resolution.y;

  float f = pattern(uv);

  if (enableMouseInteraction == 1) {
    vec2 mouseNDC = (mousePos / resolution - 0.5) * vec2(1.0, -1.0);
    mouseNDC.x *= resolution.x / resolution.y;
    float dist = length(uv - mouseNDC);
    f -= 0.5 * (1.0 - smoothstep(0.0, mouseRadius, dist));
  }

  vec3 col = mix(vec3(0.0), waveColor, f);

  /* Ordered dither */
  vec2 ditherCoord = floor(gl_FragCoord.xy / pixelSize);
  float threshold = bayer4(ditherCoord) - 0.25;
  float step = 1.0 / (colorNum - 1.0);
  col += threshold * step;
  col = clamp(col - 0.2, 0.0, 1.0);
  col = floor(col * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);

  gl_FragColor = vec4(col, 1.0);
}
`;

function DitheredWave({
  waveSpeed,
  waveFrequency,
  waveAmplitude,
  waveColor,
  colorNum,
  pixelSize,
  disableAnimation,
  enableMouseInteraction,
  mouseRadius,
  externalMouseRef,
}) {
  const mesh = useRef(null);
  const { viewport, size, gl } = useThree();

  const uniforms = useRef({
    time: new THREE.Uniform(0),
    resolution: new THREE.Uniform(new THREE.Vector2()),
    waveSpeed: new THREE.Uniform(waveSpeed),
    waveFrequency: new THREE.Uniform(waveFrequency),
    waveAmplitude: new THREE.Uniform(waveAmplitude),
    waveColor: new THREE.Uniform(new THREE.Color(...waveColor)),
    mousePos: new THREE.Uniform(new THREE.Vector2()),
    enableMouseInteraction: new THREE.Uniform(enableMouseInteraction ? 1 : 0),
    mouseRadius: new THREE.Uniform(mouseRadius),
    colorNum: new THREE.Uniform(colorNum),
    pixelSize: new THREE.Uniform(pixelSize),
  });

  useEffect(() => {
    const dpr = gl.getPixelRatio();
    uniforms.current.resolution.value.set(
      Math.floor(size.width * dpr),
      Math.floor(size.height * dpr)
    );
  }, [size, gl]);

  const prevColor = useRef([...waveColor]);

  useFrame(({ clock }) => {
    const u = uniforms.current;

    if (!disableAnimation) u.time.value = clock.getElapsedTime();

    u.waveSpeed.value = waveSpeed;
    u.waveFrequency.value = waveFrequency;
    u.waveAmplitude.value = waveAmplitude;
    u.enableMouseInteraction.value = enableMouseInteraction ? 1 : 0;
    u.mouseRadius.value = mouseRadius;
    u.colorNum.value = colorNum;
    u.pixelSize.value = pixelSize;

    if (!prevColor.current.every((v, i) => v === waveColor[i])) {
      u.waveColor.value.set(...waveColor);
      prevColor.current = [...waveColor];
    }

    if (enableMouseInteraction && externalMouseRef?.current) {
      const rect = gl.domElement.getBoundingClientRect();
      const dpr = gl.getPixelRatio();
      u.mousePos.value.set(
        (externalMouseRef.current.x - rect.left) * dpr,
        (externalMouseRef.current.y - rect.top) * dpr
      );
    }
  });

  return (
    <mesh ref={mesh} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms.current}
      />
    </mesh>
  );
}

export default function Dither({
  waveSpeed = 0.05,
  waveFrequency = 3,
  waveAmplitude = 0.3,
  waveColor = [0.5, 0.5, 0.5],
  colorNum = 4,
  pixelSize = 2,
  disableAnimation = false,
  enableMouseInteraction = true,
  mouseRadius = 1,
  externalMouseRef,
}) {
  return (
    <Canvas
      className={styles.ditherContainer}
      camera={{ position: [0, 0, 6] }}
      dpr={1}
      gl={{
        antialias: false,
        alpha: false,
        powerPreference: "low-power",
        stencil: false,
        depth: false,
      }}
      frameloop="always"
    >
      <DitheredWave
        waveSpeed={waveSpeed}
        waveFrequency={waveFrequency}
        waveAmplitude={waveAmplitude}
        waveColor={waveColor}
        colorNum={colorNum}
        pixelSize={pixelSize}
        disableAnimation={disableAnimation}
        enableMouseInteraction={enableMouseInteraction}
        mouseRadius={mouseRadius}
        externalMouseRef={externalMouseRef}
      />
    </Canvas>
  );
}
