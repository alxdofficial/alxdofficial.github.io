# Updating Paper Channel

The public site is static. One catalog record plus its credited transcript and thumbnail drives the homepage, watch page, playlist counts, date filters, archive, JSON catalog, RSS, and sitemap. Full scientific titles and verified publication metadata are required. Generated HTML is fully readable without JavaScript.

## Add a daily episode

1. Copy `tools/papers/episode.example.json` to a working JSON file outside the repository. Fill every field with verified public information. New narration may run up to five minutes per paper; optional demo material is separate. Prefer original technical figures with verified attribution and licensing. Existing episode durations remain unchanged. Use a unique stable lowercase slug.
2. Put the complete transcript at `papers/<slug>/transcript.txt` and the thumbnail at `papers/assets/<slug>.jpg` (PNG/WebP also supported). Start the transcript with the exact full paper title, then a blank line, then numbered section headings and prose. Include the exact heading `Credits and disclosure (not spoken narration)` followed by all licensing and synthetic-voice credits.
3. Upload the finished video to the authorized media host separately. Confirm its Google Drive sharing is Anyone with the link / Viewer and test its public preview. Put only the file ID in `video_id`; never put an MP4, credentials, private notes, or a whole Drive folder in this repo.
4. Run `node tools/papers/build.cjs --add /path/to/episode.json`. This validates all records and assets before adding the record to `papers/episodes.json` and rebuilding generated output.
5. Run `node tools/papers/build.cjs --check` and `node tools/papers/test.cjs`. For visual and interaction checks, run `cd tools/papers && npm install --ignore-scripts --no-package-lock && npx playwright install chromium && npm run test:browser`.
6. Review the diff, source evidence, credits, public playback, and screenshots. Commit and push only when this publication has been approved. The build command never commits, pushes, changes Drive permissions, fetches new papers, or schedules publication.

For several episodes, add one record at a time or edit the episodes array and run `node tools/papers/build.cjs` once. A paper can belong to several playlists without duplicating its episode.

## Required publication metadata

- `title`: complete, untruncated scientific title, not an editorial rewrite.
- `published`: original video creation date (YYYY-MM-DD), retained under the existing catalog key for compatibility. This is the sole date used for newest-first episode order, latest edition, playlist results, date filters, and archive groups. Same-day episodes keep their catalog order. Keep this date when uploading, replacing, or remaking an existing episode; do not substitute the paper date, file modification time, or later upload/remake date. Verify it against the original production record before adding an episode; if it is unknown, hold the record for verification rather than inventing a date.
- `paper_date`: verified paper publication/preprint date; use literal `unknown` when not verified.
- `publication_status`: `preprint`, `published`, or `unknown`. Never infer acceptance from an arXiv listing.
- `venue`: verified journal/conference or preprint source; use `Not verified` when unknown.
- `paper_version`: verified version, or `Not specified`. arXiv requires the matching v-number.
- `paper_url` and `verified_source_url`: the same canonical primary source used to verify this metadata.
- `video_license_url`: optional explicit whole-video license. Do not infer this from a paper or voice license.

The nine currently published videos retain their original 16 October 2026 creation day, supported by the dated production collection and the original October 16 catalog commits. The three launch papers are arXiv v1 preprints dated 14 October 2026. Paper publication and revision dates remain separate and do not affect video ordering. No conference/journal publication is asserted.

## Source and generated files

Edit `papers/episodes.json`, the transcript files, thumbnail files, or templates under `tools/papers/templates/`. Do not hand-edit generated index/watch HTML, catalog.json, feed.xml, or sitemap.xml. CSS and client interactions remain in `papers/assets/`.

The dependency-free generator is `tools/papers/generate.cjs`; the command wrapper is `build.cjs`. Unit tests simulate a future episode entirely in memory, with no dummy page publication. GitHub Actions checks that generated output is current and tests 320, 390, 768, and 1440px layouts, keyboard/mobile navigation, search, no-JavaScript transcript access, reduced motion, and player-button construction. External playback is not simulated as a pass: browser tests replace the external iframe with a local test response.

The workflow only validates and uploads short-lived test artifacts. It has read-only repository permissions and does not add future auto-publishing or change any existing schedule.

## Paper-figure thumbnails

Prefer a focused, legible original figure panel when reuse has been verified. Preserve axes, legends, labels and scientific context. The existing title below the image supplies the title treatment; do not shrink a whole page into a thumbnail. A labeled adaptation remains appropriate when original reuse is unclear.

For a verified original, use `thumbnail_figure`, `thumbnail_credit`, `thumbnail_source_url`, `thumbnail_license`, `thumbnail_license_url`, and `thumbnail_changes`. The generator displays attribution, license, the selected panel/crop, and a full-size image link. Original figures use contain sizing and playback controls below the artwork so labels are not cropped or obscured. These rights apply to the figure asset; they do not automatically license the whole video.
