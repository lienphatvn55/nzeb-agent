'use client';
import type { OptimizeResult, ParetoSolution } from '@/lib/harness/engine-client';

// Normalised multi-objective radar: each axis scored 0..1 where 1 = best (lowest
// EUI / LCC / WLC / capex) across the Pareto set. Recommended (knee) prominent;
// min-EUI and min-LCC extremes shown faintly for trade-off context.
const AX: Record<string, string[]> = {
  vi: ['EUI thấp', 'LCC thấp', 'WLC thấp', 'Vốn thấp'],
  en: ['Low EUI', 'Low LCC', 'Low WLC', 'Low capex'],
  ko: ['낮은 EUI', '낮은 LCC', '낮은 WLC', '낮은 투자비'],
};
const NAMES: Record<string, string> = { vi: 'Khuyến nghị', en: 'Recommended', ko: '권장' };

const KEYS = ['f1_eui', 'f2_lcc', 'f3_wlc', 'capex'] as const;
const cx = 150, cy = 120, R = 74;

export default function RadarChart({ opt, lang = 'en' }: { opt: OptimizeResult; lang?: string }) {
  const sols = opt.solutions;
  const labels = AX[lang] ?? AX.en;
  const n = KEYS.length;

  const ranges = KEYS.map((k) => {
    const vals = sols.map((s) => s[k]);
    return [Math.min(...vals), Math.max(...vals)] as const;
  });
  const score = (s: ParetoSolution, ki: number) => {
    const [mn, mx] = ranges[ki];
    return mx - mn < 1e-9 ? 1 : (mx - s[KEYS[ki]]) / (mx - mn);
  };

  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (radius: number, i: number) => [cx + radius * Math.cos(angle(i)), cy + radius * Math.sin(angle(i))];
  const poly = (s: ParetoSolution) => KEYS.map((_, i) => pt(R * Math.max(0.04, score(s, i)), i).join(',')).join(' ');

  const series = [
    { s: sols[opt.extremes.min_eui], color: '#9aa6c2', fill: 'none', w: 1, dash: '5,4', op: 0.5, label: 'min-EUI' },
    { s: sols[opt.extremes.min_lcc], color: '#f3bf26', fill: 'none', w: 1, dash: '5,4', op: 0.55, label: 'min-LCC' },
    { s: sols[opt.recommended_index], color: '#00e5ff', fill: 'rgba(0,229,255,0.16)', w: 2.5, dash: '', op: 1, label: NAMES[lang] ?? NAMES.en },
  ];

  // per-axis label placement so long L/R labels don't sit on the polygon
  const labelFor = (i: number) => {
    const [x, y] = pt(R + 14, i);
    if (i === 0) return { x: cx, y: cy - R - 14, anchor: 'middle' as const };
    if (i === 2) return { x: cx, y: cy + R + 22, anchor: 'middle' as const };
    return { x, y: y + 3, anchor: i === 1 ? ('start' as const) : ('end' as const) };
  };

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 300 244" className="w-full max-w-[340px]">
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <polygon key={g} points={KEYS.map((_, i) => pt(R * g, i).join(',')).join(' ')}
            fill="none" stroke="#3b494c" strokeWidth={0.6} opacity={0.5} />
        ))}
        {KEYS.map((_, i) => {
          const [x, y] = pt(R, i);
          const lp = labelFor(i);
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="#3b494c" strokeWidth={0.6} opacity={0.5} />
              <text x={lp.x} y={lp.y} fontSize="11" fill="#bac9cc" textAnchor={lp.anchor} dominantBaseline="middle" fontFamily="Geist">{labels[i]}</text>
            </g>
          );
        })}
        {series.map((se, i) => (
          <polygon key={i} points={poly(se.s)} fill={se.fill} stroke={se.color} strokeWidth={se.w}
            strokeDasharray={se.dash} opacity={se.op} className={se.label === (NAMES[lang] ?? NAMES.en) ? 'cyber-glow' : ''} />
        ))}
        {KEYS.map((_, i) => { const [x, y] = pt(R * Math.max(0.04, score(series[2].s, i)), i); return <circle key={i} cx={x} cy={y} r={2.6} fill="#00e5ff" />; })}
      </svg>
      <div className="flex flex-wrap justify-center gap-3 mt-1">
        {series.slice().reverse().map((se, i) => (
          <span key={i} className="flex items-center gap-1.5 text-[10px] text-on-surface-variant font-mono">
            <span className="inline-block w-3" style={{ borderTop: `2px ${se.dash ? 'dashed' : 'solid'} ${se.color}` }} />
            {se.label}
          </span>
        ))}
      </div>
    </div>
  );
}
