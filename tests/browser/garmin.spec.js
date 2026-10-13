import { test, expect } from '@playwright/test';
import { zipSync, strToU8 } from 'fflate';
import { documents, workout } from '../garmin-fixtures.js';

const owner = '11111111-1111-4111-8111-111111111111';
const user = { id: owner, aud: 'authenticated', role: 'authenticated', email: 'synthetic@example.test', app_metadata: {}, user_metadata: {} };
const fixture = documents.map(d => ({ ...d, data: d.name.includes('summarized')
  ? [{ summarizedActivitiesExport: [{ ...workout, startTimeGmt: '2026-10-12T02:30:00', startTimeLocal: '2026-10-12T06:30:00' }] }]
  : d.data.map(r => ({ ...r, calendarDate: '2026-10-12' })) }));
const archive = { name: 'Garmin-export.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync(Object.fromEntries(fixture.map(d => [d.name, strToU8(JSON.stringify(d.data))])))) };

async function setup(page, { failSave = false, failRead = false } = {}) {
  let days = [], workouts = [], writes = [];
  await page.clock.install({ time: new Date('2026-10-12T12:00:00Z') });
  await page.addInitScript(({ user }) => {
    const token = `${btoa(JSON.stringify({ alg: 'HS256' }))}.${btoa(JSON.stringify({ sub: user.id, exp: 2000000000 }))}.fake`;
    localStorage.setItem('sb-vitae-test-auth-token', JSON.stringify({ access_token: token, refresh_token: 'synthetic', expires_at: 2000000000, expires_in: 3600, token_type: 'bearer', user }));
  }, { user });
  await page.route('https://vitae-test.supabase.co/**', async route => {
    const req = route.request(), url = new URL(req.url());
    const json = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname.endsWith('/auth/v1/user')) return json(user);
    if (url.pathname.endsWith('/auth/v1/logout')) return route.fulfill({ status: 204 });
    if (url.pathname.endsWith('/rpc/import_garmin_export')) {
      if (failSave) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'offline' }) });
      const body = req.postDataJSON(); writes.push(body);
      expect(body.expected_user_id).toBe(owner);
      days = body.daily_rows.map(r => ({ ...r, user_id: owner, imported_at: '2026-10-12T12:00:00Z' }));
      workouts = body.workout_rows.map(r => ({ ...r, user_id: owner, imported_at: '2026-10-12T12:00:00Z' }));
      return json({ days: days.length, workouts: workouts.length });
    }
    if (url.pathname.endsWith('/rpc/delete_garmin_data')) { days = []; workouts = []; return json(null); }
    if (/garmin_daily|garmin_workouts/.test(url.pathname)) {
      if (failRead) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST205' }) });
      return json(url.pathname.endsWith('garmin_daily') ? days : workouts);
    }
    if (url.pathname.endsWith('/daily_metrics')) return json(null);
    return json([]);
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Garmin data', exact: true })).toBeVisible();
  return { writes };
}

test('ZIP preview, explicit save, Overview/Training readings, refresh, delete and sign out', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const { writes } = await setup(page);
  await expect(page.getByText('Awaiting daily calories')).toBeVisible();
  await page.getByLabel('Choose Garmin export', { exact: true }).setInputFiles(archive);
  await expect(page.getByRole('heading', { name: 'Review import · 2026-10-12 to 2026-10-12' })).toBeVisible();
  expect(writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Save to my Vitae account' }).click();
  await expect(page.getByRole('status')).toContainText('Saved 1 daily record and 1 workout');
  await expect(page.getByText('8,765', { exact: true })).toBeVisible();
  await expect(page.getByText('7.5h', { exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(JSON.stringify(writes)).not.toMatch(/Latitude|Longitude|home address|privateAccountField/);
  await page.getByRole('button', { name: 'Training', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Daily readings', exact: true })).toBeVisible();
  await expect(page.getByText('0h 42m · 7.10 km')).toBeVisible();
  await page.reload();
  await expect(page.getByText('8,765', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove imported Garmin data' }).click();
  await page.getByRole('button', { name: 'Confirm removal' }).click();
  await expect(page.getByText('Awaiting daily calories')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByText('Sign in to your health data')).toBeVisible();
  await expect(page.getByText('8,765', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('save failure retains preview for retry and never reports a successful import', async ({ page }) => {
  await setup(page, { failSave: true });
  await page.getByLabel('Choose Garmin export', { exact: true }).setInputFiles(archive);
  await page.getByRole('button', { name: 'Save to my Vitae account' }).click();
  await expect(page.getByRole('alert')).toContainText('could not be read or saved');
  await expect(page.getByRole('heading', { name: /Review import/ })).toBeVisible();
  await expect(page.getByText('Awaiting daily calories')).toBeVisible();
  await expect(page.getByText(/Saved 1 daily/)).toHaveCount(0);
});

test('mobile import and unavailable database state are usable without fake readings', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { failRead: true });
  await expect(page.getByRole('alert')).toContainText('storage is not ready');
  await page.getByRole('button', { name: 'Training', exact: true }).click();
  await page.getByLabel('Choose Garmin export', { exact: true }).setInputFiles(archive);
  await expect(page.getByRole('heading', { name: /Review import/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/garmin-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Discard preview' }).click();
  await expect(page.getByText('No workouts imported.', { exact: true })).toBeVisible();
});
