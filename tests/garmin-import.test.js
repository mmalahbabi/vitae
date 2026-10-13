import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { calendarDay, dayInZone, parseGarminDocuments, parseGarminFiles, IMPORT_LIMITS } from '../src/lib/garminImport.js';
import { daily, sleep, workout, documents } from './garmin-fixtures.js';
const parse = docs => parseGarminDocuments(docs, 'Asia/Dubai');

test('normalizes real export layouts, explicit units and privacy allowlist', () => {
  const p = parse(documents);
  assert.equal(p.days[0].steps, 8765);
  assert.equal(p.days[0].total_kcal, 2570);
  assert.equal(p.days[0].sleep_seconds, 27000); // excludes awake time
  assert.equal(p.workouts[0].duration_seconds, 2520);
  assert.equal(p.workouts[0].distance_m, 7100);
  assert.equal(p.workouts[0].calories, 540);
  assert.equal(p.workouts[0].avg_hr, 152);
  assert.equal(p.summary.heart, 1);
  for (const excluded of ['privateAccountField', 'userProfileId', 'Latitude', 'Longitude', 'home address']) assert.ok(!JSON.stringify(p).includes(excluded));
});

test('ZIP and extracted JSON imports produce the same records; ignores unrelated private files', async () => {
  const entries = Object.fromEntries(documents.map(d => [d.name, strToU8(JSON.stringify(d.data))]));
  entries['profile.json'] = strToU8('{"email":"private@example.test"}');
  const zip = new File([zipSync(entries)], 'Garmin.zip');
  const p = await parseGarminFiles([zip], 'Asia/Dubai');
  assert.deepEqual(p.days, parse(documents).days);
  assert.equal(p.summary.ignoredFiles, 1);
  const files = documents.map(d => new File([JSON.stringify(d.data)], d.name.split('/').pop()));
  assert.deepEqual((await parseGarminFiles(files, 'Asia/Dubai')).workouts, p.workouts);
});

test('preserves zero readings and does not invent absent readings', () => {
  const p = parse([{ name: 'UDSFile.json', data: [{ calendarDate: '2026-10-11', totalSteps: 0, restingHeartRate: -1 }] }]);
  assert.equal(p.days[0].steps, 0);
  assert.equal(p.days[0].resting_hr, undefined);
  assert.equal(p.days[0].total_kcal, undefined);
  assert.equal(p.days[0].sleep_seconds, undefined);
});

test('a sleep-only export works, without generating activity or heart readings', () => {
  const p = parse([documents[1]]);
  assert.equal(p.days[0].sleep_seconds, 27000);
  assert.equal(p.days[0].steps, undefined);
  assert.equal(p.summary.heart, 0);
  assert.equal(p.workouts.length, 0);
});

test('older sleep schema without REM and explicit total duration', () => {
  const p = parse([{ name: 'sleepData.json', data: [{ ...sleep, remSleepSeconds: null }] }]);
  assert.equal(p.days[0].sleep_seconds, 19800);
  const explicit = parse([{ name: 'sleepData.json', data: [{ ...sleep, sleepTimeSeconds: 25000 }] }]);
  assert.equal(explicit.days[0].sleep_seconds, 25000);
});

test('deduplicates workouts and merges overlapping daily and sleep records', () => {
  const p = parse([...documents, ...documents]);
  assert.equal(p.days.length, 1);
  assert.equal(p.workouts.length, 1);
  assert.equal(p.days[0].steps, 8765);
  assert.equal(p.days[0].sleep_seconds, 27000);
  assert.equal(p.summary.duplicates, 3);
});

test('preserves local workout dates across midnight; explicit fallback zone only for GMT-only records', () => {
  const row = { ...workout, startTimeGmt: '2026-10-10T22:30:00', startTimeLocal: '2026-10-11T02:30:00' };
  const doc = r => [{ name: 'summarizedActivities.json', data: [{ summarizedActivitiesExport: [r] }] }];
  assert.equal(parse(doc(row)).workouts[0].day, '2026-10-11');
  assert.equal(parseGarminDocuments(doc(row), 'America/New_York').workouts[0].day, '2026-10-11');
  assert.equal(parse(doc({ ...row, startTimeLocal: null })).workouts[0].day, '2026-10-11');
  assert.equal(parseGarminDocuments(doc({ ...row, startTimeLocal: null }), 'America/New_York').workouts[0].day, '2026-10-10');
  assert.equal(dayInZone(new Date('2026-10-10T22:30:00Z')), '2026-10-11');
  assert.equal(parse(doc({ ...row, startTimeLocal: '2026-10-11T02:30:00+04:00' })).workouts[0].started_local, '2026-10-11T02:30:00');
  assert.throws(() => parse(doc({ ...row, startTimeGmt: '2026-10-10T24:30:00' })), /No supported/);
});

test('rejects invalid dates, malformed measurements, unsupported schemas and invalid time zones', () => {
  assert.throws(() => calendarDay('2026-02-30'));
  assert.throws(() => parseGarminDocuments(documents, 'not-a-zone'));
  assert.throws(() => parse([{ name: 'activities.json', data: [workout] }]), /No supported/);
  const p = parse([{ name: 'UDSFile.json', data: [daily, { ...daily, calendarDate: '2026-02-30' }, { ...daily, totalSteps: true }, { ...daily, totalSteps: -1 }] }]);
  assert.equal(p.summary.rejected, 3);
  assert.equal(p.days.length, 1);
});

test('corrupt JSON/ZIP and oversized input fail without a partial preview', async () => {
  await assert.rejects(() => parseGarminFiles([new File(['['], 'UDSFile.json')]), /damaged/);
  await assert.rejects(() => parseGarminFiles([new File(['bad zip'], 'export.zip')]), /ZIP/);
  await assert.rejects(() => parseGarminFiles([{ name: 'x.zip', size: IMPORT_LIMITS.fileBytes + 1 }]), /100 MB/);
  await assert.rejects(() => parseGarminFiles([{ name: 'UDSFile.json', size: IMPORT_LIMITS.jsonBytes + 1 }]), /20 MB/);
});

test('bounds record count before normalization can consume unlimited memory', () => {
  assert.throws(() => parse([{ name: 'UDSFile.json', data: Array(IMPORT_LIMITS.records + 1).fill(daily) }]), /Too many/);
});
