const SHORE_ORGANIC_SMOOTH_PASSES = 5;
const SHORE_ORGANIC_JITTER_WORLD = 1.35;
const CORE_PROTECT_CELLS = 2.4;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function hashNoise2D(x: number, z: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise2D(x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hashNoise2D(x0, z0);
  const b = hashNoise2D(x0 + 1, z0);
  const c = hashNoise2D(x0, z0 + 1);
  const d = hashNoise2D(x0 + 1, z0 + 1);
  const ab = a + (b - a) * ux;
  const cd = c + (d - c) * ux;
  return ab + (cd - ab) * uz;
}

export function computeShoreSignedDistance(
  riverMask: Float32Array,
  resolution: number,
  waterThreshold: number,
): Float32Array {
  const signed = new Float32Array(riverMask.length);
  const isWet = (ix: number, iz: number): boolean => {
    if (ix < 0 || iz < 0 || ix >= resolution || iz >= resolution) return false;
    return riverMask[iz * resolution + ix] >= waterThreshold;
  };

  for (let iz = 0; iz < resolution; iz++) {
    for (let ix = 0; ix < resolution; ix++) {
      const i = iz * resolution + ix;
      const wet = isWet(ix, iz);
      let bestSq = Number.POSITIVE_INFINITY;

      for (let dz = -12; dz <= 12; dz++) {
        for (let dx = -12; dx <= 12; dx++) {
          if (dx === 0 && dz === 0) continue;
          const neighborWet = isWet(ix + dx, iz + dz);
          if (neighborWet === wet) continue;
          bestSq = Math.min(bestSq, dx * dx + dz * dz);
        }
      }

      const dist = Number.isFinite(bestSq) ? Math.sqrt(bestSq) : 12;
      signed[i] = wet ? dist : -dist;
    }
  }

  return signed;
}

export function buildOrganicShoreSignedDistance(params: {
  shoreSignedDistance: Float32Array;
  resolution: number;
  stepX: number;
  stepZ: number;
  startX: number;
  startZ: number;
}): Float32Array {
  const { shoreSignedDistance, resolution, stepX, stepZ, startX, startZ } = params;
  const n = resolution * resolution;
  const a = new Float32Array(shoreSignedDistance);
  const b = new Float32Array(n);
  const cellStep = (stepX + stepZ) * 0.5;

  for (let pass = 0; pass < SHORE_ORGANIC_SMOOTH_PASSES; pass++) {
    for (let iz = 0; iz < resolution; iz++) {
      for (let ix = 0; ix < resolution; ix++) {
        const i = iz * resolution + ix;
        const nearShore = 1 - smoothstep(0.65 * cellStep, 5.5 * cellStep, Math.abs(shoreSignedDistance[i]) * cellStep);
        if (nearShore <= 0.001) {
          b[i] = a[i];
          continue;
        }

        let sum = a[i] * 2.35;
        let weight = 2.35;
        for (let dz = -1; dz <= 1; dz++) {
          const zz = iz + dz;
          if (zz < 0 || zz >= resolution) continue;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dz === 0) continue;
            const xx = ix + dx;
            if (xx < 0 || xx >= resolution) continue;
            const j = zz * resolution + xx;
            const w = dx === 0 || dz === 0 ? 1 : 0.58;
            sum += a[j] * w;
            weight += w;
          }
        }

        const smoothed = sum / weight;
        b[i] = a[i] + (smoothed - a[i]) * (0.42 * nearShore);
      }
    }
    a.set(b);
  }

  const out = new Float32Array(n);
  for (let iz = 0; iz < resolution; iz++) {
    for (let ix = 0; ix < resolution; ix++) {
      const i = iz * resolution + ix;
      const raw = shoreSignedDistance[i];
      const rawWorld = Math.abs(raw) * cellStep;
      const nearShore = 1 - smoothstep(0.9 * cellStep, 5 * cellStep, rawWorld);
      const wx = startX + ix * stepX;
      const wz = startZ + iz * stepZ;
      const macro = valueNoise2D(wx * 0.052 + 19.1, wz * 0.052 - 8.4) - 0.5;
      const detail = valueNoise2D(wx * 0.145 - 3.7, wz * 0.145 + 12.6) - 0.5;
      const jitter =
        ((macro * 1.25 + detail * 0.48) * SHORE_ORGANIC_JITTER_WORLD * nearShore) / cellStep;

      if (raw > CORE_PROTECT_CELLS) {
        out[i] = a[i];
        continue;
      }

      const edgeBlend = raw > 0 ? smoothstep(0, CORE_PROTECT_CELLS, raw) : 1;
      out[i] = a[i] + jitter * edgeBlend;
    }
  }

  return out;
}

export function dilateRiverMask(
  riverMask: Float32Array,
  resolution: number,
  threshold: number,
  radiusCells: number,
): Float32Array {
  const out = new Float32Array(riverMask);
  const rInt = Math.ceil(radiusCells);

  for (let iz = 0; iz < resolution; iz++) {
    for (let ix = 0; ix < resolution; ix++) {
      const i = iz * resolution + ix;
      if (riverMask[i] < threshold) continue;
      for (let dz = -rInt; dz <= rInt; dz++) {
        for (let dx = -rInt; dx <= rInt; dx++) {
          const tx = ix + dx;
          const tz = iz + dz;
          if (tx < 0 || tz < 0 || tx >= resolution || tz >= resolution) continue;
          const dist = Math.hypot(dx, dz);
          if (dist > radiusCells) continue;
          const j = tz * resolution + tx;
          const falloff = 1 - dist / Math.max(1e-3, radiusCells);
          out[j] = Math.max(out[j], riverMask[i] * (0.55 + falloff * 0.45));
        }
      }
    }
  }

  return out;
}
