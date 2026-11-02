# Salvage Road (working title) — Open Questions

> File names keep the early ROADSURVIVAL prefix. Nothing gets renamed or deleted.

---

## Answered

| Question | Answer | Session |
|---|---|---|
| What kind of project? | Survival looter with a mobile base, inspired by a game Chris just started | Nov 1, 2026 |
| Engine or platform? | Browser first. Chris first wanted Unity, then chose browser to start. Unity may come later | Nov 1, 2026 |
| Shared with other games? | No. Fully separate from Chris's other games, own project and repo | Nov 1, 2026 |
| How does it differ from the reference? | Different vehicles, different biomes, more crafting and building, pop-up benches and unloading tables outside the vehicle | Nov 1, 2026 |
| Core activities? | Find a vehicle in a town, loot, build the vehicle, drive to next location, scavenge roadside, eat and drink, hunt, fish, quests | Nov 1, 2026 |
| Players? | Up to 4 players together | Nov 1, 2026 |
| Progression? | Level up, research points, unlock things to build along the way | Nov 1, 2026 |
| World? | Generative towns and biomes, always random, never a repetitive pattern | Nov 1, 2026 |
| Collectibles? | CDs found along the way, different genres, 3 song CDs | Nov 1, 2026 |
| Status? | Real project, production starting soon | Nov 1, 2026 |
| What is the project called? | Working title: Salvage Road. Fits the looting and the traders who buy it. Can change later | Nov 1, 2026 |
| Where is the player going? | Driving across a ruined world to find traders and refuge | Nov 1, 2026 |
| What happened to the world? | A quiet collapse: supply chains failed, cities emptied, most people left for organized refuges, nature is reclaiming the towns. The player stayed behind or got left | Nov 1, 2026 |
| What is the tone? | Calm and a little lonely, suited to a long drive with music on | Nov 1, 2026 |
| What threatens the player? | Hunger, thirst, weather, and distance. No enemy AI at first | Nov 1, 2026 |
| What are the CDs? | Relics of the old world, found in abandoned cars and houses | Nov 1, 2026 |
| One refuge or several? | Several refuges to visit and choose between. The player drives the distance between them and collects what they need to keep moving | Nov 2, 2026 |
| Does the journey have an ending? | No. The road itself is the point | Nov 2, 2026 |
| First person or third person? | First person | Nov 2, 2026 |
| Art direction? | Stylized realism: real proportions and believable materials, simpler model detail, strong lighting and color grading. Chris wanted more realistic over low-poly, and the Forge advised against photoreal | Nov 2, 2026 |
| Which vehicle comes first? | The El Cajon: an original El Camino-style coupe-utility with a generic name, avoiding the real Chevrolet name and exact body | Nov 2, 2026 |
| What should the game run well on? | A mid-range laptop. Chris said "ordinary-ish, but mid range" | Nov 2, 2026 |

---

## Still Open

| Question | Why It Matters |
|---|---|
| What exactly counts as a mid-range laptop, and what machine will Chris test on? | Gives the performance check a real number to hit. The coding Claude will ask Chris |
| Does the name El Cajon clash with any existing vehicle or product? | Quick name check before shipping, with a real professional for anything legal |
| How weak should the El Cajon start, and what is the upgrade path? | Forge suggests a smaller bed, low clearance, and less off-road ability, fixed through upgrades. Needs Chris's call |
| Is there an art budget, and where will assets come from? | Not confirmed for this project. Decides whether assets are free-only or partly commissioned or bought |
| What gives players a long-term goal on a road with no ending? | Forge leans toward distance milestones, the research tree, and vehicle build-up. Needs Chris's call |
| How many refuges, and how do they differ? | Defines how much content the world needs and why choosing matters |
| What does the vehicle need to keep moving: fuel, parts, or both? | Sets what "collect what you need" means and how tight each road leg feels |
| What does the choice between refuges affect? | If it changes nothing, the choice is empty. It should change traders, unlocks, or terrain |
| What do traders do beyond buying loot and selling items? | Defines how the trader system ties into research and unlocks |
| Should hostile survivors ever appear? | Backlog idea, not needed for the first build. Decide later |
| Co-op at launch, or single-player first with co-op added in Phase 3? | Biggest scope lever. Forge recommends single-player first, built to be network-ready |
| Which physics library for the vehicle? | Vehicle feel is the biggest technical risk in the browser. The coding Claude tests Rapier and cannon-es, Chris decides |
| Should the game's menus and HUD be drawn on the canvas or built from HTML? | Not decided for the game interface. Documents never use HTML, but a browser game may need it. Ask before building any UI |
| Driving camera: cockpit, chase, or switchable? | Affects how driving feels and what is built first |
| Free browser game, paid, or both, and where is it hosted? | Affects scope of the first public build |
| How will the 3 CDs be made or sourced? | Music needs a license that allows commercial use. Generated, commissioned, or licensed |
| Which networking approach for co-op? | Deferred to Phase 3, but worth a short evaluation in pre-production |
| Will a Unity version come later? | Revisit after Step Zero shows whether the browser has enough headroom |

---

## Build Rules

- No HTML in any output
- No emojis in any output
- SVG icons only when genuinely needed
