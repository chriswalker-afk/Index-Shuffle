# Index Shuffle — Release Candidate Pass 5B: player experience

This pass is exclusively a presentation and comprehension update. It does
not change scoring, bank answers, timers, difficulty, item inventory,
bosses, shop economy, achievements or the original save keys.

## What players now see

1. **Optional first-game tour.** The first newly started game offers an
   unobtrusive three-step panel covering matching-base slides, exact
   power banking and move recovery/blocker mechanics. It is skippable,
   never covers or traps the board, and can be reopened through
   **Quick tour** above the board. Once completed/skipped, a tiny
   preference key `index-shuffle-tour-seen-v1` prevents it from
   interrupting later new games. Resumed runs never auto-open the tour.
   The content is a reference, not an extra game mechanic.
2. **Clearer feedback.** Merges announce that new powers were made;
   correct banks briefly show real point/gold/move/blocker rewards.
   Short hazard/Runestone notices use the same restrained cue.
   Effects are entirely CSS, skip entrance animations for reduced
   motion, and cannot intercept board input.
3. **Optional event history.** A closed-by-default Recent events panel
   records up to eight meaningful actions: merges, correct banks,
   gold rewards, blocker interactions, hazards, Runestones, items,
   shop purchases and round transitions. Activity is recorded only
   when gameplay occurs, never from re-rendering. It is stored in
   the existing mode's save under the optional `activity` array and
   safely validated on restore; older saves simply begin empty.
   Entries are created with `textContent`, never as HTML.
4. **End-of-run presentation.** The final dialog identifies
   **Out of moves** versus **No legal actions left**, or acknowledges
   a genuinely completed twelve-round victory. It highlights a
   real measured statistic and includes a collapsed **Share your run**
   section with a selectable, text-only summary. Copy uses the
   browser clipboard when permitted; otherwise it selects the text
   and offers manual copy. A restrained two-cycle victory glow honours
   reduced-motion preferences. Boss-defeated artwork still appears
   only after actual victory.

## Tests and constraints

- `experience.tests.mjs` checks three-step content, eight-event limit,
  invalid/legacy history handling, score/reward text, factual loss/victory
  reasons and copyable results in both game modes.
- Existing full game/shop/hazard/boss tests are unchanged.
- The headless Chrome smoke suite now exercises first-run/skip/reopen
  guide controls; accessible history and persistence; an actual
  final-move loss; meaningful final-screen labels and share data.
- Focus order, native banking dialog, keyboard controls, local storage
  protection and the distinct Classic/Roguelike save slots remain
  unchanged.
- No audio, external assets, large animation dependencies or new
  randomness are introduced.

## Next: Pass 5C — final release checks

1. Validate on real iPhone Safari, Android Chrome and school laptops,
   including touch scrolling, 320px layout and keyboard-only navigation.
2. Check VoiceOver/NVDA labels, contrast, reduced motion, modal focus,
   clock/pause behaviour and the results-copy fallback.
3. Manually replay representative complete 12-round runs with bosses
   and enchanted squares. Existing deterministic tests do not measure
   actual player win rates or comprehension.
4. Check all wording, cache busting and page metadata, then select,
   tag and publish a release-candidate commit. Freeze new gameplay
   mechanics unless playtesting identifies a serious blocker.
