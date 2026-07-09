import * as THREE from 'three';
import type { Terrain } from '../terrain/Terrain.ts';
import type { RiverField } from './RiverField.ts';
import { VirtualPipesWater2D } from './virtualPipesWater.ts';

const WATER_BODY_BASE = new THREE.Color(0x4a93a8);
const WATER_FOAM_BASE = new THREE.Color(0xe8f4f0);
const RIVER_WATER_DEPTH = 0.78;
const WATER_SIM_RENDER_DELTA_SCALE = 0.16;
const MAX_SIM_CATCHUP_STEPS = 4;
const WATER_CPU_UPDATE_INTERVAL_SEC = 1 / 30;

let sharedWaterMaterial: THREE.MeshStandardMaterial | null = null;

function getSharedWaterMaterial(): THREE.MeshStandardMaterial {
  if (!sharedWaterMaterial) {
    sharedWaterMaterial = new THREE.MeshStandardMaterial({
      name: 'RiverWaterMaterial',
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: 0.86,
      roughness: 0.42,
      metalness: 0,
      depthWrite: false,
      depthTest: true,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
  }
  return sharedWaterMaterial;
}

export function disposeSharedRiverWaterMaterial(): void {
  sharedWaterMaterial?.dispose();
  sharedWaterMaterial = null;
}

export type RiverWaterController = {
  tick: (dt: number, timeSec?: number) => void;
  dispose: () => void;
};

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(1e-6, edge1 - edge0)));
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

function sampleFloatGridBilinear(values: Float32Array, nx: number, nz: number, gx: number, gz: number): number {
  const x = Math.max(0, Math.min(nx - 1, gx));
  const z = Math.max(0, Math.min(nz - 1, gz));
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = Math.min(nx - 1, x0 + 1);
  const z1 = Math.min(nz - 1, z0 + 1);
  const tx = x - x0;
  const tz = z - z0;
  const h00 = values[z0 * nx + x0] ?? 0;
  const h10 = values[z0 * nx + x1] ?? h00;
  const h01 = values[z1 * nx + x0] ?? h00;
  const h11 = values[z1 * nx + x1] ?? h10;
  const hx0 = h00 + (h10 - h00) * tx;
  const hx1 = h01 + (h11 - h01) * tx;
  return hx0 + (hx1 - hx0) * tz;
}

function writeWaterConstrainedBoundaryFlows(sim: VirtualPipesWater2D, wetMask: Uint8Array): void {
  const { nx, ny, flowX, flowY } = sim;
  for (let y = 0; y < ny; y++) {
    const rowFX = y * (nx + 1);
    flowX[rowFX] = 0;
    flowX[rowFX + nx] = 0;
    for (let x = 1; x < nx; x++) {
      const leftWet = wetMask[y * nx + (x - 1)] > 0;
      const rightWet = wetMask[y * nx + x] > 0;
      if (!leftWet || !rightWet) flowX[rowFX + x] = 0;
    }
  }
  for (let y = 0; y <= ny; y++) {
    const rowFY = y * nx;
    if (y === 0 || y === ny) {
      for (let x = 0; x < nx; x++) flowY[rowFY + x] = 0;
      continue;
    }
    for (let x = 0; x < nx; x++) {
      const bottomWet = wetMask[(y - 1) * nx + x] > 0;
      const topWet = wetMask[y * nx + x] > 0;
      if (!bottomWet || !topWet) flowY[rowFY + x] = 0;
    }
  }
}

type ClipPoint = { gx: number; gz: number; signed: number; index: number };

export function createRiverWaterMesh(
  group: THREE.Group,
  terrain: Terrain,
  riverField: RiverField,
): RiverWaterController | null {
  const nx = riverField.resolution;
  const nz = riverField.resolution;
  if (nx < 2 || nz < 2) return null;

  const organicSigned = riverField.organicSignedDistance;
  const riverMask = riverField.riverMask;

  const clipSigned = (cellIndex: number): number => {
    const organic = organicSigned[cellIndex] ?? -1;
    const mask = riverMask[cellIndex] ?? 0;
    if (mask >= 0.38) return Math.max(organic, 0.4);
    return organic;
  };

  const wetMask = new Uint8Array(nx * nz);
  let hasWet = false;
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const i = iz * nx + ix;
      const coreWet = riverField.riverMask[i] >= 0.38;
      const organicWet = organicSigned[i] >= -0.15;
      const wet = coreWet && organicWet;
      wetMask[i] = wet ? 1 : 0;
      if (wet) hasWet = true;
    }
  }
  if (!hasWet) return null;

  const sim = new VirtualPipesWater2D({
    nx,
    ny: nz,
    dx: riverField.stepX,
    dy: riverField.stepZ,
    dt: 0.005,
    g: 2.4,
    friction: 0.06,
    viscosity: 0.1,
  });

  const baseDepth = new Float32Array(nx * nz);
  const renderSurfaceBase = new Float32Array(nx * nz);
  const stillSurface = new Float32Array(nx * nz);
  const surfaceScratch = new Float32Array(nx * nz);

  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const i = iz * nx + ix;
      const wx = riverField.startX + ix * riverField.stepX;
      const wz = riverField.startZ + iz * riverField.stepZ;
      const bed = terrain.getHeightAt(wx, wz);
      sim.terrain[i] = bed;
      if (wetMask[i]) {
        const shore = 1 - Math.min(1, Math.max(0, organicSigned[i]) / 6);
        const depth = RIVER_WATER_DEPTH + shore * 0.08;
        baseDepth[i] = depth;
        sim.depth[i] = depth;
      } else {
        baseDepth[i] = 0;
        sim.depth[i] = 0;
      }
      stillSurface[i] = sim.terrain[i] + baseDepth[i];
      renderSurfaceBase[i] = stillSurface[i];
    }
  }

  const vertexGx: number[] = [];
  const vertexGz: number[] = [];
  const colors: number[] = [];

  const appendVertex = (gx: number, gz: number, signedOverride?: number): number => {
    const wx = riverField.startX + gx * riverField.stepX;
    const wz = riverField.startZ + gz * riverField.stepZ;
    const signed =
      signedOverride ??
      sampleFloatGridBilinear(organicSigned, nx, nz, gx, gz);
    const shore = signed >= 0 ? 1 - smoothstep(0.15, 4.8, signed) : 0;
    const macro = valueNoise2D(wx * 0.18 + 4.7, wz * 0.18 - 9.1);
    const detail = valueNoise2D(wx * 0.52 - 13.3, wz * 0.52 + 6.6);
    const foam = Math.min(0.48, shore * (0.16 + macro * 0.22 + detail * 0.08));
    const index = vertexGx.length;
    vertexGx.push(gx);
    vertexGz.push(gz);
    colors.push(
      WATER_BODY_BASE.r + (WATER_FOAM_BASE.r - WATER_BODY_BASE.r) * foam,
      WATER_BODY_BASE.g + (WATER_FOAM_BASE.g - WATER_BODY_BASE.g) * foam,
      WATER_BODY_BASE.b + (WATER_FOAM_BASE.b - WATER_BODY_BASE.b) * foam,
    );
    return index;
  };

  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      appendVertex(ix, iz, clipSigned(iz * nx + ix));
    }
  }

  const indices: number[] = [];
  const gridVertexIndex = (ix: number, iz: number): number => iz * nx + ix;

  const makeIntersection = (a: ClipPoint, b: ClipPoint): ClipPoint => {
    const denom = a.signed - b.signed;
    const t = denom === 0 ? 0.5 : Math.max(0, Math.min(1, a.signed / denom));
    const gx = a.gx + (b.gx - a.gx) * t;
    const gz = a.gz + (b.gz - a.gz) * t;
    return { gx, gz, signed: 0, index: appendVertex(gx, gz, 0) };
  };

  const clipWaterPolygon = (input: ClipPoint[]): ClipPoint[] => {
    const output: ClipPoint[] = [];
    for (let i = 0; i < input.length; i++) {
      const current = input[i];
      const next = input[(i + 1) % input.length];
      const currentInside = current.signed >= 0;
      const nextInside = next.signed >= 0;
      if (currentInside && nextInside) {
        output.push(next);
      } else if (currentInside && !nextInside) {
        output.push(makeIntersection(current, next));
      } else if (!currentInside && nextInside) {
        output.push(makeIntersection(current, next), next);
      }
    }
    return output;
  };

  for (let iz = 0; iz < nz - 1; iz++) {
    for (let ix = 0; ix < nx - 1; ix++) {
      const bl = iz * nx + ix;
      const br = iz * nx + ix + 1;
      const tl = (iz + 1) * nx + ix;
      const tr = (iz + 1) * nx + ix + 1;
      const corners: ClipPoint[] = [
        { gx: ix, gz: iz, signed: clipSigned(bl), index: gridVertexIndex(ix, iz) },
        { gx: ix, gz: iz + 1, signed: clipSigned(tl), index: gridVertexIndex(ix, iz + 1) },
        { gx: ix + 1, gz: iz + 1, signed: clipSigned(tr), index: gridVertexIndex(ix + 1, iz + 1) },
        { gx: ix + 1, gz: iz, signed: clipSigned(br), index: gridVertexIndex(ix + 1, iz) },
      ];
      const insideCount = corners.reduce((count, corner) => count + (corner.signed >= 0 ? 1 : 0), 0);
      if (insideCount === 0) continue;
      if (insideCount === 4) {
        indices.push(bl, tl, br, br, tl, tr);
        continue;
      }

      const clipped = clipWaterPolygon(corners);
      if (clipped.length < 3) continue;
      const first = clipped[0].index;
      for (let i = 1; i < clipped.length - 1; i++) {
        indices.push(first, clipped[i].index, clipped[i + 1].index);
      }
    }
  }
  if (indices.length === 0) return null;

  const vertexGxAttr = Float32Array.from(vertexGx);
  const vertexGzAttr = Float32Array.from(vertexGz);
  const positions = new Float32Array(vertexGxAttr.length * 3);

  const writePositions = () => {
    for (let vi = 0; vi < vertexGxAttr.length; vi++) {
      const gx = vertexGxAttr[vi];
      const gz = vertexGzAttr[vi];
      positions[vi * 3] = riverField.startX + gx * riverField.stepX;
      positions[vi * 3 + 1] = sampleFloatGridBilinear(renderSurfaceBase, nx, nz, gx, gz);
      positions[vi * 3 + 2] = riverField.startZ + gz * riverField.stepZ;
    }
  };

  writePositions();

  const geometry = new THREE.BufferGeometry();
  const positionAttr = new THREE.BufferAttribute(positions, 3);
  geometry.setAttribute('position', positionAttr);
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, getSharedWaterMaterial());
  mesh.name = 'River water surface';
  mesh.userData.water = true;
  mesh.raycast = () => {};
  mesh.receiveShadow = true;
  mesh.renderOrder = 1.25;
  group.add(mesh);

  const updatePositionsY = () => {
    sim.writeSurfaceHeightsInto(surfaceScratch);
    for (let vi = 0; vi < vertexGxAttr.length; vi++) {
      const gx = vertexGxAttr[vi];
      const gz = vertexGzAttr[vi];
      const isBoundary = gx <= 0 || gz <= 0 || gx >= nx - 1 || gz >= nz - 1;
      const wet = sampleFloatGridBilinear(organicSigned, nx, nz, gx, gz) >= 0;
      const simDelta =
        wet && !isBoundary
          ? (sampleFloatGridBilinear(surfaceScratch, nx, nz, gx, gz) -
              sampleFloatGridBilinear(stillSurface, nx, nz, gx, gz)) *
            WATER_SIM_RENDER_DELTA_SCALE
          : 0;
      positionAttr.setY(vi, sampleFloatGridBilinear(renderSurfaceBase, nx, nz, gx, gz) + simDelta);
    }
    positionAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  };

  let simAccum = 0;
  let cpuAccum = 0;
  let elapsed = 0;
  let disposed = false;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (mesh.parent === group) group.remove(mesh);
    geometry.dispose();
  };

  const tick = (dt: number, timeSec?: number) => {
    if (disposed) return;
    elapsed = timeSec ?? elapsed + dt;
    cpuAccum += Math.min(0.1, Math.max(0, dt));
    if (cpuAccum < WATER_CPU_UPDATE_INTERVAL_SEC) return;
    const updateDt = cpuAccum;
    cpuAccum = 0;

    simAccum += Math.min(0.1, Math.max(0, updateDt));
    let steps = 0;
    while (simAccum >= sim.dt && steps < MAX_SIM_CATCHUP_STEPS) {
      writeWaterConstrainedBoundaryFlows(sim, wetMask);
      sim.step();
      writeWaterConstrainedBoundaryFlows(sim, wetMask);
      simAccum -= sim.dt;
      steps++;
    }
    updatePositionsY();
  };

  return { tick, dispose };
}
