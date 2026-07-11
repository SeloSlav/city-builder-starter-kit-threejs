import * as THREE from 'three';
import { addTriangularGableWall } from '../meshPrimitives.ts';
import {
  addMesh,
  metalMaterial,
  quarryRockMaterial,
  tileMaterial,
  timberMaterial,
} from '../buildingMaterials.ts';
function addStoneBlockPile(
  group: THREE.Group,
  baseX: number,
  baseZ: number,
  floorY: number,
  pileRows: number,
  blockLength: number,
  blockWidth: number,
  blockHeight: number,
): void {
  const rowSpacing = blockHeight * 1.06;
  const colSpacing = blockLength * 1.1;

  for (let row = 0; row < pileRows; row++) {
    const blocksInRow = pileRows - row;
    const rowY = floorY + blockHeight * 0.5 + row * rowSpacing;
    const rowSpan = (blocksInRow - 1) * colSpacing;
    for (let col = 0; col < blocksInRow; col++) {
      const shade = (row + col) % 3 === 0 ? 'light' : (row + col) % 2 === 0 ? 'mid' : 'dark';
      const heightJitter = blockHeight * (0.94 + ((row + col) % 4) * 0.03);
      const widthJitter = blockWidth * (0.96 + ((col + 1) % 3) * 0.04);
      addMesh(
        group,
        new THREE.BoxGeometry(widthJitter, heightJitter, blockLength * 0.97),
        quarryRockMaterial(shade),
        new THREE.Vector3(
          baseX + ((col % 2) - 0.5) * 0.05,
          rowY,
          baseZ - rowSpan * 0.5 + col * colSpacing,
        ),
        new THREE.Euler(0, ((row + col) % 5) * 0.018 - 0.036, 0),
      );
    }
  }
}

/** Two wide blocks on the bottom, one centered on top — mirrors the lumber log pyramid. */
function addStoneBlockPyramid(
  group: THREE.Group,
  centerX: number,
  baseZ: number,
  floorY: number,
  blockLength: number,
  blockWidth: number,
  blockHeight: number,
): void {
  const spacing = blockLength * 1.12;
  const rowSpacing = blockHeight * 1.08;
  const bottomY = floorY + blockHeight * 0.5;

  for (const [col, zOffset] of [[0, -0.5], [1, 0.5]] as const) {
    addMesh(
      group,
      new THREE.BoxGeometry(blockWidth, blockHeight, blockLength),
      quarryRockMaterial(col === 0 ? 'mid' : 'dark'),
      new THREE.Vector3(centerX, bottomY, baseZ + zOffset * spacing),
    );
  }

  addMesh(
    group,
    new THREE.BoxGeometry(blockWidth * 0.96, blockHeight * 0.94, blockLength * 0.95),
    quarryRockMaterial('light'),
    new THREE.Vector3(centerX, bottomY + rowSpacing, baseZ),
  );
}

function addQuarryHoistFrame(
  group: THREE.Group,
  hoistX: number,
  hoistZ: number,
): void {
  const frameSpan = 2.6;
  const frameHeight = 5.4;
  const legW = 0.32;
  const crossbarH = 0.24;
  const crossY = frameHeight - crossbarH * 0.5;
  const crossBottomY = crossY - crossbarH * 0.5;
  const pulleyRadius = 0.34;
  const pulleyThickness = 0.18;
  const blockW = 0.85;
  const blockH = 0.5;
  const blockX = hoistX - 0.55;
  const blockTopY = blockH;
  const pulleyX = blockX;

  for (const z of [-frameSpan, frameSpan] as const) {
    addMesh(
      group,
      new THREE.BoxGeometry(legW, frameHeight, legW),
      timberMaterial('dark'),
      new THREE.Vector3(hoistX, frameHeight * 0.5, hoistZ + z),
    );
  }

  addMesh(
    group,
    new THREE.BoxGeometry(0.24, crossbarH, frameSpan * 2 + 0.42),
    timberMaterial('weathered'),
    new THREE.Vector3(hoistX, crossY, hoistZ),
  );

  const pulleyY = crossBottomY - pulleyRadius;
  addMesh(
    group,
    new THREE.BoxGeometry(0.12, crossBottomY - pulleyY, 0.16),
    timberMaterial('dark'),
    new THREE.Vector3(pulleyX, (crossBottomY + pulleyY) * 0.5, hoistZ),
  );

  addMesh(
    group,
    new THREE.CylinderGeometry(pulleyRadius, pulleyRadius, pulleyThickness, 12),
    metalMaterial('iron'),
    new THREE.Vector3(pulleyX, pulleyY, hoistZ),
    new THREE.Euler(Math.PI * 0.5, 0, 0),
  );

  addMesh(
    group,
    new THREE.BoxGeometry(blockW, blockH, 0.7),
    quarryRockMaterial('mid'),
    new THREE.Vector3(blockX, blockH * 0.5, hoistZ),
  );

  const hookY = blockTopY + 0.06;
  addMesh(
    group,
    new THREE.BoxGeometry(0.12, 0.12, 0.12),
    metalMaterial('iron'),
    new THREE.Vector3(blockX, hookY, hoistZ),
  );

  const ropeTopY = pulleyY - pulleyRadius;
  const ropeBottomY = hookY + 0.06;
  const ropeHeight = ropeTopY - ropeBottomY;
  addMesh(
    group,
    new THREE.BoxGeometry(0.055, ropeHeight, 0.055),
    timberMaterial('mid'),
    new THREE.Vector3(blockX, ropeBottomY + ropeHeight * 0.5, hoistZ),
  );
}

function addQuarryForemanShed(group: THREE.Group, shedX: number, shedZ: number): void {
  const shedW = 5.0;
  const shedD = 4.0;
  const shedStoneH = 0.38;
  const shedWallH = 2.35;
  const halfW = shedW * 0.5;
  const halfD = shedD * 0.5;
  const wallTop = shedStoneH + shedWallH;
  const ridgeH = 1.25;
  const wallInset = 0.1;
  const roofPitch = Math.atan2(ridgeH, halfD);
  const slopeLen = halfD / Math.cos(roofPitch) + 0.18;
  const plankH = 0.36;
  const frontZ = shedZ + halfD - wallInset;

  addMesh(
    group,
    new THREE.BoxGeometry(shedW + 0.3, shedStoneH, shedD + 0.3),
    quarryRockMaterial('dark'),
    new THREE.Vector3(shedX, shedStoneH * 0.5, shedZ),
  );

  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
    addMesh(
      group,
      new THREE.BoxGeometry(0.34, shedWallH, 0.34),
      timberMaterial('dark'),
      new THREE.Vector3(
        shedX + sx * (halfW - 0.14),
        shedStoneH + shedWallH * 0.5,
        shedZ + sz * (halfD - 0.14),
      ),
    );
  }

  const doorWidth = 0.95;
  const doorHeight = 1.85;
  const doorCenterX = shedX - 0.2;
  const doorLeft = doorCenterX - doorWidth * 0.5;
  const doorRight = doorCenterX + doorWidth * 0.5;
  const leftPanelWidth = doorLeft - (shedX - halfW + 0.2);
  const rightPanelWidth = shedX + halfW - 0.2 - doorRight;

  for (let rowY = shedStoneH; rowY < wallTop - 0.02; rowY += plankH) {
    const remaining = wallTop - rowY;
    const rowHeight = Math.min(plankH, remaining);
    const centerY = rowY + rowHeight * 0.5;
    const shade = Math.floor((rowY - shedStoneH) / plankH) % 2 === 0
      ? timberMaterial('weathered')
      : timberMaterial('mid');
    const rowTop = centerY + rowHeight * 0.5;
    const doorTop = shedStoneH + doorHeight;

    addMesh(
      group,
      new THREE.BoxGeometry(0.16, rowHeight * 0.94, shedD - 0.34),
      shade,
      new THREE.Vector3(shedX - halfW + 0.08, centerY, shedZ),
    );
    addMesh(
      group,
      new THREE.BoxGeometry(0.16, rowHeight * 0.94, shedD - 0.34),
      shade,
      new THREE.Vector3(shedX + halfW - 0.08, centerY, shedZ),
    );
    addMesh(
      group,
      new THREE.BoxGeometry(shedW - 0.34, rowHeight * 0.94, 0.16),
      shade,
      new THREE.Vector3(shedX, centerY, shedZ - halfD + 0.08),
    );

    if (rowTop <= doorTop) {
      if (leftPanelWidth > 0.08) {
        addMesh(
          group,
          new THREE.BoxGeometry(leftPanelWidth, rowHeight * 0.94, 0.16),
          shade,
          new THREE.Vector3(shedX - halfW + 0.2 + leftPanelWidth * 0.5, centerY, frontZ),
        );
      }
      if (rightPanelWidth > 0.08) {
        addMesh(
          group,
          new THREE.BoxGeometry(rightPanelWidth, rowHeight * 0.94, 0.16),
          shade,
          new THREE.Vector3(shedX + halfW - 0.2 - rightPanelWidth * 0.5, centerY, frontZ),
        );
      }
    } else {
      addMesh(
        group,
        new THREE.BoxGeometry(shedW - 0.34, rowHeight * 0.94, 0.16),
        shade,
        new THREE.Vector3(shedX, centerY, frontZ),
      );
    }
  }

  for (const zSign of [-1, 1] as const) {
    addMesh(
      group,
      new THREE.BoxGeometry(shedW - 0.24, 0.14, 0.14),
      timberMaterial('dark'),
      new THREE.Vector3(shedX, wallTop - 0.05, shedZ + zSign * (halfD - wallInset)),
    );
  }

  addMesh(
    group,
    new THREE.BoxGeometry(doorWidth + 0.12, doorHeight + 0.1, 0.12),
    timberMaterial('dark'),
    new THREE.Vector3(doorCenterX, shedStoneH + (doorHeight + 0.1) * 0.5, frontZ + 0.02),
  );
  addMesh(
    group,
    new THREE.BoxGeometry(doorWidth, doorHeight, 0.08),
    timberMaterial('mid'),
    new THREE.Vector3(doorCenterX, shedStoneH + doorHeight * 0.5, frontZ + 0.03),
  );

  for (const side of [-1, 1] as const) {
    addMesh(
      group,
      new THREE.BoxGeometry(shedW + 0.24, 0.1, slopeLen),
      tileMaterial(side > 0 ? 1 : 0),
      new THREE.Vector3(shedX, wallTop + ridgeH * 0.5, shedZ + side * halfD * 0.46),
      new THREE.Euler(side > 0 ? roofPitch : -roofPitch, 0, 0),
    );
  }

  addMesh(
    group,
    new THREE.BoxGeometry(shedW + 0.32, 0.14, 0.24),
    tileMaterial(2),
    new THREE.Vector3(shedX, wallTop + ridgeH + 0.03, shedZ),
  );

  const gableThickness = 0.16;
  for (const xSign of [-1, 1] as const) {
    addTriangularGableWall(
      group,
      'x',
      xSign * (halfW - wallInset),
      halfD,
      wallTop,
      ridgeH,
      gableThickness,
      timberMaterial('weathered'),
      0,
      shedX,
      shedZ,
    );
  }
}

/** Stonecutter's camp — work yard with block stacks, hoist, and foreman's shed. */
export function createStoneQuarryMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Stonecutter's camp";

  const pitX = 0;
  const pitZ = -2.8;
  const pitRadius = 5.4;
  const terraceCount = 3;
  const terraceStep = 0.52;
  const bermTube = 0.38;

  for (let tier = 0; tier < terraceCount; tier++) {
    const scale = 1 - tier * 0.2;
    const terraceH = 0.48;
    const y = tier * terraceStep;
    const inner = pitRadius * scale;
    const shade = tier === 0 ? 'cut' : tier === terraceCount - 1 ? 'dark' : 'mid';
    addMesh(
      group,
      new THREE.CylinderGeometry(inner, inner + 0.82, terraceH, 14, 1, false),
      quarryRockMaterial(shade),
      new THREE.Vector3(pitX, y + terraceH * 0.5, pitZ),
    );
  }

  const pitFloorH = 0.1;
  addMesh(
    group,
    new THREE.CylinderGeometry(pitRadius * 0.38, pitRadius * 0.42, pitFloorH, 12),
    quarryRockMaterial('spoil'),
    new THREE.Vector3(pitX + 0.4, pitFloorH * 0.5, pitZ - 0.3),
  );

  addMesh(
    group,
    new THREE.TorusGeometry(pitRadius + 0.55, bermTube, 6, 20),
    quarryRockMaterial('dust'),
    new THREE.Vector3(pitX, bermTube, pitZ),
    new THREE.Euler(Math.PI * 0.5, 0, 0),
  );

  const spoilA_H = 0.85;
  const spoilB_H = 0.5;
  addMesh(
    group,
    new THREE.BoxGeometry(2.4, spoilA_H, 1.9),
    quarryRockMaterial('spoil'),
    new THREE.Vector3(pitX + 1.4, spoilA_H * 0.5 + 0.02, pitZ + 0.6),
  );
  addMesh(
    group,
    new THREE.BoxGeometry(1.6, spoilB_H, 1.3),
    quarryRockMaterial('dust'),
    new THREE.Vector3(pitX + 2.0, spoilA_H + spoilB_H * 0.5 + 0.02, pitZ + 0.75),
  );

  const stackX = -8.6;
  addStoneBlockPile(group, stackX, 2.0, 0, 5, 1.35, 0.82, 0.58);
  addStoneBlockPyramid(group, stackX, 5.4, 0, 1.55, 0.88, 0.62);
  addStoneBlockPile(group, stackX + 1.5, -0.6, 0, 3, 1.1, 0.72, 0.5);

  for (let i = 0; i < 5; i++) {
    const rubbleW = 0.28 + (i % 3) * 0.12;
    const rubbleH = rubbleW * 0.7;
    addMesh(
      group,
      new THREE.BoxGeometry(rubbleW, rubbleH, rubbleW * 1.1),
      quarryRockMaterial(i % 2 === 0 ? 'dark' : 'mid'),
      new THREE.Vector3(stackX + 1.8 + i * 0.45, rubbleH * 0.5, 0.4 + i * 0.35),
      new THREE.Euler(0, i * 0.4, 0),
    );
  }

  addQuarryHoistFrame(group, 6.2, -6.4);
  addQuarryForemanShed(group, 7.4, 7.2);

  return group;
}
