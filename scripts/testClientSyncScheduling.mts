import assert from 'node:assert/strict';
import * as THREE from 'three';
import { syncSettlementWorld } from '../src/app/settlementWorldSync.ts';
import { GameTableSync } from '../src/data/spacetimeTableSync/gameTableSync.ts';
import { ForestManager } from '../src/props/ForestManager.ts';
import { createStubForestInstances } from '../src/props/forestInstanceStub.ts';
import type { GameState } from '../src/resources/types.ts';
import type { RoadNetwork } from '../src/roads/RoadNetwork.ts';

await testTableCallbackCoalescing();
testPlacementClearanceKeepsRoadWorkCached();
testSettlementSyncSkipsUnchangedDomains();

console.log('client sync scheduling tests passed');

async function testTableCallbackCoalescing(): Promise<void> {
  const callbacks: {
    insert?: () => void;
    update?: () => void;
    delete?: () => void;
  } = {};
  let tableRebuilds = 0;
  let notifications = 0;
  const owner = { toHexString: () => 'owner' };
  const row = {
    id: 1n,
    owner,
    kind: 'lumber_mill',
    x: 1,
    z: 2,
    workRadius: 3,
    actionCooldown: 0,
    timber: 0,
    firewood: 0,
    stone: 0,
    water: 0,
    food: 0,
    grain: 0,
    flour: 0,
    ale: 0,
    preservedFood: 0,
    honey: 0,
    wine: 0,
    gold: 0,
    waterCapacity: 0,
    assignedLabor: 0n,
    storehouseAcceptsTimber: true,
    storehouseAcceptsStone: true,
    storehouseAcceptsFirewood: true,
  };
  const buildingTable = {
    iter: () => {
      tableRebuilds += 1;
      return [row];
    },
    onInsert: (callback: () => void) => {
      callbacks.insert = callback;
    },
    onUpdate: (callback: () => void) => {
      callbacks.update = callback;
    },
    onDelete: (callback: () => void) => {
      callbacks.delete = callback;
    },
  };
  const state = {
    identityHex: 'owner',
    simTick: 0,
    worldGeneration: null,
    stockpile: {},
    economicActivityTaxRate: 0,
    parishPolicy: {},
    monasteryPolicy: {},
    marketState: {},
    quarries: new Map(),
    foragingNodes: new Map(),
    trees: new Map(),
    buildings: new Map(),
    farmFields: new Map(),
    pastures: new Map(),
    livestockHerds: new Map(),
    burgageZones: new Map(),
    residences: new Map(),
    backyardGardens: new Map(),
    deliveryTrips: new Map(),
    roads: null,
  };

  const sync = new GameTableSync(
    state as ConstructorParameters<typeof GameTableSync>[0],
    () => {
      notifications += 1;
    },
  );
  sync.attachHandlers({
    db: { building: buildingTable },
  } as Parameters<GameTableSync['attachHandlers']>[0]);

  for (let index = 0; index < 100; index++) callbacks.update?.();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(tableRebuilds, 1, 'one table burst should rebuild the table once');
  assert.equal(notifications, 1, 'one table burst should notify app listeners once');
  assert.equal(state.buildings.size, 1);
}

function testPlacementClearanceKeepsRoadWorkCached(): void {
  const placements = Array.from({ length: 80 }, (_, index) => ({
    x: (index % 10) * 8 - 40,
    z: Math.floor(index / 10) * 8 - 32,
    form: index % 3 === 0 ? 'broad' as const : 'narrow' as const,
    species: 'scotsPine',
    scale: 1,
  }));
  const forestInstances = createStubForestInstances(placements);
  let roadPathReads = 0;
  const points = [
    new THREE.Vector3(-80, 0, 0),
    new THREE.Vector3(80, 0, 0),
  ];
  const edge = {
    width: 4,
    get sampledPath() {
      roadPathReads += 1;
      return points;
    },
    controlPoints: points,
  };
  const network = {
    edges: new Map([['road-1', edge]]),
  } as unknown as RoadNetwork;
  const manager = new ForestManager(
    new THREE.Group(),
    forestInstances,
    { group: new THREE.Group(), instances: [] },
    null,
    [],
    { getHeightAt: () => 0 } as never,
    () => {},
    {
      hideTree: () => {},
      showTree: () => {},
      commit: () => {},
      setShadows: () => {},
      dispose: () => {},
    },
  );

  manager.syncRoadClearance(network);
  assert.ok(roadPathReads > 0, 'road sync should evaluate road paths');
  roadPathReads = 0;
  manager.syncPlacementClearance({
    buildings: [{ kind: 'lumber_mill', x: 0, z: 0 }],
  });
  assert.equal(
    roadPathReads,
    0,
    'building placement should reuse the existing road-clearance result',
  );
}

function testSettlementSyncSkipsUnchangedDomains(): void {
  const previous = emptyGameState();
  const current = {
    ...previous,
    tick: previous.tick + 1,
    buildings: new Map(previous.buildings),
  };
  const calls = {
    residences: 0,
    fields: 0,
    pastures: 0,
    livestock: 0,
    gardens: 0,
    deliveries: 0,
    villagers: 0,
  };
  const targets = {
    residenceMarkers: { syncResidences: () => { calls.residences += 1; } },
    farmFieldMarkers: { syncFields: () => { calls.fields += 1; } },
    pastureMarkers: { syncPastures: () => { calls.pastures += 1; } },
    livestockVisuals: { sync: () => { calls.livestock += 1; } },
    backyardGardenMarkers: { syncGardens: () => { calls.gardens += 1; } },
    deliveryAgents: {
      syncTrips: () => { calls.deliveries += 1; },
      applyTripStates: () => {},
    },
    villagers: { sync: () => { calls.villagers += 1; } },
    getHeightAt: () => 0,
    getRoadNetwork: () => null,
  };

  syncSettlementWorld(targets as never, current, previous);
  assert.deepEqual(calls, {
    residences: 0,
    fields: 0,
    pastures: 0,
    livestock: 0,
    gardens: 0,
    deliveries: 0,
    villagers: 0,
  });
}

function emptyGameState(): GameState {
  return {
    seed: 1,
    tick: 0,
    stockpile: {
      timber: 0,
      stone: 0,
      firewood: 0,
      water: 0,
      game: 0,
      berries: 0,
      food: 0,
      grain: 0,
      flour: 0,
      ale: 0,
      preservedFood: 0,
      honey: 0,
      wine: 0,
      gold: 0,
    },
    quarries: new Map(),
    foragingNodes: new Map(),
    trees: new Map(),
    buildings: new Map(),
    farmFields: new Map(),
    pastures: new Map(),
    livestockHerds: new Map(),
    burgageZones: new Map(),
    residences: new Map(),
    backyardGardens: new Map(),
    deliveryTrips: new Map(),
    nextBuildingId: 1,
  };
}
