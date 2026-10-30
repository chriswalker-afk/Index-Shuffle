# Index Shuffle — Release Candidate Pass 5A: reliability

## Scope and decisions

This pass addresses fairness, storage and restoration, not new bosses,
currency or scoring systems. The underlying moves, rounds, hazards,
Runestones and all four existing browser save keys remain unchanged.

### 1. No premature losses when an owned item could help

If the move count is positive but the board has no legal slide or bank,
the game evaluates the player's actual inventory and **simulates valid
targets** before declaring defeat. The following are considered only if
their real item action can restore a legal slide or banking choice:

- Block Breaker, Hazard Eraser, Clear Space;
- Second Chance (including a locked golden exponent-one or Echo bank);
- Power Surge, Alchemist, Gold Touch and Position Swap;
- Echo Seal (when its placement creates a valid repeat bank).

The simulation does not spend an item, award moves or score points. It
preserves boss movement restrictions, hazard layers, enchantments and
temporary banking locks. The HUD tells the player which owned item can
save the run. **Moves Left = 0 remains an immediate loss** even when an
item is held. Other items do not falsely keep an impossible board alive.
The pre-existing Hazard Eraser helper remains independently covered.

### 2. No free banking timer resets

An incorrect answer, timeout, Cancel, Escape or leaving for the title/
another game all lock that banking square until one successful slide.
The tile and game progress remain, and no gold/score is awarded.
Canceling a *consumable target selection* is still free and never
consumes the item.

### 3. Durable saves and transparent failure

- A new browser visit starts at the title without writing a phantom
  unfinished game. Only actual gameplay/final-state actions save a run.
- Storage access is performed through a safe adapter. Private browsing,
  security exceptions, unavailable storage and quota errors cannot crash
  the game.
- A prominent accessible warning appears whenever game progress cannot
  be saved durably. The in-tab backup allows Continue while the page
  remains open. **It does not survive refresh, closing the tab, or
  eviction**. The warning clears when durable game/achievement writes
  resume successfully.
- Corrupt JSON is rejected without overwriting the other game mode or
  achievements. Malformed 4×4 tiles, saved banking keys and coordinates
  are rejected or sanitised before being rendered; legacy blocker
  records without a strength remain valid.
- The game keeps Classic and Roguelike saves independent, with the
  same identifiers and no new score or inventory migrations.

## Verification

- `node rescue.tests.mjs`: blocked checkerboard scenarios exercise
  every potentially rescuing item, false-rescue protection, zero-move
  loss and the fact that rescue checks do not spend consumables.
- `node save-safety.tests.mjs`: quota/security failures, in-tab recovery,
  corrupt JSON, valid/invalid boards, legacy compatibility and stale
  banking metadata.
- Headless Chrome smoke checks: no title phantom save, actual Classic/
  Roguelike continuation, Frostlock persistence, a simulated blocked
  storage write, visible warning and restoration from in-tab memory.
- All existing engine, boss, hazard, shop, achievement, artwork and
  visual/browser regression checks remain enabled in CI.

## Still on the release checklist

**Pass 5B** — Optional brief first-play guidance, clearer merging/banking/
blocker/hazard feedback, a short activity history and satisfying but
restrained end-of-run presentation.

**Pass 5C** — Final real-device mobile Safari/Android Chrome keyboard/
screen-reader testing, review of long-session performance, final copy
and accessibility, and release tagging. These require actual devices
and classroom feedback; automated Chrome alone cannot certify them.
