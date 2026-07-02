import React, { useState } from "react";
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
  line: "#E7ECEB",       // hairlines
  mute: "#6B807D",       // secondary text
  bg: "#FFFFFF",
  panel: "#FBFCFC",
};

const FONT_DISPLAY = "'Fraunces', Georgia, serif";
const FONT_BODY = "'Inter', system-ui, sans-serif";
const FONT_MONO = "'IBM Plex Mono', ui-monospace, monospace";

// ---------- simulated data ----------
const today = { date: "Sat 27 Jun", caloriesIn: 1840, caloriesTarget: 2200, caloriesOut: 2640,
  steps: 8420, stepsTarget: 10000, resting: 54, sleep: 7.2, water: 1.6, waterTarget: 2.5 };

const weekEnergy = [
  { d: "Mon", in: 2100, out: 2400 }, { d: "Tue", in: 1950, out: 2750 },
  { d: "Wed", in: 2300, out: 2200 }, { d: "Thu", in: 1820, out: 2600 },
  { d: "Fri", in: 2050, out: 2900 }, { d: "Sat", in: 1840, out: 2640 },
  { d: "Sun", in: 0, out: 0 },
];

const bloodDates = ["Jan '24", "Apr '24", "Aug '24", "Dec '24", "May '25"];
const latestPanelDate = "12 May 2025";

// Markers grouped by panel. status derived from value vs range.
// history aligns to bloodDates; last entry is the latest = value.
const bloodPanels = [
  { panel: "Lipids", markers: [
    { key: "Total cholesterol", value: 214, unit: "mg/dL", low: 0, high: 200, history: [188, 196, 203, 209, 214] },
    { key: "LDL", value: 138, unit: "mg/dL", low: 0, high: 130, history: [122, 128, 131, 135, 138],
      note: "Above range and trending up across 5 panels." },
    { key: "HDL", value: 52, unit: "mg/dL", low: 40, high: 100, history: [48, 49, 50, 51, 52] },
    { key: "Triglycerides", value: 120, unit: "mg/dL", low: 0, high: 150, history: [98, 105, 110, 116, 120] },
  ]},
  { panel: "Metabolic", markers: [
    { key: "HbA1c", value: 5.4, unit: "%", low: 4, high: 5.6, history: [5.9, 5.8, 5.6, 5.5, 5.4],
      note: "Steady improvement — now solidly in range." },
    { key: "Fasting glucose", value: 92, unit: "mg/dL", low: 70, high: 99, history: [101, 98, 95, 93, 92] },
    { key: "Fasting insulin", value: 7.2, unit: "µIU/mL", low: 2, high: 20, history: [11, 9.5, 8.4, 7.8, 7.2] },
    { key: "Uric acid", value: 5.8, unit: "mg/dL", low: 3.4, high: 7.0, history: [6.2, 6.0, 5.9, 5.8, 5.8] },
  ]},
  { panel: "Thyroid", markers: [
    { key: "TSH", value: 2.1, unit: "mIU/L", low: 0.4, high: 4.0, history: [2.8, 2.5, 2.4, 2.2, 2.1] },
    { key: "Free T4", value: 1.3, unit: "ng/dL", low: 0.8, high: 1.8, history: [1.1, 1.2, 1.2, 1.3, 1.3] },
    { key: "Free T3", value: 3.2, unit: "pg/mL", low: 2.3, high: 4.2, history: [3.0, 3.1, 3.1, 3.2, 3.2] },
  ]},
  { panel: "Vitamins & minerals", markers: [
    { key: "Vitamin D", value: 32, unit: "ng/mL", low: 30, high: 100, history: [18, 22, 25, 29, 32],
      note: "Climbing since starting D3 — just crossed into range.", protocol: "Vitamin D3 + K2" },
    { key: "Vitamin B12", value: 540, unit: "pg/mL", low: 200, high: 900, history: [410, 450, 480, 510, 540] },
    { key: "Ferritin", value: 88, unit: "ng/mL", low: 30, high: 400, history: [64, 70, 75, 82, 88] },
    { key: "Magnesium", value: 2.0, unit: "mg/dL", low: 1.7, high: 2.4, history: [1.8, 1.9, 1.9, 2.0, 2.0], protocol: "Magnesium glycinate" },
    { key: "Folate", value: 14, unit: "ng/mL", low: 3, high: 20, history: [9, 11, 12, 13, 14] },
  ]},
  { panel: "Inflammation", markers: [
    { key: "CRP", value: 3.4, unit: "mg/L", low: 0, high: 3.0, history: [1.1, 1.8, 2.2, 2.9, 3.4],
      note: "Above range and rising — worth discussing with your doctor." },
    { key: "Homocysteine", value: 9.1, unit: "µmol/L", low: 0, high: 15, history: [10.2, 9.8, 9.5, 9.3, 9.1] },
  ]},
  { panel: "Liver & kidney", markers: [
    { key: "ALT", value: 28, unit: "U/L", low: 0, high: 40, history: [33, 31, 30, 29, 28] },
    { key: "AST", value: 24, unit: "U/L", low: 0, high: 40, history: [27, 26, 25, 24, 24] },
    { key: "Creatinine", value: 0.95, unit: "mg/dL", low: 0.7, high: 1.3, history: [0.92, 0.93, 0.94, 0.95, 0.95] },
    { key: "eGFR", value: 98, unit: "mL/min", low: 90, high: 200, history: [95, 96, 97, 98, 98] },
  ]},
  { panel: "Hormones", markers: [
    { key: "Total testosterone", value: 610, unit: "ng/dL", low: 300, high: 1000, history: [520, 545, 570, 590, 610],
      protocol: "Ipamorelin" },
    { key: "IGF-1", value: 180, unit: "ng/mL", low: 90, high: 250, history: [150, 158, 166, 173, 180], protocol: "Ipamorelin" },
  ]},
];

function markerStatus(m) {
  if (m.value > m.high) return "high";
  if (m.value < m.low) return "low";
  return "ok";
}
// Flat list for any code that wants every marker
const bloodMarkers = bloodPanels.flatMap((p) => p.markers.map((m) => ({ ...m, panel: p.panel, status: markerStatus(m) })));

const meals = [
  { name: "Greek yogurt & berries", kcal: 240, conf: 0.94, time: "08:10", p: 18, c: 28, f: 6 },
  { name: "Grilled chicken salad", kcal: 520, conf: 0.88, time: "13:25", p: 42, c: 24, f: 22 },
  { name: "Apple & almonds", kcal: 210, conf: 0.91, time: "16:40", p: 6, c: 22, f: 13 },
  { name: "Salmon, rice, greens", kcal: 670, conf: 0.83, time: "19:50", p: 38, c: 55, f: 28 },
];

const workouts = [
  { type: "Running", dur: "42 min", dist: "7.1 km", kcal: 540, hr: 152, when: "Today · 06:30", icon: Footprints },
  { type: "Strength", dur: "55 min", dist: "—", kcal: 310, hr: 118, when: "Yesterday", icon: Activity },
  { type: "Cycling", dur: "1h 18m", dist: "31 km", kcal: 720, hr: 138, when: "Thu", icon: Activity },
];

const hrZones = [
  { z: "Z1", min: 12 }, { z: "Z2", min: 18 }, { z: "Z3", min: 8 }, { z: "Z4", min: 3 }, { z: "Z5", min: 1 },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Protocols — peptides (insulin-pen, Luminate house style) and supplements
// slot: "AM" | "PM" · log: array of ISO date strings when a dose was checked off
const initialProtocols = [
  { id: 1, type: "peptide", name: "BPC-157", dose: 250, unit: "mcg", time: "08:00", slot: "AM", days: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
    purpose: "Recovery / gut", durationDays: 28, startedDay: 6, color: "#0E6E66", taken: true,
    log: ["2026-06-22","2026-06-23","2026-06-24","2026-06-25","2026-06-26","2026-06-27"] },
  { id: 2, type: "peptide", name: "TB-500", dose: 2.5, unit: "mg", time: "08:00", slot: "AM", days: ["Mon","Thu"],
    purpose: "Tissue repair", durationDays: 42, startedDay: 12, color: "#3B9BD0", taken: false,
    log: ["2026-06-22","2026-06-25"] },
  { id: 3, type: "peptide", name: "Ipamorelin", dose: 300, unit: "mcg", time: "22:30", slot: "PM", days: ["Mon","Tue","Wed","Thu","Fri"],
    purpose: "GH support / sleep", durationDays: 56, startedDay: 20, color: "#8C6BD0", taken: false,
    log: ["2026-06-22","2026-06-23","2026-06-24","2026-06-25","2026-06-26"] },
  { id: 4, type: "supplement", name: "Multivitamin", dose: 1, unit: "tab", time: "08:00", slot: "AM", days: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
    purpose: "Daily baseline", durationDays: 30, startedDay: 4, color: "#2E9E6B", taken: true,
    log: ["2026-06-24","2026-06-25","2026-06-26","2026-06-27"] },
  { id: 5, type: "supplement", name: "Vitamin D3 + K2", dose: 5000, unit: "IU", time: "08:00", slot: "AM", days: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
    purpose: "Low D — flagged in bloodwork", durationDays: 90, startedDay: 10, color: "#D89A2B", taken: false,
    log: ["2026-06-20","2026-06-21","2026-06-22","2026-06-23","2026-06-24","2026-06-25","2026-06-26"] },
  { id: 6, type: "supplement", name: "Magnesium glycinate", dose: 400, unit: "mg", time: "22:30", slot: "PM", days: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
    purpose: "Sleep / recovery", durationDays: 30, startedDay: 2, color: "#8C6BD0", taken: false,
    log: ["2026-06-25","2026-06-26"] },
];

// Completed protocols — kept as a dated historical record
const initialArchive = [
  { id: 101, type: "peptide", name: "CJC-1295", dose: 100, unit: "mcg", time: "22:30", slot: "PM",
    purpose: "GH support", durationDays: 28, startDate: "2026-04-01", endDate: "2026-04-28",
    dosesLogged: 12, dosesPlanned: 12, color: "#D89A2B" },
  { id: 102, type: "supplement", name: "Zinc", dose: 30, unit: "mg", time: "08:00", slot: "AM",
    purpose: "Immune support", durationDays: 60, startDate: "2026-02-15", endDate: "2026-04-15",
    dosesLogged: 54, dosesPlanned: 60, color: "#2E9E6B" },
];

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
  const [protocols, setProtocols] = useState(initialProtocols);
  const [archive, setArchive] = useState(initialArchive);
  const tabs = ["Overview", "Nutrition", "Training", "Protocols", "Bloodwork"];

  return (
    <div style={{ background: C.panel, minHeight: "100vh", fontFamily: FONT_BODY, color: C.ink }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet" />
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
            <span style={{ font: `400 12px/1 ${FONT_MONO}`, color: C.mute }}>{today.date}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, font: `500 12px ${FONT_BODY}`, color: C.teal }}>
            <Watch size={15} /> Garmin · synced 9m ago
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
          {tab === "Protocols" && <Protocols protocols={protocols} setProtocols={setProtocols} archive={archive} setArchive={setArchive} />}
        </main>
      </div>
    </div>
  );
}

// ---------- OVERVIEW ----------
function Overview() {
  const net = today.caloriesIn - today.caloriesOut;
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
          <span><Utensils size={13} style={{ verticalAlign: -2 }} /> In {today.caloriesIn.toLocaleString()}</span>
          <span><Flame size={13} style={{ verticalAlign: -2 }} /> Out {today.caloriesOut.toLocaleString()}</span>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,.12)", borderRadius: 99, marginTop: 18, overflow: "hidden" }}>
          <div style={{ width: `${(today.caloriesIn / today.caloriesOut) * 100}%`, height: "100%",
            background: `linear-gradient(90deg, ${C.coral}, #F0A58E)`, borderRadius: 99 }} />
        </div>
      </Card>

      {/* Ring row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
        <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Ring value={today.steps} target={today.stepsTarget} color={C.teal}>
            <div>
              <div style={{ font: `700 18px ${FONT_DISPLAY}` }}>{(today.steps / 1000).toFixed(1)}k</div>
              <div style={{ font: `400 10px ${FONT_MONO}`, color: C.mute }}>steps</div>
            </div>
          </Ring>
          <Eyebrow>Movement</Eyebrow>
        </Card>
        <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Ring value={today.caloriesIn} target={today.caloriesTarget} color={C.coral}>
            <div>
              <div style={{ font: `700 18px ${FONT_DISPLAY}` }}>{today.caloriesIn}</div>
              <div style={{ font: `400 10px ${FONT_MONO}`, color: C.mute }}>/ {today.caloriesTarget}</div>
            </div>
          </Ring>
          <Eyebrow>Intake</Eyebrow>
        </Card>
        <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Ring value={today.water} target={today.waterTarget} color="#3B9BD0">
            <div>
              <div style={{ font: `700 18px ${FONT_DISPLAY}` }}>{today.water}L</div>
              <div style={{ font: `400 10px ${FONT_MONO}`, color: C.mute }}>/ {today.waterTarget}L</div>
            </div>
          </Ring>
          <Eyebrow>Hydration</Eyebrow>
        </Card>
        <Card style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Heart size={18} color={C.coral} />
            <div><div style={{ font: `700 18px ${FONT_DISPLAY}` }}>{today.resting}</div>
              <div style={{ font: `400 10px ${FONT_MONO}`, color: C.mute }}>resting bpm</div></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Moon size={18} color={C.teal} />
            <div><div style={{ font: `700 18px ${FONT_DISPLAY}` }}>{today.sleep}h</div>
              <div style={{ font: `400 10px ${FONT_MONO}`, color: C.mute }}>sleep</div></div>
          </div>
        </Card>
      </div>

      {/* Weekly energy + blood flag */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }} className="ov-split">
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <Eyebrow>Energy · 7 days</Eyebrow>
            <span style={{ font: `400 11px ${FONT_MONO}`, color: C.mute }}>in vs out</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={weekEnergy} margin={{ left: -20, right: 4 }}>
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

        <Card style={{ borderColor: C.coralSoft, background: C.coralSoft }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={16} color={C.coral} />
            <Eyebrow>Needs attention</Eyebrow>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ font: `700 17px ${FONT_DISPLAY}` }}>LDL cholesterol</div>
            <div style={{ font: `700 32px/1.1 ${FONT_DISPLAY}`, color: C.coral, marginTop: 4 }}>138
              <span style={{ font: `400 13px ${FONT_MONO}`, color: C.mute }}> mg/dL</span></div>
            <div style={{ font: `400 12px ${FONT_BODY}`, color: C.ink, marginTop: 8, lineHeight: 1.5 }}>
              8 points above range, trending up across your last 5 panels. CRP also elevated.
            </div>
          </div>
          <Sparkline data={[122, 128, 131, 135, 138]} color={C.coral} />
        </Card>
      </div>
    </div>
  );
}

// ---------- BLOODWORK ----------
function Bloodwork() {
  const [panels, setPanels] = useState(bloodPanels);
  const [expanded, setExpanded] = useState("LDL"); // marker key whose graph is open
  const [scan, setScan] = useState({ status: "idle", count: 0 }); // idle | reading | done
  const [showForm, setShowForm] = useState(false);
  const [editKey, setEditKey] = useState(null);
  const fileRef = React.useRef(null);

  const PANEL_NAMES = bloodPanels.map((p) => p.panel);
  const blank = { key: "", value: "", unit: "", low: "", high: "", panel: PANEL_NAMES[0] };
  const [draft, setDraft] = useState(blank);

  const allMarkers = panels.flatMap((p) => p.markers.map((m) => ({ ...m, panel: p.panel, status: markerStatus(m) })));
  const flagged = allMarkers.filter((m) => m.status !== "ok");

  // Simulated lab extraction — production posts the PDF/photo to an OCR + parser
  function onPickLab(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setScan({ status: "reading", count: 0 });
    setTimeout(() => setScan({ status: "done", count: allMarkers.length }), 1900);
  }

  function openAdd() { setEditKey(null); setDraft(blank); setShowForm(true); }
  function openEdit(m) {
    setEditKey(m.key);
    setDraft({ key: m.key, value: String(m.value), unit: m.unit, low: String(m.low), high: String(m.high), panel: m.panel });
    setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditKey(null); setDraft(blank); }

  function saveMarker() {
    if (!draft.key || draft.value === "" || !draft.unit) return;
    const val = parseFloat(draft.value);
    const low = draft.low === "" ? 0 : parseFloat(draft.low);
    const high = draft.high === "" ? Infinity : parseFloat(draft.high);
    setPanels((ps) => {
      // remove existing entry with this key (in case panel changed or editing)
      const cleaned = ps.map((p) => ({ ...p, markers: p.markers.filter((m) => m.key !== (editKey || draft.key)) }));
      return cleaned.map((p) => p.panel === draft.panel
        ? { ...p, markers: [...p.markers, { key: draft.key, value: val, unit: draft.unit, low, high,
            history: (editKey ? (ps.flatMap((x) => x.markers).find((m) => m.key === editKey)?.history.slice(0, -1) || []) : []).concat(val) }] }
        : p);
    });
    setExpanded(draft.key);
    closeForm();
  }

  const inputStyle = { font: `400 14px ${FONT_BODY}`, padding: "10px 12px",
    border: `1px solid ${C.line}`, borderRadius: 10, background: C.bg, color: C.ink, width: "100%", boxSizing: "border-box" };

  function TrendGraph({ m }) {
    const status = markerStatus(m);
    const data = m.history.map((v, i) => ({ date: bloodDates[i], v }));
    const stroke = status === "ok" ? C.teal : C.coral;
    const first = m.history[0], last = m.history[m.history.length - 1];
    const delta = last - first;
    const dir = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    return (
      <div style={{ marginTop: 12, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, font: `400 11px ${FONT_MONO}`, color: C.mute }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: stroke }}>
              {dir === "up" ? <TrendingUp size={13} /> : dir === "down" ? <TrendingDown size={13} /> : null}
              {dir !== "flat" ? `${delta > 0 ? "+" : ""}${Math.round(delta * 100) / 100} ${m.unit} over ${m.history.length} panels` : "stable"}
            </span>
          </div>
          <div style={{ font: `400 11px ${FONT_MONO}`, color: C.mute }}>
            range <span style={{ color: C.ink }}>{m.low}–{m.high === Infinity ? "∞" : m.high}</span>
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
      {/* Header: latest panel + actions */}
      <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <Eyebrow>Latest panel</Eyebrow>
          <div style={{ font: `700 20px ${FONT_DISPLAY}`, marginTop: 4 }}>{latestPanelDate}</div>
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
        <Card style={{ background: scan.status === "done" ? C.tealSoft : C.bg, borderColor: scan.status === "done" ? C.teal : C.line,
          display: "flex", alignItems: "center", gap: 14 }}>
          {scan.status === "reading" ? (
            <>
              <div style={{ width: 20, height: 20, border: `2px solid ${C.line}`, borderTopColor: C.teal, borderRadius: 99, animation: "vspin 0.7s linear infinite" }} />
              <div>
                <div style={{ font: `600 14px ${FONT_BODY}` }}>Reading your lab report…</div>
                <div style={{ font: `400 12px ${FONT_MONO}`, color: C.mute }}>Extracting markers, values and reference ranges</div>
              </div>
            </>
          ) : (
            <>
              <Check size={20} color={C.teal} />
              <div style={{ flex: 1 }}>
                <div style={{ font: `600 14px ${FONT_BODY}`, color: C.teal }}>Lab parsed — {scan.count} markers found</div>
                <div style={{ font: `400 12px ${FONT_BODY}`, color: C.mute }}>
                  In the live app each value appends to its timeline as a new dated panel. Review below.
                </div>
              </div>
              <button onClick={() => setScan({ status: "idle", count: 0 })}
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
                {PANEL_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
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
                <span style={{ font: `600 13px ${FONT_DISPLAY}`, color: C.coral }}>{m.value}{m.value > m.high ? " ↑" : " ↓"}</span>
              </button>
            ))}
          </div>
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
                    <span style={{ font: `700 16px ${FONT_DISPLAY}`, color: flag ? C.coral : C.ink }}>
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
        appending each as a new dated panel — so your timeline builds itself over time.
      </div>
    </div>
  );
}

// ---------- NUTRITION ----------
function Nutrition() {
  const total = meals.reduce((s, m) => s + m.kcal, 0);
  const macros = meals.reduce((a, m) => ({ p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }), { p: 0, c: 0, f: 0 });
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
        <button style={{ appearance: "none", border: "none", cursor: "pointer", background: C.teal, color: "#fff",
          font: `600 13px ${FONT_BODY}`, padding: "11px 18px", borderRadius: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={15} /> Add photo
        </button>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }} className="nut-split">
        {/* Meal log */}
        <Card>
          <Eyebrow>Today · {meals.length} meals · {total} kcal</Eyebrow>
          <div style={{ marginTop: 14, display: "grid", gap: 4 }}>
            {meals.map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0",
                borderBottom: i < meals.length - 1 ? `1px solid ${C.line}` : "none" }}>
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
                    color: m.conf > 0.9 ? C.teal : C.amber, display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                    <Check size={10} /> {Math.round(m.conf * 100)}%
                  </div>
                </div>
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
                    <div style={{ width: `${(g / sum) * 100}%`, height: "100%", background: col, borderRadius: 99 }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 22, padding: 14, background: C.panel, borderRadius: 12,
            font: `400 12px ${FONT_BODY}`, color: C.mute, lineHeight: 1.5 }}>
            Confidence below 85% is flagged amber — tap any meal to correct the AI's estimate.
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
function Protocols({ protocols, setProtocols, archive, setArchive }) {
  const todayIdx = 5; // Saturday, matches today.date
  const todayName = DAYS[todayIdx];
  const TODAY_ISO = "2026-06-27";
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = adding; number = editing that protocol
  const [view, setView] = useState("active"); // active | archive
  const [menuFor, setMenuFor] = useState(null); // protocol id whose ⋯ menu is open
  const blank = { type: "peptide", name: "", dose: "", unit: "mcg", time: "08:00", slot: "AM", purpose: "", durationDays: "", days: [] };
  const [draft, setDraft] = useState(blank);
  const [scan, setScan] = useState({ status: "idle", preview: null, detectedType: null });
  const fileRef = React.useRef(null);

  const SAMPLE_READS = [
    { type: "peptide", name: "BPC-157", dose: 250, unit: "mcg", purpose: "Recovery / gut", durationDays: 28, slot: "AM" },
    { type: "peptide", name: "Ipamorelin", dose: 300, unit: "mcg", purpose: "GH support / sleep", durationDays: 56, slot: "PM" },
    { type: "peptide", name: "TB-500", dose: 2.5, unit: "mg", purpose: "Tissue repair", durationDays: 42, slot: "AM" },
    { type: "supplement", name: "Multivitamin", dose: 1, unit: "tab", purpose: "Daily baseline", durationDays: 30, slot: "AM" },
    { type: "supplement", name: "Vitamin D3 + K2", dose: 5000, unit: "IU", purpose: "Bone / immune", durationDays: 90, slot: "AM" },
    { type: "supplement", name: "Omega-3", dose: 1000, unit: "mg", purpose: "Heart / inflammation", durationDays: 60, slot: "AM" },
  ];

  function onPickPhoto(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setScan({ status: "reading", preview: url, detectedType: null });
    setEditingId(null);
    setShowForm(true);
    setTimeout(() => {
      const read = SAMPLE_READS[Math.floor(Math.random() * SAMPLE_READS.length)];
      setDraft((dr) => ({ ...dr, type: read.type, name: read.name, dose: String(read.dose),
        unit: read.unit, purpose: read.purpose, durationDays: String(read.durationDays), slot: read.slot }));
      setScan({ status: "done", preview: url, detectedType: read.type });
    }, 1600);
  }

  const active = protocols;
  const slots = { AM: active.filter((p) => p.slot === "AM"), PM: active.filter((p) => p.slot === "PM") };
  const todayDoses = active.filter((p) => p.days.includes(todayName));
  const takenCount = todayDoses.filter((p) => (p.log || []).includes(TODAY_ISO)).length;

  // Mark / unmark today's dose on a protocol; keeps a dated log for adherence
  function toggleToday(id) {
    setProtocols((ps) => ps.map((p) => {
      if (p.id !== id) return p;
      const log = p.log || [];
      const has = log.includes(TODAY_ISO);
      return { ...p, taken: !has, log: has ? log.filter((d) => d !== TODAY_ISO) : [...log, TODAY_ISO] };
    }));
  }

  function toggleDraftDay(d) {
    setDraft((dr) => ({ ...dr, days: dr.days.includes(d) ? dr.days.filter((x) => x !== d) : [...dr.days, d] }));
  }

  function openAdd() { setEditingId(null); setDraft(blank); setScan({ status: "idle", preview: null, detectedType: null }); setShowForm(true); }
  function openEdit(p) {
    setEditingId(p.id);
    setDraft({ type: p.type, name: p.name, dose: String(p.dose), unit: p.unit, time: p.time,
      slot: p.slot || "AM", purpose: p.purpose === "—" ? "" : p.purpose, durationDays: p.durationDays ? String(p.durationDays) : "", days: p.days });
    setScan({ status: "idle", preview: null, detectedType: null });
    setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditingId(null); setDraft(blank); setScan({ status: "idle", preview: null, detectedType: null }); }

  function save() {
    if (!draft.name || !draft.dose || draft.days.length === 0) return;
    const peptidePalette = ["#0E6E66", "#3B9BD0", "#8C6BD0", "#D89A2B", "#E8674C"];
    const supplementPalette = ["#2E9E6B", "#D89A2B", "#8C6BD0", "#3B9BD0", "#E8674C"];
    const palette = draft.type === "supplement" ? supplementPalette : peptidePalette;
    if (editingId != null) {
      setProtocols((ps) => ps.map((p) => p.id === editingId ? {
        ...p, type: draft.type, name: draft.name, dose: parseFloat(draft.dose), unit: draft.unit,
        time: draft.time, slot: draft.slot, days: draft.days, purpose: draft.purpose || "—",
        durationDays: draft.durationDays ? parseInt(draft.durationDays, 10) : null,
      } : p));
    } else {
      setProtocols((ps) => [...ps, {
        id: Date.now(), type: draft.type, name: draft.name, dose: parseFloat(draft.dose), unit: draft.unit,
        time: draft.time, slot: draft.slot, days: draft.days, purpose: draft.purpose || "—",
        durationDays: draft.durationDays ? parseInt(draft.durationDays, 10) : null, startedDay: todayIdx,
        color: palette[ps.length % palette.length], taken: false, log: [],
      }]);
    }
    closeForm();
  }

  // Move an active protocol into the dated archive
  function completeProtocol(id) {
    const p = protocols.find((x) => x.id === id);
    if (!p) return;
    const elapsed = p.startedDay != null ? p.startedDay : (p.log || []).length;
    const start = new Date(TODAY_ISO); start.setDate(start.getDate() - elapsed);
    const dosesPlanned = p.durationDays ? Math.round((p.durationDays / 7) * p.days.length) : (p.log || []).length;
    setArchive((ar) => [{
      id: p.id, type: p.type, name: p.name, dose: p.dose, unit: p.unit, time: p.time, slot: p.slot,
      purpose: p.purpose, durationDays: p.durationDays,
      startDate: start.toISOString().slice(0, 10), endDate: TODAY_ISO,
      dosesLogged: (p.log || []).length, dosesPlanned: Math.max(dosesPlanned, (p.log || []).length), color: p.color,
    }, ...ar]);
    setProtocols((ps) => ps.filter((x) => x.id !== id));
  }

  // Restart an archived protocol back into the active list
  function restartFromArchive(a) {
    setProtocols((ps) => [...ps, {
      id: Date.now(), type: a.type, name: a.name, dose: a.dose, unit: a.unit, time: a.time, slot: a.slot || "AM",
      days: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], purpose: a.purpose,
      durationDays: a.durationDays, startedDay: 0, color: a.color, taken: false, log: [],
    }]);
    setView("active");
  }
  function deleteArchived(id) { setArchive((ar) => ar.filter((a) => a.id !== id)); }

  const inputStyle = { font: `400 14px ${FONT_BODY}`, padding: "10px 12px",
    border: `1px solid ${C.line}`, borderRadius: 10, background: C.bg, color: C.ink, width: "100%", boxSizing: "border-box" };

  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
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
                    background: scan.status === "done" ? C.tealSoft : C.bg, border: `1px solid ${scan.status === "done" ? C.teal : C.line}`,
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

          {/* Protocol cards — daily check, edit, complete */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            {protocols.map((p) => {
              const done = (p.log || []).includes(TODAY_ISO);
              const scheduledToday = p.days.includes(todayName);
              const elapsed = Math.max(0, Math.min(p.durationDays || 0, p.startedDay != null ? p.startedDay : 0));
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
            Check off each dose as you take it — Vitae logs the date so your adherence builds a record. When a protocol finishes its
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
                      <div style={{ font: `600 13px ${FONT_BODY}`, marginTop: 2 }}>{fmtDate(a.startDate)} – {fmtDate(a.endDate)}</div>
                    </div>
                    <div>
                      <div style={{ font: `400 9px ${FONT_MONO}`, color: C.mute, textTransform: "uppercase", letterSpacing: "0.08em" }}>Adherence</div>
                      <div style={{ font: `600 14px ${FONT_BODY}`, marginTop: 2, color: a.color }}>{a.dosesLogged}/{a.dosesPlanned} doses</div>
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
