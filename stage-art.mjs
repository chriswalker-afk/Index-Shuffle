// Decorative scene identity only. Round -> stage continues to be defined
// in roguelite.mjs; no game rules or persisted keys depend on these assets.
export const STAGE_ART = Object.freeze({
  1: Object.freeze({
    title: "The Observatory", subtitle: "A clear sky. A clean start.",
    art: "assets/art/stage-observatory.svg", label: "STAGE I · THE OBSERVATORY"
  }),
  2: Object.freeze({
    title: "The Mist Gardens", subtitle: "Watch the ground. It can change.",
    art: "assets/art/stage-mist-gardens.svg", label: "STAGE II · THE MIST GARDENS"
  }),
  3: Object.freeze({
    title: "The Fracture Forge", subtitle: "Every square demands attention.",
    art: "assets/art/stage-fracture-forge.svg", label: "STAGE III · THE FRACTURE FORGE"
  }),
  4: Object.freeze({
    title: "The Eclipse Vault", subtitle: "The final powers are in play.",
    art: "assets/art/stage-eclipse-vault.svg", label: "STAGE IV · THE ECLIPSE VAULT"
  })
});

export function stageArtFor(stage) {
  return Number.isInteger(stage) && Object.hasOwn(STAGE_ART, stage)
    ? STAGE_ART[stage] : null;
}
