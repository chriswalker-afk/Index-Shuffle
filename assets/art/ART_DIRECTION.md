# Index Shuffle · Art direction (Pass 1)

Status: **Pass 1 character concepts + Pass 2 illustrated shop complete**. This guide is the single
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

Existing boss definitions, item IDs, score logic, saves and economy are not
changed by this art pass. More boss IDs can be added to `BOSS_ART` later.

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

## Next passes

- **Pass 3:** portraits for the other five bosses, encounter and victory beats.
- **Pass 4:** stage atmospheres, hazard icons, title and achievements.
- **Pass 5:** restrained animation, mobile/performance/accessibility polish.

Before expanding the library, review the three illustrations at
`/art-preview.html` and confirm silhouette, palette, tone and portrait size.
