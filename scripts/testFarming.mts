import assert from 'node:assert/strict';
import {
  FARM_LARGE_FIELD_EFFICIENCY_FLOOR,
  FARM_MIN_FIELD_AREA,
  FARM_MIN_FIELD_EDGE,
  FARM_OPTIMAL_FIELD_AREA,
  GRANARY_FIREWOOD_PER_CYCLE,
  GRANARY_WATER_PER_CYCLE,
  MILL_WATER_PER_HARVEST,
  WATERMILL_WATER_PER_CYCLE,
} from '../src/generated/gameBalance.ts';
import {
  expectedFieldYield,
  fieldArea,
  fieldEdgeLengths,
  fieldShapeEfficiency,
  fieldSizeEfficiency,
  moistureSuitability,
  rectangleFromBaseline,
  sampleAverageSlopeDegrees,
} from '../src/farming/farmFieldMath.ts';
import { sampleAuthoritativeHydrologyScore } from '../src/hydrology/sampleAuthoritativeHydrology.ts';

const rectangle = rectangleFromBaseline(
  { x: 0, z: 0 },
  { x: 20, z: 0 },
  { x: 5, z: 20 },
);
assert.ok(rectangle, 'three points should produce a rectangle');
assert.equal(fieldArea(rectangle), 400);
assert.deepEqual(fieldEdgeLengths(rectangle).map(Math.round), [20, 20, 20, 20]);
assert.equal(fieldShapeEfficiency(rectangle), 1);
assert.equal(sampleAverageSlopeDegrees(rectangle, () => 10), 0);
assert.ok(sampleAuthoritativeHydrologyScore(0, 0) >= 0 && sampleAuthoritativeHydrologyScore(0, 0) <= 1);
assert.equal(sampleAuthoritativeHydrologyScore(10_000, 10_000), 0);

const ryeDry = moistureSuitability('rye', 0.38);
const oatsDry = moistureSuitability('oats', 0.38);
const oatsWet = moistureSuitability('oats', 0.58);
assert.ok(ryeDry > oatsDry, 'rye should be the better crop on drier ground');
assert.ok(oatsWet > moistureSuitability('rye', 0.58), 'oats should be the better crop on wetter ground');

const goodYield = expectedFieldYield({
  area: 400,
  crop: 'rye',
  moisture: 0.38,
  fertility: 0.9,
  averageSlopeDegrees: 2,
  corners: rectangle,
});
const poorYield = expectedFieldYield({
  area: 400,
  crop: 'rye',
  moisture: 0.95,
  fertility: 0.4,
  averageSlopeDegrees: 15,
  corners: rectangle,
});
assert.ok(goodYield > poorYield * 3, 'hydrology, fertility, and slope should materially affect harvests');
assert.equal(expectedFieldYield({ area: 400, crop: 'fallow', moisture: 0.5, fertility: 0.5, averageSlopeDegrees: 0, corners: rectangle }), 0);

assert.ok(FARM_MIN_FIELD_AREA >= FARM_MIN_FIELD_EDGE ** 2);
assert.ok(FARM_OPTIMAL_FIELD_AREA >= 20 * FARM_MIN_FIELD_AREA);
assert.equal(fieldSizeEfficiency(FARM_OPTIMAL_FIELD_AREA), 1);
assert.ok(fieldSizeEfficiency(FARM_OPTIMAL_FIELD_AREA * 2) < 1);
assert.ok(fieldSizeEfficiency(FARM_OPTIMAL_FIELD_AREA * 2) > FARM_LARGE_FIELD_EFFICIENCY_FLOOR);
assert.equal(fieldSizeEfficiency(FARM_OPTIMAL_FIELD_AREA * 1e12), FARM_LARGE_FIELD_EFFICIENCY_FLOOR);

const optimalSide = Math.sqrt(FARM_OPTIMAL_FIELD_AREA);
const optimalRectangle = rectangleFromBaseline(
  { x: 0, z: 0 },
  { x: optimalSide, z: 0 },
  { x: 0, z: optimalSide },
);
const largeSide = Math.sqrt(FARM_OPTIMAL_FIELD_AREA * 2);
const largeRectangle = rectangleFromBaseline(
  { x: 0, z: 0 },
  { x: largeSide, z: 0 },
  { x: 0, z: largeSide },
);
assert.ok(optimalRectangle && largeRectangle);
const optimalYield = expectedFieldYield({
  area: FARM_OPTIMAL_FIELD_AREA,
  crop: 'rye',
  moisture: 0.38,
  fertility: 1,
  averageSlopeDegrees: 0,
  corners: optimalRectangle,
});
const largeYield = expectedFieldYield({
  area: FARM_OPTIMAL_FIELD_AREA * 2,
  crop: 'rye',
  moisture: 0.38,
  fertility: 1,
  averageSlopeDegrees: 0,
  corners: largeRectangle,
});
assert.ok(largeYield > optimalYield, 'oversized fields should remain useful and produce more total grain');
assert.ok(largeYield / (FARM_OPTIMAL_FIELD_AREA * 2) < optimalYield / FARM_OPTIMAL_FIELD_AREA, 'oversized fields should yield less grain per square metre');
assert.equal(MILL_WATER_PER_HARVEST, 0, 'lumber should not consume well water');
assert.equal(WATERMILL_WATER_PER_CYCLE, 0, 'a river-powered mill should not consume well water');
assert.ok(GRANARY_WATER_PER_CYCLE > 0, 'bakery production should consume well water');
assert.ok(GRANARY_FIREWOOD_PER_CYCLE > 0, 'bakery production should consume fuel');

console.log('farming and water-chain tests passed');
