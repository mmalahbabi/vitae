import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Activity, Flame, Heart, Camera, Plus,
  Watch, Moon, Footprints, ChevronRight, Check, AlertCircle, Utensils,
  Syringe, Clock, Pill, Sun, Pencil, Archive, Circle, RotateCcw, Trash2, MoreHorizontal,
  TrendingUp, TrendingDown, Upload, Link2,
} from "lucide-react";
import { supabase } from "./lib/supabaseClient";

// ============================================================
// Vitae — personal health platform prototype
// Single-file React. All data simulated. Component-structured
// so each "pillar" can port to a React Native screen later.
// ============================================================

const C = {
  ink: "#0F2E2C",        // deep teal-black, primary text
  teal: "#0E6E66",       // trust / health anchor
  tealSoft: "#E6F2F0",
  coral: "#E8674C",      // nutrition / energy layer
  coralSoft: "#FCEBE6",
  amber: "#D89A2B",      // caution / attention
  coralText: "#C14B2E",  // coral darkened to pass WCAG AA at small sizes
  amberText: "#8A6116",  // amber darkened to pass WCAG AA at small sizes
  line: "#E7ECEB",       // hairlines
  mute: "#5F7370",       // secondary text
  bg: "#FFFFFF",
  panel: "#FBFCFC",
};

const FONT_DISPLAY = "'Geist', system-ui, sans-serif";
const FONT_BODY = "'Geist', system-ui, sans-serif";
const FONT_MONO = "'Geist Mono', ui-monospace, monospace";

// ---------- targets & estimates (until Garmin lands, "out" is an estimate) ----------
const targets = { caloriesTarget: 2200, caloriesOutEstimate: 2600,
  steps: 8420, stepsTarget: 10000, resting: 54, sleep: 7.2, waterTarget: 2.5 };

function liveDateLabel() {
  return new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function isoDaysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const BLOOD_PANEL_NAMES = ["Lipids", "Metabolic", "Thyroid", "Vitamins & minerals", "Inflammation", "Liver & kidney", "Hormones"];

function markerStatus(m) {
  if (m.value > m.high) return "high";
  if (m.value < m.low) return "low";
  return "ok";
}

function fmtLongDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtShortDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short" }) + " '" + String(d.getFullYear()).slice(-2);
}

// Groups flat blood_markers rows (one row per marker per dated panel) into
// the { panel, markers: [{ key, value, history }] } shape the UI renders.
function groupMarkers(rows) {
  const byKey = new Map();
  for (const r of rows) {
    if (!byKey.has(r.marker_key)) byKey.set(r.marker_key, { panel: r.panel, rows: [] });
    byKey.get(r.marker_key).rows.push(r);
  }
  const panelsMap = new Map();
  for (const [key, g] of byKey) {
    g.rows.sort((a, b) => a.taken_on.localeCompare(b.taken_on));
    const latest = g.rows[g.rows.length - 1];
    const marker = {
      id: latest.id, key, value: Number(latest.value), unit: latest.unit,
      low: Number(latest.range_low), high: latest.range_high == null ? Infinity : Number(latest.range_high),
      note: latest.note || undefined, protocol: latest.protocol_link || undefined,
      history: g.rows.map((r) => ({ date: r.taken_on, value: Number(r.value) })),
    };
    if (!panelsMap.has(g.panel)) panelsMap.set(g.panel, { panel: g.panel, markers: [] });
    panelsMap.get(g.panel).markers.push(marker);
  }
  return [...panelsMap.values()].sort((a, b) => {
    const ia = BLOOD_PANEL_NAMES.indexOf(a.panel), ib = BLOOD_PANEL_NAMES.indexOf(b.panel);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

const meals = [
  { name: "Greek yogurt & berries", kcal: 240, conf: 0.94, time: "08:10", p: 18, c: 28, f: 6 },
  { name: "Grilled chicken salad", kcal: 520, conf: 0.88, time: "13:25", p: 42, c: 24, f: 22 },
  { name: "Apple & almonds", kcal: 210, conf: 0.91, time: "16:40", p: 6, c: 22, f: 13 },
  { name: "Salmon, rice, greens", kcal: 670, conf: 0.83, time: "19:50", p: 38, c: 55, f: 28 },
];

const workouts = [
  { type: "Running", dur: "42 min", dist: "7.1 km", kcal: 540, hr: 152, when: "Today · 06:30", icon: Footprints },
  { type: "Strength", dur: "55 min", dist: "-", kcal: 310, hr: 118, when: "Yesterday", icon: Activity },
  { type: "Cycling", dur: "1h 18m", dist: "31 km", kcal: 720, hr: 138, when: "Thu", icon: Activity },
];

const hrZones = [
  { z: "Z1", min: 12 }, { z: "Z2", min: 18 }, { z: "Z3", min: 8 }, { z: "Z4", min: 3 }, { z: "Z5", min: 1 },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Converts a Supabase protocols row (+ its dose log) into the shape the UI renders.
function shapeProtocol(r, log) {
  return {
    id: r.id, type: r.type, name: r.name, dose: Number(r.dose), unit: r.unit, time: r.time,
    slot: r.slot, days: r.days, purpose: r.purpose && r.purpose !== "—" ? r.purpose : "", durationDays: r.duration_days,
    startDate: r.start_date, endDate: r.end_date, color: r.color, status: r.status, log,
  };
}

// ---------- small ui helpers ----------
function Ring({ value, target, color, size = 92, stroke = 9, children }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / target, 1);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.line} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(.4,0,.2,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        {children}
      </div>
    </div>
  );
}

function Eyebrow({ children }) {
  return <div style={{ font: `600 11px/1 ${FONT_MONO}`, letterSpacing: "0.14em",
    textTransform: "uppercase", color: C.mute }}>{children}</div>;
}

function Card({ children, style }) {
  return <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 18,
    padding: 20, ...style }}>{children}</div>;
}

const authInputStyle = { font: `400 14px ${FONT_BODY}`, padding: "11px 13px",
  border: `1px solid ${C.line}`, borderRadius: 10, background: C.bg, color: C.ink, width: "100%", boxSizing: "border-box" };

function AuthScreen() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(""); setInfo(""); setBusy(true);
    const { data, error } = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    if (mode === "signup" && !data.session) setInfo("Check your email to confirm your account, then sign in.");
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.panel, fontFamily: FONT_BODY, padding: 16 }}>
      <Card style={{ width: 340, maxWidth: "100%" }}>
        <div style={{ font: `700 26px ${FONT_DISPLAY}`, letterSpacing: "-0.01em" }}>Vitae</div>
        <div style={{ font: `400 13px ${FONT_BODY}`, color: C.mute, marginTop: 4, marginBottom: 20 }}>
          {mode === "signin" ? "Sign in to your health data" : "Create your account"}
        </div>
        <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
          <input type="email" required autoComplete="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} style={authInputStyle} />
          <input type="password" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"}
            placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={authInputStyle} />
          {error && <div style={{ color: C.coralText, font: `400 12px ${FONT_BODY}` }}>{error}</div>}
          {info && <div style={{ color: C.teal, font: `400 12px ${FONT_BODY}` }}>{info}</div>}
          <button type="submit" disabled={busy}
            style={{ appearance: "none", border: "none", cursor: busy ? "default" : "pointer", background: C.teal, color: "#fff",
              font: `600 14px ${FONT_BODY}`, padding: "11px", borderRadius: 10, opacity: busy ? 0.7 : 1 }}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setInfo(""); }}
          style={{ appearance: "none", border: "none", background: "none", cursor: "pointer", color: C.teal,
            font: `500 12px ${FONT_BODY}`, marginTop: 14, padding: 0 }}>
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </Card>
    </div>
  );
}

function SupabaseSetupNotice() {
  return (
    <Card style={{ borderColor: C.amber, background: "#FCF3E3" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <AlertCircle size={16} color={C.amber} />
        <Eyebrow>Not connected to Supabase</Eyebrow>
      </div>
      <div style={{ font: `400 13px ${FONT_BODY}`, color: C.ink, marginTop: 8, lineHeight: 1.5 }}>
        Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to a <code>.env.local</code> file
        (see <code>.env.example</code>), run the migration in <code>supabase/migrations/0001_init.sql</code>,
        and restart the dev server to save real data here.
      </div>
    </Card>
  );
}

function Sparkline({ data, color }) {
  const pts = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={38}>
      <LineChart data={pts}><Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} /></LineChart>
    </ResponsiveContainer>
  );
}

// ============================================================
function Vitae() {
  const [tab, setTab] = useState("Overview");
  const [session, setSession] = useState(supabase ? undefined : null); // undefined = checking, null = signed out
  const tabs = ["Overview", "Nutrition", "Training", "Protocols", "Bloodwork"];

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (supabase && session === undefined) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: C.panel, color: C.mute, fontFamily: FONT_BODY }}>Loading…</div>;
  }
  if (supabase && !session) {
    return <AuthScreen />;
  }

  return (
    <div style={{ background: C.panel, minHeight: "100vh", fontFamily: FONT_BODY, color: C.ink,
      paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <style>{`
        @media (max-width: 760px) {
          .ov-split, .bw-split, .nut-split, .tr-split { grid-template-columns: 1fr !important; }
          .pf-row { grid-template-columns: 1fr 1fr !important; }
        }
        button:focus-visible { outline: 2px solid ${C.teal}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
        @keyframes vspin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Shell — narrow column mimics a phone-first layout for future app */}
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 16px" }}>

        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "22px 4px 18px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ font: `700 26px/1 ${FONT_DISPLAY}`, letterSpacing: "-0.01em" }}>Vitae</span>
            <span style={{ font: `400 12px/1 ${FONT_MONO}`, color: C.mute }}>{liveDateLabel()}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, font: `500 12px ${FONT_BODY}`, color: C.mute }}>
              <Watch size={15} /> Garmin · coming soon
            </div>
            {supabase && session && (
              <button onClick={() => supabase.auth.signOut()}
                style={{ appearance: "none", border: `1px solid ${C.line}`, background: C.bg, cursor: "pointer", color: C.mute,
                  font: `500 12px ${FONT_BODY}`, padding: "6px 12px", borderRadius: 8 }}>
                Sign out
              </button>
            )}
          </div>
        </header>

        {/* Tabs */}
        <nav style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.line}`, marginBottom: 22 }}>
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ appearance: "none", border: "none", background: "none", cursor: "pointer",
                padding: "10px 14px", font: `${tab === t ? 600 : 500} 14px ${FONT_BODY}`,
                color: tab === t ? C.ink : C.mute, borderBottom: `2px solid ${tab === t ? C.teal : "transparent"}`,
                marginBottom: -1, transition: "color .2s" }}>
              {t}
            </button>
          ))}
        </nav>

        <main style={{ paddingBottom: 60 }}>
          {tab === "Overview" && <Overview />}
          {tab === "Bloodwork" && <Bloodwork />}
          {tab === "Nutrition" && <Nutrition />}
          {tab === "Training" && <Training />}
          {tab === "Protocols" && <Protocols />}
        </main>
      </div>
    </div>
  );
}

// ---------- OVERVIEW ----------
function Overview() {
  const TODAY_ISO = isoDaysAgo(0);
  const [weekIn, setWeekIn] = useState(null);   // iso date -> kcal logged
  const [water, setWater] = useState(null);     // liters logged today
  const [alert, setAlert] = useState(null);     // most out-of-range marker
  const [checked, setChecked] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [{ data: mealRows }, { data: dm }, { data: markers }] = await Promise.all([
      supabase.from("meals").select("kcal, eaten_on").gte("eaten_on", isoDaysAgo(6)),
      supabase.from("daily_metrics").select("water_l").eq("day", isoDaysAgo(0)).maybeSingle(),
      supabase.from("blood_markers").select("*").order("taken_on"),
    ]);
    const byDay = {};
    for (const r of mealRows || []) byDay[r.eaten_on] = (byDay[r.eaten_on] || 0) + r.kcal;
    setWeekIn(byDay);
    setWater(dm ? Number(dm.water_l) : 0);
    let worst = null;
    for (const p of groupMarkers(markers || [])) {
      for (const m of p.markers) {
        const st = markerStatus(m);
        if (st === "ok") continue;
        const span = ((isFinite(m.high) ? m.high : m.low * 2) - m.low) || 1;
        const dev = st === "high" ? (m.value - m.high) / span : (m.low - m.value) / span;
        if (!worst || dev > worst.dev) worst = { ...m, status: st, dev };
      }
    }
    setAlert(worst);
    setChecked(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function addWater() {
    if (!supabase) return;
    const next = Math.round(((water || 0) + 0.25) * 100) / 100;
    await supabase.from("daily_metrics").upsert({ day: TODAY_ISO, water_l: next }, { onConflict: "user_id,day" });
    setWater(next);
  }

  const caloriesIn = supabase ? (weekIn ? weekIn[TODAY_ISO] || 0 : 0) : 1840;
  const estOut = targets.caloriesOutEstimate;
  const net = caloriesIn - estOut;
  const waterNow = supabase ? (water || 0) : 1.6;
  const week = [...Array(7)].map((_, i) => {
    const iso = isoDaysAgo(6 - i);
    return { d: new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }),
      in: weekIn ? weekIn[iso] || 0 : 0, out: estOut };
  });

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Hero: energy balance — the thesis of the whole product */}
      <Card style={{ background: C.ink, color: "#fff", border: "none", padding: 26 }}>
        <Eyebrow>Today's energy balance</Eyebrow>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginTop: 12 }}>
          <div style={{ font: `700 56px/0.9 ${FONT_DISPLAY}`, color: net < 0 ? "#7FD1C6" : C.coral }}>
            {net > 0 ? "+" : "−"}{Math.abs(net).toLocaleString()}
          </div>
          <div style={{ font: `400 14px ${FONT_BODY}`, color: "#A9C4C0", paddingBottom: 8 }}>
            kcal {net < 0 ? "deficit" : "surplus"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 18, font: `400 13px ${FONT_MONO}`, color: "#A9C4C0" }}>
          <span><Utensils size={13} style={{ verticalAlign: -2 }} /> In {caloriesIn.toLocaleString()}</span>
          <span><Flame size={13} style={{ verticalAlign: -2 }} /> Out {estOut.toLocaleString()} est.</span>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,.12)", borderRadius: 99, marginTop: 18, overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, (caloriesIn / estOut) * 100)}%`, height: "100%",
            background: `linear-gradient(90deg, ${C.coral}, #F0A58E)`, borderRadius: 99 }} />
        </div>
      </Card>

      {/* Ring row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
        <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Ring value={targets.steps} target={targets.stepsTarget} color={C.teal}>
            <div>
              <div style={{ font: `700 18px ${FONT_DISPLAY}` }}>{(targets.steps / 1000).toFixed(1)}k</div>
              <div style={{ font: `400 10px ${FONT_MONO}`, color: C.mute }}>steps</div>
            </div>
          </Ring>
          <Eyebrow>Movement</Eyebrow>
        </Card>
        <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Ring value={caloriesIn} target={targets.caloriesTarget} color={C.coral}>
            <div>
              <div style={{ font: `700 18px ${FONT_DISPLAY}` }}>{caloriesIn}</div>
              <div style={{ font: `400 10px ${FONT_MONO}`, color: C.mute }}>/ {targets.caloriesTarget}</div>
            </div>
          </Ring>
          <Eyebrow>Intake</Eyebrow>
        </Card>
        <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Ring value={waterNow} target={targets.waterTarget} color="#3B9BD0">
            <div>
              <div style={{ font: `700 18px ${FONT_DISPLAY}` }}>{waterNow}L</div>
              <div style={{ font: `400 10px ${FONT_MONO}`, color: C.mute }}>/ {targets.waterTarget}L</div>
            </div>
          </Ring>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Eyebrow>Hydration</Eyebrow>
            {supabase && (
              <button onClick={addWater}
                style={{ appearance: "none", cursor: "pointer", border: `1px solid ${C.line}`, background: C.bg,
                  color: "#3B9BD0", borderRadius: 7, padding: "3px 8px", font: `600 11px ${FONT_BODY}` }}>
                +250ml
              </button>
            )}
          </div>
        </Card>
        <Card style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Heart size={18} color={C.coral} />
            <div><div style={{ font: `700 18px ${FONT_DISPLAY}` }}>{targets.resting}</div>
              <div style={{ font: `400 10px ${FONT_MONO}`, color: C.mute }}>resting bpm</div></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Moon size={18} color={C.teal} />
            <div><div style={{ font: `700 18px ${FONT_DISPLAY}` }}>{targets.sleep}h</div>
              <div style={{ font: `400 10px ${FONT_MONO}`, color: C.mute }}>sleep</div></div>
          </div>
        </Card>
      </div>
      <div style={{ font: `400 11px ${FONT_MONO}`, color: C.mute, padding: "0 4px", marginTop: -6 }}>
        Steps, heart rate, sleep and energy-out are sample values until Garmin connects. Intake and hydration are yours.
      </div>

      {/* Weekly energy + blood flag */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }} className="ov-split">
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <Eyebrow>Energy · 7 days</Eyebrow>
            <span style={{ font: `400 11px ${FONT_MONO}`, color: C.mute }}>in vs est. out</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={week} margin={{ left: -20, right: 4 }}>
              <defs>
                <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.teal} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={C.teal} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke={C.line} vertical={false} />
              <XAxis dataKey="d" tick={{ font: `400 11px ${FONT_MONO}`, fill: C.mute }} axisLine={false} tickLine={false} />
              <YAxis tick={{ font: `400 10px ${FONT_MONO}`, fill: C.mute }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${C.line}`, font: `12px ${FONT_BODY}` }} />
              <Area type="monotone" dataKey="out" stroke={C.teal} strokeWidth={2} fill="url(#gOut)" />
              <Line type="monotone" dataKey="in" stroke={C.coral} strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {alert ? (
          <Card style={{ borderColor: C.coralSoft, background: C.coralSoft }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={16} color={C.coral} />
              <Eyebrow>Needs attention</Eyebrow>
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ font: `700 17px ${FONT_DISPLAY}` }}>{alert.key}</div>
              <div style={{ font: `700 32px/1.1 ${FONT_DISPLAY}`, color: C.coralText, marginTop: 4 }}>{alert.value}
                <span style={{ font: `400 13px ${FONT_MONO}`, color: C.mute }}> {alert.unit}</span></div>
              <div style={{ font: `400 12px ${FONT_BODY}`, color: C.ink, marginTop: 8, lineHeight: 1.5 }}>
                {alert.status === "high"
                  ? `Above the ${alert.high} upper limit across your latest panel.`
                  : `Below the ${alert.low} lower limit across your latest panel.`} See Bloodwork for the trend.
              </div>
            </div>
            {alert.history.length > 1 && <Sparkline data={alert.history.map((h) => h.value)} color={C.coral} />}
          </Card>
        ) : (
          <Card style={{ borderColor: C.tealSoft, background: C.tealSoft }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Check size={16} color={C.teal} />
              <Eyebrow>Bloodwork</Eyebrow>
            </div>
            <div style={{ font: `400 13px ${FONT_BODY}`, color: C.ink, marginTop: 14, lineHeight: 1.6 }}>
              {checked
                ? "All tracked markers are in range. Upload your next lab report in the Bloodwork tab to keep the timeline going."
                : "Marker data loads here once you're connected. Upload a lab report in the Bloodwork tab to start."}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ---------- BLOODWORK ----------
function Bloodwork() {
  const [markers, setMarkers] = useState([]); // flat rows straight from Supabase
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null); // marker key whose graph is open
  const [scan, setScan] = useState({ status: "idle", count: 0 }); // idle | reading | done
  const [showForm, setShowForm] = useState(false);
  const [editKey, setEditKey] = useState(null);
  const fileRef = React.useRef(null);

  const blank = { key: "", value: "", unit: "", low: "", high: "", panel: BLOOD_PANEL_NAMES[0] };
  const [draft, setDraft] = useState(blank);

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data } = await supabase.from("blood_markers").select("*").order("taken_on");
    setMarkers(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const panels = useMemo(() => groupMarkers(markers), [markers]);
  const allMarkers = panels.flatMap((p) => p.markers.map((m) => ({ ...m, panel: p.panel, status: markerStatus(m) })));
  const flagged = allMarkers.filter((m) => m.status !== "ok");
  const latestPanelDate = markers.length
    ? fmtLongDate(markers.reduce((max, m) => (m.taken_on > max ? m.taken_on : max), markers[0].taken_on))
    : "No panels yet";

  async function onPickLab(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setScan({ status: "reading", count: 0, error: null });
    if (!supabase) {
      setScan({ status: "error", count: 0, error: "Supabase isn't connected." });
      return;
    }
    try {
      const b64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("analyze-lab", { body: { file: b64, mediaType: file.type } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const takenOn = data.takenOn || new Date().toISOString().slice(0, 10);
      const rows = (data.markers || []).map((m) => ({
        panel: m.panel, marker_key: m.key, value: m.value, unit: m.unit,
        range_low: m.low ?? 0, range_high: m.high ?? null, taken_on: takenOn,
      }));
      if (rows.length > 0) {
        const { error: upsertError } = await supabase.from("blood_markers")
          .upsert(rows, { onConflict: "user_id,marker_key,taken_on" });
        if (upsertError) throw upsertError;
      }
      await load();
      setScan({ status: "done", count: rows.length, error: null });
    } catch (err) {
      setScan({ status: "error", count: 0, error: err.message || String(err) });
    }
  }

  function openAdd() { setEditKey(null); setDraft(blank); setShowForm(true); }
  function openEdit(m) {
    setEditKey(m.key);
    setDraft({ key: m.key, value: String(m.value), unit: m.unit, low: String(m.low), high: m.high === Infinity ? "" : String(m.high), panel: m.panel });
    setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditKey(null); setDraft(blank); }

  async function saveMarker() {
    if (!draft.key || draft.value === "" || !draft.unit || !supabase) return;
    const val = parseFloat(draft.value);
    const low = draft.low === "" ? 0 : parseFloat(draft.low);
    const high = draft.high === "" ? null : parseFloat(draft.high);
    if (editKey) {
      const current = allMarkers.find((m) => m.key === editKey);
      if (current?.id) {
        await supabase.from("blood_markers").update({
          panel: draft.panel, marker_key: draft.key, value: val, unit: draft.unit, range_low: low, range_high: high,
        }).eq("id", current.id);
      }
    } else {
      await supabase.from("blood_markers").insert({
        panel: draft.panel, marker_key: draft.key, value: val, unit: draft.unit, range_low: low, range_high: high,
        taken_on: new Date().toISOString().slice(0, 10),
      });
    }
    await load();
    setExpanded(draft.key);
    closeForm();
  }

  const inputStyle = { font: `400 14px ${FONT_BODY}`, padding: "10px 12px",
    border: `1px solid ${C.line}`, borderRadius: 10, background: C.bg, color: C.ink, width: "100%", boxSizing: "border-box" };

  function TrendGraph({ m }) {
    const status = markerStatus(m);
    const data = m.history.map((h) => ({ date: fmtShortDate(h.date), v: h.value }));
    const stroke = status === "ok" ? C.teal : C.coral;
    const first = m.history[0].value, last = m.history[m.history.length - 1].value;
    const delta = last - first;
    const dir = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    return (
      <div style={{ marginTop: 12, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, font: `400 11px ${FONT_MONO}`, color: C.mute }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: status === "ok" ? C.teal : C.coralText }}>
              {dir === "up" ? <TrendingUp size={13} /> : dir === "down" ? <TrendingDown size={13} /> : null}
              {dir !== "flat" ? `${delta > 0 ? "+" : ""}${Math.round(delta * 100) / 100} ${m.unit} over ${m.history.length} panels` : "stable"}
            </span>
          </div>
          <div style={{ font: `400 11px ${FONT_MONO}`, color: C.mute }}>
            range <span style={{ color: C.ink }}>{m.low}-{m.high === Infinity ? "∞" : m.high}</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 14, left: -20, right: 8 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={C.line} vertical={false} />
            <XAxis dataKey="date" tick={{ font: `400 11px ${FONT_MONO}`, fill: C.mute }} axisLine={false} tickLine={false} />
            <YAxis tick={{ font: `400 10px ${FONT_MONO}`, fill: C.mute }} axisLine={false} tickLine={false} domain={["dataMin - 5", "dataMax + 5"]} />
            <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${C.line}`, font: `12px ${FONT_BODY}` }} />
            {isFinite(m.high) && m.high < 1e6 && (
              <ReferenceLine y={m.high} stroke={C.coral} strokeDasharray="4 4" strokeOpacity={0.5}
                label={{ value: "max", font: `400 9px ${FONT_MONO}`, fill: C.coral, position: "insideTopRight" }} />
            )}
            {m.low > 0 && (
              <ReferenceLine y={m.low} stroke={C.amber} strokeDasharray="4 4" strokeOpacity={0.5}
                label={{ value: "min", font: `400 9px ${FONT_MONO}`, fill: C.amber, position: "insideBottomRight" }} />
            )}
            <Line type="monotone" dataKey="v" stroke={stroke} strokeWidth={2.5} dot={{ r: 4, fill: stroke }} />
          </LineChart>
        </ResponsiveContainer>
        {m.note && (
          <div style={{ font: `400 12px ${FONT_BODY}`, color: C.ink, marginTop: 6, lineHeight: 1.5,
            background: status === "ok" ? C.tealSoft : C.coralSoft, padding: "10px 12px", borderRadius: 10 }}>
            {m.note}
          </div>
        )}
        {m.protocol && (
          <div style={{ font: `400 11px ${FONT_MONO}`, color: C.mute, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Link2 size={12} color={C.teal} /> Linked protocol: <span style={{ color: C.ink }}>{m.protocol}</span>
          </div>
        )}
        <button onClick={() => openEdit(m)}
          style={{ appearance: "none", cursor: "pointer", border: `1px solid ${C.line}`, background: C.bg, color: C.mute,
            borderRadius: 8, padding: "7px 12px", font: `500 12px ${FONT_BODY}`, marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Pencil size={13} /> Edit value or range
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {!supabase && <SupabaseSetupNotice />}

      {/* Header: latest panel + actions */}
      <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <Eyebrow>Latest panel</Eyebrow>
          <div style={{ font: `700 20px ${FONT_DISPLAY}`, marginTop: 4 }}>{loading ? "Loading…" : latestPanelDate}</div>
          <div style={{ font: `400 12px ${FONT_MONO}`, color: C.mute }}>
            {allMarkers.length} markers · {flagged.length} out of range
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={onPickLab} style={{ display: "none" }} />
          <button onClick={() => fileRef.current && fileRef.current.click()}
            style={{ appearance: "none", border: `1px solid ${C.teal}`, cursor: "pointer", background: C.bg, color: C.teal,
              font: `600 13px ${FONT_BODY}`, padding: "9px 16px", borderRadius: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Upload size={15} /> Upload lab
          </button>
          <button onClick={openAdd}
            style={{ appearance: "none", border: "none", cursor: "pointer", background: C.teal, color: "#fff",
              font: `600 13px ${FONT_BODY}`, padding: "9px 16px", borderRadius: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> Add marker
          </button>
        </div>
      </Card>

      {/* Scan status */}
      {scan.status !== "idle" && (
        <Card style={{ background: scan.status === "done" ? C.tealSoft : scan.status === "error" ? C.coralSoft : C.bg,
          borderColor: scan.status === "done" ? C.teal : scan.status === "error" ? C.coral : C.line,
          display: "flex", alignItems: "center", gap: 14 }}>
          {scan.status === "reading" ? (
            <>
              <div style={{ width: 20, height: 20, border: `2px solid ${C.line}`, borderTopColor: C.teal, borderRadius: 99, animation: "vspin 0.7s linear infinite" }} />
              <div>
                <div style={{ font: `600 14px ${FONT_BODY}` }}>Reading your lab report…</div>
                <div style={{ font: `400 12px ${FONT_MONO}`, color: C.mute }}>Extracting markers, values and reference ranges</div>
              </div>
            </>
          ) : scan.status === "error" ? (
            <>
              <AlertCircle size={20} color={C.coral} />
              <div style={{ flex: 1 }}>
                <div style={{ font: `600 14px ${FONT_BODY}`, color: C.coralText }}>Couldn't read that lab report</div>
                <div style={{ font: `400 12px ${FONT_BODY}`, color: C.ink }}>{scan.error}</div>
              </div>
              <button onClick={() => setScan({ status: "idle", count: 0, error: null })}
                style={{ appearance: "none", border: `1px solid ${C.line}`, background: C.bg, cursor: "pointer", color: C.mute,
                  font: `600 12px ${FONT_BODY}`, padding: "7px 12px", borderRadius: 8 }}>Dismiss</button>
            </>
          ) : (
            <>
              <Check size={20} color={C.teal} />
              <div style={{ flex: 1 }}>
                <div style={{ font: `600 14px ${FONT_BODY}`, color: C.teal }}>Lab parsed: {scan.count} markers found</div>
                <div style={{ font: `400 12px ${FONT_BODY}`, color: C.mute }}>
                  Each value appended to its timeline as a new dated panel. Review below.
                </div>
              </div>
              <button onClick={() => setScan({ status: "idle", count: 0, error: null })}
                style={{ appearance: "none", border: `1px solid ${C.line}`, background: C.bg, cursor: "pointer", color: C.mute,
                  font: `600 12px ${FONT_BODY}`, padding: "7px 12px", borderRadius: 8 }}>Dismiss</button>
            </>
          )}
        </Card>
      )}

      {/* Add/edit form */}
      {showForm && (
        <Card>
          <div style={{ font: `600 14px ${FONT_BODY}`, marginBottom: 14 }}>{editKey ? "Edit marker" : "Add marker"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10, marginBottom: 12 }} className="pf-row">
            <div>
              <label style={{ font: `500 11px ${FONT_MONO}`, color: C.mute, display: "block", marginBottom: 5 }}>MARKER</label>
              <input style={inputStyle} placeholder="e.g. Vitamin D" value={draft.key} disabled={!!editKey}
                onChange={(e) => setDraft({ ...draft, key: e.target.value })} />
            </div>
            <div>
              <label style={{ font: `500 11px ${FONT_MONO}`, color: C.mute, display: "block", marginBottom: 5 }}>VALUE</label>
              <input style={inputStyle} type="number" placeholder="32" value={draft.value}
                onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
            </div>
            <div>
              <label style={{ font: `500 11px ${FONT_MONO}`, color: C.mute, display: "block", marginBottom: 5 }}>UNIT</label>
              <input style={inputStyle} placeholder="ng/mL" value={draft.unit}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 10, marginBottom: 16 }} className="pf-row">
            <div>
              <label style={{ font: `500 11px ${FONT_MONO}`, color: C.mute, display: "block", marginBottom: 5 }}>RANGE LOW</label>
              <input style={inputStyle} type="number" placeholder="30" value={draft.low}
                onChange={(e) => setDraft({ ...draft, low: e.target.value })} />
            </div>
            <div>
              <label style={{ font: `500 11px ${FONT_MONO}`, color: C.mute, display: "block", marginBottom: 5 }}>RANGE HIGH</label>
              <input style={inputStyle} type="number" placeholder="100" value={draft.high}
                onChange={(e) => setDraft({ ...draft, high: e.target.value })} />
            </div>
            <div>
              <label style={{ font: `500 11px ${FONT_MONO}`, color: C.mute, display: "block", marginBottom: 5 }}>PANEL</label>
              <select style={inputStyle} value={draft.panel} onChange={(e) => setDraft({ ...draft, panel: e.target.value })}>
                {BLOOD_PANEL_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={closeForm}
              style={{ appearance: "none", border: `1px solid ${C.line}`, background: C.bg, cursor: "pointer", color: C.mute, font: `600 13px ${FONT_BODY}`, padding: "9px 16px", borderRadius: 10 }}>Cancel</button>
            <button onClick={saveMarker}
              style={{ appearance: "none", border: "none", background: C.ink, cursor: "pointer", color: "#fff", font: `600 13px ${FONT_BODY}`, padding: "9px 18px", borderRadius: 10 }}>{editKey ? "Save changes" : "Add marker"}</button>
          </div>
        </Card>
      )}

      {/* Flagged summary */}
      {flagged.length > 0 && (
        <Card style={{ borderColor: C.coralSoft, background: C.coralSoft }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <AlertCircle size={16} color={C.coral} /><Eyebrow>Out of range</Eyebrow>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {flagged.map((m) => (
              <button key={m.key} onClick={() => { setExpanded(m.key); document.getElementById("mk-" + m.key)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
                style={{ appearance: "none", cursor: "pointer", border: `1px solid ${C.coral}`, background: C.bg,
                  borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ font: `600 13px ${FONT_BODY}`, color: C.ink }}>{m.key}</span>
                <span style={{ font: `600 13px ${FONT_DISPLAY}`, color: C.coralText }}>{m.value}{m.value > m.high ? " ↑" : " ↓"}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {supabase && !loading && panels.length === 0 && (
        <Card style={{ textAlign: "center", color: C.mute, font: `400 13px ${FONT_BODY}` }}>
          No blood markers yet. Add one above to start your timeline.
        </Card>
      )}

      {/* Panels with latest values; click a marker to expand its trend */}
      {panels.map((panel) => (
        <Card key={panel.panel}>
          <Eyebrow>{panel.panel}</Eyebrow>
          <div style={{ marginTop: 10 }}>
            {panel.markers.map((raw, i) => {
              const m = { ...raw, panel: panel.panel, status: markerStatus(raw) };
              const open = expanded === m.key;
              const flag = m.status !== "ok";
              return (
                <div key={m.key} id={"mk-" + m.key} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
                  <button onClick={() => setExpanded(open ? null : m.key)}
                    style={{ appearance: "none", cursor: "pointer", background: "none", border: "none", width: "100%",
                      display: "flex", alignItems: "center", gap: 12, padding: "13px 2px", textAlign: "left" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: flag ? C.coral : C.teal, flexShrink: 0 }} />
                    <span style={{ flex: 1, font: `600 14px ${FONT_BODY}`, color: C.ink }}>{m.key}</span>
                    <span style={{ font: `700 16px ${FONT_DISPLAY}`, color: flag ? C.coralText : C.ink }}>
                      {m.value}<span style={{ font: `400 11px ${FONT_MONO}`, color: C.mute }}> {m.unit}</span>
                    </span>
                    <ChevronRight size={16} color={C.mute} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .2s", flexShrink: 0 }} />
                  </button>
                  {open && <TrendGraph m={m} />}
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      <div style={{ font: `400 12px ${FONT_BODY}`, color: C.mute, lineHeight: 1.5, padding: "0 4px" }}>
        Tap any marker to see its history and trend. Upload a lab report and Vitae extracts every marker automatically,
        appending each as a new dated panel, so your timeline builds itself over time.
      </div>
    </div>
  );
}

// ---------- NUTRITION ----------
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Nutrition() {
  const [mealList, setMealList] = useState(supabase ? [] : meals);
  const [scan, setScan] = useState({ status: "idle", preview: null, error: null }); // idle | reading | review | error
  const [draft, setDraft] = useState(null);
  const fileRef = React.useRef(null);

  const loadMeals = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from("meals").select("*")
      .eq("eaten_on", isoDaysAgo(0)).order("eaten_at");
    setMealList((data || []).map((r) => ({ id: r.id, name: r.name, kcal: r.kcal,
      conf: r.confidence == null ? 1 : Number(r.confidence), time: r.eaten_at, p: r.protein, c: r.carbs, f: r.fat })));
  }, []);
  useEffect(() => { loadMeals(); }, [loadMeals]);

  const total = mealList.reduce((s, m) => s + m.kcal, 0);
  const macros = mealList.reduce((a, m) => ({ p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }), { p: 0, c: 0, f: 0 });

  async function onPickPhoto(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setScan({ status: "reading", preview, error: null });
    if (!supabase) {
      setScan({ status: "error", preview, error: "Supabase isn't connected. See the Bloodwork or Protocols tab for setup." });
      return;
    }
    try {
      const image = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("analyze-meal", { body: { image, mediaType: file.type } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDraft({ name: data.name || "", kcal: String(data.kcal ?? ""), protein: String(data.protein ?? ""),
        carbs: String(data.carbs ?? ""), fat: String(data.fat ?? ""), confidence: data.confidence ?? 0.8 });
      setScan({ status: "review", preview, error: null });
    } catch (err) {
      setScan({ status: "error", preview, error: err.message || String(err) });
    }
  }

  async function confirmMeal() {
    if (!draft || !draft.name || draft.kcal === "") return;
    const meal = {
      name: draft.name, kcal: Math.round(parseFloat(draft.kcal) || 0), conf: draft.confidence,
      time: new Date().toTimeString().slice(0, 5),
      p: Math.round(parseFloat(draft.protein) || 0), c: Math.round(parseFloat(draft.carbs) || 0), f: Math.round(parseFloat(draft.fat) || 0),
    };
    if (supabase) {
      await supabase.from("meals").insert({ name: meal.name, kcal: meal.kcal, protein: meal.p,
        carbs: meal.c, fat: meal.f, confidence: meal.conf, eaten_at: meal.time });
      await loadMeals();
    } else {
      setMealList((ms) => [...ms, meal]);
    }
    dismissScan();
  }

  async function removeMeal(m, i) {
    if (supabase && m.id) {
      await supabase.from("meals").delete().eq("id", m.id);
      await loadMeals();
    } else {
      setMealList((ms) => ms.filter((_, j) => j !== i));
    }
  }
  function dismissScan() {
    setScan({ status: "idle", preview: null, error: null });
    setDraft(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* AI capture strip */}
      <Card style={{ display: "flex", alignItems: "center", gap: 16, background: C.tealSoft, borderColor: C.tealSoft }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: C.teal, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Camera size={24} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ font: `600 15px ${FONT_BODY}` }}>Snap a meal to log it</div>
          <div style={{ font: `400 12px ${FONT_BODY}`, color: C.mute }}>
            AI estimates calories & macros from the photo. You confirm before it saves.
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPickPhoto} style={{ display: "none" }} />
        <button onClick={() => fileRef.current && fileRef.current.click()}
          style={{ appearance: "none", border: "none", cursor: "pointer", background: C.teal, color: "#fff",
          font: `600 13px ${FONT_BODY}`, padding: "11px 18px", borderRadius: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={15} /> Add photo
        </button>
      </Card>

      {scan.status === "reading" && (
        <Card style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {scan.preview && <img src={scan.preview} alt="Captured meal" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />}
          <div style={{ width: 18, height: 18, border: `2px solid ${C.line}`, borderTopColor: C.teal, borderRadius: 99, animation: "vspin 0.7s linear infinite" }} />
          <div>
            <div style={{ font: `600 13px ${FONT_BODY}` }}>Reading your photo…</div>
            <div style={{ font: `400 11px ${FONT_MONO}`, color: C.mute }}>Estimating calories and macros</div>
          </div>
        </Card>
      )}

      {scan.status === "error" && (
        <Card style={{ borderColor: C.coral, background: C.coralSoft }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={16} color={C.coral} /><Eyebrow>Couldn't read that photo</Eyebrow>
          </div>
          <div style={{ font: `400 12px ${FONT_BODY}`, color: C.ink, marginTop: 8 }}>{scan.error}</div>
          <button onClick={dismissScan}
            style={{ appearance: "none", border: `1px solid ${C.line}`, background: C.bg, cursor: "pointer", color: C.mute,
              font: `600 12px ${FONT_BODY}`, padding: "7px 12px", borderRadius: 8, marginTop: 10 }}>Dismiss</button>
        </Card>
      )}

      {scan.status === "review" && draft && (
        <Card>
          <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
            {scan.preview && <img src={scan.preview} alt="Captured meal" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />}
            <div>
              <div style={{ font: `600 14px ${FONT_BODY}` }}>Confirm before saving</div>
              <div style={{ font: `400 11px ${FONT_MONO}`, color: draft.confidence > 0.9 ? C.teal : C.amberText }}>
                {Math.round(draft.confidence * 100)}% confidence. Edit anything that looks off.
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 10 }} className="pf-row">
            <div>
              <label style={{ font: `500 11px ${FONT_MONO}`, color: C.mute, display: "block", marginBottom: 5 }}>DISH</label>
              <input style={{ font: `400 14px ${FONT_BODY}`, padding: "10px 12px", border: `1px solid ${C.line}`, borderRadius: 10,
                background: C.bg, color: C.ink, width: "100%", boxSizing: "border-box" }}
                value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <label style={{ font: `500 11px ${FONT_MONO}`, color: C.mute, display: "block", marginBottom: 5 }}>KCAL</label>
              <input type="number" style={{ font: `400 14px ${FONT_BODY}`, padding: "10px 12px", border: `1px solid ${C.line}`, borderRadius: 10,
                background: C.bg, color: C.ink, width: "100%", boxSizing: "border-box" }}
                value={draft.kcal} onChange={(e) => setDraft({ ...draft, kcal: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }} className="pf-row">
            {[["protein", "PROTEIN (G)"], ["carbs", "CARBS (G)"], ["fat", "FAT (G)"]].map(([key, label]) => (
              <div key={key}>
                <label style={{ font: `500 11px ${FONT_MONO}`, color: C.mute, display: "block", marginBottom: 5 }}>{label}</label>
                <input type="number" style={{ font: `400 14px ${FONT_BODY}`, padding: "10px 12px", border: `1px solid ${C.line}`, borderRadius: 10,
                  background: C.bg, color: C.ink, width: "100%", boxSizing: "border-box" }}
                  value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={dismissScan}
              style={{ appearance: "none", border: `1px solid ${C.line}`, background: C.bg, cursor: "pointer", color: C.mute,
                font: `600 13px ${FONT_BODY}`, padding: "9px 16px", borderRadius: 10 }}>Discard</button>
            <button onClick={confirmMeal}
              style={{ appearance: "none", border: "none", background: C.teal, cursor: "pointer", color: "#fff",
                font: `600 13px ${FONT_BODY}`, padding: "9px 18px", borderRadius: 10 }}>Save meal</button>
          </div>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }} className="nut-split">
        {/* Meal log */}
        <Card>
          <Eyebrow>{mealList.length} meals today · {total} kcal</Eyebrow>
          <div style={{ marginTop: 14, display: "grid", gap: 4 }}>
            {mealList.length === 0 && (
              <div style={{ font: `400 13px ${FONT_BODY}`, color: C.mute, padding: "18px 0", textAlign: "center" }}>
                No meals logged today. Snap a photo above to log your first.
              </div>
            )}
            {mealList.map((m, i) => (
              <div key={m.id || i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0",
                borderBottom: i < mealList.length - 1 ? `1px solid ${C.line}` : "none" }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: C.coralSoft,
                  display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Utensils size={18} color={C.coral} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ font: `600 14px ${FONT_BODY}` }}>{m.name}</div>
                  <div style={{ font: `400 11px ${FONT_MONO}`, color: C.mute }}>
                    {m.time} · P{m.p} C{m.c} F{m.f}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ font: `700 15px ${FONT_DISPLAY}` }}>{m.kcal}</div>
                  <div style={{ font: `400 10px ${FONT_MONO}`,
                    color: m.conf > 0.9 ? C.teal : C.amberText, display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                    <Check size={10} /> {Math.round(m.conf * 100)}%
                  </div>
                </div>
                <button onClick={() => removeMeal(m, i)} aria-label={`Delete ${m.name}`}
                  style={{ appearance: "none", cursor: "pointer", border: `1px solid ${C.line}`, background: C.bg,
                    color: C.mute, borderRadius: 8, padding: 6, display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Macro split */}
        <Card>
          <Eyebrow>Macro split</Eyebrow>
          <div style={{ display: "grid", gap: 16, marginTop: 18 }}>
            {[["Protein", macros.p, C.teal], ["Carbs", macros.c, C.coral], ["Fat", macros.f, C.amber]].map(([label, g, col]) => {
              const sum = macros.p + macros.c + macros.f;
              return (
                <div key={label}>
                  <div style={{ display: "flex", justifyContent: "space-between", font: `500 13px ${FONT_BODY}`, marginBottom: 6 }}>
                    <span>{label}</span><span style={{ font: `400 12px ${FONT_MONO}`, color: C.mute }}>{g}g</span>
                  </div>
                  <div style={{ height: 8, background: C.line, borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ width: `${sum ? (g / sum) * 100 : 0}%`, height: "100%", background: col, borderRadius: 99 }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 22, padding: 14, background: C.panel, borderRadius: 12,
            font: `400 12px ${FONT_BODY}`, color: C.mute, lineHeight: 1.5 }}>
            Confidence below 85% is flagged amber. Tap any meal to correct the AI's estimate.
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------- TRAINING ----------
function Training() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="tr-split">
        <Card>
          <Eyebrow>HR zones · today's run</Eyebrow>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={hrZones} margin={{ left: -24, top: 16 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={C.line} vertical={false} />
              <XAxis dataKey="z" tick={{ font: `400 11px ${FONT_MONO}`, fill: C.mute }} axisLine={false} tickLine={false} />
              <YAxis tick={{ font: `400 10px ${FONT_MONO}`, fill: C.mute }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${C.line}`, font: `12px ${FONT_BODY}` }} cursor={{ fill: C.tealSoft }} />
              <Bar dataKey="min" fill={C.teal} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
          <Eyebrow>This week · from Garmin</Eyebrow>
          <div style={{ display: "flex", gap: 28 }}>
            <div><div style={{ font: `700 34px/1 ${FONT_DISPLAY}`, color: C.teal }}>4</div>
              <div style={{ font: `400 11px ${FONT_MONO}`, color: C.mute }}>sessions</div></div>
            <div><div style={{ font: `700 34px/1 ${FONT_DISPLAY}`, color: C.teal }}>3h 35m</div>
              <div style={{ font: `400 11px ${FONT_MONO}`, color: C.mute }}>active time</div></div>
            <div><div style={{ font: `700 34px/1 ${FONT_DISPLAY}`, color: C.coral }}>1,570</div>
              <div style={{ font: `400 11px ${FONT_MONO}`, color: C.mute }}>kcal burned</div></div>
          </div>
          <div style={{ font: `400 12px ${FONT_BODY}`, color: C.mute, lineHeight: 1.5 }}>
            Workouts flow in automatically over the Garmin Connect API and feed your daily energy-out total.
          </div>
        </Card>
      </div>

      <Card>
        <Eyebrow>Recent activities</Eyebrow>
        <div style={{ marginTop: 12, display: "grid", gap: 4 }}>
          {workouts.map((w, i) => {
            const Icon = w.icon;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0",
                borderBottom: i < workouts.length - 1 ? `1px solid ${C.line}` : "none" }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: C.tealSoft,
                  display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Icon size={20} color={C.teal} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ font: `600 14px ${FONT_BODY}` }}>{w.type}</div>
                  <div style={{ font: `400 11px ${FONT_MONO}`, color: C.mute }}>{w.when}</div>
                </div>
                <div style={{ display: "flex", gap: 22, font: `400 12px ${FONT_MONO}`, color: C.mute }}>
                  <span>{w.dur}</span><span>{w.dist}</span>
                  <span style={{ color: C.coral }}>{w.kcal} kcal</span>
                  <span style={{ color: C.ink, display: "flex", alignItems: "center", gap: 3 }}><Heart size={12} color={C.coral} /> {w.hr}</span>
                </div>
                <ChevronRight size={16} color={C.mute} />
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ---------- PROTOCOLS ----------
function Protocols() {
  const now = new Date();
  const todayIdx = (now.getDay() + 6) % 7; // Mon=0..Sun=6, matching DAYS
  const todayName = DAYS[todayIdx];
  const TODAY_ISO = now.toISOString().slice(0, 10);
  const [protocols, setProtocols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = adding; number = editing that protocol
  const [view, setView] = useState("active"); // active | archive
  const [menuFor, setMenuFor] = useState(null); // protocol id whose ⋯ menu is open
  const blank = { type: "peptide", name: "", dose: "", unit: "mcg", time: "08:00", slot: "AM", purpose: "", durationDays: "", days: [] };
  const [draft, setDraft] = useState(blank);
  const [scan, setScan] = useState({ status: "idle", preview: null, detectedType: null });
  const fileRef = React.useRef(null);

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const [{ data: rows }, { data: logs }] = await Promise.all([
      supabase.from("protocols").select("*").order("created_at"),
      supabase.from("protocol_logs").select("protocol_id, taken_on"),
    ]);
    const logMap = {};
    for (const l of logs || []) (logMap[l.protocol_id] ||= []).push(l.taken_on);
    setProtocols((rows || []).map((r) => shapeProtocol(r, logMap[r.id] || [])));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const active = protocols.filter((p) => p.status !== "archived");
  const archive = protocols.filter((p) => p.status === "archived");

  async function onPickPhoto(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setScan({ status: "reading", preview: url, detectedType: null, error: null });
    setEditingId(null);
    setShowForm(true);
    if (!supabase) {
      setScan({ status: "error", preview: url, detectedType: null, error: "Supabase isn't connected." });
      return;
    }
    try {
      const image = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("analyze-label", { body: { image, mediaType: file.type } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDraft((dr) => ({ ...dr, type: data.type === "supplement" ? "supplement" : "peptide", name: data.name || "",
        dose: String(data.dose ?? ""), unit: data.unit || (data.type === "supplement" ? "tab" : "mcg"), purpose: data.purpose || "" }));
      setScan({ status: "done", preview: url, detectedType: data.type, error: null });
    } catch (err) {
      setScan({ status: "error", preview: url, detectedType: null, error: err.message || String(err) });
    }
  }

  const slots = { AM: active.filter((p) => p.slot === "AM"), PM: active.filter((p) => p.slot === "PM") };
  const todayDoses = active.filter((p) => p.days.includes(todayName));
  const takenCount = todayDoses.filter((p) => (p.log || []).includes(TODAY_ISO)).length;

  // Mark / unmark today's dose on a protocol; keeps a dated log for adherence
  async function toggleToday(id) {
    if (!supabase) return;
    const p = protocols.find((x) => x.id === id);
    const has = (p?.log || []).includes(TODAY_ISO);
    if (has) await supabase.from("protocol_logs").delete().eq("protocol_id", id).eq("taken_on", TODAY_ISO);
    else await supabase.from("protocol_logs").insert({ protocol_id: id, taken_on: TODAY_ISO });
    await load();
  }

  function toggleDraftDay(d) {
    setDraft((dr) => ({ ...dr, days: dr.days.includes(d) ? dr.days.filter((x) => x !== d) : [...dr.days, d] }));
  }

  function openAdd() { setEditingId(null); setDraft(blank); setScan({ status: "idle", preview: null, detectedType: null }); setShowForm(true); }
  function openEdit(p) {
    setEditingId(p.id);
    setDraft({ type: p.type, name: p.name, dose: String(p.dose), unit: p.unit, time: p.time,
      slot: p.slot || "AM", purpose: p.purpose, durationDays: p.durationDays ? String(p.durationDays) : "", days: p.days });
    setScan({ status: "idle", preview: null, detectedType: null });
    setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditingId(null); setDraft(blank); setScan({ status: "idle", preview: null, detectedType: null }); }

  async function save() {
    if (!draft.name || !draft.dose || draft.days.length === 0 || !supabase) return;
    const peptidePalette = ["#0E6E66", "#3B9BD0", "#8C6BD0", "#D89A2B", "#E8674C"];
    const supplementPalette = ["#2E9E6B", "#D89A2B", "#8C6BD0", "#3B9BD0", "#E8674C"];
    const palette = draft.type === "supplement" ? supplementPalette : peptidePalette;
    const patch = {
      type: draft.type, name: draft.name, dose: parseFloat(draft.dose), unit: draft.unit,
      time: draft.time, slot: draft.slot, days: draft.days, purpose: draft.purpose || "",
      duration_days: draft.durationDays ? parseInt(draft.durationDays, 10) : null,
    };
    if (editingId != null) {
      await supabase.from("protocols").update(patch).eq("id", editingId);
    } else {
      await supabase.from("protocols").insert({
        ...patch, start_date: TODAY_ISO, color: palette[protocols.length % palette.length], status: "active",
      });
    }
    await load();
    closeForm();
  }

  // Move an active protocol into the dated archive
  async function completeProtocol(id) {
    if (!supabase) return;
    await supabase.from("protocols").update({ status: "archived", end_date: TODAY_ISO }).eq("id", id);
    await load();
  }

  // Restart an archived protocol back into the active list
  async function restartFromArchive(a) {
    if (!supabase) return;
    await supabase.from("protocols").insert({
      type: a.type, name: a.name, dose: a.dose, unit: a.unit, time: a.time, slot: a.slot || "AM",
      days: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], purpose: a.purpose,
      duration_days: a.durationDays, start_date: TODAY_ISO, color: a.color, status: "active",
    });
    await load();
    setView("active");
  }
  async function deleteArchived(id) {
    if (!supabase) return;
    await supabase.from("protocols").delete().eq("id", id);
    await load();
  }

  const inputStyle = { font: `400 14px ${FONT_BODY}`, padding: "10px 12px",
    border: `1px solid ${C.line}`, borderRadius: 10, background: C.bg, color: C.ink, width: "100%", boxSizing: "border-box" };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {!supabase && <SupabaseSetupNotice />}
      {/* View switch */}
      <div style={{ display: "flex", gap: 4, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 12, padding: 4, width: "fit-content" }}>
        {[["active", "Active"], ["archive", `Archive · ${archive.length}`]].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)}
            style={{ appearance: "none", border: "none", cursor: "pointer", borderRadius: 9, padding: "8px 16px",
              font: `600 13px ${FONT_BODY}`, background: view === v ? C.ink : "transparent", color: view === v ? "#fff" : C.mute }}>
            {label}
          </button>
        ))}
      </div>

      {view === "active" && (
        <>
          {/* Today's doses — split AM / PM */}
          <Card style={{ background: C.ink, color: "#fff", border: "none", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Eyebrow>Today's doses · {todayName}</Eyebrow>
              <span style={{ font: `400 12px ${FONT_MONO}`, color: "#A9C4C0" }}>{takenCount}/{todayDoses.length} taken</span>
            </div>
            {["AM", "PM"].map((slot) => {
              const rows = todayDoses.filter((p) => p.slot === slot);
              if (rows.length === 0) return null;
              return (
                <div key={slot} style={{ marginTop: 16 }}>
                  <div style={{ font: `600 10px ${FONT_MONO}`, letterSpacing: "0.12em", color: "#7FD1C6", marginBottom: 8,
                    display: "flex", alignItems: "center", gap: 6 }}>
                    {slot === "AM" ? <Sun size={12} /> : <Moon size={12} />}{slot === "AM" ? "MORNING" : "EVENING"}
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {rows.sort((a, b) => a.time.localeCompare(b.time)).map((p) => {
                      const done = (p.log || []).includes(TODAY_ISO);
                      return (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14,
                          background: "rgba(255,255,255,.06)", borderRadius: 12, padding: "12px 14px" }}>
                          <button onClick={() => toggleToday(p.id)} aria-label={done ? "Mark not taken" : "Mark taken"}
                            style={{ appearance: "none", cursor: "pointer", width: 26, height: 26, borderRadius: 99, flexShrink: 0,
                              border: `2px solid ${done ? "#7FD1C6" : "rgba(255,255,255,.3)"}`,
                              background: done ? "#7FD1C6" : "transparent", display: "grid", placeItems: "center" }}>
                            {done && <Check size={14} color={C.ink} />}
                          </button>
                          <div style={{ flex: 1 }}>
                            <div style={{ font: `600 15px ${FONT_BODY}`, textDecoration: done ? "line-through" : "none",
                              opacity: done ? 0.6 : 1, display: "flex", alignItems: "center", gap: 7 }}>
                              {p.type === "supplement" ? <Pill size={13} color="#7FD1C6" style={{ flexShrink: 0 }} /> : <Syringe size={13} color="#7FD1C6" style={{ flexShrink: 0 }} />}
                              {p.name}
                            </div>
                            <div style={{ font: `400 11px ${FONT_MONO}`, color: "#A9C4C0" }}>{p.purpose}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ font: `700 15px ${FONT_DISPLAY}` }}>{p.dose}{p.unit}</div>
                            <div style={{ font: `400 11px ${FONT_MONO}`, color: "#A9C4C0", display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                              <Clock size={11} /> {p.time}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </Card>

          {/* Weekly schedule grid — grouped by AM/PM then type */}
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Eyebrow>Weekly schedule</Eyebrow>
              <div style={{ display: "flex", gap: 8 }}>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPickPhoto} style={{ display: "none" }} />
                <button onClick={() => fileRef.current && fileRef.current.click()}
                  style={{ appearance: "none", border: `1px solid ${C.teal}`, cursor: "pointer", background: C.bg, color: C.teal,
                    font: `600 13px ${FONT_BODY}`, padding: "9px 16px", borderRadius: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <Camera size={15} /> Scan label
                </button>
                <button onClick={openAdd}
                  style={{ appearance: "none", border: "none", cursor: "pointer", background: C.teal, color: "#fff",
                    font: `600 13px ${FONT_BODY}`, padding: "9px 16px", borderRadius: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <Plus size={15} /> Add item
                </button>
              </div>
            </div>

            {showForm && (
              <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 18, marginBottom: 18 }}>
                <div style={{ font: `600 13px ${FONT_BODY}`, marginBottom: 14, color: C.ink }}>
                  {editingId != null ? "Edit protocol" : "New protocol"}
                </div>
                {scan.status !== "idle" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16,
                    background: scan.status === "done" ? C.tealSoft : scan.status === "error" ? C.coralSoft : C.bg,
                    border: `1px solid ${scan.status === "done" ? C.teal : scan.status === "error" ? C.coral : C.line}`,
                    borderRadius: 12, padding: 12 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: C.line, display: "grid", placeItems: "center" }}>
                      {scan.preview && <img src={scan.preview} alt="Captured label" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      {scan.status === "reading" ? (
                        <>
                          <div style={{ font: `600 13px ${FONT_BODY}`, color: C.ink }}>Reading label…</div>
                          <div style={{ font: `400 11px ${FONT_MONO}`, color: C.mute }}>Extracting name, dose and concentration</div>
                        </>
                      ) : scan.status === "error" ? (
                        <>
                          <div style={{ font: `600 13px ${FONT_BODY}`, color: C.coralText }}>Couldn't read that label</div>
                          <div style={{ font: `400 11px ${FONT_BODY}`, color: C.ink }}>{scan.error}</div>
                        </>
                      ) : (
                        <>
                          <div style={{ font: `600 13px ${FONT_BODY}`, color: C.teal, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <Check size={14} /> Label recognised
                            {scan.detectedType && (
                              <span style={{ font: `600 10px ${FONT_MONO}`, letterSpacing: "0.08em", textTransform: "uppercase",
                                color: "#fff", background: scan.detectedType === "peptide" ? C.teal : "#2E9E6B", padding: "2px 8px", borderRadius: 99 }}>
                                {scan.detectedType === "peptide" ? "Peptide · injectable" : "Supplement · oral"}
                              </span>
                            )}
                          </div>
                          <div style={{ font: `400 11px ${FONT_MONO}`, color: C.mute }}>Type auto-detected. Confirm the dose, duration and days.</div>
                        </>
                      )}
                    </div>
                    {scan.status === "reading" && (
                      <div style={{ width: 18, height: 18, border: `2px solid ${C.line}`, borderTopColor: C.teal, borderRadius: 99, animation: "vspin 0.7s linear infinite" }} />
                    )}
                  </div>
                )}

                <div style={{ marginBottom: 14 }}>
                  <label style={{ font: `500 11px ${FONT_MONO}`, color: C.mute, display: "block", marginBottom: 6 }}>TYPE</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[["peptide", "Peptide", "injectable"], ["supplement", "Supplement", "oral"]].map(([val, label, sub]) => {
                      const on = draft.type === val;
                      const accent = val === "peptide" ? C.teal : "#2E9E6B";
                      return (
                        <button key={val} onClick={() => setDraft({ ...draft, type: val,
                          unit: val === "supplement" ? (["mcg","mg","mL"].includes(draft.unit) ? draft.unit : "tab") : (["tab","cap","mL","drops"].includes(draft.unit) ? "mcg" : draft.unit) })}
                          style={{ appearance: "none", cursor: "pointer", flex: 1, textAlign: "left",
                            border: `1px solid ${on ? accent : C.line}`, background: on ? accent : C.bg, color: on ? "#fff" : C.mute, borderRadius: 10, padding: "10px 14px" }}>
                          <div style={{ font: `600 13px ${FONT_BODY}` }}>{label}</div>
                          <div style={{ font: `400 10px ${FONT_MONO}`, opacity: 0.8 }}>{sub}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10, marginBottom: 12 }} className="pf-row">
                  <div>
                    <label style={{ font: `500 11px ${FONT_MONO}`, color: C.mute, display: "block", marginBottom: 5 }}>{draft.type === "supplement" ? "SUPPLEMENT" : "PEPTIDE"}</label>
                    <input style={inputStyle} placeholder={draft.type === "supplement" ? "e.g. Multivitamin" : "e.g. BPC-157"} value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ font: `500 11px ${FONT_MONO}`, color: C.mute, display: "block", marginBottom: 5 }}>DOSE</label>
                    <input style={inputStyle} type="number" placeholder={draft.type === "supplement" ? "1" : "250"} value={draft.dose}
                      onChange={(e) => setDraft({ ...draft, dose: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ font: `500 11px ${FONT_MONO}`, color: C.mute, display: "block", marginBottom: 5 }}>UNIT</label>
                    <select style={inputStyle} value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })}>
                      {(draft.type === "supplement" ? ["tab", "cap", "mg", "mcg", "IU", "mL", "drops"] : ["mcg", "mg", "IU", "mL"]).map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }} className="pf-row">
                  <div>
                    <label style={{ font: `500 11px ${FONT_MONO}`, color: C.mute, display: "block", marginBottom: 5 }}>TIME</label>
                    <input style={inputStyle} type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ font: `500 11px ${FONT_MONO}`, color: C.mute, display: "block", marginBottom: 5 }}>WHEN</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      {["AM", "PM"].map((s) => {
                        const on = draft.slot === s;
                        return (
                          <button key={s} onClick={() => setDraft({ ...draft, slot: s })}
                            style={{ appearance: "none", cursor: "pointer", flex: 1, border: `1px solid ${on ? C.teal : C.line}`,
                              background: on ? C.teal : C.bg, color: on ? "#fff" : C.mute, borderRadius: 10, padding: "10px",
                              font: `600 13px ${FONT_BODY}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                            {s === "AM" ? <Sun size={13} /> : <Moon size={13} />}{s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 12 }} className="pf-row">
                  <div>
                    <label style={{ font: `500 11px ${FONT_MONO}`, color: C.mute, display: "block", marginBottom: 5 }}>PURPOSE (optional)</label>
                    <input style={inputStyle} placeholder={draft.type === "supplement" ? "e.g. Daily baseline" : "e.g. Recovery / gut"} value={draft.purpose}
                      onChange={(e) => setDraft({ ...draft, purpose: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ font: `500 11px ${FONT_MONO}`, color: C.mute, display: "block", marginBottom: 5 }}>DURATION (days)</label>
                    <input style={inputStyle} type="number" placeholder="28" value={draft.durationDays}
                      onChange={(e) => setDraft({ ...draft, durationDays: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {[["2 weeks", 14], ["4 weeks", 28], ["6 weeks", 42], ["30 days", 30], ["90 days", 90]].map(([label, val]) => {
                    const on = String(val) === String(draft.durationDays);
                    return (
                      <button key={label} onClick={() => setDraft({ ...draft, durationDays: String(val) })}
                        style={{ appearance: "none", cursor: "pointer", border: `1px solid ${on ? C.teal : C.line}`,
                          background: on ? C.tealSoft : C.bg, color: on ? C.teal : C.mute, borderRadius: 8, padding: "6px 12px", font: `500 12px ${FONT_BODY}` }}>{label}</button>
                    );
                  })}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ font: `500 11px ${FONT_MONO}`, color: C.mute, display: "block", marginBottom: 8 }}>DAYS</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {DAYS.map((d) => {
                      const on = draft.days.includes(d);
                      return (
                        <button key={d} onClick={() => toggleDraftDay(d)}
                          style={{ appearance: "none", cursor: "pointer", border: `1px solid ${on ? C.teal : C.line}`,
                            background: on ? C.teal : C.bg, color: on ? "#fff" : C.mute, borderRadius: 9, padding: "8px 12px", font: `600 12px ${FONT_BODY}` }}>{d}</button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={closeForm}
                    style={{ appearance: "none", border: `1px solid ${C.line}`, background: C.bg, cursor: "pointer", color: C.mute, font: `600 13px ${FONT_BODY}`, padding: "9px 16px", borderRadius: 10 }}>Cancel</button>
                  <button onClick={save}
                    style={{ appearance: "none", border: "none", background: C.ink, cursor: "pointer", color: "#fff", font: `600 13px ${FONT_BODY}`, padding: "9px 18px", borderRadius: 10 }}>{editingId != null ? "Save changes" : "Save protocol"}</button>
                </div>
              </div>
            )}

            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 520 }}>
                <div style={{ display: "grid", gridTemplateColumns: "160px repeat(7, 1fr)", gap: 6, marginBottom: 8 }}>
                  <div />
                  {DAYS.map((d) => (
                    <div key={d} style={{ textAlign: "center", font: `600 11px ${FONT_MONO}`, color: d === todayName ? C.teal : C.mute }}>{d}</div>
                  ))}
                </div>
                {["AM", "PM"].map((slot) => {
                  const rows = slots[slot];
                  if (rows.length === 0) return null;
                  return (
                    <div key={slot}>
                      <div style={{ font: `600 10px ${FONT_MONO}`, letterSpacing: "0.1em", color: C.ink, marginTop: 14, marginBottom: 2, paddingLeft: 2,
                        display: "flex", alignItems: "center", gap: 6 }}>
                        {slot === "AM" ? <Sun size={12} /> : <Moon size={12} />}{slot === "AM" ? "MORNING" : "EVENING"}
                      </div>
                      {rows.map((p) => (
                        <div key={p.id} style={{ display: "grid", gridTemplateColumns: "160px repeat(7, 1fr)", gap: 6, alignItems: "center", padding: "8px 0", borderTop: `1px solid ${C.line}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, flexShrink: 0 }} />
                            <div>
                              <div style={{ font: `600 13px ${FONT_BODY}` }}>{p.name}</div>
                              <div style={{ font: `400 10px ${FONT_MONO}`, color: C.mute }}>{p.dose}{p.unit} · {p.time}</div>
                            </div>
                          </div>
                          {DAYS.map((d) => {
                            const on = p.days.includes(d);
                            return (
                              <div key={d} style={{ display: "grid", placeItems: "center" }}>
                                <span style={{ width: 22, height: 22, borderRadius: p.type === "supplement" ? 99 : 7,
                                  background: on ? p.color : "transparent", border: on ? "none" : `1px solid ${C.line}`, display: "grid", placeItems: "center" }}>
                                  {on && (p.type === "supplement" ? <Pill size={11} color="#fff" /> : <Syringe size={11} color="#fff" />)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {supabase && !loading && active.length === 0 && (
            <Card style={{ textAlign: "center", color: C.mute, font: `400 13px ${FONT_BODY}` }}>
              No active protocols yet. Add one above to start tracking.
            </Card>
          )}

          {/* Protocol cards — daily check, edit, complete */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            {active.map((p) => {
              const done = (p.log || []).includes(TODAY_ISO);
              const scheduledToday = p.days.includes(todayName);
              const elapsedRaw = p.startDate ? Math.floor((new Date(TODAY_ISO) - new Date(p.startDate)) / 86400000) : 0;
              const elapsed = Math.max(0, p.durationDays ? Math.min(elapsedRaw, p.durationDays) : elapsedRaw);
              const pct = p.durationDays ? Math.min(100, Math.round((elapsed / p.durationDays) * 100)) : 0;
              const remaining = p.durationDays ? Math.max(0, p.durationDays - elapsed) : null;
              const adherence = p.durationDays ? Math.round(((p.log || []).length / Math.max(1, Math.round((elapsed / 7) * p.days.length || (p.log || []).length))) * 100) : null;
              return (
                <Card key={p.id} style={{ borderTop: `3px solid ${p.color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        <div style={{ font: `700 17px ${FONT_DISPLAY}` }}>{p.name}</div>
                        <span style={{ font: `600 9px ${FONT_MONO}`, letterSpacing: "0.06em", textTransform: "uppercase",
                          color: p.type === "supplement" ? "#2E9E6B" : C.teal, background: p.type === "supplement" ? "#E6F4EC" : C.tealSoft, padding: "2px 7px", borderRadius: 99 }}>
                          {p.type === "supplement" ? "Supp" : "Peptide"}
                        </span>
                        <span style={{ font: `600 9px ${FONT_MONO}`, letterSpacing: "0.06em", color: C.mute, background: C.panel, padding: "2px 7px", borderRadius: 99,
                          display: "inline-flex", alignItems: "center", gap: 3 }}>
                          {p.slot === "AM" ? <Sun size={9} /> : <Moon size={9} />}{p.slot}
                        </span>
                      </div>
                      <div style={{ font: `400 11px ${FONT_MONO}`, color: C.mute, marginTop: 3 }}>{p.purpose}</div>
                    </div>
                    <div style={{ position: "relative" }}>
                      <button onClick={() => setMenuFor(menuFor === p.id ? null : p.id)} aria-label="More actions" aria-expanded={menuFor === p.id}
                        style={{ appearance: "none", cursor: "pointer", border: `1px solid ${menuFor === p.id ? C.ink : C.line}`,
                          background: menuFor === p.id ? C.ink : C.bg, borderRadius: 8, padding: 6, color: menuFor === p.id ? "#fff" : C.mute,
                          display: "grid", placeItems: "center" }}>
                        <MoreHorizontal size={16} />
                      </button>
                      {menuFor === p.id && (
                        <>
                          {/* tap-catcher closes the menu */}
                          <div onClick={() => setMenuFor(null)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
                          <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 11,
                            background: C.bg, border: `1px solid ${C.line}`, borderRadius: 12, padding: 6, minWidth: 168,
                            boxShadow: "0 8px 24px rgba(15,46,44,.14)" }}>
                            <button onClick={() => { setMenuFor(null); openEdit(p); }}
                              style={{ appearance: "none", cursor: "pointer", border: "none", background: "none", width: "100%",
                                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8,
                                font: `500 14px ${FONT_BODY}`, color: C.ink, textAlign: "left" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = C.panel)}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
                              <Pencil size={15} color={C.mute} /> Edit details
                            </button>
                            <button onClick={() => { setMenuFor(null); completeProtocol(p.id); }}
                              style={{ appearance: "none", cursor: "pointer", border: "none", background: "none", width: "100%",
                                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8,
                                font: `500 14px ${FONT_BODY}`, color: C.ink, textAlign: "left" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = C.panel)}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
                              <Archive size={15} color={C.mute} /> Complete &amp; archive
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
                    <div>
                      <div style={{ font: `700 20px ${FONT_DISPLAY}`, color: p.color }}>{p.dose}<span style={{ font: `400 11px ${FONT_MONO}`, color: C.mute }}>{p.unit}</span></div>
                      <div style={{ font: `400 10px ${FONT_MONO}`, color: C.mute }}>per dose</div>
                    </div>
                    <div>
                      <div style={{ font: `700 20px ${FONT_DISPLAY}` }}>{p.days.length}<span style={{ font: `400 11px ${FONT_MONO}`, color: C.mute }}>×</span></div>
                      <div style={{ font: `400 10px ${FONT_MONO}`, color: C.mute }}>per week</div>
                    </div>
                    <div>
                      <div style={{ font: `700 20px ${FONT_DISPLAY}` }}>{(p.log || []).length}</div>
                      <div style={{ font: `400 10px ${FONT_MONO}`, color: C.mute }}>doses logged</div>
                    </div>
                  </div>

                  {p.durationDays ? (
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", font: `400 10px ${FONT_MONO}`, color: C.mute, marginBottom: 5 }}>
                        <span>Day {elapsed} of {p.durationDays}</span>
                        <span>{remaining} days left</span>
                      </div>
                      <div style={{ height: 5, background: C.line, borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: p.color, borderRadius: 99 }} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}`, font: `400 10px ${FONT_MONO}`, color: C.mute }}>Ongoing · no end date</div>
                  )}

                  {/* Daily check button */}
                  <button onClick={() => toggleToday(p.id)} disabled={!scheduledToday}
                    style={{ appearance: "none", cursor: scheduledToday ? "pointer" : "default", width: "100%", marginTop: 14,
                      border: `1px solid ${done ? p.color : C.line}`, background: done ? p.color : (scheduledToday ? C.bg : C.panel),
                      color: done ? "#fff" : (scheduledToday ? C.ink : C.mute), borderRadius: 10, padding: "11px",
                      font: `600 13px ${FONT_BODY}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, opacity: scheduledToday ? 1 : 0.6 }}>
                    {done ? <><Check size={15} /> Taken today</> : scheduledToday ? <><Circle size={15} /> Mark today's dose</> : "Not scheduled today"}
                  </button>
                </Card>
              );
            })}
          </div>

          <div style={{ font: `400 12px ${FONT_BODY}`, color: C.mute, lineHeight: 1.5, padding: "0 4px" }}>
            Check off each dose as you take it. Vitae logs the date so your adherence builds a record. When a protocol finishes its
            course, archive it to keep a dated history you can revisit or restart.
          </div>
        </>
      )}

      {view === "archive" && (
        <Card>
          <Eyebrow>Archive · completed protocols</Eyebrow>
          {archive.length === 0 ? (
            <div style={{ font: `400 14px ${FONT_BODY}`, color: C.mute, marginTop: 16 }}>
              Nothing archived yet. Completed protocols land here with their dates and dosage for future reference.
            </div>
          ) : (
            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              {archive.map((a) => (
                <div key={a.id} style={{ border: `1px solid ${C.line}`, borderLeft: `3px solid ${a.color}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ font: `700 16px ${FONT_DISPLAY}` }}>{a.name}</div>
                        <span style={{ font: `600 9px ${FONT_MONO}`, letterSpacing: "0.06em", textTransform: "uppercase",
                          color: a.type === "supplement" ? "#2E9E6B" : C.teal, background: a.type === "supplement" ? "#E6F4EC" : C.tealSoft, padding: "2px 7px", borderRadius: 99 }}>
                          {a.type === "supplement" ? "Supp" : "Peptide"}
                        </span>
                      </div>
                      <div style={{ font: `400 11px ${FONT_MONO}`, color: C.mute, marginTop: 3 }}>{a.purpose}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => restartFromArchive(a)}
                        style={{ appearance: "none", cursor: "pointer", border: `1px solid ${C.teal}`, background: C.bg, color: C.teal,
                          borderRadius: 8, padding: "7px 12px", font: `600 12px ${FONT_BODY}`, display: "flex", alignItems: "center", gap: 5 }}>
                        <RotateCcw size={13} /> Restart
                      </button>
                      <button onClick={() => deleteArchived(a.id)} aria-label="Delete record"
                        style={{ appearance: "none", cursor: "pointer", border: `1px solid ${C.line}`, background: C.bg, color: C.mute, borderRadius: 8, padding: 7, display: "grid", placeItems: "center" }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12, marginTop: 14,
                    paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
                    <div>
                      <div style={{ font: `400 9px ${FONT_MONO}`, color: C.mute, textTransform: "uppercase", letterSpacing: "0.08em" }}>Dosage</div>
                      <div style={{ font: `600 14px ${FONT_BODY}`, marginTop: 2 }}>{a.dose}{a.unit} · {a.slot}</div>
                    </div>
                    <div>
                      <div style={{ font: `400 9px ${FONT_MONO}`, color: C.mute, textTransform: "uppercase", letterSpacing: "0.08em" }}>Duration</div>
                      <div style={{ font: `600 14px ${FONT_BODY}`, marginTop: 2 }}>{a.durationDays} days</div>
                    </div>
                    <div>
                      <div style={{ font: `400 9px ${FONT_MONO}`, color: C.mute, textTransform: "uppercase", letterSpacing: "0.08em" }}>Dates taken</div>
                      <div style={{ font: `600 13px ${FONT_BODY}`, marginTop: 2 }}>{fmtLongDate(a.startDate)} - {fmtLongDate(a.endDate)}</div>
                    </div>
                    <div>
                      <div style={{ font: `400 9px ${FONT_MONO}`, color: C.mute, textTransform: "uppercase", letterSpacing: "0.08em" }}>Adherence</div>
                      <div style={{ font: `600 14px ${FONT_BODY}`, marginTop: 2, color: a.color }}>
                        {(() => {
                          const dosesLogged = (a.log || []).length;
                          const dosesPlanned = a.durationDays ? Math.round((a.durationDays / 7) * (a.days ? a.days.length : 7)) : dosesLogged;
                          return `${dosesLogged}/${Math.max(dosesPlanned, dosesLogged)} doses`;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export default Vitae;
