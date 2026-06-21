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
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 text-slate-100 ring-1 ring-slate-700/50 shadow-md fade-up">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" /> {title}
        </span>
        <span className="text-[10px] text-slate-400">{model} · {steps} steps · {trace.length} tool calls · {open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2 font-mono text-[11px]">
          {trace.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-sky-400 shrink-0">▶ tool[{i + 1}]</span>
              <div className="min-w-0">
                <span className="text-sky-300">{TOOL_LABEL[s.tool] ?? s.tool}</span>
                <span className="text-slate-400"> → {s.summary}</span>
              </div>
            </div>
          ))}
          <div className="text-slate-500 pt-1">✓ agent synthesised grounded recommendation from {trace.length} engine calls</div>
        </div>
      )}
    </div>
  );
}
