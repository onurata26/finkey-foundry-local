# Finkey UI v2 — Design QA

## Target and evidence

- Reference: local design image (not included in the repository)
- Motion reference: local motion clip (not included in the repository)
- Final desktop capture: `design-qa/v3-final-desktop.png`
- Final Ask capture: `design-qa/v3-final-ask-desktop.png`
- Final answer capture: `design-qa/v3-final-answer-desktop.png`
- Historical AI-summary captures predate the Foundry Local migration and should be refreshed before final presentation.
- Final mobile captures: `design-qa/v3-final-mobile-hero.png`, `design-qa/v3-final-mobile-ask.png`, `design-qa/v3-final-mobile-answer.png`
- Same-frame reference comparison: `design-qa/comparison.png`
- Validated viewports: 1440 × 1000 desktop and 390 × 844 mobile

## Visual review

- The white navigation, inset rounded hero, oversized three-line headline and calm painterly field preserve the reference hierarchy.
- Header navigation is geometrically centered (measured center delta: 0 px), contains one Ask Finkey link, stays on one line and uses a clearer 14 px / 720 weight treatment.
- The original F logo silhouette is preserved with an exact image mask and recolored using a rose–periwinkle–mint gradient sampled from the hero.
- The hero now begins directly with the headline; the “Verified financial intelligence” badge and secondary CTA are removed.
- The Ask section has no dataset-stat block or redundant assurance row, and its composer remains centered at desktop and mobile widths.
- The answer heading keeps “ready to use.” together. The interpretation percentage and Observed/What stands out panel are removed, leaving the chart at full width.
- Foundry Local context is presented as a restrained answer brief with an executive summary, numbered key points, all returned limitations and wrapped trace controls at mobile widths.
- “Operating result comparison” is the clean display title. Its accounting limitation remains visible in the KPI note and calculation disclosure.
- All visible “Verified…” UI badges and fallback copy were replaced with neutral calculated-answer language.
- No horizontal overflow was found at 390 px.

## Motion and interaction review

- The hero uses a persistent WebGL ping-pong fluid field instead of a one-frame pixel warp.
- Pointer segments inject broad directional velocity, lateral curl and a soft surface push; momentum continues and settles naturally for roughly two seconds.
- The watercolor also moves without pointer input through slow idle curl flow.
- Measured frame deltas at the validated desktop viewport: idle mean RGB delta 0.238 (max 66); active drag mean RGB delta 2.361 (max 97).
- Headline and controls stay fixed while only the watercolor pigment is displaced.
- Reduced-motion, touch/coarse-pointer, WebGL fallback, offscreen pause, visibility pause, DPR limits and context recovery are implemented.

## Product and analytical review

- Header navigation, mobile menu, hero CTA, Ask composer, Answer anchor and Method disclosure resolve to their intended states.
- Submitting through Ask scrolls the answer section into view on the next animation frame on desktop and mobile (smooth unless reduced motion), then focuses the result heading without a second scroll. The live desktop check moved the answer from 1,216 px below the viewport to 160 px from its top.
- The financial answer remains deterministic; optional Foundry Local context cannot rewrite calculated values.
- Known questions calculate immediately and receive on-device context in the background. Unclassified questions may use local interpretation before the verified calculation. Runtime failures never hide or replace the calculated answer.
- The document workspace supports local upload, semantic chunking, SQLite storage, cosine retrieval and source-labelled answers. Hardware-specific live inference is verified after `npm run foundry:setup`.
- Charts retain audited units, ordering, baselines, denominator rules and source-grain safeguards.
- An independent engine review confirmed that shortening the operating-result display label introduces no analytical regression; the dataset-proxy caveat remains in the KPI note and method.
- Automated verification passes: 68 audit/contract assertions, 54 analytics assertions, 21 AI assertions and 2 rendered-shell assertions (145 total).
- Lint, TypeScript checking and the local Next.js production build are release gates.

final result: passed
