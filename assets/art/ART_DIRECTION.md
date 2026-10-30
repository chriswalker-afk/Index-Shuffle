# Index Shuffle · Numberworld art direction

Status: **Passes 1–4 artwork complete**: character art, illustrated shop, boss scenes and world environments. This guide is the single
source of truth for visual design decisions in later passes.

## Concept: The Curious Numberworld

A warm, slightly eccentric mathematical roguelike with collectible curios,
unusual opponents and tactile tile objects. Artwork has character, but **the
mathematical board stays clean and legible**. We use original vector drawings
rather than copied images or characters from existing games.

**Visual hierarchy:** tile values, move budget, and hazard warnings first;
boss rule text, item cost/effect and shop actions second; atmosphere third.

## Palette

| Token | Hex | Role |
| --- | --- | --- |
| Midnight ink | `#152638` | Illustration contours, deepest shadows |
| Navy | `#152337` | Default backgrounds |
| Jade | `#7de0cd` | Gameplay success and mathematics |
| Aged gold | `#e8bb6f` | Merchant, gold and collectible treasures |
| Dusky violet | `#795b97` | Roguelike magic / whimsical character accents |
| Ember rose | `#d88f8d` | Boss threat / confrontation, not error text |
| Parchment | `#f9e9cf` | Illustration facial highlights and focal points |
| Stone blue | `#6e7788` | Armoured enemies and blocker surfaces |

The site retains its existing text, board, danger and accessibility tokens.
These are illustration colours, *not* replacements for accessible UI colours.

## Illustration specification

- Illustrate on a **480 × 480 SVG viewBox**, with a 36-unit rounded dark
  vignette, centered focal character and generous safe margin (about 24 units).
- Use chunky, rounded near-black outlines (normally 5–9 units), broad
  geometric silhouettes, restrained highlight gradients, warm foreground
  lighting and small number-themed motifs.
- Keep expressive features readable when portraits are reduced to 64–96px.
  Do not place important words in the art: labels and rules stay in HTML.
- The shop is warm and friendly; boss portraits are tenser, with dramatically
  distinct silhouettes. The base math board is not illustrated.
- Use real image alternative text in the UI, respect `[hidden]`, and avoid
  animated SVG, external URLs, embedded fonts or scripts.
- When scaled small, the portrait is optional, never a substitute for the
  boss name, rule, score target, purchase description or keyboard controls.
- Prefer compact standalone SVGs over raster assets and external services.
  Keep the game playable offline and under reduced-motion preferences.

## Prototype character briefs

1. **Index Merchant:** a friendly clockwork owl in a violet cap, selling
   polished number curios from a brass-and-wood stall; warm gold/navy.
2. **The Blockade:** a weighty stone guardian with a blocky silhouette,
   glowing eyes and a carved power, showing the extra obstruction rule.
3. **The Five Thief:** a quick mischievous masked trickster, hood and stolen
   `5` coins, communicating that base-5 points are stolen.

## Source assets and wiring

- `assets/art/index-merchant.svg` — portrait/shop atmosphere
- `assets/art/boss-blockade.svg` — boss ID `blockade`
- `assets/art/boss-five-thief.svg` — boss ID `five-thief`
- `art-catalog.mjs` — immutable mappings and safe missing-portrait fallback
- `art-preview.html` — static concept gallery for reviewing the first pass

Existing boss definitions, item IDs, score logic, saves and economy were not
changed by Pass 1. All seven current bosses now have portraits (see Pass 3).

## Pass 2 · Illustrated shop (complete)

- `assets/art/item-sprites.svg`: 31 original symbolic mini-illustrations,
  each under a stable `item-<item id>` SVG symbol. The sprite uses one
  network asset and no external images, scripts, fonts, or animation.
- `shop-art.mjs`: deterministic icon hrefs with a neutral fallback,
  plus visual type classification (permanent / ward / consumable).
  Every item ID has a dedicated symbol and automated coverage tests.
- `shop-ui.mjs`: icon frames, two labelled shelves (permanents and
  consumables), true discounted prices, clear replacement and resale
  actions, compact owned-item iconography and illustrated equipped chips.
  All price arithmetic and the game economy stay in `shop.mjs`.
- Merchant quotes are short, keyed to the upcoming round, and never
  chosen randomly or stored in saves. Boss round previews retain
  their explicit rule and score target.
- The shop help is collapsed by default, but the essential permanent/
  single-use distinction stays visible. Full item effects remain
  visible on the cards; icon shapes are never the sole source of meaning.
- Visual frame colours identify **functional types**, not invented
  item rarities: gold = permanent relic, purple = consumable tool,
  jade = hazard defence. Existing `hazardCounter` rules remain.
- Mobile cards stack, inventory columns collapse, the shop continues
  to scroll, and the sticky shop actions remain visible. Focus, disabled
  states, `[hidden]` fallbacks, accessible text and reduced-motion
  behaviour are preserved.
- `item-gallery.html`: an optional visual-review gallery for all
  31 items without needing to reach an in-game shop.

## Pass 3 · Boss encounters (complete)

- **Seven original characters** in `assets/art/boss-*.svg`, including the
  five new portraits for The Scorekeeper, The Silent Seven, The Power Snob,
  The Timekeeper and The Three Curse. All are original 480×480 standalone
  SVGs, with readable silhouettes at HUD scale, meaningful art alt text
  and no external references, scripts, fonts or animation.
- `art-catalog.mjs` is now a complete boss-ID-to-portrait map with an
  explicit missing-ID fallback. Boss names, scheduling and rules remain
  defined exclusively in `bosses.mjs`.
- `boss-scenes.mjs` provides separate, short flavour lines for each
  encounter and defeat; these **never modify rules**.
- Beginning any boss round **from the shop** shows a native, accessible,
  skippable encounter dialog with illustration, boss name, full current
  rule and required target. The round has already started; closing this
  modal simply exposes the unchanged playable board. Escape, Skip intro
  and Begin boss round dismiss it without timers, moves, costs or flags.
- Continuing a saved run mid-boss **does not repeat** the introduction.
  Returning to the title safely closes an open intro dialog.
- Active boss rule cards, shop previews and victory panels share a
  per-boss visual accent using existing stable boss IDs. All numerical
  and textual rules remain front and centre.
- Clearing rounds 3, 6 or 9 adds an optional illustrated **Boss defeated**
  panel above the normal reward and Visit shop action. Round 12 uses a
  similar final boss victory panel in the existing final score modal.
  **No victory panel is shown on defeat.**
- Small, decorative reveal animations respect
  `prefers-reduced-motion: reduce`; nothing requires waiting for
  animation to finish, and the playboard remains unillustrated.
- `boss-gallery.html` offers all seven images and a real live
  preview of the encounter dialog **without entering a game**.

## Pass 4 · The world, hazards and achievement cabinet (complete)

- **Four original 960×260 panoramic SVG environments**, each evocative but
  deliberately less visually prominent than the tile grid:
  The Observatory (rounds 1–3; jade/stone observatory);
  The Mist Gardens (rounds 4–6; pale fog/arched ruins);
  The Fracture Forge (rounds 7–9; amber fractured masonry);
  The Eclipse Vault (rounds 10–12; violet eclipse and chained powers).
  The `stage-art.mjs` map stores presentation-only titles and asset paths.
  **`stageForRound` in `roguelite.mjs` remains canonical**; data-stage
  attributes are DOM-only, not stored in saves.
- **Dedicated illustrated title gateway** in `title-numberworld.svg`,
  layered behind the existing four mathematically labelled sample tiles.
  The four-realm journey cards appear underneath the mode previews.
  New Game / Continue and help links remain the principal title controls.
- **Five original compact hazard emblem SVGs**, applied consistently to
  live hazards, imminent hazard warnings, the hazard summary and the
  optional instructional guide. Distinct colours, existing symbolic badges,
  explicit hazard names and the `! NEXT` warning remain visible.
  The warning remains announced in text and never captures pointer input.
  **Cloudy remains opaque**: it hides tile values and gold, including
  screen-reader descriptions, exactly as before. Other hazards remain
  translucent and do not conceal tile maths.
- **A collectible trophy cabinet** for the existing 16 achievements.
  `assets/art/achievement-medals.svg` contains 16 bespoke symbolic
  medal emblems; `achievement-art.mjs` maps stable achievement IDs
  to icons and purely visual enamel themes. Only unlocked medals display
  the emblems in the game. Locked cards show subdued question-mark medals
  and existing goal progress, preserving the secret-art reveal.
  Unlock rules, profile storage, descriptions and dates are unchanged.
- **All assets are local**. No embedded scripts, network dependencies,
  audio or font files. Decorative images have empty alt text where adjacent
  visible text already conveys the information, and boss/hazard rule text
  is never replaced with an image.
- Stage banners collapse in height on narrow viewports; icons cannot
  intercept input. Existing reduced-motion handling continues to disable
  decorative transitions and animations.
- `world-gallery.html` provides easy, static review of the complete
  four-stage, five-hazard and 16-medal collections, without changing saves.

## Next pass

- **Pass 5:** final motion restraint, real-device mobile layout,
  performance/accessibility review and maths/readability regression audit.

Review the art in `art-preview.html`, `item-gallery.html`,
`boss-gallery.html` and `world-gallery.html` before finalising polishing.
