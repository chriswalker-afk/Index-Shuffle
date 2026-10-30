# Index Shuffle

**Slide. Multiply. Discover. Bank.** A browser-based, 2048-inspired exponent game for maths students.

## Play

[Launch Index Shuffle](https://chriswalker-afk.github.io/Index-Shuffle/) once the updated game is deployed to GitHub Pages. No login, backend, or build system is required.

- **Start with 10 moves left (maximum 10).** Every successful slide costs **1 move plus 1 extra move for each active blocker** at the start of the slide: no blockers = 1 move, one blocker = 2, two blockers = 3. Warning squares don't count until the blocker appears. **Merging tiles does not automatically restore moves.** Only **correctly answering and banking two powers that were genuinely created by merging** earns one move, capped at 10. The UI shows remaining moves, 0/2 or 1/2 correct-bank progress and the next slide's cost. Banking a randomly spawned power earns score but not move credit; a spawn must be merged first to qualify. An unchanged swipe costs nothing.
- Swipe the **4×4 board**, use the arrow keys, WASD, or click the direction controls.
- Tiles with the same **base** merge by adding exponents, for example **3² × 3³ → 3⁵**. Each tile can participate in at most one merge per swipe.
- Every **successful slide** normally spawns one number tile. From **slide 40 onwards, every tenth successful slide** (40, 50, 60, …) can spawn a **second** number tile, as long as there is an empty square. The game starts with bases **2, 3, 5**, then unlocks **7 after 15 successful slides, 11 after 35, and 13 after 60** (six bases maximum). New bases start rare and increase their spawn share over the next 12 slides. Discovered higher powers can also appear as rare spawns.
- **Escalating blockers** begin at **move 10** (tier 1, one required hit), then progressively at **20** (two hits), **30** (three), **40** (four) and **50 onward** (five, the maximum). The game allows **at most two active blockers**, and only schedules another when a suitable empty square is available.
- **Next-turn warning:** at **move 9, 19, 29, 39, …**, an eligible empty square is highlighted with a yellow **! NEXT** marker. That square is reserved for one turn, cannot be entered or crossed by number tiles, and changes into the advertised blocker **on the next successful slide**. The marked square is guaranteed to be the blocker's location; if no safe place exists or the blocker cap is reached, that warning/blocker pair is skipped. Warning squares cannot be banked or damaged. Scheduling the warning preserves at least one possible swipe.
- **Breaking blockers requires a correct bank:** once active, blockers stay fixed and split rows/columns into sliding segments. **Merging alone never removes blocker health.** A genuine merged power must be **correctly banked while directly adjacent** (up/down/left/right, not diagonally) to damage a blocker by **one hit**. Bankable powers that will strike a neighbour show a distinctive **⚡** indicator. Failed answers, timeouts, ordinary slides, or banking a higher power that appeared as a random spawn do **not** cause damage. A spawned power must first be merged to become eligible for a blocker hit. A merged power retains its eligibility as it slides; the banked tile's smaller replacement does not inherit the eligibility. A single correct bank may strike two blockers if both border the banked square. Older blockers retain their original durability tier, and breaking a blocker frees its square for later turns. Existing saved three-hit blockers remain at their original difficulty.
- A glowing **✦** tile (exponent 2 or higher) can be **banked once per base–exponent combination**, provided you calculate its exact value within **60 seconds**.
- **Banking does not empty a square.** Banking **5⁷**, for example, scores the original power but replaces that square with a randomly selected **smaller, already unlocked power of 5**. A plain **5** (exponent 1) remains the fallback. **The replacement has a one-successful-slide banking cooldown**, so another bank is never available immediately on that tile. Banked powers can still spawn or merge but cannot be banked again.
- **Banking cooldown:** the replacement tile, an incorrect attempt, or a timeout creates a **⌛** one-slide lock on that square (when the tile is otherwise bankable). One **successful slide** clears all these temporary locks. Other tiles remain bankable, and cancelling an attempt does not impose a penalty.
- **Game over:** you lose immediately when **Moves Left reaches zero** (balances never go negative), even if the board still has available banking or merging options. You also lose if there are no legal slides or bankable powers. A full board alone is not automatically game over. Incorrect or timed-out banking attempts do not earn moves. Breaking a blocker through correct banking reduces the **cost of later slides**.
- Moves animate briefly (170 ms). System **reduced motion** preferences disable animations. Banking timers pause while the browser tab is hidden.
- Game state, correctly banked merge credit, remaining moves and high score are saved locally in the browser. New games start with 10 moves. **Existing saved games created under the earlier automatic-merge-reward rule** keep their board, score, discoveries and historical slide count but receive a fresh ten-move balance and zero correct-bank credit; this upgrade occurs once.

## Interface

The play screen is intentionally **focused on making decisions**, not on displaying the rulebook:

- **Always visible:** the 4×4 board, short contextual feedback, remaining moves, next-slide cost, progress toward the next bonus move, score, and keyboard/touch controls. Remaining moves is visually prominent; low-move and game-over states are distinct.
- **Only when requested:** **How to play** and **Maths help** open separate views in an accessible learning dialog. The banking question also has an optional, collapsed maths reminder.
- **Collapsed by default:** **Run details** (personal best, number banked, cumulative slides, active blockers, unlocked bases and forthcoming milestones) and **Power collection**. Expanding them does not affect the game or timer.
- **Responsive:** on a narrow screen the move budget appears immediately above the board, with expandable details below the board. Keyboard controls are disabled while the help dialog is open, and the native dialog returns focus when closed.

The panel layout is deliberately compact: a player should not need to read instructions or open statistics to complete a normal turn. New-game, banking, 60-second answer timer, blocker warnings, and save/resume behaviour are unchanged.

## Tests

Run **node tests.mjs** and **node hazards.tests.mjs** (Node 18+). GitHub Actions runs both tests, JavaScript syntax checks, and static entrypoint verification on pushes and pull requests.

The engine and hazard regression tests cover the **ten-move budget**, blocker slide costs, the maximum of 10, the rule that slides and unbanked merges never restore moves, and the rule that **only two correctly banked powers created by merging** earn one move. They also test save migration, banking lockouts, blocker mechanics, and zero-move loss conditions. The answer timer and visual effects should be manually checked on desktop and mobile.

## Technical notes

The game is plain HTML, CSS, and native JavaScript modules, with no external runtime dependencies.

- **engine.mjs:** deterministic game rules, sliding segments, blocker damage, dual spawning, power replacement, and question validation.
- **app.mjs:** browser interaction, banking timer, accessible help dialog, persistent state, move-cost display and short tile animations. The HTML uses versioned script and stylesheet URLs to prevent stale modules from keeping the old layout or obsolete move rules after deployment.
- **styles.css:** responsive visual design, including reduced-motion support.

Spawn probabilities are weighted at roughly **85% base tiles, 11% discovered squares, 3% discovered cubes, 1% higher discovered powers**, automatically reweighted when a category has not been discovered. Within the base tile pool, a newly unlocked base starts at **30% of the normal per-base weighting** and ramps to equal weight across 12 successful slides. The progression stops at six bases. Blockers still progress from one to five required **correctly banked adjacent merges** across ten-slide milestones. Their cadence and the per-tier hit requirements can be adjusted after playtesting.

## Publishing

GitHub Pages uses **Settings → Pages → Build and deployment → Deploy from a branch**, with branch **main** and folder **/(root)**. The **.nojekyll** marker ensures that the supplied game entrypoint (**index.html**) is served instead of generating a README-based website.

For local development, serve the directory over HTTP, for example using **python3 -m http.server 8000**, then open http://localhost:8000/. Browser module imports may fail when directly opening a local file URL.
