/**
 * 2D shallow-water style flow on a staggered grid (“virtual pipes”), after the method described in
 * https://andrewkrapivin.github.io/blog/posts/virtual-pipes-and-terrain/
 */

export type VirtualPipesWaterParams = {
  nx: number;
  ny: number;
  dx?: number;
  dy?: number;
  dt?: number;
  g?: number;
  friction?: number;
  viscosity?: number;
};

const DEFAULT_DX = 1;
const DEFAULT_DY = 1;
const DEFAULT_DT = 0.005;
const DEFAULT_G = 1;
const DEFAULT_FRICTION = 0.02;

export class VirtualPipesWater2D {
  readonly nx: number;
  readonly ny: number;
  dx: number;
  dy: number;
  dt: number;
  g: number;
  friction: number;
  viscosity: number;

  readonly terrain: Float32Array;
  readonly depth: Float32Array;
  readonly flowX: Float32Array;
  readonly flowY: Float32Array;

  constructor(params: VirtualPipesWaterParams) {
    const nx = params.nx | 0;
    const ny = params.ny | 0;
    if (nx < 2 || ny < 2) {
      throw new Error('VirtualPipesWater2D requires nx, ny >= 2');
    }
    this.nx = nx;
    this.ny = ny;
    this.dx = params.dx ?? DEFAULT_DX;
    this.dy = params.dy ?? DEFAULT_DY;
    this.dt = params.dt ?? DEFAULT_DT;
    this.g = params.g ?? DEFAULT_G;
    this.friction = params.friction ?? DEFAULT_FRICTION;
    this.viscosity = params.viscosity ?? 0;

    const nCell = nx * ny;
    this.terrain = new Float32Array(nCell);
    this.depth = new Float32Array(nCell);
    this.flowX = new Float32Array((nx + 1) * ny);
    this.flowY = new Float32Array(nx * (ny + 1));
  }

  writeSurfaceHeightsInto(out: Float32Array): void {
    const { nx, ny, terrain, depth } = this;
    const n = nx * ny;
    for (let i = 0; i < n; i++) out[i] = terrain[i] + depth[i];
  }

  step(): void {
    const { nx, ny, dx, dy, dt, g, friction, viscosity } = this;
    const rdx = g * dt / dx;
    const rdy = g * dt / dy;
    const invCell = dt / (dx * dy);
    const frictionFactor = Math.pow(Math.max(0, Math.min(1, 1 - friction)), dt);

    const terr = this.terrain;
    const depth = this.depth;
    const flowX = this.flowX;
    const flowY = this.flowY;

    for (let y = 0; y < ny; y++) {
      const rowT = y * nx;
      const rowF = y * (nx + 1);
      for (let x = 1; x < nx; x++) {
        const i0 = rowT + (x - 1);
        const i1 = rowT + x;
        const s0 = terr[i0] + depth[i0];
        const s1 = terr[i1] + depth[i1];
        const e = rowF + x;
        flowX[e] = flowX[e] * frictionFactor + (s0 - s1) * rdx;
      }
    }

    for (let y = 1; y < ny; y++) {
      const rowT = y * nx;
      const rowTPrev = (y - 1) * nx;
      for (let x = 0; x < nx; x++) {
        const i0 = rowTPrev + x;
        const i1 = rowT + x;
        const s0 = terr[i0] + depth[i0];
        const s1 = terr[i1] + depth[i1];
        const e = y * nx + x;
        flowY[e] = flowY[e] * frictionFactor + (s0 - s1) * rdy;
      }
    }

    if (viscosity > 0) {
      const nu = 3 * dt * viscosity;
      for (let y = 0; y < ny; y++) {
        const rowT = y * nx;
        const rowF = y * (nx + 1);
        for (let x = 1; x < nx; x++) {
          const e = rowF + x;
          const q = flowX[e];
          const iUp = rowT + (q > 0 ? x - 1 : x);
          let H = depth[iUp];
          H *= H;
          if (H > 0) flowX[e] *= H / (H + nu);
        }
      }
      for (let y = 1; y < ny; y++) {
        const rowT = y * nx;
        const rowPrev = (y - 1) * nx;
        for (let x = 0; x < nx; x++) {
          const e = y * nx + x;
          const q = flowY[e];
          const iUp = (q > 0 ? rowPrev : rowT) + x;
          let H = depth[iUp];
          H *= H;
          if (H > 0) flowY[e] *= H / (H + nu);
        }
      }
    }

    for (let y = 0; y < ny; y++) {
      const rowT = y * nx;
      const rowFX = y * (nx + 1);
      const rowFY = y * nx;
      const rowFY1 = (y + 1) * nx;
      for (let x = 0; x < nx; x++) {
        const i = rowT + x;
        let totalOut = 0;
        const fx0 = flowX[rowFX + x];
        const fx1 = flowX[rowFX + x + 1];
        const fy0 = flowY[rowFY + x];
        const fy1 = flowY[rowFY1 + x];
        if (fx0 < 0) totalOut += -fx0;
        if (fy0 < 0) totalOut += -fy0;
        if (fx1 > 0) totalOut += fx1;
        if (fy1 > 0) totalOut += fy1;

        const maxOut = (depth[i] * dx * dy) / dt;
        if (totalOut > 0) {
          const scale = Math.min(1, maxOut / totalOut);
          if (fx0 < 0) flowX[rowFX + x] *= scale;
          if (fy0 < 0) flowY[rowFY + x] *= scale;
          if (fx1 > 0) flowX[rowFX + x + 1] *= scale;
          if (fy1 > 0) flowY[rowFY1 + x] *= scale;
        }
      }
    }

    for (let y = 0; y < ny; y++) {
      const rowT = y * nx;
      const rowFX = y * (nx + 1);
      const rowFY = y * nx;
      const rowFY1 = (y + 1) * nx;
      for (let x = 0; x < nx; x++) {
        const i = rowT + x;
        const d =
          flowX[rowFX + x] + flowY[rowFY + x] - flowX[rowFX + x + 1] - flowY[rowFY1 + x];
        depth[i] += d * invCell;
      }
    }
  }
}
