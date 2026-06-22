'use client';

// Isometric building rendered from the given parameters. The silhouette, window
// pattern and roof differ by building TYPE so office / residential / commercial /
// mixed are visually distinct — plus the recommended measures (rooftop PV, cool
// roof, glazing, shading) drawn on it. Pure SVG, no 3D library.

type Cfg = { hPer: number; foot: number; bayDiv: number; win: 'curtain' | 'punched' | 'storefront' | 'mixed'; glass: string; label: Record<string, string> };
const TYPES: Record<string, Cfg> = {
  office: { hPer: 0.16, foot: 0.92, bayDiv: 4.6, win: 'curtain', glass: '#3bc0e6', label: { vi: 'Văn phòng', en: 'Office', ko: '사무소' } },
  residential: { hPer: 0.13, foot: 1.06, bayDiv: 6.6, win: 'punched', glass: '#8fb6ee', label: { vi: 'Nhà ở', en: 'Residential', ko: '주거' } },
  commercial: { hPer: 0.115, foot: 1.22, bayDiv: 5.6, win: 'storefront', glass: '#46c8d8', label: { vi: 'Thương mại', en: 'Commercial', ko: '상업' } },
  mixed: { hPer: 0.14, foot: 1.0, bayDiv: 5.6, win: 'mixed', glass: '#5fc0e0', label: { vi: 'Hỗn hợp', en: 'Mixed', ko: '복합' } },
};

const TXT: Record<string, { floors: string; pv: string; cool: string; glaze: string; shade: string }> = {
  vi: { floors: 'tầng', pv: 'PV mái', cool: 'Mái phản xạ', glaze: 'Kính low-e', shade: 'Lam chắn nắng' },
  en: { floors: 'floors', pv: 'Rooftop PV', cool: 'Cool roof', glaze: 'Low-e glazing', shade: 'Shading' },
  ko: { floors: '층', pv: '옥상 PV', cool: '쿨루프', glaze: 'Low-e 유리', shade: '차양' },
};

export default function BuildingViz({ floors, area, btype = 'office', x, lang = 'en' }: {
  floors: number; area: number; btype?: string; x: Record<string, number>; lang?: string;
}) {
  const t = TXT[lang] ?? TXT.en;
  const cfg = TYPES[btype] ?? TYPES.office;
  const n = Math.max(1, Math.round(floors));
  const xi = (k: string) => x[k] ?? 0;
  const pv = xi('rooftop_pv') > 0.3, cool = xi('cool_roof') > 0.3, glaze = xi('window_glazing') > 0.3, shade = xi('external_shading') > 0.3;

  const side = Math.sqrt(area / n);
  const bays = Math.max(2, Math.min(7, Math.round((side * cfg.foot) / cfg.bayDiv)));
  const rows = Math.min(n, 22);
  const s = 60 * cfg.foot;
  const Hz = Math.min(2.6, Math.max(0.5, n * cfg.hPer));
  const cx = 140, cy = 202;
  const P = (px: number, py: number, pz: number): [number, number] => [cx + (px - py) * 0.866 * s, cy + (px + py) * 0.5 * s - pz * s];
  const poly = (pts: Array<[number, number, number]>) => pts.map((p) => P(p[0], p[1], p[2]).join(',')).join(' ');

  const topFace = poly([[0, 0, Hz], [1, 0, Hz], [1, 1, Hz], [0, 1, Hz]]);
  const leftFace = poly([[0, 0, 0], [1, 0, 0], [1, 0, Hz], [0, 0, Hz]]);
  const rightFace = poly([[1, 0, 0], [1, 1, 0], [1, 1, Hz], [1, 0, Hz]]);

  const glass = glaze ? '#6fd4ff' : cfg.glass;
  // window quads on a face (face 'L' = y0 wall, 'R' = x1 wall)
  const winPts = (face: 'L' | 'R', uLo: number, uHi: number, vLo: number, vHi: number) => {
    const f3 = face === 'L' ? (u: number, v: number): [number, number, number] => [u, 0, v * Hz] : (u: number, v: number): [number, number, number] => [1, u, v * Hz];
    return poly([f3(uLo, vLo), f3(uHi, vLo), f3(uHi, vHi), f3(uLo, vHi)]);
  };

  const wins: Array<{ p: string; fill: string; op: number }> = [];
  for (let f = 0; f < rows; f++) {
    const baseFloor = (cfg.win === 'storefront' && f === 0) || (cfg.win === 'mixed' && f < Math.ceil(rows * 0.35));
    const pu = (cfg.win === 'curtain' ? 0.06 : baseFloor ? 0.05 : 0.24) / bays;
    const pv0 = (cfg.win === 'curtain' ? 0.12 : baseFloor ? 0.06 : 0.28) / rows;
    const op = baseFloor ? 0.9 : cfg.win === 'curtain' ? 0.82 : 0.7;
    const fill = baseFloor ? '#2bb0cf' : glass;
    for (let b = 0; b < bays; b++) {
      const uLo = b / bays + pu, uHi = (b + 1) / bays - pu;
      const vLo = f / rows + pv0, vHi = (f + 1) / rows - pv0;
      wins.push({ p: winPts('L', uLo, uHi, vLo, vHi), fill, op });
      wins.push({ p: winPts('R', uLo, uHi, vLo, vHi), fill, op: op * 0.85 });
    }
  }

  // rooftop PV (inset grid)
  const panels: string[] = [];
  if (pv) for (let gx = 0; gx < 3; gx++) for (let gy = 0; gy < 3; gy++) {
    const x0 = 0.14 + gx * 0.26, y0 = 0.14 + gy * 0.26;
    panels.push(poly([[x0, y0, Hz + 0.004], [x0 + 0.2, y0, Hz + 0.004], [x0 + 0.2, y0 + 0.2, Hz + 0.004], [x0, y0 + 0.2, Hz + 0.004]]));
  }
  // brise-soleil louvres on the sun-facing (left) face
  const louvres: string[] = [];
  if (shade) for (let f = 1; f < rows; f++) {
    const v = (f / rows) * Hz;
    louvres.push(`${P(0.04, -0.05, v).join(',')} ${P(0.96, -0.05, v).join(',')}`);
  }

  const chips = [pv && t.pv, cool && t.cool, glaze && t.glaze, shade && t.shade].filter(Boolean) as string[];

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 280 270" className="w-full max-w-[330px]">
        <ellipse cx={cx} cy={cy + 8} rx={s * 0.95} ry={s * 0.42} fill="#000" opacity={0.28} />
        {/* shell */}
        <polygon points={leftFace} fill="#101a2e" stroke="#00e5ff" strokeWidth={1} strokeOpacity={0.55} />
        <polygon points={rightFace} fill="#0b1322" stroke="#00e5ff" strokeWidth={1} strokeOpacity={0.45} />
        {/* windows */}
        {wins.map((w, i) => <polygon key={i} points={w.p} fill={w.fill} opacity={w.op} />)}
        {/* louvres */}
        {louvres.map((l, i) => <polyline key={i} points={l} fill="none" stroke="#f472b6" strokeWidth={1.1} strokeOpacity={0.75} />)}
        {/* roof */}
        <polygon points={topFace} fill={cool ? '#1d3a43' : '#1b2740'} stroke="#00e5ff" strokeWidth={1} strokeOpacity={0.75} />
        {panels.map((p, i) => <polygon key={i} points={p} fill="#0a3a44" stroke="#4ade80" strokeWidth={0.6} strokeOpacity={0.9} />)}
      </svg>

      <div className="text-center mt-1">
        <div className="text-on-surface font-mono text-sm font-semibold">{cfg.label[lang] ?? cfg.label.en} · {n} {t.floors} · {Math.round(area).toLocaleString()} m²</div>
        {chips.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 mt-2">
            {chips.map((c) => (
              <span key={c} className="text-[10px] font-mono text-primary-container border border-primary-container/30 rounded-full px-2 py-0.5">{c}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
