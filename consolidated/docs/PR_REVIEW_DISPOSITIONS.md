# PR review disposition record

Reviewed 13 September 2026. These dispositions cover the original review threads and the follow-up review on the repair commits. A scope decision is explicit acceptance for the documented single-user local beta, not a claim that a production release gate has passed.

## PR #2

Initial head: `0bea247`. Repairs are committed on `agent/consolidated-market-skeleton`. Verification: `cd consolidated && npm test` (47 passed, zero failures) and `npm run build` (passed), on Node 24.18.0. Tests cover actual storage/HTTP behavior and component handlers; they do not certify physical sensors/audio, real-model connectivity, browser sandbox behavior or measured frame rate.

| Review threads | Disposition | Action | Evidence |
|---|---|---|---|
| [3978345197](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3978345197) | Fixed | Split coarse release tests into independent storage, API, range, Unicode, entitlement, and reader-race cases. | test/core.test.mjs; test/reader-review.test.mjs |
| [3978398525](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3978398525), [3987311386](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3987311386) | Fixed | Snapshot the initiating asset, bookmark, note, and media time before awaiting persisted state. | test/reader-review.test.mjs |
| [3978398537](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3978398537), [3978398549](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3978398549) | Fixed | Catch malformed URL parsing and await managed asset streams so one bad request/object cannot terminate the broker. | test/core.test.mjs |
| [3978398646](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3978398646) | Fixed | Restrict profile/object/staging directories to 0700 and SQLite catalog/WAL/SHM to 0600. | test/core.test.mjs (POSIX permissions) |
| [3978403335](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3978403335), [3985321262](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3985321262), [3985376625](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3985376625) | Fixed | Count raw request bytes, retain bounded buffers, and decode UTF-8 only after collecting chunks. | test/core.test.mjs (bytewise Unicode and 80 KiB rejection) |
| [3978403562](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3978403562) | Fixed | Validate reading-state object fields, numeric positions, font bounds, and note strings before persistence. | test/core.test.mjs |
| [3985321354](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3985321354), [3985321652](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3985321652) | Fixed | Publish immutable payloads with atomic hard links, verify existing duplicates, and select the latest import metadata without duplicating bytes. | test/core.test.mjs (deduplication and corruption) |
| [3985376654](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3985376654) | Fixed | Check the reader generation after text fetch before appending content or changing status. | test/reader-review.test.mjs |
| [3987311395](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3987311395) | Fixed | Support suffix/open-ended byte ranges and clamp valid ranges to the object length. | test/core.test.mjs (suffix, overflow, empty, invalid ranges) |
| [3987311404](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3987311404) | Fixed | Reject signed grants unless both expected and signed subjects are nonempty strings and equal. | test/core.test.mjs (subjectless signed payload) |
| [3978345950](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3978345950) | Scope decision | The loopback preview trusts processes on the local host. X-MBA-Client is a browser request guard, not authentication. Multi-user/hostile-local-process isolation is not claimed; the server must remain bound to 127.0.0.1. Private filesystem permissions and browser-origin checks are enforced. | server.mjs host/origin checks; test/core.test.mjs; local-beta release scope |
| [3998998876](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3998998876) | Fixed | Apply partial reading-state updates in one SQLite transaction; browser handlers no longer merge stale fetched state. | test/core.test.mjs; test/reader-review.test.mjs |
| [3978345304](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3978345304), [3985376629](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3985376629) | Fixed | Normalize unsupported imported relationships to the generic palette relation. | thinkspace-support.mjs; test/thinkspace-review.test.mjs |
| [3978345412](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3978345412), [3985376636](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3985376636) | Fixed | Reset journey, reader, selection, camera and graph-specific transient state on replacement. | ThinkSpace.tsx replaceGraph; component-handler regressions |
| [3978345508](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3978345508), [3985376644](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3985376644) | Fixed | Recover from ingestion/embedding errors with retryable error state and unconditional busy cleanup. | ThinkSpace.tsx ingestFiles; component-handler regressions |
| [3978345605](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3978345605), [3985376657](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3985376657) | Fixed | Restore the existing audio gain when unmuting. | test/thinkspace-review.test.mjs |
| [3978346074](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3978346074), [3985376677](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3985376677) | Fixed | Render imported HTML in an opaque-origin scriptless sandbox with restrictive resource policy. | thinkspace-support.mjs isolatedGraphHtml; component sandbox assertions |
| [3978346166](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3978346166), [3985376666](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3985376666) | Fixed | Bound input bytes/counts before normalization and use at most 48 repulsion samples per node. | thinkspace-support.mjs; limits and force-sampling tests |
| [3985321422](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3985321422), [3985376684](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3985376684) | Fixed | Reject empty graphs before replacing the active graph. | test/thinkspace-review.test.mjs |
| [3978403446](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3978403446), [3985321847](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3985321847) | Fixed / scoped trust | Require explicit per-origin session approval; reject credentials in URLs, remote plaintext, deceptive private-IP lookalikes and redirects. The configured service remains trusted and existing CSP/CORS still applies. | thinkspace-support.mjs; docs/RELEASE_CHECKLIST.md; endpoint tests |
| [3985376673](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3985376673) | Fixed | Wire angular velocity and look-coast damping into camera movement. | test/thinkspace-review.test.mjs |
| [3985376681](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3985376681) | Fixed | Show source chips only for unambiguous retrieved titles actually cited in the answer. | thinkspace-support.mjs citedSources; citation tests |
| [3987218753](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3987218753), [3987311412](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3987311412) | Fixed | Keep Sky off on denied/unavailable orientation permission and remove unused precise geolocation. | ThinkSpace.tsx enableSky; permission and location regressions |
| [3998998889](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3998998889) | Fixed | Flush the UTF-8 decoder and final unterminated chat record; stop at the stream terminator. | test/thinkspace-review.test.mjs |
| [3978345743](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3978345743), [3985321551](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3985321551), [3998998904](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3998998904) | Scope decision | Document the executable Node/esbuild local-beta and model-reference exceptions. Native Tauri packaging and production offline-AI acceptance remain separate release gates. | docs/PRD.md; docs/RELEASE_CHECKLIST.md |
| [3978345849](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3978345849) | Fixed | Remove Apple targets from the rollout matrix to retain INV-NO-APPLE. | docs/PRD.md platform matrix |
| [3998998936](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3998998936) | Fixed | Replace stale test counts with reproducible commands and the dated test receipt. | docs/RELEASE_CHECKLIST.md |

The loopback trust boundary and reference-runtime exceptions are detailed in `docs/RELEASE_CHECKLIST.md`. All native/commercial release gates remain intact. PR #3 is stacked and must retain these repairs when integrated onto master.


## Additional PR2 review rounds

These follow-up findings were raised while the original fixes were being reviewed. The dispositions below are merge requirements; the final verification receipt records completion.

| Review issue | Evaluation | Required merge disposition |
| --- | --- | --- |
| [3999011144](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3999011144): unsuccessful embedding responses | Valid: HTTP errors or invalid vectors must not produce a successful collapsed graph. | Reject unsuccessful responses and empty/nonfinite vectors; preserve actionable ingestion failure and retry. |
| [3999011145](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3999011145): overlapping pause and bookmark writes | Duplicate of atomic-state finding 3998998876. | Partial updates merged transactionally by the broker; regression covers overlapping note and media writes. Implemented in `4912bfd`. |
| [3999011150](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3999011150): fixed-prefix context omits relevant passages | Valid for long Markdown and HTML-only graph nodes. | Preserve readable full content and select bounded query-relevant passages rather than the first 1,200 characters. |
| [3999056110](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3999056110): mixed vector dimensions | Valid: invalid cosine scores undermine retrieval ordering. | Reject inconsistent imported embedding dimensions before replacing the graph. |
| [3999056129](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3999056129): stale endpoint model discovery | Valid asynchronous identity bug. | Invalidate model lists on connection changes and reject discovery completions for obsolete connection generations. |
| [3999056143](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3999056143): cross-document annotations | Valid provenance bug. | Bind marks to source node IDs and filter both reader and spatial views by the active node. |
| [3999056171](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3999056171): public symlink escape | Valid static-serving boundary gap. | Enforce resolved-path containment and regular-file checks before serving static bytes; retain the explicitly documented trusted-local-filesystem boundary. |

### Final PR2 local acceptance (13 September 2026)

The integrator ran `npm test` and `npm run build` after all late parallel-review fixes: 61/61 tests passed, zero failed/skipped, and the build exited 0. All 53 captured PR2 review threads are covered by the original table and follow-up rows, including duplicate dispositions and explicitly retained reference/local-beta scope boundaries. This receipt does not convert the documented production qualification gaps into verified claims.

### Late parallel-review findings

| Review issue | Evaluation | Required merge disposition |
| --- | --- | --- |
| [3999062151](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3999062151): stale import completion changes the selected work | Valid asynchronous selection bug. | Capture an import selection generation before uploading; a superseded completion may finish storage but must not replace the newer reader selection. |
| [3999062153](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3999062153): inconsistent imported dimensions | Duplicate of 3999056110. | Rejected by the shared dimension guard in `66969e3`; covered by the same regression tests. |
| [3999062157](https://github.com/rebots-online/EnZIME/pull/2#discussion_r3999062157): inherited object keys used as node IDs | Valid: inherited functions can corrupt numeric rendering state. | Reject every `Object.prototype` property name before graph replacement; test the complete set and preservation of the existing graph on rejection. |

### PR2 follow-up receipt at `66969e3` (13 September 2026)

All seven follow-up rows above are addressed. Embedding HTTP/vector rejection (3999011144) was already implemented in `070313e`; expanded tests confirm its failure/retry behavior. The other ThinkSpace follow-ups and resolved-path static serving are implemented in the final follow-up batch. The original 43 threads plus seven additional threads now have explicit dispositions.

Observed worker runs on the final shared PR2 tree: `node --test test/thinkspace-review.test.mjs` passed 35/35; `npm test` passed 58/58 with zero failures; `npm run build` exited 0. These are dated results, not permanent test-count promises. Browser-engine, real-provider, device, frame-rate, and hostile-local-process qualification remain the explicit release limitations above.
