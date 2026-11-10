# Research-to-publication checklist

Read [AGENTS.md](../../AGENTS.md), [THUMBNAILS.md](THUMBNAILS.md) and the [catalog workflow](README.md) first. These rules apply to new episodes and revisions. Do not publish this checklist's private working evidence; store that evidence in the authorized archive.

## 1. Select and archive evidence

- Future nine-paper mix: **2 own-research/memory papers**, **2–3 health/medical-AI papers**, and **4–5 free-choice papers** chosen for verified trending/popular attention, broad influence, or novel reusable techniques worth learning. Own-research topics include continual/lifelong learning, memory, reinforcement learning, bio-inspired computing, streaming/multimodal sensing, world models and representations. Do not force a disease quota or pad weak selections; disclose fewer verified papers when necessary. This change is prospective and does not reclassify already-produced batches.
- Prefer genuinely recent reusable papers. Verify paper/version dates and preprint versus peer-reviewed status from primary sources; timestamp actual attention signals and distinguish popularity from scientific quality. Use available research services and primary-source fallback honestly; disclose coverage gaps.
- Read accessible full text, methods, results, repository and supplements. Mark abstract-only limitations. Verify reuse rights and source provenance. Do not bypass paywalls.
- Deduplicate arXiv ID/DOI/version against the canonical archive ledger and previous episodes. First file the legally accessible PDF and bibliographic record, or record the exact save/access blocker. Preserve existing archive edits.
- Keep full title, paper date/version/status/venue and primary paper/code URLs distinct from video production date and selection-digest date.

## 2. Script and storyboard before audio

The short script covers: problem; why difficult/important; applications/prior approaches; operational solution; evidenced results; relevance/novelty/caveats. The private deeper companion covers problem and assumptions; demonstrated versus plausible applications; dated SOTA versus chosen baselines; architecture/objectives/update/inference; matched quantitative results/ablations/failures/costs; and evidence-based relevance. Do not invent project details.

Define unfamiliar models, modules, datasets and metrics by their function on first mention. Describe who receives what, what is predicted/matched, what parameters or memory change, and inference behavior before naming techniques. Explain metric meaning and evaluation setting. Distinguish author-reported results from independently established findings; never equate a chosen baseline with verified current SOTA.

For health work, explicitly assess patient-level splitting, leakage, sample size, external validation, population limitations and deployment limits. Autism is a neurodevelopmental condition. Prediction/association is not clinical diagnosis.

Complete the storyboard after evidence/script QA. Prefer large readable original figures/tables/diagrams with attribution, guided highlights and preserved axes/legends/conditions. Clearly label faithful redraws and illustrative animations. Official demo footage requires provenance and permissible reuse; recreated illustrations are not experimental outputs.

## 3. Narration and visual production

Use the approved pinned local Pocket TTS **Anna** preset and preserve official preset/model/license credits. Restore the authorized production package using supported archive tools and verify restoration rather than assuming it works. If Anna is unavailable, report the blocker before any voice change. Paid fallback, purchases, new credentials and access grants require approval. Do not reuse historical Flite timings.

Generate sections, measure actual durations, then retime subtitles/visualizations. Keep explanation at or under five minutes per paper without padding; log demo duration separately. Use horizontal 16:9, steady readable text and restrained mechanism-led animation. Apply the approved visual tokens and reference assets in THUMBNAILS.md. Do not redesign between days.

## 4. Readiness and storage

- Evidence-check written script and visuals, terminology and quantitative comparisons.
- Verify audio exists/plays, full media decode, actual section durations, synchronized subtitles, and meaningful reading time.
- Inspect rendered frames at desktop and phone sizes. Figures must be readable main visuals, not tiny decoration. Automated timing/decode/CI alone is insufficient.
- Skip generated-narration speech-content transcription and separate listening-versus-script checking; do not install a speech checker solely for this workflow.
- Save final videos, script/storyboard/subtitles and useful reusable setup in their authorized destinations. Keep generation sources/private notes out of the clean presentation browsing experience. Preserve previous dates and recoverable revisions; only latest version visible per paper/date.

## 5. Publish immediately after readiness

First reconcile the private [publication queue](QUEUE.md). Enqueue each QA-passed episode as soon as its outputs are ready. Claim one step, perform it with the existing authorized tools, and persist the verified receipt. Keep other episodes moving when one has a technical failure. Do not turn an unanswered routine status update into an approval requirement; actual denied actions and uncertain effects need the handling in QUEUE.md.

Use the existing catalog workflow, not a parallel website or new layout. Prefer a meaningful original-figure-focused frame from the finished video as thumbnail. If needed, use the documented editorial compositor, explicitly identifying the adaptation. Retain credits and source-figure link on the watch page.

Verify specific finished video/transcript public-view access. Add required catalog metadata and stable paths. Run:

```sh
node tools/papers/build.cjs
node tools/papers/build.cjs --check
node tools/papers/test.cjs
node tools/site/build.cjs
node tools/site/test.cjs
cd tools/papers && npm run test:browser
```

Use already available dependencies or the supported setup described in README; never retry denied installations through another route. The existing CI runs responsive browser checks at 320/390/768/1440px. Inspect actual cross-day screenshots and full-size attribution links. Review diff for privacy/unrelated edits, then publish under the user's current authority. Verify remote commit, CI/deployment, live version, actual playback, transcript/paper/download links and mobile/desktop layout. External-video mocks are not playback verification. Report exactly what is verified versus blocked; never publish an inaccessible record as ready.

