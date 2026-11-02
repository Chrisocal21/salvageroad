# Salvage Road (working title) — Progress Tracker

> File names keep the early ROADSURVIVAL prefix. Nothing gets renamed or deleted.

---

## Salvage Road

**Overall progress:** 0%
**Last updated:** November 2, 2026
**Status:** Active, browser first, separate project. Step Zero handoff written, ready for VS Code

---

### Pre-Production

**Progress:** 82% (9/11)
**Goal:** settle the few decisions that shape everything before the first line of game code.

- [x] Choose a working title: Salvage Road
- [x] Define what happened to the world: a quiet collapse
- [x] Define the refuges: several to visit and choose between
- [x] Decide whether the journey has an ending: no, the road itself is the point
- [x] Decide perspective: first person
- [x] Decide art direction: stylized realism
- [x] Decide the first vehicle: the El Cajon, an original El Camino-style coupe-utility
- [x] Set the performance target: a mid-range laptop
- [x] Write the Step Zero handoff brief for the coding Claude (ROADSURVIVAL_STEP_ZERO_HANDOFF.md)
- [ ] Choose the vehicle physics approach (evaluate Rapier and cannon-es)
- [ ] Create a new separate repo: TypeScript + Vite + Three.js on localhost:3000

---

### Step Zero — Prove the Loop

**Progress:** 0%
**Goal:** driving, looting, and the pop-up bench feel good with placeholder art.

- [ ] Drivable El Cajon with good-feeling physics
- [ ] Small generated terrain stretch
- [ ] One generated town with lootable containers
- [ ] Walk in first person, pick up, and carry items
- [ ] Enter and exit the vehicle
- [ ] Deploy a bench from the bed, craft one item, pack it away
- [ ] Hunger meter that creates a reason to stop
- [ ] Browser performance check with generated terrain and loot, judged against a mid-range laptop

---

### Phase 1 — Single-Player Vertical Slice

**Phase progress:** 0%
**Goal:** one road leg from a starting town to a first refuge. Does not start until Step Zero holds up.

#### Feature 1.1 — Vehicle
**Progress:** 0%
- [ ] Find and claim a beat-up El Cajon in a town
- [ ] Repair at the bench
- [ ] Small set of upgrades

#### Feature 1.2 — Looting
**Progress:** 0%
- [ ] Town loot with a simple loot table
- [ ] Roadside scrap pickups while driving

#### Feature 1.3 — Survival
**Progress:** 0%
- [ ] Hunger and thirst
- [ ] Eating and drinking items

#### Feature 1.4 — World
**Progress:** 0%
- [ ] Seed-based generation
- [ ] Second biome

#### Feature 1.5 — First Refuge
**Progress:** 0%
- [ ] One simple refuge at the end of the leg with a trader: sell loot, buy one thing

#### Feature 1.6 — Look
**Progress:** 0%
- [ ] Lighting and color grading pass for the stylized realism direction

#### Feature 1.7 — Saves
**Progress:** 0%
- [ ] Save and load in browser local storage
- [ ] Deploy to Vercel

---

### Phase 2 — Core Loop

**Phase progress:** 0%

- [ ] Hunting
- [ ] Fishing
- [ ] Cooking
- [ ] Full crafting tree
- [ ] Levels, research points, research tree
- [ ] Quests
- [ ] Several refuges with their own traders, and the choice of where to drive next
- [ ] Distance milestones as the long-term goal
- [ ] Weather as a survival pressure
- [ ] More biomes
- [ ] More vehicles beyond the El Cajon

---

### Phase 3 — Co-op

**Phase progress:** 0%

- [ ] Choose and prove networking approach
- [ ] Character models for other players
- [ ] Shared vehicle with seats
- [ ] Inventory rules for shared and personal items
- [ ] Join by code, same seed
- [ ] Sync benches, loot, world state

---

### Phase 4 — Depth and Polish

**Phase progress:** 0%

- [ ] Refuge variety
- [ ] 3 song CDs in different genres
- [ ] Deeper generative variety
- [ ] Real art pass within stylized realism
- [ ] Audio pass
- [ ] Decide: stay browser-only or also build Unity

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

---

## What to Tackle Next

- [ ] Hand ROADSURVIVAL_STEP_ZERO_HANDOFF.md to the coding Claude in a new empty VS Code folder
- [ ] Choose the vehicle physics approach and create the separate repo (both happen in the handoff)
- [ ] Try the placeholder El Cajon on flat ground and give a go or no-go on the feel

---

## Build Rules

- No HTML in any output
- No emojis in any output
- SVG icons only when genuinely needed
