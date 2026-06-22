'use client';
import { useState, useEffect } from 'react';
import type { OptimizeResult } from '@/lib/harness/engine-client';
import Logo from './components/Logo';
import ParetoChart from './components/ParetoChart';
import XAIPanel from './components/XAIPanel';
import CompliancePanel from './components/CompliancePanel';
import AgentTrace from './components/AgentTrace';
import Recommendation from './components/Recommendation';
import RunningPanel from './components/RunningPanel';
import RadarChart from './components/RadarChart';
import ForecastChart from './components/ForecastChart';
import BuildingViz from './components/BuildingViz';

const LANGS = ['EN', 'KO', 'VI'] as const;
type Lang = typeof LANGS[number];

const T: Record<Lang, Record<string, string>> = {
  EN: {
    tag: 'AI Retrofit Decision Platform',
    heroTitle: 'Deep-energy building retrofit, decided by an explainable AI agent.',
    heroSub: 'An agentic platform that optimises EUI, life-cycle cost and whole-life carbon with NSGA-III, checks QCVN 09:2017 + LEED v5, and explains every recommendation — toward HCMC Net-Zero Carbon 2050.',
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
    tag: 'AI 리트로핏 의사결정 플랫폼',
    heroTitle: '건물 심층 에너지 리트로핏, 설명가능한 AI 에이전트로 결정합니다.',
    heroSub: 'NSGA-III로 EUI·생애주기 비용·전생애 탄소를 최적화하고, QCVN 09:2017 + LEED v5를 검증하며, 모든 권고를 설명하는 에이전트 플랫폼 — HCMC 넷제로 2050을 향하여.',
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
    tag: 'Nền tảng Quyết định Cải tạo Năng lượng AI',
    heroTitle: 'Cải tạo sâu năng lượng tòa nhà, quyết định bằng AI Agent giải thích được.',
    heroSub: 'Nền tảng agentic tối ưu đồng thời EUI, chi phí vòng đời và carbon toàn vòng đời bằng NSGA-III, kiểm tra QCVN 09:2017 + LEED v5, và giải thích mọi khuyến nghị — hướng tới TP.HCM Net-Zero Carbon 2050.',
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
  building: { eui_base: number; floors: number; area: number; btype: string };
  narrative: string;
  trace: Array<{ step: number; tool: string; input: unknown; summary: string }>;
  steps: number;
  model: string;
  optimization: OptimizeResult | null;
}

// Group the integer part with thousand separators while preserving a decimal
// tail being typed. Used for number inputs (except year).
function groupNum(raw: string): string {
  if (!raw) return '';
  const [int, ...rest] = raw.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return rest.length ? `${grouped}.${rest.join('')}` : grouped;
}

// Cyber/teal card used by the step-3 results dashboard (Material 3 dark style).
function CyberCard({ icon, title, children, className = '' }: { icon: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`cyber-border bg-surface-container rounded-xl overflow-hidden flex flex-col fade-up ${className}`}>
      <div className="px-4 py-3 border-b border-outline-variant/40 bg-surface-container-high/40 flex items-center gap-2">
        <span className="material-symbols-outlined text-[20px] text-primary-container">{icon}</span>
        <h2 className="text-sm font-semibold text-on-surface">{title}</h2>
      </div>
      <div className="p-4 flex-1 min-w-0">{children}</div>
    </section>
  );
}

export default function Home() {
  const [lang, setLang] = useState<Lang>('VI');
  const t = T[lang];
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentResponse | null>(null);
  const [cache, setCache] = useState<Record<string, AgentResponse>>({});
  const [error, setError] = useState('');
  const [dark, setDark] = useState(false);
  const [form, setForm] = useState({
    btype: 'office', byear: '1998', barea: '5000',
    bfloors: '12', beui: '210', bwall: '2.2', bbudget: '900000',
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // One-time sync of React state from the theme class set by the pre-hydration
  // script in layout.tsx (avoids a hydration mismatch on the toggle icon).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDark(document.documentElement.classList.contains('dark')); }, []);
  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {}
  }

  async function run(l: Lang = lang) {
    const key = l.toLowerCase();
    setLoading(true); setError(''); setStep(2);
    try {
      const res = await fetch('/api/agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, lang: key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'failed');
      setCache((c) => ({ ...c, [key]: data }));
      setResult(data); setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed'); setStep(1);
    } finally { setLoading(false); }
  }

  // Switching language reuses a cached run when available (no extra API spend);
  // only the first visit to each language calls the agent.
  function switchLang(l: Lang) {
    setLang(l);
    if (!result) return;
    const cached = cache[l.toLowerCase()];
    if (cached) { setResult(cached); setStep(3); }
    else run(l);
  }
  function reset() { setResult(null); setCache({}); setStep(1); setError(''); }

  const opt = result?.optimization ?? null;
  const rec = opt ? opt.recommended : null;
  const baseEui = result?.building.eui_base ?? Number(form.beui);

  const inputCls = 'w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 bg-slate-50/70 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition';

  return (
    <div className="min-h-screen">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/70 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={34} />
            <span className="hidden sm:inline-block h-5 w-px bg-slate-200 dark:bg-slate-700" />
            <span className="hidden sm:inline text-xs font-medium text-slate-500 dark:text-slate-400">{t.tag}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} aria-label="Toggle theme"
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              {dark ? '☀️' : '🌙'}
            </button>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-full p-1">
              {LANGS.map((l) => (
                <button key={l} onClick={() => switchLang(l)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${lang === l ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 py-8">
        {/* Steps 1–2 keep the original (narrower) layout */}
        <div className="max-w-5xl mx-auto">
        {/* Hero */}
        {!result && (
          <div className="text-center max-w-3xl mx-auto mb-10 fade-up">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-950/40 ring-1 ring-blue-100 dark:ring-blue-900 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              NSGA-III · XAI · QCVN 09:2017 · LEED v5 BD+C
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight bg-gradient-to-br from-slate-900 via-slate-800 to-blue-700 dark:from-white dark:via-slate-100 dark:to-blue-300 bg-clip-text text-transparent">
              {t.heroTitle}
            </h1>
            <p className="mt-4 text-[15px] text-slate-500 dark:text-slate-400 leading-relaxed">{t.heroSub}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {['EUI', 'LCC', 'WLC', 'Net-Zero 2050', 'TP.HCM'].map((b) => (
                <span key={b} className="rounded-full bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 px-3 py-1 text-xs text-slate-600 dark:text-slate-300">{b}</span>
              ))}
            </div>
          </div>
        )}

        {/* Step indicator */}
        <div className="flex mb-6 rounded-2xl overflow-hidden ring-1 ring-slate-200/70 dark:ring-slate-800 card-grad bg-white dark:bg-slate-900 shadow-sm">
          {[t.s1, t.s2, t.s3].map((label, i) => (
            <div key={i} className={`flex-1 flex items-center gap-2.5 px-4 py-3 text-xs font-medium transition-colors
              ${step === i + 1 ? 'bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
              : step > i + 1 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                ${step >= i + 1 ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                {step > i + 1 ? '✓' : i + 1}
              </span>
              {label}
            </div>
          ))}
        </div>

        {/* Input + (during the run) live status panel on the right */}
        {!result && (
          <div className={loading ? 'grid lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start' : ''}>
            <div className="card-grad bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-800 shadow-sm p-6 fade-up">
              <div className="flex items-center gap-2.5 mb-5">
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 flex items-center justify-center">🏢</span>
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.p1}</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 font-medium mb-1.5">{t.ltype}</label>
                  <select value={form.btype} onChange={(e) => set('btype', e.target.value)} className={inputCls}>
                    <option value="office">{t.oOffice}</option>
                    <option value="residential">{t.oRes}</option>
                    <option value="commercial">{t.oCom}</option>
                    <option value="mixed">{t.oMix}</option>
                  </select>
                </div>
                {[['byear', t.lyear], ['barea', t.larea], ['bfloors', t.lfloors],
                  ['beui', t.leui], ['bwall', t.lwall], ['bbudget', t.lbudget]].map(([k, label]) => {
                  const isYear = k === 'byear';
                  return (
                    <div key={k}>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 font-medium mb-1.5">{label}</label>
                      <input
                        type="text"
                        inputMode={k === 'bwall' ? 'decimal' : 'numeric'}
                        value={isYear ? form[k as keyof typeof form] : groupNum(form[k as keyof typeof form])}
                        onChange={(e) => set(k, e.target.value.replace(isYear ? /\D/g : /[^\d.]/g, ''))}
                        className={inputCls} />
                    </div>
                  );
                })}
              </div>
              {error && <div className="text-red-600 dark:text-red-400 text-xs mb-3 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">{error}</div>}
              <button onClick={() => { setCache({}); run(); }} disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm shadow-lg shadow-blue-600/20 transition-all">
                {loading ? `⏳ ${t.analyzing}` : `${t.btn} →`}
              </button>
            </div>
            {loading && <RunningPanel lang={lang.toLowerCase()} />}
          </div>
        )}

        </div>

        {/* Results — step-3 "cyber" dashboard (wider) */}
        {result && opt && rec && (() => {
          const lc = lang.toLowerCase();
          const radarTitle = lang === 'VI' ? 'So sánh đa mục tiêu' : lang === 'KO' ? '다목적 비교' : 'Multi-objective comparison';
          const netZeroTitle = lang === 'VI' ? 'Lộ trình Net-Zero 2050' : lang === 'KO' ? '넷제로 2050 경로' : 'Net-Zero 2050 pathway';
          const buildingTitle = lang === 'VI' ? 'Mô hình tòa nhà' : lang === 'KO' ? '건물 모델' : 'Building model';
          const baseTxt = lang === 'VI' ? 'gốc' : lang === 'KO' ? '기준' : 'base';
          const base = opt.baseline;
          const kpis = [
            { icon: 'bolt', label: t.mEui, val: rec.design.f1_eui, unit: t.uEui, color: '#00e5ff', sub: `${baseTxt} ${base.f1_eui} · ↓${Math.round((1 - rec.design.f1_eui / baseEui) * 100)}%` },
            { icon: 'payments', label: t.mLcc, val: rec.design.f2_lcc, unit: t.uLcc, color: '#dae2fd', sub: `${baseTxt} ${base.f2_lcc} · NPV 25y` },
            { icon: 'eco', label: t.mWlc, val: rec.design.f3_wlc, unit: t.uWlc, color: '#00e5ff', sub: `${baseTxt} ${base.f3_wlc}` },
            { icon: 'construction', label: t.mCapex, val: `$${(rec.design.capex / 1000).toFixed(0)}k`, unit: t.uCapex, color: '#f3bf26', sub: '' },
          ];
          return (
            <div className="space-y-4 p-4 sm:p-5 rounded-2xl bg-surface text-on-surface"
              style={{ fontFamily: '"Hanken Grotesk", Inter, system-ui, sans-serif' }}>
              {/* KPI strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {kpis.map((m) => (
                  <div key={m.label} className="cyber-border bg-surface-container rounded-xl p-4 relative overflow-hidden fade-up">
                    <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full blur-xl" style={{ background: `${m.color}10` }} />
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="material-symbols-outlined text-[18px]" style={{ color: m.color }}>{m.icon}</span>
                      <span className="text-[10px] uppercase tracking-wider text-on-surface-variant font-mono">{m.label}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold font-mono tracking-tight" style={{ color: m.color }}>{m.val}</span>
                      <span className="text-xs text-secondary font-mono">{m.unit}</span>
                    </div>
                    {m.sub && <div className="text-[11px] text-on-surface-variant font-mono mt-1">{m.sub}</div>}
                  </div>
                ))}
              </div>

              {/* Bento grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <CyberCard icon="scatter_plot" title={t.pareto} className="lg:col-span-8"><ParetoChart opt={opt} labels={opt.objective_labels} /></CyberCard>
                <CyberCard icon="apartment" title={buildingTitle} className="lg:col-span-4"><BuildingViz floors={result.building.floors} area={result.building.area} btype={result.building.btype} x={rec.design.x} lang={lc} /></CyberCard>

                <CyberCard icon="psychology" title={t.recoTitle} className="lg:col-span-8"><Recommendation narrative={result.narrative} lang={lc} /></CyberCard>
                <CyberCard icon="radar" title={radarTitle} className="lg:col-span-4"><RadarChart opt={opt} lang={lc} /></CyberCard>

                <CyberCard icon="insights" title={t.xaiTitle} className="lg:col-span-4"><XAIPanel xai={rec.xai} lang={lc} /></CyberCard>
                <CyberCard icon="verified_user" title={t.compTitle} className="lg:col-span-8"><CompliancePanel c={rec.compliance} lang={lc} /></CyberCard>

                <CyberCard icon="show_chart" title={netZeroTitle} className="lg:col-span-12">
                  <ForecastChart baseEui={baseEui} postEui={rec.design.f1_eui} lang={lc} />
                </CyberCard>

                <div className="lg:col-span-12">
                  <AgentTrace trace={result.trace} steps={result.steps} model={result.model} lang={lc} />
                </div>
              </div>

              <button onClick={reset}
                className="self-start px-4 py-2 rounded-lg border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-sm font-mono transition flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">restart_alt</span>{t.reset}
              </button>
            </div>
          );
        })()}

        <footer className="mt-12 pb-6 text-center text-xs text-slate-400 dark:text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Logo size={18} showWordmark={false} /> liênnhã. · NZEB Platform — TP.HCM Net-Zero 2050
          </span>
        </footer>
      </main>
    </div>
  );
}
