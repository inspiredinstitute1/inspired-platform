# Mock-test analytics

Prepared 20 October 2026. Private test update; deployment requires owner approval.

Students open Timed mock tests → My analytics & SWOT. Admin opens Mock tests → Cohort analytics & learner SWOT. Reports use finalized timed attempts; legacy free practice remains separate. No database migration is required.

CSV template now accepts optional subject and topic labels (maximum 80 characters each). Existing papers remain valid; missing labels are explicitly unlabelled. Paper content is immutable after import; import a corrected edition to add labels. No guesses are made from question text.

Metrics: correct/wrong/skipped; net score correct − 0.25 × wrong; accuracy correct / attempted; coverage attempted / questions; negative penalty; observed gap from maximum 1.25 × wrong + skipped. Focus areas rank labelled topics by observed lost marks, with a specific review action and fresh-practice target. Lost marks are not a promised improvement.

SWOT strengths require at least five labelled responses, 80% accuracy and 70% coverage. Weaknesses require at least five labelled responses and accuracy below 60%. These are transparent coaching heuristics, not psychometric ability estimates. Opportunities link to focus actions. Threats report observed penalties, skipped questions and missing labels, without inferring carelessness, guessing or time pressure.

Admin reports exclude the current owner and learner_progress rows marked Admin or matching the configured owner email. Student responses never contain cohort identifiers or question-review data. Reports are read-only, private/no-store and bound to the signed-in identity. Admin question flags need at least five responses and at least 50% wrong/skipped; flags invite review, not automatic answer-key changes.

Reports are bounded to the latest 200 finalized attempts within the selected scope, clearly marked partial if more exist. Histories are chronological but not difficulty-normalized. No per-question timing, percentile, selection prediction, public leaderboard or generated remedial question bank is claimed. Invalid stored records are excluded and counted. No question text or keys are returned by the analytics endpoint.

## Product benchmark

Reviewed official public descriptions on 20 October 2026, not paid accounts or independent comparative trials:

- Testbook advertises strengths/weaknesses, all-India rank and topper comparison: https://testbook.com/online-test-series
- Oliveboard describes AI-based analysis and weak-area guidance: https://www.oliveboard.in/blog/ai-based-mock-test-analysis/
- PracticeMock advertises detailed post-test performance and weak-area reporting: https://play.google.com/store/apps/details?id=com.practicemock.practicemock

InspirED's immediate design goal is actionable, explainable coaching: visible evidence counts, subject/topic focus, negative-mark accounting, private Admin follow-up and explicit insufficient-data states. This does not establish that InspirED is better than these platforms. Competitive timing/rank features need separate data collection and representative cohorts before honest claims are possible.

## Verification

Synthetic tests cover scoring, thresholds, missing labels, corrupt records, cohort question flags, import metadata, student ownership, account switching, Admin exclusion and read-only behavior. Full-suite/build results are reported separately when complete. Hosted browser QA remains pending deployment approval.
