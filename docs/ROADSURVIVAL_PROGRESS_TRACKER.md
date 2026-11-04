# Salvage Road (working title) — Progress Tracker

> File names keep the early ROADSURVIVAL prefix. Nothing gets renamed or deleted.
> Where this file and docs/SALVAGE_ROAD_CONCEPT.md disagree, the concept file wins. Details of every build decision are in DECISIONS_LOG.md at the project root.

---

## Salvage Road

**Overall progress:** 44% (36 of 81 items below are done). This counts items, not effort: the untouched later phases are many items of very different size.
**Last updated:** November 4, 2026
**Status:** Active. Playable in the browser at localhost:3000. Nothing is committed to git yet. 176 tests, 175 pass; the one failure is an old comparison test for the cannon-es physics library, which the game does not use.

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
- [x] Shipping container base builder prototype at /base/ (snap grid, stacking, support rule, pillars, build menu)
- [x] Real container model with level of detail
- [x] Put containers down from the truck in first person (U): ghost, snapping, support rules, pick back up
- [ ] Containers lying in the world to haul away (one stands in the junkyard; the docks and other sites are still to come)
- [ ] Big rig, flatbed trailer, hauling and loading containers
- [ ] Floors, walls, stairs, doors and windows for the base

#### World
- [x] 12 km island generator: land, rivers, lakes, ocean, desert (viewer at /world/)
- [x] One game: wake in the desert, town hidden behind a dune, fly mode (G), quick jump to town (J)
- [x] Detailed ground you can walk and drive on (tiles that get finer near you)
- [x] Plan of places and two docks for any island (src/rules/places.ts; a plan only, nothing drawn)
- [ ] Roads, highways, dirt roads, trails and bridges (waiting for Chris's go-ahead)
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

---

## What to Tackle Next

- [ ] Chris's go-ahead for the world's roads, highways, dirt roads, trails and bridges (the places and two docks are planned; roads were prototyped and set aside on purpose)
- [ ] Draw the places in the world: the other towns, the city, the docks, the industrial yard
- [ ] Trees, shrubs and ground textures from the asset folders (licences to check first)
- [ ] Confirm how many shipping containers there should be across the map (Claude recommends about 150)
- [ ] Decide: should parts be found outside the junkyard, and does the truck need fuel
- [ ] Save the game (truck rebuild, inventory, loot)

---

## Build Rules

- No HTML in any output
- No emojis in any output
- SVG icons only when genuinely needed
