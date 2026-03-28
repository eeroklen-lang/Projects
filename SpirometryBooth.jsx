import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, ReferenceLine,
} from "recharts";

// ─── Data helpers ───────────────────────────────────────────────────────────

const generateFlowVolumeCurve = (fvc = 3.82, pef = 7.4, peakV = 0.12) => {
  const pts = [];
  const steps = Math.ceil(fvc / 0.05);
  for (let i = 0; i <= steps; i++) {
    const v = parseFloat((i * 0.05).toFixed(2));
    let flow;
    if (v <= peakV) {
      flow = (v / peakV) * pef;
    } else if (v <= fvc) {
      flow = pef * (fvc - v) / (fvc - peakV);
    } else {
      flow = 0;
    }
    pts.push({ volume: v, flow: Math.max(0, parseFloat(flow.toFixed(2))) });
  }
  return pts;
};

const FULL_CURVE = generateFlowVolumeCurve();

const MOCK_RESULTS = {
  fvc: 3.82, fvcPred: 4.10, fvcPct: 93,
  fev1: 2.91, fev1Pred: 3.20, fev1Pct: 91,
  fev1Fvc: 76, pef: 7.4,
  pattern: "Normal",
  severity: null,
  confidence: 94,
  interpretation:
    "Lung function is within normal limits. No evidence of airflow obstruction or restrictive pattern. FEV1/FVC ratio of 76% is normal and indicates adequate airway patency. Expiratory flow contour is smooth with an expected peak-flow trajectory.",
  recommendation:
    "No immediate clinical intervention required. Continue current management. Recommend routine repeat spirometry in 12 months or sooner if symptoms develop.",
};

const ANALYSIS_STEPS = [
  "Loading waveform data…",
  "Extracting spirometric parameters…",
  "Comparing against age/sex/height norms…",
  "Running AI pattern classification…",
  "Generating clinical interpretation…",
];

const STEPS = ["Scan ID", "Measure", "Check-in", "Instructions", "Test", "Analysis", "Results"];

// ─── Colours / theme ─────────────────────────────────────────────────────────

const C = {
  navy: "#1e3a5f",
  blue: "#2563eb",
  blueLight: "#eff6ff",
  green: "#16a34a",
  greenLight: "#f0fdf4",
  yellow: "#ca8a04",
  yellowLight: "#fefce8",
  red: "#dc2626",
  redLight: "#fef2f2",
  slate: "#64748b",
  border: "#e2e8f0",
  bg: "#f1f5f9",
  white: "#ffffff",
  text: "#0f172a",
};

// ─── Shared UI primitives ────────────────────────────────────────────────────

const Card = ({ children, style = {} }) => (
  <div style={{
    background: C.white, borderRadius: 16, boxShadow: "0 2px 16px rgba(0,0,0,.08)",
    padding: 40, ...style,
  }}>
    {children}
  </div>
);

const Btn = ({ children, onClick, variant = "primary", style = {}, disabled = false }) => {
  const base = {
    padding: "14px 32px", borderRadius: 10, border: "none", cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 600, fontSize: 16, transition: "opacity .15s", opacity: disabled ? .45 : 1, ...style,
  };
  const variants = {
    primary: { background: C.blue, color: "#fff" },
    outline: { background: "transparent", color: C.blue, border: `2px solid ${C.blue}` },
    ghost:   { background: C.bg, color: C.text },
    success: { background: C.green, color: "#fff" },
  };
  return (
    <button style={{ ...base, ...variants[variant] }} onClick={disabled ? undefined : onClick}>
      {children}
    </button>
  );
};

const MetricCard = ({ label, value, unit, predicted, pct, status }) => {
  const color = pct >= 80 ? C.green : pct >= 60 ? C.yellow : C.red;
  const bg    = pct >= 80 ? C.greenLight : pct >= 60 ? C.yellowLight : C.redLight;
  return (
    <div style={{ background: bg, borderRadius: 12, padding: "20px 24px", flex: 1, minWidth: 140 }}>
      <div style={{ color: C.slate, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5 }}>{label}</div>
      <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 32, fontWeight: 700, color }}>{value}</span>
        <span style={{ fontSize: 14, color: C.slate }}>{unit}</span>
      </div>
      {predicted && (
        <div style={{ marginTop: 4, fontSize: 13, color: C.slate }}>
          Predicted: {predicted} {unit} &nbsp;
          <span style={{ fontWeight: 700, color }}>{pct}%</span>
        </div>
      )}
    </div>
  );
};

const Tag = ({ label, color, bg }) => (
  <span style={{
    background: bg, color, borderRadius: 20, padding: "4px 14px",
    fontSize: 13, fontWeight: 600,
  }}>{label}</span>
);

// ─── Step 0 — Scan ID ────────────────────────────────────────────────────────

const SCAN_MOCK = {
  name: "Matti Virtanen",
  dob: "12 Mar 1971",
  age: "54",
  sex: "male",
  idNumber: "FI-284 7391-A",
  nationality: "Finnish",
};

function ScanID({ onComplete }) {
  const [phase, setPhase] = useState("idle"); // idle | scanning | done

  const handleScan = () => {
    setPhase("scanning");
    setTimeout(() => setPhase("done"), 3200);
  };

  return (
    <Card>
      <style>{`
        @keyframes scanLine {
          0%   { top: 0px; }
          50%  { top: calc(100% - 4px); }
          100% { top: 0px; }
        }
        @keyframes scannerGlow {
          0%, 100% { box-shadow: 0 0 0 3px rgba(37,99,235,0.15); }
          50%       { box-shadow: 0 0 0 6px rgba(37,99,235,0.30); }
        }
        @keyframes checkPop {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); }
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "#e0f2fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🪪</div>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Scan Your ID</h2>
          <p style={{ margin: 0, color: C.slate, fontSize: 14 }}>Place your identity card, passport, or Kela card face-up in the scanner</p>
        </div>
      </div>

      {/* Scanner viewport */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
        <div style={{
          position: "relative", width: 380, height: 240,
          background: phase === "done" ? C.greenLight : "#f8fafc",
          borderRadius: 18,
          border: `2px solid ${phase === "done" ? C.green : phase === "scanning" ? C.blue : C.border}`,
          overflow: "hidden",
          transition: "border-color .3s, background .3s",
          animation: phase === "scanning" ? "scannerGlow 1s ease-in-out infinite" : "none",
        }}>

          {/* Corner brackets */}
          {["topLeft","topRight","bottomLeft","bottomRight"].map(pos => {
            const isTop    = pos.startsWith("top");
            const isLeft   = pos.endsWith("Left");
            const color    = phase === "done" ? C.green : C.blue;
            return (
              <div key={pos} style={{
                position: "absolute",
                top:    isTop    ? 14 : "auto",
                bottom: !isTop   ? 14 : "auto",
                left:   isLeft   ? 14 : "auto",
                right:  !isLeft  ? 14 : "auto",
                width: 22, height: 22,
                borderTop:    isTop    ? `3px solid ${color}` : "none",
                borderBottom: !isTop   ? `3px solid ${color}` : "none",
                borderLeft:   isLeft   ? `3px solid ${color}` : "none",
                borderRight:  !isLeft  ? `3px solid ${color}` : "none",
                borderRadius: isTop && isLeft   ? "4px 0 0 0"
                            : isTop && !isLeft  ? "0 4px 0 0"
                            : !isTop && isLeft  ? "0 0 0 4px"
                            :                    "0 0 4px 0",
                transition: "border-color .3s",
              }} />
            );
          })}

          {/* Animated scan beam */}
          {phase === "scanning" && (
            <div style={{
              position: "absolute", left: 0, right: 0, height: 4,
              background: "linear-gradient(90deg, transparent 0%, rgba(37,99,235,0.6) 30%, #2563eb 50%, rgba(37,99,235,0.6) 70%, transparent 100%)",
              animation: "scanLine 1.1s ease-in-out infinite",
              boxShadow: "0 0 10px rgba(37,99,235,0.5)",
            }} />
          )}

          {/* Idle state */}
          {phase === "idle" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
              {/* Placeholder ID card */}
              <div style={{
                width: 220, height: 138, borderRadius: 10, border: `2px dashed ${C.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column", gap: 6, background: C.white,
              }}>
                <span style={{ fontSize: 34 }}>🪪</span>
                <span style={{ fontSize: 13, color: C.slate }}>ID card</span>
              </div>
            </div>
          )}

          {/* Scanning state */}
          {phase === "scanning" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, padding: 28, opacity: 0.5 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>👤</div>
              <div style={{ flex: 1 }}>
                <div style={{ height: 12, background: "#cbd5e1", borderRadius: 4, marginBottom: 8 }} />
                <div style={{ height: 10, background: "#e2e8f0", borderRadius: 4, marginBottom: 6, width: "70%" }} />
                <div style={{ height: 10, background: "#e2e8f0", borderRadius: 4, width: "50%" }} />
              </div>
            </div>
          )}

          {/* Done state — extracted data */}
          {phase === "done" && (
            <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "22px 28px", height: "100%" }}>
              {/* Photo placeholder */}
              <div style={{ width: 72, height: 88, borderRadius: 8, background: "#bbf7d0", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, border: `2px solid ${C.green}` }}>
                👤
              </div>
              {/* Extracted fields */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 19, color: C.text }}>{SCAN_MOCK.name}</div>
                <div style={{ color: C.slate, fontSize: 13, marginTop: 3 }}>Born: {SCAN_MOCK.dob} · {SCAN_MOCK.nationality}</div>
                <div style={{ color: C.slate, fontSize: 13, marginTop: 2 }}>ID: {SCAN_MOCK.idNumber}</div>
                <div style={{ marginTop: 10 }}>
                  <Tag label="✓ ID Verified" color={C.green} bg="#bbf7d0" />
                </div>
              </div>
              {/* Check badge */}
              <div style={{
                width: 40, height: 40, borderRadius: "50%", background: C.green,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 20, flexShrink: 0,
                animation: "checkPop .4s cubic-bezier(.34,1.56,.64,1)",
              }}>✓</div>
            </div>
          )}
        </div>
      </div>

      {/* Status message */}
      <div style={{ textAlign: "center", marginBottom: 24, minHeight: 24 }}>
        {phase === "idle"    && <span style={{ color: C.slate, fontSize: 14 }}>Align the card within the frame, then press <strong>Scan</strong></span>}
        {phase === "scanning" && <span style={{ color: C.blue, fontWeight: 600, fontSize: 14 }}>📡 Reading card… please hold still</span>}
        {phase === "done"    && <span style={{ color: C.green, fontWeight: 600, fontSize: 14 }}>✅ Scan successful — patient data extracted</span>}
      </div>

      {/* CTA */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        {phase === "idle" && (
          <>
            <Btn onClick={handleScan} style={{ fontSize: 17, padding: "15px 48px" }}>📷 Scan ID Card</Btn>
            <button
              onClick={() => onComplete(null)}
              style={{ background: "none", border: "none", color: C.slate, fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0 }}
            >
              Skip — I'll enter details manually
            </button>
          </>
        )}
        {phase === "scanning" && (
          <div style={{ height: 50, display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: "50%", background: C.blue,
                  animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
        {phase === "done" && (
          <Btn variant="success" onClick={() => onComplete(SCAN_MOCK)} style={{ fontSize: 17, padding: "15px 48px" }}>
            Confirm &amp; Continue →
          </Btn>
        )}
      </div>
    </Card>
  );
}

// ─── Step 1 — Measure height & weight ────────────────────────────────────────

// SVG arc helper for weight gauge
const arcPath = (cx, cy, r, startDeg, endDeg) => {
  const rad = d => (d - 90) * Math.PI / 180;
  const x1 = cx + r * Math.cos(rad(startDeg)), y1 = cy + r * Math.sin(rad(startDeg));
  const x2 = cx + r * Math.cos(rad(endDeg)),   y2 = cy + r * Math.sin(rad(endDeg));
  const large = (endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

function MeasureScreen({ targetHeight = 175, targetWeight = 82, onComplete }) {
  const [phase,      setPhase]      = useState("measuring"); // measuring | done
  const [animH,      setAnimH]      = useState(0);
  const [animW,      setAnimW]      = useState(0);
  const [scanY,      setScanY]      = useState(0);   // 0..1 beam position
  const [editH,      setEditH]      = useState(String(targetHeight));
  const [editW,      setEditW]      = useState(String(targetWeight));
  const [adjusting,  setAdjusting]  = useState(false);
  const timerRef = useRef(null);

  // Single animation loop: scan beam + count-up
  useEffect(() => {
    const DURATION = 3000, INTERVAL = 16;
    const steps = DURATION / INTERVAL;
    let s = 0;
    timerRef.current = setInterval(() => {
      s++;
      const t  = Math.min(s / steps, 1);
      const e  = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setScanY(e);                                          // beam travels top → head
      setAnimH(Math.round(targetHeight * e));
      setAnimW(parseFloat((targetWeight * e).toFixed(1)));
      if (s >= steps) {
        clearInterval(timerRef.current);
        setAnimH(targetHeight); setAnimW(targetWeight);
        setTimeout(() => { setPhase("done"); setEditH(String(targetHeight)); setEditW(String(targetWeight)); }, 400);
      }
    }, INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [targetHeight, targetWeight]);

  // ── Height SVG ──────────────────────────────────────────────────────────────
  const svgW = 180, svgH = 300;
  const rulerX = 100, rulerW = 20;
  const maxH = 220;
  // Head sits at ~10% from top of ruler zone → 90% of svgH
  const headFrac  = targetHeight / maxH;          // e.g. 175/220 ≈ 0.795
  const headY     = svgH * (1 - headFrac);        // px from top where head is
  const beamY     = headY + (svgH - headY) * (1 - Math.min(scanY / 0.85, 1)); // descends to headY
  const fillH     = svgH * (animH / maxH);        // height of filled bar

  const HeightViz = () => (
    <svg width={svgW} height={svgH} style={{ overflow: "visible" }}>
      {/* Ruler track */}
      <rect x={rulerX} y={0} width={rulerW} height={svgH} rx={6}
        fill="#f1f5f9" stroke={C.border} strokeWidth={1.5} />

      {/* Filled bar */}
      <rect x={rulerX} y={svgH - fillH} width={rulerW} height={fillH} rx={6}
        fill="url(#hGrad)" style={{ transition: "height .04s, y .04s" }} />

      <defs>
        <linearGradient id="hGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor={C.blue} />
        </linearGradient>
      </defs>

      {/* Tick marks + labels */}
      {[100, 120, 140, 160, 180, 200, 220].map(cm => {
        const y = svgH * (1 - cm / maxH);
        const isMajor = cm % 20 === 0;
        return (
          <g key={cm}>
            <line x1={rulerX - (isMajor ? 10 : 5)} y1={y} x2={rulerX} y2={y}
              stroke={isMajor ? "#94a3b8" : "#cbd5e1"} strokeWidth={isMajor ? 1.5 : 1} />
            {isMajor && (
              <text x={rulerX - 14} y={y + 4} textAnchor="end"
                fontSize={11} fill="#94a3b8">{cm}</text>
            )}
          </g>
        );
      })}

      {/* Person silhouette */}
      {/* Head */}
      <circle cx={rulerX - 38} cy={headY} r={18}
        fill={phase === "done" ? "#bfdbfe" : "#e2e8f0"} opacity={0.85} />
      {/* Body */}
      <rect x={rulerX - 50} y={headY + 18} width={24} height={svgH * 0.28} rx={6}
        fill={phase === "done" ? "#bfdbfe" : "#e2e8f0"} opacity={0.85} />
      {/* Left leg */}
      <rect x={rulerX - 50} y={headY + 18 + svgH * 0.28 - 4} width={10} height={svgH * 0.32} rx={4}
        fill={phase === "done" ? "#bfdbfe" : "#e2e8f0"} opacity={0.85} />
      {/* Right leg */}
      <rect x={rulerX - 38} y={headY + 18 + svgH * 0.28 - 4} width={10} height={svgH * 0.32} rx={4}
        fill={phase === "done" ? "#bfdbfe" : "#e2e8f0"} opacity={0.85} />

      {/* Scan beam (measuring phase) */}
      {phase === "measuring" && (
        <g>
          <line x1={rulerX - 70} y1={beamY} x2={rulerX + rulerW + 10} y2={beamY}
            stroke="#2563eb" strokeWidth={2.5} strokeOpacity={0.75}
            style={{ filter: "drop-shadow(0 0 4px #2563eb)" }} />
          {/* Beam end glow */}
          <circle cx={rulerX - 70} cy={beamY} r={4} fill={C.blue} opacity={0.6} />
        </g>
      )}

      {/* Measurement bracket (done phase) */}
      {phase === "done" && (
        <g>
          {/* Bracket line from head to floor */}
          <line x1={rulerX + rulerW + 12} y1={headY} x2={rulerX + rulerW + 12} y2={svgH}
            stroke={C.green} strokeWidth={2} />
          <line x1={rulerX + rulerW + 8}  y1={headY} x2={rulerX + rulerW + 16} y2={headY}
            stroke={C.green} strokeWidth={2} />
          <line x1={rulerX + rulerW + 8}  y1={svgH}  x2={rulerX + rulerW + 16} y2={svgH}
            stroke={C.green} strokeWidth={2} />
          {/* Value label */}
          <rect x={rulerX + rulerW + 18} y={svgH / 2 + headY / 2 - 16} width={64} height={32}
            rx={8} fill={C.green} />
          <text x={rulerX + rulerW + 50} y={svgH / 2 + headY / 2 + 6}
            textAnchor="middle" fontSize={16} fontWeight="700" fill="white">
            {animH} cm
          </text>
        </g>
      )}
    </svg>
  );

  // ── Weight SVG (arc gauge) ───────────────────────────────────────────────────
  const WGcx = 100, WGcy = 100, WGr = 72;
  const WG_START = 150, WG_SWEEP = 240, WG_MAX = 150;
  const wAngle  = WG_START + (animW / WG_MAX) * WG_SWEEP;
  const dotRad  = (d) => (d - 90) * Math.PI / 180;
  const dotX    = WGcx + WGr * Math.cos(dotRad(wAngle));
  const dotY    = WGcy + WGr * Math.sin(dotRad(wAngle));

  const WeightGauge = () => (
    <svg width={200} height={180} viewBox="0 0 200 180">
      {/* Tick marks around gauge */}
      {[0, 30, 60, 90, 120, 150].map(kg => {
        const a   = WG_START + (kg / WG_MAX) * WG_SWEEP;
        const r1  = WGr + 8, r2 = WGr + 16;
        const ra  = (a - 90) * Math.PI / 180;
        const x1  = WGcx + r1 * Math.cos(ra), y1 = WGcy + r1 * Math.sin(ra);
        const x2  = WGcx + r2 * Math.cos(ra), y2 = WGcy + r2 * Math.sin(ra);
        const tx  = WGcx + (r2 + 10) * Math.cos(ra);
        const ty  = WGcy + (r2 + 10) * Math.sin(ra);
        return (
          <g key={kg}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth={1.5} />
            <text x={tx} y={ty + 4} textAnchor="middle" fontSize={10} fill="#94a3b8">{kg}</text>
          </g>
        );
      })}

      {/* Background arc */}
      <path d={arcPath(WGcx, WGcy, WGr, WG_START, WG_START + WG_SWEEP)}
        fill="none" stroke="#e2e8f0" strokeWidth={14} strokeLinecap="round" />

      {/* Value arc */}
      {animW > 0 && (
        <path d={arcPath(WGcx, WGcy, WGr, WG_START, wAngle)}
          fill="none" stroke={phase === "done" ? C.blue : "#60a5fa"}
          strokeWidth={14} strokeLinecap="round" />
      )}

      {/* Moving dot */}
      {animW > 0 && (
        <circle cx={dotX} cy={dotY} r={9}
          fill={phase === "done" ? C.blue : "#93c5fd"}
          stroke="white" strokeWidth={2} />
      )}

      {/* Platform icon (scale base) */}
      <rect x={70} y={148} width={60} height={8} rx={4} fill="#e2e8f0" />
      <rect x={80} y={140} width={40} height={10} rx={3} fill="#f1f5f9" stroke={C.border} strokeWidth={1} />

      {/* Centre value */}
      <text x={WGcx} y={WGcy - 8} textAnchor="middle"
        fontSize={30} fontWeight="800" fill={phase === "done" ? C.blue : "#93c5fd"}>
        {animW.toFixed(1)}
      </text>
      <text x={WGcx} y={WGcy + 16} textAnchor="middle" fontSize={14} fill={C.slate}>kg</text>
    </svg>
  );

  // ── Adjust controls ──────────────────────────────────────────────────────────
  const Stepper = ({ label, unit, value, onChange, step }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.slate, textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 0, border: `2px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <button onClick={() => onChange(v => String(Math.max(0, parseFloat(v) - step)))}
          style={{ width: 44, height: 48, border: "none", background: C.bg, fontSize: 22, cursor: "pointer", color: C.blue, fontWeight: 700 }}>−</button>
        <input
          type="number" value={value}
          onChange={e => onChange(() => e.target.value)}
          style={{ width: 80, height: 48, border: "none", textAlign: "center", fontSize: 20, fontWeight: 700, color: C.text, outline: "none" }}
        />
        <button onClick={() => onChange(v => String(parseFloat(v) + step))}
          style={{ width: 44, height: 48, border: "none", background: C.bg, fontSize: 22, cursor: "pointer", color: C.blue, fontWeight: 700 }}>+</button>
      </div>
      <div style={{ fontSize: 14, color: C.slate }}>{unit}</div>
    </div>
  );

  return (
    <Card>
      <style>{`
        @keyframes fadeSlideIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📐</div>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Height &amp; Weight Measurement</h2>
          <p style={{ margin: 0, color: C.slate, fontSize: 14 }}>
            {phase === "measuring" ? "Please stand upright on the platform — booth sensors are measuring…" : "Measurement complete — please confirm your readings below"}
          </p>
        </div>
        {phase === "done" && !adjusting && <Tag label="✓ Measured" color={C.green} bg={C.greenLight} />}
      </div>

      {/* Visualizations */}
      <div style={{ display: "flex", justifyContent: "center", gap: 60, marginBottom: 32, alignItems: "flex-start" }}>

        {/* Height */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.slate, textTransform: "uppercase", letterSpacing: .5 }}>Height</div>
          <HeightViz />
          {phase === "measuring" && (
            <div style={{ fontSize: 18, fontWeight: 700, color: C.blue }}>{animH} cm</div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, alignSelf: "stretch", background: C.border, marginTop: 24 }} />

        {/* Weight */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.slate, textTransform: "uppercase", letterSpacing: .5 }}>Weight</div>
          <div style={{ position: "relative" }}>
            <WeightGauge />
            {phase === "measuring" && (
              <div style={{ position: "absolute", bottom: -4, left: 0, right: 0, textAlign: "center", fontSize: 13, color: C.slate }}>
                Calculating…
              </div>
            )}
          </div>
          {phase === "measuring" && <div style={{ height: 20 }} />}
        </div>
      </div>

      {/* Done: summary + actions */}
      {phase === "done" && (
        <div style={{ animation: "fadeSlideIn .4s ease" }}>

          {/* Summary cards */}
          {!adjusting && (
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 28 }}>
              <div style={{ background: C.blueLight, borderRadius: 14, padding: "18px 32px", textAlign: "center", minWidth: 140 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e40af", textTransform: "uppercase" }}>Height</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: C.blue, marginTop: 4 }}>{editH}</div>
                <div style={{ fontSize: 14, color: "#1e40af" }}>cm</div>
              </div>
              <div style={{ background: C.blueLight, borderRadius: 14, padding: "18px 32px", textAlign: "center", minWidth: 140 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e40af", textTransform: "uppercase" }}>Weight</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: C.blue, marginTop: 4 }}>{editW}</div>
                <div style={{ fontSize: 14, color: "#1e40af" }}>kg</div>
              </div>
            </div>
          )}

          {/* Adjust steppers */}
          {adjusting && (
            <div style={{ display: "flex", gap: 48, justifyContent: "center", marginBottom: 28, padding: "24px 0", background: C.bg, borderRadius: 14 }}>
              <Stepper label="Height" unit="cm" value={editH} onChange={setEditH} step={1} />
              <Stepper label="Weight" unit="kg"  value={editW} onChange={setEditW} step={0.5} />
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "center", gap: 14 }}>
            {!adjusting ? (
              <>
                <Btn variant="outline" onClick={() => setAdjusting(true)}>✏️ Adjust</Btn>
                <Btn variant="success" onClick={() => onComplete({ height: editH, weight: editW })}>
                  Confirm &amp; Continue →
                </Btn>
              </>
            ) : (
              <>
                <Btn variant="ghost" onClick={() => setAdjusting(false)}>Cancel</Btn>
                <Btn onClick={() => { setAdjusting(false); }}>Save Adjustments</Btn>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Step 2 — Check-in ───────────────────────────────────────────────────────

function CheckIn({ patient, setPatient, onNext }) {
  const field = (label, key, type = "text", opts = null) => (
    <div style={{ flex: 1, minWidth: 180 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.slate, marginBottom: 6 }}>
        {label}
      </label>
      {opts ? (
        <select
          value={patient[key]}
          onChange={e => setPatient(p => ({ ...p, [key]: e.target.value }))}
          style={inputStyle}
        >
          {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input
          type={type}
          value={patient[key]}
          onChange={e => setPatient(p => ({ ...p, [key]: e.target.value }))}
          style={inputStyle}
        />
      )}
    </div>
  );

  const valid = patient.name && patient.age && patient.height && patient.weight;

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: C.blueLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>👤</div>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Confirm Patient Details</h2>
          <p style={{ margin: 0, color: C.slate, fontSize: 14 }}>Review pre-filled data and add height &amp; weight for predicted values</p>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 28 }}>
        {field("Full Name", "name")}
        {field("Age (years)", "age", "number")}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 36 }}>
        {field("Height (cm)", "height", "number")}
        {field("Weight (kg)", "weight", "number")}
        {field("Biological Sex", "sex", "select", [
          { value: "male", label: "Male" },
          { value: "female", label: "Female" },
        ])}
      </div>

      <div style={{ padding: "16px 20px", background: C.blueLight, borderRadius: 10, marginBottom: 32, fontSize: 14, color: "#1e40af" }}>
        ℹ️  Predicted values are calculated using the GLI-2012 reference equations based on age, height, and biological sex.
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Btn onClick={onNext} disabled={!valid}>Continue to Instructions →</Btn>
      </div>
    </Card>
  );
}

const inputStyle = {
  width: "100%", padding: "12px 14px", borderRadius: 8, border: `1.5px solid ${C.border}`,
  fontSize: 16, outline: "none", boxSizing: "border-box", color: C.text, background: C.white,
};

// ─── Step 1 — Instructions ───────────────────────────────────────────────────

function Instructions({ onNext }) {
  const steps = [
    { icon: "🪑", title: "Sit upright", body: "Sit with your back straight and feet flat on the floor. Loosen any tight clothing." },
    { icon: "🫁", title: "Breathe in fully", body: "When prompted, take the deepest breath you possibly can — fill your lungs completely." },
    { icon: "💨", title: "Blast the air out", body: "Place the mouthpiece firmly in your mouth and exhale as hard and fast as you can until your lungs are completely empty." },
    { icon: "⏱️", title: "Keep blowing", body: "Continue blowing for at least 6 seconds, even when it feels like there is no air left." },
  ];

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📋</div>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Test Instructions</h2>
          <p style={{ margin: 0, color: C.slate, fontSize: 14 }}>Please read and follow these steps carefully</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ padding: "20px 24px", background: C.bg, borderRadius: 12, display: "flex", gap: 16 }}>
            <span style={{ fontSize: 28 }}>{s.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{i + 1}. {s.title}</div>
              <div style={{ color: C.slate, fontSize: 14, lineHeight: 1.5 }}>{s.body}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: "16px 20px", background: "#fef9c3", borderRadius: 10, marginBottom: 32, fontSize: 14, color: "#713f12" }}>
        ⚠️ The test may cause brief dizziness. If you feel unwell at any point, stop immediately and notify the booth attendant.
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Btn onClick={onNext}>I'm Ready — Start Test →</Btn>
      </div>
    </Card>
  );
}

// ─── Step 2 — Test ───────────────────────────────────────────────────────────

function TestScreen({ testPhase, countdown, curveData, onStart, onRetry, onNext }) {
  const volumePct = curveData.length
    ? Math.round((curveData[curveData.length - 1].volume / 3.82) * 100)
    : 0;

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🫁</div>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Spirometry Test</h2>
          <p style={{ margin: 0, color: C.slate, fontSize: 14 }}>Live flow-volume curve</p>
        </div>
        {testPhase === "done" && (
          <Tag label="✓ Test Complete" color={C.green} bg={C.greenLight} />
        )}
      </div>

      {/* Graph */}
      <div style={{ height: 260, marginBottom: 20 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={testPhase === "done" ? FULL_CURVE : curveData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="flowGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.blue} stopOpacity={0.3} />
                <stop offset="95%" stopColor={C.blue} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="volume" type="number" domain={[0, 4.2]} tickCount={8}
              label={{ value: "Volume (L)", position: "insideBottom", offset: -2, fontSize: 12, fill: C.slate }} />
            <YAxis domain={[0, 9]} tickCount={6}
              label={{ value: "Flow (L/s)", angle: -90, position: "insideLeft", offset: 10, fontSize: 12, fill: C.slate }} />
            <Tooltip formatter={(v, n) => [v, n === "flow" ? "Flow (L/s)" : "Vol (L)"]}
              labelFormatter={v => `Volume: ${v} L`} />
            <ReferenceLine x={0.12} stroke={C.yellow} strokeDasharray="4 3"
              label={{ value: "PEF", position: "top", fontSize: 11, fill: C.yellow }} />
            <Area type="monotone" dataKey="flow" stroke={C.blue} strokeWidth={2.5}
              fill="url(#flowGrad)" dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Inline stats while blowing */}
      {(testPhase === "blow" || testPhase === "done") && (
        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <div style={{ flex: 1, background: C.bg, borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ fontSize: 12, color: C.slate, fontWeight: 600 }}>VOLUME EXHALED</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.blue }}>
              {curveData.length ? curveData[curveData.length - 1].volume.toFixed(2) : "0.00"}
              <span style={{ fontSize: 14, fontWeight: 400, color: C.slate }}> L</span>
            </div>
            <div style={{ marginTop: 6, height: 6, background: "#e2e8f0", borderRadius: 4 }}>
              <div style={{ height: 6, background: C.blue, borderRadius: 4, width: `${volumePct}%`, transition: "width .1s" }} />
            </div>
          </div>
          <div style={{ flex: 1, background: C.bg, borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ fontSize: 12, color: C.slate, fontWeight: 600 }}>PEAK FLOW</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: testPhase === "done" ? C.green : C.blue }}>
              7.4 <span style={{ fontSize: 14, fontWeight: 400, color: C.slate }}>L/s</span>
            </div>
          </div>
          <div style={{ flex: 1, background: C.bg, borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ fontSize: 12, color: C.slate, fontWeight: 600 }}>STATUS</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6, color: testPhase === "done" ? C.green : C.blue }}>
              {testPhase === "blow" ? "🟢 Blowing…" : "✅ Good effort!"}
            </div>
          </div>
        </div>
      )}

      {/* CTA area */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {testPhase === "ready" && (
          <div style={{ width: "100%", textAlign: "center" }}>
            <p style={{ color: C.slate, marginBottom: 20 }}>
              When you are ready, pick up the mouthpiece, take the deepest breath you can, and press <strong>Start Manoeuvre</strong>.
            </p>
            <Btn onClick={onStart} style={{ fontSize: 18, padding: "16px 48px" }}>▶ Start Manoeuvre</Btn>
          </div>
        )}
        {testPhase === "countdown" && (
          <div style={{ width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 80, fontWeight: 800, color: C.blue, lineHeight: 1 }}>{countdown}</div>
            <div style={{ fontSize: 22, color: C.slate, marginTop: 8 }}>Get ready to BLOW…</div>
          </div>
        )}
        {testPhase === "blow" && (
          <div style={{ width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.blue }}>💨 KEEP BLOWING!</div>
            <div style={{ color: C.slate, marginTop: 4 }}>Exhale as hard and fast as possible</div>
          </div>
        )}
        {testPhase === "done" && (
          <>
            <Btn variant="outline" onClick={onRetry}>↩ Retry Manoeuvre</Btn>
            <div style={{ color: C.slate, fontSize: 14 }}>Attempt 1 of 3</div>
            <Btn variant="success" onClick={onNext}>Accept & Analyse →</Btn>
          </>
        )}
      </div>
    </Card>
  );
}

// ─── Step 3 — AI Analysis ────────────────────────────────────────────────────

function AnalysisScreen({ progress, stepLabel, stepIdx, total }) {
  const checks = [
    "Waveform integrity validated",
    "Spirometric parameters extracted",
    "GLI-2012 reference norms applied",
    "Neural network inference complete",
    "Report generated",
  ];

  return (
    <Card style={{ textAlign: "center", padding: "60px 40px" }}>
      {/* Animated icon */}
      <div style={{
        width: 96, height: 96, borderRadius: "50%", background: C.blueLight, margin: "0 auto 32px",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44,
        boxShadow: `0 0 0 12px ${C.blueLight}`,
        animation: "pulse 1.6s ease-in-out infinite",
      }}>
        🤖
      </div>

      <h2 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 8px" }}>AI Analysis in Progress</h2>
      <p style={{ color: C.slate, fontSize: 15, margin: "0 0 36px" }}>
        Our clinical AI is analysing your spirometry data
      </p>

      {/* Progress bar */}
      <div style={{ maxWidth: 480, margin: "0 auto 12px" }}>
        <div style={{ height: 10, background: C.border, borderRadius: 8 }}>
          <div style={{
            height: 10, background: `linear-gradient(90deg, ${C.blue}, #60a5fa)`,
            borderRadius: 8, width: `${progress}%`, transition: "width .15s ease",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 13, color: C.slate }}>
          <span>{stepLabel}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Step checklist */}
      <div style={{ maxWidth: 380, margin: "28px auto 0", textAlign: "left" }}>
        {checks.map((c, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0",
            borderBottom: i < checks.length - 1 ? `1px solid ${C.border}` : "none" }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
              background: i < stepIdx ? C.green : i === stepIdx ? C.blue : C.border,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", fontSize: 12, fontWeight: 700,
            }}>
              {i < stepIdx ? "✓" : i === stepIdx ? "…" : ""}
            </div>
            <span style={{ fontSize: 14, color: i <= stepIdx ? C.text : C.slate }}>{c}</span>
          </div>
        ))}
      </div>

      <style>{`@keyframes pulse { 0%,100%{box-shadow:0 0 0 12px ${C.blueLight}} 50%{box-shadow:0 0 0 24px ${C.blueLight}} }`}</style>
    </Card>
  );
}

// ─── Step 4 — Results ────────────────────────────────────────────────────────

function ResultsScreen({ patient, results, curveData, onRestart }) {
  const patternColor  = results.pattern === "Normal" ? C.green : results.pattern === "Obstructive" ? C.yellow : C.red;
  const patternBg     = results.pattern === "Normal" ? C.greenLight : results.pattern === "Obstructive" ? C.yellowLight : C.redLight;

  return (
    <div>
      {/* Patient + result header */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <Card style={{ flex: 2, padding: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.slate, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>Patient</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{patient.name}</div>
          <div style={{ color: C.slate, fontSize: 14, marginTop: 2 }}>
            {patient.age} yrs · {patient.height} cm · {patient.weight} kg · {patient.sex === "male" ? "Male" : "Female"}
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <Tag label={`Pattern: ${results.pattern}`} color={patternColor} bg={patternBg} />
            {results.severity && <Tag label={results.severity} color={C.yellow} bg={C.yellowLight} />}
          </div>
        </Card>

        <Card style={{ flex: 1, padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.slate, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>AI Confidence</div>
          <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={100} height={100} style={{ transform: "rotate(-90deg)" }}>
              <circle cx={50} cy={50} r={40} fill="none" stroke={C.border} strokeWidth={10} />
              <circle cx={50} cy={50} r={40} fill="none" stroke={C.green} strokeWidth={10}
                strokeDasharray={`${2 * Math.PI * 40 * results.confidence / 100} 999`}
                strokeLinecap="round" />
            </svg>
            <span style={{ position: "absolute", fontSize: 22, fontWeight: 800, color: C.green }}>{results.confidence}%</span>
          </div>
          <div style={{ fontSize: 13, color: C.slate, marginTop: 4 }}>Classification confidence</div>
        </Card>
      </div>

      {/* Metrics row */}
      <Card style={{ padding: 28, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.slate, textTransform: "uppercase", letterSpacing: .5, marginBottom: 16 }}>Spirometric Parameters</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <MetricCard label="FVC" value={results.fvc} unit="L" predicted={results.fvcPred} pct={results.fvcPct} />
          <MetricCard label="FEV₁" value={results.fev1} unit="L" predicted={results.fev1Pred} pct={results.fev1Pct} />
          <MetricCard label="FEV₁/FVC" value={`${results.fev1Fvc}%`} unit="" />
          <MetricCard label="PEF" value={results.pef} unit="L/s" />
        </div>
      </Card>

      {/* Graph + AI interpretation side by side */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <Card style={{ flex: 1, padding: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.slate, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}>Flow-Volume Curve</div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curveData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="flowGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.green} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.green} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="volume" type="number" domain={[0, 4.2]} tickCount={6}
                  tick={{ fontSize: 11 }}
                  label={{ value: "Volume (L)", position: "insideBottom", offset: -2, fontSize: 11, fill: C.slate }} />
                <YAxis domain={[0, 9]} tickCount={5} tick={{ fontSize: 11 }}
                  label={{ value: "Flow (L/s)", angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: C.slate }} />
                <Area type="monotone" dataKey="flow" stroke={C.green} strokeWidth={2.5}
                  fill="url(#flowGrad2)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card style={{ flex: 1, padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 22 }}>🤖</span>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.slate, textTransform: "uppercase", letterSpacing: .5 }}>AI Clinical Interpretation</div>
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: C.text, margin: "0 0 20px" }}>
            {results.interpretation}
          </p>
          <div style={{ padding: "14px 18px", background: C.blueLight, borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1e40af", marginBottom: 6, textTransform: "uppercase" }}>Recommendation</div>
            <p style={{ fontSize: 14, color: "#1e40af", margin: 0, lineHeight: 1.6 }}>
              {results.recommendation}
            </p>
          </div>
        </Card>
      </div>

      {/* Disclaimer + actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px" }}>
        <p style={{ fontSize: 12, color: C.slate, margin: 0, maxWidth: 480, lineHeight: 1.5 }}>
          ⚕️ This report is generated by an AI system and is intended for clinical decision support only.
          Results must be interpreted by a qualified healthcare professional.
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <Btn variant="outline" onClick={() => alert("PDF export — coming soon!")}>⬇ Export PDF</Btn>
          <Btn variant="ghost" onClick={onRestart}>New Patient</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

export default function SpirometryBooth() {
  const [step, setStep] = useState(0);
  const [patient, setPatient] = useState({
    name: "Matti Virtanen", age: "54", height: "175", weight: "82", sex: "male",
  });
  const [testPhase, setTestPhase] = useState("ready");
  const [countdown, setCountdown] = useState(3);
  const [curveData, setCurveData] = useState([]);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStepIdx, setAnalysisStepIdx] = useState(0);
  const timerRef = useRef(null);

  // Countdown
  useEffect(() => {
    if (testPhase !== "countdown") return;
    let c = 3;
    setCountdown(c);
    timerRef.current = setInterval(() => {
      c--;
      if (c <= 0) { clearInterval(timerRef.current); setTestPhase("blow"); }
      else setCountdown(c);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [testPhase]);

  // Blow animation
  useEffect(() => {
    if (testPhase !== "blow") return;
    let i = 0;
    setCurveData([]);
    timerRef.current = setInterval(() => {
      i++;
      setCurveData(FULL_CURVE.slice(0, i + 1));
      if (i >= FULL_CURVE.length - 1) {
        clearInterval(timerRef.current);
        setTimeout(() => setTestPhase("done"), 300);
      }
    }, 25);
    return () => clearInterval(timerRef.current);
  }, [testPhase]);

  // Analysis progress
  useEffect(() => {
    if (step !== 5) return;
    setAnalysisProgress(0);
    setAnalysisStepIdx(0);
    let p = 0;
    const iv = setInterval(() => {
      p += 1.2;
      setAnalysisProgress(Math.min(p, 100));
      setAnalysisStepIdx(Math.min(Math.floor((p / 100) * ANALYSIS_STEPS.length), ANALYSIS_STEPS.length - 1));
      if (p >= 100) { clearInterval(iv); setTimeout(() => setStep(6), 700); }
    }, 45);
    return () => clearInterval(iv);
  }, [step]);

  const goToStep = n => {
    setStep(n);
    if (n === 4) { setTestPhase("ready"); setCurveData([]); }
  };

  // ── Stepper header ──
  const header = (
    <div style={{ background: C.navy, padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ background: C.blue, borderRadius: 8, padding: "6px 12px", color: "#fff", fontWeight: 800, fontSize: 16, letterSpacing: .5 }}>
          SPIRO
        </div>
        <div style={{ color: "#94a3b8", fontSize: 13 }}>AI Spirometry Booth · Station 03</div>
      </div>

      {/* Step indicators */}
      <div style={{ display: "flex", alignItems: "center" }}>
        {STEPS.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: i < step ? C.green : i === step ? C.blue : "#334155",
                color: "#fff", fontSize: 11, fontWeight: 700,
              }}>
                {i < step ? "✓" : i + 1}
              </div>
              <div style={{ fontSize: 10, color: i === step ? "#fff" : "#64748b", marginTop: 3, whiteSpace: "nowrap" }}>{s}</div>
            </div>
            {i < STEPS.length - 1 && <div style={{ width: 32, height: 1, background: i < step ? C.green : "#334155", margin: "0 4px 14px" }} />}
          </div>
        ))}
      </div>

      <div style={{ color: "#475569", fontSize: 12 }}>{new Date().toLocaleDateString("en-GB", { dateStyle: "medium" })}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {header}
      <div style={{ maxWidth: 900, margin: "36px auto", padding: "0 24px 60px" }}>
        {step === 0 && (
          <ScanID onComplete={extracted => {
            if (extracted) {
              setPatient(p => ({
                ...p,
                name: extracted.name || p.name,
                age:  extracted.age  || p.age,
                sex:  extracted.sex  || p.sex,
              }));
            }
            goToStep(1);
          }} />
        )}
        {step === 1 && (
          <MeasureScreen
            targetHeight={175}
            targetWeight={82}
            onComplete={({ height, weight }) => {
              setPatient(p => ({ ...p, height, weight }));
              goToStep(2);
            }}
          />
        )}
        {step === 2 && <CheckIn patient={patient} setPatient={setPatient} onNext={() => goToStep(3)} />}
        {step === 3 && <Instructions onNext={() => goToStep(4)} />}
        {step === 4 && (
          <TestScreen
            testPhase={testPhase}
            countdown={countdown}
            curveData={curveData}
            onStart={() => setTestPhase("countdown")}
            onRetry={() => { setTestPhase("ready"); setCurveData([]); }}
            onNext={() => goToStep(5)}
          />
        )}
        {step === 5 && (
          <AnalysisScreen
            progress={analysisProgress}
            stepLabel={ANALYSIS_STEPS[analysisStepIdx]}
            stepIdx={analysisStepIdx}
            total={ANALYSIS_STEPS.length}
          />
        )}
        {step === 6 && (
          <ResultsScreen
            patient={patient}
            results={MOCK_RESULTS}
            curveData={FULL_CURVE}
            onRestart={() => goToStep(0)}
          />
        )}
      </div>
    </div>
  );
}
