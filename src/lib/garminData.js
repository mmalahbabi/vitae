export const EMPTY_GARMIN = { days: [], workouts: [], lastImport: null };

// Pagination matters: an account export can exceed PostgREST's default row cap.
async function allRows(client, table, userId, order) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from(table).select('*').eq('user_id', userId)
      .order(order).range(offset, offset + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

export async function loadGarmin(client, userId) {
  const [days, workouts] = await Promise.all([
    allRows(client, 'garmin_daily', userId, 'day'),
    allRows(client, 'garmin_workouts', userId, 'activity_id'),
  ]);
  const lastImport = [...days, ...workouts].reduce((last, row) => !last || row.imported_at > last ? row.imported_at : last, null);
  return { days, workouts, lastImport };
}

export async function saveGarmin(client, preview, userId) {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user || user.id !== userId) throw new Error('Your session changed. Sign in again before importing.');
  const { data, error: saveError } = await client.rpc('import_garmin_export', {
    daily_rows: preview.days, workout_rows: preview.workouts, import_timezone: preview.timeZone, expected_user_id: userId,
  });
  if (saveError) throw saveError;
  return data;
}

export function garminError(error) {
  if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(error?.code)) return 'Garmin storage is not ready. Ask the app administrator to apply the Garmin database migration.';
  if (error?.message?.startsWith('Your session changed')) return error.message;
  return 'Garmin data could not be read or saved. Check your connection and that Vitae’s database is active, then retry.';
}

export function trainingSummary(workouts, from, to) {
  const rows = workouts.filter(r => r.day >= from && r.day <= to);
  return { rows, sessions: rows.length, seconds: rows.reduce((sum, r) => sum + Number(r.duration_seconds), 0),
    calories: rows.some(r => r.calories != null) ? rows.reduce((sum, r) => sum + Number(r.calories ?? 0), 0) : null,
    missingCalories: rows.filter(r => r.calories == null).length };
}
