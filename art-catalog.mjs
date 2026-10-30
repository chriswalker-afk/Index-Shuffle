// Original illustration prototypes. Keep visual identity separate from
// the boss catalogue, shop economy and saved game state.
// Additional portraits can be added by boss ID in later art passes.
export const MERCHANT_ART = Object.freeze({
  src: "assets/art/index-merchant.svg",
  alt: "A cheerful clockwork owl shopkeeper in a purple hat, surrounded by number tokens and an abacus."
});

export const BOSS_ART = Object.freeze({
  "blockade": Object.freeze({
    src: "assets/art/boss-blockade.svg",
    alt: "The Blockade: a giant stone guardian made from numbered blocks with glowing teal eyes."
  }),
  "five-thief": Object.freeze({
    src: "assets/art/boss-five-thief.svg",
    alt: "The Five Thief: a masked, fox-like trickster escaping with golden fives."
  })
});

// Bosses without artwork must remain fully playable and legible.
export function bossPortraitFor(id) {
  return typeof id === "string" && Object.hasOwn(BOSS_ART, id)
    ? BOSS_ART[id] : null;
}
