import {
  HOUSE_SETBACK,
  MAIN_HOUSE_DEPTH,
  distancePointToSegment,
} from './burgageLayout.ts';
import { layoutFromBurgageZone } from './burgageZoneLayout.ts';
import type { BurgageZoneState, ResidenceState } from '../resources/types.ts';

/** World position for the backyard map icon — behind the house, mid-backyard. */
export function backyardIconPosition(
  residence: ResidenceState,
  zone: BurgageZoneState,
): { x: number; z: number } | null {
  const layout = layoutFromBurgageZone(zone);
  if (!layout) return null;

  const parcel = layout.parcels.find((entry) => entry.index === residence.parcelIndex);
  if (!parcel || parcel.backyardArea < 2) return null;

  const parcelDepth = Math.min(
    distancePointToSegment(parcel.frontLeft, parcel.polygon[2], parcel.polygon[3]),
    distancePointToSegment(parcel.frontRight, parcel.polygon[2], parcel.polygon[3]),
  );
  const backyardDepth = Math.max(0, parcelDepth - HOUSE_SETBACK - MAIN_HOUSE_DEPTH);
  if (backyardDepth < 1.5) return null;

  const offset = MAIN_HOUSE_DEPTH * 0.5 + backyardDepth * 0.5;
  return {
    x: residence.x - Math.sin(residence.yaw) * offset,
    z: residence.z - Math.cos(residence.yaw) * offset,
  };
}
