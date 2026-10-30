# Index Shuffle

**Slide. Multiply. Discover. Bank.** A browser-based, 2048-inspired exponent game for maths students.

## Play

Play the game at **https://chriswalker-afk.github.io/Index-Shuffle/** when the GitHub Pages deployment has completed. No account or backend is required.

GitHub Pages should be configured under **Settings → Pages → Build and deployment** with **Deploy from a branch**, branch **`main`**, folder **`/(root)`**. The `.nojekyll` marker ensures GitHub Pages serves the provided `index.html` and its JavaScript/CSS without generating a README-based Jekyll website. If the old README still appears immediately after a deployment, use a hard refresh once the publishing step has finished.

For local development, serve the directory through a local HTTP server such as `python3 -m http.server 8000` and open `http://localhost:8000/` (JavaScript modules may not load from a `file://` URL).

- Swipe the 4×4 board, use the arrow keys, WASD, or direction buttons.
- Tiles with the same **base** merge by adding exponents: `3² × 3³ → 3⁵`. A tile only merges once per swipe.
- Every successful slide spawns another tile. Discovered powers become possible (rare) spawns; base tiles remain common.
- Glowing powers (exponent 2+) can be **banked**: tap one and enter its exact numerical value.
- Each **base–exponent combination can only be banked once per game**. Banked powers may still spawn or be merged, but can't be banked again.
- A correct answer removes the selected tile and scores points; wrong answers give a multiplication hint and may be retried.
- The game ends when the player has no possible board movement/merge and no eligible banking actions, even if the board is full.
- Score and session progress are saved locally; New game resets the current run while preserving best score.

## Test

Run `node tests.mjs` (Node 18+). GitHub Actions also runs tests and syntax checks on pushes and pull requests.

## Implementation notes

The prototype is plain HTML, CSS, and native JavaScript modules. `engine.mjs` contains the pure game rules. `app.mjs` handles input, the UI, and local persistence. Spawn probabilities are weighted: roughly 85% simple bases, 11% unlocked squares, 3% unlocked cubes and 1% higher unlocked powers, with unavailable categories automatically reweighted. These are balancing defaults to refine after playtesting.

### Next iteration

Playtest game length, difficulty, spawn mix, bank scoring, and accessible animation. Consider introducing timed challenges only as a separate optional mode.
