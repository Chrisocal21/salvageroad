# Decisions Log

## Additional supplied GLB restoration vehicles

The supplied prototype pack adds vehicles rather than replacing the El Cajon, tractor or existing box truck.

- Add the unfinished pickup to the first remote salvage yard and the delivery step van to the second. Keep the starter yard exclusive to the El Cajon and the separate flatbed in its later yard. J still cycles through the yards.
- Give each imported vehicle its own wrench-and-parts restoration project, four tires, drivetrain, brakes, seats, glass and body repairs. The pickup needs a replacement bed; the van needs a cargo floor, roof and rear doors. Distribute sufficient actual parts for all four remote projects, with workshop leads and barter values.
- Unlock driving and independent item storage only after restoration: pickup 28 slots, step van 64 slots. Preserve the existing box truck's 96 slots. Only the tractor can tow the flatbed.
- Convert the source -X-forward/Z-up geometry to the game's +Z-forward/Y-up convention. Rebuild wheel pivots from the supplied meshes; use separate suspension/steering animation and collision/tuning values. Add simple missing repair assemblies rather than treating an incomplete blockout as a finished vehicle.
- Keep the pack's original README with the GLBs under public/models/salvage-vehicles. These are original procedural low-poly prototype models, not shipping-quality art. Vehicle repairs and cargo remain session-only, matching the existing vehicle system.

Validated actual GLB geometry, wheel axes/pivots, repaired bounds, driving, service braking, steering, cargo doors, independent state, multi-seed yard/access clearance and guaranteed repair loot.

## Supplied title artwork and Play-gated startup

Chris supplied the Salvage Road logo and two workshop scenes after requesting the title-screen asset brief.

- Use the pickup workshop scene for the landing screen and the box-truck workshop scene for loading. Keep the supplied attachments unchanged; prepare optimized JPEG background copies and a transparently cropped logo under public/branding.
- Present the logo, tagline, Play, a lightweight expandable controls guide and an honest development/save-status footer. Do not invent Settings, Continue or browser Quit actions that are not implemented.
- Import the game only after Play. The title screen does not generate terrain, initialize physics or request the main game module. Disable duplicate Play activation and show the loading artwork before starting the expensive import.
- Preserve the existing first-render loading completion and explicit startup-error/reload behavior. Hidden loading markup must not report itself as actively loading while the title screen is visible.

## Salvage field-system art direction

Chris rejected the generic utility-panel appearance and supplied screenshots of the loading, pause, inventory and workshop screens.

- Replace the small centered loading badge with an oversized condensed wordmark, original road-survey/contour SVG, warm recovery-orange accents, field-note footer and asymmetric composition. Retain the translucent world cover and actual first-frame readiness.
- Give pause a distinct left-hand identity/resume composition and a right-hand field manual. Select one control category at a time instead of presenting a scrolling wall of every binding. Do not invent nonfunctional settings or menu actions.
- Rebuild the field pack around numbered quick-access/reserve positions, clearly visible empty slots and a real item inspector (category, stack size and usage guidance). Pointer hover and keyboard focus inspect equipment. Explicit Use/Assign actions preserve existing food and hotbar behavior.
- Turn workshop recipes into technical blueprint cards with enlarged line illustrations, drafting grids and visible readiness/missing-tool/material states. Keep costs, bench gates and actual hauled containers unchanged.
- Share sharp-edged surfaces, condensed editorial headings, restrained rules and warm accents across storage, barter and restoration. Keep the compact world HUD rather than enlarging it.

Validated desktop loading/pause/pack/workshop screenshots and 390 px layouts, including visible control bounds and scrolling. Preview inventories were isolated from the player's inventory and saved world.

## First-frame startup loading cover

Chris requested a loading screen instead of black startup, with the map behind a transparent black cover until it is ready.

- Keep the initial cover and its styles in the HTML so they appear before the game bundle downloads or world generation blocks the main thread. A lightweight bootstrap allows that cover to paint before importing the game.
- Use a translucent black backdrop, Salvage Road identity, truthful initialization-stage text and an indeterminate activity line rather than a fabricated percentage or timer.
- Remove the cover after the first rendered world frame, with terrain and physics initialized. Permit that initial render even if the browser has paused the game before startup completes; do not advance simulation during it.
- Hide background HUD and block keyboard input while loading. Surface startup errors with a reload action instead of silently revealing a broken scene. Respect reduced-motion settings.

## Equipped-hammer removal confirmation

The hammer hotbar key now equips it without opening the workshop; K remains the build-menu key. On foot, aim within 3 m and right-click a wood piece to open a confirmation, even without an active placement recipe. Cancel/Escape does nothing; only Confirm removal mutates the layout. Toolbox benches return to inventory; ordinary wood pieces explicitly warn that materials are not refunded. Existing support checks and full-pack protection remain authoritative when confirming. World input and movement stop while the confirmation is open.

## Compact salvage-survival HUD and menu system

Chris found the placement overlay far too large and requested a cohesive, polished HUD/UI suited to the game.

- Use shared graphite/olive surfaces, ivory text, amber accents, restrained borders and original SVG item icons. Keep the world readable rather than filling it with permanent instructions.
- Replace the large placement panel with a compact lower-right card: selected piece, cost, placement verdict, level where relevant and concise input hints. Keep exactly ten icon hotbar slots; item labels appear on selection, hover or keyboard focus.
- Group the field workshop into Construction, Benches, Crafting and Containers tabs. Put longer instructions in a keyboard-accessible field guide. Preserve actual resource costs, bench requirements and physical container cargo.
- Give inventory/cargo explicit close controls and consistent modal framing; suppress background HUD clutter and block world actions while either is open. Storage closing still runs the game's cargo/door cleanup. Bring barter, pause and vehicle restoration into the same visual language, including restoration progress and scrolling parts.
- Move the minimap above the placement/speed area. Add region-map identity, coordinates, an explicit close action and keyboard activation while preserving travel-on-click.

Browser measurements: placement is 286 x 129 px at 1366 x 768 and 235 x 125 px at 390 x 844, with no horizontal overflow or overlap with the hotbar/needs. Checked inventory and categorized workshop screenshots and narrow-screen scrolling without changing player inventory or saved buildings. Regression coverage includes accessible tab switching, visible-only focus traversal, field-guide access, original recipe gates, hotbar assignment and construction/vehicle behavior.

## Ten-key hotbar and direct placeable selection

Chris clarified that the bottom bar must have only keyboard 1-0 slots, with the remaining carried items in inventory, and that pressing a bench/placeable's number should equip it for placement.

- Kept existing inventory capacity and made its first ten slots the numbered hotbar; reserve slots remain inventory-only. Inventory Assign buttons plus a number/hotbar click swap whole stacks, preserving occupied destinations and existing click-to-consume behavior.
- Number keys now equip/use hotbar items. Portable toolbox benches directly start the existing placement path, with no hammer requirement. A planer selects the planer-bench recipe, preserving its material/tool costs. Hammer selection opens the build menu. Empty selections unequip, selected slots highlight, and consumed placeables stop previewing.
- Reserved number keys for the hotbar rather than competing container-cargo shortcuts. K still selects actual hauled cargo; mouse placement, rotations and nearby stopped-trailer requirements remain unchanged.

Validation includes keyboard 0 mapping to slot ten, exactly ten HUD slots, reserve-slot hiding, lossless assignment, consumption isolation, selected-state rendering and existing building/gameplay tests.

## Unified wood building, logging and starter benches

Chris requested a build menu beside container hauling, initially wood-only doors, windows, decks, railings, garage doors, floors, walls and stairs, with scrap-metal upgrades later. He confirmed grid/container snapping, actual cut openings, and a crafted build hammer. He then requested axe/log/plank progression, a placed planer bench, and a basic portable toolbox bench placed from inventory or the car.

- K unifies wood pieces, crafting and the actual flatbed container manifest. Container placement still requires the stopped hooked flatbed nearby; containers are not conjured by the menu.
- Town containers and ground log piles supply logs; axes and planers can be looted or crafted. The starter toolbox guarantees tools and a portable toolbox bench to avoid progression deadlocks.
- Portable toolbox benches consume one kit, need no hammer, can be deployed on flat ground at their own elevation anywhere, and pack back up atomically. Nearby car/box-truck item storage can supply building materials. Further bench types were not specified and remain unimplemented.
- Tool recipes require the deployed toolbox nearby. A hammer costs one log by hand. A planer bench costs six logs plus a planer; one log processes into four planks only beside that bench. Building uses planks, not raw logs. Axe trees with three E interactions for four logs; full packs prevent the final chop rather than losing logs.
- Door/window installations replace the corresponding container wall section with wooden frames/leaves, not an intact steel wall behind decoration. Rendering and collisions share the same shell rectangles. E opens/closes doors/shutters; garage openings admit the El Cajon. Wood stairs/floors and container roofs support walking.
- Save built pieces, portable bench elevation, host-container references and door states. Remap host IDs on loading. Keep the existing session-only inventory/world-loot/vehicle policy explicit; trees respawn on reload. Dismantling ordinary wood parts gives no refund. No metal upgrades or new imported art.

Validation covers placement costs, support/removal, opened versus closed door/garage collisions, physical driving through garage doors, actual walking-circle stair climbing, crafting overflow, harvested tree collider removal, loot guarantees, portable bench retrieval and save/load. Browser checks cover the unified menu and a separate rendered container/deck/stair/door/window preview.

## Box-truck reference redesign

Chris supplied 18 delivery-truck examples, including conventional and cab-over trucks, because the first storage truck did not look like a box truck.

- Chose a generic short-hood, two-axle delivery truck with rear dual tires. The 5.4 m cargo body occupies over 60% of the vehicle length and rises above the cab.
- Added plain white panels, aluminum edge rails and rivets, mirrors, curved fenders, reflective strips, mudflaps, rear hinges/latches, wood flooring, interior tie rails and roof bows. No logos, watermarks or imported assets.
- Retained a battered cargo shell so the unrestored vehicle is recognizable; replacing each section hides its matching damaged piece independently.
- Matched suspension and restoration to two axles: four suspension wheels, six tires, four brake assemblies, 37 installed pieces across 23 component types. Kept independent 96-slot storage and the tractor-only trailer restriction. Vehicle progress and cargo remain session-only.

Validation includes production build/typecheck, restoration/storage/hauling regression tests, collider/proportion checks, and separate browser previews of the damaged front/side and restored rear. Previewing did not change the player's truck or inventory.

## Sunrise trader: tools/parts and brick workshop

Chris specified that the starting trader sells tools and vehicle parts and asked to move him into the existing brick building shown in four screenshots.

- Moved the counter/person into the yard's brick workshop. Replaced its solid blocking box with shared rendered/collision walls and an open west-facing doorway. Barter prompts require the player to be inside, so the trader cannot be used through the outside walls.
- Decisions: enlarge this workshop to 6 by 5.2 m to fit the counter, trader and a customer route; use an enclosed flat roof and a permanently open entry for this step. Keep the existing exterior brick material, add no imported assets, and leave remote sheds unchanged.
- Moved the starter toolbox beside, rather than across, the entrance. Reserved the approach against loose repair parts. Its guaranteed wrench remains free and lootable outside; outside loot is not reachable through the shop walls.
- The new tools/parts stock profile guarantees existing item types only: wrenches, El Cajon tires, a motor and a big-rig tire. No new tool/part types were invented. Other trader profiles remain unchanged, and barter can still accept any valued goods from the player.
- Added a barter sign above the doorway and a tools/vehicle-parts HUD heading. Corrected the counter renderer being repeated once per tire pile; it now renders once.

Validation: 76 focused tests and production build/typecheck pass. Tests cover seeded stock, walking in to the counter and back out across three seeds, collisions, barter and original repair progression. In the browser, walked through the doorway and opened the tools/parts stock with E. No commit.

## Starting-yard trader: step A

Chris requested one step at a time: start with a trader and barter screen at Sunrise, then stop. The supplied takeover notes describe an older marker-only world; preserve the already-built settlements, roads and remote yards rather than rebuilding or removing them.

Implemented:
- A procedural counter/person inside Sunrise's salvage yard, left of the gate. The counter and person are solid; loose repair parts reserve their space and the gate remains clear.
- E opens the existing seeded trader's goods and the player's pack. Quantity controls build an offer/request; the screen shows barter values, the verdict, remaining haggles, Haggle and Trade. No currency.
- Movement and game hotkeys are blocked while trading; pointer lock is released, keyboard focus stays in the panel, and Close/E/Esc exit. The barter panel is above the minimap so its controls remain clickable.
- Successful swaps refresh stock and the hotbar. Full-pack failures preserve exact inventory slots and stock. Duplicate offer rows are checked as totals; invalid quantities are refused.

Decisions not specified by Chris:
- Reuse `makeTrader(seed, 0)` and its current general stock/name. Do not invent specialties or extra vehicle parts before asking about them.
- Follow the existing haggle result: the final successful push may still lead to a trade; pushing again after patience runs out causes refusal. Refusal, margins and stock persist across closing/reopening during the current run, but are not saved on reload.
- Use only newly drawn primitive geometry, flat materials and a procedural sign for this trader. Do not import more assets from Chris's folders while licenses are unresolved; existing scenery assets were not changed.
- Keep the requested remaining town traders/yard vehicles, vehicle ownership/drivability, saving, lane markings and container loading out of step A. No commit.

Validation: 71 focused barter/HUD/gameplay/repair tests and production build/typecheck pass. Live browser checks opened the yard trader with E, completed a goods-for-tire swap after haggling, confirmed movement stays blocked, and closed using the clickable button. Temporary test goods and trader changes were restored; the player pack remains empty. Existing large-bundle warning remains.

## Flooded neighborhood screenshot and missing salvage yards

Chris spotted a shopping center/local streets in river or lake water and asked where the other salvage yards were.

- Root cause: neighborhood safety checked bed elevation/roughness, not water occupancy. An elevated inland lake or river bed could pass those height checks. Flat foundations did not remove the independently rendered water.
- Added a shared dry-footprint test covering all intersecting hydrology cells, not just a center point. Neighborhoods now reject wet full footprints and wet access corridors, with a three-cell setback for the water renderer's shoreline apron. Land-side destinations use the same test. Quays remain intentional water decks; existing main-road bridges are unchanged.
- Added street-midpoint growth candidates so cities can keep growing on dry land rather than accepting flooded blocks or shrinking population/developed-area requirements.
- Only Sunrise previously had a real salvage yard; the other facilities were freight depots, logistics, lookouts and docks. Three of the six outposts now become distinct salvage destinations, leaving the other depot types intact.
- Remote yards reuse the salvage scenery: five wrecks, fenced compound and open gate, workshop, tire piles, an additional roadside warehouse and ordinary loot containers. Rotated rendering and collision bounds share the same transform; their gates face the connected access lane. They do not spawn another starter car, starter repair parts, guaranteed starter wrench, or haulable cargo.
- Default-seed map names: Hermit Farm Salvage Yard, Ranger Hut Salvage Yard and Orchard Barn Salvage Yard. Main-game map labels and physical markers now use actual destination positions instead of the old planning anchor. Press M to locate/travel to them while testing.

Validation: 25 focused tests and production build/typecheck pass. Tests cover a wet footprint corner with a dry center, dry neighborhood/access placement across five seeds, preserved settlement scale, three remote yards across three seeds, unique loot, clear gates and existing road/terrain/loot regressions. Browser inspection confirms a rendered remote yard, its connected entrance and matching map position. Full truck travel to every yard and wreck-scrapping interactions remain unverified/not implemented respectively. Existing large-bundle warning remains.

## Housing and shopping references: intake and first layout pass

Chris supplied 18 further references: "heres examplers of housing and shopping centers this is how the map should flow and see within the areas of population".

- Images 1-5: substantial residential neighborhoods; connected collectors/local streets, curved routes and occasional loops; consistent street-facing homes, setbacks, driveways, sidewalks, back gardens and mature trees. These are grouped residential areas, not isolated houses beside a highway.
- Image 6: the current game's uniform small-box/grid layout is the comparison to improve, not the finished target.
- Images 7-12: shopping centers with adjoining shop bays, shared storefront promenades/awnings, parking rows, drive aisles, collector-road entrances, anchors and landscape islands.
- Images 13-18: denser urban commercial streets, ground-floor businesses beneath apartments/offices, varied skyline, pedestrian crossings, plazas and planted streets. The nighttime reference establishes visual character; it does not by itself request a day/night system.
- Use the planning principles, not real brands, watermarks or copied building designs. Previously supplied local scenery assets remain the texture source.

Implemented on the main world:
- Separate residential, shopping and apartment district layouts. Non-starting settlements get a shopping center first; larger cities alternate additional centers, apartment blocks and housing. Sunrise's starting junkyard layout is preserved.
- Residential blocks have two outward-facing rows of three homes. Removed the unnecessary central cross streets; the space behind houses is a garden strip instead of asphalt. Added front lawns, footpaths, short driveways and eight small trees per residential block, with trunk collision.
- Shopping centers have four close adjoining, individually enterable/lootable units, one frontage promenade and a shared marked parking court with an unobstructed drive aisle. Internal cross streets no longer cut through the shops/parking. Every store retains its own interior lookup and globally unique loot IDs.
- Added sidewalks to local districts, not only the large urban core. Terrain-fitting foundations, local-first growth, arterial entrance caps and shared road/ground rules remain in effect. Corrected repeated insertion of the same growth candidates while assembling a block's outgoing streets.

Validation: 24 focused neighborhood, settlement, destination, earthworks/driving-smoke and batching tests pass, as does production build/typecheck. Five-seed checks retain street connectivity, road clearance, actual developed-area/population requirements, level floors and shop entry/loot. Browser aerial checks show the shared shopping court and garden-backed housing rows. Existing large-bundle warning remains.

Still pending from the references: longer/curved residential tracts, parcel fences, larger anchor malls and landscaped parking islands, continuous downtown street walls/plazas and further architectural variety. This is a first layout pass, not photographic scenery parity. Home/upstairs interiors, general build mode and continuous whole-network vehicle driving are not completed by this change.

Anything decided that Chris did not specify, library comparison results, and open questions. Newest at the bottom.

## Current state at a glance (updated 2026-11-04, after Chris's ten-screenshot world review)

This is a summary so you do not have to read the whole history. The dated entries below stay as they were written; where a later entry changed an earlier one, the later one wins.

What the game is now (localhost:3000; /base/ is the container builder sandbox, /world/ the world viewer, /lab/ the physics comparison):
- A 12 km island from a seed (seed 1 by default, ?seed=7 for another): land, rivers, lakes, ocean, a desert round the start. src/rules/world.ts, with detailed walkable ground in src/rules/ground.ts and drawn tiles in src/render/terrainTiles.ts.
- The player wakes in the desert, 450 m from the town, with a low dune hiding it. The town (a 3 by 3 block of lots, some walk-in stores with shelves) sits on levelled ground beside a fenced junkyard.
- The junkyard holds the El Cajon on blocks as a rusty shell, 18 loose pieces (15 kinds: engine, battery, hood, 4 wheels in one stack, seat, two bumpers, tailgate, dashboard, steering wheel, windshield, two doors, grille, headlights), a toolbox with the wrench, a big rig tyre, and one 20 ft shipping container. Order and rules are in src/rules/carParts.ts.
- The truck: driver's door to drive, passenger door to ride, hood opens, bed storage (24 slots) shows what is in it. src/rules/vehicleZones.ts, vehicleStorage.ts, bedLoad.ts.
- Keys: W/A/S/D move or drive, Shift run, E use, F eat, Q drink, Tab or I inventory (in the truck: pack plus vehicle storage), C switch seat, U unload containers, R reset (or rotate while placing), J jump to the town, G fly mode (T lands), B performance run, M map (click it to travel there, for testing), N and [ ] reseed the world, H is gone. URL options: ?fixed=1 starts with the truck whole, ?cargo=ft20,ft40 puts containers on the truck, ?objects=N sets the prop count.
- The plan of places (src/rules/places.ts): starting town, 1 city, 3 more towns, 4 villages, 1 industrial yard, 6 outposts, 5 lookouts and 2 docks. In the game each place is a pole with a coloured lamp for now; the buildings are still to come. tools/place-map.ts draws the plan as a picture.
- The road network (src/rules/roads.ts): one continuous main road visits the city, every town and village, the industrial yard and both docks. Outposts and lookouts have single-join access roads. No extra highway loops or overlapping duplicate corridors. The game levels the ground along the roads and the decks carry the walker and the truck (src/rules/ground.ts). Also drawn in the /world/ viewer.
- A minimap sits top right; M opens the big map with every place named, the roads, bridges in red, a scale bar and a player arrow (src/ui/mapOverlay.ts). The HUD has an always-visible hotbar and a click-to-use inventory (src/ui/hud.ts).
- Tests: 207, two failing (the old cannon-es ramp comparison, which the game does not use, and a work-in-progress yard vehicles tolerance test).

Current priority from Chris's latest review: the connected road is not visually finished. Deep mountain trenches, abrupt embankments, awkward town approaches and unexplained road endings still need work. Other settlements are markers, not built cities or towns. The main game's U action only unloads existing truck cargo; it is not the requested accessible build mode. The detailed intake and acceptance checklist are at the end of this log. These requests are recorded, not implemented by this documentation pass.

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

## 2026-11-04 One continuous road connects the towns (Chris)

Chris said there should only be one road connecting all the towns, and showed the split, braided corridors and floating pavement.
- The main road is now one continuous polyline, visiting the city, towns, villages, industrial yard and docks once each. An open itinerary replaces the branching highway tree and its extra loops. It keeps the existing 10 m grey style and uses the paved road's 8 percent grade limit.
- Later main-road sections avoid the corridor already built instead of receiving a discount for following it. Arrival and departure use opposing gates where possible, so the route goes through a settlement rather than doubling back out of the same entrance.
- Outposts and lookouts keep their access roads. Each ends at its first junction on the existing network; no second tail or parallel shared stretch is drawn. Junction heights are pinned while the whole approach profile is fitted, keeping the grade limit and flat bridge decks. An infeasible landing tries another nearby junction; an unrouteable connection reports an error instead of returning an incomplete network.
- Sunrise uses its existing street grid, with the road height pinned to the town's fixed street level. It does not excavate the town or cut across building lots.
- Ground support uses exact projections onto road segments, not nearest height samples, removing the steps between samples. The pavement samples the ground at both edges instead of floating above it at an independent planned height. Bridge support covers the full deck width between points.
- Seed 1: one main road of about 38 km visits all 12 main places; 11 access roads connect the remaining outposts and lookouts. All 23 places remain reachable.
- Checked: nine new regression tests, with main-road topology, no nearby duplicate stretches, physical access-road junctions, town street alignment, junction grades and flat bridge decks checked across seeds 1, 2, 3, 7 and 42. The 68 focused tests pass; the full suite is 205 passing out of 207 with the same two pre-existing failures. Typecheck and production build pass. Inspected the map, the town approach and the ground-level pavement in the game.

## 2026-11-04 Screenshot intake: real roads, visible settlements and build mode in the game (Chris, about 15:00)

Chris asked: "make these sections better and make more sense make them look like real roads. i dont see any other city or town either." He also asked to add build mode into the game, and to take in all ten pictures and write the notes in the Markdown files.

This is a requirements and visual-defect intake, not a completion report. The earlier successful connectivity and grade tests do not establish that the roads look believable or that settlements and build mode exist.

### What the ten pictures show

Numbers follow the order of the ten pictures attached to this request. Coordinates below are approximate HUD camera positions, not surveyed road elevations. Descriptions are retained here so the notes do not depend on temporary attachment paths.

| Picture | Observation | Work to carry forward |
|---|---|---|
| 1 | At about X -2156, Z 30, the asphalt sits inside a conspicuous straight-sided desert cutting. There are no visible shoulders, edge markings or drainage transitions. | Make the road cross-section believable: proportionate earthworks, shoulders and gradual transitions to surrounding terrain. Check from driving height, not only from above. |
| 2 | Above Sunrise, the main road makes a broad, roughly triangular loop around the small block of buildings, with a tight corner and abrupt joins against the lighter town streets. | Rework the town approach and departure as actual streets and junctions. Preserve building access and the junkyard; do not force a loop simply to satisfy an opposing-gate rule. |
| 3 | At about X -87, Z 942, a long mountain road or access road appears to stop as a bare asphalt end on the slope. | Identify the intended destination. If it is a lookout, provide a recognizable destination and deliberate termination; otherwise investigate missing or terrain-hidden road geometry. A map dot is not an adequate destination. |
| 4 | At about X 493, Z 786, the road is at the bottom of a very deep, narrow cut with almost vertical mountain walls. | Treat these giant trenches as a routing/height-profile defect, not as finished earthworks. Prefer a route that follows the land, with believable cuts and fills. |
| 5 | The overhead mountain view shows a long, ruler-straight slice through a ridge, ending in an abrupt change of ground shape. | Revisit the horizontal alignment as well as the vertical profile. Smoothing a ribbon alone cannot make this excavation plausible. |
| 6 | The hillside road has a tall, sharply edged fill on its downhill side and a severe cut on the uphill side. The road reads as a strip pasted into a mountain. | Give the road a supported, believable cross-section; use graded slopes or deliberately modeled structures rather than unexplained terrain walls. |
| 7 | The closer view of the same kind of hillside section exposes the narrow ledge, abrupt crest and lack of readable road edges or roadside protection. | Inspect crest/sag transitions, sight lines and the supported edges at ground level. Roadside treatment must suit an exposed mountain section. |
| 8 | From above the ridge, the road appears to disappear behind or into terrain while very tall cuts continue through the mountain. | Check both route geometry and terrain-detail transitions. Determine whether the surface is occluded or genuinely interrupted; verify physical continuity as well as what is visible. |
| 9 | The wide valley view shows several bare road ends or spurs around hills and lakes, without visible settlements explaining them. | Trace each end to a real destination, distinguish intentional access roads from defects, and make junctions and destination entrances readable in the world. |
| 10 | At about X -1234, Z 924, the broad island view still looks largely empty: roads and apparent ends are visible, but no other recognizable city or town. | Build actual settlements on the existing place plan. A named marker on the map or a lamp pole does not count as a city or town. |

Visual uncertainty to preserve: a road that looks cut off in a still image may be a legitimate lookout spur, terrain occlusion, or a rendering/detail problem. Do not claim a specific cause without checking that location in the running game.

### Requested outcomes

Roads:
- Keep the requested single continuous main road connecting the towns. Do not reintroduce duplicate parallel corridors or an arbitrary extra highway network.
- Make routing and earthworks believable together: roads should work with slopes and valleys rather than carving tall narrow canyons through every obstacle.
- Rework the Sunrise loop, tight turns, street joins and approach directions as a coherent settlement road layout.
- Give intentional road ends recognizable destinations, and fix any actual breaks or hidden sections.
- Add the road presentation needed to read as real roads: shoulders, appropriate markings, edge transitions and proper junction shapes. Specific dimensions and art treatment are not yet agreed.
- Proposed engineering options, not decisions already approved: contour-following reroutes, properly spaced switchbacks, graded cut/fill slopes, retaining structures and bridges/viaducts where justified. Tunnels are not implicitly approved. The earlier question about rim-to-rim viaducts remains open.
- Do not "fix" the visual failures by only raising the tests' allowed road-to-ground height differences.

Visible places:
- The city, other towns and villages must become actual places with visible buildings, local streets and usable entrances connected to the main road.
- Their size and arrangement should communicate city versus town versus village, rather than duplicating Sunrise identically everywhere.
- The docks and industrial yard also need recognizable physical layouts; outposts and lookouts need an identifiable reason for their access roads.
- Reuse the existing seeded place plan and shared world. Markers may remain useful debugging aids but are not the finished implementation.
- Roads, terrain levelling, buildings, collision and map labels must agree about the same locations. Keep the existing Sunrise gameplay intact.

Build mode:
- Provide a discoverable build-mode entry and usable build interface in the main game at /, on the same map used for walking, driving and testing.
- Current verified distinction: /base/ has the builder catalogue and controls; / has cargo unloading on U, with a placement ghost, snapping, levels, support checks, collision updates and base saving. U requires existing truck cargo, normally supplied through the testing URL today. This is not a general in-game build mode.
- Reuse the existing building rules and renderer rather than creating a disconnected second system or requiring a visit to /base/.
- Expose supported-piece selection, placement preview, rotation, snapping, stacking/height, removal, clear invalid-placement feedback and an obvious exit. Preserve support rules, collision and the game's own base save.
- Testing access should not depend on manually supplying a cargo query string. A testing catalogue and normal survival/container-hauling rules must remain distinguishable.
- Do not silently reverse the earlier design that shipping containers are found and hauled, rather than freely crafted from a menu. The exact survival build catalogue, resource costs and unlocks remain unspecified.
- Pick controls deliberately: B already starts the performance run; U unloads cargo; R, the map and inventory already have contextual actions. Do not assign a conflicting shortcut without updating the full control flow and help.
- This request does not mean floors, walls, stairs and other still-unbuilt pieces are already available.

### Working order and acceptance checks

Proposed execution order: correct the route/earthwork failures and Sunrise transition; build visible connected settlements; integrate the in-game build-mode entry and catalogue. These are three unfinished deliverables, not another completed "one map" claim.

- [ ] Revisit the ten reference views, especially the desert cutting, Sunrise loop and mountain trench/ledge sections. Compare before and after at walking/driving height and from the air.
- [ ] Verify grades, bends and cut/fill depths against explicit agreed limits. Report measured extremes; numeric cut/fill and cross-section targets still need to be established during implementation.
- [ ] Check the full visible and drivable route, including intersections, bridges, exposed hillsides, intentional ends and changes in terrain detail. Connectivity metadata alone is not sufficient.
- [ ] Visit the city and each other town/village in the main game and find actual buildings, streets and connected entrances, not only markers or labels.
- [ ] Enter build mode from a normal main-game session, select a supported piece, rotate/place/stack/remove it, see invalid-placement reasons, exit cleanly, and verify collision and reload persistence.
- [ ] Keep performance within the existing project baseline as settlement geometry is added; check draw calls and terrain streaming instead of drawing an unbounded detailed world at once.
- [ ] Update the tracker only after the requested behavior is implemented and visually checked. This intake alone completes none of these features.

## 2026-11-04: Drive-to-loot settlements implementation

- The main game now renders every planned city/town/village using the existing seeded town/store renderer and inventory interactions. City: 5-by-5 lots; town: 3-by-3; village: 2-by-2. Each has a market, enterable shops, outdoor containers and shared walking/vehicle collision. Sunrise alone retains its junkyard, rebuild parts and shipping container.
- Residential road gates now coincide with actual grid streets. Internal main-road links follow street centrelines; corners inside settlements stay square. New settlement pad elevations are fitted to the feasible road profile, recorded in the shared place plan, then pinned through the streets. Ground, rendered buildings and physics use those levels; shop floors remain level even beside approach ramps.
- Container IDs are global across settlements. Store/building IDs stay local, so shelf reachability is checked against the owning settlement rather than treating IDs as global building indices. Opening shelves updates the corresponding renderer and existing inventory/loot state.
- Validation: 68 focused tests passed (settlements, gameplay, roads, ground, road rendering, terrain physics); standalone typecheck and production build passed. Build retains the existing large-chunk warning. New integration tests cover seeds 1/7/42: road clearance, aligned gates, level building footprints, entering every store through its door, unique containers, store-only reachability and loot transfers.
- Browser smoke check: seed 1 city inspected from above; all eight non-Sunrise residential places visited through the debug walker position, targeting a market shelf and transferring loot to inventory. This was not a continuous full-route driving run or an exhaustive visual/performance review.
- Remaining: distinct architecture beyond lot-count scales, docks/industrial/outpost/lookout layouts, broader terrain/road visual corrections and full-route driving/performance checks. New settlements are currently built at startup, not streamed by distance. Inventory/loot persistence and a general in-game build mode remain unfinished. No claim that all reference-road or build priorities are complete.

## 2026-11-04: Bounded road earthwork corrections and traversal sampling

- Short-run cleanup now compares sampled terrain costs before deleting a waypoint. It no longer freely straightens a contour-following climb just because the shortcut is dry. Corner rounding also shrinks when its curve moves more than 2 m vertically away from the original terrain-following runs.
- Access roads compare up to eight successfully fitted approaches instead of accepting the nearest horizontal junction. Selection measures actual finished maximum cut/fill and penalizes overlapping road-height disagreement at the join. The main-road itinerary, single-join branches, widths, grades, 12 m smoothing target and 9 m earthwork blend remain unchanged. The smoothing target is explicitly documented as **not a hard earthwork bound**.
- New regression test samples non-bridge segment midpoints against untouched world ground, including all roads rather than only the main corridor. Seeds 1/7/42 respectively: RMS cut/fill **20.20 → 17.08 m**, **19.73 → 17.18 m**, **26.45 → 22.26 m**; maximum absolute cut/fill **123.09 → 99.29 m**, **181.47 → 142.92 m**, **244.60 → 221.23 m**. Remaining maximum fills: **60.15 / 35.76 / 59.81 m**. These are serious remaining cuts/fills, not acceptable completed realistic earthworks. No bound was enlarged to make the tests pass.
- The test enforces at least 10% RMS and 5% maximum improvement against those measured pre-change baselines. It also checks actual ground crossfall over a 4 m cross-section: maxima **17.10% / 7.04% / 7.70%**; seed 1 still has an undesirable steep local crossfall. All planned longitudinal segment grades remain within their existing road-class limits.
- Actual Rapier samples use the finished ground callback and rolling terrain colliders, spawning separately on one straight sloping main-road section per seed. Four seconds of throttle after settling covers **32.95 / 27.32 / 32.79 m**, with lateral drift **0.19 / 0.004 / 0.12 m** and chassis clearance about **0.65–0.66 m**. This is roughly 93 m of isolated driving, **not continuous route traversal**, not a bridge/junction/town-door driving validation, and not a visual-driving proof.
- Validation: 33 tests passed in roads, earthworks, ground, road rendering, settlements and terrain physics; typecheck and production build passed (existing large-chunk warning).
- Browser: refreshed the main game at `127.0.0.1:5187/?fixed=1&objects=0`, confirmed 23 connected places and the approximately 38.17 km main road, and inspected Sunrise from above. Its awkward outside turn remains visible. Broader exit-side changes were tried but rejected because they broke route clearance/street alignment; they are not shipped. The remaining major trench was also located at road height through the debug camera; this was not driven.
- Remaining acceptance scope: redesign Sunrise exits without braiding approaches; reroute infeasible mountain descents rather than merely widening trench bounds; improve deep-cut/fill side slopes and bad local crossfalls; drive the entire main road and every branch through intersections, settlement entrances and bridges; repeat the reference-view and performance review. Build mode was not part of this stage.

### 2026-11-04: hard construction constraints and coupled terrain redesign

- Supersedes the preceding percentage-improvement experiment, not its historical measurements. The original island's knife-edge, 500 m-scale relief did not admit reliable connected 8%-grade surface roads. A hard-grade router initially failed between Port Alder and Ironworks. Rather than silently relax grades, drop places, or manufacture tunnels, this implementation explicitly changes terrain generation: before drainage and placement, an erosion/chamfer envelope limits upland neighbour rise to 6%. The result is substantially lower, broader highlands, **not the original mountain silhouettes**. Taller dramatic mountains would need a different terrain/corridor design, a larger island, or real tunnel engineering.
- Routing rejects over-grade dry edges and infeasible simplification shortcuts. Profiling intersects hard height intervals across the 10 m formation with grade and street/deck anchors; an empty intersection returns failure. Finished formations are checked at at most 1 m longitudinal intervals, including both edges, against a **6 m absolute cut/fill ceiling**. This is a maximum modest rural cutting/embankment, not a percentage improvement or a raised legacy tolerance. Shoulders use an 18 m smooth blend (a 6 m displacement gives a nominal maximum 1:2 blend slope before natural slope).
- Corrected coupled river artifacts: channel depth is capped at 3 m; water and excavation use each cell's drainage surface rather than a neighbouring river stamp's height. This also fixes upstream water being stamped below its outlet on the redesigned terrain.
- Bridges may slope within class grade rather than forcing every crossing above its highest bank. Two dry samples at each end provide real abutments. They remain restricted to actual water crossings, not mountain viaducts. Alternative gates are tried without relaxing grade/clearance. Branch routes avoid other settlement pads and bridge-side landings; junction ground uses smoothly weighted per-road projections instead of discontinuously switching ribbons.
- Preserved one continuous main itinerary, street alignment, reserved main-road separation, all residential sites, six outposts and five lookouts in every regression seed. Lookout height is relative to island relief, with 750 m separation; no lookout is silently lost to the obsolete 140 m cutoff. The current network generates road/dirt/trail, not highway.
- Hard regression samples every non-deck segment at <=1 m spacing, offsets -5/-2.5/0/2.5/5 m and shoulder offsets +/-14/+/-23 m. It checks both planned formation and actual ground against natural world ground, including mixed deck/approach segments, and actual transverse surface slope across 4 m and 10 m. Limits: 6 m construction difference, 8% crossfall (including junctions), existing per-class grades. Exact observed extrema:

| Seed | Maximum cut (m) | Maximum fill (m) | Maximum crossfall |
| --- | ---: | ---: | ---: |
| 1 | 3.813254477591226 | 3.856223365348974 | 0.05033557257788886 |
| 2 | 3.824549007225677 | 3.286261202240965 | 0.0585906391112232 |
| 3 | 3.950359697355637 | 4.900919569457477 | 0.05732162439366206 |
| 7 | 3.252474379852657 | 3.464331917968309 | 0.07264487995114166 |
| 42 | 3.6589892333582554 | 5.604457495925743 | 0.05687052629566267 |

- These are extrema of the sampled constructed footprint/shoulders on the **redesigned** world, not a claim that the original tall mountains were successfully routed unchanged. Continuous analytic bounds between all terrain/render samples are not proven. The shared formation solver applies to every class; seed regressions cover all three generated classes.
- Validation: 53 focused tests pass across earthworks, roads, ground, places, world, settlements and road rendering, including an artificial impassable ridge that must produce an explicit routing failure rather than dropped connectivity. `npm run typecheck` and `npm run build` pass, with the existing bundle-size warning. Five isolated Rapier driving samples advance 25.02/25.59/25.72/27.10/26.89 m with near-zero lateral drift; these are not a full-network drive.
- Browser inspection confirms 23 connected places and 12 roads; both the highest main-road view and the former trench area near X493/Z786 now show broad, low highlands without the old vertical cutting. This also visibly confirms the substantial scenery tradeoff, not preservation of the old mountains. Full continuous driving, richer mountain scenery, tunnels and the separate Sunrise exit redesign are not claimed complete.

### Road-first mountains (supersedes the globally lowered final terrain)

- Chris approved preserving mountains: “1 but just build out more roads and then build in the mountains between the roads.” The low-gradient envelope is now only a **routing draft**, not the finished island. Original blurred relief is retained, roads/places are planned first, and `restoreMountains` builds mountainous inter-road areas before terrain meshes, water, props, settlement views or collision ground are created.
- The finalizer consumes the completed plans; it never calls world, place or road generation. Road planning remains deterministic and does not mutate terrain. Main-game initialization explicitly runs the finalizer once.
- Reserve 80 m around road samples (plus grid interpolation support), residential pads and the starting-town/spawn approach. Restore original relief outside these reservations using a smooth 450 m transition, capped by a 0.55 rise/run relief envelope. This creates broad valley sides, not narrow road trenches; some original mountain vertices survive unchanged. Closely spaced roads naturally leave lower intervening hills.
- Preserve every wet cell and its water level. Bound restored relief downstream using the existing flood surface and upstream-first drainage tree, so raising an inter-road saddle cannot dam an upstream reserved corridor. Drainage directions, accumulation and lake/river surfaces remain consistent; mountain aridity and height/desert statistics are updated. The shared finalized map feeds both rendering and collision.
- Keep the connected 23-place/12-road network and continuous main itinerary; no extra duplicate loops are required for these seeds. Do not label buried roads as tunnels: no tunnels or dry-land bridge substitutes are introduced, and the 6 m formation and class-grade limits remain unchanged.
- Validation includes five-seed restored-world connectivity, formation/shoulder bounds, crossfall, downhill drainage, unchanged water, preserved original upland vertices and driving smoke tests. Browser inspection covers the former X493/Z786 area from the air and a lakeside main-road/branch junction. This is terrain co-design, **not preservation of every original silhouette**: reserved valleys and drainage constraints reshape nearby mountains. Whole-network continuous driving and all ten reference views remain unverified.
- Measured seeds 1/2/3/7/42: final peaks 381.84/342.68/349.22/447.05/366.80 m; maximum restored relief 288.23/273.56/236.19/329.70/270.68 m. Between 209 and 908 vertices above 200 m exactly retain the original mountain relief in each seed. Worst constructed earthwork remains 5.6045 m; worst sampled crossfall 7.2645%. All five driving smoke tests pass.
- Final validation: typecheck/build pass (existing large-bundle warning); full suite 210 passed, two unrelated failures in Cannon ramp driving and yard-vehicle model bounds. Final browser view confirms restored mountain slopes at X493/Z786 with roads remaining in the low corridors. Hidden-tab/software-renderer frame timing is not a performance acceptance result.
# 2026-11-04 Scenery references and northern city blocks

Chris supplied 32 reference images and the local Supply Line Assets pack. These guide original environment composition, not copied screenshots, branded buildings or watermarked textures.

- Images 1-7: weathered desert highways, lane edges, poles/wires, warning signs, guardrails, fenced industrial buildings, isolated roadside stops, snowy woods and abandoned vehicles.
- Images 8-14: wooded coastal docks, industrial clearings, lakeside roads, camps, apartment blocks with garages, fishing settlements and utility corridors.
- Images 15-26: wind-rippled dunes, high mountain silhouettes, alpine lakes, rocky streams, wooded foothills, snow patches, contrasting vegetation and atmospheric depth. These remain scenery direction, not a claim that snow, waterfalls or a day/night cycle are implemented.
- Images 27-30: tree-lined town streets, forest road approaches, substantial roadside buildings/parking and furnished multi-storey interiors. Upstairs gameplay and furnished residential interiors remain future work.
- Images 31-32: the game's northern coastal road/lake section needs real city blocks instead of empty terrain.

Implemented a northern urban district by expanding the northernmost non-starting town to a five-by-five block footprint. In the default seed this is Fenwick, near X -1008, Z -4080. Existing regional place identities and positions remain intact; moving the original city changed unrelated routes and was rejected after road regression checks. Fenwick and the existing city now use urban building heights (9.6-38.4 m), a mix of tall solid residential/office buildings and enterable ground-level stores, repeated upper-floor windows and masonry trim, and concrete pavement strips. Upper floors are visual facades, not navigable apartments. Facade details are batched by shared material per settlement instead of issuing separate window draw calls.

The expanded footprint is shared by routing gates, street anchors, ground levelling, mountain clearance, prop exclusion and settlement generation. All loot retains unique global IDs and existing collision/store-access rules.

Asset inspection found a Unity-oriented pack (FBX, prefabs, textures and shaders). Existing world materials already use its sand, grass, rock, bark, asphalt and concrete images; this pass reuses those imports, with provenance in public/textures/world/SOURCES.md, rather than duplicating the pack or treating Unity prefabs as browser-ready models. Brick facades retain the existing separately documented sources.

Validation: 27 focused settlement/place/road/earthworks tests pass, including the northern location, skyline scale, shop reachability, unique loot, five-seed road limits and physics smoke checks. Typecheck and production build pass with the existing bundle warning. This is a first downtown district, not a kilometre-scale metropolis or completion of all 30 scenery references.

## Barter rules for the traders (Chris: barter only, no money)

- src/rules/trade.ts, tests in tests/trade.test.ts (8, all pass). Pure rules, nothing drawn yet and no trader is in the world yet.
- How it works (Claude chose the numbers): every item has a worth in units (a motor 220, a tyre 45, a wrench 30, beans 10, crackers 4). The trader wants goods worth more than what you ask for, by a margin (1.25 to 1.5 at first, seeded per trader). Pushing for a better price lowers the margin 0.08 at a time down to that trader's floor (1.05 to 1.15) and costs patience (2 to 4 pushes); after that the trader refuses to haggle. A swap that would not fit in your pack is undone completely.
- Five traders: the starting town, the three other towns and the city, one salvage yard each, which matches the five traders in the concept. Each trader has a seeded stock of food, goods and always some tyres; motors and wrenches only sometimes.
- Not done: drawing the other towns and city, their salvage yards, the trader character and the trade screen, joining the starting yard to its trader, and the van, box truck, big rig and flatbed trailer placed in the yards.

## 2026-11-04 Larger settlements and connected residential neighbourhoods

Supersedes the earlier five-by-five skyline-only expansion. Keep the existing core streets, gates, locations and Sunrise junkyard unchanged. Add seeded, road-connected small neighbourhood foundations along approaches and grow additional connected side-street blocks from them. Each pad is fitted locally to terrain; rejected candidates cannot raise the 6 m road-earthwork or 8% crossfall bounds. Mountain restoration reserves these footprints, rather than flattening a kilometre-wide city mesa.

Seed 1 measured built street-envelope dimensions and actual building counts (envelopes include open ground between districts, **not** fully developed rectangular acreage):

| Settlement | Before | After | Businesses | Detached homes | Apartment buildings |
|---|---|---|---:|---:|---:|
| Port Alder | 140 × 140 m, 21 buildings | 1,124 × 1,214 m, 107 buildings | 32 | 28 | 79 |
| Northern Fenwick | 140 × 140 m, 20 buildings | 1,317 × 800 m, 101 buildings | 31 | 27 | 74 |
| Oro Verde | 84 × 84 m, 6 buildings | 300 × 704 m, 31 buildings | 4 | 25 | 0 |
| Halcyon | 84 × 84 m, 8 buildings | 734 × 318 m, 41 buildings | 4 | 33 | 0 |
| Little Ash | 56 × 56 m, 4 buildings | 485 × 495 m, 17 buildings | 2 | 13 | 0 |
| Wren | 56 × 56 m, 4 buildings | 404 × 157 m, 15 buildings | 3 | 11 | 0 |
| Quarry End | 56 × 56 m, 4 buildings | 487 × 391 m, 16 buildings | 3 | 12 | 0 |
| Brindle | 56 × 56 m, 3 buildings | 152 × 524 m, 17 buildings | 1 | 14 | 0 |

Businesses under apartments count in both business and apartment columns. Commercial blocks have signed, enterable ground floors, shelves and a real ceiling beneath solid upper storeys. Apartment-only and pitched-roof detached-home side streets have separate housing assignments; non-residential logistics destinations never acquire a blanket urban flag. IDs are globally unique across cores, neighbourhoods and facilities; existing inventory/opened-loot handling is shared. Map footprints, ground, collision, prop exclusion and mountain reservations consume the same neighbourhood plan. Immutable scenery and facade detail are spatially batched; openable stock stays independent. Existing supplied world textures are reused without new dependencies.

The increase is not just the bounding envelope: counting only the original core street-grid area plus accepted 28 × 28 m neighbourhood grids, excluding every intervening gap, seed 1 Port Alder grows from 19,600 to 87,024 m² (4.44×), Fenwick to 83,104 m² (4.24×), Oro Verde from 7,056 to 26,656 m² (3.78×), Halcyon to 32,928 m² (4.67×), and villages from 3,136 to 11,760–14,112 m² (3.75–4.5×). These are street-block areas, not building-floor area.

Browser verification at northern Fenwick: aerial inspection of the expanded connected footprint; walked through the west-facing ground-floor market entrance at approximately X -945, Z -3978, below a 19.2 m apartment building; approached shelf ID 573 and pressed E, transferring four water bottles into the previously empty inventory. Ground floor has a ceiling rather than a hollow tower interior.

Validation: 43 focused tests passed across settlement/terrain/roads/facilities/batching suites, including seeds 1, 2, 3, 7 and 42. New checks measure developed block area excluding gaps, within-kind variety, city > town > village building counts, connected street graphs, vehicle-clear centre lines, foundations/collider ground agreement, unique loot IDs, business door entry and shelf inventory transfer. Every constructed road formation was sampled after mountain restoration: worst cut/fill magnitude 5.790 m (limit 6 m), maximum crossfall 7.844% (limit 8%), and all class grade bounds held; five Rapier driving smoke tests passed. Typecheck and production build passed (existing large-bundle warning remains). No full-suite claim: the previously known unrelated cannon-ramp and yard-vehicle issues were not changed or re-run.

Limits: development follows feasible local terrain and therefore includes gaps, irregular outskirts and different populations by seed. These are small block neighbourhoods, not fully furnished realistic city parcels. Homes/apartment upper floors remain exterior-only; no simulated resident population. Planning takes noticeably longer than the old tiny settlements, and this browser sample was roughly 20–35 fps with ~700 draws inside the shop while validation processes were running; this is not a clean laptop performance certification. All loot remains session-only as before.
# 2026-11-04 Road-fronting facilities and grouped housing

Final facility visual follow-through: inspected the seed-1 military compound, depot termination court and North Quay. Corrected terrain protruding through court/access pavement by grading their footprints and shoulders while preserving existing roads and sea terrain. Facility entrances/courts match their floor heights, and access lanes clear buildings/fixtures. The final destination/ground check passes all 19 tests; production build/typecheck pass. Actual truck traversal of these facility entrances remains untested.

Chris's six layout screenshots show a military compound straddling a diagonal through-road, isolated depots on mismatched square aprons, and residential buildings strung individually along approaches. The requested correction is road frontage and actual neighborhoods, not more scattered lots.

- Residential expansion now places two-by-two street blocks with at least three buildings each. Local-street growth is considered before another arterial attachment, with at most four arterial entrances per city, three per town and two per village. Seeded population/size differences remain.
- Each block has a local terrain-fitting foundation; its 40 m access street grades from the existing junction to the block, rather than forcing every neighborhood onto the arterial's elevation. Shared intersection samples keep graph and physical street connectivity aligned. Expanded foundation clearances protect the original core's shop floors.
- Houses/apartments face their nearest local street. Fronts stay clear of loot containers; house doors follow the same frontage. Homes remain exterior-only.
- Facilities use road-clear layouts with projected access entrances, deliberate courts and gates instead of building across through-roads. The same access lanes are rendered and registered as driving/walking surfaces. Docks retain obstacle-aware quay access. Building/fixture clearance tests use full road segments, including diagonal/curving roads, not only nearest sampled points.
- Default-seed Fenwick retains 103 buildings and Port Alder 107. Fenwick's 23 added blocks occupy 72,128 square metres of street-block area, excluding the existing core and gaps; its footprint is approximately 1,332 by 912 m. Larger blocks reduce the prior one-building apron/spur pattern without shrinking cities back into tiny settlements.

Validation: 36 focused neighborhood, settlement, road/earthworks, destination and render-batching tests pass; typecheck and production build pass with the existing bundle warning. Five-seed housing checks cover grouping, capped arterial entrances, frontage, real local-street connectivity, unobstructed streets, floor agreement and business entry/loot. Destination tests cover road/obstacle clearances and entrances. This is layout correction, not new upstairs/home interiors.
