declare module 'three/tsl' {
  import type * as THREE from 'three';

  export const cameraPosition: unknown;
  export const positionWorld: unknown;

  export function pass(
    scene: THREE.Object3D,
    camera: THREE.Camera,
  ): {
    dispose(): void;
    getTextureNode(name?: string): {
      add(value: unknown): unknown;
    };
  };

  export function uniform<T>(value: T): { value: T };
  export function uv(): unknown;
  export function wgslFn(code: string, includes?: unknown[]): (params: Record<string, unknown>) => unknown;
  export function texture(texture: THREE.Texture, uvNode?: unknown): unknown;
  export function vertexColor(index?: number): unknown;
  export function normalMap(node: unknown, scaleNode?: unknown): unknown;
  export function float(value: number): unknown;
  export function max(a: unknown, b: unknown): unknown;
  export function mix(a: unknown, b: unknown, t: unknown): unknown;
  export function vec3(x: unknown, y?: unknown, z?: unknown): unknown;
}
