'use client';
import type { ComplianceResult } from '@/lib/harness/engine-client';

export default function CompliancePanel({ c, lang }: { c: ComplianceResult; lang: string }) {
  const dir = (d: string) => (d === '<=' ? '≤' : '≥');
  const passTxt = lang === 'vi' ? 'Đạt' : lang === 'ko' ? '적합' : 'Pass';
  const failTxt = lang === 'vi' ? 'Chưa đạt' : lang === 'ko' ? '미충족' : 'Fail';

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* QCVN */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">QCVN 09:2017/BXD</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.qcvn.passed ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
            {c.qcvn.n_pass}/{c.qcvn.n_total} {c.qcvn.passed ? passTxt : ''}
          </span>
        </div>
        <div className="text-[10px] text-slate-400 mb-2">{c.qcvn.scope_note}</div>
        <div className="space-y-1">
          {c.qcvn.checks.map((ck) => (
            <div key={ck.name} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 dark:border-slate-800 last:border-0">
              <div className="min-w-0">
                <div className="text-slate-700 dark:text-slate-300 truncate">{ck.name}</div>
                <div className="text-[10px] text-slate-400">{ck.clause}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {ck.value} {dir(ck.direction)} {ck.limit} {ck.unit}
                </span>
                <span aria-label={ck.pass ? passTxt : failTxt}
                  className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white ${ck.pass ? 'bg-emerald-500' : 'bg-red-500'}`}>
                  {ck.pass ? '✓' : '✗'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* LEED */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">LEED v5 BD+C · EA</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{c.leed.likely_tier}</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500" style={{ width: `${(c.leed.ea_points / c.leed.ea_max) * 100}%` }} />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{c.leed.ea_points}/{c.leed.ea_max} EA pts</span>
        </div>
        <div className="space-y-1">
          {c.leed.credits.map((cr) => (
            <div key={cr.name} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 dark:border-slate-800 last:border-0">
              <div className="min-w-0">
                <div className="text-slate-700 dark:text-slate-300 truncate">{cr.name}</div>
                <div className="text-[10px] text-slate-400 truncate" title={cr.detail}>{cr.detail}</div>
              </div>
              <span className="shrink-0 ml-2 text-[11px] font-medium tabular-nums">
                {cr.type === 'prerequisite'
                  ? <span className={cr.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{cr.met ? '✓' : '✗'}</span>
                  : <span className="text-blue-600 dark:text-blue-400">{cr.points}/{cr.max}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
