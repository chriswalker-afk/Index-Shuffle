# Enchanted Squares — Pass 4 balance and integration review

This is a **deterministic regression audit** of the current six Runestones,
not a claim of verified human win rates or perceived difficulty. All tests
run using Node 22 in GitHub Actions alongside the existing browser smoke test.

## Final tuning decisions

| Runestone | Unlock | Price | Charges | Rationale |
| --- | ---: | ---: | ---: | --- |
| Gilded Foundry | 4 | 5 | 2 | Two planned merged banks can return up to 6 gold |
| Power Prism | 4 | 6 | 2 | Powerful scoring boosts, with **×4 combined multiplier cap** |
| Time Sanctuary | 4 | 5 | 2 | Two +10-second banking opportunities; maximum 60 seconds |
| Echo Seal | 7 | 7 | 1 | One repeat bank on a previously banked power |
| Shatter Crest | 7 | **3** | 2 | Two tactical extra blocker hits, instead of 5-gold price |
| Twin Mint | 10 | **3** | 1 | One double-gold merge can return 4 gold, instead of 8-gold price |

Permanent multiplicative bonuses and Prism are composed to a maximum
of ×4, with additive item points applied afterwards. A direct Prism
square's charge is not spent when it cannot increase points (including
the cap or a zero-score boss). A marked power still banks normally.

## Automatic tests

- **Rarity:** 8,100 seeded shop visits across the nine eligible
  next-round shops (4–12); unlocked rarity weighting and single rare
  reveal are checked. Observed occurrence rates are bounded near the
  advertised 22% per refresh. No claim is made about purchase rates.
- **Bosses:** All eight boss rules, including Five Thief, Power Snob
  and Timekeeper, are covered by independent bank-and-score assertions.
- **Gold/merges:** Foundry, Golden Calculator and Twin Mint gold
  accounting; wrong answers cannot score; exhausted charges stay gone.
- **Hazards:** Active hazards prevent Runestone placement and incoming
  warnings cannot mature on enchanted cells.
- **Stage progression:** A synthetic 12-round correct-bank route
  validates phase transitions, shop inventory, reset layers and the
  60/50/40/30-second countdown stages.
- **Saves:** JSON-compatible enchantments and legacy pricePaid=8
  Twin Mint inventory migrate without extra currency or refunds.
- **UI:** The existing headless Chrome smoke suite covers
  layout and banking dialogue across 320–1200px.

## Still needed before a public classroom release

Pass 5A should audit **all inventory rescue opportunities** against the
game-over decision, report local-storage failures to the player, and
complete a save/restore stress test. Pass 5B should test first-play
comprehension, boss/shop interaction feedback and end-of-run clarity.
Pass 5C should finish mobile Safari/Android real-device and keyboard/
screen-reader checks, then release-tag the tested commit.

Do not interpret a synthetic 12-round route as a realistic win
probability. Test human play over representative difficulty levels
before changing base scoring targets or hazard pressure.
