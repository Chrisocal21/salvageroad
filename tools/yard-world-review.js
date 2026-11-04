(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  await wait(12000);
  const game = window.__game;
  const mode = new URLSearchParams(location.search).get('review') || 'wreck';
  let target, dx, dz, elevation;
  if (mode === 'brick') {
    const b = game.town.buildings.find(b => !b.store);
    target = { x: b.x, z: b.z, y: 1.8 };
    dx = b.hx + 8; dz = b.hz + 8; elevation = 3.4;
  } else if (mode === 'tire') {
    const t = game.town.junkyard.tires[2];
    target = { x: t.x, z: t.z, y: 0.40 };
    dx = 1.7; dz = -2.0; elevation = 1.4;
  } else {
    const w = game.town.junkyard.wrecks[0];
    target = { x: w.x, z: w.z, y: 0.8 };
    dx = 4.5; dz = 4.5; elevation = 2.4;
  }
  if (!game.isFlying()) game.toggleFly();
  const ground = game.world().town.height;
  game.setFly(target.x + dx, ground + elevation, target.z + dz,
    Math.atan2(dx, dz), -Math.atan2(elevation - target.y, Math.hypot(dx, dz)));
  await wait(6000);
})();
