import { computeForestTreePlacements } from '../props/ForestProps.ts';
import { QuarryLayout } from '../quarries/QuarryLayout.ts';
import { RiverField } from '../rivers/RiverField.ts';
import { RiverLayout } from '../rivers/RiverLayout.ts';
import { treeWoodYield } from '../resources/treeYield.ts';
import { DEFAULT_WORLD_SEED } from '../resources/WorldLayout.ts';
import { WorldLayoutRegistry } from '../resources/WorldLayoutRegistry.ts';
import { Terrain } from '../terrain/Terrain.ts';

export type WorldBootstrapQuarry = {
  quarryId: string;
  x: number;
  z: number;
  maxYield: number;
};

export type WorldBootstrapTree = {
  treeId: string;
  layoutIndex: number;
  woodYield: number;
  x: number;
  z: number;
};

export type WorldBootstrapData = {
  seed: number;
  quarries: WorldBootstrapQuarry[];
  trees: WorldBootstrapTree[];
};

/** Headless bootstrap for scripts — rebuilds river/quarry blocking without full terrain mesh. */
export function computeWorldBootstrapDataHeadless(seed = DEFAULT_WORLD_SEED): WorldBootstrapData {
  const riverBounds = Terrain.fullBounds();
  const riverLayout = RiverLayout.create({ bounds: riverBounds });
  const quarryLayout = QuarryLayout.create({
    bounds: riverBounds,
    seed,
    riverLayout,
    playableHalf: 410,
  });
  const worldLayout = { seed, quarryLayout, riverLayout, forestCores: [] as never[] };
  const registry = WorldLayoutRegistry.fromWorldLayout(worldLayout);
  const riverField = RiverField.fromLayout({ bounds: riverBounds, layout: riverLayout });
  const isBlockedAt = (x: number, z: number) =>
    riverField.isBlockedForProps(x, z) || quarryLayout.isBlockedForProps(x, z);

  const quarries: WorldBootstrapQuarry[] = registry.definitionList.map((definition) => ({
    quarryId: definition.id,
    x: definition.x,
    z: definition.z,
    maxYield: definition.maxYield,
  }));

  const treePlacements = computeForestTreePlacements(820, 1080, isBlockedAt);
  const trees: WorldBootstrapTree[] = treePlacements.map((placement, layoutIndex) => ({
    treeId: `tree-${layoutIndex}`,
    layoutIndex,
    x: placement.x,
    z: placement.z,
    woodYield: treeWoodYield({
      form: placement.form,
      species: placement.species,
      scale: placement.scale,
    }),
  }));

  return { seed, quarries, trees };
}
