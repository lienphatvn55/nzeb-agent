/**
 * Explainable-AI layer — TS port of engine/xai.py.
 * Model-faithful attributions over the white-box surrogate.
 */
import { Building, evaluate, MEASURES, MEASURE_KEYS } from './surrogate';
import type { XaiResult } from '../harness/engine-client';

const NAMES: Record<string, string> = Object.fromEntries(MEASURES.map((m) => [m.key, m.name_en]));
const r2 = (v: number) => Math.round(v * 100) / 100;

export function energyWaterfall(b: Building, x: number[]) {
  const eb = evaluate(b, x).energy;
  const grouped: Record<string, number> = {
    wall_insulation: eb.save_wall,
    roof_insulation: eb.save_roof * 0.7,
    cool_roof: eb.save_roof * 0.3,
    window_glazing: eb.save_window * 0.6,
    external_shading: eb.save_window * 0.4,
    led_lighting: eb.save_led,
    hvac_upgrade: eb.save_hvac,
    rooftop_pv: eb.save_pv,
  };
  const rows: { key: string; name: string; eui_saved: number }[] = [];
  MEASURE_KEYS.forEach((k, i) => {
    if (x[i] > 0.02 && grouped[k] > 0.05) rows.push({ key: k, name: NAMES[k], eui_saved: r2(grouped[k]) });
  });
  rows.sort((a, c) => c.eui_saved - a.eui_saved);
  return rows;
}

export function costCarbonSplit(b: Building, x: number[]) {
  const ev = evaluate(b, x);
  const capex = Object.entries(ev.capex_by)
    .filter(([, v]) => v > 1.0)
    .map(([k, v]) => ({ key: k, name: NAMES[k], value: Math.round(v) }))
    .sort((a, c) => c.value - a.value);
  const embodied = Object.entries(ev.embodied_by)
    .filter(([, v]) => v > 1.0)
    .map(([k, v]) => ({ key: k, name: NAMES[k], value: Math.round(v) }))
    .sort((a, c) => c.value - a.value);
  return { capex, embodied, capex_total: Math.round(ev.capex), embodied_total: Math.round(ev.embodied) };
}

export function localSensitivity(b: Building, x: number[], eps = 0.05) {
  const base = evaluate(b, x);
  const f0 = [base.f1_eui, base.f2_lcc, base.f3_wlc];
  const rows: XaiResult['sensitivity'] = [];
  MEASURE_KEYS.forEach((k, j) => {
    const xp = [...x];
    let step: number;
    if (Math.min(1, x[j] + eps) === x[j]) { xp[j] = Math.max(0, x[j] - eps); step = x[j] - xp[j]; }
    else { xp[j] = Math.min(1, x[j] + eps); step = xp[j] - x[j]; }
    if (step === 0) return;
    const ev = evaluate(b, xp);
    rows.push({
      key: k, name: NAMES[k],
      d_eui: r2((ev.f1_eui - f0[0]) / step),
      d_lcc: r2((ev.f2_lcc - f0[1]) / step),
      d_wlc: r2((ev.f3_wlc - f0[2]) / step),
      active: x[j] > 0.02,
    });
  });
  rows.sort((a, c) => Math.abs(c.d_eui) - Math.abs(a.d_eui));
  return rows;
}

export function explain(b: Building, x: number[]): XaiResult {
  const ev = evaluate(b, x);
  return {
    baseline_eui: r2(b.eui_base),
    post_eui: r2(ev.f1_eui),
    eui_reduction_pct: Math.round(((b.eui_base - ev.f1_eui) / b.eui_base) * 1000) / 10,
    energy_waterfall: energyWaterfall(b, x),
    cost_carbon: costCarbonSplit(b, x),
    sensitivity: localSensitivity(b, x),
    objectives: { f1_eui: r2(ev.f1_eui), f2_lcc: r2(ev.f2_lcc), f3_wlc: r2(ev.f3_wlc) },
  };
}
