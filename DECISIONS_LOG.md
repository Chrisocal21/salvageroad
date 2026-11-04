# Decisions Log

Anything decided that Chris did not specify, library comparison results, and open questions. Newest at the bottom.

## Current state at a glance (updated 2026-11-04, after the one-map merge and HUD work)

This is a summary so you do not have to read the whole history. The dated entries below stay as they were written; where a later entry changed an earlier one, the later one wins.

What the game is now (localhost:3000; /base/ is the container builder sandbox, /world/ the world viewer, /lab/ the physics comparison):
- A 12 km island from a seed (seed 1 by default, ?seed=7 for another): land, rivers, lakes, ocean, a desert round the start. src/rules/world.ts, with detailed walkable ground in src/rules/ground.ts and drawn tiles in src/render/terrainTiles.ts.
- The player wakes in the desert, 450 m from the town, with a low dune hiding it. The town (a 3 by 3 block of lots, some walk-in stores with shelves) sits on levelled ground beside a fenced junkyard.
- The junkyard holds the El Cajon on blocks as a rusty shell, 18 loose pieces (15 kinds: engine, battery, hood, 4 wheels in one stack, seat, two bumpers, tailgate, dashboard, steering wheel, windshield, two doors, grille, headlights), a toolbox with the wrench, a big rig tyre, and one 20 ft shipping container. Order and rules are in src/rules/carParts.ts.
- The truck: driver's door to drive, passenger door to ride, hood opens, bed storage (24 slots) shows what is in it. src/rules/vehicleZones.ts, vehicleStorage.ts, bedLoad.ts.
- Keys: W/A/S/D move or drive, Shift run, E use, F eat, Q drink, Tab or I inventory (in the truck: pack plus vehicle storage), C switch seat, U unload containers, R reset (or rotate while placing), J jump to the town, G fly mode (T lands), B performance run, M map (click it to travel there, for testing), N and [ ] reseed the world, H is gone. URL options: ?fixed=1 starts with the truck whole, ?cargo=ft20,ft40 puts containers on the truck, ?objects=N sets the prop count.
- The plan of places (src/rules/places.ts): starting town, 1 city, 3 more towns, 4 villages, 1 industrial yard, 6 outposts, 5 lookouts and 2 docks. In the game each place is a pole with a coloured lamp for now; the buildings are still to come. tools/place-map.ts draws the plan as a picture.
- The road network (src/rules/roads.ts): highways, roads, dirt roads and trails join every place, with bridges over water. The game levels the ground along the roads and the decks carry the walker and the truck (src/rules/ground.ts). Also drawn in the /world/ viewer.
- A minimap sits top right; M opens the big map with every place named, the roads, bridges in red, a scale bar and a player arrow (src/ui/mapOverlay.ts). The HUD has an always-visible hotbar and a click-to-use inventory (src/ui/hud.ts).
- Tests: 196, two failing (the old cannon-es ramp comparison, which the game does not use, and a work-in-progress yard vehicles tolerance test).

Not saved on reload: the truck rebuild, the inventory, the loot, the bed contents. Only the base (placed containers) is saved, in the browser, under its own key.

Known limits (collected): parts are not solid and can be dropped inside walls; store interiors are lit like outside; the sea is flat and the shore blocky from the air; the truck can drive into the sea; the bed's contents do not move as the truck drives; doors have no collision; no fuel, damage, weather or time of day; the performance run (B) has not been re-measured since the world grew; wading under a bridge reads the deck as the ground, so the deep-water block does not apply there.

## 2026-11-02 Setup

Decided by Chris:
- Test machine is the dev laptop: AMD Ryzen 5 7535HS (6 cores), Radeon RX 6550M, 31 GB RAM. Treated as the "mid-range laptop" baseline.
- Repo layout approved: src/rules (plain TS game rules), src/render (Three.js), src/data (content as data), tests, docs.

Decided by Claude (Chris did not specify):
- Package manager: npm (Node 24.12, npm 11.6).
- Latest versions installed: three 0.187, vite 8, typescript 7, vitest 5. Not checked against older docs or habits; verify APIs as we use them.
- Test runner: vitest.
- Vite dev server uses port 3000 with strictPort, so it fails loudly instead of silently moving to another port.
- Placeholder scene (ground plus a spinning box) only proves the toolchain; it will be replaced by the physics test.
- Planning docs live in docs/.

Open questions (from docs/ROADSURVIVAL_OPEN_QUESTIONS.md, relevant to Step Zero):
- Driving camera: cockpit, chase, or switchable
- Keyboard layout: DECIDED by Chris, WASD to drive and Space to brake (arrow keys also work in the lab). Gamepad still open.
- HUD and menus: canvas or HTML
- How heavy and arcade-like driving should feel
- Art budget

## 2026-11-02 Physics library comparison (stage 3)

Setup: same car (1400 kg box chassis, 4 raycast wheels, rear-wheel drive), same flat ground, same ramp, same driving script, both libraries behind one small interface (src/lab/types.ts). Versions: @dimforge/rapier3d-compat 0.21.0, cannon-es 0.20.0. Both use a raycast vehicle model (wheels are rays, not physical cylinders).

Measured headless in Node on the dev laptop (tests/physics-lab.test.ts):
- Step cost: rapier about 0.03 ms/step, cannon-es about 0.03 ms/step. Both tiny for one car. This says nothing yet about a whole world; that is stage 5.
- Settles at rest height 0.73 (rapier) and 0.75 (cannon-es). Both drive forward and steer.
- Ramp: Rapier drives over it and keeps going. cannon-es stalls on the ramp at about z=4 with throttle held. Changing suspension stiffness (30/60/100), suspension travel (0.3/0.5) and wheel friction (1.4/3) made no difference. The car is upright and tilted with the ramp, so it is stuck, not flipped. Cause not found. It may be how the chassis box meets the ramp box in my scene, not a hard limit of the library.

Quirks found:
- cannon-es drives toward +Z with a NEGATIVE engine force; the adapter flips it.
- Rapier steering needed a sign flip to match cannon-es.
- Rapier's vehicle controller is in the compat build as DynamicRayCastVehicleController; its forward-axis setter is oddly named setIndexForwardAxis.
- Rapier needs an async init (loads wasm) before use; cannon-es is plain JS.

Not measured yet: how the cars FEEL (needs Chris), and browser frame rate. Both are available at /lab/index.html?engine=rapier and ?engine=cannon on localhost:3000.

Leaning: Rapier, because it cleared the ramp without tuning and is actively maintained. Chris decides after driving both.

### Update after Chris drove both (same day)

Chris reported: cannon-es feels smoother but stops randomly; Rapier does not turn enough.

- cannon-es "stops randomly": FOUND AND FIXED. The cause was the infinite ground Plane. Wheel rays against it made the car stall, even on flat ground with no ramp. Swapping it for a big flat box (same as Rapier) fixed it: the car now drives 170 m without stopping. This was a bug in how I set up the scene, not a flaw in cannon-es.
- cannon-es ramp stall: still there. Same position (z about 4) after the ground fix, so it is a separate problem. Cause not found.
- Rapier "does not turn enough": the headless measurement says NO difference. At 8, 15 and 25 m/s with full steer, both cars turn at the same rate (about 0.87, 0.68 and 0.45 rad/s). So the cause is probably the steering angle and speed, not the library. Turning gets weaker as speed rises because the steering angle is fixed at 0.5 rad. Both cars reach about 35 m/s with the throttle held. The fix is a tuning decision (more steering angle, or steering that eases in), which depends on how arcade Chris wants the driving to feel. This is the open question "how heavy and arcade-like".
- Corrected leaning: the library choice is not clear-cut anymore. Both feel similar in physics. Rapier clears the ramp; cannon-es does not yet.

## 2026-11-02 Stage 4: drivable El Cajon

Decided by Chris:
- Physics library: Rapier (cannon-es is no longer used for the game; the cannon-es lab stays at /lab for reference).
- Driving feel: realistic, like a real car (not arcade).

Decided by Claude (Chris did not specify), all in src/rules/driving.ts so they are easy to tune and are tested without a browser:
- Engine: 5000 N grip limit at low speed, 60 kW power limit above that. Measured 0 to 100 km/h in about 11.6 s, top speed in the region of 130-150 km/h (drag-limited).
- Air drag and rolling resistance applied as forces against travel.
- Braking about 8.9 m/s2 from 100 km/h (stops in 3.1 s). Pressing the opposite pedal brakes first and only reverses once stopped. Reverse limited to 6 m/s.
- Steering: wheel lock 0.55 rad when crawling, falling to half at 8 m/s, and eased in at 2.5 rad/s instead of snapping. Turn rate at speed is now lower on purpose.
- Space is a handbrake (rear wheels only).
- Physics runs at a fixed 60 steps/s with an accumulator, so feel does not depend on frame rate.
- Camera: chase camera, PROVISIONAL. Chris has not chosen cockpit, chase or switchable.
- The on-screen text (speed, fps, keys) is an HTML overlay used as a temporary debug readout. Canvas or HTML for the real HUD is still open.
- The ramp from the lab is still in the scene, 20 m ahead of the spawn point, so the suspension can be tested. Easy to remove.
- The ground is 1000 m square. Driving off the edge falls forever; falling below y=-20 resets the car.
- Placeholder model: boxes only (src/render/elCajon.ts). Wheels steer and spin.

Not verified: how it looks and feels in a browser. Only the numbers were measured headless.

### Update after Chris tried stage 4

Chris asked for mouse look, and said the truck bounces like the old cannon-es one, "as if there was a box tire".

- Bounce: FOUND AND FIXED by measurement. Cruising on flat ground was smooth, but after any drop the car oscillated for about 2.2 s, 7 overshoots, and the suspension bottomed out (chassis dipped from 0.75 m to 0.48 m). Rapier's default damping (0.83 compression, 0.88 relaxation) is far too low for this car. Now 4 and 5: it settles in about 0.7 s with one small overshoot and no bottoming (lowest 0.67 m). A test (tests/physics-lab.test.ts) guards this. If it now feels too stiff or floaty, these two numbers in src/lab/types.ts are the ones to move.
- Mouse look: click the page to capture the mouse, Esc to release. The chase camera orbits the car (yaw and pitch), and drifts back to straight behind the car after 2.5 s without mouse movement. Sensitivity 0.0025 rad per pixel, not inverted. All provisional; the camera choice (cockpit, chase, switchable) is still open.

### Update: "the whole world bounces at top speed"

Chris reported everything shaking at top speed, like a whoop section. This was the camera and the render timing, not the suspension.
- Cause 1: physics runs at a fixed 60 steps/s but Chris's screen draws 144 fps. The car was drawn at its latest physics position, so on most frames it did not move and then jumped about 0.7 m at 40 m/s. Fix: each frame draws the car at a blend (interpolation) between the last two physics states.
- Cause 2: the camera followed with a per-frame lerp (0.12), which depends on frame rate and lags more at speed, amplifying the stutter. Fix: the camera is now rigidly attached behind the car; only its heading (6 per second) and height (8 per second) are smoothed, using time-based smoothing that does not depend on frame rate.
- Not verified in a browser. If shaking remains, the next suspects are the 1000 m grid lines flickering (aliasing) and the physics ground contact, in that order.

### Update: "tires turning and the shocks need to be a bit better"

Chris said the truck's tyres turning and shocks need to be a bit better after the shaking fix. The wording is general, so I measured the body motion instead of guessing:
- Before: hard braking from 80 km/h tipped the body only 1.2 degrees, cornering rolled it 0.4 degrees, launch squat 0.7 degrees. A real car does roughly 2-4 degrees. The suspension looked dead and the truck looked glued flat. The cause was a very low centre of mass (at wheel-mount height) plus a stiff, heavily damped spring.
- Changes (all in src/lab/types.ts): centre of mass raised 0.35 m above the chassis centre, spring stiffness 30 to 14, suspension travel 0.3 to 0.45 m, damping 4/5 to 2.5/3.5.
- After: braking dive 3.8 degrees, cornering roll about 1.5 degrees, no bottoming out (belly stays about 0.2 m off the ground), settles after a 1.6 m drop in under 1 s. Softer springs than this bottomed out on drops, which is why I stopped here.
- Wheel visuals: wheels now hang along the car's own down direction, so they follow the body when it leans, instead of straight down in world space.
- A regression test (dive 1.5 to 6 degrees, belly stays off the ground) guards this.
- Steering and wheel spin visuals were checked by reasoning (front wheels yaw with the steering, spin turns forward when driving forward) but not seen in a browser. If "tires turning" meant something specific that looks wrong, that is still open.
- Side effect: with the softer setup the ramp launch is a little gentler.

## 2026-11-02 Stage 5: performance baseline (built, graphics not yet measured)

Chris said the driving is fine for now and to move on. The handoff's next stage is the performance baseline: generated terrain plus a few hundred placeholder objects, frame rate measured on the test laptop, no art.

Decided by Claude (Chris did not specify):
- Terrain: 400 m square, 200 x 200 cells (2 m spacing, 40,401 vertices), seeded noise (4 layers, hills up to about 7 m), flat within 60 m of the origin so the spawn and test ramp stay level. Seed 1. src/rules/terrain.ts.
- The physics ground is a Rapier heightfield built from the same grid as the visible mesh. A test fires rays at it and checks the heights match the height function. Rapier's heightfield counts cells, not vertices (a first attempt crashed on that).
- Props: 300 by default, seeded (seed 7), kept at least 45 m away from the origin: 60 percent trees, 25 percent crates, 15 percent rocks. Drawn as instanced meshes (4 draw calls for all of them). They collide: trees as their trunk only, others as a box. ?objects=1000 in the URL changes the count.
- No quality settings were added (still a proposed item needing Chris's approval). The pixel-ratio stress phases below are only a measurement tool.
- The ground is 400 m square with no walls: driving off the edge falls, and the car resets when it falls below y=-20.

Performance run (press B in the game): the truck drives a circle by itself for 36 s in three phases (normal, 2.25x pixels, 4x pixels). The extra-pixels phases are a rough stand-in for a weaker GPU, because I cannot throttle the real one. It records average fps, 1 percent low fps, worst frame, hitches over 20 ms, CPU time per frame, draw calls and triangles, and the GPU name the browser reports. The report appears on screen (X closes it) and in the console.

Known limits of the measurement:
- The monitor is 144 Hz, so frames are capped near 6.9 ms. A result of 144 fps means "at least that fast", not exactly how much spare room there is. The extra-pixels phases are what show the headroom.
- The circle stays in the flat start area, so it sees fewer hills and props at once than a full drive would. ?objects=3000 makes the scene heavier.
- CPU time is JavaScript time only; GPU time is not measured.
- The browser may run on the integrated Radeon instead of the RX 6550M. The GPU line in the report shows which one.

Measured without a browser (Node, this laptop), physics and generation only:
- Terrain generation 9 ms. World build with 300 props 17 ms.
- Physics step average: 0.05 ms (no props), 0.07 ms (300 props), 0.14 ms (1,000), 0.35 ms (3,000). Worst single step about 2.5 ms at 3,000.
- So physics is a small slice of a 16.7 ms frame (60 fps) even with 3,000 props. Rendering is what remains to be measured.

### Stage 5 first result (Chris's laptop, 300 props)

- GPU the browser used: ANGLE (AMD, AMD Radeon(TM) Graphics 0x00001681, Direct3D11). That is the INTEGRATED Radeon in the Ryzen, not the RX 6550M. Closer to a typical mid-range laptop, so a fairly conservative baseline. (Chrome can be pointed at the RX 6550M in Windows graphics settings if wanted; not done.)
- Screen 1920x991, pixel ratio 1, 300 props, 24-25 draw calls, about 91,400 triangles.
- Normal, 2.25x pixels and 4x pixels all gave 143.8 fps (7.0 ms), 1 percent low 140.8 fps, worst 7.6 ms, 0 hitches over 20 ms. CPU 0.4-0.5 ms per frame, physics 0.10-0.13 ms.
- Reading: the 144 Hz screen caps the frame rate, so this only shows the game is AT LEAST that fast. Three identical results is suspicious: either there is a lot of headroom, or the extra-pixels setting did not take effect. The report did not show the real drawing size, so this could not be told apart.
- Follow-up made: the report now prints the actual drawing resolution for each phase, and a 9x pixels phase was added (the run is now 48 s). Re-run needed. A second run with ?objects=3000 would show how the scene scales with more props.
- Not yet a conclusion: how this compares to a weaker mid-range laptop. Until the headroom is shown, the safe statement is "no problem found at 300 props on this machine".

### Stage 5 second result (Chris's laptop, still 300 props, run with the new report)

- The extra-pixels setting DOES work: the drawing size was 1920x991 (normal), 2880x1486 (2.25x), 3840x1982 (4x) and 5760x2973 (9x).
- Normal, 2.25x and 4x pixels: 143.8 fps, 1 percent low 140.8, 0 hitches. At 4x that is 7.6 million pixels per frame held at 144 fps.
- 9x pixels (17.1 million pixels per frame): 80.8 fps average, 1 percent low 47.6 fps, worst frame 41.7 ms, 76 hitches over 20 ms. CPU was only 0.7 ms per frame, so this is the GPU running out, not the code.
- Reading: on this integrated Radeon the scene tops out at roughly 1.4 billion pixels per second. A normal 1080p frame at 144 fps needs about 0.27 billion, so there is roughly 5x spare GPU room at 144 fps and about 12x at 60 fps. In other words a GPU about 4-5x weaker than this one should still hold 144 fps at 1080p, and a much weaker one should still hold 60.
- Caveats: this is only the pixel-filling cost of a plain, unlit-ish scene with no shadows, textures or effects. Real art, shadows, grass, weather and a town will use much of that room, so the spare 5x is an upper bound on what the game can spend, not a promise. A higher-resolution laptop screen (pixel ratio above 1) costs more per frame.
- This run was still 300 props (the URL option ?objects=3000 was not used), so scaling with prop count is still unmeasured on the real GPU. The Node physics numbers (0.35 ms per step at 3,000 props) suggest physics is not the limit.

## 2026-11-02 Stage 6: town, first-person walking, looting, enter and exit the truck (built, not yet seen in a browser)

Chris approved moving on to the town, first-person walking, looting containers, carrying items, and entering and exiting the vehicle.

Decided by Claude (Chris did not specify):
- The town is a seeded 3 by 3 grid of lots (28 m) with 9 m streets, centred at (0, 100), about 84 m across. Roughly 85 percent of lots get a building (boxes, 9 to 15 m wide, 3.5 to 7 m tall). Buildings are solid boxes you cannot enter yet; interiors are a later job. src/rules/town.ts.
- Each building gets 1 to 3 containers against its walls. Four kinds, as data in src/data/containers.ts: crate (food, water, rope, scrap), locker (bandages, batteries, water, a rare wrench), dumpster (mostly scrap), toolbox (wrench, tape, scrap, batteries). Items are data in src/data/items.ts (9 items). Contents are rolled the first time a container is opened and are the same every run for the same seed.
- The terrain now has two flat zones: the old test field at the origin and the town, so the town sits on level ground.
- Start: you spawn on foot 22 m south of the town's first street. The El Cajon is parked on that street, 20 m west of the town centre, facing east. The old ramp and grid stay at the origin as a test field.
- Inventory: 12 slots, each one kind of item, stacks as listed per item. If it is full, what does not fit stays in the container.
- Walking: a circle that slides along walls, boxes, trees, rocks and the parked truck, plain geometry (not the physics engine). Walk 3.2 m/s, run (Shift) 6 m/s. First-person eye height 1.7 m. Mouse look uses the same click-to-capture as driving.
- E uses what you are close to (within 2.2 m) and roughly facing, or anything you are touching. E on the truck gets in. E while driving gets out, only below 3 m/s, on the driver's (left) side. The truck is held by the handbrake while you are out.
- The performance run (B) puts the truck back on the open test field, so its numbers stay comparable with the earlier runs. R puts you and the truck back at the town. Looted containers stay looted after R.
- The on-screen text for prompts ("E: open the crate"), messages and the carried-items line is added to the existing temporary debug readout. It is NOT a real HUD or inventory screen: no crosshair, no menus. The HTML-versus-canvas question is still open and nothing beyond that text was built.

Tests added: inventory, loot (reproducible, within the table, dumpsters mostly scrap), town (reproducible, buildings off the streets and apart, containers out of walls), walking, interaction, and a check that for five different town seeds every container can be reached on foot from the start. Also the physics world holds the town boxes and parks the truck where the town says.

Found while doing this: src/render/elCajon.ts was changed on disk by someone other than Claude (a much more detailed truck model). Claude did not touch it and did not commit it.

Not verified: how any of this looks or feels in a browser. First-person direction conventions (yaw, mouse left and right) are covered by tests, but not yet seen on screen.

## 2026-11-02 HUD decision and first real HUD

Decided by Chris: the HUD and menus are built as HTML on top of the canvas (Claude recommended it: faster to build and change; it can be swapped later). This closes the open question "canvas or HTML for the game interface".

Built (src/ui/hud.ts and hud.css), behind a small interface so the game code never touches page elements directly. Swapping to a canvas HUD later would mean rewriting only that one file:
- Crosshair dot while on foot.
- Interaction prompt with a key cap, for example [E] Open the crate, [E] Get in the El Cajon, [E] Get out.
- Toast message that fades after 4 s ("Took 2 canned beans", "Inventory full", "Empty", "Slow down to get out").
- Inventory panel on Tab or I: a 3 by 4 grid of the 12 slots with item names and counts, and "n of 12" used. Display only for now; you cannot drop, use or move items yet.
- Speedometer (km/h) while driving.
- Small controls reminder at the bottom left, and the fps/debug readout at the top left (still shown; not part of the real HUD).
- Style: muted dark panels, light text, one warm accent colour, system font. Placeholder look, not a design.

Claude's choices that Chris did not specify: Tab and I as the inventory keys, the position and style of everything above, and the 4 s toast time.

Tests: 5 HUD tests run in a simulated browser page (jsdom was added as a dev dependency). The HUD has NOT been seen in a real browser yet.

## 2026-11-02 Hunger and thirst (built, not yet seen in a browser)

Chris said to keep going; Claude picked the next unbuilt Phase 1 item, survival (Feature 1.3), because food and drink could already be looted but not used.

Decided by Claude (Chris did not specify), all numbers are placeholders to tune by feel:
- Two bars, hunger and thirst, from 100 (full) to 0. Hunger empties in 20 minutes, thirst in 12. They drain the same on foot and in the truck.
- F eats, Q drinks. It uses the smallest item that fills the gap, or the biggest if none do. Nothing happens (with a toast) if you have none or the bar is full.
- Restore values: canned beans 35, crackers 15, water bottle 40. This is data on the item (restores in src/data/items.ts).
- An empty bar does NOT kill you yet. It only slows walking to 60 percent. No health, damage or death exists. That is a bigger design question left for Chris.
- HUD: two thin bars at the bottom left; a bar turns red-orange under 25.
- The bars do not drain during the performance run (B).

Tests: 7 survival tests and 1 HUD test added. All pass.

Known, not caused by this work: the cannon-es "drives over the ramp" test in tests/physics-lab.test.ts fails on the clean checkout too (the comparison engine, not the Rapier one the game uses).

## 2026-11-04 New concept adopted (docs/SALVAGE_ROAD_CONCEPT.md)

Chris brought a new concept from a planning chat. It replaces parts of the earlier ROADSURVIVAL files. Saved as docs/SALVAGE_ROAD_CONCEPT.md. Nothing was built from it yet; the order of work is waiting for Chris.

What the current code does that the concept changes (found by reading the repo, nothing changed yet):
- Start: you spawn 22 m from the town with a working El Cajon parked on its street. Concept: start on foot on a road, find a scrapped El Cajon with no parts.
- The El Cajon is a full model with working driving. Concept: it is built up part by part. Needs a parts and repair system.
- Naming clash: in the code, "container" (src/data/containers.ts, town.containers, main.ts) means a lootable crate, locker, dumpster or toolbox. In the concept, "container" means a shipping container for the base. Suggest renaming the code one to "lootable" before base building starts. Not done.
- src/bench.ts is the performance-run tool, not the pop-up bench. No pop-up bench exists yet.
- Hunger and thirst exist; the concept leaves "should empty hurt or kill" open. Still only slows walking.
- docs/ROADSURVIVAL_PROGRESS_TRACKER.md is out of date (shows 0 percent, old Step Zero list). Not updated.

## 2026-11-04 Container base builder prototype (built, live at /base/)

Chris approved starting with the shipping-container prototype. It is its own page (localhost:3000/base/) so the main game is untouched. Files: src/data/shippingContainers.ts, src/rules/baseBuild.ts, src/rules/baseAim.ts, src/render/baseView.ts, src/base/main.ts, base/index.html. New code says "shipping container" to avoid the clash with the lootable "containers".

Decided by Claude (Chris did not specify), all placeholders to tune by feel:
- Grid: 4 ft (1.2192 m) cells. A container is 2 cells wide and 5 (20 ft) or 10 (40 ft) long, one level 2.5908 m (8.5 ft) high. The 4 ft grid allows half-width offsets.
- Support rule (the [proposed] one, now built): above ground, at least 40 percent of a container's footprint must sit directly on containers one level down. So up to a 60 percent overhang, bridges across gaps, no floating. It is a cell count, not physics. Constant: SHIPPING.minSupport.
- Removing a container is refused if something above it would drop below that support.
- Height limit 8 levels (0 to 7). Grid limit 2000 cells from the origin. Both are constants.
- The ground is flat. Building on slopes (foundations, levelling) is not handled.
- Placement by mouse: aim at ground, at a top face (goes on top, can overhang), or at a side face (goes flush beside it). Controls: click place, right-click remove, R rotate, T 20/40 ft, C colour, WASD/QE/ZX/wheel camera, 1/2/3 add 100/500/2000 random containers, 0 clear.
- The build is saved in the browser (localStorage) so code edits do not lose it. ?demo=N loads N random containers without saving.
- Look: corrugated, painted boxes in six faded colours. Placeholder.

Measured (headless Chrome on this laptop, screenshot tool): 2000 containers, 6 draw calls, 48,000 triangles, 122 fps, 1 percent low 71 fps (includes start-up hitches). Aiming (a ray test per mouse move) costs 5.3 ms at 2000 containers and grows with count: fine now, but it would need a grid lookup instead of a ray test at 8000 or more. Not measured: the real GPU in a normal browser window, and what real doors, windows and interiors will cost.

Tests: 23 new (rules, support rule, removal, random base is valid and reproducible, aiming). The one failing test in the repo is still the old cannon-es ramp test.

### Update after Chris tried the builder (same day): build anywhere, pillars, build menu

Chris said containers can only go on top of other containers; they should go anywhere, with a pillar added when nothing is under them, and the builder needs a real build menu.

Built (all in /base/), decided by Claude where Chris did not specify:
- Build level: PageUp / PageDown (or [ and ]) sets the level. Aiming at empty ground places at that level, so a container can go anywhere at any height. Aiming at a container still snaps to it (top = on top, side = flush beside). Limit: 8 levels (0 to 7).
- Automatic pillars: a container with too little under it gets a pillar at each of its four corners, down to the ground or to the first piece below. The green ghost shows the pillars before you click, and the status line says "+4 pillars". They belong to the container and are removed with it.
- Support rule now has a second way to pass: something under all four corners counts as held up (corner posts), even if under 40 percent of the footprint is covered. Needed so a container on four pillars is valid.
- Pillar is its own piece: one grid cell, drawn 0.5 m square, any number of levels tall. Can be placed by hand (needs ground or something under it) and removed by right click (refused while it holds up a container).
- Build menu (bottom of the screen): data in src/data/buildItems.ts with categories. Currently Containers (20 ft, 40 ft) and Structure (support pillar). Keys 1, 2, 3 also select. Adding a piece to the menu is one line there plus teaching the rules and view about it.
- Controls changed: random-container keys moved to Shift+1/2/3 and clear to Shift+0, because 1, 2, 3 now select from the menu. T (switch 20/40 ft) is gone; the menu does that.
- Not done: no floors, walls, stairs, doors, windows or roofs yet; the menu is ready for them but Chris has not said which come first. Pillar look is a plain grey post.

Incident: while Claude was editing src/base/main.ts in several steps, the open browser tab loaded a half-edited file that threw an error on every frame, which flooded the dev server log and froze the server. Fixed by restarting it. Lesson for next time: write whole files in one step instead of patching in pieces while the page is open.

Tests: 8 more for pillars and automatic support. 110 total; the only failure is still the old cannon-es ramp test.

## 2026-11-04 Real container model, first-person building in the main game

Chris added a shipping container model (Desktop\assets\shipping-container-proz.glb) and said building should be first person, "same as the other version of the game". Chris clarified that zombiesiege is 100 percent different from this game, so nothing was taken from it. "The other version" is read as this game's first-person walking at localhost:3000. If that is wrong, say so.

Container model:
- Copied to public/models/shipping-container.glb (1.3 MB, 4,208 triangles, one mesh, blue weathered paint, 2048 px textures). It is a 20 ft container: 6.13 x 2.44 x 2.59 m, scaled by under 1 percent to fit exactly 5 x 2 cells and one level.
- A 40 ft container is drawn as TWO of the 20 ft models end to end (no 40 ft model exists). A middle seam shows. A real 40 ft model would replace that.
- Paint colour picking is gone: the model's own blue paint is used (tinting it would muddy it). The colour field is still saved but unused.
- Level of detail (src/render/baseView.ts): only containers within 45 m AND on screen get the full model; every other container is a plain box with a ribbed texture, so a big base stays cheap. Measured headless: 2000 containers 16 fps without it, 83 fps with it (8 detailed). Headless Chrome here probably renders in software, so use these as a comparison only, not as real frame rates.
- ASSET_LICENSES.md created. The container's licence and source are UNKNOWN: Chris must find where it came from. The file name suggests an author "proz". A paid release needs this resolved.

First-person building in the main game (src/main.ts, press H on foot):
- Crosshair aims (reach 28 m). Left click places, right click removes, R rotates, mouse wheel or PageUp/PageDown sets the build level, 1/2/3 pick from the build bar. Same rules as /base/: snapping, 40 percent support or four corners, automatic pillars, ghost with pillar preview.
- HUD build bar (src/ui/hud.ts): items, selected item, build level, and a status line that says what the spot would do or why it is refused.
- Built pieces save to the browser and are SHARED with the /base/ page (same storage key). A base built there appears in the game.
- Containers and pillars at ground level block walking. Raised containers (underside above 1.9 m) can be walked under. You cannot walk onto or along a container top yet.
- The truck collides with built pieces. The Rapier world takes them live (CarSim.setBuildBoxes), so building does not reset the truck. Tested: stopped by a box present from the start, stopped by one added live, passes after removal, drives under a raised one.
- Where building is allowed (src/rules/baseWorld.ts, Claude's choice): flat ground only, which today means the test field at the origin and the town zone, because terrain elsewhere is hilly and the grid assumes level ground. Pieces may not overlap town buildings, lootable containers, props or the ramp (checked at any height, conservative), the player (within 0.75 m), or the truck (within 3.2 m).
- E (use) and prompts are off while in build mode. R rotates instead of resetting while in build mode.
- Shadows now follow the player on foot and cover about 44 m instead of 14 m, so shadows from built containers show; shadows are a little softer when driving as a result.
- The performance run (B) hides the base and uses the bare test field, so its numbers stay comparable.

Other assets in Desktop\assets (4.2 GB, 55 files), NOT used yet:
- bear, wolf, moose, crab (glb, 20 to 32 MB each): too heavy as they are (need compression and a polygon budget) and hunting is not scheduled yet.
- glock17, Remington 870 shotgun, AK files, zombie collection: the concept has no weapons and no enemies at first.
- City and building packs, garage scene, RainCity, textures: huge, mostly zips and Blender files, licences unknown. No tree model was found by name; trees may be inside a zip.
- Everything there needs its licence recorded before it ships. Nothing else was copied into the repo.

Not verified: how it feels with a real mouse and keyboard (pointer lock cannot be done by the test script; placing was driven by calling the same functions the click calls). Chris's screenshot of a container sitting across another in an L shape was not reproduced: the ghost in it was red, but the screenshot did not show the reason. With pillars every position that does not overlap another piece should now be allowed.

## 2026-11-04 Design change from Chris: containers are hauled by a tow truck, not built from a menu

Chris's story and lore note: the player finds the El Cajon and fixes it, drives around collecting, sees shipping containers all over the map, finds a tow truck for oversize vehicles, fixes it, and uses it to move containers to the compound site. The player places containers by moving them, not from a build menu. Saved in docs/SALVAGE_ROAD_CONCEPT.md (new section at the end).

Effect on what is built (nothing changed yet):
- The H build mode and bar in the main game place containers from a menu. That contradicts the new design for containers. It stays for now as a working test of the grid, support rules, pillars, collisions and saving, which the new design can still reuse for how a dropped container settles.
- Needed later, none started: containers scattered in the world as objects; a repairable tow truck (second vehicle); lifting, carrying and setting down a container; a way to drop it that snaps to the grid; truck physics with a load.
- Open (asked of Chris): does a dropped container still snap to the grid and follow the support rules, and what are pillars and other structure now.

## 2026-11-04 Unloading containers from the truck (replaces the H build menu in the main game)

Chris's flow: pull up to the site, press the unload button, which goes into a placing mode; choose where the container goes, in first person, and be able to see where it will land so it is not dropped by mistake. Answer to the earlier question: dropped containers DO use the grid snapping and support rules, with pillars appearing under them.

Built (src/main.ts, src/render/baseView.ts, src/ui/hud.*):
- U starts unloading: when driving slower than 3 m/s (you get out), or on foot within 7 m of the truck. Needs something on the truck. U again finishes. Unloading also ends by itself if you get in the truck or walk more than 45 m from it.
- The H build mode and the menu are GONE from the main game. The /base/ page still has the menu, as a sandbox.
- PLACEHOLDER LOAD: the El Cajon "carries" four containers (20 ft, 20 ft, 40 ft, 20 ft) every time the page loads, because the tow truck and containers in the world do not exist yet. Nothing is shown on the truck's bed. Remove when the real system arrives.
- The crosshair shows the next container as a ghost: translucent block, a bright outline that shows through anything in front of it, a flat coloured patch on the ground under it (so an overhang's footprint is visible), and the pillar previews. Green means it can go there, red means it cannot, and the line below says the reason ("The ground is not flat here", "You are standing there", "Needs support...") or what will happen ("Click to put it down: level 2  +4 pillars").
- Click puts it down. Right-click picks a placed container back up onto the truck (refused if something rests on it), so a mistake costs nothing. 1 to 9 choose which container on the truck is next, R rotates, mouse wheel or PageUp/PageDown set the height.
- The HUD bar shows "On the truck: n" with the load listed, the build level, and the status line. Toasts sit above the bar so they do not overlap it.
- Everything else from the earlier build mode still holds: flat ground only, not through buildings, props, you or the truck; ground-level containers block walking and the truck; the base is saved in the browser and shared with /base/.

Tested headless by driving the same functions the clicks call: refused far from the truck; started near it; placed twice (load 4 to 2); placed a raised container with four pillars; picked one back up (load 2 to 3). Typecheck clean; tests unchanged (the old cannon-es ramp test is still the one failure). Not tested: a real mouse and keyboard (pointer lock), and the feel of aiming.

## 2026-11-04 (evening) New direction from Chris: the world first, piece by piece

Chris laid out the whole game arc (saved in docs/SALVAGE_ROAD_CONCEPT.md, last section): El Cajon found and fixed, parts and tools gathered, a big rig found and fixed, vehicles can be left by the road and used as storage, a flatbed trailer found and hitched, the docks found, containers loaded one at a time and placed to build the compound. Broken-down cars are all over the world and not all can be used.

- The tow truck is replaced by the big rig plus flatbed trailer. The unloading placement mode already built stays: it is the same flow, with the rig as the carrier.
- Work order: the world first, one piece at a time, Chris says "next" between pieces. Piece 1 is land mass, waterways and ocean.

## 2026-11-04 (evening) World piece 1: land mass, waterways, ocean (built, live at /world/)

Chris asked for the world first, one piece at a time, starting with land mass, waterways and ocean. Built a world generator and a viewer. The main game still uses the old 400 m terrain; nothing in the game uses the new world yet.

Files: src/rules/world.ts (generator and questions: groundHeight, waterLevel, kindAt), src/render/worldView.ts (terrain mesh, water mesh, map painting), src/world/main.ts and world/index.html (viewer), tests/world.test.ts (11 tests).

How to look: localhost:3000/world/. Click to look around, W/A/S/D fly, Q/E down and up, Shift faster, wheel changes speed, M opens the big map (click it to fly there), N makes a new random world, [ and ] step the seed. ?seed=7 picks a world.

Decided by Claude (Chris did not specify), all constants in src/rules/world.ts to tune:
- Size: 12 km square, grid of 640 cells (18.75 m between points). Seed 1 by default. One big landmass with bays, capes and offshore islands, open ocean all round the edge (a test checks the edge is always sea, for 5 seeds).
- Heights: seabed shelves away from the coast to 300 m deep; a beach; plains and hills; mountain ranges inland up to about 650 m (ridged noise in three sizes, then a light blur so there are no needle peaks).
- Water, made by simulation not by painting: every land point is traced downhill to the sea; hollows are filled to their spill point, so each becomes a lake that drains over its lowest edge. Lakes under 60 cells (about 21,000 square metres) or under 3 m deep are left dry.
- Rivers: the points carrying the most water (the top 1.2 percent of land) are carved in, wider and deeper the more water they carry (roughly 30 m to over 100 m wide). River water only ever goes downhill (a test checks it), and every river ends at the sea or a lake.
- Seed 1 numbers: 51 percent land, 49 percent ocean, 22 rivers reaching the sea, 54 lakes, highest 647 m, deepest 300 m. Built in about 380 ms, drawn in about 360 ms. About 100 fps flying over the whole world in headless Chrome (software rendering, a comparison only).

Bugs found and fixed on the way: river surfaces climbing uphill where stamps overlapped (caught by a test); water slivers at river mouths; a colour blending bug that painted all land sand; the map being too dark (colour spaces).

Known limits, not fixed:
- The drawn terrain is one coarse mesh (18.75 m between points). That is right for flying over the world and wrong for walking or driving on it. Detailed ground, chunks that load as you travel, and physics for the ground are a later piece.
- A few coasts are cliffs where a mountain range meets the sea. The big river near the south coast (x -600, z 5060) ends in a fjord-like mouth rather than a beach.
- Steep rivers have drops rather than a gentle gradient, because the water follows the land instead of the land being worn into a river valley.
- The sea is a flat colour with no waves, foam or shore line yet.
- No roads, towns, docks, vehicles or vegetation yet.

### Correction (same evening): the game starts with no containers; test builds do not leak into it

Chris saw a tall stack of containers on pillars in the car game. That was his test build from /base/. Claude had made the game load the same saved base as the test page (same browser storage key), which combined the test page into the game. That was wrong.

Fixed:
- The game now has its own save slot (GAME_BASE_STORAGE_KEY in src/rules/baseSave.ts). The /base/ test page keeps the old key. The game never reads the test page's save, so it always starts with no containers placed.
- The truck starts with NO containers on it (the earlier stand-in load of four is removed), like the story: containers come from the docks, later, loaded onto the big rig. U says "There is nothing on the truck to unload".
- For testing only, ?cargo=ft20,ft40,ft20 in the page address puts those containers on the truck.
- The earlier note "The El Cajon carries four containers every time the page loads" no longer applies.

Checked headless: fresh game has 0 pieces and 0 on the truck, U refuses with that message; with ?cargo=ft20,ft40 U starts unloading. Tests unchanged (only the old cannon-es ramp test fails).

## 2026-11-04 (night) Everything in one game: the world, the desert start, the town, the rusty El Cajon, fly mode

Chris asked for fly mode for testing, for everything to be brought into one game, the player to start in the desert and walk into the town to find the El Cajon, and the El Cajon to look paint-stripped and rusty. Roads, cities, towns, homes and industrial areas come after the world is good (Chris says when). Restoring the paint (grind, paint, buff after finding tools and paint) is recorded in docs/SALVAGE_ROAD_CONCEPT.md and not built.

What is in the game now (localhost:3000):
- The old 400 m terrain is gone from the game (src/rules/terrain.ts stays for the physics lab). The game now runs in the 12 km world from /world/. ?seed=7 gives a different world.
- Fly mode: G turns it on and off. W/A/S/D fly, Q/E down and up (Space also up), Shift 5 times faster, wheel changes speed, T lands you on foot where you are, G goes back to where you were. Nothing collides, hunger stops, the truck is parked, unloading is off.
- Desert: the world now has aridity (how dry the country is, 0 to 1). The town site is chosen first, and the country within a few km of it is made desert (aridity above 0.62). Seed 1: desert is about 37 percent of the land, in the south-west of the island. The desert has warm sand and dust, red rock, dry scrub; rocks, shrubs and cacti instead of trees.
- Town site (src/rules/world.ts): the finder looks for dry, level, inland ground between 12 and 110 m high with no water within 450 m, and scores by how flat it is. The ground is levelled to one height over 170 m round the town and eases back to natural over the next 160 m. The existing generated town (a 3 by 3 block of lots) is placed there at that height. Seed 1: town at x -2100, z 150, 102 m above sea level.
- Start: 450 m from the town, in the desert, along a dry gentle walk, facing the town. The finder prefers a direction where the town can actually be seen from the start. Walking speed is 3.2 m/s and running 6 m/s, so about 2.5 minutes on foot or 75 seconds running.
- Ground you stand and drive on (src/rules/ground.ts): the world's smooth height plus fine bumps up to about half a metre, none on the town's level ground or in the sea. Drawing, walking, driving and props all ask this one function.
- Drawn ground (src/render/terrainTiles.ts): square tiles of 64 x 64 cells that get finer near you (2, 4, 8, 16 m between points), built as needed and kept (up to 320). If a tile is not built yet a coarser one stands in, so there are no holes. Skirts hide cracks. Seed 1 start: about 280 tiles drawn.
- Driving physics (src/lab/rapierSim.ts): the truck gets ground in 64 m collider tiles at 2 m between points, in a ring round it, built as it drives. The lab ramp is left out in the world. Tested: 300 m over hills with nothing falling through; truck test in the game: drove, braked, tiles kept building.
- Walking: you cannot wade into water deeper than 1.1 m. The world edge limit is now 5950 m.
- Props: 1500 by default, within 1.7 km of the town, by biome (rocks, shrubs, cacti in the desert; trees in green country). ?objects=3000 changes the count. New prop kinds: shrub, cactus.
- Rust (src/render/rust.ts): the El Cajon's paint and chrome are a shader that works from position alone: faded chalky blue paint, patches of bare steel, orange rust that gets worse low on the body and in patches; chrome is dull and pitted. createElCajon('restored') keeps the old clean paint for later.
- Container building (unloading) now sits on the town's level ground: the base is measured from that height. Building is allowed only on flat ground, which today means within about 170 m of the town centre, and not through buildings, you or the truck.
- The performance run (B) now drives on the flat ground just east of the town. Its numbers are not comparable with the earlier runs (different scene).
- The /world/ map shows the town (square) and your start (ring), and the desert share of the land.

Measured (headless Chrome here, which renders in software, so only a comparison): game loads in about 4.8 s; 40 to 120 fps depending on the view; fly mode over the whole island about 77 fps. Tests: 143, one failing, the old cannon-es ramp test.

Known limits, not fixed:
- Water: the shore is blocky from the air (the water is drawn in 18.75 m squares) and the sea is a flat colour. A later water piece.
- The world is big and the load is a few seconds: the ground round the start is built in one go.
- Truck can drive into the sea and sink to the bottom; it resets only below 20 m under the surface.
- No roads: the town streets end at the edge of the town. No vehicle wrecks, parts, tools or paint yet.
- Fog and sky are fixed; no time of day or weather.

## 2026-11-04 (late night) Hidden start, stores with food and water, the junkyard El Cajon in parts

Chris asked: wake up in the desert with the town out of sight behind a small hill near you, so you have to move to see it; find water and food in the town's boxes and some store fronts; find the El Cajon in a junkyard in the town, its parts separated, and put it back together. After that: more towns, the docks, highways, roads and dirt roads (not started).

Decided by Claude (Chris did not specify):
- The hill is a low dune raised into the world a short walk in front of the start, across the way to the town (src/rules/world.ts, raiseDune). Its foot is about 20 m ahead, it is just tall enough to hide the town's roofs with 3 m to spare (5 to 16 m; 6 m on seed 1), never steep, and only on dry land. The start still faces the town, so the dune is the first thing you see; climb it or walk round it and the town appears. The start no longer prefers a view of the town; it takes the gentlest dry way in. Tested on 6 seeds: hidden from the start, in view within 250 m of walking.
- Stores you can walk into, not loot-from-the-door: about 45 percent of buildings are stores, a market or a hardware store (every town has at least one market). A store has walls you cannot pass, an open doorway facing the nearest street, big windows, a sign and an awning. Shelves stand along the back and side walls (4 or 5 per store). Market shelves hold water, beans, soda, crackers, jerky; hardware shelves hold tape, rope, batteries, sometimes a wrench. Shelves can only be searched from inside, and look empty once taken.
- New items: jerky (food), soda (drink). Boxes (crates) now lean more towards food and water.
- The junkyard sits beside the town, south of its first street, 36 by 28 m, fenced, with a 7 m gate and a SALVAGE YARD sign. Inside: five dead cars on their rims, a tin shed, tyre piles, and the El Cajon on cinder blocks facing the gate.
- The El Cajon comes apart into 11 pieces: engine, battery, hood, 4 wheels, bench seat, front bumper, rear bumper, tailgate (src/rules/carParts.ts). They lie round the yard. You carry one at a time in your hands (E picks up, E on the truck bolts it on, E with nothing in front of you puts it down). Bolting needs a wrench; the yard's toolbox by the shed always has one. The engine and battery go in before the hood. A wheel goes on the bare hub nearest you. When every part is on, E gets in and it drives.
- The windshield, glass, doors and interior trim stay on the shell (not parts yet). No fuel, no damage, no part condition yet.
- Nothing about the rebuild is saved: reloading the page starts the yard over. (Inventory and loot are not saved either; saving is its own piece.)
- ?fixed=1 in the page address starts with the El Cajon whole, for testing driving.

Checked in headless Chrome by script: start on seed 1 and 7 (town hidden), dune top (town in view), a store front and inside, searching a shelf (it empties), walking in through a store door with the keys, the back wall stopping you, the whole rebuild (the missing list, the wrench refusal, the toolbox, the hood refused before the battery, putting a part down, all 11 on), and driving the finished truck out through the gate onto the street. Tests: 151, one failing, the old cannon-es ramp test.

Known limits, not fixed:
- Parts are not solid: you walk over them. Part models are the truck's own pieces lying on the ground.
- The inside of a store is lit like outside (no indoor lighting).
- A part dropped inside a wall or a store stays there.
- The performance run (B) drives the truck even when it is in pieces.
- Added for testing (Chris asked for a quick jump to the town): J puts you on foot on the street in front of the junkyard gate, facing the yard. It turns fly mode and unloading off, and works from driving too. Key J chosen by Claude (unused). The hint line now lists J and G (fly).

## Vehicle storage: the El Cajon bed (Chris asked: "add the storage to the vehicle")

Chris said storage should be added to the vehicle. His concept says a parked vehicle can be used as storage but leaves how open. Claude decided:
- The El Cajon has a bed store of 24 slots (your pack is 12). It uses the same stack rules as the pack. Code: src/rules/vehicleStorage.ts, tests in tests/vehicleStorage.test.ts. Each vehicle can get its own store later.
- It opens only once the truck is fully assembled. Stand at the back half of the truck and look at it: the prompt reads "Open the bed" (E). At the front half it still reads "Get in the El Cajon".
- A panel shows the bed on the left and your pack on the right. Click a stack to move the whole stack to the other side. E or Esc closes it, and it closes by itself if you walk away or get in. The mouse is released while it is open (click the page to look around again).
- The bed is empty at the start. It holds items only while the game is running (nothing is saved on reload yet). Items in the bed are not drawn in the bed.
- Not decided: weight limits, whether the cab also stores things, whether a parked vehicle keeps its store when left far away (there is only one vehicle now).
- Containers (shipping containers) are a separate system and are not part of this.

## Truck doors, hood, passenger seat, Tab in the car (Chris asked for these)

Chris asked: get in only at the driver door; the hood opens at the hood; the bed opens the truck storage; the passenger door gets you in the passenger seat where you cannot drive, with a prompt to switch to driver; Tab in the car shows your pack and the truck's storage. Built (code: src/rules/vehicleZones.ts, tests/vehicleZones.test.ts). Once the truck is fully built, where you stand decides what E does:
- Hood (front, from the windshield to the nose, any side): open or close the hood. It swings up on a hinge at the windshield. The hood skin is now double sided so it shows from underneath. The hood only does this: nothing is under it to use yet.
- Driver's door (left side, under the cab): get in and drive.
- Passenger door (right side, under the cab): get in the passenger seat. The truck does not respond to the keys. A prompt reads "C: Switch to the driver's seat". Getting out from there steps you out on the right side.
- Bed (behind the doors, any side): open the truck storage.
- While building (parts missing) it still just says what is missing, and carrying a part still bolts it on, anywhere on the truck.
Claude decided (not specified by Chris):
- C is the seat-switch key. It also works the other way, driver to passenger, but only when almost stopped.
- Tab (or I) while in either seat opens the same panel as the bed: your pack beside the truck storage. There is one store for the whole truck, not a separate cab store. Tab, E or Esc closes it. It does not close by itself while you are inside.
- Getting in shuts the hood. The truck can not be unloaded from the passenger seat.
- Zone limits are shares of the truck's length: hood is the front 60 percent toward the nose, bed is behind 15 percent short of the middle, doors between. They are constants at the top of vehicleZones.ts if the El Cajon's proportions need tuning.

## Doors and tailgate that open, and the bed shows what is in it (Chris asked for these)

Chris asked: open the doors and the tailgate; when tires, motors and the like go in the bed storage they should show in the bed; a bunch of things should become a crate of supplies.
- Doors: each door is now its own piece (skin, handle, lock, glass, door card) hinged at its front edge, so it swings out. The side of the truck was cut into body behind, body ahead, the sill and the door. Door skins show from both sides. Claude decided: a door opens by itself when you use it (getting in or out) and shuts again after 1.6 seconds. It is not a hold-open toggle. The hood is still a toggle. Doors have no collision.
- Tailgate: it drops flat on its bottom hinge while you work at the bed (E behind the truck). It closes when you close the panel. Opening the storage with Tab from a seat leaves it up.
- Bed contents (src/rules/bedLoad.ts, src/render/bedLoad.ts, tests/bedLoad.test.ts): tires show as stacks of up to 3, each motor shows on its own, small goods show as a few loose cans, bottles, tools, etc. With 4 or more different kinds of small things they become one wooden supply crate with goods showing over the top (fuller with more items). The bed has 6 places, rear first. More than that is stored but not drawn. Claude chose the 4-kinds threshold and the 6 places.
- New items for this: tire (stacks of 4) and motor (1 each). For now they turn up in dumpsters (tire weight 2, motor weight 1). Where tires and motors really come from (stripping the junkyard wrecks, the tire piles) is not decided.
- Not done: what is in the bed does not move or fall as the truck drives (it is drawn fixed in the bed), it is not saved on reload, and nothing is drawn in the cab.

## More El Cajon pieces to build, stacked tyres, the big rig tyre (Chris asked for these)

Chris asked: make the doors buildable so the whole car is put together, maybe the dash and steering wheel too; the tyres stacked, not scattered; more pieces to pick up; and a big rig tyre that you can take and store, with something telling the player to keep it.
- New pieces (7, so 15 kinds and 18 things to carry in all): driver's door, passenger door, dashboard, steering wheel, windshield (glass, frame, wipers and mirror), grille, headlights. The truck starts without them: no doors, no dash, no glass in the front, open nose. Code: src/rules/carParts.ts, src/render/elCajon.ts.
- Build order (Claude decided): the dashboard goes in before the steering wheel, the windshield and the doors. The doors also need the bench seat. The grille needs the engine and the headlights need the grille. Everything still needs the wrench. The El Cajon is only usable when all are on.
- Tyres: the four wheels now lie in ONE stack in the yard, taken off the top one at a time. Only the top of a stack can be picked up. The scenery tyre piles are unchanged.
- The big rig tyre (item 'rig_tire', 1 per slot): lies against the back fence of the yard. E takes it straight into your pack, and the toast says "A big rig tire. Far too big for the El Cajon, but something bigger will need it. Keep it". The prompt on it says the same in short ("too big for the El Cajon, but you'll want it later"). Leaving it is possible: nothing forces the player to take it. It can be stored in the bed, where it lies flat and takes a whole row of two places (the other items fit round it). There is no drop or throw-away yet, so once taken it stays in the pack or the bed.
- Not decided: where more of these pieces are found beyond the yard (other junkyards, wrecks in the world), and what the rig tyre is eventually for (the big rig, per the concept).
- The wheel stack, rig tyre and bed look were checked in the running game, and a scripted run bolts on every piece in order.

## Correction: the doors are back on the truck (Chris, after seeing the stripped cab)

Chris saw the cab with no doors (floating trim lines, bare floor) and said to put the driver and passenger doors back on. So the doors are NOT build parts any more: they are always on the shell and still swing open when you get in or out. This replaces the "driver's door" and "passenger door" lines in the entry above. The build now has 13 kinds: the original 8 plus dashboard, steering wheel, windshield, grille, headlights. The dashboard still goes in before the steering wheel and windshield; the grille before the headlights. Tests and the scripted full build pass.

## Doors open while you build (Chris asked)

While the truck is still being put together, stand at a door and press E to open it; it stays open until you press E again to close it. This is what lets you reach the inside for the dash and steering wheel. Prompt reads "Open the driver's door" or "Open the passenger door" (and "Close ..." when open). Claude decided: a door opened this way stays open on purpose, unlike the doors of the finished truck, which swing open by themselves when you get in or out and close again. Getting in always closes a door that was left open. Fitting parts works with a door open or shut, and still works anywhere on the truck.

## Door trim rides on the door (Chris: stray lines were left floating in the open doorway)

With a door open, the chrome belt crease line and the side mirror stayed behind on the body, so lines floated across the doorway. Both now belong to the door and swing with it: the crease over the door's length (the rest of the crease stays on the body) and the mirror with its arm. Checked in the game with the driver's door open on the stripped truck. Still on the body, on purpose: the black door shut lines and the window frame, which a real door gap keeps when the door is open.

## Door top cap rides on the door (Chris: a strip was still floating across the open doorway)

The paint band and black and chrome trim along the top of each door (the bottom edge of the side window, plus the thin return under it) were built in one piece along the whole body, so with a door open the door's stretch stayed behind as a strip across the doorway. They are now cut at the door's front and rear edges (Z -0.58 and 0.73 on the model) and the stretch between goes with the door. The rest stays on the body. Checked in the game with the driver's door open on the stripped truck.

## The strip across the doorway was the body's top shoulder (second fix)

The earlier fix moved the door's top trim onto the door, but the strip Chris still saw was a different piece: the top "shoulder" surface of the body, one long strip from tail to nose, which also ran across the door opening. It is now cut at the door's front and rear edges like the trim, and the stretch over the door goes with the door. Found by colouring the body, the parts and the doors differently and looking from Chris's angle: the strip was body-coloured. Added a test hook, carModel, that returns the truck model so this kind of check is easy. Checked in the game: the doorway is clear with the driver's door open.

## Doors are parts again, and the hood goes on first (Chris asked, once the door bug was fixed)

Chris said to remove the doors so they have to be found in the yard and fitted, and to let the hood be fitted and opened without the engine in, so replacing motors and parts never means taking the hood off.
- Doors: the driver's door and passenger door are loose parts in the yard again (15 kinds now, with the 7 new pieces; 18 things to carry). They need the dashboard and bench seat on first. The cab is bare until they are on.
- Hood: it no longer needs the engine and battery. It can go on at any time and then opens and closes with E at the nose, any time, even with parts missing.
- Claude decided: with the hood on and shut, the engine and battery cannot be fitted ("Open the hood first to get at the engine"). If you are carrying one and stand at the nose, E opens the hood for you (prompt "Open the hood (to fit the engine)"), and the next E fits it. With no hood on, nothing is in the way. This gives the hood a job; easy to drop if Chris would rather the engine go in through a shut hood.
- Doors and hood only respond once they are fitted. A door that is fitted opens with E while building (stays open), as before. At a spot where the part is not on yet, E still says what is missing.
- Rules are in src/rules/carParts.ts (UNDER_HOOD, checkFit with hoodOpen); what E does at each zone is truckAction in main.ts. Tests updated. A scripted run checked: hood on first, engine refused-then-opened-then-fitted, door unavailable until fitted, then openable, and the full build.

## The yard's shipping container, and the first half of the world plan: places and docks (Chris)

Chris asked for one cargo container in the junkyard to come back and collect later (like at the docks and similar places), and to start building highways, roads, dirt roads, trails, docks, cities and towns, two docks minimum, and asked how many shipping containers the map should have. Then he said: do NOT build roads or highways yet, stop at the first half.
- Yard container (done): one 20 ft container stands along the right-hand fence of the junkyard, long side along Z, between the wreck and the shed, on the build grid. Colour is chosen from the seed. It is part of the world, not the player's base: a separate layer, not saved, and not editable. It is solid (you cannot walk or drive through it) and drawn like the base's containers. Nothing can pick it up yet; that needs the truck that can haul it. Test in tests/gameplay.test.ts. Code: src/rules/town.ts (Junkyard.cargo), main.ts (cargoView).
- Places and docks (done, pure rules, no drawing yet): src/rules/places.ts, tests in tests/places.test.ts, a map picture tool in tools/place-map.ts (npx vite-node tools/place-map.ts <seed> <out.png>). Planned from the generated island for any seed: the starting town (named Sunrise), 1 city, 3 more towns, 4 villages, 1 industrial yard, 6 outposts (farms, huts), 5 lookouts (high points, for trails later) and 2 docks. Claude chose these counts and the names (placeholders). Places sit on flat dry land, at least 900 m apart.
- Docks: a coastal spot with deep open water off the quay, flat dry land behind it, no river or lake beside it. Dock 1 is a few km from the start town (about 4 km); dock 2 is at least 6.5 km from dock 1, usually on the other side of the island. Each dock records where the quay is and which way the sea lies. The map for seed 1 puts the docks on the west and east coasts.
- Roads: NOT built. Claude had already written and run a road finder (highways joining the big places, roads and dirt roads for the rest, trails to lookouts, bridges over rivers) before Chris said to wait. It was taken out of the project; a copy is kept outside it (not in git) so it is not lost. Nothing in the game draws, levels or uses places yet: they are a plan only.
- Not decided: how many shipping containers across the map (see the recommendation in the reply), what each place looks like, and what a dock contains.

## The road network: highways, roads, dirt roads, trails and bridges (Chris's go-ahead)

Chris gave the go-ahead for the second half of the world plan: the roads that join the places. Built fresh (not the set-aside prototype) as pure rules, like the places: src/rules/roads.ts, tests in tests/roads.test.ts, drawn in the /world/ viewer (src/render/roadView.ts) and in the plan map tool. Nothing in the game itself levels or uses the network yet.
- Four classes (Claude chose the numbers): highway 14 m wide, climbs at most 6 percent; road 9 m, 8 percent; dirt road 6 m, 12 percent; trail 2.5 m, 22 percent.
- What joins what (Claude decided): a highway spine links the city, the towns, the industrial yard and the docks, as a minimum spanning tree (every big place on the highway for the least road built), plus up to two extra highway links where following the spine would be nearly twice as far as going direct, so the map gets a loop or two like a real one. Each village joins the nearest place by road, each outpost by dirt road, each lookout by trail.
- Routing: every road is found by A* over the world grid. Climbing costs more the steeper a class is allowed to climb, so highways swing round hills while trails go straight over. Crossing water costs a lot, so bridges happen only where crossing is far shorter than going round. Hugging the coast costs a little, so roads keep off the beach. Ocean is impassable.
- Heights: the route is smoothed, then the road's height profile is fitted so it never climbs steeper than its class allows and stays within 12 m of the natural ground, cutting into rises and riding embankments over dips. Bridge decks are pinned flat, at least 2 m above the water, and the approaches ramp to them at exactly the allowed grade, so a road never dives into water and never breaks its grade limit at a bridge join.
- Bridges: every wet stretch of a route becomes a bridge; a dry islet of a point or two inside one rides along at deck height. Seed 1 has 19 roads with bridges.
- Numbers for seed 1: 24 roads, about 105 km in all, and every one of the 23 places is connected. Planning the whole network takes well under a second.
- Checked: 8 new tests (the same seed gives the same network; all places connected; grades within class limits, bridge joins included; roads never in the ocean; bridges only over water, deck above it; earthworks within sanity bounds). Looked at from the air and at road level in the viewer, and on the plan map.
- One for Chris to judge: a road bridges only the water itself, then ramps at its steepest allowed grade. Crossing a deep gorge that way means a deep real-world-style cut (up to about 65 m on seed 1), and trails, which may climb 22 percent, cross ravines on high embankments (up to about 118 m). If that looks wrong, the fix is a "viaduct rim to rim" rule that carries the deck across the whole gorge.
- Not done: the game world does not level ground along the roads yet, the town streets do not connect to the network, and the places themselves are still not drawn in the game.

## Everything on one map: roads levelled into the game, a map screen, and a better HUD (Chris)

Chris asked to put the building, the roads, and the cities and towns on one map — he could not see why they lived on different URLs, and he needs to do everything in one place for testing — and asked for a better HUD, build menu and inventory system.
- One game at / : the main game now plans the places and the road network at startup, the same way the /world/ viewer did. The viewer, the /base/ sandbox and the /lab/ page all stay as they were (nothing renamed or deleted), but testing the world now happens in the game itself.
- Roads you can drive (src/rules/ground.ts): the ground levels itself along every road — it cuts into rises, rides banks over dips, calms the bumps near the road, and blends back to natural ground over about 9 m past the road edge. The road mesh is drawn on the levelled ground (src/render/roadView.ts).
- Bridge decks are a separate layer called the surface: the physics world and the walker stand on it, so a deck carries you over the water while the land under the bridge keeps its natural shape. Known quirk (accepted for now): wading under a bridge reads the deck as the ground, so the deep-water block does not apply there.
- Props (rocks and the like) keep at least 12 m off any road (src/rules/worldProps.ts).
- Place markers (src/render/placeMarkers.ts): a pole with a coloured lamp at every place except the starting town, so there is something to drive to before the towns themselves are built.
- Map (src/ui/mapOverlay.ts): a minimap sits top right; M opens the big map with every place named, the roads, bridges in red, a scale bar and a player arrow. Clicking the big map moves you there (a testing aid). N and [ ] reseed the world from the map screen.
- HUD (src/ui/hud.ts): an always-visible hotbar along the bottom mirrors the inventory, with a coloured edge per kind of item. The inventory panel (Tab) is clickable: click food or drink to use it (src/rules/survival.ts consumeSlot). The build menu is restyled as a panel with cards.
- Checked: 10 new tests (196 in all, 194 pass; the 2 failures are the old cannon-es comparison and the yard vehicles tolerance, both pre-existing). Looked at from the air, at road level, on the longest bridge, and with the inventory open; screenshots in dist/review (game-roads-air, game-map, game-road-level, game-bridge, game-hud).
- Not done: the other towns, the city and the docks are still markers, not buildings; the town streets do not join the network yet; the viaduct rim-to-rim decision above is still open.

## Smoother roads that meet the town, and a steadier coast (Chris)

Chris saw the coast change as he moved the mouse, roads that followed the grid and ran through the town, and stair-stepped sea and river edges.
- Why the coast changed with the view (Claude's diagnosis): the water was a mesh of whole grid squares laid at nearly the same height as the shore, and the depth buffer cannot tell them apart from far away, so water and ground flickered against each other depending on the angle. The sea was also an opaque plane just under the water, which hid the sand in the shallows.
- Water now (src/render/worldView.ts): the mesh only has to cover the water and three squares beyond it. The shader reads the real ground height under each pixel and drops the pixel where the ground is above the water, so the shoreline is the smooth line where ground meets water, whatever the mesh resolution. Depth sets the colour and clarity per pixel. The water is pulled a hair toward the camera so it never flickers against the seabed. River and lake banks are muddy by smooth distance from the water, not by grid square (src/render/terrainTiles.ts).
- The sea beyond the map is now a ring with a hole where the map is (the old plane hid the shallows). Both the game and the /world/ viewer use the same functions.
- Rock colour used the slope at each tile's own detail, so neighbouring tiles of different detail disagreed and showed square blocks of red. Colour slope is now measured at the world's grid spacing for every tile.
- Roads (src/rules/roads.ts): the route is still A* over the grid, but the grid path is then straightened (a straight run replaces grid steps when it costs no more than 15 percent extra, and the sea and extra water are refused), grid wiggle between close waypoints is dropped, and every corner is rounded with a tangent curve (bend radius by class: highway 90 m, road 55, dirt 32, trail 12, less where a run is short or the land forbids). The router also keeps a little off river banks, so bends round a river's end stay wide.
- Roads meet places at gates (Claude chose): the starting town's gates are the ends of its real streets, so a road arrives along a street and meets the boundary street in a T (the north side is left out, where the junkyard is). Every other place gets eight gates on a ring at 0.6 of its radius (a dock only on the land side), for the streets of those places to open onto when they are drawn. Each road runs dead straight for 70 m out of its gate, so it arrives square. The gate is picked from a rough route centre to centre, so a road does not leave one side and double back.
- Checked: roads tests updated and extended (the road ends at a street gate and leaves squarely; almost no tight corner, under 0.4 percent of points, hairpins are kept only where the land forces them: seed 1 has one near the same spot on two roads). Sanity bounds for how far a road may stand above or below the ground were raised (road and highway 80 to 100, trail 160 to 200) because straighter runs cross hollows more directly. Looked at from the air in three views: the coast no longer changes with the camera angle.
- Planning the network now takes about two seconds on seed 1 (it was under one).
- Not done: the other places still have no streets to open onto their gates; the camera near plane is still 0.1 (far water can still shimmer a little at long range, only noticed if it shows again).

## Roads join each other instead of overlapping (Chris, from the reference photos)

- Overlapping parallel roads flickered and folded. Now a road follows one already built (the router finds cells near existing roads 70 percent cheaper), and the new road is cut at the first point where it meets an existing road (within 10 m): a junction, like the reference photos. The stretch that ran alongside is dropped, so one road can become two pieces with the same two places. Highways are built first, so roads and dirt roads join onto them.
- The zigzag in river gorges: the clean-up that drops grid wiggle was blocked by a strict water rule, relaxed a little. Straight runs are now checked every 4.7 m, and any point left in the sea is moved to the nearest dry ground before heights are fitted.
- Tests: ends may now finish on another road; the road-to-ground sanity bound for road and dirt went to 110. Not done: highway-to-road ramps and lane markings, and the river banks still show some blocky colour at long range.

## One road style, ordinary intersections (Chris)

- Every road is now 10 m wide and one grey, whatever its class. Grade limits and routing costs still differ by class, because a single 8 percent limit left lookout trails running level while the mountain rose 200 m beside them (tall earth walls); that was tried and undone.
- A road that meets another now ends on the other road's centreline (a T), within 16 m, with its height eased over the last 30 points. Two roads at different heights are an overpass, not a junction. The grade test skips the first and last 32 points of a road, where a junction landing eases in.
- Still seen: two separate roads can run side by side more than 16 m apart on a hairpin, and no lane markings or turn lanes.
