import type { BurgageZoneState } from '../resources/types.ts';
import type { Point2 } from '../utils/polygonGeometry.ts';
import {
  computeBurgageLayout,
  cornersFromPoints,
  type BurgageLayoutResult,
} from './burgageLayout.ts';

export function layoutFromBurgageZone(zone: BurgageZoneState): BurgageLayoutResult | null {
  const corners = cornersFromPoints([
    zone.cornerA,
    zone.cornerB,
    zone.cornerC,
    zone.cornerD,
  ]);
  if (!corners) return null;
  return computeBurgageLayout(corners, zone.frontageEdge, zone.plotCount);
}

export function occupiedParcelPolygonsForZone(
  zone: BurgageZoneState,
  parcelIndices: ReadonlySet<number>,
): Point2[][] {
  const layout = layoutFromBurgageZone(zone);
  if (!layout) return [];
  return layout.parcels
    .filter((parcel) => parcelIndices.has(parcel.index))
    .map((parcel) => parcel.polygon);
}

function occupiedParcelIndicesByZone(
  residences: Iterable<{ zoneId: string; parcelIndex: number }>,
): Map<string, Set<number>> {
  const byZone = new Map<string, Set<number>>();
  for (const residence of residences) {
    let parcelIndices = byZone.get(residence.zoneId);
    if (!parcelIndices) {
      parcelIndices = new Set();
      byZone.set(residence.zoneId, parcelIndices);
    }
    parcelIndices.add(residence.parcelIndex);
  }
  return byZone;
}

export function collectOccupiedParcelPolygons(
  zones: Iterable<BurgageZoneState>,
  residences: Iterable<{ zoneId: string; parcelIndex: number }>,
): Point2[][] {
  const occupiedByZone = occupiedParcelIndicesByZone(residences);
  const polygons: Point2[][] = [];
  for (const zone of zones) {
    const occupied = occupiedByZone.get(zone.id);
    if (!occupied || occupied.size === 0) continue;
    polygons.push(...occupiedParcelPolygonsForZone(zone, occupied));
  }
  return polygons;
}
