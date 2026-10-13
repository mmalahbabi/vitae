# Garmin export import

Vitae now reads Garmin **Account Management data exports** and saves selected
measurements to the existing Supabase account. It does not connect to Garmin or
request a Garmin password. Imports are manual snapshots, not live synchronization.

## Use

1. Request an export at [Garmin Account Data Management](https://www.garmin.com/account/datamanagement/).
   Garmin prepares the download separately; see [Garmin's export help](https://support.garmin.com/en-US/?faq=W1TvTPW8JZ6LfJSfK512Q8).
2. In Vitae's Overview or Training tab, choose the downloaded ZIP. For larger
   exports, unzip it on your device and select the supported JSON files below.
3. Check the preview dates, counts, invalid records and ignored files. Select
   **Save to my Vitae account**. Previewing alone does not upload anything.
4. Today's dashboard uses only measurements matching today's UAE calendar date.
   Training lets you select older imported dates and browse completed workouts.
   Import a new export to update the readings.

| Garmin export file | Saved measurements | Units |
| --- | --- | --- |
| `UDSFile*.json` | Steps, daily/active calories, resting/minimum/maximum heart rate | count, kcal, bpm |
| `*sleepData.json` | Total sleep, deep/light/REM/awake durations | seconds |
| `*summarizedActivities.json` | Activity ID/type, dates/times, duration, distance, calories, average/maximum HR | export milliseconds → seconds; centimetres → metres; kcal unchanged |

The first two formats are arrays of records with `calendarDate`. The activity
format is an array of containers with a `summarizedActivitiesExport` array. These
adapters intentionally do not guess units or recursively ingest arbitrary JSON.
Unknown layouts produce a visible unsupported-file/no-records result.

Not supported: individual FIT/TCX/GPX/CSV activity files, continuous heart-rate
samples, HR zones, planned workouts, routes, stress, HRV and Body Battery. Summary
HR measurements and workout average/maximum HR are supported. Some devices or
export revisions omit fields; missing values stay unavailable instead of zero.

## Dates, calculations and repeated imports

- Garmin calendar dates are preserved. Sleep uses Garmin's assigned date. Local
  workout wall-clock timestamps are stored separately from UTC timestamps.
- `Asia/Dubai` is the default fallback for UTC-only workouts. Change it before
  selecting files if those workouts should be grouped in another IANA time zone.
  The app does not reinterpret Garmin's explicit local dates.
- Daily energy comes only from the daily calorie field. Workout calories are
  **not added again**. Garmin calorie readings are device estimates and today's
  export may only cover part of the day.
- Newly logged meals explicitly use the same UAE date/time as the dashboard,
  avoiding the database's UTC date default near midnight. Existing meal dates
  are not rewritten.
- Sleep total prefers `sleepTimeSeconds`. Otherwise it sums deep + light + REM,
  with absent REM treated as unsupported by older devices. Awake and unmeasurable
  time are excluded. A total is not fabricated if deep/light are missing.
- Rows are keyed by `(user_id, day)` or `(user_id, activity_id)`. Reimporting updates
  supplied values and retains existing fields absent from the new file. Use the
  latest export: this version does not infer source revision ordering. Repeated
  imports update `imported_at` but do not multiply records or calorie totals.
- Within one selection, overlapping valid records are merged in file order and
  reported in the preview. Invalid records are skipped and counted. Damaged JSON
  aborts the preview. Database validation failures roll back the entire save.
- Limits: 100 MB selected input, 20 MB per selected JSON, 64 MB expanded selected
  JSON, 2,000 selected JSON files and 15,000 input records per import. The server
  separately limits normalized records and payload bytes.

## Storage and privacy

`garmin_daily` and `garmin_workouts` are added alongside the existing schema;
`daily_metrics.water_l`, meals, protocols and bloodwork are not changed by imports.
Only normalized measurement fields are saved. GPS, activity titles (which can
contain locations), account details, filenames and raw exports are excluded.

The parser runs in a terminable Web Worker on the device. The only write is the
explicit save via `import_garmin_export`, a single Postgres transaction. All rows
belong to `auth.uid()`; the RPC also verifies the preview's expected account to
prevent an account-switch race. Both tables have row-level security and explicit
authenticated grants; anonymous users cannot read or write them. RPCs use
`SECURITY INVOKER` and an empty search path. No service-role key belongs in Vite.

Imported values are not added to localStorage or service-worker caches. Existing
Supabase session persistence remains unchanged. The provider is remounted when
accounts change, discards old data, and ignores stale requests. The remove action
asks for confirmation and transactionally deletes only that user's Garmin rows.
Supabase backup retention is controlled by the project's existing backup policy.
This is account access control and data minimization, not end-to-end encryption.

The existing Capacitor 8.4.1 native dependencies were also affected by
[GHSA-rvm3-566m-v7fv](https://github.com/ionic-team/capacitor/security/advisories/GHSA-rvm3-566m-v7fv),
which can expose application-origin storage through malicious navigation. This
change pins the four Capacitor packages and the iOS Swift package to the vendor's
patched 8.4.3 release. Rebuild and redistribute native apps to apply the patch;
publishing web assets alone does not update installed native binaries.
The existing `tar`, `brace-expansion` and `@xmldom/xmldom` dependency locks were
also updated within their allowed ranges to resolve reported security advisories.

## Deployment and current blockers

Inspection on **12 October 2026** found main at
`26b17d0211d56aa7a644791515be49ea79a212e2`, no open PRs, and only the existing
`analyze-meal`, `analyze-label` and `analyze-lab` Edge Functions. The connected
Supabase project named `vitae` reported **INACTIVE**. No live migration or
production deployment was performed as part of preparing this change.

To activate:

1. Restore/resume the existing Vitae Supabase project and confirm it is healthy.
2. Apply `supabase/migrations/20261012130203_garmin_export_import.sql` through the
   project's normal migration process. Existing installations must already have
   `0001_init.sql` and `0002_meals_metrics.sql`. Do not rerun old migrations that
   already exist in the project's history. Review any schema drift first.
3. Keep `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` configured with the
   project's public client credentials. No new secret is needed for imports.
4. Deploy the reviewed frontend change. The existing main-branch workflow deploys
   to GitHub Pages. For native apps, run the existing Capacitor build/sync process
   and verify the file picker on the target devices.
5. Sign in and import an actual Garmin export. Inspect a known day and workout
   against Garmin Connect, reload, reimport the same data and confirm no duplicates.

## Automatic synchronization is separate

Garmin's [Developer Program FAQ](https://developer.garmin.com/gc-developer-program/program-faq/)
describes approved business access and OAuth 2.0. The
[Health API](https://developer.garmin.com/gc-developer-program/health-api/) covers
daily health summaries after user consent; the
[Activity API](https://developer.garmin.com/gc-developer-program/activity-api/)
covers activity data. No approved Garmin application credentials or existing
Garmin integration were available in the inspected Vitae setup. The public FAQ
also displays “Stay tuned for more updates on the program”; do not assume that
new applications can currently be onboarded without confirming with Garmin.

Future automatic sync needs Garmin approval for the relevant APIs, issued OAuth
client credentials, registered redirects, user consent and a server integration
for secure token storage/refresh, approved data delivery, revocation and deletion.
Client secrets/tokens must remain server-side. This PR deliberately contains no
unofficial Garmin sign-in scraper and no button pretending to connect.

## Validation

```sh
npm ci
npm test
npm run lint
npm run build
npm run build:capacitor
npx playwright install chromium
npm run test:browser
```

Unit tests cover Garmin-layout synthetic fixtures, units, dates, null/zero values,
archive handling, invalid files and duplicates. PGlite runs the actual migration
SQL on an isolated Postgres engine with simulated Supabase auth roles and two
users, checking RLS, account-switch protection, atomic rollback, idempotency and
hydration preservation. Browser tests intercept a synthetic Supabase endpoint and
exercise ZIP selection, preview/save, dashboard refresh, failure, deletion,
sign-out and a mobile viewport. They do not use a live account or personal data.

The inactive hosted database, real user exports, native iOS/Android file pickers
and Garmin OAuth are **not** validated by these local tests. Fixture fields were
cross-checked against public first-hand Garmin export analyses
([daily/sleep](https://xgarrido1.gitlab.io/garmin_data/),
[activity format](https://github.com/mgilangjanuar/garmin-running-analytics)); Garmin
does not promise a stable public schema for the account export. New layouts need
an explicit adapter and a deidentified fixture, not silent unit guessing.

Recorded local verification: 24 parser/data/Postgres test assertions and 3 browser
flows passed; web and Capacitor asset builds passed. Browser verification used
Chromium 153 via `VITAE_TEST_CHROMIUM` because the standard Playwright browser
download was unavailable in the working environment. This is not a native device
test. Lint has one pre-existing unused `adherence` warning, and Vite retains its
existing large-bundle warning. `npm audit --omit=dev` reports zero vulnerabilities
after the security updates; it is not a complete security audit of the app.
