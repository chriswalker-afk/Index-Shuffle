# Index Shuffle

**Slide. Multiply. Discover. Bank.** A browser-based, 2048-inspired exponent game for maths students.

## Play

[Launch Index Shuffle](https://chriswalker-afk.github.io/Index-Shuffle/) once the updated game is deployed to GitHub Pages. No login, backend, or build system is required.

- **Start with 10 moves left.** Every successful slide uses **1** move; every **2 merges** return **1** move, including merges spread across separate slides. Four merges earn two moves. The bonus is credited **before** checking for game over, so two merges on the last slide can keep a run alive. Unsuccessful swipes that leave the board unchanged do not spend moves. The Moves Left counter and 0/2 or 1/2 merge-progress indicator are shown above the board. There is no maximum move balance.
- Swipe the **4×4 board**, use the arrow keys, WASD, or click the direction controls.
- Tiles with the same **base** merge by adding exponents, for example **3² × 3³ → 3⁵**. Each tile can participate in at most one merge per swipe.
- Every **successful slide** normally spawns one number tile. From **slide 40 onwards, every tenth successful slide** (40, 50, 60, …) can spawn a **second** number tile, as long as there is an empty square. The game starts with bases **2, 3, 5**, then unlocks **7 after 15 successful slides, 11 after 35, and 13 after 60** (six bases maximum). New bases start rare and increase their spawn share over the next 12 slides. Discovered higher powers can also appear as rare spawns.
- **Escalating blockers** begin at **move 10** (tier 1, one required hit), then progressively at **20** (two hits), **30** (three), **40** (four) and **50 onward** (five, the maximum). The game allows **at most two active blockers**, and only schedules another when a suitable empty square is available.
- **Next-turn warning:** at **move 9, 19, 29, 39, …**, an eligible empty square is highlighted with a yellow **! NEXT** marker. That square is reserved for one turn, cannot be entered or crossed by number tiles, and changes into the advertised blocker **on the next successful slide**. The marked square is guaranteed to be the blocker's location; if no safe place exists or the blocker cap is reached, that warning/blocker pair is skipped. Warning squares cannot be banked or damaged. Scheduling the warning preserves at least one possible swipe.
- **Breaking blockers requires a correct bank:** once active, blockers stay fixed and split rows/columns into sliding segments. **Merging alone never removes blocker health.** A genuine merged power must be **correctly banked while directly adjacent** (up/down/left/right, not diagonally) to damage a blocker by **one hit**. Bankable powers that will strike a neighbour show a distinctive **⚡** indicator. Failed answers, timeouts, ordinary slides, or banking a higher power that appeared as a random spawn do **not** cause damage. A spawned power must first be merged to become eligible for a blocker hit. A merged power retains its eligibility as it slides; the banked tile's smaller replacement does not inherit the eligibility. A single correct bank may strike two blockers if both border the banked square. Older blockers retain their original durability tier, and breaking a blocker frees its square for later turns. Existing saved three-hit blockers remain at their original difficulty.
- A glowing **✦** tile (exponent 2 or higher) can be **banked once per base–exponent combination**, provided you calculate its exact value within **60 seconds**.
- **Banking does not empty a square.** Banking **5⁷**, for example, scores the original power but replaces that square with a randomly selected **smaller, already unlocked power of 5**. A plain **5** (exponent 1) remains the fallback. **The replacement has a one-successful-slide banking cooldown**, so another bank is never available immediately on that tile. Banked powers can still spawn or merge but cannot be banked again.
- **Banking cooldown:** the replacement tile, an incorrect attempt, or a timeout creates a **⌛** one-slide lock on that square (when the tile is otherwise bankable). One **successful slide** clears all these temporary locks. Other tiles remain bankable, and cancelling an attempt does not impose a penalty.
- **Game over:** you lose immediately when **Moves Left reaches zero**, even if the board still has available banking or merging options. You also lose if there are no legal slides or bankable powers. A full board by itself is not automatically game over. Banking answers and their 60-second timers do not add or subtract moves; only successful slides and their merges affect the move budget.
- Moves animate briefly (170 ms). System **reduced motion** preferences disable animations. Banking timers pause while the browser tab is hidden.
- Game state, merge credit, remaining moves and high score are saved in the current browser between visits. A new game resets to **10 moves** while keeping your best score. **Older saved games** created before the budget system retain their board and slide count but receive a fresh 10-move budget and zero merge credit because historic merge counts were not stored.

## Tests

Run **node tests.mjs** and **node hazards.tests.mjs** (Node 18+). GitHub Actions runs both tests, JavaScript syntax checks, and static entrypoint verification on pushes and pull requests.

The engine and hazard regression tests cover the **10-move resource**, move spending, merge credits carried across turns, bonus awards before zero-move defeat, and independent game-over conditions. They also verify exponent merging, warning squares, blocker tiers, bank-triggered blocker damage, cooldowns and extra spawns. The answer timer and visual effects should also be checked manually on desktop and mobile.

## Technical notes

The game is plain HTML, CSS, and native JavaScript modules, with no external runtime dependencies.

- **engine.mjs:** deterministic game rules, sliding segments, blocker damage, dual spawning, power replacement, and question validation.
- **app.mjs:** DOM interactions, timer, progress storage, and short motion animations.
- **styles.css:** responsive visual design, including reduced-motion support.

Spawn probabilities are weighted at roughly **85% base tiles, 11% discovered squares, 3% discovered cubes, 1% higher discovered powers**, automatically reweighted when a category has not been discovered. Within the base tile pool, a newly unlocked base starts at **30% of the normal per-base weighting** and ramps to equal weight across 12 successful slides. The progression stops at six bases. Blockers still progress from one to five required **correctly banked adjacent merges** across ten-slide milestones. Their cadence and the per-tier hit requirements can be adjusted after playtesting.

## Publishing

GitHub Pages uses **Settings → Pages → Build and deployment → Deploy from a branch**, with branch **main** and folder **/(root)**. The **.nojekyll** marker ensures that the supplied game entrypoint (**index.html**) is served instead of generating a README-based website.

For local development, serve the directory over HTTP, for example using **python3 -m http.server 8000**, then open http://localhost:8000/. Browser module imports may fail when directly opening a local file URL.
