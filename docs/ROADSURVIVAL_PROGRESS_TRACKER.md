# Salvage Road (working title) — Progress Tracker

> File names keep the early ROADSURVIVAL prefix. Nothing gets renamed or deleted.
> Where this file and docs/SALVAGE_ROAD_CONCEPT.md disagree, the concept file wins. Details of every build decision are in DECISIONS_LOG.md at the project root.

---

## Salvage Road

**Overall progress:** 46% (38 of 82 items below are done). This counts items, not effort: the untouched later phases are many items of very different size.
**Last updated:** November 4, 2026

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
