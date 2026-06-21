'use client';
import type { XaiResult } from '@/lib/harness/engine-client';

const L = {
  en: { waterfall: 'EUI reduction by measure (waterfall)', sens: 'Sensitivity dF/dx (EUI leverage)', cost: 'Capex allocation', base: 'Baseline', final: 'Net EUI', saved: 'saved', unit: 'kWh/m²/yr' },
  vi: { waterfall: 'Giảm EUI theo từng biện pháp (waterfall)', sens: 'Độ nhạy dF/dx (đòn bẩy EUI)', cost: 'Phân bổ chi phí đầu tư', base: 'Hiện trạng', final: 'EUI ròng', saved: 'tiết kiệm', unit: 'kWh/m²/năm' },
  ko: { waterfall: '조치별 EUI 절감 (워터폴)', sens: '민감도 dF/dx (EUI 레버리지)', cost: '투자비 배분', base: '기준', final: '순 EUI', saved: '절감', unit: 'kWh/m²/년' },
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
      {/* Waterfall */}
      <div>
        <div className="text-xs font-medium text-slate-700 mb-2">{t.waterfall}</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-28 text-xs text-slate-500 text-right shrink-0">{t.base}</div>
            <div className="flex-1 h-5 bg-slate-200 rounded relative">
              <div className="absolute inset-y-0 left-0 bg-slate-400 rounded" style={{ width: '100%' }} />
              <span className="absolute right-1.5 top-0.5 text-[10px] text-white font-medium">{baseline}</span>
            </div>
          </div>
          {wf.map((w) => (
            <div key={w.key} className="flex items-center gap-2">
              <div className="w-28 text-xs text-slate-500 text-right shrink-0 truncate" title={w.name}>{w.name}</div>
              <div className="flex-1 h-5 bg-slate-50 rounded relative border border-slate-100">
                <div className="absolute inset-y-0 left-0 bg-emerald-500 rounded" style={{ width: `${(w.eui_saved / maxSaved) * 100}%` }} />
                <span className="absolute left-1.5 top-0.5 text-[10px] text-emerald-900 font-medium">−{w.eui_saved}</span>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="w-28 text-xs text-slate-700 font-medium text-right shrink-0">{t.final}</div>
            <div className="flex-1 h-5 bg-emerald-600 rounded relative">
              <span className="absolute right-1.5 top-0.5 text-[10px] text-white font-semibold">{xai.post_eui} ({t.saved} {xai.eui_reduction_pct}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sensitivity tornado */}
      <div>
        <div className="text-xs font-medium text-slate-700 mb-2">{t.sens}</div>
        <div className="space-y-1">
          {sens.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className="w-28 text-xs text-slate-500 text-right shrink-0 truncate" title={s.name}>{s.name}</div>
              <div className="flex-1 flex items-center">
                <div className="h-3.5 bg-blue-500 rounded-sm" style={{ width: `${(Math.abs(s.d_eui) / maxSens) * 100}%` }} />
                <span className="text-[10px] text-slate-400 ml-1.5">{s.d_eui}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Capex split */}
      <div>
        <div className="text-xs font-medium text-slate-700 mb-2">{t.cost} · ${(capexTotal / 1000).toFixed(0)}k</div>
        <div className="flex h-4 rounded overflow-hidden">
          {capex.map((c, i) => {
            const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'];
            return <div key={c.key} title={`${c.name}: $${(c.value / 1000).toFixed(0)}k`} style={{ width: `${(c.value / capexTotal) * 100}%`, background: colors[i % colors.length] }} />;
          })}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
          {capex.slice(0, 5).map((c, i) => {
            const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
            return <span key={c.key} className="text-[10px] text-slate-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: colors[i] }} />{c.name} (${(c.value / 1000).toFixed(0)}k)</span>;
          })}
        </div>
      </div>
    </div>
  );
}
