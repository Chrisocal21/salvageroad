# Salvage Road (working title) — Progress Tracker

> File names keep the early ROADSURVIVAL prefix. Nothing gets renamed or deleted.
> Where this file and docs/SALVAGE_ROAD_CONCEPT.md disagree, the concept file wins. Details of every build decision are in DECISIONS_LOG.md at the project root.

---

## Salvage Road

**Additional imported vehicles:** The supplied unfinished pickup and delivery step van are additional projects in the first and second remote salvage yards, respectively; none of the existing vehicles are replaced. J cycles the yards. Both require a wrench and their own real repair parts, including four tires, mechanical assemblies, brakes, seats, glass and body components. The pickup gains a replacement bed and 28-slot item storage; the van gains a cargo floor, roof, opening rear doors and 64-slot storage. Driving/storage unlock after full restoration. Guaranteed remote loot covers all four projects and workshop leads identify component locations. The original box truck retains 96 slots; only the tractor tows the separately collected flatbed. Supplied geometry has converted axes, rebuilt wheel pivots and tuned suspension/collisions. Missing assemblies use simple supplemental geometry. The pack remains prototype/blockout-quality art; its README is preserved. Repairs, vehicles and cargo remain session-only.

**Title screen / Play gate:** The supplied transparent logo and pickup-workshop scene now introduce the game before world initialization. Play reveals the supplied box-truck loading scene and then imports/generates the world; the title alone does not load the main game/physics modules. An expandable controls guide works without starting the game. Duplicate Play clicks are blocked. Background copies are optimized; original attachments are unchanged. The loading cover still ends only after the first world render, with an explicit reload option on startup failure. No unsupported Continue/Settings/Quit buttons are shown.

**Field-system visual redesign:** Replaced the generic panel presentation with an asymmetric road-survey loading composition, oversized condensed identity, recovery-orange accents and technical blueprint motifs. Pause now separates Resume from a category-based field manual. The pack has visible numbered empty/occupied positions, reserve labels, an equipment inspector and explicit Use/Assign actions. Workshop cards show large diagrams and inline readiness/tool/material requirements. Cargo, barter and restoration share the sharper visual system. Compact in-world placement/hotbar dimensions remain unchanged. Desktop and narrow layouts were checked without modifying player inventory or saves.

**Startup loading cover:** The initial HTML now shows a branded loading screen immediately, before game code/world generation runs. A translucent black cover and indeterminate activity line remain through island generation and physics initialization, then fade out only after the first world frame renders. Background HUD/input stay hidden or blocked until ready. Initialization failures retain the cover with an explicit reload action; reduced-motion users get a static activity line and no fade.

**Hammer removal:** Equip the build hammer with its hotbar number; this no longer opens the menu. K opens the workshop. Aim at a placed wood piece within 3 m and right-click to open **Confirm removal / Cancel**, without selecting a placement recipe. Escape cancels. Removal still respects structural support; ordinary pieces have no material refund, while portable toolbox benches return to inventory if there is room.

**Compact salvage UI:** Shared graphite/olive panels, restrained amber highlights, original item icons and consistent keyboard focus now cover the HUD, inventory, cargo, barter, pause, restoration and map screens. The ten-slot icon hotbar keeps names in contextual tooltips; needs remain in a small corner readout. Placement is a bottom-right tool card instead of a large central panel (browser-measured 286 x 129 px at 1366 x 768; 235 x 125 px at 390 x 844, without overlapping needs/hotbar). K opens Construction, Benches, Crafting and Containers tabs with costs and a collapsible field guide. Inventory/cargo have explicit close buttons and modal world-input blocking. The minimap moves to the upper-right; the region map adds a header, close button and keyboard access. Desktop and narrow workshop/inventory layouts were checked in-browser; long lists scroll inside their panels. Existing recipes, hauling and hotbar assignments are unchanged.

**Numbered hotbar:** Only the first ten pack slots appear along the bottom, labelled 1-9 then 0; remaining items stay in inventory. Open Tab/I, click an item's Assign button, then press the target number (or click its hotbar slot). Whole stacks swap without deleting either item. Close inventory and press the number to equip: portable toolbox benches immediately enter placement mode without a hammer; planers select their bench recipe (still requiring logs/hammer); the build hammer equips for right-click removal confirmation, while K opens the build menu. Aim at flat ground, click the game to capture the mouse, then left-click to place; R rotates. Food/drink can be used from the hotbar. Selected slots are highlighted and depleted placeable items end their preview. Number keys no longer select trailer cargo: use K's actual cargo list instead.

**Wood building and benches:** K opens a unified crafting/build menu with hauled containers, wood doors/shutter windows, decks, rails, garage doors, floors, walls, stairs and benches. Containers still require actual flatbed cargo and a stopped, hooked trailer nearby; U remains available. Wood pieces snap to the existing grid; container doors/windows replace matching wall sections with real render/vehicle/walking openings. E operates doors/shutters. Floors, roofs and stairs have walkable elevations; stairs rotate in four directions. Left-click builds; right-click dismantles without refunds, except portable toolbox benches return as items.

Loot log piles and town boxes, or carry an axe and use E three times at a tree for four logs. Felled world/town trees lose their visuals and walking/driving collisions for this session. Lootable axes/planers also have recipes. The starter toolbox supplies a portable toolbox bench: place it from your pack or item storage within 8 m, without needing a hammer, on flat ground anywhere. E/K beside it enables axe/planer crafting; the menu can pack it back into inventory, refusing safely if full. Craft a build hammer by hand from one log. Build a planer bench using six logs and a planer; beside it, one log becomes four building planks. Other wood pieces require the carried build hammer and planks. Resource consumption and full-inventory crafting are atomic. Buildings, deployed benches/elevations, openings and open states are saved with the base; inventories, tree harvesting, loot depletion and vehicles remain session-only. More bench types and scrap-metal/material upgrades remain future work.

**Overall progress:** 46% (38 of 82 items below are done). This counts items, not effort: the untouched later phases are many items of very different size.
**Last updated:** November 4, 2026

**Box-truck restoration/storage:** The second remote vehicle is now a short-hood, two-axle delivery truck, not another tractor. Based on the supplied references, its tall white cargo box dominates the cab, with aluminum rails/rivets, mirrors, curved front fenders, rear door hardware, mudflaps, wood floor and interior tie rails. It needs 37 installed pieces across 23 component types: drivetrain and six tires (rear duals), radiator, four brake assemblies, exhaust, dashboard, two seats, glass, cab doors, hood, grille/lights, bumpers, cargo floor, four wall panels, roof and two rear doors. A wrench and actual hauled items are required; dashboard/seats precede cab doors, engine/radiator precede grille/lights, and the cargo floor/walls precede roof/rear doors. A battered cargo shell survives before restoration; each repaired section replaces its damaged counterpart. Missing mechanical assemblies remain absent. Guaranteed remote loot supplies both the tractor and box truck, with leads in each workshop. Complete the restoration to unlock driving and its independent 96-slot item storage (not the El Cajon's tire/engine rack limits). E opens its workshop/storage menu on foot; Tab opens cargo while driving and stopped; E/Tab/Esc close it. Cargo doors swing open with storage. The tractor remains the only flatbed tow vehicle. Box restoration and stored items are session-only, like the existing unsaved vehicle state.

**Salvage-yard shortcut:** J cycles from the starting El Cajon yard through the remote salvage yards, including the flatbed yard, then wraps back to the start. Each stop places the player outside the gate facing inward; vehicles remain parked where they were left.

**Flatbed hauling:** One remote salvage yard offers a stripped tractor, another offers the box truck, and the third holds a separate flatbed to collect. Back the restored tractor under its front kingpin, align within 1.8 m, stop and press H to hook/unhook. The trailer uses an articulated physics joint, tandem-axle suspension and cargo collision/mass. Tow it to a dock, stop and press U; right-click a container within 12 m of the trailer to load it. Capacity is one 20 ft or two 10 ft containers (not 40 ft). Drive to the compound, press U, left-click to place, R to rotate and PageUp/PageDown to stack. Right-click can recover supported, removable base containers without duplicating them. Dock stock is removed from rendering and collisions when loaded. Cargo remains on an unhooked trailer during the session. A first compound takes its elevation from the chosen unloading site; base elevation is saved with the base. Ten-foot models are 3.048 m long and reserve three 4 ft build cells for end clearance. The build grid now covers the full island. Vehicle/trailer state, cargo and depleted dock stock are not saved across reloads.

**Big-rig restoration:** The starting yard retains only the El Cajon restoration project. The rig yards have independent repair progress. Carry a wrench, collect the engine, transmission, battery, tank, steering assembly and ten tires, then press E beside a rig to fit parts and drive it. Parts can come from the pack or the El Cajon parked within 8 m; scavenging leads are listed in the workshop. Fixed concurrent Rapier initialization that could put separate vehicles at the same spawn. Rigs have six suspension wheels, driving/exit/flip controls, walking collisions and vehicle obstacles. Unhook the trailer before flipping a rig.

**Sunrise workshop trader:** Moved the trader indoors into an enterable brick workshop. Shared walls/collisions, an open doorway, clear approach and repositioned toolbox preserve access and the starter wrench. Stock now specializes in existing tools and vehicle parts, with a matching HUD title. Other traders, new parts and vehicle acquisition remain outside this step.

**Trader step A:** Added Sunrise's yard counter/person, E prompt and barter-only screen with item quantities, offer verdict, Haggle and Trade. Prevents movement/world actions while open; full-pack failure leaves both sides unchanged. Existing general seeded stock is reused; trader specialties and the other four settlement traders are not implemented. No saving or vehicle ownership work. Validation: 71 focused trade/HUD/gameplay/repair tests, production build/typecheck, and a live goods-for-tire browser swap pass. No commit.

**Flooded blocks and salvage yards:** Neighborhood foundations and access streets now require dry full footprints, including shoreline clearance, rather than only acceptable ground height. Mid-street growth candidates preserve settlement size while avoiding water. Added three remote salvage compounds at outposts, with wrecks, fences/gates, workshops, loot and connected entrances, without duplicating Sunrise's starter progression. M-map names/markers use actual facility positions. All 25 focused tests and production build/typecheck pass; a remote yard was visually checked in the browser. Actual whole-route truck traversal and wreck-scrapping gameplay remain unfinished.

**Housing/shopping reference follow-through:** Recorded the latest 18 images in the decision log. Replaced the shared micro-grid template with six-home garden-backed residential blocks and four-unit shopping centers with common promenades, marked parking and clear drive aisles; apartment blocks remain a separate higher-density type. Added residential lawns, paths, short driveways, trees with trunk collisions, and local-district sidewalks. Preserved connected, terrain-fitting streets and individually reachable shop loot. All 24 focused neighborhood/settlement/destination/earthworks/batching tests and production build/typecheck pass; aerial browser checks cover both new layouts. Curved/longer residential tracts, larger malls and full downtown/reference scenery parity remain unfinished. Overall completion remains unchanged.

**Layout correction (Nov 4, 17:23):** Replaced individually attached residential lots with two-by-two local-street blocks containing at least three buildings, prioritizing neighborhood growth over additional arterial spurs. Houses face local streets. Added graded block access and larger pad separation from core floors. Roadside facilities now clear through-roads and use explicit connected entrances/courts; access surfaces and rendering agree. Default-seed Fenwick/Port Alder retain 103/107 buildings. All 36 focused layout/road/loot/render tests and production build/typecheck pass. No home/upstairs interior completion is implied.

**Scenery/city pass (Nov 4, 16:47):** Recorded all 32 scenery references in the decision log. Fenwick in the pictured northern coastal region now has a five-by-five urban block layout, taller multi-storey buildings, textured facades, sidewalks and lootable ground-floor stores. The existing city gets the same skyline treatment. Street routing, terrain pads, mountain clearance and collision/loot integration share the expanded footprint. Facades are material-batched. Upper floors remain decorative; larger city districts and the full reference scenery set are not complete. Reused the supplied pack's already-imported runtime textures. Validation: 27 focused tests and production build/typecheck pass.

**Coastal network follow-through (Nov 4, 16:30):** The default seed now has 18 roads instead of 12, including six junction-to-junction loops adding 7.90 km. Seeds 2/3/7/42 have 21/25/25/22 roads, adding 14.16/24.60/20.05/17.63 km. Water-adjacent dry anchors are prioritized; this is not a guaranteed complete ocean ring or a ring around every lake. New roads are rejected for self-overlap, incompatible junction elevations, excessive shoulder earthworks or actual blended-surface crossfall. Search is bounded to 120 candidate route pairs, distributed across anchors rather than exhausted on one site. All 21 focused roads, earthworks/driving-smoke, destination and terrain-stitching tests pass; production build/typecheck pass. Terrain seams were visually checked in isolated near/far terrain scenes; continuous whole-network driving and every facility approach remain unverified. Facilities include freight depots, a military logistics compound and shipping docks with loot and collisions. No build-mode progress is implied.
**Status:** Active. Playable in the browser at localhost:3000. 207 tests, 205 pass; the failures are an old comparison test for the cannon-es physics library, which the game does not use, and a work-in-progress yard vehicles tolerance test.

**Latest review (Nov 4, about 15:00):** Chris's ten screenshots show that connected roads are not yet believable roads: mountain trenches/ledges, the Sunrise loop and unexplained ends remain. Other settlements are still markers, and U cargo unloading is not the requested general in-game build mode. Detailed screenshot notes and acceptance checks are in the latest entry of [DECISIONS_LOG.md](../DECISIONS_LOG.md). This review records unfinished work; it does not increase progress.

---

### Pre-Production

**Progress:** 100% (11/11)
**Goal:** settle the few decisions that shape everything before the first line of game code.

- [x] Choose a working title: Salvage Road
- [x] Define what happened to the world: a quiet collapse
- [x] Define the refuges: several to visit and choose between (the concept file now says five traders instead)
- [x] Decide whether the journey has an ending: no, the road itself is the point
- [x] Decide perspective: first person
- [x] Decide art direction: stylized realism
- [x] Decide the first vehicle: the El Cajon, an original El Camino-style coupe-utility
- [x] Set the performance target: a mid-range laptop (test machine: Ryzen 5 7535HS, integrated Radeon)
- [x] Write the Step Zero handoff brief for the coding Claude (ROADSURVIVAL_STEP_ZERO_HANDOFF.md)
- [x] Choose the vehicle physics approach: Rapier (compared with cannon-es, Chris chose Rapier)
- [x] Create a new separate repo: TypeScript + Vite + Three.js on localhost:3000

---

### Step Zero — Prove the Loop

**Progress:** 88% (7/8)
**Goal:** driving, looting, and the pop-up bench feel good with placeholder art.

- [x] Drivable El Cajon with good-feeling physics (realistic, not arcade)
- [x] Generated terrain (first a 400 m patch, now the 12 km world)
- [x] One generated town with lootable containers
- [x] Walk in first person, pick up, and carry items
- [x] Enter and exit the vehicle
- [ ] Deploy a bench from the bed, craft one item, pack it away (never built: the concept replaced the bench with base building from shipping containers)
- [x] Hunger meter that creates a reason to stop (hunger and thirst)
- [x] Browser performance check, judged against a mid-range laptop (300 props held 144 fps; the scene has grown since and has not been re-measured with the real GPU)

---

### Phase 1 — Single-Player Vertical Slice

**Phase progress:** 50% (7/14)
**Goal:** one road leg from a starting town to a first refuge. The concept changed the shape of this (see the next section), so some items here are done in a different way than first written.

#### Feature 1.1 — Vehicle
**Progress:** 50% (2/4)
- [x] Find and claim a beat-up El Cajon in a town (it is a stripped rusty shell in the town's junkyard)
- [x] Put it back together from loose parts with a wrench (15 kinds of part, 18 pieces)
- [ ] Repair at a bench (there is no bench; parts are bolted on by hand)
- [ ] Small set of upgrades

#### Feature 1.2 — Looting
**Progress:** 50% (1/2)
- [x] Town loot with a simple loot table (boxes outside, shelves in walk-in stores)
- [ ] Roadside scrap pickups while driving

#### Feature 1.3 — Survival
**Progress:** 100% (2/2)
- [x] Hunger and thirst (placeholder numbers; nothing lethal yet)
- [x] Eating and drinking items (F eat, Q drink)

#### Feature 1.4 — World
**Progress:** 100% (2/2)
- [x] Seed-based generation (island, rivers, lakes, desert, mountains, town site)
- [x] Second biome (desert round the start, green country beyond)

#### Feature 1.5 — First Refuge
**Progress:** 0% (0/1)
- [ ] One simple refuge at the end of the leg with a trader: sell loot, buy one thing

#### Feature 1.6 — Look
**Progress:** 0% (0/1)
- [ ] Lighting and color grading pass for the stylized realism direction (the El Cajon has a rust shader; the rest is placeholder)

#### Feature 1.7 — Saves
**Progress:** 0% (0/2)
- [ ] Save and load in browser local storage (only the base is saved today; the truck rebuild, inventory and loot are not)
- [ ] Deploy to Vercel

---

### Concept Build (from docs/SALVAGE_ROAD_CONCEPT.md)

**Progress:** 44% (11/25)
**Goal:** the game as Chris described it later: rebuild the truck, find containers, haul them to a compound, a big world to travel.

#### Base and containers
- [x] Shipping container base builder prototype at /base/ (snap grid, stacking, support rule, pillars, build menu); the requested discoverable main-game build mode is still pending
- [x] Real container model with level of detail
- [x] Put containers down from the truck in first person (U): ghost, snapping, support rules, pick back up
- [ ] Containers lying in the world to haul away (one stands in the junkyard; the docks and other sites are still to come)
- [ ] Big rig, flatbed trailer, hauling and loading containers
- [ ] Floors, walls, stairs, doors and windows for the base

#### World
- [x] 12 km island generator: land, rivers, lakes, ocean, desert (viewer at /world/)
- [x] One game: wake in the desert, town hidden behind a dune, fly mode (G), quick jump to town (J)
- [x] Detailed ground you can walk and drive on (tiles that get finer near you)
- [x] Plan of places and two docks for any island (src/rules/places.ts; map labels and world markers exist, but other settlements are not built)
- [x] One continuous main-road connection through the planned towns, villages, city, industrial yard and docks, with single-join access roads and bridge support (src/rules/roads.ts, src/rules/ground.ts); routing, earthworks and road presentation still need the latest visual-review work
- [x] Map screen (M) and minimap: every place named, roads and bridges drawn, player arrow, click-to-travel for testing; HUD hotbar and click-to-use inventory (src/ui/mapOverlay.ts, src/ui/hud.ts)
- [ ] The other towns, the city, the docks and the industrial yard built in the world
- [ ] Trees, shrubs and ground textures from Chris's asset folders
- [ ] Water: shore, waves, shoreline
- [ ] Time of day and weather

#### The truck
- [x] Rusty wreck rebuilt part by part from the junkyard (engine, battery, hood, 4 wheels, seat, 2 bumpers, tailgate, dash, steering wheel, windshield, 2 doors, grille, headlights)
- [x] Doors, hood and tailgate that open; driver and passenger seats; Tab storage from either seat
- [x] Bed storage of 24 slots that shows what is in it (tires, motors, a supply crate)
- [x] Big rig tyre to find, keep and store
- [ ] Fuel, damage and part condition
- [ ] Restoring the paint (grind, paint, buff)
- [ ] More vehicles, and broken-down cars across the world

#### Everything else from the concept
- [ ] Hunting and survival depth (animals, weapons, cooking), ranching
- [ ] Five traders buying and selling different things; the three song CDs
- [ ] Co-op for up to 4 players (see Phase 3)

---

### Phase 2 — Core Loop

**Phase progress:** 0% (0/11)

- [ ] Hunting
- [ ] Fishing
- [ ] Cooking
- [ ] Full crafting tree
- [ ] Levels, research points, research tree
- [ ] Quests
- [ ] Several refuges or traders, and the choice of where to drive next
- [ ] Distance milestones as the long-term goal
- [ ] Weather as a survival pressure
- [ ] More biomes
- [ ] More vehicles beyond the El Cajon

---

### Phase 3 — Co-op

**Phase progress:** 0% (0/6)

- [ ] Choose and prove networking approach
- [ ] Character models for other players
- [ ] Shared vehicle with seats (the El Cajon already has a driver and a passenger seat, for one player)
- [ ] Inventory rules for shared and personal items
- [ ] Join by code, same seed
- [ ] Sync benches, loot, world state

---

### Phase 4 — Depth and Polish

**Phase progress:** 0% (0/6)

- [ ] Refuge variety
- [ ] 3 song CDs in different genres
- [ ] Deeper generative variety
- [ ] Real art pass within stylized realism
- [ ] Audio pass
- [ ] Decide: stay browser-only or also build Unity (the concept says browser first, wrapped in Electron later for Steam)

---

## Session Update Log

| Date | What Moved | New Overall |
|---|---|---|
| Nov 1, 2026 | Project opened: idea, features, phase plan, and documents created | 0% |
| Nov 1, 2026 | Platform changed to browser first, as a fully separate project; tools and pre-production list updated | 0% |
| Nov 1, 2026 | Working title Salvage Road chosen; story direction set: drive to find traders and refuge; trader stop added to Phase 1 | 0% |
| Nov 1, 2026 | Story settled as a quiet collapse; tone calm and a little lonely; pre-production now 2 of 7 | 0% |
| Nov 2, 2026 | Refuges set as several to visit and choose between; Phase 1 now ends at a first refuge; pre-production now 3 of 8 | 0% |
| Nov 2, 2026 | No fixed ending: the road itself is the point; distance milestones added to Phase 2; pre-production now 4 of 8 | 0% |
| Nov 2, 2026 | First person camera chosen; pre-production now 5 of 8 | 0% |
| Nov 2, 2026 | Art direction set to stylized realism; look pass added to Phase 1; pre-production now 6 of 8 | 0% |
| Nov 2, 2026 | First vehicle set: the El Cajon, an original El Camino-style coupe-utility with a generic name; pre-production now 7 of 9 | 0% |
| Nov 2, 2026 | Step Zero handoff brief written; performance target set to a mid-range laptop; pre-production now 9 of 11 | 0% |
| Nov 2, 2026 | Repo created. Physics compared; Rapier chosen. Drivable El Cajon, terrain and performance baseline, a generated town with looting, first-person walking, the HTML HUD, hunger and thirst. Pre-production and most of Step Zero done | about 20% |
| Nov 4, 2026 | New concept adopted. Shipping container base builder, real container model, first-person unloading. A 12 km island world, desert start with the town hidden behind a dune, fly mode, walk-in stores | about 33% |
| Nov 4, 2026 | The El Cajon becomes a stripped rusty shell in a junkyard, rebuilt from 18 loose pieces with a wrench. Doors, hood, tailgate, seats, bed storage that shows its load, the big rig tyre. One container in the yard. Plan of places and two docks. Tracker rewritten to match | 44% |
| Nov 4, 2026 | Road network built: highways, roads, dirt roads and trails join every place, with bridges over water. Drawn in the /world/ viewer and the plan map tool; not levelled into the game world yet | 46% |
| Nov 4, 2026 | Everything on one map: roads levelled into the game world and drivable, bridge decks carry the walker and the truck, place markers, map screen (M) with click-to-travel, minimap, HUD hotbar and clickable inventory | 46% |
| Nov 4, 2026 | Road correction: one continuous town-to-town route replaces branching highways and duplicate corridors; access roads join once, street heights stay fixed, and pavement follows exact ground support | 46% |
| Nov 4, 2026 | Ten-screenshot review recorded: believable road routing/earthworks and Sunrise approaches, actual visible settlements, and discoverable build mode in the main game are the next priorities; no implementation claimed by this intake | 46% |

---

## What to Tackle Next

- [ ] Correct the reviewed road sections: giant mountain trenches and ledges, abrupt terrain transitions, and the unnatural Sunrise loop; keep one main town-to-town road
- [ ] Make roads read as roads: shoulders, appropriate markings, coherent junctions and deliberate destination entrances/ends; verify all ten reference views
- [ ] Build actual visible cities, towns and villages with streets connected to the shared road network; markers and map names do not satisfy this
- [ ] Integrate discoverable build mode and a supported-piece catalogue into the main game, reusing placement/support/collision/save rules without requiring /base/ or a cargo testing URL
- [x] Road connectivity implemented: one main route, street-height anchors and single-join access roads (2026-11-04); this does not close the visual road work above
- [x] Smooth coast and river edges, stable with the camera (2026-11-04)
- [ ] Haul a container onto the truck (the yard container, then the docks)
- [ ] Lane markings and proper junction shapes
- [x] City/town/village streets opening onto real road gates, visible scaled settlements and lootable stores (2026-11-04; seed 1 browser smoke check, seeds 1/7/42 integration tests)
- [ ] Physical layouts and entrances for docks, industrial yard, outposts and lookouts
- [ ] River bank colour still blocky at long range
- [ ] Decide: a viaduct rim-to-rim rule for gorges, or keep the deep-cut roads as they are (see DECISIONS_LOG.md)
- [x] Draw the other towns, city and villages; reuse inventory, store entrances and walking/vehicle collisions without duplicating Sunrise's yard
- [ ] Draw the docks and industrial yard; full-route driving and settlement streaming/performance validation
- [ ] Trees, shrubs and ground textures from the asset folders (licences to check first)
- [ ] Confirm how many shipping containers there should be across the map (Claude recommends about 150)
- [ ] Decide: should parts be found outside the junkyard, and does the truck need fuel
- [ ] Save the game (truck rebuild, inventory, loot)

---

## Build Rules

### Road-end facilities and terrain boundaries (2026-11-04)

- Main-game nonresidential destinations now use enterable metal freight warehouses, a three-building military logistics compound with perimeter barriers and a tower, and shipping quays with two warehouses, stacked cargo, a clear central freight lane and a gantry. The same town-wall, loot, opened-container and walking/driving collision paths handle these facilities; loot IDs follow residential container IDs. No additional build-mode features.
- Facilities attach to the nearest dry road sample, including interior main-road samples rather than only road endpoints. Residential layouts remain unchanged. Courts use terrain-conforming pavement, foundations are spatially indexed, and foundation grading explicitly excludes the validated 23 m road/shoulder footprint.
- Removed terrain skirts and triangulated every tile boundary on the same 2 m lattice. Near and far tiles now share exact edge positions, colours and fixed-spacing normals; this addresses real LOD geometry/lighting discontinuities rather than hiding a supposed grid overlay.
- Verification: four focused facility/boundary tests and production typecheck/build pass. Tests cover unique loot IDs, enterable door gaps, clear turning courts, distinct military/dock layouts, quay driving support without filling sea terrain, preserved road formations, and matching 128/256/512 m edges against a 1024 m tile.
- Browser inspection used the actual facility renderer in an isolated dock/military scene, plus the actual tiled renderer at two camera heights (282 and 288 visible tiles). No dotted tile boundaries appeared in that terrain scene. This is not a claim of completed seed-by-seed main-game POI driving: the concurrent expanded network planner was still computing during this verification. Main-game approach grades, dock deck/land transitions, and facility foundations on unusually steep terrain still require whole-world checks.

### Latest road verification (2026-11-04; supersedes the percentage-only follow-up below)

- Implemented hard 6 m formation cut/fill constraints, dry-link grade rejection, full-width construction validation, sloping bridge decks with dry abutments, continuous junction ground and 18 m shoulder blending.
- Coupled terrain redesign is deliberate: old knife-edge mountains are replaced by lower broad highlands using a pre-drainage 6% neighbour-slope erosion envelope. This is **not** a claim to have retained the old mountain silhouettes or implemented tunnels. River carving and water stamps are corrected too.
- Seeds 1/2/3/7/42: every place connected, one continuous main road plus six outpost/five lookout branches. Actual construction/shoulder maximum differences: 3.856223365348974 / 3.824549007225677 / 4.900919569457477 / 3.464331917968309 / 5.604457495925743 m; maximum crossfalls: 5.033557257788886 / 5.85906391112232 / 5.732162439366206 / 7.264487995114166 / 5.687052629566267%. All generated classes covered.
- 53 focused tests and production build/typecheck pass, including explicit failure on an impassable artificial ridge. Browser highland inspection and five short Rapier driving samples completed. Full-network driving, detailed scenery/performance review, dramatic mountain restoration/tunnels and Sunrise exit redesign remain unfinished. See DECISIONS_LOG.md for methods and exact cut/fill extrema.

- No HTML in any output
- No emojis in any output
- SVG icons only when genuinely needed
- 2026-11-04 settlement expansion: connected local neighbourhoods now materially enlarge city/town/village footprints without enlarging the fixed-height core pads. Default-seed Fenwick grows from 20 to 101 buildings over a 1,317 × 800 m street envelope; Port Alder has 107, the two non-urban towns 31–41, and villages 15–17. Separate apartment, business-under-apartment and pitched-roof home streets share terrain/collision/loot IDs, map footprint and mountain-reservation data. Northern business door entry and shelf-to-inventory transfer are browser-verified. Upstairs/homes are exterior-only; planning cost and on-foot render budget still need further optimisation. See the latest decision-log entry for exact counts and honest envelope/performance limits.
- 2026-11-04 road follow-up: terrain-aware waypoint cleanup/rounding and bounded fitted access-road selection are implemented. Seeds 1/7/42 show 10–16% lower RMS earthworks, with regression checks and three isolated Rapier driving samples. Full-route driving, Sunrise's outside loop, deep mountain trenches/fills and local crossfall corrections remain **unchecked/incomplete**; see the numeric results and limitations in DECISIONS_LOG.md.
