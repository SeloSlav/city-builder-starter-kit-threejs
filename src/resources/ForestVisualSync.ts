import type { ForestManager } from '../props/ForestManager.ts';
import type { GameState, TreeEntityState } from './types.ts';

export class ForestVisualSync {
  private readonly forestManager: ForestManager;

  constructor(forestManager: ForestManager) {
    this.forestManager = forestManager;
  }

  syncAll(trees: Map<string, TreeEntityState>): void {
    for (const entity of trees.values()) {
      this.syncTree(entity);
    }
  }

  syncTrees(trees: Map<string, TreeEntityState>, treeIds: string[]): void {
    for (const treeId of treeIds) {
      const entity = trees.get(treeId);
      if (entity) this.syncTree(entity);
    }
  }

  private syncTree(entity: TreeEntityState): void {
    this.forestManager.applyTreePhase(entity.layoutIndex, entity.phase, entity.regrowProgress);
  }
}

export function countTreesNearBuilding(
  state: GameState,
  treeRegistry: { treesInRadius(x: number, z: number, radius: number): { id: string }[] },
  x: number,
  z: number,
  radius: number,
): { standing: number; felled: number; regrowing: number } {
  let standing = 0;
  let felled = 0;
  let regrowing = 0;

  for (const entry of treeRegistry.treesInRadius(x, z, radius)) {
    const entity = state.trees.get(entry.id);
    if (!entity) continue;
    switch (entity.phase) {
      case 'standing':
      case 'felling':
        standing++;
        break;
      case 'felled':
        felled++;
        break;
      case 'regrowing':
        regrowing++;
        break;
      default: {
        const unreachable: never = entity.phase;
        return unreachable;
      }
    }
  }

  return { standing, felled, regrowing };
}
