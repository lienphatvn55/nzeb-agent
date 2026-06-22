'use client';
import { useState } from 'react';
import type { OptimizeResult, ParetoSolution } from '@/lib/harness/engine-client';

const W = 560, H = 320, PAD = 46;

function scale(v: number, lo: number, hi: number, a: number, b: number) {
  if (hi - lo < 1e-9) return (a + b) / 2;
  return a + ((v - lo) / (hi - lo)) * (b - a);
}

// WLC -> color (emerald low carbon -> amber -> red high carbon)
function wlcColor(t: number) {
  const stops = [
    [16, 185, 129], // emerald
    [245, 158, 11], // amber
    [239, 68, 68],  // red
  ];
  const x = Math.max(0, Math.min(1, t)) * 2;
  const i = Math.floor(x), f = x - i;
  const a = stops[Math.min(i, 1)], b = stops[Math.min(i + 1, 2)];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}

export default function ParetoChart({ opt, labels }: { opt: OptimizeResult; labels: Record<string, string> }) {
  const sols = opt.solutions;
  const [hover, setHover] = useState<number | null>(null);
  const [view, setView] = useState<'scatter' | 'parallel'>('scatter');

  const eui = sols.map((s) => s.f1_eui);
  const lcc = sols.map((s) => s.f2_lcc);
  const wlc = sols.map((s) => s.f3_wlc);
  const euiMin = Math.min(...eui), euiMax = Math.max(...eui);
  const lccMin = Math.min(...lcc), lccMax = Math.max(...lcc);
  const wlcMin = Math.min(...wlc), wlcMax = Math.max(...wlc);

  const rec = opt.recommended_index;
  const ext = opt.extremes;

  const tag = (i: number) =>
    i === rec ? '★ Recommended' :
    i === ext.min_eui ? 'min EUI' :
    i === ext.min_lcc ? 'min LCC' :
    i === ext.min_wlc ? 'min WLC' : '';

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-on-surface-variant font-mono">
          {opt.algorithm.name} · pop {opt.algorithm.pop_size} · {opt.algorithm.generations} gens · {opt.n_solutions} Pareto-optimal solutions
        </div>
        <div className="flex gap-1">
          {(['scatter', 'parallel'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium font-mono border transition ${view === v ? 'bg-primary-container text-on-primary border-primary-container' : 'text-on-surface-variant border-outline-variant hover:bg-surface-container-high'}`}>
              {v === 'scatter' ? 'f1×f2 (WLC color)' : 'Parallel coords'}
            </button>
          ))}
        </div>
      </div>

      {view === 'scatter' ? (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {/* axes */}
          <line x1={PAD} y1={H - PAD} x2={W - 12} y2={H - PAD} stroke="#3b494c" />
          <line x1={PAD} y1={12} x2={PAD} y2={H - PAD} stroke="#3b494c" />
          {[0, 0.25, 0.5, 0.75, 1].map((g) => {
            const xv = euiMin + (euiMax - euiMin) * g;
            const yv = lccMin + (lccMax - lccMin) * g;
            const px = scale(xv, euiMin, euiMax, PAD, W - 12);
            const py = scale(yv, lccMin, lccMax, H - PAD, 12);
            return (
              <g key={g}>
                <text x={px} y={H - PAD + 14} fontSize="8" fill="#849396" textAnchor="middle">{xv.toFixed(0)}</text>
                <text x={PAD - 6} y={py + 3} fontSize="8" fill="#849396" textAnchor="end">{yv.toFixed(0)}</text>
              </g>
            );
          })}
          <text x={(W) / 2} y={H - 6} fontSize="9" fill="#bac9cc" textAnchor="middle">f1 = {labels.f1_eui}</text>
          <text x={12} y={H / 2} fontSize="9" fill="#bac9cc" textAnchor="middle" transform={`rotate(-90 12 ${H / 2})`}>f2 = {labels.f2_lcc}</text>

          {sols.map((s, i) => {
            const px = scale(s.f1_eui, euiMin, euiMax, PAD, W - 12);
            const py = scale(s.f2_lcc, lccMin, lccMax, H - PAD, 12);
            const t = (s.f3_wlc - wlcMin) / Math.max(wlcMax - wlcMin, 1e-9);
            const special = i === rec || i === ext.min_eui || i === ext.min_lcc || i === ext.min_wlc;
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }}>
                {i === rec && <circle cx={px} cy={py} r={10} fill="none" stroke="#00e5ff" strokeWidth={2} />}
                <circle cx={px} cy={py} r={special ? 6 : 4} fill={wlcColor(t)}
                  stroke={special ? '#00e5ff' : 'rgba(255,255,255,0.8)'} strokeWidth={special ? 1.5 : 0.7} className="dark:stroke-slate-900" />
              </g>
            );
          })}

          {hover !== null && (() => {
            const s = sols[hover];
            const px = scale(s.f1_eui, euiMin, euiMax, PAD, W - 12);
            const py = scale(s.f2_lcc, lccMin, lccMax, H - PAD, 12);
            const tx = Math.min(px + 8, W - 130);
            return (
              <g>
                <rect x={tx} y={py - 44} width={124} height={42} rx={4} fill="#060e20" opacity={0.92} />
                <text x={tx + 6} y={py - 30} fontSize="8.5" fill="#fff">EUI {s.f1_eui} · LCC {s.f2_lcc}</text>
                <text x={tx + 6} y={py - 19} fontSize="8.5" fill="#fff">WLC {s.f3_wlc} · ${(s.capex / 1000).toFixed(0)}k</text>
                <text x={tx + 6} y={py - 8} fontSize="8.5" fill="#00e5ff">{tag(hover) || `solution #${hover}`}</text>
              </g>
            );
          })()}
        </svg>
      ) : (
        <ParallelCoords sols={sols} rec={rec} euiR={[euiMin, euiMax]} lccR={[lccMin, lccMax]} wlcR={[wlcMin, wlcMax]} hover={hover} setHover={setHover} />
      )}

      {/* legend */}
      <div className="flex items-center gap-4 mt-2 text-xs text-on-surface-variant font-mono flex-wrap">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-primary-container inline-block" /> ★ recommended (knee)</span>
        <span className="flex items-center gap-1">f3 WLC:
          <span className="inline-block w-16 h-2 rounded" style={{ background: 'linear-gradient(90deg,#10b981,#f59e0b,#ef4444)' }} />
          low → high carbon</span>
      </div>
    </div>
  );
}

function ParallelCoords({ sols, rec, euiR, lccR, wlcR, hover, setHover }: {
  sols: ParetoSolution[]; rec: number;
  euiR: [number, number]; lccR: [number, number]; wlcR: [number, number];
  hover: number | null; setHover: (i: number | null) => void;
}) {
  const axes = [
    { x: PAD, r: euiR, key: 'f1_eui' as const, label: 'f1 EUI' },
    { x: W / 2, r: lccR, key: 'f2_lcc' as const, label: 'f2 LCC' },
    { x: W - PAD, r: wlcR, key: 'f3_wlc' as const, label: 'f3 WLC' },
  ];
  const yOf = (v: number, r: [number, number]) => scale(v, r[0], r[1], 24, H - 36);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {axes.map((a) => (
        <g key={a.key}>
          <line x1={a.x} y1={24} x2={a.x} y2={H - 36} stroke="#3b494c" strokeWidth={1.5} />
          <text x={a.x} y={H - 18} fontSize="9" fill="#bac9cc" textAnchor="middle">{a.label}</text>
          <text x={a.x} y={18} fontSize="8" fill="#849396" textAnchor="middle">{a.r[0].toFixed(0)}</text>
          <text x={a.x} y={H - 26} fontSize="8" fill="#849396" textAnchor="middle">{a.r[1].toFixed(0)}</text>
        </g>
      ))}
      {sols.map((s, i) => {
        const pts = axes.map((a) => `${a.x},${yOf(s[a.key], a.r)}`).join(' ');
        const isRec = i === rec, isHover = i === hover;
        return (
          <polyline key={i} points={pts} fill="none"
            stroke={isRec ? '#00e5ff' : isHover ? '#9cf0ff' : '#849396'}
            strokeWidth={isRec ? 2.5 : isHover ? 2 : 1}
            opacity={isRec || isHover ? 1 : 0.5}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ cursor: 'pointer' }} />
        );
      })}
    </svg>
  );
}
