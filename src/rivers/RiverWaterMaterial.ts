import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { attribute, float, pow, vertexColor } from 'three/tsl';

type TslNode = {
  mul(value: TslNode): TslNode;
};

const WATER_BASE_OPACITY = 0.86;

let sharedWaterMaterial: MeshStandardNodeMaterial | null = null;

export function getSharedRiverWaterMaterial(): MeshStandardNodeMaterial {
  if (!sharedWaterMaterial) {
    const featherAlpha = attribute('featherAlpha', 'float') as TslNode;
    const alphaFeather = pow(featherAlpha, float(0.76) as TslNode) as TslNode;

    const material = new MeshStandardNodeMaterial();
    material.name = 'RiverWaterMaterial';
    material.color.set(0xffffff);
    material.vertexColors = true;
    material.transparent = true;
    material.opacity = 1;
    material.roughness = 0.42;
    material.metalness = 0;
    material.depthWrite = false;
    material.depthTest = true;
    material.side = THREE.FrontSide;
    material.polygonOffset = true;
    material.polygonOffsetFactor = -2;
    material.polygonOffsetUnits = -2;
    material.colorNode = vertexColor();
    material.opacityNode = (float(WATER_BASE_OPACITY) as TslNode).mul(alphaFeather);
    sharedWaterMaterial = material;
  }
  return sharedWaterMaterial;
}

export function disposeSharedRiverWaterMaterial(): void {
  sharedWaterMaterial?.dispose();
  sharedWaterMaterial = null;
}
