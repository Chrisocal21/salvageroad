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
- Keyboard layout, and whether gamepad matters
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
