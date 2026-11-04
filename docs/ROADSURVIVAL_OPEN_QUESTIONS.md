# Salvage Road (working title) — Open Questions

> File names keep the early ROADSURVIVAL prefix. Nothing gets renamed or deleted.
> Last updated November 4, 2026. docs/SALVAGE_ROAD_CONCEPT.md has the newer concept and wins where they disagree.

---

## Answered

| Question | Answer | Session |
|---|---|---|
| What kind of project? | Survival looter with a mobile base, inspired by a game Chris just started | Nov 1, 2026 |
| Engine or platform? | Browser first. Chris first wanted Unity, then chose browser to start. Unity may come later. Steam release later, wrapped in Electron | Nov 1, 2026 |
| Shared with other games? | No. Fully separate from Chris's other games, own project and repo. zombiesiege in particular is a different game: nothing is taken from it | Nov 1, 2026 |
| How does it differ from the reference? | Different vehicles, different biomes, more crafting and building | Nov 1, 2026 |
| Core activities? | Find a vehicle in a town, loot, build the vehicle, drive to next location, scavenge roadside, eat and drink, hunt, fish, quests | Nov 1, 2026 |
| Players? | Up to 4 players together, in the long run | Nov 1, 2026 |
| Progression? | Level up, research points, unlock things to build along the way | Nov 1, 2026 |
| World? | Generative towns and biomes, always random, never a repetitive pattern | Nov 1, 2026 |
| Collectibles? | CDs found along the way, different genres, 3 song CDs | Nov 1, 2026 |
| Status? | Real project, production under way | Nov 1, 2026 |
| What is the project called? | Working title: Salvage Road | Nov 1, 2026 |
| Where is the player going? | Driving across a ruined world. The concept now adds: to find parts and containers and build a compound | Nov 1, 2026 |
| What happened to the world? | A quiet collapse: supply chains failed, cities emptied, nature is reclaiming the towns | Nov 1, 2026 |
| What is the tone? | Calm and a little lonely, suited to a long drive with music on | Nov 1, 2026 |
| What threatens the player? | Hunger, thirst, weather, and distance. No enemy AI at first | Nov 1, 2026 |
| What are the CDs? | Relics of the old world, found in abandoned cars and houses | Nov 1, 2026 |
| One refuge or several? | Several. The concept now says five traders across the map | Nov 2, 2026 |
| Does the journey have an ending? | No. The road itself is the point | Nov 2, 2026 |
| First person or third person? | First person | Nov 2, 2026 |
| Art direction? | Stylized realism | Nov 2, 2026 |
| Which vehicle comes first? | The El Cajon: an original El Camino-style coupe-utility with a generic name | Nov 2, 2026 |
| What should the game run well on? | A mid-range laptop. The test machine is the dev laptop: Ryzen 5 7535HS, 31 GB RAM, integrated Radeon in the browser | Nov 2, 2026 |
| Which physics library for the vehicle? | Rapier. Chris drove both Rapier and cannon-es; the cannon-es lab stays at /lab for reference | Nov 2, 2026 |
| How heavy and arcade-like should driving be? | Realistic, like a real car | Nov 2, 2026 |
| Keyboard layout? | WASD to drive, Space to brake or handbrake. Gamepad is still open | Nov 2, 2026 |
| HUD and menus: canvas or HTML? | HTML drawn over the canvas, behind one small interface so it can be swapped | Nov 2, 2026 |
| Co-op at launch, or single-player first? | Single-player first, built so co-op can be added later | Nov 4, 2026 |
| Free browser game, paid, or both? | A paid Steam game. "Free browser game" is out | Nov 4, 2026 |
| Is the pop-up bench the core mechanic? | No. Building a base from shipping containers is. The bench was never built | Nov 4, 2026 |
| How are containers placed? | Moved by hand from a truck: pull up, press U, aim in first person, see a ghost, click. Not from a build menu | Nov 4, 2026 |
| Do dropped containers snap to a grid and follow the support rule? | Yes, with pillars appearing under them | Nov 4, 2026 |
| Where does the player start? | In the desert, out of sight of the town behind a small hill. They walk to the town, find food and water, and find the El Cajon in a junkyard in pieces | Nov 4, 2026 |
| Does the El Cajon start whole? | No. It is a rusty, stripped shell. The player finds its parts in the yard and bolts them on with a wrench | Nov 4, 2026 |
| Do the doors come off? | The two doors are parts to find and fit, after the dashboard and seat. The hood can go on first and then opens, so the engine can be changed through it | Nov 4, 2026 |
| How many docks? | At least two, a long way apart. They are planned now, not drawn yet | Nov 4, 2026 |

---

## Still Open

| Question | Why It Matters |
|---|---|
| Does the name El Cajon clash with any existing vehicle or product? | Quick name check before shipping, with a real professional for anything legal |
| How weak should the El Cajon start, and what is the upgrade path? | Forge suggests a smaller bed, low clearance, and less off-road ability, fixed through upgrades. Needs Chris's call |
| Is there an art budget, and where will assets come from? | Chris has folders of building, land, tree and shrub assets. Their licences are not known (see ASSET_LICENSES.md). Decides whether a paid release can use them |
| How many shipping containers across the map, and where? | Claude recommends about 150: around 50 at each dock, 30 in industrial and town yards, 15 near roads, 1 in the junkyard. Needs Chris's call |
| Should some El Cajon parts be found outside the junkyard? | Right now every part is in the yard. More variety means more reasons to explore |
| Does the rebuilt truck need fuel to run? | Sets what "find gas" means and how tight each trip feels |
| What is under the hood to use? | The hood opens, but there is nothing to do under it yet (engine repair, fuel, battery) |
| Where do tires and motors really come from? | They turn up in dumpsters for now. The concept suggests stripping wrecks |
| How is the paint restored? | Chris wants grind, paint, buff after finding tools and paint. Which tools, how much paint, whole truck or panel by panel |
| What does each fleet vehicle do, and which exist? | The El Cajon fetches small things, the big rig hauls containers. The rest is open |
| What does each of the five traders buy and sell? | Defines how trading ties into progress |
| Is there ranching at the base? | Wanted in the concept, not scheduled |
| How does a parked vehicle work as storage, away from the base? | The El Cajon has a bed store of 24 slots while it is in the game; storage on a vehicle left by the road is not designed |
| How does a flatbed trailer hook to the big rig, and how are containers lifted onto it at the docks? | By hand in a placing mode like unloading, or with a crane. Not decided |
| Should an empty hunger bar hurt or kill the player? | An empty bar only slows walking today. It decides how tense the game is |
| Why is the player on the road at the start? | A mystery revealed slowly. Not written yet |
| What gives players a long-term goal beyond the base and fleet? | Base and fleet are enough for now |
| Driving camera: cockpit, chase, or switchable? | The chase camera is provisional. First person is only used on foot |
| Gamepad support? | Keyboard and mouse only so far |
| How will the 3 CDs be made or sourced? | Music needs a license that allows commercial use. Generated, commissioned, or licensed |
| Which networking approach for co-op? | Deferred to Phase 3, but worth a short evaluation before then |
| Should hostile survivors ever appear? | Backlog idea, not needed for the first build |
| Will a Unity version come later? | The concept says browser first, then Electron for Steam. Revisit later |
| Should the game be saved? | Only the base is saved. The truck rebuild, the inventory and the loot start over on reload. Saving is its own piece of work |

---

## Build Rules

- No HTML in any output
- No emojis in any output
- SVG icons only when genuinely needed
