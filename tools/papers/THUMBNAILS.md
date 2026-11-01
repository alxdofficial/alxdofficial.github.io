# Paper Channel thumbnail contract: editorial-frame-v1

Approved reference (1 November 2026): the existing `papers/assets/spectral-eeg.jpg` card, not a raw white figure stretched into the catalog. Also compare `papers/assets/timecap.jpg` and the source-framed `papers/assets/latent-editorial.jpg`.

## Stable design across every production date
- One 16:9 1280×720 editorial frame. Retain a charcoal canvas (#1e2224), inset dark surface, generous margins, cream Playfair Display title, small JetBrains Mono labels and restrained teal/almond accents.
- Original paper figure/table is the main visual within that frame. Preserve complete relevant axes, legends, conditions and readable labels. Do not stretch or crop to fill the card. Avoid tiny entire-page screenshots.
- Prefer a meaningful frame extracted from the final QA-passed video. Pick a stable figure-focused moment, not a blank/fade/title-only frame. Do not bake the website's Watch button or duration into the image.
- If only a reusable source figure exists, compose it with `python3 tools/papers/thumbnail.py SLUG`. This preserves its pixels and adds editorial framing; it is a thumbnail layout adaptation, **not a claimed video frame or experimental output**.
- The website supplies a centered Watch overlay and bottom-right duration for ALL cards. Immediately below: playlist/date, complete paper title, paper metadata, description and tags. No per-paper CSS layouts and no variable-length credits inserted between image and title.
- Full visual credit, license, modification notice and original-figure link remain visibly available on the watch page. Never remove attribution to obtain layout consistency.

## Catalog and regression checks
Each episode declares `thumbnail_style: "editorial-frame-v1"`. `thumbnail_path` names the 16:9 image. When wrapping a source figure, `thumbnail_original_path` retains the original asset; source/credit/license/changes fields remain intact. Do not put internal notes, private IDs or drafts in the public catalog.

Run `node tools/papers/build.cjs --check`, `node tools/papers/test.cjs` and browser tests. Verify actual desktop and phone screenshots for a cross-day sample: spectral-eeg (approved), latent (repaired), a latest-day episode. Check identical image aspect ratios, centered Watch controls, bottom-right duration, title/metadata order, and no overflow at 320/390/768/1440px. Open a watch page and verify complete source credits still appear. Check live deployment after push.

Future agents must read this file and inspect the three reference assets before creating thumbnails or changing card templates. The generator must reject missing/unknown styles and the build must reject non-16:9 image assets. A successful video render alone is not publication readiness.
