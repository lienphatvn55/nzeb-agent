'use client';
import { useState } from 'react';

const LANGS = ['EN', 'KO', 'VI'] as const;
type Lang = typeof LANGS[number];

const T: Record<Lang, Record<string, string>> = {
  EN: {
    title: 'NZEB Retrofit AI Agent',
    subtitle: 'Smart City Decision Support Platform · Hanyang University ERICA',
    s1: 'Building Input', s2: 'AI Analysis', s3: 'Compliance Check',
    p1: 'Building Information',
    ltype: 'Building type', lyear: 'Year built', larea: 'Floor area (m²)',
    lfloors: 'Floors', leui: 'Current EUI (kWh/m²/yr)',
    lwall: 'Wall U-value (W/m²K)', lbudget: 'Retrofit budget (USD)',
    btn: 'Analyze & Generate Recommendations',
    analyzing: 'Analyzing building profile...',
    m1: 'Energy savings', m2: 'CO₂ reduction', m3: 'Simple payback',
    u1: 'kWh/m²/yr', u2: 'tCO₂/yr', u3: 'years',
    p2: 'AI Retrofit Recommendations', p3: 'Compliance Assessment',
    complabel: 'Detailed Compliance Analysis',
    qcvnTitle: 'QCVN 09:2017', leedTitle: 'LEED v5 BD+C',
    qcvnSub: 'Vietnam National Technical Regulation on Energy Efficient Buildings',
    leedSub: 'Building Design & Construction — Energy & Atmosphere',
    pass: 'Compliant', fail: 'Non-compliant',
    leedGold: 'Gold likely', leedSilver: 'Silver likely', leedBase: 'Certifiable',
    oOffice: 'Office', oRes: 'Residential', oCom: 'Commercial', oMix: 'Mixed-use',
    reset: 'New Analysis',
  },
  KO: {
    title: 'NZEB 리트로핏 AI 에이전트',
    subtitle: '스마트시티 의사결정 지원 플랫폼 · 한양대학교 ERICA',
    s1: '건물 정보 입력', s2: 'AI 분석', s3: '규정 준수 검토',
    p1: '건물 정보',
    ltype: '건물 유형', lyear: '건축 연도', larea: '연면적 (m²)',
    lfloors: '층수', leui: '현재 EUI (kWh/m²/년)',
    lwall: '외벽 U값 (W/m²K)', lbudget: '리트로핏 예산 (USD)',
    btn: '분석 및 권고안 생성',
    analyzing: '건물 프로파일 분석 중...',
    m1: '에너지 절감', m2: 'CO₂ 감축', m3: '단순 회수 기간',
    u1: 'kWh/m²/년', u2: 'tCO₂/년', u3: '년',
    p2: 'AI 리트로핏 권고안', p3: '규정 준수 평가',
    complabel: '상세 규정 준수 분석',
    qcvnTitle: 'QCVN 09:2017', leedTitle: 'LEED v5 BD+C',
    qcvnSub: '베트남 에너지 효율 건축물 국가기술기준',
    leedSub: '건물 설계 및 시공 — 에너지 및 대기 항목',
    pass: '적합', fail: '미충족',
    leedGold: '골드 예상', leedSilver: '실버 예상', leedBase: '인증 가능',
    oOffice: '사무소', oRes: '주거', oCom: '상업', oMix: '복합용도',
    reset: '새 분석',
  },
  VI: {
    title: 'AI Agent Tối ưu Retrofit NZEB',
    subtitle: 'Hỗ trợ Ra quyết định Thành phố Thông minh · ĐH Hanyang ERICA',
    s1: 'Nhập thông tin', s2: 'Phân tích AI', s3: 'Kiểm tra tuân thủ',
    p1: 'Thông tin tòa nhà',
    ltype: 'Loại công trình', lyear: 'Năm xây dựng', larea: 'Diện tích sàn (m²)',
    lfloors: 'Số tầng', leui: 'EUI hiện tại (kWh/m²/năm)',
    lwall: 'Hệ số U tường (W/m²K)', lbudget: 'Ngân sách retrofit (USD)',
    btn: 'Phân tích & Tạo Khuyến nghị',
    analyzing: 'Đang phân tích hồ sơ tòa nhà...',
    m1: 'Tiết kiệm năng lượng', m2: 'Giảm CO₂', m3: 'Hoàn vốn',
    u1: 'kWh/m²/năm', u2: 'tCO₂/năm', u3: 'năm',
    p2: 'Khuyến nghị Retrofit từ AI', p3: 'Đánh giá Tuân thủ Tiêu chuẩn',
    complabel: 'Phân tích tuân thủ chi tiết',
    qcvnTitle: 'QCVN 09:2017', leedTitle: 'LEED v5 BD+C',
    qcvnSub: 'Quy chuẩn Kỹ thuật Quốc gia về Công trình Sử dụng Năng lượng Hiệu quả',
    leedSub: 'Thiết kế & Xây dựng — Tín chỉ Năng lượng và Khí quyển',
    pass: 'Đạt', fail: 'Chưa đạt',
    leedGold: 'Dự kiến Gold', leedSilver: 'Dự kiến Silver', leedBase: 'Đạt chứng nhận',
    oOffice: 'Văn phòng', oRes: 'Nhà ở', oCom: 'Thương mại', oMix: 'Hỗn hợp',
    reset: 'Phân tích mới',
  },
};

interface Metrics { savings: number; co2: number; payback: number; leedPts: number; qcvnPass: boolean; }
interface Result { reco: string; compliance: string; metrics: Metrics; }

export default function Home() {
  const [lang, setLang] = useState<Lang>('EN');

  async function switchLang(l: Lang) {
    setLang(l);
    if (result) {
      // Re-fetch với ngôn ngữ mới
      setLoading(true);
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, lang: l.toLowerCase() }),
        });
        if (!res.ok) throw new Error('Server error');
        const data = await res.json();
        setResult(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
  }
  
  const t = T[lang];
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    btype: 'office', byear: '1998', barea: '2500',
    bfloors: '8', beui: '180', bwall: '1.8', bbudget: '500000',
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function analyze() {
    setLoading(true);
    setError('');
    setStep(2);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, lang: lang.toLowerCase() }),
      });
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      setResult(data);
      setStep(3);
    } catch (e) {
      setError('Analysis failed. Please try again.');
      setStep(1);
    } finally {
      setLoading(false);
    }
  }

  function reset() { setResult(null); setStep(1); setError(''); }

  const leedLabel = result
    ? result.metrics.leedPts >= 14 ? t.leedGold
    : result.metrics.leedPts >= 8 ? t.leedSilver
    : t.leedBase
    : '';

  return (
    <main className="min-h-screen bg-slate-50 py-6 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-lg font-bold">N</div>
            <div>
              <div className="font-medium text-slate-900 text-base">{t.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{t.subtitle}</div>
            </div>
          </div>
          <div className="flex gap-1.5">
            {LANGS.map(l => (
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
              : step > i + 1 ? 'bg-emerald-50 text-emerald-600'
              : 'bg-white text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0
                ${step >= i + 1 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                {step > i + 1 ? '✓' : i + 1}
              </span>
              {label}
            </div>
          ))}
        </div>

        {/* Input form */}
        {!result && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
            <div className="text-sm font-medium text-slate-800 mb-4 flex items-center gap-2">
              🏢 {t.p1}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-slate-500 font-medium mb-1">{t.ltype}</label>
                <select value={form.btype} onChange={e => set('btype', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-slate-50 focus:outline-none focus:border-emerald-500">
                  <option value="office">{t.oOffice}</option>
                  <option value="residential">{t.oRes}</option>
                  <option value="commercial">{t.oCom}</option>
                  <option value="mixed">{t.oMix}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 font-medium mb-1">{t.lyear}</label>
                <input type="number" value={form.byear} onChange={e => set('byear', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-slate-50 focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              {[['barea', t.larea], ['bfloors', t.lfloors], ['beui', t.leui]].map(([k, label]) => (
                <div key={k}>
                  <label className="block text-xs text-slate-500 font-medium mb-1">{label}</label>
                  <input type="number" value={form[k as keyof typeof form]} onChange={e => set(k, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-slate-50 focus:outline-none focus:border-emerald-500" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[['bwall', t.lwall], ['bbudget', t.lbudget]].map(([k, label]) => (
                <div key={k}>
                  <label className="block text-xs text-slate-500 font-medium mb-1">{label}</label>
                  <input type="number" value={form[k as keyof typeof form]} onChange={e => set(k, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-slate-50 focus:outline-none focus:border-emerald-500" />
                </div>
              ))}
            </div>
            {error && <div className="text-red-500 text-xs mb-3">{error}</div>}
            <button onClick={analyze} disabled={loading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors">
              {loading ? `⏳ ${t.analyzing}` : `${t.btn} →`}
            </button>
          </div>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Metric cards */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: t.m1, val: result.metrics.savings, unit: t.u1, color: 'emerald' },
                { label: t.m2, val: result.metrics.co2, unit: t.u2, color: 'blue' },
                { label: t.m3, val: result.metrics.payback, unit: t.u3, color: 'amber' },
              ].map(({ label, val, unit, color }) => (
                <div key={label} className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500 mb-1">{label}</div>
                  <div className={`text-2xl font-semibold text-${color}-600`}>{val}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{unit}</div>
                </div>
              ))}
            </div>

            {/* Reco */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
              <div className="text-sm font-medium text-slate-800 mb-3 flex items-center gap-2">🤖 {t.p2}</div>
              <div className="text-sm text-slate-700 leading-relaxed space-y-2">
  {result.reco.split('\n').filter(l => l.trim()).map((line, i) => {
    const clean = line.replace(/\*\*/g, '').replace(/^#+\s*/, '').replace(/^---+$/, '');
    if (!clean.trim()) return null;
    if (line.startsWith('#')) return <div key={i} className="font-medium text-slate-900 mt-3">{clean}</div>;
    if (line.match(/^\d+\./)) return <div key={i} className="pl-2 border-l-2 border-emerald-200 py-1">{clean}</div>;
    if (line.startsWith('**') || line.startsWith('*')) return <div key={i} className="font-medium text-slate-800">{clean}</div>;
    return <div key={i}>{clean}</div>;
  })}
</div>
            </div>

            {/* Compliance */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
              <div className="text-sm font-medium text-slate-800 mb-3 flex items-center gap-2">🛡️ {t.p3}</div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-800">{t.qcvnTitle}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${result.metrics.qcvnPass ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {result.metrics.qcvnPass ? t.pass : t.fail}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">{t.qcvnSub}</div>
                </div>
                <div className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-800">{t.leedTitle}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">{leedLabel}</span>
                  </div>
                  <div className="text-xs text-slate-500">{t.leedSub}</div>
                </div>
              </div>
              <div className="text-xs text-slate-400 uppercase font-medium tracking-wide mb-2">{t.complabel}</div>
              <div className="text-sm text-slate-700 leading-relaxed space-y-2">
                {result.compliance.split('\n').filter(l => l.trim()).map((line, i) => {
                  const clean = line.replace(/\*\*/g, '').replace(/^#+\s*/, '').replace(/^---+$/, '');
                  if (!clean.trim()) return null;
                  if (line.startsWith('#')) return <div key={i} className="font-medium text-slate-900 mt-3">{clean}</div>;
                  if (line.match(/^\d+\./)) return <div key={i} className="pl-2 border-l-2 border-emerald-200 py-1">{clean}</div>;
                  if (line.startsWith('**') || line.startsWith('*')) return <div key={i} className="font-medium text-slate-800">{clean}</div>;
                  return <div key={i}>{clean}</div>;
                })}
              </div>
            </div>

            <button onClick={reset} className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium rounded-lg text-sm transition-colors">
              ← {t.reset}
            </button>
          </>
        )}
      </div>
    </main>
  );
}