# Salvage Road (working title) — Project Log

> File names keep the early ROADSURVIVAL prefix. Nothing gets renamed or deleted.

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
