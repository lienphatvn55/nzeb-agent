'use client';

// 25-year operational-carbon trajectory, derived from the same grid-decarbonisation
// curve the engine uses (0.68 → 0.05 kgCO₂e/kWh, linear 2025→2050). BAU keeps the
// baseline EUI; the retrofit holds the post-retrofit EUI. Not fabricated — it's the
// model's projection of operational carbon per m².
const BASE_YEAR = 2025, NET_ZERO_YEAR = 2050, EF_BASE = 0.68, EF_2050 = 0.05;
const gridEf = (yr: number) => yr >= NET_ZERO_YEAR ? EF_2050 : EF_BASE + (EF_2050 - EF_BASE) * ((yr - BASE_YEAR) / (NET_ZERO_YEAR - BASE_YEAR));

const L: Record<string, { title: string; bau: string; net: string; unit: string }> = {
  vi: { title: 'Lộ trình carbon vận hành 25 năm', bau: 'BAU (giữ nguyên)', net: 'Sau cải tạo → Net-Zero', unit: 'kgCO₂e/m²/năm' },
  en: { title: '25-year operational-carbon pathway', bau: 'BAU (no retrofit)', net: 'Retrofit → Net-Zero', unit: 'kgCO₂e/m²/yr' },
  ko: { title: '25년 운영 탄소 경로', bau: 'BAU (현행)', net: '리트로핏 → 넷제로', unit: 'kgCO₂e/m²/년' },
};

const W = 760, H = 220, PADL = 38, PADB = 26, PADT = 12, PADR = 12;

export default function ForecastChart({ baseEui, postEui, lang = 'en' }: { baseEui: number; postEui: number; lang?: string }) {
  const t = L[lang] ?? L.en;
  const years = Array.from({ length: NET_ZERO_YEAR - BASE_YEAR + 1 }, (_, i) => BASE_YEAR + i);
  const bau = years.map((y) => baseEui * gridEf(y));
  const ret = years.map((y) => postEui * gridEf(y));
  const yMax = Math.max(...bau) * 1.05;

  const x = (i: number) => PADL + (i / (years.length - 1)) * (W - PADL - PADR);
  const y = (v: number) => PADT + (1 - v / yMax) * (H - PADT - PADB);
  const line = (arr: number[]) => arr.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const area = `${x(0)},${y(0)} ` + ret.map((v, i) => `${x(i)},${y(v)}`).join(' ') + ` ${x(years.length - 1)},${y(0)}`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((g) => g * yMax);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PADL} y1={y(v)} x2={W - PADR} y2={y(v)} stroke="#3b494c" strokeWidth={0.5} opacity={0.4} />
            <text x={PADL - 6} y={y(v) + 3} fontSize="9" fill="#849396" textAnchor="end" fontFamily="Geist">{Math.round(v)}</text>
          </g>
        ))}
        <polygon points={area} fill="rgba(0,229,255,0.06)" />
        <polyline points={line(bau)} fill="none" stroke="#849396" strokeWidth={1.2} strokeDasharray="5,4" />
        <polyline points={line(ret)} fill="none" stroke="#00e5ff" strokeWidth={2} className="cyber-glow" />
        {[2025, 2030, 2035, 2040, 2045, 2050].map((yr) => {
          const i = yr - BASE_YEAR;
          return <text key={yr} x={x(i)} y={H - 8} fontSize="9" fill={yr === 2050 ? '#00e5ff' : '#849396'} textAnchor="middle" fontFamily="Geist" fontWeight={yr === 2050 ? 700 : 400}>{yr}</text>;
        })}
      </svg>
      <div className="flex items-center gap-4 mt-1 px-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-[10px] text-on-surface-variant font-mono"><span className="inline-block w-3" style={{ borderTop: '2px dashed #849396' }} />{t.bau}</span>
        <span className="flex items-center gap-1.5 text-[10px] text-primary font-mono"><span className="inline-block w-3" style={{ borderTop: '2px solid #00e5ff' }} />{t.net}</span>
        <span className="text-[10px] text-on-surface-variant font-mono ml-auto">{t.unit}</span>
      </div>
    </div>
  );
}
