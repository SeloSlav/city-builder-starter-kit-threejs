/** Shared grade math constants for WebGL + WebGPU post pipelines. */
export const GRADE_LUMA_WEIGHTS = [0.2126, 0.7152, 0.0722] as const;
export const GRADE_WARMTH_TINT = [1.03, 1.01, 0.97] as const;
export const GRADE_NIGHT_BLUE_TINT = [0.82, 0.9, 1.12] as const;
export const GRADE_VIGNETTE_INNER = 0.18;
export const GRADE_VIGNETTE_OUTER = 0.78;

export function buildGradeGlslVertexShader(): string {
  return `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
}

export function buildGradeGlslFragmentShader(): string {
  const [lr, lg, lb] = GRADE_LUMA_WEIGHTS;
  const [wr, wg, wb] = GRADE_WARMTH_TINT;
  const [nr, ng, nb] = GRADE_NIGHT_BLUE_TINT;
  return `
    uniform sampler2D tDiffuse;
    uniform float saturation;
    uniform float contrast;
    uniform float warmth;
    uniform float nightBlue;
    uniform float vignette;
    varying vec2 vUv;

    vec3 adjustSaturation(vec3 color, float amount) {
      float luma = dot(color, vec3(${lr}, ${lg}, ${lb}));
      return mix(vec3(luma), color, amount);
    }

    void main() {
      vec3 color = texture2D(tDiffuse, vUv).rgb;
      color = (color - 0.5) * contrast + 0.5;
      color = adjustSaturation(color, saturation);
      color = mix(color, color * vec3(${wr}, ${wg}, ${wb}), warmth);
      color = mix(color, color * vec3(${nr}, ${ng}, ${nb}), nightBlue);
      float distanceFromCenter = distance(vUv, vec2(0.5));
      float edge = smoothstep(${GRADE_VIGNETTE_INNER}, ${GRADE_VIGNETTE_OUTER}, distanceFromCenter);
      color *= mix(1.0, 1.0 - vignette, edge);
      gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
    }
  `;
}

export function buildGradeWgslFunctionBody(): string {
  const [lr, lg, lb] = GRADE_LUMA_WEIGHTS;
  const [wr, wg, wb] = GRADE_WARMTH_TINT;
  const [nr, ng, nb] = GRADE_NIGHT_BLUE_TINT;
  return `
      let luma = dot(inputColor.rgb, vec3<f32>(${lr}, ${lg}, ${lb}));
      let saturated = mix(vec3<f32>(luma), inputColor.rgb, gradeSaturation);
      let contrasted = (saturated - vec3<f32>(0.5)) * gradeContrast + vec3<f32>(0.5);
      let warmed = mix(contrasted, contrasted * vec3<f32>(${wr}, ${wg}, ${wb}), gradeWarmth);
      let nightTinted = mix(warmed, warmed * vec3<f32>(${nr}, ${ng}, ${nb}), gradeNightBlue);
      let distanceFromCenter = distance(frameUv, vec2<f32>(0.5));
      let edge = smoothstep(${GRADE_VIGNETTE_INNER}, ${GRADE_VIGNETTE_OUTER}, distanceFromCenter);
      let graded = nightTinted * mix(1.0, 1.0 - gradeVignette, edge);
      return vec4<f32>(max(graded, vec3<f32>(0.0)), inputColor.a);
  `;
}
