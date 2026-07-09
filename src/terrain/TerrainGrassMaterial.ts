import { MeshStandardNodeMaterial } from 'three/webgpu';
import { float, max, normalMap, texture, uv, vertexColor } from 'three/tsl';
import type { TerrainBlendTextureSet } from '../roads/RoadTextureLoader.ts';

type TslNode = {
  add(value: TslNode): TslNode;
  div(value: TslNode): TslNode;
  mul(value: TslNode): TslNode;
  r: TslNode;
  rgb: TslNode;
  xyz: TslNode;
  x: TslNode;
  y: TslNode;
  z: TslNode;
};

function buildGrassBlendNodes(textures: TerrainBlendTextureSet) {
  const grassUv = uv() as TslNode;
  const weightsRaw = (vertexColor() as TslNode).xyz;
  const weightSum = max(weightsRaw.x.add(weightsRaw.y).add(weightsRaw.z), float(0.0001) as TslNode) as TslNode;
  const w = weightsRaw.div(weightSum);

  const meadowColor = texture(textures.meadow.albedo, grassUv) as TslNode;
  const denseColor = texture(textures.dense.albedo, grassUv) as TslNode;
  const dryColor = texture(textures.dry.albedo, grassUv) as TslNode;
  const colorNode = meadowColor.rgb
    .mul(w.x)
    .add(denseColor.rgb.mul(w.y))
    .add(dryColor.rgb.mul(w.z));

  const meadowNormal = texture(textures.meadow.normal, grassUv) as TslNode;
  const denseNormal = texture(textures.dense.normal, grassUv) as TslNode;
  const dryNormal = texture(textures.dry.normal, grassUv) as TslNode;
  const blendedNormalSample = meadowNormal.mul(w.x).add(denseNormal.mul(w.y)).add(dryNormal.mul(w.z));
  const normalNode = normalMap(blendedNormalSample);

  const meadowRoughness = (texture(textures.meadow.roughness, grassUv) as TslNode).r;
  const denseRoughness = (texture(textures.dense.roughness, grassUv) as TslNode).r;
  const dryRoughness = (texture(textures.dry.roughness, grassUv) as TslNode).r;
  const roughnessNode = meadowRoughness.mul(w.x).add(denseRoughness.mul(w.y)).add(dryRoughness.mul(w.z));

  const meadowAo = (texture(textures.meadow.ao!, grassUv) as TslNode).r;
  const denseAo = (texture(textures.dense.ao!, grassUv) as TslNode).r;
  const dryAo = (texture(textures.dry.ao!, grassUv) as TslNode).r;
  const aoNode = meadowAo.mul(w.x).add(denseAo.mul(w.y)).add(dryAo.mul(w.z));

  return { colorNode, normalNode, roughnessNode, aoNode };
}

export function createTerrainGrassMaterial(textures: TerrainBlendTextureSet): MeshStandardNodeMaterial {
  const blendNodes = buildGrassBlendNodes(textures);
  const material = new MeshStandardNodeMaterial();
  material.name = 'Grass blend terrain';
  material.color.set(0xffffff);
  material.roughness = 1;
  material.metalness = 0;
  material.colorNode = blendNodes.colorNode;
  material.normalNode = blendNodes.normalNode;
  material.roughnessNode = blendNodes.roughnessNode;
  material.aoNode = blendNodes.aoNode;
  return material;
}
