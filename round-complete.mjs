// A single source of truth for the round-complete intermission.
// Pure presentation data: never changes the board, gold, score or boss schedule.
import { targetForRound, stageForRound, validRogueliteRun
} from "./roguelite.mjs?v=round-intermission-v1";
import { BOSS_ROUNDS, bossForRound, bossTargetFor
} from "./bosses.mjs?v=runestones-pass2";

export function roundCompletionSummary(state) {
  if (state?.mode !== "roguelite" || !validRogueliteRun(state.run) ||
      state.run.phase !== "round-clear") return null;
  const { run } = state;
  const round = run.round;
  const reward = run.lastRoundReward || {
    bankCoins: 0, moveCoins: 0, unusedMoves: 0, totalCoins: 0
  };
  // For example, after rounds 1 and 2 the progress toward round 3 is
  // 1/3 and 2/3. Defeating round 3 starts the 0/3 journey to round 6.
  const nextBossRound = BOSS_ROUNDS.find(bossRound => bossRound > round);
  const previousBossRound = [...BOSS_ROUNDS].reverse()
    .find(bossRound => bossRound <= round) || 0;
  const steps = nextBossRound - previousBossRound;
  const progress = round - previousBossRound;
  const defeatedBoss = bossForRound(run, round);
  const nextRound = round + 1;
  const isNextBoss = nextRound === nextBossRound;
  return {
    round, nextRound, stage: stageForRound(round),
    target: bossTargetFor(run, targetForRound(round)),
    score: state.score, runScore: run.totalScore,
    coins: run.coins,
    bankCoins: reward.bankCoins,
    moveCoins: reward.moveCoins,
    unusedMoves: reward.unusedMoves,
    totalCoins: reward.totalCoins,
    defeatedBoss: defeatedBoss?.name || null,
    defeatedBossId: defeatedBoss?.id || null,
    nextBossRound, steps, progress,
    roundsToBoss: nextBossRound - round,
    // Keep the opponent a surprise until the next encounter is imminent.
    nextBossName: isNextBoss ? bossForRound(run, nextBossRound)?.name : null
  };
}
