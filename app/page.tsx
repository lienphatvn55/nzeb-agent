'use client';
import { useState } from 'react';
import type { OptimizeResult } from '@/lib/harness/engine-client';
import ParetoChart from './components/ParetoChart';
import XAIPanel from './components/XAIPanel';
import CompliancePanel from './components/CompliancePanel';
import AgentTrace from './components/AgentTrace';

const LANGS = ['EN', 'KO', 'VI'] as const;
type Lang = typeof LANGS[number];

const T: Record<Lang, Record<string, string>> = {
  EN: {
    title: 'NZEB Deep-Retrofit Decision Platform',
    subtitle: 'Agentic XAI · NSGA-III · QCVN 09:2017 + LEED v5 · HCMC Net-Zero 2050',
    s1: 'Building input', s2: 'Agent + NSGA-III', s3: 'Explainable decision',
    p1: 'Building profile', ltype: 'Building type', lyear: 'Year built',
    larea: 'Floor area (m²)', lfloors: 'Floors', leui: 'Measured EUI (kWh/m²/yr)',
    lwall: 'Wall U-value (W/m²K)', lbudget: 'Retrofit budget (USD)',
    btn: 'Run Agent Harness', analyzing: 'Agent running NSGA-III + compliance + XAI…',
    mEui: 'Recommended EUI', mLcc: 'Life-cycle cost', mWlc: 'Whole-life carbon', mCapex: 'Capex',
    uEui: 'kWh/m²/yr', uLcc: 'USD/m²', uWlc: 'kgCO₂e/m²', uCapex: 'USD',
    reduction: 'reduction', pareto: 'Pareto front (NSGA-III multi-objective)',
    xaiTitle: 'Explainability (XAI)', compTitle: 'Standards compliance',
    recoTitle: 'Agent recommendation', reset: 'New analysis',
    oOffice: 'Office', oRes: 'Residential', oCom: 'Commercial', oMix: 'Mixed-use',
  },
  KO: {
    title: 'NZEB 심층 리트로핏 의사결정 플랫폼',
    subtitle: '에이전트 XAI · NSGA-III · QCVN 09:2017 + LEED v5 · HCMC 넷제로 2050',
    s1: '건물 입력', s2: '에이전트 + NSGA-III', s3: '설명가능 의사결정',
    p1: '건물 정보', ltype: '건물 유형', lyear: '건축 연도',
    larea: '연면적 (m²)', lfloors: '층수', leui: '측정 EUI (kWh/m²/년)',
    lwall: '외벽 U값 (W/m²K)', lbudget: '리트로핏 예산 (USD)',
    btn: 'Agent Harness 실행', analyzing: '에이전트가 NSGA-III + 규정 + XAI 실행 중…',
    mEui: '권장 EUI', mLcc: '생애주기 비용', mWlc: '전생애 탄소', mCapex: '투자비',
    uEui: 'kWh/m²/년', uLcc: 'USD/m²', uWlc: 'kgCO₂e/m²', uCapex: 'USD',
    reduction: '절감', pareto: '파레토 프론트 (NSGA-III 다목적)',
    xaiTitle: '설명가능성 (XAI)', compTitle: '표준 준수',
    recoTitle: '에이전트 권고', reset: '새 분석',
    oOffice: '사무소', oRes: '주거', oCom: '상업', oMix: '복합용도',
  },
  VI: {
    title: 'Nền tảng Hỗ trợ Ra quyết định Cải tạo sâu Năng lượng NZEB',
    subtitle: 'AI Agent XAI · NSGA-III · QCVN 09:2017 + LEED v5 · TP.HCM Net-Zero 2050',
    s1: 'Nhập tòa nhà', s2: 'Agent + NSGA-III', s3: 'Quyết định giải thích được',
    p1: 'Hồ sơ tòa nhà', ltype: 'Loại công trình', lyear: 'Năm xây dựng',
    larea: 'Diện tích sàn (m²)', lfloors: 'Số tầng', leui: 'EUI đo được (kWh/m²/năm)',
    lwall: 'Hệ số U tường (W/m²K)', lbudget: 'Ngân sách cải tạo (USD)',
    btn: 'Chạy Agent Harness', analyzing: 'Agent đang chạy NSGA-III + tuân thủ + XAI…',
    mEui: 'EUI khuyến nghị', mLcc: 'Chi phí vòng đời', mWlc: 'Carbon toàn vòng đời', mCapex: 'Vốn đầu tư',
    uEui: 'kWh/m²/năm', uLcc: 'USD/m²', uWlc: 'kgCO₂e/m²', uCapex: 'USD',
    reduction: 'giảm', pareto: 'Mặt Pareto (NSGA-III đa mục tiêu)',
    xaiTitle: 'Khả năng giải thích (XAI)', compTitle: 'Tuân thủ tiêu chuẩn',
    recoTitle: 'Khuyến nghị của Agent', reset: 'Phân tích mới',
    oOffice: 'Văn phòng', oRes: 'Nhà ở', oCom: 'Thương mại', oMix: 'Hỗn hợp',
  },
};

interface AgentResponse {
  building: { eui_base: number };
  narrative: string;
  trace: Array<{ step: number; tool: string; input: unknown; summary: string }>;
  steps: number;
  model: string;
  optimization: OptimizeResult | null;
}

export default function Home() {
  const [lang, setLang] = useState<Lang>('VI');
  const t = T[lang];
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentResponse | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    btype: 'office', byear: '1998', barea: '5000',
    bfloors: '12', beui: '210', bwall: '2.2', bbudget: '900000',
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function run(l: Lang = lang) {
    setLoading(true); setError(''); setStep(2);
    try {
      const res = await fetch('/api/agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, lang: l.toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'failed');
      setResult(data); setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed'); setStep(1);
    } finally { setLoading(false); }
  }

  function switchLang(l: Lang) { setLang(l); if (result) run(l); }
  function reset() { setResult(null); setStep(1); setError(''); }

  const opt = result?.optimization ?? null;
  const rec = opt ? opt.recommended : null;
  const baseEui = result?.building.eui_base ?? Number(form.beui);

  const COLOR: Record<string, string> = {
    emerald: 'text-emerald-600', blue: 'text-blue-600',
    violet: 'text-violet-600', amber: 'text-amber-600',
  };

  return (
    <main className="min-h-screen bg-slate-50 py-6 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-lg font-bold">N</div>
            <div>
              <div className="font-semibold text-slate-900 text-base">{t.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{t.subtitle}</div>
            </div>
          </div>
          <div className="flex gap-1.5">
            {LANGS.map((l) => (
              <button key={l} onClick={() => switchLang(l)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${lang === l ? 'bg-emerald-600 text-white border-emerald-600' : 'text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="flex mb-4 rounded-lg overflow-hidden border border-slate-200">
          {[t.s1, t.s2, t.s3].map((label, i) => (
            <div key={i} className={`flex-1 flex items-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors
              ${step === i + 1 ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-600'
              : step > i + 1 ? 'bg-emerald-50 text-emerald-600' : 'bg-white text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold shrink-0
                ${step >= i + 1 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                {step > i + 1 ? '✓' : i + 1}
              </span>
              {label}
            </div>
          ))}
        </div>

        {/* Input */}
        {!result && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
            <div className="text-sm font-medium text-slate-800 mb-4">🏢 {t.p1}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="block text-xs text-slate-500 font-medium mb-1">{t.ltype}</label>
                <select value={form.btype} onChange={(e) => set('btype', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-slate-50 focus:outline-none focus:border-emerald-500">
                  <option value="office">{t.oOffice}</option>
                  <option value="residential">{t.oRes}</option>
                  <option value="commercial">{t.oCom}</option>
                  <option value="mixed">{t.oMix}</option>
                </select>
              </div>
              {[['byear', t.lyear], ['barea', t.larea], ['bfloors', t.lfloors],
                ['beui', t.leui], ['bwall', t.lwall], ['bbudget', t.lbudget]].map(([k, label]) => (
                <div key={k}>
                  <label className="block text-xs text-slate-500 font-medium mb-1">{label}</label>
                  <input type="number" value={form[k as keyof typeof form]} onChange={(e) => set(k, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-slate-50 focus:outline-none focus:border-emerald-500" />
                </div>
              ))}
            </div>
            {error && <div className="text-red-500 text-xs mb-3">{error}</div>}
            <button onClick={() => run()} disabled={loading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors">
              {loading ? `⏳ ${t.analyzing}` : `${t.btn} →`}
            </button>
          </div>
        )}

        {loading && !result && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
            ⏳ {t.analyzing}
          </div>
        )}

        {/* Results */}
        {result && opt && rec && (
          <div className="space-y-4">
            <AgentTrace trace={result.trace} steps={result.steps} model={result.model} lang={lang.toLowerCase()} />

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: t.mEui, val: rec.design.f1_eui, unit: t.uEui, color: 'emerald',
                  sub: `↓ ${Math.round((1 - rec.design.f1_eui / baseEui) * 100)}% ${t.reduction}` },
                { label: t.mLcc, val: rec.design.f2_lcc, unit: t.uLcc, color: 'blue', sub: '25-yr NPV' },
                { label: t.mWlc, val: rec.design.f3_wlc, unit: t.uWlc, color: 'violet', sub: 'embodied + ops' },
                { label: t.mCapex, val: `$${(rec.design.capex / 1000).toFixed(0)}k`, unit: t.uCapex, color: 'amber', sub: '' },
              ].map((m) => (
                <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500 mb-1">{m.label}</div>
                  <div className={`text-2xl font-semibold ${COLOR[m.color]}`}>{m.val}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{m.unit}{m.sub ? ` · ${m.sub}` : ''}</div>
                </div>
              ))}
            </div>

            {/* Pareto */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-sm font-medium text-slate-800 mb-3">📊 {t.pareto}</div>
              <ParetoChart opt={opt} labels={opt.objective_labels} />
            </div>

            {/* Recommendation narrative */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-sm font-medium text-slate-800 mb-3">🤖 {t.recoTitle}</div>
              <div className="text-sm text-slate-700 leading-relaxed space-y-1.5">
                {result.narrative.split('\n').filter((l) => l.trim()).map((line, i) => {
                  const clean = line.replace(/\*\*/g, '').replace(/^#+\s*/, '').replace(/^---+$/, '');
                  if (!clean.trim()) return null;
                  if (line.startsWith('**') || line.match(/^#+/)) return <div key={i} className="font-semibold text-slate-900 mt-2">{clean}</div>;
                  if (line.match(/^[-•\d]/)) return <div key={i} className="pl-2 border-l-2 border-emerald-200">{clean}</div>;
                  return <div key={i}>{clean}</div>;
                })}
              </div>
            </div>

            {/* XAI */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-sm font-medium text-slate-800 mb-3">🔍 {t.xaiTitle}</div>
              <XAIPanel xai={rec.xai} lang={lang.toLowerCase()} />
            </div>

            {/* Compliance */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-sm font-medium text-slate-800 mb-3">🛡️ {t.compTitle}</div>
              <CompliancePanel c={rec.compliance} lang={lang.toLowerCase()} />
            </div>

            <button onClick={reset} className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium rounded-lg text-sm transition-colors">
              ← {t.reset}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
