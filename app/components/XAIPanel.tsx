'use client';
import type { XaiResult } from '@/lib/harness/engine-client';

// One distinct colour PER MEASURE, reused across the waterfall, sensitivity and
// capex charts so a measure is identifiable by colour everywhere. 8 separated
// hues (no near-duplicates) for legibility on the dark theme.
const MEASURE_COLORS: Record<string, string> = {
  wall_insulation: '#f59e0b',   // orange
  roof_insulation: '#a78bfa',   // violet
  cool_roof: '#94a3b8',         // slate
  window_glazing: '#60a5fa',    // blue
  external_shading: '#f472b6',  // pink
  hvac_upgrade: '#00e5ff',      // cyan
  led_lighting: '#facc15',      // yellow
  rooftop_pv: '#4ade80',        // green
};
const mc = (k: string) => MEASURE_COLORS[k] ?? '#00e5ff';

const L = {
  en: { waterfall: 'EUI reduction by measure', sens: 'Sensitivity dF/dx (EUI leverage)', cost: 'Capex allocation', base: 'Baseline', final: 'Net EUI', saved: 'saved' },
  vi: { waterfall: 'Giảm EUI theo từng biện pháp', sens: 'Độ nhạy dF/dx (đòn bẩy EUI)', cost: 'Phân bổ chi phí đầu tư', base: 'Hiện trạng', final: 'EUI ròng', saved: 'tiết kiệm' },
  ko: { waterfall: '조치별 EUI 절감', sens: '민감도 dF/dx (EUI 레버리지)', cost: '투자비 배분', base: '기준', final: '순 EUI', saved: '절감' },
};

export default function XAIPanel({ xai, lang }: { xai: XaiResult; lang: string }) {
  const t = L[(lang as keyof typeof L)] ?? L.en;
  const wf = xai.energy_waterfall;
  const baseline = xai.baseline_eui;
  const maxSaved = Math.max(...wf.map((w) => w.eui_saved), 1);
  const sens = xai.sensitivity.filter((s) => s.active).slice(0, 6);
  const maxSens = Math.max(...sens.map((s) => Math.abs(s.d_eui)), 1);
  const capex = xai.cost_carbon.capex;
  const capexTotal = xai.cost_carbon.capex_total || 1;

  return (
    <div className="space-y-5">
      {/* Waterfall — per-measure colours */}
      <div>
        <div className="text-xs font-medium text-on-surface mb-2">{t.waterfall}</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-24 text-[11px] text-on-surface-variant text-right shrink-0 font-mono">{t.base}</div>
            <div className="flex-1 h-5 bg-surface-container-highest rounded relative">
              <span className="absolute right-1.5 top-0.5 text-[10px] text-on-surface font-medium font-mono">{baseline}</span>
            </div>
          </div>
          {wf.map((w) => (
            <div key={w.key} className="flex items-center gap-2">
              <div className="w-24 text-[11px] text-on-surface-variant text-right shrink-0 truncate font-mono" title={w.name}>{w.name}</div>
              <div className="flex-1 h-5 bg-surface-container rounded relative border border-outline-variant/40">
                <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${(w.eui_saved / maxSaved) * 100}%`, background: mc(w.key) }} />
                <span className="absolute left-1.5 top-0.5 text-[10px] text-on-surface font-medium font-mono">−{w.eui_saved}</span>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="w-24 text-[11px] text-on-surface font-medium text-right shrink-0 font-mono">{t.final}</div>
            <div className="flex-1 h-5 bg-primary-container rounded relative cyber-glow">
              <span className="absolute right-1.5 top-0.5 text-[10px] text-on-primary font-semibold font-mono">{xai.post_eui} ({t.saved} {xai.eui_reduction_pct}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sensitivity — same per-measure colours */}
      <div>
        <div className="text-xs font-medium text-on-surface mb-2">{t.sens}</div>
        <div className="space-y-1">
          {sens.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className="w-24 text-[11px] text-on-surface-variant text-right shrink-0 truncate font-mono" title={s.name}>{s.name}</div>
              <div className="flex-1 flex items-center">
                <div className="h-3.5 rounded-sm" style={{ width: `${(Math.abs(s.d_eui) / maxSens) * 100}%`, background: mc(s.key) }} />
                <span className="text-[10px] text-on-surface-variant ml-1.5 font-mono">{s.d_eui}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Capex split — SAME per-measure colours, every segment labelled with % */}
      <div>
        <div className="text-xs font-medium text-on-surface mb-2">{t.cost} · ${(capexTotal / 1000).toFixed(0)}k</div>
        <div className="flex h-4 rounded overflow-hidden">
          {capex.map((c) => (
            <div key={c.key} title={`${c.name}: $${(c.value / 1000).toFixed(0)}k`}
              style={{ width: `${(c.value / capexTotal) * 100}%`, background: mc(c.key) }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {capex.map((c) => (
            <span key={c.key} className="text-[10px] text-on-surface-variant flex items-center gap-1 font-mono">
              <span className="w-2 h-2 rounded-sm inline-block shrink-0" style={{ background: mc(c.key) }} />
              {c.name} <span className="text-on-surface-variant/60">${(c.value / 1000).toFixed(0)}k · {Math.round((c.value / capexTotal) * 100)}%</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
