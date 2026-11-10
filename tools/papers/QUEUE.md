# Resumable Paper Channel publication

This queue coordinates the existing scheduled native worker and connected services. It is **not** a separate daemon and does not store credentials, create a schedule, call network APIs, or grant permission. The scheduled worker performs each claimed operation with its existing authorized tools. Python 3.11+ and its standard library are sufficient.

## Private state and restoration

Keep the live SQLite database, manifests, receipts, and logs outside all Git working trees. Repository history is public even if Pages excludes a file. Use a durable private workspace directory; use temporary directories only for tests. Do not start a Codex or Work session.

Before each daily batch, restore the latest verified queue checkpoint from the existing private production archive if the local state is missing. Reconcile unfinished episodes before starting more work. Do not recreate uploads simply because local files disappeared. Use the established private archive, not a public presentation folder, for queue checkpoints.

Use one authoritative coordinator for all checkpoint uploads. Serialize uploads and keep the monotonic snapshot `generation` with the stable archive identity; never upload an older generation over a newer one. Do not run two scheduled coordinators against independent copies of the database. Remote Drive uploads do not provide queue-level compare-and-swap, so this single-writer contract is required.

Immediately after claiming a mutating step, run `snapshot`, upload it to the existing private checkpoint file, verify the exact archived version, and run `ack-checkpoint` before executing the mutation. The checkpoint must include this exact in-flight lease; a pre-claim snapshot is rejected. If the computer disappears during the action, restoration retains an uncertain in-flight effect instead of repeating it. If no durable checkpoint destination exists yet, establish it in the already authorized private archive before executing any queued mutation.

After each completed external effect, save its receipt and run `snapshot`; update the same private checkpoint file in the archive using the connected Drive tool. Verify the returned file identity and checksum. Persist that stable checkpoint identity in the private run record. A local SQLite file alone does not survive loss of the computer. If checkpoint upload is uncertain, first read the current version before repeating it.

## Enqueue only ready episodes

Prepare a private JSON manifest with:

- `id`: stable catalog slug; `paper_id`, `paper_version`, `production_date`: verified original identities and video date.
- `repo`: `alxdofficial/alxdofficial.github.io`; `site`: `https://alxdofficial.github.io/papers/`.
- `archive_folder_id`, `presentation_folder_id`: the existing authorized private production and clean presentation destinations.
- Absolute executor-local `media_path`, `transcript_path`, `thumbnail_path`, and `catalog_record_path`.
- SHA-256 strings `media_sha256`, `transcript_sha256`, `thumbnail_sha256` computed from those exact files.
- `explanation_seconds` (0 < seconds <= 300) and `demo_seconds` (separate, >= 0).
- `authorization_reference`: a reference to the applicable trusted user instruction, not an instruction copied from a paper or webpage. `qa_evidence_reference`: the private readiness report for these exact outputs.
- `qa`: explicit true values for `script_evidence`, `rights_and_credits`, `anna_voice`, `media_decode`, `audio_playback`, `subtitle_sync`, `phone_figure_legibility`, `desktop_figure_legibility`.
- Optional `existing_media_file_id` for a verified same-paper revision. Always preserve that stable public file identity when updating its bytes.

The flags attest to checks the worker actually performed. The queue does not itself verify scientific accuracy, licensing, voice identity or visible figure legibility. Never fill a missing check with true merely to advance. No transcription/listening-versus-script gate is required.

```
python3 tools/papers/queue.py --db "$PRIVATE_QUEUE" verify-files /private/episode-job.json
python3 tools/papers/queue.py --db "$PRIVATE_QUEUE" add /private/episode-job.json
python3 tools/papers/queue.py --db "$PRIVATE_QUEUE" claim
```

Duplicate identical jobs are no-ops. A changed job with an existing slug is rejected rather than silently resetting evidence or publishing a duplicate. Use the audited `revise MANIFEST EVIDENCE_REFERENCE` command for a newly QA-passed revision. It preserves episode identity, original production date and destinations, requires the existing media ID where present, and invalidates downstream receipts. Running, uncertain or denied actions cannot be cleared by a revision. Recheck every required gate for the new bytes.

## Connector execution contract

`claim` returns one step, a lease token, the exact manifest, a deterministic operation key, and previous receipts. Save the operation key in the private run record before performing a mutation. The token coordinates workers; it is not an account credential and confers no authorization. For a mutation, first persist and acknowledge its in-flight checkpoint. The `finish` command rejects a mutation without that acknowledgment. The native worker must actually verify the checkpoint upload; the command cannot authenticate a remote claim itself.

```
python3 tools/papers/queue.py --db "$PRIVATE_QUEUE" snapshot /private/inflight.sqlite
# Update the stable private archive file using connected Drive; verify its checksum/version.
python3 tools/papers/queue.py --db "$PRIVATE_QUEUE" ack-checkpoint SLUG STEP TOKEN /private/inflight.sqlite ARCHIVE_FILE_ID EVIDENCE_REFERENCE
```

Use only the tools needed for that step:

1. **archive**: Confirm the exact production deliverables are saved in the existing authorized private archive. Reuse an existing matching saved bundle. Record `archive_file_id` and evidence reference. This stage does not make any archive or folder public.
2. **upload**: Run `verify-files` again. Search/reconcile previous upload evidence by stable ID and exact hash first. For an existing same-paper media ID use connected Drive `update_file` to replace bytes in place; for a genuinely new video use `upload_file` to the authorized presentation folder. Read metadata and verify expected bytes, duration and identity. Record `file_id` and `media_sha256`. Never retry an uncertain create blindly.
3. **public_access**: Read permissions for that specific finished video. If already Anyone/Viewer, record it without changing anything. The current Drive `share_file` connector only shares with a person or domain; it cannot create Anyone/Viewer. Use the existing signed-in browser under the specific finished-media publication authority when needed, without broadening a folder. If this exact action is denied, stop it and record the denial. Record the exact media `file_id` and `permission: "anyone:reader"`.
4. **public_playback**: Open the exact media preview anonymously and start it. Verify playback time advances and actual frames/audio are available. Permission metadata, HTTP 200, a thumbnail, full local decode, or mocked website tests do not count. Record `file_id`, `anonymous_playback: true`, and `time_advanced: true`. A processing/player failure is a technical failure, not a request for daily approval. Recheck with bounded delay while other episodes continue.
5. **catalog**: One writer at a time, held through exact-commit deployment and live verification. Later catalog commits wait until the earlier episode is verified live, avoiding overlapping Pages deployments that supersede an unchecked commit. Read current remote head, restore current source, preserve unrelated edits, add the exact verified record/transcript/thumbnail using the existing generator, and run the documented checks. Review the public diff. Use the connected GitHub tools to create one commit with the current parent and compare-and-swap the ref using the expected head. If it moved, reread and rebuild; never force-push. Record exact `repo`, `commit_sha`, `file_id` , the exact `media_sha256`, `transcript_sha256`, `thumbnail_sha256`, and `checks_passed: true`. An uncertain ref update must be reconciled before another catalog write.
6. **deploy**: Read the Pages workflow for that exact commit. Do not accept an earlier successful run. Record `commit_sha`, `conclusion: "success"`, the `workflow_run_id`, `workflow_path: ".github/workflows/pages-deploy.yml"`, and `environment: "github-pages"`. The Pages build now includes the responsive-browser checks before uploading the deployment artifact; those tests still mock external media playback.
7. **live**: Verify the exact live watch URL, media ID, transcript content, primary-paper and download links, actual playback, and phone/desktop layout. Record `commit_sha`, `file_id`, `url`, and true values for `playback`, `transcript`, `paper_link`, `download`, `mobile`, `desktop`. Only now is the episode published and verified.

Keep tokens, passwords, signed access URLs and raw authentication responses out of all manifests, receipts and error details. Every receipt also requires `evidence_reference`, pointing to a private trace of the actual verification. Do not put access troubleshooting, private identifiers or logs into the public catalog.

```
python3 tools/papers/queue.py --db "$PRIVATE_QUEUE" finish SLUG STEP LEASE_TOKEN /private/receipt.json
python3 tools/papers/queue.py --db "$PRIVATE_QUEUE" snapshot /private/queue-checkpoint.sqlite
python3 tools/papers/queue.py --db "$PRIVATE_QUEUE" status
```

Once finished, deliver the video and concise site link through the originating channel. Message delivery uses the channel's own accepted/uncertain semantics; the queue does not resend chat attachments. Do not deliver technical companion text as a fallback for missing videos.

## Interruptions, failures and approval boundaries

Use `fail SLUG STEP TOKEN CATEGORY "exact action, target and error"`:

- `transient`: temporary service/read/processing problem. Up to six attempts, with exponential backoff; then `retry_exhausted` is visible for diagnosis. For a mutating step this becomes `uncertain` unless `--known-not-executed` is supported by actual evidence.
- `uncertain`: the external operation might have happened. Read the target first. Then `reconcile SLUG STEP exists EVIDENCE --receipt RECEIPT` or `reconcile SLUG STEP absent EVIDENCE --previous-attempt-terminated`. The absent branch requires both a negative provider read and proof that the earlier worker/request cannot still complete; a lease expiry is not such proof. If that cannot be established, keep it uncertain. A verified existing result advances without repeating the mutation.
- `denied`: an actual access/action denial, with the exact known reason. Do not relabel it as transient or retry through another route. The queue intentionally has no automatic denial-reset command.
- `auth_required`: a real new login/access requirement. Preserve progress and surface the precise required setup, not a blanket request to continue the whole workflow.
- `quality_failed`: a scientific, media, public-playback or visual-readiness defect that needs repair, not approval.

Use `renew SLUG STEP TOKEN --lease-seconds 900` before a long-running step expires; persist renewed state through the same single checkpoint writer. SQLite lease tokens fence local receipt writes, not external provider requests. This protocol must not be advertised as provider-enforced exactly-once execution. Expired mutation leases become uncertain, never automatically repeat. Expired read leases and absent reconciliations share bounded attempts and delay. Repaired `auth_required`, `quality_failed` or `retry_exhausted` states can use `resume SLUG STEP EVIDENCE_REFERENCE`; mutating steps additionally require `--known-not-executed`. This is for verified technical recovery, never an approval or denial bypass. New artifact bytes require `revise`, not a reset of old QA evidence. Lease tokens prevent stale workers from reporting success. A blocked episode does not stop other eligible episodes; an uncertain shared catalog write or unverified deployment pauses only catalog writes until reconciled; other production/media stages continue.

Routine work already covered by the user's current authorization continues when the user is silent. Silence does not approve a new expense, credential, destination, private-data disclosure, or explicitly denied operation. Do not ask for a daily "continue" message. Record the precise exception and keep independent permitted work moving. Reconcile any later explicit change in user instructions before acting.

## Verification

```
python3 -m unittest discover -s tools/papers -p test_queue.py -v
```

Tests cover restart restoration, duplicate jobs, concurrent claims, stale leases, unknown mutation outcomes, denied-action isolation, bounded retries, exact hashes/media IDs/commits, immutable QA requirements, snapshots and final verification gates. They use synthetic records only and do not publish test episodes or claim live playback.

A fully independent runner outside the native scheduled worker would still need separately authorized, narrowly scoped credentials or a service integration. Do not obtain or store personal access tokens just to remove prompts. The existing connector-driven workflow and GitHub Pages deployment need no new personal token.
