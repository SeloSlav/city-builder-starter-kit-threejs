import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  DEER_FLEE_TRIGGER_DISTANCE,
  DEER_ROAM_RADIUS,
  type DeerMotionState,
  updateDeerMotion,
} from '../src/foraging/DeerWildlifeBehavior.ts';

function fixedRandom(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index++;
    return value;
  };
}

function createMotion(overrides: Partial<DeerMotionState> = {}): DeerMotionState {
  return {
    x: 0,
    z: 0,
    homeX: 0,
    homeZ: 0,
    targetX: 0,
    targetZ: 0,
    heading: 0,
    speed: 0,
    mode: 'idle',
    modeTimer: 4,
    fleeBias: 0,
    ...overrides,
  };
}

{
  const motion = createMotion({ modeTimer: 0.01 });
  const random = fixedRandom([0.15, 0.2, 0.72, 0.4, 0.65, 0.3]);
  for (let frame = 0; frame < 600; frame++) {
    updateDeerMotion(motion, 1 / 60, { observer: null, random });
  }
  assert.ok(Math.hypot(motion.x, motion.z) > 0.5, 'an undisturbed deer should roam away from its spawn');
  assert.ok(
    Math.hypot(motion.x - motion.homeX, motion.z - motion.homeZ) <= DEER_ROAM_RADIUS + 1,
    'ordinary roaming should stay near the game resource',
  );
  assert.notEqual(motion.mode, 'flee', 'orbit-camera observation must not scare deer');
}

{
  const motion = createMotion();
  const observer = { x: DEER_FLEE_TRIGGER_DISTANCE * 0.4, z: 0 };
  const initialDistance = Math.hypot(motion.x - observer.x, motion.z - observer.z);
  const random = fixedRandom([0.2, 0.7, 0.4, 0.8]);
  for (let frame = 0; frame < 120; frame++) {
    updateDeerMotion(motion, 1 / 60, { observer, random });
  }
  const escapedDistance = Math.hypot(motion.x - observer.x, motion.z - observer.z);
  assert.equal(motion.mode, 'flee', 'a close first-person observer should trigger fleeing');
  assert.ok(escapedDistance > initialDistance + 6, 'the deer should sprint away from the observer');
  assert.ok(motion.speed > 6, 'fleeing should reach gallop speed');

  updateDeerMotion(motion, 1 / 60, { observer: null, random });
  assert.equal(motion.mode, 'walk', 'deer should return to roaming when the observer is gone');
}

const modelBytes = fs.readFileSync('public/assets/models/deer/quaternius-deer.glb');
const modelBuffer = modelBytes.buffer.slice(
  modelBytes.byteOffset,
  modelBytes.byteOffset + modelBytes.byteLength,
) as ArrayBuffer;
const gltf = await new Promise<Awaited<ReturnType<GLTFLoader['loadAsync']>>>((resolve, reject) => {
  new GLTFLoader().parse(modelBuffer, '', resolve, reject);
});

const directClipNames = new Set(
  gltf.animations.filter((clip) => !clip.name.includes('|')).map((clip) => clip.name),
);
for (const clipName of ['Idle', 'Eating', 'Walk', 'Gallop']) {
  assert.ok(directClipNames.has(clipName), `deer GLB should contain the ${clipName} clip`);
}

let sourceSkinnedMesh: THREE.SkinnedMesh | null = null;
gltf.scene.traverse((object) => {
  const skinnedMesh = object as THREE.SkinnedMesh;
  if (!sourceSkinnedMesh && skinnedMesh.isSkinnedMesh) sourceSkinnedMesh = skinnedMesh;
});
assert.ok(sourceSkinnedMesh, 'deer GLB should contain a skinned mesh');
assert.ok(sourceSkinnedMesh.skeleton.bones.length >= 40, 'deer GLB should retain its full articulated rig');

const clonedScene = cloneSkinned(gltf.scene);
let clonedSkinnedMesh: THREE.SkinnedMesh | null = null;
clonedScene.traverse((object) => {
  const skinnedMesh = object as THREE.SkinnedMesh;
  if (!clonedSkinnedMesh && skinnedMesh.isSkinnedMesh) clonedSkinnedMesh = skinnedMesh;
});
assert.ok(clonedSkinnedMesh, 'the runtime clone should remain skinned');
assert.notEqual(
  clonedSkinnedMesh.skeleton,
  sourceSkinnedMesh.skeleton,
  'each deer should receive an independent skeleton for animation',
);

const mapIconSource = fs.readFileSync('src/map/ForagingMapIcons.ts', 'utf8');
assert.match(mapIconSource, /GAME_ICON_SVG/, 'the high-zoom game resource marker should remain defined');
assert.match(
  mapIconSource,
  /foraging-map-icon--game/,
  'the game resource should retain its own static map-marker style',
);

console.log('test:deer-wildlife passed');
