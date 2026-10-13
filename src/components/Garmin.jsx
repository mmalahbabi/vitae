import { useCallback, useEffect, useRef, useState } from 'react';
import { Watch, Upload, RefreshCw, Activity } from 'lucide-react';
import { EMPTY_GARMIN, garminError, loadGarmin, saveGarmin, trainingSummary } from '../lib/garminData.js';
import { healthDay, daysBefore } from '../lib/garminDates.js';
import { GarminContext, useGarmin } from '../lib/garminContext.js';
import './garmin.css';

const fmt = (value, suffix = '') => value == null ? '—' : `${Number(value).toLocaleString()}${suffix}`;
const countLabel = (count, label) => `${count} ${label}${count === 1 ? '' : 's'}`;
const duration = seconds => seconds == null ? '—' : `${Math.floor(Math.round(seconds / 60) / 60)}h ${Math.round(seconds / 60) % 60}m`;

export function GarminProvider({ client, userId, children }) {
  const [data, setData] = useState(EMPTY_GARMIN);
  const [loading, setLoading] = useState(Boolean(client && userId));
  const [error, setError] = useState('');
  const [today, setToday] = useState(healthDay);
  const mounted = useRef(true);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    if (!client || !userId) return;
    const request = ++sequence.current;
    setLoading(true); setError('');
    try {
      const result = await loadGarmin(client, userId);
      if (mounted.current && request === sequence.current) setData(result);
    } catch (e) {
      if (mounted.current && request === sequence.current) { setData(EMPTY_GARMIN); setError(garminError(e)); }
    } finally { if (mounted.current && request === sequence.current) setLoading(false); }
  }, [client, userId]);
  useEffect(() => {
    mounted.current = true;
    reload();
    const clock = setInterval(() => setToday(healthDay()), 60000);
    // This mutable sequence is a request generation, not a rendered DOM ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { mounted.current = false; sequence.current++; clearInterval(clock); };
  }, [reload]);
  const status = loading ? 'Loading imports…' : error ? 'Storage unavailable' : data.lastImport ? 'Imported · manual updates' : 'No imported data';
  return <GarminContext.Provider value={{ ...data, today, loading, error, status, client, userId, reload }}>{children}</GarminContext.Provider>;
}

export function GarminStatus() {
  const { status } = useGarmin();
  return <span className="garmin-status"><Watch size={15} /> Garmin · {status}</span>;
}

export function GarminImportPanel() {
  const g = useGarmin();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [timeZone, setTimeZone] = useState('Asia/Dubai');
  const worker = useRef(null);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; worker.current?.terminate(); }; }, []);

  function cancelPreview() {
    worker.current?.terminate(); worker.current = null;
    setParsing(false); setPreview(null); setError('');
  }
  function selectFiles(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    cancelPreview(); setMessage(''); setParsing(true);
    try {
      const w = new Worker(new URL('../lib/garminImport.worker.js', import.meta.url), { type: 'module' });
      worker.current = w;
      w.onmessage = ({ data }) => {
        if (!active.current || worker.current !== w) return;
        setParsing(false); w.terminate(); worker.current = null;
        if (data.error) setError(data.error); else setPreview(data.result);
      };
      w.onerror = () => {
        if (!active.current || worker.current !== w) return;
        setError('The export could not be read. Try selecting fewer extracted JSON files.');
        setParsing(false); w.terminate(); worker.current = null;
      };
      w.postMessage({ files, timeZone });
    } catch {
      setParsing(false); setError('File import is unavailable in this browser. Open Vitae in a current browser and try again.');
    }
  }
  async function save() {
    if (!preview || !g.client || !g.userId) return;
    setSaving(true); setError('');
    try {
      const result = await saveGarmin(g.client, preview, g.userId);
      await g.reload();
      if (!active.current) return;
      setPreview(null);
      setMessage(`Saved ${countLabel(result.days, 'daily record')} and ${countLabel(result.workouts, 'workout')}. Repeated records were updated.`);
    } catch (e) { if (active.current) setError(garminError(e)); }
    finally { if (active.current) setSaving(false); }
  }
  async function remove() {
    setSaving(true); setError('');
    try {
      const { data: { user } } = await g.client.auth.getUser();
      if (user?.id !== g.userId) throw new Error('Your session changed. Sign in again.');
      const { error: deleteError } = await g.client.rpc('delete_garmin_data', { expected_user_id: g.userId });
      if (deleteError) throw deleteError;
      await g.reload();
      if (!active.current) return;
      setConfirmDelete(false); setPreview(null); setMessage('Your imported Garmin records have been removed.');
    } catch (e) { if (active.current) setError(garminError(e)); }
    finally { if (active.current) setSaving(false); }
  }
  const latest = [...g.days.map(r => r.day), ...g.workouts.map(r => r.day)].sort().at(-1);
  return <section className="garmin-card" aria-label="Garmin import">
    <div className="garmin-heading"><div><h2>Garmin data</h2><p>{g.status}. Automatic sync is not connected.</p></div>
      {g.client && g.userId && <button type="button" onClick={g.reload} disabled={g.loading || saving} aria-label="Refresh Garmin data"><RefreshCw size={14} /> Refresh</button>}
    </div>
    {g.lastImport && <p>Latest record: <strong>{latest}</strong> · Last imported {new Date(g.lastImport).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })} UAE time. View dated readings in Training.</p>}
    {(g.error || error) && <p role="alert" className="garmin-error">{error || g.error}</p>}
    {message && <p role="status">{message}</p>}
    <details><summary>How to export from Garmin</summary>
      <ol>
        <li>Open <a href="https://www.garmin.com/account/datamanagement/" target="_blank" rel="noreferrer">Garmin Account Data Management</a> and request a data export.</li>
        <li>Download the ZIP when Garmin makes it available. Select it below, or extract it and select UDSFile*.json, *sleepData.json and *summarizedActivities.json files together.</li>
        <li>Review the dates and counts, then save the measurements to your Vitae account.</li>
      </ol>
      <p>Supports daily steps/calories, heart-rate summaries, sleep and completed workouts. Other files, including GPS routes, are ignored. FIT, TCX, CSV and continuous heart-rate samples are not supported in this version.</p>
      <p>Exports are read on this device. Only the listed measurements are sent to your private Vitae account when you choose Save. The original files, route coordinates and Garmin login details are not uploaded.</p>
      <p>100 MB maximum selection; 20 MB per JSON; 64 MB of selected JSON in a ZIP. For larger archives, extract and select fewer JSON files.</p>
    </details>
    <div className="garmin-actions">
      <label>Fallback workout time zone <input aria-label="Fallback workout time zone" value={timeZone} disabled={parsing || saving}
        onChange={e => { setTimeZone(e.target.value); setPreview(null); }} placeholder="Asia/Dubai" /></label>
      <label className="garmin-file"><Upload size={15} /> Choose Garmin export
        <input aria-label="Choose Garmin export" type="file" multiple accept=".zip,.json,application/zip,application/json" disabled={parsing || saving} onChange={selectFiles} />
      </label>
    </div>
    <p className="garmin-small">Garmin calendar dates and local workout times are preserved. The fallback zone is used only when a workout contains a UTC time without a local time.</p>
    {parsing && <p role="status">Reading export on this device… <button type="button" onClick={cancelPreview}>Cancel</button></p>}
    {preview && <div className="garmin-preview">
      <h3>Review import · {preview.summary.from} to {preview.summary.to}</h3>
      <p>{countLabel(preview.summary.days, 'daily record')} · {countLabel(preview.summary.sleep, 'sleep record')} · {countLabel(preview.summary.heart, 'day with heart-rate data')} · {countLabel(preview.summary.workouts, 'workout')}</p>
      <p>{preview.summary.rejected} invalid records skipped · {preview.summary.ignoredFiles} unsupported or empty files ignored · {preview.summary.duplicates} overlapping records merged</p>
      <details><summary>Preview measurements (first 3 of each type)</summary>
        {preview.days.slice(0, 3).map(r => <p key={r.day}>{r.day}: {fmt(r.steps)} steps · {duration(r.sleep_seconds)} sleep · resting HR {fmt(r.resting_hr)} bpm · {fmt(r.total_kcal)} daily kcal</p>)}
        {preview.workouts.slice(0, 3).map(r => <p key={r.activity_id}>{r.day}: {r.sport} · {duration(r.duration_seconds)} · {r.distance_m == null ? '— km' : `${(r.distance_m / 1000).toFixed(2)} km`} · {fmt(r.calories)} kcal</p>)}
      </details>
      <p>Saving updates matching dates and workout IDs. Missing fields keep existing values; supplied values replace them, so use your newest export.</p>
      <div className="garmin-actions"><button type="button" className="garmin-primary" onClick={save} disabled={saving || !g.userId || !g.client}>{saving ? 'Saving…' : 'Save to my Vitae account'}</button>
        <button type="button" onClick={cancelPreview} disabled={saving}>Discard preview</button></div>
      {(!g.client || !g.userId) && <p>Preview only. Sign in to a configured Vitae account to save these records.</p>}
    </div>}
    {g.lastImport && <div className="garmin-delete">
      {confirmDelete ? <><p>Remove all your imported Garmin records? Your meals, hydration, protocols and bloodwork will stay in Vitae.</p>
        <button type="button" onClick={remove} disabled={saving}>Confirm removal</button> <button type="button" onClick={() => setConfirmDelete(false)} disabled={saving}>Cancel</button></>
        : <button type="button" onClick={() => setConfirmDelete(true)} disabled={saving || parsing}>Remove imported Garmin data</button>}
    </div>}
  </section>;
}

export function GarminTraining() {
  const g = useGarmin();
  const dates = [...new Set([...g.days.map(r => r.day), ...g.workouts.map(r => r.day)])].sort().reverse();
  const [selected, setSelected] = useState('');
  const day = dates.includes(selected) ? selected : dates[0] ?? g.today;
  const daily = g.days.find(r => r.day === day);
  const week = trainingSummary(g.workouts, daysBefore(day, 6), day);
  const [visible, setVisible] = useState(20);
  const workouts = [...g.workouts].sort((a, b) => b.day.localeCompare(a.day) || String(b.started_local ?? b.started_at).localeCompare(String(a.started_local ?? a.started_at)));
  return <div className="garmin-stack">
    <GarminImportPanel />
    <section className="garmin-card" aria-label="Imported Garmin readings">
      <div className="garmin-heading"><h2>Daily readings</h2>
        <label>Record date <select value={day} onChange={e => setSelected(e.target.value)} disabled={!dates.length} aria-label="Garmin record date">
          {(dates.length ? dates : [g.today]).map(date => <option key={date}>{date}</option>)}
        </select></label></div>
      {!dates.length && <p>Import an export to see your recorded activity, sleep and heart rate here.</p>}
      <div className="garmin-metrics">
        <div><strong>{fmt(daily?.steps)}</strong><span>steps</span></div>
        <div><strong>{duration(daily?.sleep_seconds)}</strong><span>sleep</span></div>
        <div><strong>{fmt(daily?.resting_hr)}</strong><span>resting bpm</span></div>
        <div><strong>{fmt(daily?.min_hr)} / {fmt(daily?.max_hr)}</strong><span>min / max bpm</span></div>
        <div><strong>{fmt(daily?.total_kcal)}</strong><span>daily kcal out</span></div>
        <div><strong>{fmt(daily?.active_kcal)}</strong><span>active kcal</span></div>
      </div>
      <p>— means not present in the export. Sleep is assigned to Garmin’s calendar date. These are recorded summaries, not live readings.</p>
      {daily?.sleep_seconds != null && <p>Sleep stages: deep {duration(daily.deep_seconds)} · light {duration(daily.light_seconds)} · REM {duration(daily.rem_seconds)} · awake {duration(daily.awake_seconds)}</p>}
    </section>
    <section className="garmin-card"><h2>Training · {daysBefore(day, 6)} to {day}</h2>
      <div className="garmin-metrics">
        <div><strong>{week.sessions}</strong><span>imported sessions</span></div>
        <div><strong>{duration(week.seconds)}</strong><span>recorded duration</span></div>
        <div><strong>{fmt(week.calories)}</strong><span>workout kcal{week.missingCalories ? ' (partial)' : ''}</span></div>
      </div><p>Totals cover imported workouts only. Workout calories are not added to daily calories, which already include activity. Heart-rate zones require additional data and are not estimated.</p>
    </section>
    <section className="garmin-card"><h2>Imported workouts</h2>
      {!workouts.length && <p>No workouts imported.</p>}
      {workouts.slice(0, visible).map(w => <div className="garmin-workout" key={w.activity_id}>
        <Activity size={20} /><div><strong>{w.sport.replaceAll('_', ' ')}</strong><p>{w.started_local?.replace('T', ' ') ?? `${w.day} · local time unavailable`}</p></div>
        <div>{duration(w.duration_seconds)} · {w.distance_m == null ? '— km' : `${(Number(w.distance_m) / 1000).toFixed(2)} km`}<p>{fmt(w.calories)} kcal · avg HR {fmt(w.avg_hr)} bpm · max {fmt(w.max_hr)} bpm</p></div>
      </div>)}
      {visible < workouts.length && <button type="button" onClick={() => setVisible(v => v + 20)}>Show more workouts ({workouts.length - visible} remaining)</button>}
    </section>
  </div>;
}
