# Shared LeakProof reports: setup and acceptance

This adds shared persistence only. OpenAI prompts, sampling, water gates, temporal analysis and risk scoring are unchanged. No cloud resources are created by `npm install`, tests or the production build.

## 1. Create the Supabase project

1. Open [Supabase Dashboard](https://supabase.com/dashboard), choose your organization and **New project**.
2. Name the project, choose a strong database password and a suitable region, and create it.
3. Wait for provisioning to finish. Keep this project separate from unrelated applications if possible.

## 2. Run the initial SQL migration

1. In that project, open **SQL Editor → New query**.
2. Paste the entire contents of [`supabase/reports.sql`](../supabase/reports.sql) and run it once.
3. The transaction creates `public.reports`, CHECK constraints, indexes, RLS, service-role privileges and the private bucket. It deliberately does not drop existing tables. If `reports` already exists, inspect its schema before adapting/running this initial migration; do not delete existing reports.
4. Verify the result with this read-only query:

```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'report-evidence';

select relrowsecurity from pg_class
where oid = 'public.reports'::regclass;

select
  has_table_privilege('anon', 'public.reports', 'SELECT') as anon_can_read,
  has_table_privilege('authenticated', 'public.reports', 'SELECT') as users_can_read,
  has_table_privilege('service_role', 'public.reports', 'SELECT') as server_can_read;
```

Expected: `public=false`, size limit `52428800`, only MP4/WebM/QuickTime MIME types; RLS is `true`; privileges are `false`, `false`, `true`.

## 3. Confirm the storage bucket

Open **Storage → report-evidence → Configuration** (bucket settings). Confirm the bucket is **private**, its limit is 50 MB, and allowed MIME types are `video/mp4`, `video/webm`, `video/quicktime`. Also ensure the project's global Storage file-size setting permits 50 MB.

Do not enable public access or add public read/write policies. The restrictive `storage.objects` policy blocks ordinary anon/authenticated access to this bucket even if the project already has broad permissive policies. Service-role operations and narrowly scoped signed upload/download capabilities handle access. [Private bucket access](https://supabase.com/docs/guides/storage/buckets/fundamentals).

## 4. Obtain the project URL and server key

1. Copy the **Project URL** from the project's **Connect** dialog or **Settings → Data API**.
2. In **Settings → API Keys → Legacy API Keys**, copy the **service_role** key. This implementation uses `SUPABASE_SERVICE_ROLE_KEY` only inside `server-only` modules.
3. Do not use the database password or anon key in place of the service-role key. Do not paste the key into source files, browser code or chat. No browser anon key is needed.

## 5. Configure local development

Keep existing OpenAI settings in `.env.local`. Add:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
DISPATCHER_ACCESS_KEY=YOUR_LONG_RANDOM_DISPATCHER_KEY
```

Generate the dispatcher key locally, for example with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Keep the generated value in `.env.local` and share it privately with authorized dispatchers. Never prefix either secret with `NEXT_PUBLIC_`. Do not add `NEXT_PUBLIC_SUPABASE_ANON_KEY`; this implementation does not need it. Restart the dev server after editing environment variables. Use Node.js 22 or newer (24.x recommended).

For real reports, retain `ANALYSIS_PROVIDER=openai`, the existing server OpenAI key, `OPENAI_WATER_GATE_MODEL=gpt-4.1-mini` and `OPENAI_TEMPORAL_MODEL=gpt-5.6-terra`.

## 6. Configure Vercel

1. Open the LeakProof project in Vercel → **Settings → Environment Variables**.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `DISPATCHER_ACCESS_KEY` for **Production**. Configure Preview/Development separately if used; all devices in the acceptance test must use the same deployment and Supabase project.
3. Keep the existing OpenAI variables and set `ANALYSIS_PROVIDER=openai` for the real demo deployment.
4. Select Node.js **24.x**, install with `npm ci` and build with `npm run build`.
5. Redeploy. Environment changes do not update an already-built deployment.
6. Use the same deployed HTTPS URL on both devices. `localhost` on a phone refers to the phone and does not refer to the laptop.

Vercel functions have a [4.5 MB request-body limit](https://vercel.com/docs/functions/limitations). Therefore `POST /api/reports/upload` validates metadata and creates a server-chosen UUID/path plus an upload capability; the browser uploads the original bytes directly to private Storage. `POST /api/reports` then verifies the uploaded file server-side and inserts the row. No video bytes pass through a Vercel request body, and no Supabase service key reaches the browser. This is a deliberate transport adjustment to preserve LeakProof's 50 MB limit.

## 7. Exact cross-device acceptance test

### DEVICE A — PHONE

1. Open LeakProof at the deployed HTTPS URL.
2. Analyse a valid water video.
3. Receive a `MEDIUM` or `HIGH` result.
4. Add location.
5. Submit report. Wait for the success screen and note the report ID.

### DEVICE B — LAPTOP

6. Open `/dashboard` on the same deployment.
7. Enter the dispatcher key and click **Unlock workspace**.
8. Click **Refresh reports**.
9. Confirm the new report ID appears as **CITIZEN REPORT**, distinct from demo incidents.
10. Open the report.
11. Play the original video evidence. Confirm it matches the phone's recording.
12. Change status `NEW → IN_REVIEW` and save.
13. Refresh the page (the same tab retains its session key).
14. Confirm status remains `IN_REVIEW`.

Also confirm a locked/new browser cannot list reports, update status or obtain a video URL; the dispatcher endpoints must respond `401`. If a video link expires, use **Reload video** to request a fresh authorized link.

## Access and failure behavior

- Only real `LOW`/`MEDIUM`/`HIGH` reports reach Supabase. Existing Zod schemas validate input; server report validation also checks consistency between risk and categorical signals. This validates the submitted analysis object's shape and consistency, not cryptographic proof of a past OpenAI call; AI request/response logic is unchanged.
- The server verifies actual stored size and file signature using `file-type`, as well as bounded video metadata. It does not transcode or independently measure the duration/dimensions of the stored container. Original bytes are preserved.
- The browser cannot select a storage path or replace report metadata after upload authorization. An HMAC receipt binds a server-generated UUID to the validated input and expires after 15 minutes. Storage upload capabilities themselves expire after two hours, cannot upsert an existing object, and grant no read/list access. [Supabase signed uploads](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl).
- A successful upload alone is not report success. Database failure triggers evidence cleanup after checking that a concurrent/retried submission has not already committed. A retry using the same valid receipt returns the existing report.
- If the database is unreachable during that cleanup check, deletion is deferred to protect possibly committed evidence. Cleanup failures log only the report ID, never secrets or video data.
- Closing the browser after upload but before finalization can leave an orphan object. Periodically inspect Storage objects older than two hours against `reports.evidence_path`, and delete only confirmed orphans via the Storage dashboard/API. Do not delete `storage.objects` rows directly. No automatic cleanup job is installed.
- There are no public table policies. Citizen upload authorization is public and deliberately unauthenticated for the hackathon; consider Vercel rate limits on `/api/reports/upload` before opening the service broadly. A shared dispatcher key is a hackathon access mechanism, not individual user accounts or an audit trail.
- Evidence playback uses authorized, five-minute signed URLs; URLs are never stored in `reports`. Treat signed URLs as temporary bearer credentials: a recipient can use one until expiry. [Signed download URLs](https://supabase.com/docs/reference/javascript/file-buckets-createsignedurl).
- Keys are not logged. Server errors returned to browsers contain generic operational messages. Dashboard keys stay in sessionStorage and are cleared by **Lock workspace** or an unauthorized response. Rotate `DISPATCHER_ACCESS_KEY` and redeploy to revoke that shared credential; already-issued playback links last until their expiry.
- Demo fixtures and simulated submissions stay in IndexedDB and remain labelled. Old real IndexedDB reports are not automatically migrated. Supabase errors never fall back to local success.

## Verification boundary

Unit tests mock Supabase and make no paid API/storage requests. Passing tests/build confirms local implementation behavior only. Run the migration verification query and the exact two-device test above before claiming the cloud integration works. This setup guide does not imply the project has been provisioned or deployed.
