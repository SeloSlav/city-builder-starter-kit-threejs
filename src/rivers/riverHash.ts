export function hashF64(seed: number, x: number, z: number): number {
  let h = Math.imul((seed + x) | 0, 0x85ebca6b);
  h = Math.imul((h + z) | 0, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}
