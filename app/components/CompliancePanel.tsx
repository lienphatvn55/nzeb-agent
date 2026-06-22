'use client';
import type { ComplianceResult } from '@/lib/harness/engine-client';

export default function CompliancePanel({ c, lang }: { c: ComplianceResult; lang: string }) {
  const dir = (d: string) => (d === '<=' ? '≤' : '≥');
  const passTxt = lang === 'vi' ? 'Đạt' : lang === 'ko' ? '적합' : 'Pass';
  const failTxt = lang === 'vi' ? 'Chưa đạt' : lang === 'ko' ? '미충족' : 'Fail';

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* QCVN */}
      <div className="border border-outline-variant/60 rounded-lg p-3 bg-surface-container-low">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-on-surface">QCVN 09:2017/BXD</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium ${c.qcvn.passed ? 'bg-primary-container/20 text-primary-container' : 'bg-tertiary-container/20 text-tertiary'}`}>
            {c.qcvn.n_pass}/{c.qcvn.n_total} {c.qcvn.passed ? passTxt : ''}
          </span>
        </div>
        <div className="text-[10px] text-on-surface-variant/70 mb-2 font-mono">{c.qcvn.scope_note}</div>
        <div className="space-y-1">
          {c.qcvn.checks.map((ck) => (
            <div key={ck.name} className="flex items-center justify-between text-xs py-1 border-b border-outline-variant/30 last:border-0">
              <div className="min-w-0">
                <div className="text-on-surface truncate">{ck.name}</div>
                <div className="text-[10px] text-on-surface-variant/60 font-mono">{ck.clause}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-on-surface-variant tabular-nums font-mono">{ck.value} {dir(ck.direction)} {ck.limit} {ck.unit}</span>
                <span aria-label={ck.pass ? passTxt : failTxt}
                  className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${ck.pass ? 'bg-primary-container text-on-primary' : 'bg-error text-error-container'}`}>
                  {ck.pass ? '✓' : '✗'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* LEED */}
      <div className="border border-outline-variant/60 rounded-lg p-3 bg-surface-container-low">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-on-surface">LEED v5 BD+C · EA</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-mono font-medium bg-primary-container/20 text-primary-container">{c.leed.likely_tier}</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-primary-container" style={{ width: `${(c.leed.ea_points / c.leed.ea_max) * 100}%` }} />
          </div>
          <span className="text-xs text-on-surface-variant tabular-nums font-mono">{c.leed.ea_points}/{c.leed.ea_max} EA</span>
        </div>
        <div className="space-y-1">
          {c.leed.credits.map((cr) => (
            <div key={cr.name} className="flex items-center justify-between text-xs py-1 border-b border-outline-variant/30 last:border-0">
              <div className="min-w-0">
                <div className="text-on-surface truncate">{cr.name}</div>
                <div className="text-[10px] text-on-surface-variant/60 truncate font-mono" title={cr.detail}>{cr.detail}</div>
              </div>
              <span className="shrink-0 ml-2 text-[11px] font-medium tabular-nums font-mono">
                {cr.type === 'prerequisite'
                  ? <span className={cr.met ? 'text-primary-container' : 'text-error'}>{cr.met ? '✓' : '✗'}</span>
                  : <span className="text-primary-container">{cr.points}/{cr.max}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
