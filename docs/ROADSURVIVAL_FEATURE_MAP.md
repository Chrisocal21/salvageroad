# Salvage Road (working title) — Feature Map

> A survival looter with a mobile base, built browser-first as its own separate project. Find a vehicle, loot towns, build the vehicle up, and drive across a quietly collapsed world between several refuges, collecting what you need to keep moving. The road itself is the point, with no fixed ending. Survive off the land with up to 4 players. Inspired by a game Chris just started playing; this one has its own vehicles, biomes, and a much deeper crafting and building layer.
> File names keep the early ROADSURVIVAL prefix. Nothing gets renamed or deleted.
> Tags: [stated] Chris said it. [agreed] Forge proposed it and Chris said yes. [proposed] Forge suggestion, not yet confirmed by Chris.

---

## Where This Stands (November 4, 2026)

This file is the EARLY plan, written before any code. The game has since moved on, and docs/SALVAGE_ROAD_CONCEPT.md is the current concept: where they disagree, the concept wins. Sections below are kept as written, with notes where reality has changed.

What changed since this was written:
- **Built and playable at localhost:3000:** a drivable El Cajon (Rapier physics, realistic feel), a 12 km generated island with rivers, lakes and desert, a desert start with the town hidden behind a dune, a town with walk-in stores, hunger and thirst, an HTML HUD, and a fly mode for testing.
- **The El Cajon is no longer found beat-up.** It is a rusty stripped shell in a junkyard, rebuilt from 18 loose pieces with a wrench. Its doors, hood and tailgate open, it has a passenger seat, and its bed is a 24 slot store that shows what is in it.
- **The pop-up bench was dropped as the core.** Base building from shipping containers took its place: containers are hauled by a big rig and flatbed trailer, and put down by hand in first person on a snap grid. The /base/ page is the builder sandbox.
- **Refuges became five traders** across the map, and a paid Steam release replaced "free browser game".
- **Next in the world:** a plan of places and two docks exists (not drawn yet). Roads, highways, dirt roads, trails and bridges are next, when Chris says. Trees and shrubs come after, from Chris's asset folders.
- Progress by item is in ROADSURVIVAL_PROGRESS_TRACKER.md. Every decision is in DECISIONS_LOG.md.

---

## The Idea

You start on foot in a town. You find a vehicle, loot the town, and build the vehicle up. Then you drive to the next location, scavenging scraps along the roadside, eating and drinking to survive, hunting and fishing for food, and doing quests. You can bring up to 3 friends.

**Core loop:** find, loot, build, drive, survive, repeat. Each stop leaves the player stronger and the vehicle more capable.

**Differentiators from the reference game:** [stated]
- Different vehicles
- Different biomes, with many differences
- More crafting and more building
- Deployable benches and unloading tables outside the vehicle: you pop them up, work on things, then pack them down

---

## The Story

**Working title: Salvage Road.** [stated] It fits the looting along the road and the traders who buy what you find. Can change later.

**The player drives across a ruined world to find traders and refuge.** [stated]

**What happened: a quiet collapse, not an explosion.** [agreed]
- The supply chains failed and the cities emptied out
- Most people left for organized refuges
- Nature is reclaiming the towns they left behind
- The player stayed behind, or got left
- Traders are the few people who still run the roads between refuges

**The refuges: several to visit and choose between.** [stated]
- There is no single final destination
- The player drives the distance between refuges
- Along the way the player collects what they need to keep moving
- Refuges take travelers in [agreed]

**The road itself is the point.** [stated]
- No fixed ending and no win state
- The journey is the game

**Tone** [agreed]
- Calm, a little lonely, suited to a long drive with music on
- Main threats are hunger, thirst, weather, and the distance itself
- No enemy AI is required at first; hostile survivors could be added later if wanted [proposed]

**How the story connects to the systems** [agreed]
- Hunting and fishing make sense because wildlife has returned
- Looting empty towns makes sense because the people are gone
- Traders exist because someone has to move goods between refuges
- The CDs are relics of the old world, found in abandoned cars and houses

**How it could connect to the structure** [proposed]
- The world is a network of refuges linked by long road legs, with generated towns and biomes in between
- The distance between refuges is the survival pressure: each leg needs food, water, and whatever keeps the vehicle running
- Each refuge has its own traders and character, so choosing where to go next matters
- Traders are the stops where you sell loot and buy what you cannot craft
- With no ending, long-term goals come from milestones tied to distance traveled, the research tree, and how far the vehicle can be built up

**Still undefined:** how many refuges there are and how they differ, what the vehicle needs to keep moving, and what traders do beyond buying and selling (see Open Questions)

---

## Platform, Camera, and Look

- **Browser first.** Chris originally wanted Unity, then chose to start in the browser instead. Unity may come later, not decided. [stated]
- **Separate from Chris's other games.** Its own project, its own repo, no shared code or foundation with any other game. [stated]
- **Performance target: a mid-range laptop.** [stated] Chris said "ordinary-ish, but mid range." The game should run well there, not only on a strong gaming PC. Exact specs not yet defined.
- **First person.** [stated] Fits looting, aiming a hunting weapon, and using the pop-up bench. It also saves player-model work in a solo browser build. Friends' character models arrive with co-op in Phase 3. [proposed]
- **Stylized realism.** [stated] Chris wanted more realistic over low-poly, and agreed on stylized realism as the level. [agreed]
  - Real proportions and believable materials, with simpler detail on the models
  - Not photoreal: a solo browser build cannot reach it, and heavier art takes performance from the terrain, loot, and vehicle physics
  - Strong lighting, fog, and color grading carry most of the realism at low cost [proposed]
  - Free texture sources such as Poly Haven for ground and surfaces, license checked before use [proposed]
  - One or two consistent asset sources, since mixed realistic styles look worse than one simple style [proposed]
  - Quality settings that can scale down, so the game stays playable on a mid-range laptop [proposed]

---

## The First Vehicle: the El Cajon

- **An original coupe-utility in the El Camino style.** [stated] A car-truck hybrid with an open bed, found beat-up in a town and brought back to life.
- **Name: El Cajon.** [stated] A generic name that avoids the real Chevrolet name and an exact copy of its body. A real professional should confirm before shipping. [proposed]
- **The bed carries the pop-up benches and tables.** [agreed]

**How its character could drive the upgrade loop** [proposed]
- It starts weaker than a pickup: smaller bed, lower ground clearance, less off-road ability
- Upgrades give those weaknesses a reason to exist: raised suspension, better tires, a bigger bed, bench mounts
- The first road leg needs to be forgiving, since low clearance makes rough roads harder
- More vehicles come in Phase 2

---

## Confirmed Features [stated]

**Vehicle**
- Found in a town, not given at the start
- Built and upgraded by the player
- Unloading tables and benches pop up and down outside the vehicle to repair, build, and craft

**Survival**
- Eating and drinking to survive
- Hunting animals for food
- Fishing
- Looting scraps from the side of the road while driving

**Progression**
- Level up
- Research points
- Unlock new things to build along the way
- Quests

**World**
- Generative towns and biomes, never a repetitive pattern, always random
- Several refuges to visit and choose between
- Collectible CDs found along the way, in different genres: 3 song CDs

**Players**
- Up to 4 players together on one adventure

---

## Tools [proposed, to verify before committing]

| Need | Tool | Why |
|---|---|---|
| Language and build | TypeScript + Vite | Chris's default stack |
| 3D rendering | Three.js | Free, browser 3D, already familiar from Supplyline |
| Vehicle and world physics | Rapier (chosen; cannon-es was compared and is kept only at /lab) | Needed for drivable vehicle feel |
| Textures | Free CC0 sources such as Poly Haven, license checked. So far the game draws everything procedurally (the rust is a shader); the shipping container model is the only imported asset, and its licence is unknown | Believable surfaces at no cost |
| Saves | Browser local storage (only the base is saved so far) | Single-player needs no backend |
| Tests | Vitest, including a simulated browser page for the HUD | Rules are plain TypeScript, so they test without a browser |
| Co-op rooms (Phase 3) | Cloudflare Workers with Durable Objects, to evaluate | Fits Chris's stack and room-code style joining |
| Deploy | Vercel | Static build, share by link |
| Version control | Git + GitHub | Always |
| Local dev | localhost:3000 | Always |

---

## Core Architecture Principles [proposed]

- **Separate game rules from visuals.** Inventory, crafting recipes, survival stats, and research tree live as plain TypeScript logic and data, testable without a browser.
- **Content as plain data files.** Items, recipes, animals, loot tables, refuges, vehicles, and research nodes are data, not code. Adding content stays cheap, and the design and data survive a later move to Unity.
- **Seed-based generation.** Every town, biome, and road leg comes from a seed. Random every run, but reproducible for debugging and for friends joining the same world.
- **Build for 4 players from day one, ship single-player first.** The host owns world state from the start so co-op does not force a rewrite.
- **Watch browser performance from Step Zero, against a mid-range laptop.** Large generated terrain, many lootable objects, and vehicle physics compete for the same budget. Measure early, and set a limit on model and texture size.

---

## Step Zero — Prove the Loop

**Goal:** prove the stop-and-work rhythm feels good with rough placeholder art. Driving, looting, and the pop-up bench are the three things everything else depends on.

- One drivable El Cajon with feel-good physics (done)
- One small generated stretch of terrain and one generated town (done; the terrain is now a 12 km island)
- Walk in first person, loot containers, carry items (done)
- Enter and exit the vehicle (done)
- Deploy a bench from the bed, craft one thing, pack it away (NOT built: base building from shipping containers replaced it)
- A hunger meter that creates a reason to stop (done, with thirst)
- A quick browser performance check with generated terrain and loot, judged against a mid-range laptop (done at 300 props: 144 fps; not re-measured since the world grew)

Step Zero held up and the project moved past it. The first stages are written up in ROADSURVIVAL_STEP_ZERO_HANDOFF.md for the coding Claude.

---

## Phase 1 — Single-Player Vertical Slice [proposed]

**Goal:** one complete road leg from a starting town to a first refuge, playable start to finish.

- Find and claim a beat-up El Cajon in a town
- Town loot with a simple loot table
- Vehicle repair and a small set of upgrades at the bench
- Hunger and thirst
- One biome besides the starting one
- Roadside scrap pickups while driving
- One simple refuge at the end of the leg with a trader: sell loot, buy one thing
- Lighting and color grading pass so the slice already looks like the final direction
- Save and load

**Not in Phase 1:** multiplayer, research tree, fishing, full quest system, CDs, more than one refuge, more than one vehicle.

---

## Phase 2 — Core Loop

**Goal:** the survival and progression systems that make a long run worth playing.

- Hunting: a few animals, a weapon, aiming, meat and hides
- Fishing
- Cooking and food items
- Full crafting tree across benches
- Levels, research points, research tree gating what can be built
- Quest system
- Several refuges with their own traders, and the choice of where to drive next
- Distance milestones as the long-term goal
- Weather as a survival pressure
- More biomes
- More vehicles beyond the El Cajon

---

## Phase 3 — Co-op

**Goal:** up to 4 players in one world.

- Networking approach chosen and proven
- Character models for other players, seen from first person
- Shared vehicle with seats and roles
- Shared and personal inventory rules
- Join by invite or code, same seed for everyone
- Syncing benches, loot, and world state

---

## Phase 4 — Depth and Polish

- Refuge variety: each refuge feels different
- CDs: 3 song CDs in different genres, collectible, playable in the vehicle, found as relics of the old world
- More generative variety in towns and biomes
- Real art pass, one asset category at a time, within the stylized realism direction
- Sound and audio pass
- Decide whether to stay in the browser or also build a Unity version

---

## Things Considered and Set Aside

| Idea | Why It Was Set Aside |
|---|---|
| Unity first | Chris chose browser first; faster to share and iterate. Unity stays a possible later step |
| Sharing a foundation or code with Chris's other games | Chris wants this project fully separate |
| Building multiplayer first | Networking before the single-player loop is fun means debugging two hard problems at once |
| All biomes and all vehicles at launch | Content multiplies cost; prove one of each first |
| Copying the reference game's names, art, or assets | Mechanics are fair game, specific assets and names are not |
| A harsher world with constant real danger | Chris chose the quiet collapse |
| One final refuge as the ending | Chris chose several refuges to visit and choose between |
| A fixed ending or win state | Chris chose the road itself as the point |
| Third person camera | Chris chose first person |
| Stylized low-poly art | Chris wanted more realistic |
| Photoreal art | Too heavy for a solo browser build; stylized realism chosen |
| Targeting a strong gaming PC only | Chris chose a mid-range laptop as the performance target |
| A generic rugged pickup as the first vehicle | Chris chose an El Camino-style coupe-utility instead |
| The real Chevrolet El Camino name and exact body | Brand and likeness risk; original design with a generic name chosen |
| Other title options: Far Haven, Safe Passage, Last Stop, Long Way Home | Salvage Road chosen; the others stay in reserve |

---

## Ideas in the Backlog

- Hostile survivors or raiders as an optional later threat
- More CD genres beyond the first three
- Vehicle customization looks (paint, decals)
- Base-camp mode, parking and expanding a permanent camp
- Day and night effects on survival

---

## Build Rules

- No HTML in any output
- No emojis in any output
- SVG icons only when genuinely needed
