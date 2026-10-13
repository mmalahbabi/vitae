import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGarmin, saveGarmin, trainingSummary } from '../src/lib/garminData.js';

test('reads beyond Supabase default row cap, with explicit user filtering', async () => {
  const calls = [];
  const days = Array.from({ length: 1001 }, (_, i) => ({ day: String(i), imported_at: '2026-10-12T12:00:00Z' }));
  const client = { from(table) { return { select() { return this; }, eq(key, id) { calls.push([table, key, id]); return this; },
    order() { return this; }, range(a, b) { return { data: table === 'garmin_daily' ? days.slice(a, b + 1) : [], error: null }; } }; } };
  const result = await loadGarmin(client, 'owner');
  assert.equal(result.days.length, 1001);
  assert.ok(calls.every(([, key, id]) => key === 'user_id' && id === 'owner'));
});
test('expired or switched session cannot save a previous user’s preview', async () => {
  let writes = 0;
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'other' } }, error: null }) }, rpc() { writes++; } };
  await assert.rejects(() => saveGarmin(client, {}, 'owner'), /session changed/);
  assert.equal(writes, 0);
});
test('training totals only cover requested dates and report missing calories', () => {
  const result = trainingSummary([
    { day: '2026-10-01', duration_seconds: 9000, calories: 2000 },
    { day: '2026-10-11', duration_seconds: 2500, calories: 400 },
    { day: '2026-10-12', duration_seconds: 1000, calories: null },
  ], '2026-10-06', '2026-10-12');
  assert.equal(result.sessions, 2);
  assert.equal(result.seconds, 3500);
  assert.equal(result.calories, 400);
  assert.equal(result.missingCalories, 1);
  assert.equal(trainingSummary([], '2026-10-01', '2026-10-12').calories, null);
});
