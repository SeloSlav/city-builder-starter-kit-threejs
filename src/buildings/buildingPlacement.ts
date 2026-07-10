export function buildingPlacementYaw(x: number, z: number): number {
  return (Math.abs(Math.floor(Math.sin(x * 0.017 + z * 0.013) * 6283)) % 360) * (Math.PI / 180);
}
