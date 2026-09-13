# LeakProof domain and adapter report

## Scope delivered

The domain layer defines the requested analysis, video, report, status, coordinate, and repository contracts. Browser adapters provide deterministic demo analysis, video-file safety checks and metadata extraction, IndexedDB persistence, and shared presentation metadata. No network AI, municipal submission, or memory-storage fallback is present.

## Analysis behavior

- `NO_WATER` executes only the `water` stage, reports `waterDetected: false`, and leaves movement, source, and spreading signals `null`.
- `UNCERTAIN` also stops after the water stage, suppresses downstream claims, and asks the citizen to capture another steady 5–10 second recording.
- `LOW`, `MEDIUM`, and `HIGH` execute `water`, `movement`, `source`, and `risk` in order. Each stage takes approximately 600 ms in the real adapter.
- All five scenario outputs are deterministic and explicitly identify `provider: "demo"` and the selected scenario.
- Resolution below 320 pixels on the shorter side forces an `UNCERTAIN` risk while retaining the selected scenario as provenance. Invalid duration or unsafe metadata is rejected before any stage callback.
- Abort signals are honored before analysis and between stages. Exported `AnalysisInput` carries both decoded metadata and the original `source: Blob`, and the adapter rejects a missing, empty, or size-mismatched source before emitting progress. `analyzeLeakVideo` delegates to a concrete `AnalysisProvider` instance.

## Video safety

The adapter accepts MP4, WebM, and QuickTime files up to 50 MB. When MIME type is empty, `.mp4`, `.webm`, and `.mov` extensions provide a conservative fallback. Empty files, malformed sizes, unsupported MIME types, duration outside 5–10 seconds, and non-finite or zero dimensions return user-displayable validation messages.

`readVideoMetadata` reads the browser's decoded duration and dimensions, rejects browser decode failures, honors cancellation, and times out after 12 seconds. Its temporary object URL is revoked after success, decode failure, timeout, or cancellation.

## Report persistence

`getReportRepository()` returns an IndexedDB-backed implementation of `ReportRepository`. Reports and evidence use separate `reports` and `evidence` stores. Citizen creation uses one read/write transaction across both stores, so a report cannot commit without its original video blob. Input validation checks coordinates, status, analysis bounds and gating invariants, text limits, metadata, evidence presence, and evidence-size agreement.

Every read validates persisted report data before returning it. Storage and schema errors are surfaced with operation context; there is no silent in-memory fallback. Status updates use a read/write transaction, and every operation opens the same durable database and closes its connection after completion.

Six fixed fixtures seed idempotently around Aktau (approximately 43.65, 51.16). They cover LOW, MEDIUM, and HIGH risks and all report statuses. Every fixture is visibly described as a demo, has `isDemo: true`, and has no fake video metadata or evidence identifier. Existing fixture status edits are retained because seeding only inserts missing IDs.

## Presentation rules

Risk and status metadata cover every union member with static Tailwind class strings and contrast-safe foreground/background pairs. `canReport` returns true only for LOW, MEDIUM, and HIGH results. Date formatting is shared through `formatDate`.

## Automated coverage

The Vitest suite covers all five scenarios, deterministic output, risk value bounds, water gating, uncertain-claim suppression, ordered stage callbacks, fixed stage timing under fake timers, low-resolution downgrading with selected-scenario provenance, invalid duration, source-blob size agreement, cancellation before and between stages, supported formats, empty and oversized files, unsafe dimensions, browser decode failure, metadata timeout, URL cleanup, report seed idempotence, transactional evidence retention, concurrent create and status operations, persistence across repository access, malformed create inputs, invalid statuses, missing reports, and corrupt stored records.

Final verification results are recorded after the final fresh run:

- `npm.cmd test -- --run tests/analysis.test.ts tests/video.test.ts tests/reports.test.ts tests/presentation.test.ts` — 4 files passed, 49 tests passed, 0 failed.
- `npm.cmd run typecheck` — Next route types generated and TypeScript exited successfully.
- `npx.cmd eslint src/domain src/lib tests --max-warnings=0` — exited successfully with 0 warnings or errors.

Vitest currently emits a configuration migration warning because `vitest.config.ts` uses ESM syntax while the package is not marked as an ESM package. This does not affect test results and belongs to the project configuration scope.
