# LeakProof

A software-only civic water-reporting MVP for Aktau. Residents record a 5–10 second observation, review visible evidence, add a location and create a report. Dispatchers review incidents on an OpenStreetMap map and update their status.

LeakProof assesses **visible signs that may justify inspection**. It does not diagnose broken pipes or claim measured detection accuracy.

## Run

Node.js 20.9+ and npm are required; Node.js 24.16.0 was used for verification.

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
OPENAI_VISION_MODEL=gpt-4.1-mini
```

Restart the local server after changing configuration. Set the same variables in Vercel and redeploy. Never use a `NEXT_PUBLIC_` variable for the API key. Server modules are marked `server-only`.

**No live provider call has been verified without an API key.** Automated tests use controlled responses and never spend API credits. A missing key, timeout, refusal, malformed response or network failure produces a safe error. Real mode never silently switches to demo.

## Analysis architecture

```text
Original video → browser validation → 6 sampled JPEG frames
→ server request validation → one structured OpenAI vision request
→ quality gate → water gate → temporal evidence validation
→ deterministic risk rules → explanation and recommendation
```

- `src/domain/` — domain types and asynchronous report repository contract.
- `src/lib/analysis/provider.ts` — `AnalysisProvider`, explicit selection, demo adapter.
- `src/lib/analysis/frames.ts` — browser-native video decoding, canvas sampling and cleanup.
- `src/lib/analysis/real-provider.ts` — real client adapter; calls only the app server.
- `src/app/api/analyze/route.ts` — bounded request parsing, validation and safe errors.
- `src/lib/analysis/openai-server.ts` — OpenAI Responses API, strict JSON schema, 28-second timeout and `store: false`.
- `src/lib/analysis/scoring.ts` — categorical evidence validation and deterministic risk/explanations.
- `src/lib/analysis/result-schema.ts` — shared validation of API results and persisted analyses.
- `src/lib/reports/` — IndexedDB implementation, separate report/video stores and transactional creation.
- `src/components/` — existing scan, report, dashboard and map components.

The provider accepts both video metadata and the original blob. The real adapter extracts six moments distributed from 0.1 seconds to 0.1 seconds before the end, resizes the longest edge to at most 960 pixels and compresses JPEGs. The server accepts exactly six chronological frames and caps the complete request at 2.2 MB. No native FFmpeg binary is deployed, keeping this path suitable for Vercel. FFmpeg is used only by the optional test-fixture generator.

The model returns quality, categorical water evidence, three categorical temporal signals and supporting frame indices. It is instructed to stop at inadequate quality or water evidence; application gates discard downstream claims regardless. The application never parses arbitrary prose to choose risk. Model observations are not displayed directly: explanations and recommendations are assembled from validated categories.

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

Creating a report explicitly stores the original video, assessment and location in the current browser's IndexedDB. These records are local to that browser profile and origin, subject to quota/eviction, and removed when site data is cleared. Nothing is sent to city services. Six sample incidents have explicit demo labels and no fabricated video evidence. Real and demo reports retain distinct analysis provenance after reload.

The async `ReportRepository` can be replaced with a Supabase adapter without rebuilding the UI. Shared storage, dispatcher authentication, access policies and private evidence playback belong to that next integration. No Supabase resource has been provisioned.

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
