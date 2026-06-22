/**
 * Deterministic compliance engine — TS port of engine/compliance.py.
 * QCVN 09:2017/BXD prescriptive checks + LEED v5 BD+C Energy & Atmosphere.
 */
import { Building, energyBreakdown, MEASURE_KEYS } from './surrogate';
import type { ComplianceResult } from '../harness/engine-client';

const QCVN_MIN_AREA = 2500.0;
const QCVN_WALL_U_MAX = 1.50;
const QCVN_ROOF_U_MAX = 1.00;
const QCVN_SHGC_MAX = 0.40;
const QCVN_COP_MIN = 2.90;
const QCVN_LPD_MAX: Record<string, number> = { office: 11.0, residential: 8.0, commercial: 14.0, mixed: 12.0 };

const ROOF_U_BASE = 1.80;
const SHGC_BASE = 0.62;
const LPD_BASE: Record<string, number> = { office: 16.0, residential: 12.0, commercial: 20.0, mixed: 16.0 };

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function effectiveProperties(b: Building, x: number[]) {
  const xi: Record<string, number> = {};
  MEASURE_KEYS.forEach((k, i) => { xi[k] = clamp01(x[i]); });
  const u_wall = b.u_wall - xi.wall_insulation * 0.70 * (b.u_wall - 0.40);
  const u_roof = ROOF_U_BASE - xi.roof_insulation * 0.75 * (ROOF_U_BASE - 0.30);
  const shgc = SHGC_BASE - (0.45 * xi.window_glazing + 0.40 * xi.external_shading) * SHGC_BASE;
  const lpd0 = LPD_BASE[b.btype] ?? LPD_BASE.mixed;
  const lpd = lpd0 - xi.led_lighting * 0.55 * lpd0;
  const cop = energyBreakdown(b, x).cop_new;
  return { u_wall, u_roof, shgc, lpd, cop };
}

interface Check {
  name: string; clause: string; value: number; limit: number;
  unit: string; direction: string; pass: boolean; gap: number;
}

function check(name: string, clause: string, value: number, limit: number, unit: string, direction: '<=' | '>='): Check {
  let passed: boolean, gap: number;
  if (direction === '<=') { passed = value <= limit + 1e-9; gap = value - limit; }
  else { passed = value >= limit - 1e-9; gap = limit - value; }
  return { name, clause, value: r3(value), limit, unit, direction, pass: passed, gap: r3(gap) };
}

export function checkQcvn(b: Building, x: number[]): ComplianceResult['qcvn'] {
  const p = effectiveProperties(b, x);
  const checks = [
    check('Wall thermal transmittance', 'QCVN 09:2017 §2.1 (OTTV)', p.u_wall, QCVN_WALL_U_MAX, 'W/m2K', '<='),
    check('Roof thermal transmittance', 'QCVN 09:2017 §2.1 (RTTV)', p.u_roof, QCVN_ROOF_U_MAX, 'W/m2K', '<='),
    check('Window SHGC', 'QCVN 09:2017 §2.1.3', p.shgc, QCVN_SHGC_MAX, '-', '<='),
    check('HVAC minimum COP', 'QCVN 09:2017 §2.2', p.cop, QCVN_COP_MIN, '-', '>='),
    check('Lighting power density', 'QCVN 09:2017 §2.3', p.lpd, QCVN_LPD_MAX[b.btype] ?? QCVN_LPD_MAX.mixed, 'W/m2', '<='),
  ];
  const inScope = b.area >= QCVN_MIN_AREA;
  const nPass = checks.filter((c) => c.pass).length;
  return {
    standard: 'QCVN 09:2017/BXD',
    in_scope: inScope,
    scope_note: `Floor area ${b.area.toFixed(0)} m2 ${inScope ? '≥' : '<'} ${QCVN_MIN_AREA.toFixed(0)} m2 mandatory-application threshold`,
    checks,
    passed: checks.every((c) => c.pass),
    n_pass: nPass,
    n_total: checks.length,
  };
}

export function checkLeedV5(b: Building, x: number[], euiPost: number): ComplianceResult['leed'] {
  const euiBase = b.eui_base;
  const improvement = Math.max(0, (euiBase - euiPost) / euiBase);

  const xi: Record<string, number> = {};
  MEASURE_KEYS.forEach((k, i) => { xi[k] = clamp01(x[i]); });
  const eb = energyBreakdown(b, x);
  const pvFraction = eb.pv_offset / Math.max(eb.gross_eui, 1e-6);

  const credits: ComplianceResult['leed']['credits'] = [];
  const prereq = improvement >= 0.05;
  credits.push({ name: 'Prerequisite: Minimum Energy Efficiency', type: 'prerequisite', met: prereq, detail: `${(improvement * 100).toFixed(0)}% EUI improvement (≥5% required)` });

  const optPts = Math.min(18, Math.round((improvement / 0.50) * 18));
  credits.push({ name: 'Optimize Energy Performance / Operational Carbon', type: 'credit', points: optPts, max: 18, detail: `${(improvement * 100).toFixed(0)}% reduction vs baseline EUI` });

  const renPts = Math.min(5, Math.round((pvFraction / 0.20) * 5));
  credits.push({ name: 'Renewable Energy (on-site PV)', type: 'credit', points: renPts, max: 5, detail: `${(pvFraction * 100).toFixed(0)}% of demand met by rooftop PV` });

  const elecPts = xi.hvac_upgrade > 0.5 && pvFraction > 0.05 ? 3 : xi.hvac_upgrade > 0.3 ? 2 : 0;
  credits.push({ name: 'Electrification & Grid Harmonization', type: 'credit', points: elecPts, max: 3, detail: 'Electrified high-COP HVAC + PV demand flexibility' });

  // Commissioning/metering credit is only assumed when a retrofit is actually
  // applied — flagged conditionally rather than hardcoded.
  const anyMeasure = MEASURE_KEYS.some((_, i) => clamp01(x[i]) > 0.02);
  const cxPts = anyMeasure ? 4 : 0;
  credits.push({ name: 'Enhanced Commissioning + Advanced Metering', type: 'credit', points: cxPts, max: 4, detail: anyMeasure ? 'IoT sub-metering + M&V assumed in retrofit scope' : 'No retrofit measures applied' });

  const eaPoints = credits.reduce((a, c) => a + (c.points ?? 0), 0);
  const eaMax = 30;
  let tier: string;
  if (!prereq) tier = 'Not certifiable (prerequisite unmet)';
  else if (eaPoints >= 24) tier = 'Gold likely';
  else if (eaPoints >= 16) tier = 'Silver likely';
  else if (eaPoints >= 8) tier = 'Certified likely';
  else tier = 'Below Certified';

  return {
    standard: 'LEED v5 BD+C — Energy & Atmosphere',
    prerequisite_met: prereq,
    ea_points: eaPoints,
    ea_max: eaMax,
    improvement_pct: Math.round(improvement * 1000) / 10,
    pv_fraction_pct: Math.round(pvFraction * 1000) / 10,
    credits,
    likely_tier: tier,
  };
}

export function assess(b: Building, x: number[], euiPost: number): ComplianceResult {
  return {
    qcvn: checkQcvn(b, x),
    leed: checkLeedV5(b, x, euiPost),
    effective_properties: effectiveProperties(b, x),
  };
}
