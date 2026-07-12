import {
  attribute,
  float,
  positionGeometry,
  sin,
  time,
  vec3,
} from 'three/tsl';
import { windSpeed, windStrength } from '@seedthree/core/wind.js';

type TslNode = {
  mul: (value: unknown) => TslNode;
  add: (value: unknown) => TslNode;
  div: (value: unknown) => TslNode;
  x: TslNode;
  y: TslNode;
  z: TslNode;
};

const tsl = {
  attribute: attribute as (name: string, type: string) => TslNode,
  float: float as (value: number) => TslNode,
  positionGeometry: positionGeometry as TslNode,
  sin: sin as (value: unknown) => TslNode,
  time: time as TslNode,
  vec3: vec3 as (x: unknown, y: unknown, z: unknown) => TslNode,
  windSpeed: windSpeed as unknown as TslNode,
  windStrength: windStrength as unknown as TslNode,
};

function swayAt(phaseWorld: TslNode, phaseScale: number): TslNode {
  const t = tsl.time.mul(tsl.windSpeed);
  const phase = phaseWorld.x.mul(0.35).add(phaseWorld.z.mul(0.27)).mul(phaseScale);
  return tsl.sin(t.mul(1.15).add(phase))
    .mul(0.72)
    .add(tsl.sin(t.mul(2.63).add(phase.mul(1.9))).mul(0.28));
}

/** Card foliage: rooted base (y fixed), xz bend weighted by geometry height squared. */
export function createRootedFoliageWindPosition(bladeHeight = 1, ampScale = 0.18): TslNode {
  const geo = tsl.positionGeometry;
  const heightNorm = geo.y.div(tsl.float(bladeHeight));
  const k = heightNorm.mul(heightNorm);
  const amp = tsl.windStrength.mul(ampScale);
  const anchorWorld = tsl.attribute('aAnchorPos', 'vec3');
  const gust = swayAt(anchorWorld, 2).mul(amp);
  const jitterT = tsl.time
    .mul(tsl.windSpeed)
    .mul(3)
    .add(anchorWorld.z.mul(1.7))
    .add(anchorWorld.x.mul(1.3));
  const jitter = tsl.sin(jitterT).mul(amp).mul(0.2);
  const bend = gust.add(jitter).mul(k);
  const windLocal = tsl.attribute('aWindVec', 'vec3');
  return tsl.vec3(
    geo.x.add(windLocal.x.mul(bend)),
    geo.y,
    geo.z.add(windLocal.z.mul(bend)),
  );
}
