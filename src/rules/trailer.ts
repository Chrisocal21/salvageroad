import { SHIPPING, type ShippingKind } from '../data/shippingContainers';
import { localBox, type Town } from './town';
import { checkRemove, removePiece, type Layout } from './baseBuild';

export const TRAILER = {
  half: [1.3, .18, 4.1] as const,
  hitchZ: 3,
  rigHitchZ: -2.45,
  rigHitchY: -.75,
  deckHeight: .18,
  axleZ: [-2.4, -3.4],
  wheelRadius: .48,
  capacityFeet: 20,
};

export function trailerRoom(cargo: ShippingKind[], kind: ShippingKind): string | null {
  if (kind === 'ft40') return 'This flatbed only carries 10 ft and 20 ft containers';
  const feet = (k: ShippingKind) => k === 'ft10' ? 10 : k === 'ft20' ? 20 : 40;
  return cargo.reduce((n, k) => n + feet(k), 0) + feet(kind) <= TRAILER.capacityFeet
    ? null : 'The flatbed is full (one 20 ft or two 10 ft containers)';
}

export function loadTrailerContainer(layout: Layout, id: number, cargo: ShippingKind[], colors: number[]) {
  const piece = layout.pieces.get(id);
  if (!piece || piece.kind === 'pillar') return { ok: false, message: 'Choose a shipping container' };
  const problem = trailerRoom(cargo, piece.kind);
  if (problem) return { ok: false, message: problem };
  const check = checkRemove(layout, id);
  if (!check.ok) return { ok: false, message: check.reason ?? 'Cannot pick that up' };
  removePiece(layout, id);
  cargo.push(piece.kind);
  colors.push(piece.color);
  return { ok: true, message: `Loaded the ${SHIPPING.kinds[piece.kind].name} container onto the flatbed` };
}

/** Separate project from the tractors: a trailer waits in the last remote yard. */
export function trailerSpawn(towns: Town[]) {
  const site = towns.filter(t => t.salvage).at(-1);
  if (!site?.salvage) throw new Error('No remote salvage yard for the flatbed');
  const yaw = site.salvage.yaw;
  return { ...localBox(site.center.x, site.center.z, yaw, 7, 0, 1.3, 4.1), yaw };
}

export function containerLength(kind: ShippingKind) {
  return SHIPPING.kinds[kind].length;
}
