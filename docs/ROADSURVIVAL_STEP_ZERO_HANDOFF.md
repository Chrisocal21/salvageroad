# Salvage Road: Step Zero Handoff for the Coding Claude

Written 2026-11-02, updated the same day with the performance target. Hand this file to the coding Claude in VS Code, in a brand new empty project folder.

## Read this first

The person who wrote this file (a planning chat) has NOT seen any code. There is no repo yet. This file states Chris's goals and decisions. You, the coding Claude, can see the real folder and machine, so you decide the specifics and tell Chris what you find.

Where this file states a goal or decision, that is Chris's call. Where it says "proposed", it is a suggestion Chris has not approved: ask before building it. Where it says "not specified", do not invent an answer: ask.

Nothing here has been checked against the current docs of any library. Verify before relying on it.

## Who you are working with

- Chris is a solo developer with ADHD. He is the idea person and relies on AI for heavy implementation. He wants to understand enough to stay in control.
- Keep replies short, plain, and one step at a time. Explain a new concept simply the first time it comes up.
- Ask one question at a time. Never stack questions.
- No emojis anywhere.
- Work in small steps with one clear goal each. Commit small and often. Run tests after each change.
- At the end of each stage, stop, summarize in under 10 lines, and wait for Chris's go-ahead.
- Local dev always runs on localhost:3000.

## What this is

Salvage Road (working title) is a browser survival looter with a mobile base. The player finds a vehicle in an emptied town, loots, builds the vehicle up, and drives across a quietly collapsed world between several refuges, collecting what they need to keep moving. Hunting, fishing, crafting, benches that pop up beside the vehicle, research and unlocks, and up to 4-player co-op come later. The road itself is the point: there is no ending.

This is a NEW, fully SEPARATE project. It shares no code, repo, or foundation with any of Chris's other games. Do not look for or reuse code from other projects.

## Chris's decisions (settled, do not reopen)

- Browser first. Unity may come later, not decided.
- TypeScript, Vite, and Three.js as the starting stack, on localhost:3000, deployed later to Vercel.
- First person camera on foot.
- Art direction: stylized realism. Real proportions and believable materials, simpler model detail, strong lighting and color grading. Not low-poly, not photoreal.
- First vehicle: the El Cajon, an ORIGINAL coupe-utility in the El Camino style with an open bed. Do not use the real Chevrolet name or copy its exact body.
- Calm, a little lonely tone. Threats are hunger, thirst, weather, and distance. No enemy AI at first.
- Single-player first, but built so 4-player co-op can be added later without a rewrite.
- **Performance target: a mid-range laptop.** Chris said "ordinary-ish, but mid range." The game should run well there, not only on a strong gaming PC. The exact specs of a mid-range laptop are not specified.

## Proposed (ask before building)

- Keep game rules (inventory, crafting, survival stats) as plain TypeScript separate from rendering, so they can be tested without a browser.
- Keep content (items, recipes, loot tables, vehicles) as plain data files, not code.
- Generate towns, biomes, and road legs from a seed.
- Free CC0 textures such as Poly Haven, with the license checked for each asset.
- Quality settings that can scale down, so the game stays playable on a mid-range laptop.
- Co-op rooms later with Cloudflare Workers and Durable Objects, to be evaluated then. Not for Step Zero.

## The goal of this handoff: Step Zero

Prove that driving feels good in the browser, with placeholder shapes only. Nothing else gets built until Chris says go.

Step Zero in full, for context (you only do the first stages now):
1. One drivable El Cajon with feel-good physics
2. A small generated stretch of terrain and one generated town
3. Walk in first person, loot containers, carry items
4. Enter and exit the vehicle
5. Deploy a bench from the bed, craft one item, pack it away
6. A hunger meter that gives a reason to stop
7. A browser performance check with generated terrain and loot

## Suggested order (loose, change it if you see a better way)

1. **Look around.** Check the folder and the machine: Node version, git, editor setup. Tell Chris what you find. Propose a repo layout and the one question you most need answered. Do not start building until Chris agrees.
2. **Set up the repo.** New separate git repo. Vite and TypeScript project with Three.js, running on localhost:3000. A sensible .gitignore, a test runner (vitest is a likely fit, your call), and a first commit. Keep rules code and rendering code in separate folders.
3. **Compare physics libraries with a small test.** Try Rapier and cannon-es on the same simple scene: a box-shaped car on flat ground with one ramp. Check what each offers for vehicles, how easy it is to tune handling, and how the frame rate holds. Report honestly with a recommendation. Chris decides.
4. **Drive.** Using the chosen library, a placeholder El Cajon (boxes, no art) that drives on flat ground with keyboard controls. Stop here and let Chris try it and say go or no-go on the feel.
5. **Performance baseline.** Measure the frame rate with a simple generated terrain patch and a few hundred placeholder objects. Ask Chris what machine he is testing on, and tell him how the result compares to a mid-range laptop. Report the numbers. Do not add art.

## Do not

- Add real art, models, or textures yet. Placeholder shapes only.
- Use assets, names, or code from the reference game or from any real brand.
- Build multiplayer, hunting, fishing, crafting, quests, or the research tree.
- Reuse or look at code from Chris's other projects.

## Keep a log

Keep a DECISIONS_LOG.md in the new repo. Write down anything you decided that Chris did not specify, every library comparison result, and every open question, so he can review it.

## Not specified (ask Chris, do not guess)

- What exactly counts as a mid-range laptop, and what machine he will test on
- The driving camera: cockpit, chase, or switchable
- Keyboard layout and whether gamepad matters
- Whether menus and the HUD should be drawn on the canvas or built from HTML. Chris's planning notes forbid HTML in documents, but nothing has been decided for the game interface. Ask before building any UI
- How heavy and how arcade-like the driving should feel
- Whether there is an art budget

## Still open (not for you to decide now)

- How many refuges, and how they differ
- What the vehicle needs to keep moving: fuel, parts, or both
- Co-op timing and networking approach
- Where the CDs and music come from
