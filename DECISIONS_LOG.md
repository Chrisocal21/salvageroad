# Decisions Log

Anything decided that Chris did not specify, library comparison results, and open questions. Newest at the bottom.

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
