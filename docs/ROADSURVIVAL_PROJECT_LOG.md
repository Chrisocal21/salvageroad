# Salvage Road (working title) — Project Log

> File names keep the early ROADSURVIVAL prefix. Nothing gets renamed or deleted.

---

## Salvage Road -- Session 4 -- 2026-11-04

**Status:** Active. Written by the coding Claude from DECISIONS_LOG.md; the concept itself is in docs/SALVAGE_ROAD_CONCEPT.md.

---

### What We Decided

- A new concept replaced parts of the early plan: the player is a lone mechanic with no home, rebuilds a wrecked truck, hauls shipping containers from the docks with a big rig and flatbed trailer, and builds a compound anywhere. Paid Steam game, browser first, wrapped in Electron later
- The pop-up bench is no longer the core mechanic. Base building from shipping containers is
- Containers are not placed from a build menu. They are moved by hand: pull up, press U, aim in first person, see a ghost of where it lands, click. Dropped containers snap to a grid with a support rule and pillars
- The tow truck became a big rig plus a flatbed trailer. Vehicles can be left by the road and used as storage
- The world comes first, one piece at a time, and Chris says "next" between pieces
- The player wakes in the desert. The town is hidden behind a small hill, so they have to move to see it. Food and water are in boxes and in some store fronts
- The El Cajon is found in a junkyard in the town, rusty and stripped, with its parts lying about. The player puts it back together. Restoring the paint (grind, paint, buff) is recorded but not built
- Fly mode for testing. Doors, hood, tailgate and a passenger seat. Storage in the truck bed that shows what is in it, becoming a crate of supplies when there is a lot
- Tyres stacked in the yard. A big rig tyre to find and keep (the game tells the player to keep it)
- One shipping container stands in the junkyard, to haul later. Two docks at least. Roads, highways, dirt roads, trails and bridges come after the places, and only when Chris says

---

### What Was Learned

- zombiesiege is a completely different game: nothing is taken from it
- A base built on the /base/ test page showed up in the game because both used one browser save. They now have separate saves, and the game always starts with no containers
- The truck's doorway showed stray trim after the doors opened. Three separate pieces had to move with the door (the belt crease and mirror, the top cap, and the body's top shoulder). Colouring each group a different colour showed which piece was left behind
- Chris prefers to see a thing look wrong and say so; the log of fixes is in DECISIONS_LOG.md

---

### What Changed

- Built: the shipping container builder (/base/), the real container model with level of detail, first-person unloading in the main game, a 12 km island generator with rivers, lakes and desert (/world/), detailed walkable and drivable ground, one game with the desert start and hidden town, walk-in stores, the rusty El Cajon in a junkyard rebuilt from 18 pieces, doors and hood and tailgate that open, passenger seat, bed storage with visible load, the big rig tyre, one yard container, and a plan of places and two docks
- Not built: roads and highways (a prototype was written, set aside at Chris's request, and kept outside the project), the big rig, the trailer, hauling containers, fuel, saving the game, trees and shrubs
- The earlier tracker, feature map and handoff were out of date. They are updated in this session

---

### Open Questions Added

- How many shipping containers across the map (about 150 is recommended)
- Should some truck parts be found outside the junkyard, and does the truck need fuel
- Where tires and motors really come from
- What is under the hood to use, and whether goods in the bed can fall out
- Which tools and how much paint are needed to restore the paint
- What each fleet vehicle is for, what each trader buys and sells, whether there is ranching
- Where the container model, the trees and the other assets in Chris's folders came from, and their licences

---

### Open Questions Closed

- Physics library: Rapier
- Canvas or HTML for the HUD: HTML
- How the driving should feel: realistic, not arcade
- Single-player first or co-op first: single-player first, built for co-op
- Free browser game or paid: paid Steam release
- Whether a pop-up bench is the core: no, base building is
- How containers get placed: by hand from a truck, snapped to the grid, with the support rule
- Whether dropped containers follow the grid and support rules: yes

---

### Progress Updates

- Overall about 44% of the tracker's items. Pre-production 11 of 11. Step Zero 7 of 8 (no bench, by design)
- 176 tests, 175 pass. The one failure is the old cannon-es ramp comparison, not used by the game

---

### Documents Updated

- ROADSURVIVAL_PROGRESS_TRACKER.md — rewritten to match what is built
- ROADSURVIVAL_PROJECT_LOG.md — sessions 3 and 4 added
- ROADSURVIVAL_OPEN_QUESTIONS.md — answered, still open, and new
- ROADSURVIVAL_FEATURE_MAP.md — status note and tools
- ROADSURVIVAL_STEP_ZERO_HANDOFF.md — status note
- SALVAGE_ROAD_CONCEPT.md — where the build stands, and the late updates tidied
- DECISIONS_LOG.md — a current-state summary at the top
- ASSET_LICENSES.md — unused asset folders noted

---

### Next Session

Chris's call: roads, highways, dirt roads, trails and bridges, or drawing the places in the world, or trees and shrubs from the asset folders. Confirm the container count first.

---

## Salvage Road -- Session 3 -- 2026-11-02

**Status:** Active. Written by the coding Claude from DECISIONS_LOG.md.

---

### What We Decided

- The test machine is the dev laptop: Ryzen 5 7535HS, 31 GB RAM, and the integrated Radeon in the browser (the RX 6550M is not used unless Chrome is pointed at it)
- Physics library: Rapier. Chris drove both libraries; Rapier cleared the ramp and the cannon-es comparison stays only at /lab
- Driving feel: realistic, like a real car. WASD to drive, Space is the handbrake
- The HUD and menus are HTML drawn over the canvas, behind one small interface so it can be swapped later
- The repo layout: src/rules for plain game rules, src/render for Three.js, src/data for content as data, src/ui for the HUD, tests, docs

---

### What Was Learned

- The cannon-es truck stopped randomly because of an infinite ground plane, not the library. Swapping it for a big flat box fixed it
- The truck bounced because Rapier's default suspension damping was far too low for it. Raised, with a test to guard it
- The whole world seemed to shake at top speed because physics runs at 60 steps a second while the screen draws 144. The truck is now drawn blended between physics steps, and the camera is rigidly attached
- On the integrated Radeon the scene held 144 fps at 4 times the pixels and dropped to 80 fps at 9 times, so there is roughly five times spare GPU room at 1080p. That is an upper bound for plain scenes, not a promise once real art arrives
- A much more detailed truck model appeared on disk that Claude did not write; it was kept

---

### What Changed

- Built in order: the repo and toolchain, the physics comparison, the drivable El Cajon with mouse look, a generated 400 m terrain and 300 props with a performance run (B), a generated town with lootable containers, first-person walking, enter and exit the truck, a 12 slot inventory, the HTML HUD (crosshair, prompts, toast, inventory panel, speedometer), and hunger and thirst with F to eat and Q to drink
- Nothing lethal: an empty bar only slows walking

---

### Open Questions Added

- Should an empty hunger bar hurt or kill the player

---

### Open Questions Closed

- Which physics library: Rapier
- Canvas or HTML for the HUD: HTML
- What machine counts as the mid-range laptop: the dev laptop above
- Keyboard layout: WASD, Space (a gamepad is still open)
- How heavy the driving should feel: realistic

---

### Progress Updates

- Pre-production 11 of 11. Step Zero stages 1 to 6 built; the bench was never built

---

### Documents Updated

- DECISIONS_LOG.md — created, with the physics comparison and every stage

---

### Next Session

Chris brings a new concept (see Session 4).

---

## Salvage Road -- Session 2 -- 2026-11-01 (ran past midnight into 2026-11-02)

**Status:** Active

---

### What We Decided

- Browser first instead of Unity. Unity may come later, not decided
- Fully separate from Chris's other games: own project, own repo, no shared code or foundation
- Working title: Salvage Road
- Story direction: the player drives across a ruined world to find traders and refuge
- The world ended in a quiet collapse: supply chains failed, cities emptied, most people left for organized refuges, nature is reclaiming the towns, and the player stayed behind or got left
- Traders are the few people who still run the roads between refuges
- Tone is calm and a little lonely, suited to a long drive with music on
- Main threats are hunger, thirst, weather, and distance; no enemy AI at first
- The CDs are relics of the old world, found in abandoned cars and houses
- Several refuges to visit and choose between, not one final destination. The player drives the distance between them and collects what they need to keep moving
- No fixed ending: the road itself is the point
- First person camera
- Art direction: stylized realism. Real proportions and believable materials, simpler model detail, strong lighting and color grading
- First vehicle: the El Cajon, an original coupe-utility in the El Camino style with a generic name
- Performance target: a mid-range laptop ("ordinary-ish, but mid range")
- A Step Zero handoff brief was written for the coding Claude in VS Code

---

### What Was Learned

- Chris wanted to prove the idea in the browser before committing to a heavier engine
- A Forge suggestion to build on another game's foundation was wrong for this project. Chris wants it separate
- Chris wants the name to follow the plot, so the story had to be settled first
- Chris handed the plot call to the Forge when he had no answer ready, then approved the quiet collapse straight away
- Chris overrode the Forge's lean toward one final refuge, choosing several instead. That makes the game a journey between hubs more than a trip toward an ending
- Chris confirmed the Forge's lean on the ending: no ending, the road is the point. This fits his earlier picture of a long drive with music on
- Chris accepted the Forge's recommendation on the camera without changes
- Chris overrode the Forge's low-poly lean and wanted more realistic. The Forge pushed back on photoreal for a solo browser build, and Chris settled on stylized realism
- Chris overrode the Forge's generic pickup lean with a more distinctive choice, an El Camino-style coupe-utility. The real name and exact body carry brand risk, so he chose a generic name, El Cajon
- Chris accepted the mid-range laptop target, nudging it slightly toward "ordinary", which makes the stylized realism and performance budget tighter
- An earlier version of the open questions assumed Chris has no art budget. That was carried over from another project and was never confirmed for this one. It has been corrected and left open
- Chris asked where the other markdown files were. They had been saved in the project's claude folder under the early ROADSURVIVAL prefix, which is easy to miss

---

### What Changed

- Platform: Unity became browser first. Tools now TypeScript, Vite, Three.js, a physics library to evaluate, Vercel
- Removed Unity-specific setup from pre-production; added physics library choice and a browser performance check to Step Zero
- Phase 4 now includes deciding whether to also build a Unity version
- Project renamed in the documents from the placeholder to Salvage Road (working title). File names unchanged
- Added a Story section to the Feature Map
- One final refuge became several refuges. Phase 1 now ends at a first refuge with a trader; Phase 2 gains several refuges and the choice of where to drive next; Phase 4 gains refuge variety
- Added weather and distance milestones to Phase 2
- Removed the ending decision from Phase 4 and moved "a fixed ending or win state" to the set-aside list
- Added a Platform, Camera, and Look section; Step Zero now says first person; Phase 3 gains character models for other players
- Third person, low-poly, and photoreal moved to the set-aside list
- Phase 1 gained a lighting and color grading pass so the slice looks like the final direction from the start
- Tools table gained a free textures row, license check required
- Added a First Vehicle section for the El Cajon. Step Zero and Phase 1 now name it; Phase 2 says more vehicles beyond it. Generic pickup and the real Chevrolet name moved to the set-aside list
- Added the mid-range laptop target to the Feature Map, Step Zero, and the architecture principles. Targeting a strong gaming PC only moved to the set-aside list
- Created ROADSURVIVAL_STEP_ZERO_HANDOFF.md with five stages for the coding Claude, and updated it with the performance target

---

### Open Questions Added

- Which physics library for the vehicle
- Will a Unity version come later
- Free browser game, paid, or both, and where it is hosted
- What gives players a long-term goal on a road with no ending
- How many refuges, and how do they differ
- What the vehicle needs to keep moving
- What the choice between refuges affects
- What traders do beyond buying and selling
- Should hostile survivors ever appear
- Is there an art budget, and where will assets come from
- Does the name El Cajon clash with any existing vehicle or product
- How weak the El Cajon starts and what its upgrade path is
- What exactly counts as a mid-range laptop and what machine Chris tests on
- Should the game's menus and HUD be drawn on the canvas or built from HTML
- Driving camera: cockpit, chase, or switchable

---

### Open Questions Closed

- Engine or platform: browser first
- Shared with other games: no, separate
- Name: Salvage Road, working title
- Where the player is going: traders and refuge
- What happened to the world: a quiet collapse
- Tone and threats: calm, lonely, hunger and weather and distance
- What the CDs are: relics of the old world
- One refuge or several: several
- Does the journey have an ending: no, the road itself is the point
- First or third person: first person
- Art direction: stylized realism
- First vehicle: the El Cajon
- What the game should run on: a mid-range laptop

---

### Progress Updates

- Pre-production now 9 of 11 done (working title, world story, refuges, no ending, first person, art direction, first vehicle, performance target, handoff brief). Remaining: vehicle physics approach and the separate repo, both of which happen in the handoff

---

### Documents Updated

- ROADSURVIVAL_FEATURE_MAP.md — platform, camera, and look, performance target, first vehicle, story section, refuges, no ending, tools, architecture notes, phases
- ROADSURVIVAL_PROGRESS_TRACKER.md — pre-production, Step Zero, next steps, log rows
- ROADSURVIVAL_OPEN_QUESTIONS.md — answered and open lists
- ROADSURVIVAL_STEP_ZERO_HANDOFF.md — created, then updated with the performance target
- ROADSURVIVAL_PROJECT_LOG.md — this entry

---

### Next Session

Hand the Step Zero brief to the coding Claude in a new empty VS Code folder. Come back with the physics comparison and a go or no-go on how the El Cajon drives.

---

## Salvage Road -- Session 1 -- 2026-11-01

**Status:** Active

---

### What We Decided

- New project: a survival looter with a mobile base, opened as a real project with production starting soon
- Inspired by a game Chris just started playing, with different vehicles, different biomes, and far more crafting and building
- Core loop: find a vehicle in a town, loot, build the vehicle, drive to the next location, scavenge, eat and drink, hunt, fish, do quests
- Benches and unloading tables pop up outside the vehicle and pack away again
- Up to 4 players on one adventure
- Level up, research points, and unlocks for what you can build
- Generative towns and biomes, always random
- Collectible CDs in different genres, 3 song CDs
- Engine at this point: Unity (changed in Session 2)

---

### What Was Learned

- Chris wants this as a real production project, not an Inbox idea
- The idea grew over the session from "drive and craft" to a full survival looter with co-op
- The hunting and fishing layer gives every trip a purpose: food is the clock

---

### What Changed

- Moved from Inbox idea to opened project, earlier in the session than the Forge first suggested

---

### Open Questions Added

- Project name, co-op timing, time split with other projects, perspective, art direction, vehicle fantasy, tone, threats, release plan, CD sourcing, networking approach

---

### Open Questions Closed

- Kind of project, engine, differentiators, core activities, player count, progression, world generation, collectibles

---

### Progress Updates

- Project created at 0%. Pre-production, Step Zero, and Phases 1 to 4 defined in the tracker

---

### Documents Updated

- ROADSURVIVAL_FEATURE_MAP.md — created
- ROADSURVIVAL_PROGRESS_TRACKER.md — created
- ROADSURVIVAL_OPEN_QUESTIONS.md — created
- ROADSURVIVAL_PROJECT_LOG.md — created

---

### Next Session

Pick a name, decide how this shares time with other projects, then scaffold the project and get a vehicle driving.

---

## Build Rules

- No HTML in any output
- No emojis in any output
- SVG icons only when genuinely needed
