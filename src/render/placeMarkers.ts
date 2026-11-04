// Marks the planned places in the world so they can be found while testing, before the real towns,
// city and docks are built: a tall pole with a coloured lamp on top at each place. The starting town
// is already built, so it gets no marker.

import * as THREE from 'three';
import type { Place, PlaceKind } from '../rules/places';

const KIND_COLOUR: Record<PlaceKind, number> = {
  city: 0xffd24a,
  town: 0xe8e2d0,
  village: 0xc4ad7c,
  industrial: 0x9aa0a6,
  outpost: 0xb08954,
  dock: 0x5aa3e0,
  lookout: 0xe07c4a,
};

const POLE_HEIGHT = 9;

/**
 * One group of markers for every place but the starting town (index 0). ground gives the height each
 * marker stands on.
 */
export function createPlaceMarkers(places: Place[], ground: (x: number, z: number) => number): THREE.Group {
  const group = new THREE.Group();
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, POLE_HEIGHT, 6);
  const lampGeo = new THREE.SphereGeometry(0.85, 12, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 0.9 });
  for (const place of places) {
    if (place.id === 0) continue; // the starting town is built, not marked
    const y = ground(place.x, place.z);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(place.x, y + POLE_HEIGHT / 2, place.z);
    const lamp = new THREE.Mesh(
      lampGeo,
      new THREE.MeshStandardMaterial({ color: KIND_COLOUR[place.kind], emissive: KIND_COLOUR[place.kind], emissiveIntensity: 0.55, roughness: 0.6 }),
    );
    lamp.position.set(place.x, y + POLE_HEIGHT + 0.9, place.z);
    group.add(pole, lamp);
  }
  return group;
}
