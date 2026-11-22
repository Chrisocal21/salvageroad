# Piece-by-Piece Vehicle Assembly and Holographic Placement

An implementation guide for a first-person game where a vehicle is built up one part at a time and structures are placed with holographic previews. It covers how the models are authored, how build state drives what is drawn, how loose and held parts work, hinges, supports, the hologram (ghost) system for both building and vehicle parts, the weathered-metal shader that paint restoration plugs into, and the order to port it all.

Code is TypeScript with Three.js, but every idea maps directly to Unity (GameObjects, child transforms, materials) or Unreal (actors, components, material instances).

The guide uses two labels:
- **Proven** means it is working in a shipped prototype.
- **Extension** means a design built on the proven pieces, not yet tried in play.

---

## 1. The whole pipeline in one picture

```
 Data (rules)                     Model (render)                    Player
 ─────────────                    ──────────────                    ──────
 PartSlot list  ─────────────►    one named group per slot   ◄───   E at a zone
 build counts   ── sync() ──►     visible = count > 0                holding a part
 fit / detach   ── result ──►     hologram colour + prompt   ◄───   aim / look
 condition, paint ─ uniforms ─►   rust / gloss / damage
```

Three rules hold everything together:

1. **The rules never touch the model.** Fitting, detaching and validity checks are plain functions over plain data (`build[slot] = count`). They return `{ ok, reason }`.
2. **The model never decides anything.** It has a `sync(build)` that shows and hides named groups, and a hologram that takes a spec plus an `ok` flag.
3. **The same check drives the action, the hologram colour and the prompt text.** One function, three uses, so they can never disagree.

---

## 2. Authoring the vehicle model (Proven)

### 2.1 One group per part slot

Build or import the vehicle so every removable part is its own child group of the body, **named exactly after its slot id**:

```
Vehicle (root)
├── body_shell          (always visible: the bare chassis or shell)
├── engine
├── battery
├── hood                (pivot at the hinge, see 4)
├── driver_door
├── passenger_door
├── dash
├── steering_wheel
├── windshield
├── grille
├── headlights
├── front_bumper
├── rear_bumper
├── tailgate
├── seat
└── Wheel 0..3          (separate objects, pivot at the hub centre)
```

With a procedural model, use a "current part" pointer, so every primitive made between `beginPart` and `endPart` lands in that part's group:

```ts
let current: THREE.Object3D = body;
const parts = {} as Record<PartKind, THREE.Group>;

function beginPart(name: PartKind) {
  if (!parts[name]) {
    const g = new THREE.Group();
    g.name = name;
    body.add(g);
    parts[name] = g;
  }
  current = parts[name]; // pieces of one part can be added at different points in the build script
}
function endPart() { current = body; }
```

### 2.2 Parts that come in multiples

For a slot with `count > 1` (4 brakes, 2 headlights, 4 wall panels), put **one child per unit** inside the slot group, in fitting order. `sync` then shows the first `n` children.

### 2.3 Damaged variants

To show a part as present but battered, add a sibling group named `Damaged <slot>` with the same child order. Sync shows a damaged child wherever the good one is not yet fitted:

```ts
damaged.children.forEach((child, i) => { child.visible = i >= build[id]; });
```

Fitting a good part therefore swaps it with its battered counterpart in place, with no extra code.

### 2.4 Wheels

- Each wheel is its own object, with its pivot at the hub centre and named `Wheel <index>`.
- Keep a `wheelOn[]` array beside the count. The rules only know there are "3 of 4 wheels"; the view needs to know which hubs are filled.
- Each frame, the physics gives a position and rotation per wheel (suspension length plus steer plus spin). Copy those onto the wheel objects.
- If one physics wheel drives several meshes (dual rear tires), keep an `axleForTire[]` map from mesh to physics wheel, plus the mesh's sideways offset from that wheel.

### 2.5 Importing models (GLB, FBX)

Supplied models rarely match the slot structure. Re-group them on load:

1. **Convert axes once.** Bake a fixed rotation matrix into every mesh's geometry. For example, the source might be -X forward and Z up while the game is +Z forward and Y up:
   ```ts
   const FIX = new THREE.Matrix4().makeRotationY(Math.PI / 2)
     .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
   geometry.applyMatrix4(mesh.matrixWorld).applyMatrix4(FIX);
   ```
2. **Map mesh names to slots with patterns.** `/(front|rear)_(tire|rim|hub|lug_\d+)$/` maps to a wheel; `/hood/` to hood; and so on. Strip exporter prefixes such as `^\d+_`. Throw an error on any name that matches nothing, so missing mappings are caught at load time.
3. **Re-pivot the wheels.** Choose the wheel index from the side of the mesh centre (`centre.x > 0` means right) and front or rear from its name. Translate the geometry by minus the hub position, then parent it under a wheel group placed at the hub.
4. **Reassign materials by name.** Glass, rubber and dark parts, steel, and paint each get one shared game material, so the model matches the game's look and batches well.
5. **Keep vertex-colour tints.** If the source colours vertices, average each mesh's vertex colour into a tint, then clone the material once per (material, tint) pair with `vertexColors = false`.
6. **Remove or trim bad geometry.** Delete meshes you are replacing. Cut unwanted faces (such as caps closing a cargo box opening) by filtering triangles by position.
7. **Fill gaps with simple supplemental geometry** for any slot the source does not model, so every slot has something to show.

### 2.6 Materials on moving panels

A door or hood opened toward the player shows its back faces. Give those groups double-sided material copies. One catch: in Three.js, `material.clone()` **drops `onBeforeCompile`**. Copy it across, or the rust shader disappears from the opened panel:

```ts
const copy = original.clone();
copy.onBeforeCompile = original.onBeforeCompile;
copy.customProgramCacheKey = () => original.customProgramCacheKey() + '-both-sides';
copy.side = THREE.DoubleSide;
```

---

## 3. Build state drives what is drawn (Proven)

One `sync` runs after every change to the build:

```ts
function sync() {
  for (const slot of slots) {
    const group = model.getObjectByName(slot.id)!;
    group.visible = build[slot.id] > 0;
    if (slot.count > 1) group.children.forEach((c, i) => { c.visible = i < build[slot.id]; });
    model.getObjectByName(`Damaged ${slot.id}`)?.children
      .forEach((c, i) => { c.visible = i >= build[slot.id]; });
  }
  wheels.forEach((w, i) => { w.visible = wheelOn[i]; blocks[i].visible = !wheelOn[i]; });
  cribs.visible = !isDriveable(build);
}
```

- Physics only runs once the vehicle is driveable: `step()` returns early otherwise, so a half-built car sits still on its supports.
- Show the vehicle's support blocks until it is driveable (section 6).

---

## 4. Hinges: hood, doors, tailgate (Proven)

Rotate a part group about a hinge point that is not its origin by rotating the group, then moving it so the hinge point stays put:

```ts
function hinge(group: THREE.Object3D, point: THREE.Vector3, rx: number, ry: number) {
  group.rotation.set(rx, ry, 0);
  group.position.copy(point).sub(point.clone().applyEuler(group.rotation));
}
```

| Part | Hinge point | Axis | Fully open |
|---|---|---|---|
| Hood | Base of the windshield | X | -1.15 rad (about 66°) |
| Door | Front edge of the door, at the A-pillar | Y | ±1.15 rad, sign by side |
| Tailgate | Bottom edge | X | -π/2 (flat) |
| Rear cargo doors | Outer edges | Y | ±0.75π |

- Keep an "amount" from 0 to 1 per hinge and ease it toward its goal each frame: `amount += sign(goal - amount) * min(|goal - amount|, rate * dt)`.
- **Doors used to get in** open by themselves and close after about 1.6 s.
- **Doors opened on purpose** while the vehicle is being built stay open, so the player can reach inside.
- The tailgate or cargo doors open while the vehicle's storage is open.
- Parts behind a cover check the cover: the engine cannot be fitted while the hood is fitted and shut. Pressing E with an engine in hand at the hood zone opens the hood first.

---

## 5. Loose parts in the world, and parts in hand (Proven)

### 5.1 A loose part is a clone of the vehicle's own part

Don't model loose parts separately. Clone the slot group from the vehicle model. Three.js clones share geometry and materials, so a yard full of parts costs very little memory:

```ts
function createPartModel(car, kind): THREE.Group {
  const copy = (kind === 'wheel' ? car.wheels[0] : car.parts[kind]).clone();
  copy.position.set(0, 0, 0);
  copy.quaternion.identity();
  copy.visible = true;

  const tilt = new THREE.Group();          // lie it down the way it would be left
  tilt.rotation.set(LIE[kind][0], 0, LIE[kind][1]);
  tilt.add(copy);
  tilt.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(tilt);  // centre over its footprint, lowest point at y = 0
  const c = box.getCenter(new THREE.Vector3());
  tilt.position.set(-c.x, -box.min.y, -c.z);

  const holder = new THREE.Group();
  holder.name = `loose ${kind}`;
  holder.add(tilt);
  return holder;
}
```

`LIE` is a small table giving each part's resting pose:

| Part | Lies | Rotation |
|---|---|---|
| Wheel | Flat, like a tire on the ground | Z +90° |
| Tailgate, windshield, grille | On its back | X -90° |
| Steering wheel | Flat, like on a bench | X -90° |
| Doors | Flat, outside up | Z ±90° |
| Engine, battery, seat, bumpers, dash | Upright | none |

### 5.2 Placing and stacking

- Put a loose part at `ground(x, z) + level × thickness`, where `thickness` is the clone's bounding box height.
- Stacks share an x/z position and differ in `level`. **Only the top of a stack can be taken**: refuse any item that has another of the same kind at the same spot with a higher level.
- Each loose part has a small pick box (half-size about 0.45 m) for targeting.

### 5.3 Holding a part

The held part is the same clone, attached to the camera so it moves with the view:

```ts
const held = new THREE.Group();
held.position.set(0.42, -0.5, -1.15);   // low right, in front of the eyes
held.rotation.set(0.35, -0.6, 0);
camera.add(held);
scene.add(camera);                      // the camera must be in the scene for children to render

function holdPart(kind: PartKind | null) {
  held.clear();
  carrying = kind;
  if (!kind) return;
  const m = createPartModel(car, kind);
  m.scale.setScalar(Math.min(1, 0.5 / partSize(m)));  // fit a 0.5 m view-model box
  m.traverse(o => (o.castShadow = false));            // view models never cast shadows
  held.add(m);
}
```

Rules:
- One hand-carried part at a time. While holding one, E cannot pick up, loot, trade or enter a vehicle ("Hands full").
- E with nothing targeted drops it about 1.3 m ahead, on the ground, facing the player's heading.
- Small parts can go in the inventory instead and be fitted from there.

### 5.4 Choosing which hub or unit

For multi-unit slots such as wheels, fill the free unit nearest the player:

```ts
let best = -1, bestDist = Infinity;
car.wheels.forEach((w, i) => {
  const d = Math.hypot(w.position.x - player.x, w.position.z - player.z);
  if (!wheelOn[i] && d < bestDist) { best = i; bestDist = d; }
});
if (best >= 0) wheelOn[best] = true;
```

---

## 6. Supports while the vehicle is incomplete (Proven)

- **Blocks per missing wheel:** two cinder blocks stacked crosswise under each bare hub (a 0.4 × 0.2 × 0.2 m block, then a 0.2 × 0.2 × 0.4 m block on top). They are visible exactly when that hub has no wheel.
- **Cribbing for heavy vehicles:** three layers of crossed timbers (about 0.62 × 0.21 × 0.14 m) under each axle end. Shown until the vehicle is driveable, then hidden.
- These tell the player at a glance that the vehicle can't move yet, and why.

---

## 7. The hologram (ghost) system

### 7.1 Recipe for a readable hologram (Proven)

A placement ghost has to stay readable from far away and from behind other objects. It uses three layers:

| Layer | Material | Settings | Purpose |
|---|---|---|---|
| Body | Unlit, translucent | colour `#55ff77`, opacity 0.5, `depthWrite: false`, `renderOrder: 10` | Shows the volume without hiding what is behind it |
| Edges | Line segments of the same shape | colour `#a8ffbc`, opacity 0.95, **`depthTest: false`**, `renderOrder: 11` | The outline shows through walls and other pieces |
| Footprint | Flat patch on the ground below | colour `#55ff77`, opacity 0.4, `depthWrite: false`, `renderOrder: 9`, raised 0.05 m | Shows where it lands and how far an overhang reaches |

Invalid placements switch all three to red: body and footprint `#ff5544`, edges `#ffb0a4`.

```ts
const ghostMat = new THREE.MeshBasicMaterial({ color: 0x55ff77, transparent: true, opacity: .5, depthWrite: false });
const edgeMat  = new THREE.LineBasicMaterial({ color: 0xa8ffbc, transparent: true, opacity: .95, depthTest: false });
const footMat  = new THREE.MeshBasicMaterial({ color: 0x55ff77, transparent: true, opacity: .4, depthWrite: false });

const ghost = new THREE.Mesh(boxGeo, ghostMat);                  ghost.renderOrder = 10;
const edges = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), edgeMat); edges.renderOrder = 11;
ghost.add(edges);
const foot  = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), footMat); foot.renderOrder = 9;

function setGhost(spec: Spec | null, ok: boolean) {
  ghostMat.color.setHex(ok ? 0x55ff77 : 0xff5544);
  footMat.color.setHex(ok ? 0x55ff77 : 0xff5544);
  edgeMat.color.setHex(ok ? 0xa8ffbc : 0xffb0a4);
  ghost.visible = foot.visible = !!spec;
  if (!spec) return;
  // position, rotate and scale the ghost and footprint from the spec (see 8.2)
}
```

Notes:
- Build `EdgesGeometry` once per piece shape and swap it when the selected piece changes. Don't rebuild it every frame.
- Ghosts never cast or receive shadows.
- Hide the ghost whenever the mouse isn't captured or a menu is open.

### 7.2 The per-frame hologram loop (Proven)

```
every frame while a building tool is active:
  hit   = raycast from the camera centre (build pieces first, then terrain)
  spec  = aimToSpec(kind, rotation, level, hit.point, hit.normal, hit.piece)   // snap to the grid
  plan  = planPlace(layout, spec)            // pure rules: ok, reason, support %, auto pillars
  view.setGhost(spec, plan.ok, plan.pillars)
  status = plan.ok ? `Level ${level}${supportNote}${pillarNote}` : plan.reason
on left click:
  if plan.ok: addPiece(layout, spec); rebuild colliders; save
  else: show plan.reason
```

The same `planPlace` result supplies the hologram colour, the status text and the click outcome.

### 7.3 Extra ghosts for automatic additions (Proven)

When the rules would add corner pillars to support an overhang, the plan returns them and the view draws them as additional ghost pillars with the same material. The player sees exactly what will be built before clicking, and the status line says "+4 pillars".

### 7.4 Wood and other small pieces (Proven)

Any piece made of boxes can use one generic ghost. Generate the piece's boxes from its spec (the same function that builds the real piece), draw each box with the translucent ghost material, and switch the colour green or red. Because the real piece and the ghost come from one function, the ghost is always the exact shape.

---

## 8. Grid snapping behind the hologram (Proven)

### 8.1 Grid
- Square cells of size `cell` (for example 4 ft, 1.2192 m) and levels of height `levelHeight` (for example 2.59 m, the height of a shipping container).
- A piece spec is `{ kind, gx, gz, level, rot, levels? }`: whole cells only, so everything snaps by construction.
- The footprint after rotation: `rot 0` gives `w = long, d = wide`; `rot 1` swaps them.

### 8.2 From a hit to a spec
```
if the hit is on a placed piece:
   top face (normal.y > 0.5)  → level = piece.level + piece height, same cell under the hit
   side face                  → level = piece.level, the cell just past the face, in the normal's direction
else (terrain)                → level = the chosen build level (PageUp/PageDown), cell under the hit
gx = floor(hit.x / cell - w / 2 + 0.5)    // centre the footprint on the crosshair
gz = floor(hit.z / cell - d / 2 + 0.5)
```
Position in the world: `x = (gx + w/2) × cell`, `y = (level + levels/2) × levelHeight`, `z = (gz + d/2) × cell`, rotated `rot × 90°` about Y.

### 8.3 Validity (what turns the hologram red)
1. Any cell is already occupied.
2. Above level 0 without support: less than the minimum share of the footprint rests on something, and not all four corners are supported. If pillars down to the support below would fix it, the placement is valid and the plan includes them.
3. Out of bounds, overlapping a vehicle or the player, or overlapping a protected area such as a road.
4. Missing materials or tool (if the game charges for building).

Removal uses the same checks in reverse: refuse if anything above would lose its support.

### 8.4 Openings
A door or window placed on a module's wall replaces that wall section with a framed opening. The view rebuilds that module as a shell with the gap, and collisions follow, so the player can walk or drive through the gap.

---

## 9. Glowing fit spots and detach glow (Extension)

**The core idea:** when the player is holding a part, the place on the vehicle where it goes **glows**: a pulsing hologram of the part in its fitted position. When the player has the tool out and empty hands, the part they're aiming at glows to show it can be detached. The player never has to guess where something goes or what can come off.

It uses the same ghost recipe as building (section 7), applied to the vehicle.

### 9.1 Behaviour

**Fitting (holding a part)**

| Situation | Glow |
|---|---|
| Holding a part, vehicle in view (within about 10 m) | The part's fitted spot glows: a pulsing hologram of that exact part where it bolts on. It's visible from a distance, so the player can walk straight to it. |
| It can go on now | Green glow. Within reach, the pulse speeds up and the prompt reads "E: bolt on the X". |
| Something must go first | Red glow on the spot, plus **amber** glows on the slots that are blocking it, so the player sees what to fit first |
| A cover is shut (the engine behind the hood) | The hood glows amber; the prompt says "E to open the hood". Once it's open, the engine bay glows green. |
| Multi-unit slot (wheels, brakes, panels) | Every free unit glows faintly; the one nearest the player glows brightly and is the one that gets fitted |
| Slot already full | No glow; the prompt says it's already fitted |
| The part fits no slot on this vehicle | No glow; the prompt says "This part doesn't fit this vehicle" |

**Detaching (tool out, empty hands)**

| Situation | Glow |
|---|---|
| Aiming at a fitted part | That real part glows white (an outline plus a soft pulse). The prompt reads "E: remove the X". |
| Something depends on it | Red glow on the part, plus **amber** glows on the parts that must come off first |
| Behind a shut cover | The cover glows amber first |
| Not aiming at anything | Optionally, every removable part glows faintly, so the player can see what can come off |

**Optional overview:** a key toggles a faint outline on every empty slot when the player isn't holding anything, as a "what's missing" view.

### 9.2 Building a part ghost

Reuse the slot group from the vehicle model, as loose parts do, but keep its fitted transform and swap in the ghost materials:

```ts
function createPartGhost(car, kind, unit = 0): THREE.Object3D {
  const src = kind === 'wheel' ? car.wheels[unit] : car.parts[kind];
  const ghost = src.clone();              // keeps the fitted position inside the body
  ghost.visible = true;
  ghost.traverse(o => {
    if (o instanceof THREE.Mesh) {
      o.material = ghostMat;              // shared translucent material
      o.castShadow = o.receiveShadow = false;
      o.renderOrder = 10;
      const e = new THREE.LineSegments(edgesFor(o.geometry), edgeMat);  // cache per geometry
      e.renderOrder = 11;
      o.add(e);
    }
  });
  return ghost;
}
```

- Parent the ghost to the **vehicle body**, not the scene, so it follows a vehicle that moves or sits on a slope.
- For wheels, parent the ghost at the hub position (the physics' rest pose).
- Cache one ghost per slot and unit; toggle visibility and colour instead of cloning every frame.
- Use `EdgesGeometry(geometry, 30)` (a 30° threshold) on detailed meshes, so only real edges are drawn, not every triangle.

### 9.3 Driving it from the rules

```ts
const check = checkFit(build, carrying, inventory, hoodOpen);   // the same function as the fit action
const colour = check.ok ? GREEN : RED;
showGhost(carrying, nearestFreeUnit(carrying), colour);
for (const b of check.blockers ?? []) showGhost(b, 0, AMBER);
prompt(check.ok ? `Bolt on the ${name}` : check.reason);
```

Have `checkFit` return the blocking slot ids (`blockers`) as well as the reason text, so the view can highlight them.

### 9.3b Making the spot glow

A translucent ghost alone looks like a preview. To make it read as a **glow**, combine three things:

1. **Pulse:** animate the ghost's opacity and colour brightness with time, e.g. `opacity = 0.35 + 0.25 × (0.5 + 0.5 × sin(t × 4))`. Pulse faster (`t × 8`) once the player is within reach.
2. **Additive blending:** `blending: THREE.AdditiveBlending` on the ghost body makes it brighten what is behind it, which reads as light rather than glass. Use normal blending for the red state, so it reads as a warning rather than as light.
3. **Bloom (optional):** with a bloom post-process (Three.js `UnrealBloomPass`, Unity URP Bloom, Unreal post-process bloom), push the ghost's colour above 1.0 (HDR) so only the holograms bloom. With selective bloom, put the ghosts on their own layer.

Using the rim-and-scanline shader in 9.4 on the ghost body gives the strongest effect: bright edges, a moving scanline, and a pulse.

### 9.3c Detach glow on the real part

For detaching, the part is already fitted, so the real part glows instead of a ghost:

```ts
// Option A: overlay. Clone the part with the glow material, scale it by about 1.01, and show it over the real one.
const overlay = createPartGhost(car, kind);    // same function as fit ghosts
overlay.scale.multiplyScalar(1.01);            // sits just outside the surface, no z-fighting
setGlow(overlay, WHITE);                       // or RED with AMBER on its dependents

// Option B: emissive pulse. Briefly raise the real part's emissive (on per-part material copies).
part.traverse(o => { if (o instanceof THREE.Mesh) o.material.emissive.setHex(0x335544); });
```

Option A needs no material copies and works with batched or shared materials, so prefer it. Option B is simpler, but each part needs its own material instance.

To find what's being aimed at, raycast against the slot groups (use `userData.slot = id` on each mesh, then walk up the parents) instead of against the whole vehicle box. Only fitted parts can be hit, and the nearest hit wins.

### 9.3d The glow rules in one place

```ts
function updateVehicleGlow(player, vehicle) {
  hideAllGlows(vehicle);
  if (player.carrying) {
    const check = checkFit(vehicle.build, player.carrying, player.inventory, vehicle.coverOpen);
    if (check.code === 'full' || check.code === 'no_slot') return;
    for (const unit of freeUnits(vehicle, player.carrying))
      showGlow(vehicle, player.carrying, unit, check.ok ? GREEN : RED, unit === nearestFreeUnit(...) ? 1 : .3);
    for (const b of check.blockers ?? []) showGlow(vehicle, b, 0, AMBER, .8);
    if (check.code === 'cover_shut') showGlow(vehicle, check.cover, 0, AMBER, 1);
  } else if (player.tool && !player.carrying) {
    const aimed = raycastFittedPart(vehicle, player.view);
    if (!aimed) return;
    const check = checkDetach(vehicle.build, aimed.slot, player.inventory, vehicle.coverOpen);
    showGlowOnFitted(vehicle, aimed.slot, aimed.unit, check.ok ? WHITE : RED);
    for (const d of check.blockers ?? []) showGlowOnFitted(vehicle, d, 0, AMBER);
  }
}
```

Give `checkFit` and `checkDetach` a `code` (`ok`, `full`, `no_slot`, `blocked`, `cover_shut`, `no_tool`, `no_part`) alongside the human-readable reason. The glow logic switches on the code; the prompt shows the reason.

### 9.4 A hologram shader (optional)

Flat translucency reads well and is cheap. For a stronger "projected" look, swap the body material for a small shader. Keep the edge lines as they are.

```glsl
// vertex
varying vec3 vNormalW; varying vec3 vPosW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vPosW = w.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
// fragment
uniform vec3 uColor; uniform float uTime; uniform float uOpacity;
varying vec3 vNormalW; varying vec3 vPosW;
void main() {
  vec3 v = normalize(cameraPosition - vPosW);
  float rim = pow(1.0 - abs(dot(normalize(vNormalW), v)), 2.0);     // bright silhouette
  float scan = 0.5 + 0.5 * sin(vPosW.y * 40.0 - uTime * 4.0);       // moving scanlines
  float pulse = 0.85 + 0.15 * sin(uTime * 3.0);
  float a = uOpacity * pulse * (0.25 + 0.75 * rim) * (0.7 + 0.3 * scan);
  gl_FragColor = vec4(uColor * (0.6 + 0.8 * rim), a);
}
```

Material settings: `transparent: true`, `depthWrite: false`, `blending: AdditiveBlending` (or normal blending for the red state, so it reads as a warning), `side: DoubleSide`. Animate `uTime` with the game clock.

### 9.5 Feel

- Fade the ghost in over about 0.15 s when the player comes within reach, and out when they leave.
- On a successful fit, flash the real part's edges once (about 0.2 s), then hide the ghost.
- Play a short bolt sound on fit, and a dull clunk on a refusal.
- Never let the hologram hide the prompt text; the text explains, the colour summarises.

---

## 10. Weathered metal shader and paint restoration

### 10.1 Rust without textures (Proven)

The wreck look is a shader patch on a standard PBR material. It computes rust from each point's **object-space position**, so it needs no UVs and works on every part, procedural or imported:

- Pass `vRustPos = position` from the vertex shader.
- Use 3D value-noise fBm at three scales: big patches (×1.7), mid detail (×6) and fine detail (×31).
- Add a **low-body bias** (`1 - smoothstep(-0.15, 0.45, p.y)`) so rust is worst along the sills and lower panels, as on real vehicles.
- `gone` is where the paint has worn away (bare dull steel); `rusty` is where rust has spread from those patches.
- The final colour mixes faded, chalky paint, bare steel and rust. Rust also raises roughness (from 0.6 to 0.93) and lowers metalness (from 0.5 to 0.12).
- Chrome has its own variant: tarnished, with rust freckles.
- Patch the shader at the `#include <color_fragment>`, `<roughnessmap_fragment>` and `<metalnessmap_fragment>` chunks. Give it a `customProgramCacheKey` per variant and paint colour, so shaders compile once and are shared.
- For vehicles whose origin is not at the body, offset the noise position (`vRustPos = position - vec3(0, 0.85, 0)`) so the low-body bias lands on the real sills.

### 10.2 Turning it into paint restoration (Extension)

Add uniforms per panel material (or per-instance attributes if batched):

| Uniform | Range | Driven by |
|---|---|---|
| `uRust` | 0–1 | Multiplies the computed rust and paint loss. 1 = as found, 0 = fully ground |
| `uPainted` | 0–1 | Blends from bare metal (or primer) to the new paint colour |
| `uPaintColor` | rgb | The chosen colour |
| `uGloss` | 0–1 | Lowers roughness toward about 0.15 and adds clearcoat as it rises |

The panel states are `rusted → ground → painted → buffed`:
- Grinding animates `uRust` from 1 to 0 while the player holds the tool on the panel.
- Painting animates `uPainted` from 0 to 1.
- Buffing animates `uGloss` from 0 to 1.

Give each panel its own material instance (or instance attribute), so panels can be in different states. Store `{ rust, painted, color, gloss }` per panel and save it.

For a hands-on version, paint into a small mask texture per panel at the aimed point (a soft brush in UV or tri-planar space) instead of animating one uniform for the whole panel.

---

## 11. Interaction glue (Proven)

Each frame on foot:

```
target = nearest usable thing within 2.2 m, within about 57° of the view (or within 0.6 m regardless)
zone   = which zone of the vehicle the player stands in (hood / driver / passenger / rear)
prompt = from the state:
   holding a part at the vehicle → checkFit → "Bolt on the X" or the reason
   holding a part, cover shut    → "Open the hood (to fit the engine)"
   holding, nothing targeted     → "Put the X down"
   empty hands at a loose part   → "Pick up the X"
   empty hands at the vehicle    → the zone's action, or "Missing: …"
E runs exactly what the prompt says.
```

The prompt and the action must come from the same branch of code. If they are written separately, they will drift apart.

---

## 12. Performance notes (Proven)

- **Clones share geometry and materials.** Loose parts, held parts and part ghosts cost almost nothing extra.
- **Instance the repeated building pieces.** Use one instanced mesh per piece type for placed containers or modules, with level of detail: a detailed model near the camera and a simple box far away. Picking reads the instance id back to a piece id.
- **Batch static meshes by material** for wrecks and imported vehicles that don't need part groups.
- **Rebuild colliders only when the layout changes**, never per frame. Swapping building colliders must not reset the vehicles.
- **Cache edge geometry** per mesh geometry; it is expensive to compute.
- **Compile each shader variant once**, using cache keys.

---

## 13. Porting checklist

1. Define `PartSlot` data and `VehicleDef` for one vehicle (section 2 of the systems blueprint).
2. Author or import the model with one named group per slot, wheels pivoted at their hubs, and hinge points recorded.
3. Write `sync(build)` and confirm that toggling counts shows and hides the right pieces, including multi-unit and damaged variants.
4. Add supports under missing wheels and cribbing until the vehicle is driveable; gate physics on driveability.
5. Add hinges with eased amounts; make the hood gate the parts behind it.
6. Loose parts: clone, lie down, centre, stack, take from the top only.
7. Held part as a camera child; one at a time; drop with E.
8. Write `checkFit` and `checkDetach` returning `{ ok, reason, blockers }`; drive the action, prompt and hologram from them.
9. The placement hologram recipe: body, edges that show through, footprint, green/red.
10. The grid: `aimToSpec`, then `planPlace`, then `setGhost`, then commit on click; automatic pillar ghosts.
11. The glowing fit spot when holding a part, and the detach glow on aimed parts (section 9).
12. The rust shader; then paint uniforms per panel; then the grind, paint and buff tools.
13. Save the build counts, which units are filled, condition, paint state per panel, and the grid layout.
