'use client';
import { useState } from 'react';

interface TraceStep { step: number; tool: string; input: unknown; summary: string }

const TOOL_LABEL: Record<string, string> = {
  run_nsga3_optimization: 'NSGA-III optimisation',
  check_compliance: 'Compliance engine (QCVN + LEED)',
  explain_design: 'XAI attribution',
};

export default function AgentTrace({ trace, steps, model, lang }: {
  trace: TraceStep[]; steps: number; model: string; lang: string;
}) {
  const [open, setOpen] = useState(true);
  const title = lang === 'vi' ? 'Agent Harness — vết suy luận'
    : lang === 'ko' ? 'Agent Harness — 추론 트레이스' : 'Agent Harness — reasoning trace';
  return (
    <div className="cyber-border bg-surface-container-lowest rounded-xl p-4 fade-up">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-2 text-on-surface">
          <span className="w-2 h-2 rounded-full bg-primary-container pulse-dot" /> {title}
        </span>
        <span className="text-[10px] text-on-surface-variant font-mono">{model} · {steps} steps · {trace.length} tool calls · {open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2 font-mono text-[11px]">
          {trace.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-primary-container shrink-0">▶ tool[{i + 1}]</span>
              <div className="min-w-0">
                <span className="text-primary">{TOOL_LABEL[s.tool] ?? s.tool}</span>
                <span className="text-on-surface-variant"> → {s.summary}</span>
              </div>
            </div>
          ))}
          <div className="text-on-surface-variant/60 pt-1">✓ {trace.length} grounded engine calls</div>
        </div>
      )}
    </div>
  );
}
