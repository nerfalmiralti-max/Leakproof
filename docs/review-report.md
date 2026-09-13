# LeakProof source review

Reviewed 2026-09-13 against the supplied MVP specification and `docs/superpowers/plans/2026-09-13-leakproof.md`. This is an independent source/contract review of all `src/domain`, `src/lib`, `src/components`, `src/app` files and the four unit-test files. No existing tests were rerun; browser verification and final command results belong to the implementation task. No real AI, Supabase connection, authentication, or city dispatch is expected in this milestone.

## Actionable finding

### P2 — Landing map wrapper loses its absolute positioning

**Location:** `src/app/globals.css:42`, applied to `src/components/landing-map.tsx:11`.

**Trigger:** Open the landing page after the lazy Leaflet component loads. The inner map wrapper uses `map-shell absolute inset-0`, but the unlayered `.map-shell` rule sets `position: relative`. An unlayered declaration outranks Tailwind's layered `absolute` utility. This wrapper has no explicit height, so its Leaflet child, whose height is `100%`, cannot fill the intended 380/472-pixel preview. The map can collapse inside an otherwise correctly sized outer preview card. Dispatcher and report maps provide explicit wrapper heights and do not share this particular failure.

**Fix:** Keep the positioning utility in control: move the shared class into an appropriate CSS layer, remove its global positioning declaration and set relative positioning only on wrappers that need it, or give the landing wrapper an explicit positioning override. Verify a nonzero Leaflet height and visible tiles/markers on both desktop and mobile.

## Spec compliance verdict

**Qualified pass for the requested local demo foundation, subject to fixing the landing map and completing the owner's browser checks/documentation.** No source-level blocker was found in the principal upload → analysis → location → report → evidence → status → reload contract.

- The three App Router pages, mobile capture input, preview/removal, timed analysis stages, all five outcomes, geolocation/map/coordinate entry, optional notes, report confirmation, dispatcher filters/details/status controls, manifest, and icon are present.
- File and metadata validation enforce supported video formats, nonempty files, 50 MB maximum, 5–10 seconds, and readable dimensions. Metadata reading is abortable, times out, and releases its object URL. Preview errors disable analysis.
- The default scenario is UNCERTAIN; results come from fixed scenario definitions. Low resolution is downgraded to UNCERTAIN. NO_WATER and UNCERTAIN stop after the water stage, have no downstream signal values, show the required safe copy, and cannot reach report creation through the UI. The repository separately rejects non-actionable creation inputs.
- Analysis and dispatcher evidence are visibly labelled DEMO/simulated. User-facing copy does not confirm a leak, and submission/confirmation/status controls clearly explain local storage and the absence of city dispatch.
- Report creation stores the report and original video in one IndexedDB transaction and waits for completion before returning success. Dashboard retrieval resolves the evidence reference to the retained Blob. Status updates read and modify the stored report in a transaction. Opening the database only inserts missing fixtures, preserving their edited statuses.
- Runtime schemas reject malformed stored reports before they reach badge/date/map presentation. Invalid stored evidence produces an error state. A malformed row currently makes the entire list request fail; the dashboard reports the failure rather than silently inventing replacement data. This is fail-closed behavior, with no in-app repair tool in scope.
- Inputs have labels, action controls are native buttons/links, errors and progress are announced, and coordinate fields plus the incident list provide alternatives to map interaction. No keyboard-only completion blocker was identified by source inspection; this is not a full accessibility audit.

## Code quality verdict

**Suitable separation for this MVP.** Domain contracts, analysis adapter, repository, presentation rules, reusable evidence rendering, citizen workflow, and dispatcher UI are distinct. Cancellation guards, save locks, schema validation, and explicit storage errors are meaningful defensive measures. The unit tests cover the core safety and persistence contracts rather than only snapshots.

Before real AI integration, extend the analysis input to carry video evidence or a retrievable reference: the present input contains only metadata and a demo scenario. Provider provenance and the repository schema currently deliberately allow only `demo`, so those contracts must be extended together with a real adapter. This is contained adapter/domain work, not evidence of a working AI backend.

Many UI components are compressed into very long JSX lines. Formatting them into normal multiline JSX would improve future reviews and maintenance without changing behavior. This is a maintainability recommendation, not an MVP functional blocker.

README/deployment instructions were still being written by the owner at review time, and final lint/typecheck/build/E2E outcomes were not independently executed by this review.
