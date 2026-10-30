# Index Shuffle · Pass 5 quality assurance

**Status:** Implementation complete. Existing gameplay regressions, local
source-contract tests and headless Chrome browser checks run via
`.github/workflows/test.yml`.

This pass deliberately changed presentation and accessibility only. There
were **no changes** to the mathematics engine, randomness, boss conditions,
shop pricing, achievement thresholds or serialized save formats.

## What the pass fixes

| Concern | Resolution | Verification |
| --- | --- | --- |
| Phone board pushed below a tall HUD | Board-first layout at widths ≤650px; concise move budget and target above the board | Headless Chrome position checks at 320, 390, 650px |
| Classic had an empty round-target slot | Two-column compact HUD for Classic; three fields for Roguelike | Browser smoke and CSS contract |
| Screen-reader grid-cell semantics masked button actions | Board is a named group of 16 native buttons with row and column on each name | Browser smoke tests roles and all 16 names |
| Keyboard users must traverse the whole HUD | Visible-on-focus "Skip to the maths board" link | Source contract and focusable board |
| Timed banking popup had no native focus containment | Native HTML dialog, Escape/cancel handling, keyboard focus restored after banking | Browser smoke opens, focuses and closes dialog; source tests verify timer cleanup |
| Mathematical prompt used Unicode exponent glyphs | Genuine semantic superscript + full spoken exponent name | Source contract and six-colour contrast budget |
| Bank icon could cover exponent / hazard symbol | Bank marker moved down; hazard bankability uses outline without overlapping impact badge | CSS checks; board/overlay remain click-through |
| Art loading and motion overhead | Lazy nonessential images; stage art assigned on demand; data saver, reduced motion and background tabs skip slide animations | Source/asset budgets and reduced-motion checks |
| Repeated pull-request builds caused queueing | Cancel superseded workflow jobs by branch | GitHub Actions concurrency |

## Automated checks

**Node tests:** The existing engine, Roguelike, hazard, boss, shop, effects,
achievement, title navigation and artwork tests are still run. The new
`quality-pass5.tests.mjs` checks important DOM and CSS contracts, 4.5:1
contrast for the six number-tile base colours, local graphic file size
limits, and presentation-only loading behaviour.

**Browser smoke:** `qa/browser-smoke.html` is a dependency-free test page.
GitHub Actions serves the project locally and opens the actual game in
headless Google Chrome. It checks the title, new-game flow, Classic,
Roguelike, real 16-button board, row/column labels, native banking modal,
current-stage scene, duplicate summary values and responsive positions
at **320, 390, 650, 768, and 1200 CSS pixels**. It checks for horizontal
overflow at each width. It never modifies the mathematical model directly
and does not rely on test-only game shortcuts.

**SVG and code checks:** Node syntax checks, XML parsing for all shop/boss/
stage/hazard/award art, a no-external-asset contract, and the standard
static GitHub Pages file checks remain in CI.

## Manual checks still recommended

These cannot be certified by a headless Chrome smoke test. Use real
devices or assistive technology before a high-stakes school-wide rollout.

- At 200% and 400% zoom, check the title, move status, board and long
  shop replacement labels for clipping or horizontal scrolling.
- On an iPhone Safari and an Android Chrome device, try swiping the
  board, selecting a bankable tile, closing a question, and scrolling
  the shop on narrow screens.
- With a physical keyboard, use **Skip to the maths board**, Tab to a
  bankable tile, open the question, try Escape/Cancel and verify the focus
  returns to an actionable tile or the board.
- With VoiceOver/NVDA, verify row-and-column tile labels, the spoken
  exponent, move status, full boss rule, announcements and native dialog
  focus. Check that Cloudy never speaks concealed tile contents.
- On a boss round and a shop visit, confirm artwork stays decorative
  while move cost, hazards, item effects and score targets are clear.
- Under operating system **Reduce Motion**, check that tiles do not
  animate and that the board remains responsive.
- Check a fresh player session and a saved Roguelike / Classic
  continuation. Save keys and game state are intentionally unchanged.

## Review links

- [Play the game](https://chriswalker-afk.github.io/Index-Shuffle/)
- [Visual identity](https://chriswalker-afk.github.io/Index-Shuffle/art-preview.html)
- [Shop icons](https://chriswalker-afk.github.io/Index-Shuffle/item-gallery.html)
- [All bosses](https://chriswalker-afk.github.io/Index-Shuffle/boss-gallery.html)
- [Stage/hazard/medal gallery](https://chriswalker-afk.github.io/Index-Shuffle/world-gallery.html)
