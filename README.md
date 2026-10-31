# Index Shuffle

**Slide. Multiply. Discover. Bank.** A browser-based, 2048-inspired exponent game for maths students.

## Play

**Title-screen flow:** The game now opens to a dedicated title screen rather than
immediately loading the board. Choose **New Game** to see the equal-size
**Classic** and **Roguelike** mode cards, then select one to start. If you
already have an unfinished game, choose **Continue** to select the saved Classic
or Roguelike run. The most recently played mode appears first; Continue is
disabled when no unfinished saves exist. The title also gives access to
achievements and game/maths instructions.

**Saving and restarting:** Gameplay is saved locally under the existing,
separate Classic (`index-shuffle-v1`) and Roguelike
(`index-shuffle-roguelite-v1`) keys, so returning to the title does not delete
either run. The shop includes **Return to title** as well, preserving its stock,
gold and purchases; Continue returns directly to the saved shop. Starting a
new game replaces only that mode's unfinished save and requires confirmation.
All previously unlocked achievements remain. The displayed name is **Roguelike**
while the existing internal `roguelite` save format remains unchanged.


**Release reliability Pass 5A:** The game checks every owned board-rescuing
consumable before declaring a no-legal-action loss (including Block Breaker,
Clear Space, Second Chance, Gold Touch, Power Surge, Alchemist, Position
Swap, Hazard Eraser and Echo Seal). **Zero moves is still an immediate loss.**
Cancelling a timed question—including Escape or leaving for the title—locks
that tile until a successful slide. Invalid saved tiles and banking keys are
sanitised or rejected before resuming. When browser storage is blocked,
full or corrupt, a clear warning appears; playable progress is kept in memory
**for this tab only** but may be lost on reload. Merely visiting the title
screen does not create an unfinished game. Existing local-storage keys and
achievement records are preserved. See [5A QA and limitations](QA_RELEASE_5A.md).

**Release player experience Pass 5B:** New players are offered a skippable,
reopenable three-step guide to sliding, exact-value banking and earning
moves. The board provides concise rewards and event feedback, and an
optional Recent events panel keeps the last eight significant actions
across saves. End-of-run results now explain a move-budget loss versus a
board lock, show a genuine run highlight and offer a copyable plain-text
score summary. These additions do not change gameplay rules or timers.
The guide dismissal preference uses a separate local key, and older
game saves have no migration burden. See [5B QA and release checklist](QA_RELEASE_5B.md).

**Release launch checks Pass 5C:** The site now has an original
`xⁿ` favicon, canonical/share metadata, mobile safe-area and high-contrast
CSS, safer keyboard focus after boss introductions, and expanded browser
tests for 300px phones, short landscape dialogs and reduced motion.
`release-audit.tests.mjs` checks local resources, labels, baseline
contrast and asset budgets. No gameplay balance changes are introduced.
**Manual iPhone Safari, Android Chrome, VoiceOver/NVDA and representative
full-run playtests are still required before tagging an official release.**
See [Pass 5C acceptance and release checklist](QA_RELEASE_5C.md).


**Game over:** The final-score screen offers **Play again** (restart the same
mode) and **Return to title**. Once dismissed, the results can still be viewed
from the finished board. A finished/lost game is excluded from Continue; start
a new one instead.

[Launch Index Shuffle](https://chriswalker-afk.github.io/Index-Shuffle/) once the updated game is deployed to GitHub Pages. No login, backend, or build system is required.

**Visual art Pass 1 (prototype):** The [Numberworld concept gallery](https://chriswalker-afk.github.io/Index-Shuffle/art-preview.html) shows the first three original vector illustrations: the Index Merchant, The Blockade and The Five Thief. The shop banner and those two boss portraits are now wired into gameplay; the other five bosses were subsequently illustrated in Pass 3. See [art direction](assets/art/ART_DIRECTION.md) for the palette, accessibility standards and upcoming passes. No rules or save keys are changed.

**Shop visual Pass 2:** The [37-item original illustration gallery](https://chriswalker-afk.github.io/Index-Shuffle/item-gallery.html) shows every purchasable permanent, hazard-defence and single-use item. The live shop now has a character-led merchant scene, contextual dialogue, category-based offer shelves, collectible-looking item cards with clear price/discount information, improved inventory cards and compact artwork in the equipped loadout. Full descriptions, purchases, slot replacement/refunds, rerolls, accessibility labels and save data still work exactly as before. The illustrations live in a single cached SVG sprite, mapped in `shop-art.mjs`, without external images or fonts.

**Boss visual Pass 3:** The original seven bosses gained 480×480 SVG portraits. [Browse the expanded roster and preview an encounter](https://chriswalker-afk.github.io/Index-Shuffle/boss-gallery.html). Starting a boss round from the shop reveals a **skippable encounter introduction** with the boss's actual rule and target before play begins; Escape or either button dismisses it immediately. The active boss HUD and shop previews adopt boss-specific visual accents. Correctly clearing rounds 3, 6 or 9 displays a boss-defeated celebration above the regular shop reward; winning round 12 displays the final boss's defeat on the results screen. Losing never displays a victory celebration. Boss rules, save keys, timing and rewards remain unchanged. Reduced-motion preferences are honoured, and continuing a saved round never forces a repeated introduction.

**New boss — The Frostlock (October 2026):** This eighth possible opponent can be drawn on boss rounds 6, 9 or 12. It **randomly freezes one slide direction**. The frozen arrow is iced over and disabled, and the active direction is named beside the board and in the boss rule card. The same restriction applies to arrow keys, WASD and touch swipes; trying the frozen direction never costs a move or advances the board. After each successful slide, correct bank or consumed item, Frostlock changes its frozen direction. It never freezes the only possible sliding direction, and the current freeze persists through saving and resuming. The full rule is visible in the shop and boss introduction. The encounter has original [Frostlock artwork](assets/art/boss-frostlock.svg), intro/victory lines, and can be previewed in the [boss gallery](https://chriswalker-afk.github.io/Index-Shuffle/boss-gallery.html). Existing runs and the first-boss pool remain compatible; Classic is unchanged.

**World visual Pass 4:** The four Roguelike stages now have original panoramic environments: **The Observatory**, **The Mist Gardens**, **The Fracture Forge**, and **The Eclipse Vault**. The current-stage strip and its restrained panel accents update from the existing round number, while the maths board and tile colours remain untouched; Classic mode keeps its original screen. The title now shows a Numberworld gateway and illustrated four-stage journey. Each of the five square hazards has a compact original emblem in the existing overlay, warning and optional help guide, **without concealing any additional tile information**: only Cloudy hides a tile. The achievement cabinet has a new collectible presentation and **16 original medals**, rendered only for unlocked awards; locked awards retain their blacked-out/question-mark presentation and visible progress. Browse the [world and awards art gallery](https://chriswalker-afk.github.io/Index-Shuffle/world-gallery.html) without affecting saved progress. All visual enhancements are local SVG/CSS and introduce no gameplay changes.

**Round-complete intermission:** Clearing any Roguelike round from 1–11
now opens a dedicated, accessible **Round complete** pop-in. It shows the
correctly banked round score against the target, gold earned from banked
powers and unused moves, total wallet, and a three-step tracker towards
the next boss (rounds 3, 6, 9 and 12). Defeating a boss also displays
the defeated portrait and starts the next progress segment. Players
choose **Visit shop** to open the existing merchant, or **Skip shop ·
Start next round** to keep their coins and inventory and immediately
advance. Skipping generates no offers, spends nothing, awards no extra
coins and cannot be undone for that round; it still triggers any upcoming
boss intro. A secondary **Save and return to title** action preserves the
round-clear decision, which reappears after Continue or a browser refresh.
The final round 12 instead retains the full victory results screen.
No changes were made to score targets, gold payouts, movement or boss rules.

**Boss timer progression (October 2026):** Roguelike banking questions start at 60 seconds and lose 10 seconds of available answering time after each defeated boss. Rounds 4, 7 and 10 introduce 50-, 40- and 30-second limits respectively; the final boss ends the run. The current limit appears in the banking question and maths help, and defeating a boss announces the next stage's shorter timer. Timers still pause on hidden tabs, and Classic retains its original 60 seconds. Existing saved runs resume at their correct round-based limit without migrations.

**Final quality Pass 5:** The mobile gameplay page is **board-first** below 650px, with a new compact strip showing moves left, next slide cost and round target (Classic uses two columns). All 16 squares are still native buttons, with explicit row/column labels, a keyboard Skip to board link and accurately worded blocker banking instructions. The 60-second banking question now uses a **native focus-trapping dialog** and genuine `<sup>` notation (with spoken exponent text); cancelled/answered questions return keyboard focus to a sensible place. Screen-reader names never reveal a Cloudy tile. All original art remains available, but nonessential loading is deferred; movement animations are disabled for reduced-motion settings, hidden tabs and data-saving connections. The automated CI checks now include contrast and SVG payload budgets plus a **real headless Chrome smoke test at 320, 390, 650, 768 and 1200 pixels**, with workflow concurrency to avoid duplicate checks. See [Pass 5 QA and review checklist](QA_PASS5.md). Engine rules, currencies, bosses, inventory, achievements and saved-run keys are unchanged.

- **Start with 10 moves left (maximum 10).** Every successful slide costs **1 move plus 1 extra move for each active blocker** at the start of the slide: no blockers = 1 move, one blocker = 2, two blockers = 3. Warning squares don't count until the blocker appears. **Merging tiles does not automatically restore moves.** Only **correctly answering and banking two powers that were genuinely created by merging** earns one move, capped at 10. The UI shows remaining moves, 0/2 or 1/2 correct-bank progress and the next slide's cost. Banking a randomly spawned power earns score but not move credit; a spawn must be merged first to qualify. An unchanged swipe costs nothing.
- Swipe the **4×4 board**, use the arrow keys, WASD, or click the direction controls.
- Tiles with the same **base** merge by adding exponents, for example **3² × 3³ → 3⁵**. Each tile can participate in at most one merge per swipe.
- Every **successful slide** normally spawns one number tile. From **slide 40 onwards, every tenth successful slide** (40, 50, 60, …) can spawn a **second** number tile, as long as there is an empty square. The game starts with bases **2, 3, 5**, then unlocks **7 after 15 successful slides, 11 after 35, and 13 after 60** (six bases maximum). New bases start rare and increase their spawn share over the next 12 slides. Discovered higher powers can also appear as rare spawns.
- **Escalating blockers** begin at **move 10** (tier 1, one required hit), then progressively at **20** (two hits), **30** (three), **40** (four) and **50 onward** (five, the maximum). The game allows **at most two active blockers**, and only schedules another when a suitable empty square is available.
- **Next-turn warning:** at **move 9, 19, 29, 39, …**, an eligible empty square is highlighted with a yellow **! NEXT** marker. That square is reserved for one turn, cannot be entered or crossed by number tiles, and changes into the advertised blocker **on the next successful slide**. The marked square is guaranteed to be the blocker's location; if no safe place exists or the blocker cap is reached, that warning/blocker pair is skipped. Warning squares cannot be banked or damaged. Scheduling the warning preserves at least one possible swipe.
- **Breaking blockers requires a correct bank:** once active, blockers stay fixed and split rows/columns into sliding segments. **Merging alone never removes blocker health.** A genuine merged power must be **correctly banked while directly adjacent** (up/down/left/right, not diagonally) to damage a blocker by **one hit**. Bankable powers that will strike a neighbour show a distinctive **⚡** indicator. Failed answers, timeouts, ordinary slides, or banking a higher power that appeared as a random spawn do **not** cause damage. A spawned power must first be merged to become eligible for a blocker hit. A merged power retains its eligibility as it slides; the banked tile's smaller replacement does not inherit the eligibility. A single correct bank may strike two blockers if both border the banked square. Older blockers retain their original durability tier, and breaking a blocker frees its square for later turns. Existing saved three-hit blockers remain at their original difficulty.
- A glowing **✦** tile can be banked by calculating its exact value before the question timer expires. **Classic always allows 60 seconds**. In Roguelike, the limit drops by 10 seconds **after each defeated boss**: rounds 1–3 allow **60 seconds**, 4–6 **50**, 7–9 **40**, and 10–12 **30**. **Every power, including gold, can be banked only once per base–exponent combination each round.** Ordinary powers require exponent 2 or higher; Roguelike gold may also bank exponent 1 (such as 3¹). A newly golden copy of an already-banked power is **not** another banking opportunity until the next round. Other bases or exponents remain distinct.
- **Banking does not empty a square.** Banking **5⁷**, for example, scores the original power but replaces that square with a randomly selected **smaller, already unlocked power of 5**. A plain **5** (exponent 1) remains the fallback. **The replacement has a one-successful-slide banking cooldown**, so another bank is never available immediately on that tile. Banked powers can still spawn or merge but cannot be banked again.
- **Banking cooldown:** the replacement tile, an incorrect attempt, or a timeout creates a **⌛** one-slide lock on that square (when the tile is otherwise bankable). One **successful slide** clears all these temporary locks. Other tiles remain bankable, and **cancelling or leaving a banking question locks that tile until another successful slide** to prevent free timer resets.
- **Game over:** you lose immediately when **Moves Left reaches zero** (balances never go negative), even if the board still has available banking or merging options. You also lose if there are no legal slides or bankable powers **and no held consumable can restore a legal action**. A full board alone is not automatically game over. With zero moves remaining, defeat is immediate even if an item could restore the board. Incorrect or timed-out banking attempts do not earn moves. Breaking a blocker through correct banking reduces the **cost of later slides**.
- Moves animate briefly (170 ms). System **reduced motion** preferences disable animations. Banking timers pause while the browser tab is hidden.
- Game state, correctly banked merge credit, remaining moves and high score are saved locally in the browser. New games start with 10 moves. **Existing saved games created under the earlier automatic-merge-reward rule** keep their board, score, discoveries and historical slide count but receive a fresh ten-move balance and zero correct-bank credit; this upgrade occurs once.

## Enchanted Squares — Pass 4: balance and integration audit

Pass 4 prioritises fairness and test coverage over new mechanics:

- **Prism score cap:** The combined scoring multiplier from permanent
  upgrades and the Power Prism is limited to **×4**. Fixed additive
  bonuses apply after the multiplier. If the Prism would add no points,
  its on-square charge is preserved; zero-scoring bosses still take
  priority. Both the question preview and actual scoring use the
  same pure formula.
- **Economy tuning:** Twin Mint falls from **8 to 3 coins**: its single
  successfully banked double-gold merge can pay 4 coins, so purchasing it
  can now create a positive coin return. Shatter Crest falls from
  **5 to 3 coins** to remain competitive with the 2-coin Block Breaker
  while still requiring genuine merged-power correct banks near a blocker.
  The other four Runestones retain their prices and charges.
- **Rarity:** The 22% shop-stock chance, one rare reveal per visit,
  weighted Runestones and stage-specific unlocks remain unchanged.
- **Automated checks:** Deterministic seeded draws test rarity throughout
  stages 2–4; every boss is checked against capped Prism scoring;
  hazard/Runestone collisions, gold bonuses, depleted charges, older saves
  and a **synthetic** correctly-bankable 12-round progression are covered.
  These tests do **not** estimate human win rates or item pick rates.

The game keeps the same save keys and stable item IDs. Existing inventory
items retain their original price-paid history; no retroactive refunds,
free gold or new currencies are introduced. Real-player balancing,
device testing and loss-state reliability remain on the release checklist.

## Enchanted Squares — Pass 3: rarity and presentation

Pass 3 makes purchased positive squares understandable while keeping the
original mathematical banking rules and two active square limit.

- **Shop rarity:** Each refresh of consumable stock from round 4 onward has
  approximately a 22% Runestone chance, until a rare item has appeared.
  **Only one Runestone can be revealed per shop visit**, even if bought or
  followed by multiple rerolls. The reveal is recorded in the saved shop.
  Existing Pass 2 shops are migrated without replacing their offers.
  Among unlocked rare items, Foundry, Prism and Sanctuary are more common
  (weight 3), Echo and Shatter less common (weight 2), and Twin Mint the
  rarest (weight 1). Locked items are never offered early.
- **Shop clarity:** Rare items have distinct gold-and-violet card frames,
  activation labels and remaining-use previews. An optional collapsible
  Runestone field guide lists every item, artwork, trigger, charges, price
  and unlock round; locked Runestones are identified clearly.
  The shop tells players when a Runestone is in stock and when the single
  rare opportunity in that visit has already been used.
- **Board clarity:** Selecting a Runestone highlights only legal placements
  with non-intercepting outlines and a "PLACE" hint. Existing enchanted
  squares remain fixed; an unobtrusive summary shows their board positions
  and remaining charges. Tile-carried Prism marks remain distinguishable
  from board-square effects.
- **Activation feedback:** A short visual flash and explicit notice identify
  a successful enchanted merge or correct banking activation, with the
  charges remaining. Banking prompts show relevant square bonuses,
  including timed Sanctuary boosts and Prism-marked powers.
- **Accessibility:** All meanings are available in text and screen-reader
  button labels, previews capture no gestures or keyboard focus, and
  animated effects respect reduced-motion preferences. Classic mode,
  obstacles, boss restrictions and save keys are unchanged.

## Enchanted Squares — Passes 1–2

From round 4, approximately 22% of shop visits offer **one rare Runestone**
among the two consumable offers. These items occupy existing one-use slots
and enchant a chosen board coordinate without using a move. Enchantments
are independent of tiles, square hazards and blockers. At most two may
exist at once, and remaining charges disappear between rounds. Runestones
cannot be placed on active hazards, other enchantments, pending hazard
warnings, blockers or blocker-warning cells. Empty board squares are valid.

| Runestone | From | Price | Charges | Effect |
| --- | ---: | ---: | ---: | --- |
| Gilded Foundry | Round 4 | 5 | 2 | A successful merge becomes golden, or a correct bank on its square counts as gold. Already-gold powers do not spend charges. |
| Power Prism | Round 4 | 6 | 2 | A merge stores a double-score mark on its power; otherwise a correct bank on this square scores double. Already-marked powers do not double again. Zero-score boss banks do not consume a direct Prism charge. |
| Time Sanctuary | Round 4 | 5 | 2 | Opening a banking question here grants +10 seconds (maximum 60). The charge is consumed on opening regardless of success. |
| Echo Seal | Round 7 | 7 | 1 | Correctly bank one previously banked base–exponent combination again here. The usual one-slide tile lock and exact answer still apply. |
| Shatter Crest | Round 7 | 3 | 2 | Correct banking of a genuinely merged power beside a blocker adds +1 hit. May stack with Blockbuster to a maximum of 3 hits per adjacent blocker. |
| Twin Mint | Round 10 | 3 | 1 | A merge finishing here becomes double gold, upgrading ordinary gold if necessary. Cannot be activated by banking or sliding alone. |

Enchantment icons, charge badges, rare offer labels and tile-carried Prism
marks are visible on the board. Correct-answer banking remains the only
source of score, blocker damage, and merge credit. Normal gold rewards and
boss restrictions remain authoritative. Cancelled banking questions now
lock the tile until another successful slide, preventing free timer resets.
Time Sanctuary awards extra time at question open and spends one charge
immediately even if the answer is wrong, cancelled or times out.

The enchantment layer saves as an independent serializable 4×4 array and
migrates safely from Pass-1/legacy saves. Existing discoveries, currency,
inventory, hazard warnings, game modes and achievement profiles remain
unchanged. CI covers placement, charges, repeated banks, double gold,
score multipliers, shop rarity, timers, blocker hits and browser navigation.

## Square hazards — Passes 1–4 (balance, rescue and visual polish)

Square hazards are anchored to **board positions beneath numbered tiles**,
not carried by the tiles. They work only in Roguelike; Classic keeps its
original merging, banking and blocker behaviour. There are up to two active
hazards, with at most one **Null or Cracked** simultaneously.

| Hazard | Gameplay effect | Duration |
| --- | --- | --- |
| **Cloudy** | Conceals the tile's base, exponent and gold; its value cannot be banked or targeted by other tile items until it moves out or the cloud clears. Does not prevent ordinary movement or merging. | 3 successful slides |
| **Void** | A tile moving/merging onto the square loses one exponent, minimum 1, **after** the move resolves; this updated value is used for scoring and banking. | Disappears on trigger |
| **Null** | Prevents any merge that would finish on its square, but movement through or over it remains allowed. | Until erased or round ends |
| **Cracked** | Permits a merge on its square, then becomes **Null**; the triggering merge still succeeds. | Until erased or round ends |
| **Greedy** | Strips gold from each tile that travels across its square, **before** gold from merging tiles is combined. | Until erased or round ends |

**When they appear:** No square hazards in Stage 1 (rounds 1–3).
Stage 2 (rounds 4–6) introduces **Cloudy, Void, Cracked** with up to **one**
active hazard and a **21%** chance per eligible slide to schedule a warning.
Stage 3 (rounds 7–9) unlocks **all five** and allows two hazards with a
**27%** warning chance. Stage 4 (rounds 10–12) uses all five and a **32%**
warning chance. These are chances to *schedule* a warning, not guarantees
that a hazard will appear. Type selection is weighted: short-lived
Cloudy and Void are more common early; durable Null and Cracked are rarer.
Round beginnings have a short grace period, and a cooldown separates
appearances. **Boss encounters halve warning chances.**
No new hazard warning begins with three or fewer moves remaining.
Persistent Null/Cracked cannot spawn next to an active blocker or warning.
These are automated balance baselines; real-player win rates still need
manual playtesting.

**One-slide warning:** A highlighted square names the incoming hazard.
On the **next successful slide**, the hazard activates on that square,
possibly beneath an ordinary number tile. The warning does not block
sliding or add a move surcharge. Blocker warnings cannot overlap a hazard
and an incoming hazard cannot appear on an existing blocker or fixed
warning. The scheduler checks for at least one legal action before
placing a hazard; placement fizzles out if unsafe. The on-board status
names the hazard and gives its row/column, with an optional guide button.
Cloudy slide animations conceal both the value and the gold/base colour.

**Shop counter:** **Hazard Eraser** is an 11th single-use consumable costing
**3 coins** (subject to shop discounts). It removes one selected active
hazard, whether or not a number tile occupies that square. It uses no
moves and never changes the underlying number, exponent, bank provenance,
score, coins or gold status. It occupies one of the existing two
consumable slots; **Block Breaker** remains the separate tool for actual
blockers. Cloudy remains selectable while using Hazard Eraser; it never
reveals the covered tile. If a held Eraser can restore a legal bank/slide,
that otherwise-locked board is not prematurely declared game over.
Zero moves still ends the game immediately.

**Persistence:** A separate 16-entry `hazards` array and the pending
hazard warning/cooldown survive browser refreshes and Continue. Earlier
saves lacking the new fields migrate safely. Hazards and hazard warnings
reset when the next round begins, while the player's gold, items, bosses
and cumulative score remain.

**Pass 4 validation:** Seeded automated simulations compare hazard warnings
in representative 10-move Stage 1–4 rounds, including bosses. Regression
tests cover late-round pressure, blocker adjacency, impossible Three Curse
banking, unique gold banking, Eraser rescue and Cloudy secrecy. These
simulations **do not model human strategy or prove 12-round win rates**.

**Remaining after Pass 4:** Manual full-run playtesting (especially boss/shop
builds), mobile visual review, and subsequent tuning from observed results.

## Roguelite — Passes 2–5 (Gold, shop, active items and bosses)

Select **Roguelite** for a separate 12-round run. Correctly banking a power earns **exactly its exponent in points** (for example, 7² earns 2 points). Classic scoring is unchanged. Each round has a rising target: **8, 11, 14, 17, 20, 24, 28, 33, 39, 45, 52, 60**. Every third round is labelled as a boss milestone; actual boss effects arrive in a later pass. These targets are provisional and will need balancing with the now-active item combinations.

**Gold rules (Roguelite only):**

- Around **12% of ordinary number spawns** receive a full **metallic gold tile treatment** and a **◉ coin marker**. If five successful slides have produced no gold, the next eligible spawned tile is guaranteed gold. The opening board may also contain gold. A gold tile keeps its normal base and exponent, but its metallic appearance takes priority over the ordinary base colour. Regular **base-3** tiles are now coral instead of amber so they cannot be mistaken for gold.
- Gold follows tiles as they slide. **Golden tiles can be banked directly with a correct mathematical answer**, including at exponent 1, **but only when the same base–exponent has not already been banked in the current round**. An already-banked golden power displays a check mark instead of suggesting another reward; merge it into a different exponent to create a new opportunity. Direct banking of otherwise-unmerged gold earns **1 coin**. Correctly banking merged gold earns **2 coins**, **3 coins** for exponent 4 or higher, or **4 coins** when two gold tiles merged into double gold. Banking also scores the exponent (subject to boss/item rules). Incorrect answers, timeouts and repeated banked values earn no points or coins.
- Banking replaces the original power with an ordinary, non-gold smaller tile. Coins cannot be collected twice from the same bank.
- Clearing a round grants **1 extra coin per unused move, capped at 5 coins**. This payout happens once, at the correct-answer bank that clears the round (after any move refund from that bank). No unused-move reward is given when a round is lost.
- The wallet, cumulative earned gold and per-round bank earnings persist across rounds and browser restarts, independently of Classic. Gold markings, temporary banking locks and the gold drought counter reset for each new round. The round-clear screen displays banked gold, unused-move bonus and their total.
- Existing Roguelite saves migrate safely; if a Pass 1 save was already at round-clear or victory, its unused-move reward is credited once on restore.

**Permanent hazard-defence upgrades (new):**

The shop now contains **eight additional permanents** which defend against
hazards instead of directly improving points, moves or gold. All eight occupy
the existing **two permanent slots**, so buying hazard protection means
sacrificing a potential scoring or economy bonus. Their effects combine
with one another if both slots contain compatible defences.

| Permanent item | Gold | Partial protection |
| --- | ---: | --- |
| **Storm Shelter** | 8 | Each eligible slide has 30% less chance of scheduling a hazard warning (also during bosses). |
| **Mist Filter** | 4 | Cloudy's type-selection weight is 65% lower; Cloudy can still appear. |
| **Fracture Ward** | 6 | Null and Cracked have 60% lower selection weights; neither is eliminated. |
| **Gilded Compass** | 5 | Greedy's type-selection weight is 70% lower. |
| **Hazard Tamer** | 8 | New Null warnings become Cracked, and Cracked warnings become Void. The replacement still has its normal dangerous effect. |
| **Fog Lantern** | 5 | Newly appearing Cloudy lasts two successful slides, not three. Banking remains prohibited while a tile is covered. |
| **Void Cushion** | 5 | Void cannot reduce exponent 2 to 1; exponent 3 and higher still lose one, and Void is still consumed. |
| **Gilded Soles** | 5 | Gold survives travelling *through* Greedy, but not *landing* on it (including as the result of a merge). |

These upgrades are **stage-gated**. Six counters for Cloudy, Void, Cracked
and general hazard pressure can first appear in the shop **after round 3**
(ahead of Stage 2). Greedy-specific counters begin in the shop **after round
6** (ahead of Stage 3). Items are added to the ordinary randomized shop
pool; four stock positions per shop (two permanents, two consumables)
and the rising-cost reroll remain unchanged. A saved open shop keeps its
existing offers across the update, and all items are stored by stable ID.
A reduced type-selection *weight* is not an identical percentage reduction
in final probability because the other eligible types are reweighted.
No counter provides blanket hazard immunity, and none changes Classic mode.

**The shop (Pass 3):**

- Clearing a non-final round reveals its gold breakdown and a **Visit shop** button. You must visit the shop before advancing to the next round, but you may continue without purchasing anything. The final round ends in victory instead of a shop.
- Each visit offers exactly **two permanent upgrades** and **two single-use items**. The catalogue contains 20 permanent and 11 single-use options with distinct active effects and coin prices. Purchasing deducts coins immediately; a purchased offer becomes sold out until rerolled.
- There are **two permanent slots** and **two single-use slots**, which persist through subsequent rounds and browser restarts. With space available, buying fills the first free slot. When both slots are occupied, the player must choose which one to replace. A permanent replacement returns half the original purchase price (rounded down), which can help finance the replacement. Consumable replacements have no refund.
- In the shop, owned permanents can be **sold for half their purchase price**; held consumables can be discarded with confirmation and no refund. Equipment is not removed at the end of the round.
- **Rerolling costs 1 coin initially**, increasing to 2, 3, etc. during that same shop visit. The cost resets on the next visit. Rerolls replace all four offer slots, including sold-out ones. Current equipped permanent upgrades will not reappear in shop stock; rerolls attempt to show different items from the previous offers.
- Coins, owned items, purchased-item prices, open shop stock, sold-out offers and reroll prices are saved locally. Existing Pass 1/2 runs are migrated without losing their boards, scores or coins.
**Active items (Pass 4):**

- **Permanent items apply automatically** as soon as purchased and equipped, for every remaining round until sold or replaced. Each bank starts with its exponent as the base score. Matching multipliers apply first (Opening Act, Twin Twos, Five Alive), then additive effects (Big Powers, Square Specialist, Variety Bonus). The banking prompt previews the total score and the confirmation explains the bonuses used.
- Golden Calculator adds **1 coin** to every correctly banked golden tile (including direct banks); Lucky Spawn increases general gold spawn probability to **27%**, and Lucky Sevens adds **30 percentage points** for base 7. Three's Company delays the next blocker by one slide after a correct bank of a genuinely merged base-3 power. Blockbuster makes genuinely merged correctly banked powers damage neighbouring blockers for two hits instead of one. Bulk Discount reduces item purchase prices by one coin, to a minimum of one, while it is equipped (not reroll fees).
- The 17 consumables are now actionable from the **two single-use slots in the Roguelite HUD**. Block Breaker destroys a selected blocker; Power Surge raises one exponent (without generating genuine merge credit); Second Wind restores two moves (up to ten); Alchemist changes a base-3 tile to base 5; Protection ignores blocker surcharges for the next two actual slides; Gold Touch gilds a tile; Position Swap exchanges two number tiles; Delay Tactics delays blockers by two slides; Clear Space removes a number tile without scoring; Second Chance unlocks a temporarily locked banking opportunity; Hazard Eraser removes one selected square hazard without spending a move.
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
- **The Frostlock:** one randomly chosen direction is frozen: that on-screen arrow is visibly disabled and the corresponding keyboard shortcut or swipe does nothing. A blocked attempt costs **zero moves**. After any successful slide, correct bank or used item, a new safe direction freezes. The only direction capable of sliding is never locked, and the chosen freeze is saved with the run. Appears only on rounds **6, 9 or 12**.
- All boss effects are restricted to **Roguelite boss rounds**. Boss identities, curse countdowns and Frostlock's active frozen direction persist between browser sessions. Earlier saves retain their existing boss schedules; new schedules select from eight bosses without repeating one in the same run. Classic gameplay is unchanged.

**Mode selection, final scores and achievements:**

- The equal-size **Classic** and **Roguelike** cards are shown after selecting **New Game** on the title screen, not above the live board. They explain the continuous high-score challenge versus the 12-round boss/shop run. Each mode's unfinished save is preserved until the player explicitly starts a replacement.
- Every finished game automatically opens an accessible **Final Score** screen. Classic shows the final score, personal best, slides, successful banks, highest banked exponent and blockers destroyed. Roguelite shows the cumulative run score (not merely the last round), best run score, rounds reached and cleared, bosses defeated, successful banks, slides, gold earned, coins remaining, upgrade purchases and notable correct banks.
- The final screen offers **Play again** or **Return to title**. Its optional close control lets players review the finished board and reopen **View final score**. Returning to the title never restarts the game accidentally.
- Roguelite features **16 permanent achievements**, with progress indicators and a gallery accessed from the mode selector. Awards cover banking, golden tiles, double-gold mergers, high exponents, large score combinations, round clears, boss victories, shopping, equipping two permanents, efficient or close-call clears, blocker damage and single-use items. Unlock notifications appear as achievements are earned, and results list all awards earned during that run.
- Achievements are stored under a **separate local storage key** so starting a new Roguelite run or switching to Classic does not wipe them. Per-run statistics survive round transitions and browser restarts. Existing saves are restored with safe defaults for stats that were not tracked by earlier releases. Awards are granted only on actual completed banking or gameplay actions, never by rereading a saved game.
- The achievement gallery displays earned badges and readable goals with progress for locked badges, rather than presenting an unexplained row of awards.

**Still to verify with real players:** Human win rates, difficulty by stage, and first-play comprehension. The deterministic 12-round progression test validates integration, not realistic win probability.

## Interface

The play screen is intentionally **focused on making decisions**, not on displaying the rulebook:

- **Always visible:** the 4×4 board, short contextual feedback, remaining moves, next-slide cost, progress toward the next bonus move, score, and keyboard/touch controls. Remaining moves is visually prominent; low-move and game-over states are distinct.
- **Only when requested:** **How to play** and **Maths help** open separate views in an accessible learning dialog. The banking question also has an optional, collapsed maths reminder.
- **Collapsed by default:** **Run details** (personal best, number banked, cumulative slides, active blockers, unlocked bases and forthcoming milestones) and **Power collection**. Expanding them does not affect the game or timer.
- **Responsive:** on a narrow screen the move budget appears immediately above the board, with expandable details below the board. Keyboard controls are disabled while the help dialog is open, and the native dialog returns focus when closed.

The panel layout is deliberately compact: a player should not need to read instructions or open statistics to complete a normal turn. New-game, banking, 60-second answer timer, blocker warnings, and save/resume behaviour are unchanged.

## Tests

Run **node tests.mjs**, **node hazards.tests.mjs**, **node roguelite.tests.mjs**, **node shop.tests.mjs**, **node effects.tests.mjs**, **node bosses.tests.mjs** and **node frostlock.tests.mjs** (Node 18+). GitHub Actions runs all six test suites, JavaScript syntax checks and static entrypoint verification on pushes and pull requests.

The engine and hazard regression tests cover the **ten-move budget**, blocker slide costs, the maximum of 10, the rule that slides and unbanked merges never restore moves, and the rule that **only two correctly banked powers created by merging** earn one move. They also test save migration, banking lockouts, blocker mechanics, and zero-move loss conditions. The answer timer and visual effects should be manually checked on desktop and mobile.

## Technical notes

The game is plain HTML, CSS, and native JavaScript modules, with no external runtime dependencies.

- **engine.mjs:** deterministic game rules, sliding segments, blocker damage, gold metadata propagation during merges, dual spawning, power replacement and question validation.
- **roguelite.mjs:** exponent-only scoring, 12-round progression, golden spawns, coin payouts, leftover-move rewards and saved-state migration.
- **shop.mjs:** data-driven item catalogue, four-offer shop generation, purchases, permanent resale, consumable discards, rising-price rerolls and inventory/save validation.
- **shop-ui.mjs:** accessible shop offer and equipment controls, plus active consumable buttons in the Roguelite HUD.
- **effects.mjs:** pure bonus calculations, protected slides, hazard delays, gold rates, and ten targeted or immediate consumable effects, with independent tests.
- **bosses.mjs:** boss scheduling, restrictions, score/target overrides, extra blockers, timed curses, Frostlock's fair random freeze and migration for existing runs.
- **hazards.mjs:** independent 4×4 hazard data, exact slide effects, stage-scaled warnings, safe placement and migration.
- **hazard-ui.mjs:** non-interactive stationary hazard/warning overlay renderer and accessible non-revealing descriptions.
- **milestones.mjs:** achievement catalogue, permanent progress tracking, per-run bank/shop/move stats and final-score summaries.
- **results-ui.mjs:** accessible final score and achievement gallery dialogs with earned and locked medal states.
- **navigation.mjs:** pure title-screen save eligibility and Continue summaries, preserving the legacy Roguelite save format.
- **title-ui.mjs:** accessible title/New Game/Continue scene presentation and saved-run selection.
- **app.mjs:** browser interaction, banking timer, accessible help dialog, persistent state, move-cost display and short tile animations. The HTML uses versioned script and stylesheet URLs to prevent stale modules from keeping the old layout or obsolete move rules after deployment.
- **styles.css:** responsive visual design, including reduced-motion support.
- **qa/browser-smoke.html:** no-package-dependency, headless-Chrome browser tests for title, native banking dialog, tile semantics, stage panel and mobile/desktop widths.
- **quality-pass5.tests.mjs:** automated maths contrast, accessibility, asset weight and responsive wiring checks.
- **QA_PASS5.md:** scope, automated verification and brief manual device checklist.

Spawn probabilities are weighted at roughly **85% base tiles, 11% discovered squares, 3% discovered cubes, 1% higher discovered powers**, automatically reweighted when a category has not been discovered. Within the base tile pool, a newly unlocked base starts at **30% of the normal per-base weighting** and ramps to equal weight across 12 successful slides. The progression stops at six bases. Blockers still progress from one to five required **correctly banked adjacent merges** across ten-slide milestones. Their cadence and the per-tier hit requirements can be adjusted after playtesting.

## Publishing

GitHub Pages uses **Settings → Pages → Build and deployment → Deploy from a branch**, with branch **main** and folder **/(root)**. The **.nojekyll** marker ensures that the supplied game entrypoint (**index.html**) is served instead of generating a README-based website.

For local development, serve the directory over HTTP, for example using **python3 -m http.server 8000**, then open http://localhost:8000/. Browser module imports may fail when directly opening a local file URL.
