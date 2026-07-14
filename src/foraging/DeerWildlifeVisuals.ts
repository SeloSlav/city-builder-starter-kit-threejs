import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mulberry32 } from '../props/forestField.ts';
import type { Terrain } from '../terrain/Terrain.ts';
import type { ForagingSite } from './ForagingLayout.ts';
import {
  chooseInitialDeerMode,
  chooseRestDuration,
  type DeerBehaviorMode,
  type DeerMotionState,
  type DeerObserver,
  updateDeerMotion,
} from './DeerWildlifeBehavior.ts';

type DeerAnimationSet = {
  idle: THREE.AnimationAction;
  graze: THREE.AnimationAction;
  walk: THREE.AnimationAction;
  flee: THREE.AnimationAction;
};

type DeerVisual = {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: DeerAnimationSet;
  activeMode: DeerBehaviorMode;
  motion: DeerMotionState;
};

export type DeerWildlifeVisuals = {
  group: THREE.Group;
  deerCount: number;
  update: (
    dtSeconds: number,
    firstPersonObserver: DeerObserver | null,
    cameraDistance: number,
  ) => void;
  dispose: () => void;
};

const DEER_MODEL_URL = '/assets/models/deer/quaternius-deer.glb';
const DEER_PER_GAME_SITE = 5;
const HERD_SPAWN_RADIUS = 12;
const DEER_TARGET_HEIGHT = 1.7;
const CLOSE_WORLD_MAX_CAMERA_DISTANCE = 210;
const TAU = Math.PI * 2;

/**
 * Adds a small animated herd to each authoritative game-resource site. The static
 * map marker remains owned by ForagingMapIcons; this is only its close-world form.
 */
export async function createDeerWildlifeVisuals(
  terrain: Terrain,
  sites: ReadonlyArray<ForagingSite>,
  seed: number,
  isBlockedAt?: (x: number, z: number) => boolean,
): Promise<DeerWildlifeVisuals> {
  const gameSites = sites.filter((site) => site.kind === 'game');
  const group = new THREE.Group();
  group.name = 'Animated deer at game resource sites';
  group.userData.gameResourceCenters = gameSites.map((site, index) => ({
    nodeId: `foraging-game-${index}`,
    x: site.x,
    z: site.z,
  }));

  if (gameSites.length === 0) {
    return {
      group,
      deerCount: 0,
      update: () => undefined,
      dispose: () => undefined,
    };
  }

  const gltf = await new GLTFLoader().loadAsync(DEER_MODEL_URL);
  const clips = resolveAnimationClips(gltf.animations);
  const sourceBounds = new THREE.Box3().setFromObject(gltf.scene);
  const sourceHeight = sourceBounds.max.y - sourceBounds.min.y;
  if (!Number.isFinite(sourceHeight) || sourceHeight <= 0.001) {
    throw new Error('The deer model has invalid bounds.');
  }

  const rng = mulberry32(seed ^ 0xd33f51);
  const deer: DeerVisual[] = [];

  for (const site of gameSites) {
    const spawnPoints = createHerdSpawnPoints(site, rng, isBlockedAt);
    for (const spawn of spawnPoints) {
      const model = cloneSkinned(gltf.scene) as THREE.Group;
      const sizeVariation = THREE.MathUtils.lerp(0.9, 1.08, rng());
      const modelScale = (DEER_TARGET_HEIGHT / sourceHeight) * sizeVariation;
      model.scale.setScalar(modelScale);
      model.position.y = -sourceBounds.min.y * modelScale + 0.025;
      configureModelMeshes(model);

      const root = new THREE.Group();
      root.name = 'Rigged roaming deer';
      root.add(model);
      group.add(root);

      const mixer = new THREE.AnimationMixer(model);
      const actions: DeerAnimationSet = {
        idle: mixer.clipAction(clips.idle, model),
        graze: mixer.clipAction(clips.graze, model),
        walk: mixer.clipAction(clips.walk, model),
        flee: mixer.clipAction(clips.flee, model),
      };
      configureActions(actions);

      const initialMode = chooseInitialDeerMode(rng);
      const heading = rng() * TAU;
      const motion: DeerMotionState = {
        x: spawn.x,
        z: spawn.z,
        homeX: site.x,
        homeZ: site.z,
        targetX: spawn.x,
        targetZ: spawn.z,
        heading,
        speed: 0,
        mode: initialMode,
        modeTimer: chooseRestDuration(rng),
        fleeBias: THREE.MathUtils.lerp(-0.2, 0.2, rng()),
      };

      const firstAction = actions[initialMode];
      firstAction.play();
      firstAction.time = rng() * firstAction.getClip().duration;
      root.position.set(spawn.x, terrain.getHeightAt(spawn.x, spawn.z), spawn.z);
      root.rotation.y = heading;
      deer.push({ root, mixer, actions, activeMode: initialMode, motion });
    }
  }

  const update = (
    dtSeconds: number,
    firstPersonObserver: DeerObserver | null,
    cameraDistance: number,
  ): void => {
    const shouldShow = firstPersonObserver !== null || cameraDistance <= CLOSE_WORLD_MAX_CAMERA_DISTANCE;
    group.visible = shouldShow;
    if (!shouldShow) return;

    for (const visual of deer) {
      updateDeerMotion(visual.motion, dtSeconds, {
        observer: firstPersonObserver,
        random: rng,
        isBlockedAt,
      });
      if (visual.motion.mode !== visual.activeMode) transitionAnimation(visual, visual.motion.mode);

      visual.root.position.set(
        visual.motion.x,
        terrain.getHeightAt(visual.motion.x, visual.motion.z),
        visual.motion.z,
      );
      visual.root.rotation.y = visual.motion.heading;
      visual.mixer.update(Math.min(Math.max(dtSeconds, 0), 0.1));
    }
  };

  return {
    group,
    deerCount: deer.length,
    update,
    dispose: () => {
      for (const visual of deer) {
        visual.mixer.stopAllAction();
        visual.mixer.uncacheRoot(visual.root.children[0]);
      }
      group.clear();
      disposeModelResources(gltf.scene);
    },
  };
}

function resolveAnimationClips(animations: ReadonlyArray<THREE.AnimationClip>): {
  idle: THREE.AnimationClip;
  graze: THREE.AnimationClip;
  walk: THREE.AnimationClip;
  flee: THREE.AnimationClip;
} {
  const directClips = new Map(
    animations
      .filter((clip) => !clip.name.includes('|'))
      .map((clip) => [clip.name.toLowerCase(), clip]),
  );
  const requireClip = (name: string): THREE.AnimationClip => {
    const clip = directClips.get(name.toLowerCase());
    if (!clip) throw new Error(`The deer model is missing its ${name} animation.`);
    return clip;
  };

  return {
    idle: requireClip('Idle'),
    graze: requireClip('Eating'),
    walk: requireClip('Walk'),
    flee: requireClip('Gallop'),
  };
}

function createHerdSpawnPoints(
  site: ForagingSite,
  random: () => number,
  isBlockedAt?: (x: number, z: number) => boolean,
): Array<{ x: number; z: number }> {
  const points: Array<{ x: number; z: number }> = [];
  let attempts = 0;
  while (points.length < DEER_PER_GAME_SITE && attempts < DEER_PER_GAME_SITE * 20) {
    attempts++;
    const radius = points.length === 0 ? 2.5 : Math.sqrt(random()) * HERD_SPAWN_RADIUS;
    const angle = random() * TAU;
    const x = site.x + Math.sin(angle) * radius;
    const z = site.z + Math.cos(angle) * radius;
    if (isBlockedAt?.(x, z)) continue;
    if (points.some((point) => Math.hypot(point.x - x, point.z - z) < 2.7)) continue;
    points.push({ x, z });
  }

  if (points.length === 0) points.push({ x: site.x, z: site.z });
  return points;
}

function configureModelMeshes(model: THREE.Object3D): void {
  model.traverse((child) => {
    const mesh = child as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
  });
}

function configureActions(actions: DeerAnimationSet): void {
  for (const action of Object.values(actions)) {
    action.setLoop(THREE.LoopRepeat, Number.POSITIVE_INFINITY);
    action.enabled = true;
    action.clampWhenFinished = false;
  }
  actions.walk.setEffectiveTimeScale(1.05);
  actions.flee.setEffectiveTimeScale(1.12);
}

function transitionAnimation(visual: DeerVisual, nextMode: DeerBehaviorMode): void {
  const previous = visual.actions[visual.activeMode];
  const next = visual.actions[nextMode];
  previous.fadeOut(0.22);
  next.reset().fadeIn(0.22).play();
  visual.activeMode = nextMode;
}

function disposeModelResources(source: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  source.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of meshMaterials) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });

  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}
