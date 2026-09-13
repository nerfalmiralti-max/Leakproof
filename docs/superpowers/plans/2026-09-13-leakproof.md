# LeakProof implementation plan

**Goal:** Build the requested working civic water-reporting MVP in the empty workspace.

**Architecture:** Server-rendered Next.js pages surround small client workflows. Domain contracts keep analysis, evidence storage, report persistence, and result presentation independent. A deterministic, explicitly selected demo scenario never claims to inspect video pixels. IndexedDB stores reports and original video blobs transactionally, behind an async repository contract suitable for a future Supabase adapter.

**Stack:** Next.js App Router, TypeScript strict mode, React, Tailwind CSS, Leaflet / OpenStreetMap, Zod runtime validation, Vitest and browser integration checks. No AI API, authentication, or external report submission in this stage.

## Design

Colors: paper `#f5f7f5`, ink `#173e36`, civic green `#286b54`, pale green `#e8efdf`, lime `#dce99f`, muted text `#66746d`. Manrope display, DM Sans body, system monospace for report references. Quiet rounded panels, ample spacing, compact dispatcher controls. The landing page leads with water stewardship and a clearly labelled illustrative observation preview. Mobile uses one column; dashboard uses a list, map, and selected report panel.

## Implementation checklist

- [ ] Foundation: package/config files, `src/app/layout.tsx`, CSS tokens, metadata, icon and manifest; install dependencies; lint/typecheck/build.
- [ ] Domain and adapters: `src/domain/analysis.ts`, `src/domain/report.ts`, `src/lib/analysis/*`, `src/lib/reports/*`, `src/lib/video.ts`, `src/lib/presentation.ts`. Write safety and persistence tests first. Cover water gating, uncertain quality, deterministic scenarios, aborted analysis, validation, report status changes and retained evidence.
- [ ] Citizen flow: `src/app/page.tsx`, `src/app/scan/page.tsx`, `src/components/scan/*`, `src/components/report/*`. File/camera input, 5–10 second and 50 MB validation, preview/removal, cancellable stage progress, safe results, map/geolocation, optional notes, transactional submission and confirmation. Check lint/typecheck/build.
- [ ] Dispatcher: `src/app/dashboard/page.tsx`, `src/components/dashboard/*`, `src/components/map/*`. Aktau map, demo incident seed, risk/status filtering, accessible incident selection, evidence playback, explanation, persisted status updates and storage error states. Check lint/typecheck/build.
- [ ] Verification and documentation: `README.md`, reproducible tests and production browser checks. Exercise all five analysis outcomes, a real local video upload/report/status/reload cycle, mobile layouts and failure states. Run lint/typecheck/tests/production build and report exact results.

## Safety contracts

`AnalysisProvider.analyze(input, { signal, onStage }): Promise<AnalysisResult>` consumes validated video metadata and an explicit demo scenario. `NO_WATER` returns `waterDetected: false` and all downstream signals `null`. `UNCERTAIN` suppresses unsupported signals and recommends recording again. Only `LOW`, `MEDIUM`, and `HIGH` can create inspection reports. All demo outputs include provider provenance and a scenario label.

`ReportRepository.list()`, `get(id)`, `create(input, evidence)`, `updateStatus(id, status)`, and `getEvidence(id)` are asynchronous. Creation validates coordinates, notes, video metadata and analysis and stores the report and original blob atomically. A failure never produces a success screen. Seed incidents are labelled fixtures and never pretend to have uploaded video evidence. No incident is sent to a city service.

## Verification commands

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. No deployment is claimed without a deployment command; local persistence is documented as browser- and origin-specific.
