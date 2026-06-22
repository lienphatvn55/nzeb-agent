'use client';
import { useEffect, useState } from 'react';

// Live-feeling status panel shown during stage 2. The harness isn't streamed,
// so stages advance on a timer to convey progress; the last stage stays active
// until the request completes and this panel unmounts.
const STAGES: Record<string, string[]> = {
  vi: ['Tối ưu NSGA-III (đa mục tiêu)', 'Giải thích XAI (attribution)', 'Kiểm tra QCVN + LEED', 'Tổng hợp khuyến nghị'],
  en: ['NSGA-III optimisation', 'XAI attribution', 'QCVN + LEED compliance', 'Synthesising recommendation'],
  ko: ['NSGA-III 최적화', 'XAI 기여도 분석', 'QCVN + LEED 준수', '권고 종합'],
};
const TITLE: Record<string, string> = { vi: 'Agent đang chạy', en: 'Agent running', ko: 'Agent 실행 중' };

export default function RunningPanel({ lang }: { lang: string }) {
  const stages = STAGES[lang] ?? STAGES.en;
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive((a) => Math.min(a + 1, stages.length - 1)), 2600);
    return () => clearInterval(id);
  }, [stages.length]);

  return (
    <aside className="card-grad bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-slate-200/70 dark:ring-slate-800 shadow-sm p-4 fade-up lg:sticky lg:top-24">
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
        </span>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{TITLE[lang] ?? TITLE.en}</span>
      </div>
      <div className="h-1 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-3">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700"
          style={{ width: `${((active + 1) / stages.length) * 100}%` }} />
      </div>
      <ul className="space-y-2.5">
        {stages.map((s, i) => {
          const done = i < active, current = i === active;
          return (
            <li key={i} className="flex items-start gap-2.5 text-[13px]">
              <span className={`mt-px w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${done ? 'bg-emerald-500 text-white' : current ? 'bg-blue-500 text-white animate-pulse' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
                {done ? '✓' : i + 1}
              </span>
              <span className={current ? 'text-slate-800 dark:text-slate-100 font-medium' : 'text-slate-400 dark:text-slate-500'}>{s}</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
