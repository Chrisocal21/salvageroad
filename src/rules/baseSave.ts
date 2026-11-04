// Saving and loading a base as text. Shared by the base builder page and the main game, so a base
// built in one shows up in the other. Plain data, no browser calls: callers do the storing.

import { addPiece, type Layout, type Piece, type PieceSpec } from './baseBuild';

/** The /base/ test page's saved base. The game never reads this. */
export const BASE_STORAGE_KEY = 'salvageroad.base.v1';
/** The game's own saved base. Starts empty, and test builds never leak into it. */
export const GAME_BASE_STORAGE_KEY = 'salvageroad.game.base.v1';

type Saved = PieceSpec & { id?: number; owner?: number };

export function serializeLayout(layout: Layout): string {
  return JSON.stringify([...layout.pieces.values()]);
}

/** Adds the saved pieces to the (empty) layout. Bad or missing text loads nothing. Returns how many were added. */
export function loadLayout(layout: Layout, raw: string | null): number {
  if (!raw) return 0;
  let saved: Saved[];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return 0;
    saved = parsed as Saved[];
  } catch {
    return 0;
  }
  // Lowest level first so everything finds its support. Saved ids are remapped to new ones.
  saved = saved.filter((s) => s && typeof s.kind === 'string').sort((a, b) => a.level - b.level);
  const newId = new Map<number, number>();
  const owned: [Piece, number][] = [];
  let added = 0;
  for (const { id, owner, ...spec } of saved) {
    const piece = addPiece(layout, spec);
    if (!piece) continue;
    added++;
    if (id !== undefined) newId.set(id, piece.id);
    if (owner !== undefined) owned.push([piece, owner]);
  }
  for (const [piece, oldOwner] of owned) {
    const owner = newId.get(oldOwner);
    if (owner !== undefined) piece.owner = owner;
  }
  return added;
}
