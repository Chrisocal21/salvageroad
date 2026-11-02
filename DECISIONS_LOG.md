# Decisions Log

Anything decided that Chris did not specify, library comparison results, and open questions. Newest at the bottom.

## 2026-11-02 Setup

Decided by Chris:
- Test machine is the dev laptop: AMD Ryzen 5 7535HS (6 cores), Radeon RX 6550M, 31 GB RAM. Treated as the "mid-range laptop" baseline.
- Repo layout approved: src/rules (plain TS game rules), src/render (Three.js), src/data (content as data), tests, docs.

Decided by Claude (Chris did not specify):
- Package manager: npm (Node 24.12, npm 11.6).
- Latest versions installed: three 0.187, vite 8, typescript 7, vitest 5. Not checked against older docs or habits; verify APIs as we use them.
- Test runner: vitest.
- Vite dev server uses port 3000 with strictPort, so it fails loudly instead of silently moving to another port.
- Placeholder scene (ground plus a spinning box) only proves the toolchain; it will be replaced by the physics test.
- Planning docs live in docs/.

Open questions (from docs/ROADSURVIVAL_OPEN_QUESTIONS.md, relevant to Step Zero):
- Driving camera: cockpit, chase, or switchable
- Keyboard layout, and whether gamepad matters
- HUD and menus: canvas or HTML
- How heavy and arcade-like driving should feel
- Art budget
