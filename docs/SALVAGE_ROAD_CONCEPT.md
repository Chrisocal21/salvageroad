# Salvage Road: Concept

Written 2026-11-04 in a planning chat with Chris. This is the game concept in one place. It REPLACES parts of the earlier ROADSURVIVAL feature map, tracker and handoff. Where they disagree, this file wins.

Tags: **[stated]** Chris said it. **[agreed]** proposed and Chris said yes. **[proposed]** not confirmed, ask before building. **Open** means undecided, ask Chris.

## Where the build stands (November 4, 2026)

Playable at localhost:3000 (the builder sandbox is /base/, the world viewer is /world/). Details in DECISIONS_LOG.md, progress in docs/ROADSURVIVAL_PROGRESS_TRACKER.md.

Built:
- A 12 km generated island: land, rivers, lakes, ocean, a desert round the start, mountains inland.
- The opening: wake in the desert, the town hidden behind a dune, walk in, find food and water in boxes and walk-in stores, find the El Cajon in a junkyard in pieces.
- The El Cajon: a rusty shell rebuilt from 18 loose pieces with a wrench, with doors, hood and tailgate that open, a driver and a passenger seat, and a 24 slot store in the bed that shows what is in it.
- Hunger and thirst, an inventory, an HTML HUD, a fly mode and a jump-to-town key for testing.
- Shipping containers: a real model, a snap grid with a support rule and pillars, and putting them down by hand from a truck in first person. One container stands in the junkyard.
- A plan of places for any island: a city, towns, villages, an industrial yard, outposts, lookouts and two docks far apart. Not drawn in the game yet.
- A road network plan for any island: highways join the city, towns, industrial yard and docks, roads join the villages, dirt roads the outposts, trails the lookouts, with bridges over water. Drawn in the /world/ viewer; the game world does not level or use it yet.

Roads and water (added): one road style (10 m wide, one grey) joining every place, smoothed into long straight runs and bends, meeting the starting town along its own streets and meeting each other in T intersections; the coast and river edges are smooth and no longer change with the camera angle.

Not built yet: loading a container onto the truck from the yard or docks (press U to unload only works once cargo is on the truck); lane markings; the other towns and the docks drawn in the world; the big rig and the flatbed trailer; hauling containers from the world; fuel; restoring the paint; trees and shrubs; traders, hunting and the CDs; saving the game (only the base is saved); co-op.

## The game in one line

A lone mechanic rebuilds a wrecked truck, drives into an emptied world for parts and supplies, and brings them home to a base the player designs and grows without limit. [agreed]

## What kind of game this is

- Touchstones: Deadside-ish, Vein-ish, mechanic sim, container home building, hunting sim, ranch sim, Nomad Drive. [stated]
- Sandbox. The player plays how they want and builds where and how they want. [stated]
- A paid Steam game. [stated]
- Browser first, wrapped in Electron later for Steam. The wrap is a late step and should not change what is built now. [agreed]
- Performance target: a mid-range laptop (test machine: Ryzen 5 7535HS, integrated Radeon). [stated]

## The player

- A military mechanic, out of the service for years. Always alone; the collapse only removed everyone else. [stated]
- NO starting home. The old off-grid container home is removed. [stated]
- Starts on foot, hiking a road from nowhere toward a town. Why he is on that road is a mystery revealed slowly. [agreed]
- First person camera on foot. [stated]

## The world and tone

- A quiet collapse. Cities emptied, nature reclaiming the towns. [stated]
- Calm and a little lonely. Threats are hunger, thirst, weather and distance. No enemy AI at first. [agreed]
- Cause of the collapse stays mostly unexplained: notes, radio fragments, the CDs. [proposed]
- 3 song CDs in different genres, found in abandoned cars and houses. Needs a commercial-use license. [stated, licensing open]
- Art: stylized realism. Not low-poly, not photoreal. [stated]

## The opening

1. The player walks a road into a town. [stated]
2. They find a scrapped El Cajon. It is a dump: none of the parts are on the vehicle. [stated]
3. They gather parts, repair parts, and build the vehicle up piece by piece. [stated]
4. They find gas. [stated]
5. They drive out to search more towns and cities, hunting along the way. [stated]

The El Cajon is an original El Camino-style coupe-utility with a generic name. [stated]

## The two goals

1. Build a home base. The main goal. [stated]
2. Find new vehicles. The second goal. [stated]

## The home base

- Built from shipping containers, anywhere the player chooses, made their own. [stated]
- Snap-to-grid. Containers snap together and stack in any arrangement: offset, rotated, overhanging, bridged. [agreed]
- Thousands of combinations from many simple rules, not free-form placement. [agreed]
- Support rule: may overhang generously, cannot float with nothing under it. No full physics per box. [proposed]
- Functional: storage, crafting benches, power and water, a garage for the fleet. [agreed]

Inspiration from reference photos (not a commitment to build all at once): cantilevered and offset floors, walkways and bridges; courtyards, L and U shapes, fenced compounds with a watchtower; pitched, glass, and flat solar roofs; rust, wood, stone, stucco skins; cut doors, glass walls, decks; pool, garden, vehicle parking.

## The fleet

- The player keeps every vehicle they find and fix, at the base. [stated]
- Each vehicle has a different job that helps the player. [stated]
- What each vehicle's job is: open.

## Traders

- Five traders across the map, each buying and selling different things (compared to Vein and "No one survived"). [stated]
- Who buys and sells what: open.

## Hunting and survival

- Hunting animals for food while travelling through deserted towns and cities. [stated]
- Eating and drinking to survive. [stated]
- Fishing and other earlier-list items are wanted but not scheduled. [agreed]
- Ranching at the base: open.

## Co-op

- Up to 4 players long-term. Build network-ready, ship single-player first. [agreed]
- Steam networking to be evaluated later.

## What this changes for the build (all proposed, need Chris's go-ahead)

- Base building is the core system, larger than the pop-up bench. The bench is still a useful first step toward it.
- Container building needs an early prototype: snap grid, stacking, support rule, performance with many containers.
- Home, Road, Return loop: a base the player grows between trips, trips that bring back parts, supplies and vehicles.
- The very detailed procedural El Cajon will not scale to a fleet. Later vehicles need a model budget.
- Solo paid release path: playable slice, free demo or Steam page to gauge wishlists, then Early Access. Not confirmed.

## Differences from the earlier ROADSURVIVAL files

- No old container home to leave and return to. The player starts from nowhere and builds anywhere.
- Home base is goal one. Earlier files treated a pop-up bench as the core mechanic.
- Five traders instead of "several refuges". How they relate is open.
- The El Cajon is a wreck with no parts, not found beat-up.
- "Free browser game" is out. Target is a paid Steam release.
- Work already built still stands.

## Open questions

(The full running list, with the ones answered since, is in ROADSURVIVAL_OPEN_QUESTIONS.md.)

- Why is he on the road at the start?
- What does each fleet vehicle do, and which exist?
- What does each of the five traders buy and sell?
- Is there ranching at the base?
- What does a vehicle need to keep moving: fuel, parts, or both?
- Long-term pull beyond base and fleet (base and fleet are enough for now).
- Should an empty hunger bar hurt or kill the player?
- Driving camera: cockpit, chase, or switchable.
- Gamepad support.
- Release plan, art budget, how the 3 CDs are made or licensed.
- Does the name "El Cajon" clash with anything? A professional should confirm before shipping.

## Working with Chris

- Solo developer with ADHD, the idea guy. Relies on AI for implementation but wants control.
- Short replies. One question at a time. No walls of text. No emojis.
- Small steps. Commit small. Stop at the end of each stage with a summary under 10 lines and wait for the go-ahead.
- Keep DECISIONS_LOG.md for anything decided that Chris did not specify.

## Update: story and moving containers (Chris, 2026-11-04, later the same day)

This REPLACES the build-menu idea for containers. Where it disagrees with the sections above, this wins.

- The player finds the El Cajon and fixes it up. [stated]
- They drive around collecting things and see shipping containers all over the map. [stated]
- They come across a tow truck for oversize vehicles, and fix it up too. [stated]
- With the tow truck they move shipping containers to the compound site. The player moves containers into place by hand, not from a build menu. [stated]
- Chris's reason: this makes the game far more original. [stated]

What this means (Claude's reading, to confirm with Chris):
- Containers become real objects in the world that exist before the player does anything, not items picked from a menu.
- The tow truck is the second vehicle and the key to goal one (the base). It also fits goal two (find new vehicles) and gives the fleet a first clear job: the El Cajon fetches small things, the tow truck hauls containers.
- Home, Road, Return gets sharper: scout containers on the road, fix the tow truck, haul them home, build the compound one container at a time.
- Still to decide: whether the grid snapping and support rules (the work already built) stay as the way a dropped container settles into place. Claude recommends yes.
- Still to decide: what pillars and other structure (floors, stairs, doors) are, now that containers are not in a menu.

## Update: the world is the world, and the full progression (Chris, 2026-11-04, evening)

This REPLACES the tow truck with a big rig and a flatbed trailer, and replaces the "found a base" idea with a long stretch of life on the road. Where it disagrees with sections above, this wins.

The world:
- The world is the world: cars broken down all over it, and not all of them can be used. [stated]

The progression:
1. The player finds the El Cajon and fixes it, then loots and drives around with no home base. [stated]
2. They find car parts and tools and gather them. [stated]
3. They eventually find a broken-down big rig and fix it. Still no home base. [stated]
4. They can leave either vehicle on the side of the road, and it stays there. A parked vehicle can be used as storage. [stated]
5. They find a flatbed trailer, fix its tires, and hook it to the big rig. [stated]
6. They find the docks, where they loot containers and load them onto the truck one at a time. [stated]
7. They place the containers wherever they want, to build out their compound. [stated]

Decision on order of work: the WORLD first, one piece at a time. Chris says "next" to move to the following piece. [stated]
- Piece 1: land mass, waterways, ocean. (Docks later need a coast, rivers and lakes shape where towns and roads go.)
- Pieces after that are Chris's to call. Likely candidates, not agreed: terrain detail and biomes, roads and towns, broken-down vehicles and wrecks, the docks, vegetation.

Open questions this raises (not decided, nothing built):
- How a parked vehicle works as storage (open its trunk or bed? limits?).
- How a trailer hooks to the rig, and how heavy the rig and trailer drive.
- How containers are lifted onto the trailer at the docks (by hand in a placing mode, like unloading, or with a crane).
- Which broken vehicles are usable and which are scenery, and what a usable one needs to be fixed.

## Update: the start, the wreck, and restoring it (Chris, 2026-11-04, night)

- The player starts in the DESERT biome and walks into the town, where they find the El Cajon to begin the game. [stated]
- The El Cajon is found with its paint removed and a rusted look, to fit the play. [stated]
- Restoring the paint is a gameplay step: once the truck is 100 percent fixed up, and after finding the tools and the paint, the player grinds it, paints it and buffs it. [stated]
- Everything is brought together into one game so it can all be tested together, with a fly mode for testing. Once the world is good, the next pieces are roads, cities, towns and homes, and industrial areas. [stated]

Open questions this raises (not decided, nothing built):
- Which tools and how much paint, and where they are found (a grinder, sander, buffer, paint cans?).
- Whether each panel is done separately (grind, then paint, then buff), or the whole truck at once.
- What fixing the truck "100 percent" means: which parts, and how the player sees progress.

## Update: waking up, the first town, the junkyard (Chris, 2026-11-04, late night)

- The player wakes up in the desert. The town is NOT in view at the start: it is hidden behind a small hill near the player, who has to move around to see it. [stated]
- The player heads to the nearest town and finds water and food in boxes and in some of the store fronts. [stated]
- The El Cajon is found in a junkyard in the town, with its parts separated; the player assembles it. [stated]
- After this: more towns, the docks somewhere on the map, connected by highways and roads, with dirt roads here and there. [stated]

What was built (details in DECISIONS_LOG.md): a dune hides the town from the start; walk-in markets and hardware stores with shelves; a fenced salvage yard with the El Cajon on blocks and 11 parts to carry over and bolt on with a wrench from the yard's toolbox. [proposed, built for review]

Open questions (not decided):
- Should some parts be found elsewhere (in town, in other wrecks) rather than all in the junkyard?
- Does the rebuilt truck need fuel to run?

## Update: the truck, how it is rebuilt and how it is used (Chris, 2026-11-04)

How it is rebuilt. [stated]
- The El Cajon is found stripped and rusty in the junkyard, with its parts lying about. More pieces than the first few: the dash and the steering wheel are parts too, and so are the doors.
- The four tyres lie in one stack in the yard, not scattered. Only the top one can be taken.
- The hood can be put on at any time, before the engine, and then opens, so replacing motors and parts never needs it taken off.
- Built as 15 kinds of part, 18 pieces in all: engine, battery, hood, 4 wheels, bench seat, front and rear bumper, tailgate, dashboard, steering wheel, windshield, driver's door, passenger door, grille, headlights. Everything is bolted on with a wrench from the yard's toolbox. The dashboard goes in before the steering wheel, windshield and doors; the doors also need the seat; the grille needs the engine and the headlights need the grille.

How it is used. [stated]
- Where you stand decides what E does: the driver's door to get in and drive; the passenger door to ride only, with a key to switch to the driver's seat; the hood to open it; the bed to open the truck's storage.
- In the car, as driver or passenger, Tab opens your inventory and the vehicle's inventory.
- The doors and the tailgate open. Things stored in the bed show in the bed: tyres and motors as themselves, and a bunch of small things as a crate of supplies.
- Before the truck is whole, a fitted door can be opened and left open to reach the inside.

The big rig tyre. [stated]
- A big rig tyre lies in the yard: too big for the El Cajon, but it can be picked up and stored. Something tells the player to keep it; whether they do is their call. It is for the big rig later.

Claude's choices, to confirm with Chris (details in DECISIONS_LOG.md):
- C switches seats. A door that is used by the finished truck swings open by itself and shuts again.
- With the hood on and shut, the engine and battery cannot be fitted until it is opened. Carrying one to the nose and pressing E opens the hood first.
- The bed holds 24 stacks; the pack holds 12. Four different kinds of small thing or more become a crate. The bed has six places drawn, and the rig tyre takes a row of two.
- Tyres and motors turn up in dumpsters for now.

Open:
- Should some parts be found elsewhere than the junkyard? Does the truck need fuel to run?
- What is under the hood to use? Can goods fall out of the bed, and is there a cab store?
- Where tyres and motors are found for real (stripping wrecks?).
- How a vehicle left by the road works as storage, and storage on the big rig.

## Update: the yard container and planning the world's places (Chris, 2026-11-04)

- One shipping container stands in the junkyard, to come back and haul later, like those at the docks and similar places round the map. [stated]
- Next for the world: highways, roads, dirt roads, trails, bridges, docks (two at least), cities and towns. [stated] The order is the places and docks first, and roads and highways only when Chris says. [stated]
- Built so far: a plan of places for any island: a city, three more towns beside the starting one, villages, an industrial yard, outposts, lookouts for trails to climb to, and two docks far apart. It is a plan only: nothing in the game draws it yet.
- Open: how many shipping containers across the map (Claude recommends about 150: around 50 at each dock, 30 in industrial and town yards, 15 near roads, 1 in the junkyard); what each kind of place holds; whether containers differ by place.
