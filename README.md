# LeakProof

A software-only civic water-reporting MVP for Aktau. Residents record a 5–10 second observation, review visible evidence, add a location and create a report. Dispatchers review incidents on an OpenStreetMap map and update their status.

LeakProof assesses **visible signs that may justify inspection**. It does not diagnose broken pipes or claim measured detection accuracy.

## Run

Node.js 22+ and npm are required; Node.js 24.16.0 was used for verification.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Routes: `/`, `/scan`, `/dashboard`, and the server endpoint `POST /api/analyze`.

## Select analysis mode

Copy `.env.example` to `.env.local`. The default is an explicitly labelled deterministic demo:

```dotenv
ANALYSIS_PROVIDER=demo
```

To enable real vision analysis:

```dotenv
ANALYSIS_PROVIDER=openai
OPENAI_API_KEY=your_server_side_key
OPENAI_WATER_GATE_MODEL=gpt-4.1-mini
OPENAI_TEMPORAL_MODEL=gpt-5.6-terra
```

Restart the local server after changing configuration. Set the same variables in Vercel and redeploy. Never use a `NEXT_PUBLIC_` variable for the API key. Server modules are marked `server-only`.

These stage-specific settings default to the models shown above. The deprecated `OPENAI_VISION_MODEL` is no longer used; migrate it to the two explicit settings to avoid assigning one model both jobs. The public analysis result and saved-report formats remain compatible.

Automated tests use controlled responses and never spend API credits. A missing key, timeout, refusal, malformed response or network failure produces a safe error. There are no automatic retries or fallback models. Server diagnostics identify the failing stage, with sanitized provider errors; API keys and image payloads are not logged or exposed to the browser.

## Analysis architecture

```text
Original video → browser validation → 6 sampled JPEG frames
→ server request validation → gpt-4.1-mini quality/water gate
  → poor quality: UNCERTAIN and stop
  → insufficient water: NO_WATER and stop
  → confirmed water: gpt-5.6-terra temporal evidence → validation
→ deterministic risk rules → explanation and recommendation
```

- `src/domain/` — domain types and asynchronous report repository contract.
- `src/lib/analysis/provider.ts` — `AnalysisProvider`, explicit selection, demo adapter.
- `src/lib/analysis/frames.ts` — browser-native video decoding, canvas sampling and cleanup.
- `src/lib/analysis/real-provider.ts` — real client adapter; calls only the app server.
- `src/app/api/analyze/route.ts` — bounded request parsing, validation and safe errors.
- `src/lib/analysis/openai-server.ts` — two sequential OpenAI Responses API stages, separate strict JSON schemas, a shared 28-second deadline and `store: false`.
- `src/lib/analysis/scoring.ts` — categorical evidence validation and deterministic risk/explanations.
- `src/lib/analysis/result-schema.ts` — shared validation of API results and persisted analyses.
- `src/lib/reports/` — shared Supabase report service, remote repository and separate IndexedDB demo storage.
- `src/components/` — existing scan, report, dashboard and map components.

The provider accepts both video metadata and the original blob. The real adapter extracts six moments distributed from 0.1 seconds to 0.1 seconds before the end, resizes the longest edge to at most 960 pixels and compresses JPEGs. The server accepts exactly six chronological frames and caps the complete request at 2.2 MB. No native FFmpeg binary is deployed, keeping this path suitable for Vercel. FFmpeg is used only by the optional test-fixture generator.

Stage 1 returns only quality, quality issues, water presence, categorical water evidence and supporting frame indices. Application code requires at least two distinct valid indices 0–5 spanning at least three positions before calling Stage 2. Dry or unusable recordings use one provider call; confirmed water uses two. Inputs rejected by server validation may use no provider calls.

Stage 2 receives the same chronological frames and is told water is established. It returns only flow, source and spreading signals with their supporting frame indices. It cannot override water evidence or choose risk. Terra requests omit the unsupported `temperature` parameter. The application never parses arbitrary prose to choose risk: existing deterministic rules assemble the final result, explanations and recommendations. Ambiguous temporal evidence can still produce `UNCERTAIN` after water passes the gate.

## Deterministic risk rules

Quality is checked first: poor quality, reported quality issues or resolution below 320 pixels on the shorter edge produces `UNCERTAIN`.

With usable quality, absent water or `NONE`/`WEAK` water evidence produces `NO_WATER` and suppresses downstream assessment.

For each claimed temporal signal, corroboration requires distinct frame indices spanning at least half the sample sequence (index separation >= 3): active flow and persistent source need at least 3 frames; spreading needs at least 2. Unsupported YES claims become UNCERTAIN.

After the gates:

| Rule                                                           | Outcome     |
| -------------------------------------------------------------- | ----------- |
| Active flow unknown, or at least two temporal signals unknown  | `UNCERTAIN` |
| Water established, no supported positive temporal signals      | `LOW`       |
| At least one supported positive signal                         | `MEDIUM`    |
| STRONG water evidence and all three supported positive signals | `HIGH`      |

**Real results contain no invented probabilities.** `waterConfidence` and `activeFlowProbability` are null; the UI shows water evidence and active flow as categories. The risk rules are deterministic for the same validated observations; model observations themselves can vary between requests, even at temperature zero. These rules are conservative heuristics, not calibrated accuracy claims.

`NO_WATER` has no report action or meaningless metrics. `UNCERTAIN` asks the resident to record again. `MEDIUM`/`HIGH` recommend inspection. A human must determine the actual cause of water.

## Privacy and persistence

Only the six JPEG frames and timestamps are sent to OpenAI. The full video, audio, geolocation, filename and report description are not sent to that provider. The app does not persist processing frames on the server; browser object URLs and canvas buffers are cleaned up. `store: false` disables Responses storage; it is not a claim of zero provider retention. See [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

Submitting a real report stores the original video in private Supabase Storage and its assessment/location in PostgreSQL. The server validates metadata, analysis consistency and uploaded file signatures. A server-issued signed upload URL keeps videos up to 50 MB outside Vercel's 4.5 MB request-body limit. The report is confirmed only after the database insert succeeds. There is no local fallback for real submissions.

Dispatchers unlock `/dashboard` with a shared access key stored only in that tab's sessionStorage, then refresh to fetch reports across devices. Evidence links expire after five minutes. Demo incidents and demo submissions remain explicitly labelled and local to IndexedDB; they are never uploaded. Previously stored real IndexedDB reports are not automatically uploaded or presented as shared reports. Nothing automatically notifies city services.

Run the migration and configure Supabase/Vercel using [SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md). Automated tests mock Supabase; they do not establish that a deployed project is configured correctly. The two-device acceptance test is required before claiming live cloud integration works.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The default browser suite exercises the demo workflow on desktop and mobile. The real-mode suite exercises actual browser frame extraction, a controlled API response, real-mode result persistence and the missing-key response:

```sh
# POSIX shell
E2E_ANALYSIS_PROVIDER=openai npm run test:e2e
# PowerShell
$env:E2E_ANALYSIS_PROVIDER='openai'; npm run test:e2e
```

Both suites target the production build. They use ports 3000 and 3002 respectively; keep these free or ensure an existing server uses the intended mode. `PLAYWRIGHT_EXECUTABLE_PATH` can select an existing Chromium binary. Unit tests cover dry scenes, poor quality, all risk rules, missing temporal support, malformed schemas, timeout, refusal, network error, input bounds and local persistence.

`tests/fixtures/observation.webm` is a generated 7-second test slate, not a water dataset. Its 3-second companion tests invalid duration. The optional `scripts/create-test-video.mjs` generator requires FFmpeg with VP8 support (`FFMPEG_PATH`).

## Deploy

Import this Git repository into Vercel using its Next.js preset. Install with `npm ci`, build with `npm run build`, retain the default output directory and use Node.js 24.x. Configure analysis variables on the server. Geolocation requires HTTPS outside localhost. No Vercel deployment is implied by pushing the repository.

Before enabling a paid provider on a publicly exposed endpoint, configure provider spend limits and deployment-level rate limiting. The MVP does not implement distributed request quotas or authentication; same-origin checks and payload bounds are not a substitute for those controls.

## Limitations and next step

Six sampled frames can miss fast movement, intermittent sources and subtle spreading. Vision descriptions are not optical-flow measurements. Camera movement, reflections and occlusion can remain ambiguous; quality assessment also relies on the model. Client-supplied frames and metadata are not forensic proof that a recording is authentic. The system cannot establish an underground cause or measured accuracy.

OpenStreetMap tiles require network access; coordinate entry and incident lists remain available if tiles fail. Native camera capture is browser/device-dependent and still needs physical iOS/Android testing. The icon and manifest are present; there is no offline service worker.

**Next:** evaluate the real provider on a consented, labelled set of dry scenes, misleading reflections, poor recordings, standing water and sustained flow before tuning gates or making any performance claim.

References: [OpenAI vision inputs](https://developers.openai.com/api/docs/guides/images-vision), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini), [Next.js](https://nextjs.org/docs/app), [React Leaflet](https://react-leaflet.js.org/docs/start-introduction/).
