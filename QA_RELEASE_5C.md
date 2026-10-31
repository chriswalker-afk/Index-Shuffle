# Index Shuffle — Release Candidate Pass 5C

This pass is a launch-readiness **code and automated QA** pass, not a claim
that physical iOS/Android devices or human players have already tested the
release. New gameplay mechanics, prices, mathematical scoring rules, bosses
and items are frozen. Pass 5B was merged before this work began.

## Implemented changes

- Original small SVG favicon using the existing `xⁿ` identity, without
  importing external fonts, trackers or scripts.
- Canonical GitHub Pages URL, improved search description, basic Open Graph
  and Twitter summary metadata. The summary is **text-first**: no PNG/JPEG
  social card exists yet, and rich image previews are not guaranteed.
- Screen-reader/keyboard corrections: after a boss intro the focus goes to
  the actual game board, not the Return-to-title control. Arrow keys used
  to read an open `summary`/text editing control do not count as slides.
- Safe-area padding on devices with a home indicator, and explicit
  forced-colour/high-contrast focus and feedback styles. Important
  information continues to be expressed in text, not colour alone.
- A baseline release-audit script verifies local HTML/module references,
  in-page links, unique IDs, label/ARIA references, alt text, metadata,
  baseline CSS variable contrast and modest bootstrap-size budgets.
- Browser smoke expands to 300/320/390/650/768/1200px, the help modal,
  short landscape-like shop layout, keyboard navigation and both normal
  and reduced-motion environments. Existing save/restore, boss, 12-round
  synthetic integration and achievement tests remain enabled.

## Automatic checks required for this PR

- [ ] `node release-audit.tests.mjs` reports no missing resources,
      duplicate IDs, broken references or oversized bootstrap assets
- [ ] All historical engine, item, boss, hazard, banking, achievement,
      save-safety and experience tests pass under Node 22
- [ ] All JavaScript modules pass `node --check`
- [ ] All original SVG files, including the favicon, parse correctly
- [ ] Headless Chrome normal-motion browser smoke passes
- [ ] Headless Chrome reduced-motion browser smoke passes
- [ ] HTML loads under 300–1200px without horizontal overflow

The automated checks are necessary but **not sufficient** for a release.

## Manual device acceptance (not verified by GitHub Actions)

Complete these on actual devices before applying a public release tag.

| Device / scenario | Expected acceptance | Status |
| --- | --- | --- |
| iPhone Safari portrait and landscape | Board swipes, 16px+ answer input, safe-area spacing, score and results scroll | **Not verified** |
| Android Chrome portrait and landscape | No browser zoom/scroll conflict while swiping, usable shop and banking dialogs | **Not verified** |
| School Windows/Chromebook laptop | Keyboard directions, Tab order, focus after boss/shop/results and clipboard fallback | **Not verified** |
| iOS VoiceOver | Square locations and powers announced; banking, timer, warning and error messages understandable | **Not verified** |
| Windows NVDA/Chrome or Edge | Modal labels, HUD moves, list history, bank attempts, close actions and collection | **Not verified** |
| Reduced-motion OS setting | No required animation; full game works without effects | **Automated Chrome only** |
| Storage disabled/quota exceeded | Accessible warning; in-tab recovery; refresh data-loss caveat is clear | **Automated Chrome only** |
| Full 12-round representative play | Shop inventory, all boss types, hazard/Runestone interactions, actual time limits and UI comprehension | **Synthetic logic tests only** |
| Classroom first-play trial | A new player understands merging vs correct banking and the two-merge move rule | **Not verified** |

## Go / no-go criteria

Release only once:
1. The Pass 5C PR has merged and its **final HEAD SHA** has green CI checks.
2. Physical-device and assistive-technology blockers above have been tested
   and any serious problems fixed.
3. No premature loss, save corruption, inaccessible dialogue or mobile
   control failure is known; no hidden gameplay changes are introduced.
4. The exact merged commit is tagged, and the live GitHub Pages URL is
   checked once deployment completes.

**Do not publish a `v1.0.0` tag or GitHub Release before those steps.**

For a release-candidate tag after merge and manual acceptance, the
maintainer can use:

```sh
git switch main
git pull --ff-only
git tag -a v1.0.0-rc.1 -m "Index Shuffle release candidate 1"
git push origin v1.0.0-rc.1
```

An official `v1.0.0` tag can follow after RC feedback. The tagged
commit must be recorded in the release notes so future defects are
reproducible.

## Post-release fixes

Restrict changes to defects, accessibility, performance and copy.
Collect real student/teacher first-run feedback before changing
move budgets, stage targets, Runestone prices or boss conditions.
