# Alex's public pages

- `/papers/`: research films, source links, transcripts, playlists and archive.
- `/halo/`: interactive research explainer.
- `/spain-2026/`: encrypted older travel page, retained pending an explicit removal decision.

## Source and publication boundaries

`papers/episodes.json` and `tools/papers/` are the catalog source and generator. Follow [the catalog workflow](tools/papers/README.md) for approved episode updates. Generated public pages and their assets stay under `papers/`; do not edit generated HTML directly.

`tools/site/public-files.json` lists the other approved public files. `node tools/site/build.cjs` validates the catalog and copies only that list plus each catalog episode's page, transcript, and thumbnail into `.site/`. `node tools/site/test.cjs` verifies that boundary. Build tools, source records, tests, reports, dependencies, and local working files are excluded from the Pages artifact.

GitHub Pages uses the **Publish public site** Actions workflow and its `.site/` artifact. Changes still require publication approval. The workflow publishes only committed files; it does not change video-host permissions or add episodes on its own.

This repository itself is public. Keeping a file out of Pages does not make its GitHub source or history private. Never commit private production notes, credentials, unpublished media, or sensitive backups. Removing material from the current tree does not remove previous commits, clones, caches, or separately hosted files; those need a separately approved remediation decision.
