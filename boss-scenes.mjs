// Presentation-only encounter copy. Text in bosses.mjs stays the source
// of truth for gameplay effects; these phrases are flavour, not new rules.
export const BOSS_SCENES = Object.freeze({
  blockade: Object.freeze({
    entrance: "A wall of stone has decided you are not going anywhere.",
    defeated: "The last stone falls. The path is clear."
  }),
  "five-thief": Object.freeze({
    entrance: "A suspiciously cheerful thief is eyeing your fives.",
    defeated: "The thief makes a hasty exit — empty-handed."
  }),
  scorekeeper: Object.freeze({
    entrance: "Every last point will be inspected. Twice.",
    defeated: "The ledger is closed. Your score stands."
  }),
  "silent-seven": Object.freeze({
    entrance: "The chains tighten. The sevens fall silent.",
    defeated: "The chains are broken. The board is yours again."
  }),
  "power-snob": Object.freeze({
    entrance: "Only the grandest powers will impress this noble.",
    defeated: "A reluctant bow. You have earned the noble's respect."
  }),
  timekeeper: Object.freeze({
    entrance: "Tick. Tock. There is no borrowing extra time here.",
    defeated: "The clock strikes victory, just this once."
  }),
  "three-curse": Object.freeze({
    entrance: "Three grins. Three tricks. One very troublesome curse.",
    defeated: "All three heads concede defeat."
  }),
  frostlock: Object.freeze({
    entrance: "A cold snap seizes an arrow key. The ice never stays still for long.",
    defeated: "The ice shatters. Every direction is yours again."
  })
});

export function bossSceneFor(id) {
  return typeof id === "string" && Object.hasOwn(BOSS_SCENES, id)
    ? BOSS_SCENES[id] : null;
}
