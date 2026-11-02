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
