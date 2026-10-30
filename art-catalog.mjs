// Original, local portrait assets. Stable boss IDs are defined in bosses.mjs.
// Pure presentation mapping: never referenced by game rules, save data or RNG.
export const MERCHANT_ART = Object.freeze({
  src: "assets/art/index-merchant.svg",
  alt: "A cheerful clockwork owl shopkeeper in a purple hat, surrounded by number tokens and an abacus."
});

export const BOSS_ART = Object.freeze({
  blockade: Object.freeze({
    src: "assets/art/boss-blockade.svg",
    alt: "The Blockade: a giant stone guardian made from numbered blocks with glowing teal eyes."
  }),
  "five-thief": Object.freeze({
    src: "assets/art/boss-five-thief.svg",
    alt: "The Five Thief: a masked, fox-like trickster escaping with golden fives."
  }),
  scorekeeper: Object.freeze({
    src: "assets/art/boss-scorekeeper.svg",
    alt: "The Scorekeeper: a stern owl-like accountant in burgundy robes looming over an ornate golden abacus and ledger."
  }),
  "silent-seven": Object.freeze({
    src: "assets/art/boss-silent-seven.svg",
    alt: "The Silent Seven: a mysterious hooded figure holding two spectral sevens chained apart with gold padlocks."
  }),
  "power-snob": Object.freeze({
    src: "assets/art/boss-power-snob.svg",
    alt: "The Power Snob: a pompous mathematical aristocrat wearing a crown, high hat and golden exponent monocle."
  }),
  timekeeper: Object.freeze({
    src: "assets/art/boss-timekeeper.svg",
    alt: "The Timekeeper: a clockwork guardian with a giant brass clock face, hourglass chest and mechanical gears."
  }),
  "three-curse": Object.freeze({
    src: "assets/art/boss-three-curse.svg",
    alt: "The Three Curse: a playful three-headed imp in violet robes surrounded by triangular curses and a ticking number-three rune."
  }),
  frostlock: Object.freeze({
    src: "assets/art/boss-frostlock.svg",
    alt: "The Frostlock: an icy clockwork jailer with glowing teal eyes and four arrow charms, one frozen inside a sharp blue crystal."
  })
});

// Missing IDs fail closed to readable text-only treatment.
export function bossPortraitFor(id) {
  return typeof id === "string" && Object.hasOwn(BOSS_ART, id)
    ? BOSS_ART[id] : null;
}
