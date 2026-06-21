/**
 * Tool layer of the Agent Harness.
 *
 * These are the *only* actions the LLM can take. Each maps to a deterministic
 * call into the Python decision engine, so the agent's reasoning is always
 * grounded in real NSGA-III / surrogate / compliance results rather than free
 * text. The dispatcher records every tool result so the route can surface the
 * full optimisation + XAI + compliance payload to the UI for visualisation.
 */
import Anthropic from '@anthropic-ai/sdk';
import { engine, BuildingInput, OptimizeResult } from './engine-client';

export const MEASURE_KEYS = [
  'wall_insulation', 'roof_insulation', 'cool_roof', 'window_glazing',
  'external_shading', 'hvac_upgrade', 'led_lighting', 'rooftop_pv',
] as const;

export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'run_nsga3_optimization',
    description:
      'Run NSGA-III multi-objective optimisation over the 8 retrofit measures. ' +
      'Minimises f1=EUI (kWh/m²/yr), f2=LCC (USD/m²), f3=WLC (kgCO₂e/m²) subject ' +
      'to the budget constraint. Returns the Pareto front, the algorithm-recommended ' +
      '(knee) design, and the objective extremes. Call this FIRST.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'check_compliance',
    description:
      'Run the deterministic compliance engine on a retrofit design against ' +
      'QCVN 09:2017/BXD (prescriptive envelope/lighting/HVAC) and LEED v5 BD+C ' +
      'Energy & Atmosphere. Returns per-clause pass/fail, gaps and LEED EA points.',
    input_schema: {
      type: 'object',
      properties: {
        x: {
          type: 'array', items: { type: 'number' },
          description:
            'Length-8 intensity vector in [0,1] ordered as: ' + MEASURE_KEYS.join(', '),
        },
      },
      required: ['x'],
    },
  },
  {
    name: 'explain_design',
    description:
      'Produce model-faithful XAI for a design: per-measure EUI-reduction ' +
      'waterfall, capex/embodied-carbon split, and local sensitivity (dF/dx) of ' +
      'each objective. Use this to justify WHY the recommendation works.',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'array', items: { type: 'number' },
          description: 'Length-8 intensity vector in [0,1].' },
      },
      required: ['x'],
    },
  },
];

export interface HarnessContext {
  building: BuildingInput;
  /** captured tool outputs for the UI */
  captured: {
    optimize?: OptimizeResult;
    compliance?: unknown[];
    explain?: unknown[];
  };
}

export async function dispatchTool(
  name: string,
  input: Record<string, unknown>,
  ctx: HarnessContext,
): Promise<unknown> {
  const b = ctx.building;
  switch (name) {
    case 'run_nsga3_optimization': {
      const res = await engine.optimize(b);
      ctx.captured.optimize = res;
      // Return a compact view to the model (full payload kept for the UI).
      return {
        n_solutions: res.n_solutions,
        algorithm: res.algorithm,
        objective_labels: res.objective_labels,
        recommended_design: res.recommended.design,
        recommended_compliance_summary: {
          qcvn_passed: res.recommended.compliance.qcvn.passed,
          qcvn_score: `${res.recommended.compliance.qcvn.n_pass}/${res.recommended.compliance.qcvn.n_total}`,
          leed_tier: res.recommended.compliance.leed.likely_tier,
          leed_ea_points: res.recommended.compliance.leed.ea_points,
        },
        extremes: {
          min_eui: res.solutions[res.extremes.min_eui],
          min_lcc: res.solutions[res.extremes.min_lcc],
          min_wlc: res.solutions[res.extremes.min_wlc],
        },
      };
    }
    case 'check_compliance': {
      const x = (input.x as number[]) ?? [];
      const res = await engine.compliance(b, x);
      (ctx.captured.compliance ??= []).push(res);
      return res;
    }
    case 'explain_design': {
      const x = (input.x as number[]) ?? [];
      const res = await engine.explain(b, x);
      (ctx.captured.explain ??= []).push(res);
      return res;
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
