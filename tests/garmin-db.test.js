import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { parseGarminDocuments } from '../src/lib/garminImport.js';
import { documents } from './garmin-fixtures.js';

test('Postgres migration: atomic import, idempotency, ownership, deletion and existing data isolation', async t => {
  const db = new PGlite();
  const alice = '11111111-1111-4111-8111-111111111111', bob = '22222222-2222-4222-8222-222222222222';
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      insert into auth.users values ('${alice}'), ('${bob}');`);
    for (const file of (await readdir(new URL('../supabase/migrations/', import.meta.url))).sort()) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
    }
    await db.exec(`insert into public.daily_metrics(user_id,day,water_l) values ('${alice}','2026-10-11',1.75);`);
    async function asUser(id, role = 'authenticated') {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
      await db.exec(`set role ${role}`);
    }
    const p = parseGarminDocuments(documents);
    let currentUser = alice;
    const save = (days = p.days, workouts = p.workouts, zone = 'Asia/Dubai', expected = currentUser) => db.query(
      'select public.import_garmin_export($1::jsonb, $2::jsonb, $3, $4::uuid)', [JSON.stringify(days), JSON.stringify(workouts), zone, expected]);

    await t.test('anonymous access and function execution denied', async () => {
      await asUser('', 'anon');
      await assert.rejects(() => db.query('select * from public.garmin_daily'), /permission denied/);
      await assert.rejects(() => save(), /permission denied/);
      await asUser('');
      await assert.rejects(() => save(), /Sign in/);
    });
    await t.test('owner import and repeated export update exactly one record', async () => {
      await asUser(alice); currentUser = alice;
      assert.deepEqual((await save()).rows[0].import_garmin_export, { days: 1, workouts: 1 });
      await save();
      assert.equal((await db.query('select * from public.garmin_daily')).rows.length, 1);
      assert.equal((await db.query('select * from public.garmin_workouts')).rows.length, 1);
    });
    await t.test('partial imports preserve existing measurements, including numeric zero', async () => {
      await save([{ day: p.days[0].day, steps: 0 }], []);
      const row = (await db.query('select * from public.garmin_daily')).rows[0];
      assert.equal(row.steps, 0);
      assert.equal(row.sleep_seconds, 27000);
      assert.equal(Number(row.total_kcal), 2570);
    });
    await t.test('a failing workout rolls the whole import back', async () => {
      await assert.rejects(() => save([{ day: p.days[0].day, steps: 123 }], [{ ...p.workouts[0], duration_seconds: -1 }]), /check constraint/);
      assert.equal((await db.query('select steps from public.garmin_daily')).rows[0].steps, 0);
    });
    await t.test('server rejects malformed or unbounded data independently of the parser', async () => {
      await assert.rejects(() => save([], []), /size/);
      await assert.rejects(() => save(p.days, [], 'invalid-zone'), /time zone/);
      await assert.rejects(() => save([{ day: p.days[0].day }], []), /check constraint/);
      await assert.rejects(() => save({}, []), /record arrays/);
      await assert.rejects(() => save([{ day: p.days[0].day, steps: 300001 }], []), /check constraint/);
    });
    await t.test('owner cannot reassign records or insert as another user', async () => {
      await assert.rejects(() => db.query('update public.garmin_daily set user_id=$1', [bob]), /row-level security/);
      await assert.rejects(() => db.query("insert into public.garmin_workouts(user_id,activity_id,day,started_at,import_timezone,sport,duration_seconds) values ($1,'99','2026-10-11',now(),'UTC','walking',100)", [bob]), /row-level security/);
    });
    await t.test('other account cannot read, update or delete the owner’s rows', async () => {
      await asUser(bob); currentUser = bob;
      assert.equal((await db.query('select * from public.garmin_daily')).rows.length, 0);
      assert.equal((await db.query('select * from public.garmin_workouts')).rows.length, 0);
      assert.equal((await db.query('update public.garmin_daily set steps=999 returning *')).rows.length, 0);
      await db.query('select public.delete_garmin_data($1::uuid)', [currentUser]);
      // A forged payload owner is ignored; the RPC assigns the session user.
      await save([{ ...p.days[0], user_id: alice }], p.workouts);
      assert.equal((await db.query('select user_id from public.garmin_daily')).rows[0].user_id, bob);
    });
    await t.test('a session switch between validation and writing is rejected by the server', async () => {
      await assert.rejects(() => save(p.days, p.workouts, 'Asia/Dubai', alice), /account must match/);
      await assert.rejects(() => db.query('select public.delete_garmin_data($1::uuid)', [alice]), /account must match/);
    });
    await t.test('deletion affects only the current owner and leaves hydration untouched', async () => {
      await asUser(alice); currentUser = alice;
      assert.equal((await db.query('select count(*)::int as n from public.garmin_daily')).rows[0].n, 1);
      await db.query('select public.delete_garmin_data($1::uuid)', [currentUser]);
      assert.equal((await db.query('select * from public.garmin_daily')).rows.length, 0);
      assert.equal((await db.query('select * from public.garmin_workouts')).rows.length, 0);
      await db.exec('reset role');
      assert.equal(Number((await db.query('select water_l from public.daily_metrics')).rows[0].water_l), 1.75);
      assert.equal((await db.query('select user_id from public.garmin_daily')).rows[0].user_id, bob);
    });
    await t.test('all new tables have RLS and routines run as the caller', async () => {
      const tables = await db.query("select relrowsecurity from pg_class where relname in ('garmin_daily','garmin_workouts')");
      assert.ok(tables.rows.every(r => r.relrowsecurity));
      const functions = await db.query("select prosecdef from pg_proc where proname in ('import_garmin_export','delete_garmin_data')");
      assert.ok(functions.rows.every(r => !r.prosecdef));
    });
  } finally { await db.close(); }
});
