import { describe, it, expect } from 'vitest';
import { evaluate, measureCapex, MEASURE_KEYS, N_VAR, type Building } from '../lib/engine/surrogate';
import { runNSGA3 } from '../lib/engine/nsga3';
import { assess } from '../lib/engine/compliance';
import { explain } from '../lib/engine/xai';
import { runOptimize } from '../lib/engine';

const B: Building = {
  btype: 'office', year_built: 1998, area: 5000, floors: 12,
  eui_base: 210, u_wall: 2.2, budget: 900_000,
};
const zeros = Array(N_VAR).fill(0);
const ones = Array(N_VAR).fill(1);
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe('surrogate', () => {
  it('baseline (no measures) reproduces the measured EUI', () => {
    expect(evaluate(B, zeros).f1_eui).toBeCloseTo(B.eui_base, 4);
  });

  it('a full retrofit strictly lowers EUI', () => {
    expect(evaluate(B, ones).f1_eui).toBeLessThan(evaluate(B, zeros).f1_eui);
  });

  it('capex is zero at no-retrofit and positive at full', () => {
    expect(sum(Object.values(measureCapex(B, zeros)))).toBe(0);
    expect(sum(Object.values(measureCapex(B, ones)))).toBeGreaterThan(0);
  });

  it('clamps out-of-range / NaN intensities to [0,1]', () => {
    const wild = MEASURE_KEYS.map(() => 5);
    expect(evaluate(B, wild).f1_eui).toBeCloseTo(evaluate(B, ones).f1_eui, 6);
    expect(Number.isFinite(evaluate(B, [NaN, NaN]).f1_eui)).toBe(true);
  });

  it('all three objectives are finite', () => {
    const ev = evaluate(B, ones);
    for (const v of [ev.f1_eui, ev.f2_lcc, ev.f3_wlc]) expect(Number.isFinite(v)).toBe(true);
  });
});

describe('NSGA-III', () => {
  it('returns a non-empty, budget-feasible Pareto set', () => {
    const res = runNSGA3(B, 24, 10);
    expect(res.paretoX.length).toBeGreaterThan(0);
    for (const x of res.paretoX) {
      const capex = sum(Object.values(measureCapex(B, x)));
      expect(capex).toBeLessThanOrEqual(B.budget + 1e-6);
    }
  });

  it('is deterministic for a fixed seed', () => {
    expect(runNSGA3(B, 24, 10).paretoF).toEqual(runNSGA3(B, 24, 10).paretoF);
  });
});

describe('runOptimize', () => {
  it('recommends a valid index inside the solution set', () => {
    const r = runOptimize(B, 24, 10);
    expect(r.n_solutions).toBeGreaterThan(0);
    expect(r.recommended_index).toBeGreaterThanOrEqual(0);
    expect(r.recommended_index).toBeLessThan(r.n_solutions);
    for (const k of ['min_eui', 'min_lcc', 'min_wlc'] as const) {
      expect(r.extremes[k]).toBeLessThan(r.n_solutions);
    }
  });
});

describe('compliance', () => {
  it('runs the 5 QCVN checks and a full retrofit passes at least as many as baseline', () => {
    const base = assess(B, zeros, evaluate(B, zeros).f1_eui);
    const full = assess(B, ones, evaluate(B, ones).f1_eui);
    expect(base.qcvn.checks.length).toBe(5);
    expect(full.qcvn.n_pass).toBeGreaterThanOrEqual(base.qcvn.n_pass);
  });

  it('awards more LEED EA points with a retrofit than without', () => {
    const base = assess(B, zeros, evaluate(B, zeros).f1_eui);
    const full = assess(B, ones, evaluate(B, ones).f1_eui);
    expect(full.leed.ea_points).toBeGreaterThan(base.leed.ea_points);
  });
});

describe('xai', () => {
  it('produces a positive reduction and per-measure waterfall for a full retrofit', () => {
    const x = explain(B, ones);
    expect(x.eui_reduction_pct).toBeGreaterThan(0);
    expect(x.energy_waterfall.length).toBeGreaterThan(0);
    for (const row of x.energy_waterfall) expect(row.eui_saved).toBeGreaterThanOrEqual(0);
  });
});
