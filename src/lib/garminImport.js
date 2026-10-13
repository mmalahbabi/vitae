import { unzipSync, strFromU8 } from 'fflate';
import { dayInZone } from './garminDates.js';
export { dayInZone } from './garminDates.js';

// Garmin Account Management export adapters. Units are format-specific; never
// infer them from value magnitude or treat an unknown schema as an empty day.
export const IMPORT_LIMITS = { fileBytes: 100 * 1024 ** 2, jsonBytes: 20 * 1024 ** 2,
  expandedBytes: 64 * 1024 ** 2, files: 2000, records: 15000 };
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const present = v => v !== undefined && v !== null && v !== '';

export function calendarDay(value) {
  if (typeof value !== 'string' || !DAY.test(value)) throw new Error('Invalid calendar date');
  const d = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value || value < '2000-01-01' || value > '2100-12-31') {
    throw new Error('Invalid calendar date');
  }
  return value;
}

function number(value, max, { divisor = 1, integer = false, heart = false } = {}) {
  if (!present(value) || (heart && (Number(value) === -1 || Number(value) === 0))) return null;
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value))) throw new Error('Invalid measurement');
  const n = Number(value) / divisor;
  if (!Number.isFinite(n) || n < (heart ? 20 : 0) || n > max || (integer && !Number.isInteger(n))) throw new Error('Measurement out of range');
  return Math.round(n * 1000) / 1000;
}

function timestamp(value) {
  if (!present(value)) return null;
  // These export timestamps are epoch milliseconds or ISO strings, not seconds.
  if (typeof value === 'number') {
    if (value < 946684800000 || value > 4133980800000) throw new Error('Invalid timestamp');
    return new Date(value).toISOString();
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.test(value)) throw new Error('Invalid timestamp');
  calendarDay(value.slice(0, 10));
  if (+value.slice(11, 13) > 23 || +value.slice(14, 16) > 59 || +value.slice(17, 19) > 59) throw new Error('Invalid clock time');
  const text = value.replace(' ', 'T');
  const date = new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(text) ? text : `${text}Z`);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid timestamp');
  return date.toISOString();
}

function daily(row) {
  const result = { day: calendarDay(row.calendarDate),
    steps: number(row.totalSteps, 300000, { integer: true }),
    total_kcal: number(row.totalKilocalories ?? row.totalCalories, 30000),
    active_kcal: number(row.activeKilocalories ?? row.activeCalories, 30000),
    resting_hr: number(row.restingHeartRate, 250, { heart: true }),
    min_hr: number(row.minHeartRate, 250, { heart: true }),
    max_hr: number(row.maxHeartRate, 250, { heart: true }) };
  if (!Object.entries(result).some(([k, v]) => k !== 'day' && v !== null)) throw new Error('No daily measurements');
  return result;
}

function sleep(row) {
  const result = { day: calendarDay(row.calendarDate),
    sleep_seconds: number(row.sleepTimeSeconds, 86400, { integer: true }),
    deep_seconds: number(row.deepSleepSeconds, 86400, { integer: true }),
    light_seconds: number(row.lightSleepSeconds, 86400, { integer: true }),
    rem_seconds: number(row.remSleepSeconds, 86400, { integer: true }),
    awake_seconds: number(row.awakeSleepSeconds, 86400, { integer: true }) };
  if (result.sleep_seconds === null && result.deep_seconds !== null && result.light_seconds !== null) {
    // Older Garmin devices don't report REM. Awake/unmeasurable time is excluded.
    result.sleep_seconds = result.deep_seconds + result.light_seconds + (result.rem_seconds ?? 0);
  }
  if (result.sleep_seconds === null || result.sleep_seconds > 86400) throw new Error('No valid sleep duration');
  return result;
}

function workout(row, timeZone) {
  const id = row.activityId;
  if ((!['string', 'number'].includes(typeof id)) || !/^\d{1,30}$/.test(String(id)) || (typeof id === 'number' && !Number.isSafeInteger(id))) throw new Error('Missing activity ID');
  const started = timestamp(row.startTimeGmt ?? row.startTimeGMT ?? row.beginTimestamp);
  // Preserve the wall-clock part even if a local string includes an offset.
  const validatedLocal = timestamp(row.startTimeLocal);
  const local = typeof row.startTimeLocal === 'string' && validatedLocal
    ? row.startTimeLocal.replace(' ', 'T').slice(0, 19)
    : validatedLocal?.slice(0, 19);
  if (!started && !local) throw new Error('Missing activity timestamp');
  const sport = typeof row.activityType === 'string' ? row.activityType : row.activityType?.typeKey ?? row.sportType;
  const result = { activity_id: String(id), day: local ? calendarDay(local.slice(0, 10)) : dayInZone(new Date(started), timeZone),
    started_at: started, started_local: local ? local.slice(0, 19) : null,
    sport: typeof sport === 'string' && sport.trim() ? sport.trim().slice(0, 80) : 'Activity',
    duration_seconds: number(row.duration ?? row.elapsedDuration ?? row.movingDuration, 604800, { divisor: 1000 }),
    distance_m: number(row.distance, 5000000, { divisor: 100 }),
    calories: number(row.calories, 30000),
    avg_hr: number(row.avgHr ?? row.averageHR, 250, { heart: true }),
    max_hr: number(row.maxHr ?? row.maxHR, 250, { heart: true }) };
  if (result.duration_seconds === null) throw new Error('Missing activity duration');
  return result;
}

export function formatOf(name) {
  const base = name.split(/[\\/]/).pop();
  if (/^UDSFile.*\.json$/i.test(base)) return 'daily';
  if (/sleepData\.json$/i.test(base)) return 'sleep';
  if (/summarizedActivities\.json$/i.test(base)) return 'workout';
  return null;
}

export function parseGarminDocuments(documents, timeZone = 'Asia/Dubai') {
  dayInZone(new Date(), timeZone); // Validate IANA zone before handling any records.
  const days = new Map(), workouts = new Map();
  let rejected = 0, ignoredFiles = 0, duplicates = 0, count = 0;
  for (const { name, data } of documents) {
    const kind = formatOf(name);
    if (!kind) { ignoredFiles++; continue; }
    let rows = Array.isArray(data) ? data : object(data) ? [data] : [];
    if (kind === 'workout') rows = rows.flatMap(r => Array.isArray(r?.summarizedActivitiesExport) ? r.summarizedActivitiesExport : []);
    if (!rows.length) { ignoredFiles++; continue; }
    for (const row of rows) {
      if (++count > IMPORT_LIMITS.records) throw new Error('Too many records. Select a smaller set of export JSON files (15,000 records per import).');
      try {
        if (!object(row)) throw new Error('Invalid record');
        if (kind === 'workout') {
          const item = workout(row, timeZone);
          if (workouts.has(item.activity_id)) duplicates++;
          workouts.set(item.activity_id, item);
        } else {
          const item = kind === 'daily' ? daily(row) : sleep(row);
          const previous = days.get(item.day) ?? {};
          if (Object.keys(item).some(k => k !== 'day' && item[k] !== null && previous[k] != null)) duplicates++;
          // A sleep-only file must not erase an existing daily activity record.
          days.set(item.day, { ...previous, ...Object.fromEntries(Object.entries(item).filter(([, v]) => v !== null)) });
        }
      } catch { rejected++; }
    }
  }
  const dailyRows = [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
  const workoutRows = [...workouts.values()].sort((a, b) => a.day.localeCompare(b.day));
  const dates = [...days.keys(), ...workoutRows.map(r => r.day)].sort();
  if (!dates.length) throw new Error('No supported records found. Choose Garmin UDSFile, sleepData or summarizedActivities JSON files, or the ZIP containing them. FIT, TCX, CSV and other JSON layouts are not supported yet.');
  return { days: dailyRows, workouts: workoutRows, timeZone,
    summary: { from: dates[0], to: dates.at(-1), days: dailyRows.length, workouts: workoutRows.length,
      sleep: dailyRows.filter(r => r.sleep_seconds != null).length,
      heart: dailyRows.filter(r => ['resting_hr', 'min_hr', 'max_hr'].some(k => r[k] != null)).length,
      rejected, ignoredFiles, duplicates } };
}

export async function parseGarminFiles(files, timeZone) {
  if (!files.length || files.length > IMPORT_LIMITS.files) throw new Error('Choose 1–2,000 export files.');
  const documents = [];
  let expanded = 0, input = 0, ignored = 0;
  const add = (name, bytes) => {
    expanded += bytes.length;
    if (bytes.length > IMPORT_LIMITS.jsonBytes || expanded > IMPORT_LIMITS.expandedBytes || documents.length >= IMPORT_LIMITS.files) throw new Error('Export is too large. Extract the ZIP and select fewer JSON files (20 MB per JSON, 64 MB total).');
    let data;
    try { data = JSON.parse(strFromU8(bytes).replace(/^\uFEFF/, '')); }
    catch { throw new Error('A selected Garmin JSON file is damaged. No data has been saved.'); }
    documents.push({ name, data });
  };
  for (const file of files) {
    input += file.size;
    if (input > IMPORT_LIMITS.fileBytes) throw new Error('Selection exceeds 100 MB. Extract the ZIP and select the supported JSON files.');
    if (/\.zip$/i.test(file.name)) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let declared = 0, entries = 0;
      let extracted;
      try {
        extracted = unzipSync(bytes, { filter: entry => {
          if (!formatOf(entry.name)) { ignored++; return false; }
          declared += entry.originalSize; entries++;
          if (entry.originalSize > IMPORT_LIMITS.jsonBytes || declared + expanded > IMPORT_LIMITS.expandedBytes || entries + documents.length > IMPORT_LIMITS.files) throw new Error('size');
          return true;
        } });
      } catch { throw new Error('ZIP could not be read safely. Extract it on your device and choose the supported JSON files instead.'); }
      for (const [name, content] of Object.entries(extracted)) add(name, content);
    } else if (formatOf(file.name)) {
      if (file.size > IMPORT_LIMITS.jsonBytes) throw new Error('JSON exceeds the 20 MB file limit.');
      add(file.name, new Uint8Array(await file.arrayBuffer()));
    } else { ignored++; }
  }
  const result = parseGarminDocuments(documents, timeZone);
  result.summary.ignoredFiles += ignored;
  return result;
}
