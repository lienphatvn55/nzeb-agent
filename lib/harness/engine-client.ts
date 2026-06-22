/**
 * Decision-engine facade for the Agent Harness.
 *
 * The engine logic runs IN-PROCESS in TypeScript (lib/engine/*) so the whole
 * platform deploys as a single Vercel app with no separate Python service. The
 * Python engine/ (FastAPI + pymoo) is kept in the repo as the reference /
 * academic implementation; set ENGINE_URL to fall back to it if desired.
 */
import { runOptimize, runCompliance, runExplain } from '../engine';

export interface BuildingInput {
  btype: string;
  year_built: number;
  area: number;
  floors: number;
  eui_base: number;
  u_wall: number;
  budget: number;
}

export const engine = {
  optimize: async (b: BuildingInput, pop_size = 92, n_gen = 60): Promise<OptimizeResult> =>
    runOptimize(b, pop_size, n_gen),
  compliance: async (b: BuildingInput, x: number[]): Promise<ComplianceResult> =>
    runCompliance(b, x),
  explain: async (b: BuildingInput, x: number[]): Promise<XaiResult> =>
    runExplain(b, x),
};

// ---- Engine response shapes (partial, what the UI consumes) -------------- //
export interface ParetoSolution {
  x: Record<string, number>;
  f1_eui: number;
  f2_lcc: number;
  f3_wlc: number;
  capex: number;
  energy: Record<string, number>;
}

export interface ComplianceResult {
  qcvn: {
    standard: string;
    in_scope: boolean;
    scope_note: string;
    passed: boolean;
    n_pass: number;
    n_total: number;
    checks: Array<{
      name: string; clause: string; value: number; limit: number;
      unit: string; direction: string; pass: boolean; gap: number;
    }>;
  };
  leed: {
    standard: string;
    prerequisite_met: boolean;
    ea_points: number;
    ea_max: number;
    improvement_pct: number;
    pv_fraction_pct: number;
    likely_tier: string;
    credits: Array<{ name: string; type: string; points?: number; max?: number; met?: boolean; detail: string }>;
  };
  effective_properties: Record<string, number>;
}

export interface XaiResult {
  baseline_eui: number;
  post_eui: number;
  eui_reduction_pct: number;
  energy_waterfall: Array<{ key: string; name: string; eui_saved: number }>;
  cost_carbon: {
    capex: Array<{ key: string; name: string; value: number }>;
    embodied: Array<{ key: string; name: string; value: number }>;
    capex_total: number;
    embodied_total: number;
  };
  sensitivity: Array<{
    key: string; name: string; d_eui: number; d_lcc: number; d_wlc: number; active: boolean;
  }>;
  objectives: { f1_eui: number; f2_lcc: number; f3_wlc: number };
}

export interface OptimizeResult {
  n_solutions: number;
  solutions: ParetoSolution[];
  baseline: { f1_eui: number; f2_lcc: number; f3_wlc: number; capex: number };
  recommended_index: number;
  extremes: { min_eui: number; min_lcc: number; min_wlc: number };
  measures: Array<{ key: string; name: string }>;
  objective_labels: Record<string, string>;
  algorithm: { name: string; pop_size: number; generations: number; ref_dirs: string };
  recommended: {
    design: ParetoSolution;
    compliance: ComplianceResult;
    xai: XaiResult;
  };
}
