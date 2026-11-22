# Vehicle Restoration, Driving and Grid Building: Systems Blueprint

Reusable systems for a first-person game where the player restores vehicles part by part, drives them with realistic handling, keeps them up through wear and tear, restores their paint, uses them as storage, and builds structures on a snapping grid.

This is not a game design. It has no story, setting, economy or progression. Each system is described as rules plus tunable numbers, so a different game can keep what fits, change the numbers and drop the rest.

---

## 1. First-person foundation

- **On foot:** first-person camera, WASD and mouse look. All work on vehicles happens on foot, standing at the vehicle.
- **Driving:** a chase camera behind and above the vehicle, with mouse free look. Each vehicle class sets its own camera height and distance (e.g. light vehicle 1.3 m up and 9 m back; heavy truck 2 m up and 14 m back). A cockpit camera is an optional extra.
- **One use key (E):** what it does depends on what the player is near and looking at, and on what they're holding.
- **Targeting:** pick the nearest usable thing within about 2.2 m of its surface and within about 57° of the view direction. Anything within 0.6 m counts regardless of view angle, so the player can use what they're standing against.
- **Context prompt:** always show what E will do right now ("Bolt on the grille", "Open the hood to fit the engine", "Hands full: carrying the driver's door").
- **Plain refusals:** every blocked action says why and what to do about it.

---

## 2. Vehicles as data

A vehicle is a data definition, not hand-written code:

```
VehicleDef {
  id, name
  physics        // mass, chassis size, center of mass, wheels, suspension, engine, brakes (section 4)
  slots[]        // part slots (section 3)
  zones          // where the player stands to use each area (section 2.2)
  storage        // inventory size and any physical limits (section 7)
  camera         // chase height and distance
  canTow?        // hitch type, if any
}
```

Adding a vehicle means adding a data entry and a model whose sub-objects are named after the part slots. The game shows or hides each named object based on what's fitted.

### 2.1 Example vehicle classes (adapt freely)

| Class | Mass | Drive | Wheels | Storage idea |
|---|---|---|---|---|
| Small car / coupe-utility | ~1,400 kg | RWD | 4 | Open bed, small and physically limited |
| Pickup | ~2,000–2,500 kg | RWD/4WD | 4 | Open bed |
| Van | ~2,500–3,500 kg | RWD | 4 | Enclosed, large |
| Box truck | ~5,500 kg | RWD | 6 (rear duals) | Enclosed, very large |
| Tractor unit | ~7,000 kg | RWD on two rear axles | 10 | None; tows a trailer |
| Flatbed trailer | ~1,800 kg empty | Towed | 4 (tandem) | Deck cargo |

### 2.2 Interaction zones

Split the vehicle's footprint by where the player stands, measured along its length as a share of the half-length (+ is the front):

| Zone | Default range | E does |
|---|---|---|
| Hood | From +0.4 to the nose | Open/close the hood. Holding an under-hood part with the hood shut opens it first. |
| Driver side | Middle, left | Enter as driver if driveable; otherwise open/close the fitted door |
| Passenger side | Middle, right | Enter as passenger; a key switches seats |
| Rear/cargo | Behind -0.15 | Open the vehicle's storage |

- Doors used to get in swing open and shut again on their own.
- Exit places the player about 0.9 m beside the door used, facing the vehicle's heading.
- On a non-driveable vehicle, a zone with nothing usable shows what's missing: "Missing: engine, battery, 3 wheels."
- Zone boundaries go in each vehicle's data (long-hood trucks need a longer hood zone, vans a longer cargo zone).

---

## 3. Restoration: fitting, detaching, replacing

### 3.1 Part slots

```
PartSlot {
  id            // engine, battery, wheel, driver_door, ...
  name          // shown to the player
  count         // how many the vehicle takes (wheel 4, brake 4, heavy tire 10)
  after[]       // slots that must be filled before this one goes on
  cover?        // slot that must be open to reach this one (engine and battery behind the hood)
  tool          // required tool (wrench by default; can differ per slot)
  carry         // 'hands' (big, one at a time) or 'pack' (fits in inventory)
  function      // what it enables: 'start', 'drive', 'steer', 'brake', 'grip', 'storage', 'cosmetic'
}
```

A vehicle is **driveable** when every slot with a function of `start`, `drive`, `steer` or `grip` is filled. Cosmetic and body slots can either be required too (full restoration before driving) or optional (drive a rough shell). That choice belongs to the game. Either way, make it one rule per vehicle.

### 3.2 Example: small car (15 kinds, 18 pieces)

| Slot | Count | After | Notes |
|---|---|---|---|
| Engine | 1 | — | Under the hood |
| Battery | 1 | Engine | Under the hood |
| Hood | 1 | — | Can go on first; it opens |
| Wheel | 4 | — | Fits the nearest bare hub |
| Bench seat | 1 | — | |
| Front bumper, rear bumper | 1 each | — | |
| Tailgate | 1 | — | Opens once fitted |
| Dashboard | 1 | — | |
| Steering wheel | 1 | Dashboard | |
| Windshield | 1 | Dashboard | |
| Driver door, passenger door | 1 each | Dashboard and seat | Open once fitted |
| Grille | 1 | Engine | |
| Headlights | 1 | Grille | |

The order follows how a mechanic would think: the interior before the glass and doors, the drivetrain before the front-end trim.

### 3.3 Example: box truck (23 kinds, 37 pieces)

- **Drivetrain:** engine, transmission, battery, fuel tank, steering assembly, 6 tires, radiator, 4 brake assemblies, exhaust.
- **Cab:** dashboard, 2 seats, windshield, 2 doors, hood, grille, 2 headlights, 2 bumpers.
- **Cargo box:** floor, 4 wall panels, roof, 2 rear doors.
- **Dependencies:** battery and radiator after the engine; steering and windshield after the dashboard; doors after the dashboard and seats; grille after the engine and radiator; headlights after the grille; walls after the floor; roof and rear doors after the walls.

Shared cores keep the content manageable. For example, every light vehicle takes the same motor, battery, transmission, steering, 4 tires, radiator, 4 brakes, windshield and 2 seats, plus its own body panels.

### 3.4 Fitting

The player holds a part (or has it in the pack), stands at the right zone and presses E. Check in this order and show the first failure:

1. **Slot full?** "Already has its headlights."
2. **Dependencies in?** "The dashboard and seat must go in before the driver's door."
3. **Cover closed?** Don't refuse: open the cover. The first E opens the hood, the second fits the engine.
4. **Tool in the pack?** "You need a wrench to bolt the engine on."
5. **Part available?** In hand, in the pack, or in another vehicle's storage within 8 m.

If everything passes: consume the real item from its source, fill the slot, show the part, and report what's left. When the vehicle becomes driveable, its support blocks disappear and the controls unlock.

Multi-count parts place sensibly: wheels go on the nearest bare hub; panels fill in order.

### 3.5 Carrying

- **Hand-carried parts** (engine, doors, hood, bumpers, wheels, panels): one at a time. While holding one, the player can't pick up another, open storage or enter a vehicle ("Hands full"). E with nothing targeted puts it down about 1.3 m ahead, where it stays.
- **Pack parts** (battery, headlights, small assemblies): go in the inventory and can be fitted straight from it.
- Optionally, hand-carried parts can slow the player's walk, more for heavier parts.
- **Stacks in the world:** a pile of tires only gives up its top one.
- **Vehicle as parts runner:** parts in a vehicle parked within 8 m count as available, so one vehicle can bring parts to another.

### 3.6 Detaching

The same rules in reverse:

1. Free hands, the right tool in the pack, standing at the part's zone.
2. **Reverse dependencies:** a part can't come off while anything that depends on it is still on. Before the engine comes out, the grille has to come off, and the headlights before the grille: "Remove the headlights and grille first."
3. Covers must be open (hood open to reach the battery).
4. The part comes off as a real object: hand-carried parts into the hands, pack parts into the pack. A full pack refuses rather than deleting anything.
5. The vehicle loses that function at once:
   - Start/drive/steer part removed: the vehicle won't start; show what's missing.
   - Wheel removed: that corner drops onto a block and the vehicle can't move.
   - Door or hood removed: a visible opening.
   - Cosmetic part removed: still driveable, but the look changes and protection drops (section 5).
6. The detached part keeps its condition and paint state (sections 5 and 6).
7. Detaching takes nothing else away and gives nothing extra.

Uses: stripping donor wrecks, moving shared parts between vehicles, swapping worn parts, upgrading.

### 3.7 Replacing

- **Replace** is one action that detaches the old part and fits the new one, when the player has the tool and the new part, and the dependency rules allow it.
- **Damaged parts on a wreck:** a wreck can start with some slots holding damaged parts (battered panels, cracked glass). They're shown, but count as broken for function and protection. Fitting a good part swaps the damaged one out and shows the repaired version.
- **Upgrades** are just alternative parts for the same slot with different stats (a stronger engine, off-road tires, heavy-duty springs). The slot accepts any part with the matching type tag.

### 3.8 Workshop panel

E on a heavy or complex vehicle can open a panel instead of fitting from the hand:
- Every slot with fitted/required counts ("Tires 6/10") and condition.
- Readiness per slot: ready, blocked by which slot, missing tool, part not in reach.
- Optional leads to where a missing part can be found.
- Fit, Detach or Replace buttons, following the same rules as doing it by hand.

---

## 4. Driving

Use a raycast-wheel vehicle on a rigid body: one ray per wheel, with a spring, a damper and tire friction. Keep the driving maths in pure, engine-independent functions; the physics engine only applies the forces.

### 4.1 Pedals
- One forward/back axis. Pressing against the direction of travel brakes first and only engages reverse once the vehicle is below 0.5 m/s.
- The handbrake works on the rear wheels only.
- The service brake works on all wheels. A towed trailer brakes with the tow vehicle.

### 4.2 Engine force with a power limit
```
force = throttle × min(maxEngineForce, enginePower / max(speed, 1))
```
- Small car: 5,000 N maximum at the wheels, 60 kW. Full force at low speed, power-limited higher up, so acceleration fades naturally.
- Reverse: 40% of forward force, capped at 6 m/s.
- Heavy vehicles: multiply engine force (box truck 3.5×, tractor 5×) and brake torque.
- RWD splits drive force across the driven wheels. AWD/4WD splits it across all of them.

### 4.3 Resistance
```
resistance = dragArea × speed²  +  rollingCoef × mass × 9.81
```
Small car: drag term 0.46 N per (m/s)², rolling coefficient 0.015. Scale with mass for heavy vehicles. This gives a natural top speed and coasting.

### 4.4 Speed-sensitive steering
```
maxWheelAngle(speed) = 0.55 rad / (1 + (speed / 8 m/s)²)
```
About 31° when crawling, half that at 8 m/s, a few degrees at highway speed. The wheels turn in at 2.5 rad/s and return at 3.5 rad/s, so steering takes time and recenters faster than it turns.

### 4.5 Suspension and body (small car baseline)

| Setting | Value | Effect |
|---|---|---|
| Rest length | 0.35 m | Ride height |
| Travel | 0.45 m | Absorbs curbs and rough ground |
| Stiffness | 14 (engine units; heavy trucks ~22, trailer ~30) | Soft enough to lean, squat and dive |
| Compression damping | 2.5 | Engine defaults (~0.8) bounced for two seconds; this settles fast |
| Rebound damping | 3.5 | Higher than compression, so no pogo |
| Tire friction slip | 1.4 | Grip with a reachable limit |
| Center of mass | 0.35 m above chassis center | Visible body lean and pitch |
| Chassis angular damping | 0.4 (trailer 0.8) | Calms spins without killing momentum |
| Wheel radius | 0.38 m car, ~0.49 m box truck, ~0.56 m tractor | |

### 4.6 Physics world
- Gravity 9.81 m/s². Fixed step at 60 Hz or higher.
- Stream heightfield ground colliders in tiles (e.g. 64 m tiles at 2 m resolution, within about 224 m of the vehicle), building a few per frame and dropping distant ones. Match the visible terrain's finest lattice so what you see is what you drive on.
- Buildings, containers and built structures are static boxes. Trees collide as their trunk only.
- Parked vehicles are obstacles for the vehicle being driven.

### 4.7 Recovery
- A flip-upright key keeps the heading, zeroes roll and pitch, lifts the vehicle about 1.2 m and zeroes its velocity. Unhook any trailer first.
- A game can gate this (needs a winch or jack, or a cooldown) instead of making it free.

### 4.8 Towing
- The hitch is a ball joint between the bodies, with collisions between them disabled. It passes force but not torque, so the trailer articulates.
- Hook up by backing within about 1.8 m of the hitch, stopped, then pressing a key. An unhooked trailer stays where it was left, with its cargo.
- The trailer has its own suspension (stiffer) and brakes with the tow vehicle.
- Cargo on a trailer is a collider with real mass (e.g. a container at about 220 kg per meter of length), so a loaded trailer handles heavier.

---

## 5. Wear and tear

Every fitted part carries a **condition** from 0 to 100%. Condition belongs to the part, not the slot, so it travels with the part when it's detached, stored or moved to another vehicle.

### 5.1 What condition does

| Part | Effect as condition falls | At 0% |
|---|---|---|
| Engine | Power and max force scale down; rough idle; random stalls below ~25% | Won't start |
| Battery | Starting becomes unreliable | Won't start |
| Transmission | Slower response; occasional slip (force drops for a moment) | No drive |
| Tires | Friction slip scales down; more rolling resistance | Flat: very high rolling resistance, pull to that side, little grip |
| Brakes | Brake force scales down; uneven brakes pull under braking | Almost no braking on that wheel |
| Suspension (per corner) | Ride height sags; damping drops (more bounce) | Corner on its bump stop |
| Steering | Wander (small random steer offset) and slower response | Badly reduced lock |
| Radiator | Engine heats faster under load and at low speed | Overheats; power cut until it cools |
| Fuel tank | Leaks a share of fuel over time | Can't hold fuel |
| Glass, panels, doors, bumpers | Visual damage; less protection for the parts behind them | Visually broken; parts behind take full damage |

Use smooth curves (e.g. `effect = 0.4 + 0.6 × condition`) so wear is felt gradually instead of falling off a cliff.

### 5.2 What wears parts

- **Collisions:** take the impact impulse at the contact point and apply damage to the nearest parts by distance. Bumpers and panels in front absorb first and pass on less.
- **Use:** engine and transmission wear per hour of running, more at high RPM or heavy load; tires wear with slip (burnouts and drifts cost tread); brakes wear with braking energy.
- **Terrain:** suspension wears from hard compressions (bottoming out); tires wear faster on rough or rocky ground.
- **Overloading:** carrying or towing past a vehicle's rating speeds up suspension, tire, brake and drivetrain wear.
- **Time and weather (optional):** parked vehicles slowly gain rust and lose battery charge.

### 5.3 Feedback

- Damaged models: dents, cracked glass, drooping corners, smoke from a worn engine, a squeal from worn brakes.
- A per-part condition readout in the workshop panel and the storage screen, colored at thresholds (good, worn, failing).
- Warnings on the driving HUD for overheating, a flat tire or a failing part.

### 5.4 Fixing wear

Two options per part, which a game can mix:
- **Replace:** swap in a better part (section 3.7).
- **Repair in place:** with a tool and materials (scrap, tape, a spare-parts kit), raise condition by a set amount, optionally capped below 100% for field repairs, with full repair needing a bench.

---

## 6. Paint restoration

A cosmetic chain for vehicles that are mechanically sound. Each body panel (hood, doors, bumpers, tailgate, roof, wall panels) has its own paint state.

### 6.1 States
```
rusted  →  ground  →  painted  →  buffed
```
| Step | Tool | Consumes | Visual |
|---|---|---|---|
| Grind | Grinder | Grinding discs (optional) | Rust removed, bare metal |
| Paint | Spray gun or cans | Paint (amount per panel by size) | Flat color, no shine |
| Buff | Buffer | Polish (optional) | Full gloss |

### 6.2 Rules
- Steps happen in order per panel. You can't paint over rust or buff unpainted metal.
- Work per panel (aim at it and hold the use key, with a progress bar) or as a whole-vehicle action at a bench. The game decides; per-panel is more hands-on.
- The player picks a color before painting; different panels can be different colors (two-tone, mismatched replacement panels).
- A newly fitted replacement panel arrives in its own state (often primer or rusted), so a part swap creates paint work.
- Paint is purely visual unless the game wants it to slow rust (painted panels rust slower, section 5.2).
- Collisions can chip paint back toward bare metal at the impact point.

### 6.3 Rendering
- Drive rust with a mask in a shader: a rust amount per panel (or per vertex/texel) blends between the rust material and the paint.
- Grinding sets rust to 0 and shows bare metal. Painting sets the base color with high roughness. Buffing lowers roughness to a gloss.
- Store per panel: `{ rust, painted, color, gloss }`. It's small enough to save easily.

---

## 7. Vehicle inventory

Keep this flexible. The pieces below can be combined differently per game.

### 7.1 Basics
- An inventory is a list of slots holding stacks (`{ id, count }`). Each item has a maximum stack size.
- The player's pack and every vehicle's storage are the same kind of inventory, with different sizes.
- Moving a stack moves whatever fits and leaves the rest. Nothing is ever deleted. "Move all" repeats this for every stack.
- Open the vehicle's storage from its cargo zone on foot, or from either seat while stopped. Show the pack and the vehicle side by side.
- Cargo doors and tailgates open while storage is open.

### 7.2 Capacity models (choose per vehicle)

| Model | Rule | Good for |
|---|---|---|
| Slot count | N slots, any items | Enclosed vans and box trucks (e.g. 64 or 96) |
| Physical limits | Slot count plus limits by item shape | Open beds that show what they carry |
| Weight limit | Total mass under the vehicle's payload rating | Games that care about load and handling |
| Volume grid | Items take grid footprints (Tetris-style) | Games that want packing as a puzzle |

**Physical-limits example (small open bed):** up to 4 tires; up to 2 engines, each taking the space of 12 small stacks; small items grouped into crates of 6 stacks, 4 crates in the bed. Show a capacity line: "Tires 2/4 | Cargo 9/12 | Engines 1/2".

### 7.3 Visible cargo
On open beds and trailers, show the contents: tires as tires, engines as engines, small items as crates. It confirms the load at a glance and adds to the sense of physical cargo.

### 7.4 Cargo affects driving (optional)
Add the cargo's mass to the vehicle, and shift the center of mass toward where it sits. A loaded truck brakes longer, leans more and accelerates slower. This connects inventory to wear (overloading, section 5.2).

### 7.5 Parked vehicles
A vehicle left anywhere stays there with its inventory, and it can be used as a storage locker. Parts in a vehicle within 8 m can be used for restoration (section 3.4).

---

## 8. Grid building

Snapped pieces with simple support rules, and no per-piece physics. Fast to compute, hard to break, and still capable of thousands of layouts.

### 8.1 Grid
- Uniform square cells (e.g. 4 ft / 1.22 m) and stacked levels (e.g. one shipping container high).
- Each piece fills a block of cells after rotation (0° or 90°). No two pieces share a cell.
- The first placement sets the build's ground elevation; the grid can cover the whole world.

### 8.2 Support rules
1. Level 0 sits on the ground.
2. A large piece above level 0 needs at least a minimum share of its footprint resting on something below, or something under all four corners. Generous overhangs and bridges are fine; floating isn't.
3. A single-cell piece (pillar, post) needs something directly under it.
4. If a placement isn't supported, offer to add corner pillars down to whatever is below. Those pillars belong to the piece and are removed with it, unless something else now rests on them.
5. A piece can't be removed if that would leave something above it unsupported.

Support is a count of occupied cells, not a physics simulation.

### 8.3 Placement flow
- Select a piece and show a ghost snapped to the cell under the crosshair: green if valid, red with a reason if not.
- R rotates; PageUp/PageDown change level; left click places.
- Removal: aim, right click, then confirm. It respects the support rules.
- Placed pieces become static colliders for walking and driving straight away, without resetting any vehicle.

### 8.4 Piece families (examples)
- **Large modules:** shipping containers (10 ft, 20 ft, 40 ft), sheds, prefab rooms.
- **Structure:** pillars, floors, walls, roofs, stairs (four directions), decks, rails.
- **Openings:** doors, windows, shutters, garage doors. Fitted into a module's wall, they replace that wall section with a real opening for walking, driving and rendering. E opens and closes them.
- **Walkable surfaces:** floors, roofs, decks and stairs give elevations for walking.

### 8.5 Getting pieces into the world (choose per game)
- **Menu building:** pick from a catalogue and pay materials.
- **Physical hauling:** large pieces exist in the world and must be carried in by vehicle. Load from a trailer (e.g. one 20 ft or two 10 ft containers per flatbed), drive to the site, place from the trailer by hand. A piece loaded from the world is removed from it, so nothing is duplicated.
- **Mixed:** haul the big modules, build the small parts from materials.

### 8.6 Building and vehicles together
- Garage doors big enough to drive through.
- A grid-placed workbench or lift where restoration can happen: the place for full repairs and paint work.
- Parking areas for the fleet.

---

## 9. Architecture rules

- **Rules separate from visuals.** Part fitting, detaching, wear, paint states, inventory and grid support are plain functions over plain data. They can be tested without a renderer or physics engine.
- **Content as data.** Vehicles, part slots, part types, wear curves, paint steps, storage models and building pieces are tables.
- **Atomic actions.** Fitting, detaching, replacing, repairing, painting a panel and moving stacks either fully succeed or change nothing.
- **Named model parts.** Vehicle models expose one sub-object per part slot, plus a damaged variant and per-panel materials, so the game can drive visibility, damage and paint by name.
- **Save everything.** Vehicle position, fitted parts with condition and paint per panel, vehicle inventories, and the grid layout.
- **Performance.** Batch materials, stream terrain colliders, use level of detail for vehicles and large building pieces, and set a model budget per vehicle so a fleet stays affordable.
