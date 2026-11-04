// Turns "where the mouse ray hit" into a snapped grid placement. Plain numbers, no rendering.

import { SHIPPING } from '../data/shippingContainers';
import { footprint, type Piece, type PieceKind, type PieceSpec, type Rotation } from './baseBuild';

interface V3 {
  x: number;
  y: number;
  z: number;
}

/**
 * point: where the ray hit. normal: world-space surface direction there, or null if it hit no piece.
 * hit: the piece that was hit, if any. buildLevel: the level the player has chosen, used when no
 * piece was hit (the ray is then tested against a plane at that level's height).
 *  - No piece hit: centred on the point, at the chosen build level.
 *  - Top face: it goes on top at the next level, centred on the point (so it can overhang the edge).
 *  - Side face: it goes beside the hit piece, flush against that face, level with it.
 */
export function aimToSpec(
  kind: PieceKind,
  rot: Rotation,
  color: number,
  point: V3,
  normal: V3 | null,
  hit: Piece | null,
  buildLevel = 0,
): PieceSpec {
  const { w, d } = footprint(kind, rot);
  const cell = SHIPPING.cell;
  let level = buildLevel;
  let gx = Math.round(point.x / cell - w / 2) + 0; // + 0 turns -0 into 0
  let gz = Math.round(point.z / cell - d / 2) + 0;

  if (normal && hit && Math.abs(normal.y) < 0.5) {
    level = hit.level;
    const hf = footprint(hit.kind, hit.rot);
    if (Math.abs(normal.x) > Math.abs(normal.z)) {
      gx = normal.x > 0 ? hit.gx + hf.w : hit.gx - w;
    } else {
      gz = normal.z > 0 ? hit.gz + hf.d : hit.gz - d;
    }
  } else if (normal && normal.y > 0.5) {
    level = Math.max(0, Math.round(point.y / SHIPPING.height));
  }
  return { kind, rot, level, gx, gz, color };
}
