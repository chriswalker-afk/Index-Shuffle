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
- A glowing **✦** tile can be banked by calculating its exact value within **60 seconds**. Ordinary powers need exponent 2 or higher and can be banked only once per base–exponent combination. **Roguelite golden tiles are an exception:** even an exponent-1 golden number (such as 3¹) can be banked, and a newly golden copy can be banked even if the same power was already banked earlier this round.
- **Banking does not empty a square.** Banking **5⁷**, for example, scores the original power but replaces that square with a randomly selected **smaller, already unlocked power of 5**. A plain **5** (exponent 1) remains the fallback. **The replacement has a one-successful-slide banking cooldown**, so another bank is never available immediately on that tile. Banked powers can still spawn or merge but cannot be banked again.
- **Banking cooldown:** the replacement tile, an incorrect attempt, or a timeout creates a **⌛** one-slide lock on that square (when the tile is otherwise bankable). One **successful slide** clears all these temporary locks. Other tiles remain bankable, and cancelling an attempt does not impose a penalty.
- **Game over:** you lose immediately when **Moves Left reaches zero** (balances never go negative), even if the board still has available banking or merging options. You also lose if there are no legal slides or bankable powers. A full board alone is not automatically game over. Incorrect or timed-out banking attempts do not earn moves. Breaking a blocker through correct banking reduces the **cost of later slides**.
- Moves animate briefly (170 ms). System **reduced motion** preferences disable animations. Banking timers pause while the browser tab is hidden.
- Game state, correctly banked merge credit, remaining moves and high score are saved locally in the browser. New games start with 10 moves. **Existing saved games created under the earlier automatic-merge-reward rule** keep their board, score, discoveries and historical slide count but receive a fresh ten-move balance and zero correct-bank credit; this upgrade occurs once.

## Roguelite — Passes 2–5 (Gold, shop, active items and bosses)

Select **Roguelite** for a separate 12-round run. Correctly banking a power earns **exactly its exponent in points** (for example, 7² earns 2 points). Classic scoring is unchanged. Each round has a rising target: **8, 11, 14, 17, 20, 24, 28, 33, 39, 45, 52, 60**. Every third round is labelled as a boss milestone; actual boss effects arrive in a later pass. These targets are provisional and will need balancing with the now-active item combinations.

**Gold rules (Roguelite only):**

- Around **12% of ordinary number spawns** receive a full **metallic gold tile treatment** and a **◉ coin marker**. If five successful slides have produced no gold, the next eligible spawned tile is guaranteed gold. The opening board may also contain gold. A gold tile keeps its normal base and exponent, but its metallic appearance takes priority over the ordinary base colour. Regular **base-3** tiles are now coral instead of amber so they cannot be mistaken for gold.
- Gold follows tiles as they slide. **Any golden tile can be banked directly with a correct mathematical answer**, even if it has exponent 1 or its base/exponent was banked earlier. Direct banking of gold that has not genuinely merged earns **1 coin**. Merging a gold tile makes its resulting power golden; correctly banking a genuinely merged golden power earns **2 coins**, **3 coins** for exponent 4 or higher, or **4 coins** when two gold tiles merged into double gold. Banking also earns points equal to the exponent (subject to boss/item rules). Incorrect answers and timeouts earn no points or coins.
- Banking replaces the original power with an ordinary, non-gold smaller tile. Coins cannot be collected twice from the same bank.
- Clearing a round grants **1 extra coin per unused move, capped at 5 coins**. This payout happens once, at the correct-answer bank that clears the round (after any move refund from that bank). No unused-move reward is given when a round is lost.
- The wallet, cumulative earned gold and per-round bank earnings persist across rounds and browser restarts, independently of Classic. Gold markings, temporary banking locks and the gold drought counter reset for each new round. The round-clear screen displays banked gold, unused-move bonus and their total.
- Existing Roguelite saves migrate safely; if a Pass 1 save was already at round-clear or victory, its unused-move reward is credited once on restore.

**The shop (Pass 3):**

- Clearing a non-final round reveals its gold breakdown and a **Visit shop** button. You must visit the shop before advancing to the next round, but you may continue without purchasing anything. The final round ends in victory instead of a shop.
- Each visit offers exactly **two permanent upgrades** and **two single-use items**. The catalogue contains 12 permanent and 10 single-use options with distinct active effects and coin prices. Purchasing deducts coins immediately; a purchased offer becomes sold out until rerolled.
- There are **two permanent slots** and **two single-use slots**, which persist through subsequent rounds and browser restarts. With space available, buying fills the first free slot. When both slots are occupied, the player must choose which one to replace. A permanent replacement returns half the original purchase price (rounded down), which can help finance the replacement. Consumable replacements have no refund.
- In the shop, owned permanents can be **sold for half their purchase price**; held consumables can be discarded with confirmation and no refund. Equipment is not removed at the end of the round.
- **Rerolling costs 1 coin initially**, increasing to 2, 3, etc. during that same shop visit. The cost resets on the next visit. Rerolls replace all four offer slots, including sold-out ones. Current equipped permanent upgrades will not reappear in shop stock; rerolls attempt to show different items from the previous offers.
- Coins, owned items, purchased-item prices, open shop stock, sold-out offers and reroll prices are saved locally. Existing Pass 1/2 runs are migrated without losing their boards, scores or coins.
**Active items (Pass 4):**

- **Permanent items apply automatically** as soon as purchased and equipped, for every remaining round until sold or replaced. Each bank starts with its exponent as the base score. Matching multipliers apply first (Opening Act, Twin Twos, Five Alive), then additive effects (Big Powers, Square Specialist, Variety Bonus). The banking prompt previews the total score and the confirmation explains the bonuses used.
- Golden Calculator adds **1 coin** to every correctly banked golden tile (including direct banks); Lucky Spawn increases general gold spawn probability to **27%**, and Lucky Sevens adds **30 percentage points** for base 7. Three's Company delays the next blocker by one slide after a correct bank of a genuinely merged base-3 power. Blockbuster makes genuinely merged correctly banked powers damage neighbouring blockers for two hits instead of one. Bulk Discount reduces item purchase prices by one coin, to a minimum of one, while it is equipped (not reroll fees).
- The 10 consumables are now actionable from the **two single-use slots in the Roguelite HUD**. Block Breaker destroys a selected blocker; Power Surge raises one exponent (without generating genuine merge credit); Second Wind restores two moves (up to ten); Alchemist changes a base-3 tile to base 5; Protection ignores blocker surcharges for the next two actual slides; Gold Touch gilds a tile; Position Swap exchanges two number tiles; Delay Tactics delays hazards by two slides; Clear Space removes a number tile without scoring; Second Chance unlocks a temporarily locked banking opportunity.
- Targeted consumables **highlight valid squares**. Swapping requires selecting two distinct number tiles. The Cancel button or Escape abandons the selection without losing the item. Non-targeted effects apply immediately on use. Invalid targets cannot be selected, and items cannot be spent in the shop or after game over.
- Consuming an item does **not** itself count as a swipe, a merge or a correct bank: it never directly awards exponent points, gold, correct-bank move credit or blocker strike credit. Correct banking remains required for those rewards. Swaps carry gold, merge provenance and banking locks with their tiles. Transformations preserve existing banking cooldowns while removing merge provenance.
- Temporary effects, last-bank base and per-round scoring bonus counters **reset each new round**, while equipped permanent bonuses, remaining consumables, coins and discoveries persist. Earlier Pass 1–3 saves receive safe defaults for the new counters without losing their existing run.

**Boss encounters (Pass 5):**

- **Every third round is a boss:** rounds **3, 6, 9 and 12**. A run receives four different bosses, selected in advance and saved. The first encounter uses an earlier, smaller pool; later encounters can include restrictions involving base 7 and timed powers. The upcoming boss, its full condition and any adjusted score target are **revealed in the shop immediately before that round**, allowing purchases and inventory replacements to be strategic.
- **The Blockade:** starts the round with one extra one-hit blocker, but only in a place that still leaves legal actions. It increases slide cost like other active blockers.
- **The Five Thief:** correctly banked base-5 powers score zero, regardless of bonuses; gold rewards, merge credit and blocker damage still work.
- **The Scorekeeper:** score target rises by **40%**, rounded up. The same increased target appears in both the shop preview and the gameplay HUD, and is enforced when banking.
- **The Silent Seven:** base-7 tiles cannot merge. Correctly answering and banking an existing 7 power still works, and legal-move detection honours the restriction.
- **The Power Snob:** exponent-2 powers score zero, even with permanent scoring upgrades. Correct answers still yield gold and merge/blocker credit.
- **The Timekeeper:** no restoring moves through correct-bank merge bonuses or the Second Wind consumable. Second Wind is disabled, rather than consumed uselessly. Protection still reduces blocker slide surcharges.
- **The Three Curse:** every **newly merged base-3 power** has three more successful slides to be correctly banked. Countdown markers follow the tile through movement and reset if it merges again. If it expires, it becomes a **one-hit blocker**; conversion is waived if it would exceed the two-blocker cap or leave no legal actions. Successfully banking it removes the countdown, and Alchemist can transform it into an uncursed base-5 tile.
- All boss effects are restricted to **Roguelite boss rounds**. Boss identities and active curse countdowns persist between browser sessions, and earlier Pass 1–4 saves receive a stable, repeatable boss schedule. Classic gameplay is unchanged.

**Mode selection, final scores and achievements:**

- The equal-size **Classic** and **Roguelite** cards describe their different goals at a glance: a continuous high-score challenge versus a 12-round run with bosses, gold and upgrades. Mode switches retain separate existing saves.
- Every finished game automatically opens an accessible **Final Score** screen. Classic shows the final score, personal best, slides, successful banks, highest banked exponent and blockers destroyed. Roguelite shows the cumulative run score (not merely the last round), best completed-run score, rounds reached and cleared, bosses defeated, successful banks, slides, gold earned, coins remaining, upgrade purchases and notable correct banks.
- The final screen supports **Play again** and **Back to board**, and can be reopened using **View final score**. A close choice persists through page refresh instead of reopening the dialog repeatedly.
- Roguelite features **16 permanent achievements**, with progress indicators and a gallery accessed from the mode selector. Awards cover banking, golden tiles, double-gold mergers, high exponents, large score combinations, round clears, boss victories, shopping, equipping two permanents, efficient or close-call clears, blocker damage and single-use items. Unlock notifications appear as achievements are earned, and results list all awards earned during that run.
- Achievements are stored under a **separate local storage key** so starting a new Roguelite run or switching to Classic does not wipe them. Per-run statistics survive round transitions and browser restarts. Existing saves are restored with safe defaults for stats that were not tracked by earlier releases. Awards are granted only on actual completed banking or gameplay actions, never by rereading a saved game.
- The achievement gallery displays earned badges and readable goals with progress for locked badges, rather than presenting an unexplained row of awards.

**Still to build:** Pass 6 balance and polish: simulate complete 12-round runs to tune 8–60+ targets, move budgets, boss severity, blocker arrival, gold/shop prices and UI feedback. Round targets remain provisional.

## Interface

The play screen is intentionally **focused on making decisions**, not on displaying the rulebook:

- **Always visible:** the 4×4 board, short contextual feedback, remaining moves, next-slide cost, progress toward the next bonus move, score, and keyboard/touch controls. Remaining moves is visually prominent; low-move and game-over states are distinct.
- **Only when requested:** **How to play** and **Maths help** open separate views in an accessible learning dialog. The banking question also has an optional, collapsed maths reminder.
- **Collapsed by default:** **Run details** (personal best, number banked, cumulative slides, active blockers, unlocked bases and forthcoming milestones) and **Power collection**. Expanding them does not affect the game or timer.
- **Responsive:** on a narrow screen the move budget appears immediately above the board, with expandable details below the board. Keyboard controls are disabled while the help dialog is open, and the native dialog returns focus when closed.

The panel layout is deliberately compact: a player should not need to read instructions or open statistics to complete a normal turn. New-game, banking, 60-second answer timer, blocker warnings, and save/resume behaviour are unchanged.

## Tests

Run **node tests.mjs**, **node hazards.tests.mjs**, **node roguelite.tests.mjs**, **node shop.tests.mjs**, **node effects.tests.mjs** and **node bosses.tests.mjs** (Node 18+). GitHub Actions runs all six test suites, JavaScript syntax checks and static entrypoint verification on pushes and pull requests.

The engine and hazard regression tests cover the **ten-move budget**, blocker slide costs, the maximum of 10, the rule that slides and unbanked merges never restore moves, and the rule that **only two correctly banked powers created by merging** earn one move. They also test save migration, banking lockouts, blocker mechanics, and zero-move loss conditions. The answer timer and visual effects should be manually checked on desktop and mobile.

## Technical notes

The game is plain HTML, CSS, and native JavaScript modules, with no external runtime dependencies.

- **engine.mjs:** deterministic game rules, sliding segments, blocker damage, gold metadata propagation during merges, dual spawning, power replacement and question validation.
- **roguelite.mjs:** exponent-only scoring, 12-round progression, golden spawns, coin payouts, leftover-move rewards and saved-state migration.
- **shop.mjs:** data-driven item catalogue, four-offer shop generation, purchases, permanent resale, consumable discards, rising-price rerolls and inventory/save validation.
- **shop-ui.mjs:** accessible shop offer and equipment controls, plus active consumable buttons in the Roguelite HUD.
- **effects.mjs:** pure bonus calculations, protected slides, hazard delays, gold rates, and ten targeted or immediate consumable effects, with independent tests.
- **bosses.mjs:** boss scheduling, restrictions, score/target overrides, extra blockers, timed curses and migration for existing runs.
- **milestones.mjs:** achievement catalogue, permanent progress tracking, per-run bank/shop/move stats and final-score summaries.
- **results-ui.mjs:** accessible final score and achievement gallery dialogs with earned and locked medal states.
- **app.mjs:** browser interaction, banking timer, accessible help dialog, persistent state, move-cost display and short tile animations. The HTML uses versioned script and stylesheet URLs to prevent stale modules from keeping the old layout or obsolete move rules after deployment.
- **styles.css:** responsive visual design, including reduced-motion support.

Spawn probabilities are weighted at roughly **85% base tiles, 11% discovered squares, 3% discovered cubes, 1% higher discovered powers**, automatically reweighted when a category has not been discovered. Within the base tile pool, a newly unlocked base starts at **30% of the normal per-base weighting** and ramps to equal weight across 12 successful slides. The progression stops at six bases. Blockers still progress from one to five required **correctly banked adjacent merges** across ten-slide milestones. Their cadence and the per-tier hit requirements can be adjusted after playtesting.

## Publishing

GitHub Pages uses **Settings → Pages → Build and deployment → Deploy from a branch**, with branch **main** and folder **/(root)**. The **.nojekyll** marker ensures that the supplied game entrypoint (**index.html**) is served instead of generating a README-based website.

For local development, serve the directory over HTTP, for example using **python3 -m http.server 8000**, then open http://localhost:8000/. Browser module imports may fail when directly opening a local file URL.
