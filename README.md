# Index Shuffle

**Slide. Multiply. Discover. Bank.** A browser-based, 2048-inspired exponent game for maths students.

## Play

[Launch Index Shuffle](https://chriswalker-afk.github.io/Index-Shuffle/) once the updated game is deployed to GitHub Pages. No login, backend, or build system is required.

- Swipe the **4×4 board**, use the arrow keys, WASD, or click the direction controls.
- Tiles with the same **base** merge by adding exponents, for example **3² × 3³ → 3⁵**. Each tile can participate in at most one merge per swipe.
- Every **successful slide** spawns one new tile. Once you have discovered a power by merging, that power can occasionally appear as a new tile. Higher powers are rarer.
- A glowing **✦** tile (exponent 2 or higher) can be **banked once per base–exponent combination**, provided you calculate its exact value within **60 seconds**.
- **Banking no longer empties a square.** Banking **5⁷**, for example, scores the original power but replaces that square with a randomly selected **smaller, already unlocked power of 5**. A plain **5** (exponent 1) is always available as a fallback. Banked powers can still spawn or merge but cannot be banked again.
- **Incorrect answer or timeout:** the attempted tile stays on the board with a **⌛** symbol and cannot be banked until you complete **one successful slide**. Other bankable tiles remain available. Canceling an attempt does not impose a penalty.
- A full board is **not automatically game over**: you may still merge tiles or bank a power. The game ends only when there are no legal slides/merges and no currently bankable tiles.
- Moves animate briefly (170 ms). System **reduced motion** preferences disable animations. Banking timers pause while the browser tab is hidden.
- Game state and high score are saved in the current browser between visits. A new game resets the current run but keeps your best score.

## Tests

Run **node tests.mjs** (Node 18+). GitHub Actions runs the same tests, JavaScript syntax checks, and static entrypoint verification for pushes and pull requests.

The engine tests cover exponent merging in all directions, slide destinations for animation, discovered-power spawning, banking replacement eligibility, one-swipe lockouts, and game-over scenarios. The 60-second modal timer and visual effects should also be manually checked on desktop and mobile devices.

## Technical notes

The game is plain HTML, CSS, and native JavaScript modules, with no external runtime dependencies.

- **engine.mjs:** deterministic game rules, merging destinations, power replacement, spawning, and question validation.
- **app.mjs:** DOM interactions, timer, progress storage, and short motion animations.
- **styles.css:** responsive visual design, including reduced-motion support.

Spawn probabilities are weighted at roughly **85% base tiles, 11% discovered squares, 3% discovered cubes, 1% higher discovered powers**, automatically reweighted when a category has not been unlocked.

## Publishing

GitHub Pages uses **Settings → Pages → Build and deployment → Deploy from a branch**, with branch **main** and folder **/(root)**. The **.nojekyll** marker ensures that the supplied game entrypoint (**index.html**) is served instead of generating a README-based website.

For local development, serve the directory over HTTP, for example using **python3 -m http.server 8000**, then open http://localhost:8000/. Browser module imports may fail when directly opening a local file URL.
