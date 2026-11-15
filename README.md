# TIDEBREAK

[![make.fun](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/bactiar291/tidebreak-fps-makefun/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard)
[![reward](https://make.fun/badge/threejs-fps-02/bactiar291/tidebreak-fps-makefun/reward.svg)](https://make.fun/bounty/threejs-fps-02)

An original single-player tactical FPS at a coastal relay waterworks. A sandstone pier, oxidized pump hall, generator court and recessed canal form intersecting approaches to relay 01. All scenery, characters, weapon meshes and sound are procedural. No build step, package install, runtime network service or external asset is required.

## Play

Serve `game/` with any static HTTP server and open its index in desktop Chrome with WebGL 2. For a local random-port server:

    python3 tests/server.py game

The server prints its localhost port. Open that address; Ctrl+C stops it. The menu starts an attack-only operation: you and Mica against Rusk, Brine and Flint. First to three rounds wins (at most five rounds). Normal and Easy alter bot reaction delay, spread and damage, not objective rules. Click BEGIN OPERATION, buy equipment, then DEPLOY. Pointer lock captures the mouse; Escape pauses. Where pointer lock is denied, right-drag controls aim.

## Controls

- WASD: movement with acceleration and friction.
- Mouse: aim. Left button: fire. Right button: focus view; right-drag fallback aim.
- Shift: quiet walk. Ctrl or C: crouch, lowering head height and improving accuracy.
- R: reload. X: cancel reload; ammunition moves only when a reload finishes.
- G: throw a smoke canister. Smoke blocks both teams' vision for 11 seconds, but does not stop bullets.
- E: hold at the marked relay circle for three uninterrupted seconds to arm sabotage.
- B: toggle requisitions during the buy phase. Enter: deploy. Escape: pause.

Stop before firing. Moving and sustained fire increase spread; recoil recovers over time. Heads take greater damage and bypass armor. Friendly bodies stop bullets without taking friendly damage. Pistol fire is single-shot; SMG and rifle are automatic with different cadence, recoil, capacity and damage. Reserve ammunition is finite.

## Round rules and economy

Eliminate all defenders, or arm relay 01 and protect it for 30 seconds. Defenders can disarm it with five uninterrupted seconds at the site. Movement, damage, death, releasing E or starting a reload cancels a player's plant. An armed relay persists after all attackers die. Its final detonation tick precedes a simultaneous completed defuse. Before planting, loss of both attackers or the 85-second timer gives defenders the round. Scores and rewards are applied once.

Start with $2,400. A team win earns $2,200; a loss earns $1,500; a player elimination earns $300. Funds carry over, capped at $9,000. Surviving players keep the equipped weapon; death resets it to the free pistol. Every round restores full weapon ammunition, 100 health, 50 armor and one smoke. Purchases are limited to the 18-second buy phase. Armor costs $450, reserve refill $200, a second smoke $250, the SMG $1,100 and the rifle $1,900. Match restart resets all economy and scores. There is no side switch or weapon pickup system.

On death you spectate Mica while AI and the objective continue. Results advance to the next buy phase automatically, or immediately through NEXT ROUND. A completed match offers NEW MATCH.

## Practice

PIER DRILL and RELAY DRILL are public menu options, not screenshot cheats. They initialize a rifle-equipped live scenario on the same map, using ordinary damage, AI, collision and round resolution. Pier practice exposes a long sightline. Relay practice begins at the site with defenders approaching from farther away, allowing practice of planting and defending. Screenshots may be captured in these documented scenarios; their HUD reflects real state.

## Architecture and verification

`game/src/map.js` holds the shared render/collision plan and a waypoint graph with all-pairs next-hop routing. `sim.js` owns centralized state and a seeded 60 Hz fixed-step simulation, independent of the renderer. `bots.js` owns tactical decisions: Rusk anchors the relay, Brine rotates along the pier, and Flint patrols the hall. Guards investigate expiring sound coordinates and pursue the last visible position without tracking an unseen opponent. The anchor ignores distant distractions. Bots seek nearby reachable cover when reloading under visual contact and retain that cover goal for the whole reload, including after reaching cover or losing sight of the opponent. A planted relay assigns one surviving defender to disarm while the others cover separate approaches; the assignment transfers if that defender dies. Routes replan after blocked progress. Bounded range, field of view, wall/smoke occlusion and reaction delay apply before shooting. `view.js` creates economical geometry, a capped DPR 1 renderer, interpolated actor positions, articulated reload/recoil and pooled tracers, impact flashes and smoke. `audio.js` uses reusable WebAudio voices, muted until the user explicitly enables sound. `main.js` handles browser input and state-derived UI. `window.tidebreak.state()` returns a detached read-only snapshot for QA; there is no gameplay mutation interface.

Run pure simulation invariants:

    node --test tests/sim.test.js tests/ai.test.js

The saved post-fix test run passed 42 simulation checks (26 original and 16 tactical regressions), including waypoint routes to the relay, bounded blocked-route replanning, hidden-contact memory, smoke/wall vision, covering/defuse assignment, friendly-body bullet blocking and fixed-step seed consistency. Four reload-cover regression cases fail in the saved pre-fix run and pass after the fix: Brine and Flint retain their goal through 99 simulation steps, hold reached cover while an unseen opponent moves, release the goal on reload completion, and reacquire visible contact with reaction delay. These saved results were inspected during the documentation handoff, not rerun. Existing navigation may still oscillate after a distraction; this inherited limitation is not a claim of universal recovery. A previous normal-difficulty browser operation completed with TIDE 0 : 3 GUARD; this is an observed loss, not a claim of competitive balance.

The browser regression script requires Python Playwright and Pillow already installed, plus Chrome at `/usr/bin/google-chrome`:

    /root/venv/bin/python3 tests/browser.py

It owns a localhost random-port server, exercises normal UI and mouse/keyboard input, records real frames and writes `/tmp/makefun/fps-browser/report.json`. Set `TIDEBREAK_TEST_OUTPUT` to preserve reports from previous runs. It stops its server in a finally block. The saved post-fix browser report passed all 29 checks with no page errors or unexpected requests; this report was inspected, not rerun during the documentation handoff. CPU-only SwiftShader test timing is not a desktop FPS benchmark.

Produce the competition artifact in a new empty directory (Node 22.18+ standard library only):

    MAKEFUN_OUTPUT_DIR=/tmp/makefun/fps-output node main.ts

The default without that variable is `/output` as required by the competition. `--prepare` copies only the static game for initial screenshot preparation; the default always creates the full dossier. A nonempty output target is refused to avoid stale files. No writes occur outside the specified output.

`tests/gates.ts` reproduces published file/reference/image/dossier checks locally, using Node's bundled Acorn via `--expose-internals` for AST parsing. It is a local validator, not the sealed official scorer. Set `TIDEBREAK_IMAGE_REPORT` to the Pillow image-validation report for the current artifact (default `/tmp/makefun/fps-images.json`). No official judge score is claimed.

The current screenshots are genuine previous pre-fix captures, retained without recapture during this handoff: direct 1280×720 browser JPEGs of normal-match combat, the public relay drill after arming, normal requisitions, and a completed normal operation. Captures are unedited and do not demonstrate the reload-cover fix. The combat frame was checked against living-player snapshots before and after capture, a weapon render pass, and in-frame unobstructed opponent projections. Temporary read-only browser instrumentation confirmed separate world and weapon passes; the public render counter reports only the last pass. No rendering defect was established. The parent visually inspected the previous cover and confirmed a visible weapon, a distinguishable character, and a readable main HUD. That limited screenshot inspection does not establish hardware performance, overall visual quality, or ranking; final image review remains a parent task.

## Limits and provenance

Desktop keyboard/mouse only; no multiplayer, jumping, mobile controls, save game, destructible world or advanced animation rig. The canal uses a simple height field. Decorative overhead pipes, railings and console details do not have separate bullet colliders; structural cover does. Smoke uses low-poly pooled clouds, with a deliberate spherical visibility approximation. There are no dynamic shadows, postprocessing or textures fetched over the network. Visual review on a hardware GPU is still recommended.

MIT; see LICENSE and THIRD_PARTY.md. Only the required make.fun library and Three.js 0.187.0 kit bytes were copied. The native authoring session contains the original writes, revisions and real tests; transcript collection and publishing are separate parent tasks. No transcripts, token usage, judge responses or screenshot content are synthesized here.
