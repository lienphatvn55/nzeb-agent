/**
 * In-process decision engine entry point — mirrors the FastAPI /optimize,
 * /compliance and /explain endpoints so the Agent Harness can call it directly
 * (no Python process) on Vercel. The Python engine/ remains the reference impl.
 */
import { Building, evaluate, MEASURES, MEASURE_KEYS } from './surrogate';
import { runNSGA3 } from './nsga3';
import { assess } from './compliance';
import { explain } from './xai';
import type { OptimizeResult, ParetoSolution, ComplianceResult, XaiResult } from '../harness/engine-client';

const OBJ_LABELS = {
  f1_eui: 'EUI (kWh/m²/yr)',
  f2_lcc: 'LCC (USD/m²)',
  f3_wlc: 'WLC (kgCO₂e/m²)',
};

function kneeIndex(F: [number, number, number][]): number {
  const n = F.length;
  const fmin = [Infinity, Infinity, Infinity];
  const fmax = [-Infinity, -Infinity, -Infinity];
  for (const f of F) for (let i = 0; i < 3; i++) { fmin[i] = Math.min(fmin[i], f[i]); fmax[i] = Math.max(fmax[i], f[i]); }
  const span = fmax.map((v, i) => (v - fmin[i] < 1e-9 ? 1 : v - fmin[i]));
  let best = 0, bestD = Infinity;
  for (let k = 0; k < n; k++) {
    let d = 0;
    for (let i = 0; i < 3; i++) { const nv = (F[k][i] - fmin[i]) / span[i]; d += nv * nv; }
    d = Math.sqrt(d);
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}

const r = (v: number, p = 2) => { const m = Math.pow(10, p); return Math.round(v * m) / m; };

export function runOptimize(b: Building, popSize = 92, nGen = 60): OptimizeResult {
  const res = runNSGA3(b, popSize, nGen);

  const solutions: ParetoSolution[] = res.paretoX.map((x) => {
    const ev = evaluate(b, x);
    const xObj: Record<string, number> = {};
    MEASURE_KEYS.forEach((k, i) => { xObj[k] = r(x[i], 3); });
    const energy: Record<string, number> = {};
    for (const [k, v] of Object.entries(ev.energy)) energy[k] = r(v as number);
    return {
      x: xObj,
      f1_eui: r(ev.f1_eui), f2_lcc: r(ev.f2_lcc), f3_wlc: r(ev.f3_wlc),
      capex: Math.round(ev.capex), energy,
    };
  });

  const F = res.paretoF;
  const recommendedIndex = kneeIndex(F);
  const argmin = (i: 0 | 1 | 2) => F.reduce((best, f, k) => (f[i] < F[best][i] ? k : best), 0);

  const recX = MEASURE_KEYS.map((k) => solutions[recommendedIndex].x[k]);

  const recommended = {
    design: solutions[recommendedIndex],
    compliance: assess(b, recX, solutions[recommendedIndex].f1_eui) as ComplianceResult,
    xai: explain(b, recX) as XaiResult,
  };

  // Baseline (no-retrofit) design, for "original vs recommended" comparison.
  const base = evaluate(b, MEASURE_KEYS.map(() => 0));

  return {
    n_solutions: solutions.length,
    solutions,
    baseline: { f1_eui: r(base.f1_eui), f2_lcc: r(base.f2_lcc), f3_wlc: r(base.f3_wlc), capex: 0 },
    recommended_index: recommendedIndex,
    extremes: { min_eui: argmin(0), min_lcc: argmin(1), min_wlc: argmin(2) },
    measures: MEASURES.map((m) => ({ key: m.key, name: m.name_en })),
    objective_labels: OBJ_LABELS,
    algorithm: { name: 'NSGA-III', pop_size: res.popSize, generations: res.generations, ref_dirs: `Das-Dennis (p=12, ${res.refDirCount} directions)` },
    recommended,
  };
}

export function runCompliance(b: Building, x: number[]): ComplianceResult {
  return assess(b, x, evaluate(b, x).f1_eui);
}

export function runExplain(b: Building, x: number[]): XaiResult {
  return explain(b, x);
}

export { evaluate };
export type { Building };
